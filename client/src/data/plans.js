/** Subscription catalog — INR primary (India D2C). Mock/Stripe billing until live keys. */
export const PLAN_IDS = ['starter', 'growth', 'business', 'enterprise'];

export const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '₹999',
    priceUsd: '$12',
    blurb: 'Creators & small D2C brands starting with comment sales.',
    perks: ['Up to 2k comments/mo', 'Instagram + YouTube', 'AI sales agent replies', 'Daily CEO email'],
    commentLimit: 2000,
    salesAgent: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '₹2,999',
    priceUsd: '$36',
    blurb: 'Serious D2C brands — hot-lead alerts, ROI, comment→DM agent.',
    perks: [
      'Up to 15k comments/mo',
      'Instagram DM sales agent',
      'Slack / CRM webhook',
      'Sales influenced dashboard',
    ],
    featured: true,
    commentLimit: 15000,
    salesAgent: true,
  },
  {
    id: 'business',
    name: 'Pro',
    price: '₹7,999',
    priceUsd: '$96',
    blurb: 'Multi-SKU brands with heavy ad spend & multiple accounts.',
    perks: ['Up to 75k comments/mo', 'Hinglish intent AI', 'Post-level campaigns', 'Priority sync'],
    commentLimit: 75000,
    salesAgent: true,
  },
  {
    id: 'enterprise',
    name: 'Agency',
    price: '₹19,999+',
    priceUsd: 'Custom',
    blurb: 'Agencies & enterprise — custom volume, SSO, SLAs.',
    perks: ['Unlimited volume', 'Dedicated success', 'Custom AOV models', 'API access'],
    contactSales: true,
    commentLimit: null,
    salesAgent: true,
  },
];

export function getPlan(id) {
  return PLANS.find((p) => p.id === id) || null;
}

export function isValidPlanId(id) {
  return PLAN_IDS.includes(id);
}

export function planCommentLimit(planId) {
  const plan = getPlan(planId);
  return plan?.commentLimit ?? 2000;
}

export function planHasSalesAgent(planId) {
  const plan = getPlan(planId);
  return Boolean(plan?.salesAgent);
}
