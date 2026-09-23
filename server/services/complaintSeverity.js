const COMPLAINT_CATEGORIES = ['complaint', 'shipping_issue', 'refund_request'];

const REPEAT_RE =
  /\b(again|third time|second time|still waiting|nobody|no one|ignored|not responding|follow.?up|fraud|scam|worst|angry|frustrated|disgusting)\b/i;

const FRUSTRATION_RE =
  /\b(refund|angry|frustrated|disgusting|worst|horrible|terrible|scam|fraud|cheat|lie|liar|shame)\b/i;

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export function isComplaintCategory(category) {
  return COMPLAINT_CATEGORIES.includes(category);
}

export function scoreComplaint(comment) {
  let score = 0;
  const tags = [];
  const text = String(comment.text || '');
  const category = comment.category;

  if (category === 'refund_request') {
    score += 3;
    tags.push('Refund issue');
  } else if (category === 'shipping_issue') {
    score += 2;
    tags.push('Shipping issue');
  } else if (category === 'complaint') {
    score += 1;
  }

  if (comment.sentiment === 'negative') score += 1;

  const heat = (comment.likes || 0) + (comment.replies || 0);
  const publicVisible = Boolean(comment.isViral) || heat >= 20;
  if (publicVisible) {
    score += 2;
    tags.push('Public visibility');
  }

  if (REPEAT_RE.test(text)) {
    score += 2;
    tags.push('Repeated complaint');
  }

  if (FRUSTRATION_RE.test(text) || comment.sentiment === 'negative') {
    if (!tags.includes('High frustration') && (FRUSTRATION_RE.test(text) || score >= 3)) {
      tags.push('High frustration');
    }
  }

  const posted = comment.postedAt ? new Date(comment.postedAt).getTime() : 0;
  const ageMs = posted ? Date.now() - posted : 0;
  if (comment.status === 'new' && ageMs > 24 * 60 * 60 * 1000) {
    score += 1;
  }

  if (comment.escalated) {
    score = Math.max(score, 6);
  }

  let severity = 'low';
  if (score >= 6) severity = 'critical';
  else if (score >= 4) severity = 'high';
  else if (score >= 2) severity = 'medium';

  // Deduplicate tags
  const uniqueTags = [...new Set(tags)];
  if (category === 'refund_request' && !uniqueTags.includes('Refund issue')) {
    uniqueTags.unshift('Refund issue');
  }

  return { severity, score, tags: uniqueTags };
}

export function severityRank(severity) {
  return SEVERITY_ORDER[severity] ?? 9;
}

export { COMPLAINT_CATEGORIES };
