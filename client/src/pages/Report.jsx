import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function formatMoney(n, currency = 'INR') {
  if (currency === 'INR') return `₹${Number(n || 0).toLocaleString('en-IN')}`;
  return `${currency} ${Number(n || 0).toLocaleString()}`;
}

export default function Report() {
  const { token, user } = useAuth();
  const [payload, setPayload] = useState(null);
  const [email, setEmail] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState('');
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
    try {
      const data = await api('/api/reports/email-preview', { method: 'POST', token });
      setEmail(data);
    } catch (err) {
      setError(err.message);
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
          <button type="button" className="btn btn-ghost" onClick={previewEmail}>
            Preview email
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
      {sent && (
        <div className="panel" style={{ marginBottom: '1rem', background: '#eef8d4' }}>
          {sent}
        </div>
      )}
      {!emailConfigured && (
        <p className="prob" style={{ marginTop: '-0.5rem' }}>
          Email sending off — add <code>SMTP_HOST</code>, <code>SMTP_USER</code>,{' '}
          <code>SMTP_PASS</code> to <code>server/.env</code> to enable “Send now”.
        </p>
      )}

      {report?.crisis?.active && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          ⚠ Crisis alert: {report.crisis.reason}
        </div>
      )}

      {report && (
        <div className="report-preview">
          <h3>{payload.brandName} — Yesterday’s Summary</h3>
          <div className="report-grid">
            <div className="report-metric">
              <strong>{report.totalComments.toLocaleString()}</strong>
              <span>comments analyzed</span>
            </div>
            <div className="report-metric">
              <strong>{report.salesOpportunities}</strong>
              <span>sales opportunities</span>
            </div>
            <div className="report-metric">
              <strong>{formatMoney(report.estimatedMissedRevenue, currency)}</strong>
              <span>lost revenue yesterday</span>
            </div>
            <div className="report-metric">
              <strong>{report.missedComments}</strong>
              <span>missed / unreplied leads</span>
            </div>
            <div className="report-metric">
              <strong>{report.complaints}</strong>
              <span>complaints</span>
            </div>
            <div className="report-metric">
              <strong>{report.sentiment.positive}%</strong>
              <span>positive sentiment</span>
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
              {report.competitorMentions.join(', ') || '—'}
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

      {email && (
        <div className="panel" style={{ marginTop: '1rem' }}>
          <h2>Email preview</h2>
          <p className="prob">
            To: {email.to} · Subject: {email.subject}
          </p>
          <pre className="email-preview">{email.body}</pre>
          <p className="prob">{email.note}</p>
        </div>
      )}
    </div>
  );
}
