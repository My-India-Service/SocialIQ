import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const VIEWS = [
  { id: 'flagged', label: 'Needs review' },
  { id: 'spam', label: 'Spam' },
  { id: 'toxic', label: 'Toxic' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'deleted', label: 'Removed' },
  { id: 'all', label: 'All' },
];

const BULK_ACTIONS = [
  { id: 'hide', label: 'Hide', className: 'btn-primary', confirm: false },
  { id: 'unhide', label: 'Unhide', className: 'btn-ghost', confirm: false },
  { id: 'allow', label: 'Allow', className: 'btn-ghost', confirm: false },
  { id: 'mark_spam', label: 'Mark spam', className: 'btn-ghost', confirm: false },
  { id: 'delete', label: 'Remove', className: 'btn-danger', confirm: true },
];

function scoreTone(n) {
  if (n >= 70) return 'high';
  if (n >= 35) return 'mid';
  return 'low';
}

export default function Moderation() {
  const { token } = useAuth();
  const [view, setView] = useState('flagged');
  const [platform, setPlatform] = useState('all');
  const [comments, setComments] = useState([]);
  const [counts, setCounts] = useState({});
  const [selected, setSelected] = useState(() => new Set());
  const [settings, setSettings] = useState(null);
  const [keywordsText, setKeywordsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    const q = new URLSearchParams({ view, platform });
    const data = await api(`/api/moderation?${q}`, { token });
    setComments(data.comments || []);
    setCounts(data.counts || {});
    setSettings((prev) => prev || data.settings);
    setKeywordsText((prev) => (settings ? prev : (data.settings?.customKeywords || []).join(', ')));
    setSelected(new Set());
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, view, platform]);

  const allSelected = comments.length > 0 && selected.size === comments.length;

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(comments.map((c) => c.id)));
  }

  async function run(fn) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const data = await fn();
      if (data?.message) setSuccess(data.message);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function bulk(action) {
    const meta = BULK_ACTIONS.find((a) => a.id === action);
    if (
      meta?.confirm &&
      !window.confirm(
        `Remove ${selected.size} comment(s)? Facebook/Instagram deletes them; YouTube rejects them from public view.`
      )
    ) {
      return;
    }
    run(() =>
      api('/api/moderation/bulk', {
        method: 'POST',
        token,
        body: { ids: [...selected], action },
      })
    );
  }

  async function saveSettings(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const data = await api('/api/moderation/settings', {
        method: 'PATCH',
        token,
        body: { ...settings, customKeywords: keywordsText },
      });
      setSettings(data.settings);
      setKeywordsText((data.settings.customKeywords || []).join(', '));
      const scan = await api('/api/moderation/rescan', { method: 'POST', token, body: {} });
      setSuccess(`${data.message} · ${scan.message}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const platforms = useMemo(
    () => ['all', 'instagram', 'facebook', 'youtube', 'linkedin', 'tiktok'],
    []
  );

  return (
    <div className="moderation-page">
      <div className="page-head">
        <div>
          <h1>Moderation</h1>
          <p>
            Catch spam, bots, abuse, and competitor ads before customers see them. Hide or remove in
            bulk on Instagram, Facebook, and YouTube.
          </p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="mod-tabs" role="tablist" aria-label="Moderation view">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            className={`mod-tab${view === v.id ? ' is-active' : ''}`}
            onClick={() => setView(v.id)}
          >
            {v.label}
            {counts[v.id] != null && <span className="mod-tab-count">{counts[v.id]}</span>}
          </button>
        ))}
        <select
          className="mod-platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          aria-label="Platform"
        >
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p === 'all' ? 'All platforms' : p[0].toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="mod-layout">
        <section className="panel mod-list-panel">
          <div className="mod-bulkbar">
            <label className="mod-check">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              {selected.size ? `${selected.size} selected` : 'Select all'}
            </label>
            <div className="mod-bulk-actions">
              {BULK_ACTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`btn btn-sm ${a.className}`}
                  disabled={busy || selected.size === 0}
                  onClick={() => bulk(a.id)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {comments.length === 0 ? (
            <p className="prob mod-empty">
              Nothing here. New comments are scored automatically on every sync.
            </p>
          ) : (
            <ul className="mod-list">
              {comments.map((c) => (
                <li key={c.id} className={`mod-row${selected.has(c.id) ? ' is-selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    aria-label={`Select comment by ${c.author}`}
                  />
                  <div className="mod-row-body">
                    <div className="mod-row-top">
                      <strong>{c.authorHandle ? `@${c.authorHandle.replace(/^@/, '')}` : c.author}</strong>
                      <span className={`pill platform-${c.platform}`}>{c.platform}</span>
                      <span className={`mod-status mod-status-${c.moderationStatus}`}>
                        {c.moderationStatus}
                      </span>
                    </div>
                    <p className="mod-text">{c.text}</p>
                    <div className="mod-row-meta">
                      <span className={`mod-score mod-score-${scoreTone(c.spamScore)}`}>
                        Spam {c.spamScore}
                      </span>
                      <span className={`mod-score mod-score-${scoreTone(c.toxicity)}`}>
                        Toxic {c.toxicity}
                      </span>
                      {c.flags.map((f) => (
                        <span key={f.id} className="mod-flag">
                          {f.label}
                        </span>
                      ))}
                      {!c.canModerateOnPlatform && (
                        <span className="mod-flag mod-flag-muted">Local only</span>
                      )}
                    </div>
                    {c.moderationError && <p className="mod-error">{c.moderationError}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {settings && (
          <form className="panel mod-settings" onSubmit={saveSettings}>
            <h2>Rules</h2>
            <label>
              Sensitivity
              <select
                value={settings.sensitivity}
                onChange={(e) => setSettings({ ...settings, sensitivity: e.target.value })}
              >
                <option value="low">Low — only obvious spam/abuse</option>
                <option value="medium">Medium — recommended</option>
                <option value="high">High — flag anything suspicious</option>
              </select>
            </label>
            <label className="mod-check">
              <input
                type="checkbox"
                checked={settings.autoHide}
                onChange={(e) => setSettings({ ...settings, autoHide: e.target.checked })}
              />
              Auto-hide flagged comments on sync
            </label>
            <label className="mod-check">
              <input
                type="checkbox"
                checked={settings.hideCompetitorAds}
                onChange={(e) => setSettings({ ...settings, hideCompetitorAds: e.target.checked })}
              />
              Detect competitor ads (“buy it cheaper at @…”)
            </label>
            <label>
              Custom blocked keywords
              <textarea
                rows={3}
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder="e.g. giveaway, telegram, rival brand"
              />
            </label>
            <p className="prob">
              Saving rescans recent comments. Hidden, removed, and allowed comments keep their status.
            </p>
            <button type="submit" className="btn btn-citrus" disabled={busy}>
              {busy ? 'Saving…' : 'Save & rescan'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
