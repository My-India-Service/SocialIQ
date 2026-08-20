import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  if (isLikelyMetaSandboxNumber(notifyPhone)) {
    return 'Sales notify phone looks like Meta’s +1 555 test business number (sender). Use your personal WhatsApp instead.';
  }
  return '';
}

function normalizePhoneDigits(to) {
  return String(to || '').replace(/\D/g, '');
}

/** Meta sandbox business/sender numbers (+1 555-xxx-xxxx) — not valid recipients. */
function isLikelyMetaSandboxNumber(to) {
  const digits = normalizePhoneDigits(to);
  if (!digits) return false;
  if (/^1555\d{7}$/.test(digits)) return true;
  if (/^555\d{7}$/.test(digits)) return true;
  return false;
}

function buildFormSnapshot(values) {
  return JSON.stringify({
    brandName: values.brandName,
    brandTone: values.brandTone,
    avgOrderValue: String(values.avgOrderValue ?? ''),
    slackWebhookUrl: values.slackWebhookUrl,
    whatsappNotifyPhone: values.whatsappNotifyPhone,
    crmWebhookUrl: values.crmWebhookUrl,
    autoRouteHotLeads: Boolean(values.autoRouteHotLeads),
    hotLeadThreshold: String(values.hotLeadThreshold ?? ''),
    autoDmEnabled: Boolean(values.autoDmEnabled),
    catalogueUrl: values.catalogueUrl,
    couponCode: values.couponCode,
    websiteUrl: values.websiteUrl,
  });
}

function mapWhatsAppError(rawMessage, notifyPhone) {
  const raw = String(rawMessage || '').trim();
  const lower = raw.toLowerCase();

  if (
    raw.includes('SANDBOX_SENDER_AS_RECIPIENT') ||
    (lower.includes('sandbox') && lower.includes('sender'))
  ) {
    return {
      title: 'Wrong number for Test send',
      message:
        'You pasted Meta’s +1 555 sandbox *business* (sender) number. Add your personal WhatsApp under Meta → Try it out → Recipient, then put that phone in Sales notify phone.',
      detail: raw,
    };
  }

  if (raw.includes('131030') || lower.includes('recipient phone number not in allowed list')) {
    return {
      title: 'WhatsApp test failed',
      message:
        'You may have pasted Meta’s test business number, or your personal phone is not on the allowed list yet. In Meta → WhatsApp → Try it out, add *your* phone as Recipient (not the +1 555 test number), verify it, then put that same number here and try again.',
      detail: raw,
    };
  }

  if (lower.includes('not configured on the server') || lower.includes('cloud api is incomplete')) {
    return {
      title: 'WhatsApp setup incomplete',
      message:
        'Set the missing META_WHATSAPP_* env vars on the API, then redeploy before testing.',
      detail: raw,
    };
  }

  if (lower.includes('verify token')) {
    return {
      title: 'Verify token missing',
      message:
        'Add META_WEBHOOK_VERIFY_TOKEN in API env and use the same value in the Meta webhook form.',
      detail: raw,
    };
  }

  if (!notifyPhone) {
    return {
      title: 'Sales phone required',
      message: 'Add a sales notify phone first, then test send again.',
      detail: raw || null,
    };
  }

  return {
    title: 'WhatsApp action failed',
    message: raw || 'The WhatsApp action could not be completed.',
    detail: null,
  };
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
  const [waStatus, setWaStatus] = useState(null);
  const [waLoading, setWaLoading] = useState(true);
  const [waBusy, setWaBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [baselineSnapshot, setBaselineSnapshot] = useState(() =>
    buildFormSnapshot({
      brandName: user?.brandName || '',
      brandTone: user?.brandTone || 'friendly',
      avgOrderValue: user?.avgOrderValue ?? 2499,
      slackWebhookUrl: user?.integrations?.slackWebhookUrl || '',
      whatsappNotifyPhone: user?.integrations?.whatsappNotifyPhone || '',
      crmWebhookUrl: user?.integrations?.crmWebhookUrl || '',
      autoRouteHotLeads: Boolean(user?.integrations?.autoRouteHotLeads),
      hotLeadThreshold: user?.integrations?.hotLeadThreshold ?? 80,
      autoDmEnabled: Boolean(user?.autoDm?.enabled),
      catalogueUrl: user?.autoDm?.catalogueUrl || '',
      couponCode: user?.autoDm?.couponCode || '',
      websiteUrl: user?.autoDm?.websiteUrl || '',
    })
  );
  const [saveFeedback, setSaveFeedback] = useState(null);
  const [waFeedback, setWaFeedback] = useState(null);
  const [analysisFeedback, setAnalysisFeedback] = useState(null);

  const currentSnapshot = useMemo(
    () =>
      buildFormSnapshot({
        brandName,
        brandTone,
        avgOrderValue,
        slackWebhookUrl,
        whatsappNotifyPhone,
        crmWebhookUrl,
        autoRouteHotLeads,
        hotLeadThreshold,
        autoDmEnabled,
        catalogueUrl,
        couponCode,
        websiteUrl,
      }),
    [
      autoDmEnabled,
      autoRouteHotLeads,
      avgOrderValue,
      brandName,
      brandTone,
      catalogueUrl,
      couponCode,
      crmWebhookUrl,
      hotLeadThreshold,
      slackWebhookUrl,
      websiteUrl,
      whatsappNotifyPhone,
    ]
  );
  const dirty = currentSnapshot !== baselineSnapshot;

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
    e?.preventDefault?.();
    setSaving(true);
    setSaveFeedback(null);
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
      setBaselineSnapshot(currentSnapshot);
      setSaveFeedback({
        type: 'success',
        title: 'Settings saved',
        message: 'All changes saved.',
      });
    } catch (err) {
      setSaveFeedback({
        type: 'error',
        title: 'Could not save settings',
        message: err.message,
      });
    } finally {
      setSaving(false);
    }
  }

  async function tryAnalyze(e) {
    e.preventDefault();
    setAnalysisFeedback(null);
    try {
      const data = await api('/api/comments/analyze', {
        method: 'POST',
        token,
        body: { text: sample },
      });
      setAnalysis(data.analysis);
    } catch (err) {
      setAnalysisFeedback({
        type: 'error',
        title: 'Analysis failed',
        message: err.message,
      });
    }
  }

  async function enableWhatsAppInbox() {
    setWaBusy(true);
    setWaFeedback(null);
    try {
      const data = await api('/api/whatsapp/enable', { method: 'POST', token });
      setWaFeedback({
        type: 'success',
        title: 'WhatsApp inbox enabled',
        message: data.message || 'Incoming WhatsApp messages will now attach to this account.',
      });
      await loadWhatsAppStatus();
    } catch (err) {
      const mapped = mapWhatsAppError(err.message, whatsappNotifyPhone);
      setWaFeedback({ type: 'error', ...mapped });
    } finally {
      setWaBusy(false);
    }
  }

  async function testWhatsAppSend() {
    setWaBusy(true);
    setWaFeedback(null);
    if (isLikelyMetaSandboxNumber(whatsappNotifyPhone)) {
      setWaFeedback({
        type: 'error',
        title: 'Wrong number for Test send',
        message:
          'You pasted Meta’s +1 555 sandbox *business* (sender) number. Add your personal WhatsApp under Meta → Try it out → Recipient, then put that phone in Sales notify phone (digits only, e.g. 9198xxxxxxxx).',
        detail: null,
      });
      setWaBusy(false);
      return;
    }
    try {
      const data = await api('/api/whatsapp/test-send', {
        method: 'POST',
        token,
        body: { to: whatsappNotifyPhone || undefined },
      });
      setWaFeedback({
        type: 'success',
        title: 'WhatsApp test sent',
        message: data.message || 'The test message was sent to the configured sales phone.',
      });
    } catch (err) {
      const mapped = mapWhatsAppError(err.message, whatsappNotifyPhone);
      setWaFeedback({ type: 'error', ...mapped });
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
      setWaFeedback({
        type: 'error',
        title: 'Copy failed',
        message: 'Could not copy the Callback URL. Select it manually and paste into Meta.',
      });
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
        <Link to="/app/billing" className="btn btn-ghost btn-sm settings-plan-chip">
          Plan: {user?.subscription?.planId || 'starter'}
          {user?.subscription?.status ? ` · ${user.subscription.status}` : ''} — Manage
        </Link>
      </div>

      {saveFeedback && (
        <div className={saveFeedback.type === 'error' ? 'error-banner' : 'success-banner'}>
          <strong>{saveFeedback.title}</strong>
          <div>{saveFeedback.message}</div>
        </div>
      )}
      {waFeedback && (
        <div className={waFeedback.type === 'error' ? 'error-banner' : 'success-banner'}>
          <strong>{waFeedback.title}</strong>
          <div>{waFeedback.message}</div>
          {waFeedback.detail ? <div className="banner-detail">{waFeedback.detail}</div> : null}
        </div>
      )}
      {analysisFeedback && (
        <div className="error-banner">
          <strong>{analysisFeedback.title}</strong>
          <div>{analysisFeedback.message}</div>
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
                  disabled={
                    waBusy ||
                    !waStatus.configured ||
                    !whatsappNotifyPhone ||
                    isLikelyMetaSandboxNumber(whatsappNotifyPhone)
                  }
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
            Sales notify phone (your personal WhatsApp)
            <input
              placeholder="9696187534 or 919696187534"
              value={whatsappNotifyPhone}
              onChange={(e) => setWhatsappNotifyPhone(e.target.value)}
            />
          </label>
          <p className="prob">
            Recipient that receives hot-lead alerts. 10-digit India mobiles (e.g.{' '}
            <code>9696187534</code>) get country code <code>91</code> added automatically; or paste{' '}
            <code>9196…</code> / <code>+91…</code>. Must be a Meta <strong>test recipient</strong>. Do{' '}
            <strong>not</strong> paste Meta’s +1 555 test / business number (that is the sender). Save
            settings after changing.
          </p>
          {isLikelyMetaSandboxNumber(whatsappNotifyPhone) ? (
            <div className="wa-warn">
              This value looks like Meta’s sandbox business number. Replace it with your personal
              WhatsApp after adding that number under Meta → Try it out → Recipient.
            </div>
          ) : null}
          {waFeedback?.detail?.includes('131030') || waFeedback?.title === 'WhatsApp test failed' ? (
            <p className="prob">
              Meta Development mode only delivers to allowed recipients. Add <em>your</em> phone
              under Recipient (not the +1 555 test number), then retry Test send.
            </p>
          ) : null}
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

      </form>

      <div className="panel settings-utility">
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

      <div className="settings-savebar">
        <div className="settings-savebar-copy">
          <strong>{dirty ? 'Unsaved changes' : 'All changes saved'}</strong>
          <span>
            {dirty
              ? 'Save before leaving this page so WhatsApp, routing, and Auto DM changes are kept.'
              : 'Your current Settings values are synced.'}
          </span>
        </div>
        <button className="btn btn-citrus" type="button" onClick={save} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}
