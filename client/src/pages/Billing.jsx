import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { getPlan, PLANS } from '../data/plans';

export default function Billing() {
  const { user, token, setUser } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightPlan = searchParams.get('plan');
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  return (
    <div className="billing-page">
      <header className="page-head">
        <div>
          <h1>Billing</h1>
          <p className="page-sub">
            Mock subscription — no charges yet. Switch plans to preview upgrade paths.
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
            <p className="muted">
              Status: <strong>{status}</strong>
              {user?.subscription?.updatedAt
                ? ` · Updated ${new Date(user.subscription.updatedAt).toLocaleDateString()}`
                : null}
            </p>
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
                    onClick={() => switchPlan(plan.id)}
                  >
                    {busyId === plan.id ? 'Updating…' : `Switch to ${plan.name}`}
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
