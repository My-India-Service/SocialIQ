import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import OnboardingShell from '../components/onboarding/OnboardingShell';
import PhoneMockup from '../components/landing/PhoneMockup';
import {
  GOAL_OPTIONS,
  ONBOARDING_STEPS,
  PLATFORM_OPTIONS,
  TONE_OPTIONS,
  WELCOME_STATS,
} from '../data/onboardingContent';

const STEP_KEY = 'voxa_onboarding_step';

export default function Onboarding() {
  const { user, token, loading, setUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const connected = searchParams.get('connected');

  const [step, setStep] = useState(() => {
    const saved = Number(sessionStorage.getItem(STEP_KEY));
    if (connected) return 7;
    return saved >= 1 && saved <= ONBOARDING_STEPS ? saved : 1;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connectBusy, setConnectBusy] = useState('');

  const [form, setForm] = useState({
    brandName: user?.brandName || '',
    brandTone: user?.brandTone || 'friendly',
    avgOrderValue: user?.avgOrderValue ?? 2499,
    currency: user?.currency || 'INR',
    platforms: user?.onboarding?.platforms || [],
    primaryGoal: user?.onboarding?.primaryGoal || '',
  });

  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        brandName: user.brandName || f.brandName,
        brandTone: user.brandTone || f.brandTone,
        avgOrderValue: user.avgOrderValue ?? f.avgOrderValue,
        currency: user.currency || f.currency,
        platforms: user.onboarding?.platforms?.length ? user.onboarding.platforms : f.platforms,
        primaryGoal: user.onboarding?.primaryGoal || f.primaryGoal,
      }));
    }
  }, [user]);

  useEffect(() => {
    sessionStorage.setItem(STEP_KEY, String(step));
  }, [step]);

  useEffect(() => {
    if (connected && step < 7) setStep(7);
  }, [connected, step]);

  if (loading) return <div className="loading-screen">Loading…</div>;
  if (!user || !token) return <Navigate to="/login" replace />;
  if (user.onboardingCompletedAt) return <Navigate to="/app" replace />;

  async function savePatch(body) {
    const data = await api('/api/auth/onboarding', {
      method: 'PATCH',
      token,
      body,
    });
    setUser(data.user);
    return data.user;
  }

  function nextStep() {
    setStep((s) => Math.min(ONBOARDING_STEPS, s + 1));
    setError('');
  }

  function prevStep() {
    setStep((s) => Math.max(1, s - 1));
    setError('');
  }

  async function handleContinue() {
    setBusy(true);
    setError('');
    try {
      if (step === 2) {
        if (!form.brandName.trim()) {
          setError('Enter your brand name');
          return;
        }
        await savePatch({ brandName: form.brandName.trim(), brandTone: form.brandTone });
      } else if (step === 3) {
        await savePatch({
          avgOrderValue: Number(form.avgOrderValue) || 2499,
          currency: form.currency,
        });
      } else if (step === 4) {
        await savePatch({ onboarding: { platforms: form.platforms } });
      } else if (step === 5) {
        if (!form.primaryGoal) {
          setError('Pick what matters most to you');
          return;
        }
        await savePatch({ onboarding: { primaryGoal: form.primaryGoal } });
      } else if (step === 7) {
        await savePatch({ complete: true });
        sessionStorage.removeItem(STEP_KEY);
        navigate('/app');
        return;
      }
      nextStep();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function connectPlatform(platform) {
    setConnectBusy(platform);
    setError('');
    try {
      const path =
        platform === 'youtube'
          ? '/api/connections/youtube/auth'
          : platform === 'instagram'
            ? '/api/connections/instagram/auth'
            : '/api/connections/meta/auth?platform=facebook';
      const data = await api(path, { token });
      if (data.url) window.location.href = data.url;
      else setError('OAuth not configured on server');
    } catch (err) {
      setError(err.message);
    } finally {
      setConnectBusy('');
    }
  }

  function togglePlatform(id) {
    setForm((f) => {
      const has = f.platforms.includes(id);
      return {
        ...f,
        platforms: has ? f.platforms.filter((p) => p !== id) : [...f.platforms, id],
      };
    });
  }

  const connectedMsg = connected
    ? `${connected.charAt(0).toUpperCase() + connected.slice(1)} connected! Finish setup to open your inbox.`
    : '';

  if (step === 1) {
    return (
      <div className="onboarding-page">
        <Link to="/" className="logo onboarding-logo">
          <span className="logo-mark" aria-hidden="true">
            <span />
          </span>
          Voxa
        </Link>
        <OnboardingShell
          step={1}
          totalSteps={ONBOARDING_STEPS}
          title="Your AI Sales Agent"
          subtitle="Voxa turns Instagram & YouTube comments into DM conversations, qualified leads, and tracked sales."
          onContinue={handleContinue}
          busy={busy}
        >
          <div className="onboarding-welcome-grid">
            <div className="onboarding-stat-chips">
              {WELCOME_STATS.map((s) => (
                <div className="onboarding-stat-chip" key={s.label}>
                  <strong>{s.value}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
            <PhoneMockup variant="inbox" />
          </div>
        </OnboardingShell>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="onboarding-page">
        <OnboardingShell
          step={2}
          totalSteps={ONBOARDING_STEPS}
          title="What's your brand?"
          subtitle="AI replies will match this name and tone."
          onBack={prevStep}
          onContinue={handleContinue}
          busy={busy}
          continueDisabled={!form.brandName.trim()}
        >
          {error && <div className="error-banner">{error}</div>}
          <label className="onboarding-field">
            Brand name
            <input
              value={form.brandName}
              onChange={(e) => setForm((f) => ({ ...f, brandName: e.target.value }))}
              placeholder="NovaWear"
            />
          </label>
          <p className="onboarding-field-label">Reply tone</p>
          <div className="onboarding-card-grid">
            {TONE_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`onboarding-card${form.brandTone === t.id ? ' is-selected' : ''}`}
                onClick={() => setForm((f) => ({ ...f, brandTone: t.id }))}
              >
                <strong>{t.label}</strong>
                <span>{t.desc}</span>
              </button>
            ))}
          </div>
        </OnboardingShell>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="onboarding-page">
        <OnboardingShell
          step={3}
          totalSteps={ONBOARDING_STEPS}
          title="Revenue defaults"
          subtitle="Used to estimate expected order value on sales comments."
          onBack={prevStep}
          onContinue={handleContinue}
          busy={busy}
        >
          <div className="onboarding-row">
            <label className="onboarding-field">
              Average order value
              <input
                type="number"
                min="0"
                value={form.avgOrderValue}
                onChange={(e) => setForm((f) => ({ ...f, avgOrderValue: e.target.value }))}
              />
            </label>
            <label className="onboarding-field">
              Currency
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </label>
          </div>
        </OnboardingShell>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="onboarding-page">
        <OnboardingShell
          step={4}
          totalSteps={ONBOARDING_STEPS}
          title="Which channels matter?"
          subtitle="Pick all that apply — you can connect them next."
          onBack={prevStep}
          onContinue={handleContinue}
          busy={busy}
        >
          <div className="onboarding-card-grid onboarding-card-grid-2">
            {PLATFORM_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`onboarding-card${form.platforms.includes(p.id) ? ' is-selected' : ''}`}
                onClick={() => togglePlatform(p.id)}
              >
                <strong>{p.label}</strong>
                <span>{p.desc}</span>
              </button>
            ))}
          </div>
        </OnboardingShell>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="onboarding-page">
        <OnboardingShell
          step={5}
          totalSteps={ONBOARDING_STEPS}
          title="What matters most?"
          subtitle="We'll prioritize your inbox view around this goal."
          onBack={prevStep}
          onContinue={handleContinue}
          busy={busy}
          continueDisabled={!form.primaryGoal}
        >
          {error && <div className="error-banner">{error}</div>}
          <div className="onboarding-card-grid">
            {GOAL_OPTIONS.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`onboarding-card${form.primaryGoal === g.id ? ' is-selected' : ''}`}
                onClick={() => setForm((f) => ({ ...f, primaryGoal: g.id }))}
              >
                <strong>{g.label}</strong>
                <span>{g.desc}</span>
              </button>
            ))}
          </div>
        </OnboardingShell>
      </div>
    );
  }

  if (step === 6) {
    const preferred =
      form.platforms.length > 0 ? form.platforms : PLATFORM_OPTIONS.map((p) => p.id);

    return (
      <div className="onboarding-page">
        <OnboardingShell
          step={6}
          totalSteps={ONBOARDING_STEPS}
          title="Connect your first channel"
          subtitle="OAuth opens in this tab. You can always connect more later on Connect."
          onBack={prevStep}
          onContinue={handleContinue}
          onSkip={nextStep}
          showSkip
          skipLabel="I'll connect later"
          busy={busy}
        >
          {error && <div className="error-banner">{error}</div>}
          {connectedMsg && <div className="success-banner">{connectedMsg}</div>}
          <div className="onboarding-connect-grid">
            {preferred.map((id) => {
              const p = PLATFORM_OPTIONS.find((x) => x.id === id);
              if (!p) return null;
              if (p.id === 'whatsapp') {
                return (
                  <div key={p.id} className="onboarding-connect-note">
                    <strong>{p.label}</strong>
                    <span>Enable inbox in Settings after you open the Inbox.</span>
                  </div>
                );
              }
              return (
                <button
                  key={p.id}
                  type="button"
                  className="onboarding-connect-btn"
                  disabled={Boolean(connectBusy)}
                  onClick={() => connectPlatform(p.id)}
                >
                  {connectBusy === p.id ? 'Redirecting…' : `Connect ${p.label}`}
                </button>
              );
            })}
          </div>
        </OnboardingShell>
      </div>
    );
  }

  return (
    <div className="onboarding-page onboarding-unlock">
      <OnboardingShell
        step={7}
        totalSteps={ONBOARDING_STEPS}
        title="Unlock your Inbox"
        subtitle={
          connectedMsg ||
          `You're set, ${form.brandName || user.brandName}. Your revenue inbox is ready.`
        }
        onBack={prevStep}
        onContinue={handleContinue}
        continueLabel="Open Inbox"
        busy={busy}
      >
        <div className="onboarding-unlock-visual">
          <div className="onboarding-orb" aria-hidden="true" />
          <PhoneMockup variant="inbox" />
        </div>
      </OnboardingShell>
    </div>
  );
}
