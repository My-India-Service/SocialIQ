import jwt from 'jsonwebtoken';
import Connection from '../models/Connection.js';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
].join(' ');

function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.SERVER_URL || 'http://localhost:5000'}/api/connections/youtube/callback`;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. Add them to server/.env'
    );
  }

  return { clientId, clientSecret, redirectUri };
}

export function isYouTubeConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getYouTubeAuthUrl(userId) {
  const { clientId, redirectUri } = getConfig();
  const state = jwt.sign({ id: userId, purpose: 'youtube_oauth' }, process.env.JWT_SECRET, {
    expiresIn: '15m',
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function verifyYouTubeOAuthState(state) {
  const payload = jwt.verify(state, process.env.JWT_SECRET);
  if (payload.purpose !== 'youtube_oauth' || !payload.id) {
    throw new Error('Invalid OAuth state');
  }
  return payload.id;
}

async function exchangeCodeForTokens(code) {
  const { clientId, clientSecret, redirectUri } = getConfig();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Token exchange failed');
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

async function refreshAccessToken(connection) {
  const { clientId, clientSecret } = getConfig();
  if (!connection.refreshToken) {
    throw new Error('YouTube session expired. Reconnect with Google.');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Token refresh failed');
  }

  connection.accessToken = data.access_token;
  connection.tokenExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000);
  if (data.refresh_token) connection.refreshToken = data.refresh_token;
  await connection.save();
  return connection.accessToken;
}

async function getValidAccessToken(connection) {
  const expired =
    !connection.tokenExpiry || connection.tokenExpiry.getTime() < Date.now() + 60_000;
  if (expired || !connection.accessToken) {
    return refreshAccessToken(connection);
  }
  return connection.accessToken;
}

async function youtubeGet(accessToken, path, params = {}) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `YouTube API ${res.status}`;
    const err = new Error(msg);
    err.code = res.status;
    throw err;
  }
  return data;
}

async function youtubePost(accessToken, path, body, params = {}) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  url.searchParams.set('part', 'snippet');
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `YouTube API ${res.status}`;
    const err = new Error(msg);
    err.code = res.status;
    throw err;
  }
  return data;
}

/** Reply to a YouTube top-level comment (parentId = comment id from sync). */
export async function postYouTubeCommentReply(connection, parentCommentId, message) {
  if (!parentCommentId) throw new Error('YouTube comment id missing — re-sync comments');
  const text = String(message || '').trim();
  if (!text) throw new Error('Reply message is required');

  const accessToken = await getValidAccessToken(connection);
  const data = await youtubePost(accessToken, 'comments', {
    snippet: {
      parentId: parentCommentId,
      textOriginal: text,
    },
  });
  return data.id || '';
}

/**
 * Moderate a comment on the channel owner's video.
 * status: published (unhide) | heldForReview (hide) | rejected (remove from public view).
 */
export async function setYouTubeCommentModeration(connection, commentId, status) {
  if (!commentId) throw new Error('YouTube comment id missing — re-sync comments');
  const accessToken = await getValidAccessToken(connection);
  const url = new URL('https://www.googleapis.com/youtube/v3/comments/setModerationStatus');
  url.searchParams.set('id', commentId);
  url.searchParams.set('moderationStatus', status);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data?.error?.message || `YouTube API ${res.status}`);
    err.code = res.status;
    throw err;
  }
  return true;
}

export async function exchangeYouTubeCode(code) {
  const tokens = await exchangeCodeForTokens(code);
  const channelData = await youtubeGet(tokens.access_token, 'channels', {
    part: 'snippet',
    mine: 'true',
  });

  const channel = channelData.items?.[0];
  if (!channel) {
    throw new Error('No YouTube channel found for this Google account');
  }

  return {
    tokens,
    channelId: channel.id,
    accountName: channel.snippet?.title || channel.snippet?.customUrl || channel.id,
    channelTitle: channel.snippet?.title || 'YouTube',
  };
}

export async function saveYouTubeConnection(userId, { tokens, channelId, accountName }) {
  const update = {
    accountName,
    channelId,
    status: 'connected',
    accessToken: tokens.access_token || '',
    tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    connectedAt: new Date(),
  };
  if (tokens.refresh_token) {
    update.refreshToken = tokens.refresh_token;
  }

  return Connection.findOneAndUpdate(
    { user: userId, platform: 'youtube' },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * Fetch top-level comments from recent uploads (official YouTube Data API).
 */
export async function fetchYouTubeComments(connection, { maxVideos = 8, maxCommentsPerVideo = 50 } = {}) {
  const accessToken = await getValidAccessToken(connection);

  const channelRes = await youtubeGet(accessToken, 'channels', {
    part: 'contentDetails,snippet',
    mine: 'true',
  });
  const channel = channelRes.items?.[0];
  if (!channel) throw new Error('YouTube channel not found');

  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error('Could not find uploads playlist');

  const playlistRes = await youtubeGet(accessToken, 'playlistItems', {
    part: 'snippet,contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: maxVideos,
  });

  const videos = (playlistRes.items || [])
    .map((item) => ({
      videoId: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId,
      title: item.snippet?.title || 'Untitled video',
    }))
    .filter((v) => v.videoId);

  const comments = [];

  for (const video of videos) {
    let pageToken;
    let fetched = 0;

    do {
      let threadRes;
      try {
        threadRes = await youtubeGet(accessToken, 'commentThreads', {
          part: 'snippet',
          videoId: video.videoId,
          maxResults: Math.min(50, maxCommentsPerVideo - fetched),
          order: 'time',
          textFormat: 'plainText',
          pageToken,
        });
      } catch (err) {
        if (err.code === 403) break;
        throw err;
      }

      for (const item of threadRes.items || []) {
        const top = item.snippet?.topLevelComment?.snippet;
        if (!top?.textDisplay && !top?.textOriginal) continue;

        comments.push({
          externalId: item.snippet?.topLevelComment?.id || item.id,
          videoId: video.videoId,
          postTitle: video.title,
          author: top.authorDisplayName || 'YouTube user',
          authorHandle: top.authorChannelUrl || '',
          text: top.textOriginal || top.textDisplay || '',
          likes: top.likeCount || 0,
          replies: item.snippet?.totalReplyCount || 0,
          postedAt: top.publishedAt ? new Date(top.publishedAt) : new Date(),
          platform: 'youtube',
        });
        fetched += 1;
      }

      pageToken = threadRes.nextPageToken;
    } while (pageToken && fetched < maxCommentsPerVideo);
  }

  return {
    channelTitle: channel.snippet?.title || connection.accountName,
    comments,
  };
}
