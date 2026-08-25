import express from 'express';
import Connection from '../models/Connection.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { isLLMConfigured } from '../services/ai.js';
import {
  syncFacebookCommentsForUser,
  syncInstagramCommentsForUser,
  syncYouTubeCommentsForUser,
} from '../services/sync.js';
import {
  exchangeYouTubeCode,
  getYouTubeAuthUrl,
  isYouTubeConfigured,
  saveYouTubeConnection,
  verifyYouTubeOAuthState,
} from '../services/youtube.js';
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
import { getClientUrl } from '../utils/clientUrl.js';

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
  return out;
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
  return `${clientUrl}/app/connections?meta=connected&platform=${encodeURIComponent(platform)}`;
}

const router = express.Router();

router.get('/status', authRequired, async (_req, res) => {
  res.json({
    youtubeOAuth: isYouTubeConfigured(),
    metaOAuth: isMetaConfigured(),
    instagramDirectOAuth: isInstagramDirectOAuthConfigured(),
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
    console.error('YouTube OAuth callback failed:', err.message);
    return res.redirect(
      `${clientUrl}/app/connections?youtube=error&reason=${encodeURIComponent(err.message)}`
    );
  }
});

router.post('/youtube/sync', authRequired, async (req, res) => {
  try {
    const result = await syncYouTubeCommentsForUser(req.userId, {
      maxVideos: Number(req.body?.maxVideos) || 8,
      maxCommentsPerVideo: Number(req.body?.maxCommentsPerVideo) || 40,
    });
    res.json({
      ...result,
      analysisMode: isLLMConfigured() ? 'llm' : 'rules',
      message: appendAutoReplySummary(
        `YouTube: synced ${result.imported} new (${result.updated} updated).`,
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

    return res.redirect(await oauthSuccessRedirect(parsed.userId, platform));
  } catch (err) {
    console.error('Meta OAuth callback failed:', err.message);
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

    return res.redirect(await oauthSuccessRedirect(userId, 'instagram'));
  } catch (err) {
    console.error('Instagram OAuth callback failed:', err.message);
    return res.redirect(
      `${clientUrl}/app/connections?instagram=error&reason=${encodeURIComponent(err.message)}`
    );
  }
});

router.post('/facebook/sync', authRequired, async (req, res) => {
  try {
    const result = await syncFacebookCommentsForUser(req.userId, {
      maxPosts: Number(req.body?.maxPosts) || 20,
      maxCommentsPerPost: Number(req.body?.maxCommentsPerPost) || 25,
      maxScan: Number(req.body?.maxScan) || 80,
    });
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
    const result = await syncInstagramCommentsForUser(req.userId, {
      maxMedia: Number(req.body?.maxMedia) || 10,
      maxCommentsPerMedia: Number(req.body?.maxCommentsPerMedia) || 25,
    });
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

router.delete('/:platform', authRequired, async (req, res) => {
  try {
    await Connection.findOneAndDelete({ user: req.userId, platform: req.params.platform });
    res.json({ message: 'Disconnected' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
