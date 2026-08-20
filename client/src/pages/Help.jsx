import { Link } from 'react-router-dom';
import { GUIDE_STEPS, MAIN_OBJECTIVE, OBJECTIVES } from '../data/helpContent';
import { FaqList } from './Faq';

export default function Help() {
  return (
    <div className="help-page">
      <div className="page-head">
        <div>
          <h1>How to use Voxa</h1>
          <p>{MAIN_OBJECTIVE.title}</p>
        </div>
      </div>

      <div className="panel stack-gap objective-panel">
        <h2>Main objective</h2>
        <p className="objective-lead">{MAIN_OBJECTIVE.body}</p>
        <ul className="objective-list">
          {OBJECTIVES.map((item) => (
            <li key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel stack-gap">
        <h2>User guide</h2>
        <p className="prob" style={{ marginTop: 0 }}>
          Follow the steps once. After that, start each day in Inbox.
        </p>
        <ol className="guide-cards">
          {GUIDE_STEPS.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="prob">
          Public copies: <Link to="/about">About</Link>
          {' · '}
          <Link to="/faq">FAQ</Link>
          {' · '}
          <Link to="/pricing">Pricing</Link>
          {' · '}
          <Link to="/app/billing">Billing</Link>
        </p>
      </div>

      <div className="panel">
        <h2>FAQ</h2>
        <FaqList />
      </div>
    </div>
  );
}
