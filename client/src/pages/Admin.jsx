import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { clearAdminSession, getAdminEmail, getAdminToken } from '../adminSession';
import AdminPlans from '../components/AdminPlans';
import BrandLogo from '../components/BrandLogo';
import ThemeToggle from '../components/ThemeToggle';
import { formatDateTime } from '../utils/time';

const PLATFORM_LABELS = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  x: 'X',
};

const GOAL_LABELS = {
  sales: 'Sales',
  complaints: 'Complaints',
  both: 'Sales and complaints',
};

const PLAN_LABELS = {
  starter: 'Starter',
  growth: 'Growth',
  business: 'Business',
  enterprise: 'Enterprise',
};

const STATUS_LABELS = {
  trialing: 'Trial',
  active: 'Active',
  canceled: 'Canceled',
};

function label(map, value) {
  if (!value) return '—';
  return map[value] || value;
}

function when(value) {
  return value ? formatDateTime(value) : '—';
}

function initial(name) {
  return (name || '?').trim().slice(0, 1).toUpperCase();
}

function AdminSite({ email, onLogout, children }) {
  return (
    <div className="admin-site">
      <header className="admin-top">
        <div className="container admin-top-inner">
          <Link to="/" className="logo">
            <BrandLogo />
          </Link>
          <div className="admin-top-actions">
            <ThemeToggle className="theme-toggle--nav" />
            {email ? <span className="admin-who">{email}</span> : null}
            <button type="button" className="btn btn-ghost btn-sm" onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="container admin-site-main">{children}</main>
    </div>
  );
}

export default function Admin() {
  const [token, setToken] = useState(() => getAdminToken());
  const [email] = useState(() => getAdminEmail());
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [plan, setPlan] = useState('all');
  const [onboarded, setOnboarded] = useState('all');

  function logout() {
    clearAdminSession();
    setToken('');
  }

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api('/api/admin/overview', { token });
        if (!cancelled) setOverview(data);
      } catch (err) {
        if (!cancelled) {
          if (err.status === 401 || err.status === 403) {
            clearAdminSession();
            setToken('');
          }
          setError(err.message || 'Could not load admin data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const users = overview?.users || [];
  const stats = overview?.stats;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((row) => {
      if (plan !== 'all' && row.subscription?.planId !== plan) return false;
      const done = Boolean(row.onboardingCompletedAt);
      if (onboarded === 'yes' && !done) return false;
      if (onboarded === 'no' && done) return false;
      if (!q) return true;
      const haystack = [
        row.name,
        row.email,
        row.brandName,
        ...(row.connections || []).map((c) => `${c.platform} ${c.accountName}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [users, query, plan, onboarded]);

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  const connectedPlatforms = stats
    ? Object.entries(stats.platforms).filter(([, count]) => count > 0)
    : [];

  return (
    <AdminSite email={email} onLogout={logout}>
      <div className="admin-page">
        <AdminPlans token={token} />
        <div className="admin-hero">
          <div>
            <p className="admin-kicker">Platform</p>
            <h1>Accounts</h1>
            <p>Who signed up, which plan they are on, and what they connected.</p>
          </div>
          {!loading && stats ? (
            <p className="admin-count">
              Showing <strong>{filtered.length}</strong> of {stats.totalUsers}
            </p>
          ) : null}
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        {loading ? (
          <div className="admin-empty">
            <strong>Loading accounts…</strong>
            <p>Fetching users, plans, and connections.</p>
          </div>
        ) : null}

        {stats ? (
          <>
            <div className="admin-stats">
              <div className="admin-stat">
                <span>Users</span>
                <strong>{stats.totalUsers}</strong>
              </div>
              <div className="admin-stat">
                <span>Onboarded</span>
                <strong>{stats.onboarded}</strong>
              </div>
              <div className="admin-stat">
                <span>Onboarding pending</span>
                <strong>{stats.pendingOnboarding}</strong>
              </div>
              <div className="admin-stat">
                <span>With a connection</span>
                <strong>{stats.usersWithConnection}</strong>
              </div>
              <div className="admin-stat">
                <span>Connected accounts</span>
                <strong>{stats.connectedAccounts}</strong>
              </div>
              <div className="admin-stat">
                <span>Email verified</span>
                <strong>{stats.emailVerified}</strong>
              </div>
            </div>

            <div className="admin-panels">
              <section>
                <h2>Plans</h2>
                <ul>
                  {Object.entries(stats.plans).map(([id, count]) => (
                    <li key={id}>
                      <span>{label(PLAN_LABELS, id)}</span>
                      <strong>{count}</strong>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h2>Billing</h2>
                <ul>
                  {Object.entries(stats.statuses).map(([id, count]) => (
                    <li key={id}>
                      <span>{label(STATUS_LABELS, id)}</span>
                      <strong>{count}</strong>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h2>Connected</h2>
                {connectedPlatforms.length ? (
                  <ul>
                    {connectedPlatforms.map(([platform, count]) => (
                      <li key={platform}>
                        <span>{label(PLATFORM_LABELS, platform)}</span>
                        <strong>{count}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No accounts connected yet.</p>
                )}
              </section>
            </div>
          </>
        ) : null}

        <div className="admin-toolbar">
          <input
            type="search"
            placeholder="Search name, email, brand, or account"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search users"
          />
          <select value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Filter by plan">
            <option value="all">All plans</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="business">Business</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select
            value={onboarded}
            onChange={(e) => setOnboarded(e.target.value)}
            aria-label="Filter by onboarding"
          >
            <option value="all">All onboarding</option>
            <option value="yes">Onboarded</option>
            <option value="no">Not onboarded</option>
          </select>
        </div>

        {!loading && filtered.length === 0 ? (
          <div className="admin-empty">
            <strong>{users.length ? 'No matches' : 'No users yet'}</strong>
            <p>
              {users.length
                ? 'Try a different name, plan, or onboarding filter.'
                : 'Accounts will show up here after someone registers.'}
            </p>
          </div>
        ) : null}

        <div className="admin-list">
          {filtered.map((row) => {
            const status = row.subscription?.status || 'trialing';
            const onboardedDone = Boolean(row.onboardingCompletedAt);
            return (
              <article key={row.id} className="admin-user">
                <header className="admin-user-head">
                  <span className="admin-avatar" aria-hidden="true">
                    {initial(row.name)}
                  </span>
                  <div className="admin-user-id">
                    <h2>{row.name}</h2>
                    <p>{row.email}</p>
                    {row.brandName ? <p className="admin-brand">{row.brandName}</p> : null}
                  </div>
                  <div className="admin-pills">
                    <span className={`admin-pill admin-pill--${row.subscription?.planId || 'starter'}`}>
                      {label(PLAN_LABELS, row.subscription?.planId)}
                    </span>
                    <span className={`admin-pill admin-pill--${status}`}>
                      {label(STATUS_LABELS, status)}
                    </span>
                    {row.subscription?.trialActive ? (
                      <span className="admin-pill admin-pill--trialing">Trial active</span>
                    ) : null}
                    <span className={`admin-pill ${onboardedDone ? 'admin-pill--active' : 'admin-pill--canceled'}`}>
                      {onboardedDone ? 'Onboarded' : 'Onboarding pending'}
                    </span>
                  </div>
                </header>

                <dl className="admin-user-meta">
                  <div>
                    <dt>Signed up</dt>
                    <dd>{when(row.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Onboarded</dt>
                    <dd>{when(row.onboardingCompletedAt)}</dd>
                  </div>
                  <div>
                    <dt>Email verified</dt>
                    <dd>{when(row.emailVerifiedAt)}</dd>
                  </div>
                  <div>
                    <dt>Goal</dt>
                    <dd>{label(GOAL_LABELS, row.onboarding?.primaryGoal)}</dd>
                  </div>
                  <div>
                    <dt>Wanted platforms</dt>
                    <dd>
                      {(row.onboarding?.platforms || [])
                        .map((p) => label(PLATFORM_LABELS, p))
                        .join(', ') || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Comments synced</dt>
                    <dd>{row.commentCount}</dd>
                  </div>
                  <div>
                    <dt>Effective plan</dt>
                    <dd>{label(PLAN_LABELS, row.subscription?.effectivePlanId)}</dd>
                  </div>
                  <div>
                    <dt>Trial ends</dt>
                    <dd>{when(row.subscription?.trialEndsAt)}</dd>
                  </div>
                </dl>

                <div className="admin-conn-block">
                  <h3>Connections</h3>
                  {row.connections?.length ? (
                    <div className="admin-connections">
                      {row.connections.map((connection) => (
                        <div
                          key={`${connection.platform}-${connection.accountName}`}
                          className="admin-conn"
                        >
                          <strong>
                            {label(PLATFORM_LABELS, connection.platform)}
                            <span className={`admin-dot admin-dot--${connection.status}`} />
                          </strong>
                          <span>{connection.accountName || 'Account'}</span>
                          <span>
                            {connection.status} · {when(connection.connectedAt)}
                            {connection.lastSyncedAt ? ` · synced ${when(connection.lastSyncedAt)}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-none">No accounts connected.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </AdminSite>
  );
}
