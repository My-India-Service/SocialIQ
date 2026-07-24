import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AppLayout() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading Voxa…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
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
          <NavLink to="/app/insights">Insights</NavLink>
          <NavLink to="/app/connections">Connect</NavLink>
          <NavLink to="/app/settings">Settings</NavLink>
        </nav>
        <div className="side-foot">
          <div className="who">
            {user.brandName}
            <br />
            {user.email}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout} style={{ color: '#e8eef2', borderColor: 'rgba(232,238,242,0.2)' }}>
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
