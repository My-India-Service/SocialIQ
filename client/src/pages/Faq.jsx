import { useState } from 'react';
import { Link } from 'react-router-dom';
import LegalPage from './LegalPage';
import { FAQS } from '../data/helpContent';

export default function Faq() {
  return (
    <LegalPage title="FAQ" updated="18 August 2026">
      <p>
        Short answers. Start with the <Link to="/about">main objective and user guide</Link> if you
        are new. Plans: <Link to="/pricing">Pricing</Link>.
      </p>
      <FaqList />
    </LegalPage>
  );
}

export function FaqList() {
  const [open, setOpen] = useState(0);

  return (
    <div className="faq-list">
      {FAQS.map((item, i) => {
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
