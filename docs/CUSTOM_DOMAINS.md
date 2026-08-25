# Custom domains cutover checklist

Cloudflare DNS (already set):

| Host | Points to |
|------|-----------|
| `www.socialaidigital.com` | `socialiq-client.onrender.com` (client) |
| `api.socialaidigital.com` | `socialiq-37aa.onrender.com` (API) |
| `socialaidigital.com` | apex A → Render / Cloudflare |

Use **no trailing slash** on all env values.

---

## 1. Render — API service

Set / update, then **Manual Deploy**:

| Key | Value |
|-----|-------|
| `CLIENT_URL` | `https://www.socialaidigital.com` |
| `SERVER_URL` | `https://api.socialaidigital.com` |
| `GOOGLE_REDIRECT_URI` | `https://api.socialaidigital.com/api/connections/youtube/callback` |
| `META_REDIRECT_URI` | `https://api.socialaidigital.com/api/connections/meta/callback` |
| `META_INSTAGRAM_REDIRECT_URI` | `https://api.socialaidigital.com/api/connections/instagram/callback` |

Optional CORS cutover:

```
CLIENT_URL=https://www.socialaidigital.com,https://socialiq-client.onrender.com
```

Confirm custom domain `api.socialaidigital.com` is **Verified** with certificate issued on the API service.

---

## 2. Render — Static site (client)

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://api.socialaidigital.com` |

**Redeploy / rebuild** after changing `VITE_API_URL` (Vite bakes it at build time).

Confirm custom domain `www.socialaidigital.com` is verified on the static site.

---

## 3. Google Cloud Console

Authorized redirect URI:

```
https://api.socialaidigital.com/api/connections/youtube/callback
```

Keep the old `*.onrender.com` URI until Connect works, then remove.

---

## 4. Meta Developer Console

**OAuth redirect URIs** (Facebook + Instagram login):

```
https://api.socialaidigital.com/api/connections/meta/callback
https://api.socialaidigital.com/api/connections/instagram/callback
```

**App Domains:** `socialaidigital.com`, `api.socialaidigital.com`

**App settings URLs:**

| Setting | URL |
|---------|-----|
| Privacy Policy | `https://www.socialaidigital.com/privacy` |
| Terms of Service | `https://www.socialaidigital.com/terms` |
| User data deletion | `https://www.socialaidigital.com/data-deletion` |

**WhatsApp webhook:**

```
https://api.socialaidigital.com/api/whatsapp/webhook
```

**Instagram messaging webhook** (after App Review):

```
https://api.socialaidigital.com/api/instagram/webhook
```

---

## 5. Cloudflare SSL

- SSL/TLS mode: **Full (strict)** while records are Proxied (orange cloud)
- If OAuth or webhooks fail with SSL errors: set `api` CNAME to **DNS only** (grey cloud)

---

## 6. Verify

- [ ] `curl https://api.socialaidigital.com/api/health` → `ok`
- [ ] https://www.socialaidigital.com loads; Network tab calls `api.socialaidigital.com`
- [ ] Login works (no CORS errors)
- [ ] Connect YouTube / Instagram returns to **www** with session
- [ ] Settings → WhatsApp Callback URL shows `https://api.socialaidigital.com/api/whatsapp/webhook`
- [ ] Google OAuth branding verified (see section 7)

See also: [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md), [META_INSTAGRAM_SETUP.md](./META_INSTAGRAM_SETUP.md), [WHATSAPP_WEBHOOK.md](./WHATSAPP_WEBHOOK.md).

---

## 7. Google OAuth branding (Search Console + app name)

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
https://api.socialaidigital.com/api/connections/youtube/callback
```
