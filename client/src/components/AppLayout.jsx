import { Link, NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { needsEmailVerification, needsOnboarding } from '../utils/onboarding';
import BrandLogo from './BrandLogo';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';
import usePageMeta from '../hooks/usePageMeta';

const NAV = [
  { to: '/app', end: true, label: 'Inbox', icon: 'inbox' },
  { to: '/app/report', label: 'CEO dashboard', icon: 'chart' },
  { to: '/app/revenue', label: 'Revenue & ROI', icon: 'revenue' },
  { to: '/app/conversations', label: 'Conversations', icon: 'chat' },
  { to: '/app/leads', label: 'Lead Center', icon: 'users' },
  { to: '/app/checkout', label: 'Checkout', icon: 'card' },
  { to: '/app/complaints', label: 'Complaints', icon: 'alert' },
  { to: '/app/tickets', label: 'Tickets', icon: 'ticket' },
  { to: '/app/moderation', label: 'Moderation', icon: 'shield' },
  { to: '/app/brand-health', label: 'Brand health', icon: 'heart' },
  { to: '/app/posts', label: 'Posts', icon: 'image' },
  { to: '/app/insights', label: 'Insights', icon: 'spark' },
  { to: '/app/connections', label: 'Connect', icon: 'plug' },
  { to: '/app/ai-setup', label: 'AI Setup', icon: 'bot' },
  { to: '/app/settings', label: 'Settings', icon: 'gear' },
  { to: '/app/billing', label: 'Billing', icon: 'billing' },
  { to: '/app/help', label: 'Guide', icon: 'book' },
];

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
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <a className="member-support" href="tel:+918448255663">
            <span className="member-support-label">
              <Icon name="phone" size={14} />
              Member support
            </span>
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
            <Icon name="logout" />
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
