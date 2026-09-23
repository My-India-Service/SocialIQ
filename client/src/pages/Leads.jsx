import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const TEMP_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'hot', label: 'Hot', icon: '🔥' },
  { id: 'warm', label: 'Warm', icon: '🟡' },
  { id: 'cold', label: 'Cold', icon: '🟢' },
];

function formatMoney(n, currency = 'INR') {
  if (currency === 'INR') return `₹${Number(n || 0).toLocaleString('en-IN')}`;
  return `${currency} ${Number(n || 0).toLocaleString()}`;
}

function intentLabel(temp, intent) {
  if (temp === 'hot') return `🔥 ${intent}%`;
  if (temp === 'warm') return `🟡 ${intent}%`;
  if (temp === 'cold') return `🟢 ${intent}%`;
  return `${intent}%`;
}

function formatDetected(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Leads() {
  const { token, user } = useAuth();
  const currency = user?.currency || 'INR';
  const [temperature, setTemperature] = useState('all');
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [createForm, setCreateForm] = useState({
    person: '',
    text: '',
    expectedOrderValue: user?.avgOrderValue ?? 2499,
  });

  async function loadList() {
    const data = await api(`/api/leads?temperature=${temperature}`, { token });
    setLeads(data.leads || []);
    setTotal(data.total || 0);
  }

  async function loadDetail(id) {
    const data = await api(`/api/leads/${id}`, { token });
    setDetail(data);
    setReplyText(data.lead?.suggestedReply || '');
  }

  useEffect(() => {
    loadList().catch((err) => setError(err.message));
  }, [token, temperature]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    loadDetail(selectedId).catch((err) => setError(err.message));
  }, [selectedId, token]);

  async function run(fn) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await fn();
      if (result?.message) setSuccess(result.message);
      await loadList();
      if (selectedId) await loadDetail(selectedId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function createLead(e) {
    e.preventDefault();
    await run(async () => {
      const data = await api('/api/leads', {
        method: 'POST',
        token,
        body: {
          person: createForm.person.trim(),
          text: createForm.text.trim() || undefined,
          expectedOrderValue: Number(createForm.expectedOrderValue) || 0,
        },
      });
      setShowCreate(false);
      setCreateForm({
        person: '',
        text: '',
        expectedOrderValue: user?.avgOrderValue ?? 2499,
      });
      setSelectedId(data.lead.id);
      return { message: `Lead created: ${data.lead.person}` };
    });
  }

  return (
    <div className="leads-page">
      <div className="page-head">
        <div>
          <h1>Lead Center</h1>
          <p>Mini CRM for high-intent buyers from comments and DMs.</p>
        </div>
        <button type="button" className="btn btn-citrus" onClick={() => setShowCreate((v) => !v)}>
          + Create Lead
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      {showCreate && (
        <form className="panel leads-create" onSubmit={createLead}>
          <h2>Create Lead</h2>
          <label>
            Person
            <input
              required
              value={createForm.person}
              onChange={(e) => setCreateForm((f) => ({ ...f, person: e.target.value }))}
              placeholder="Rahul Sharma"
            />
          </label>
          <label>
            Comment / note (optional)
            <textarea
              rows={2}
              value={createForm.text}
              onChange={(e) => setCreateForm((f) => ({ ...f, text: e.target.value }))}
              placeholder="Price kya hai?"
            />
          </label>
          <label>
            Estimated value (₹)
            <input
              type="number"
              min="0"
              value={createForm.expectedOrderValue}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, expectedOrderValue: e.target.value }))
              }
            />
          </label>
          <div className="reply-actions">
            <button type="submit" className="btn btn-citrus" disabled={busy}>
              Save lead
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="leads-toolbar">
        <span className="leads-count">{total} leads</span>
        <div className="leads-filters" role="tablist" aria-label="Lead temperature">
          {TEMP_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={temperature === f.id}
              className={`leads-filter${temperature === f.id ? ' is-active' : ''}`}
              onClick={() => setTemperature(f.id)}
            >
              {f.icon ? `${f.icon} ${f.label}` : f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel leads-table-wrap">
        {leads.length === 0 ? (
          <p className="prob" style={{ margin: 0 }}>
            No leads yet. Sync comments from Connect, or create a lead manually.
          </p>
        ) : (
          <table className="leads-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Intent</th>
                <th>Source</th>
                <th>Status</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className={selectedId === lead.id ? 'is-selected' : ''}
                  onClick={() => setSelectedId(lead.id)}
                >
                  <td>{lead.person}</td>
                  <td>{intentLabel(lead.temperature, lead.intent)}</td>
                  <td>{lead.source}</td>
                  <td>{lead.statusLabel}</td>
                  <td>{formatMoney(lead.value, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detail?.lead && (
        <div className="panel lead-detail">
          <div className="lead-detail-head">
            <div>
              <h2>{detail.lead.person}</h2>
              <div className="lead-detail-meta">
                <span className={`pill temp-${detail.summary.temperature || 'none'}`}>
                  {detail.summary.highIntent
                    ? '🔥 High Intent'
                    : intentLabel(detail.summary.temperature, detail.summary.purchaseIntent)}
                </span>
                <span className="pill">{detail.summary.source}</span>
                <span className="prob">
                  First detected: {formatDetected(detail.summary.firstDetectedAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="lead-detail-grid">
            <div className="lead-thread-block">
              <h3>Conversation</h3>
              <div className="lead-thread">
                {(detail.conversation?.messages || []).length === 0 ? (
                  <p className="prob">No messages yet.</p>
                ) : (
                  detail.conversation.messages.map((m, i) => (
                    <div
                      key={`${m.role}-${i}`}
                      className={`lead-bubble lead-bubble-${m.role === 'agent' ? 'agent' : 'customer'}`}
                    >
                      <span className="lead-bubble-role">
                        {m.role === 'agent' ? 'AI' : 'Customer'}
                      </span>
                      <p>{m.text}</p>
                    </div>
                  ))
                )}
              </div>
              {detail.conversation?.synthetic && (
                <p className="prob">Preview from comment + suggested reply (no DM thread yet).</p>
              )}
            </div>

            <div className="lead-summary-block">
              <h3>AI Lead Summary</h3>
              <p>
                <strong>Purchase intent:</strong> {detail.summary.purchaseIntent}%
              </p>
              <p>
                <strong>Estimated value:</strong>{' '}
                {formatMoney(detail.summary.estimatedValue, currency)}
              </p>

              <label>
                Reply
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type a reply…"
                />
              </label>

              <div className="reply-actions lead-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !replyText.trim()}
                  onClick={() =>
                    run(() =>
                      api(`/api/leads/${detail.lead.id}/reply`, {
                        method: 'POST',
                        token,
                        body: { message: replyText.trim() },
                      })
                    )
                  }
                >
                  Reply
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy || detail.lead.statusLabel === 'Converted'}
                  onClick={() =>
                    run(() =>
                      api(`/api/leads/${detail.lead.id}/contacted`, {
                        method: 'POST',
                        token,
                        body: {},
                      })
                    )
                  }
                >
                  Mark Contacted
                </button>
                <button
                  type="button"
                  className="btn btn-citrus"
                  disabled={busy || detail.lead.statusLabel === 'Converted'}
                  onClick={() =>
                    run(() =>
                      api(`/api/leads/${detail.lead.id}/convert`, {
                        method: 'POST',
                        token,
                        body: { orderValue: detail.summary.estimatedValue },
                      })
                    )
                  }
                >
                  Convert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
