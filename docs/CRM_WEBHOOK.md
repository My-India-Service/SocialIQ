# CRM webhook (Zapier vs Zoho)

SocialAiDigital does **not** ship a native Zoho or Zapier SDK. Settings → **CRM webhook URL** receives a JSON `POST` when you **Send to sales** or auto-route a hot lead (`server/services/integrations.js` → `sendToCrm` / `formatLeadPayload`).

Paste any HTTPS URL that accepts JSON: Zapier Catch Hook, Zoho Flow webhook, Make, n8n, or your own middleware.

---

## Payload (`voxa.lead`)

```json
{
  "event": "voxa.lead",
  "channel": "crm",
  "brand": "My Brand",
  "lead": {
    "id": "64f…",
    "author": "Priya",
    "handle": "@priya",
    "platform": "instagram",
    "text": "Do you deliver in Delhi?",
    "category": "sales_opportunity",
    "purchaseProbability": 95,
    "expectedOrderValue": 2499,
    "leadTemperature": "hot",
    "suggestedReply": "Yes — we ship pan-India…",
    "postTitle": "Summer drop",
    "postedAt": "2026-08-20T10:00:00.000Z"
  },
  "sentAt": "2026-08-20T10:01:00.000Z"
}
```

Map `lead.author`, `lead.text`, `lead.purchaseProbability`, `lead.expectedOrderValue`, and `lead.suggestedReply` into your CRM Lead/Deal fields.

---

## Zapier vs Zoho CRM (for this app)

They are **not** substitutes:

| | [Zapier](https://zapier.com/pricing) | [Zoho CRM](https://www.zoho.com/crm/zohocrm-pricing.html) |
|--|--------|-----------|
| What it is | Automation **glue** | Actual **CRM** (leads, deals, pipeline) |
| Stores sales pipeline? | No | Yes |
| SocialAiDigital URL | Catch Hook (webhooks on paid plans) | Zoho Flow / CRM webhook / custom function URL |
| Replaces SocialAiDigital Slack / WA alerts? | Redundant — SocialAiDigital already has Slack + WhatsApp notify | No — CRM is for lead records |

**Recommendation**

1. **Primary CRM: Zoho CRM** (or any real CRM) — better feature + India seat pricing for tracked leads.
2. **Zapier: optional glue** — use when you need multi-app fan-out (Zoho + Sheets + email). Prefer **Zoho Flow alone** if Zoho is the only destination (avoids paying Zapier task costs).
3. Do **not** replace SocialAiDigital’s native Slack / WhatsApp notify with Zapier unless you need extra destinations.
4. Full WhatsApp conversation CRM (threads, reply UI) is a separate product — see [WHATSAPP_WEBHOOK.md](./WHATSAPP_WEBHOOK.md) (e.g. self-hosted wacrm). Zoho here = traditional sales CRM for comment-originated leads.

### Pricing snapshot (approx — verify on vendor sites)

- **Zapier:** task-based (USD). Free ~100 tasks/mo is for testing; Professional ~$20/mo annual unlocks webhooks. Cost grows with every lead POST.
- **Zoho CRM (India):** per-user INR (e.g. Free for 3 users; Standard ~₹800/user/mo annual). You pay seats, not per SocialAiDigital lead (edition API/webhook caps still apply).

Zapier + Zoho together means **paying both** — only worth it for multi-app Zaps.

---

## Can you use both?

Yes:

1. Settings → CRM webhook = Zapier Catch Hook URL  
2. Zap: Catch Hook → Create Zoho CRM Lead (map `voxa.lead` fields)  
3. Optional same Zap: Google Sheet / email  

**Cheaper when Zoho-only:** point `crmWebhookUrl` at Zoho Flow (or middleware) that creates the Lead — skip Zapier.

---

## Setup checklist

1. Settings → paste CRM webhook URL → Save  
2. Inbox → **Send to sales** (or enable auto-route + threshold)  
3. Confirm the catch/flow receives `event: "voxa.lead"`  
4. Keep the hot-lead threshold high enough so you do not flood Zapier tasks or CRM with noise  

WhatsApp Cloud API inbox/alerts are separate from this CRM field — do not paste Catch Hooks into WhatsApp settings ([WHATSAPP_WEBHOOK.md](./WHATSAPP_WEBHOOK.md)).
