import express from 'express';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { buildDailyReport, detectFeatureTheme, renderReportEmail } from '../services/ai.js';
import { isEmailConfigured, sendEmail } from '../services/mailer.js';

const router = express.Router();

router.use(authRequired);

const COMPLAINT_CATEGORIES = ['complaint', 'shipping_issue', 'refund_request'];
const OPEN_STATUSES = new Set(['new', 'ignored']);
const REFUND_RE = /refund|money back|return|cancel(led)? order/i;

function pctChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function dayKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function daysAgo(from, n) {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d;
}

function inRange(comment, start, end) {
  const t = new Date(comment.postedAt).getTime();
  return t >= start.getTime() && t < end.getTime();
}

function countKpis(comments) {
  const sales = comments.filter((c) => c.category === 'sales_opportunity');
  const complaints = comments.filter((c) => COMPLAINT_CATEGORIES.includes(c.category));
  const hotLeads = comments.filter((c) => (c.purchaseProbability || 0) >= 60);
  return {
    comments: comments.length,
    leads: sales.length,
    complaints: complaints.length,
    hotLeads: hotLeads.length,
  };
}

function buildKpiCards(currentComments, previousComments) {
  const current = countKpis(currentComments);
  const previous = countKpis(previousComments);
  return [
    {
      key: 'comments',
      label: 'Comments',
      value: current.comments,
      changePct: pctChange(current.comments, previous.comments),
    },
    {
      key: 'leads',
      label: 'Leads',
      value: current.leads,
      changePct: pctChange(current.leads, previous.leads),
    },
    {
      key: 'complaints',
      label: 'Complaints',
      value: current.complaints,
      changePct: pctChange(current.complaints, previous.complaints),
    },
    {
      key: 'hotLeads',
      label: 'Hot Leads',
      value: current.hotLeads,
      changePct: pctChange(current.hotLeads, previous.hotLeads),
    },
  ];
}

/** 30 daily points of positive sentiment % for sparkline. */
function buildSentimentTrend(comments30d, now = new Date()) {
  const byDay = new Map();
  for (const c of comments30d) {
    const key = dayKey(c.postedAt);
    const bucket = byDay.get(key) || { positive: 0, total: 0 };
    bucket.total += 1;
    if (c.sentiment === 'positive') bucket.positive += 1;
    byDay.set(key, bucket);
  }

  const trend = [];
  let lastScore = 50;
  for (let i = 29; i >= 0; i -= 1) {
    const d = daysAgo(now, i);
    const key = dayKey(d);
    const bucket = byDay.get(key);
    let positivePct;
    let score;
    if (bucket && bucket.total > 0) {
      positivePct = Math.round((bucket.positive / bucket.total) * 100);
      score = positivePct;
      lastScore = score;
    } else {
      positivePct = null;
      score = lastScore;
    }
    trend.push({ date: key, positivePct, score });
  }
  return trend;
}

function productLabel(comment) {
  return (
    comment.featureTheme ||
    detectFeatureTheme(comment.text || '') ||
    (comment.category === 'feature_request' ? String(comment.text || '').slice(0, 32) : '')
  );
}

function isRefundRelated(comment) {
  return comment.category === 'refund_request' || REFUND_RE.test(comment.text || '');
}

function buildAiAlerts(comments30d, currentWindowComments, now = new Date()) {
  const alerts = [];
  const dayMs = 24 * 60 * 60 * 1000;
  const dayAgo = new Date(now.getTime() - dayMs);
  const sevenAgo = daysAgo(now, 7);
  const fourteenAgo = daysAgo(now, 14);

  const intentPool =
    currentWindowComments.length > 0 ? currentWindowComments : comments30d;
  const highIntent = intentPool.filter(
    (c) => (c.purchaseProbability || 0) >= 60 && OPEN_STATUSES.has(c.status || 'new')
  );
  if (highIntent.length > 0) {
    alerts.push({
      id: 'high_intent',
      severity: 'hot',
      icon: '🔥',
      count: highIntent.length,
      message: `${highIntent.length} high-intent customers detected`,
    });
  }

  const unanswered = comments30d.filter(
    (c) =>
      COMPLAINT_CATEGORIES.includes(c.category) &&
      OPEN_STATUSES.has(c.status || 'new') &&
      new Date(c.postedAt) < dayAgo
  );
  if (unanswered.length > 0) {
    alerts.push({
      id: 'unanswered_complaints',
      severity: 'urgent',
      icon: '🚨',
      count: unanswered.length,
      message: `${unanswered.length} complaints unanswered >24h`,
    });
  }

  const recentProduct = comments30d.filter(
    (c) =>
      inRange(c, sevenAgo, now) &&
      (c.category === 'feature_request' || Boolean(productLabel(c)))
  );
  const priorProduct = comments30d.filter(
    (c) =>
      inRange(c, fourteenAgo, sevenAgo) &&
      (c.category === 'feature_request' || Boolean(productLabel(c)))
  );

  const recentThemeCounts = new Map();
  for (const c of recentProduct) {
    const label = productLabel(c);
    if (!label) continue;
    recentThemeCounts.set(label, (recentThemeCounts.get(label) || 0) + 1);
  }
  const priorThemeCounts = new Map();
  for (const c of priorProduct) {
    const label = productLabel(c);
    if (!label) continue;
    priorThemeCounts.set(label, (priorThemeCounts.get(label) || 0) + 1);
  }

  let bestSpike = null;
  for (const [label, count] of recentThemeCounts) {
    const prev = priorThemeCounts.get(label) || 0;
    const change = pctChange(count, prev);
    if (change >= 25 && count > 0) {
      if (!bestSpike || change > bestSpike.change) {
        bestSpike = { label, count, change };
      }
    }
  }
  if (bestSpike) {
    alerts.push({
      id: 'product_spike',
      severity: 'info',
      icon: '📈',
      count: bestSpike.count,
      message: `${bestSpike.label} mentions increased ${bestSpike.change}%`,
    });
  }

  const recentRefund = comments30d.filter((c) => inRange(c, sevenAgo, now) && isRefundRelated(c));
  const priorRefund = comments30d.filter(
    (c) => inRange(c, fourteenAgo, sevenAgo) && isRefundRelated(c)
  );
  const refundChange = pctChange(recentRefund.length, priorRefund.length);
  if (recentRefund.length > 0 && refundChange >= 25) {
    alerts.push({
      id: 'refund_spike',
      severity: 'warn',
      icon: '⚠️',
      count: recentRefund.length,
      message: `Refund-related comments increased ${refundChange}%`,
    });
  }

  return alerts;
}

async function loadReport(userId) {
  const now = new Date();
  const currentStart = daysAgo(now, 1);
  const previousStart = daysAgo(now, 2);
  const thirtyStart = daysAgo(now, 30);

  const comments30d = await Comment.find({
    user: userId,
    postedAt: { $gte: thirtyStart },
  }).sort({ postedAt: 1 });

  let comments = comments30d.filter((c) => new Date(c.postedAt) >= currentStart);
  let previousComments = comments30d.filter((c) =>
    inRange(c, previousStart, currentStart)
  );
  let kpiCurrent = comments;

  // Fallback: if no "yesterday" comments, use all for demo report value and
  // split by postedAt for a rough prior-period KPI comparison.
  let usedFallback = false;
  if (comments.length === 0) {
    usedFallback = true;
    const all =
      comments30d.length > 0
        ? comments30d
        : await Comment.find({ user: userId }).sort({ postedAt: 1 });
    comments = all;
    const mid = Math.floor(all.length / 2);
    previousComments = all.slice(0, mid);
    kpiCurrent = all.slice(mid);
    if (kpiCurrent.length === 0) kpiCurrent = all;
  }

  const user = await User.findById(userId).select('-password');
  const report = buildDailyReport(comments, {
    avgOrderValue: user?.avgOrderValue ?? 2499,
    currency: user?.currency || 'INR',
  });
  report.kpis = buildKpiCards(kpiCurrent, previousComments);

  const trendSource =
    comments30d.length > 0
      ? comments30d
      : usedFallback
        ? comments
        : comments30d;
  report.sentimentTrend = buildSentimentTrend(trendSource, now);
  report.aiAlerts = buildAiAlerts(
    trendSource.length ? trendSource : comments,
    usedFallback ? kpiCurrent : comments,
    now
  );

  return { user, report };
}

router.get('/daily', async (req, res) => {
  try {
    const { user, report } = await loadReport(req.userId);
    res.json({
      brandName: user.brandName,
      emailConfigured: isEmailConfigured(),
      report,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/email-preview', async (req, res) => {
  try {
    const { user, report } = await loadReport(req.userId);
    const subject = `${user.brandName} — Daily CEO Report`;
    const { text } = renderReportEmail(user.brandName, report);

    res.json({
      to: user.email,
      from: process.env.REPORT_FROM || 'SocialAiDigital <reports@socialaidigital.com>',
      subject,
      body: text,
      delivered: false,
      emailConfigured: isEmailConfigured(),
      note: isEmailConfigured()
        ? 'SMTP configured — click “Send now” to deliver.'
        : 'Add SMTP_HOST / SMTP_USER / SMTP_PASS to server/.env to send real email.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { user, report } = await loadReport(req.userId);
    if (!isEmailConfigured()) {
      return res.status(400).json({
        message: 'Email not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to server/.env.',
      });
    }

    const subject = `${user.brandName} — Daily CEO Report (${report.date})`;
    const { text, html } = renderReportEmail(user.brandName, report);
    const to = req.body?.to || user.email;

    const result = await sendEmail({ to, subject, text, html });
    res.json({
      delivered: result.delivered,
      to,
      subject,
      messageId: result.messageId || null,
      message: result.delivered ? `Report emailed to ${to}` : 'Email not sent',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
