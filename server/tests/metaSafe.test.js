import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertMetaSyncAllowed,
  assertMetaWriteAllowed,
  clampFacebookSyncOptions,
  clampInstagramSyncOptions,
  clampInt,
  DAILY_META_WRITE_BUDGET,
  fetchGraphWithBackoff,
  getMetaUsageState,
  isMetaBlockingError,
  MAX_POSTS_WITH_COMMENTS,
  MAX_SCAN_POSTS,
  metaPauseReason,
  metaUsageBlockReason,
  metaWritesRemaining,
  parseMetaUsageHeaders,
  recordMetaUsage,
  recordMetaWrite,
  resetMetaUsageState,
  tripMetaBreaker,
  withMetaGuard,
} from '../services/metaSafe.js';
import { privateReplyBlockReason } from '../services/instagramMessaging.js';

const headers = (obj) => new Map(Object.entries(obj));

beforeEach(() => resetMetaUsageState());

test('clampInt caps values and falls back on junk', () => {
  assert.equal(clampInt(500, 20, 80), 80);
  assert.equal(clampInt('10', 20, 80), 10);
  assert.equal(clampInt('abc', 20, 80), 20);
  assert.equal(clampInt(-5, 20, 80), 20);
  assert.equal(clampInt(undefined, 200, 80), 80);
});

test('sync option clamps never exceed hard limits', () => {
  const fb = clampFacebookSyncOptions({ maxPosts: 999, maxScan: 999, maxCommentsPerPost: 999 });
  assert.equal(fb.maxPosts, MAX_POSTS_WITH_COMMENTS);
  assert.equal(fb.maxScan, MAX_SCAN_POSTS);
  assert.ok(fb.maxCommentsPerPost <= 50);
  const ig = clampInstagramSyncOptions({ maxMedia: 1000 });
  assert.ok(ig.maxMedia <= 20);
  assert.deepEqual(clampFacebookSyncOptions({}), {
    maxPosts: 20,
    maxCommentsPerPost: 25,
    maxScan: 80,
  });
});

test('parseMetaUsageHeaders takes the max of app + business usage', () => {
  const parsed = parseMetaUsageHeaders(
    headers({
      'x-app-usage': JSON.stringify({ call_count: 40, total_cputime: 10, total_time: 5 }),
      'x-business-use-case-usage': JSON.stringify({
        123: [{ type: 'pages', call_count: 82, total_cputime: 3, total_time: 4, estimated_time_to_regain_access: 0 }],
      }),
    })
  );
  assert.equal(parsed.pct, 82);
  assert.equal(parsed.source, 'business:pages');
  assert.equal(parsed.regainMinutes, 0);
});

test('usage at 90% blocks automated writes but not manual ones', () => {
  const now = Date.now();
  recordMetaUsage(headers({ 'x-app-usage': JSON.stringify({ call_count: 91 }) }), now);
  assert.ok(metaUsageBlockReason(now));
  const conn = { metaWriteDate: '', metaWriteCount: 0 };
  assert.throws(() => assertMetaWriteAllowed(conn, { automated: true, now }), { code: 'META_USAGE_HIGH' });
  assert.doesNotThrow(() => assertMetaWriteAllowed(conn, { automated: false, now }));
  assert.throws(() => assertMetaSyncAllowed({}, now), { code: 'META_USAGE_HIGH' });
  assert.equal(metaUsageBlockReason(now + 31 * 60 * 1000), null);
});

test('estimated_time_to_regain_access triggers a block even at low usage', () => {
  const now = Date.now();
  recordMetaUsage(
    headers({
      'x-business-use-case-usage': JSON.stringify({
        1: [{ type: 'instagram', call_count: 10, estimated_time_to_regain_access: 45 }],
      }),
    }),
    now
  );
  assert.ok(getMetaUsageState().blockedUntil >= now + 45 * 60 * 1000);
});

test('daily write budget resets per day and blocks when exhausted', async () => {
  const now = Date.parse('2026-09-25T10:00:00Z');
  const conn = { metaWriteDate: '2026-09-25', metaWriteCount: DAILY_META_WRITE_BUDGET - 1 };
  assert.equal(metaWritesRemaining(conn, now), 1);
  await recordMetaWrite(conn, now);
  assert.equal(metaWritesRemaining(conn, now), 0);
  assert.throws(() => assertMetaWriteAllowed(conn, { now }), { code: 'META_BUDGET' });
  const tomorrow = Date.parse('2026-09-26T01:00:00Z');
  assert.equal(metaWritesRemaining(conn, tomorrow), DAILY_META_WRITE_BUDGET);
});

test('circuit breaker trips on policy/permission/token codes only', async () => {
  assert.ok(isMetaBlockingError({ code: 368 }));
  assert.ok(isMetaBlockingError({ code: 190 }));
  assert.ok(!isMetaBlockingError({ code: 100 }));
  assert.ok(!isMetaBlockingError({ code: 'SYNC_COOLDOWN' }));

  const conn = { platform: 'facebook' };
  const policyErr = Object.assign(new Error('blocked'), { code: 368 });
  await assert.rejects(withMetaGuard(conn, async () => { throw policyErr; }), policyErr);
  assert.ok(metaPauseReason(conn));
  assert.match(conn.metaPauseReason, /code 368/);
  assert.throws(() => assertMetaWriteAllowed(conn), { code: 'META_PAUSED' });

  let called = false;
  await assert.rejects(withMetaGuard(conn, async () => { called = true; }), { code: 'META_PAUSED' });
  assert.equal(called, false);

  const other = { platform: 'instagram' };
  assert.equal(await tripMetaBreaker(other, { code: 100 }), false);
  assert.equal(metaPauseReason(other), null);
});

test('fetchGraphWithBackoff records usage headers from responses', async () => {
  const res = {
    ok: true,
    status: 200,
    headers: headers({ 'x-app-usage': JSON.stringify({ call_count: 50 }) }),
    json: async () => ({ data: [] }),
  };
  const data = await fetchGraphWithBackoff(async () => res);
  assert.deepEqual(data, { data: [] });
  assert.equal(getMetaUsageState().pct, 50);
});

test('Instagram private reply: once per comment, within 7 days', () => {
  const now = Date.now();
  assert.equal(privateReplyBlockReason({ postedAt: new Date(now - 60_000) }, now), null);
  assert.match(privateReplyBlockReason({ autoDmStatus: 'sent' }, now), /already sent/);
  assert.match(
    privateReplyBlockReason({ postedAt: new Date(now - 8 * 24 * 60 * 60 * 1000) }, now),
    /7 days/
  );
});
