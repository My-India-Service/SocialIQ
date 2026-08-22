import PostCampaign from '../models/PostCampaign.js';

export const DEFAULT_GLOBAL_KEYWORDS = ['price', 'link', 'dm', 'info'];

export function normalizeKeywords(list) {
  return (list || []).map((k) => String(k).trim().toLowerCase()).filter(Boolean);
}

export function commentMatchesKeywords(text, keywords) {
  if (!keywords?.length) return false;
  const lower = String(text || '').toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

export function commentMatchesAiSales(analysis, threshold = 80) {
  if (analysis.category !== 'sales_opportunity') return false;
  if (analysis.leadTemperature === 'hot') return true;
  return analysis.purchaseProbability >= threshold;
}

export function commentMatchesCampaign(comment, analysis, campaign, user) {
  if (!campaign?.active) return false;
  const matchMode = campaign.matchMode || 'both';
  const keywords = normalizeKeywords(
    campaign.keywords?.length ? campaign.keywords : user?.autoDm?.keywords
  );
  const threshold = user?.integrations?.autoReplyThreshold ?? 80;
  const keywordMatch = commentMatchesKeywords(comment.text, keywords);
  const aiMatch = commentMatchesAiSales(analysis, threshold);

  if (matchMode === 'keyword') return keywordMatch;
  if (matchMode === 'ai') return aiMatch;
  return keywordMatch || aiMatch;
}

export async function findCampaignForComment(userId, comment) {
  const postId = comment.videoId || '';
  if (!postId) return null;
  return PostCampaign.findOne({
    user: userId,
    platform: comment.platform,
    externalPostId: String(postId),
    active: true,
  });
}

export function shouldTriggerSalesAgent(user, comment, analysis, campaign) {
  if (!user?.autoDm?.enabled) return false;
  if (comment.platform !== 'instagram') return false;
  if (['spam', 'complaint', 'shipping_issue', 'refund_request'].includes(analysis.category)) {
    return false;
  }

  if (campaign) {
    return commentMatchesCampaign(comment, analysis, campaign, user);
  }

  const globalKeywords = normalizeKeywords(
    user.autoDm?.keywords?.length ? user.autoDm.keywords : DEFAULT_GLOBAL_KEYWORDS
  );
  const threshold = user?.integrations?.autoReplyThreshold ?? 80;
  return (
    commentMatchesKeywords(comment.text, globalKeywords) ||
    commentMatchesAiSales(analysis, threshold)
  );
}

export async function incrementCampaignTrigger(campaignId) {
  if (!campaignId) return;
  await PostCampaign.findByIdAndUpdate(campaignId, { $inc: { triggerCount: 1 } });
}
