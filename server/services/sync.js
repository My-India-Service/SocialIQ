import Comment from '../models/Comment.js';
import Connection from '../models/Connection.js';
import User from '../models/User.js';
import { analyzeComment, buildAutoDmPreview } from './ai.js';
import { fetchYouTubeComments } from './youtube.js';
import { fetchFacebookComments, fetchInstagramComments } from './meta.js';
import { routeLead } from './integrations.js';

async function ingestRawComments(userId, platform, rawComments, user) {
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let routed = 0;

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
    if (user?.autoDm?.enabled && analysis.category === 'sales_opportunity') {
      autoDmStatus = 'queued';
      autoDmPreview = buildAutoDmPreview(user, raw.text);
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

    imported += 1;
  }

  return { imported, updated, skipped, routed };
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
    commentFetchFailures = 0,
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
    commentFetchFailures,
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
  const { comments: rawComments, accountName } = await fetchInstagramComments(connection, options);
  const stats = await ingestRawComments(userId, 'instagram', rawComments, user);

  connection.lastSyncedAt = new Date();
  if (accountName) connection.accountName = accountName;
  await connection.save();

  return {
    platform: 'instagram',
    channelTitle: connection.accountName,
    fetched: rawComments.length,
    ...stats,
    lastSyncedAt: connection.lastSyncedAt,
  };
}
