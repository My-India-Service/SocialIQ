import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const TONE_OPTIONS = [
  { id: 'professional', label: 'Professional', desc: 'Clear, polished, business-ready' },
  { id: 'friendly', label: 'Friendly', desc: 'Warm, approachable, conversational' },
  { id: 'casual', label: 'Casual', desc: 'Fun, energetic, Gen-Z friendly' },
  { id: 'luxury', label: 'Luxury', desc: 'Refined, premium, understated' },
  { id: 'funny', label: 'Funny', desc: 'Light humour without being rude' },
];

function linesToText(list) {
  return (list || []).join('\n');
}

function textToLines(text) {
  return String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function AiSetup() {
  const { user, token, setUser } = useAuth();
  const [brandName, setBrandName] = useState(user?.brandName || '');
  const [brandDescription, setBrandDescription] = useState(user?.brandDescription || '');
  const [brandTone, setBrandTone] = useState(user?.brandTone || 'friendly');
  const [neverSay, setNeverSay] = useState(linesToText(user?.aiProfile?.neverSay));
  const [alwaysMention, setAlwaysMention] = useState(linesToText(user?.aiProfile?.alwaysMention));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (!user) return;
    setBrandName(user.brandName || '');
    setBrandDescription(user.brandDescription || '');
    setBrandTone(user.brandTone || 'friendly');
    setNeverSay(linesToText(user.aiProfile?.neverSay));
    setAlwaysMention(linesToText(user.aiProfile?.alwaysMention));
  }, [user]);

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaved('');
    setSaving(true);
    try {
      const data = await api('/api/auth/brand', {
        method: 'PATCH',
        token,
        body: {
          brandName: brandName.trim() || 'My Brand',
          brandDescription: brandDescription.trim(),
          brandTone,
          aiProfile: {
            neverSay: textToLines(neverSay),
            alwaysMention: textToLines(alwaysMention),
          },
        },
      });
      setUser(data.user);
      setSaved('AI profile saved — replies will use these rules.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ai-setup-page">
      <div className="page-head">
        <div>
          <h1>AI Setup</h1>
          <p>Teach your AI about your business — this is where replies become differentiated.</p>
        </div>
        <Link to="/app/settings" className="btn btn-ghost btn-sm">
          Settings
        </Link>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {saved && <div className="success-banner">{saved}</div>}

      <form className="form-stack ai-setup-form" onSubmit={save}>
        <div className="panel">
          <h2>Teach your AI about your business</h2>

          <label>
            Brand name
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Acme Clothing"
              required
            />
          </label>

          <label>
            Describe your brand
            <textarea
              rows={4}
              value={brandDescription}
              onChange={(e) => setBrandDescription(e.target.value)}
              placeholder="Premium Indian streetwear brand…"
            />
          </label>

          <fieldset className="tone-fieldset">
            <legend>Tone of voice</legend>
            <div className="tone-radio-grid" role="radiogroup" aria-label="Tone of voice">
              {TONE_OPTIONS.map((t) => (
                <label
                  key={t.id}
                  className={`tone-radio-card${brandTone === t.id ? ' is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="brandTone"
                    value={t.id}
                    checked={brandTone === t.id}
                    onChange={() => setBrandTone(t.id)}
                  />
                  <span className="tone-radio-label">{t.label}</span>
                  <span className="tone-radio-desc">{t.desc}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            Never say
            <textarea
              rows={3}
              value={neverSay}
              onChange={(e) => setNeverSay(e.target.value)}
              placeholder={'We don\'t know\nPlease contact support'}
            />
            <span className="field-hint">One phrase per line — the AI will avoid these.</span>
          </label>

          <label>
            Always mention
            <textarea
              rows={3}
              value={alwaysMention}
              onChange={(e) => setAlwaysMention(e.target.value)}
              placeholder={'Free shipping above ₹999\nCOD available'}
            />
            <span className="field-hint">
              One phrase per line — used on sales and shipping replies when relevant.
            </span>
          </label>

          <div className="reply-actions">
            <button type="submit" className="btn btn-citrus" disabled={saving}>
              {saving ? 'Saving…' : 'Save AI Profile'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
