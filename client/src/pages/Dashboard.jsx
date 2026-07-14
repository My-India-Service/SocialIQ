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

export default function Dashboard() {
  const { token } = useAuth();
  const [comments, setComments] = useState([]);
  const [stats, setStats] = useState(null);
  const [category, setCategory] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ category, platform, q });
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
  }, [token, category, platform]);

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
    const data = await api(`/api/comments/${id}/regenerate-reply`, {
      method: 'POST',
      token,
    });
    setComments((prev) => prev.map((c) => (c._id === id ? data.comment : c)));
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Comment inbox</h1>
          <p>AI-categorized sales leads, complaints, and feedback across connected channels.</p>
        </div>
      </div>

      {stats && (
        <div className="stat-row">
          <div className="stat">
            <strong>{stats.total}</strong>
            <span>Comments</span>
          </div>
          <div className="stat">
            <strong>{stats.sales_opportunity}</strong>
            <span>Sales opportunities</span>
          </div>
          <div className="stat">
            <strong>{stats.complaint}</strong>
            <span>Complaints</span>
          </div>
          <div className="stat">
            <strong>{stats.feature_request}</strong>
            <span>Feature requests</span>
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
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="all">All platforms</option>
          <option value="youtube">YouTube</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
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
      {loading && <p className="prob">Loading comments…</p>}

      <div className="comment-list">
        {!loading && comments.length === 0 && (
          <div className="panel">
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              No comments yet. Connect a channel or run <code>npm run seed</code> for demo data.
            </p>
          </div>
        )}

        {comments.map((c) => (
          <article className="comment-item" key={c._id}>
            <div className="comment-top">
              <div>
                <div className="comment-meta">
                  <span className={`pill ${c.category}`}>{formatCategory(c.category)}</span>
                  <span className="pill">{c.platform}</span>
                  {c.isVip && <span className="pill">VIP</span>}
                  {c.isViral && <span className="pill">Viral</span>}
                  <span className="prob">
                    {c.author} {c.authorHandle && `· ${c.authorHandle}`}
                  </span>
                </div>
                <p className="comment-text">{c.text}</p>
                <p className="prob">
                  {c.postTitle && <>On “{c.postTitle}” · </>}
                      <b>{c.purchaseProbability}%</b> purchase probability · {c.likes} likes ·{' '}
                      {c.replies} replies · {c.sentiment}
                      {c.analysisSource ? ` · ${c.analysisSource}` : ''}
                    </p>
              </div>
              <select
                value={c.status}
                onChange={(e) => updateComment(c._id, { status: e.target.value })}
              >
                <option value="new">New</option>
                <option value="reviewed">Reviewed</option>
                <option value="replied">Replied</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>

            {c.suggestedReply && (
              <div className="reply-box">
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
                <div className="reply-actions">
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
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
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
