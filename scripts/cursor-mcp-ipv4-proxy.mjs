/**
 * Facebook MCP OAuth redirects to http://127.0.0.1:8787/callback
 * while Cursor often listens only on IPv6 [::1]:8787 — Chrome then
 * gets ERR_CONNECTION_REFUSED. This forwards IPv4 → IPv6.
 *
 * 1. Cursor → Authenticate (Cursor binds [::1]:8787)
 * 2. node scripts/cursor-mcp-ipv4-proxy.mjs
 * 3. Facebook → Continue
 * 4. Ctrl+C after login succeeds
 */
import http from 'node:http';

const LISTEN_HOST = '127.0.0.1';
const LISTEN_PORT = 8787;
const TARGET_HOST = '::1';
const TARGET_PORT = 8787;

const server = http.createServer((req, res) => {
  const headers = { ...req.headers, host: `[${TARGET_HOST}]:${TARGET_PORT}` };
  const proxy = http.request(
    {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      family: 6,
      path: req.url,
      method: req.method,
      headers,
    },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    }
  );

  proxy.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(
      `Proxy could not reach Cursor on [${TARGET_HOST}]:${TARGET_PORT}\n${err.message}\nStart Authenticate in Cursor first.\n`
    );
  });

  req.pipe(proxy);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `127.0.0.1:${LISTEN_PORT} is already in use. Stop whatever is bound to IPv4 :${LISTEN_PORT} and retry.`
    );
  } else {
    console.error(err.message);
  }
  process.exit(1);
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(
    `Forwarding http://${LISTEN_HOST}:${LISTEN_PORT} → http://[${TARGET_HOST}]:${TARGET_PORT}`
  );
  console.log('Leave this running, then Continue on Facebook. Ctrl+C when MCP is connected.');
});
