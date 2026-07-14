import Comment from '../models/Comment.js';
import Connection from '../models/Connection.js';
import User from '../models/User.js';
import { analyzeComment } from './ai.js';
import { fetchYouTubeComments } from './youtube.js';
import { fetchFacebookComments, fetchInstagramComments } from './meta.js';

async function ingestRawComments(userId, platform, rawComments, brandTone) {
  let imported = 0;
  let updated = 0;
  let skipped = 0;

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

    const analysis = await analyzeComment(raw.text, brandTone || 'friendly');
    await Comment.create({
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
      ...analysis,
    });
    imported += 1;
  }

  return { imported, updated, skipped };
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
  const stats = await ingestRawComments(userId, 'youtube', rawComments, user?.brandTone);

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
  const { comments: rawComments, accountName } = await fetchFacebookComments(connection, options);
  const stats = await ingestRawComments(userId, 'facebook', rawComments, user?.brandTone);

  connection.lastSyncedAt = new Date();
  if (accountName) connection.accountName = accountName;
  await connection.save();

  return {
    platform: 'facebook',
    channelTitle: connection.accountName,
    fetched: rawComments.length,
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
  const stats = await ingestRawComments(userId, 'instagram', rawComments, user?.brandTone);

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
