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

  return (
    <div className="onboarding-shell">
      <div className="onboarding-top">
        {step > 1 ? (
          <button type="button" className="onboarding-back btn btn-ghost btn-sm" onClick={onBack}>
            ← Back
          </button>
        ) : (
          <span />
        )}
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
        {showSkip && onSkip ? (
          <button type="button" className="btn btn-ghost" onClick={onSkip} disabled={busy}>
            {skipLabel}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="btn btn-citrus"
          onClick={onContinue}
          disabled={busy || continueDisabled}
        >
          {busy ? 'Saving…' : continueLabel}
        </button>
      </div>
    </div>
  );
}
