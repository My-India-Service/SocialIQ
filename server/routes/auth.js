import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { isEmailConfigured, sendEmail } from '../services/mailer.js';
import { getClientUrl } from '../utils/clientUrl.js';
import { logInfo, logWarn } from '../services/logger.js';
import {
  isEmailOtpEnabled,
  isGoogleLoginEnabled,
  isWhatsAppEnabled,
} from '../config/features.js';
import { effectivePlanId, isTrialActive, trialDaysLeft } from '../config/plans.js';
import {
  fetchGoogleProfile,
  getGoogleLoginUrl,
  verifyGoogleLoginState,
} from '../services/googleLogin.js';

const router = express.Router();

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_MS = 60 * 1000; // 1 minute
const VALID_TONES = new Set(['professional', 'friendly', 'casual', 'luxury', 'funny']);
const VALID_OTP_PURPOSES = new Set(['verify', 'login']);

/** In-memory resend throttle: email+purpose → last sent timestamp */
const otpLastSent = new Map();

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashOtp(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Map legacy playful → casual; default unknown → friendly. */
export function normalizeTone(tone) {
  if (tone === 'playful') return 'casual';
  if (VALID_TONES.has(tone)) return tone;
  return 'friendly';
}

function normalizePhraseList(value, { maxItems = 20, maxLen = 120 } = {}) {
  const raw = Array.isArray(value)
    ? value
    : String(value || '')
        .split('\n')
        .map((s) => s.trim());
  const out = [];
  for (const item of raw) {
    const s = String(item || '')
      .trim()
      .slice(0, maxLen);
    if (!s) continue;
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

function signToken(user, { rememberMe = false } = {}) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: rememberMe ? '30d' : '7d',
  });
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt || null,
    brandName: user.brandName,
    brandDescription: user.brandDescription || '',
    brandTone: normalizeTone(user.brandTone),
    avgOrderValue: user.avgOrderValue ?? 2499,
    currency: user.currency || 'INR',
    aiProfile: {
      neverSay: user.aiProfile?.neverSay || [],
      alwaysMention: user.aiProfile?.alwaysMention || [],
    },
    integrations: {
      slackWebhookUrl: user.integrations?.slackWebhookUrl || '',
      whatsappNotifyPhone: user.integrations?.whatsappNotifyPhone || '',
      crmWebhookUrl: user.integrations?.crmWebhookUrl || '',
      autoRouteHotLeads: Boolean(user.integrations?.autoRouteHotLeads),
      hotLeadThreshold: user.integrations?.hotLeadThreshold ?? 80,
      autoReplyEnabled: Boolean(user.integrations?.autoReplyEnabled),
      autoReplyThreshold: user.integrations?.autoReplyThreshold ?? 80,
      autoReplyDailyLimit: user.integrations?.autoReplyDailyLimit ?? 20,
      autoReplyRemainingToday: (() => {
        const limit = user.integrations?.autoReplyDailyLimit ?? 20;
        const today = new Date().toISOString().slice(0, 10);
        if (user.integrations?.autoReplyTodayDate !== today) return limit;
        return Math.max(0, limit - (user.integrations?.autoReplyTodayCount || 0));
      })(),
      hasSlack: Boolean(user.integrations?.slackWebhookUrl),
      hasWhatsapp: Boolean(user.integrations?.whatsappNotifyPhone),
      hasCrm: Boolean(user.integrations?.crmWebhookUrl),
    },
    autoDm: {
      enabled: Boolean(user.autoDm?.enabled),
      catalogueUrl: user.autoDm?.catalogueUrl || '',
      couponCode: user.autoDm?.couponCode || '',
      websiteUrl: user.autoDm?.websiteUrl || '',
      publicReplyTemplate: user.autoDm?.publicReplyTemplate || 'Sent you the details in DM ❤️',
      keywords: user.autoDm?.keywords?.length
        ? user.autoDm.keywords
        : ['price', 'link', 'dm', 'info'],
      bookingUrl: user.autoDm?.bookingUrl || '',
      whatsappHandoffPhone: user.autoDm?.whatsappHandoffPhone || '',
      qualificationQuestions: user.autoDm?.qualificationQuestions?.length
        ? user.autoDm.qualificationQuestions
        : ['COD available?', 'Delivery city?', 'Pincode?'],
    },
    subscription: {
      planId: user.subscription?.planId || 'starter',
      status: user.subscription?.status || 'trialing',
      updatedAt: user.subscription?.updatedAt || null,
      trialEndsAt: user.subscription?.trialEndsAt || null,
      trialActive: isTrialActive(user),
      trialDaysLeft: trialDaysLeft(user),
      effectivePlanId: effectivePlanId(user),
    },
    onboarding: {
      platforms: user.onboarding?.platforms || [],
      primaryGoal: user.onboarding?.primaryGoal || '',
    },
    onboardingCompletedAt: user.onboardingCompletedAt || null,
    features: {
      whatsapp: isWhatsAppEnabled(),
      emailOtp: isEmailOtpEnabled(),
    },
  };
}

function clearOtpFields(user) {
  user.emailOtpHash = null;
  user.emailOtpExpires = null;
  user.emailOtpPurpose = null;
}

async function issueAndSendOtp(user, purpose) {
  const code = generateOtpCode();
  user.emailOtpHash = hashOtp(code);
  user.emailOtpExpires = new Date(Date.now() + OTP_TTL_MS);
  user.emailOtpPurpose = purpose;
  await user.save();

  const throttleKey = `${user.email}:${purpose}`;
  otpLastSent.set(throttleKey, Date.now());

  const subject = '[SocialAiDigital] Your code';
  const text = `Hi ${user.name},\n\nYour SocialAiDigital verification code is: ${code}\n\nIt expires in 10 minutes. If you did not request this, ignore this email.`;
  const html = `
    <p>Hi ${user.name},</p>
    <p>Your SocialAiDigital verification code is:</p>
    <p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p>
    <p>It expires in 10 minutes. If you did not request this, ignore this email.</p>
  `;

  const result = await sendEmail({ to: user.email, subject, text, html });
  if (!result.delivered) {
    const msg = `OTP for ${user.email} (${purpose}): ${code} — email not sent (${result.reason})`;
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[otp] ${msg}`);
      logInfo(msg, { route: '/api/auth/otp/send' });
    } else {
      logWarn(`OTP email not delivered to ${user.email}: ${result.reason}`, {
        route: '/api/auth/otp/send',
      });
    }
  }

  return {
    delivered: Boolean(result.delivered),
    // Expose code only when SMTP is off and not production (local/dev testing)
    devCode:
      !isEmailConfigured() && process.env.NODE_ENV !== 'production' ? code : undefined,
  };
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, brandName, brandTone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const otpEnabled = isEmailOtpEnabled();
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashed,
      brandName: brandName || 'My Brand',
      brandTone: normalizeTone(brandTone || 'friendly'),
      emailVerifiedAt: otpEnabled ? null : new Date(),
    });

    const token = signToken(user);
    if (!otpEnabled) {
      return res.status(201).json({ token, user: publicUser(user), needsVerification: false });
    }

    const otpMeta = await issueAndSendOtp(user, 'verify');
    res.status(201).json({
      token,
      user: publicUser(user),
      needsVerification: true,
      otpDelivered: otpMeta.delivered,
      ...(otpMeta.devCode ? { devOtp: otpMeta.devCode } : {}),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Legacy / password login: treat successful password as email ownership
    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date();
      clearOtpFields(user);
      await user.save();
    }

    res.json({
      token: signToken(user, { rememberMe: Boolean(rememberMe) }),
      user: publicUser(user),
      needsVerification: false,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const OTP_DISABLED_MESSAGE = 'Email codes are turned off. Sign in with your password or Google.';

/** Public sign-in options, read by Login/Register before a session exists. */
router.get('/config', (_req, res) => {
  res.json({ emailOtp: isEmailOtpEnabled(), googleLogin: isGoogleLoginEnabled() });
});

router.get('/google', (req, res) => {
  try {
    if (!isGoogleLoginEnabled()) {
      return res.status(503).json({ message: 'Google sign-in is not configured' });
    }
    res.json({ url: getGoogleLoginUrl({ plan: String(req.query.plan || '') }) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/google/callback', async (req, res) => {
  const clientUrl = getClientUrl();
  try {
    const { code, state, error } = req.query;
    if (error) {
      return res.redirect(`${clientUrl}/login?google=error&reason=${encodeURIComponent(String(error))}`);
    }
    if (!code || !state) {
      return res.redirect(`${clientUrl}/login?google=error&reason=missing_code`);
    }
    const { plan } = verifyGoogleLoginState(String(state));
    const profile = await fetchGoogleProfile(String(code));

    let user =
      (await User.findOne({ googleId: profile.googleId })) ||
      (await User.findOne({ email: profile.email }));
    if (user) {
      if (!user.googleId) user.googleId = profile.googleId;
      if (!user.emailVerifiedAt) {
        user.emailVerifiedAt = new Date();
        clearOtpFields(user);
      }
      await user.save();
    } else {
      user = await User.create({
        name: profile.name,
        email: profile.email,
        googleId: profile.googleId,
        password: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
        brandName: 'My Brand',
        brandTone: 'friendly',
        emailVerifiedAt: new Date(),
      });
    }

    const token = signToken(user, { rememberMe: true });
    const planParam = plan ? `&plan=${encodeURIComponent(plan)}` : '';
    return res.redirect(`${clientUrl}/auth/google/callback#token=${encodeURIComponent(token)}${planParam}`);
  } catch (err) {
    logWarn(`Google sign-in failed: ${err.message}`, { route: '/api/auth/google/callback' });
    return res.redirect(`${clientUrl}/login?google=error&reason=${encodeURIComponent(err.message)}`);
  }
});

router.post('/otp/send', async (req, res) => {
  if (!isEmailOtpEnabled()) return res.status(503).json({ message: OTP_DISABLED_MESSAGE });
  try {
    const email = req.body.email?.toLowerCase()?.trim();
    const purpose = req.body.purpose;
    if (!email || !VALID_OTP_PURPOSES.has(purpose)) {
      return res.status(400).json({ message: 'Valid email and purpose (verify|login) are required' });
    }

    const throttleKey = `${email}:${purpose}`;
    const last = otpLastSent.get(throttleKey) || 0;
    if (Date.now() - last < OTP_RESEND_MS) {
      const waitSec = Math.ceil((OTP_RESEND_MS - (Date.now() - last)) / 1000);
      return res.status(429).json({ message: `Please wait ${waitSec}s before requesting another code` });
    }

    const user = await User.findOne({ email });
    if (!user) {
      if (purpose === 'login') {
        return res.json({
          message: 'If an account exists for that email, a code was sent.',
          otpDelivered: false,
        });
      }
      return res.status(404).json({ message: 'No account found for that email' });
    }

    if (purpose === 'verify' && user.emailVerifiedAt) {
      return res.json({ message: 'Email already verified', alreadyVerified: true });
    }

    const otpMeta = await issueAndSendOtp(user, purpose);
    res.json({
      message: 'Verification code sent',
      otpDelivered: otpMeta.delivered,
      ...(otpMeta.devCode ? { devOtp: otpMeta.devCode } : {}),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/otp/verify', async (req, res) => {
  if (!isEmailOtpEnabled()) return res.status(503).json({ message: OTP_DISABLED_MESSAGE });
  try {
    const email = req.body.email?.toLowerCase()?.trim();
    const code = String(req.body.code || '').trim();
    const purpose = req.body.purpose;
    const rememberMe = Boolean(req.body.rememberMe);

    if (!email || !code || !VALID_OTP_PURPOSES.has(purpose)) {
      return res.status(400).json({ message: 'Email, code, and purpose are required' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: 'Enter the 6-digit code' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired code' });
    }

    if (
      !user.emailOtpHash ||
      !user.emailOtpExpires ||
      user.emailOtpPurpose !== purpose ||
      user.emailOtpExpires < new Date() ||
      user.emailOtpHash !== hashOtp(code)
    ) {
      return res.status(401).json({ message: 'Invalid or expired code' });
    }

    clearOtpFields(user);
    if (purpose === 'verify' || purpose === 'login') {
      user.emailVerifiedAt = user.emailVerifiedAt || new Date();
    }
    await user.save();

    res.json({
      token: signToken(user, { rememberMe }),
      user: publicUser(user),
      needsVerification: false,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase()?.trim();
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const genericMessage =
      'If an account exists for that email, you will receive a password reset link shortly.';

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: genericMessage });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = hashResetToken(rawToken);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const clientUrl = getClientUrl();
    const resetUrl = `${clientUrl}/reset-password?token=${rawToken}`;

    const result = await sendEmail({
      to: user.email,
      subject: 'Reset your SocialAiDigital password',
      text: `Hi ${user.name},\n\nReset your password using this link (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      html: `
        <p>Hi ${user.name},</p>
        <p>Reset your password using the link below. It expires in 1 hour.</p>
        <p><a href="${resetUrl}">Reset password</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      `,
    });

    if (!result.delivered) {
      console.warn(`[forgot-password] Email not sent (${result.reason}). Reset link for ${user.email}: ${resetUrl}`);
    }

    res.json({ message: genericMessage });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({
      resetPasswordToken: hashResetToken(token),
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset link. Please request a new one.' });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: 'Password updated. You can log in with your new password.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: publicUser(user) });
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

router.patch('/brand', async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const {
      brandName,
      brandTone,
      brandDescription,
      avgOrderValue,
      currency,
      integrations,
      autoDm,
      aiProfile,
    } = req.body;

    const user = await User.findById(payload.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (brandName !== undefined) user.brandName = brandName;
    if (brandTone !== undefined) user.brandTone = normalizeTone(brandTone);
    if (brandDescription !== undefined) {
      user.brandDescription = String(brandDescription).trim().slice(0, 2000);
    }
    if (avgOrderValue !== undefined) user.avgOrderValue = Math.max(0, Number(avgOrderValue) || 0);
    if (currency !== undefined) user.currency = currency;

    if (aiProfile && typeof aiProfile === 'object') {
      user.aiProfile = user.aiProfile || {};
      if (aiProfile.neverSay !== undefined) {
        user.aiProfile.neverSay = normalizePhraseList(aiProfile.neverSay);
      }
      if (aiProfile.alwaysMention !== undefined) {
        user.aiProfile.alwaysMention = normalizePhraseList(aiProfile.alwaysMention);
      }
      user.markModified('aiProfile');
    }

    if (integrations && typeof integrations === 'object') {
      user.integrations = user.integrations || {};
      if (integrations.slackWebhookUrl !== undefined) {
        user.integrations.slackWebhookUrl = String(integrations.slackWebhookUrl).trim();
      }
      if (integrations.whatsappNotifyPhone !== undefined) {
        user.integrations.whatsappNotifyPhone = String(integrations.whatsappNotifyPhone).trim();
      }
      if (integrations.crmWebhookUrl !== undefined) {
        user.integrations.crmWebhookUrl = String(integrations.crmWebhookUrl).trim();
      }
      if (integrations.autoRouteHotLeads !== undefined) {
        user.integrations.autoRouteHotLeads = Boolean(integrations.autoRouteHotLeads);
      }
      if (integrations.hotLeadThreshold !== undefined) {
        user.integrations.hotLeadThreshold = Math.max(
          0,
          Math.min(100, Number(integrations.hotLeadThreshold) || 80)
        );
      }
      if (integrations.autoReplyEnabled !== undefined) {
        user.integrations.autoReplyEnabled = Boolean(integrations.autoReplyEnabled);
      }
      if (integrations.autoReplyThreshold !== undefined) {
        user.integrations.autoReplyThreshold = Math.max(
          0,
          Math.min(100, Number(integrations.autoReplyThreshold) || 80)
        );
      }
      if (integrations.autoReplyDailyLimit !== undefined) {
        user.integrations.autoReplyDailyLimit = Math.max(
          1,
          Math.min(500, Number(integrations.autoReplyDailyLimit) || 20)
        );
      }
      user.markModified('integrations');
    }

    if (autoDm && typeof autoDm === 'object') {
      user.autoDm = user.autoDm || {};
      if (autoDm.enabled !== undefined) user.autoDm.enabled = Boolean(autoDm.enabled);
      if (autoDm.catalogueUrl !== undefined) user.autoDm.catalogueUrl = String(autoDm.catalogueUrl).trim();
      if (autoDm.couponCode !== undefined) user.autoDm.couponCode = String(autoDm.couponCode).trim();
      if (autoDm.websiteUrl !== undefined) user.autoDm.websiteUrl = String(autoDm.websiteUrl).trim();
      if (autoDm.publicReplyTemplate !== undefined) {
        user.autoDm.publicReplyTemplate = String(autoDm.publicReplyTemplate).trim();
      }
      if (autoDm.keywords !== undefined) {
        user.autoDm.keywords = Array.isArray(autoDm.keywords)
          ? autoDm.keywords.map((k) => String(k).trim()).filter(Boolean)
          : String(autoDm.keywords)
              .split(',')
              .map((k) => k.trim())
              .filter(Boolean);
      }
      if (autoDm.bookingUrl !== undefined) user.autoDm.bookingUrl = String(autoDm.bookingUrl).trim();
      if (autoDm.whatsappHandoffPhone !== undefined) {
        user.autoDm.whatsappHandoffPhone = String(autoDm.whatsappHandoffPhone).trim();
      }
      if (autoDm.qualificationQuestions !== undefined) {
        user.autoDm.qualificationQuestions = Array.isArray(autoDm.qualificationQuestions)
          ? autoDm.qualificationQuestions.map((q) => String(q).trim()).filter(Boolean)
          : String(autoDm.qualificationQuestions)
              .split('\n')
              .map((q) => q.trim())
              .filter(Boolean);
      }
      user.markModified('autoDm');
    }

    await user.save();
    res.json({ user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/onboarding', async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { brandName, brandTone, avgOrderValue, currency, onboarding, complete } = req.body || {};

    if (brandName !== undefined) user.brandName = String(brandName).trim() || 'My Brand';
    if (brandTone !== undefined) user.brandTone = normalizeTone(brandTone);
    if (avgOrderValue !== undefined) user.avgOrderValue = Math.max(0, Number(avgOrderValue) || 0);
    if (currency !== undefined) user.currency = currency;

    if (onboarding && typeof onboarding === 'object') {
      user.onboarding = user.onboarding || {};
      if (Array.isArray(onboarding.platforms)) {
        user.onboarding.platforms = onboarding.platforms.filter(Boolean);
      }
      if (onboarding.primaryGoal !== undefined) {
        user.onboarding.primaryGoal = onboarding.primaryGoal;
      }
      user.markModified('onboarding');
    }

    if (complete) {
      if (!user.emailVerifiedAt && isEmailOtpEnabled()) {
        return res.status(403).json({
          message: 'Verify your email before finishing onboarding',
          needsVerification: true,
        });
      }
      user.onboardingCompletedAt = new Date();
    }

    await user.save();
    res.json({ user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const VALID_PLAN_IDS = ['starter', 'growth', 'business', 'enterprise'];

/** Mock plan switch — no payment. Enterprise should use contact sales in UI. */
router.patch('/subscription', async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const { planId } = req.body || {};
    if (!VALID_PLAN_IDS.includes(planId)) {
      return res.status(400).json({ message: 'Invalid plan' });
    }

    const user = await User.findById(payload.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.subscription = user.subscription || {};
    user.subscription.planId = planId;
    user.subscription.status = 'active';
    user.subscription.updatedAt = new Date();
    user.markModified('subscription');
    await user.save();

    res.json({ user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
