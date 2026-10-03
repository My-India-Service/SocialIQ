import { Link } from 'react-router-dom';
import LegalPage from './LegalPage';
import usePageMeta from '../hooks/usePageMeta';
import { GUIDE_STEPS, MAIN_OBJECTIVE, OBJECTIVES } from '../data/helpContent';

export default function About() {
  usePageMeta({
    title: 'About',
    description:
      'What SocialAiDigital does: one inbox for social comments with AI lead detection, complaint alerts, brand-tone replies and revenue tracking for Indian brands.',
    path: '/about',
  });
  return (
    <LegalPage title="About SocialAiDigital" updated="25 August 2026">
      <h2>Main objective</h2>
      <p>
        <strong>{MAIN_OBJECTIVE.title}.</strong> {MAIN_OBJECTIVE.body}
      </p>
      <ul>
        {OBJECTIVES.map((item) => (
          <li key={item.title}>
            <strong>{item.title}.</strong> {item.body}
          </li>
        ))}
      </ul>

      <h2 id="guide">User guide</h2>
      <p>Use SocialAiDigital in this order. The inbox is the screen you live in; the rest is setup and reporting.</p>
      <ol className="guide-list">
        {GUIDE_STEPS.map((step) => (
          <li key={step.title}>
            <strong>{step.title.replace(/^\d+\.\s/, '')}</strong>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>

      <p>
        Setup questions: <Link to="/faq">FAQ</Link>. Plans:{' '}
        <Link to="/pricing">Pricing</Link>. After login, the same guide is under{' '}
        <Link to="/app/help">Help</Link>; change plans in <Link to="/app/billing">Billing</Link>.
      </p>
    </LegalPage>
  );
}
