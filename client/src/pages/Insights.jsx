import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Insights() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await api('/api/comments/insights', { token });
        setData(res);
      } catch (err) {
        setError(err.message);
      }
    }
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
      </div>

      {error && <div className="error-banner">{error}</div>}

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
                    {f.sample && <p className="prob">“{f.sample}”</p>}
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
                    {c.samples?.[0] && <p className="prob">“{c.samples[0]}”</p>}
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
                “{data.viral.text}”
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
