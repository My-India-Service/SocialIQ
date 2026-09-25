import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

/** Auto-FAQ editor + competitor share of voice + revenue-based content ideas for Insights. */
export default function GrowthIntel({ token, period }) {
  const [faq, setFaq] = useState([]);
  const [faqMeta, setFaqMeta] = useState(null);
  const [sov, setSov] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    Promise.all([
      api(`/api/intel/faq?period=${period}`, { token }),
      api(`/api/intel/share-of-voice?period=${period}`, { token }),
      api(`/api/posts?period=${period}`, { token }),
    ])
      .then(([faqRes, sovRes, postsRes]) => {
        if (cancelled) return;
        setFaq(faqRes.suggestions || []);
        setFaqMeta(faqRes);
        setSov(sovRes);
        setIdeas(postsRes.contentIdeas || []);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [token, period]);

  function patchFaq(intent, patch) {
    setFaq((list) => list.map((f) => (f.intent === intent ? { ...f, ...patch } : f)));
  }

  async function saveFaq() {
    setSaving(true);
    setError('');
    setSaved('');
    try {
      const res = await api('/api/intel/faq', {
        method: 'PUT',
        token,
        body: {
          faq: faq
            .filter((f) => f.answer.trim())
            .map((f) => ({ intent: f.intent, answer: f.answer, enabled: f.enabled })),
        },
      });
      setFaq((list) =>
        list.map((f) => ({ ...f, needsAnswer: f.count > 0 && !f.answer.trim() }))
      );
      setSaved(res.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const maxSov = Math.max(...(sov?.competitors || []).map((c) => c.count), 1);

  return (
    <>
      {error && <div className="error-banner">{error}</div>}

      {ideas.length > 0 && (
        <section className="panel growth-section">
          <div className="insights-panel-head">
            <div>
              <h2>Content ideas from revenue</h2>
              <p className="prob">Make more of what sells — and fix what’s hurting you.</p>
            </div>
            <Link to="/app/posts" className="btn btn-ghost btn-sm">
              All posts
            </Link>
          </div>
          <div className="content-ideas">
            {ideas.map((idea) => (
              <article key={`${idea.type}-${idea.key}`} className={`content-idea content-idea-${idea.type}`}>
                <p className="content-idea-kicker">{idea.type === 'fix' ? 'Fix this' : 'Repeat this'}</p>
                <h3>{idea.title}</h3>
                <p className="content-idea-why">{idea.why}</p>
                {idea.suggestion && <p className="content-idea-tip">{idea.suggestion}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="panel growth-section">
        <div className="insights-panel-head">
          <div>
            <h2>Auto-FAQ</h2>
            <p className="prob">
              Questions customers keep asking. Save an answer once — the AI uses it in every reply.
              {faqMeta?.unanswered > 0 && (
                <strong className="faq-unanswered"> {faqMeta.unanswered} need an answer.</strong>
              )}
            </p>
          </div>
          <button type="button" className="btn btn-citrus btn-sm" onClick={saveFaq} disabled={saving}>
            {saving ? 'Saving…' : 'Save answers'}
          </button>
        </div>
        {saved && <div className="success-banner">{saved}</div>}
        {faq.length === 0 ? (
          <p className="prob">No recurring questions yet — they appear as comments come in.</p>
        ) : (
          <ul className="faq-list">
            {faq.map((f) => (
              <li key={f.intent} className={`faq-item${f.needsAnswer ? ' needs-answer' : ''}`}>
                <div className="faq-item-head">
                  <strong>{f.question}</strong>
                  <span className="pill">{f.count}× asked</span>
                  <label className="mod-check faq-toggle">
                    <input
                      type="checkbox"
                      checked={f.enabled}
                      onChange={(e) => patchFaq(f.intent, { enabled: e.target.checked })}
                    />
                    Use in replies
                  </label>
                </div>
                {f.samples?.[0] && <p className="prob">e.g. “{f.samples[0]}”</p>}
                <textarea
                  rows={2}
                  value={f.answer}
                  onChange={(e) => patchFaq(f.intent, { answer: e.target.value })}
                  placeholder="Your brand-approved answer…"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {sov && (
        <section className="panel growth-section">
          <h2>Competitor share of voice</h2>
          <p className="prob">
            {sov.competitorShare}% of comments on your posts mention a competitor (
            {sov.competitorMentions} of {sov.totalComments}).
          </p>
          {sov.pricingAlert?.active && (
            <div className="error-banner sov-alert">
              💸 Pricing alert: {sov.pricingAlert.message}
            </div>
          )}
          <div className="sov-layout">
            <div>
              {sov.competitors.length ? (
                <ul className="insight-bars">
                  {sov.competitors.map((c) => (
                    <li key={c.name}>
                      <div className="insight-bar-head">
                        <strong>{c.name}</strong>
                        <span>
                          {c.count} · {c.share}%
                          {c.cheaperSignals > 0 && ` · ${c.cheaperSignals} “cheaper”`}
                        </span>
                      </div>
                      <div className="insight-bar-track">
                        <div
                          className="insight-bar-fill competitor"
                          style={{ width: `${(c.count / maxSov) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="prob">No competitor mentions in this period. 🎉</p>
              )}
            </div>
            <div className="sov-weekly" aria-label="Weekly competitor share">
              {sov.weekly.map((w) => (
                <div key={w.weekEnding} className="sov-week" title={`Week ending ${w.weekEnding}`}>
                  <span className="sov-week-bar" style={{ height: `${Math.max(4, Math.min(100, w.share * 4))}%` }} />
                  <small>{w.share}%</small>
                  <small className="sov-week-label">{w.weekEnding.slice(5)}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
