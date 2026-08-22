import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { getPlan, PLANS } from '../data/plans';

export default function Billing() {
  const { user, token, setUser } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightPlan = searchParams.get('plan');
  const checkoutResult = searchParams.get('checkout');
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [usage, setUsage] = useState(null);
  const [stripeConfigured, setStripeConfigured] = useState(false);

  const currentId = user?.subscription?.planId || 'starter';
  const currentPlan = getPlan(currentId) || PLANS[0];
  const status = user?.subscription?.status || 'trialing';

  useEffect(() => {
    if (highlightPlan && document.getElementById(`plan-${highlightPlan}`)) {
      document.getElementById(`plan-${highlightPlan}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [highlightPlan]);

  useEffect(() => {
    if (checkoutResult === 'success') {
      setMessage('Payment successful — your plan is active.');
    } else if (checkoutResult === 'cancel') {
      setMessage('Checkout cancelled.');
    }
  }, [checkoutResult]);

  useEffect(() => {
    async function loadUsage() {
      try {
        const [usageRes, catalogRes] = await Promise.all([
          api('/api/billing/usage', { token }),
          api('/api/billing/catalog'),
        ]);
        setUsage(usageRes.usage);
        setStripeConfigured(Boolean(catalogRes.stripeConfigured));
      } catch {
        /* usage optional */
      }
    }
    if (token) loadUsage();
  }, [token, user?.subscription?.planId]);

  async function switchPlan(planId) {
    setBusyId(planId);
    setError('');
    setMessage('');
    try {
      const data = await api('/api/auth/subscription', {
        method: 'PATCH',
        token,
        body: { planId },
      });
      setUser(data.user);
      setMessage(`Switched to ${getPlan(planId)?.name || planId}.`);
    } catch (err) {
      setError(err.message || 'Could not update plan');
    } finally {
      setBusyId(null);
    }
  }

  async function checkoutPlan(planId) {
    setBusyId(planId);
    setError('');
    setMessage('');
    try {
      const data = await api('/api/billing/checkout', {
        method: 'POST',
        token,
        body: { planId },
      });
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.mock) {
        const sub = await api('/api/auth/subscription', {
          method: 'PATCH',
          token,
          body: { planId },
        });
        setUser(sub.user);
        setMessage(data.message || `Switched to ${getPlan(planId)?.name}.`);
      }
    } catch (err) {
      setError(err.message || 'Checkout failed');
    } finally {
      setBusyId(null);
    }
  }

  const usagePct =
    usage?.commentLimit && usage.commentLimit > 0
      ? Math.min(100, Math.round((usage.commentCount / usage.commentLimit) * 100))
      : 0;

  return (
    <div className="billing-page">
      <header className="page-head">
        <div>
          <h1>Billing</h1>
          <p className="page-sub">
            India pricing in INR. Stripe checkout when configured — otherwise switch plans in-app
            for demo.
          </p>
        </div>
        <Link to="/pricing" className="btn btn-ghost btn-sm">
          Public pricing
        </Link>
      </header>

      <section className="panel billing-current">
        <h2>Current plan</h2>
        <div className="billing-current-row">
          <div>
            <p className="billing-plan-name">{currentPlan.name}</p>
            <p className="price">
              {currentPlan.price}
              <span>/mo</span>
            </p>
            {currentPlan.priceUsd ? (
              <p className="muted">≈ {currentPlan.priceUsd}/mo USD</p>
            ) : null}
            <p className="muted">
              Status: <strong>{status}</strong>
              {user?.subscription?.updatedAt
                ? ` · Updated ${new Date(user.subscription.updatedAt).toLocaleDateString()}`
                : null}
            </p>
            {usage ? (
              <div className="billing-usage">
                <p className="muted">
                  Comments this month: <strong>{usage.commentCount.toLocaleString()}</strong>
                  {usage.commentLimit != null
                    ? ` / ${usage.commentLimit.toLocaleString()}`
                    : ' (unlimited)'}
                </p>
                {usage.commentLimit != null ? (
                  <div className="insight-bar-track">
                    <div
                      className="insight-bar-fill feature"
                      style={{ width: `${usagePct}%` }}
                    />
                  </div>
                ) : null}
                {!usage.salesAgent ? (
                  <p className="prob">Upgrade to Growth for Instagram DM sales agent.</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <ul>
            {currentPlan.perks.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </section>

      {message ? <p className="billing-flash ok">{message}</p> : null}
      {error ? <p className="billing-flash err">{error}</p> : null}

      <section className="billing-plans">
        <h2>All plans</h2>
        <div className="pricing-grid">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentId;
            const highlighted = plan.id === highlightPlan;
            return (
              <article
                id={`plan-${plan.id}`}
                key={plan.id}
                className={`pricing-card${plan.featured ? ' featured' : ''}${
                  highlighted ? ' billing-highlight' : ''
                }${isCurrent ? ' billing-current-card' : ''}`}
              >
                <h3>{plan.name}</h3>
                <p className="price">
                  {plan.price}
                  <span>/mo</span>
                </p>
                {plan.priceUsd ? <p className="muted">≈ {plan.priceUsd}/mo</p> : null}
                <p className="prob">{plan.blurb}</p>
                <ul>
                  {plan.perks.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                {plan.contactSales ? (
                  <a
                    href="mailto:sales@voxa.app?subject=Enterprise%20plan"
                    className="btn btn-primary btn-sm"
                  >
                    Contact sales
                  </a>
                ) : isCurrent ? (
                  <button type="button" className="btn btn-ghost btn-sm" disabled>
                    Current plan
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`btn ${plan.featured ? 'btn-citrus' : 'btn-primary'} btn-sm`}
                    disabled={Boolean(busyId)}
                    onClick={() =>
                      stripeConfigured ? checkoutPlan(plan.id) : switchPlan(plan.id)
                    }
                  >
                    {busyId === plan.id
                      ? 'Processing…'
                      : stripeConfigured
                        ? `Subscribe — ${plan.price}/mo`
                        : `Switch to ${plan.name}`}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
