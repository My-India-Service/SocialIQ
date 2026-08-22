import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function formatMoney(n, currency = 'INR') {
  if (currency === 'INR') return `₹${Number(n || 0).toLocaleString('en-IN')}`;
  return `${currency} ${Number(n || 0).toLocaleString()}`;
}

export default function Revenue() {
  const { token, user } = useAuth();
  const [roi, setRoi] = useState(null);
  const [error, setError] = useState('');
  const currency = user?.currency || roi?.currency || 'INR';

  useEffect(() => {
    async function load() {
      try {
        const data = await api('/api/comments/roi', { token });
        setRoi(data.roi);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, [token]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Revenue & ROI</h1>
          <p>Sales influenced through Voxa — conversions, pipeline, and recovered complaints.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {roi && (
        <>
          <div className="stat-row">
            <div className="stat stat-emphasis">
              <strong>{formatMoney(roi.salesInfluenced ?? roi.revenueGenerated + roi.pipelineValue, currency)}</strong>
              <span>Sales influenced this month</span>
            </div>
            <div className="stat">
              <strong>{formatMoney(roi.revenueGenerated, currency)}</strong>
              <span>Revenue attributed (converted)</span>
            </div>
            <div className="stat">
              <strong>{formatMoney(roi.estimatedMissedRevenue, currency)}</strong>
              <span>Lost / unreplied pipeline</span>
            </div>
            <div className="stat">
              <strong>{formatMoney(roi.pipelineValue, currency)}</strong>
              <span>Open sales pipeline</span>
            </div>
          </div>

          <section className="panel" style={{ marginBottom: '1rem' }}>
            <h2>Reel → Sale funnel</h2>
            <p className="prob">
              Comments → DMs started → Qualified → Converted → ₹ sales influenced
            </p>
            <div className="stat-row">
              <div className="stat">
                <strong>{roi.totalComments ?? 0}</strong>
                <span>Comments</span>
              </div>
              <div className="stat">
                <strong>{roi.conversationsStarted ?? 0}</strong>
                <span>DMs started</span>
              </div>
              <div className="stat">
                <strong>{roi.qualifiedLeads ?? 0}</strong>
                <span>Qualified</span>
              </div>
              <div className="stat">
                <strong>{roi.leadsConverted ?? 0}</strong>
                <span>Converted</span>
              </div>
              <div className="stat stat-emphasis">
                <strong>{formatMoney(roi.salesInfluenced ?? 0, currency)}</strong>
                <span>Sales influenced</span>
              </div>
            </div>
          </section>

          <div className="stat-row">
            <div className="stat">
              <strong>{roi.buyingIntentComments ?? roi.salesOpportunities ?? 0}</strong>
              <span>Buying-intent comments</span>
            </div>
            <div className="stat">
              <strong>{roi.leadsSentToSales ?? 0}</strong>
              <span>Sent to sales / CRM</span>
            </div>
            <div className="stat">
              <strong>{roi.responseCoveragePct ?? 0}%</strong>
              <span>Response coverage</span>
            </div>
            <div className="stat">
              <strong>{formatMoney(roi.moneyRecoveredEstimate ?? 0, currency)}</strong>
              <span>Est. recovered from complaints</span>
            </div>
          </div>

          <div className="panel">
            <h2>How ROI is calculated</h2>
            <ul className="plain-list">
              <li>
                <b>Revenue from comments</b> — leads marked Converted × attributed order value (defaults
                to expected value / AOV of {formatMoney(roi.avgOrderValue, currency)}).
              </li>
              <li>
                <b>Lost pipeline</b> — unreplied sales opportunities × expected order value.
              </li>
              <li>
                <b>Complaint recovery</b> — answered complaints × ~35% of AOV (reputation salvage
                estimate).
              </li>
            </ul>
            <p className="prob" style={{ marginBottom: 0 }}>
              Set your average order value in Settings so executives see numbers that match your
              Shopify store.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
