import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { postAuthPath } from '../utils/onboarding';

/** Landing page after Google OAuth; the server passes the JWT in the URL hash. */
export default function GoogleCallback() {
  const { loginSuccess } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('token');
    const plan = params.get('plan') || undefined;
    window.history.replaceState(null, '', window.location.pathname);
    if (!token) {
      setError('Google sign-in did not return a session. Please try again.');
      return;
    }
    api('/api/auth/me', { token })
      .then(({ user }) => {
        loginSuccess({ token, user });
        navigate(postAuthPath(user, plan), { replace: true });
      })
      .catch((err) => setError(err.message));
  }, [loginSuccess, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-panel">
        {error ? (
          <>
            <div className="error-banner">{error}</div>
            <Link to="/login" className="btn btn-citrus">
              Back to login
            </Link>
          </>
        ) : (
          <p>Signing you in with Google…</p>
        )}
      </div>
    </div>
  );
}
