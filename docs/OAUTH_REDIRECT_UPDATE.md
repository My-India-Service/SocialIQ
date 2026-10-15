# OAuth redirect URIs (same-origin API)

The API runs on the site's own domain, so every callback is `https://www.socialaidigital.com/api/...`.

## Google Cloud Console

Authorized redirect URIs:

```
https://www.socialaidigital.com/api/connections/youtube/callback
https://www.socialaidigital.com/api/auth/google/callback
```

## Meta Developer Console

OAuth redirect URIs:

```
https://www.socialaidigital.com/api/connections/meta/callback
https://www.socialaidigital.com/api/connections/instagram/callback
```

## LinkedIn Developer Portal

Authorized redirect URL:

```
https://www.socialaidigital.com/api/connections/linkedin/callback
```

Products on this app (self-serve): Sign In with LinkedIn using OpenID Connect, Share on LinkedIn.

Do not add Community Management API on the same app — LinkedIn blocks mixing it with Sign In / Share. Company Page comments need a second app with only Community Management API (review required), then set `LINKEDIN_OAUTH_SCOPES` to that app’s Auth-tab scopes.

## TikTok for Developers

Login Kit redirect URI (HTTPS required):

```
https://www.socialaidigital.com/api/connections/tiktok/callback
```

Scopes: `user.info.basic`, `user.info.profile`, `video.list`.

## Meta extras

**App Domains:** `socialaidigital.com`

**Webhooks:**

```
https://www.socialaidigital.com/api/whatsapp/webhook
https://www.socialaidigital.com/api/instagram/webhook
```

## Server env (`~/socialiq/server/.env` on cPanel)

```
SERVER_URL=https://www.socialaidigital.com
GOOGLE_REDIRECT_URI=https://www.socialaidigital.com/api/connections/youtube/callback
GOOGLE_LOGIN_REDIRECT_URI=https://www.socialaidigital.com/api/auth/google/callback
META_REDIRECT_URI=https://www.socialaidigital.com/api/connections/meta/callback
META_INSTAGRAM_REDIRECT_URI=https://www.socialaidigital.com/api/connections/instagram/callback
LINKEDIN_REDIRECT_URI=https://www.socialaidigital.com/api/connections/linkedin/callback
TIKTOK_REDIRECT_URI=https://www.socialaidigital.com/api/connections/tiktok/callback
```

Restart the Node.js app in cPanel after changing env vars.
