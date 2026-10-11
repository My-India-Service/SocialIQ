import { useEffect, useState } from 'react';
import { api } from '../api';

const EMPTY = { trialDays: 30, plans: [] };

export default function AdminPlans({ token }) {
  const [catalog, setCatalog] = useState(EMPTY);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api('/api/admin/plans', { token })
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load plans');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function updatePlan(id, patch) {
    setCatalog((current) => ({
      ...current,
      plans: current.plans.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)),
    }));
  }

  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await api('/api/admin/plans', {
        method: 'PUT',
        token,
        body: {
          trialDays: Number(catalog.trialDays),
          plans: catalog.plans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            priceInr: Number(plan.priceInr),
            features: String(plan.featuresText ?? (plan.features || []).join('\n')),
          })),
        },
      });
      setCatalog(saved);
      setNotice('Pricing saved. The website and billing page use these plans.');
    } catch (err) {
      setError(err.message || 'Could not save plans');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="admin-plans">
        <h2>Pricing</h2>
        <p className="admin-none">Loading plans…</p>
      </section>
    );
  }

  return (
    <section className="admin-plans">
      <div className="admin-hero">
        <div>
          <p className="admin-kicker">Pricing</p>
          <h2>Plans</h2>
          <p>Change the name, monthly amount, features, and how many days are free for new signups.</p>
        </div>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}
      {notice ? <div className="success-banner">{notice}</div> : null}
      <form onSubmit={onSave}>
        <label className="admin-trial">
          <span>Free days for new accounts</span>
          <input
            type="number"
            min="0"
            max="365"
            value={catalog.trialDays}
            onChange={(e) => setCatalog((current) => ({ ...current, trialDays: e.target.value }))}
            required
          />
        </label>
        <div className="admin-plan-grid">
          {catalog.plans.map((plan) => (
            <article key={plan.id} className="admin-plan-card">
              <p className="admin-kicker">{plan.id}</p>
              <label>
                Plan name
                <input
                  value={plan.name}
                  onChange={(e) => updatePlan(plan.id, { name: e.target.value })}
                  required
                  maxLength={40}
                />
              </label>
              <label>
                Amount (₹ / month)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={plan.priceInr}
                  onChange={(e) => updatePlan(plan.id, { priceInr: e.target.value })}
                  required
                />
              </label>
              <label>
                Features
                <textarea
                  rows={5}
                  value={plan.featuresText ?? (plan.features || []).join('\n')}
                  onChange={(e) => updatePlan(plan.id, { featuresText: e.target.value })}
                  required
                />
              </label>
              <p className="admin-none">One feature per line.</p>
            </article>
          ))}
        </div>
        <button type="submit" className="btn btn-citrus" disabled={saving}>
          {saving ? 'Saving…' : 'Save pricing'}
        </button>
      </form>
    </section>
  );
}
