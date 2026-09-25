import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'all', label: 'All' },
];

const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' };

function slaText(t) {
  if (t.status === 'resolved') return t.slaBreached ? 'Resolved after SLA' : 'Resolved in SLA';
  const ms = t.slaRemainingMs ?? 0;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const span = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
  return ms < 0 ? `Overdue ${span}` : `${span} left`;
}

function slaTone(t) {
  if (t.status === 'resolved') return t.slaBreached ? 'late' : 'ok';
  if (t.slaBreached) return 'late';
  if ((t.slaRemainingMs ?? 0) < 2 * 3600000) return 'soon';
  return 'ok';
}

export default function Tickets() {
  const { token } = useAuth();
  const [tab, setTab] = useState('open');
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [ownerDraft, setOwnerDraft] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [, setTick] = useState(0);

  async function load(nextTab = tab) {
    const q = nextTab === 'all' ? '' : `?status=${nextTab}`;
    const res = await api(`/api/tickets${q}`, { token });
    setData(res);
    setWebhookUrl((prev) => prev || res.helpdeskWebhookUrl || '');
    return res;
  }

  useEffect(() => {
    load(tab).catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tab]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const tickets = data?.tickets || [];
  const selected = tickets.find((t) => t.id === selectedId) || null;

  useEffect(() => {
    setOwnerDraft(selected?.owner || '');
  }, [selected?.id, selected?.owner]);

  async function run(fn) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const update = (id, body, message) =>
    run(async () => {
      const res = await api(`/api/tickets/${id}`, { method: 'PATCH', token, body });
      const hook = res.webhook?.sent ? ' · synced to helpdesk' : '';
      setSuccess(`${message}${hook}`);
      await load();
    });

  const syncNow = () =>
    run(async () => {
      const res = await api('/api/tickets/sync', { method: 'POST', token, body: {} });
      setSuccess(res.message);
      await load();
    });

  const saveWebhook = (e) => {
    e.preventDefault();
    run(async () => {
      const res = await api('/api/tickets/settings', {
        method: 'PATCH',
        token,
        body: { helpdeskWebhookUrl: webhookUrl },
      });
      setSuccess(res.message);
    });
  };

  const counts = data?.counts || {};

  return (
    <div className="tickets-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Complaint desk</p>
          <h1>Tickets</h1>
          <p>
            Every complaint becomes a ticket with an owner and an SLA. Repeat complaints on the same
            issue are grouped automatically.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={syncNow} disabled={busy}>
          Sync complaints
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      {data?.breached > 0 && (
        <div className="error-banner">
          ⏱ {data.breached} ticket{data.breached === 1 ? '' : 's'} past SLA — customers are waiting.
        </div>
      )}

      <div className="mod-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`mod-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => {
              setTab(t.id);
              setSelectedId(null);
            }}
          >
            {t.label}
            <span className="mod-tab-count">{counts[t.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="tickets-layout">
        <section className="panel tickets-list-panel">
          {tickets.length === 0 ? (
            <p className="mod-empty">No tickets here. 🎉</p>
          ) : (
            <ul className="ticket-list">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`ticket-row${selectedId === t.id ? ' is-selected' : ''}`}
                    onClick={() => setSelectedId(t.id)}
                  >
                    <div className="ticket-row-top">
                      <strong className="ticket-label">{t.label}</strong>
                      <span className={`ticket-priority ticket-priority-${t.priority}`}>{t.priority}</span>
                      <span className="pill">{t.topicLabel}</span>
                      {t.grouped && <span className="ticket-grouped">×{t.commentCount} grouped</span>}
                    </div>
                    <p className="ticket-title">{t.title}</p>
                    <div className="ticket-row-meta">
                      <span className={`ticket-status ticket-status-${t.status}`}>{STATUS_LABEL[t.status]}</span>
                      <span className={`ticket-sla ticket-sla-${slaTone(t)}`}>{slaText(t)}</span>
                      <span>{t.owner ? `👤 ${t.owner}` : 'Unassigned'}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="panel ticket-detail">
          {!selected ? (
            <>
              <h2>Helpdesk sync</h2>
              <p className="prob">
                Send ticket created/updated events to Freshdesk, Zendesk, Zoho Desk, or any tool
                that accepts a webhook (Zapier/Make work too). Falls back to your CRM webhook.
              </p>
              <form onSubmit={saveWebhook} className="ticket-webhook-form">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/…"
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                  Save
                </button>
              </form>
              <p className="prob">Select a ticket to assign it, change status, and see every grouped comment.</p>
            </>
          ) : (
            <>
              <div className="ticket-detail-head">
                <strong className="ticket-label">{selected.label}</strong>
                <span className={`ticket-priority ticket-priority-${selected.priority}`}>{selected.priority}</span>
                <span className={`ticket-sla ticket-sla-${slaTone(selected)}`}>{slaText(selected)}</span>
              </div>
              <h2>{selected.title}</h2>

              <div className="ticket-controls">
                <label>
                  Status
                  <select
                    value={selected.status}
                    disabled={busy}
                    onChange={(e) =>
                      update(selected.id, { status: e.target.value }, `${selected.label} → ${STATUS_LABEL[e.target.value]}`)
                    }
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </label>
                <label>
                  Owner
                  <div className="ticket-owner-row">
                    <input
                      value={ownerDraft}
                      onChange={(e) => setOwnerDraft(e.target.value)}
                      placeholder="e.g. Priya (support)"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy || ownerDraft === (selected.owner || '')}
                      onClick={() => update(selected.id, { owner: ownerDraft }, `${selected.label} assigned`)}
                    >
                      Assign
                    </button>
                  </div>
                </label>
              </div>

              {selected.webhookError && (
                <p className="mod-error">Helpdesk sync failed: {selected.webhookError}</p>
              )}

              <h3>
                {selected.commentCount} comment{selected.commentCount === 1 ? '' : 's'}
              </h3>
              <ul className="ticket-comments">
                {selected.comments.map((c) => (
                  <li key={c.id}>
                    <div className="post-comment-top">
                      <strong>{c.author}</strong>
                      <span className={`pill platform-${c.platform}`}>{c.platform}</span>
                      <small>{new Date(c.postedAt).toLocaleString()}</small>
                      <small className="ticket-comment-status">{c.status}</small>
                    </div>
                    <p>{c.text}</p>
                    {c.suggestedReply && (
                      <p className="ticket-suggested">
                        <span>Suggested reply:</span> {c.suggestedReply}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
