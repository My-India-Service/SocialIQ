import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import BrandHealthCard from '../components/BrandHealthCard';

function timeAgo(date) {
  const ms = Date.now() - new Date(date).getTime();
  const m = Math.round(ms / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function BrandHealth() {
  const { token, user } = useAuth();
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [keywordsText, setKeywordsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const settingsLoaded = useRef(false);

  async function load() {
    const res = await api('/api/brand-health', { token });
    setData(res);
    if (!settingsLoaded.current && res.crisis?.settings) {
      settingsLoaded.current = true;
      setSettings(res.crisis.settings);
      setKeywordsText((res.crisis.settings.keywords || []).join(', '));
    }
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

  const checkNow = () =>
    run(async () => {
      const res = await api('/api/brand-health/crisis/check', { method: 'POST', token, body: {} });
      setSuccess(res.message);
      await load();
    });

  const ack = (id) =>
    run(async () => {
      await api(`/api/brand-health/crisis/${id}/ack`, { method: 'PATCH', token, body: {} });
      await load();
    });

  const saveSettings = (e) => {
    e.preventDefault();
    run(async () => {
      const res = await api('/api/brand-health/crisis/settings', {
        method: 'PATCH',
        token,
        body: { ...settings, keywords: keywordsText },
      });
      setSettings(res.settings);
      setKeywordsText(res.settings.keywords.join(', '));
      setSuccess(res.message);
    });
  };

  const alerts = data?.crisis?.alerts || [];

  return (
    <div className="brand-health-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Early warning</p>
          <h1>Brand health</h1>
          <p>One score for how your community feels, what it costs you, and when to act fast.</p>
        </div>
        <button type="button" className="btn btn-citrus" onClick={checkNow} disabled={busy}>
          {busy ? 'Checking…' : 'Check for crisis now'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      {data && (
        <BrandHealthCard
          health={data.health}
          currency={data.currency}
          activeAlerts={data.crisis?.activeCount || 0}
        />
      )}

      <div className="health-layout">
        <section className="panel crisis-panel">
          <h2>Crisis alerts</h2>
          <p className="prob">
            Checked every hour: a spike of negative comments vs your 7-day normal, or any crisis
            keyword. Alerts go to email and Slack
            {user?.features?.whatsapp ? ' and WhatsApp' : ''} (if connected in Settings).
          </p>
          {alerts.length === 0 ? (
            <p className="mod-empty">No crisis alerts. All quiet.</p>
          ) : (
            <ul className="crisis-list">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className={`crisis-item crisis-${a.severity}${a.acknowledgedAt ? ' is-acked' : ''}`}
                >
                  <div className="crisis-item-top">
                    <span className={`crisis-sev crisis-sev-${a.severity}`}>
                      {a.severity === 'critical' ? 'Critical' : 'Warning'}
                    </span>
                    <span className="pill">{a.type === 'spike' ? 'Negative spike' : 'Keyword'}</span>
                    <small>{timeAgo(a.createdAt)}</small>
                    {a.channels?.length > 0 && <small>· sent via {a.channels.join(', ')}</small>}
                  </div>
                  <p className="crisis-reason">{a.reason}</p>
                  {a.samples?.length > 0 && (
                    <ul className="crisis-samples">
                      {a.samples.slice(0, 3).map((s) => (
                        <li key={s.id}>
                          <strong>{s.author}</strong> <span className={`pill platform-${s.platform}`}>{s.platform}</span>{' '}
                          “{s.text}”
                        </li>
                      ))}
                    </ul>
                  )}
                  {!a.acknowledgedAt ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => ack(a.id)} disabled={busy}>
                      Mark handled
                    </button>
                  ) : (
                    <small className="prob">Handled {timeAgo(a.acknowledgedAt)}</small>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {settings && (
          <form className="panel mod-settings" onSubmit={saveSettings}>
            <h2>Alert rules</h2>
            <label className="mod-check">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              />
              Hourly crisis monitoring
            </label>
            <label>
              Crisis keywords (comma separated)
              <textarea
                rows={3}
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder="scam, fraud, consumer court"
              />
            </label>
            <label>
              Extra alert email
              <input
                type="email"
                value={settings.alertEmail}
                onChange={(e) => setSettings({ ...settings, alertEmail: e.target.value })}
                placeholder="founder@brand.com"
              />
            </label>
            {settings.lastCheckedAt && (
              <p className="prob">Last checked {timeAgo(settings.lastCheckedAt)}</p>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Save rules
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
