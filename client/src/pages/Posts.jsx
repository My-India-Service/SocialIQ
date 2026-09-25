import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function money(n, currency = 'INR') {
  if (currency === 'INR') return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
  return `${currency} ${Math.round(n || 0).toLocaleString()}`;
}

function SentimentBar({ sentiment }) {
  const total = (sentiment.positive || 0) + (sentiment.neutral || 0) + (sentiment.negative || 0) || 1;
  const pct = (n) => `${((n || 0) / total) * 100}%`;
  return (
    <div className="post-sentiment-bar" aria-label="Sentiment split">
      <span className="seg-pos" style={{ width: pct(sentiment.positive) }} />
      <span className="seg-neu" style={{ width: pct(sentiment.neutral) }} />
      <span className="seg-neg" style={{ width: pct(sentiment.negative) }} />
    </div>
  );
}

export default function Posts() {
  const { token } = useAuth();
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api(`/api/posts?period=${period}`, { token })
      .then((d) => {
        setData(d);
        if (!d.posts?.some((p) => p.key === selectedKey)) setSelectedKey(d.posts?.[0]?.key || null);
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, period]);

  const selected = data?.posts?.find((p) => p.key === selectedKey);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    const q = new URLSearchParams({
      platform: selected.platform,
      postId: selected.postId,
      period: String(period),
    });
    api(`/api/posts/detail?${q}`, { token })
      .then(setDetail)
      .catch((err) => setError(err.message));
  }, [selected?.key, period, token]);

  const currency = data?.currency || 'INR';

  return (
    <div className="posts-page">
      <div className="page-head">
        <div>
          <h1>Posts</h1>
          <p>Which posts make money — sentiment, buyer intent, complaints, and revenue per post.</p>
        </div>
        <div className="seg-toggle" role="tablist" aria-label="Period">
          {[7, 30, 90].map((p) => (
            <button
              key={p}
              type="button"
              className={period === p ? 'is-active' : ''}
              onClick={() => setPeriod(p)}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {data?.contentIdeas?.length > 0 && (
        <section className="content-ideas">
          {data.contentIdeas.map((idea) => (
            <button
              key={`${idea.type}-${idea.key}`}
              type="button"
              className={`content-idea content-idea-${idea.type}`}
              onClick={() => setSelectedKey(idea.key)}
            >
              <span className="content-idea-kicker">
                {idea.type === 'fix' ? 'Fix this' : 'Make more like this'}
              </span>
              <strong>{idea.postTitle}</strong>
              <span className="content-idea-why">{idea.why}</span>
              <span className="content-idea-tip">{idea.suggestion}</span>
            </button>
          ))}
        </section>
      )}

      <div className="posts-layout">
        <section className="panel posts-table-panel">
          {!data ? (
            <p className="prob">Loading…</p>
          ) : data.posts.length === 0 ? (
            <p className="prob">No comments in this period. Sync from Connect to see post analytics.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table posts-table">
                <thead>
                  <tr>
                    <th>Post</th>
                    <th>Comments</th>
                    <th>Sentiment</th>
                    <th>Leads</th>
                    <th>Complaints</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.posts.map((p) => (
                    <tr
                      key={p.key}
                      className={p.key === selectedKey ? 'is-selected' : ''}
                      onClick={() => setSelectedKey(p.key)}
                    >
                      <td>
                        <span className={`pill platform-${p.platform}`}>{p.platform}</span>
                        <span className="posts-title">{p.postTitle || p.postId}</span>
                        {p.campaign?.active && <span className="pill">Trigger on</span>}
                      </td>
                      <td>{p.total}</td>
                      <td>
                        <SentimentBar sentiment={p.sentiment} />
                      </td>
                      <td>
                        {p.leads}
                        {p.hot > 0 && <span className="posts-hot"> · {p.hot} hot</span>}
                      </td>
                      <td>{p.complaints}</td>
                      <td>
                        <strong>{money(p.revenue, currency)}</strong>
                        <div className="prob">{money(p.pipeline, currency)} pipeline</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="panel post-detail">
          {!selected ? (
            <p className="prob">Select a post.</p>
          ) : (
            <>
              <span className={`pill platform-${selected.platform}`}>{selected.platform}</span>
              <h2>{selected.postTitle || selected.postId}</h2>
              <div className="post-kpis">
                <div>
                  <span>Revenue</span>
                  <strong>{money(selected.revenue, currency)}</strong>
                </div>
                <div>
                  <span>Pipeline</span>
                  <strong>{money(selected.pipeline, currency)}</strong>
                </div>
                <div>
                  <span>Buyer intent</span>
                  <strong>{selected.buyerIntentRate}%</strong>
                </div>
                <div>
                  <span>Sentiment</span>
                  <strong>{selected.sentimentScore}/100</strong>
                </div>
                <div>
                  <span>Unanswered buyers</span>
                  <strong>{selected.unanswered}</strong>
                </div>
                <div>
                  <span>Complaint rate</span>
                  <strong>{selected.complaintRate}%</strong>
                </div>
              </div>
              <SentimentBar sentiment={selected.sentiment} />
              <p className="prob">
                😊 {selected.sentiment.positive} · 😐 {selected.sentiment.neutral} · 😡{' '}
                {selected.sentiment.negative}
              </p>
              {selected.topTopics.length > 0 && (
                <>
                  <h3>Top topics</h3>
                  <div className="post-topics">
                    {selected.topTopics.map((t) => (
                      <span key={t.label} className="pill">
                        {t.label} · {t.count}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <h3>Latest comments</h3>
              <ul className="post-comments">
                {(detail?.comments || []).slice(0, 15).map((c) => (
                  <li key={c.id}>
                    <div className="post-comment-top">
                      <strong>{c.authorHandle ? `@${c.authorHandle.replace(/^@/, '')}` : c.author}</strong>
                      <span className={`pill ${c.category}`}>{c.category.replace(/_/g, ' ')}</span>
                    </div>
                    <p>{c.text}</p>
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
