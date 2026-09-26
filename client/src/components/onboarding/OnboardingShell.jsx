import ThemeToggle from '../ThemeToggle';

export default function OnboardingShell({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  onBack,
  onContinue,
  onSkip,
  continueLabel = 'Continue',
  skipLabel = 'Skip for now',
  showSkip = false,
  busy = false,
  continueDisabled = false,
}) {
  const progress = Math.round((step / totalSteps) * 100);
  const canGoBack = step > 1 && typeof onBack === 'function';

  return (
    <div className="onboarding-shell">
      <ThemeToggle className="theme-toggle--auth" />
      <div className="onboarding-top">
        <span className="onboarding-step-label">
          Step {step} of {totalSteps}
        </span>
      </div>

      <div className="onboarding-progress" aria-hidden="true">
        <div className="onboarding-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="onboarding-body">
        <header className="onboarding-head">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </header>
        <div className="onboarding-content">{children}</div>
      </div>

      <div className="onboarding-foot">
        <div className="onboarding-foot-left">
          {canGoBack ? (
            <button
              type="button"
              className="btn btn-ghost onboarding-foot-back"
              onClick={onBack}
              disabled={busy}
            >
              ← Back
            </button>
          ) : (
            <span />
          )}
          {showSkip && onSkip ? (
            <button type="button" className="btn btn-ghost" onClick={onSkip} disabled={busy}>
              {skipLabel}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-citrus onboarding-foot-continue"
          onClick={onContinue}
          disabled={busy || continueDisabled}
        >
          {busy ? 'Saving…' : continueLabel}
        </button>
      </div>
    </div>
  );
}
