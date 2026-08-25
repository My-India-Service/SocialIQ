/**
 * Meta Graph helpers: pacing + 429/backoff for SaaS-safe multi-tenant writes.
 * Official API is fine; burst writes without backoff trigger account flags.
 */

export const META_SYNC_COOLDOWN_MS = 10 * 60 * 1000;
export const MAX_AUTO_REPLIES_PER_SYNC = 5;
export const OUTBOUND_DELAY_MIN_MS = 3000;
export const OUTBOUND_DELAY_MAX_MS = 6000;
export const GRAPH_MAX_RETRIES = 4;

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
  // Meta: 4 = too many calls, 17 = user request limit, 32 = page request limit
  return code === 4 || code === 17 || code === 32;
}

/**
 * Run a Graph fetch; retry on 429 / Meta rate-limit codes with exponential backoff.
 * @param {() => Promise<Response>} doFetch
 */
export async function fetchGraphWithBackoff(doFetch) {
  let lastErr;
  for (let attempt = 0; attempt <= GRAPH_MAX_RETRIES; attempt += 1) {
    const res = await doFetch();
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
      throw err;
    }

    return data;
  }
  throw lastErr || new Error('Meta Graph request failed');
}
