# WhatsApp Cloud API (Meta)

Voxa talks to WhatsApp **directly** via the official Meta WhatsApp Cloud API.

Meta does **not** give you a webhook URL. Your API publishes the Callback URL; you paste that URL into Meta Developers.

---

## What WhatsApp provides (not a CRM)

WhatsApp in Voxa is **not** a CRM (no contacts DB, deals, pipeline, or ownership). It does two jobs:

1. **Inbox channel** — customer messages the business number → Meta webhook → scored Inbox items (`Comment` with `platform=whatsapp`), same workflow as IG/YouTube comments.
2. **Sales alert channel** — hot-lead ping to the sales notify phone via Cloud API, **parallel** to Slack and CRM webhooks (not a replacement for them).

```text
Customer WhatsApp
    → Meta Cloud API
    → GET/POST {SERVER_URL}/api/whatsapp/webhook
    → Voxa Inbox (Comment)
    → Send to sales / auto-route
         → Slack webhook
         → WhatsApp sales phone (Graph text)
         → CRM webhook (JSON only)
```

| | WhatsApp in Voxa | CRM in Voxa |
|--|------------------|---------------|
| Role | Inbox + sales alert | Outbound JSON webhook only |
| Config | `whatsappNotifyPhone` + server Meta env | `crmWebhookUrl` |
| Contacts / deals / pipeline | No | No |
| Reply to customer from Inbox | No (does not send Graph replies to the sender) | N/A |

**Works today:** webhook verify/receive, Enable inbox, inbound text/button/interactive/media-caption → Inbox, platform filter, manual/auto Send to sales, Test send, India `91` prefix, block Meta sandbox `1555…` as recipient.

**Not built:** chat threads, reply-to-customer from Inbox, WhatsApp pull/sync (push-only), per-brand WABA OAuth (one server-wide `META_PHONE_NUMBER_ID`), Auto DM on WhatsApp, full CRM UI.

Mental model: **comments inbox + sales ping** — not Intercom / HubSpot WhatsApp inbox.

### Full WhatsApp CRM (separate deploy — do not merge)

For shared inbox threads, reply-to-customer, contacts, pipelines, broadcasts, and automations, use a **separate** self-hosted WhatsApp CRM (e.g. fork [wacrm](https://github.com/ArnasDon/wacrm) / [wacrm.tech](https://wacrm.tech/)), not an in-repo merge into Voxa.

- **Why separate:** wacrm is Next.js + Supabase; Voxa is Express + Mongo. Merging means dual auth, dual backends, and two apps fighting over one Meta webhook URL per phone number.
- **Product split:** social comments + intent scoring + Slack/CRM ping stay in Voxa; day-to-day WhatsApp sales conversations live in the CRM deploy.
- **Meta:** Prefer a dedicated WABA/number for the CRM. Do not point two apps at the same webhook without a single ingress owner.
- **Later (optional):** Settings deep-link or `routeLead` → CRM API — not copying CRM source into `client/` / `server/`.

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

`SERVER_URL` must be the **API origin only** (e.g. `https://socialiq-37aa.onrender.com`). Do not put `/api/connections/meta/callback` in `SERVER_URL` — that belongs in `META_REDIRECT_URI`. Wrong `SERVER_URL` produces a broken WhatsApp Callback URL.

### Render: which env for the WhatsApp Callback URL?

There is **no** `WHATSAPP_CALLBACK_URL` variable. On the Render **API** service set:

| Meta form field | Render env | Example |
|-----------------|------------|---------|
| Callback URL (you paste) | built from `SERVER_URL` | Meta gets `{SERVER_URL}/api/whatsapp/webhook` |
| Verify token | `META_WEBHOOK_VERIFY_TOKEN` | same string as Meta, e.g. `voxa-wa-verify-k7m9p2` |

Also set `META_WHATSAPP_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WABA_ID`, `META_APP_SECRET`, then **redeploy** the API. If Verify fails, hit `/api/health` first (wake cold start), then click Verify and save again.

Webhook URL Voxa exposes:

`{SERVER_URL}/api/whatsapp/webhook`

Example: `https://socialiq-37aa.onrender.com/api/whatsapp/webhook`

Sales notify phones: bare 10-digit Indian mobiles (`9696187534`) are auto-prefixed with `91` before Graph send.

---

## Sender vs recipient (test-send / #131030)

| Role | What it is | Example |
|------|------------|---------|
| **Business / test number** | Meta sandbox *sender* (Phone Number ID). Voxa sends *from* this via Graph. | `+1 (555) 668-1875` |
| **Recipient** | A real phone you add under Meta → Try it out → Recipient | Your personal WhatsApp |
| **Sales notify phone** (Settings) | Where Voxa sends hot-lead *alerts* (`to` in Graph) | Same as your Meta recipient, e.g. `9198xxxxxxxx` |

Do **not** put the +1 555 business test number in Sales notify phone. That causes `#131030 Recipient phone number not in allowed list`.

Outbound test steps:

1. Meta → WhatsApp → Step 1 Try it out → add **your** number as Recipient and verify.
2. Settings → Sales notify phone = that personal number (digits only).
3. Save → **Test send to sales phone**.

Meta’s “Generate token” on Try it out is separate from Voxa’s `META_WHATSAPP_ACCESS_TOKEN` in env.

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
- **Sales notify phone** = personal WhatsApp that *receives* alerts (Meta test recipient), not the +1 555 business sender.
- Slack / CRM webhook URL fields are unchanged (still third-party webhooks). CRM webhook ≠ WhatsApp inbox. See [CRM_WEBHOOK.md](./CRM_WEBHOOK.md) (Zapier vs Zoho, `voxa.lead` payload).

---

## Intentionally not Zapier (for WhatsApp)

Do not use Catch Hooks, Make.com, or paste external automation URLs into **WhatsApp** settings. Those paths were removed for WhatsApp. For **CRM**, Zapier Catch Hook or Zoho Flow is supported via the CRM webhook URL — see [CRM_WEBHOOK.md](./CRM_WEBHOOK.md).
