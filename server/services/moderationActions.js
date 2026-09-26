import Connection from '../models/Connection.js';
import {
  deleteFacebookComment,
  deleteInstagramComment,
  setFacebookCommentHidden,
  setInstagramCommentHidden,
} from './meta.js';
import { setYouTubeCommentModeration } from './youtube.js';
import {
  assertMetaWriteAllowed,
  paceOutboundMetaWrite,
  recordMetaWrite,
  withMetaGuard,
} from './metaSafe.js';

export const PLATFORM_MODERATION = ['facebook', 'instagram', 'youtube'];

export function canModerateOnPlatform(platform) {
  return PLATFORM_MODERATION.includes(platform);
}

/**
 * Apply hide / unhide / delete on the source platform.
 * YouTube cannot delete other people's comments — "delete" rejects it (removed from public view).
 * @returns {{ onPlatform: boolean }}
 */
export async function applyPlatformModeration(
  userId,
  comment,
  action,
  { pace = true, automated = false, localOnly = false } = {}
) {
  if (localOnly || !canModerateOnPlatform(comment.platform) || !comment.externalId) {
    return { onPlatform: false };
  }

  const connection = await Connection.findOne({
    user: userId,
    platform: comment.platform,
    status: 'connected',
  });
  if (!connection?.accessToken && !connection?.refreshToken) {
    throw new Error(`${comment.platform} is not connected — open Connect to moderate on the platform`);
  }

  if (comment.platform === 'youtube') {
    const status =
      action === 'hide' ? 'heldForReview' : action === 'unhide' ? 'published' : 'rejected';
    await setYouTubeCommentModeration(connection, comment.externalId, status);
    return { onPlatform: true };
  }

  assertMetaWriteAllowed(connection, { automated });
  if (pace) await paceOutboundMetaWrite();

  await withMetaGuard(connection, async () => {
    if (comment.platform === 'instagram') {
      if (action === 'delete') await deleteInstagramComment(connection, comment.externalId);
      else await setInstagramCommentHidden(connection, comment.externalId, action === 'hide');
      return;
    }
    if (action === 'delete') await deleteFacebookComment(connection, comment.externalId);
    else await setFacebookCommentHidden(connection, comment.externalId, action === 'hide');
  });
  await recordMetaWrite(connection);
  return { onPlatform: true };
}

const LOCAL_STATUS = {
  hide: 'hidden',
  unhide: 'visible',
  delete: 'deleted',
  allow: 'allowed',
  flag: 'flagged',
};

/**
 * Run a moderation action on one comment: platform call when supported, then persist status.
 * allow / flag / mark_spam are local-only.
 */
export async function moderateComment(userId, comment, action, options = {}) {
  let onPlatform = false;
  if (['hide', 'unhide', 'delete'].includes(action)) {
    const result = await applyPlatformModeration(userId, comment, action, options);
    onPlatform = result.onPlatform;
  }

  if (action === 'mark_spam') {
    comment.category = 'spam';
    comment.suggestedReply = '';
    comment.leadTemperature = 'none';
    comment.purchaseProbability = 0;
    comment.expectedOrderValue = 0;
    comment.moderationStatus = 'flagged';
    if (!comment.moderationFlags.includes('marked_spam')) {
      comment.moderationFlags = [...comment.moderationFlags, 'marked_spam'];
    }
  } else {
    comment.moderationStatus = LOCAL_STATUS[action] || comment.moderationStatus;
    if (action === 'delete' && comment.status === 'new') comment.status = 'ignored';
  }
  comment.moderatedAt = new Date();
  comment.moderationError = '';
  await comment.save();
  return { onPlatform };
}
