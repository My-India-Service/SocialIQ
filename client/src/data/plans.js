/** Shared subscription catalog (USD). Mock billing until Stripe. */
export const PLAN_IDS = ['starter', 'growth', 'business', 'enterprise'];

export const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$49',
    blurb: 'For early Shopify brands validating comment revenue.',
    perks: ['Up to 2k comments/mo', 'IG + YouTube', 'AI replies', 'Daily CEO email'],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$149',
    blurb: 'For teams that need Slack routing and ROI tracking.',
    perks: ['Up to 15k comments/mo', 'Hot-lead alerts', 'Slack / WhatsApp / CRM', 'ROI dashboard'],
    featured: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '$399',
    blurb: 'For multi-SKU brands with heavy ad spend.',
    perks: ['Up to 75k comments/mo', 'Competitor intel', 'Auto DM catalogue', 'Priority sync'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$1,000+',
    blurb: 'Custom volume, SSO, and recovered-revenue SLAs.',
    perks: ['Unlimited volume', 'Dedicated success', 'Custom AOV models', 'API access'],
    contactSales: true,
  },
];

export function getPlan(id) {
  return PLANS.find((p) => p.id === id) || null;
}

export function isValidPlanId(id) {
  return PLAN_IDS.includes(id);
}
