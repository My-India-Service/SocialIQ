# Domain setup checklist

## Production setup (same origin on Spidyhost)

One cPanel Node.js app serves the site and the API from the same domain (see [deploy/spidyhost/RUNBOOK.md](../deploy/spidyhost/RUNBOOK.md)):

| Path | Served by |
|------|-----------|
| `https://www.socialaidigital.com/api/*` | Express API |
| `https://www.socialaidigital.com/*` | React build (`client/dist`) |

The client always calls relative `/api/...`; there is no API URL to configure. Use **no trailing slash** on all env values.

---

## 1. Server env (`~/socialiq/server/.env` on cPanel)

Edit, then **Restart** the Node.js app:

| Key | Value |
|-----|-------|
| `CLIENT_URL` | `https://www.socialaidigital.com,https://socialaidigital.com` |
| `SERVER_URL` | `https://www.socialaidigital.com` |
| `CANONICAL_HOST` | `www.socialaidigital.com` |
| `GOOGLE_REDIRECT_URI` | `https://www.socialaidigital.com/api/connections/youtube/callback` |
| `GOOGLE_LOGIN_REDIRECT_URI` | `https://www.socialaidigital.com/api/auth/google/callback` |
| `META_REDIRECT_URI` | `https://www.socialaidigital.com/api/connections/meta/callback` |
| `META_INSTAGRAM_REDIRECT_URI` | `https://www.socialaidigital.com/api/connections/instagram/callback` |

---

## 2. Google Cloud Console

Authorized redirect URIs (OAuth client used by `GOOGLE_CLIENT_ID`):

```
https://www.socialaidigital.com/api/connections/youtube/callback
https://www.socialaidigital.com/api/auth/google/callback
```

---

## 3. Meta Developer Console

**OAuth redirect URIs** (Facebook + Instagram login):

```
https://www.socialaidigital.com/api/connections/meta/callback
https://www.socialaidigital.com/api/connections/instagram/callback
```

**App Domains:** `socialaidigital.com`

**App settings URLs:**

| Setting | URL |
|---------|-----|
| Privacy Policy | `https://www.socialaidigital.com/privacy` |
| Terms of Service | `https://www.socialaidigital.com/terms` |
| User data deletion | `https://www.socialaidigital.com/data-deletion` |

**WhatsApp webhook:**

```
https://www.socialaidigital.com/api/whatsapp/webhook
```

**Instagram messaging webhook** (after App Review):

```
https://www.socialaidigital.com/api/instagram/webhook
```

---

## 4. Cloudflare DNS

| Host | Points to |
|------|-----------|
| `www.socialaidigital.com` | A → cPanel server IP (Proxied) |
| `socialaidigital.com` | A → cPanel server IP (Proxied); the app redirects it to `www` |

## 5. Cloudflare SSL

- SSL/TLS mode: **Full (strict)** with an AutoSSL or Cloudflare Origin certificate installed in cPanel.

---

## 6. Verify

- [ ] `curl https://www.socialaidigital.com/api/health` → `"ok":true`
- [ ] https://www.socialaidigital.com loads; Network tab calls `https://www.socialaidigital.com/api/...`
- [ ] Login works
- [ ] Connect YouTube / Instagram returns to **www** with session
- [ ] Settings → WhatsApp Callback URL shows `https://www.socialaidigital.com/api/whatsapp/webhook`
- [ ] Google OAuth branding verified (see section 7)

See also: [META_INSTAGRAM_SETUP.md](./META_INSTAGRAM_SETUP.md), [WHATSAPP_WEBHOOK.md](./WHATSAPP_WEBHOOK.md).

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
3. Prefer **DNS TXT** verification in Cloudflare
4. Wait until Search Console shows **Verified**
5. Google Cloud → Branding → **I have fixed the issues** → Proceed / re-verify
