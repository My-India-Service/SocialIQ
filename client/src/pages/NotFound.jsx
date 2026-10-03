import { Link } from 'react-router-dom';
import LegalPage from './LegalPage';
import usePageMeta from '../hooks/usePageMeta';

export default function NotFound() {
  usePageMeta({ title: 'Page not found', noindex: true });
  return (
    <LegalPage title="Page not found">
      <p>The page you're looking for doesn't exist or has moved.</p>
      <div className="reply-actions">
        <Link className="btn btn-citrus" to="/">
          Go to home
        </Link>
        <Link className="btn btn-ghost" to="/pricing">
          See pricing
        </Link>
        <Link className="btn btn-ghost" to="/login">
          Log in
        </Link>
      </div>
    </LegalPage>
  );
}
