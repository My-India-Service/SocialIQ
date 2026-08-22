import jwt from 'jsonwebtoken';
import Connection from '../models/Connection.js';
import { getValidInstagramDirectAccessToken } from './instagramLogin.js';

const GRAPH = 'https://graph.facebook.com/v21.0';
const IG_GRAPH = 'https://graph.instagram.com/v21.0';

const SCOPES = [
  'public_profile',
  'email',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_manage_engagement',
  'pages_read_user_content',
  'instagram_basic',
  'instagram_manage_comments',
  'business_management',
].join(',');

function getConfig() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri =
    process.env.META_REDIRECT_URI ||
    `${process.env.SERVER_URL || 'http://localhost:5000'}/api/connections/meta/callback`;

  if (!appId || !appSecret) {
    throw new Error('Missing META_APP_ID / META_APP_SECRET. Add them to server/.env');
  }

  return { appId, appSecret, redirectUri };
}

export function isMetaConfigured() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function getMetaAuthUrl(userId, platform = 'facebook') {
  if (!['facebook', 'instagram'].includes(platform)) {
    throw new Error('platform must be facebook or instagram');
  }

  const { appId, redirectUri } = getConfig();
  const state = jwt.sign(
    { id: userId, purpose: 'meta_oauth', platform },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: SCOPES,
    response_type: 'code',
  });

  return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
}

export function verifyMetaOAuthState(state) {
  const payload = jwt.verify(state, process.env.JWT_SECRET);
  if (payload.purpose !== 'meta_oauth' || !payload.id || !payload.platform) {
    throw new Error('Invalid OAuth state');
  }
  return { userId: payload.id, platform: payload.platform };
}

/** Legacy empty metaAuthType = Facebook Page token path. */
export function resolveInstagramMetaAuthType(connection) {
  if (connection?.metaAuthType === 'instagram_direct') return 'instagram_direct';
  return 'facebook_page';
}

export function getInstagramGraphBase(connection) {
  return resolveInstagramMetaAuthType(connection) === 'instagram_direct' ? IG_GRAPH : GRAPH;
}

async function graphGet(path, accessToken, params = {}) {
  const url = new URL(path.startsWith('http') ? path : `${GRAPH}/${path}`);
  url.searchParams.set('access_token', accessToken);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) {
    const err = new Error(data.error?.message || `Meta Graph API error (${res.status})`);
    err.code = data.error?.code || res.status;
    throw err;
  }
  return data;
}

async function graphPost(path, accessToken, body = {}) {
  const url = new URL(path.startsWith('http') ? path : `${GRAPH}/${path}`);
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const err = new Error(data.error?.message || `Meta Graph API error (${res.status})`);
    err.code = data.error?.code || res.status;
    throw err;
  }
  return data;
}

function isMetaTokenError(message = '', code) {
  const m = String(message).toLowerCase();
  return (
    code === 190 ||
    code === 102 ||
    m.includes('expired') ||
    m.includes('session has expired') ||
    m.includes('invalid oauth')
  );
}

/** Re-list Pages with the stored user token and refresh the Page access token. */
async function refreshPageAccessToken(connection) {
  if (!connection.refreshToken || !connection.channelId) {
    throw new Error('Meta token expired — reconnect on Connect');
  }
  const pages = await getManagedPages(connection.refreshToken);
  const page = pages.find((p) => p.id === connection.channelId) || pages[0];
  if (!page?.access_token) {
    throw new Error('Could not refresh Page token — reconnect Facebook on Connect');
  }
  connection.accessToken = page.access_token;
  await connection.save();
  return page.access_token;
}

async function graphPostWithConnection(connection, path, body = {}) {
  try {
    return await graphPost(path, connection.accessToken, body);
  } catch (err) {
    if (isMetaTokenError(err.message, err.code) && connection.refreshToken) {
      const token = await refreshPageAccessToken(connection);
      return await graphPost(path, token, body);
    }
    throw err;
  }
}

async function instagramGraphGetRaw(base, path, accessToken, params = {}) {
  const url = new URL(path.startsWith('http') ? path : `${base}/${path}`);
  url.searchParams.set('access_token', accessToken);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) {
    const err = new Error(data.error?.message || `Instagram Graph API error (${res.status})`);
    err.code = data.error?.code || res.status;
    throw err;
  }
  return data;
}

async function instagramGraphPostRaw(base, path, accessToken, body = {}) {
  const url = new URL(path.startsWith('http') ? path : `${base}/${path}`);
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const err = new Error(data.error?.message || `Instagram Graph API error (${res.status})`);
    err.code = data.error?.code || res.status;
    throw err;
  }
  return data;
}

async function instagramGraphGet(connection, path, params = {}) {
  const base = getInstagramGraphBase(connection);
  if (resolveInstagramMetaAuthType(connection) === 'instagram_direct') {
    const token = await getValidInstagramDirectAccessToken(connection);
    return instagramGraphGetRaw(base, path, token, params);
  }
  return graphGet(path, connection.accessToken, params);
}

async function instagramGraphPost(connection, path, body = {}) {
  const base = getInstagramGraphBase(connection);
  if (resolveInstagramMetaAuthType(connection) === 'instagram_direct') {
    const token = await getValidInstagramDirectAccessToken(connection);
    return instagramGraphPostRaw(base, path, token, body);
  }
  return graphPostWithConnection(connection, path, body);
}

function isMetaReplyPermissionError(message = '') {
  const m = String(message).toLowerCase();
  return (
    m.includes('pages_manage_engagement') ||
    m.includes('instagram_manage_comments') ||
    m.includes('permission') ||
    m.includes('insufficient') ||
    m.includes('(#200)') ||
    m.includes('(#10)')
  );
}

function wrapMetaReplyError(err, platform) {
  let message = err.message || 'Meta reply failed';
  if (isMetaReplyPermissionError(message)) {
    const perm =
      platform === 'instagram' ? 'instagram_manage_comments' : 'pages_manage_engagement';
    message = `${message} Reconnect ${platform === 'instagram' ? 'Instagram' : 'Facebook'} on Connect and ensure ${perm} is granted.`;
  }
  const wrapped = new Error(message);
  wrapped.code = err.code;
  return wrapped;
}

/** Reply to a Facebook Page comment (requires pages_manage_engagement — reconnect Meta if missing). */
export async function postFacebookCommentReply(connection, commentId, message) {
  if (!commentId) throw new Error('Facebook comment id missing — re-sync comments');
  const text = String(message || '').trim();
  if (!text) throw new Error('Reply message is required');

  try {
    const data = await graphPostWithConnection(connection, `${commentId}/comments`, {
      message: text,
    });
    return data.id || '';
  } catch (err) {
    throw wrapMetaReplyError(err, 'facebook');
  }
}

/** Reply to an Instagram comment (requires instagram_manage_comments — reconnect Meta if missing). */
export async function postInstagramCommentReply(connection, commentId, message) {
  if (!commentId) throw new Error('Instagram comment id missing — re-sync comments');
  const text = String(message || '').trim();
  if (!text) throw new Error('Reply message is required');

  try {
    const data = await instagramGraphPost(connection, `${commentId}/replies`, {
      message: text,
    });
    return data.id || '';
  } catch (err) {
    throw wrapMetaReplyError(err, 'instagram');
  }
}

const COMMENT_READ_SCOPES = ['pages_read_engagement', 'pages_read_user_content'];

/**
 * Inspect token scopes so sync errors can show what Meta actually granted.
 * Prefer debug_token (Page or user token); fall back to /me/permissions with user token.
 */
async function describeMetaTokenScopes(connection) {
  const needed = COMMENT_READ_SCOPES;
  try {
    const { appId, appSecret } = getConfig();
    const appToken = `${appId}|${appSecret}`;
    const debug = await graphGet('debug_token', appToken, {
      input_token: connection.accessToken,
    });
    const data = debug.data || {};
    const scopes = Array.isArray(data.scopes) ? data.scopes : [];
    const missing = needed.filter((s) => !scopes.includes(s));
    const type = data.type || 'unknown';
    const parts = [
      `tokenType=${type}`,
      scopes.length ? `granted=[${scopes.join(', ')}]` : 'granted=[]',
    ];
    if (missing.length) parts.push(`missingForComments=[${missing.join(', ')}]`);

    if (connection.refreshToken) {
      try {
        const perms = await graphGet('me/permissions', connection.refreshToken);
        const granted = (perms.data || [])
          .filter((p) => p.status === 'granted')
          .map((p) => p.permission);
        const userMissing = needed.filter((s) => !granted.includes(s));
        if (granted.length) {
          parts.push(`userGranted=[${granted.join(', ')}]`);
        }
        if (userMissing.length) {
          parts.push(`userMissing=[${userMissing.join(', ')}]`);
        }
      } catch {
        /* user permissions optional */
      }
    }

    return parts.join('; ');
  } catch (err) {
    return `scopeDebugUnavailable (${err.message})`;
  }
}

function isMetaCommentPermissionError(message = '') {
  const m = String(message).toLowerCase();
  return (
    m.includes('pages_read_user_content') ||
    m.includes('pages_read_engagement') ||
    m.includes('page public content access') ||
    m.includes('page public metadata access') ||
    m.includes('(#100)') ||
    m.includes('(#10)') ||
    m.includes('(#200)') ||
    m.includes('permission') ||
    m.includes('insufficient') ||
    m.includes('oauth') ||
    m.includes('does not exist')
  );
}

function scopesAlreadyGranted(scopeHint = '') {
  return (
    scopeHint.includes('pages_read_engagement') &&
    scopeHint.includes('pages_read_user_content') &&
    !scopeHint.includes('missingForComments=[')
  );
}

function buildCommentPermissionError(lastError, scopeHint) {
  if (scopesAlreadyGranted(scopeHint)) {
    return (
      'Cannot read Page comments even though pages_read_engagement and pages_read_user_content are on the Page token. ' +
      'Meta may be blocking the post/comments object (wrong post edge, New Page Experience, or App Review feature). ' +
      'Confirm the connected Page matches the Page with comments, try Sync again after redeploy, and check Meta App mode. ' +
      (lastError ? `Meta: ${lastError} ` : '') +
      (scopeHint ? `Token: ${scopeHint}` : '')
    );
  }
  return (
    'Cannot read Page comments. In Meta Developer Console set pages_read_engagement and pages_read_user_content to Ready for testing, then Reconnect Facebook (re-consent) and Sync again.' +
    (lastError ? ` Meta: ${lastError}` : '') +
    (scopeHint ? ` Token: ${scopeHint}` : '')
  );
}

function mapFbComment(c, post) {
  if (!c?.message?.trim()) return null;
  return {
    externalId: c.id,
    videoId: post.id,
    postTitle: (post.message || 'Facebook post').slice(0, 120),
    author: c.from?.name || 'Facebook user',
    authorHandle: c.from?.id ? `fb:${c.from.id}` : '',
    text: c.message,
    likes: c.like_count || 0,
    replies: c.comment_count || 0,
    postedAt: c.created_time ? new Date(c.created_time) : new Date(),
    platform: 'facebook',
  };
}

function commentActivityScore(post) {
  const summary = post.comments?.summary?.total_count;
  if (typeof summary === 'number') return summary;
  if (Array.isArray(post.comments?.data)) return post.comments.data.length;
  if (typeof post.comment_count === 'number') return post.comment_count;
  return 0;
}

/** Prefer posts that already show comment activity within the sync window. */
function sortPostsByCommentActivity(posts) {
  return [...posts].sort((a, b) => commentActivityScore(b) - commentActivityScore(a));
}

async function fetchGraphUrl(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Meta Graph API error (${res.status})`);
  }
  return data;
}

/**
 * Deep-scan a Page edge: follow paging until maxScan posts
 * (and optionally until maxPosts with comment activity).
 */
async function scanEdgePosts(
  pageId,
  accessToken,
  edge,
  { maxPosts, maxScan, fields, nested, stopOnActivity = true }
) {
  const pageSize = Math.min(25, Math.max(5, maxScan));
  let data = await graphGet(`${pageId}/${edge}`, accessToken, {
    fields,
    limit: pageSize,
  });

  const scanned = [];
  const withActivity = [];

  while (true) {
    for (const post of data.data || []) {
      scanned.push(post);
      if (commentActivityScore(post) > 0) withActivity.push(post);
      if (scanned.length >= maxScan) break;
      if (stopOnActivity && withActivity.length >= maxPosts) break;
    }
    if (scanned.length >= maxScan) break;
    if (stopOnActivity && withActivity.length >= maxPosts) break;
    const next = data.paging?.next;
    if (!next) break;
    data = await fetchGraphUrl(next);
  }

  // Prefer posts that signal comments; if none, still try newest scanned posts.
  const posts = withActivity.length
    ? sortPostsByCommentActivity(withActivity).slice(0, maxPosts)
    : scanned.slice(0, maxPosts);

  return {
    edge,
    posts,
    scanned,
    nested,
    scannedPosts: scanned.length,
    postsWithCommentSignal: withActivity.length,
  };
}

/**
 * Scan published_posts + feed + posts and union by id (do not stop at first edge).
 */
async function listPagePosts(
  pageId,
  accessToken,
  maxPosts,
  maxCommentsPerPost = 50,
  maxScan = 250
) {
  const commentLimit = Math.min(50, maxCommentsPerPost);
  const commentFields = `comments.limit(${commentLimit}).summary(true){id,message,created_time,like_count,comment_count,from{id,name}}`;
  const edges = ['published_posts', 'feed', 'posts'];
  const fieldModes = [
    {
      nested: true,
      fields: `id,message,created_time,permalink_url,${commentFields}`,
    },
    {
      nested: false,
      fields: 'id,message,created_time,permalink_url,comments.limit(0).summary(true)',
    },
    {
      nested: false,
      fields: 'id,message,created_time,permalink_url',
    },
  ];

  const byId = new Map();
  const edgesUsed = [];
  let nested = false;
  let lastErr = null;

  for (const edge of edges) {
    if (byId.size >= maxScan) break;

    let edgeOk = false;
    for (const mode of fieldModes) {
      try {
        const remaining = maxScan - byId.size;
        const result = await scanEdgePosts(pageId, accessToken, edge, {
          maxPosts: remaining,
          maxScan: remaining,
          fields: mode.fields,
          nested: mode.nested,
          stopOnActivity: false,
        });
        nested = nested || result.nested;
        edgesUsed.push(edge);
        for (const post of result.scanned || []) {
          if (!post?.id) continue;
          const prev = byId.get(post.id);
          if (!prev || commentActivityScore(post) > commentActivityScore(prev)) {
            byId.set(post.id, post);
          }
        }
        edgeOk = true;
        break;
      } catch (err) {
        lastErr = err;
        console.warn(
          `FB deep-scan ${edge} (${mode.nested ? 'nested' : 'plain'}) failed:`,
          err.message
        );
      }
    }
    if (!edgeOk) {
      console.warn(`FB deep-scan skipped edge ${edge}`);
    }
  }

  if (!byId.size) {
    throw lastErr || new Error('Could not list Facebook Page posts.');
  }

  const all = [...byId.values()];
  const withActivity = all.filter((p) => commentActivityScore(p) > 0);
  const posts = withActivity.length
    ? sortPostsByCommentActivity(withActivity).slice(0, maxPosts)
    : all.slice(0, maxPosts);

  return {
    edge: edgesUsed.join('+') || 'none',
    posts,
    nested,
    scannedPosts: all.length,
    postsWithCommentSignal: withActivity.length,
  };
}

async function fetchCommentsForPost(postId, accessToken, maxCommentsPerPost) {
  const limit = Math.min(50, maxCommentsPerPost);
  const attempts = [
    { fields: 'id,message,created_time,like_count,comment_count,from{id,name}', limit },
    { fields: 'id,message,created_time,like_count,comment_count', limit },
    {
      fields: 'id,message,created_time,like_count,comment_count,from{id,name}',
      limit,
      filter: 'stream',
    },
  ];

  let lastErr;
  for (const params of attempts) {
    try {
      return await graphGet(`${postId}/comments`, accessToken, params);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Facebook comments request failed');
}

async function probePostComments(postId, accessToken) {
  try {
    const res = await graphGet(`${postId}/comments`, accessToken, {
      fields: 'id,message',
      limit: 1,
      summary: true,
    });
    return {
      probePostId: postId,
      probeSummaryTotal:
        typeof res.summary?.total_count === 'number' ? res.summary.total_count : null,
      probeDataLength: Array.isArray(res.data) ? res.data.length : 0,
    };
  } catch (err) {
    return {
      probePostId: postId,
      probeSummaryTotal: null,
      probeDataLength: 0,
      probeError: err.message || String(err),
    };
  }
}

function buildZeroCommentVisibilityWarning({
  scannedPosts,
  postsWithCommentSignal,
  postsChecked,
  probe,
  scopeHint,
}) {
  const probeBits = [];
  if (probe?.probePostId) {
    probeBits.push(`probePost=${probe.probePostId}`);
    if (probe.probeSummaryTotal != null) probeBits.push(`summaryTotal=${probe.probeSummaryTotal}`);
    probeBits.push(`probeDataLength=${probe.probeDataLength ?? 0}`);
    if (probe.probeError) probeBits.push(`probeError=${probe.probeError}`);
  }

  return (
    `Scanned ${scannedPosts} posts (${postsWithCommentSignal} with comment signal); ` +
    `checked ${postsChecked} for comment bodies but Graph returned none. ` +
    `Comments Manager can show comments that Graph hides — common in Meta Development mode ` +
    `or before App Review. Fix: (1) App roles — Page admin must be Admin/Developer/Tester on the app. ` +
    `(2) Post a test comment as that role user, then Sync — if it appears, Dev-mode filtering is confirmed. ` +
    `(3) For public commenters: App Review for pages_read_engagement + pages_read_user_content, set App Live, Reconnect, Sync. ` +
    (probeBits.length ? `Probe: ${probeBits.join(', ')}. ` : '') +
    (scopeHint ? `Token: ${scopeHint}` : '')
  );
}

function buildInstagramZeroCommentWarning({
  mediaChecked,
  mediaWithCommentSignal,
  commentFetchFailures,
  authType,
}) {
  const scopeHint =
    authType === 'instagram_direct'
      ? 'instagram_business_basic + instagram_business_manage_comments'
      : 'instagram_manage_comments via Facebook Page';

  if (mediaChecked === 0) {
    return (
      'No recent Instagram media found on this account. Confirm the connected account is Business/Creator and has published posts, then Sync again.'
    );
  }

  let msg =
    `Checked ${mediaChecked} recent posts (${mediaWithCommentSignal} with comment signal) but Graph returned no comment text. ` +
    `Common in Meta Development mode — only comments from app Admin/Developer/Tester accounts may appear. ` +
    `Fix: (1) Post a test comment as an app role user, then Sync. (2) For public commenters: App Review for ${scopeHint}, set app Live, Reconnect, Sync.`;

  if (commentFetchFailures > 0) {
    msg += ` ${commentFetchFailures} post(s) skipped due to comment API errors — check scopes and reconnect.`;
  }

  return msg;
}

/**
 * Facebook Page post comments (official Graph API).
 */
export async function fetchFacebookComments(
  connection,
  { maxPosts = 50, maxCommentsPerPost = 50, maxScan = 250 } = {}
) {
  if (!connection.accessToken || !connection.channelId) {
    throw new Error('Facebook Page token missing. Reconnect with Meta.');
  }

  const {
    posts: postList,
    nested,
    scannedPosts = 0,
    postsWithCommentSignal = 0,
  } = await listPagePosts(
    connection.channelId,
    connection.accessToken,
    maxPosts,
    maxCommentsPerPost,
    maxScan
  );

  if (!postList.length) {
    return {
      accountName: connection.accountName,
      comments: [],
      postsChecked: 0,
      scannedPosts,
      postsWithCommentSignal,
      commentFetchFailures: 0,
      warning:
        'No recent posts found on this Facebook Page (checked published_posts/feed/posts). Confirm the connected Page has published posts.',
    };
  }

  const comments = [];
  let commentFetchFailures = 0;
  let permissionDenied = false;
  let lastError = '';

  for (const post of postList) {
    let fetched = 0;
    const nestedRows = Array.isArray(post.comments?.data) ? post.comments.data : null;
    const summaryTotal =
      typeof post.comments?.summary?.total_count === 'number'
        ? post.comments.summary.total_count
        : null;
    const seenIds = new Set();

    const pushBatch = (rows) => {
      for (const c of rows || []) {
        if (fetched >= maxCommentsPerPost) break;
        if (c?.id && seenIds.has(c.id)) continue;
        const mapped = mapFbComment(c, post);
        if (!mapped) continue;
        if (c?.id) seenIds.add(c.id);
        comments.push(mapped);
        fetched += 1;
      }
    };

    // Nested fast path only when Graph returned real comment objects.
    // Empty data[] must fall through to /{post-id}/comments.
    if (nested && nestedRows?.length) {
      pushBatch(nestedRows);
      const incomplete =
        typeof summaryTotal === 'number' &&
        summaryTotal > nestedRows.length &&
        fetched < maxCommentsPerPost;
      if (!incomplete) continue;
    }

    try {
      const first = await fetchCommentsForPost(post.id, connection.accessToken, maxCommentsPerPost);
      pushBatch(first.data);

      const nextUrl = first.paging?.next;
      if (nextUrl && fetched < maxCommentsPerPost) {
        try {
          const more = await fetchGraphUrl(nextUrl);
          pushBatch(more.data);
        } catch (err) {
          console.warn('FB comments paging skip', post.id, err.message);
        }
      }
    } catch (err) {
      commentFetchFailures += 1;
      lastError = err.message || String(err);
      console.warn('FB comments skip post', post.id, lastError);
      if (isMetaCommentPermissionError(lastError)) permissionDenied = true;
    }
  }

  if (permissionDenied || (commentFetchFailures > 0 && commentFetchFailures === postList.length)) {
    const scopeHint = await describeMetaTokenScopes(connection);
    throw new Error(buildCommentPermissionError(lastError, scopeHint));
  }

  let probe = null;
  let warning;
  if (!comments.length) {
    const sampleId = postList[0]?.id;
    if (sampleId) {
      probe = await probePostComments(sampleId, connection.accessToken);
    }
    const scopeHint = await describeMetaTokenScopes(connection);

    if (commentFetchFailures > 0) {
      warning =
        `Scanned ${scannedPosts} posts (${postsWithCommentSignal} with comment signal); ` +
        `comment fetch failed on ${commentFetchFailures}/${postList.length}. ` +
        (scopesAlreadyGranted(scopeHint)
          ? `Permissions look granted on the token — Meta still blocked comment reads. ${scopeHint}`
          : `Enable pages_read_engagement + pages_read_user_content, Reconnect Facebook, then Sync. Token: ${scopeHint}`);
    } else if (scannedPosts > 0 && postsWithCommentSignal === 0) {
      warning = buildZeroCommentVisibilityWarning({
        scannedPosts,
        postsWithCommentSignal,
        postsChecked: postList.length,
        probe,
        scopeHint,
      });
    } else {
      warning = buildZeroCommentVisibilityWarning({
        scannedPosts,
        postsWithCommentSignal,
        postsChecked: postList.length,
        probe,
        scopeHint,
      });
    }
  } else if (commentFetchFailures > 0) {
    warning = `Synced with ${commentFetchFailures} post(s) skipped due to comment API errors.`;
  }

  return {
    accountName: connection.accountName,
    comments,
    postsChecked: postList.length,
    scannedPosts,
    postsWithCommentSignal,
    commentFetchFailures,
    ...(probe || {}),
    warning,
  };
}

async function exchangeCodeForUserToken(code) {
  const { appId, appSecret, redirectUri } = getConfig();

  const shortUrl = new URL(`${GRAPH}/oauth/access_token`);
  shortUrl.searchParams.set('client_id', appId);
  shortUrl.searchParams.set('client_secret', appSecret);
  shortUrl.searchParams.set('redirect_uri', redirectUri);
  shortUrl.searchParams.set('code', code);

  const shortRes = await fetch(shortUrl);
  const short = await shortRes.json();
  if (short.error || !short.access_token) {
    throw new Error(short.error?.message || 'Meta token exchange failed');
  }

  const longUrl = new URL(`${GRAPH}/oauth/access_token`);
  longUrl.searchParams.set('grant_type', 'fb_exchange_token');
  longUrl.searchParams.set('client_id', appId);
  longUrl.searchParams.set('client_secret', appSecret);
  longUrl.searchParams.set('fb_exchange_token', short.access_token);

  const longRes = await fetch(longUrl);
  const longLived = await longRes.json();
  if (longLived.error || !longLived.access_token) {
    return {
      access_token: short.access_token,
      expiry_date: Date.now() + (short.expires_in || 3600) * 1000,
    };
  }

  return {
    access_token: longLived.access_token,
    expiry_date: Date.now() + (longLived.expires_in || 60 * 24 * 3600) * 1000,
  };
}

async function getManagedPages(userAccessToken) {
  const data = await graphGet('me/accounts', userAccessToken, {
    fields: 'id,name,access_token,instagram_business_account{id,username,name}',
    limit: 50,
  });
  return data.data || [];
}

/** Sum comment totals on a few recent posts — used to pick the right Page when user manages many. */
async function probePageCommentActivity(page) {
  if (!page?.id || !page?.access_token) return 0;
  const edges = ['published_posts', 'feed', 'posts'];
  for (const edge of edges) {
    try {
      const res = await graphGet(`${page.id}/${edge}`, page.access_token, {
        fields: 'id,comments.limit(0).summary(true)',
        limit: 10,
      });
      const posts = res.data || [];
      return posts.reduce((sum, p) => sum + commentActivityScore(p), 0);
    } catch (err) {
      console.warn(`FB page probe ${page.id} ${edge}:`, err.message);
    }
  }
  return 0;
}

async function pickFacebookPage(pages) {
  if (pages.length === 1) return pages[0];
  let best = pages[0];
  let bestScore = -1;
  for (const page of pages) {
    try {
      const score = await probePageCommentActivity(page);
      if (score > bestScore) {
        bestScore = score;
        best = page;
      }
    } catch (err) {
      console.warn('FB page probe failed', page.id, err.message);
    }
  }
  return best;
}

/**
 * After OAuth: resolve Facebook Page and/or Instagram Business Account and save connection(s).
 */
export async function exchangeMetaCodeAndSave(userId, platform, code) {
  const tokens = await exchangeCodeForUserToken(code);
  const pages = await getManagedPages(tokens.access_token);

  if (!pages.length) {
    throw new Error(
      'No Facebook Pages found. Create/claim a Page and make sure your Facebook account is an admin.'
    );
  }

  // Prefer a page that has Instagram linked when connecting IG;
  // for Facebook, prefer the Page with the most recent comment activity.
  let page = pages[0];
  if (platform === 'instagram') {
    page = pages.find((p) => p.instagram_business_account?.id) || null;
    if (!page) {
      throw new Error(
        'No Instagram Business/Creator account linked to your Facebook Page. Link IG in Meta Business Suite, then retry.'
      );
    }
  } else if (platform === 'facebook') {
    page = await pickFacebookPage(pages);
  }

  const pageToken = page.access_token;
  const results = [];

  if (platform === 'facebook' || platform === 'instagram') {
    // Always ensure Facebook page connection when user connects FB
    if (platform === 'facebook') {
      const fb = await Connection.findOneAndUpdate(
        { user: userId, platform: 'facebook' },
        {
          accountName: page.name || `Page ${page.id}`,
          channelId: page.id,
          status: 'connected',
          metaAuthType: 'facebook_page',
          accessToken: pageToken,
          refreshToken: tokens.access_token, // keep user token for refresh/page re-list
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          connectedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      results.push(fb);

      // Bonus: if IG is linked, also save Instagram so one login can do both
      const ig = page.instagram_business_account;
      if (ig?.id) {
        const igConn = await Connection.findOneAndUpdate(
          { user: userId, platform: 'instagram' },
          {
            accountName: ig.username ? `@${ig.username}` : ig.name || ig.id,
            channelId: ig.id,
            status: 'connected',
            metaAuthType: 'facebook_page',
            accessToken: pageToken,
            refreshToken: tokens.access_token,
            tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
            connectedAt: new Date(),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        results.push(igConn);
      }
    }

    if (platform === 'instagram') {
      const ig = page.instagram_business_account;
      const igConn = await Connection.findOneAndUpdate(
        { user: userId, platform: 'instagram' },
        {
          accountName: ig.username ? `@${ig.username}` : ig.name || ig.id,
          channelId: ig.id,
          status: 'connected',
          metaAuthType: 'facebook_page',
          accessToken: pageToken,
          refreshToken: tokens.access_token,
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          connectedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      results.push(igConn);
    }
  }

  return {
    platform,
    pageName: page.name,
    connections: results.map((c) => ({
      platform: c.platform,
      accountName: c.accountName,
      channelId: c.channelId,
    })),
  };
}

/**
 * Instagram media comments — Page token (Facebook Login) or Instagram User token (direct login).
 */
export async function fetchInstagramComments(connection, { maxMedia = 12, maxCommentsPerMedia = 50 } = {}) {
  if (!connection.accessToken || !connection.channelId) {
    throw new Error('Instagram account token missing. Reconnect with Instagram login or Meta.');
  }

  const media = await instagramGraphGet(connection, `${connection.channelId}/media`, {
    fields: 'id,caption,timestamp,permalink,comments_count',
    limit: maxMedia,
  });

  const mediaItems = media.data || [];
  const mediaChecked = mediaItems.length;
  const mediaWithCommentSignal = mediaItems.filter(
    (item) => typeof item.comments_count === 'number' && item.comments_count > 0
  ).length;

  const comments = [];
  let commentFetchFailures = 0;

  for (const item of mediaItems) {
    let fetched = 0;
    const res = await instagramGraphGet(connection, `${item.id}/comments`, {
      fields: 'id,text,username,timestamp,like_count,replies{count}',
      limit: Math.min(50, maxCommentsPerMedia),
    }).catch((err) => {
      commentFetchFailures += 1;
      console.warn('IG comments skip media', item.id, err.message);
      return { data: [] };
    });

    for (const c of res.data || []) {
      if (!c?.text?.trim()) continue;
      comments.push({
        externalId: c.id,
        videoId: item.id,
        postTitle: (item.caption || 'Instagram post').slice(0, 120),
        author: c.username || 'Instagram user',
        authorHandle: c.username ? `@${c.username}` : '',
        text: c.text,
        likes: c.like_count || 0,
        replies: c.replies?.data?.length || 0,
        postedAt: c.timestamp ? new Date(c.timestamp) : new Date(),
        platform: 'instagram',
      });
      fetched += 1;
      if (fetched >= maxCommentsPerMedia) break;
    }
  }

  const authType = resolveInstagramMetaAuthType(connection);
  let warning;
  if (comments.length === 0) {
    warning = buildInstagramZeroCommentWarning({
      mediaChecked,
      mediaWithCommentSignal,
      commentFetchFailures,
      authType,
    });
  } else if (commentFetchFailures > 0) {
    warning = `Synced with ${commentFetchFailures} post(s) skipped due to comment API errors.`;
  }

  return {
    accountName: connection.accountName,
    comments,
    mediaChecked,
    mediaWithCommentSignal,
    commentFetchFailures,
    warning,
  };
}
