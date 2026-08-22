import Comment from '../models/Comment.js';
import Connection from '../models/Connection.js';
import User from '../models/User.js';
import { analyzeComment, buildAutoDmPreview } from './ai.js';
import { fetchYouTubeComments } from './youtube.js';
import { fetchFacebookComments, fetchInstagramComments } from './meta.js';
import { routeLead } from './integrations.js';
import { planCommentLimit } from '../config/plans.js';
import { runInstagramSalesAgentFlow } from './instagramMessaging.js';
import { appendConversationMessage } from './conversationService.js';
import {
  findCampaignForComment,
  shouldTriggerSalesAgent,
} from './campaignTriggers.js';
import {
  canAutoReplyToday,
  postCommentReplyToPlatform,
  recordAutoReplySuccess,
  shouldAutoReply,
} from './postReply.js';

export async function ingestRawComments(userId, platform, rawComments, user) {
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let routed = 0;
  let autoReplied = 0;
  let autoReplyFailed = 0;

  const planId = user?.subscription?.planId || 'starter';
  const limit = planCommentLimit(planId);
  if (limit != null) {
    const currentCount = await Comment.countDocuments({ user: userId });
    if (currentCount >= limit) {
      const err = new Error(
        `Comment limit reached (${limit}/mo on ${planId} plan). Upgrade in Billing to sync more.`
      );
      err.code = 'PLAN_LIMIT';
      throw err;
    }
  }

  const brandTone = user?.brandTone || 'friendly';
  const avgOrderValue = user?.avgOrderValue ?? 2499;
  const threshold = user?.integrations?.hotLeadThreshold ?? 80;
  const autoRoute = Boolean(user?.integrations?.autoRouteHotLeads);

  for (const raw of rawComments) {
    if (!raw.externalId || !raw.text?.trim()) {
      skipped += 1;
      continue;
    }

    const existing = await Comment.findOne({ user: userId, externalId: raw.externalId });
    if (existing) {
      existing.likes = raw.likes;
      existing.replies = raw.replies;
      existing.isViral = raw.likes + raw.replies >= 100;
      await existing.save();
      updated += 1;
      continue;
    }

    const analysis = await analyzeComment(raw.text, brandTone, avgOrderValue);
    let autoDmStatus = 'none';
    let autoDmPreview = '';
    const campaign =
      platform === 'instagram' ? await findCampaignForComment(userId, { platform, videoId: raw.videoId }) : null;
    const willTriggerAgent =
      platform === 'instagram' &&
      shouldTriggerSalesAgent(user, { platform, text: raw.text, videoId: raw.videoId }, analysis, campaign);
    if (willTriggerAgent) {
      autoDmStatus = 'queued';
      autoDmPreview = buildAutoDmPreview(user, raw.text, { dmLink: campaign?.dmLink });
    }

    const comment = await Comment.create({
      user: userId,
      platform,
      externalId: raw.externalId,
      videoId: raw.videoId,
      postTitle: raw.postTitle,
      author: raw.author,
      authorHandle: raw.authorHandle,
      text: raw.text,
      likes: raw.likes,
      replies: raw.replies,
      isViral: raw.likes + raw.replies >= 100,
      postedAt: raw.postedAt,
      status: 'new',
      autoDmStatus,
      autoDmPreview,
      ...analysis,
    });

    let salesAgentHandled = false;

    if (platform === 'instagram' && shouldTriggerSalesAgent(user, comment, analysis, campaign)) {
      try {
        const agentResult = await runInstagramSalesAgentFlow({ user, comment, campaign });
        if (agentResult.ok && agentResult.dmSent) {
          comment.autoDmStatus = 'sent';
        } else if (agentResult.ok) {
          comment.autoDmStatus = 'queued';
        }
        if (agentResult.dmText) comment.autoDmPreview = agentResult.dmText;
        if (agentResult.publicReplyPosted || agentResult.ok) {
          salesAgentHandled = true;
        }
        await comment.save();
      } catch (err) {
        console.warn('Sales agent flow failed:', err.message);
      }
    }

    await appendConversationMessage({
      userId,
      platform,
      commentId: comment._id,
      role: 'customer',
      text: comment.text,
      customerHandle: comment.authorHandle || comment.author,
      postTitle: comment.postTitle,
    });

    if (
      autoRoute &&
      analysis.purchaseProbability >= threshold &&
      analysis.category === 'sales_opportunity'
    ) {
      try {
        const result = await routeLead(user, comment, 'all');
        if (result.routed) {
          comment.routedTo = result.routedChannels;
          comment.sentToSalesAt = new Date();
          comment.status = 'sent_to_sales';
          await comment.save();
          routed += 1;
        }
      } catch (err) {
        console.warn('Auto-route lead failed:', err.message);
      }
    }

    if (
      !salesAgentHandled &&
      shouldAutoReply(user, comment) &&
      canAutoReplyToday(user)
    ) {
      const keepSentToSales = comment.status === 'sent_to_sales';
      try {
        const { platformReplyId, message } = await postCommentReplyToPlatform(
          userId,
          comment,
          comment.suggestedReply
        );
        comment.suggestedReply = message;
        if (!keepSentToSales) {
          comment.status = 'replied';
        }
        comment.platformReplyId = platformReplyId;
        comment.postedReplyAt = new Date();
        await comment.save();
        recordAutoReplySuccess(user);
        await user.save();
        autoReplied += 1;
      } catch (err) {
        autoReplyFailed += 1;
        console.warn('Auto-reply failed:', err.message);
      }
    }

    imported += 1;
  }

  return { imported, updated, skipped, routed, autoReplied, autoReplyFailed };
}

async function getOAuthConnection(userId, platform, connectHint) {
  const connection = await Connection.findOne({
    user: userId,
    platform,
    status: 'connected',
  });

  if (!connection) {
    throw new Error(`${platform} is not connected. ${connectHint}`);
  }

  if (!connection.accessToken && !connection.refreshToken) {
    throw new Error(
      `${platform} shows connected but has no OAuth tokens (demo stub). Disconnect, then reconnect.`
    );
  }

  return connection;
}

export async function syncYouTubeCommentsForUser(userId, options = {}) {
  const connection = await getOAuthConnection(
    userId,
    'youtube',
    'Click “Connect with Google” first.'
  );
  const user = await User.findById(userId);
  const { comments: rawComments, channelTitle } = await fetchYouTubeComments(connection, options);
  const stats = await ingestRawComments(userId, 'youtube', rawComments, user);

  connection.lastSyncedAt = new Date();
  if (channelTitle) connection.accountName = channelTitle;
  await connection.save();

  return {
    platform: 'youtube',
    channelTitle: connection.accountName,
    fetched: rawComments.length,
    ...stats,
    lastSyncedAt: connection.lastSyncedAt,
  };
}

export async function syncFacebookCommentsForUser(userId, options = {}) {
  const connection = await getOAuthConnection(
    userId,
    'facebook',
    'Click “Connect Facebook” first.'
  );
  const user = await User.findById(userId);
  const {
    comments: rawComments,
    accountName,
    postsChecked = 0,
    scannedPosts = 0,
    postsWithCommentSignal = 0,
    commentFetchFailures = 0,
    probePostId,
    probeSummaryTotal,
    probeDataLength,
    probeError,
    warning,
  } = await fetchFacebookComments(connection, options);
  const stats = await ingestRawComments(userId, 'facebook', rawComments, user);

  connection.lastSyncedAt = new Date();
  if (accountName) connection.accountName = accountName;
  await connection.save();

  return {
    platform: 'facebook',
    channelTitle: connection.accountName,
    fetched: rawComments.length,
    postsChecked,
    scannedPosts,
    postsWithCommentSignal,
    commentFetchFailures,
    probePostId,
    probeSummaryTotal,
    probeDataLength,
    probeError,
    warning,
    ...stats,
    lastSyncedAt: connection.lastSyncedAt,
  };
}

export async function syncInstagramCommentsForUser(userId, options = {}) {
  const connection = await getOAuthConnection(
    userId,
    'instagram',
    'Click “Connect Instagram” first.'
  );
  const user = await User.findById(userId);
  const {
    comments: rawComments,
    accountName,
    mediaChecked,
    mediaWithCommentSignal,
    commentFetchFailures,
    warning,
  } = await fetchInstagramComments(connection, options);
  const stats = await ingestRawComments(userId, 'instagram', rawComments, user);

  connection.lastSyncedAt = new Date();
  if (accountName) connection.accountName = accountName;
  await connection.save();

  return {
    platform: 'instagram',
    channelTitle: connection.accountName,
    fetched: rawComments.length,
    mediaChecked,
    mediaWithCommentSignal,
    commentFetchFailures,
    warning,
    ...stats,
    lastSyncedAt: connection.lastSyncedAt,
  };
}
