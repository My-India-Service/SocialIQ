import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function webhookUrlLooksWrong(url) {
  if (!url) return false;
  return /\/connections\//.test(url) || /\/callback(\/|$)/.test(url);
}

function whatsappActionHint(status, notifyPhone) {
  if (!status?.configured) {
    if (!status?.verifyTokenConfigured) {
      return 'Set META_WEBHOOK_VERIFY_TOKEN in API env (a string you invent), then redeploy.';
    }
    return 'Cloud API is incomplete — set missing env vars on the API and redeploy.';
  }
  if (!notifyPhone) {
    return 'Save a sales notify phone to enable Test send.';
  }
  return '';
}

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
  const [waLoading, setWaLoading] = useState(true);
  const [waBusy, setWaBusy] = useState(false);
  const [waMessage, setWaMessage] = useState('');
  const [copied, setCopied] = useState(false);

  async function loadWhatsAppStatus() {
    setWaLoading(true);
    try {
      const data = await api('/api/whatsapp/status', { token });
      setWaStatus(data);
    } catch (err) {
      setWaStatus(null);
      console.warn('WhatsApp status:', err.message);
    } finally {
      setWaLoading(false);
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

  const waHint = waStatus ? whatsappActionHint(waStatus, whatsappNotifyPhone) : '';

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Brand & integrations</h1>
          <p>Tone, average order value, Slack/CRM routing, WhatsApp Cloud API, and Auto DM.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {saved && <div className="success-banner">Settings saved.</div>}
      {waMessage && <div className="success-banner">{waMessage}</div>}

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

        <div className="panel wa-setup">
          <div className="wa-setup-head">
            <h2>WhatsApp (Meta Cloud API)</h2>
            {waLoading ? (
              <span className="pill">Checking…</span>
            ) : waStatus?.inboxEnabled ? (
              <span className="pill wa-pill-ready">Inbox on</span>
            ) : waStatus?.configured ? (
              <span className="pill wa-pill-ready">Ready</span>
            ) : (
              <span className="pill wa-pill-missing">Incomplete</span>
            )}
          </div>

          <ol className="step-list">
            <li>
              Set API env: <code>META_WHATSAPP_*</code> and{' '}
              <code>META_WEBHOOK_VERIFY_TOKEN</code>. The verify token is a string{' '}
              <strong>you invent</strong> — same value in Render <code>.env</code> and the Meta
              form. Meta does not generate it.
            </li>
            <li>
              Copy the Callback URL below into Meta → WhatsApp → Production setup → Callback URL.
              Do <strong>not</strong> use Facebook Login (<code>…/meta/callback</code>).
            </li>
            <li>
              Click <strong>Verify and save</strong>, then subscribe to the <strong>messages</strong>{' '}
              field.
            </li>
            <li>Enable inbox here, then optionally set a sales notify phone for outbound alerts.</li>
          </ol>

          {waLoading ? (
            <p className="prob wa-checking">Checking Cloud API…</p>
          ) : waStatus ? (
            <>
              {webhookUrlLooksWrong(waStatus.webhookUrl) && (
                <div className="wa-warn">
                  <code>SERVER_URL</code> must be the API origin only (e.g.{' '}
                  <code>https://socialiq-37aa.onrender.com</code>), not the OAuth callback path.
                </div>
              )}

              <label>
                Callback URL (paste into Meta)
                <div className="copy-row">
                  <input readOnly value={waStatus.webhookUrl || ''} />
                  <button className="btn btn-primary btn-sm" type="button" onClick={copyWebhookUrl}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </label>

              <div className="status-grid">
                <div>
                  <span className="status-grid-label">Access token</span>
                  <span
                    className={`pill ${waStatus.accessTokenConfigured ? 'wa-pill-ready' : 'wa-pill-missing'}`}
                  >
                    {waStatus.accessTokenConfigured ? 'Configured' : 'Missing'}
                  </span>
                </div>
                <div>
                  <span className="status-grid-label">Verify token</span>
                  <span
                    className={`pill ${waStatus.verifyTokenConfigured ? 'wa-pill-ready' : 'wa-pill-missing'}`}
                  >
                    {waStatus.verifyTokenConfigured ? 'Configured' : 'Missing'}
                  </span>
                </div>
                <div>
                  <span className="status-grid-label">App secret</span>
                  <span
                    className={`pill ${waStatus.appSecretConfigured ? 'wa-pill-ready' : 'wa-pill-missing'}`}
                  >
                    {waStatus.appSecretConfigured ? 'Configured' : 'Missing'}
                  </span>
                </div>
                <div>
                  <span className="status-grid-label">Inbox</span>
                  <span
                    className={`pill ${waStatus.inboxEnabled ? 'wa-pill-ready' : 'wa-pill-missing'}`}
                  >
                    {waStatus.inboxEnabled ? 'On' : 'Off'}
                  </span>
                </div>
                <div>
                  <span className="status-grid-label">Phone Number ID</span>
                  <code className="status-mono">{waStatus.phoneNumberId || '—'}</code>
                </div>
                <div>
                  <span className="status-grid-label">WABA ID</span>
                  <code className="status-mono">{waStatus.wabaId || '—'}</code>
                </div>
              </div>

              <div className="wa-actions">
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
              {waHint ? <p className="prob">{waHint}</p> : null}
            </>
          ) : (
            <p className="prob">Could not load WhatsApp status. Confirm the API is running.</p>
          )}

          <label>
            Sales notify phone
            <input
              placeholder="9198xxxxxxxx"
              value={whatsappNotifyPhone}
              onChange={(e) => setWhatsappNotifyPhone(e.target.value)}
            />
          </label>
          <p className="prob">
            Outbound hot-lead alerts only (E.164, no +). Save settings after changing. Outside the
            24h window, set <code>META_WHATSAPP_LEAD_TEMPLATE</code> on the API.
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
