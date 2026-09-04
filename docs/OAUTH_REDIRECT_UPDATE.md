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

## LinkedIn Developer Portal

Authorized redirect URL:

```
https://socialiq-37aa.onrender.com/api/connections/linkedin/callback
```

Products on this app (self-serve): Sign In with LinkedIn using OpenID Connect, Share on LinkedIn.

Do not add Community Management API on the same app — LinkedIn blocks mixing it with Sign In / Share. Company Page comments need a second app with only Community Management API (review required), then set `LINKEDIN_OAUTH_SCOPES` to that app’s Auth-tab scopes.

## TikTok for Developers

Login Kit redirect URI (HTTPS required):

```
https://socialiq-37aa.onrender.com/api/connections/tiktok/callback
```

Scopes: `user.info.basic`, `user.info.profile`, `video.list`.

## Meta extras

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
LINKEDIN_REDIRECT_URI=https://socialiq-37aa.onrender.com/api/connections/linkedin/callback
TIKTOK_REDIRECT_URI=https://socialiq-37aa.onrender.com/api/connections/tiktok/callback
```

Redeploy the API after changing env vars.
