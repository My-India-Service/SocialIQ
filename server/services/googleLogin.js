import jwt from 'jsonwebtoken';

const SCOPES = 'openid email profile';
const STATE_PURPOSE = 'google_login';

function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google sign-in is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).');
  }
  const redirectUri =
    process.env.GOOGLE_LOGIN_REDIRECT_URI ||
    `${process.env.SERVER_URL || 'http://localhost:5001'}/api/auth/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

export function getGoogleLoginUrl({ plan } = {}) {
  const { clientId, redirectUri } = getConfig();
  const state = jwt.sign({ purpose: STATE_PURPOSE, plan: plan || '' }, process.env.JWT_SECRET, {
    expiresIn: '10m',
  });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    prompt: 'select_account',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function verifyGoogleLoginState(state) {
  const payload = jwt.verify(state, process.env.JWT_SECRET);
  if (payload.purpose !== STATE_PURPOSE) throw new Error('Invalid Google sign-in state');
  return payload;
}

/** Exchange the auth code and return the verified Google profile. */
export async function fetchGoogleProfile(code) {
  const { clientId, clientSecret, redirectUri } = getConfig();
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(tokens.error_description || tokens.error || 'Google token exchange failed');
  }

  const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const info = await infoRes.json();
  if (!infoRes.ok || !info.sub) {
    throw new Error(info.error_description || 'Could not read Google profile');
  }
  if (!info.email || info.email_verified === false) {
    throw new Error('Your Google account email is not verified');
  }

  return {
    googleId: String(info.sub),
    email: String(info.email).toLowerCase(),
    name: info.name || info.given_name || info.email.split('@')[0],
  };
}
