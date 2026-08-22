import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const PLATFORMS = [
  { id: 'youtube', label: 'YouTube', ready: true, mvp: true },
  { id: 'instagram', label: 'Instagram', ready: true, mvp: true },
  { id: 'facebook', label: 'Facebook', ready: true, mvp: false },
  { id: 'whatsapp', label: 'WhatsApp', ready: true, mvp: true },
  { id: 'tiktok', label: 'TikTok', ready: false, mvp: false },
  { id: 'x', label: 'X', ready: false, mvp: false },
];

function instagramAuthLabel(metaAuthType) {
  if (metaAuthType === 'instagram_direct') return 'Via Instagram login';
  if (metaAuthType === 'facebook_page') return 'Via Facebook Page';
  return '';
}

export default function Connections() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connections, setConnections] = useState([]);
  const [integration, setIntegration] = useState({
    youtubeOAuth: false,
    metaOAuth: false,
    instagramDirectOAuth: false,
    llm: false,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [syncing, setSyncing] = useState('');

  async function load() {
    const [connData, statusData] = await Promise.all([
      api('/api/connections', { token }),
      api('/api/connections/status', { token }),
    ]);
    setConnections(connData.connections);
    setIntegration(statusData);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [token]);

  useEffect(() => {
    const yt = searchParams.get('youtube');
    const meta = searchParams.get('meta');
    const instagram = searchParams.get('instagram');
    if (!yt && !meta && !instagram) return;

    if (yt === 'connected') {
      setMessage('YouTube connected. Click Sync comments to pull real comments.');
      load().catch(() => {});
    } else if (yt === 'error') {
      setError(searchParams.get('reason') || 'YouTube connection failed');
    }

    if (meta === 'connected') {
      const platform = searchParams.get('platform') || 'facebook';
      setMessage(
        `${platform === 'instagram' ? 'Instagram (via Facebook Page)' : 'Facebook'} connected via Meta. Click Sync.`
      );
      load().catch(() => {});
    } else if (meta === 'error') {
      setError(searchParams.get('reason') || 'Meta connection failed');
    }

    if (instagram === 'connected') {
      setMessage('Instagram connected via Instagram login. No Facebook Page required. Click Sync.');
      load().catch(() => {});
    } else if (instagram === 'error') {
      setError(searchParams.get('reason') || 'Instagram connection failed');
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  async function connectYouTube() {
    setError('');
    setMessage('');
    setBusy('youtube');
    try {
      const data = await api('/api/connections/youtube/auth', { token });
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  }

  async function connectInstagramDirect() {
    setError('');
    setMessage('');
    setBusy('instagram-direct');
    try {
      const data = await api('/api/connections/instagram/auth', { token });
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  }

  async function connectMeta(platform) {
    setError('');
    setMessage('');
    setBusy(platform);
    try {
      const data = await api(`/api/connections/meta/auth?platform=${platform}`, { token });
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  }

  async function syncPlatform(platform) {
    setError('');
    setMessage('');
    setSyncing(platform);
    try {
      const path =
        platform === 'youtube'
          ? '/api/connections/youtube/sync'
          : platform === 'facebook'
            ? '/api/connections/facebook/sync'
            : '/api/connections/instagram/sync';
      const data = await api(path, { method: 'POST', token, body: {} });
      const summary = `${data.message} Analysis: ${data.analysisMode === 'llm' ? 'OpenAI LLM' : 'rules fallback'}.`;
      if ((platform === 'facebook' || platform === 'instagram') && data.fetched === 0) {
        setError(summary);
        setMessage('');
      } else {
        setMessage(summary);
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing('');
    }
  }

  async function disconnect(p) {
    await api(`/api/connections/${p}`, { method: 'DELETE', token });
    await load();
  }

  function statusFor(id) {
    return connections.find((c) => c.platform === id);
  }

  const yt = statusFor('youtube');
  const ig = statusFor('instagram');
  const fb = statusFor('facebook');
  const igAuthLabel = instagramAuthLabel(ig?.metaAuthType);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Connect channels</h1>
          <p>Instagram, YouTube, Facebook via OAuth. WhatsApp Cloud API is configured in Settings.</p>
        </div>
      </div>

      <div className="stat-row" style={{ marginBottom: '1rem' }}>
        <div className="stat">
          <strong>{integration.youtubeOAuth ? 'On' : 'Off'}</strong>
          <span>YouTube OAuth</span>
        </div>
        <div className="stat">
          <strong>{integration.metaOAuth ? 'On' : 'Off'}</strong>
          <span>Meta (Facebook Login)</span>
        </div>
        <div className="stat">
          <strong>{integration.instagramDirectOAuth ? 'On' : 'Off'}</strong>
          <span>Instagram Login</span>
        </div>
        <div className="stat">
          <strong>{integration.llm ? 'On' : 'Rules'}</strong>
          <span>LLM categorization</span>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <div className="panel stack-gap">
        <h2>WhatsApp</h2>
        <p className="prob" style={{ marginTop: 0 }}>
          Incoming messages use Meta Cloud API webhooks — not Facebook Login. Enable inbox and copy
          the Callback URL in Settings.
        </p>
        <div className="reply-actions">
          <Link className="btn btn-citrus btn-sm" to="/app/settings">
            Open WhatsApp settings
          </Link>
        </div>
      </div>

      <div className="panel stack-gap">
        <h2>YouTube</h2>
        <p className="prob" style={{ marginTop: 0 }}>
          Connect with Google, then sync comments.
          {integration.llm ? ' Categorized with OpenAI.' : ' Rule-based AI (add OPENAI_API_KEY for LLM).'}
        </p>
        <div className="reply-actions">
          <button
            type="button"
            className="btn btn-citrus"
            onClick={connectYouTube}
            disabled={Boolean(busy) || !integration.youtubeOAuth}
          >
            {busy === 'youtube' ? 'Redirecting…' : yt?.hasOAuth ? 'Reconnect YouTube' : 'Connect with Google'}
          </button>
          {yt?.hasOAuth && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => syncPlatform('youtube')}
              disabled={Boolean(syncing)}
            >
              {syncing === 'youtube' ? 'Syncing…' : 'Sync comments'}
            </button>
          )}
          {yt && !yt.hasOAuth && (
            <button type="button" className="btn btn-ghost" onClick={() => disconnect('youtube')}>
              Remove stub
            </button>
          )}
        </div>
        {!integration.youtubeOAuth && (
          <p className="prob">Add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to server/.env</p>
        )}
        {yt?.hasOAuth && yt?.lastSyncedAt && (
          <p className="prob">Last synced: {new Date(yt.lastSyncedAt).toLocaleString()}</p>
        )}
      </div>

      <div className="panel stack-gap">
        <h2>Instagram</h2>
        <p className="prob" style={{ marginTop: 0 }}>
          <strong>Recommended:</strong> Connect with Instagram — log in at instagram.com with your
          Business/Creator account. No Facebook Page required.
          <br />
          <strong>Meta setup:</strong> Add the OAuth redirect URI in Instagram → Business login
          (Section 3). Do <strong>not</strong> use Verify and save in Configure webhooks (Section 2)
          — that URL is for login return, not webhooks. See docs/META_INSTAGRAM_SETUP.md.
          <br />
          <strong>Alternative:</strong> Connect via Facebook Page if your IG is linked in Meta
          Business Suite.
        </p>
        <div className="reply-actions">
          <button
            type="button"
            className="btn btn-citrus"
            onClick={connectInstagramDirect}
            disabled={Boolean(busy) || !integration.instagramDirectOAuth}
          >
            {busy === 'instagram-direct'
              ? 'Redirecting…'
              : ig?.hasOAuth && ig?.metaAuthType === 'instagram_direct'
                ? 'Reconnect with Instagram'
                : 'Connect with Instagram'}
          </button>
          {ig?.hasOAuth && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => syncPlatform('instagram')}
              disabled={Boolean(syncing)}
            >
              {syncing === 'instagram' ? 'Syncing…' : 'Sync comments'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => connectMeta('instagram')}
            disabled={Boolean(busy) || !integration.metaOAuth}
          >
            {busy === 'instagram' ? 'Redirecting…' : 'Connect via Facebook Page'}
          </button>
          {ig && !ig.hasOAuth && (
            <button type="button" className="btn btn-ghost" onClick={() => disconnect('instagram')}>
              Remove stub
            </button>
          )}
        </div>
        {!integration.instagramDirectOAuth && (
          <p className="prob">
            Add META_INSTAGRAM_APP_ID / META_INSTAGRAM_APP_SECRET to server/.env, or reuse existing
            META_APP_ID / META_APP_SECRET (same Meta app). See docs/META_INSTAGRAM_SETUP.md. Also
            enable Instagram → API setup with Instagram login in Meta App Dashboard.
          </p>
        )}
        {ig?.hasOAuth && (
          <p className="prob">
            Connected: <strong>{ig.accountName || 'Unknown'}</strong>
            {igAuthLabel ? (
              <>
                {' '}
                <span className="pill wa-pill-ready">{igAuthLabel}</span>
              </>
            ) : null}
          </p>
        )}
        {ig?.hasOAuth && ig?.lastSyncedAt && (
          <p className="prob">Last synced: {new Date(ig.lastSyncedAt).toLocaleString()}</p>
        )}
      </div>

      <div className="panel stack-gap">
        <h2>Facebook</h2>
        <p className="prob" style={{ marginTop: 0 }}>
          Connect a Facebook Page you admin. Sync merges published_posts + feed + posts (up to
          ~250), then imports comments. If Comments Manager shows comments but Sync finds 0, Graph
          is hiding them — usually Meta <strong>Development</strong> mode. Checklist: (1) Page
          admin must be Admin/Developer/Tester on the Meta app. (2) Post a test comment as that
          role user, then Sync. (3) For public commenters: App Review for{' '}
          <code>pages_read_engagement</code> + <code>pages_read_user_content</code>, set App{' '}
          <strong>Live</strong>, Reconnect, Sync. Connecting Facebook also links Instagram if IG is
          attached to that Page.
        </p>
        <div className="reply-actions">
          <button
            type="button"
            className="btn btn-citrus"
            onClick={() => connectMeta('facebook')}
            disabled={Boolean(busy) || !integration.metaOAuth}
          >
            {busy === 'facebook'
              ? 'Redirecting…'
              : fb?.hasOAuth
                ? 'Reconnect Facebook'
                : 'Connect Facebook'}
          </button>
          {fb?.hasOAuth && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => syncPlatform('facebook')}
              disabled={Boolean(syncing)}
            >
              {syncing === 'facebook' ? 'Syncing…' : 'Sync comments'}
            </button>
          )}
          {fb && !fb.hasOAuth && (
            <button type="button" className="btn btn-ghost" onClick={() => disconnect('facebook')}>
              Remove stub
            </button>
          )}
        </div>
        {fb?.hasOAuth && (
          <p className="prob">
            Connected Page: <strong>{fb.accountName || 'Unknown'}</strong>
            {fb.channelId ? (
              <>
                {' '}
                (id <code>{fb.channelId}</code>)
              </>
            ) : null}
            . Confirm this matches Meta Comments Manager, then Sync.
          </p>
        )}
        {fb?.hasOAuth && fb?.lastSyncedAt && (
          <p className="prob">Last synced: {new Date(fb.lastSyncedAt).toLocaleString()}</p>
        )}
      </div>

      <div className="panel">
        <h2>Channels</h2>
        <div className="connect-grid">
          {PLATFORMS.map((p) => {
            const conn = statusFor(p.id);
            const igVia = p.id === 'instagram' ? instagramAuthLabel(conn?.metaAuthType) : '';
            return (
              <div className="connect-row" key={p.id}>
                <div>
                  <strong>{p.label}</strong>
                  <div className="prob">
                    <span
                      className={`status-dot ${
                        p.id === 'whatsapp'
                          ? conn
                            ? ''
                            : 'off'
                          : conn?.hasOAuth
                            ? ''
                            : 'off'
                      }`}
                    />
                    {p.id === 'whatsapp'
                      ? conn
                        ? `Inbox · ${conn.accountName}`
                        : 'Configure in Settings'
                      : conn
                        ? conn.hasOAuth
                          ? `OAuth · ${conn.accountName}${igVia ? ` · ${igVia}` : ''}`
                          : `Stub · ${conn.accountName}`
                        : p.ready
                          ? 'Not connected'
                          : 'Coming soon'}
                  </div>
                </div>
                {conn ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => disconnect(p.id)}
                  >
                    Disconnect
                  </button>
                ) : (
                  <span className="pill">
                    {p.id === 'whatsapp' ? 'Cloud API' : p.ready ? 'OAuth' : 'Later'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
