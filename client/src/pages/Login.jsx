import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, loginSuccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('demo@voxa.app');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');
  const [success] = useState(
    location.state?.resetSuccess ? 'Password updated. You can log in now.' : ''
  );
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: { email, password },
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
        <h1>Welcome back</h1>
        <p>Log in to your revenue intelligence dashboard.</p>
        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">{success}</div>}
        <form className="form-stack" onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            <span className="label-row">
              Password
              <Link to="/forgot-password" className="forgot-link">
                Forgot password?
              </Link>
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button className="btn btn-citrus" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="muted-link">
          New here? <Link to="/register">Create an account</Link>
        </p>
        <p className="muted-link">
          <Link to="/about">About</Link>
          {' · '}
          <Link to="/faq">FAQ</Link>
          {' · '}
          <Link to="/pricing">Pricing</Link>
          {' · '}
          <Link to="/privacy">Privacy</Link>
          {' · '}
          <Link to="/terms">Terms</Link>
        </p>
      </div>
    </div>
  );
}
