import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { user, loginSuccess } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    brandName: '',
    brandTone: 'friendly',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: form,
      });
      loginSuccess(data);
      navigate('/app');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <Link to="/" className="logo">
          <span className="logo-mark" aria-hidden="true">
            <span />
          </span>
          Voxa
        </Link>
        <h1>Start with Voxa</h1>
        <p>Connect social comments. Capture sales. Catch complaints early.</p>
        {error && <div className="error-banner">{error}</div>}
        <form className="form-stack" onSubmit={onSubmit}>
          <label>
            Your name
            <input value={form.name} onChange={update('name')} required />
          </label>
          <label>
            Work email
            <input type="email" value={form.email} onChange={update('email')} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={update('password')}
              required
              minLength={6}
            />
          </label>
          <label>
            Brand name
            <input value={form.brandName} onChange={update('brandName')} placeholder="NovaWear" />
          </label>
          <label>
            Reply tone
            <select value={form.brandTone} onChange={update('brandTone')}>
              <option value="friendly">Friendly</option>
              <option value="professional">Professional</option>
              <option value="playful">Playful</option>
              <option value="luxury">Luxury</option>
            </select>
          </label>
          <button className="btn btn-citrus" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="muted-link">
          Already have an account? <Link to="/login">Log in</Link>
          <br />
          Or try demo: demo@voxa.app / demo1234
        </p>
        <p className="muted-link">
          <Link to="/about">About</Link>
          {' · '}
          <Link to="/faq">FAQ</Link>
          {' · '}
          <Link to="/privacy">Privacy</Link>
          {' · '}
          <Link to="/terms">Terms</Link>
        </p>
      </div>
    </div>
  );
}
