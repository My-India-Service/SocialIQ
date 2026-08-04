import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendEmail } from '../services/mailer.js';

const router = express.Router();

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    brandName: user.brandName,
    brandTone: user.brandTone,
    avgOrderValue: user.avgOrderValue ?? 2499,
    currency: user.currency || 'INR',
    integrations: {
      slackWebhookUrl: user.integrations?.slackWebhookUrl || '',
      whatsappWebhookUrl: user.integrations?.whatsappWebhookUrl || '',
      crmWebhookUrl: user.integrations?.crmWebhookUrl || '',
      autoRouteHotLeads: Boolean(user.integrations?.autoRouteHotLeads),
      hotLeadThreshold: user.integrations?.hotLeadThreshold ?? 80,
      hasSlack: Boolean(user.integrations?.slackWebhookUrl),
      hasWhatsapp: Boolean(user.integrations?.whatsappWebhookUrl),
      hasCrm: Boolean(user.integrations?.crmWebhookUrl),
    },
    autoDm: {
      enabled: Boolean(user.autoDm?.enabled),
      catalogueUrl: user.autoDm?.catalogueUrl || '',
      couponCode: user.autoDm?.couponCode || '',
      websiteUrl: user.autoDm?.websiteUrl || '',
    },
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

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashed,
      brandName: brandName || 'My Brand',
      brandTone: brandTone || 'friendly',
    });

    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({ token: signToken(user), user: publicUser(user) });
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

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password?token=${rawToken}`;

    const result = await sendEmail({
      to: user.email,
      subject: 'Reset your Voxa password',
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
      avgOrderValue,
      currency,
      integrations,
      autoDm,
    } = req.body;

    const user = await User.findById(payload.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (brandName !== undefined) user.brandName = brandName;
    if (brandTone !== undefined) user.brandTone = brandTone;
    if (avgOrderValue !== undefined) user.avgOrderValue = Math.max(0, Number(avgOrderValue) || 0);
    if (currency !== undefined) user.currency = currency;

    if (integrations && typeof integrations === 'object') {
      user.integrations = user.integrations || {};
      if (integrations.slackWebhookUrl !== undefined) {
        user.integrations.slackWebhookUrl = String(integrations.slackWebhookUrl).trim();
      }
      if (integrations.whatsappWebhookUrl !== undefined) {
        user.integrations.whatsappWebhookUrl = String(integrations.whatsappWebhookUrl).trim();
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
      user.markModified('integrations');
    }

    if (autoDm && typeof autoDm === 'object') {
      user.autoDm = user.autoDm || {};
      if (autoDm.enabled !== undefined) user.autoDm.enabled = Boolean(autoDm.enabled);
      if (autoDm.catalogueUrl !== undefined) user.autoDm.catalogueUrl = String(autoDm.catalogueUrl).trim();
      if (autoDm.couponCode !== undefined) user.autoDm.couponCode = String(autoDm.couponCode).trim();
      if (autoDm.websiteUrl !== undefined) user.autoDm.websiteUrl = String(autoDm.websiteUrl).trim();
      user.markModified('autoDm');
    }

    await user.save();
    res.json({ user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
