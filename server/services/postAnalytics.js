import { bucketCustomerTopics } from './customerInsights.js';
import { COMPLAINT_CATEGORIES } from './complaintSeverity.js';

export function postKeyParts(c) {
  const postId = c.videoId || c.postTitle || 'unknown';
  return { platform: c.platform, postId };
}

function emptySummary(platform, postId, postTitle) {
  return {
    key: `${platform}::${postId}`,
    platform,
    postId,
    postTitle: postTitle || '',
    total: 0,
    sentiment: { positive: 0, neutral: 0, negative: 0 },
    leads: 0,
    hot: 0,
    complaints: 0,
    spam: 0,
    pipeline: 0,
    revenue: 0,
    conversions: 0,
    unanswered: 0,
    lastCommentAt: null,
    _comments: [],
  };
}

/**
 * Aggregate comments per post: sentiment, topics, leads, pipeline, and attributed revenue.
 */
export function buildPostSummaries(comments) {
  const map = new Map();
  for (const c of comments) {
    const { platform, postId } = postKeyParts(c);
    const key = `${platform}::${postId}`;
    let s = map.get(key);
    if (!s) {
      s = emptySummary(platform, postId, c.postTitle);
      map.set(key, s);
    }
    if (!s.postTitle && c.postTitle) s.postTitle = c.postTitle;
    s.total += 1;
    s.sentiment[c.sentiment || 'neutral'] = (s.sentiment[c.sentiment || 'neutral'] || 0) + 1;
    if (c.category === 'sales_opportunity') {
      s.leads += 1;
      s.pipeline += c.expectedOrderValue || 0;
      if (c.status === 'new') s.unanswered += 1;
    }
    if (c.leadTemperature === 'hot') s.hot += 1;
    if (COMPLAINT_CATEGORIES.includes(c.category)) s.complaints += 1;
    if (c.category === 'spam') s.spam += 1;
    if (c.status === 'converted') {
      s.conversions += 1;
      s.revenue += c.revenueAttributed || 0;
    }
    const at = c.postedAt || c.createdAt;
    if (at && (!s.lastCommentAt || new Date(at) > new Date(s.lastCommentAt))) s.lastCommentAt = at;
    s._comments.push(c);
  }

  return [...map.values()]
    .map(({ _comments, ...s }) => {
      const scored = s.total - s.spam || 1;
      return {
        ...s,
        sentimentScore: Math.round(((s.sentiment.positive - s.sentiment.negative) / scored) * 50 + 50),
        buyerIntentRate: Math.round((s.leads / scored) * 100),
        complaintRate: Math.round((s.complaints / scored) * 100),
        topTopics: bucketCustomerTopics(_comments).slice(0, 3),
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.pipeline - a.pipeline || b.total - a.total);
}

function moneyLabel(n, currency = 'INR') {
  if (currency === 'INR') return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
  return `${currency} ${Math.round(n || 0).toLocaleString()}`;
}

/**
 * "Make more like this": rank posts by money generated (revenue + weighted pipeline), not likes.
 * Also surface one post to fix (highest complaint share).
 */
export function buildContentIdeas(summaries, { currency = 'INR' } = {}) {
  const ranked = summaries
    .filter((s) => s.leads >= 2 || s.revenue > 0)
    .map((s) => ({ ...s, moneyScore: s.revenue + s.pipeline * 0.3 }))
    .sort((a, b) => b.moneyScore - a.moneyScore);

  const ideas = ranked.slice(0, 3).map((s) => {
    const topic = s.topTopics[0]?.label;
    const why = [
      s.revenue > 0 ? `${moneyLabel(s.revenue, currency)} revenue from ${s.conversions} order${s.conversions === 1 ? '' : 's'}` : null,
      `${s.leads} buyer comment${s.leads === 1 ? '' : 's'} (${s.buyerIntentRate}% intent rate)`,
      s.pipeline > 0 ? `${moneyLabel(s.pipeline, currency)} pipeline` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return {
      type: 'repeat',
      key: s.key,
      platform: s.platform,
      postTitle: s.postTitle || s.postId,
      title: `Make more like “${(s.postTitle || s.postId).slice(0, 60)}”`,
      why,
      suggestion: topic
        ? `Buyers keep asking about ${topic.toLowerCase()} — answer it up front in the next reel/caption and pin a comment with the details.`
        : 'Reuse the same product, hook, and call-to-action in your next post.',
    };
  });

  const fix = summaries
    .filter((s) => s.total >= 5 && s.complaintRate >= 25)
    .sort((a, b) => b.complaintRate - a.complaintRate)[0];
  if (fix) {
    ideas.push({
      type: 'fix',
      key: fix.key,
      platform: fix.platform,
      postTitle: fix.postTitle || fix.postId,
      title: `Address complaints on “${(fix.postTitle || fix.postId).slice(0, 60)}”`,
      why: `${fix.complaintRate}% of comments are complaints (${fix.complaints})`,
      suggestion: `Pin a reply that addresses ${(fix.topTopics[0]?.label || 'the main issue').toLowerCase()} and route open complaints to Tickets.`,
    });
  }

  return ideas;
}
