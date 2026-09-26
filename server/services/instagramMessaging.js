import Connection from '../models/Connection.js';
import Conversation from '../models/Conversation.js';
import { getInstagramGraphBase, resolveInstagramMetaAuthType } from './meta.js';
import { getValidInstagramDirectAccessToken } from './instagramLogin.js';
import { buildAutoDmPreview } from './ai.js';
import { planHasSalesAgent } from '../config/plans.js';
import {
  canAutoReplyToday,
  dailyAutoReplyLimitMessage,
  isAlreadyPosted,
  postCommentReplyToPlatform,
  recordAutoReplySuccess,
} from './postReply.js';
import {
  assertMetaWriteAllowed,
  fetchGraphWithBackoff,
  paceOutboundMetaWrite,
  recordMetaWrite,
  withMetaGuard,
} from './metaSafe.js';
import { incrementCampaignTrigger } from './campaignTriggers.js';

export function isInstagramMessagingConfigured() {
  return Boolean(process.env.META_INSTAGRAM_MESSAGING_ENABLED === 'true');
}

export function publicReplyForSalesAgent(user, campaign) {
  if (campaign?.publicReplyTemplate?.trim()) return campaign.publicReplyTemplate.trim();
  if (user?.autoDm?.publicReplyTemplate?.trim()) return user.autoDm.publicReplyTemplate.trim();
  return 'Sent you the details in DM ❤️';
}

async function instagramGraphPost(connection, path, body = {}, { automated = true } = {}) {
  assertMetaWriteAllowed(connection, { automated });
  const base = getInstagramGraphBase(connection);
  const token =
    resolveInstagramMetaAuthType(connection) === 'instagram_direct'
      ? await getValidInstagramDirectAccessToken(connection)
      : connection.accessToken;

  const url = new URL(`${base}/${path}`);
  url.searchParams.set('access_token', token);

  const data = await withMetaGuard(connection, () =>
    fetchGraphWithBackoff(() =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    )
  );
  await recordMetaWrite(connection);
  return data;
}

/** Meta only allows one private reply per comment, within 7 days of the comment. */
export const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function privateReplyBlockReason(comment, now = Date.now()) {
  if (comment?.autoDmStatus === 'sent' || comment?.privateReplySentAt) {
    return 'Private reply already sent for this comment (Meta allows only one).';
  }
  const postedAt = comment?.postedAt ? new Date(comment.postedAt).getTime() : 0;
  if (postedAt && now - postedAt > PRIVATE_REPLY_WINDOW_MS) {
    return 'Comment is older than 7 days — Meta no longer allows a private reply.';
  }
  return null;
}

/**
 * Send private reply to an Instagram comment (requires instagram_business_manage_messages + App Review).
 */
export async function sendPrivateReplyToComment(connection, commentExternalId, message) {
  if (!commentExternalId || !message?.trim()) {
    throw new Error('Comment ID and message required');
  }
  return instagramGraphPost(connection, `${commentExternalId}/private_replies`, {
    message: message.trim(),
  });
}

/** Send DM in an existing Instagram messaging thread (requires manage_messages + App Review). */
export async function sendInstagramDm(connection, recipientId, message, { automated = true } = {}) {
  if (!recipientId || !message?.trim()) {
    throw new Error('Recipient ID and message required');
  }
  const igUserId = connection.channelId;
  if (!igUserId) {
    throw new Error('Instagram business account id missing on connection');
  }
  return instagramGraphPost(
    connection,
    `${igUserId}/messages`,
    {
      recipient: { id: String(recipientId) },
      message: { text: message.trim() },
    },
    { automated }
  );
}

export async function findInstagramConnection(userId) {
  return Connection.findOne({
    user: userId,
    platform: 'instagram',
    status: 'connected',
  });
}

/**
 * Full sales-agent flow: public reply on comment + private DM + conversation thread.
 */
export async function runInstagramSalesAgentFlow({ user, comment, connection, campaign }) {
  if (!connection) {
    connection = await findInstagramConnection(user._id || user.id);
  }
  if (!connection) {
    return { ok: false, reason: 'no_instagram_connection' };
  }

  const planId = user.subscription?.planId || 'starter';
  if (!planHasSalesAgent(planId)) {
    return {
      ok: false,
      reason: 'plan_upgrade_required',
      preview: buildAutoDmPreview(user, comment.text, { dmLink: campaign?.dmLink }),
    };
  }

  const dmText = buildAutoDmPreview(user, comment.text, { dmLink: campaign?.dmLink });
  const publicReply = publicReplyForSalesAgent(user, campaign);
  let dmResult = null;
  let dmError = null;
  let publicReplyPosted = false;
  let publicReplyError = null;

  if (!isAlreadyPosted(comment) && comment.externalId && canAutoReplyToday(user)) {
    try {
      const { platformReplyId, message } = await postCommentReplyToPlatform(
        user._id || user.id,
        comment,
        publicReply,
        { automated: true }
      );
      comment.suggestedReply = message;
      comment.platformReplyId = platformReplyId;
      comment.postedReplyAt = new Date();
      comment.replyClaimedAt = undefined;
      if (comment.status !== 'sent_to_sales') comment.status = 'replied';
      publicReplyPosted = true;
      recordAutoReplySuccess(user);
      await user.save();
    } catch (err) {
      publicReplyError = err.message;
      console.warn('[instagramMessaging] public reply failed:', err.message);
    }
  }

  if (isInstagramMessagingConfigured() && comment.externalId && comment.platform === 'instagram') {
    const privateReplyBlocked = privateReplyBlockReason(comment);
    if (privateReplyBlocked) {
      dmError = privateReplyBlocked;
    } else if (!canAutoReplyToday(user)) {
      dmError = dailyAutoReplyLimitMessage(user);
    } else {
      try {
        await paceOutboundMetaWrite();
        dmResult = await sendPrivateReplyToComment(connection, comment.externalId, dmText);
        if (dmResult) {
          comment.autoDmStatus = 'sent';
          recordAutoReplySuccess(user);
          await user.save();
        }
      } catch (err) {
        dmError = err.message;
        console.warn('[instagramMessaging] private reply failed:', err.message);
      }
    }
  }

  let conversation = await Conversation.findOne({
    user: user._id || user.id,
    comment: comment._id,
  });

  const newMessages = [
    { role: 'customer', text: comment.text, sentAt: comment.postedAt || new Date() },
    { role: 'agent', text: publicReply, sentAt: new Date() },
  ];
  if (dmResult || !dmError) {
    newMessages.push({ role: 'agent', text: dmText, sentAt: new Date() });
  }

  if (!conversation) {
    conversation = await Conversation.create({
      user: user._id || user.id,
      platform: 'instagram',
      comment: comment._id,
      campaign: campaign?._id || null,
      customerHandle: comment.authorHandle || comment.author,
      instagramUserId: comment.authorHandle || comment.author || '',
      postTitle: comment.postTitle || '',
      stage: 'engaged',
      messages: newMessages,
    });
  } else {
    conversation.messages.push(...newMessages);
    conversation.stage = 'engaged';
    if (campaign?._id) conversation.campaign = campaign._id;
    if (!conversation.instagramUserId) {
      conversation.instagramUserId = comment.authorHandle || comment.author || '';
    }
    conversation.lastMessageAt = new Date();
    await conversation.save();
  }

  if (campaign?._id) {
    await incrementCampaignTrigger(campaign._id);
  }

  return {
    ok: true,
    publicReply,
    publicReplyPosted,
    publicReplyError,
    dmText,
    dmSent: Boolean(dmResult),
    dmError,
    conversationId: conversation._id,
    messagingEnabled: isInstagramMessagingConfigured(),
  };
}
