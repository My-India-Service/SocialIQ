/** Server-side plan limits (mirror client/src/data/plans.js). */
export const PLAN_IDS = ['starter', 'growth', 'business', 'enterprise'];

export const PLANS = [
  { id: 'starter', commentLimit: 2000, salesAgent: false },
  { id: 'growth', commentLimit: 15000, salesAgent: true },
  { id: 'business', commentLimit: 75000, salesAgent: true },
  { id: 'enterprise', commentLimit: null, salesAgent: true },
];

export function getPlan(planId) {
  return PLANS.find((p) => p.id === planId) || PLANS[0];
}

export function planCommentLimit(planId) {
  const plan = getPlan(planId);
  return plan.commentLimit;
}

export function planHasSalesAgent(planId) {
  return Boolean(getPlan(planId).salesAgent);
}
