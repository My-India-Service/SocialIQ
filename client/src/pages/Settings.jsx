import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { token, user, setUser } = useAuth();
  const [brandName, setBrandName] = useState(user?.brandName || '');
  const [brandTone, setBrandTone] = useState(user?.brandTone || 'friendly');
  const [avgOrderValue, setAvgOrderValue] = useState(user?.avgOrderValue ?? 2499);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(user?.integrations?.slackWebhookUrl || '');
  const [whatsappWebhookUrl, setWhatsappWebhookUrl] = useState(
    user?.integrations?.whatsappWebhookUrl || ''
  );
  const [crmWebhookUrl, setCrmWebhookUrl] = useState(user?.integrations?.crmWebhookUrl || '');
  const [autoRouteHotLeads, setAutoRouteHotLeads] = useState(
    Boolean(user?.integrations?.autoRouteHotLeads)
  );
  const [hotLeadThreshold, setHotLeadThreshold] = useState(
    user?.integrations?.hotLeadThreshold ?? 80
  );
  const [autoDmEnabled, setAutoDmEnabled] = useState(Boolean(user?.autoDm?.enabled));
  const [catalogueUrl, setCatalogueUrl] = useState(user?.autoDm?.catalogueUrl || '');
  const [couponCode, setCouponCode] = useState(user?.autoDm?.couponCode || '');
  const [websiteUrl, setWebsiteUrl] = useState(user?.autoDm?.websiteUrl || '');
  const [sample, setSample] = useState('Do you deliver in Delhi?');
  const [analysis, setAnalysis] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    try {
      const data = await api('/api/auth/brand', {
        method: 'PATCH',
        token,
        body: {
          brandName,
          brandTone,
          avgOrderValue: Number(avgOrderValue),
          integrations: {
            slackWebhookUrl,
            whatsappWebhookUrl,
            crmWebhookUrl,
            autoRouteHotLeads,
            hotLeadThreshold: Number(hotLeadThreshold),
          },
          autoDm: {
            enabled: autoDmEnabled,
            catalogueUrl,
            couponCode,
            websiteUrl,
          },
        },
      });
      setUser(data.user);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function tryAnalyze(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await api('/api/comments/analyze', {
        method: 'POST',
        token,
        body: { text: sample },
      });
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Brand & integrations</h1>
          <p>Tone, average order value, Slack/CRM routing, and Auto DM catalogue.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {saved && (
        <div className="panel" style={{ marginBottom: '1rem', background: '#eef8d4' }}>
          Settings saved.
        </div>
      )}

      <form className="form-stack settings-form" onSubmit={save}>
        <div className="panel">
          <h2>Brand</h2>
          <label>
            Brand name
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} required />
          </label>
          <label>
            Default reply tone
            <select value={brandTone} onChange={(e) => setBrandTone(e.target.value)}>
              <option value="friendly">Friendly — warm & human</option>
              <option value="professional">Professional — clear & formal</option>
              <option value="playful">Playful — witty & casual</option>
              <option value="luxury">Luxury — refined & calm</option>
            </select>
          </label>
          <label>
            Average order value (₹)
            <input
              type="number"
              min="0"
              value={avgOrderValue}
              onChange={(e) => setAvgOrderValue(e.target.value)}
            />
          </label>
        </div>

        <div className="panel">
          <h2>Send leads to sales</h2>
          <p className="prob">
            Paste webhook URLs — Slack Incoming Webhook, WhatsApp automation, or any CRM/Zapier
            endpoint.
          </p>
          <label>
            Slack webhook URL
            <input
              placeholder="https://hooks.slack.com/services/…"
              value={slackWebhookUrl}
              onChange={(e) => setSlackWebhookUrl(e.target.value)}
            />
          </label>
          <label>
            WhatsApp webhook URL
            <input
              placeholder="https://…"
              value={whatsappWebhookUrl}
              onChange={(e) => setWhatsappWebhookUrl(e.target.value)}
            />
          </label>
          <label>
            CRM webhook URL
            <input
              placeholder="https://hooks.zapier.com/… or HubSpot"
              value={crmWebhookUrl}
              onChange={(e) => setCrmWebhookUrl(e.target.value)}
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={autoRouteHotLeads}
              onChange={(e) => setAutoRouteHotLeads(e.target.checked)}
            />
            Auto-route hot leads on sync
          </label>
          <label>
            Hot lead threshold (%)
            <input
              type="number"
              min="0"
              max="100"
              value={hotLeadThreshold}
              onChange={(e) => setHotLeadThreshold(e.target.value)}
            />
          </label>
        </div>

        <div className="panel">
          <h2>Auto DM</h2>
          <p className="prob">
            When someone comments “Price?”, queue a DM with catalogue, coupon, and store link.
            Delivery uses Instagram Messaging once connected — preview works today.
          </p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={autoDmEnabled}
              onChange={(e) => setAutoDmEnabled(e.target.checked)}
            />
            Enable Auto DM for sales comments
          </label>
          <label>
            Catalogue URL
            <input value={catalogueUrl} onChange={(e) => setCatalogueUrl(e.target.value)} />
          </label>
          <label>
            Coupon code
            <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
          </label>
          <label>
            Website / Shopify URL
            <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
          </label>
        </div>

        <button className="btn btn-citrus" type="submit">
          Save settings
        </button>
      </form>

      <div className="panel" style={{ marginTop: '1rem' }}>
        <h2>Try revenue detection</h2>
        <form className="form-stack" onSubmit={tryAnalyze}>
          <label>
            Sample comment
            <textarea value={sample} onChange={(e) => setSample(e.target.value)} />
          </label>
          <button className="btn btn-primary" type="submit">
            Analyze
          </button>
        </form>
        {analysis && (
          <div style={{ marginTop: '1rem' }}>
            <p>
              <span className={`pill ${analysis.category}`}>{analysis.category}</span>{' '}
              <span className={`pill temp-${analysis.leadTemperature}`}>
                {analysis.leadTemperature} · {analysis.purchaseProbability}% intent
              </span>{' '}
              <span className="prob">
                expected ₹{Number(analysis.expectedOrderValue || 0).toLocaleString('en-IN')} ·{' '}
                {analysis.sentiment}
              </span>
            </p>
            <div className="reply-box">
              <strong>Suggested reply</strong>
              <p style={{ margin: 0 }}>{analysis.suggestedReply || '—'}</p>
              {analysis.autoDmPreview && (
                <>
                  <strong>Auto DM preview</strong>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{analysis.autoDmPreview}</pre>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
