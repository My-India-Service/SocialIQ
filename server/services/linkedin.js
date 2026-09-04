import jwt from 'jsonwebtoken';
import Connection from '../models/Connection.js';

const LINKEDIN_VERSION = '202508';
const REST = 'https://api.linkedin.com/rest';
const AUTH = 'https://www.linkedin.com/oauth/v2';

/** Self-serve on a new LinkedIn app: Sign In (OpenID) + Share on LinkedIn.
 * Org scopes (r_organization_social, etc.) need Community Management API review.
 * LinkedIn rejects the whole OAuth request if any requested scope is not on the app.
 * After CMA is approved, set LINKEDIN_OAUTH_SCOPES to the Auth-tab list (comma or space).
 */
const DEFAULT_SCOPES = ['openid', 'profile', 'email', 'w_member_social'];

function parseScopeList(value) {
  return String(value || '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getLinkedInOAuthScopes() {
  const fromEnv = parseScopeList(process.env.LINKEDIN_OAUTH_SCOPES);
  const raw = fromEnv.length ? fromEnv : [...DEFAULT_SCOPES];
  const allowOrg = process.env.LINKEDIN_REQUEST_ORG_SCOPES === '1';
  if (allowOrg) return raw;
  return raw.filter((scope) => !/organization/i.test(scope));
}

function requestedOrganizationAccess() {
  return getLinkedInOAuthScopes().some((scope) => scope.includes('organization'));
}

function isUnauthorizedAppScope(err) {
  return /not authorized for your application|invalid_scope|unauthorized_scope|organization_social/i.test(
    String(err?.message || err || '')
  );
}

export function linkedInConnectErrorMessage(error, errorDescription) {
  const text = `${error || ''} ${errorDescription || ''}`;
  if (isUnauthorizedAppScope(text)) {
    return 'LinkedIn rejected Company Page scope w_organization_social. In Developer Portal → Products keep only Sign In with LinkedIn (OpenID Connect) and Share on LinkedIn. Remove Community Management API from this app (it cannot mix), then Connect again from http://localhost:5173.';
  }
  return String(errorDescription || error || 'LinkedIn connection failed');
}

function getConfig() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri =
    process.env.LINKEDIN_REDIRECT_URI ||
    `${process.env.SERVER_URL || 'http://localhost:5001'}/api/connections/linkedin/callback`;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET. Add them to server/.env'
    );
  }

  return { clientId, clientSecret, redirectUri };
}

export function isLinkedInConfigured() {
  return Boolean(
    process.env.LINKEDIN_CLIENT_ID?.trim() && process.env.LINKEDIN_CLIENT_SECRET?.trim()
  );
}

export function getLinkedInAuthUrl(userId) {
  const { clientId, redirectUri } = getConfig();
  const state = jwt.sign({ id: userId, purpose: 'linkedin_oauth' }, process.env.JWT_SECRET, {
    expiresIn: '15m',
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: getLinkedInOAuthScopes().join(' '),
  });

  return `${AUTH}/authorization?${params}`;
}

export function verifyLinkedInOAuthState(state) {
  const payload = jwt.verify(state, process.env.JWT_SECRET);
  if (payload.purpose !== 'linkedin_oauth' || !payload.id) {
    throw new Error('Invalid OAuth state');
  }
  return payload.id;
}

function linkedInErrorMessage(data, fallback) {
  return (
    data?.error_description ||
    data?.message ||
    data?.error?.message ||
    (typeof data?.error === 'string' ? data.error : '') ||
    fallback
  );
}

async function exchangeCodeForTokens(code) {
  const { clientId, clientSecret, redirectUri } = getConfig();
  const res = await fetch(`${AUTH}/accessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(linkedInErrorMessage(data, 'LinkedIn token exchange failed'));
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: Date.now() + (data.expires_in || 5184000) * 1000,
  };
}

async function refreshAccessToken(connection) {
  const { clientId, clientSecret } = getConfig();
  if (!connection.refreshToken) {
    throw new Error('LinkedIn session expired. Reconnect LinkedIn on Connect.');
  }

  const res = await fetch(`${AUTH}/accessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(linkedInErrorMessage(data, 'LinkedIn token refresh failed'));
  }

  connection.accessToken = data.access_token;
  connection.tokenExpiry = new Date(Date.now() + (data.expires_in || 5184000) * 1000);
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

function restHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Linkedin-Version': LINKEDIN_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  };
}

function encodeUrn(urn) {
  return encodeURIComponent(String(urn || ''));
}

function orgIdFromUrn(urn) {
  const value = String(urn || '');
  const match = value.match(/organization(?:Brand)?:(\d+)/);
  return match?.[1] || value.replace(/^urn:li:organization(?:Brand)?:/, '');
}

async function linkedInGet(accessToken, url, { rest = true, extraHeaders = {} } = {}) {
  const res = await fetch(url, {
    headers: rest
      ? { ...restHeaders(accessToken), ...extraHeaders }
      : { Authorization: `Bearer ${accessToken}`, ...extraHeaders },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(linkedInErrorMessage(data, `LinkedIn API ${res.status}`));
    err.code = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

async function linkedInPost(accessToken, url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: restHeaders(accessToken),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(linkedInErrorMessage(data, `LinkedIn API ${res.status}`));
    err.code = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

async function fetchUserInfo(accessToken) {
  return linkedInGet(accessToken, 'https://api.linkedin.com/v2/userinfo', { rest: false });
}

async function fetchOrganizationName(accessToken, orgUrn) {
  const id = orgIdFromUrn(orgUrn);
  try {
    const org = await linkedInGet(
      accessToken,
      `https://api.linkedin.com/v2/organizations/${id}`,
      { rest: false }
    );
    return org.localizedName || org.vanityName || `LinkedIn Page ${id}`;
  } catch {
    return `LinkedIn Page ${id}`;
  }
}

async function fetchAdministeredOrg(accessToken) {
  const params = new URLSearchParams({
    q: 'roleAssignee',
    role: 'ADMINISTRATOR',
    state: 'APPROVED',
  });
  const data = await linkedInGet(accessToken, `${REST}/organizationAcls?${params}`, {
    extraHeaders: { 'X-RestLi-Method': 'FINDER' },
  });
  const row = (data.elements || []).find((el) => el.organization);
  if (!row?.organization) return null;
  const orgUrn =
    typeof row.organization === 'string'
      ? row.organization
      : row.organization.entity || row.organization.localizedName || '';
  if (!orgUrn) return null;
  const accountName = await fetchOrganizationName(accessToken, orgUrn);
  return { orgUrn, orgId: orgIdFromUrn(orgUrn), accountName };
}

export async function exchangeLinkedInCode(code) {
  const tokens = await exchangeCodeForTokens(code);
  let profile = {};
  try {
    profile = await fetchUserInfo(tokens.access_token);
  } catch {
    profile = {};
  }

  let org = null;
  if (requestedOrganizationAccess()) {
    try {
      org = await fetchAdministeredOrg(tokens.access_token);
    } catch (err) {
      console.warn('LinkedIn organization lookup skipped:', err.message);
    }
  }

  if (org) {
    return {
      tokens,
      channelId: org.orgId,
      accountName: org.accountName,
      authorUrn: org.orgUrn,
    };
  }

  const personId = profile.sub || '';
  return {
    tokens,
    channelId: personId,
    accountName: profile.name || profile.email || 'LinkedIn',
    authorUrn: personId ? `urn:li:person:${personId}` : '',
  };
}

export async function saveLinkedInConnection(userId, { tokens, channelId, accountName }) {
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
    { user: userId, platform: 'linkedin' },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

function authorUrnForConnection(connection) {
  const id = connection.channelId || '';
  if (!id) return '';
  if (String(id).startsWith('urn:li:')) return id;
  if (/^\d+$/.test(id)) return `urn:li:organization:${id}`;
  return `urn:li:person:${id}`;
}

function postTitleFrom(post) {
  const text = post?.commentary || post?.content?.article?.title || '';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (!clean) return 'LinkedIn post';
  return clean.length > 80 ? `${clean.slice(0, 77)}…` : clean;
}

function commentText(comment) {
  return comment?.message?.text || comment?.commentary || '';
}

function commentAuthor(comment) {
  const actor = comment?.actor || '';
  if (String(actor).includes('organization')) return 'LinkedIn Page';
  return 'LinkedIn member';
}

export async function fetchLinkedInComments(
  connection,
  { maxPosts = 10, maxCommentsPerPost = 40 } = {}
) {
  const accessToken = await getValidAccessToken(connection);
  const authorUrn = authorUrnForConnection(connection);
  if (!authorUrn) {
    throw new Error('LinkedIn Page id missing — reconnect LinkedIn on Connect.');
  }

  const authorParam = encodeUrn(authorUrn);
  let postsData;
  try {
    postsData = await linkedInGet(
      accessToken,
      `${REST}/posts?q=author&author=${authorParam}&count=${maxPosts}&sortBy=LAST_MODIFIED`,
      { extraHeaders: { 'X-RestLi-Method': 'FINDER' } }
    );
  } catch (err) {
    if (err.code === 403 || err.code === 400 || isUnauthorizedAppScope(err)) {
      throw new Error(
        'This LinkedIn app cannot read Company Page posts (w_organization_social is not approved). Personal Sign In + Share still works. Page comments need a separate Community Management API app after LinkedIn review.'
      );
    }
    throw err;
  }

  const posts = postsData.elements || [];
  const comments = [];
  let commentFetchFailures = 0;

  for (const post of posts) {
    const postUrn = post.id;
    if (!postUrn) continue;
    try {
      const thread = await linkedInGet(
        accessToken,
        `${REST}/socialActions/${encodeUrn(postUrn)}/comments?count=${Math.min(100, maxCommentsPerPost)}`
      );
      for (const item of thread.elements || []) {
        const text = commentText(item).trim();
        if (!text) continue;
        comments.push({
          externalId: item.$URN || item.id || `${postUrn}:${text.slice(0, 24)}`,
          videoId: postUrn,
          postTitle: postTitleFrom(post),
          author: commentAuthor(item),
          authorHandle: item.actor || '',
          text,
          likes: item.likesSummary?.totalLikes || item.likes?.summary?.totalLikes || 0,
          replies: item.commentsSummary?.totalFirstLevelComments || 0,
          postedAt: item.created?.time
            ? new Date(item.created.time)
            : item.createdAt
              ? new Date(item.createdAt)
              : new Date(),
          platform: 'linkedin',
        });
      }
    } catch {
      commentFetchFailures += 1;
    }
  }

  let warning = '';
  if (!authorUrn.includes('organization')) {
    warning =
      'Connected a personal LinkedIn profile. Comment sync works best on a Company Page you admin (Community Management API).';
  } else if (posts.length === 0) {
    warning = 'No LinkedIn Page posts found. Publish a post on the connected Page, then Sync again.';
  } else if (comments.length === 0 && commentFetchFailures > 0) {
    warning =
      'Could not read comments. Enable Community Management API (r_organization_social / r_organization_social_feed) and Reconnect.';
  }

  return {
    accountName: connection.accountName,
    comments,
    postsChecked: posts.length,
    commentFetchFailures,
    warning,
  };
}

export async function postLinkedInCommentReply(connection, parentCommentId, postUrn, message) {
  if (!parentCommentId) throw new Error('LinkedIn comment id missing — re-sync comments');
  const text = String(message || '').trim();
  if (!text) throw new Error('Reply message is required');

  const accessToken = await getValidAccessToken(connection);
  const actor = authorUrnForConnection(connection);
  if (!actor) throw new Error('LinkedIn Page missing — reconnect LinkedIn');

  const threadUrn = postUrn || parentCommentId;
  const body = {
    actor,
    message: { text },
    object: threadUrn,
    parentComment: parentCommentId,
  };

  try {
    const data = await linkedInPost(
      accessToken,
      `${REST}/socialActions/${encodeUrn(threadUrn)}/comments`,
      body
    );
    return data.id || data.$URN || '';
  } catch (err) {
    if (err.code === 403 || err.code === 400 || isUnauthorizedAppScope(err)) {
      throw new Error(
        'LinkedIn blocked the reply. w_organization_social is not on this app. Personal replies need w_member_social; Page replies need Community Management API on a separate app.'
      );
    }
    throw err;
  }
}
