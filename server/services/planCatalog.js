import PlanSettings from '../models/PlanSettings.js';

export const DEFAULT_PLAN_CATALOG = {
  trialDays: 30,
  plans: [
    {
      id: 'starter',
      name: 'Starter',
      priceInr: 999,
      blurb: 'Creators & small D2C brands starting with comment sales.',
      features: ['Up to 2k comments/mo', 'Instagram + YouTube', 'AI sales agent replies', 'Daily CEO email'],
      commentLimit: 2000,
      salesAgent: false,
      featured: false,
      contactSales: false,
    },
    {
      id: 'growth',
      name: 'Growth',
      priceInr: 2999,
      blurb: 'Serious D2C brands — hot-lead alerts, ROI, comment→DM agent.',
      features: [
        'Up to 15k comments/mo',
        'Instagram DM sales agent',
        'Slack / CRM webhook',
        'Sales influenced dashboard',
      ],
      commentLimit: 15000,
      salesAgent: true,
      featured: true,
      contactSales: false,
    },
    {
      id: 'business',
      name: 'Pro',
      priceInr: 7999,
      blurb: 'Multi-SKU brands with heavy ad spend & multiple accounts.',
      features: ['Up to 75k comments/mo', 'Hinglish intent AI', 'Post-level campaigns', 'Priority sync'],
      commentLimit: 75000,
      salesAgent: true,
      featured: false,
      contactSales: false,
    },
    {
      id: 'enterprise',
      name: 'Agency',
      priceInr: 19999,
      blurb: 'Agencies & enterprise — custom volume, SSO, SLAs.',
      features: ['Unlimited volume', 'Dedicated success', 'Custom AOV models', 'API access'],
      commentLimit: null,
      salesAgent: true,
      featured: false,
      contactSales: true,
    },
  ],
};

const PLAN_IDS = DEFAULT_PLAN_CATALOG.plans.map((plan) => plan.id);

let state = cloneCatalog(DEFAULT_PLAN_CATALOG);

function cloneCatalog(catalog) {
  return {
    trialDays: catalog.trialDays,
    plans: catalog.plans.map((plan) => ({
      ...plan,
      features: [...(plan.features || [])],
    })),
  };
}

export function currentCatalog() {
  return state;
}

function cleanFeatures(value) {
  const raw = Array.isArray(value)
    ? value
    : String(value || '')
        .split('\n');
  const features = [];
  for (const item of raw) {
    const text = String(item || '').trim().slice(0, 120);
    if (!text) continue;
    features.push(text);
    if (features.length >= 8) break;
  }
  return features;
}

/** Merge an admin edit onto the built-in plan ids. Limits stay on the saved plan. */
export function normalizePlanCatalog(input, base = DEFAULT_PLAN_CATALOG) {
  const trialDays = Math.round(Number(input?.trialDays));
  if (!Number.isFinite(trialDays) || trialDays < 0 || trialDays > 365) {
    throw new Error('Free days must be a number from 0 to 365');
  }

  const incoming = new Map((input?.plans || []).map((plan) => [plan.id, plan]));
  const plans = DEFAULT_PLAN_CATALOG.plans.map((fallback) => {
    const next = incoming.get(fallback.id) || {};
    const saved = base.plans.find((plan) => plan.id === fallback.id) || fallback;
    const name = String(next.name ?? saved.name ?? fallback.name).trim().slice(0, 40);
    if (!name) throw new Error(`Plan name is required for ${fallback.id}`);
    const priceInr = Math.round(Number(next.priceInr ?? saved.priceInr ?? fallback.priceInr));
    if (!Number.isFinite(priceInr) || priceInr < 0 || priceInr > 10000000) {
      throw new Error(`Amount for ${name} must be a rupee amount`);
    }
    const features = cleanFeatures(next.features ?? saved.features ?? fallback.features);
    if (!features.length) throw new Error(`Add at least one feature for ${name}`);
    const limitSource = next.commentLimit !== undefined ? next : saved;
    return {
      id: fallback.id,
      name,
      priceInr,
      blurb: String(next.blurb ?? saved.blurb ?? fallback.blurb).trim().slice(0, 180),
      features,
      commentLimit: limitSource.commentLimit ?? null,
      salesAgent: Boolean(
        next.salesAgent !== undefined ? next.salesAgent : (saved.salesAgent ?? fallback.salesAgent)
      ),
      featured: Boolean(saved.featured ?? fallback.featured),
      contactSales: Boolean(saved.contactSales ?? fallback.contactSales),
    };
  });

  const unknown = (input?.plans || []).filter((plan) => !PLAN_IDS.includes(plan.id));
  if (unknown.length) throw new Error('Unknown plan');

  return { trialDays, plans };
}

export async function loadPlanCatalog() {
  try {
    const doc = await PlanSettings.findOne({ singleton: 'catalog' }).lean();
    if (!doc) {
      state = cloneCatalog(DEFAULT_PLAN_CATALOG);
      return state;
    }
    state = normalizePlanCatalog(doc, DEFAULT_PLAN_CATALOG);
  } catch {
    state = cloneCatalog(DEFAULT_PLAN_CATALOG);
  }
  return state;
}

export async function savePlanCatalog(input) {
  const next = normalizePlanCatalog(input, {
    ...DEFAULT_PLAN_CATALOG,
    plans: state.plans.length ? state.plans : DEFAULT_PLAN_CATALOG.plans,
  });
  await PlanSettings.findOneAndUpdate(
    { singleton: 'catalog' },
    { $set: { trialDays: next.trialDays, plans: next.plans, singleton: 'catalog' } },
    { upsert: true, new: true }
  );
  state = next;
  return state;
}

export function publicPlanCatalog() {
  return {
    trialDays: state.trialDays,
    plans: state.plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      priceInr: plan.priceInr,
      blurb: plan.blurb,
      features: plan.features,
      featured: plan.featured,
      contactSales: plan.contactSales,
      commentLimit: plan.commentLimit,
      salesAgent: plan.salesAgent,
    })),
  };
}
