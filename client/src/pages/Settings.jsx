import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { token, user, setUser } = useAuth();
  const [brandName, setBrandName] = useState(user?.brandName || '');
  const [brandTone, setBrandTone] = useState(user?.brandTone || 'friendly');
  const [sample, setSample] = useState('Love this product.');
  const [analysis, setAnalysis] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    try {
      const data = await api('/api/auth/brand', {
        method: 'PATCH',
        token,
        body: { brandName, brandTone },
      });
      setUser(data.user);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function tryAnalyze(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await api('/api/comments/analyze', {
        method: 'POST',
        token,
        body: { text: sample },
      });
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Brand tone</h1>
          <p>Replies learn your voice — friendly, professional, playful, or luxury.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {saved && (
        <div className="panel" style={{ marginBottom: '1rem', background: '#eef8d4' }}>
          Brand settings saved.
        </div>
      )}

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h2>Settings</h2>
        <form className="form-stack" onSubmit={save}>
          <label>
            Brand name
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} required />
          </label>
          <label>
            Default reply tone
            <select value={brandTone} onChange={(e) => setBrandTone(e.target.value)}>
              <option value="friendly">Friendly — warm & human</option>
              <option value="professional">Professional — clear & formal</option>
              <option value="playful">Playful — witty & casual</option>
              <option value="luxury">Luxury — refined & calm</option>
            </select>
          </label>
          <button className="btn btn-citrus" type="submit">
            Save
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>Try intent analysis</h2>
        <form className="form-stack" onSubmit={tryAnalyze}>
          <label>
            Sample comment
            <textarea value={sample} onChange={(e) => setSample(e.target.value)} />
          </label>
          <button className="btn btn-primary" type="submit">
            Analyze
          </button>
        </form>
        {analysis && (
          <div style={{ marginTop: '1rem' }}>
            <p>
              <span className={`pill ${analysis.category}`}>{analysis.category}</span>{' '}
              <span className="prob">
                {analysis.purchaseProbability}% buy intent · {analysis.sentiment}
              </span>
            </p>
            <div className="reply-box">
              <strong>Suggested reply</strong>
              <p style={{ margin: 0 }}>{analysis.suggestedReply || '—'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
