const API_BASE = import.meta.env.VITE_API_URL || '';

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const err = new Error(
      'Cannot reach the API. Start the Voxa server (cd server && npm start) and refresh.'
    );
    err.status = 0;
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      data.message ||
        (res.status === 404
          ? 'API route not found — is the Voxa server running on the correct port?'
          : `Request failed (${res.status})`)
    );
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Authenticated file download (CSV, etc.) — does not parse JSON. */
export async function downloadFile(path, { token, fallbackFilename = 'download' } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { headers });
  } catch {
    const err = new Error(
      'Cannot reach the API. Start the Voxa server (cd server && npm start) and refresh.'
    );
    err.status = 0;
    throw err;
  }

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

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
