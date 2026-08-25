import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PLANS } from '../data/plans';
import { FAQS } from '../data/helpContent';
import {
  BENEFITS,
  HOW_IT_WORKS,
  LANDING_FEATURES,
  LANDING_STATS,
  TESTIMONIALS,
  TRUST_BADGE,
} from '../data/landingContent';
import PhoneMockup from '../components/landing/PhoneMockup';
import BrandLogo from '../components/BrandLogo';

function LandingFaq({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="faq-list">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div className={`faq-item${isOpen ? ' is-open' : ''}`} key={item.q}>
            <button
              type="button"
              className="faq-q"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              {item.q}
              <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && <p className="faq-a">{item.a}</p>}
          </div>
        );
      })}
    </div>
  );
}

export default function Landing() {
  const faqPreview = FAQS.slice(0, 6);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="landing landing-quittr">
      <header className="lq-hero">
        <div className="lq-hero-glow" aria-hidden="true" />
        <div className="container">
          <nav className="nav lq-nav">
            <Link to="/" className="logo" onClick={closeMenu}>
              <BrandLogo />
            </Link>
            <div className="lq-nav-bar-end">
              <Link to="/register" className="btn btn-citrus btn-sm">
                Start free
              </Link>
              <button
                type="button"
                className={`lq-menu-toggle${menuOpen ? ' is-open' : ''}`}
                aria-expanded={menuOpen}
                aria-controls="lq-nav-menu"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span />
                <span />
                <span />
              </button>
            </div>
            <div
              className={`nav-links${menuOpen ? ' is-open' : ''}`}
              id="lq-nav-menu"
            >
              <a href="#how" className="btn btn-ghost btn-sm lq-nav-link" onClick={closeMenu}>
                How it works
              </a>
              <a href="#features" className="btn btn-ghost btn-sm lq-nav-link" onClick={closeMenu}>
                Features
              </a>
              <Link to="/pricing" className="btn btn-ghost btn-sm lq-nav-link" onClick={closeMenu}>
                Pricing
              </Link>
              <Link to="/login" className="btn btn-ghost btn-sm lq-nav-link" onClick={closeMenu}>
                Log in
              </Link>
              <Link to="/register" className="btn btn-citrus btn-sm lq-nav-cta-desktop" onClick={closeMenu}>
                Start free
              </Link>
            </div>
          </nav>

          <div className="lq-hero-grid">
            <div className="lq-hero-copy">
              <p className="lq-trust">{TRUST_BADGE}</p>
              <h1>AI Sales Agent for Social Media</h1>
              <p className="lq-lead">
                Every comment is a potential customer. SocialAiDigital detects buying intent — including Hinglish —
                replies publicly, sells in DM, qualifies leads, and tracks ₹ sales influenced.
              </p>
              <div className="hero-cta">
                <Link to="/register" className="btn btn-citrus">
                  Start free
                </Link>
                <a href="#how" className="btn btn-ghost lq-ghost-btn">
                  See how it works
                </a>
              </div>
            </div>
            <PhoneMockup variant="inbox" />
          </div>
        </div>
      </header>

      <section className="lq-stats">
        <div className="container lq-stats-grid">
          {LANDING_STATS.map((s) => (
            <div className="lq-stat" key={s.label}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="lq-section" id="how">
        <div className="container">
          <div className="lq-section-head">
            <p className="lq-kicker">How it works</p>
            <h2>How SocialAiDigital turns comments into revenue</h2>
          </div>
          <div className="lq-steps">
            {HOW_IT_WORKS.map((step, i) => (
              <article className={`lq-step${i % 2 ? ' lq-step-reverse' : ''}`} key={step.title}>
                <div className="lq-step-copy">
                  <span className="lq-step-num">{i + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
                <PhoneMockup variant={step.mockVariant} />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lq-section lq-section-dark" id="features">
        <div className="container">
          <div className="lq-section-head">
            <p className="lq-kicker">Features</p>
            <h2>Everything you need to capture comment revenue</h2>
          </div>
          <div className="lq-feature-grid">
            {LANDING_FEATURES.map((f) => (
              <article className="lq-feature-card" key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lq-section">
        <div className="container">
          <div className="lq-section-head">
            <p className="lq-kicker">Reviews</p>
            <h2>What brands say about SocialAiDigital</h2>
          </div>
          <div className="lq-testimonials">
            {TESTIMONIALS.map((t) => (
              <blockquote className="lq-testimonial" key={t.name}>
                <p>&ldquo;{t.quote}&rdquo;</p>
                <footer>
                  <strong>{t.name}</strong>
                  <span>{t.role}</span>
                  <span className="lq-stars" aria-label={`${t.rating} stars`}>
                    {'★'.repeat(t.rating)}
                  </span>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="lq-section lq-benefits-band">
        <div className="container lq-benefits-grid">
          <div className="lq-section-head" style={{ marginBottom: 0, textAlign: 'left' }}>
            <p className="lq-kicker">Benefits</p>
            <h2>Experience revenue-changing results</h2>
            <p>Unlock faster replies, clearer pipeline, and fewer missed opportunities.</p>
          </div>
          <ul className="lq-benefits-list">
            {BENEFITS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lq-section" id="pricing">
        <div className="container">
          <div className="lq-section-head">
            <p className="lq-kicker">Pricing</p>
            <h2>Priced by comments processed</h2>
            <p>Enterprise pays for saved time and recovered revenue — not just AI replies.</p>
          </div>
          <div className="pricing-grid">
            {PLANS.map((plan) => (
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
                {plan.contactSales ? (
                  <a
                    href="mailto:sales@voxa.app?subject=Enterprise%20plan"
                    className="btn btn-primary btn-sm"
                  >
                    Contact sales
                  </a>
                ) : (
                  <Link
                    to={`/register?plan=${plan.id}`}
                    className={`btn ${plan.featured ? 'btn-citrus' : 'btn-primary'} btn-sm`}
                  >
                    Start with {plan.name}
                  </Link>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lq-section lq-faq-section" id="faq">
        <div className="container">
          <div className="lq-section-head">
            <p className="lq-kicker">FAQ</p>
            <h2>Frequently asked questions</h2>
          </div>
          <LandingFaq items={faqPreview} />
          <p className="lq-faq-more">
            <Link to="/faq">View all FAQ →</Link>
          </p>
        </div>
      </section>

      <section className="lq-cta-band">
        <div className="container">
          <h2>Turn comments into revenue today</h2>
          <p>Start with SocialAiDigital — connect channels, sync comments, and unlock your revenue inbox.</p>
          <Link to="/register" className="btn btn-citrus">
            Start free
          </Link>
        </div>
      </section>

      <footer className="footer container lq-footer">
        <span>© {new Date().getFullYear()} SocialAiDigital</span>
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
