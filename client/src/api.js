/** API is served on the same origin as the site (/api/*); Vite proxies /api in dev. */
const API_BASE = '';

const FETCH_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutErr = new Error(
        'Request timed out. The API may be waking up — try again.'
      );
      timeoutErr.status = 0;
      throw timeoutErr;
    }
    const networkErr = new Error(
      'Cannot reach the API. Check that the server is running and try again.'
    );
    networkErr.status = 0;
    throw networkErr;
  } finally {
    clearTimeout(timer);
  }
}

export async function api(path, { method = 'GET', body, token, timeoutMs } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetchWithTimeout(
    `${API_BASE}${path}`,
    {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    },
    timeoutMs || FETCH_TIMEOUT_MS
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      data.message ||
        (res.status === 404
          ? 'API route not found — is the server running on the correct port?'
          : `Request failed (${res.status})`)
    );
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Authenticated file download (CSV, etc.) — does not parse JSON.
 * @returns {{ filename: string, exportCount: number|null }}
 */
export async function downloadFile(path, { token, fallbackFilename = 'download' } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetchWithTimeout(`${API_BASE}${path}`, { headers });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.message || `Download failed (${res.status})`);
    err.status = res.status;
    throw err;
  }

  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/i.exec(cd);
  const filename = match?.[1] || fallbackFilename;
  const countHeader = res.headers.get('X-Export-Count');
  const exportCount = countHeader != null && countHeader !== '' ? Number(countHeader) : null;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { filename, exportCount: Number.isFinite(exportCount) ? exportCount : null };
}
