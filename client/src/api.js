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
    throw new Error(
      'Cannot reach the API. Start the Voxa server (cd server && npm start) and refresh.'
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.message ||
        (res.status === 404
          ? 'API route not found — is the Voxa server running on the correct port?'
          : `Request failed (${res.status})`)
    );
  }
  return data;
}
