/**
 * Outbound lead routing: Slack webhooks, WhatsApp Cloud API, generic CRM webhooks.
 */
import { isWhatsAppConfigured, sendWhatsAppLeadAlert } from './whatsapp.js';
import { isWhatsAppEnabled } from '../config/features.js';

function moneyLabel(amount, currency = 'INR') {
  if (currency === 'INR') return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
  return `${currency} ${Number(amount || 0).toLocaleString()}`;
}

export function formatLeadPayload(user, comment, channel) {
  return {
    event: 'voxa.lead',
    channel,
    brand: user.brandName,
    lead: {
      id: String(comment._id),
      author: comment.author,
      handle: comment.authorHandle,
      platform: comment.platform,
      text: comment.text,
      category: comment.category,
      purchaseProbability: comment.purchaseProbability,
      expectedOrderValue: comment.expectedOrderValue,
      leadTemperature: comment.leadTemperature,
      suggestedReply: comment.suggestedReply,
      postTitle: comment.postTitle,
      postedAt: comment.postedAt,
    },
    sentAt: new Date().toISOString(),
  };
}

export function formatSlackBlocks(user, comment) {
  const temp = (comment.leadTemperature || 'hot').toUpperCase();
  const value = moneyLabel(comment.expectedOrderValue, user.currency);
  return {
    text: `🔥 ${temp} lead on ${comment.platform}: ${comment.author} (${comment.purchaseProbability}% intent)`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${temp} lead · ${comment.platform}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Author*\n${comment.author} ${comment.authorHandle || ''}` },
          { type: 'mrkdwn', text: `*Intent*\n${comment.purchaseProbability}%` },
          { type: 'mrkdwn', text: `*Expected value*\n${value}` },
          { type: 'mrkdwn', text: `*Brand*\n${user.brandName}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Comment*\n>${comment.text}` },
      },
      comment.suggestedReply
        ? {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Suggested reply*\n${comment.suggestedReply}` },
          }
        : null,
    ].filter(Boolean),
  };
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Webhook ${res.status}: ${text.slice(0, 160)}`);
  }
  return true;
}

export async function sendToSlack(webhookUrl, user, comment) {
  if (!webhookUrl) return { ok: false, skipped: true, reason: 'No Slack webhook' };
  await postJson(webhookUrl, formatSlackBlocks(user, comment));
  return { ok: true, channel: 'slack' };
}

export async function sendToWhatsApp(user, comment) {
  const to = user?.integrations?.whatsappNotifyPhone;
  if (!to) return { ok: false, skipped: true, reason: 'No WhatsApp notify phone' };
  if (!isWhatsAppConfigured()) {
    return { ok: false, skipped: true, reason: 'WhatsApp Cloud API not configured' };
  }

  const message = `Hot lead (${comment.purchaseProbability}%): ${comment.author} — "${comment.text}" · Reply: ${comment.suggestedReply || '—'}`;
  await sendWhatsAppLeadAlert(to, message);
  return { ok: true, channel: 'whatsapp' };
}

export async function sendToCrm(webhookUrl, user, comment) {
  if (!webhookUrl) return { ok: false, skipped: true, reason: 'No CRM webhook' };
  await postJson(webhookUrl, formatLeadPayload(user, comment, 'crm'));
  return { ok: true, channel: 'crm' };
}

/**
 * Route a lead to configured destinations. channels: ['slack','whatsapp','crm'] or 'all'
 */
export async function routeLead(user, comment, channels = 'all') {
  const want =
    channels === 'all'
      ? ['slack', 'whatsapp', 'crm']
      : Array.isArray(channels)
        ? channels
        : [channels];

  const results = [];
  const integ = user.integrations || {};

  if (want.includes('slack') && integ.slackWebhookUrl) {
    try {
      results.push(await sendToSlack(integ.slackWebhookUrl, user, comment));
    } catch (err) {
      results.push({ ok: false, channel: 'slack', error: err.message });
    }
  }

  if (want.includes('whatsapp') && integ.whatsappNotifyPhone && isWhatsAppConfigured()) {
    try {
      results.push(await sendToWhatsApp(user, comment));
    } catch (err) {
      results.push({ ok: false, channel: 'whatsapp', error: err.message });
    }
  }

  if (want.includes('crm') && integ.crmWebhookUrl) {
    try {
      results.push(await sendToCrm(integ.crmWebhookUrl, user, comment));
    } catch (err) {
      results.push({ ok: false, channel: 'crm', error: err.message });
    }
  }

  if (results.length === 0) {
    return {
      routed: false,
      results: [],
      message: noDestinationsMessage(),
    };
  }

  const routedChannels = results.filter((r) => r.ok).map((r) => r.channel);
  return {
    routed: routedChannels.length > 0,
    results,
    routedChannels,
  };
}

export function noDestinationsMessage() {
  return isWhatsAppEnabled()
    ? 'No sales destinations configured. Add Slack webhook, WhatsApp notify phone (Cloud API), or CRM webhook in Settings.'
    : 'No sales destinations configured. Add a Slack webhook or CRM webhook in Settings.';
}

export function hasAnyIntegration(user) {
  const i = user?.integrations || {};
  return Boolean(
    i.slackWebhookUrl ||
      (i.whatsappNotifyPhone && isWhatsAppConfigured()) ||
      i.crmWebhookUrl
  );
}
