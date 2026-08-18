/**
 * Resolve the browser origin for redirects (OAuth callbacks, password reset).
 * CLIENT_URL may be comma-separated. In production, prefer a public https URL
 * so Facebook Connect does not land on localhost (which has no JWT).
 */
export function getClientUrl() {
  const entries = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (!entries.length) return 'http://localhost:5173';

  if (process.env.NODE_ENV === 'production') {
    const live = entries.find(
      (u) => u.startsWith('https://') && !/localhost|127\.0\.0\.1/i.test(u)
    );
    if (live) return live;
  }

  return entries[0];
}
