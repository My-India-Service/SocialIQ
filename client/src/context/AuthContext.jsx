import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await fetchMe(token);
        if (!cancelled) setUser(data.user);
      } catch (err) {
        // Only wipe session on real auth failure — not network/5xx after OAuth return.
        const status = err?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem('voxa_token');
          if (!cancelled) {
            setToken(null);
            setUser(null);
          }
        } else if (!cancelled) {
          setUser(null);
          // One delayed retry after OAuth full-page return when API was briefly down.
          if (sessionRetry < 2) {
            setTimeout(() => {
              if (!cancelled) setSessionRetry((n) => n + 1);
            }, 1200);
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

  function loginSuccess({ token: nextToken, user: nextUser }) {
    localStorage.setItem('voxa_token', nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }

  function logout() {
    localStorage.removeItem('voxa_token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, loginSuccess, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
