const CATEGORIES = [
  'sales_opportunity',
  'complaint',
  'feature_request',
  'positive_feedback',
  'spam',
  'competitor_mention',
  'refund_request',
  'shipping_issue',
  'influencer',
  'other',
];

const COMPETITORS = [
  'adidas',
  'nike',
  'puma',
  'samsung',
  'nothing',
  'google pixel',
  'apple',
  'sony',
  'oneplus',
  'xiaomi',
  'boat',
  'noise',
  'jbl',
  'bose',
];

const CATEGORY_RULES = [
  {
    category: 'spam',
    patterns: [/dm me for/i, /follow for follow/i, /check (my|our) bio/i, /crypto giveaway/i, /bit\.ly/i],
    sentiment: 'neutral',
  },
  {
    category: 'refund_request',
    patterns: [/refund/i, /money back/i, /want my money/i],
    sentiment: 'negative',
  },
  {
    category: 'sales_opportunity',
    patterns: [
      /how much/i,
      /price\??$/i,
      /\bprice\b/i,
      /where can i buy/i,
      /available in/i,
      /in stock/i,
      /do you (ship|deliver)/i,
      /deliver in/i,
      /need this/i,
      /want this/i,
      /link\??$/i,
      /when is this back/i,
    ],
    sentiment: 'positive',
  },
  {
    category: 'shipping_issue',
    patterns: [
      /shipping .+took|took forever|still waiting|haven't received/i,
      /where is my order/i,
      /courier/i,
      /late delivery|delayed dispatch/i,
    ],
    sentiment: 'neutral',
  },
  {
    category: 'complaint',
    patterns: [
      /broke|broken|stopped working|defective|worst|scam|terrible|disappointed|drains too/i,
      /not working|faulty|poor quality|after two weeks/i,
    ],
    sentiment: 'negative',
  },
  {
    category: 'feature_request',
    patterns: [
      /please (launch|add|make)/i,
      /wish (it|you)/i,
      /need (this )?in/i,
      /come in (blue|black|xl|usb)/i,
      /dark mode/i,
      /vegan option/i,
      /blue variant/i,
    ],
    sentiment: 'neutral',
  },
  {
    category: 'competitor_mention',
    patterns: [
      new RegExp(`\\b(${COMPETITORS.join('|')})\\b`, 'i'),
      /switched from/i,
      /buying .+ instead/i,
      /quality is better/i,
    ],
    sentiment: 'neutral',
  },
  {
    category: 'positive_feedback',
    patterns: [/love|amazing|awesome|best|perfect|glad|thank you|thanks|🔥|❤️|great product/i],
    sentiment: 'positive',
  },
];

const TONE_REPLIES = {
  friendly: {
    sales_opportunity: "Hey! Thanks for asking — I'd love to help you grab this. Dropping the details in your DMs!",
    complaint: "So sorry about this — that shouldn't happen. Send us a DM with your order details and we'll make it right.",
    feature_request: "Love this idea! We're always listening — noted and shared with the product team.",
    positive_feedback: "Appreciate it! Glad you're loving it 🔥",
    spam: '',
    competitor_mention: "Thanks for the shout — happy to show you why customers stick with us. DM us anytime!",
    refund_request: "Sorry this didn't work out. DM us your order ID and we'll sort a refund ASAP.",
    shipping_issue: "Ugh, shipping delays are the worst. Share your order ID in DM and we'll track it down.",
    influencer: "Huge thanks for jumping in — we'd love to connect. Check your DMs!",
    other: "Thanks for commenting! How can we help?",
  },
  professional: {
    sales_opportunity: "Thank you for your interest. We'd be happy to share pricing and availability — please check your DMs.",
    complaint: "We're sorry for the inconvenience. Please message us with your order details so we can assist promptly.",
    feature_request: "Thank you for the suggestion. We've shared this feedback with our product team.",
    positive_feedback: "Thanks for your feedback. We're glad you're enjoying the product.",
    spam: '',
    competitor_mention: "Thank you for considering us. We're happy to answer any comparison questions via DM.",
    refund_request: "We're sorry to hear that. Please send your order ID via DM and we'll process your request.",
    shipping_issue: "We apologize for the delay. Please share your order ID so we can investigate immediately.",
    influencer: "Thank you for engaging with us. We'll reach out via DM shortly.",
    other: "Thank you for your comment. How may we assist you?",
  },
  playful: {
    sales_opportunity: "Say less — this one's calling your name 👀 Link + deets incoming in your DMs!",
    complaint: "Yikes, that's not the vibe. Hit us in DMs with your order info — we'll fix it fast.",
    feature_request: "Plot twist: you just wrote our next roadmap item. Logged!",
    positive_feedback: "You're making our day rn 🔥 Keep that energy!",
    spam: '',
    competitor_mention: "Bold of them to enter the chat 😏 We've got receipts — DM us.",
    refund_request: "Not the ending we wanted. Slide your order ID in DMs and we'll sort it.",
    shipping_issue: "Package playing hide and seek? Send the order ID — we'll find it.",
    influencer: "Main character energy spotted. DMing you!",
    other: "We're listening — what's up?",
  },
  luxury: {
    sales_opportunity: "Thank you for your interest. A member of our concierge team will assist you privately.",
    complaint: "We sincerely regret this experience. Please message us so we may resolve this with care.",
    feature_request: "We appreciate your refined suggestion and have noted it for consideration.",
    positive_feedback: "We're honored by your kind words. Thank you for choosing us.",
    spam: '',
    competitor_mention: "We welcome thoughtful comparison. Our team is available should you wish to learn more.",
    refund_request: "We understand. Please share your order details and we shall arrange a resolution.",
    shipping_issue: "We apologize for any delay. Kindly share your order reference for priority assistance.",
    influencer: "A pleasure to have you here. We shall be in touch shortly.",
    other: "Thank you for writing. How may we be of service?",
  },
};

const TONE_LABELS = {
  friendly: 'warm, human, lightly casual',
  professional: 'clear, formal, polite',
  playful: 'witty, casual, Gen-Z friendly',
  luxury: 'refined, calm, concierge-like',
};

const COMPLAINT_THEMES = {
  Battery: /battery|charge|drain|backup/i,
  Shipping: /ship|deliver|courier|dispatch|late|delay/i,
  Quality: /broke|broken|defective|faulty|poor quality|stopped working|zipper|tear|crack/i,
  Support: /support|response|reply|customer care|helpline|no one/i,
  Size: /size|small|large|tight|loose|fit/i,
  Price: /expensive|costly|price|overpriced|refund|money back/i,
};

const PRODUCT_THEMES = {
  'USB-C': /usb-?c/i,
  'Dark mode': /dark mode/i,
  'Blue color': /\bblue\b/i,
  'Black color': /\bblack\b/i,
  'XL / large size': /\b(xl|extra large|large size)\b/i,
  'Vegan option': /vegan/i,
  'Budget under ₹999': /under ?₹?999|cheaper|budget/i,
  Delhi: /delhi/i,
  Bangalore: /bangalore|bengaluru/i,
  Mumbai: /mumbai/i,
};

export function scorePurchaseProbability(text, category) {
  const lower = text.toLowerCase();
  if (/where can i buy|how (do i|to) buy|link to buy|need this now/i.test(lower)) return 98;
  if (/how much|price|available in|in stock|do you (ship|deliver)|deliver in/i.test(lower)) return 92;
  if (/need this|want this|taking this|when is this back/i.test(lower)) return 88;
  if (/looks nice|interested|maybe/i.test(lower)) return 22;
  if (category === 'sales_opportunity') return 80;
  if (category === 'positive_feedback') return 28;
  if (category === 'feature_request') return 35;
  return 10;
}

export function leadTemperatureFromProbability(prob) {
  if (prob >= 80) return 'hot';
  if (prob >= 50) return 'warm';
  if (prob >= 20) return 'cold';
  return 'none';
}

export function estimateExpectedOrderValue(purchaseProbability, avgOrderValue = 2499) {
  const aov = Math.max(0, Number(avgOrderValue) || 2499);
  const prob = Math.max(0, Math.min(100, Number(purchaseProbability) || 0));
  return Math.round((prob / 100) * aov);
}

export function detectCompetitor(text) {
  const lower = text.toLowerCase();
  for (const name of COMPETITORS) {
    if (lower.includes(name)) {
      return name
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }
  if (/switched from|instead of|better than/i.test(text)) return 'Unknown';
  return '';
}

export function detectFeatureTheme(text) {
  for (const [label, re] of Object.entries(PRODUCT_THEMES)) {
    if (re.test(text)) return label;
  }
  const color = text.match(/\b(blue|black|red|green|pink|white|purple)\b/i);
  if (color) return `${color[1].charAt(0).toUpperCase()}${color[1].slice(1).toLowerCase()} color`;
  return '';
}

export function buildAutoDmPreview(user, commentText) {
  const dm = user?.autoDm || {};
  const parts = [
    `Thanks for your comment${commentText ? ` about “${String(commentText).slice(0, 40)}…”` : ''}!`,
  ];
  if (dm.catalogueUrl) parts.push(`Catalogue: ${dm.catalogueUrl}`);
  if (dm.couponCode) parts.push(`Use code ${dm.couponCode} for a limited offer.`);
  if (dm.websiteUrl) parts.push(`Shop here: ${dm.websiteUrl}`);
  if (!dm.catalogueUrl && !dm.couponCode && !dm.websiteUrl) {
    parts.push('Dropping the details — happy to help you order.');
  }
  return parts.join('\n');
}

export function categorizeComment(text) {
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      return {
        category: rule.category,
        purchaseProbability: scorePurchaseProbability(text, rule.category),
        sentiment: rule.sentiment,
      };
    }
  }

  return {
    category: 'other',
    purchaseProbability: scorePurchaseProbability(text, 'other'),
    sentiment: 'neutral',
  };
}

export function suggestReply(text, category, brandTone = 'friendly') {
  const tone = TONE_REPLIES[brandTone] || TONE_REPLIES.friendly;
  return tone[category] || tone.other;
}

function enrichAnalysis(text, base, avgOrderValue = 2499) {
  const purchaseProbability = base.purchaseProbability ?? 0;
  const competitorName =
    base.category === 'competitor_mention' ? detectCompetitor(text) : base.competitorName || '';
  const featureTheme =
    base.category === 'feature_request' || base.category === 'sales_opportunity'
      ? detectFeatureTheme(text) || base.featureTheme || ''
      : base.featureTheme || '';

  return {
    ...base,
    purchaseProbability,
    expectedOrderValue: estimateExpectedOrderValue(purchaseProbability, avgOrderValue),
    leadTemperature: leadTemperatureFromProbability(purchaseProbability),
    competitorName,
    featureTheme,
  };
}

export function analyzeCommentRules(text, brandTone = 'friendly', avgOrderValue = 2499) {
  const result = categorizeComment(text);
  return enrichAnalysis(
    text,
    {
      ...result,
      suggestedReply: suggestReply(text, result.category, brandTone),
      analysisSource: 'rules',
    },
    avgOrderValue
  );
}

function normalizeCategory(value) {
  if (!value) return 'other';
  const cleaned = String(value).toLowerCase().trim().replace(/\s+/g, '_');
  return CATEGORIES.includes(cleaned) ? cleaned : 'other';
}

function normalizeSentiment(value) {
  const s = String(value || '').toLowerCase();
  if (s === 'positive' || s === 'negative' || s === 'neutral') return s;
  return 'neutral';
}

function clampProbability(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

async function analyzeWithLLM(text, brandTone = 'friendly', avgOrderValue = 2499) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const toneDesc = TONE_LABELS[brandTone] || TONE_LABELS.friendly;

  const system = `You are Voxa, an AI Social Revenue Platform for Instagram & YouTube comments.
Classify each comment and draft a short reply in the brand's tone (${toneDesc}).
Return ONLY valid JSON with keys:
category (one of: ${CATEGORIES.join(', ')}),
purchaseProbability (0-100 integer; buying intent),
sentiment (positive|neutral|negative),
suggestedReply (string; empty string for spam; max 2 sentences; brand-tone),
competitorName (string; brand name if competitor_mention else ""),
featureTheme (string; short product/theme label if feature_request else "").`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Comment:\n"""${text.slice(0, 2000)}"""` },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);
  const category = normalizeCategory(parsed.category);

  return enrichAnalysis(
    text,
    {
      category,
      purchaseProbability: clampProbability(parsed.purchaseProbability),
      sentiment: normalizeSentiment(parsed.sentiment),
      suggestedReply:
        typeof parsed.suggestedReply === 'string'
          ? parsed.suggestedReply.trim()
          : suggestReply(text, category, brandTone),
      competitorName: typeof parsed.competitorName === 'string' ? parsed.competitorName.trim() : '',
      featureTheme: typeof parsed.featureTheme === 'string' ? parsed.featureTheme.trim() : '',
      analysisSource: 'llm',
    },
    avgOrderValue
  );
}

/**
 * Prefer OpenAI LLM when OPENAI_API_KEY is set; otherwise rule-based fallback.
 */
export async function analyzeComment(text, brandTone = 'friendly', avgOrderValue = 2499) {
  if (!text?.trim()) {
    return analyzeCommentRules(text || '', brandTone, avgOrderValue);
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const llm = await analyzeWithLLM(text, brandTone, avgOrderValue);
      if (llm) return llm;
    } catch (err) {
      console.warn('LLM analysis failed, using rules:', err.message);
    }
  }

  return analyzeCommentRules(text, brandTone, avgOrderValue);
}

function bucketThemes(comments, themes) {
  const counts = {};
  for (const c of comments) {
    for (const [label, re] of Object.entries(themes)) {
      if (re.test(c.text)) counts[label] = (counts[label] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function aggregateFeatureRequests(comments) {
  const map = new Map();
  for (const c of comments.filter((x) => x.category === 'feature_request')) {
    const label = c.featureTheme || detectFeatureTheme(c.text) || c.text.slice(0, 48);
    const prev = map.get(label) || { label, count: 0, sample: c.text };
    prev.count += 1;
    map.set(label, prev);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function aggregateCompetitors(comments) {
  const map = new Map();
  for (const c of comments.filter((x) => x.category === 'competitor_mention')) {
    const name = c.competitorName || detectCompetitor(c.text) || 'Unknown';
    const prev = map.get(name) || { name, count: 0, samples: [] };
    prev.count += 1;
    if (prev.samples.length < 3) prev.samples.push(c.text);
    map.set(name, prev);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/**
 * @param {Array} comments
 * @param {{ avgOrderValue?: number, currency?: string }} options
 */
export function buildDailyReport(comments, options = {}) {
  const avgOrderValue = options.avgOrderValue ?? 2499;
  const currency = options.currency || 'INR';
  const total = comments.length;
  const byCategory = comments.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {});

  const sales = comments.filter((c) => c.category === 'sales_opportunity');
  const complaints = comments.filter((c) =>
    ['complaint', 'shipping_issue', 'refund_request'].includes(c.category)
  );
  const missedNew = sales.filter((c) => c.status === 'new' || c.status === 'ignored');
  const estimatedMissedRevenue = missedNew.reduce(
    (sum, c) => sum + (c.expectedOrderValue || estimateExpectedOrderValue(c.purchaseProbability, avgOrderValue)),
    0
  );
  const pipelineValue = sales.reduce(
    (sum, c) => sum + (c.expectedOrderValue || estimateExpectedOrderValue(c.purchaseProbability, avgOrderValue)),
    0
  );

  const converted = comments.filter((c) => c.status === 'converted');
  const revenueGenerated = converted.reduce(
    (sum, c) => sum + (c.revenueAttributed || c.expectedOrderValue || avgOrderValue),
    0
  );
  const leadsSent = comments.filter(
    (c) => c.status === 'sent_to_sales' || c.status === 'converted' || (c.routedTo || []).length > 0
  );
  const replied = comments.filter((c) => c.status === 'replied' || c.status === 'converted');
  const recoveredComplaints = complaints.filter(
    (c) => c.status === 'replied' || c.status === 'reviewed' || c.status === 'converted'
  );

  const sentimentCounts = comments.reduce(
    (acc, c) => {
      acc[c.sentiment] = (acc[c.sentiment] || 0) + 1;
      return acc;
    },
    { positive: 0, neutral: 0, negative: 0 }
  );

  const sentimentTotal = Math.max(total, 1);
  const topComplaint = [...complaints].sort((a, b) => b.likes - a.likes)[0]?.text || null;
  const viral = [...comments].sort((a, b) => b.likes + b.replies - (a.likes + a.replies))[0] || null;
  const influencers = comments.filter((c) => c.isVip || c.category === 'influencer').slice(0, 5);

  const featureRequestGroups = aggregateFeatureRequests(comments);
  const competitorIntel = aggregateCompetitors(comments);
  const trendingFeature = featureRequestGroups[0]
    ? `${featureRequestGroups[0].label} requested by ${featureRequestGroups[0].count} users`
    : null;

  const complaintThemes = bucketThemes(complaints, COMPLAINT_THEMES);
  const productSignalPool = comments.filter(
    (c) => c.category === 'feature_request' || c.category === 'sales_opportunity'
  );
  const productRoadmap = bucketThemes(productSignalPool, PRODUCT_THEMES);

  const hotLeads = [...comments]
    .filter((c) => c.purchaseProbability >= 60)
    .sort((a, b) => b.purchaseProbability - a.purchaseProbability)
    .slice(0, 8)
    .map((c) => ({
      id: c._id,
      author: c.author,
      handle: c.authorHandle,
      text: c.text,
      platform: c.platform,
      purchaseProbability: c.purchaseProbability,
      expectedOrderValue: c.expectedOrderValue || estimateExpectedOrderValue(c.purchaseProbability, avgOrderValue),
      leadTemperature: c.leadTemperature || leadTemperatureFromProbability(c.purchaseProbability),
      suggestedReply: c.suggestedReply,
      status: c.status,
    }));

  const scamMentions = comments.filter((c) => /scam|fraud|fake|cheat|thief|report/i.test(c.text));
  const negativePct = Math.round((sentimentCounts.negative / sentimentTotal) * 100);
  const crisis = {
    active: scamMentions.length >= 5 || (negativePct >= 40 && total >= 10),
    scamMentions: scamMentions.length,
    negativePct,
    reason:
      scamMentions.length >= 5
        ? `${scamMentions.length} comments mention scam/fraud`
        : negativePct >= 40
          ? `Negative sentiment at ${negativePct}%`
          : null,
  };

  const avgResponseProxy = Math.round(
    total ? (replied.length / Math.max(sales.length + complaints.length, 1)) * 100 : 0
  );

  return {
    date: new Date().toISOString().slice(0, 10),
    totalComments: total,
    byCategory,
    salesOpportunities: sales.length,
    missedComments: missedNew.length,
    estimatedMissedRevenue,
    pipelineValue,
    avgOrderValue,
    currency,
    complaints: complaints.length,
    topComplaint,
    complaintThemes,
    productRoadmap,
    featureRequestGroups,
    competitorIntel,
    hotLeads,
    crisis,
    trendingFeatureRequest: trendingFeature,
    competitorMentions: competitorIntel.map((c) => c.name),
    mostViralComment: viral
      ? { text: viral.text, author: viral.author, likes: viral.likes, replies: viral.replies }
      : null,
    sentiment: {
      positive: Math.round((sentimentCounts.positive / sentimentTotal) * 100),
      neutral: Math.round((sentimentCounts.neutral / sentimentTotal) * 100),
      negative: negativePct,
    },
    topInfluencers: influencers.map((c) => ({
      author: c.author,
      handle: c.authorHandle,
      text: c.text,
    })),
    roi: {
      revenueGenerated,
      leadsConverted: converted.length,
      leadsSentToSales: leadsSent.length,
      responseCoveragePct: avgResponseProxy,
      complaintsRecovered: recoveredComplaints.length,
      moneyRecoveredEstimate: recoveredComplaints.length * Math.round(avgOrderValue * 0.35),
      customerSatisfactionProxy: Math.round((sentimentCounts.positive / sentimentTotal) * 100),
    },
  };
}

export function buildRoiSummary(comments, options = {}) {
  const report = buildDailyReport(comments, options);
  return {
    currency: report.currency,
    avgOrderValue: report.avgOrderValue,
    ...report.roi,
    pipelineValue: report.pipelineValue,
    estimatedMissedRevenue: report.estimatedMissedRevenue,
    salesOpportunities: report.salesOpportunities,
    totalComments: report.totalComments,
  };
}

export function renderReportEmail(brandName, report) {
  const money = (n) =>
    report.currency === 'INR'
      ? `₹${Number(n || 0).toLocaleString('en-IN')}`
      : `${report.currency} ${Number(n || 0).toLocaleString()}`;

  const line = (label, value) => `${label}: ${value}`;
  const text = [
    `${brandName} — Daily CEO Report (${report.date})`,
    '',
    `${report.totalComments.toLocaleString()} comments analyzed`,
    '',
    line('Sales opportunities', report.salesOpportunities),
    line('Missed / unreplied leads', report.missedComments),
    line('Estimated missed revenue', money(report.estimatedMissedRevenue)),
    line('Pipeline value', money(report.pipelineValue)),
    '',
    line('Revenue attributed', money(report.roi?.revenueGenerated)),
    line('Leads converted', report.roi?.leadsConverted ?? 0),
    '',
    line('Complaints', report.complaints),
    line('Top complaint', report.topComplaint || '—'),
    report.complaintThemes.length
      ? line('Complaint themes', report.complaintThemes.map((t) => `${t.label} (${t.count})`).join(', '))
      : '',
    '',
    line('Trending feature request', report.trendingFeatureRequest || '—'),
    report.featureRequestGroups?.length
      ? line(
          'Feature requests',
          report.featureRequestGroups.map((t) => `${t.label} ×${t.count}`).join(', ')
        )
      : '',
    line('Competitor mentions', report.competitorMentions.join(', ') || '—'),
    '',
    report.crisis.active ? `⚠ CRISIS ALERT: ${report.crisis.reason}` : '',
    '',
    `Sentiment — 😊 ${report.sentiment.positive}%  😐 ${report.sentiment.neutral}%  😡 ${report.sentiment.negative}%`,
    '',
    report.hotLeads.length ? 'Hottest leads:' : '',
    ...report.hotLeads.map(
      (l) =>
        `  • ${l.author} (${l.purchaseProbability}% · ${money(l.expectedOrderValue)}) — "${l.text}"`
    ),
  ]
    .filter((l) => l !== '')
    .join('\n');

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f1c24">
    <h2 style="margin:0 0 4px">${brandName} — Daily CEO Report</h2>
    <p style="color:#5c6b75;margin:0 0 16px">${report.date}</p>
    ${
      report.crisis.active
        ? `<div style="background:#ffe8e2;color:#9a2f18;padding:10px 14px;border-radius:10px;margin-bottom:16px">⚠ <b>Crisis alert:</b> ${report.crisis.reason}</div>`
        : ''
    }
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="padding:8px;border:1px solid #eee"><b>${report.totalComments}</b><br>comments</td>
        <td style="padding:8px;border:1px solid #eee"><b>${report.salesOpportunities}</b><br>sales leads</td>
        <td style="padding:8px;border:1px solid #eee"><b>${money(report.estimatedMissedRevenue)}</b><br>missed revenue</td>
      </tr>
      <tr>
        <td style="padding:8px;border:1px solid #eee"><b>${report.complaints}</b><br>complaints</td>
        <td style="padding:8px;border:1px solid #eee"><b>${report.sentiment.positive}%</b><br>positive</td>
        <td style="padding:8px;border:1px solid #eee"><b>${money(report.roi?.revenueGenerated || 0)}</b><br>revenue attributed</td>
      </tr>
    </table>
    <p><b>Top complaint:</b> ${report.topComplaint || '—'}</p>
    <p><b>Feature requests:</b> ${
      report.featureRequestGroups?.length
        ? report.featureRequestGroups.map((t) => `${t.label} (${t.count})`).join(', ')
        : '—'
    }</p>
    <p><b>Competitors:</b> ${report.competitorMentions.join(', ') || '—'}</p>
    ${
      report.hotLeads.length
        ? `<h3>Hottest leads</h3><ul>${report.hotLeads
            .map(
              (l) =>
                `<li><b>${l.author}</b> (${l.purchaseProbability}% · ${money(l.expectedOrderValue)}) — “${l.text}”</li>`
            )
            .join('')}</ul>`
        : ''
    }
  </div>`;

  return { text, html };
}

export function isLLMConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}
