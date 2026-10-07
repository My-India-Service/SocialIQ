import express from 'express';
import Connection from '../models/Connection.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { isLLMConfigured } from '../services/ai.js';
import {
  syncFacebookCommentsForUser,
  syncInstagramCommentsForUser,
  syncLinkedInCommentsForUser,
  syncTikTokCommentsForUser,
  syncYouTubeCommentsForUser,
} from '../services/sync.js';
import {
  exchangeYouTubeCode,
  getYouTubeAuthUrl,
  isYouTubeConfigured,
  revokeGoogleToken,
  saveYouTubeConnection,
  verifyYouTubeOAuthState,
} from '../services/youtube.js';
import { logError } from '../services/logger.js';
import {
  exchangeMetaCodeAndSave,
  getMetaAuthUrl,
  isMetaConfigured,
  verifyMetaOAuthState,
} from '../services/meta.js';
import {
  exchangeInstagramCodeAndSave,
  getInstagramAuthUrl,
  isInstagramDirectOAuthConfigured,
  verifyInstagramOAuthState,
} from '../services/instagramLogin.js';
import {
  exchangeLinkedInCode,
  getLinkedInAuthUrl,
  getLinkedInOAuthScopes,
  isLinkedInConfigured,
  linkedInConnectErrorMessage,
  saveLinkedInConnection,
  verifyLinkedInOAuthState,
} from '../services/linkedin.js';
import {
  exchangeTikTokCode,
  getTikTokAuthUrl,
  isTikTokConfigured,
  saveTikTokConnection,
  verifyTikTokOAuthState,
} from '../services/tiktok.js';
import { getClientUrl } from '../utils/clientUrl.js';
import {
  clampFacebookSyncOptions,
  clampInstagramSyncOptions,
  metaPauseReason,
  metaWritesRemaining,
  DAILY_META_WRITE_BUDGET,
  MAX_AUTO_HIDES_PER_SYNC,
} from '../services/metaSafe.js';

function appendAutoReplySummary(message, result) {
  let out = message;
  if (result.autoReplied > 0) {
    out += ` Auto-replied on platform: ${result.autoReplied}.`;
  }
  if (result.autoReplyFailed > 0) {
    out += ` Auto-reply failed: ${result.autoReplyFailed} (check Connect permissions).`;
  }
  if (result.autoReplySkippedDaily > 0) {
    out += ` Auto-reply stopped: daily limit reached (${result.autoReplySkippedDaily} skipped). Raise the limit in Settings or try tomorrow.`;
  }
  if (result.autoReplySkippedSyncCap > 0) {
    out += ` Auto-reply capped at 5 per sync for Meta safety (${result.autoReplySkippedSyncCap} skipped). Sync again later for more.`;
  }
  if (result.autoHidden > 0) {
    out += ` Auto-hidden: ${result.autoHidden}.`;
  }
  if (result.autoHideSkippedCap > 0) {
    out += ` Auto-hide capped at ${MAX_AUTO_HIDES_PER_SYNC} per sync for Meta safety (${result.autoHideSkippedCap} left flagged for review).`;
  }
  return out;
}

/** Reconnecting refreshes the token, so lift any circuit-breaker pause. */
async function clearMetaPause(userId) {
  await Connection.updateMany(
    { user: userId, platform: { $in: ['facebook', 'instagram'] } },
    { $set: { metaPausedUntil: null, metaPauseReason: '' } }
  );
}

async function oauthSuccessRedirect(userId, platform) {
  const clientUrl = getClientUrl();
  const user = await User.findById(userId);
  if (user && !user.onboardingCompletedAt) {
    return `${clientUrl}/onboarding?connected=${encodeURIComponent(platform)}`;
  }
  if (platform === 'youtube') {
    return `${clientUrl}/app/connections?youtube=connected`;
  }
  if (platform === 'instagram') {
    return `${clientUrl}/app/connections?instagram=connected`;
  }
  if (platform === 'linkedin') {
    return `${clientUrl}/app/connections?linkedin=connected`;
  }
  if (platform === 'tiktok') {
    return `${clientUrl}/app/connections?tiktok=connected`;
  }
  return `${clientUrl}/app/connections?meta=connected&platform=${encodeURIComponent(platform)}`;
}

const router = express.Router();

router.get('/status', authRequired, async (_req, res) => {
  res.json({
    youtubeOAuth: isYouTubeConfigured(),
    metaOAuth: isMetaConfigured(),
    instagramDirectOAuth: isInstagramDirectOAuthConfigured(),
    linkedinOAuth: isLinkedInConfigured(),
    linkedinScopes: isLinkedInConfigured() ? getLinkedInOAuthScopes() : [],
    tiktokOAuth: isTikTokConfigured(),
    llm: isLLMConfigured(),
  });
});

router.get('/', authRequired, async (req, res) => {
  try {
    const rows = await Connection.find({ user: req.userId }).sort({ createdAt: 1 });
    const connections = rows.map((c) => ({
      id: c._id,
      platform: c.platform,
      accountName: c.accountName,
      channelId: c.channelId,
      status: c.status,
      lastSyncedAt: c.lastSyncedAt,
      connectedAt: c.connectedAt,
      metaAuthType: c.metaAuthType || '',
      hasOAuth: Boolean(c.accessToken || c.refreshToken),
      ...(c.platform === 'facebook' || c.platform === 'instagram'
        ? {
            metaPausedUntil: metaPauseReason(c) ? c.metaPausedUntil : null,
            metaPauseReason: metaPauseReason(c),
            metaWritesRemaining: metaWritesRemaining(c),
            metaWriteBudget: DAILY_META_WRITE_BUDGET,
          }
        : {}),
    }));
    res.json({ connections });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Start Google YouTube OAuth */
router.get('/youtube/auth', authRequired, async (req, res) => {
  try {
    if (!isYouTubeConfigured()) {
      return res.status(503).json({
        message:
          'YouTube OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to server/.env',
      });
    }
    const url = getYouTubeAuthUrl(req.userId);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/youtube/callback', async (req, res) => {
  const clientUrl = getClientUrl();
  try {
    const { code, state, error } = req.query;
    if (error) {
      return res.redirect(
        `${clientUrl}/app/connections?youtube=error&reason=${encodeURIComponent(String(error))}`
      );
    }
    if (!code || !state) {
      return res.redirect(`${clientUrl}/app/connections?youtube=error&reason=missing_code`);
    }

    const userId = verifyYouTubeOAuthState(String(state));
    const result = await exchangeYouTubeCode(String(code));

    const existing = await Connection.findOne({ user: userId, platform: 'youtube' });
    if (!result.tokens.refresh_token && existing?.refreshToken) {
      result.tokens.refresh_token = existing.refreshToken;
    }

    await saveYouTubeConnection(userId, result);
    return res.redirect(await oauthSuccessRedirect(userId, 'youtube'));
  } catch (err) {
    logError(err, { route: '/api/connections/youtube/callback', method: 'GET' });
    return res.redirect(
      `${clientUrl}/app/connections?youtube=error&reason=${encodeURIComponent(err.message)}`
    );
  }
});

function parseSyncDay(value, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const d = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatSyncDay(date) {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

router.post('/youtube/sync', authRequired, async (req, res) => {
  try {
    const since = parseSyncDay(req.body?.since);
    let until = parseSyncDay(req.body?.until, true);
    if ((req.body?.since && !since) || (req.body?.until && !until)) {
      return res.status(400).json({ message: 'Dates must be in YYYY-MM-DD format.' });
    }
    if (since && until && since > until) {
      return res.status(400).json({ message: 'From date must be before To date.' });
    }
    const backfillSince = since || (until ? new Date(until.getTime() - 365 * 86400000) : null);
    if (until && until > new Date()) until = null;

    const result = await syncYouTubeCommentsForUser(req.userId, {
      maxVideos: Number(req.body?.maxVideos) || 8,
      maxCommentsPerVideo: Number(req.body?.maxCommentsPerVideo) || 40,
      since: backfillSince,
      until,
    });
    const period = backfillSince
      ? ` from ${formatSyncDay(backfillSince)} – ${formatSyncDay(until || new Date())}`
      : '';
    res.json({
      ...result,
      analysisMode: isLLMConfigured() ? 'llm' : 'rules',
      message: appendAutoReplySummary(
        `YouTube: synced ${result.imported} new (${result.updated} updated)${period}.`,
        result
      ),
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/** Start Meta OAuth for facebook | instagram */
router.get('/meta/auth', authRequired, async (req, res) => {
  try {
    if (!isMetaConfigured()) {
      return res.status(503).json({
        message: 'Meta OAuth not configured. Add META_APP_ID and META_APP_SECRET to server/.env',
      });
    }
    const platform = req.query.platform === 'instagram' ? 'instagram' : 'facebook';
    const url = getMetaAuthUrl(req.userId, platform);
    res.json({ url, platform });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/meta/callback', async (req, res) => {
  const clientUrl = getClientUrl();
  let platform = 'facebook';
  try {
    const { code, state, error } = req.query;
    if (error) {
      return res.redirect(
        `${clientUrl}/app/connections?meta=error&reason=${encodeURIComponent(String(error))}`
      );
    }
    if (!code || !state) {
      return res.redirect(`${clientUrl}/app/connections?meta=error&reason=missing_code`);
    }

    const parsed = verifyMetaOAuthState(String(state));
    platform = parsed.platform;
    await exchangeMetaCodeAndSave(parsed.userId, platform, String(code));
    await clearMetaPause(parsed.userId);

    return res.redirect(await oauthSuccessRedirect(parsed.userId, platform));
  } catch (err) {
    logError(err, { route: '/api/connections/meta/callback', method: 'GET' });
    return res.redirect(
      `${clientUrl}/app/connections?meta=error&platform=${encodeURIComponent(platform)}&reason=${encodeURIComponent(err.message)}`
    );
  }
});

/** Start Instagram Business Login (instagram.com OAuth — no Facebook Page required) */
router.get('/instagram/auth', authRequired, async (req, res) => {
  try {
    if (!isInstagramDirectOAuthConfigured()) {
      return res.status(503).json({
        message:
          'Instagram Login not configured. Add META_INSTAGRAM_APP_ID and META_INSTAGRAM_APP_SECRET to server/.env (Meta App Dashboard → Instagram → API setup with Instagram login).',
      });
    }
    const url = getInstagramAuthUrl(req.userId);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/instagram/callback', async (req, res) => {
  const clientUrl = getClientUrl();
  try {
    const { code, state, error } = req.query;
    if (error) {
      return res.redirect(
        `${clientUrl}/app/connections?instagram=error&reason=${encodeURIComponent(String(error))}`
      );
    }
    if (!code || !state) {
      return res.redirect(`${clientUrl}/app/connections?instagram=error&reason=missing_code`);
    }

    const userId = verifyInstagramOAuthState(String(state));
    await exchangeInstagramCodeAndSave(userId, String(code));
    await clearMetaPause(userId);

    return res.redirect(await oauthSuccessRedirect(userId, 'instagram'));
  } catch (err) {
    logError(err, { route: '/api/connections/instagram/callback', method: 'GET' });
    return res.redirect(
      `${clientUrl}/app/connections?instagram=error&reason=${encodeURIComponent(err.message)}`
    );
  }
});

router.post('/facebook/sync', authRequired, async (req, res) => {
  try {
    const result = await syncFacebookCommentsForUser(
      req.userId,
      clampFacebookSyncOptions(req.body || {})
    );
    const scan =
      typeof result.scannedPosts === 'number'
        ? ` Scanned ${result.scannedPosts} posts (${result.postsWithCommentSignal ?? 0} with comment signal); checked ${result.postsChecked ?? 0}.`
        : typeof result.postsChecked === 'number'
          ? ` Checked ${result.postsChecked} posts.`
          : '';
    const base = `Facebook: synced ${result.imported} new (${result.updated} updated) from ${result.fetched} fetched.${scan}`;
    const hint = result.warning
      ? ` ${result.warning}`
      : result.fetched === 0
        ? ' No comments imported — enable pages_read_engagement + pages_read_user_content in Meta, Reconnect the correct Facebook Page (must match Comments Manager), then Sync again.'
        : '';
    res.json({
      ...result,
      analysisMode: isLLMConfigured() ? 'llm' : 'rules',
      message: appendAutoReplySummary(`${base}${hint}`, result),
    });
  } catch (err) {
    const status = err.status || (err.code === 'SYNC_COOLDOWN' ? 429 : 400);
    res.status(status).json({ message: err.message, code: err.code });
  }
});

router.post('/instagram/sync', authRequired, async (req, res) => {
  try {
    const result = await syncInstagramCommentsForUser(
      req.userId,
      clampInstagramSyncOptions(req.body || {})
    );
    const scan =
      typeof result.mediaChecked === 'number'
        ? ` Checked ${result.mediaChecked} posts (${result.mediaWithCommentSignal ?? 0} with comment signal).`
        : '';
    const base = `Instagram: synced ${result.imported} new (${result.updated} updated) from ${result.fetched} fetched.${scan}`;
    const hint = result.warning
      ? ` ${result.warning}`
      : result.fetched === 0
        ? ' No comments imported — post a test comment as an app Admin/Developer/Tester, then Sync again. For public commenters, complete App Review and set the app Live.'
        : '';
    res.json({
      ...result,
      analysisMode: isLLMConfigured() ? 'llm' : 'rules',
      message: appendAutoReplySummary(`${base}${hint}`, result),
    });
  } catch (err) {
    const status = err.status || (err.code === 'SYNC_COOLDOWN' ? 429 : 400);
    res.status(status).json({ message: err.message, code: err.code });
  }
});

/** Start LinkedIn OAuth (Company Page comments via Community Management API) */
router.get('/linkedin/auth', authRequired, async (req, res) => {
  try {
    if (!isLinkedInConfigured()) {
      return res.status(503).json({
        message:
          'LinkedIn OAuth not configured. Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to server/.env',
      });
    }
    const url = getLinkedInAuthUrl(req.userId);
    console.log(`LinkedIn OAuth start scopes=${getLinkedInOAuthScopes().join(' ')}`);
    res.json({ url, scopes: getLinkedInOAuthScopes() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/linkedin/callback', async (req, res) => {
  const clientUrl = getClientUrl();
  try {
    const { code, state, error, error_description: errorDescription } = req.query;
    if (error) {
      const reason = linkedInConnectErrorMessage(error, errorDescription);
      return res.redirect(
        `${clientUrl}/app/connections?linkedin=error&reason=${encodeURIComponent(reason)}`
      );
    }
    if (!code || !state) {
      return res.redirect(`${clientUrl}/app/connections?linkedin=error&reason=missing_code`);
    }

    const userId = verifyLinkedInOAuthState(String(state));
    const result = await exchangeLinkedInCode(String(code));

    const existing = await Connection.findOne({ user: userId, platform: 'linkedin' });
    if (!result.tokens.refresh_token && existing?.refreshToken) {
      result.tokens.refresh_token = existing.refreshToken;
    }

    await saveLinkedInConnection(userId, result);
    return res.redirect(await oauthSuccessRedirect(userId, 'linkedin'));
  } catch (err) {
    logError(err, { route: '/api/connections/linkedin/callback', method: 'GET' });
    return res.redirect(
      `${clientUrl}/app/connections?linkedin=error&reason=${encodeURIComponent(
        linkedInConnectErrorMessage(err.message, err.message)
      )}`
    );
  }
});

router.post('/linkedin/sync', authRequired, async (req, res) => {
  try {
    const result = await syncLinkedInCommentsForUser(req.userId, {
      maxPosts: Number(req.body?.maxPosts) || 10,
      maxCommentsPerPost: Number(req.body?.maxCommentsPerPost) || 40,
    });
    const scan =
      typeof result.postsChecked === 'number' ? ` Checked ${result.postsChecked} posts.` : '';
    const base = `LinkedIn: synced ${result.imported} new (${result.updated} updated) from ${result.fetched} fetched.${scan}`;
    const hint = result.warning
      ? ` ${result.warning}`
      : result.fetched === 0
        ? ' No comments imported — connect a Company Page you admin, enable Community Management API, then Sync again.'
        : '';
    res.json({
      ...result,
      analysisMode: isLLMConfigured() ? 'llm' : 'rules',
      message: appendAutoReplySummary(`${base}${hint}`, result),
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/** Start TikTok OAuth (Login Kit) */
router.get('/tiktok/auth', authRequired, async (req, res) => {
  try {
    if (!isTikTokConfigured()) {
      return res.status(503).json({
        message:
          'TikTok OAuth not configured. Add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET to server/.env',
      });
    }
    const url = getTikTokAuthUrl(req.userId);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/tiktok/callback', async (req, res) => {
  const clientUrl = getClientUrl();
  try {
    const { code, state, error, error_description: errorDescription } = req.query;
    if (error) {
      return res.redirect(
        `${clientUrl}/app/connections?tiktok=error&reason=${encodeURIComponent(String(errorDescription || error))}`
      );
    }
    if (!code || !state) {
      return res.redirect(`${clientUrl}/app/connections?tiktok=error&reason=missing_code`);
    }

    const userId = verifyTikTokOAuthState(String(state));
    const result = await exchangeTikTokCode(String(code));

    const existing = await Connection.findOne({ user: userId, platform: 'tiktok' });
    if (!result.tokens.refresh_token && existing?.refreshToken) {
      result.tokens.refresh_token = existing.refreshToken;
    }

    await saveTikTokConnection(userId, result);
    return res.redirect(await oauthSuccessRedirect(userId, 'tiktok'));
  } catch (err) {
    logError(err, { route: '/api/connections/tiktok/callback', method: 'GET' });
    return res.redirect(
      `${clientUrl}/app/connections?tiktok=error&reason=${encodeURIComponent(err.message)}`
    );
  }
});

router.post('/tiktok/sync', authRequired, async (req, res) => {
  try {
    const result = await syncTikTokCommentsForUser(req.userId, {
      maxVideos: Number(req.body?.maxVideos) || 8,
      maxCommentsPerVideo: Number(req.body?.maxCommentsPerVideo) || 40,
    });
    const scan =
      typeof result.videosChecked === 'number' ? ` Checked ${result.videosChecked} videos.` : '';
    const base = `TikTok: synced ${result.imported} new (${result.updated} updated) from ${result.fetched} fetched.${scan}`;
    const hint = result.warning
      ? ` ${result.warning}`
      : result.fetched === 0
        ? ' No comments imported — post a public video, enable video.list on your TikTok app, then Sync again.'
        : '';
    res.json({
      ...result,
      analysisMode: isLLMConfigured() ? 'llm' : 'rules',
      message: appendAutoReplySummary(`${base}${hint}`, result),
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:platform', authRequired, async (req, res) => {
  try {
    const removed = await Connection.findOneAndDelete({
      user: req.userId,
      platform: req.params.platform,
    });
    if (removed && req.params.platform === 'youtube') {
      await revokeGoogleToken(removed.refreshToken || removed.accessToken);
    }
    res.json({ message: 'Disconnected' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
