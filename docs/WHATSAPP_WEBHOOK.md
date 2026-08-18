# WhatsApp Cloud API (Meta)

Voxa talks to WhatsApp **directly** via the official Meta WhatsApp Cloud API.

Meta does **not** give you a webhook URL. Your API publishes the Callback URL; you paste that URL into Meta Developers.

```text
WhatsApp user
    → Meta WhatsApp Cloud API
    → GET/POST {SERVER_URL}/api/whatsapp/webhook
    → Voxa Node API
    → MongoDB Inbox (Comment platform=whatsapp)
```

Outbound hot-lead alerts use Graph `/{PHONE_NUMBER_ID}/messages` to the sales notify phone in Settings (not Zapier).

---

## Environment (Render API / `server/.env`)

```env
SERVER_URL=https://YOUR-API.onrender.com
META_APP_ID=
META_APP_SECRET=
META_WHATSAPP_ACCESS_TOKEN=
META_WABA_ID=
META_PHONE_NUMBER_ID=
META_WEBHOOK_VERIFY_TOKEN=choose-a-long-random-string
META_GRAPH_API_VERSION=v21.0
# Optional: approved template for leads outside the 24h window
META_WHATSAPP_LEAD_TEMPLATE=
META_WHATSAPP_LEAD_TEMPLATE_LANG=en
```

Never put the access token, app secret, or verify token in React / `VITE_*` vars.

Webhook URL Voxa exposes:

`{SERVER_URL}/api/whatsapp/webhook`

Example: `https://socialiq-37aa.onrender.com/api/whatsapp/webhook`

---

## Connection flow

1. Create/configure a Meta Developer app with the **WhatsApp** product.
2. Attach a WhatsApp Business Account and phone number; note **Phone number ID** and **WABA ID**.
3. Create a permanent/system user access token with WhatsApp permissions; set `META_WHATSAPP_ACCESS_TOKEN`.
4. Set all env vars on the Render **API** service and redeploy.
5. Voxa serves `GET`/`POST /api/whatsapp/webhook`.
6. In Meta → WhatsApp → Configuration → Webhooks, set:
   - **Callback URL** = the URL from Voxa Settings (or `{SERVER_URL}/api/whatsapp/webhook`)
   - **Verify token** = same as `META_WEBHOOK_VERIFY_TOKEN`
7. Subscribe to the **messages** field.
8. In Voxa → Settings → **Enable WhatsApp inbox** (creates a `Connection` for your user).
9. Send a WhatsApp message to the business number → it appears in Inbox (filter WhatsApp).

---

## Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/whatsapp/webhook` | none | Meta `hub.mode` / `hub.verify_token` / `hub.challenge` |
| POST | `/api/whatsapp/webhook` | `X-Hub-Signature-256` | Inbound messages → inbox |
| GET | `/api/whatsapp/status` | JWT | Safe config status for Settings UI |
| POST | `/api/whatsapp/enable` | JWT | Link this user to `META_PHONE_NUMBER_ID` |
| POST | `/api/whatsapp/test-send` | JWT | Smoke-test outbound to notify phone |

---

## Local testing

1. Run API with WhatsApp env vars set (`PORT` / `SERVER_URL`).
2. Expose HTTPS with a tunnel, e.g. `cloudflared tunnel --url http://localhost:5001` or ngrok.
3. Temporarily set `SERVER_URL` to the tunnel HTTPS origin and restart API (or paste `{tunnel}/api/whatsapp/webhook` into Meta).
4. Verify & save in Meta (GET challenge must succeed).
5. Enable inbox in Settings; message the test number; check Inbox + API logs.

On Render, use the public API host (not the static client host) as Callback URL.

---

## Settings UI

- Shows webhook URL, phone/WABA ids, token configured yes/no (never secrets).
- **Sales notify phone** (E.164) for outbound lead alerts.
- Slack / CRM webhook URL fields are unchanged (still third-party webhooks).

---

## Intentionally not Zapier

Do not use Catch Hooks, Make.com, or paste external automation URLs into WhatsApp settings. Those paths were removed for WhatsApp; CRM may still use Zapier if you choose.
