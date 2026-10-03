/** Main job of the product — shown on About and in-app Help. */
export const MAIN_OBJECTIVE = {
  title: 'AI Sales Agent for Social Media',
  body: 'Every comment is a potential customer. SocialAiDigital detects purchase intent in Instagram, YouTube, Facebook, LinkedIn, TikTok, and WhatsApp comments — including Hinglish like “kitne ka hai?” and “COD hai?” — replies in your brand tone, sends details in DM, qualifies the lead, and tracks ₹ sales influenced.',
};

export const OBJECTIVES = [
  {
    title: 'Find the money in comments',
    body: 'Surface hot leads (high purchase probability) instead of scrolling every thread.',
  },
  {
    title: 'Reply in your brand voice',
    body: 'Use suggested replies, then mark replied or convert when an order lands.',
  },
  {
    title: 'Hand off to sales',
    body: 'One click to Slack, CRM, or WhatsApp for the sales phone you configure.',
  },
  {
    title: 'See what the business is missing',
    body: 'CEO dashboard, ROI, and insights: lost pipeline, complaints, features, competitors.',
  },
];

export const GUIDE_STEPS = [
  {
    title: '1. Your free trial',
    body: 'Every new account gets 30 days of full Pro access — 75k comments a month and the Instagram DM sales agent — with no card needed. The banner at the top shows the days left. When the trial ends you drop to Starter limits unless you pick a plan in Billing.',
  },
  {
    title: '2. Set up your brand',
    body: 'Settings: brand name, reply tone (professional / friendly / casual / luxury / funny), and average order value — intent scores use it to estimate order value. AI Setup: teach the AI your products, FAQs, and policies so replies sound like your brand.',
  },
  {
    title: '3. Connect your accounts',
    body: 'Open Connect and link YouTube (Google login), Instagram (Connect with Instagram — no Facebook Page needed), Facebook Page, LinkedIn, or TikTok. Each platform shows which channel, page, or account it is connected as. Click Sync comments — the Inbox only fills after a sync. For YouTube you can pick a From / To period to pull older comments.',
  },
  {
    title: '4. Work the Inbox every day',
    body: 'Click the stat cards to filter Hot leads, Sales, Complaints, or Needs review. Use the Posted filter (24h, 7 days, 30 days, 90 days, or a custom range) — every comment shows when it was posted. Open a comment to see intent %, expected value, and the suggested reply. Post reply & mark done (YouTube / Facebook / Instagram / LinkedIn), Copy reply, Send to sales, or set Converted when they buy. Export CSV for Excel or your CRM.',
  },
  {
    title: '5. Sell in DMs',
    body: 'Conversations: comment → public reply → DM threads where the AI qualifies the buyer (COD, city, pincode). Lead Center: a mini CRM of high-intent buyers. Checkout: send UPI / Razorpay payment links and track paid orders.',
  },
  {
    title: '6. Protect the brand',
    body: 'Complaints: refunds, shipping issues, and public frustration in one place. Tickets: every complaint gets an owner and an SLA. Moderation: hide spam, bots, abuse, and competitor ads. Brand health: one score for how your community feels — it shows “No data yet” until comments are synced.',
  },
  {
    title: '7. Measure what is working',
    body: 'CEO dashboard: yesterday’s comments, missed revenue, and crisis alerts. Revenue & ROI: pipeline vs money you marked converted. Posts: which posts make money. Insights: feature requests and competitor mentions — use them for product and ads.',
  },
  {
    title: '8. Route leads and WhatsApp (optional)',
    body: 'Settings → Send leads to sales: paste a Slack Incoming Webhook and/or CRM webhook, save a sales notify phone for WhatsApp alerts, and optionally auto-route above a purchase-probability threshold. Settings → WhatsApp: paste the Callback URL into Meta, verify, then Enable WhatsApp inbox to see messages in the Inbox.',
  },
  {
    title: '9. Plans and billing',
    body: 'Billing highlights your current plan and shows the trial days left. Switch to Starter, Growth, or Pro anytime; Agency is contact-sales. Public Pricing compares every tier.',
  },
];

export const FAQS = [
  {
    q: 'What is the main objective of SocialAiDigital?',
    a: 'Turn social comments into revenue: find people who want to buy, reply fast in brand voice, and send hot leads to sales before the thread goes cold.',
  },
  {
    q: 'What should I do every day?',
    a: 'Open Inbox, click Hot leads (or Needs review), approve replies, send sales-ready comments to sales, and mark Converted when an order happens. Then glance at CEO dashboard.',
  },
  {
    q: 'Who is it for?',
    a: 'D2C / Shopify-style brands that get buying questions, complaints, and product requests in comments and lose sales when those sit unanswered.',
  },
  {
    q: 'Where do comments come from?',
    a: 'Official APIs only: YouTube Data API, Meta Graph (Facebook Page + Instagram), LinkedIn Community Management, TikTok Login Kit / Display API, and Meta WhatsApp Cloud API. No scraping. WhatsApp is not Zapier.',
  },
  {
    q: 'How do I connect Facebook or Instagram?',
    a: 'Facebook: Connect → Connect Facebook (Page admin, facebook.com login) → Sync. Instagram (recommended): Connect with Instagram (instagram.com login, Business/Creator account, no Page required). Add the OAuth redirect URI in Meta → Instagram → Business login (Section 3), not Configure webhooks (Section 2). Alternative: Connect via Facebook Page if IG is linked in Meta Business Suite. In Development mode you must be a tester/admin on the Meta app. LinkedIn: Connect → Connect LinkedIn. Enable Sign In with LinkedIn (OpenID) and Share on LinkedIn only — Community Management API cannot sit on the same app. TikTok: Connect → Connect TikTok (Login Kit).',
  },
  {
    q: 'How do I set the WhatsApp webhook?',
    a: 'You paste SocialAiDigital’s Callback URL into Meta (API host + /api/whatsapp/webhook). The verify token is a string you invent — same in META_WEBHOOK_VERIFY_TOKEN and the Meta form. Then Enable inbox in Settings.',
  },
  {
    q: 'Is WhatsApp a CRM in SocialAiDigital?',
    a: 'No. WhatsApp is (1) inbound messages into the shared Inbox and (2) outbound hot-lead alerts to your sales notify phone. CRM is a separate webhook URL that receives a JSON lead payload — there is no contacts/deals pipeline in the app.',
  },
  {
    q: 'What does Send to sales do?',
    a: 'It sends the lead to Slack and/or CRM webhooks, and can WhatsApp your sales notify phone via Cloud API. Configure those in Settings first. It does not reply to the customer on WhatsApp.',
  },
  {
    q: 'How is purchase intent calculated?',
    a: 'Each new comment is categorized (sales, complaint, feature, etc.) with a 0–100 purchase probability. With OPENAI_API_KEY SocialAiDigital uses an LLM; otherwise rules.',
  },
  {
    q: 'Where do I change my plan?',
    a: 'In-app: Billing (sidebar). Public comparison: Pricing. Every account starts with a 30-day free trial with full Pro access; after it ends you are on Starter limits unless you choose a plan. Agency: contact sales.',
  },
  {
    q: 'Can I see older comments or comments from a specific date?',
    a: 'Yes. In the Inbox, use the Posted filter for the last 24 hours, 7, 30, or 90 days, or pick a custom From / To range. To pull older YouTube comments into the Inbox, open Connect, choose a From / To period next to YouTube, and click Sync this period.',
  },
  {
    q: 'What does Regenerate do on a suggested reply?',
    a: 'It drafts a new suggested reply only (does not change category). Without OPENAI_API_KEY it cycles brand-tone templates; with OpenAI it asks for a different AI draft. Save reply & mark done still only updates SocialAiDigital — it does not post to YouTube/IG/WhatsApp.',
  },
  {
    q: 'What does Save reply & mark done / Replied status mean?',
    a: 'Internal team tracking only. It saves your draft and sets status to Replied in SocialAiDigital. Use Post reply & mark done to publish on YouTube, Facebook, or Instagram in one click — or Copy reply and paste manually. Save without posting updates SocialAiDigital only.',
  },
  {
    q: 'What does Post reply & mark done do?',
    a: 'Posts your suggested reply on YouTube, Facebook, Instagram, or LinkedIn via official APIs, then marks Replied in SocialAiDigital. WhatsApp and TikTok still need manual copy. If Meta rejects the post, reconnect on Connect (pages_manage_engagement / instagram_manage_comments). You cannot post twice — use Copy reply to edit on the platform.',
  },
  {
    q: 'How does auto-reply on sync work?',
    a: 'Settings → Auto-reply on YouTube & Facebook posts AI suggested replies for hot leads or sales comments above your threshold, up to the daily limit. Instagram uses the separate sales agent (public stub + DM) — not the long-form AI reply — to avoid double replies.',
  },
  {
    q: 'How does the Instagram sales agent work?',
    a: 'Settings → Instagram sales agent. On sync, when a comment matches your global keywords (LINK, price, dm) or Hinglish AI intent (kitne ka, COD hai), SocialAiDigital posts your public reply template on the comment and sends catalogue/link details in DM. Per-reel keyword triggers: Insights → Set trigger. Requires Growth or above (included in the free trial); real DMs need Meta App Review for instagram_business_manage_messages.',
  },
  {
    q: 'What is the full Reel → Sale loop?',
    a: 'Reel comment → AI intent → auto public reply → DM conversation → qualify (COD, city, pincode) → handoff to website, WhatsApp, or booking link based on campaign objective → mark converted to track ₹ sales influenced. Open Conversations to view threads and simulate DM replies before Instagram webhooks are live.',
  },
  {
    q: 'How do I export leads to Excel?',
    a: 'Inbox → Export leads CSV: only sales opportunities, hot/warm intent, or already sent/converted leads — with sales-friendly columns for Excel/Zoho. Use Export all comments for the full dump (praise/other included). Current filters still apply; try Sales or Hot to narrow further. Up to 5,000 rows.',
  },
];
