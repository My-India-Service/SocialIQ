import { Link, NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { needsEmailVerification, needsOnboarding } from '../utils/onboarding';
import BrandLogo from './BrandLogo';
import ThemeToggle from './ThemeToggle';
import usePageMeta from '../hooks/usePageMeta';

function TrialBanner({ subscription }) {
  if (subscription?.trialActive) {
    const days = subscription.trialDaysLeft || 0;
    return (
      <div className="trial-banner">
        <span>
          Free trial: {days} day{days === 1 ? '' : 's'} of Pro access left
        </span>
        <Link to="/app/billing">See plans</Link>
      </div>
    );
  }
  if (subscription?.trialEndsAt && (subscription.planId || 'starter') === 'starter') {
    return (
      <div className="trial-banner ended">
        <span>Trial ended — you&apos;re on Starter limits</span>
        <Link to="/app/billing">Upgrade</Link>
      </div>
    );
  }
  return null;
}

export default function AppLayout() {
  usePageMeta({ title: 'Dashboard', noindex: true });
  const { user, token, loading, sessionError, logout, retrySession } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  if (loading) {
    return <div className="loading-screen">Loading SocialAiDigital…</div>;
  }

  // JWT still present but /me failed — auto-retrying or offer recovery.
  if (!user && token) {
    if (!sessionError) {
      return <div className="loading-screen">Restoring session…</div>;
    }
    return (
      <div className="loading-screen session-restore">
        <div className="session-restore-card">
          <h1>Couldn’t restore your session</h1>
          <p>
            {sessionError ||
              'The API didn’t respond. It may be waking up — retry in a moment.'}
          </p>
          <div className="session-restore-actions">
            <button type="button" className="btn btn-citrus" onClick={retrySession}>
              Retry
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
            >
              Log in again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (needsEmailVerification(user)) {
    return <Navigate to="/verify-email" replace />;
  }

  if (needsOnboarding(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/app" className="logo" end>
          <BrandLogo variant={theme === 'dark' ? 'onDark' : 'default'} />
        </NavLink>
        <nav className="side-nav">
          <NavLink to="/app" end>
            Inbox
          </NavLink>
          <NavLink to="/app/report">CEO dashboard</NavLink>
          <NavLink to="/app/revenue">Revenue & ROI</NavLink>
          <NavLink to="/app/conversations">Conversations</NavLink>
          <NavLink to="/app/leads">Lead Center</NavLink>
          <NavLink to="/app/checkout">Checkout</NavLink>
          <NavLink to="/app/complaints">Complaints</NavLink>
          <NavLink to="/app/tickets">Tickets</NavLink>
          <NavLink to="/app/moderation">Moderation</NavLink>
          <NavLink to="/app/brand-health">Brand health</NavLink>
          <NavLink to="/app/posts">Posts</NavLink>
          <NavLink to="/app/insights">Insights</NavLink>
          <NavLink to="/app/connections">Connect</NavLink>
          <NavLink to="/app/ai-setup">AI Setup</NavLink>
          <NavLink to="/app/settings">Settings</NavLink>
          <NavLink to="/app/billing">Billing</NavLink>
          <NavLink to="/app/help">Guide</NavLink>
        </nav>
        <div className="side-foot">
          <a className="member-support" href="tel:+918448255663">
            <span>Member support</span>
            <strong>+91 84482 55663</strong>
            <span>Registered members · call for a quick response</span>
          </a>
          <ThemeToggle className="theme-toggle--sidebar" />
          <div className="who">
            <span className="who-avatar" aria-hidden="true">
              {(user.brandName || 'V').slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{user.brandName}</strong>
              <br />
              {user.email}
            </span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm sidebar-logout" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="main">
        <TrialBanner subscription={user.subscription} />
        <Outlet />
      </main>
    </div>
  );
}
