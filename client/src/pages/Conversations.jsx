import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const STAGE_LABELS = {
  new: 'New',
  engaged: 'In DM',
  qualified: 'Qualified',
  converted: 'Converted',
  closed: 'Closed',
};

function formatInr(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function Conversations() {
  const { token, user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [simulateText, setSimulateText] = useState('COD hai, Delhi 110001');
  const [orderValue, setOrderValue] = useState(user?.avgOrderValue ?? 2499);
  const [manualReply, setManualReply] = useState('');

  async function loadList() {
    const res = await api('/api/conversations', { token });
    setConversations(res.conversations || []);
  }

  async function loadDetail(id) {
    const res = await api(`/api/conversations/${id}`, { token });
    setDetail(res.conversation);
  }

  useEffect(() => {
    loadList().catch((err) => setError(err.message));
  }, [token]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId).catch((err) => setError(err.message));
    else setDetail(null);
  }, [selectedId, token]);

  async function runAction(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await loadList();
      if (selectedId) await loadDetail(selectedId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const q = detail?.qualification || {};

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>DM conversations</h1>
          <p>
            Reel comment → public reply → DM → qualify → handoff → sale. Simulate replies when
            Instagram webhooks are not live yet.
          </p>
        </div>
        <Link to="/app/insights" className="btn btn-ghost btn-sm">
          Post triggers
        </Link>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="conversations-layout">
        <section className="panel conversations-list">
          <h2>Threads ({conversations.length})</h2>
          {conversations.length ? (
            <ul className="conv-list">
              {conversations.map((c) => (
                <li key={c._id}>
                  <button
                    type="button"
                    className={`conv-list-item${selectedId === c._id ? ' active' : ''}`}
                    onClick={() => setSelectedId(c._id)}
                  >
                    <strong>{c.customerHandle || 'Customer'}</strong>
                    <span className={`pill stage-${c.stage}`}>{STAGE_LABELS[c.stage] || c.stage}</span>
                    <span className="muted">{c.postTitle || c.platform}</span>
                    <span className="muted">{c.messages?.length || 0} messages</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="prob">
              No conversations yet. Enable Instagram sales agent in Settings, sync comments on a
              reel, or simulate below after a thread exists.
            </p>
          )}
        </section>

        <section className="panel conversations-detail">
          {detail ? (
            <>
              <h2>{detail.customerHandle || 'Customer'}</h2>
              <p className="prob">
                {detail.postTitle ? `Reel/post: ${detail.postTitle}` : detail.platform} ·{' '}
                <span className={`pill stage-${detail.stage}`}>
                  {STAGE_LABELS[detail.stage] || detail.stage}
                </span>
              </p>

              <div className="qual-card">
                <h3>Qualification</h3>
                <ul className="plain-list">
                  <li>COD: {q.cod === true ? 'Yes' : q.cod === false ? 'No' : '—'}</li>
                  <li>City: {q.city || '—'}</li>
                  <li>Pincode: {q.pincode || '—'}</li>
                  <li>Phone: {q.phone || '—'}</li>
                  <li>Size: {q.size || '—'}</li>
                </ul>
                {detail.handoff?.url ? (
                  <p className="prob">
                    Handoff ({detail.handoff.type}):{' '}
                    <a href={detail.handoff.url} target="_blank" rel="noreferrer">
                      {detail.handoff.url}
                    </a>
                  </p>
                ) : null}
              </div>

              <div className="thread-messages">
                {(detail.messages || []).map((m) => (
                  <div key={m._id || m.sentAt} className={`thread-bubble ${m.role}`}>
                    <span className="thread-role">{m.role}</span>
                    <p>{m.text}</p>
                  </div>
                ))}
              </div>

              <div className="conv-actions">
                <h3>Simulate customer DM</h3>
                <textarea
                  value={simulateText}
                  onChange={(e) => setSimulateText(e.target.value)}
                  rows={2}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={() =>
                    runAction(() =>
                      api(`/api/conversations/${detail._id}/simulate-inbound`, {
                        method: 'POST',
                        token,
                        body: { text: simulateText },
                      })
                    )
                  }
                >
                  Simulate reply
                </button>

                <h3>Actions</h3>
                <div className="conv-action-row">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() =>
                      runAction(() =>
                        api(`/api/conversations/${detail._id}/handoff`, { method: 'POST', token })
                      )
                    }
                  >
                    Send handoff now
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() =>
                      runAction(() =>
                        api(`/api/conversations/${detail._id}/stage`, {
                          method: 'PATCH',
                          token,
                          body: { stage: 'qualified' },
                        })
                      )
                    }
                  >
                    Mark qualified
                  </button>
                </div>
                <div className="conv-action-row">
                  <input
                    type="number"
                    min="0"
                    value={orderValue}
                    onChange={(e) => setOrderValue(e.target.value)}
                    placeholder="Order value"
                  />
                  <button
                    type="button"
                    className="btn btn-citrus btn-sm"
                    disabled={busy}
                    onClick={() =>
                      runAction(() =>
                        api(`/api/conversations/${detail._id}/convert`, {
                          method: 'POST',
                          token,
                          body: { orderValue: Number(orderValue) },
                        })
                      )
                    }
                  >
                    Mark converted ({formatInr(orderValue)})
                  </button>
                </div>

                <h3>Manual reply</h3>
                <textarea
                  value={manualReply}
                  onChange={(e) => setManualReply(e.target.value)}
                  rows={2}
                  placeholder="Type a manual agent message…"
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy || !manualReply.trim()}
                  onClick={() =>
                    runAction(async () => {
                      await api(`/api/conversations/${detail._id}/reply`, {
                        method: 'POST',
                        token,
                        body: { text: manualReply },
                      });
                      setManualReply('');
                    })
                  }
                >
                  Send reply
                </button>
              </div>
            </>
          ) : (
            <p className="prob">Select a conversation to view the DM thread and qualify the lead.</p>
          )}
        </section>
      </div>
    </div>
  );
}
