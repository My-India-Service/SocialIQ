import jwt from 'jsonwebtoken';
import Connection from '../models/Connection.js';

const GRAPH = 'https://graph.facebook.com/v21.0';

const SCOPES = [
  'public_profile',
  'email',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
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

async function graphGet(path, accessToken, params = {}) {
  const url = new URL(path.startsWith('http') ? path : `${GRAPH}/${path}`);
  url.searchParams.set('access_token', accessToken);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Meta Graph API error (${res.status})`);
  }
  return data;
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

  // Prefer a page that has Instagram linked when connecting IG
  let page = pages[0];
  if (platform === 'instagram') {
    page = pages.find((p) => p.instagram_business_account?.id) || null;
    if (!page) {
      throw new Error(
        'No Instagram Business/Creator account linked to your Facebook Page. Link IG in Meta Business Suite, then retry.'
      );
    }
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
          accessToken: pageToken,
          refreshToken: tokens.access_token,
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          connectedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      results.push(igConn);

      // Also save the linked Facebook page
      const fb = await Connection.findOneAndUpdate(
        { user: userId, platform: 'facebook' },
        {
          accountName: page.name || `Page ${page.id}`,
          channelId: page.id,
          status: 'connected',
          accessToken: pageToken,
          refreshToken: tokens.access_token,
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          connectedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      results.push(fb);
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
 * Facebook Page post comments (official Graph API).
 */
export async function fetchFacebookComments(connection, { maxPosts = 10, maxCommentsPerPost = 50 } = {}) {
  if (!connection.accessToken || !connection.channelId) {
    throw new Error('Facebook Page token missing. Reconnect with Meta.');
  }

  const posts = await graphGet(`${connection.channelId}/posts`, connection.accessToken, {
    fields: 'id,message,created_time,permalink_url',
    limit: maxPosts,
  });

  const comments = [];

  for (const post of posts.data || []) {
    let nextUrl = null;
    let fetched = 0;

    const first = await graphGet(`${post.id}/comments`, connection.accessToken, {
      fields: 'id,from,message,created_time,comment_count,like_count',
      filter: 'stream',
      order: 'reverse_chronological',
      limit: Math.min(50, maxCommentsPerPost),
    }).catch((err) => {
      console.warn('FB comments skip post', post.id, err.message);
      return { data: [] };
    });

    const queue = [...(first.data || [])];
    nextUrl = first.paging?.next;

    while (queue.length && fetched < maxCommentsPerPost) {
      const c = queue.shift();
      if (!c?.message?.trim()) continue;
      comments.push({
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
      });
      fetched += 1;
    }

    // one extra page if needed
    if (nextUrl && fetched < maxCommentsPerPost) {
      try {
        const more = await fetch(nextUrl).then((r) => r.json());
        for (const c of more.data || []) {
          if (fetched >= maxCommentsPerPost) break;
          if (!c?.message?.trim()) continue;
          comments.push({
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
          });
          fetched += 1;
        }
      } catch {
        /* ignore */
      }
    }
  }

  return {
    accountName: connection.accountName,
    comments,
  };
}

/**
 * Instagram media comments (Instagram Graph API via Page token).
 */
export async function fetchInstagramComments(connection, { maxMedia = 12, maxCommentsPerMedia = 50 } = {}) {
  if (!connection.accessToken || !connection.channelId) {
    throw new Error('Instagram account token missing. Reconnect with Meta.');
  }

  const media = await graphGet(`${connection.channelId}/media`, connection.accessToken, {
    fields: 'id,caption,timestamp,permalink,comments_count',
    limit: maxMedia,
  });

  const comments = [];

  for (const item of media.data || []) {
    let fetched = 0;
    const res = await graphGet(`${item.id}/comments`, connection.accessToken, {
      fields: 'id,text,username,timestamp,like_count,replies{count}',
      limit: Math.min(50, maxCommentsPerMedia),
    }).catch((err) => {
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

  return {
    accountName: connection.accountName,
    comments,
  };
}
