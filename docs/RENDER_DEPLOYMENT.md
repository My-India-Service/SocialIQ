# Render Deployment Guide — Voxa

This project is a **two-package monorepo** (`client/` + `server/`). On Render you create **two services** from the same GitHub repo.

## Architecture

```
GitHub repo (SocialIQ / Voxa)
├── Web Service  → Express API  (Node.js, rootDir: server)
├── Static Site  → React build  (Vite → client/dist)
└── MongoDB Atlas (database)
```

The static site calls the API over HTTPS. Auth uses **Bearer JWT** in the `Authorization` header (not cookies).

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
| `CLIENT_URL` | Yes | Static site URL — set after Step 3. Comma-separated allowed. **In production the first `https://` non-localhost entry is used for OAuth return** (do not put `http://localhost:5173` first on Render). |
| `SERVER_URL` | OAuth + WhatsApp | `https://YOUR-API.onrender.com` (origin only). WhatsApp Callback URL = `{SERVER_URL}/api/whatsapp/webhook` — there is no separate callback env var |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | YouTube OAuth |
| `GOOGLE_REDIRECT_URI` | Optional | `https://YOUR-API.onrender.com/api/connections/youtube/callback` |
| `META_APP_ID` / `META_APP_SECRET` | Optional | Facebook Login (Page comments) |
| `META_REDIRECT_URI` | Optional | `https://YOUR-API.onrender.com/api/connections/meta/callback` |
| `META_INSTAGRAM_APP_ID` / `META_INSTAGRAM_APP_SECRET` | Optional | Instagram Login — **separate Instagram App ID** from Meta Dashboard (e.g. `1102250409082500`, not always same as `META_APP_ID`) |
| `META_INSTAGRAM_REDIRECT_URI` | Optional | `https://YOUR-API.onrender.com/api/connections/instagram/callback` |
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
curl https://YOUR-API.onrender.com/api/health
# → {"ok":true,"product":"Voxa","message":"AI Revenue Intelligence API"}
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
| `VITE_API_URL` | `https://YOUR-API.onrender.com` |

**Important:** Do **not** append `/api`. Client request paths already include `/api/...` (e.g. `/api/auth/login`). Setting `.../api` would produce `/api/api/...`.

Vite bakes `VITE_API_URL` into the build at deploy time — setting it only in a local `client/.env` is not enough; it must be set in the Render dashboard before building.

Example:

```
VITE_API_URL=https://voxa-api.onrender.com
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
| `CLIENT_URL` | `https://YOUR-STATIC-SITE.onrender.com` |
| `SERVER_URL` | `https://YOUR-API.onrender.com` (if using OAuth) |

Then **Manual Deploy** / redeploy the API so CORS (and OAuth redirects) use the correct origin.

`CLIENT_URL` must match the static site URL **exactly** (no trailing slash). On the Render API set:

```env
CLIENT_URL=https://socialiq-client.onrender.com
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

- [ ] `curl https://API/api/health` returns `ok` / `Voxa`
- [ ] Static homepage loads (check Network tab → API requests go to `VITE_API_URL`)
- [ ] `/login` and `/app` work on direct URL / refresh (SPA rewrite)
- [ ] Register / login works (JWT in local storage / Authorization header)
- [ ] `CLIENT_URL` on API matches static site URL exactly (no trailing slash)
- [ ] Optional: seed ran; demo login `demo@voxa.app` / `demo1234`
- [ ] Optional: YouTube / Meta OAuth redirect URIs use the Render API host

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Homepage loads but API calls fail | `VITE_API_URL` missing or wrong at build time | Set env on Static Site (**no** trailing `/api`), redeploy |
| Login fails / CORS errors | `CLIENT_URL` wrong or API not redeployed | Set static URL on API (comma-ok), redeploy API |
| Logged out after Facebook Connect | `CLIENT_URL` localhost-first, or `/me` wiped JWT | Set live `CLIENT_URL` first; redeploy API + client |
| WhatsApp webhook / inbox empty | Meta Callback URL wrong or Cloud API env missing | Callback = `{SERVER_URL}/api/whatsapp/webhook`. On Render set `SERVER_URL` + `META_WEBHOOK_VERIFY_TOKEN` (no separate callback env). Redeploy API; wake with `/api/health` then Verify again. See [`WHATSAPP_WEBHOOK.md`](./WHATSAPP_WEBHOOK.md) |
| Local login `403` / empty body | Vite proxy port ≠ server `PORT` | Match `PORT` and Vite proxy (`5001` / `VITE_API_PROXY`) |
| Facebook Inbox empty after Sync | Wrong Page or posts outside sync window | Reconnect correct Page; Sync again (checks ~50 posts) |
| API starts but no data | Atlas empty or wrong DB name in URI | Add `/voxa` to URI, run `npm run seed` |
| Build fails on static site | Wrong publish path | Use `dist` with Root Directory `client` |
| Build fails on API (`file:..` / voxa) | Stale lockfile or old dep | Ensure `voxa` is not in `server`/`client` package.json; Root Directory is `server` |
| Slow first request (~30–60s) | Free tier cold start | Normal on Render free Web Services |
| 404 on `/login` or `/app` refresh | SPA rewrite missing | Dashboard → Redirects/Rewrites → Rewrite `/*` → `/index.html` |
| OAuth callback fails | Redirect URI mismatch | Set `SERVER_URL` / `*_REDIRECT_URI` to Render API URL; update Google/Meta consoles |

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
