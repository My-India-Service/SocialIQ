import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);
const MAX_AUTO_RETRIES = 2;

async function fetchMe(token, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await api('/api/auth/me', { token });
    } catch (err) {
      lastErr = err;
      const status = err?.status;
      if (status === 401 || status === 403) throw err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('voxa_token'));
  const [loading, setLoading] = useState(true);
  const [sessionRetry, setSessionRetry] = useState(0);
  const [sessionError, setSessionError] = useState(null);
  const userRef = useRef(user);
  const loadingRef = useRef(loading);
  userRef.current = user;
  loadingRef.current = loading;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setLoading(false);
        setSessionError(null);
        return;
      }
      setLoading(true);
      setSessionError(null);
      try {
        const data = await fetchMe(token);
        if (!cancelled) {
          setUser(data.user);
          setSessionError(null);
        }
      } catch (err) {
        // Only wipe session on real auth failure — not network/5xx after OAuth return.
        const status = err?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem('voxa_token');
          if (!cancelled) {
            setToken(null);
            setUser(null);
            setSessionError(null);
          }
        } else if (!cancelled) {
          setUser(null);
          const message =
            err?.message ||
            'Cannot restore your session. The API may be offline or waking up.';
          if (sessionRetry < MAX_AUTO_RETRIES) {
            setTimeout(() => {
              if (!cancelled) setSessionRetry((n) => n + 1);
            }, 1200);
          } else {
            setSessionError(message);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token, sessionRetry]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      if (!token || userRef.current || loadingRef.current) return;
      setSessionError(null);
      setSessionRetry((n) => n + 1);
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [token]);

  function loginSuccess({ token: nextToken, user: nextUser }) {
    localStorage.setItem('voxa_token', nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setSessionError(null);
    setSessionRetry(0);
  }

  function logout() {
    localStorage.removeItem('voxa_token');
    setToken(null);
    setUser(null);
    setSessionError(null);
    setSessionRetry(0);
  }

  function retrySession() {
    setSessionError(null);
    setSessionRetry((n) => n + 1);
  }

  async function refreshUser() {
    if (!token) return null;
    const data = await fetchMe(token);
    setUser(data.user);
    setSessionError(null);
    return data.user;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        sessionError,
        loginSuccess,
        logout,
        retrySession,
        setUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
