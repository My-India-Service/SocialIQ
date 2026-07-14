import { Link } from 'react-router-dom';

const STREAM = [
  { tag: 'Sales opportunity', className: 'tag-sales', text: 'How much is this?' },
  { tag: 'Complaint', className: 'tag-complaint', text: 'Zipper broke after two days.' },
  { tag: 'Feature request', className: 'tag-feature', text: 'Please launch this in blue.' },
  { tag: 'Positive', className: 'tag-positive', text: 'I bought it and it’s amazing.' },
  { tag: 'Sales opportunity', className: 'tag-sales', text: 'Do you ship to Bangalore?' },
  { tag: 'Complaint', className: 'tag-complaint', text: 'Battery drains too fast.' },
  { tag: 'Sales opportunity', className: 'tag-sales', text: 'Where can I buy?' },
  { tag: 'Feature request', className: 'tag-feature', text: 'Need a vegan option under ₹999.' },
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="hero">
        <div className="hero-canvas" aria-hidden="true">
          <div className="stream-line">
            {STREAM.map((item) => (
              <div className="stream-chip" key={`${item.tag}-${item.text}`}>
                <strong className={item.className}>{item.tag}</strong>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
          <div className="stream-line">
            {[...STREAM].reverse().map((item) => (
              <div className="stream-chip" key={`b-${item.text}`}>
                <strong className={item.className}>{item.tag}</strong>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="container">
          <nav className="nav">
            <Link to="/" className="logo">
              <span className="logo-mark" aria-hidden="true">
                <span />
              </span>
              Voxa
            </Link>
            <div className="nav-links">
              <Link to="/login" className="btn btn-ghost btn-sm">
                Log in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Start free
              </Link>
            </div>
          </nav>

          <div className="hero-grid">
            <div className="hero-copy">
              <p className="brand-hero">Voxa</p>
              <h1>Turn every comment into revenue.</h1>
              <p className="hero-lead">
                AI reads Instagram & YouTube comments, finds sales leads and complaints, and drafts
                replies in your brand tone.
              </p>
              <div className="hero-cta">
                <Link to="/register" className="btn btn-citrus">
                  Open the dashboard
                </Link>
                <a href="#how" className="btn btn-ghost">
                  See how it works
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="section problem">
        <div className="container">
          <div className="section-head">
            <h2>Brands drown in comments. Revenue slips through.</h2>
            <p>Keyword filters miss intent. Manual reading doesn’t scale.</p>
          </div>
          <ul className="problem-list">
            <li>“How much is this?” — ignored sales opportunity</li>
            <li>“Zipper broke.” — silent product issue</li>
            <li>“Please launch in blue.” — roadmap signal, unread</li>
          </ul>
        </div>
      </section>

      <section className="section" id="how">
        <div className="container feature-split">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <h2>AI that understands intent — not just keywords.</h2>
            <p>
              Connect YouTube and Instagram. Voxa categorizes every comment into sales, complaints,
              feature requests, praise, and spam — then suggests a reply in your tone.
            </p>
          </div>
          <div className="intent-demo">
            <div className="intent-row">
              <span>95% purchase probability</span>
              <strong>“Need this.”</strong>
            </div>
            <div className="intent-row">
              <span>Hot lead</span>
              <strong>“Where can I buy?”</strong>
            </div>
            <div className="intent-row">
              <span>Complaint spike</span>
              <strong>Battery complaints up 230% this week</strong>
            </div>
            <div className="intent-row">
              <span>Brand-tone reply</span>
              <strong>Appreciate it! Glad you’re loving it 🔥</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <h2>A daily CEO report, every morning.</h2>
            <p>Sales opportunities, missed revenue, complaints, competitors, sentiment.</p>
          </div>
          <div className="report-preview">
            <h3>Yesterday’s Summary</h3>
            <div className="report-grid">
              <div className="report-metric">
                <strong>12,347</strong>
                <span>comments analyzed</span>
              </div>
              <div className="report-metric">
                <strong>156</strong>
                <span>sales opportunities</span>
              </div>
              <div className="report-metric">
                <strong>₹3.8L</strong>
                <span>estimated missed revenue</span>
              </div>
              <div className="report-metric">
                <strong>71%</strong>
                <span>positive sentiment</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="container">
          <h2>Not another social scheduler. Revenue intelligence.</h2>
          <Link to="/register" className="btn btn-citrus">
            Try Voxa with demo data
          </Link>
        </div>
      </section>

      <footer className="footer container">
        <span>© {new Date().getFullYear()} Voxa</span>
        <span>AI Revenue Intelligence Platform</span>
      </footer>
    </div>
  );
}
