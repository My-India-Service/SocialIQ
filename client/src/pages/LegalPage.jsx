import { Link } from 'react-router-dom';

export default function LegalPage({ title, updated, children }) {
  return (
    <div className="legal-page">
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
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/data-deletion">Data deletion</Link>
            <Link to="/login" className="btn btn-ghost btn-sm">
              Log in
            </Link>
          </div>
        </div>
      </header>

      <main className="container legal-body">
        <h1>{title}</h1>
        {updated ? <p className="legal-updated">Last updated: {updated}</p> : null}
        <article className="legal-prose">{children}</article>
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
