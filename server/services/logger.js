import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isEmailConfigured, sendEmail } from './mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.join(__dirname, '..', 'logs');
const RETENTION_DAYS = 30;
const ALERT_DEDUPE_MS = 10 * 60 * 1000;

const recentAlerts = new Map();
let retentionCheckedOn = '';

function localDateStamp(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ensureLogsDir() {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function pruneOldLogs() {
  const today = localDateStamp();
  if (retentionCheckedOn === today) return;
  retentionCheckedOn = today;
  try {
    ensureLogsDir();
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(LOGS_DIR)) {
      if (!name.endsWith('.log')) continue;
      const full = path.join(LOGS_DIR, name);
      const stat = fs.statSync(full);
      if (stat.mtimeMs < cutoff) fs.unlinkSync(full);
    }
  } catch {
    /* ignore retention errors */
  }
}

function logFilePath(dateStamp = localDateStamp()) {
  return path.join(LOGS_DIR, `${dateStamp}.log`);
}

function normalizeError(errOrMessage) {
  if (errOrMessage instanceof Error) {
    return {
      message: errOrMessage.message || String(errOrMessage),
      stack: errOrMessage.stack || '',
      status: errOrMessage.status || errOrMessage.statusCode || null,
    };
  }
  return {
    message: String(errOrMessage || 'Unknown error'),
    stack: '',
    status: null,
  };
}

function alertKey(level, message, route) {
  return `${level}|${message}|${route || ''}`;
}

function shouldSendAlert(key) {
  const now = Date.now();
  for (const [k, ts] of recentAlerts) {
    if (now - ts > ALERT_DEDUPE_MS) recentAlerts.delete(k);
  }
  const last = recentAlerts.get(key);
  if (last && now - last < ALERT_DEDUPE_MS) return false;
  recentAlerts.set(key, now);
  return true;
}

function appendLine(entry) {
  ensureLogsDir();
  pruneOldLogs();
  const line = `${JSON.stringify(entry)}\n`;
  fs.appendFileSync(logFilePath(), line, 'utf8');
}

async function sendErrorAlert(entry) {
  if (!isEmailConfigured()) return { delivered: false, reason: 'SMTP not configured' };

  const key = alertKey(entry.level, entry.message, entry.route);
  if (!shouldSendAlert(key)) {
    return { delivered: false, reason: 'deduped' };
  }

  const to = process.env.ALERT_EMAIL || 'myindiaservice1@gmail.com';
  const short = String(entry.message).slice(0, 80);
  const subject = `[SocialAiDigital] Error: ${short}`;
  const text = [
    `Time: ${entry.ts}`,
    `Level: ${entry.level}`,
    `Message: ${entry.message}`,
    entry.route ? `Route: ${entry.method || ''} ${entry.route}` : null,
    entry.userId ? `User: ${entry.userId}` : null,
    entry.status ? `Status: ${entry.status}` : null,
    entry.meta && Object.keys(entry.meta).length
      ? `Meta: ${JSON.stringify(entry.meta, null, 2)}`
      : null,
    entry.stack ? `\nStack:\n${entry.stack}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    return await sendEmail({ to, subject, text });
  } catch (mailErr) {
    appendLine({
      ts: new Date().toISOString(),
      level: 'warn',
      message: `Failed to send error alert email: ${mailErr.message}`,
    });
    return { delivered: false, reason: mailErr.message };
  }
}

function write(level, errOrMessage, meta = {}) {
  const normalized = normalizeError(errOrMessage);
  const {
    route,
    method,
    userId,
    stack: metaStack,
    status: metaStatus,
    ...restMeta
  } = meta || {};

  const entry = {
    ts: new Date().toISOString(),
    level,
    message: normalized.message,
    stack: metaStack || normalized.stack || undefined,
    route: route || undefined,
    method: method || undefined,
    userId: userId || undefined,
    status: metaStatus || normalized.status || undefined,
    meta: Object.keys(restMeta).length ? restMeta : undefined,
  };

  // Drop undefined keys for cleaner JSON lines
  for (const k of Object.keys(entry)) {
    if (entry[k] === undefined) delete entry[k];
  }

  try {
    appendLine(entry);
  } catch (writeErr) {
    console.error('[logger] failed to write log file:', writeErr.message);
  }

  if (level === 'error' || level === 'fatal') {
    // Fire-and-forget; callers don't need to await
    void sendErrorAlert(entry);
  }

  if (level === 'error' || level === 'fatal') {
    console.error(`[${level}]`, entry.message);
  } else if (level === 'warn') {
    console.warn(`[warn]`, entry.message);
  } else {
    console.log(`[${level}]`, entry.message);
  }

  return entry;
}

export function logInfo(message, meta) {
  return write('info', message, meta);
}

export function logWarn(message, meta) {
  return write('warn', message, meta);
}

export function logError(errOrMessage, meta) {
  return write('error', errOrMessage, meta);
}

export function logFatal(errOrMessage, meta) {
  return write('fatal', errOrMessage, meta);
}

export { LOGS_DIR, logFilePath };
