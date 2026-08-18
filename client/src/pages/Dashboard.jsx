import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const CATEGORY_LABELS = {
  sales_opportunity: 'Sales',
  complaint: 'Complaint',
  feature_request: 'Feature',
  positive_feedback: 'Positive',
  spam: 'Spam',
  competitor_mention: 'Competitor',
  refund_request: 'Refund',
  shipping_issue: 'Shipping',
  influencer: 'Influencer',
  other: 'Other',
};

function formatCategory(c) {
  return CATEGORY_LABELS[c] || c;
}

function formatMoney(n, currency = 'INR') {
  if (currency === 'INR') return `₹${Number(n || 0).toLocaleString('en-IN')}`;
  return `${currency} ${Number(n || 0).toLocaleString()}`;
}

function TempPill({ temp }) {
  if (!temp || temp === 'none') return null;
  const label = temp === 'hot' ? '🔥 Hot lead' : temp === 'warm' ? 'Warm lead' : 'Cold';
  return <span className={`pill temp-${temp}`}>{label}</span>;
}

export default function Dashboard() {
  const { token, user } = useAuth();
  const [comments, setComments] = useState([]);
  const [stats, setStats] = useState(null);
  const [category, setCategory] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [temperature, setTemperature] = useState('all');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const currency = user?.currency || 'INR';

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ category, platform, q, temperature });
      const [listData, statsData] = await Promise.all([
        api(`/api/comments?${params}`, { token }),
        api('/api/comments/stats', { token }),
      ]);
      setComments(listData.comments);
      setStats(statsData.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, category, platform, temperature]);

  async function search(e) {
    e.preventDefault();
    await load();
  }

  async function updateComment(id, patch) {
    const data = await api(`/api/comments/${id}`, {
      method: 'PATCH',
      token,
      body: patch,
    });
    setComments((prev) => prev.map((c) => (c._id === id ? data.comment : c)));
  }

  async function regenerate(id) {
    setBusyId(id);
    try {
      const data = await api(`/api/comments/${id}/regenerate-reply`, {
        method: 'POST',
        token,
      });
      setComments((prev) => prev.map((c) => (c._id === id ? data.comment : c)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function sendToSales(id) {
    setBusyId(id);
    setNotice('');
    setError('');
    try {
      const data = await api(`/api/comments/${id}/send-to-sales`, {
        method: 'POST',
        token,
        body: { channels: 'all' },
      });
      setComments((prev) => prev.map((c) => (c._id === id ? data.comment : c)));
      setNotice(`Sent to sales via ${data.routing.routedChannels.join(', ')}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function queueAutoDm(id, markSent = false) {
    setBusyId(id);
    setError('');
    try {
      const data = await api(`/api/comments/${id}/auto-dm`, {
        method: 'POST',
        token,
        body: { markSent },
      });
      setComments((prev) => prev.map((c) => (c._id === id ? data.comment : c)));
      setNotice(data.note);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Revenue inbox</h1>
          <p>
            Buying intent, expected order value, and brand-tone replies — turn comments into
            revenue.
          </p>
        </div>
      </div>

      {stats && (
        <div className="stat-row">
          <div className="stat">
            <strong>{stats.total}</strong>
            <span>Comments</span>
          </div>
          <div className="stat">
            <strong>{stats.hot}</strong>
            <span>Hot leads</span>
          </div>
          <div className="stat">
            <strong>{stats.sales_opportunity}</strong>
            <span>Sales opportunities</span>
          </div>
          <div className="stat">
            <strong>{formatMoney(stats.pipelineValue, currency)}</strong>
            <span>Pipeline value</span>
          </div>
          <div className="stat">
            <strong>{stats.complaint}</strong>
            <span>Complaints</span>
          </div>
          <div className="stat">
            <strong>{stats.new}</strong>
            <span>Needs review</span>
          </div>
        </div>
      )}

      <form className="toolbar" onSubmit={search}>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          <option value="sales_opportunity">Sales opportunity</option>
          <option value="complaint">Complaint</option>
          <option value="feature_request">Feature request</option>
          <option value="positive_feedback">Positive feedback</option>
          <option value="spam">Spam</option>
          <option value="competitor_mention">Competitor</option>
          <option value="shipping_issue">Shipping</option>
          <option value="refund_request">Refund</option>
        </select>
        <select value={temperature} onChange={(e) => setTemperature(e.target.value)}>
          <option value="all">All intent</option>
          <option value="hot">🔥 Hot leads</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="all">All platforms</option>
          <option value="youtube">YouTube</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <input
          placeholder="Search comments…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" type="submit">
          Search
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}
      {notice && (
        <div className="panel" style={{ marginBottom: '1rem', background: '#eef8d4' }}>
          {notice}
        </div>
      )}
      {loading && <p className="prob">Loading comments…</p>}

      <div className="comment-list">
        {!loading && comments.length === 0 && (
          <div className="panel">
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              No comments yet. Connect Instagram, YouTube, or Facebook, or run <code>npm run seed</code> for
              demo data.
            </p>
          </div>
        )}

        {comments.map((c) => (
          <article
            className={`comment-item${c.leadTemperature === 'hot' ? ' comment-hot' : ''}`}
            key={c._id}
          >
            <div className="comment-top">
              <div>
                <div className="comment-meta">
                  <span className={`pill ${c.category}`}>{formatCategory(c.category)}</span>
                  <TempPill temp={c.leadTemperature} />
                  <span className="pill">{c.platform}</span>
                  {c.isVip && <span className="pill">VIP</span>}
                  {c.isViral && <span className="pill">Viral</span>}
                  {c.autoDmStatus === 'queued' && <span className="pill">Auto DM queued</span>}
                  {c.autoDmStatus === 'sent' && <span className="pill">Auto DM sent</span>}
                  <span className="prob">
                    {c.author} {c.authorHandle && `· ${c.authorHandle}`}
                  </span>
                </div>
                <p className="comment-text">{c.text}</p>
                <p className="prob">
                  {c.postTitle && <>On “{c.postTitle}” · </>}
                  <b>{c.purchaseProbability}%</b> purchase intent
                  {c.expectedOrderValue > 0 && (
                    <>
                      {' '}
                      · expected <b>{formatMoney(c.expectedOrderValue, currency)}</b>
                    </>
                  )}
                  {' · '}
                  {c.likes} likes · {c.replies} replies · {c.sentiment}
                  {c.competitorName ? ` · vs ${c.competitorName}` : ''}
                  {c.featureTheme ? ` · ${c.featureTheme}` : ''}
                </p>
              </div>
              <select
                value={c.status}
                onChange={(e) => {
                  const status = e.target.value;
                  if (status === 'converted') {
                    updateComment(c._id, {
                      status,
                      revenueAttributed: c.expectedOrderValue || user?.avgOrderValue || 2499,
                    });
                  } else {
                    updateComment(c._id, { status });
                  }
                }}
              >
                <option value="new">New</option>
                <option value="reviewed">Reviewed</option>
                <option value="replied">Replied</option>
                <option value="sent_to_sales">Sent to sales</option>
                <option value="converted">Converted</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>

            {(c.suggestedReply || c.category === 'sales_opportunity') && (
              <div className="reply-box">
                {c.suggestedReply && (
                  <label>
                    Suggested reply
                    <textarea
                      value={c.suggestedReply}
                      onChange={(e) =>
                        setComments((prev) =>
                          prev.map((x) =>
                            x._id === c._id ? { ...x, suggestedReply: e.target.value } : x
                          )
                        )
                      }
                    />
                  </label>
                )}
                {c.autoDmPreview && (
                  <div className="auto-dm-preview">
                    <strong>Auto DM preview</strong>
                    <pre>{c.autoDmPreview}</pre>
                  </div>
                )}
                <div className="reply-actions">
                  {c.suggestedReply && (
                    <button
                      type="button"
                      className="btn btn-citrus btn-sm"
                      onClick={() =>
                        updateComment(c._id, {
                          suggestedReply: c.suggestedReply,
                          status: 'replied',
                        })
                      }
                    >
                      Approve & mark replied
                    </button>
                  )}
                  {(c.leadTemperature === 'hot' ||
                    c.leadTemperature === 'warm' ||
                    c.category === 'sales_opportunity') && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busyId === c._id}
                      onClick={() => sendToSales(c._id)}
                    >
                      Send to sales
                    </button>
                  )}
                  {c.category === 'sales_opportunity' && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busyId === c._id}
                      onClick={() => queueAutoDm(c._id, false)}
                    >
                      Queue Auto DM
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busyId === c._id}
                    onClick={() => regenerate(c._id)}
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
