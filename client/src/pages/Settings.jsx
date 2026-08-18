import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { token, user, setUser } = useAuth();
  const [brandName, setBrandName] = useState(user?.brandName || '');
  const [brandTone, setBrandTone] = useState(user?.brandTone || 'friendly');
  const [avgOrderValue, setAvgOrderValue] = useState(user?.avgOrderValue ?? 2499);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(user?.integrations?.slackWebhookUrl || '');
  const [whatsappNotifyPhone, setWhatsappNotifyPhone] = useState(
    user?.integrations?.whatsappNotifyPhone || ''
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
  const [waStatus, setWaStatus] = useState(null);
  const [waBusy, setWaBusy] = useState(false);
  const [waMessage, setWaMessage] = useState('');
  const [copied, setCopied] = useState(false);

  async function loadWhatsAppStatus() {
    try {
      const data = await api('/api/whatsapp/status', { token });
      setWaStatus(data);
    } catch (err) {
      setWaStatus(null);
      console.warn('WhatsApp status:', err.message);
    }
  }

  useEffect(() => {
    if (token) loadWhatsAppStatus();
  }, [token]);

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
            whatsappNotifyPhone,
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

  async function enableWhatsAppInbox() {
    setWaBusy(true);
    setWaMessage('');
    setError('');
    try {
      const data = await api('/api/whatsapp/enable', { method: 'POST', token });
      setWaMessage(data.message || 'WhatsApp inbox enabled');
      await loadWhatsAppStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setWaBusy(false);
    }
  }

  async function testWhatsAppSend() {
    setWaBusy(true);
    setWaMessage('');
    setError('');
    try {
      const data = await api('/api/whatsapp/test-send', {
        method: 'POST',
        token,
        body: { to: whatsappNotifyPhone || undefined },
      });
      setWaMessage(data.message || 'Test message sent');
    } catch (err) {
      setError(err.message);
    } finally {
      setWaBusy(false);
    }
  }

  async function copyWebhookUrl() {
    if (!waStatus?.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(waStatus.webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select the URL manually');
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Brand & integrations</h1>
          <p>Tone, average order value, Slack/CRM routing, WhatsApp Cloud API, and Auto DM.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {saved && (
        <div className="panel" style={{ marginBottom: '1rem', background: '#eef8d4' }}>
          Settings saved.
        </div>
      )}
      {waMessage && (
        <div className="panel" style={{ marginBottom: '1rem', background: '#eef8d4' }}>
          {waMessage}
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
          <h2>WhatsApp (Meta Cloud API)</h2>
          <p className="prob">
            Meta does not give you a webhook URL. Voxa exposes the Callback URL below — paste it
            into Meta Developers → WhatsApp → Configuration → Webhooks. Tokens stay on the API
            server (Render env), never in the browser.
          </p>

          {waStatus ? (
            <>
              <label>
                Webhook Callback URL (copy into Meta)
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input readOnly value={waStatus.webhookUrl || ''} />
                  <button className="btn btn-primary btn-sm" type="button" onClick={copyWebhookUrl}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </label>
              <p className="prob">
                Phone Number ID: {waStatus.phoneNumberId || '—'} · WABA ID:{' '}
                {waStatus.wabaId || '—'} · Graph {waStatus.graphApiVersion}
              </p>
              <p className="prob">
                Access token: {waStatus.accessTokenConfigured ? 'configured' : 'missing'} · Verify
                token: {waStatus.verifyTokenConfigured ? 'configured' : 'missing'} · App secret:{' '}
                {waStatus.appSecretConfigured ? 'configured' : 'missing'} · Cloud API:{' '}
                {waStatus.configured ? 'ready' : 'incomplete'}
              </p>
              <p className="prob">
                Inbox for this account:{' '}
                {waStatus.inboxEnabled ? 'enabled' : 'not enabled — click below after Meta setup'}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  disabled={waBusy || !waStatus.configured}
                  onClick={enableWhatsAppInbox}
                >
                  Enable WhatsApp inbox
                </button>
                <button
                  className="btn btn-sm"
                  type="button"
                  disabled={waBusy || !waStatus.configured || !whatsappNotifyPhone}
                  onClick={testWhatsAppSend}
                >
                  Test send to sales phone
                </button>
              </div>
            </>
          ) : (
            <p className="prob">Loading WhatsApp status…</p>
          )}

          <label style={{ marginTop: '1rem' }}>
            Sales notify phone (E.164, e.g. 9198xxxxxxxx)
            <input
              placeholder="919876543210"
              value={whatsappNotifyPhone}
              onChange={(e) => setWhatsappNotifyPhone(e.target.value)}
            />
          </label>
          <p className="prob">
            Hot leads are sent to this number via Meta Graph API (not Zapier). Outside the 24h
            session window, set META_WHATSAPP_LEAD_TEMPLATE on the API for template sends.
          </p>
        </div>

        <div className="panel">
          <h2>Send leads to sales</h2>
          <p className="prob">
            Slack and CRM still use outbound webhook URLs. WhatsApp uses Cloud API + the notify
            phone above.
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
