# Voxa — AI Revenue Intelligence

Turn YouTube, Instagram & Facebook comments into sales leads, complaint intel, and brand-tone reply drafts.

## Stack

- **MongoDB** — users, connections, comments
- **Express** — REST API + Google/Meta OAuth + LLM categorization
- **React (Vite)** — landing page + dashboard
- **Node.js** — server runtime

## Quick start

### 1. Prerequisites

- Node.js 18+
- MongoDB running locally (`mongodb://127.0.0.1:27017`)

### 2. Install

```bash
npm install
npm run install:all
```

### 3. Configure

Copy `server/.env.example` → `server/.env` and fill keys:

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | YouTube OAuth |
| `GOOGLE_REDIRECT_URI` | `http://localhost:5000/api/connections/youtube/callback` |
| `META_APP_ID` / `META_APP_SECRET` | Instagram + Facebook OAuth |
| `META_REDIRECT_URI` | `http://localhost:5000/api/connections/meta/callback` |
| `OPENAI_API_KEY` | LLM intent categorization (optional) |

### 4. Google Cloud (YouTube)

1. [Google Cloud Console](https://console.cloud.google.com/) → enable **YouTube Data API v3**
2. OAuth consent screen → add yourself as **Test user**
3. Create Web OAuth client  
4. Redirect URI: `http://localhost:5000/api/connections/youtube/callback`

### 5. Meta App (Instagram + Facebook)

1. Create an app at [Meta for Developers](https://developers.facebook.com/)
2. Add products: **Facebook Login** + **Instagram Graph API** (and Pages if prompted)
3. Facebook Login → Settings → Valid OAuth Redirect URIs:
   `http://localhost:5000/api/connections/meta/callback`
4. App settings → copy **App ID** + **App Secret** into `.env`
5. Roles → add yourself as developer/tester
6. Requirements for real data:
   - A **Facebook Page** you admin
   - Instagram **Business/Creator** account linked to that Page
7. Restart the server after saving `.env`

### 6. Seed demo data (optional)

```bash
npm run seed
```

Demo login: `demo@voxa.app` / `demo1234`

### 7. Run

```bash
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:5000  

## Test real channels

1. Log in → **Connect**
2. **YouTube** → Connect with Google → Sync  
3. **Instagram** / **Facebook** → Connect with Meta → Sync  
4. Open **Inbox** — filter by platform  

If `OPENAI_API_KEY` is set → LLM categorization; else rules engine.

## MVP features

1. YouTube OAuth + real comment ingest
2. Instagram + Facebook Meta OAuth + real comment ingest
3. AI categories: sales, complaint, feature, positive, spam (+ extras)
4. Brand-tone reply suggestions
5. Daily CEO report + email preview

## Product name

**Voxa** — hear every comment, capture every sale.
