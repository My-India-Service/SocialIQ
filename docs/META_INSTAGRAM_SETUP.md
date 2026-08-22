# Meta Instagram Login setup — My India Service

Meta app **My India Service** uses **two different App IDs**:

| Credential | Value | Env var |
|------------|-------|---------|
| Meta App ID (Facebook Login) | `1645663120309703` | `META_APP_ID` |
| **Instagram App ID** | `1102250409082500` | `META_INSTAGRAM_APP_ID` |
| Instagram App Secret | From Meta Dashboard → Instagram → API setup | `META_INSTAGRAM_APP_SECRET` |

**Important:** Do **not** use `1645663120309703` for Instagram Login. Copy the **Instagram App ID** from **Instagram → API setup with Instagram login**. The server fallback to `META_APP_ID` only works when both IDs are the same (not true for this app).

---

## 1. Local env (`.env`)

```env
META_APP_ID=1645663120309703
META_APP_SECRET=<Facebook app secret>

META_INSTAGRAM_APP_ID=1102250409082500
META_INSTAGRAM_APP_SECRET=<Instagram app secret from dashboard>
META_INSTAGRAM_REDIRECT_URI=https://socialiq-37aa.onrender.com/api/connections/instagram/callback
```

For local OAuth testing, also allow:

```env
# META_INSTAGRAM_REDIRECT_URI=http://localhost:5001/api/connections/instagram/callback
```

Restart API after changes: `cd server && npm run dev`

---

## 2. Render (production)

**Render → voxa-api → Environment:**

| Key | Value |
|-----|--------|
| `META_INSTAGRAM_APP_ID` | `1102250409082500` |
| `META_INSTAGRAM_APP_SECRET` | Full Instagram app secret (from Meta Dashboard) |
| `META_INSTAGRAM_REDIRECT_URI` | `https://socialiq-37aa.onrender.com/api/connections/instagram/callback` |

Keep `META_APP_ID` / `META_APP_SECRET` unchanged for Facebook Page connect.

**Save → Manual Deploy / Redeploy** the API service.

---

## 3. Meta Dashboard

### Instagram product (done)

Instagram → **API setup with Instagram login** should show:

- Instagram app name: My India Service - IG
- Instagram app ID: `1102250409082500`

### OAuth redirect — **Set up Instagram business login** (required)

Add OAuth redirect URIs in **step 3 — Set up Instagram business login**, **not** only in webhooks:

- `https://socialiq-37aa.onrender.com/api/connections/instagram/callback`
- `http://localhost:5001/api/connections/instagram/callback` (local dev)

Voxa route: `GET /api/connections/instagram/callback` — OAuth return after user logs in at instagram.com.

### Webhooks (optional — skip for now)

**Configure webhooks** is for real-time IG events. Voxa does **not** implement an Instagram webhook handler (WhatsApp uses `/api/whatsapp/webhook` only). Comment sync uses **Sync comments** on Connect. You can leave Instagram webhooks unverified/off.

### Scopes

Enable for testing / App Review:

- `instagram_business_basic`
- `instagram_business_manage_comments`

---

## 4. Verify config

```bash
cd server && node -e "
import dotenv from 'dotenv'; dotenv.config();
import { resolveInstagramCredentials, getInstagramAuthUrl } from './services/instagramLogin.js';
const c = resolveInstagramCredentials();
console.log('appId:', c.appId);
console.log('redirect:', c.redirectUri);
console.log('auth:', getInstagramAuthUrl('test').includes('client_id=1102250409082500') ? 'OK' : 'WRONG client_id');
"
```

Expected: `appId: 1102250409082500`

---

## 5. Test in Voxa

| Step | Expected |
|------|----------|
| Connect → **Instagram Login** = On | Yes |
| **Connect with Instagram** | Opens `instagram.com/oauth/authorize?client_id=1102250409082500...` |
| After login | Success on Connect page |
| Badge | **Via Instagram login** |
| **Sync comments** | IG comments in Inbox |

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| Invalid redirect URI | URI in Meta **Business login** must match `META_INSTAGRAM_REDIRECT_URI` exactly |
| Wrong client_id in URL | Set `META_INSTAGRAM_APP_ID=1102250409082500` (not main App ID) |
| Instagram Login Off | Set `META_INSTAGRAM_*` on API env and redeploy |
| Scope / permission denied | Enable scopes; IG account must be Business/Creator |
| Still fails | Use **Connect via Facebook Page** (IG linked to Page) |

## Checklist

- [x] Instagram product added in Meta Dashboard
- [ ] OAuth redirect in **Business login** settings (not webhooks only)
- [ ] Render env: `META_INSTAGRAM_APP_ID=1102250409082500` + secret
- [ ] API redeployed on Render
- [ ] Connect with Instagram tested (`client_id=1102250409082500`)
- [ ] Sync comments tested
