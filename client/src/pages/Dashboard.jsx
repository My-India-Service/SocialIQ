import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadFile } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatDateTime, timeAgo } from '../utils/time';

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

const PLATFORM_LABELS = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  tiktok: 'TikTok',
  x: 'X',
};

const STATUS_LABELS = {
  new: 'New',
  reviewed: 'Reviewed',
  replied: 'Replied',
  sent_to_sales: 'Sent to sales',
  converted: 'Converted',
  ignored: 'Ignored',
};

const POST_REPLY_PLATFORMS = ['youtube', 'facebook', 'instagram', 'linkedin'];

function isAlreadyPosted(comment) {
  return Boolean(comment?.postedReplyAt || comment?.platformReplyId);
}

function formatCategory(c) {
  return CATEGORY_LABELS[c] || c;
}

function formatPlatform(p) {
  return PLATFORM_LABELS[p] || p;
}

const PLATFORM_EMPTY_HINTS = {
  instagram:
    'No Instagram comments yet. Connect → Sync comments. In Meta Development mode, only comments from app Admin/Developer/Tester accounts may appear until App Review.',
  whatsapp:
    'No WhatsApp messages yet. Enable inbox in Settings, then send a text message to your business WhatsApp number (Test send only sends outbound alerts — it does not fill the inbox).',
  youtube: 'No YouTube comments yet. Connect YouTube on Connect, then Sync comments.',
  facebook: 'No Facebook comments yet. Connect your Page on Connect, then Sync comments.',
  linkedin: 'No LinkedIn comments yet. Connect a Company Page on Connect, then Sync comments.',
  tiktok: 'No TikTok comments yet. Connect TikTok on Connect, then Sync comments.',
};

function formatMoney(n, currency = 'INR') {
  if (currency === 'INR') return `₹${Number(n || 0).toLocaleString('en-IN')}`;
  return `${currency} ${Number(n || 0).toLocaleString()}`;
}

function TempPill({ temp }) {
  if (!temp || temp === 'none') return null;
  const label = temp === 'hot' ? 'Hot lead' : temp === 'warm' ? 'Warm' : 'Cold';
  return <span className={`pill temp-${temp}`}>{label}</span>;
}

export default function Dashboard() {
  const { token, user } = useAuth();
  const whatsappEnabled = Boolean(user?.features?.whatsapp);
  const [comments, setComments] = useState([]);
  const [stats, setStats] = useState(null);
  const [category, setCategory] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [temperature, setTemperature] = useState('all');
  const [status, setStatus] = useState('all');
  const [range, setRange] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [postingId, setPostingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const currency = user?.currency || 'INR';

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        category,
        platform,
        q,
        temperature,
        status,
        range,
        from: fromDate,
        to: toDate,
      });
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
  }, [token, category, platform, temperature, status, range, fromDate, toDate]);

  async function search(e) {
    e.preventDefault();
    await load();
  }

  function applyStatFilter(kind) {
    setQ('');
    if (kind === 'all') {
      setCategory('all');
      setTemperature('all');
      setStatus('all');
      setPlatform('all');
      setRange('all');
      setFromDate('');
      setToDate('');
      return;
    }
    if (kind === 'hot') {
      setCategory('all');
      setTemperature('hot');
      setStatus('all');
      return;
    }
    if (kind === 'sales') {
      setCategory('sales_opportunity');
      setTemperature('all');
      setStatus('all');
      return;
    }
    if (kind === 'complaint') {
      setCategory('complaint');
      setTemperature('all');
      setStatus('all');
      return;
    }
    if (kind === 'new') {
      setCategory('all');
      setTemperature('all');
      setStatus('new');
    }
  }

  async function refreshStats() {
    try {
      const statsData = await api('/api/comments/stats', { token });
      setStats(statsData.stats);
    } catch {
      /* stats refresh is best-effort */
    }
  }

  async function updateComment(id, patch, { successMessage } = {}) {
    setSavingId(id);
    setError('');
    setNotice('');
    try {
      const data = await api(`/api/comments/${id}`, {
        method: 'PATCH',
        token,
        body: patch,
      });
      setComments((prev) => prev.map((c) => (c._id === id ? data.comment : c)));
      if (successMessage) {
        setNotice(successMessage);
      } else if (patch.status) {
        setNotice(`Status updated to ${STATUS_LABELS[patch.status] || patch.status}`);
      }
      await refreshStats();
      return data.comment;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setSavingId(null);
    }
  }

  async function copyReply(id, text) {
    const reply = String(text || '').trim();
    if (!reply) return;
    setError('');
    try {
      await navigator.clipboard.writeText(reply);
      setCopiedId(id);
      setNotice('Reply copied — paste on the platform, or use Post reply for YouTube/Facebook/Instagram');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError('Could not copy to clipboard');
    }
  }

  async function postReply(id, message) {
    setPostingId(id);
    setError('');
    setNotice('');
    try {
      const data = await api(`/api/comments/${id}/post-reply`, {
        method: 'POST',
        token,
        body: { message },
      });
      setComments((prev) => prev.map((c) => (c._id === id ? data.comment : c)));
      setNotice('Reply posted on platform & marked done');
      await refreshStats();
    } catch (err) {
      setError(err.message || 'Post failed');
    } finally {
      setPostingId(null);
    }
  }

  async function regenerate(id) {
    setBusyId(id);
    setRegeneratingId(id);
    setNotice('');
    setError('');
    try {
      const data = await api(`/api/comments/${id}/regenerate-reply`, {
        method: 'POST',
        token,
      });
      setComments((prev) => prev.map((c) => (c._id === id ? data.comment : c)));
      setNotice('Suggested reply updated');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
      setRegeneratingId(null);
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

  async function exportCsv(scope = 'leads') {
    setExporting(true);
    setError('');
    setNotice('');
    try {
      const params = new URLSearchParams({
        category,
        platform,
        q,
        temperature,
        status,
        range,
        from: fromDate,
        to: toDate,
        scope,
      });
      const result = await downloadFile(`/api/comments/export.csv?${params}`, {
        token,
        fallbackFilename: scope === 'all' ? 'voxa-comments.csv' : 'voxa-leads.csv',
      });
      if (scope === 'leads' && result.exportCount === 0) {
        setNotice(
          'No sales leads in this filter — try Sales / Hot, or Export all comments'
        );
      } else if (scope === 'leads') {
        setNotice(
          `Downloaded ${result.exportCount} sales leads CSV — opens in Excel or Google Sheets`
        );
      } else {
        setNotice(
          `Downloaded ${result.exportCount ?? 0} comments CSV — opens in Excel or Google Sheets`
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  const filtersActive =
    category !== 'all' ||
    platform !== 'all' ||
    temperature !== 'all' ||
    status !== 'all' ||
    range !== 'all' ||
    q;

  const postedTimes = comments
    .map((c) => (c.postedAt ? new Date(c.postedAt).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  const oldestPosted = postedTimes.length ? Math.min(...postedTimes) : null;
  const newestPosted = postedTimes.length ? Math.max(...postedTimes) : null;

  const platformFilterCount =
    platform !== 'all' && stats?.byPlatform ? stats.byPlatform[platform] ?? 0 : null;

  const emptyStateHint =
    platform !== 'all' && PLATFORM_EMPTY_HINTS[platform]
      ? PLATFORM_EMPTY_HINTS[platform]
      : filtersActive
        ? 'Try clearing filters, or sync more comments from Connect.'
        : whatsappEnabled
          ? 'Connect Facebook, Instagram, YouTube, or enable WhatsApp in Settings — then sync.'
          : 'Connect Facebook, Instagram, or YouTube — then sync.';

  return (
    <div className="inbox-page">
      <div className="page-head">
        <div>
          <h1>Revenue inbox</h1>
          <p>Buying intent, expected order value, and brand-tone replies — comments into revenue.</p>
        </div>
        <div className="page-head-actions">
          {!loading && (
            <span className="page-head-meta">
              {comments.length} shown
              {platformFilterCount != null
                ? ` · ${platformFilterCount} ${formatPlatform(platform)} · ${stats?.total ?? 0} total`
                : stats?.total != null
                  ? ` · ${stats.total} total`
                  : ''}
            </span>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={exporting || loading}
            onClick={() => exportCsv('leads')}
          >
            {exporting ? 'Exporting…' : 'Export leads CSV'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={exporting || loading}
            onClick={() => exportCsv('all')}
          >
            Export all comments
          </button>
        </div>
      </div>

      {stats && (
        <div className="stat-row">
          <button
            type="button"
            className={`stat ${category === 'all' && temperature === 'all' && status === 'all' ? 'stat-active' : ''}`}
            onClick={() => applyStatFilter('all')}
          >
            <strong>{stats.total}</strong>
            <span>Comments</span>
          </button>
          <button
            type="button"
            className={`stat ${temperature === 'hot' ? 'stat-active' : ''}`}
            onClick={() => applyStatFilter('hot')}
          >
            <strong>{stats.hot}</strong>
            <span>Hot leads</span>
          </button>
          <button
            type="button"
            className={`stat ${category === 'sales_opportunity' ? 'stat-active' : ''}`}
            onClick={() => applyStatFilter('sales')}
          >
            <strong>{stats.sales_opportunity}</strong>
            <span>Sales opportunities</span>
          </button>
          <div className="stat stat-emphasis">
            <strong>{formatMoney(stats.pipelineValue, currency)}</strong>
            <span>Pipeline value</span>
          </div>
          <button
            type="button"
            className={`stat ${category === 'complaint' ? 'stat-active' : ''}`}
            onClick={() => applyStatFilter('complaint')}
          >
            <strong>{stats.complaint}</strong>
            <span>Complaints</span>
          </button>
          <button
            type="button"
            className={`stat ${status === 'new' ? 'stat-active' : ''}`}
            onClick={() => applyStatFilter('new')}
          >
            <strong>{stats.new}</strong>
            <span>Needs review</span>
          </button>
        </div>
      )}

      <form className="toolbar" onSubmit={search}>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
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
        <select
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
          aria-label="Intent"
        >
          <option value="all">All intent</option>
          <option value="hot">Hot leads</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform">
          <option value="all">All platforms</option>
          <option value="youtube">YouTube</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="linkedin">LinkedIn</option>
          <option value="tiktok">TikTok</option>
          {whatsappEnabled && <option value="whatsapp">WhatsApp</option>}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="replied">Replied</option>
          <option value="sent_to_sales">Sent to sales</option>
          <option value="converted">Converted</option>
          <option value="ignored">Ignored</option>
        </select>
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Posted">
          <option value="all">Any time</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="custom">Custom range…</option>
        </select>
        {range === 'custom' && (
          <>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="Posted from"
              title="Posted from"
            />
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="Posted to"
              title="Posted to"
            />
          </>
        )}
        <input
          placeholder="Search comments…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search"
        />
        <button className="btn btn-primary btn-sm" type="submit">
          Search
        </button>
        {filtersActive && (
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => {
              setCategory('all');
              setPlatform('all');
              setTemperature('all');
              setStatus('all');
              setRange('all');
              setFromDate('');
              setToDate('');
              setQ('');
            }}
          >
            Clear
          </button>
        )}
      </form>

      {error && (
        <div className="error-banner">
          <div>{error}</div>
          {(error.includes('Connect') || error.includes('connect') || error.includes('Reconnect')) && (
            <p className="prob" style={{ margin: '0.5rem 0 0' }}>
              <Link to="/app/connections">Open Connect →</Link>
            </p>
          )}
        </div>
      )}
      {notice && <div className="success-banner">{notice}</div>}

      {loading && (
        <div className="comment-list" aria-busy="true">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      )}

      {!loading && oldestPosted != null && (
        <p className="inbox-range-summary">
          Showing {comments.length} {comments.length === 1 ? 'comment' : 'comments'}{' '}
          {oldestPosted === newestPosted ? (
            <>posted {formatDateTime(oldestPosted)}</>
          ) : (
            <>
              posted between <b>{formatDateTime(oldestPosted)}</b> and{' '}
              <b>{formatDateTime(newestPosted)}</b>
            </>
          )}
        </p>
      )}

      <div className="comment-list">
        {!loading && comments.length === 0 && (
          <div className="empty-state">
            <h2>{filtersActive ? 'No matches' : 'Inbox is empty'}</h2>
            <p>{emptyStateHint}</p>
            <div className="reply-actions">
              <Link className="btn btn-citrus btn-sm" to="/app/connections">
                Open Connect
              </Link>
              {whatsappEnabled && (platform === 'whatsapp' || platform === 'all') && (
                <Link className="btn btn-ghost btn-sm" to="/app/settings">
                  WhatsApp settings
                </Link>
              )}
            </div>
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
                  <span className={`pill platform-${c.platform}`}>{formatPlatform(c.platform)}</span>
                  {c.isVip && <span className="pill">VIP</span>}
                  {c.isViral && <span className="pill">Viral</span>}
                  {c.autoDmStatus === 'queued' && <span className="pill">Auto DM queued</span>}
                  {c.autoDmStatus === 'sent' && <span className="pill">Auto DM sent</span>}
                </div>
                <p className="comment-author">
                  {c.author}
                  {c.authorHandle ? <span> · {c.authorHandle}</span> : null}
                  {c.postedAt && (
                    <span className="comment-date" title={formatDateTime(c.postedAt)}>
                      {' '}
                      · {timeAgo(c.postedAt)}
                    </span>
                  )}
                </p>
                <p className="comment-text">{c.text}</p>
                <p className="prob">
                  {c.postedAt && <>Posted {formatDateTime(c.postedAt)} · </>}
                  {c.postTitle && c.platform !== 'whatsapp' && <>On “{c.postTitle}” · </>}
                  {c.platform === 'whatsapp' && <>WhatsApp · </>}
                  <b>{c.purchaseProbability}%</b> purchase intent
                  {c.expectedOrderValue > 0 && (
                    <>
                      {' '}
                      · expected <b>{formatMoney(c.expectedOrderValue, currency)}</b>
                    </>
                  )}
                  {c.platform !== 'whatsapp' && (
                    <>
                      {' · '}
                      {c.likes} likes · {c.replies} replies
                    </>
                  )}
                  {' · '}
                  {c.sentiment}
                  {c.competitorName ? ` · vs ${c.competitorName}` : ''}
                  {c.featureTheme ? ` · ${c.featureTheme}` : ''}
                </p>
              </div>
              <select
                className="comment-status"
                value={c.status}
                aria-label="Voxa team status (does not post to the platform — use Post reply for that)"
                title="Voxa team tracking only — use Post reply & mark done to publish on the platform"
                disabled={savingId === c._id || postingId === c._id}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === 'converted') {
                    updateComment(c._id, {
                      status: next,
                      revenueAttributed: c.expectedOrderValue || user?.avgOrderValue || 2499,
                    });
                  } else {
                    updateComment(c._id, { status: next });
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
                  <>
                    <label>
                      Suggested reply
                      <textarea
                        value={c.suggestedReply}
                        disabled={savingId === c._id}
                        onChange={(e) =>
                          setComments((prev) =>
                            prev.map((x) =>
                              x._id === c._id ? { ...x, suggestedReply: e.target.value } : x
                            )
                          )
                        }
                      />
                      {c.analysisSource === 'rules' ? (
                        <span className="reply-source-hint">
                          Template reply (add OPENAI_API_KEY for AI variations)
                        </span>
                      ) : null}
                    </label>
                    <p className="reply-platform-hint">
                      {POST_REPLY_PLATFORMS.includes(c.platform)
                        ? 'Post reply sends to YouTube/Facebook/Instagram and marks done in Voxa. Or copy & paste manually.'
                        : 'Copy the reply to the platform yourself, then Save without posting in Voxa.'}
                      {c.postedReplyAt
                        ? ` · Posted ${new Date(c.postedReplyAt).toLocaleString()}`
                        : null}
                    </p>
                  </>
                )}
                {c.autoDmPreview && (
                  <div className="auto-dm-preview">
                    <strong>Auto DM preview</strong>
                    <pre>{c.autoDmPreview}</pre>
                  </div>
                )}
                <div className="reply-actions">
                  {c.suggestedReply && POST_REPLY_PLATFORMS.includes(c.platform) && (
                    isAlreadyPosted(c) ? (
                      <span className="pill wa-pill-ready">Posted on platform</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-citrus btn-sm"
                        disabled={postingId === c._id || savingId === c._id}
                        onClick={() => postReply(c._id, c.suggestedReply)}
                      >
                        {postingId === c._id ? 'Posting…' : 'Post reply & mark done'}
                      </button>
                    )
                  )}
                  {c.suggestedReply && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={postingId === c._id || savingId === c._id}
                      onClick={() => copyReply(c._id, c.suggestedReply)}
                    >
                      {copiedId === c._id ? 'Copied' : 'Copy reply'}
                    </button>
                  )}
                  {c.suggestedReply && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={postingId === c._id || savingId === c._id}
                      onClick={() =>
                        updateComment(
                          c._id,
                          {
                            suggestedReply: c.suggestedReply,
                            status: 'replied',
                          },
                          { successMessage: 'Reply saved & marked done (Voxa only)' }
                        )
                      }
                    >
                      {savingId === c._id ? 'Saving…' : 'Save without posting'}
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
                  {c.category === 'sales_opportunity' && c.platform !== 'whatsapp' && (
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
                    {regeneratingId === c._id ? 'Regenerating…' : 'Regenerate'}
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
