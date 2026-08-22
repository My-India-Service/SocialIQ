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

### Verify Render env (after redeploy)

1. Open Voxa → **Connect** → integration strip should show **Instagram Login: On**
2. If **Off**, add the three `META_INSTAGRAM_*` keys above and redeploy
3. Click **Connect with Instagram** — browser URL should include `client_id=1102250409082500`

---

## 3. Meta Dashboard

### Instagram product (done)

Instagram → **API setup with Instagram login** should show:

- Instagram app name: My India Service - IG
- Instagram app ID: `1102250409082500`

### Webhooks — **skip Section 2** (do not Verify and save)

**Do not** put `/api/connections/instagram/callback` in **Section 2 — Configure webhooks**.

| Section | URL purpose | Voxa endpoint |
|---------|-------------|---------------|
| **Section 2 — Webhooks** | Real-time events (`hub.challenge` verify) | **Not implemented** — skip |
| **Section 3 — Business login** | OAuth return after instagram.com login | `/api/connections/instagram/callback` |
| **WhatsApp → Webhooks** | WhatsApp messages only | `/api/whatsapp/webhook` |

If you click **Verify and save** in Section 2 with the OAuth callback URL, Meta sends:

```http
GET /api/connections/instagram/callback?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
```

Voxa’s callback expects `code` + `state` (OAuth), not webhook verification — Meta shows:

> The callback URL or verify token couldn't be validated.

**Fix:** Leave Section 2 empty. Remove callback URL from webhooks if already entered. Do **not** use WhatsApp verify token (`voxa-wa-verify-k7m9p2`) here — that token is only for `/api/whatsapp/webhook`.

Comment sync uses **Sync comments** on Connect, not Instagram webhooks.

### OAuth redirect — **Section 3 — Set up Instagram business login** (required)

Add OAuth redirect URIs here (Business login settings / OAuth redirect URIs):

- `https://socialiq-37aa.onrender.com/api/connections/instagram/callback`
- `http://localhost:5001/api/connections/instagram/callback` (local dev)

Voxa route: `GET /api/connections/instagram/callback` — OAuth return after user logs in at instagram.com.

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

| Error | Cause | Fix |
|-------|--------|-----|
| **Verify and save** fails on Instagram webhooks | OAuth URL used in Section 2 webhooks | Skip Section 2; add URL only in Section 3 Business login |
| Invalid redirect URI on Connect | Redirect not in Business login settings | Add URI in Section 3 (not webhooks) |
| Wrong client_id in URL | Using main App ID instead of Instagram App ID | Set `META_INSTAGRAM_APP_ID=1102250409082500` |
| Instagram Login Off on Connect | Missing env on API | Set `META_INSTAGRAM_*` on Render and redeploy |
| Scope / permission denied | Scopes or account type | Enable scopes; IG must be Business/Creator |
| Still fails | Page-linked IG path | Use **Connect via Facebook Page** |

### Meta Dashboard quick fix (Verify and save error)

1. Instagram → API setup with Instagram login
2. **Section 2 — Configure webhooks:** clear Callback URL and Verify token; do not click Verify and save
3. **Section 3 — Set up Instagram business login:** add OAuth redirect URI `https://socialiq-37aa.onrender.com/api/connections/instagram/callback`
4. In Voxa → Connect → **Connect with Instagram** (not Meta Verify)

## What NOT to do

- Do not put `/api/connections/instagram/callback` in Instagram **Configure webhooks** (Section 2)
- Do not use the WhatsApp verify token (`META_WEBHOOK_VERIFY_TOKEN`) for Instagram webhooks
- Do not expect **Verify and save** in Section 2 to succeed — Voxa has no Instagram webhook handler
- Do not use main App ID `1645663120309703` for Instagram Login — use `1102250409082500`

## Checklist

- [x] Instagram product added in Meta Dashboard
- [ ] **Skip** Section 2 webhooks (ignore Verify error — expected)
- [ ] OAuth redirect in **Section 3 Business login**
- [ ] Render env: `META_INSTAGRAM_APP_ID=1102250409082500` + secret + redirect URI
- [ ] API redeployed on Render
- [ ] Connect with Instagram tested from Voxa (`client_id=1102250409082500`)
- [ ] Sync comments tested
