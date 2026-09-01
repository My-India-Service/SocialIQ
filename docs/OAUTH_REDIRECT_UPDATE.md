# OAuth redirect URI update (Render direct API URL)

After switching the API to `https://socialiq-37aa.onrender.com`, add these callback URIs in each console. Keep old `api.socialaidigital.com` URIs until Connect is verified, then remove.

## Google Cloud Console

Authorized redirect URI:

```
https://socialiq-37aa.onrender.com/api/connections/youtube/callback
```

## Meta Developer Console (App ID: 1645663120309703)

**Current OAuth redirect (verified via Meta Developer Tools):**

```
https://api.socialaidigital.com/api/connections/meta/callback
```

**Add:**

```
https://socialiq-37aa.onrender.com/api/connections/meta/callback
https://socialiq-37aa.onrender.com/api/connections/instagram/callback
```

**App Domains:** add `onrender.com` (keep `socialaidigital.com`)

**Webhooks:**

```
https://socialiq-37aa.onrender.com/api/whatsapp/webhook
https://socialiq-37aa.onrender.com/api/instagram/webhook
```

## Render API env (set on `socialiq-37aa` service)

```
SERVER_URL=https://socialiq-37aa.onrender.com
GOOGLE_REDIRECT_URI=https://socialiq-37aa.onrender.com/api/connections/youtube/callback
META_REDIRECT_URI=https://socialiq-37aa.onrender.com/api/connections/meta/callback
META_INSTAGRAM_REDIRECT_URI=https://socialiq-37aa.onrender.com/api/connections/instagram/callback
```

Redeploy the API after changing env vars.
