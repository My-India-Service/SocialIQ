# Custom domains cutover checklist

## Production setup (Render direct API URL)

Current production uses the Render API URL directly (no custom `api.` subdomain required):

| Service | URL |
|---------|-----|
| Client | `https://www.socialaidigital.com` → `socialiq-client.onrender.com` |
| API | `https://socialiq-37aa.onrender.com` |

Use **no trailing slash** on all env values.

---

## 1. Render — API service (`socialiq-37aa.onrender.com`)

Set / update, then **Manual Deploy**:

| Key | Value |
|-----|-------|
| `CLIENT_URL` | `https://www.socialaidigital.com,https://socialaidigital.com` |
| `SERVER_URL` | `https://socialiq-37aa.onrender.com` |
| `GOOGLE_REDIRECT_URI` | `https://socialiq-37aa.onrender.com/api/connections/youtube/callback` |
| `META_REDIRECT_URI` | `https://socialiq-37aa.onrender.com/api/connections/meta/callback` |
| `META_INSTAGRAM_REDIRECT_URI` | `https://socialiq-37aa.onrender.com/api/connections/instagram/callback` |

Optional CORS cutover (keep Render client URL as secondary):

```
CLIENT_URL=https://www.socialaidigital.com,https://socialaidigital.com,https://socialiq-client.onrender.com
```

---

## 2. Render — Static site (client, `www.socialaidigital.com`)

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://socialiq-37aa.onrender.com` |

**Important:** no `/api` suffix. **Clear build cache & redeploy** after changing `VITE_API_URL` (Vite bakes it at build time).

Confirm custom domain `www.socialaidigital.com` is verified on the static site.

---

## 3. Google Cloud Console

Authorized redirect URI:

```
https://socialiq-37aa.onrender.com/api/connections/youtube/callback
```

Keep the old `api.socialaidigital.com` URI until Connect works, then remove.

---

## 4. Meta Developer Console

**OAuth redirect URIs** (Facebook + Instagram login):

```
https://socialiq-37aa.onrender.com/api/connections/meta/callback
https://socialiq-37aa.onrender.com/api/connections/instagram/callback
```

**App Domains:** `socialaidigital.com`, `onrender.com`

**App settings URLs:**

| Setting | URL |
|---------|-----|
| Privacy Policy | `https://www.socialaidigital.com/privacy` |
| Terms of Service | `https://www.socialaidigital.com/terms` |
| User data deletion | `https://www.socialaidigital.com/data-deletion` |

**WhatsApp webhook:**

```
https://socialiq-37aa.onrender.com/api/whatsapp/webhook
```

**Instagram messaging webhook** (after App Review):

```
https://socialiq-37aa.onrender.com/api/instagram/webhook
```

---

## 5. Cloudflare DNS (reference)

| Host | Points to |
|------|-----------|
| `www.socialaidigital.com` | `socialiq-client.onrender.com` (client) |
| `socialaidigital.com` | apex A → Render / Cloudflare |

The `api.socialaidigital.com` CNAME is **optional** when using the Render API URL directly.

---

## 6. Cloudflare SSL

- SSL/TLS mode: **Full (strict)** while records are Proxied (orange cloud)
- If OAuth or webhooks fail with SSL errors: set API CNAME to **DNS only** (grey cloud)

---

## 7. Verify

- [ ] `curl https://socialiq-37aa.onrender.com/api/health` → `ok`
- [ ] https://www.socialaidigital.com loads; Network tab calls `socialiq-37aa.onrender.com` (not `api.socialaidigital.com`)
- [ ] Login works (no CORS errors)
- [ ] Connect YouTube / Instagram returns to **www** with session
- [ ] Settings → WhatsApp Callback URL shows `https://socialiq-37aa.onrender.com/api/whatsapp/webhook`
- [ ] Google OAuth branding verified (see section 8)

See also: [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md), [META_INSTAGRAM_SETUP.md](./META_INSTAGRAM_SETUP.md), [WHATSAPP_WEBHOOK.md](./WHATSAPP_WEBHOOK.md).

---

## 8. Google OAuth branding (Search Console + app name)

Google rejects verification if the **OAuth app name** does not match the **homepage**, or if the homepage domain is not verified to your Google account.

### App name (must match exactly)

| Place | Value |
|-------|-------|
| Google Cloud → Auth → Branding → App name | `SocialAiDigital` (not "Social AI Digital") |
| Live homepage wordmark / title | `SocialAiDigital` |
| Application home page | `https://www.socialaidigital.com` |
| Privacy policy | `https://www.socialaidigital.com/privacy` |

### Verify domain ownership

1. Open [Google Search Console](https://search.google.com/search-console)
2. Add property: domain `socialaidigital.com` **or** URL prefix `https://www.socialaidigital.com`
3. Prefer **DNS TXT** verification in Cloudflare (same zone as your CNAMEs)
4. Wait until Search Console shows **Verified**
5. Redeploy the static site so Google can crawl the updated SocialAiDigital homepage
6. Google Cloud → Branding → **I have fixed the issues** → Proceed / re-verify

Authorized YouTube redirect URI (separate from branding):

```
https://socialiq-37aa.onrender.com/api/connections/youtube/callback
```

---

## Optional: custom API subdomain (`api.socialaidigital.com`)

If you prefer a branded API URL instead of `*.onrender.com`:

1. Add custom domain `api.socialaidigital.com` on the Render API service (CNAME → `socialiq-37aa.onrender.com`)
2. Set `SERVER_URL` and `VITE_API_URL` to `https://api.socialaidigital.com`
3. Update OAuth redirect URIs and Meta/Google consoles accordingly
4. Redeploy both API and static site
