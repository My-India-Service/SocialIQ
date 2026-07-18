import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Report() {
  const { token } = useAuth();
  const [payload, setPayload] = useState(null);
  const [email, setEmail] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState('');

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
          <h1>Daily CEO report</h1>
          <p>Morning snapshot of sales, complaints, product signals, and crises.</p>
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
        <div className="panel" style={{ marginBottom: '1rem', background: '#eef8d4' }}>{sent}</div>
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
              <strong>₹{report.estimatedMissedRevenue.toLocaleString('en-IN')}</strong>
              <span>estimated missed revenue</span>
            </div>
            <div className="report-metric">
              <strong>{report.complaints}</strong>
              <span>complaints</span>
            </div>
            <div className="report-metric">
              <strong>{report.sentiment.positive}%</strong>
              <span>positive sentiment</span>
            </div>
            <div className="report-metric">
              <strong>{report.sentiment.negative}%</strong>
              <span>negative sentiment</span>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'grid', gap: '0.75rem' }}>
            <p style={{ margin: 0 }}>
              <strong>Top complaint:</strong> {report.topComplaint || '—'}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Trending feature request:</strong> {report.trendingFeatureRequest || '—'}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Competitors mentioned:</strong>{' '}
              {report.competitorMentions.join(', ') || '—'}
            </p>
            {report.mostViralComment && (
              <p style={{ margin: 0 }}>
                <strong>Most viral:</strong> “{report.mostViralComment.text}” —{' '}
                {report.mostViralComment.author} ({report.mostViralComment.likes} likes)
              </p>
            )}
          </div>
        </div>
      )}

      {report && (
        <div className="stat-row" style={{ marginTop: '1rem' }}>
          <div className="panel">
            <h2>Complaint intelligence</h2>
            {report.complaintThemes?.length ? (
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {report.complaintThemes.map((t) => (
                  <li key={t.label}>
                    {t.label} — <b>{t.count}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="prob" style={{ margin: 0 }}>No complaint themes detected.</p>
            )}
          </div>

          <div className="panel">
            <h2>Product roadmap signals</h2>
            {report.productRoadmap?.length ? (
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {report.productRoadmap.map((t) => (
                  <li key={t.label}>
                    {t.label} — <b>{t.count}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="prob" style={{ margin: 0 }}>No product signals yet.</p>
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
                      <span className="pill sales_opportunity">{l.purchaseProbability}% intent</span>
                      <span className="pill">{l.platform}</span>
                      <span className="prob">{l.author}</span>
                    </div>
                    <p className="comment-text">{l.text}</p>
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
