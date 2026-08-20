/** Main job of the product — shown on About and in-app Help. */
export const MAIN_OBJECTIVE = {
  title: 'Catch buying intent in comments before it disappears',
  body: 'People ask “price?”, “do you deliver?”, and “where can I buy?” on YouTube, Instagram, Facebook, and WhatsApp. Those comments are leads. Voxa’s job is to pull them into one inbox, score how likely they are to buy, draft a reply in your brand tone, and send hot leads to sales — so revenue does not sit unread under a post.',
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
    body: 'Open Connect. Google OAuth for YouTube. Meta Login for a Facebook Page you admin (Instagram must be a Business/Creator account linked to that Page). After connect, click Sync comments. Inbox only fills after a successful sync.',
  },
  {
    title: '3. Connect WhatsApp (optional)',
    body: 'WhatsApp is an inbox channel + sales-phone alert — not a CRM. Settings → WhatsApp: copy Callback URL into Meta → WhatsApp setup, same verify token as META_WEBHOOK_VERIFY_TOKEN, Verify and save, subscribe to messages, then Enable WhatsApp inbox. Incoming messages appear in Inbox → platform WhatsApp (flat items, not a chat thread).',
  },
  {
    title: '4. Work the Revenue inbox (main screen)',
    body: 'This is the daily workspace. Click the stat cards to filter Hot leads, Sales, Complaints, or Needs review. Open a comment: read intent %, expected value, and the suggested reply. Approve & mark replied, Send to sales, or set status to Converted when they buy.',
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
    a: 'Connect → Connect Facebook or Instagram as a Page admin. Then Sync. If Inbox is empty, the connected Page must match Comments Manager, and you must be a tester/admin on the Meta app while it is in Development.',
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
];
