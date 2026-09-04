import jwt from 'jsonwebtoken';
import Connection from '../models/Connection.js';

const AUTH = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN = 'https://open.tiktokapis.com/v2/oauth/token/';
const API = 'https://open.tiktokapis.com/v2';

const SCOPES = ['user.info.basic', 'user.info.profile', 'video.list'];

function getConfig() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri =
    process.env.TIKTOK_REDIRECT_URI ||
    `${process.env.SERVER_URL || 'http://localhost:5001'}/api/connections/tiktok/callback`;

  if (!clientKey || !clientSecret) {
    throw new Error(
      'Missing TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET. Add them to server/.env'
    );
  }

  return { clientKey, clientSecret, redirectUri };
}

export function isTikTokConfigured() {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

export function getTikTokOAuthScopes() {
  return [...SCOPES];
}

export function getTikTokAuthUrl(userId) {
  const { clientKey, redirectUri } = getConfig();
  const state = jwt.sign({ id: userId, purpose: 'tiktok_oauth' }, process.env.JWT_SECRET, {
    expiresIn: '15m',
  });

  const params = new URLSearchParams({
    client_key: clientKey,
    scope: SCOPES.join(','),
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  });

  return `${AUTH}?${params}`;
}

export function verifyTikTokOAuthState(state) {
  const payload = jwt.verify(state, process.env.JWT_SECRET);
  if (payload.purpose !== 'tiktok_oauth' || !payload.id) {
    throw new Error('Invalid OAuth state');
  }
  return payload.id;
}

function tiktokErrorMessage(data, fallback) {
  return (
    data?.error_description ||
    data?.error?.message ||
    (typeof data?.error === 'string' ? data.error : '') ||
    data?.message ||
    fallback
  );
}

function tiktokApiFailed(data) {
  const code = data?.error?.code;
  return Boolean(code && code !== 'ok');
}

async function exchangeCodeForTokens(code) {
  const { clientKey, clientSecret, redirectUri } = getConfig();
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(tiktokErrorMessage(data, 'TikTok token exchange failed'));
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    open_id: data.open_id || '',
    expiry_date: Date.now() + (data.expires_in || 86400) * 1000,
  };
}

async function refreshAccessToken(connection) {
  const { clientKey, clientSecret } = getConfig();
  if (!connection.refreshToken) {
    throw new Error('TikTok session expired. Reconnect TikTok on Connect.');
  }

  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(tiktokErrorMessage(data, 'TikTok token refresh failed'));
  }

  connection.accessToken = data.access_token;
  connection.tokenExpiry = new Date(Date.now() + (data.expires_in || 86400) * 1000);
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

async function tiktokGet(accessToken, path, params = {}) {
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || tiktokApiFailed(data)) {
    const err = new Error(tiktokErrorMessage(data, `TikTok API ${res.status}`));
    err.code = res.status;
    throw err;
  }
  return data;
}

async function tiktokPost(accessToken, path, body = {}, params = {}) {
  const url = new URL(`${API}${path}`);
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok || tiktokApiFailed(data)) {
    const err = new Error(tiktokErrorMessage(data, `TikTok API ${res.status}`));
    err.code = res.status;
    throw err;
  }
  return data;
}

async function fetchTikTokProfile(accessToken) {
  const data = await tiktokGet(accessToken, '/user/info/', {
    fields: 'open_id,union_id,avatar_url,display_name,username',
  });
  return data.data?.user || {};
}

export async function exchangeTikTokCode(code) {
  const tokens = await exchangeCodeForTokens(code);
  const user = await fetchTikTokProfile(tokens.access_token);
  const openId = user.open_id || tokens.open_id;
  const accountName = user.username
    ? `@${String(user.username).replace(/^@/, '')}`
    : user.display_name || openId || 'TikTok';

  return {
    tokens,
    channelId: openId || '',
    accountName,
  };
}

export async function saveTikTokConnection(userId, { tokens, channelId, accountName }) {
  const update = {
    accountName,
    channelId: channelId || '',
    status: 'connected',
    accessToken: tokens.access_token || '',
    tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    connectedAt: new Date(),
  };
  if (tokens.refresh_token) {
    update.refreshToken = tokens.refresh_token;
  }

  return Connection.findOneAndUpdate(
    { user: userId, platform: 'tiktok' },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function listVideos(accessToken, { maxVideos = 12 } = {}) {
  const videos = [];
  let cursor = 0;
  let hasMore = true;

  while (hasMore && videos.length < maxVideos) {
    const remaining = Math.min(20, maxVideos - videos.length);
    const data = await tiktokPost(
      accessToken,
      '/video/list/',
      { max_count: remaining, ...(cursor ? { cursor } : {}) },
      { fields: 'id,title,video_description,cover_image_url,create_time,share_url' }
    );
    const page = data.data?.videos || [];
    videos.push(...page);
    hasMore = Boolean(data.data?.has_more);
    cursor = data.data?.cursor || 0;
    if (!page.length) break;
  }

  return videos.slice(0, maxVideos);
}

async function listCommentsForVideo(accessToken, videoId, maxComments) {
  const comments = [];
  let cursor = 0;
  let hasMore = true;

  while (hasMore && comments.length < maxComments) {
    const data = await tiktokPost(
      accessToken,
      '/comment/list/',
      {
        video_id: String(videoId),
        max_count: Math.min(50, maxComments - comments.length),
        ...(cursor ? { cursor } : {}),
      },
      { fields: 'id,video_id,text,like_count,reply_count,create_time,parent_comment_id' }
    );
    const page = data.data?.comments || [];
    comments.push(...page);
    hasMore = Boolean(data.data?.has_more);
    cursor = data.data?.cursor || 0;
    if (!page.length) break;
  }

  return comments;
}

export async function fetchTikTokComments(
  connection,
  { maxVideos = 8, maxCommentsPerVideo = 40 } = {}
) {
  const accessToken = await getValidAccessToken(connection);
  const videos = await listVideos(accessToken, { maxVideos });
  const comments = [];
  let commentFetchFailures = 0;
  let commentApiUnavailable = false;

  for (const video of videos) {
    if (!video.id) continue;
    try {
      const raw = await listCommentsForVideo(accessToken, video.id, maxCommentsPerVideo);
      for (const item of raw) {
        const text = String(item.text || '').trim();
        if (!text) continue;
        comments.push({
          externalId: String(item.id),
          videoId: String(video.id),
          postTitle: video.title || video.video_description || 'TikTok video',
          author: 'TikTok user',
          authorHandle: '',
          text,
          likes: item.like_count || 0,
          replies: item.reply_count || 0,
          postedAt: item.create_time ? new Date(item.create_time * 1000) : new Date(),
          platform: 'tiktok',
        });
      }
    } catch (err) {
      commentFetchFailures += 1;
      const msg = String(err.message || '').toLowerCase();
      if (
        err.code === 401 ||
        err.code === 403 ||
        err.code === 404 ||
        /scope|permission|not authorized|invalid scope/.test(msg)
      ) {
        commentApiUnavailable = true;
        break;
      }
    }
  }

  let warning = '';
  if (commentApiUnavailable) {
    warning =
      'TikTok account connected. Comment listing needs extra TikTok API approval (comment.list). Videos can still be listed; comments stay empty until that product is granted.';
  } else if (videos.length === 0) {
    warning = 'No public TikTok videos found on this account. Post a public video, then Sync again.';
  } else if (comments.length === 0 && commentFetchFailures > 0) {
    warning =
      'TikTok connected but comments could not be fetched. Enable video.list + comment APIs on developers.tiktok.com, then Reconnect.';
  }

  return {
    accountName: connection.accountName,
    comments,
    videosChecked: videos.length,
    commentFetchFailures,
    warning,
  };
}
