import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';
process.env.META_INSTAGRAM_APP_ID = '123456789';
process.env.META_INSTAGRAM_APP_SECRET = 'test-instagram-secret';
process.env.SERVER_URL = 'http://localhost:5001';

const { getInstagramAuthUrl, getInstagramOAuthScopes, isInstagramDirectOAuthConfigured, resolveInstagramCredentials } =
  await import('../services/instagramLogin.js');
const { resolveInstagramMetaAuthType, getInstagramGraphBase } = await import('../services/meta.js');

test('isInstagramDirectOAuthConfigured when env vars set', () => {
  assert.equal(isInstagramDirectOAuthConfigured(), true);
});

test('getInstagramOAuthScopes includes comment permissions', () => {
  const scopes = getInstagramOAuthScopes();
  assert.ok(scopes.includes('instagram_business_basic'));
  assert.ok(scopes.includes('instagram_business_manage_comments'));
});

test('getInstagramAuthUrl uses instagram.com and hides Facebook login', () => {
  const url = getInstagramAuthUrl('user-id-1');
  assert.match(url, /^https:\/\/www\.instagram\.com\/oauth\/authorize\?/);
  assert.match(url, /enable_fb_login=false/);
  assert.match(url, /instagram_business_manage_comments/);
  assert.match(url, /client_id=123456789/);
  assert.match(url, /redirect_uri=/);
});

test('resolveInstagramMetaAuthType treats legacy empty as facebook_page', () => {
  assert.equal(resolveInstagramMetaAuthType({ metaAuthType: '' }), 'facebook_page');
  assert.equal(resolveInstagramMetaAuthType({}), 'facebook_page');
  assert.equal(resolveInstagramMetaAuthType({ metaAuthType: 'facebook_page' }), 'facebook_page');
  assert.equal(resolveInstagramMetaAuthType({ metaAuthType: 'instagram_direct' }), 'instagram_direct');
});

test('resolveInstagramCredentials falls back to META_APP_ID when META_INSTAGRAM unset', () => {
  const saved = {
    igId: process.env.META_INSTAGRAM_APP_ID,
    igSecret: process.env.META_INSTAGRAM_APP_SECRET,
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
  };
  delete process.env.META_INSTAGRAM_APP_ID;
  delete process.env.META_INSTAGRAM_APP_SECRET;
  process.env.META_APP_ID = 'fallback-app-id';
  process.env.META_APP_SECRET = 'fallback-app-secret';

  const creds = resolveInstagramCredentials();
  assert.equal(creds.appId, 'fallback-app-id');
  assert.equal(creds.appSecret, 'fallback-app-secret');

  if (saved.igId !== undefined) process.env.META_INSTAGRAM_APP_ID = saved.igId;
  else delete process.env.META_INSTAGRAM_APP_ID;
  if (saved.igSecret !== undefined) process.env.META_INSTAGRAM_APP_SECRET = saved.igSecret;
  else delete process.env.META_INSTAGRAM_APP_SECRET;
  if (saved.appId !== undefined) process.env.META_APP_ID = saved.appId;
  if (saved.appSecret !== undefined) process.env.META_APP_SECRET = saved.appSecret;
});

test('getInstagramAuthUrl uses configured Instagram App ID as client_id', () => {
  process.env.META_INSTAGRAM_APP_ID = '1102250409082500';
  const url = getInstagramAuthUrl('user-1');
  assert.match(url, /client_id=1102250409082500/);
});

test('getInstagramGraphBase picks host by auth type', () => {
  assert.equal(
    getInstagramGraphBase({ metaAuthType: 'instagram_direct' }),
    'https://graph.instagram.com/v21.0'
  );
  assert.equal(
    getInstagramGraphBase({ metaAuthType: 'facebook_page' }),
    'https://graph.facebook.com/v21.0'
  );
  assert.equal(getInstagramGraphBase({ metaAuthType: '' }), 'https://graph.facebook.com/v21.0');
});
