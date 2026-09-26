import { useEffect, useState } from 'react';
import { api } from '../api';

/** Public sign-in options: { emailOtp, googleLogin }. Defaults hide both until loaded. */
export default function useAuthConfig() {
  const [config, setConfig] = useState({ emailOtp: false, googleLogin: false });
  useEffect(() => {
    let cancelled = false;
    api('/api/auth/config')
      .then((data) => {
        if (!cancelled) setConfig({ emailOtp: Boolean(data.emailOtp), googleLogin: Boolean(data.googleLogin) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return config;
}
