import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const PLATFORMS = [
  { id: 'youtube', label: 'YouTube', ready: true, mvp: true },
  { id: 'instagram', label: 'Instagram', ready: true, mvp: true },
  { id: 'facebook', label: 'Facebook', ready: true, mvp: false },
  { id: 'tiktok', label: 'TikTok', ready: false, mvp: false },
  { id: 'x', label: 'X', ready: false, mvp: false },
];

export default function Connections() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connections, setConnections] = useState([]);
  const [integration, setIntegration] = useState({
    youtubeOAuth: false,
    metaOAuth: false,
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
    if (!yt && !meta) return;

    if (yt === 'connected') {
      setMessage('YouTube connected. Click Sync comments to pull real comments.');
      load().catch(() => {});
    } else if (yt === 'error') {
      setError(searchParams.get('reason') || 'YouTube connection failed');
    }

    if (meta === 'connected') {
      const platform = searchParams.get('platform') || 'facebook';
      setMessage(
        `${platform === 'instagram' ? 'Instagram' : 'Facebook'} connected via Meta. Linked Page/IG saved when available. Click Sync.`
      );
      load().catch(() => {});
    } else if (meta === 'error') {
      setError(searchParams.get('reason') || 'Meta connection failed');
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
      setMessage(
        `${data.message} Analysis: ${data.analysisMode === 'llm' ? 'OpenAI LLM' : 'rules fallback'}.`
      );
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

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Connect channels</h1>
          <p>MVP focus: Instagram & YouTube via official APIs. Facebook optional; TikTok/X later.</p>
        </div>
      </div>

      <div className="stat-row" style={{ marginBottom: '1rem' }}>
        <div className="stat">
          <strong>{integration.youtubeOAuth ? 'On' : 'Off'}</strong>
          <span>YouTube OAuth</span>
        </div>
        <div className="stat">
          <strong>{integration.metaOAuth ? 'On' : 'Off'}</strong>
          <span>Meta OAuth</span>
        </div>
        <div className="stat">
          <strong>{integration.llm ? 'On' : 'Rules'}</strong>
          <span>LLM categorization</span>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {message && (
        <div className="panel" style={{ marginBottom: '1rem', background: '#eef8d4' }}>
          {message}
        </div>
      )}

      <div className="panel" style={{ marginBottom: '1rem' }}>
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

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h2>Instagram</h2>
        <p className="prob" style={{ marginTop: 0 }}>
          Needs an Instagram Business/Creator account linked to a Facebook Page. Meta Login → Sync
          media comments.
        </p>
        <div className="reply-actions">
          <button
            type="button"
            className="btn btn-citrus"
            onClick={() => connectMeta('instagram')}
            disabled={Boolean(busy) || !integration.metaOAuth}
          >
            {busy === 'instagram'
              ? 'Redirecting…'
              : ig?.hasOAuth
                ? 'Reconnect Instagram'
                : 'Connect Instagram'}
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
          {ig && !ig.hasOAuth && (
            <button type="button" className="btn btn-ghost" onClick={() => disconnect('instagram')}>
              Remove stub
            </button>
          )}
        </div>
        {!integration.metaOAuth && (
          <p className="prob">Add META_APP_ID / META_APP_SECRET to server/.env</p>
        )}
        {ig?.hasOAuth && ig?.lastSyncedAt && (
          <p className="prob">Last synced: {new Date(ig.lastSyncedAt).toLocaleString()}</p>
        )}
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h2>Facebook</h2>
        <p className="prob" style={{ marginTop: 0 }}>
          Connect a Facebook Page you admin. Pulls post comments via Graph API (up to ~50 recent
          posts). The connected Page must be the same one that shows comments in Meta Comments
          Manager — if Sync returns 0, Reconnect and pick that Page. If IG is linked, Meta also
          connects Instagram. Comment sync needs{' '}
          <code>pages_read_engagement</code> + <code>pages_read_user_content</code> (Ready for
          testing), then Reconnect so the token includes them.
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
            return (
              <div className="connect-row" key={p.id}>
                <div>
                  <strong>{p.label}</strong>
                  <div className="prob">
                    <span className={`status-dot ${conn?.hasOAuth ? '' : 'off'}`} />
                    {conn
                      ? conn.hasOAuth
                        ? `OAuth · ${conn.accountName}`
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
                  <span className="pill">{p.ready ? 'OAuth' : 'Later'}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
