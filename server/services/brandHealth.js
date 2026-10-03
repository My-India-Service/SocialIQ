import { COMPLAINT_CATEGORIES, scoreComplaint } from './complaintSeverity.js';

const DAY = 24 * 60 * 60 * 1000;
const LOST_AFTER_MS = 48 * 60 * 60 * 1000;
/** Share of one order value at risk per unanswered complaint, by severity. */
const RISK_WEIGHT = { critical: 1, high: 0.6, medium: 0.3, low: 0.15 };
const RESPONDED = new Set(['replied', 'sent_to_sales', 'converted', 'reviewed']);
const WEIGHTS = { sentiment: 0.3, complaints: 0.25, response: 0.25, resolution: 0.2 };
const MIN_SAMPLE = 10;

function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function ageMs(c, now) {
  return now - new Date(c.postedAt || c.createdAt || now).getTime();
}

function healthLabel(score) {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Watch';
  if (score >= 40) return 'At risk';
  return 'Critical';
}

function scoreComponents(comments, tickets) {
  const scored = comments.filter((c) => c.category !== 'spam' && c.moderationStatus !== 'deleted');
  const n = scored.length;
  const pos = scored.filter((c) => c.sentiment === 'positive').length;
  const neg = scored.filter((c) => c.sentiment === 'negative').length;
  const complaints = scored.filter((c) => COMPLAINT_CATEGORIES.includes(c.category)).length;
  const actionable = scored.filter(
    (c) => c.category === 'sales_opportunity' || c.category === 'feature_request' || COMPLAINT_CATEGORIES.includes(c.category)
  );
  const responded = actionable.filter((c) => RESPONDED.has(c.status)).length;

  const sentiment = n ? clamp(((pos - neg) / n) * 50 + 50) : 50;
  const complaintRate = n ? complaints / n : 0;
  const complaintScore = clamp(100 - complaintRate * 300);
  const response = actionable.length ? clamp((responded / actionable.length) * 100) : 100;

  let resolution = 100;
  let breached = 0;
  if (tickets?.length) {
    const resolved = tickets.filter((t) => t.status === 'resolved').length;
    breached = tickets.filter(
      (t) => t.status !== 'resolved' && new Date(t.slaDueAt).getTime() < Date.now()
    ).length;
    resolution = clamp((resolved / tickets.length) * 100 - breached * 5);
  }

  const score = clamp(
    sentiment * WEIGHTS.sentiment +
      complaintScore * WEIGHTS.complaints +
      response * WEIGHTS.response +
      resolution * WEIGHTS.resolution
  );

  return {
    score,
    sampleSize: n,
    components: [
      {
        key: 'sentiment',
        label: 'Sentiment',
        score: sentiment,
        weight: WEIGHTS.sentiment,
        detail: `${pos} positive · ${neg} negative of ${n}`,
      },
      {
        key: 'complaints',
        label: 'Complaint rate',
        score: complaintScore,
        weight: WEIGHTS.complaints,
        detail: `${Math.round(complaintRate * 100)}% of comments are complaints`,
      },
      {
        key: 'response',
        label: 'Response rate',
        score: response,
        weight: WEIGHTS.response,
        detail: `${responded}/${actionable.length} buyer & complaint comments handled`,
      },
      {
        key: 'resolution',
        label: 'Ticket resolution',
        score: resolution,
        weight: WEIGHTS.resolution,
        detail: tickets?.length
          ? `${tickets.filter((t) => t.status === 'resolved').length}/${tickets.length} resolved · ${breached} past SLA`
          : 'No tickets yet',
      },
    ],
  };
}

/**
 * Money view of brand health: complaints left unanswered put future orders at risk; buyers ignored
 * for 48h+ are treated as lost; younger unanswered buyers are still winnable.
 */
export function computeRevenueHealth(comments, { avgOrderValue = 2499, now = Date.now() } = {}) {
  let revenueAtRisk = 0;
  let atRiskComplaints = 0;
  let revenueLost = 0;
  let lostBuyers = 0;
  let winnableRevenue = 0;
  let winnableBuyers = 0;

  for (const c of comments) {
    if (c.moderationStatus === 'deleted' || c.category === 'spam') continue;
    if (COMPLAINT_CATEGORIES.includes(c.category) && ['new', 'reviewed'].includes(c.status)) {
      const { severity } = scoreComplaint(c);
      revenueAtRisk += avgOrderValue * (RISK_WEIGHT[severity] || 0.15);
      atRiskComplaints += 1;
    }
    if (c.category === 'sales_opportunity' && c.status === 'new') {
      const value = c.expectedOrderValue || 0;
      if (ageMs(c, now) > LOST_AFTER_MS) {
        revenueLost += value;
        lostBuyers += 1;
      } else {
        winnableRevenue += value;
        winnableBuyers += 1;
      }
    }
  }

  return {
    revenueAtRisk: Math.round(revenueAtRisk),
    atRiskComplaints,
    revenueLost: Math.round(revenueLost),
    lostBuyers,
    winnableRevenue: Math.round(winnableRevenue),
    winnableBuyers,
  };
}

/**
 * @param {Array} comments last 30 days
 * @param {Array} tickets
 */
export function computeBrandHealth(comments, tickets = [], { avgOrderValue = 2499, now = Date.now() } = {}) {
  const current = scoreComponents(comments, tickets);

  const trend = [];
  for (let w = 3; w >= 0; w -= 1) {
    const end = now - w * 7 * DAY;
    const start = end - 7 * DAY;
    const week = comments.filter((c) => {
      const t = new Date(c.postedAt || c.createdAt || 0).getTime();
      return t >= start && t < end;
    });
    trend.push({
      weekEnding: new Date(end).toISOString().slice(0, 10),
      score: week.length ? scoreComponents(week, []).score : null,
      comments: week.length,
    });
  }

  const sampleSize = current.sampleSize;
  const dataState = sampleSize === 0 ? 'none' : sampleSize < MIN_SAMPLE ? 'low' : 'ok';
  const components =
    dataState === 'none'
      ? current.components.map((c) =>
          c.key === 'resolution' && tickets?.length
            ? c
            : { ...c, score: null, detail: 'Needs synced comments' }
        )
      : current.components;
  let label = healthLabel(current.score);
  if (dataState === 'none') label = 'No data yet';
  else if (dataState === 'low') label = `${label} (early estimate)`;

  return {
    score: dataState === 'none' ? null : current.score,
    label,
    dataState,
    sampleSize,
    components,
    trend,
    revenue: computeRevenueHealth(comments, { avgOrderValue, now }),
  };
}
