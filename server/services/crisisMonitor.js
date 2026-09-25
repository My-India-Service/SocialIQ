import Comment from '../models/Comment.js';
import CrisisAlert from '../models/CrisisAlert.js';
import User from '../models/User.js';
import { COMPLAINT_CATEGORIES } from './complaintSeverity.js';
import { isEmailConfigured, sendEmail } from './mailer.js';
import { isWhatsAppConfigured, sendWhatsAppLeadAlert } from './whatsapp.js';
import { logError, logInfo } from './logger.js';

const HOUR = 60 * 60 * 1000;
const BASELINE_DAYS = 7;
const DEDUPE_MS = 6 * HOUR;
const SPIKE_MIN = 5;
const SPIKE_MULTIPLIER = 3;
const CRITICAL_MIN = 10;
const CRITICAL_MULTIPLIER = 6;

function isNegative(c) {
  return c.sentiment === 'negative' || COMPLAINT_CATEGORIES.includes(c.category);
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordRegex(keywords) {
  const list = (keywords || []).map((k) => String(k).trim()).filter(Boolean);
  if (!list.length) return null;
  return new RegExp(`\\b(${list.map(escapeRe).join('|')})\\b`, 'i');
}

async function recentlyAlerted(userId, type, now) {
  return CrisisAlert.exists({
    user: userId,
    type,
    createdAt: { $gte: new Date(now - DEDUPE_MS) },
  });
}

function alertText(user, alert, samples) {
  const lines = [
    `⚠ ${user.brandName || 'Your brand'} — ${alert.severity === 'critical' ? 'CRITICAL' : 'Warning'} crisis alert`,
    alert.reason,
    '',
    ...samples.slice(0, 3).map((c) => `• ${c.author} (${c.platform}): "${String(c.text).slice(0, 140)}"`),
    '',
    'Open SocialAiDigital → Brand health to review and respond.',
  ];
  return lines.join('\n');
}

async function postSlack(url, text) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Slack ${res.status}`);
}

/** Fan out an alert to email, Slack, and WhatsApp. Returns channels that succeeded. */
async function notifyCrisis(user, alert, samples) {
  const text = alertText(user, alert, samples);
  const channels = [];
  const subject = `[SocialAiDigital] ${alert.severity === 'critical' ? 'CRITICAL' : 'Warning'}: ${alert.reason.slice(0, 80)}`;

  if (isEmailConfigured()) {
    const to = [user.email, user.crisis?.alertEmail].filter(Boolean).join(',');
    try {
      const r = await sendEmail({ to, subject, text });
      if (r.delivered) channels.push('email');
    } catch (err) {
      logError(err, { route: 'crisisMonitor.email', userId: String(user._id) });
    }
  }

  if (user.integrations?.slackWebhookUrl) {
    try {
      await postSlack(user.integrations.slackWebhookUrl, text);
      channels.push('slack');
    } catch (err) {
      logError(err, { route: 'crisisMonitor.slack', userId: String(user._id) });
    }
  }

  if (user.integrations?.whatsappNotifyPhone && isWhatsAppConfigured()) {
    try {
      await sendWhatsAppLeadAlert(user.integrations.whatsappNotifyPhone, text.slice(0, 1000));
      channels.push('whatsapp');
    } catch (err) {
      logError(err, { route: 'crisisMonitor.whatsapp', userId: String(user._id) });
    }
  }

  return channels;
}

/**
 * Compare last-hour negative volume with the 7-day hourly baseline and scan for crisis keywords.
 * Deduped per alert type for 6 hours.
 */
export async function evaluateCrisisForUser(user, { notify = true, now = Date.now() } = {}) {
  if (user?.crisis?.enabled === false) return { skipped: true, alerts: [] };

  const since = new Date(now - BASELINE_DAYS * 24 * HOUR);
  const lastHourStart = now - HOUR;
  const comments = await Comment.find({
    user: user._id,
    postedAt: { $gte: since },
    category: { $ne: 'spam' },
  }).select('text sentiment category postedAt author authorHandle platform');

  const lastHour = comments.filter((c) => new Date(c.postedAt).getTime() >= lastHourStart);
  const lastHourNeg = lastHour.filter(isNegative);
  const baselineNegCount = comments.filter(
    (c) => new Date(c.postedAt).getTime() < lastHourStart && isNegative(c)
  ).length;
  const baselineHourly = baselineNegCount / (BASELINE_DAYS * 24 - 1);

  const created = [];

  const spikeThreshold = Math.max(SPIKE_MIN, Math.ceil(baselineHourly * SPIKE_MULTIPLIER));
  if (lastHourNeg.length >= spikeThreshold && !(await recentlyAlerted(user._id, 'spike', now))) {
    const critical = lastHourNeg.length >= Math.max(CRITICAL_MIN, Math.ceil(baselineHourly * CRITICAL_MULTIPLIER));
    const alert = await CrisisAlert.create({
      user: user._id,
      type: 'spike',
      severity: critical ? 'critical' : 'warning',
      reason: `${lastHourNeg.length} negative comments in the last hour (normal ≈ ${baselineHourly.toFixed(1)}/hr)`,
      metrics: {
        lastHourNegative: lastHourNeg.length,
        baselineHourlyNegative: Number(baselineHourly.toFixed(2)),
      },
      sampleComments: lastHourNeg.slice(0, 5).map((c) => c._id),
    });
    created.push({ alert, samples: lastHourNeg });
  }

  const re = keywordRegex(user.crisis?.keywords);
  if (re) {
    const hits = lastHour.filter((c) => re.test(c.text || ''));
    if (hits.length && !(await recentlyAlerted(user._id, 'keyword', now))) {
      const matched = [
        ...new Set(hits.map((c) => (String(c.text).match(re)?.[1] || '').toLowerCase()).filter(Boolean)),
      ];
      const alert = await CrisisAlert.create({
        user: user._id,
        type: 'keyword',
        severity: hits.length >= 3 ? 'critical' : 'warning',
        reason: `Crisis keyword${matched.length === 1 ? '' : 's'} “${matched.join('”, “')}” in ${hits.length} comment${hits.length === 1 ? '' : 's'} this hour`,
        metrics: { keywordHits: hits.length, keywords: matched },
        sampleComments: hits.slice(0, 5).map((c) => c._id),
      });
      created.push({ alert, samples: hits });
    }
  }

  if (notify) {
    for (const { alert, samples } of created) {
      alert.channels = await notifyCrisis(user, alert, samples);
      await alert.save();
    }
  }

  await User.updateOne({ _id: user._id }, { $set: { 'crisis.lastCheckedAt': new Date(now) } });

  return {
    skipped: false,
    lastHourNegative: lastHourNeg.length,
    baselineHourlyNegative: Number(baselineHourly.toFixed(2)),
    alerts: created.map((c) => c.alert),
  };
}

let timer = null;

export async function runCrisisSweep() {
  const users = await User.find({ 'crisis.enabled': { $ne: false } }).select(
    'email brandName crisis integrations'
  );
  let alerts = 0;
  for (const user of users) {
    try {
      const r = await evaluateCrisisForUser(user);
      alerts += r.alerts.length;
    } catch (err) {
      logError(err, { route: 'crisisMonitor.sweep', userId: String(user._id) });
    }
  }
  if (alerts) logInfo(`Crisis sweep: ${alerts} alert(s) across ${users.length} brand(s)`);
  return { users: users.length, alerts };
}

/** Hourly background sweep. Disable with CRISIS_MONITOR_ENABLED=false. */
export function startCrisisMonitor() {
  if (process.env.CRISIS_MONITOR_ENABLED === 'false' || timer) return;
  const run = () =>
    runCrisisSweep().catch((err) => logError(err, { route: 'crisisMonitor.interval' }));
  setTimeout(run, 60 * 1000).unref?.();
  timer = setInterval(run, HOUR);
  timer.unref?.();
}
