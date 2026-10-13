# SocialIQ API on Spidyhost (cPanel Node.js app)

The API runs as a cPanel **Setup Node.js App** (Phusion Passenger) at `https://api.myindiaservice.com`.
The frontend stays on Render (`www.socialaidigital.com`) and calls the API cross-origin (bearer token auth, CORS via `CLIENT_URL`).
The Render API keeps running until cutover (step 7) and is the rollback.

| Endpoint | Meaning |
|---|---|
| `GET /api/health/live` | Always 200 while the Node process is up |
| `GET /api/health/ready` | 200 when MongoDB is connected, 503 otherwise |
| `GET /api/health` | Product info and which OAuth providers are configured |

## 1. Subdomain and SSL

1. cPanel → **Domains** → Create a New Domain → `api.myindiaservice.com`. Uncheck "share document root"; the default root (e.g. `~/api.myindiaservice.com`) is fine, the Node app overrides it.
2. If `myindiaservice.com` DNS is not on this cPanel, add an `A` record `api` → the cPanel server IP at your DNS provider. If it is behind Cloudflare, set SSL mode to **Full** for that zone.
3. cPanel → **SSL/TLS Status** → select `api.myindiaservice.com` → **Run AutoSSL**.

## 2. Upload the server code

On your Mac, from the repo root:

```bash
cd server && zip -r ../socialiq-api.zip . -x 'node_modules/*' '.env' 'logs/*' && cd ..
```

cPanel → **File Manager** → create `~/socialiq-api` → Upload `socialiq-api.zip` → Extract → delete the zip.
`~/socialiq-api` must directly contain `app.cjs`, `index.js`, `package.json`, `package-lock.json`, `routes/`, `services/`, …

(Alternative: cPanel → Git Version Control → clone the repo, then point the app root at `<clone>/server`. A private GitHub repo needs a cPanel SSH key added as a GitHub deploy key.)

## 3. Setup Node.js App

cPanel → **Setup Node.js App** → Create Application:

| Field | Value |
|---|---|
| Node.js version | 22 (or the highest available, at least 20) |
| Application mode | Production |
| Application root | `socialiq-api` |
| Application URL | `api.myindiaservice.com` |
| Application startup file | `app.cjs` |

Then:

1. **Environment variables:** add every non-empty key from [env/production.env.example](env/production.env.example) with the real values from Render. (Or create `~/socialiq-api/.env` in File Manager with the same content; `server/loadEnv.js` reads it.) Do not set `PORT`. Keep `CRISIS_MONITOR_ENABLED=false`.
2. Click **Save** → **Run NPM Install** (wait until it finishes) → **Restart**.

## 4. MongoDB Atlas

Find the host's outbound IP: cPanel → **Terminal** → `curl -s ifconfig.me` (or the "Shared IP Address" on the cPanel home page; ask Spidyhost support if they differ).
Atlas (SocialIQ project) → **Network Access** → Add IP Address → `<that IP>/32` → then Restart the Node app.

## 5. Verify

```bash
curl -i https://api.myindiaservice.com/api/health/live    # 200 {"ok":true,...}
curl -i https://api.myindiaservice.com/api/health/ready   # 200 {"db":"connected"}
curl -s https://api.myindiaservice.com/api/health         # oauth.youtube / meta true
curl -i -X POST https://api.myindiaservice.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<socialiq user>","password":"<password>"}' # 200 with token
```

Troubleshooting:
- "Incomplete response" / 503 page from Passenger → the app crashed at startup. Open `~/socialiq-api/stderr.log` (or the log path shown in Setup Node.js App). Usual causes: missing env vars, Atlas IP not allowed (`MongooseServerSelectionError`), NPM install not run.
- After changing env vars or uploading code → **Restart** the app (or `touch ~/socialiq-api/tmp/restart.txt`).

## 6. OAuth and webhooks (add new URLs, keep the Render ones)

- **Google Cloud** (same OAuth client):
  - Authorized redirect URIs: `https://api.myindiaservice.com/api/connections/youtube/callback`, `https://api.myindiaservice.com/api/auth/google/callback`.
  - Google Auth Platform → Branding → Authorized domains: add `myindiaservice.com`. The domain must be verified in Google Search Console by the same Google account. Adding a domain can trigger a re-review of the pending verification; expect that.
- **Meta** (Facebook app): App Domains add `myindiaservice.com`; Facebook Login → Valid OAuth Redirect URIs add `https://api.myindiaservice.com/api/connections/meta/callback`.
- **Meta** (Instagram app): redirect `https://api.myindiaservice.com/api/connections/instagram/callback`; webhook `https://api.myindiaservice.com/api/instagram/webhook` (only if Instagram messaging is enabled).
- **LinkedIn / TikTok** (if used): `/api/connections/linkedin/callback`, `/api/connections/tiktok/callback` on the new host.
- **Razorpay** → Webhooks: `https://api.myindiaservice.com/api/checkout/razorpay/webhook` (same secret).

## 7. Cutover

1. In the repo, edit `client/public/runtime-config.js` so `www.socialaidigital.com` / `socialaidigital.com` use `https://api.myindiaservice.com` (keep `*.onrender.com` on the Render API), then push to `main`. Render rebuilds the static site in a few minutes.
2. Spidyhost: set `CRISIS_MONITOR_ENABLED=true` → Restart. Render (voxa-api): set `CRISIS_MONITOR_ENABLED=false`.
3. Open `https://www.socialaidigital.com/login` with DevTools → Network: requests must go to `api.myindiaservice.com`. Test login, Inbox, Connect YouTube + Sync, Billing.

**Rollback:** revert `runtime-config.js`, push, and swap `CRISIS_MONITOR_ENABLED` back.

After a quiet week: remove the `socialiq-37aa.onrender.com` redirect URIs from Google/Meta and suspend the Render API service.

## Caveats

- **Idle shutdown:** Passenger on shared hosting stops idle apps, which also pauses the hourly crisis monitor. Add a free uptime monitor (e.g. UptimeRobot) on `https://api.myindiaservice.com/api/health/live` every 5 minutes, or a cPanel cron: `*/5 * * * * curl -fsS https://api.myindiaservice.com/api/health/live >/dev/null`.
- **Timeouts:** long YouTube syncs can hit the host's proxy timeout (often 60–120 s). If a full sync fails with 502/504, ask Spidyhost support for the limit.
- **Memory:** check the plan's per-app memory limit (CloudLinux LVE, cPanel home → Resource Usage). The API needs about 200–300 MB; `npm install` needs more briefly.
- **Updates:** re-upload changed files (or the full zip without `node_modules`), Run NPM Install if `package.json` changed, then Restart.
