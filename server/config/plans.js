import { currentCatalog } from '../services/planCatalog.js';

/** Server-side plan limits. Names, prices, and features can be edited in admin. */
export const PLAN_IDS = ['starter', 'growth', 'business', 'enterprise'];

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Fallback when the catalog has not been loaded yet. */
export const TRIAL_DAYS = 30;
/** Plan whose limits apply while the free trial is active. */
export const TRIAL_PLAN_ID = 'business';

export function trialDays() {
  const days = Number(currentCatalog().trialDays);
  if (!Number.isFinite(days) || days < 0) return TRIAL_DAYS;
  return Math.round(days);
}

export function getPlan(planId) {
  const plans = currentCatalog().plans;
  return plans.find((p) => p.id === planId) || plans[0];
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
