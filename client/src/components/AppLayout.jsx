import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { needsOnboarding } from '../utils/onboarding';

export default function AppLayout() {
  const { user, token, loading, logout } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading Voxa…</div>;
  }

  // JWT still present (e.g. after OAuth return) but /me briefly failed — do not send to login.
  if (!user && token) {
    return <div className="loading-screen">Restoring session…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (needsOnboarding(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/app" className="logo" end>
          <span className="logo-mark" aria-hidden="true">
            <span />
          </span>
          Voxa
        </NavLink>
        <nav className="side-nav">
          <NavLink to="/app" end>
            Inbox
          </NavLink>
          <NavLink to="/app/report">CEO dashboard</NavLink>
          <NavLink to="/app/revenue">Revenue & ROI</NavLink>
          <NavLink to="/app/conversations">Conversations</NavLink>
          <NavLink to="/app/insights">Insights</NavLink>
          <NavLink to="/app/connections">Connect</NavLink>
          <NavLink to="/app/settings">Settings</NavLink>
          <NavLink to="/app/billing">Billing</NavLink>
          <NavLink to="/app/help">Guide</NavLink>
        </nav>
        <div className="side-foot">
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
        <Outlet />
      </main>
    </div>
  );
}
