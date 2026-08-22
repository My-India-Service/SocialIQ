import jwt from 'jsonwebtoken';
import Connection from '../models/Connection.js';

const IG_GRAPH = 'https://graph.instagram.com/v21.0';
const IG_SCOPES = ['instagram_business_basic', 'instagram_business_manage_comments'].join(',');
let warnedMissingInstagramAppId = false;

export function resolveInstagramCredentials() {
  const appId = process.env.META_INSTAGRAM_APP_ID || process.env.META_APP_ID;
  const appSecret = process.env.META_INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;
  const redirectUri =
    process.env.META_INSTAGRAM_REDIRECT_URI ||
    `${process.env.SERVER_URL || 'http://localhost:5000'}/api/connections/instagram/callback`;

  if (!process.env.META_INSTAGRAM_APP_ID && process.env.META_APP_ID && !warnedMissingInstagramAppId) {
    warnedMissingInstagramAppId = true;
    console.warn(
      '[instagramLogin] META_INSTAGRAM_APP_ID not set — using META_APP_ID. If Meta Dashboard shows a separate Instagram App ID, set META_INSTAGRAM_APP_ID explicitly.'
    );
  }

  if (!appId || !appSecret) {
    throw new Error(
      'Missing Instagram Login credentials. Set META_INSTAGRAM_APP_ID / META_INSTAGRAM_APP_SECRET, or reuse META_APP_ID / META_APP_SECRET (same Meta app). Also enable Instagram → API setup with Instagram login in Meta App Dashboard.'
    );
  }

  return { appId, appSecret, redirectUri };
}

function getConfig() {
  return resolveInstagramCredentials();
}

export function isInstagramDirectOAuthConfigured() {
  const { appId, appSecret } = resolveInstagramCredentials();
  return Boolean(appId && appSecret);
}

export function getInstagramAuthUrl(userId) {
  const { appId, redirectUri } = getConfig();
  const state = jwt.sign(
    { id: userId, purpose: 'instagram_oauth' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: IG_SCOPES,
    state,
    enable_fb_login: 'false',
  });

  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

export function verifyInstagramOAuthState(state) {
  const payload = jwt.verify(state, process.env.JWT_SECRET);
  if (payload.purpose !== 'instagram_oauth' || !payload.id) {
    throw new Error('Invalid OAuth state');
  }
  return payload.id;
}

export function getInstagramOAuthScopes() {
  return IG_SCOPES.split(',');
}

async function exchangeInstagramCode(code) {
  const { appId, appSecret, redirectUri } = getConfig();
  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error_message || data.error) {
    throw new Error(data.error_message || data.error?.message || `Instagram token exchange failed (${res.status})`);
  }

  const row = Array.isArray(data.data) ? data.data[0] : data;
  if (!row?.access_token || !row?.user_id) {
    throw new Error('Instagram token exchange returned an unexpected response');
  }
  return { access_token: row.access_token, user_id: String(row.user_id) };
}

async function exchangeLongLivedInstagramToken(shortToken) {
  const { appSecret } = getConfig();
  const url = new URL('https://graph.instagram.com/access_token');
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('access_token', shortToken);

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Instagram long-lived token exchange failed (${res.status})`);
  }
  return data;
}

async function refreshInstagramLongLivedToken(longToken) {
  const url = new URL('https://graph.instagram.com/refresh_access_token');
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', longToken);

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Instagram token refresh failed (${res.status})`);
  }
  return data;
}

async function fetchInstagramProfile(accessToken) {
  const url = new URL(`${IG_GRAPH}/me`);
  url.searchParams.set('fields', 'user_id,username,name');
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Instagram profile fetch failed (${res.status})`);
  }
  return data;
}

/** Refresh Instagram User token when near expiry (direct login path only). */
export async function getValidInstagramDirectAccessToken(connection) {
  if (connection.metaAuthType !== 'instagram_direct') {
    return connection.accessToken;
  }
  if (!connection.accessToken) {
    throw new Error('Instagram token missing. Reconnect with Instagram login.');
  }

  const expiryMs = connection.tokenExpiry?.getTime?.() || 0;
  const refreshBufferMs = 7 * 24 * 60 * 60 * 1000;
  if (expiryMs && Date.now() < expiryMs - refreshBufferMs) {
    return connection.accessToken;
  }

  const refreshed = await refreshInstagramLongLivedToken(connection.accessToken);
  connection.accessToken = refreshed.access_token;
  connection.tokenExpiry = new Date(Date.now() + (refreshed.expires_in || 5184000) * 1000);
  await connection.save();
  return connection.accessToken;
}

export async function exchangeInstagramCodeAndSave(userId, code) {
  const short = await exchangeInstagramCode(code);
  const long = await exchangeLongLivedInstagramToken(short.access_token);
  const profile = await fetchInstagramProfile(long.access_token).catch(() => ({}));
  const igUserId = String(profile.user_id || short.user_id);
  const accountName = profile.username
    ? `@${profile.username}`
    : profile.name || `Instagram ${igUserId}`;

  const conn = await Connection.findOneAndUpdate(
    { user: userId, platform: 'instagram' },
    {
      accountName,
      channelId: igUserId,
      status: 'connected',
      metaAuthType: 'instagram_direct',
      accessToken: long.access_token,
      refreshToken: '',
      tokenExpiry: new Date(Date.now() + (long.expires_in || 5184000) * 1000),
      connectedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    platform: 'instagram',
    accountName: conn.accountName,
    channelId: conn.channelId,
    metaAuthType: 'instagram_direct',
  };
}
