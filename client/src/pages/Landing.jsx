import { Link } from 'react-router-dom';

const STREAM = [
  { tag: 'Hot lead · 95%', className: 'tag-sales', text: 'Do you deliver in Delhi?' },
  { tag: 'Complaint', className: 'tag-complaint', text: 'Zipper broke after two days.' },
  { tag: 'Feature · 512 users', className: 'tag-feature', text: 'Blue variant requested' },
  { tag: 'Competitor', className: 'tag-sales', text: 'I switched from Adidas.' },
  { tag: 'Sales · Auto DM', className: 'tag-sales', text: 'Price?' },
  { tag: 'Complaint', className: 'tag-complaint', text: 'Battery drains too fast.' },
  { tag: 'Hot lead · 98%', className: 'tag-sales', text: 'Where can I buy?' },
  { tag: 'Feature', className: 'tag-feature', text: 'Need a vegan option under ₹999.' },
];

const PLANS = [
  {
    name: 'Starter',
    price: '$49',
    blurb: 'For early Shopify brands validating comment revenue.',
    perks: ['Up to 2k comments/mo', 'IG + YouTube', 'AI replies', 'Daily CEO email'],
  },
  {
    name: 'Growth',
    price: '$149',
    blurb: 'For teams that need Slack routing and ROI tracking.',
    perks: ['Up to 15k comments/mo', 'Hot-lead alerts', 'Slack / WhatsApp / CRM', 'ROI dashboard'],
    featured: true,
  },
  {
    name: 'Business',
    price: '$399',
    blurb: 'For multi-SKU brands with heavy ad spend.',
    perks: ['Up to 75k comments/mo', 'Competitor intel', 'Auto DM catalogue', 'Priority sync'],
  },
  {
    name: 'Enterprise',
    price: '$1,000+',
    blurb: 'Custom volume, SSO, and recovered-revenue SLAs.',
    perks: ['Unlimited volume', 'Dedicated success', 'Custom AOV models', 'API access'],
  },
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
              <a href="#pricing" className="btn btn-ghost btn-sm">
                Pricing
              </a>
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
              <h1>We turn every social media comment into revenue.</h1>
              <p className="hero-lead">
                AI reads Instagram & YouTube comments, finds sales leads and complaints, scores
                buying intent, and drafts replies in your brand tone — built for Shopify brands
                first.
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
            <h2>Thousands of comments. Hidden revenue. Slow replies.</h2>
            <p>Sales opportunities bury in threads. Complaints damage reputation. Teams filter manually.</p>
          </div>
          <ul className="problem-list">
            <li>“Do you deliver in Delhi?” — 95% intent, never routed to sales</li>
            <li>“Zipper broke.” — silent product issue, unpaid recovery</li>
            <li>“Please launch in blue.” — 512 users asking, unread as noise</li>
          </ul>
        </div>
      </section>

      <section className="section" id="how">
        <div className="container feature-split">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <h2>Not just classification — revenue detection.</h2>
            <p>
              Every sales comment gets a buying-intent score, expected order value, recommended
              reply, and a one-click send to Slack, WhatsApp, or your CRM.
            </p>
          </div>
          <div className="intent-demo">
            <div className="intent-row">
              <span>🔥 Hot lead · 95%</span>
              <strong>“Do you deliver in Delhi?”</strong>
            </div>
            <div className="intent-row">
              <span>Expected ₹2,374</span>
              <strong>Suggested reply + Send to sales</strong>
            </div>
            <div className="intent-row">
              <span>Auto DM</span>
              <strong>Catalogue · coupon · Shopify link</strong>
            </div>
            <div className="intent-row">
              <span>Feature research</span>
              <strong>Blue variant requested by 512 users</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <h2>A CEO dashboard executives actually open.</h2>
            <p>Lost revenue, missed comments, competitor mentions, product requests, complaints, viral posts.</p>
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
                <span>lost revenue yesterday</span>
              </div>
              <div className="report-metric">
                <strong>71%</strong>
                <span>positive sentiment</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section shopify-band">
        <div className="container feature-split">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <h2>Built for Shopify brands first.</h2>
            <p>
              You already advertise. Comments are full of product intent. Voxa closes the path from
              comment → DM → cart — and shows ROI that justifies the subscription.
            </p>
          </div>
          <ul className="problem-list">
            <li>Revenue generated from comments</li>
            <li>Leads converted & response coverage</li>
            <li>Money recovered from complaints</li>
            <li>Competitor switch-away trends</li>
          </ul>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="container">
          <div className="section-head">
            <h2>Priced by comments processed.</h2>
            <p>Enterprise pays for saved time and recovered revenue — not just AI replies.</p>
          </div>
          <div className="pricing-grid">
            {PLANS.map((plan) => (
              <article
                key={plan.name}
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
                <Link to="/register" className={`btn ${plan.featured ? 'btn-citrus' : 'btn-primary'} btn-sm`}>
                  Start with {plan.name}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="container">
          <h2>Turn every comment into revenue.</h2>
          <Link to="/register" className="btn btn-citrus">
            Try Voxa with demo data
          </Link>
        </div>
      </section>

      <footer className="footer container">
        <span>© {new Date().getFullYear()} Voxa</span>
        <span>AI Social Revenue Platform</span>
      </footer>
    </div>
  );
}
