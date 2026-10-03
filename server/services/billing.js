import {
  effectivePlanId,
  getPlan,
  isTrialActive,
  planCommentLimit,
  trialDaysLeft,
} from '../config/plans.js';

export function getBillingCatalog() {
  return {
    currency: 'INR',
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    plans: [
      { id: 'starter', priceInr: 999, commentLimit: 2000, salesAgent: false },
      { id: 'growth', priceInr: 2999, commentLimit: 15000, salesAgent: true },
      { id: 'business', priceInr: 7999, commentLimit: 75000, salesAgent: true },
      { id: 'enterprise', priceInr: null, commentLimit: null, salesAgent: true, contactSales: true },
    ],
  };
}

export async function createStripeCheckoutSession({ planId, userEmail, successUrl, cancelUrl }) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return { mock: true, message: 'Stripe not configured — plan switched in-app without charge' };
  }

  const priceMap = {
    starter: process.env.STRIPE_PRICE_STARTER_INR,
    growth: process.env.STRIPE_PRICE_GROWTH_INR,
    business: process.env.STRIPE_PRICE_BUSINESS_INR,
  };
  const priceId = priceMap[planId];
  if (!priceId) {
    throw new Error('Stripe price ID not configured for this plan');
  }

  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    customer_email: userEmail,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Stripe checkout failed');
  }
  return { url: data.url, sessionId: data.id };
}

export function usageForUser(user, commentCount) {
  const planId = effectivePlanId(user);
  const limit = planCommentLimit(planId);
  return {
    planId,
    commentCount,
    commentLimit: limit,
    remaining: limit != null ? Math.max(0, limit - commentCount) : null,
    salesAgent: getPlan(planId).salesAgent,
    trialActive: isTrialActive(user),
    trialEndsAt: user.subscription?.trialEndsAt || null,
    trialDaysLeft: trialDaysLeft(user),
  };
}
