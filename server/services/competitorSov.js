import { detectCompetitor } from './ai.js';

const DAY = 24 * 60 * 60 * 1000;
const CHEAPER_RE = /cheaper|sasta|saste|kam\s*(price|daam|me)|less\s*price|lower\s*price|better\s*price|half\s*price|same\s*(thing|product)\s*(for|at)\s*less/i;
const PRICING_ALERT_MIN = 3;

function competitorOf(c) {
  const text = String(c.text || '');
  if (c.category === 'competitor_mention') return c.competitorName || detectCompetitor(text) || 'Unknown';
  return detectCompetitor(text) || null;
}

/**
 * Share of voice: how much of the conversation on your posts is about competitors,
 * weekly trend, and a pricing alert when "cheaper at X" signals cluster.
 */
export function buildShareOfVoice(comments, { weeks = 4, now = Date.now() } = {}) {
  const scored = comments.filter((c) => c.category !== 'spam');
  const total = scored.length;
  const byName = new Map();
  let competitorTotal = 0;

  const weekly = [];
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const end = now - w * 7 * DAY;
    weekly.push({ start: end - 7 * DAY, end, weekEnding: new Date(end).toISOString().slice(0, 10), total: 0, competitor: 0 });
  }

  const recentCheaper = [];

  for (const c of scored) {
    const at = new Date(c.postedAt || c.createdAt || 0).getTime();
    const week = weekly.find((wk) => at >= wk.start && at < wk.end);
    if (week) week.total += 1;

    const name = competitorOf(c);
    if (!name) continue;
    competitorTotal += 1;
    if (week) week.competitor += 1;

    const cheaper = CHEAPER_RE.test(String(c.text || ''));
    const row = byName.get(name) || { name, count: 0, cheaperSignals: 0, samples: [], lastMentionAt: null };
    row.count += 1;
    if (cheaper) row.cheaperSignals += 1;
    if (row.samples.length < 3) row.samples.push(String(c.text || '').slice(0, 160));
    if (!row.lastMentionAt || at > new Date(row.lastMentionAt).getTime()) row.lastMentionAt = new Date(at);
    byName.set(name, row);

    if (cheaper && at >= now - 7 * DAY) recentCheaper.push({ name, text: c.text });
  }

  const competitors = [...byName.values()]
    .map((r) => ({
      ...r,
      share: total ? Math.round((r.count / total) * 1000) / 10 : 0,
      shareOfCompetitorTalk: competitorTotal ? Math.round((r.count / competitorTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const alertNames = [...new Set(recentCheaper.map((r) => r.name))];
  const pricingAlert =
    recentCheaper.length >= PRICING_ALERT_MIN
      ? {
          active: true,
          count: recentCheaper.length,
          competitors: alertNames,
          message: `${recentCheaper.length} comments this week say ${alertNames.join(', ')} is cheaper — review pricing or highlight your value (warranty, COD, quality).`,
          samples: recentCheaper.slice(0, 3).map((r) => String(r.text).slice(0, 160)),
        }
      : { active: false, count: recentCheaper.length, competitors: alertNames };

  return {
    totalComments: total,
    competitorMentions: competitorTotal,
    brandShare: total ? Math.round(((total - competitorTotal) / total) * 1000) / 10 : 100,
    competitorShare: total ? Math.round((competitorTotal / total) * 1000) / 10 : 0,
    competitors,
    weekly: weekly.map(({ weekEnding, total: t, competitor }) => ({
      weekEnding,
      total: t,
      competitor,
      share: t ? Math.round((competitor / t) * 1000) / 10 : 0,
    })),
    pricingAlert,
  };
}
