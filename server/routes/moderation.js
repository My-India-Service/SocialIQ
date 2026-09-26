import express from 'express';
import mongoose from 'mongoose';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { MODERATION_FLAG_LABELS, scoreModeration } from '../services/moderation.js';
import { canModerateOnPlatform, moderateComment } from '../services/moderationActions.js';
import { logError } from '../services/logger.js';
import { MAX_BULK_PLATFORM_WRITES, META_SAFETY_CODES } from '../services/metaSafe.js';

const router = express.Router();
router.use(authRequired);

const ACTIONS = new Set(['hide', 'unhide', 'delete', 'allow', 'flag', 'mark_spam']);
const MAX_BULK = 100;
const PLATFORM_ACTIONS = new Set(['hide', 'unhide', 'delete']);
const META_PLATFORMS = new Set(['facebook', 'instagram']);

function viewFilter(userId, view, platform) {
  const filter = { user: userId };
  if (platform && platform !== 'all') filter.platform = platform;
  switch (view) {
    case 'hidden':
      filter.moderationStatus = 'hidden';
      break;
    case 'deleted':
      filter.moderationStatus = 'deleted';
      break;
    case 'spam':
      filter.category = 'spam';
      filter.moderationStatus = { $nin: ['deleted'] };
      break;
    case 'toxic':
      filter.toxicity = { $gte: 35 };
      filter.moderationStatus = { $nin: ['deleted', 'allowed'] };
      break;
    case 'all':
      break;
    default:
      filter.moderationStatus = 'flagged';
  }
  return filter;
}

function serialize(c) {
  return {
    id: c._id,
    platform: c.platform,
    author: c.author,
    authorHandle: c.authorHandle || '',
    text: c.text,
    postTitle: c.postTitle || '',
    category: c.category,
    spamScore: c.spamScore || 0,
    toxicity: c.toxicity || 0,
    flags: (c.moderationFlags || []).map((f) => ({ id: f, label: MODERATION_FLAG_LABELS[f] || f })),
    moderationStatus: c.moderationStatus || 'visible',
    moderationError: c.moderationError || '',
    moderatedAt: c.moderatedAt,
    postedAt: c.postedAt || c.createdAt,
    canModerateOnPlatform: canModerateOnPlatform(c.platform) && Boolean(c.externalId),
  };
}

function publicSettings(user) {
  return {
    sensitivity: user?.moderation?.sensitivity || 'medium',
    autoHide: Boolean(user?.moderation?.autoHide),
    hideCompetitorAds: user?.moderation?.hideCompetitorAds !== false,
    customKeywords: user?.moderation?.customKeywords || [],
  };
}

router.get('/', async (req, res) => {
  try {
    const view = String(req.query.view || 'flagged');
    const [user, comments, counts] = await Promise.all([
      User.findById(req.userId).select('moderation'),
      Comment.find(viewFilter(req.userId, view, req.query.platform))
        .sort({ postedAt: -1 })
        .limit(200),
      Comment.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(req.userId) } },
        {
          $group: {
            _id: null,
            flagged: { $sum: { $cond: [{ $eq: ['$moderationStatus', 'flagged'] }, 1, 0] } },
            hidden: { $sum: { $cond: [{ $eq: ['$moderationStatus', 'hidden'] }, 1, 0] } },
            deleted: { $sum: { $cond: [{ $eq: ['$moderationStatus', 'deleted'] }, 1, 0] } },
            spam: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$category', 'spam'] }, { $ne: ['$moderationStatus', 'deleted'] }] },
                  1,
                  0,
                ],
              },
            },
            toxic: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$toxicity', 35] },
                      { $not: [{ $in: ['$moderationStatus', ['deleted', 'allowed']] }] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);
    res.json({
      view,
      counts: counts[0] || { flagged: 0, hidden: 0, deleted: 0, spam: 0, toxic: 0 },
      comments: comments.map(serialize),
      settings: publicSettings(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    const { ids, action } = req.body || {};
    if (!ACTIONS.has(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Select at least one comment' });
    }
    if (ids.length > MAX_BULK) {
      return res.status(400).json({ message: `Select up to ${MAX_BULK} comments at a time` });
    }

    const comments = await Comment.find({ _id: { $in: ids }, user: req.userId });
    const results = [];
    let metaWrites = 0;
    let metaStopReason = '';
    for (const comment of comments) {
      const isMetaWrite =
        PLATFORM_ACTIONS.has(action) &&
        META_PLATFORMS.has(comment.platform) &&
        canModerateOnPlatform(comment.platform) &&
        Boolean(comment.externalId);
      if (isMetaWrite && !metaStopReason && metaWrites >= MAX_BULK_PLATFORM_WRITES) {
        metaStopReason = `Meta safety: only ${MAX_BULK_PLATFORM_WRITES} platform actions per batch`;
      }
      const localOnly = isMetaWrite && Boolean(metaStopReason);
      try {
        const { onPlatform } = await moderateComment(req.userId, comment, action, { localOnly });
        if (isMetaWrite && onPlatform) metaWrites += 1;
        if (localOnly) {
          comment.moderationError = `${metaStopReason} — updated in SocialAiDigital only`;
          await comment.save();
        }
        results.push({ id: comment._id, ok: true, onPlatform, localOnly });
      } catch (err) {
        if (isMetaWrite && META_SAFETY_CODES.includes(err.code)) {
          metaStopReason = err.message;
          const { onPlatform } = await moderateComment(req.userId, comment, action, {
            localOnly: true,
          });
          comment.moderationError = `${err.message} — updated in SocialAiDigital only`;
          await comment.save();
          results.push({ id: comment._id, ok: true, onPlatform, localOnly: true });
          continue;
        }
        comment.moderationError = err.message;
        await comment.save();
        results.push({ id: comment._id, ok: false, error: err.message });
      }
    }

    const ok = results.filter((r) => r.ok).length;
    const onPlatform = results.filter((r) => r.onPlatform).length;
    const localOnly = results.filter((r) => r.localOnly).length;
    const failed = results.length - ok;
    if (failed) {
      logError(`Moderation ${action}: ${failed}/${results.length} failed`, {
        route: '/api/moderation/bulk',
        method: 'POST',
        userId: String(req.userId),
        firstError: results.find((r) => !r.ok)?.error,
      });
    }

    let message = `${ok} comment${ok === 1 ? '' : 's'} updated`;
    if (onPlatform) message += ` · ${onPlatform} on platform`;
    if (localOnly) message += ` · ${localOnly} local only (${metaStopReason})`;
    if (failed) message += ` · ${failed} failed (see row errors)`;
    res.json({ message, results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/settings', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { sensitivity, autoHide, hideCompetitorAds, customKeywords } = req.body || {};
    user.moderation = user.moderation || {};
    if (['low', 'medium', 'high'].includes(sensitivity)) user.moderation.sensitivity = sensitivity;
    if (autoHide !== undefined) user.moderation.autoHide = Boolean(autoHide);
    if (hideCompetitorAds !== undefined) user.moderation.hideCompetitorAds = Boolean(hideCompetitorAds);
    if (customKeywords !== undefined) {
      const list = Array.isArray(customKeywords) ? customKeywords : String(customKeywords).split(/[,\n]/);
      user.moderation.customKeywords = [
        ...new Set(list.map((k) => String(k).trim().toLowerCase()).filter(Boolean)),
      ].slice(0, 100);
    }
    user.markModified('moderation');
    await user.save();
    res.json({ settings: publicSettings(user), message: 'Moderation rules saved' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Re-score recent comments with current rules; never overrides hidden/deleted/allowed. */
router.post('/rescan', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('moderation');
    const comments = await Comment.find({
      user: req.userId,
      moderationStatus: { $in: ['visible', 'flagged'] },
    })
      .sort({ postedAt: -1 })
      .limit(1000);

    let flagged = 0;
    for (const c of comments) {
      const mod = scoreModeration(c.text, user?.moderation || {});
      c.spamScore = mod.spamScore;
      c.toxicity = mod.toxicity;
      c.moderationFlags = mod.moderationFlags;
      c.moderationStatus = mod.shouldFlag ? 'flagged' : 'visible';
      if (mod.shouldFlag) flagged += 1;
      await c.save();
    }
    res.json({ scanned: comments.length, flagged, message: `Rescanned ${comments.length} comments · ${flagged} flagged` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
