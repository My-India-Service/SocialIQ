import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { needsEmailVerification, needsOnboarding, postAuthPath } from '../utils/onboarding';
import BrandLogo from '../components/BrandLogo';
import ThemeToggle from '../components/ThemeToggle';
import OtpInput from '../components/OtpInput';
import InstallAppBanner from '../components/InstallAppBanner';

export default function Register() {
  const { user, loginSuccess, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPlan = searchParams.get('plan');
  const [step, setStep] = useState(() =>
    user && needsEmailVerification(user) ? 'verify' : 'form'
  );
  const [form, setForm] = useState({
    name: '',
    email: user?.email || '',
    password: '',
  });
  const [otp, setOtp] = useState('');
  const [devHint, setDevHint] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user && !needsEmailVerification(user)) {
    return <Navigate to={needsOnboarding(user) ? '/onboarding' : '/app'} replace />;
  }

  const showVerify = step === 'verify' || (user && needsEmailVerification(user));
  const emailForOtp = form.email || user?.email || '';

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setDevHint('');
    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: form,
      });
      loginSuccess(data);
      if (data.devOtp) setDevHint(`Dev code: ${data.devOtp}`);
      setStep('verify');
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
          email: emailForOtp,
          code: otp,
          purpose: 'verify',
          rememberMe: true,
        },
      });
      loginSuccess(data);
      navigate(postAuthPath(data.user, selectedPlan));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError('');
    setDevHint('');
    try {
      const data = await api('/api/auth/otp/send', {
        method: 'POST',
        body: { email: emailForOtp, purpose: 'verify' },
      });
      if (data.devOtp) setDevHint(`Dev code: ${data.devOtp}`);
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
        {!showVerify ? (
          <>
            <h1>Start with SocialAiDigital</h1>
            <p>Connect social comments. Capture sales. Catch complaints early.</p>
            {error && <div className="error-banner">{error}</div>}
            <form className="form-stack" onSubmit={onSubmit}>
              <label>
                Your name
                <input value={form.name} onChange={update('name')} required autoComplete="name" />
              </label>
              <label>
                Work email
                <input
                  type="email"
                  value={form.email}
                  onChange={update('email')}
                  required
                  autoComplete="email"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={form.password}
                  onChange={update('password')}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </label>
              <button className="btn btn-citrus" type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Continue'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1>Verify your email</h1>
            <p>
              Enter the 6-digit code sent to <strong>{emailForOtp}</strong>
            </p>
            {error && <div className="error-banner">{error}</div>}
            {devHint && <div className="success-banner">{devHint}</div>}
            <form className="form-stack" onSubmit={onVerify}>
              <OtpInput value={otp} onChange={setOtp} disabled={busy} />
              <div className="auth-actions-row">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => {
                    setStep('form');
                    setOtp('');
                    setError('');
                    if (user) logout();
                  }}
                >
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
                onClick={resend}
              >
                Resend code
              </button>
            </form>
          </>
        )}
        <p className="muted-link">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
