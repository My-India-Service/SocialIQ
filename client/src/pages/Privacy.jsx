import { Link } from 'react-router-dom';
import LegalPage from './LegalPage';
import usePageMeta from '../hooks/usePageMeta';

const CONTACT = 'myindiaservice1@gmail.com';

export default function Privacy() {
  usePageMeta({
    title: 'Privacy Policy',
    description:
      'How SocialAiDigital collects, uses and protects data, including Google (YouTube, Sign-In) and Meta (Facebook, Instagram) user data.',
    path: '/privacy',
  });
  return (
    <LegalPage title="Privacy Policy" updated="26 September 2026">
      <p>
        SocialAiDigital (“we”, “our”) is a revenue intelligence dashboard that helps brands read, categorize,
        and reply to comments from connected social accounts. This policy explains what we collect
        and how we use it when you use SocialAiDigital, including Facebook Login and related Meta APIs.
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

      <h2>Google user data (YouTube and Google Sign-In)</h2>
      <ul>
        <li>
          <strong>Data accessed:</strong> for Google Sign-In, your Google account ID, name, and
          email. For YouTube, with your consent, your channel ID and name, comments on your videos,
          and the ability to post replies and set comment moderation status (
          <code>youtube.readonly</code>, <code>youtube.force-ssl</code>).
        </li>
        <li>
          <strong>How we use it:</strong> to sign you in, sync comments into your inbox,
          categorize them, draft replies, and post replies or moderate only when you ask or enable
          an automation that does so.
        </li>
        <li>
          <strong>Storage and protection:</strong> sent over HTTPS and stored in an
          access-controlled database; OAuth tokens stay server-side.
        </li>
        <li>
          <strong>Sharing:</strong> never sold or used for advertising; only shared with the
          hosting, database, and (if enabled) AI providers needed to run the features above. Not
          used to train generalized AI or machine-learning models.
        </li>
        <li>
          <strong>Deletion:</strong> disconnect YouTube in Connect, revoke access at{' '}
          <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>,
          or email {CONTACT} to delete your account and data.
        </li>
      </ul>
      <p>
        <strong>
          SocialAiDigital's use and transfer of information received from Google APIs to any other
          app will adhere to the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </strong>
      </p>

      <h2>Analytics</h2>
      <p>
        Our website uses Google Analytics, which sets cookies to measure how visitors use the site
        (for example pages viewed, device type and approximate location). We use this only to
        improve SocialAiDigital. Learn how Google uses this data at{' '}
        <a href="https://policies.google.com/technologies/partner-sites">
          policies.google.com/technologies/partner-sites
        </a>
        . You can block these cookies in your browser settings or with the{' '}
        <a href="https://tools.google.com/dlpage/gaoptout">Google Analytics opt-out add-on</a>.
      </p>

      <h2>Sharing</h2>
      <p>We do not sell your personal data. We share data only as needed to run SocialAiDigital:</p>
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
