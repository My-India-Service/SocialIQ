import express from 'express';
import Connection from '../models/Connection.js';
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

const router = express.Router();

router.get('/status', authRequired, async (_req, res) => {
  res.json({
    youtubeOAuth: isYouTubeConfigured(),
    metaOAuth: isMetaConfigured(),
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
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
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
    return res.redirect(`${clientUrl}/app/connections?youtube=connected`);
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
      message: `YouTube: synced ${result.imported} new (${result.updated} updated).`,
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
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
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

    return res.redirect(
      `${clientUrl}/app/connections?meta=connected&platform=${encodeURIComponent(platform)}`
    );
  } catch (err) {
    console.error('Meta OAuth callback failed:', err.message);
    return res.redirect(
      `${clientUrl}/app/connections?meta=error&platform=${encodeURIComponent(platform)}&reason=${encodeURIComponent(err.message)}`
    );
  }
});

router.post('/facebook/sync', authRequired, async (req, res) => {
  try {
    const result = await syncFacebookCommentsForUser(req.userId, {
      maxPosts: Number(req.body?.maxPosts) || 10,
      maxCommentsPerPost: Number(req.body?.maxCommentsPerPost) || 40,
    });
    res.json({
      ...result,
      analysisMode: isLLMConfigured() ? 'llm' : 'rules',
      message: `Facebook: synced ${result.imported} new (${result.updated} updated).`,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/instagram/sync', authRequired, async (req, res) => {
  try {
    const result = await syncInstagramCommentsForUser(req.userId, {
      maxMedia: Number(req.body?.maxMedia) || 12,
      maxCommentsPerMedia: Number(req.body?.maxCommentsPerMedia) || 40,
    });
    res.json({
      ...result,
      analysisMode: isLLMConfigured() ? 'llm' : 'rules',
      message: `Instagram: synced ${result.imported} new (${result.updated} updated).`,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
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
