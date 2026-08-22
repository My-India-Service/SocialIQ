import { isValidPlanId } from '../data/plans';

export function needsOnboarding(user) {
  return Boolean(user && !user.onboardingCompletedAt);
}

export function postAuthPath(user, plan) {
  if (needsOnboarding(user)) return '/onboarding';
  if (plan && isValidPlanId(plan) && plan !== 'starter') return `/app/billing?plan=${plan}`;
  return '/app';
}
