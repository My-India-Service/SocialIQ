import Connection from '../models/Connection.js';
import Comment from '../models/Comment.js';
import { postFacebookCommentReply, postInstagramCommentReply } from './meta.js';
import { postYouTubeCommentReply } from './youtube.js';
import { paceOutboundMetaWrite } from './metaSafe.js';

export {
  META_SYNC_COOLDOWN_MS,
  MAX_AUTO_REPLIES_PER_SYNC,
  assertMetaSyncCooldown,
  paceOutboundMetaWrite,
  randomOutboundDelayMs,
} from './metaSafe.js';

export const POST_REPLY_PLATFORMS = ['youtube', 'facebook', 'instagram'];
export const PENDING_REPLY_ID = 'pending';
export const PENDING_REPLY_TTL_MS = 2 * 60 * 1000;

export function canPostReplyToPlatform(platform) {
  return POST_REPLY_PLATFORMS.includes(platform);
}

export function isAlreadyPosted(comment) {
  if (comment?.postedReplyAt) return true;
  const id = comment?.platformReplyId;
  if (!id) return false;
  if (id === PENDING_REPLY_ID) {
    const claimedAt = comment.replyClaimedAt ? new Date(comment.replyClaimedAt).getTime() : 0;
    if (claimedAt && Date.now() - claimedAt < PENDING_REPLY_TTL_MS) return true;
    // Stale pending — treat as not posted so reclaim can proceed
    return false;
  }
  return true;
}

export function assertNotAlreadyPosted(comment) {
  if (isAlreadyPosted(comment)) {
    const err = new Error('Reply already posted on platform — use Copy reply to edit manually.');
    err.status = 409;
    throw err;
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function shouldAutoReply(user, comment) {
  if (!user?.integrations?.autoReplyEnabled) return false;
  if (!canPostReplyToPlatform(comment.platform)) return false;
  if (isAlreadyPosted(comment)) return false;
  if (comment.category === 'spam') return false;
  if (['complaint', 'shipping_issue', 'refund_request'].includes(comment.category)) return false;
  if (!comment.suggestedReply?.trim()) return false;
  if (!comment.externalId) return false;

  const threshold = user.integrations.autoReplyThreshold ?? 80;
  const isHot = comment.leadTemperature === 'hot';
  const isSales =
    comment.category === 'sales_opportunity' && comment.purchaseProbability >= threshold;
  return isHot || isSales;
}

export function autoReplyRemainingToday(user) {
  const limit = user.integrations?.autoReplyDailyLimit ?? 20;
  const today = todayKey();
  if (user.integrations?.autoReplyTodayDate !== today) return limit;
  return Math.max(0, limit - (user.integrations?.autoReplyTodayCount || 0));
}

export function canAutoReplyToday(user) {
  return autoReplyRemainingToday(user) > 0;
}

export function dailyAutoReplyLimitMessage(user) {
  const limit = user?.integrations?.autoReplyDailyLimit ?? 20;
  return `Daily auto-reply limit reached (${limit}/day). Raise the limit in Settings or try again tomorrow. Public replies and Instagram DMs both count toward this budget.`;
}

export function recordAutoReplySuccess(user) {
  user.integrations = user.integrations || {};
  const today = todayKey();
  if (user.integrations.autoReplyTodayDate !== today) {
    user.integrations.autoReplyTodayCount = 0;
    user.integrations.autoReplyTodayDate = today;
  }
  user.integrations.autoReplyTodayCount = (user.integrations.autoReplyTodayCount || 0) + 1;
  user.markModified('integrations');
}

/**
 * Atomic claim so sync + webhook cannot double-post the same comment.
 * Sets platformReplyId to "pending" until the real Graph id is saved.
 * Stale pending locks older than PENDING_REPLY_TTL_MS are reclaimable.
 */
export async function claimCommentForPlatformReply(commentId) {
  const staleBefore = new Date(Date.now() - PENDING_REPLY_TTL_MS);
  const updated = await Comment.findOneAndUpdate(
    {
      _id: commentId,
      $and: [
        {
          $or: [{ postedReplyAt: { $exists: false } }, { postedReplyAt: null }],
        },
        {
          $or: [
            { platformReplyId: { $exists: false } },
            { platformReplyId: null },
            { platformReplyId: '' },
            {
              platformReplyId: PENDING_REPLY_ID,
              replyClaimedAt: { $lte: staleBefore },
            },
            {
              platformReplyId: PENDING_REPLY_ID,
              replyClaimedAt: { $exists: false },
              updatedAt: { $lte: staleBefore },
            },
          ],
        },
      ],
    },
    { $set: { platformReplyId: PENDING_REPLY_ID, replyClaimedAt: new Date() } },
    { new: true }
  );
  return updated;
}

export async function clearPendingPlatformReply(commentId) {
  await Comment.updateOne(
    { _id: commentId, platformReplyId: PENDING_REPLY_ID },
    { $unset: { platformReplyId: 1, replyClaimedAt: 1 } }
  );
}

/**
 * Post a public reply on YouTube, Facebook, or Instagram. Returns platform reply id.
 * Uses claim + outbound pacing for Meta platforms to reduce automation flags.
 */
export async function postCommentReplyToPlatform(userId, comment, message, options = {}) {
  const { pace = true, claim = true } = options;
  assertNotAlreadyPosted(comment);

  const text = String(message || comment.suggestedReply || '').trim();
  if (!text) throw new Error('Reply message is required');
  if (!canPostReplyToPlatform(comment.platform)) {
    throw new Error(`Posting replies is not supported for ${comment.platform} yet`);
  }
  if (!comment.externalId) {
    throw new Error('Comment id missing — sync comments again from Connect');
  }

  const commentId = comment._id || comment.id;
  if (claim && commentId) {
    const claimed = await claimCommentForPlatformReply(commentId);
    if (!claimed) {
      const err = new Error('Reply already posted on platform — use Copy reply to edit manually.');
      err.status = 409;
      throw err;
    }
  }

  const connection = await Connection.findOne({
    user: userId,
    platform: comment.platform,
    status: 'connected',
  });
  if (!connection?.accessToken && !connection?.refreshToken) {
    if (claim && commentId) await clearPendingPlatformReply(commentId);
    throw new Error(`${comment.platform} is not connected — open Connect and link your account`);
  }

  try {
    if (pace && (comment.platform === 'facebook' || comment.platform === 'instagram')) {
      await paceOutboundMetaWrite();
    }

    if (comment.platform === 'youtube') {
      const platformReplyId = await postYouTubeCommentReply(connection, comment.externalId, text);
      return { platformReplyId, message: text };
    }

    if (comment.platform === 'instagram') {
      const platformReplyId = await postInstagramCommentReply(connection, comment.externalId, text);
      return { platformReplyId, message: text };
    }

    const platformReplyId = await postFacebookCommentReply(connection, comment.externalId, text);
    return { platformReplyId, message: text };
  } catch (err) {
    if (claim && commentId) await clearPendingPlatformReply(commentId);
    throw err;
  }
}
