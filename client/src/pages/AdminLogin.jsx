import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { getAdminToken, setAdminSession } from '../adminSession';
import BrandLogo from '../components/BrandLogo';
import ThemeToggle from '../components/ThemeToggle';
import usePageMeta from '../hooks/usePageMeta';

export default function AdminLogin() {
  usePageMeta({ title: 'Admin log in', noindex: true, path: '/admin/login' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(() => Boolean(getAdminToken()));

  if (signedIn) {
    return <Navigate to="/admin" replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/admin/login', {
        method: 'POST',
        body: { email, password },
      });
      setAdminSession(data.token, data.admin?.email);
      setSignedIn(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <ThemeToggle className="theme-toggle--auth" />
      <div className="auth-panel">
        <Link to="/" className="logo">
          <BrandLogo />
        </Link>
        <p className="admin-login-kicker">Platform admin</p>
        <h1>Admin log in</h1>
        <p>Sign in with the email and password from the server settings. Customer accounts stay on the regular log in.</p>
        {error ? <div className="error-banner">{error}</div> : null}
        <form className="form-stack" onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label>
            Password
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
          <Link to="/">Back to website</Link>
          {' · '}
          <Link to="/login">Customer log in</Link>
        </p>
      </div>
    </div>
  );
}
