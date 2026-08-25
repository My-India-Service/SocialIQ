/** Main job of the product — shown on About and in-app Help. */
export const MAIN_OBJECTIVE = {
  title: 'AI Sales Agent for Social Media',
  body: 'Every comment is a potential customer. SocialAiDigital detects purchase intent in Instagram, YouTube, Facebook, and WhatsApp comments — including Hinglish like “kitne ka hai?” and “COD hai?” — replies in your brand tone, sends details in DM, qualifies the lead, and tracks ₹ sales influenced.',
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
    title: '1. Sign up and set the brand',
    body: 'Create an account. In Settings set brand name, reply tone (friendly / professional / playful / luxury), and average order value. Intent scores use AOV to estimate expected order value.',
  },
  {
    title: '2. Connect YouTube, Instagram, Facebook',
    body: 'Open Connect. Google OAuth for YouTube. For Instagram: use Connect with Instagram (instagram.com login — no Facebook Page required) or Connect via Facebook Page if IG is linked to your Page. Facebook Page connect uses Meta Login for Page comments. After connect, click Sync comments. Inbox only fills after a successful sync.',
  },
  {
    title: '3. Connect WhatsApp (optional)',
    body: 'WhatsApp is an inbox channel + sales-phone alert — not a CRM. Settings → WhatsApp: copy Callback URL into Meta → WhatsApp setup, same verify token as META_WEBHOOK_VERIFY_TOKEN, Verify and save, subscribe to messages, then Enable WhatsApp inbox. Incoming messages appear in Inbox → platform WhatsApp (flat items, not a chat thread).',
  },
  {
    title: '4. Work the Revenue inbox (main screen)',
    body: 'This is the daily workspace. Click the stat cards to filter Hot leads, Sales, Complaints, or Needs review. Open a comment: read intent %, expected value, and the suggested reply. Regenerate cycles a new draft reply. Post reply & mark done (YouTube/Facebook/Instagram), Copy reply, Save without posting, Send to sales, or set status to Converted when they buy.',
  },
  {
    title: '5. Route hot leads automatically',
    body: 'Settings → Send leads to sales. Paste Slack Incoming Webhook and/or CRM webhook. For WhatsApp alerts, save a sales notify phone (E.164). Optionally turn on auto-route when purchase probability is above your threshold.',
  },
  {
    title: '6. Check the other dashboards',
    body: 'CEO dashboard: yesterday’s comments, missed revenue, crisis alerts. Revenue & ROI: pipeline vs money you marked converted. Insights: grouped feature requests and competitor mentions — use these for product and ads, not for 1:1 replies.',
  },
  {
    title: '7. Pick a subscription plan',
    body: 'Open Billing to see your current plan (starts on Starter trial) and switch plans for demo. Public Pricing explains each tier. Enterprise is contact-sales only — no fake charge.',
  },
];

export const FAQS = [
  {
    q: 'What is the main objective of Voxa?',
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
    a: 'Official APIs only: YouTube Data API, Meta Graph (Facebook Page + Instagram), and Meta WhatsApp Cloud API. No scraping. WhatsApp is not Zapier.',
  },
  {
    q: 'How do I connect Facebook or Instagram?',
    a: 'Facebook: Connect → Connect Facebook (Page admin, facebook.com login) → Sync. Instagram (recommended): Connect with Instagram (instagram.com login, Business/Creator account, no Page required). Add the OAuth redirect URI in Meta → Instagram → Business login (Section 3), not Configure webhooks (Section 2). Alternative: Connect via Facebook Page if IG is linked in Meta Business Suite. In Development mode you must be a tester/admin on the Meta app.',
  },
  {
    q: 'How do I set the WhatsApp webhook?',
    a: 'You paste Voxa’s Callback URL into Meta (API host + /api/whatsapp/webhook). The verify token is a string you invent — same in META_WEBHOOK_VERIFY_TOKEN and the Meta form. Then Enable inbox in Settings.',
  },
  {
    q: 'Is WhatsApp a CRM in Voxa?',
    a: 'No. WhatsApp is (1) inbound messages into the shared Inbox and (2) outbound hot-lead alerts to your sales notify phone. CRM is a separate webhook URL that receives a JSON lead payload — there is no contacts/deals pipeline in the app.',
  },
  {
    q: 'What does Send to sales do?',
    a: 'It sends the lead to Slack and/or CRM webhooks, and can WhatsApp your sales notify phone via Cloud API. Configure those in Settings first. It does not reply to the customer on WhatsApp.',
  },
  {
    q: 'How is purchase intent calculated?',
    a: 'Each new comment is categorized (sales, complaint, feature, etc.) with a 0–100 purchase probability. With OPENAI_API_KEY Voxa uses an LLM; otherwise rules.',
  },
  {
    q: 'Where do I change my plan?',
    a: 'In-app: Billing (sidebar). Public comparison: Pricing. Plans are mock until payments — switch anytime to preview upgrades. Enterprise: contact sales.',
  },
  {
    q: 'What does Regenerate do on a suggested reply?',
    a: 'It drafts a new suggested reply only (does not change category). Without OPENAI_API_KEY it cycles brand-tone templates; with OpenAI it asks for a different AI draft. Save reply & mark done still only updates Voxa — it does not post to YouTube/IG/WhatsApp.',
  },
  {
    q: 'What does Save reply & mark done / Replied status mean?',
    a: 'Internal team tracking only. It saves your draft and sets status to Replied in Voxa. Use Post reply & mark done to publish on YouTube, Facebook, or Instagram in one click — or Copy reply and paste manually. Save without posting updates Voxa only.',
  },
  {
    q: 'What does Post reply & mark done do?',
    a: 'Posts your suggested reply on YouTube, Facebook, or Instagram via official APIs, then marks Replied in Voxa. WhatsApp still needs manual copy. If Meta rejects the post, reconnect on Connect (pages_manage_engagement / instagram_manage_comments). You cannot post twice — use Copy reply to edit on the platform.',
  },
  {
    q: 'How does auto-reply on sync work?',
    a: 'Settings → Auto-reply on YouTube & Facebook posts AI suggested replies for hot leads or sales comments above your threshold, up to the daily limit. Instagram uses the separate sales agent (public stub + DM) — not the long-form AI reply — to avoid double replies.',
  },
  {
    q: 'How does the Instagram sales agent work (like Delulu)?',
    a: 'Settings → Instagram sales agent. On sync, when a comment matches your global keywords (LINK, price, dm) or Hinglish AI intent (kitne ka, COD hai), Voxa posts your public reply template on the comment and sends catalogue/link details in DM. Per-reel keyword triggers: Insights → Set trigger. Requires Growth plan; real DMs need Meta App Review for instagram_business_manage_messages.',
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
