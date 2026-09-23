import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const SEVERITY_META = [
  { id: 'critical', label: 'Critical', icon: '🔴' },
  { id: 'high', label: 'High', icon: '🟠' },
  { id: 'medium', label: 'Medium', icon: '🟡' },
  { id: 'low', label: 'Low', icon: '🟢' },
];

export default function Complaints() {
  const { token } = useAuth();
  const [severity, setSeverity] = useState('all');
  const [totalActive, setTotalActive] = useState(0);
  const [bySeverity, setBySeverity] = useState({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const [complaints, setComplaints] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadList() {
    const q = severity === 'all' ? '' : `?severity=${severity}`;
    const data = await api(`/api/complaints${q}`, { token });
    setTotalActive(data.totalActive || 0);
    setBySeverity(data.bySeverity || { critical: 0, high: 0, medium: 0, low: 0 });
    setComplaints(data.complaints || []);
  }

  async function loadDetail(id) {
    const data = await api(`/api/complaints/${id}`, { token });
    setDetail(data.complaint);
    setReplyText(data.complaint?.suggestedReply || '');
  }

  useEffect(() => {
    loadList().catch((err) => setError(err.message));
  }, [token, severity]);

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

  const severityMeta = SEVERITY_META.find((s) => s.id === detail?.severity);

  return (
    <div className="complaints-page">
      <div className="page-head">
        <div>
          <h1>Complaints</h1>
          <p>Support command center — catch refunds, shipping issues, and public frustration early.</p>
        </div>
        <span className="complaints-active-pill">{totalActive} Active</span>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="complaints-severity" role="tablist" aria-label="Severity">
        <button
          type="button"
          className={`complaints-sev-card${severity === 'all' ? ' is-active' : ''}`}
          onClick={() => setSeverity('all')}
        >
          <span className="complaints-sev-label">All</span>
          <strong>{totalActive}</strong>
        </button>
        {SEVERITY_META.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`complaints-sev-card sev-${s.id}${severity === s.id ? ' is-active' : ''}`}
            onClick={() => setSeverity(s.id)}
          >
            <span className="complaints-sev-label">
              {s.icon} {s.label}
            </span>
            <strong>{bySeverity[s.id] || 0}</strong>
          </button>
        ))}
      </div>

      <div className="complaints-layout">
        <div className="complaints-list">
          {complaints.length === 0 ? (
            <div className="panel">
              <p className="prob" style={{ margin: 0 }}>
                No active complaints in this filter. Sync comments or clear the severity filter.
              </p>
            </div>
          ) : (
            complaints.map((c) => {
              const meta = SEVERITY_META.find((s) => s.id === c.severity);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`complaint-card sev-${c.severity}${selectedId === c.id ? ' is-selected' : ''}`}
                  onClick={() => setSelectedId(c.id)}
                >
                  <div className="complaint-card-top">
                    <span className={`complaint-sev-badge sev-${c.severity}`}>
                      {meta?.icon} {meta?.label?.toUpperCase()}
                    </span>
                    {c.escalated && <span className="pill">Escalated</span>}
                  </div>
                  <strong className="complaint-author">
                    {c.authorHandle ? `@${c.authorHandle.replace(/^@/, '')}` : c.author}
                  </strong>
                  <p className="complaint-quote">“{c.text}”</p>
                  <div className="complaint-card-foot">
                    <span>{c.source}</span>
                    <span>{c.relativeTime}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="panel complaint-detail">
          {!detail ? (
            <p className="prob" style={{ margin: 0 }}>
              Select a complaint to review AI tags and reply.
            </p>
          ) : (
            <>
              <div className={`complaint-detail-banner sev-${detail.severity}`}>
                {severityMeta?.icon} {severityMeta?.label?.toUpperCase()}
                {detail.escalated ? ' · Escalated' : ''}
              </div>
              <h2>
                {detail.authorHandle
                  ? `@${detail.authorHandle.replace(/^@/, '')}`
                  : detail.author}
              </h2>
              <p className="complaint-detail-text">{detail.text}</p>
              <p className="prob">
                {detail.source} · {detail.relativeTime}
                {detail.assignedTo ? ` · Assigned to ${detail.assignedTo}` : ''}
              </p>

              <h3>AI detected</h3>
              {detail.tags?.length ? (
                <ul className="complaint-tags">
                  {detail.tags.map((tag) => (
                    <li key={tag}>
                      <span aria-hidden="true">✓</span> {tag}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="prob">No extra risk tags beyond category.</p>
              )}

              <h3>Suggested response</h3>
              <textarea
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Draft a calm public reply…"
              />

              <div className="reply-actions complaint-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !replyText.trim()}
                  onClick={() =>
                    run(() =>
                      api(`/api/complaints/${detail.id}/reply`, {
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
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      api(`/api/complaints/${detail.id}/assign`, {
                        method: 'POST',
                        token,
                        body: {},
                      })
                    )
                  }
                >
                  Assign
                </button>
                <button
                  type="button"
                  className="btn btn-citrus"
                  disabled={busy || detail.escalated}
                  onClick={() =>
                    run(() =>
                      api(`/api/complaints/${detail.id}/escalate`, {
                        method: 'POST',
                        token,
                        body: {},
                      })
                    )
                  }
                >
                  Escalate
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
