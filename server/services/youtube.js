import jwt from 'jsonwebtoken';
import Connection from '../models/Connection.js';

/** force-ssl covers reading channel, uploads and comments plus posting replies. */
const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'].join(' ');

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

/** Best-effort revoke so Disconnect also removes SocialAiDigital from the user's Google account. */
export async function revokeGoogleToken(token) {
  if (!token) return;
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
  } catch {
    /* token already invalid or Google unreachable; local tokens are deleted regardless */
  }
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

const BACKFILL_MAX_VIDEOS = 50;
const BACKFILL_MAX_PER_VIDEO = 100;
const BACKFILL_MAX_TOTAL = 500;
const BACKFILL_MAX_PAGES_PER_VIDEO = 10;

function mapUploads(items) {
  return (items || [])
    .map((item) => ({
      videoId: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId,
      title: item.snippet?.title || 'Untitled video',
      publishedAt: item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || null,
    }))
    .filter((v) => v.videoId);
}

async function listUploadsSince(accessToken, playlistId, since, until) {
  const videos = [];
  let pageToken;
  do {
    const res = await youtubeGet(accessToken, 'playlistItems', {
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: 50,
      pageToken,
    });
    let reachedOlder = false;
    for (const video of mapUploads(res.items)) {
      if (video.publishedAt && new Date(video.publishedAt) < since) {
        reachedOlder = true;
        break;
      }
      if (until && video.publishedAt && new Date(video.publishedAt) > until) continue;
      videos.push(video);
      if (videos.length >= BACKFILL_MAX_VIDEOS) break;
    }
    if (reachedOlder || videos.length >= BACKFILL_MAX_VIDEOS) break;
    pageToken = res.nextPageToken;
  } while (pageToken);
  return videos;
}

const CHANNEL_QUICK_PAGES = 2;
const CHANNEL_DATED_PAGES = 10;

function mapThread(item, videoId, postTitle) {
  const top = item.snippet?.topLevelComment?.snippet;
  return {
    externalId: item.snippet?.topLevelComment?.id || item.id,
    videoId,
    postTitle,
    author: top.authorDisplayName || 'YouTube user',
    authorHandle: top.authorChannelUrl || '',
    text: top.textOriginal || top.textDisplay || '',
    likes: top.likeCount || 0,
    replies: item.snippet?.totalReplyCount || 0,
    postedAt: top.publishedAt ? new Date(top.publishedAt) : new Date(),
    platform: 'youtube',
  };
}

/** Newest-first top-level comments across every video on the channel, filtered by comment date. */
export async function fetchChannelCommentThreads(
  accessToken,
  channelId,
  { since = null, until = null, maxTotal = BACKFILL_MAX_TOTAL, maxPages = CHANNEL_QUICK_PAGES } = {}
) {
  const threads = [];
  let pageToken;
  let pages = 0;
  let reachedOlder = false;

  do {
    pages += 1;
    const res = await youtubeGet(accessToken, 'commentThreads', {
      part: 'snippet',
      allThreadsRelatedToChannelId: channelId,
      order: 'time',
      maxResults: 100,
      textFormat: 'plainText',
      pageToken,
    });

    for (const item of res.items || []) {
      const top = item.snippet?.topLevelComment?.snippet;
      if (!top?.textDisplay && !top?.textOriginal) continue;
      const posted = top.publishedAt ? new Date(top.publishedAt) : null;
      if (posted && until && posted > until) continue;
      if (posted && since && posted < since) {
        reachedOlder = true;
        break;
      }
      threads.push(item);
      if (threads.length >= maxTotal) break;
    }

    pageToken = res.nextPageToken;
  } while (pageToken && !reachedOlder && pages < maxPages && threads.length < maxTotal);

  return threads;
}

/** Map of videoId → title, 50 ids per videos.list call. */
export async function fetchVideoTitles(accessToken, videoIds) {
  const titles = new Map();
  const ids = [...new Set(videoIds.filter(Boolean))];
  for (let i = 0; i < ids.length; i += 50) {
    const res = await youtubeGet(accessToken, 'videos', {
      part: 'snippet',
      id: ids.slice(i, i + 50).join(','),
      maxResults: 50,
    });
    for (const v of res.items || []) titles.set(v.id, v.snippet?.title || 'Untitled video');
  }
  return titles;
}

/**
 * Fetch top-level comments (official YouTube Data API).
 * Reads the channel-wide comment list newest-first so new comments on older videos are included;
 * `since` / `until` filter by when the comment was posted. Falls back to per-video reads.
 */
export async function fetchYouTubeComments(
  connection,
  { maxVideos = 8, maxCommentsPerVideo = 50, since = null, until = null } = {}
) {
  const accessToken = await getValidAccessToken(connection);

  const channelRes = await youtubeGet(accessToken, 'channels', {
    part: 'contentDetails,snippet',
    mine: 'true',
  });
  const channel = channelRes.items?.[0];
  if (!channel) throw new Error('YouTube channel not found');
  const channelTitle = channel.snippet?.title || connection.accountName;

  try {
    const dated = Boolean(since || until);
    const threads = await fetchChannelCommentThreads(accessToken, channel.id, {
      since,
      until,
      maxTotal: dated ? BACKFILL_MAX_TOTAL : CHANNEL_QUICK_PAGES * 100,
      maxPages: dated ? CHANNEL_DATED_PAGES : CHANNEL_QUICK_PAGES,
    });
    const titles = await fetchVideoTitles(
      accessToken,
      threads.map((t) => t.snippet?.videoId)
    ).catch(() => new Map());
    const comments = threads.map((t) => {
      const videoId = t.snippet?.videoId || '';
      return mapThread(t, videoId, titles.get(videoId) || 'YouTube video');
    });
    return { channelTitle, comments };
  } catch (err) {
    if (err.code !== 400 && err.code !== 403) throw err;
  }

  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error('Could not find uploads playlist');

  const comments = await fetchCommentsFromUploads(accessToken, uploadsPlaylistId, {
    maxVideos,
    maxCommentsPerVideo,
    since,
    until,
  });
  return { channelTitle, comments };
}

/** Per-video fallback: comments from recent uploads (or uploads published since `since`). */
async function fetchCommentsFromUploads(
  accessToken,
  uploadsPlaylistId,
  { maxVideos, maxCommentsPerVideo, since, until }
) {
  let videos;
  if (since) {
    videos = await listUploadsSince(accessToken, uploadsPlaylistId, since, until);
  } else {
    const playlistRes = await youtubeGet(accessToken, 'playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: maxVideos,
    });
    videos = mapUploads(playlistRes.items);
  }

  const perVideoCap = since ? BACKFILL_MAX_PER_VIDEO : maxCommentsPerVideo;
  const comments = [];

  for (const video of videos) {
    if (since && comments.length >= BACKFILL_MAX_TOTAL) break;
    let pageToken;
    let fetched = 0;
    let pages = 0;
    let reachedOlder = false;

    do {
      pages += 1;
      let threadRes;
      try {
        threadRes = await youtubeGet(accessToken, 'commentThreads', {
          part: 'snippet',
          videoId: video.videoId,
          maxResults: since ? 50 : Math.min(50, perVideoCap - fetched),
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

        if (since) {
          const posted = top.publishedAt ? new Date(top.publishedAt) : null;
          if (posted && until && posted > until) continue;
          if (posted && posted < since) {
            reachedOlder = true;
            break;
          }
          if (comments.length >= BACKFILL_MAX_TOTAL || fetched >= perVideoCap) break;
        }

        comments.push(mapThread(item, video.videoId, video.title));
        fetched += 1;
      }

      pageToken = threadRes.nextPageToken;
    } while (
      pageToken &&
      fetched < perVideoCap &&
      !reachedOlder &&
      !(since && pages >= BACKFILL_MAX_PAGES_PER_VIDEO) &&
      !(since && comments.length >= BACKFILL_MAX_TOTAL)
    );
  }

  return comments;
}
