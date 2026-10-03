import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { needsEmailVerification, postAuthPath } from '../utils/onboarding';
import BrandLogo from '../components/BrandLogo';
import ThemeToggle from '../components/ThemeToggle';
import OtpInput from '../components/OtpInput';
import usePageMeta from '../hooks/usePageMeta';

/** Standalone verify page for sessions that registered but never confirmed email. */
export default function VerifyEmail() {
  usePageMeta({ title: 'Verify email', noindex: true });
  const { user, token, loading, loginSuccess, logout } = useAuth();
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [devHint, setDevHint] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentOnce, setSentOnce] = useState(false);

  if (loading) {
    return (
      <div className="auth-page">
        <p>Loading…</p>
      </div>
    );
  }

  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  if (!needsEmailVerification(user)) {
    return <Navigate to={postAuthPath(user)} replace />;
  }

  async function ensureCode() {
    setBusy(true);
    setError('');
    setDevHint('');
    try {
      const data = await api('/api/auth/otp/send', {
        method: 'POST',
        body: { email: user.email, purpose: 'verify' },
      });
      if (data.alreadyVerified) {
        const me = await api('/api/auth/me', { token });
        loginSuccess({ token, user: me.user });
        navigate(postAuthPath(me.user));
        return;
      }
      if (data.devOtp) setDevHint(`Dev code: ${data.devOtp}`);
      setSentOnce(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/auth/otp/verify', {
        method: 'POST',
        body: {
          email: user.email,
          code: otp,
          purpose: 'verify',
          rememberMe: true,
        },
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
        <h1>Verify your email</h1>
        <p>
          Confirm <strong>{user.email}</strong> to continue onboarding.
        </p>
        {error && <div className="error-banner">{error}</div>}
        {devHint && <div className="success-banner">{devHint}</div>}
        {!sentOnce ? (
          <div className="form-stack">
            <button className="btn btn-citrus" type="button" disabled={busy} onClick={ensureCode}>
              {busy ? 'Sending…' : 'Send verification code'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={logout}>
              ← Use a different account
            </button>
          </div>
        ) : (
          <form className="form-stack" onSubmit={onVerify}>
            <OtpInput value={otp} onChange={setOtp} disabled={busy} />
            <div className="auth-actions-row">
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={logout}>
                ← Back
              </button>
              <button
                className="btn btn-citrus"
                type="submit"
                disabled={busy || otp.length !== 6}
              >
                {busy ? 'Verifying…' : 'Verify & continue'}
              </button>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm auth-resend"
              disabled={busy}
              onClick={ensureCode}
            >
              Resend code
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
