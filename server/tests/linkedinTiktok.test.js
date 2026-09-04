import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';
process.env.LINKEDIN_CLIENT_ID = 'li-client-id';
process.env.LINKEDIN_CLIENT_SECRET = 'li-client-secret';
process.env.TIKTOK_CLIENT_KEY = 'tt-client-key';
process.env.TIKTOK_CLIENT_SECRET = 'tt-client-secret';
process.env.SERVER_URL = 'http://localhost:5001';

const {
  getLinkedInAuthUrl,
  getLinkedInOAuthScopes,
  isLinkedInConfigured,
  linkedInConnectErrorMessage,
  verifyLinkedInOAuthState,
} = await import('../services/linkedin.js');
const {
  getTikTokAuthUrl,
  getTikTokOAuthScopes,
  isTikTokConfigured,
  verifyTikTokOAuthState,
} = await import('../services/tiktok.js');

test('linkedInConnectErrorMessage maps unauthorized organization scope', () => {
  const msg = linkedInConnectErrorMessage(
    'access_denied',
    'Scope "w_organization_social" is not authorized for your application'
  );
  assert.match(msg, /Community Management API/);
  assert.equal(msg.includes('w_organization_social is not authorized'), false);
});

test('isLinkedInConfigured when env vars set', () => {
  assert.equal(isLinkedInConfigured(), true);
});

test('isTikTokConfigured when env vars set', () => {
  assert.equal(isTikTokConfigured(), true);
});

test('getLinkedInOAuthScopes defaults to Sign In + Share and honors LINKEDIN_OAUTH_SCOPES', () => {
  const prevScopes = process.env.LINKEDIN_OAUTH_SCOPES;
  const prevOrg = process.env.LINKEDIN_REQUEST_ORG_SCOPES;
  try {
    delete process.env.LINKEDIN_OAUTH_SCOPES;
    delete process.env.LINKEDIN_REQUEST_ORG_SCOPES;
    const defaults = getLinkedInOAuthScopes();
    assert.ok(defaults.includes('openid'));
    assert.ok(defaults.includes('w_member_social'));
    assert.equal(defaults.includes('r_organization_social'), false);
    assert.equal(defaults.includes('rw_organization_admin'), false);

    process.env.LINKEDIN_OAUTH_SCOPES = 'openid profile r_organization_social';
    assert.deepEqual(getLinkedInOAuthScopes(), ['openid', 'profile']);

    process.env.LINKEDIN_REQUEST_ORG_SCOPES = '1';
    assert.deepEqual(getLinkedInOAuthScopes(), ['openid', 'profile', 'r_organization_social']);
  } finally {
    if (prevScopes === undefined) delete process.env.LINKEDIN_OAUTH_SCOPES;
    else process.env.LINKEDIN_OAUTH_SCOPES = prevScopes;
    if (prevOrg === undefined) delete process.env.LINKEDIN_REQUEST_ORG_SCOPES;
    else process.env.LINKEDIN_REQUEST_ORG_SCOPES = prevOrg;
  }
});

test('getLinkedInAuthUrl uses LinkedIn OAuth and callback', () => {
  const url = getLinkedInAuthUrl('user-id-1');
  assert.match(url, /^https:\/\/www\.linkedin\.com\/oauth\/v2\/authorization\?/);
  assert.match(url, /client_id=li-client-id/);
  assert.match(url, /response_type=code/);
  assert.match(url, /linkedin%2Fcallback/);
  const parsed = new URL(url);
  const userId = verifyLinkedInOAuthState(parsed.searchParams.get('state'));
  assert.equal(userId, 'user-id-1');
  const scope = parsed.searchParams.get('scope') || '';
  assert.ok(scope.includes('openid'));
  assert.ok(scope.includes('w_member_social'));
  assert.equal(scope.includes('r_organization_social'), false);
});

test('getTikTokOAuthScopes includes Login Kit and video list', () => {
  const scopes = getTikTokOAuthScopes();
  assert.ok(scopes.includes('user.info.basic'));
  assert.ok(scopes.includes('video.list'));
});

test('getTikTokAuthUrl uses TikTok authorize and callback', () => {
  const url = getTikTokAuthUrl('user-id-2');
  assert.match(url, /^https:\/\/www\.tiktok\.com\/v2\/auth\/authorize\/\?/);
  assert.match(url, /client_key=tt-client-key/);
  assert.match(url, /response_type=code/);
  assert.match(url, /tiktok%2Fcallback/);
  const parsed = new URL(url);
  const userId = verifyTikTokOAuthState(parsed.searchParams.get('state'));
  assert.equal(userId, 'user-id-2');
});
