import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { needsEmailVerification, needsOnboarding, postAuthPath } from '../utils/onboarding';
import BrandLogo from '../components/BrandLogo';
import ThemeToggle from '../components/ThemeToggle';
import OtpInput from '../components/OtpInput';
import InstallAppBanner from '../components/InstallAppBanner';

export default function Login() {
  const { user, loginSuccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('password'); // password | otp
  const [otpPhase, setOtpPhase] = useState('email'); // email | code
  const [email, setEmail] = useState('demo@voxa.app');
  const [password, setPassword] = useState('demo1234');
  const [otp, setOtp] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [devHint, setDevHint] = useState('');
  const [error, setError] = useState('');
  const [success] = useState(
    location.state?.resetSuccess ? 'Password updated. You can log in now.' : ''
  );
  const [busy, setBusy] = useState(false);

  if (user && needsEmailVerification(user)) {
    return <Navigate to="/verify-email" replace />;
  }

  if (user) {
    return <Navigate to={needsOnboarding(user) ? '/onboarding' : '/app'} replace />;
  }

  async function onPasswordSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: { email, password, rememberMe },
      });
      loginSuccess(data);
      navigate(postAuthPath(data.user));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onSendOtp(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setDevHint('');
    try {
      const data = await api('/api/auth/otp/send', {
        method: 'POST',
        body: { email, purpose: 'login' },
      });
      if (data.devOtp) setDevHint(`Dev code: ${data.devOtp}`);
      setOtpPhase('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onOtpVerify(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/auth/otp/verify', {
        method: 'POST',
        body: { email, code: otp, purpose: 'login', rememberMe },
      });
      loginSuccess(data);
      navigate(postAuthPath(data.user));
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
        <InstallAppBanner />
        <h1>Welcome back</h1>
        <p>Log in with your password or a one-time email code.</p>

        <div className="auth-mode-tabs" role="tablist" aria-label="Sign-in method">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'password'}
            className={mode === 'password' ? 'is-active' : ''}
            onClick={() => {
              setMode('password');
              setError('');
            }}
          >
            Password
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'otp'}
            className={mode === 'otp' ? 'is-active' : ''}
            onClick={() => {
              setMode('otp');
              setOtpPhase('email');
              setOtp('');
              setError('');
            }}
          >
            Email code
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">{success}</div>}
        {devHint && <div className="success-banner">{devHint}</div>}

        {mode === 'password' ? (
          <form className="form-stack" onSubmit={onPasswordSubmit}>
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
            <label className="auth-check">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Stay signed in
            </label>
            <button className="btn btn-citrus" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : otpPhase === 'email' ? (
          <form className="form-stack" onSubmit={onSendOtp}>
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
            <label className="auth-check">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Stay signed in
            </label>
            <button className="btn btn-citrus" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form className="form-stack" onSubmit={onOtpVerify}>
            <p className="auth-otp-hint">
              Code sent to <strong>{email}</strong>
            </p>
            <OtpInput value={otp} onChange={setOtp} disabled={busy} />
            <label className="auth-check">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Stay signed in
            </label>
            <div className="auth-actions-row">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => {
                  setOtpPhase('email');
                  setOtp('');
                  setDevHint('');
                }}
              >
                ← Back
              </button>
              <button
                className="btn btn-citrus"
                type="submit"
                disabled={busy || otp.length !== 6}
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm auth-resend"
              disabled={busy}
              onClick={onSendOtp}
            >
              Resend code
            </button>
          </form>
        )}

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
