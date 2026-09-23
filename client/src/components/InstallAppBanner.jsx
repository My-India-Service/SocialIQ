import { useEffect, useState } from 'react';

/**
 * Soft PWA install prompt. Android: beforeinstallprompt.
 * iOS Safari: tip to use Share → Add to Home Screen.
 */
export default function InstallAppBanner() {
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('sad_install_dismissed') === '1';
    } catch {
      return false;
    }
  });
  const [isIos, setIsIos] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIos(ios);
    setStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
        // eslint-disable-next-line no-undef
        Boolean(navigator.standalone)
    );

    function onBip(e) {
      e.preventDefault();
      setDeferred(e);
    }
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  if (dismissed || standalone) return null;
  if (!deferred && !isIos) return null;

  function dismiss() {
    try {
      sessionStorage.setItem('sad_install_dismissed', '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  return (
    <div className="install-app-banner" role="status">
      <div className="install-app-banner-text">
        <strong>Add to Home Screen</strong>
        <span>
          {deferred
            ? 'Open SocialAiDigital like an app — stay signed in without hunting the browser.'
            : 'On iPhone: tap Share, then “Add to Home Screen”.'}
        </span>
      </div>
      <div className="install-app-banner-actions">
        {deferred && (
          <button type="button" className="btn btn-citrus btn-sm" onClick={install}>
            Install
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
