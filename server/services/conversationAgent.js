import Comment from '../models/Comment.js';
import PostCampaign from '../models/PostCampaign.js';
import {
  isQualificationComplete,
  missingQualificationFields,
  resolveHandoff,
} from './handoff.js';
import { sendInstagramDm, findInstagramConnection } from './instagramMessaging.js';
import {
  canAutoReplyToday,
  dailyAutoReplyLimitMessage,
  recordAutoReplySuccess,
} from './postReply.js';
import { paceOutboundMetaWrite } from './metaSafe.js';
import { checkoutAvailable, checkoutMessage, createCheckoutLink } from './checkout.js';

const COD_YES = /\b(cod|cash on delivery)\b/i;
const COD_NO = /\b(prepaid|online pay|upi only|no cod)\b/i;
const PINCODE = /\b(\d{6})\b/;
const PHONE = /\b(\+?91[\s-]?)?[6-9]\d{9}\b/;
const ORDER_PLACED = /\b(order(ed)?|book(ed)?|buy|purchase|payment done|paid)\b/i;

const INDIAN_CITIES =
  /\b(delhi|mumbai|bangalore|bengaluru|hyderabad|chennai|kolkata|pune|gurgaon|gurugram|noida|jaipur|lucknow|ahmedabad|chandigarh|indore|bhopal|patna|kochi|surat|nagpur|faridabad|ghaziabad|dehradun|goa|haryana|punjab|maharashtra|up|uttar pradesh|rajasthan|karnataka|tamil nadu|telangana|west bengal)\b/i;

export function extractQualificationFromText(text, existing = {}) {
  const q = { ...existing };
  const lower = String(text || '').toLowerCase();

  if (COD_YES.test(text)) q.cod = true;
  else if (COD_NO.test(text)) q.cod = false;

  const pinMatch = text.match(PINCODE);
  if (pinMatch) q.pincode = pinMatch[1];

  const phoneMatch = text.match(PHONE);
  if (phoneMatch) q.phone = phoneMatch[0].replace(/\s/g, '');

  const cityMatch = text.match(INDIAN_CITIES);
  if (cityMatch) q.city = cityMatch[1];

  if (/size\s*[:\-]?\s*(xs|s|m|l|xl|xxl|\d+)/i.test(text)) {
    const sizeMatch = text.match(/size\s*[:\-]?\s*(xs|s|m|l|xl|xxl|\d+)/i);
    if (sizeMatch) q.size = sizeMatch[1].toUpperCase();
  }

  if (q.notes) q.notes = `${q.notes}; ${text.slice(0, 80)}`;
  else q.notes = lower.slice(0, 120);

  return q;
}

function nextQuestion(missing, user) {
  const questions = user?.autoDm?.qualificationQuestions?.length
    ? user.autoDm.qualificationQuestions
    : ['COD available?', 'Delivery city?', 'Pincode?'];

  if (missing.includes('cod')) {
    return questions.find((q) => /cod/i.test(q)) || 'COD available hai?';
  }
  if (missing.includes('city')) {
    return questions.find((q) => /city|deliver/i.test(q)) || 'Kis city me delivery chahiye?';
  }
  if (missing.includes('pincode')) {
    return questions.find((q) => /pin/i.test(q)) || 'Pincode bata do for delivery?';
  }
  if (missing.includes('phone')) {
    return 'WhatsApp number share kar do order ke liye?';
  }
  return null;
}

function buildHandoffReply(handoff) {
  if (!handoff.url) return `${handoff.message}\n\nReply if you need help.`;
  return `${handoff.message}\n\n${handoff.url}`;
}

/** Payment link line for qualified buyers when comment-to-checkout is on; '' otherwise. */
async function checkoutLineFor(user, conversation) {
  if (!user?.checkout?.enabled || user.checkout.sendInDm === false || !checkoutAvailable(user)) {
    return '';
  }
  try {
    const link = await createCheckoutLink(user, { conversation });
    return checkoutMessage(link, user);
  } catch (err) {
    console.warn('[conversationAgent] checkout link failed:', err.message);
    return '';
  }
}

async function loadCampaignForConversation(conversation) {
  if (conversation.campaign) {
    return PostCampaign.findById(conversation.campaign);
  }
  if (!conversation.comment) return null;
  const comment = await Comment.findById(conversation.comment);
  if (!comment?.videoId) return null;
  return PostCampaign.findOne({
    user: conversation.user,
    platform: conversation.platform,
    externalPostId: String(comment.videoId),
    active: true,
  });
}

/**
 * Process inbound DM message: extract qualification, reply, handoff, or convert.
 */
export async function processInboundDmMessage({ user, conversation, text, sendDm = true }) {
  const inbound = String(text || '').trim();
  if (!inbound) return { ok: false, reason: 'empty_message' };

  conversation.messages.push({
    role: 'customer',
    text: inbound,
    sentAt: new Date(),
  });
  conversation.lastMessageAt = new Date();
  if (conversation.stage === 'new') conversation.stage = 'engaged';

  const qualification = extractQualificationFromText(
    inbound,
    conversation.qualification?.toObject?.() || conversation.qualification || {}
  );
  conversation.qualification = qualification;
  conversation.markModified('qualification');

  const campaign = await loadCampaignForConversation(conversation);
  let agentReply = '';
  let dmSent = false;
  let dmError = null;

  if (ORDER_PLACED.test(inbound)) {
    conversation.stage = 'converted';
    conversation.convertedAt = new Date();
    conversation.orderValue = conversation.orderValue || user.avgOrderValue || 2499;
    agentReply = 'Thank you! Order noted — team will confirm shortly.';

    if (conversation.comment) {
    await Comment.findByIdAndUpdate(conversation.comment, {
      status: 'converted',
      revenueAttributed: conversation.orderValue,
    });
    }
  } else if (isQualificationComplete(qualification) || conversation.agentTurnCount >= 3) {
    const handoff = resolveHandoff(user, campaign, {
      customerHandle: conversation.customerHandle,
    });
    conversation.stage = 'qualified';
    conversation.handoff = {
      type: handoff.type,
      url: handoff.url,
      sentAt: new Date(),
    };
    agentReply = buildHandoffReply(handoff);
    const payLine = await checkoutLineFor(user, conversation);
    if (payLine) agentReply = `${agentReply}\n\n${payLine}`;
  } else {
    const missing = missingQualificationFields(
      qualification,
      user?.autoDm?.qualificationQuestions
    );
    agentReply =
      nextQuestion(missing, user) ||
      'Thanks! COD, city, and pincode bata do — phir link bhej dete hain.';
    conversation.agentTurnCount = (conversation.agentTurnCount || 0) + 1;
  }

  conversation.messages.push({
    role: 'agent',
    text: agentReply,
    sentAt: new Date(),
  });
  await conversation.save();

  if (
    sendDm &&
    conversation.platform === 'instagram' &&
    conversation.instagramUserId &&
    process.env.META_INSTAGRAM_MESSAGING_ENABLED === 'true'
  ) {
    if (!canAutoReplyToday(user)) {
      dmError = dailyAutoReplyLimitMessage(user);
    } else {
      try {
        const connection = await findInstagramConnection(user._id || user.id);
        if (connection) {
          await paceOutboundMetaWrite();
          await sendInstagramDm(connection, conversation.instagramUserId, agentReply);
          dmSent = true;
          recordAutoReplySuccess(user);
          await user.save();
        }
      } catch (err) {
        dmError = err.message;
        console.warn('[conversationAgent] DM send failed:', err.message);
      }
    }
  }

  return {
    ok: true,
    conversation,
    agentReply,
    dmSent,
    dmError,
    stage: conversation.stage,
  };
}

export async function sendHandoffNow({ user, conversation }) {
  const campaign = await loadCampaignForConversation(conversation);
  const handoff = resolveHandoff(user, campaign, {
    customerHandle: conversation.customerHandle,
  });
  let agentReply = buildHandoffReply(handoff);
  const payLine = await checkoutLineFor(user, conversation);
  if (payLine) agentReply = `${agentReply}\n\n${payLine}`;

  conversation.stage = 'qualified';
  conversation.handoff = { type: handoff.type, url: handoff.url, sentAt: new Date() };
  conversation.messages.push({ role: 'agent', text: agentReply, sentAt: new Date() });
  conversation.lastMessageAt = new Date();
  await conversation.save();

  let dmSent = false;
  let dmError = null;
  if (
    conversation.platform === 'instagram' &&
    conversation.instagramUserId &&
    process.env.META_INSTAGRAM_MESSAGING_ENABLED === 'true'
  ) {
    if (!canAutoReplyToday(user)) {
      dmError = dailyAutoReplyLimitMessage(user);
    } else {
      try {
        const connection = await findInstagramConnection(user._id || user.id);
        if (connection) {
          await paceOutboundMetaWrite();
          await sendInstagramDm(connection, conversation.instagramUserId, agentReply);
          dmSent = true;
          recordAutoReplySuccess(user);
          await user.save();
        }
      } catch (err) {
        dmError = err.message;
        console.warn('[conversationAgent] handoff DM failed:', err.message);
      }
    }
  }

  return { conversation, agentReply, dmSent, dmError, handoff };
}

export async function convertConversation({ user, conversation, orderValue }) {
  const value = Math.max(0, Number(orderValue) || user.avgOrderValue || 2499);
  conversation.stage = 'converted';
  conversation.convertedAt = new Date();
  conversation.orderValue = value;
  await conversation.save();

  if (conversation.comment) {
    await Comment.findByIdAndUpdate(conversation.comment, {
      status: 'converted',
      revenueAttributed: value,
    });
  }

  return conversation;
}
