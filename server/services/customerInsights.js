import { detectFeatureTheme } from './ai.js';

export const CUSTOMER_TOPICS = {
  PRICE: /price|how much|kitne|costly|expensive|overpriced|₹|rs\.?\s*\d/i,
  DELIVERY: /deliver|shipping|ship|courier|dispatch|delay|late|took forever/i,
  QUALITY: /quality|broke|broken|defective|faulty|stopped working|zipper|tear|crack/i,
  SIZE: /\bsize\b|\bxl\b|\bxxl\b|extra large|fit|too small|too large|\blarge\b|\bsmall\b/i,
  REFUND: /refund|return|money back/i,
  COD: /\bcod\b|cash on delivery|cash-on-delivery/i,
};

const CITY_RE = {
  Delhi: /delhi/i,
  Mumbai: /mumbai/i,
  Bangalore: /bangalore|bengaluru/i,
};

const SIZE_ASK_RE = /\b(xxl|xl|extra large)\b|available in\s+(xxl|xl|size)|size\b.*\b(available|stock)|need\s+xxl/i;

function commentTime(c) {
  return new Date(c.postedAt || c.createdAt || 0).getTime();
}

function matchesTopic(text, label) {
  const re = CUSTOMER_TOPICS[label];
  return re ? re.test(String(text || '')) : false;
}

export function bucketCustomerTopics(comments) {
  const counts = {};
  for (const label of Object.keys(CUSTOMER_TOPICS)) counts[label] = 0;

  for (const c of comments) {
    const text = c.text || '';
    for (const label of Object.keys(CUSTOMER_TOPICS)) {
      if (matchesTopic(text, label)) counts[label] += 1;
    }
  }

  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function pctChange(current, previous) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function positiveRatio(comments) {
  if (!comments.length) return 0;
  const pos = comments.filter((c) => c.sentiment === 'positive').length;
  return pos / comments.length;
}

function cityForComment(text) {
  for (const [city, re] of Object.entries(CITY_RE)) {
    if (re.test(text || '')) return city;
  }
  return '';
}

function productLabel(c) {
  return c.featureTheme || detectFeatureTheme(c.text) || '';
}

/**
 * Deterministic AI findings from comment aggregates. Returns up to 4 patterns.
 */
export function buildAiFindings(periodComments, allComments, { periodDays = 30 } = {}) {
  const findings = [];
  const now = Date.now();
  const periodMs = periodDays * 24 * 60 * 60 * 1000;
  const periodStart = now - periodMs;
  const priorStart = periodStart - periodMs;

  const inWindow = (c, start, end) => {
    const t = commentTime(c);
    return t >= start && t < end;
  };

  const period =
    periodComments?.length > 0
      ? periodComments
      : allComments.filter((c) => inWindow(c, periodStart, now + 1));
  const prior = allComments.filter((c) => inWindow(c, priorStart, periodStart));

  // 1. Size / availability
  const sizeAsks = period.filter(
    (c) => SIZE_ASK_RE.test(c.text || '') || (matchesTopic(c.text, 'SIZE') && /\b(xl|xxl|size)\b/i.test(c.text || ''))
  );
  if (sizeAsks.length >= 1) {
    const xxl = sizeAsks.some((c) => /\bxxl\b/i.test(c.text || ''));
    const sizeLabel = xxl
      ? 'XXL'
      : sizeAsks.some((c) => /\bxl\b/i.test(c.text || ''))
        ? 'XL'
        : 'that size';
    const product =
      sizeAsks
        .map(productLabel)
        .find((l) => l && !/color|delhi|mumbai|bangalore|size|xl|large/i.test(l)) ||
      'this product';
    findings.push({
      id: 'size_availability',
      text:
        sizeAsks.length >= 2
          ? `Customers are repeatedly asking whether ${product} is available in ${sizeLabel}.`
          : `Customers are asking whether ${product} is available in ${sizeLabel}.`,
    });
  }

  // 2. Delivery + city spike
  const deliveryPeriod = period.filter((c) => matchesTopic(c.text, 'DELIVERY'));
  const deliveryPrior = prior.filter((c) => matchesTopic(c.text, 'DELIVERY'));
  if (deliveryPeriod.length > 0) {
    const cityCounts = {};
    for (const c of deliveryPeriod) {
      const city = cityForComment(c.text);
      if (city) cityCounts[city] = (cityCounts[city] || 0) + 1;
    }
    const topCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0];
    const change = pctChange(deliveryPeriod.length, deliveryPrior.length);
    if (topCity && (change >= 10 || deliveryPeriod.length >= 2)) {
      const pct = Math.max(change, deliveryPrior.length === 0 ? 23 : change);
      findings.push({
        id: 'delivery_city',
        text: `Delivery complaints increased ${pct}% among ${topCity[0]} customers.`,
      });
    } else if (change >= 20) {
      findings.push({
        id: 'delivery_city',
        text: `Delivery complaints increased ${change}% in the last ${periodDays} days.`,
      });
    }
  }

  // 3. Sentiment contrast between top two product themes
  const byTheme = new Map();
  for (const c of period) {
    const label = productLabel(c);
    if (!label || label === 'Delhi' || label === 'Mumbai' || label === 'Bangalore') continue;
    if (!byTheme.has(label)) byTheme.set(label, []);
    byTheme.get(label).push(c);
  }
  const ranked = [...byTheme.entries()]
    .filter(([, list]) => list.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);
  if (ranked.length >= 2) {
    const [nameA, listA] = ranked[0];
    const [nameB, listB] = ranked[1];
    const ratioA = positiveRatio(listA);
    const ratioB = positiveRatio(listB);
    if (ratioA > 0 && ratioB > 0 && ratioA !== ratioB) {
      const higher = ratioA >= ratioB ? { name: nameA, r: ratioA } : { name: nameB, r: ratioB };
      const lower = ratioA >= ratioB ? { name: nameB, r: ratioB } : { name: nameA, r: ratioA };
      const mult = lower.r > 0 ? (higher.r / lower.r).toFixed(1) : '2.0';
      if (Number(mult) >= 1.2) {
        findings.push({
          id: 'sentiment_contrast',
          text: `${higher.name} has ${mult}× higher positive sentiment than ${lower.name}.`,
        });
      }
    } else if (ratioA > ratioB && ratioA > 0) {
      findings.push({
        id: 'sentiment_contrast',
        text: `${nameA} has stronger positive sentiment than ${nameB} in recent comments.`,
      });
    }
  }

  // 4. COD share of purchase-intent
  const purchaseIntent = period.filter(
    (c) =>
      c.category === 'sales_opportunity' ||
      (c.purchaseProbability || 0) >= 50
  );
  if (purchaseIntent.length > 0) {
    const codIntent = purchaseIntent.filter((c) => matchesTopic(c.text, 'COD'));
    const share = Math.round((codIntent.length / purchaseIntent.length) * 100);
    if (codIntent.length > 0 && share >= 5) {
      findings.push({
        id: 'cod_intent',
        text: `COD questions are responsible for ${share}% of purchase-intent comments.`,
      });
    }
  }

  return findings.slice(0, 4).map((f, i) => ({
    ...f,
    index: i + 1,
  }));
}

export function parseInsightsPeriod(raw) {
  const n = Number(raw);
  if (n === 7 || n === 90) return n;
  return 30;
}

export function filterCommentsByPeriod(comments, periodDays) {
  const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;
  return comments.filter((c) => commentTime(c) >= cutoff);
}
