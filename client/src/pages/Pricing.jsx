import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PLANS } from '../data/plans';

function planCta(plan, loggedIn) {
  if (plan.contactSales) {
    return {
      to: 'mailto:sales@voxa.app?subject=Enterprise%20plan',
      external: true,
      label: 'Contact sales',
    };
  }
  if (loggedIn) {
    return { to: `/app/billing?plan=${plan.id}`, label: `Choose ${plan.name}` };
  }
  return { to: `/register?plan=${plan.id}`, label: `Start with ${plan.name}` };
}

export default function Pricing() {
  const { user } = useAuth();
  const loggedIn = Boolean(user);

  return (
    <div className="landing pricing-page">
      <header className="legal-top">
        <div className="container legal-nav">
          <Link to="/" className="logo">
            <span className="logo-mark" aria-hidden="true">
              <span />
            </span>
            Voxa
          </Link>
          <div className="nav-links">
            <Link to="/about">About</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/pricing">Pricing</Link>
            {loggedIn ? (
              <Link to="/app" className="btn btn-primary btn-sm">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">
                  Log in
                </Link>
                <Link to="/register?plan=growth" className="btn btn-primary btn-sm">
                  Start free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container pricing-page-body">
        <div className="section-head">
          <h1>Priced by comments processed.</h1>
          <p>Enterprise pays for saved time and recovered revenue — not just AI replies.</p>
        </div>

        <div className="pricing-grid">
          {PLANS.map((plan) => {
            const cta = planCta(plan, loggedIn);
            const btnClass = `btn ${plan.featured ? 'btn-citrus' : 'btn-primary'} btn-sm`;
            return (
              <article
                key={plan.id}
                className={`pricing-card${plan.featured ? ' featured' : ''}`}
              >
                <h3>{plan.name}</h3>
                <p className="price">
                  {plan.price}
                  <span>/mo</span>
                </p>
                <p className="prob">{plan.blurb}</p>
                <ul>
                  {plan.perks.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                {cta.external ? (
                  <a href={cta.to} className={btnClass}>
                    {cta.label}
                  </a>
                ) : (
                  <Link to={cta.to} className={btnClass}>
                    {cta.label}
                  </Link>
                )}
              </article>
            );
          })}
        </div>

        <p className="pricing-footnote muted">
          Prices in USD. Brand reporting defaults to INR in Settings. Payments coming soon — plans
          can be switched in-app for demo.
        </p>
      </main>

      <footer className="footer container">
        <span>© {new Date().getFullYear()} Voxa</span>
        <span>
          <Link to="/about">About</Link>
          {' · '}
          <Link to="/faq">FAQ</Link>
          {' · '}
          <Link to="/pricing">Pricing</Link>
          {' · '}
          <Link to="/privacy">Privacy</Link>
          {' · '}
          <Link to="/terms">Terms</Link>
          {' · '}
          <Link to="/data-deletion">Data deletion</Link>
        </span>
      </footer>
    </div>
  );
}
