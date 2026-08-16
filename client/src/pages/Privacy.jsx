import { Link } from 'react-router-dom';
import LegalPage from './LegalPage';

const CONTACT = 'narsingh.bind@gmail.com';

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="16 August 2026">
      <p>
        Voxa (“we”, “our”) is a revenue intelligence dashboard that helps brands read, categorize,
        and reply to comments from connected social accounts. This policy explains what we collect
        and how we use it when you use Voxa, including Facebook Login and related Meta APIs.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> name, email, password (stored hashed), brand settings, and
          session tokens.
        </li>
        <li>
          <strong>OAuth connections:</strong> when you connect Facebook, Instagram, or YouTube we
          store access tokens, refresh tokens, Page or channel IDs, and account names so we can
          sync on your behalf.
        </li>
        <li>
          <strong>Social content:</strong> comments, authors, post titles, timestamps, and related
          metadata pulled from official APIs (Meta Graph, YouTube Data API).
        </li>
        <li>
          <strong>Usage:</strong> basic product actions such as sync, login, and settings changes
          needed to operate the service.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>Sign you in and keep your workspace secure.</li>
        <li>Sync comments into the Revenue inbox and related dashboards.</li>
        <li>Categorize intent and draft replies (rules and, if configured, OpenAI).</li>
        <li>Send optional emails such as password reset or daily reports when SMTP is set.</li>
      </ul>

      <h2>Sharing</h2>
      <p>We do not sell your personal data. We share data only as needed to run Voxa:</p>
      <ul>
        <li>Meta (Facebook/Instagram APIs) and Google (YouTube) when you connect those accounts.</li>
        <li>OpenAI, if an API key is configured, for comment analysis.</li>
        <li>Hosting and database providers (for example Render and MongoDB Atlas).</li>
        <li>Email delivery providers if SMTP is configured.</li>
      </ul>

      <h2>Retention</h2>
      <p>
        We keep account, connection, and synced comment data while your workspace is active. You
        can disconnect a channel in Connect, which removes stored OAuth tokens for that platform.
        You may request deletion of your account and associated data (see{' '}
        <Link to="/data-deletion">User data deletion</Link>).
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Disconnect Facebook, Instagram, or YouTube at any time from Connect.</li>
        <li>Change or reset your password from the login and settings flows.</li>
        <li>Email {CONTACT} to access, correct, or delete personal data we hold.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions about this policy: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </LegalPage>
  );
}
