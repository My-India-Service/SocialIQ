import { useEffect, useState } from 'react';
import { api } from '../api';
import { PLANS } from '../data/plans';

export function formatPlanPrice(plan) {
  if (plan.priceInr == null || plan.priceInr === '') return 'Custom';
  const amount = `₹${Number(plan.priceInr).toLocaleString('en-IN')}`;
  return plan.contactSales ? `${amount}+` : amount;
}

export function catalogToPlans(catalog) {
  if (!catalog?.plans?.length) return PLANS;
  return catalog.plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    price: formatPlanPrice(plan),
    blurb: plan.blurb || '',
    perks: plan.features?.length ? plan.features : [],
    featured: Boolean(plan.featured),
    contactSales: Boolean(plan.contactSales),
    commentLimit: plan.commentLimit,
    salesAgent: Boolean(plan.salesAgent),
  }));
}

export function trialLabel(days) {
  const count = Number(days);
  if (!Number.isFinite(count) || count <= 0) return 'Choose a plan to start.';
  return `${count} day${count === 1 ? '' : 's'} free — no card needed.`;
}

export function usePlanCatalog() {
  const [plans, setPlans] = useState(PLANS);
  const [trialDays, setTrialDays] = useState(30);

  useEffect(() => {
    let cancelled = false;
    api('/api/billing/catalog')
      .then((data) => {
        if (cancelled) return;
        setPlans(catalogToPlans(data));
        if (Number.isFinite(Number(data.trialDays))) setTrialDays(Number(data.trialDays));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return { plans, trialDays };
}
