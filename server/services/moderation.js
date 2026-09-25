/**
 * Rule-based moderation scoring: spam/bot signals and toxicity (English + Hinglish).
 * Pure functions — no DB or network — so it can run inside analyzeComment.
 */

const SPAM_SIGNALS = [
  { re: /(https?:\/\/|www\.|bit\.ly|tinyurl|t\.me\/|linktr\.ee)/i, weight: 35, flag: 'link' },
  { re: /follow\s*(for|4)\s*follow|\bf4f\b|sub\s*4\s*sub|like\s*4\s*like/i, weight: 45, flag: 'follow_spam' },
  { re: /check\s+(my|our)\s+(bio|profile|page)|link\s+in\s+(my\s+)?bio/i, weight: 35, flag: 'bio_bait' },
  {
    re: /crypto|bitcoin|forex|giveaway|click\s+to\s+win|earn\s+(rs\.?|₹)?\s?\d+|work\s+from\s+home|investment\s+plan|double\s+your\s+money/i,
    weight: 50,
    flag: 'scam_offer',
  },
  { re: /dm\s+me\s+for\s+(collab|promo|promotion)|promote\s+your\s+(page|account)/i, weight: 40, flag: 'promo' },
  { re: /(.)\1{6,}/, weight: 15, flag: 'repeated_chars' },
];

const COMPETITOR_AD_RE =
  /(buy|order|shop|visit|get)\s+(it\s+)?(from|at|on)\s+@?[a-z0-9_.]{3,}|use\s+code\s+\w+\s+(at|on)\s+@?\w+|cheaper\s+(at|on)\s+@?\w+/i;

const PROFANITY = [
  'fuck', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'moron', 'idiot', 'stupid',
  'chutiya', 'chutiye', 'madarchod', 'bhenchod', 'behenchod', 'gandu', 'harami', 'kamina',
  'kamine', 'randi', 'bsdk', 'bkl', 'lodu', 'lavde', 'lawde', 'saala', 'saale', 'kutta', 'kutte',
];

const THREAT_RE = /\b(kill\s+you|i\s+will\s+kill|maar\s+dunga|jaan\s+se\s+maar|burn\s+your|beat\s+you)\b/i;
const HATE_RE = /\b(go\s+back\s+to\s+your\s+country|terrorist|anti[-\s]?national)\b/i;

const PROFANITY_RE = new RegExp(`\\b(${PROFANITY.join('|')})\\b`, 'gi');

const THRESHOLDS = { low: 75, medium: 55, high: 35 };

export function moderationThreshold(sensitivity = 'medium') {
  return THRESHOLDS[sensitivity] ?? THRESHOLDS.medium;
}

function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} text
 * @param {{ sensitivity?: string, customKeywords?: string[], hideCompetitorAds?: boolean }} settings
 * @returns {{ spamScore: number, toxicity: number, moderationFlags: string[], shouldFlag: boolean }}
 */
export function scoreModeration(text, settings = {}) {
  const body = String(text || '');
  const flags = new Set();
  let spam = 0;
  let toxic = 0;

  for (const signal of SPAM_SIGNALS) {
    if (signal.re.test(body)) {
      spam += signal.weight;
      flags.add(signal.flag);
    }
  }

  const emojiCount = (body.match(/\p{Extended_Pictographic}/gu) || []).length;
  const letters = body.replace(/[^a-z]/gi, '');
  if (emojiCount >= 8 && letters.length < 10) {
    spam += 25;
    flags.add('emoji_flood');
  }

  const upper = body.replace(/[^A-Z]/g, '').length;
  if (letters.length >= 12 && upper / letters.length > 0.75) {
    toxic += 10;
    flags.add('shouting');
  }

  if (settings.hideCompetitorAds !== false && COMPETITOR_AD_RE.test(body)) {
    spam += 55;
    flags.add('competitor_ad');
  }

  const profanityHits = body.match(PROFANITY_RE) || [];
  if (profanityHits.length) {
    toxic += 60 + (profanityHits.length - 1) * 15;
    flags.add('profanity');
  }
  if (THREAT_RE.test(body)) {
    toxic += 70;
    flags.add('threat');
  }
  if (HATE_RE.test(body)) {
    toxic += 60;
    flags.add('hate');
  }

  let customHit = false;
  for (const kw of settings.customKeywords || []) {
    const k = String(kw || '').trim();
    if (!k) continue;
    if (new RegExp(`\\b${escapeRe(k)}\\b`, 'i').test(body)) {
      customHit = true;
      flags.add('custom_rule');
      break;
    }
  }

  const spamScore = clamp(spam);
  const toxicity = clamp(toxic);
  const threshold = moderationThreshold(settings.sensitivity);
  const shouldFlag = customHit || spamScore >= threshold || toxicity >= threshold;

  return { spamScore, toxicity, moderationFlags: [...flags], shouldFlag };
}

/** Human labels for UI + emails. */
export const MODERATION_FLAG_LABELS = {
  link: 'Suspicious link',
  follow_spam: 'Follow/sub spam',
  bio_bait: 'Bio bait',
  scam_offer: 'Scam offer',
  promo: 'Promo spam',
  repeated_chars: 'Repeated characters',
  emoji_flood: 'Emoji flood',
  shouting: 'All caps',
  competitor_ad: 'Competitor ad',
  profanity: 'Profanity',
  threat: 'Threat',
  hate: 'Hate speech',
  custom_rule: 'Custom rule',
};
