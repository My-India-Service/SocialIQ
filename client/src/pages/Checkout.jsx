import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function formatMoney(n, currency = 'INR') {
  if (currency === 'INR') return `₹${Number(n || 0).toLocaleString('en-IN')}`;
  return `${currency} ${Number(n || 0).toLocaleString()}`;
}

const STATUS_LABEL = { created: 'Sent', opened: 'Opened', paid: 'Paid', expired: 'Expired' };

export default function Checkout() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState('');

  async function load() {
    const res = await api('/api/checkout', { token });
    setData(res);
    setForm((prev) => prev || res.settings);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function run(fn) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const save = (e) => {
    e.preventDefault();
    run(async () => {
      const res = await api('/api/checkout/settings', { method: 'PATCH', token, body: form });
      setForm(res.settings);
      setSuccess(res.message);
      await load();
    });
  };

  const markPaid = (id) =>
    run(async () => {
      const res = await api(`/api/checkout/links/${id}/paid`, { method: 'PATCH', token, body: {} });
      setSuccess(res.message);
      await load();
    });

  async function copy(url, id) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      setError('Could not copy — select the link manually');
    }
  }

  const stats = data?.stats || {};
  const currency = data?.currency || 'INR';
  const conversion = stats.created ? Math.round((stats.paid / stats.created) * 100) : 0;

  return (
    <div className="checkout-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Comment → checkout</p>
          <h1>Checkout links</h1>
          <p>
            When a buyer is qualified in DM, the AI sends a UPI / Razorpay payment link. Paid links
            mark the lead converted and attribute revenue automatically.
          </p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="kpi-row">
        <div className="kpi-card">
          <strong>{stats.created || 0}</strong>
          <span className="kpi-label">Links sent</span>
        </div>
        <div className="kpi-card">
          <strong>{stats.opened || 0}</strong>
          <span className="kpi-label">Opened</span>
        </div>
        <div className="kpi-card">
          <strong>{stats.paid || 0}</strong>
          <span className="kpi-label">Paid · {conversion}%</span>
        </div>
        <div className="kpi-card">
          <strong>{formatMoney(stats.revenue, currency)}</strong>
          <span className="kpi-label">Revenue collected</span>
        </div>
      </div>

      <div className="checkout-layout">
        <section className="panel">
          <h2>Recent links</h2>
          {(data?.links || []).length === 0 ? (
            <p className="mod-empty">
              No links yet. Use “💳 Payment link” in the Lead Center, or turn on auto-send below.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table checkout-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Via</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.links.map((l) => (
                    <tr key={l.id}>
                      <td>{l.customerHandle || '—'}</td>
                      <td>{formatMoney(l.amount, l.currency)}</td>
                      <td>{l.provider === 'razorpay' ? 'Razorpay' : 'UPI'}</td>
                      <td>
                        <span className={`checkout-status checkout-status-${l.status}`}>
                          {STATUS_LABEL[l.status] || l.status}
                        </span>
                      </td>
                      <td>{new Date(l.createdAt).toLocaleDateString()}</td>
                      <td className="checkout-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(l.url, l.id)}>
                          {copied === l.id ? 'Copied' : 'Copy'}
                        </button>
                        {l.status !== 'paid' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy}
                            onClick={() => markPaid(l.id)}
                            title="UPI payments can't be verified automatically — confirm once you see the money"
                          >
                            Mark paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {form && (
          <form className="panel mod-settings" onSubmit={save}>
            <h2>Settings</h2>
            <label className="mod-check">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              Enable comment-to-checkout
            </label>
            <label className="mod-check">
              <input
                type="checkbox"
                checked={form.sendInDm}
                onChange={(e) => setForm({ ...form, sendInDm: e.target.checked })}
              />
              Auto-send link in DM when the buyer is qualified
            </label>
            <label>
              UPI ID
              <input
                value={form.upiId}
                onChange={(e) => setForm({ ...form, upiId: e.target.value })}
                placeholder="yourbrand@okhdfcbank"
              />
            </label>
            <label>
              Payee name
              <input
                value={form.payeeName}
                onChange={(e) => setForm({ ...form, payeeName: e.target.value })}
                placeholder="Your brand"
              />
            </label>
            <p className="prob">
              {data?.settings?.razorpay
                ? '✓ Razorpay connected — links are Razorpay Payment Links and confirm automatically when paid.'
                : 'Razorpay not connected — links open a UPI pay page. Add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET on the server for auto-confirmed payments.'}
            </p>
            <button type="submit" className="btn btn-citrus" disabled={busy}>
              Save
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
