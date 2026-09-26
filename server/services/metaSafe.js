/**
 * Meta Graph helpers: pacing + 429/backoff for SaaS-safe multi-tenant writes.
 * Official API is fine; burst writes without backoff trigger account flags.
 */
import Connection from '../models/Connection.js';
import { logError, logWarn } from './logger.js';

export const META_SYNC_COOLDOWN_MS = 10 * 60 * 1000;
export const MAX_AUTO_REPLIES_PER_SYNC = 5;
export const OUTBOUND_DELAY_MIN_MS = 3000;
export const OUTBOUND_DELAY_MAX_MS = 6000;
export const GRAPH_MAX_RETRIES = 4;

/** Hard ceilings — request bodies can lower these, never raise them. */
export const MAX_SCAN_POSTS = 80;
export const MAX_POSTS_WITH_COMMENTS = 20;
export const MAX_COMMENTS_PER_POST = 50;
export const MAX_INSTAGRAM_MEDIA = 20;
export const MAX_AUTO_HIDES_PER_SYNC = 10;
export const MAX_BULK_PLATFORM_WRITES = 25;
/** Replies + DMs + hides + deletes per connection per UTC day. */
export const DAILY_META_WRITE_BUDGET = 150;
export const READ_PAGE_DELAY_MS = 400;

export const USAGE_SLOWDOWN_PCT = 75;
export const USAGE_BLOCK_PCT = 90;
export const USAGE_BLOCK_MS = 30 * 60 * 1000;
const USAGE_SLOWDOWN_DELAY_MS = 2000;

const HOUR = 60 * 60 * 1000;
/** Graph error codes that mean "stop automating this account for a while". */
export const META_BLOCKING_CODES = {
  368: { ms: 6 * HOUR, reason: 'Meta temporarily blocked actions on this account for policy reasons' },
  10: { ms: 6 * HOUR, reason: 'Meta denied permission for this action' },
  200: { ms: 6 * HOUR, reason: 'Meta permissions error on this account' },
  190: { ms: 30 * 24 * HOUR, reason: 'Access token expired or revoked — reconnect the account' },
};

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomOutboundDelayMs() {
  return (
    OUTBOUND_DELAY_MIN_MS +
    Math.floor(Math.random() * (OUTBOUND_DELAY_MAX_MS - OUTBOUND_DELAY_MIN_MS + 1))
  );
}

export async function paceOutboundMetaWrite() {
  await sleep(randomOutboundDelayMs());
}

export async function paceMetaRead() {
  await sleep(READ_PAGE_DELAY_MS);
}

/* ---------- Input clamps ---------- */

export function clampInt(value, fallback, max, min = 1) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < min) return Math.min(fallback, max);
  return Math.min(n, max);
}

export function clampFacebookSyncOptions(body = {}) {
  return {
    maxPosts: clampInt(body.maxPosts, 20, MAX_POSTS_WITH_COMMENTS),
    maxCommentsPerPost: clampInt(body.maxCommentsPerPost, 25, MAX_COMMENTS_PER_POST),
    maxScan: clampInt(body.maxScan, 80, MAX_SCAN_POSTS),
  };
}

export function clampInstagramSyncOptions(body = {}) {
  return {
    maxMedia: clampInt(body.maxMedia, 10, MAX_INSTAGRAM_MEDIA),
    maxCommentsPerMedia: clampInt(body.maxCommentsPerMedia, 25, MAX_COMMENTS_PER_POST),
  };
}

/* ---------- App / business usage tracking ---------- */

const usageState = { pct: 0, updatedAt: 0, blockedUntil: 0, source: '' };

function maxPct(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  return Math.max(
    0,
    ...['call_count', 'total_cputime', 'total_time'].map((k) => Number(obj[k]) || 0)
  );
}

/**
 * Parse X-App-Usage and X-Business-Use-Case-Usage into the highest usage percentage
 * plus Meta's own "minutes until access returns" hint.
 */
export function parseMetaUsageHeaders(headers) {
  const get = (name) => headers?.get?.(name) || headers?.[name] || null;
  let pct = 0;
  let regainMinutes = 0;
  let source = '';

  const app = get('x-app-usage');
  if (app) {
    try {
      const p = maxPct(JSON.parse(app));
      if (p > pct) {
        pct = p;
        source = 'app';
      }
    } catch {
      /* ignore malformed header */
    }
  }

  const buc = get('x-business-use-case-usage');
  if (buc) {
    try {
      for (const entries of Object.values(JSON.parse(buc))) {
        for (const e of Array.isArray(entries) ? entries : []) {
          const p = maxPct(e);
          if (p > pct) {
            pct = p;
            source = `business:${e.type || 'unknown'}`;
          }
          regainMinutes = Math.max(regainMinutes, Number(e.estimated_time_to_regain_access) || 0);
        }
      }
    } catch {
      /* ignore malformed header */
    }
  }

  return { pct, regainMinutes, source };
}

export function recordMetaUsage(headers, now = Date.now()) {
  const { pct, regainMinutes, source } = parseMetaUsageHeaders(headers);
  if (!pct && !regainMinutes) return usageState;
  usageState.pct = pct;
  usageState.updatedAt = now;
  usageState.source = source;

  if (pct >= USAGE_BLOCK_PCT || regainMinutes > 0) {
    const until = now + Math.max(USAGE_BLOCK_MS, regainMinutes * 60 * 1000);
    if (until > usageState.blockedUntil) {
      usageState.blockedUntil = until;
      logWarn(`Meta API usage at ${pct}% (${source}) — pausing automated Meta calls for 30 min`, {
        route: 'metaSafe.usage',
      });
    }
  } else if (pct >= USAGE_SLOWDOWN_PCT) {
    logWarn(`Meta API usage at ${pct}% (${source}) — slowing down Graph calls`, {
      route: 'metaSafe.usage',
    });
  }
  return usageState;
}

export function getMetaUsageState() {
  return { ...usageState };
}

export function resetMetaUsageState() {
  usageState.pct = 0;
  usageState.updatedAt = 0;
  usageState.blockedUntil = 0;
  usageState.source = '';
}

/** Non-null when Meta usage is too high for bulk/automated work. */
export function metaUsageBlockReason(now = Date.now()) {
  if (usageState.blockedUntil > now) {
    const mins = Math.ceil((usageState.blockedUntil - now) / 60000);
    return `Meta API usage is high (${usageState.pct}%). Automated actions paused for ${mins} min to protect your account.`;
  }
  return null;
}

/* ---------- Per-connection circuit breaker ---------- */

function metaError(message, code, status = 429) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

export function isMetaBlockingError(err) {
  return Boolean(err && META_BLOCKING_CODES[Number(err.code)]);
}

export function metaPauseReason(connection, now = Date.now()) {
  const until = connection?.metaPausedUntil ? new Date(connection.metaPausedUntil).getTime() : 0;
  if (until > now) {
    const hours = Math.ceil((until - now) / HOUR);
    return `${connection.metaPauseReason || 'Paused by Meta'}. Automation paused for ~${hours}h — reconnect the account or wait.`;
  }
  return null;
}

export function assertMetaConnectionActive(connection, now = Date.now()) {
  const reason = metaPauseReason(connection, now);
  if (reason) throw metaError(reason, 'META_PAUSED');
}

/** Pause a connection after Meta returns a policy/permission/token error. */
export async function tripMetaBreaker(connection, err, now = Date.now()) {
  const rule = META_BLOCKING_CODES[Number(err?.code)];
  if (!rule || !connection) return false;
  const until = new Date(now + rule.ms);
  const reason = `${rule.reason} (code ${err.code})`;
  connection.metaPausedUntil = until;
  connection.metaPauseReason = reason;
  if (connection._id) {
    await Connection.updateOne(
      { _id: connection._id },
      { $set: { metaPausedUntil: until, metaPauseReason: reason } }
    );
  }
  logError(err, {
    route: 'metaSafe.circuitBreaker',
    userId: connection.user ? String(connection.user) : undefined,
    platform: connection.platform,
    pausedUntil: until.toISOString(),
  });
  return true;
}

/** Run a Meta call for a connection; trip the breaker on blocking errors. */
export async function withMetaGuard(connection, fn) {
  assertMetaConnectionActive(connection);
  try {
    return await fn();
  } catch (err) {
    if (isMetaBlockingError(err)) await tripMetaBreaker(connection, err);
    throw err;
  }
}

/* ---------- Daily write budget ---------- */

function todayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function metaWritesRemaining(connection, now = Date.now()) {
  if (connection?.metaWriteDate !== todayKey(now)) return DAILY_META_WRITE_BUDGET;
  return Math.max(0, DAILY_META_WRITE_BUDGET - (connection.metaWriteCount || 0));
}

export async function recordMetaWrite(connection, now = Date.now()) {
  if (!connection) return;
  const today = todayKey(now);
  if (connection.metaWriteDate !== today) {
    connection.metaWriteDate = today;
    connection.metaWriteCount = 0;
  }
  connection.metaWriteCount = (connection.metaWriteCount || 0) + 1;
  if (connection._id) {
    await Connection.updateOne(
      { _id: connection._id },
      { $set: { metaWriteDate: today, metaWriteCount: connection.metaWriteCount } }
    );
  }
}

/**
 * Gate every Meta write. Manual actions still pass during high app usage;
 * automated ones (sync auto-reply, auto-DM, auto-hide) do not.
 */
export function assertMetaWriteAllowed(connection, { automated = false, now = Date.now() } = {}) {
  assertMetaConnectionActive(connection, now);
  if (metaWritesRemaining(connection, now) <= 0) {
    throw metaError(
      `Daily Meta action limit reached (${DAILY_META_WRITE_BUDGET}/day for this account). Try again tomorrow — this protects the account from being flagged.`,
      'META_BUDGET'
    );
  }
  if (automated) {
    const usage = metaUsageBlockReason(now);
    if (usage) throw metaError(usage, 'META_USAGE_HIGH');
  }
}

/** Sync = bulk reads: cooldown + breaker + usage block. */
export function assertMetaSyncAllowed(connection, now = Date.now()) {
  assertMetaSyncCooldown(connection);
  assertMetaConnectionActive(connection, now);
  const usage = metaUsageBlockReason(now);
  if (usage) throw metaError(usage, 'META_USAGE_HIGH');
}

export const META_SAFETY_CODES = ['META_PAUSED', 'META_BUDGET', 'META_USAGE_HIGH'];

/**
 * Reject rapid Sync clicks that look like bot polling.
 * @param {{ lastSyncedAt?: Date }} connection
 * @param {number} [cooldownMs]
 */
export function assertMetaSyncCooldown(connection, cooldownMs = META_SYNC_COOLDOWN_MS) {
  if (!connection?.lastSyncedAt) return;
  const elapsed = Date.now() - new Date(connection.lastSyncedAt).getTime();
  if (elapsed < cooldownMs) {
    const waitSec = Math.ceil((cooldownMs - elapsed) / 1000);
    const err = new Error(
      `Sync cooldown: wait ${waitSec}s before syncing again. Frequent syncs can look automated to Meta and risk account restrictions.`
    );
    err.code = 'SYNC_COOLDOWN';
    err.status = 429;
    throw err;
  }
}

function retryAfterMs(res, attempt) {
  const header = res.headers?.get?.('retry-after');
  if (header) {
    const sec = Number(header);
    if (Number.isFinite(sec) && sec > 0) return Math.min(sec * 1000, 60000);
  }
  return Math.min(1000 * 2 ** attempt, 30000);
}

function isRateLimited(res, data) {
  if (res.status === 429) return true;
  const code = data?.error?.code;
  // Meta: 4 = too many calls, 17 = user request limit, 32 = page request limit, 613 = custom rate limit
  return code === 4 || code === 17 || code === 32 || code === 613;
}

/**
 * Run a Graph fetch; retry on 429 / Meta rate-limit codes with exponential backoff.
 * Records usage headers and slows down when Meta reports high usage.
 * @param {() => Promise<Response>} doFetch
 */
export async function fetchGraphWithBackoff(doFetch) {
  let lastErr;
  for (let attempt = 0; attempt <= GRAPH_MAX_RETRIES; attempt += 1) {
    if (usageState.pct >= USAGE_SLOWDOWN_PCT) await sleep(USAGE_SLOWDOWN_DELAY_MS);

    const res = await doFetch();
    if (res?.headers) recordMetaUsage(res.headers);
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (isRateLimited(res, data)) {
      lastErr = new Error(data.error?.message || `Meta Graph rate limited (${res.status})`);
      lastErr.code = data.error?.code || 429;
      lastErr.status = 429;
      if (attempt === GRAPH_MAX_RETRIES) throw lastErr;
      await sleep(retryAfterMs(res, attempt));
      continue;
    }

    if (!res.ok || data.error) {
      const err = new Error(data.error?.message || `Meta Graph API error (${res.status})`);
      err.code = data.error?.code || res.status;
      err.subcode = data.error?.error_subcode;
      throw err;
    }

    return data;
  }
  throw lastErr || new Error('Meta Graph request failed');
}
