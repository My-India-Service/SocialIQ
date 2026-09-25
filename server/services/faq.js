/**
 * Auto-FAQ: detect recurring customer questions (English + Hinglish) and pair them with
 * brand-approved answers that feed AI replies.
 */

export const FAQ_INTENTS = [
  { intent: 'price', re: /price|how much|kitne\s*ka|kitna\s*hai|rate\s*kya|cost|kya\s*price|price\s*batao/i },
  { intent: 'cod', re: /\bcod\b|cash\s*on\s*delivery|cod\s*hai/i },
  { intent: 'delivery', re: /deliver|shipping|ship\s+to|delivery\s*(time|kab|ho)|kab\s*tak\s*aayega|pincode/i },
  { intent: 'size', re: /\bsize\b|\bxl\b|\bxxl\b|\bfit\b|size\s*chart|kaunsa\s*size/i },
  { intent: 'availability', re: /in\s*stock|available|availability|back\s*in\s*stock|milega/i },
  { intent: 'genuine', re: /genuine|original|authentic|fake\s*hai|asli/i },
  { intent: 'returns', re: /return|exchange|replace(ment)?|refund\s*policy/i },
  { intent: 'discount', re: /discount|coupon|offer|sale|code\s*(hai|do)/i },
  { intent: 'how_to_order', re: /how\s*(to|do\s*i)\s*order|order\s*kaise|kaha\s*se\s*(le|kharide)|where\s*can\s*i\s*buy|link\s*(do|bhejo)?\??$/i },
];

export const FAQ_INTENT_QUESTIONS = {
  price: 'What is the price?',
  cod: 'Is cash on delivery (COD) available?',
  delivery: 'Do you deliver to my city / how long does delivery take?',
  size: 'Which sizes are available / how does it fit?',
  availability: 'Is it in stock?',
  genuine: 'Is the product genuine / original?',
  returns: 'What is the return / exchange policy?',
  discount: 'Is there any discount or coupon?',
  how_to_order: 'How do I order?',
};

const QUESTION_HINT = /\?|kya|kaise|kab|kitn|kaha|batao|hai\s*kya|can\s+i|do\s+you|is\s+it|how|where|when|which/i;

export function detectFaqIntent(text) {
  const body = String(text || '');
  for (const { intent, re } of FAQ_INTENTS) {
    if (re.test(body)) return intent;
  }
  return null;
}

/**
 * Rank recurring questions from comments and merge saved brand answers.
 * @param {Array} comments
 * @param {Array<{intent:string, answer:string, enabled:boolean}>} savedFaq
 */
export function buildFaqSuggestions(comments, savedFaq = []) {
  const saved = new Map((savedFaq || []).map((f) => [f.intent, f]));
  const buckets = new Map();

  for (const c of comments) {
    const text = String(c.text || '');
    if (c.category === 'spam' || !QUESTION_HINT.test(text)) continue;
    const intent = detectFaqIntent(text);
    if (!intent) continue;
    const b = buckets.get(intent) || { intent, count: 0, samples: [], lastAskedAt: null };
    b.count += 1;
    if (b.samples.length < 3) b.samples.push(text.slice(0, 160));
    const at = c.postedAt || c.createdAt;
    if (at && (!b.lastAskedAt || new Date(at) > new Date(b.lastAskedAt))) b.lastAskedAt = at;
    buckets.set(intent, b);
  }

  for (const intent of saved.keys()) {
    if (!buckets.has(intent)) buckets.set(intent, { intent, count: 0, samples: [], lastAskedAt: null });
  }

  return [...buckets.values()]
    .map((b) => {
      const s = saved.get(b.intent);
      return {
        ...b,
        question: FAQ_INTENT_QUESTIONS[b.intent] || b.intent,
        answer: s?.answer || '',
        enabled: s ? s.enabled !== false : true,
        needsAnswer: b.count > 0 && !String(s?.answer || '').trim(),
      };
    })
    .sort((a, b) => b.count - a.count);
}
