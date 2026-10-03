# Render Deployment Guide — SocialAiDigital

This project is a **two-package monorepo** (`client/` + `server/`). On Render you create **two services** from the same GitHub repo.

## Architecture

```
GitHub repo (SocialIQ / SocialAiDigital)
├── Web Service  → Express API  (Node.js, rootDir: server)
├── Static Site  → React build  (Vite → client/dist)
└── MongoDB Atlas (database)
```

The static site calls the API over HTTPS. Auth uses **Bearer JWT** in the `Authorization` header (not cookies).

**Production URLs:** see [CUSTOM_DOMAINS.md](./CUSTOM_DOMAINS.md). API: `https://socialiq-37aa.onrender.com`, client: `https://www.socialaidigital.com`.

---

## Prerequisites

1. **GitHub** — repo pushed to `main`
2. **MongoDB Atlas** — free cluster with:
   - Database user (read/write)
   - Network access: `0.0.0.0/0` (or Render IPs)
   - Connection string **with database name**:
     ```
     mongodb+srv://USER:PASS@cluster.mongodb.net/voxa?retryWrites=true&w=majority
     ```
3. **Render account** — [render.com](https://render.com)

---

## Deploy order

1. Deploy **API** (Web Service)
2. Seed production database (optional demo data)
3. Deploy **Static Site** with `VITE_API_URL`
4. Set `CLIENT_URL` (and `SERVER_URL` if using OAuth) on API → redeploy API

---

## Step 1 — API (Web Service)

In Render: **New → Web Service** → connect your GitHub repo.

| Setting | Value |
|---------|-------|
| **Language** | Node |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/api/health` |

### API environment variables

| Key | Required | Example / notes |
|-----|----------|-----------------|
| `NODE_ENV` | Yes | `production` |
| `MONGODB_URI` | Yes | Atlas URI with `/voxa` |
| `JWT_SECRET` | Yes | Random string, 32+ characters |
| `CLIENT_URL` | Yes | Production: `https://www.socialaidigital.com,https://socialaidigital.com` (no trailing slash). Comma-separated allowed. **First `https://` non-localhost entry is used for OAuth return** (do not put `http://localhost:5173` first on Render). |
| `SERVER_URL` | OAuth + WhatsApp | Production: `https://socialiq-37aa.onrender.com` (origin only). WhatsApp Callback URL = `{SERVER_URL}/api/whatsapp/webhook` — there is no separate callback env var |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | YouTube OAuth |
| `GOOGLE_REDIRECT_URI` | Optional | `https://socialiq-37aa.onrender.com/api/connections/youtube/callback` |
| `META_APP_ID` / `META_APP_SECRET` | Optional | Facebook Login (Page comments) |
| `META_REDIRECT_URI` | Optional | `https://socialiq-37aa.onrender.com/api/connections/meta/callback` |
| `META_INSTAGRAM_APP_ID` / `META_INSTAGRAM_APP_SECRET` | Optional | Instagram Login — **separate Instagram App ID** from Meta Dashboard (e.g. `1102250409082500`, not always same as `META_APP_ID`) |
| `META_INSTAGRAM_REDIRECT_URI` | Optional | `https://socialiq-37aa.onrender.com/api/connections/instagram/callback` |
| `META_WHATSAPP_ACCESS_TOKEN` | WhatsApp | Cloud API permanent token |
| `META_PHONE_NUMBER_ID` / `META_WABA_ID` | WhatsApp | From Meta WhatsApp → API setup |
| `META_WEBHOOK_VERIFY_TOKEN` | WhatsApp | Same string as Meta Webhooks **Verify token** field |
| `META_GRAPH_API_VERSION` | WhatsApp | e.g. `v21.0` |
| `META_WHATSAPP_LEAD_TEMPLATE` | Optional | Template name for outbound leads outside 24h window |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Optional | LLM categorization (else rule-based) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `REPORT_FROM` | Optional | Daily report email |

For the first API deploy, you can temporarily set `CLIENT_URL` to `http://localhost:5173`, then update it once the static site is live.

Also add the production redirect URIs in **Google Cloud Console** and **Meta App** settings if you use OAuth.

### Verify API

```bash
curl https://socialiq-37aa.onrender.com/api/health
# → {"ok":true,"product":"SocialAiDigital", ...}
```

---

## Step 2 — Seed production database (optional)

Demo comments/users are **not** created automatically on Atlas. Run once from your machine (repo root):

```bash
MONGODB_URI="mongodb+srv://USER:PASS@cluster.mongodb.net/voxa?retryWrites=true&w=majority" npm run seed
```

Default account created by seed:

| Role | Email | Password |
|------|-------|----------|
| Demo | `demo@voxa.app` | `demo1234` |

Change this password (or create a real account via Register) before going public.

---

## Step 3 — Static Site (React)

In Render: **New → Static Site** → same GitHub repo.

| Setting | Value |
|---------|-------|
| **Branch** | `main` |
| **Root Directory** | `client` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

> Static sites have **no Start Command** — Render serves the built files from `dist`.

### Static site environment variable

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://socialiq-37aa.onrender.com` |

**Important:** Do **not** append `/api`. Client request paths already include `/api/...` (e.g. `/api/auth/login`). Setting `.../api` would produce `/api/api/...`.

Vite bakes `VITE_API_URL` into the build at deploy time — setting it only in a local `client/.env` is not enough; it must be set in the Render dashboard before building.

[`client/public/runtime-config.js`](../client/public/runtime-config.js) also sets the API origin on production hostnames (`www.socialaidigital.com`, `*.onrender.com`) so login works even if an old `VITE_API_URL` was baked into the bundle. Prefer keeping `VITE_API_URL` correct on Render as well.

Example:

```
VITE_API_URL=https://socialiq-37aa.onrender.com
```

### SPA routing (required on Render)

React Router paths (`/login`, `/register`, `/app`, `/app/connections`, …) are **not** real files on disk. Without a rewrite, Render returns plain `Not Found` on refresh or direct links.

1. Open [Render Dashboard](https://dashboard.render.com) → your static site
2. **Redirects/Rewrites**
3. Add **Rewrite**: Source `/*` → Destination `/index.html`
4. Save and retest `/login` and `/app` on refresh

#### Blueprint

[`render.yaml`](../render.yaml) service **`voxa-web`** includes the same `/*` → `/index.html` rewrite for Blueprint-managed services.

---

## Step 4 — Link API ↔ Static Site

After the static site deploys, copy its URL (e.g. `https://voxa-web.onrender.com`).

On the **API** service, update:

| Key | Value |
|-----|-------|
| `CLIENT_URL` | `https://www.socialaidigital.com,https://socialaidigital.com` (no trailing slash) |
| `SERVER_URL` | `https://socialiq-37aa.onrender.com` |

Then **Manual Deploy** / redeploy the API so CORS (and OAuth redirects) use the correct origin.

`CLIENT_URL` must match the static site URL **exactly** (no trailing slash). Production uses the custom domain:

```env
CLIENT_URL=https://www.socialaidigital.com,https://socialaidigital.com
```

Optional cutover (keep Render client URL as secondary CORS origin):

```env
CLIENT_URL=https://www.socialaidigital.com,https://socialaidigital.com,https://socialiq-client.onrender.com
```

Do **not** put `http://localhost:5173` first on production — after Facebook Connect the API redirects there and the browser has no live JWT (looks like logout). Redeploy the API after changing `CLIENT_URL`.

---

## Option B — Blueprint (`render.yaml`)

The repo includes [`render.yaml`](../render.yaml). On Render: **New → Blueprint** → connect the repo to create both services at once.

After blueprint deploy, set secrets in the dashboard:

| Service | Variable |
|---------|----------|
| `voxa-api` | `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL` (+ OAuth / SMTP / OpenAI as needed) |
| `voxa-web` | `VITE_API_URL` |

Then redeploy the static site after `VITE_API_URL` is set (it must be present at **build** time), and redeploy the API after `CLIENT_URL` points at the live static URL.

---

## Post-deploy checklist

- [ ] `curl https://socialiq-37aa.onrender.com/api/health` returns `ok` / `SocialAiDigital`
- [ ] Static homepage loads (check Network tab → API requests go to `https://socialiq-37aa.onrender.com`)
- [ ] `/login` and `/app` work on direct URL / refresh (SPA rewrite)
- [ ] Register / login works (JWT in local storage / Authorization header)
- [ ] `CLIENT_URL` includes `https://www.socialaidigital.com` (no trailing slash)
- [ ] `SERVER_URL` / `VITE_API_URL` = `https://socialiq-37aa.onrender.com`
- [ ] Optional: seed ran; demo login `demo@voxa.app` / `demo1234`
- [ ] YouTube / Meta OAuth redirect URIs use `socialiq-37aa.onrender.com` (see [CUSTOM_DOMAINS.md](./CUSTOM_DOMAINS.md))

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Homepage loads but API calls fail | `VITE_API_URL` missing, wrong, or stale at build time | Set `VITE_API_URL=https://socialiq-37aa.onrender.com` on Static Site (**no** trailing `/api`), **Clear build cache & redeploy** |
| Login fails / CORS errors | `CLIENT_URL` wrong or API not redeployed | Set `CLIENT_URL=https://www.socialaidigital.com,https://socialaidigital.com` on API, redeploy API |
| Logged out after Facebook Connect | `CLIENT_URL` localhost-first, or `/me` wiped JWT | Set live `CLIENT_URL` first; redeploy API + client |
| WhatsApp webhook / inbox empty | Meta Callback URL wrong or Cloud API env missing | Callback = `{SERVER_URL}/api/whatsapp/webhook`. On Render set `SERVER_URL` + `META_WEBHOOK_VERIFY_TOKEN` (no separate callback env). Redeploy API; wake with `/api/health` then Verify again. See [`WHATSAPP_WEBHOOK.md`](./WHATSAPP_WEBHOOK.md) |
| Local login `403` / empty body | Vite proxy port ≠ server `PORT` | Match `PORT` and Vite proxy (`5001` / `VITE_API_PROXY`) |
| Facebook Inbox empty after Sync | Wrong Page or posts outside sync window | Reconnect correct Page; Sync again (checks ~50 posts) |
| API starts but no data | Atlas empty or wrong DB name in URI | Add `/voxa` to URI, run `npm run seed` |
| Build fails on static site | Wrong publish path | Use `dist` with Root Directory `client` |
| Build fails on API (`file:..` / voxa) | Stale lockfile or old dep | Ensure `voxa` is not in `server`/`client` package.json; Root Directory is `server` |
| Slow first request (~30–60s) | Free tier cold start | Normal on Render free Web Services |
| 404 on `/login` or `/app` refresh | SPA rewrite missing | Dashboard → Redirects/Rewrites → Rewrite `/*` → `/index.html` |
| OAuth callback fails | Redirect URI mismatch | Set `SERVER_URL` / `*_REDIRECT_URI` to `https://socialiq-37aa.onrender.com/...`; update Google/Meta consoles — [CUSTOM_DOMAINS.md](./CUSTOM_DOMAINS.md) |
| Still calls `api.socialaidigital.com` | Old client build not redeployed | Update `VITE_API_URL` on static site and rebuild with cache clear |

---

## Environment reference

### Local development

**`server/.env`** (see also [`server/.env.example`](../server/.env.example))

```env
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/voxa
JWT_SECRET=your-dev-secret-32-chars-minimum
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:5001
NODE_ENV=development
```

**`client`** — leave `VITE_API_URL` empty so requests go through the Vite proxy. Proxy target defaults to `http://localhost:5001` (must match `PORT`). Override with `VITE_API_PROXY` if needed.

```env
VITE_API_URL=
# optional: VITE_API_PROXY=http://localhost:5001
```

### Facebook comments empty in Inbox

1. Connect → **Sync comments** on Facebook; read the message (`fetched` / `postsChecked` / warnings).
2. Confirm the connected Page is the same Page that shows comments in Meta Comments Manager (Reconnect if not).
3. Sync checks ~50 recent posts — older posts outside that window are skipped.

### Production (Render)

| Service | Variables |
|---------|-----------|
| API | `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, optional `SERVER_URL` / OAuth / WhatsApp Cloud API / OpenAI / SMTP |
| Static | `VITE_API_URL` (API origin only, no `/api` suffix) |

---

## Free tier notes

- Web Services spin down after ~15 minutes of inactivity
- First request after sleep can take 30–60 seconds
- MongoDB Atlas free tier may pause after inactivity — wake the cluster in Atlas if connections fail
- **Logs are ephemeral** — `server/logs/*.log` is wiped on every deploy/restart. Use Render → Logs for recent output; set `ALERT_EMAIL` + SMTP so errors (including Meta circuit-breaker trips) are emailed.
- **Cron jobs pause while asleep** — the crisis monitor and daily report only run while the API is awake. Use the keep-awake ping below.

### Keep-awake ping (free plan)

Create a free monitor that hits the health endpoint every 10 minutes:

- [UptimeRobot](https://uptimerobot.com) → New monitor → HTTP(s) → URL `https://socialiq-37aa.onrender.com/api/health` → interval 10 min, **or**
- [cron-job.org](https://cron-job.org) → new job → same URL → every 10 minutes

`/api/health` touches no Meta APIs, so pinging it is safe for the Facebook account. Never point a monitor at a sync or Graph-backed endpoint.

---

## First deploy checklist

### 1. Render dashboard secrets (`voxa-api`)

Set these before the first deploy (Environment tab). Values marked `sync: false` in `render.yaml` are **not** filled automatically.

| Key | Needed for |
|-----|-----------|
| `MONGODB_URI` | Always (Atlas URI with `/voxa`) |
| `JWT_SECRET` | Auto-generated by Blueprint; set manually otherwise |
| `META_APP_ID` / `META_APP_SECRET` | Facebook + Instagram via Facebook Login |
| `META_INSTAGRAM_APP_ID` / `META_INSTAGRAM_APP_SECRET` | Instagram Login (optional) |
| `META_INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | Instagram webhooks (only if subscribed) |
| `OPENAI_API_KEY` | LLM analysis (else rule-based) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `REPORT_FROM` | Emails, reports, alerts |
| `ALERT_EMAIL` | Error + crisis + Meta pause alerts |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Checkout links (optional) |

Preset in `render.yaml`: `WHATSAPP_ENABLED=false`, `CRISIS_MONITOR_ENABLED=true`, `META_INSTAGRAM_MESSAGING_ENABLED=false` (flip to `true` only after `instagram_business_manage_messages` is approved).

### 2. Meta App Dashboard

- **Use cases:** "Manage messaging & content on Instagram" + "Manage everything on your Page" (no WhatsApp).
- **Facebook Login → Settings → Valid OAuth Redirect URIs:** `https://socialiq-37aa.onrender.com/api/connections/meta/callback`
- **Instagram → API setup with Instagram login → redirect:** `https://socialiq-37aa.onrender.com/api/connections/instagram/callback`
- **App Domains:** `socialaidigital.com`, `onrender.com`; Privacy / Terms / Data deletion URLs on `https://www.socialaidigital.com/...`
- While in **Development** mode only app roles (Admin/Developer/Tester) see real data — add your own FB/IG accounts as testers.

### 3. Google sign-in (Google Cloud Console)

"Continue with Google" reuses the YouTube OAuth client (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).

- **APIs & Services → Credentials → your OAuth client → Authorized redirect URIs:** add `https://socialiq-37aa.onrender.com/api/auth/google/callback` (and `http://localhost:5001/api/auth/google/callback` for local).
- **OAuth consent screen:** scopes `openid`, `email`, `profile` (non-sensitive, no Google review needed).
- **Publishing status:** while "Testing", only listed test users can sign in — click **Publish app** for everyone.

### Email codes are off on Render free

Render free blocks outbound SMTP, so `EMAIL_OTP_ENABLED=false`: password sign-ups are verified immediately and the "Email code" login tab is hidden. SMTP emails fail fast (≈10 s timeout) instead of hanging. Set `EMAIL_OTP_ENABLED=true` only after moving to a paid plan or a host that allows SMTP.

### 4. Deploy + smoke test

1. Push to `main` (Render auto-deploys both services).
2. `curl https://socialiq-37aa.onrender.com/api/health`
3. Open `https://www.socialaidigital.com`, log in, open **Connect**.
4. Connect Facebook once, Sync once, confirm comments appear. Do **not** click Sync repeatedly.

---

## Meta safe-usage rules (protect the Facebook account)

Meta flags accounts that look like bots: bursts of API calls, many replies in a short time, or repeated actions after an error. The API enforces these guards automatically (see `server/services/metaSafe.js`):

| Guard | Limit |
|-------|-------|
| Sync cooldown | 1 sync per platform per 10 min |
| Sync size | ≤ 80 posts scanned, ≤ 20 posts with comments, ≤ 50 comments/post, ≤ 20 IG media |
| Read pacing | 400 ms between Graph pages |
| Write pacing | 3–6 s random delay before every reply / DM / hide |
| Auto-replies | ≤ 5 per sync + the per-user daily limit in Settings |
| Auto-hide | ≤ 10 per sync (rest stay flagged for review) |
| Bulk moderation | ≤ 25 platform actions per batch (rest applied locally only) |
| Daily write budget | 150 Meta actions per connected account per day |
| Usage headers | Meta usage ≥ 75% → slow down; ≥ 90% → automation + sync paused 30 min |
| Circuit breaker | Error 368 / 10 / 200 → pause 6 h; 190 (token) → pause until reconnect. Emailed to `ALERT_EMAIL`, shown on the Connect page |
| Instagram private reply | Once per comment, only within 7 days of the comment |

Operator habits:

- Do not create new Meta test apps or reconnect accounts over and over in one day.
- Keep the app in Development mode until App Review is approved; don't enable messaging flags before approval.
- If the Connect page shows a pause banner, **stop** — read the reason, fix permissions in Meta, then Reconnect (which clears the pause).
- Never run load tests or scripts against Graph-backed endpoints in production.
