import express from 'express';
import jwt from 'jsonwebtoken';
import PostCampaign from '../models/PostCampaign.js';
import Comment from '../models/Comment.js';

const router = express.Router();

function authUserId(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    return payload.id;
  } catch {
    return null;
  }
}

router.use((req, res, next) => {
  const userId = authUserId(req);
  if (!userId) return res.status(401).json({ message: 'Authentication required' });
  req.userId = userId;
  next();
});

router.get('/', async (req, res) => {
  try {
    const campaigns = await PostCampaign.find({ user: req.userId }).sort({ updatedAt: -1 });
    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      platform,
      externalPostId,
      postTitle,
      objective,
      keywords,
      publicReplyTemplate,
      dmLink,
      matchMode,
      bookingUrl,
      whatsappHandoffPhone,
      handoffMessage,
      active,
    } = req.body || {};
    if (!platform || !externalPostId) {
      return res.status(400).json({ message: 'platform and externalPostId are required' });
    }
    const update = {
      postTitle: postTitle || '',
      objective: objective || 'sell',
      active: active !== false,
    };
    if (keywords !== undefined) update.keywords = Array.isArray(keywords) ? keywords : [];
    if (publicReplyTemplate !== undefined) update.publicReplyTemplate = String(publicReplyTemplate);
    if (dmLink !== undefined) update.dmLink = String(dmLink);
    if (matchMode !== undefined) update.matchMode = matchMode;
    if (bookingUrl !== undefined) update.bookingUrl = String(bookingUrl);
    if (whatsappHandoffPhone !== undefined) update.whatsappHandoffPhone = String(whatsappHandoffPhone);
    if (handoffMessage !== undefined) update.handoffMessage = String(handoffMessage);

    const campaign = await PostCampaign.findOneAndUpdate(
      { user: req.userId, platform, externalPostId: String(externalPostId) },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ campaign });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const allowed = [
      'postTitle',
      'objective',
      'keywords',
      'publicReplyTemplate',
      'dmLink',
      'matchMode',
      'bookingUrl',
      'whatsappHandoffPhone',
      'handoffMessage',
      'active',
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) update[key] = req.body[key];
    }
    const campaign = await PostCampaign.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      update,
      { new: true }
    );
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    res.json({ campaign });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Per-post KPIs aggregated from comments. */
router.get('/kpis', async (req, res) => {
  try {
    const [comments, campaigns] = await Promise.all([
      Comment.find({ user: req.userId }),
      PostCampaign.find({ user: req.userId }),
    ]);
    const campaignByPost = new Map(
      campaigns.map((c) => [`${c.platform}:${c.externalPostId}`, c])
    );
    const byPost = new Map();

    for (const c of comments) {
      const key = c.videoId || c.postTitle || 'unknown';
      const campaignKey = `${c.platform}:${c.videoId || ''}`;
      const campaign = campaignByPost.get(campaignKey);
      if (!byPost.has(key)) {
        byPost.set(key, {
          externalPostId: c.videoId || '',
          postTitle: c.postTitle || 'Unknown post',
          platform: c.platform,
          objective: campaign?.objective || null,
          keywords: campaign?.keywords || [],
          matchMode: campaign?.matchMode || 'both',
          triggerCount: campaign?.triggerCount || 0,
          campaignId: campaign?._id || null,
          commentCount: 0,
          buyingIntent: 0,
          avgIntent: 0,
          pipelineValue: 0,
          converted: 0,
        });
      }
      const row = byPost.get(key);
      row.commentCount += 1;
      if (c.category === 'sales_opportunity') {
        row.buyingIntent += 1;
        row.pipelineValue += c.expectedOrderValue || 0;
      }
      row.avgIntent += c.purchaseProbability || 0;
      if (c.status === 'converted') row.converted += 1;
    }

    const posts = [...byPost.values()]
      .map((p) => ({
        ...p,
        avgIntent: p.commentCount ? Math.round(p.avgIntent / p.commentCount) : 0,
      }))
      .sort((a, b) => b.buyingIntent - a.buyingIntent);

    const avgIntentAll = comments.length
      ? comments.reduce((s, c) => s + (c.purchaseProbability || 0), 0) / comments.length
      : 0;

    for (const p of posts) {
      p.intentMultiplier =
        avgIntentAll > 0 ? Math.round((p.avgIntent / avgIntentAll) * 10) / 10 : 1;
    }

    res.json({ posts, avgIntentAll: Math.round(avgIntentAll) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
