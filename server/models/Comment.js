import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    platform: {
      type: String,
      enum: ['youtube', 'instagram', 'facebook', 'linkedin', 'tiktok', 'x', 'whatsapp'],
      required: true,
    },
    externalId: { type: String },
    videoId: { type: String, default: '' },
    postTitle: { type: String, default: '' },
    author: { type: String, required: true },
    authorHandle: { type: String, default: '' },
    text: { type: String, required: true },
    category: {
      type: String,
      enum: [
        'sales_opportunity',
        'complaint',
        'feature_request',
        'positive_feedback',
        'spam',
        'competitor_mention',
        'refund_request',
        'shipping_issue',
        'influencer',
        'other',
      ],
      default: 'other',
    },
    purchaseProbability: { type: Number, default: 0, min: 0, max: 100 },
    /** Estimated rupees (or brand currency) this lead could convert at. */
    expectedOrderValue: { type: Number, default: 0, min: 0 },
    leadTemperature: {
      type: String,
      enum: ['hot', 'warm', 'cold', 'none'],
      default: 'none',
    },
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral',
    },
    suggestedReply: { type: String, default: '' },
    analysisSource: {
      type: String,
      enum: ['llm', 'rules'],
      default: 'rules',
    },
    /** Competitor name when category is competitor_mention. */
    competitorName: { type: String, default: '' },
    /** Feature/product theme label for aggregation. */
    featureTheme: { type: String, default: '' },
    likes: { type: Number, default: 0 },
    replies: { type: Number, default: 0 },
    isViral: { type: Boolean, default: false },
    isVip: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['new', 'reviewed', 'replied', 'ignored', 'sent_to_sales', 'converted'],
      default: 'new',
    },
    routedTo: {
      type: [String],
      default: [],
    },
    sentToSalesAt: { type: Date },
    autoDmStatus: {
      type: String,
      enum: ['none', 'queued', 'sent', 'skipped'],
      default: 'none',
    },
    autoDmPreview: { type: String, default: '' },
    /** Attribution when marked converted. */
    revenueAttributed: { type: Number, default: 0, min: 0 },
    /** Platform comment id after a successful post-reply. */
    platformReplyId: { type: String, default: '' },
    /** When platformReplyId was set to "pending" for idempotent claim. */
    replyClaimedAt: { type: Date },
    postedReplyAt: { type: Date },
    postedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

commentSchema.index({ user: 1, category: 1, postedAt: -1 });
commentSchema.index({ user: 1, externalId: 1 }, { unique: true, sparse: true });
commentSchema.index({ user: 1, leadTemperature: 1, purchaseProbability: -1 });

export default mongoose.model('Comment', commentSchema);
