import { Link } from 'react-router-dom';
import LegalPage from './LegalPage';

const CONTACT = 'myindiaservice1@gmail.com';

export default function DataDeletion() {
  return (
    <LegalPage title="User data deletion" updated="16 August 2026">
      <p>
        This page explains how to remove Facebook, Instagram, YouTube, and SocialAiDigital account data. Meta
        requires a public data-deletion URL for apps that use Facebook Login.
      </p>

      <h2>Disconnect a social channel</h2>
      <ol>
        <li>
          Sign in to SocialAiDigital and open <Link to="/app/connections">Connect</Link>.
        </li>
        <li>Use Reconnect or remove/disconnect for Facebook, Instagram, or YouTube.</li>
        <li>
          We delete the stored access token, refresh token, and Page/channel IDs for that platform
          from your workspace.
        </li>
      </ol>
      <p>
        You should also revoke SocialAiDigital in Facebook Settings → Business integrations (and Google
        account permissions for YouTube) so the platform stops issuing tokens.
      </p>

      <h2>Delete synced comments</h2>
      <p>
        Disconnecting a channel stops new syncs. To delete previously synced comments or your whole
        SocialAiDigital account, email us (below). We will remove associated comment records and connection
        documents for your user.
      </p>

      <h2>Delete your SocialAiDigital account</h2>
      <p>
        Email{' '}
        <a href={`mailto:${CONTACT}?subject=SocialAiDigital%20account%20deletion`}>{CONTACT}</a> from
        the address on your account. Include “Delete my SocialAiDigital account” in the subject. We will
        delete your user record, OAuth connections, and comments tied to that account, typically
        within 14 days, unless we must retain a limited record for security or legal reasons.
      </p>

      <h2>Facebook Login callback</h2>
      <p>
        If Meta sends users here after a deletion request, follow the same email process and
        include your Facebook user ID if Facebook provided one. We will locate and delete matching
        connection tokens and synced Facebook comments.
      </p>
    </LegalPage>
  );
}
