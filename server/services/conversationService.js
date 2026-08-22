import Conversation from '../models/Conversation.js';
import Comment from '../models/Comment.js';

export async function appendConversationMessage({
  userId,
  platform,
  commentId,
  role,
  text,
  customerHandle = '',
  postTitle = '',
}) {
  if (!text?.trim()) return null;

  const update = {
    $set: { lastMessageAt: new Date(), platform },
    $push: { messages: { role, text: text.trim(), sentAt: new Date() } },
  };

  if (customerHandle) update.$set.customerHandle = customerHandle;
  if (postTitle) update.$set.postTitle = postTitle;

  const filter = commentId
    ? { user: userId, comment: commentId }
    : { user: userId, platform, customerHandle };

  let conv = await Conversation.findOneAndUpdate(filter, update, {
    upsert: Boolean(commentId),
    new: true,
    setDefaultsOnInsert: true,
  });

  if (!conv && commentId) {
    conv = await Conversation.create({
      user: userId,
      platform,
      comment: commentId,
      customerHandle,
      postTitle,
      messages: [{ role, text: text.trim() }],
    });
  }

  if (conv && role === 'customer' && conv.stage === 'new') {
    conv.stage = 'engaged';
    await conv.save();
  }

  return conv;
}

export async function linkCommentToConversation(comment) {
  if (!comment?._id) return;
  await Conversation.updateMany(
    { user: comment.user, comment: comment._id },
    { $set: { stage: comment.status === 'converted' ? 'converted' : 'engaged' } }
  );
}

export async function getConversationStats(userId) {
  const [total, qualified, converted] = await Promise.all([
    Conversation.countDocuments({ user: userId }),
    Conversation.countDocuments({ user: userId, stage: { $in: ['qualified', 'converted'] } }),
    Conversation.countDocuments({ user: userId, stage: 'converted' }),
  ]);
  return { total, qualified, converted };
}

export async function ingestWhatsAppToConversation(userId, raw, user) {
  const comment = await Comment.findOne({ user: userId, externalId: raw.externalId });
  await appendConversationMessage({
    userId,
    platform: 'whatsapp',
    commentId: comment?._id,
    role: 'customer',
    text: raw.text,
    customerHandle: raw.authorHandle || raw.author,
    postTitle: raw.postTitle || 'WhatsApp message',
  });
}
