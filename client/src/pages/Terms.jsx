import { Link } from 'react-router-dom';
import LegalPage from './LegalPage';
import usePageMeta from '../hooks/usePageMeta';

const CONTACT = 'myindiaservice1@gmail.com';

export default function Terms() {
  usePageMeta({
    title: 'Terms of Service',
    description:
      'Terms for using SocialAiDigital, the AI sales agent for social media comments: accounts, connected platforms, acceptable use, billing and liability.',
    keywords: ['terms of service', 'acceptable use', 'billing terms'],
    path: '/terms',
  });
  return (
    <LegalPage title="Terms of Service" updated="7 October 2026">
      <p>
        These terms govern your use of SocialAiDigital, including connecting social accounts through Facebook
        Login, Instagram, and YouTube. By creating an account or using the product, you agree to
        them.
      </p>

      <h2>The service</h2>
      <p>
        SocialAiDigital helps you ingest comments from connected Pages and channels, categorize buying intent,
        and draft replies. Features depend on third-party APIs remaining available and on the
        permissions you grant.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must provide accurate account information and keep credentials secure.</li>
        <li>You are responsible for activity under your login.</li>
        <li>You must have the right to connect any Facebook Page, Instagram account, or YouTube channel you authorize.</li>
      </ul>

      <h2>OAuth and permissions</h2>
      <p>
        When you click Connect, Meta or Google may ask for scopes such as reading Page comments or
        YouTube comment threads. You can revoke access in those platforms and in SocialAiDigital Connect.
        Tokens are stored only to sync data you requested.
      </p>

      <h2>Third-party APIs</h2>
      <p>
        Facebook, Instagram, and YouTube are operated by Meta and Google. Graph or YouTube APIs may
        return incomplete data (for example comments visible in Comments Manager but not via Graph
        while an app is in Development mode or before App Review). SocialAiDigital does not guarantee that
        every comment on a platform will appear in the inbox.
      </p>
      <p>
        SocialAiDigital uses YouTube API Services. By connecting a YouTube channel you also agree
        to be bound by the <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>{' '}
        and acknowledge the <a href="https://policies.google.com/privacy">Google Privacy Policy</a>.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not use SocialAiDigital to spam, harass, or violate platform policies.</li>
        <li>Do not attempt to access other customers’ workspaces or bypass authentication.</li>
        <li>Do not scrape or resell data obtained through SocialAiDigital except as allowed for your own brand operations.</li>
      </ul>

      <h2>Limitation of liability</h2>
      <p>
        SocialAiDigital is provided as-is. We are not liable for outages, Meta/Google API changes, missed
        comments, or business results from suggested replies. To the extent permitted by law,
        liability is limited to fees you paid us in the prior three months (if any).
      </p>

      <h2>Privacy</h2>
      <p>
        How we handle personal data is described in our <a href="/privacy-policy.html">Privacy Policy</a>.
        How to delete data is described at <Link to="/data-deletion">User data deletion</Link>.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </LegalPage>
  );
}
