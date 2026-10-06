import crypto from 'crypto';

/** Admin login email from ADMIN_EMAIL, or the first address in ADMIN_EMAILS. */
export function adminEmail() {
  const single = String(process.env.ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  if (single.includes('@')) return single;
  const fromList = String(process.env.ADMIN_EMAILS || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .find((s) => s.includes('@'));
  return fromList || '';
}

function sameSecret(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** True only when both email and password match the values in the server env. */
export function adminCredentialsMatch(email, password) {
  const expectedEmail = adminEmail();
  const expectedPassword = process.env.ADMIN_PASSWORD || '';
  if (!expectedEmail || !expectedPassword) return false;
  const emailOk = String(email || '').trim().toLowerCase() === expectedEmail;
  return emailOk && sameSecret(password || '', expectedPassword);
}
