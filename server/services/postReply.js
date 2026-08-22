import Connection from '../models/Connection.js';
import { postFacebookCommentReply, postInstagramCommentReply } from './meta.js';
import { postYouTubeCommentReply } from './youtube.js';

export const POST_REPLY_PLATFORMS = ['youtube', 'facebook', 'instagram'];

export function canPostReplyToPlatform(platform) {
  return POST_REPLY_PLATFORMS.includes(platform);
}

export function isAlreadyPosted(comment) {
  return Boolean(comment?.postedReplyAt || comment?.platformReplyId);
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
  const limit = user.integrations?.autoReplyDailyLimit ?? 50;
  const today = todayKey();
  if (user.integrations?.autoReplyTodayDate !== today) return limit;
  return Math.max(0, limit - (user.integrations?.autoReplyTodayCount || 0));
}

export function canAutoReplyToday(user) {
  return autoReplyRemainingToday(user) > 0;
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
 * Post a public reply on YouTube, Facebook, or Instagram. Returns platform reply id.
 */
export async function postCommentReplyToPlatform(userId, comment, message) {
  assertNotAlreadyPosted(comment);

  const text = String(message || comment.suggestedReply || '').trim();
  if (!text) throw new Error('Reply message is required');
  if (!canPostReplyToPlatform(comment.platform)) {
    throw new Error(`Posting replies is not supported for ${comment.platform} yet`);
  }
  if (!comment.externalId) {
    throw new Error('Comment id missing — sync comments again from Connect');
  }

  const connection = await Connection.findOne({
    user: userId,
    platform: comment.platform,
    status: 'connected',
  });
  if (!connection?.accessToken && !connection?.refreshToken) {
    throw new Error(`${comment.platform} is not connected — open Connect and link your account`);
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
}
