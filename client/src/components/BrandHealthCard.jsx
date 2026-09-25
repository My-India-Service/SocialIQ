import { Link } from 'react-router-dom';

function formatMoney(n, currency = 'INR') {
  if (currency === 'INR') return `₹${Number(n || 0).toLocaleString('en-IN')}`;
  return `${currency} ${Number(n || 0).toLocaleString()}`;
}

function tone(score) {
  if (score >= 80) return 'good';
  if (score >= 60) return 'watch';
  if (score >= 40) return 'risk';
  return 'critical';
}

/**
 * Community health score (0-100) + money-at-stake strip.
 * @param {{ health: object, currency?: string, activeAlerts?: number, compact?: boolean }} props
 */
export default function BrandHealthCard({ health, currency = 'INR', activeAlerts = 0, compact = false }) {
  if (!health) return null;
  const t = tone(health.score);
  const revenue = health.revenue || {};
  const circumference = 2 * Math.PI * 42;
  const dash = (health.score / 100) * circumference;

  return (
    <section className={`panel health-card health-${t}`}>
      <div className="health-top">
        <div className="health-ring" aria-label={`Brand health ${health.score} out of 100`}>
          <svg viewBox="0 0 100 100" width="104" height="104" aria-hidden="true">
            <circle cx="50" cy="50" r="42" className="health-ring-track" />
            <circle
              cx="50"
              cy="50"
              r="42"
              className="health-ring-fill"
              strokeDasharray={`${dash} ${circumference}`}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="health-ring-value">
            <strong>{health.score}</strong>
            <span>/100</span>
          </div>
        </div>
        <div className="health-summary">
          <p className="eyebrow">Community health · last 30 days</p>
          <h2>
            {health.label}
            {activeAlerts > 0 && (
              <Link to="/app/brand-health" className="health-alert-pill">
                ⚠ {activeAlerts} active alert{activeAlerts === 1 ? '' : 's'}
              </Link>
            )}
          </h2>
          {!compact && (
            <div className="health-trend" aria-label="Weekly trend">
              {(health.trend || []).map((w) => (
                <div key={w.weekEnding} className="health-trend-bar" title={`Week ending ${w.weekEnding}: ${w.score ?? '—'}`}>
                  <span
                    className={`health-trend-fill health-${w.score == null ? 'none' : tone(w.score)}`}
                    style={{ height: `${Math.max(6, w.score ?? 0)}%` }}
                  />
                  <small>{w.score ?? '—'}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="health-components">
        {(health.components || []).map((c) => (
          <div key={c.key} className="health-component">
            <div className="health-component-head">
              <span>{c.label}</span>
              <strong>{c.score}</strong>
            </div>
            <div className="health-bar">
              <span className={`health-${tone(c.score)}`} style={{ width: `${c.score}%` }} />
            </div>
            {!compact && <small>{c.detail}</small>}
          </div>
        ))}
      </div>

      <div className="health-money">
        <div className="health-money-item health-money-risk">
          <strong>{formatMoney(revenue.revenueAtRisk, currency)}</strong>
          <span>revenue at risk</span>
          <small>{revenue.atRiskComplaints || 0} unanswered complaints</small>
        </div>
        <div className="health-money-item health-money-lost">
          <strong>{formatMoney(revenue.revenueLost, currency)}</strong>
          <span>revenue lost</span>
          <small>{revenue.lostBuyers || 0} buyers ignored 48h+</small>
        </div>
        <div className="health-money-item health-money-win">
          <strong>{formatMoney(revenue.winnableRevenue, currency)}</strong>
          <span>still winnable</span>
          <small>
            {revenue.winnableBuyers || 0} buyers waiting —{' '}
            <Link to="/app/leads">reply now</Link>
          </small>
        </div>
      </div>
    </section>
  );
}
