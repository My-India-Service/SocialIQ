import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function formatInr(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function CampaignForm({ post, token, onSaved }) {
  const [keywords, setKeywords] = useState((post.keywords || []).join(', '));
  const [publicReplyTemplate, setPublicReplyTemplate] = useState(
    post.publicReplyTemplate || ''
  );
  const [dmLink, setDmLink] = useState(post.dmLink || '');
  const [bookingUrl, setBookingUrl] = useState(post.bookingUrl || '');
  const [whatsappHandoffPhone, setWhatsappHandoffPhone] = useState(post.whatsappHandoffPhone || '');
  const [handoffMessage, setHandoffMessage] = useState(post.handoffMessage || '');
  const [matchMode, setMatchMode] = useState(post.matchMode || 'both');
  const [objective, setObjective] = useState(post.objective || 'sell');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const body = {
        platform: post.platform,
        externalPostId: post.externalPostId || post.postTitle,
        postTitle: post.postTitle,
        objective,
        keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
        publicReplyTemplate,
        dmLink,
        bookingUrl,
        whatsappHandoffPhone,
        handoffMessage,
        matchMode,
      };
      if (post.campaignId) {
        await api(`/api/campaigns/${post.campaignId}`, {
          method: 'PATCH',
          token,
          body,
        });
      } else {
        await api('/api/campaigns', { method: 'POST', token, body });
      }
      setMsg('Trigger saved.');
      onSaved?.();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-stack campaign-form" onSubmit={save}>
      <label>
        Keywords (comma-separated)
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="LINK, INFO, price" />
      </label>
      <label>
        Match mode
        <select value={matchMode} onChange={(e) => setMatchMode(e.target.value)}>
          <option value="both">Keyword or AI intent</option>
          <option value="keyword">Keyword only</option>
          <option value="ai">AI / Hinglish intent only</option>
        </select>
      </label>
      <label>
        Objective
        <select value={objective} onChange={(e) => setObjective(e.target.value)}>
          <option value="sell">Sell product</option>
          <option value="leads">Get leads</option>
          <option value="link">Drive link clicks</option>
          <option value="appointment">Book appointment</option>
        </select>
      </label>
      <label>
        Public reply template (optional override)
        <input
          value={publicReplyTemplate}
          onChange={(e) => setPublicReplyTemplate(e.target.value)}
          placeholder="Sent you the details in DM"
        />
      </label>
      <label>
        DM / Shopify link (sell / link objectives)
        <input value={dmLink} onChange={(e) => setDmLink(e.target.value)} placeholder="https://..." />
      </label>
      <label>
        WhatsApp handoff phone (leads objective)
        <input
          value={whatsappHandoffPhone}
          onChange={(e) => setWhatsappHandoffPhone(e.target.value)}
          placeholder="+91..."
        />
      </label>
      <label>
        Booking URL (appointment objective)
        <input value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} />
      </label>
      <label>
        Handoff message (before link)
        <input
          value={handoffMessage}
          onChange={(e) => setHandoffMessage(e.target.value)}
          placeholder="Great — here is the next step:"
        />
      </label>
      <p className="prob">
        Handoff preview:{' '}
        {objective === 'appointment'
          ? 'Booking link after qualify'
          : objective === 'leads'
            ? 'WhatsApp wa.me link'
            : objective === 'link'
              ? 'DM link / catalogue'
              : 'Shopify / website URL'}
      </p>
      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
        {busy ? 'Saving…' : post.campaignId ? 'Update trigger' : 'Set trigger'}
      </button>
      {msg ? <p className="prob">{msg}</p> : null}
    </form>
  );
}

export default function Insights() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [postKpis, setPostKpis] = useState(null);
  const [error, setError] = useState('');
  const [editingPost, setEditingPost] = useState(null);

  async function load() {
    try {
        const [insightsRes, kpisRes] = await Promise.all([
          api('/api/comments/insights', { token }),
          api('/api/campaigns/kpis', { token }),
        ]);
        setData(insightsRes);
        setPostKpis(kpisRes);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Product & competitor intel</h1>
          <p>
            Feature requests aggregated into roadmap signals — plus what people say about rivals.
          </p>
        </div>
        <Link to="/app/conversations" className="btn btn-ghost btn-sm">
          DM conversations
        </Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {postKpis?.posts?.length ? (
        <section className="panel" style={{ marginBottom: '1.5rem' }}>
          <h2>Post-level sales KPIs & triggers</h2>
          <p className="prob">
            Set keyword triggers per reel (like Delulu) — or rely on Hinglish AI intent. Sync
            comments to run the sales agent.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Platform</th>
                  <th>Comments</th>
                  <th>Buying intent</th>
                  <th>Triggers</th>
                  <th>Pipeline</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {postKpis.posts.slice(0, 12).map((p) => (
                  <tr key={`${p.platform}-${p.externalPostId || p.postTitle}`}>
                    <td>{p.postTitle}</td>
                    <td>{p.platform}</td>
                    <td>{p.commentCount}</td>
                    <td>{p.buyingIntent}</td>
                    <td>
                      {p.keywords?.length ? p.keywords.join(', ') : '—'}
                      {p.triggerCount ? ` (${p.triggerCount} fired)` : ''}
                    </td>
                    <td>{formatInr(p.pipelineValue)}</td>
                    <td>
                      {p.platform === 'instagram' ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setEditingPost(
                              editingPost?.externalPostId === p.externalPostId &&
                                editingPost?.platform === p.platform
                                ? null
                                : p
                            )
                          }
                        >
                          {editingPost?.externalPostId === p.externalPostId &&
                          editingPost?.platform === p.platform
                            ? 'Close'
                            : 'Set trigger'}
                        </button>
                      ) : (
                        <span className="muted">IG only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editingPost ? (
            <div style={{ marginTop: '1rem' }}>
              <h3>Trigger for: {editingPost.postTitle}</h3>
              <CampaignForm
                post={editingPost}
                token={token}
                onSaved={() => {
                  load();
                  setEditingPost(null);
                }}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {data && (
        <div className="insights-grid">
          <section className="panel">
            <h2>Feature requests</h2>
            <p className="prob">
              Instead of 500 raw comments — one product research line per theme.
            </p>
            {data.featureRequests?.length ? (
              <ul className="insight-bars">
                {data.featureRequests.map((f) => (
                  <li key={f.label}>
                    <div className="insight-bar-head">
                      <strong>{f.label}</strong>
                      <span>{f.count} users</span>
                    </div>
                    <div className="insight-bar-track">
                      <div
                        className="insight-bar-fill feature"
                        style={{
                          width: `${Math.min(
                            100,
                            (f.count / Math.max(data.featureRequests[0].count, 1)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    {f.sample && <p className="prob">"{f.sample}"</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="prob">No feature requests detected yet.</p>
            )}
          </section>

          <section className="panel">
            <h2>Competitor intelligence</h2>
            <p className="prob">Switch-aways, comparisons, and brand mentions in comments.</p>
            {data.competitors?.length ? (
              <ul className="insight-bars">
                {data.competitors.map((c) => (
                  <li key={c.name}>
                    <div className="insight-bar-head">
                      <strong>{c.name}</strong>
                      <span>{c.count} mentions</span>
                    </div>
                    <div className="insight-bar-track">
                      <div
                        className="insight-bar-fill competitor"
                        style={{
                          width: `${Math.min(
                            100,
                            (c.count / Math.max(data.competitors[0].count, 1)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    {c.samples?.[0] && <p className="prob">"{c.samples[0]}"</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="prob">No competitor mentions yet.</p>
            )}
          </section>

          <section className="panel">
            <h2>Complaint themes</h2>
            {data.complaintThemes?.length ? (
              <ul className="plain-list">
                {data.complaintThemes.map((t) => (
                  <li key={t.label}>
                    {t.label} — <b>{t.count}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="prob">No complaint themes.</p>
            )}
          </section>

          <section className="panel">
            <h2>Viral comment</h2>
            {data.viral ? (
              <blockquote className="viral-quote">
                "{data.viral.text}"
                <footer>
                  — {data.viral.author} · {data.viral.likes} likes
                </footer>
              </blockquote>
            ) : (
              <p className="prob">No viral comments yet.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
