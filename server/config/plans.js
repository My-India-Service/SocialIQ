/** Server-side plan limits (mirror client/src/data/plans.js). */
export const PLAN_IDS = ['starter', 'growth', 'business', 'enterprise'];

export const PLANS = [
  { id: 'starter', commentLimit: 2000, salesAgent: false },
  { id: 'growth', commentLimit: 15000, salesAgent: true },
  { id: 'business', commentLimit: 75000, salesAgent: true },
  { id: 'enterprise', commentLimit: null, salesAgent: true },
];

export const DAY_MS = 24 * 60 * 60 * 1000;
export const TRIAL_DAYS = 30;
/** Plan whose limits apply while the free trial is active. */
export const TRIAL_PLAN_ID = 'business';

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

export function isTrialActive(user, now = Date.now()) {
  const ends = user?.subscription?.trialEndsAt;
  return Boolean(ends) && new Date(ends).getTime() > now;
}

export function trialDaysLeft(user, now = Date.now()) {
  if (!isTrialActive(user, now)) return 0;
  return Math.ceil((new Date(user.subscription.trialEndsAt).getTime() - now) / DAY_MS);
}

/** The plan whose limits apply right now: at least Pro while the trial is active. */
export function effectivePlanId(user, now = Date.now()) {
  const chosen = PLAN_IDS.includes(user?.subscription?.planId) ? user.subscription.planId : 'starter';
  if (!isTrialActive(user, now)) return chosen;
  return PLAN_IDS.indexOf(chosen) >= PLAN_IDS.indexOf(TRIAL_PLAN_ID) ? chosen : TRIAL_PLAN_ID;
}
