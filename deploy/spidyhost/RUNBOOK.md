# SocialAiDigital on Spidyhost (cPanel Node.js app, MIS style)

One cPanel **Setup Node.js App** runs the whole product at `https://www.socialaidigital.com`:

```
Browser ──► Cloudflare ──► cPanel Node app (~/socialiq, startup server/app.cjs)
                              ├── /api/*  → Express API
                              └── /*      → client/dist (committed React build, SPA fallback)
                                   │
                                   ▼
                              MongoDB Atlas
```

- Same origin: the site calls `/api` on its own domain (no CORS, no API URL setting). OAuth callbacks use `https://www.socialaidigital.com/api/...`, the domain already verified with Google.
- The client calls relative `/api/...` only (`API_BASE = ''` in `client/src/api.js`), exactly like MIS (`https://myindiaservice.com/api/...`).

## CloudLinux rules (same as MIS)

1. **npm installs only from the app-root `package.json`** into a virtualenv (`~/socialiq/node_modules` is a symlink). The root [package.json](../../package.json) therefore lists the server's runtime `dependencies`; `server/tests/rootDeps.test.js` fails if they drift. When you add a server dependency, add it to both.
2. **devDependencies are never installed**, so Vite cannot run on the server. Build locally and commit `client/dist`.
3. Upload code with **git**, not ZIPs (cPanel antivirus flags archives).
4. Activate the virtualenv in every new Terminal session: `source ~/nodevenv/socialiq/20/bin/activate && cd ~/socialiq`.

| Check | Expected |
|---|---|
| `/api/health/live` | 200 while the process is up |
| `/api/health/ready` | 200 when MongoDB is connected, 503 otherwise |
| `/api/health` | product info + OAuth providers configured |

---

## 1. Code on the server

cPanel → **Terminal**:

```bash
ssh-keygen -t ed25519 -N '' -C spidyhost-socialiq -f ~/.ssh/socialiq_deploy
cat ~/.ssh/socialiq_deploy.pub
```

GitHub → `My-India-Service/SocialIQ` → Settings → **Deploy keys** → Add key → paste → read-only.

```bash
cat >> ~/.ssh/config <<'EOF'
Host github-socialiq
  HostName github.com
  User git
  IdentityFile ~/.ssh/socialiq_deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
git clone github-socialiq:My-India-Service/SocialIQ.git ~/socialiq
ls ~/socialiq/client/dist/index.html ~/socialiq/server/app.cjs
```

## 2. Domain and Node.js app

1. cPanel → **Domains** → Create a New Domain → `socialaidigital.com` (uncheck "share document root"). `www` is included automatically.
2. cPanel → **Setup Node.js App** → Create Application:

   | Field | Value |
   |---|---|
   | Node.js version | 20 (or 22 if listed) |
   | Application mode | Production |
   | Application root | `socialiq` |
   | Application URL | `socialaidigital.com` |
   | Application startup file | `server/app.cjs` |

3. **Environment:** create `~/socialiq/server/.env` from [env/production.env.example](env/production.env.example) with the real values (one-time copy from the current `~/api/.env` or the old Render service):
   ```bash
   nano ~/socialiq/server/.env && chmod 600 ~/socialiq/server/.env
   ```
   Leave the panel's Environment variables **empty**: panel values override `.env` (this caused the old Google client ID to stick on `~/api`). Keep `CRISIS_MONITOR_ENABLED=false` until cutover.
4. **Run NPM Install** → **Restart**.
5. MongoDB Atlas → Network Access must include the server IP (`curl -s ifconfig.me`; already added for `~/api`).

## 3. Test before DNS

On your Mac, point the domain at cPanel temporarily (find the IP on the cPanel home page, "Shared IP Address"):

```bash
sudo sh -c 'echo "<CPANEL_IP> www.socialaidigital.com socialaidigital.com" >> /etc/hosts'
```

Then check (`-k` because the certificate may not be issued yet):

```bash
curl -sk https://www.socialaidigital.com/api/health/ready
curl -sk https://www.socialaidigital.com/ | head -5
curl -skI https://www.socialaidigital.com/privacy-policy.html | head -3
```

Open `https://www.socialaidigital.com/login` in a private window and test login, Inbox, Billing. Remove the `/etc/hosts` line afterwards (`sudo nano /etc/hosts`).

## 4. OAuth and webhooks (add the www URLs)

- **Google** (client `618678023530-…`) → Authorized redirect URIs:
  `https://www.socialaidigital.com/api/connections/youtube/callback`, `https://www.socialaidigital.com/api/auth/google/callback`.
- **Meta** (Facebook app): Valid OAuth Redirect URIs `https://www.socialaidigital.com/api/connections/meta/callback`.
- **Meta** (Instagram app): redirect `https://www.socialaidigital.com/api/connections/instagram/callback`; webhook `https://www.socialaidigital.com/api/instagram/webhook` (verify token from `.env`).
- **Razorpay** → Webhooks: `https://www.socialaidigital.com/api/checkout/razorpay/webhook`.

## 5. Cutover

1. Cloudflare → **socialaidigital.com** → DNS: set `@` and `www` to **A → `<CPANEL_IP>`**, Proxied (replacing the old Render CNAMEs).
2. SSL/TLS mode **Full**. cPanel → SSL/TLS Status → Run **AutoSSL** for `socialaidigital.com` + `www` (or install a Cloudflare Origin Certificate via cPanel → SSL/TLS → Manage SSL sites). Then switch Cloudflare to **Full (strict)**.
3. `~/socialiq/server/.env`: `CRISIS_MONITOR_ENABLED=true` → Restart (the hourly monitor now runs only here).
4. Verify: `curl -sI https://www.socialaidigital.com` (served by the cPanel server, not Render), login, Connect YouTube + Sync, `tail -n 50 ~/socialiq/stderr.log`.
5. cPanel → Cron Jobs: `*/5 * * * * curl -fsS https://www.socialaidigital.com/api/health/live >/dev/null 2>&1` (keeps the app warm and the hourly monitor running).

**Rollback (until Render is deleted):** point `@` and `www` back to the old Render CNAMEs.

## 6. Deploying updates

Local:

```bash
npm run build:client                 # needed for any client change
git add -A client/dist client/src server
git commit -m "…" && git push
```

Server (Terminal):

```bash
source ~/nodevenv/socialiq/20/bin/activate && cd ~/socialiq
git pull
```

Root `package.json` changed → **Run NPM Install**. Always → **Restart** (or `touch ~/socialiq/tmp/restart.txt`).

| Change | Local | Server |
|---|---|---|
| Client only | build, commit `client/dist`, push | `git pull`, Restart |
| Server only | commit, push | `git pull`, Restart (+ NPM Install if deps changed) |

## 7. Final Render shutdown (after a quiet week)

- Render: suspend, then delete `voxa-api` and `voxa-web` (the repo no longer has `render.yaml`, and new builds would call a `/api` that a static site does not have).
- cPanel: remove the old `api` Node app (`~/api`) or point `api.myindiaservice.com` at `~/socialiq` as an alias.
- Google / Meta: remove `socialiq-37aa.onrender.com` and `api.myindiaservice.com` redirect URIs.

## Troubleshooting

| Symptom | Fix |
|---|---|
| 503 page | `tail -n 40 ~/socialiq/stderr.log`; or in Terminal (venv on) `node server/app.cjs` to see the error |
| `Cannot find package 'express'` | Root `package.json` missing the dependency → add it, push, `git pull`, Run NPM Install |
| Site blank but `/api/health` works | `client/dist` missing → build locally, commit, `git pull` |
| Old settings still used after editing `.env` | Panel Environment variables override `.env` → delete them there; then `touch ~/socialiq/tmp/restart.txt` and `pkill -u $USER -f lsnode` |
| `redirect_uri_mismatch` | Check the live client: `curl -s https://www.socialaidigital.com/api/auth/google \| grep -o 'client_id=[^&]*'` and add the URI to that client |
| `ready` returns 503 | Atlas IP allowlist / `MONGODB_URI` |
