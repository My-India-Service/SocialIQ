import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    platform: {
      type: String,
      enum: ['youtube', 'instagram', 'facebook', 'tiktok', 'x'],
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
    likes: { type: Number, default: 0 },
    replies: { type: Number, default: 0 },
    isViral: { type: Boolean, default: false },
    isVip: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['new', 'reviewed', 'replied', 'ignored'],
      default: 'new',
    },
    postedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

commentSchema.index({ user: 1, category: 1, postedAt: -1 });
commentSchema.index({ user: 1, externalId: 1 }, { unique: true, sparse: true });

export default mongoose.model('Comment', commentSchema);
