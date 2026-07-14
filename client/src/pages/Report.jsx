import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Report() {
  const { token } = useAuth();
  const [payload, setPayload] = useState(null);
  const [email, setEmail] = useState(null);
  const [error, setError] = useState('');

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
    try {
      const data = await api('/api/reports/email-preview', { method: 'POST', token });
      setEmail(data);
    } catch (err) {
      setError(err.message);
    }
  }

  const report = payload?.report;

  return (
    <div className="report-page">
      <div className="page-head">
        <div>
          <h1>Daily CEO report</h1>
          <p>Morning snapshot of sales opportunities, complaints, and sentiment.</p>
        </div>
        <button type="button" className="btn btn-citrus" onClick={previewEmail}>
          Preview daily email
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

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
            {report.topInfluencers?.length > 0 && (
              <p style={{ margin: 0 }}>
                <strong>Top influencers / VIPs:</strong>{' '}
                {report.topInfluencers.map((i) => i.author).join(', ')}
              </p>
            )}
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
