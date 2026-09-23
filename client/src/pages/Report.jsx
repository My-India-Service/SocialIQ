import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function formatMoney(n, currency = 'INR') {
  if (currency === 'INR') return `₹${Number(n || 0).toLocaleString('en-IN')}`;
  return `${currency} ${Number(n || 0).toLocaleString()}`;
}

function formatChange(pct) {
  const n = Number(pct) || 0;
  if (n > 0) return { text: `↑ ${n}%`, dir: 'up' };
  if (n < 0) return { text: `↓ ${Math.abs(n)}%`, dir: 'down' };
  return { text: '→ 0%', dir: 'flat' };
}

function SentimentSparkline({ points }) {
  const scores = (points || []).map((p) => Number(p.score) || 50);
  if (scores.length < 2) return null;

  const w = 220;
  const h = 72;
  const pad = 4;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = Math.max(max - min, 1);

  const coords = scores
    .map((s, i) => {
      const x = pad + (i / (scores.length - 1)) * (w - pad * 2);
      const y = h - pad - ((s - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      className="sentiment-spark"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="30 day positive sentiment trend"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords}
      />
    </svg>
  );
}

export default function Report() {
  const { token, user } = useAuth();
  const [payload, setPayload] = useState(null);
  const [email, setEmail] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sent, setSent] = useState('');
  const emailPreviewRef = useRef(null);
  const currency = user?.currency || 'INR';

  useEffect(() => {
    async function load() {
      try {
        const data = await api('/api/reports/daily', { token });
        setPayload(data);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, [token]);

  async function previewEmail() {
    setError('');
    setPreviewLoading(true);
    try {
      const data = await api('/api/reports/email-preview', {
        method: 'POST',
        token,
        body: {},
      });
      if (!data?.body) {
        setError('Email preview missing body');
        setEmail(null);
        return;
      }
      setEmail(data);
      requestAnimationFrame(() => {
        emailPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function sendNow() {
    setError('');
    setSent('');
    setSending(true);
    try {
      const data = await api('/api/reports/send', { method: 'POST', token, body: {} });
      setSent(data.message || 'Report sent');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const report = payload?.report;
  const emailConfigured = payload?.emailConfigured;

  return (
    <div className="report-page">
      <div className="page-head">
        <div>
          <h1>CEO dashboard</h1>
          <p>
            Every morning: lost revenue, missed comments, competitors, product requests, complaints,
            viral posts.
          </p>
        </div>
        <div className="reply-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={previewEmail}
            disabled={previewLoading}
          >
            {previewLoading ? 'Loading…' : 'Preview email'}
          </button>
          <button
            type="button"
            className="btn btn-citrus"
            onClick={sendNow}
            disabled={sending || !emailConfigured}
            title={emailConfigured ? '' : 'Add SMTP keys in server/.env'}
          >
            {sending ? 'Sending…' : 'Send now'}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {sent && <div className="success-banner">{sent}</div>}
      {!emailConfigured && (
        <p className="prob" style={{ marginTop: '-0.5rem' }}>
          Email sending off — add <code>SMTP_HOST</code>, <code>SMTP_USER</code>,{' '}
          <code>SMTP_PASS</code> to <code>server/.env</code> to enable “Send now”.
        </p>
      )}

      {email && (
        <div className="panel" style={{ marginTop: '1rem' }} ref={emailPreviewRef}>
          <h2>Email preview</h2>
          <p className="prob">
            To: {email.to} · Subject: {email.subject}
          </p>
          <pre className="email-preview">{email.body}</pre>
          <p className="prob">{email.note}</p>
        </div>
      )}

      {report?.crisis?.active && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          ⚠ Crisis alert: {report.crisis.reason}
        </div>
      )}

      {report && (
        <div className="report-preview">
          <h3>{payload.brandName} — Yesterday’s Summary</h3>
          <div className="kpi-row">
            {(
              report.kpis || [
                {
                  key: 'comments',
                  label: 'Comments',
                  value: report.totalComments,
                  changePct: 0,
                },
                {
                  key: 'leads',
                  label: 'Leads',
                  value: report.salesOpportunities,
                  changePct: 0,
                },
                {
                  key: 'complaints',
                  label: 'Complaints',
                  value: report.complaints,
                  changePct: 0,
                },
                {
                  key: 'hotLeads',
                  label: 'Hot Leads',
                  value: report.hotLeads?.length || 0,
                  changePct: 0,
                },
              ]
            ).map((kpi) => {
              const change = formatChange(kpi.changePct);
              return (
                <div className="kpi-card" key={kpi.key}>
                  <strong>{Number(kpi.value || 0).toLocaleString('en-IN')}</strong>
                  <span className="kpi-label">{kpi.label}</span>
                  <span className={`kpi-change kpi-change-${change.dir}`}>{change.text}</span>
                </div>
              );
            })}
          </div>

          <div className="report-grid" style={{ marginTop: '1.25rem' }}>
            <div className="report-metric">
              <strong>
                {formatMoney(
                  report.roi?.salesInfluenced ??
                    (report.roi?.revenueGenerated || 0) + (report.pipelineValue || 0),
                  currency
                )}
              </strong>
              <span>sales influenced</span>
            </div>
            <div className="report-metric">
              <strong>{formatMoney(report.estimatedMissedRevenue, currency)}</strong>
              <span>lost revenue yesterday</span>
            </div>
            <div className="report-metric">
              <strong>{report.roi?.leadsConverted ?? 0}</strong>
              <span>purchases / converted</span>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'grid', gap: '0.75rem' }}>
            <p style={{ margin: 0 }}>
              <strong>Top complaint:</strong> {report.topComplaint || '—'}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Products people requested:</strong>{' '}
              {report.trendingFeatureRequest || '—'}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Competitor mentions:</strong>{' '}
              {(report.competitorMentions ?? []).join(', ') || '—'}
            </p>
            {report.mostViralComment && (
              <p style={{ margin: 0 }}>
                <strong>Viral comment:</strong> “{report.mostViralComment.text}” —{' '}
                {report.mostViralComment.author} ({report.mostViralComment.likes} likes)
              </p>
            )}
            {report.roi && (
              <p style={{ margin: 0 }}>
                <strong>Revenue attributed:</strong>{' '}
                {formatMoney(report.roi.revenueGenerated, currency)} ·{' '}
                {report.roi.leadsConverted} converted
              </p>
            )}
          </div>
        </div>
      )}

      {report && (
        <div className="ceo-split">
          <div className="panel">
            <h2>Customer Sentiment</h2>
            <div className="sentiment-breakdown">
              {[
                { key: 'positive', label: 'Positive', pct: report.sentiment?.positive ?? 0 },
                { key: 'neutral', label: 'Neutral', pct: report.sentiment?.neutral ?? 0 },
                { key: 'negative', label: 'Negative', pct: report.sentiment?.negative ?? 0 },
              ].map((row) => (
                <div className="sentiment-row" key={row.key}>
                  <span className="sentiment-row-label">{row.label}</span>
                  <div className="sentiment-bar-track">
                    <div
                      className={`sentiment-bar sentiment-bar-${row.key}`}
                      style={{ width: `${Math.max(0, Math.min(100, row.pct))}%` }}
                    />
                  </div>
                  <span className="sentiment-row-pct">{row.pct}%</span>
                </div>
              ))}
            </div>
            <div className="sentiment-trend-block">
              <span className="sentiment-trend-label">30 day trend</span>
              <SentimentSparkline points={report.sentimentTrend} />
            </div>
          </div>

          <div className="panel">
            <h2>AI Alerts</h2>
            {report.aiAlerts?.length ? (
              <ul className="ai-alert-list">
                {report.aiAlerts.map((alert) => (
                  <li className={`ai-alert-item ai-alert-${alert.severity || 'info'}`} key={alert.id}>
                    <span className="ai-alert-icon" aria-hidden="true">
                      {alert.icon}
                    </span>
                    <span>{alert.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="prob" style={{ margin: 0 }}>
                No alerts right now.
              </p>
            )}
          </div>
        </div>
      )}

      {report && (
        <div className="stat-row" style={{ marginTop: '1rem' }}>
          <div className="panel">
            <h2>Most common complaints</h2>
            {report.complaintThemes?.length ? (
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {report.complaintThemes.map((t) => (
                  <li key={t.label}>
                    {t.label} — <b>{t.count}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="prob" style={{ margin: 0 }}>
                No complaint themes detected.
              </p>
            )}
          </div>

          <div className="panel">
            <h2>Feature requests (aggregated)</h2>
            {report.featureRequestGroups?.length ? (
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {report.featureRequestGroups.map((t) => (
                  <li key={t.label}>
                    {t.label} — <b>{t.count} users</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="prob" style={{ margin: 0 }}>
                No feature requests yet.
              </p>
            )}
          </div>
        </div>
      )}

      {report?.hotLeads?.length > 0 && (
        <div className="panel" style={{ marginTop: '1rem' }}>
          <h2>Hottest buying-intent leads</h2>
          <div className="comment-list">
            {report.hotLeads.map((l, i) => (
              <div className="comment-item" key={i}>
                <div className="comment-top">
                  <div>
                    <div className="comment-meta">
                      <span className={`pill temp-${l.leadTemperature || 'hot'}`}>
                        {l.leadTemperature === 'hot' ? '🔥 Hot lead' : `${l.purchaseProbability}% intent`}
                      </span>
                      <span className="pill">{l.platform}</span>
                      <span className="prob">
                        {l.author} · {formatMoney(l.expectedOrderValue, currency)}
                      </span>
                    </div>
                    <p className="comment-text">{l.text}</p>
                    {l.suggestedReply && (
                      <p className="prob" style={{ marginTop: '0.35rem' }}>
                        Suggested: {l.suggestedReply}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
