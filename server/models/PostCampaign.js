import mongoose from 'mongoose';

const postCampaignSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    platform: {
      type: String,
      enum: ['youtube', 'instagram', 'facebook'],
      required: true,
    },
    externalPostId: { type: String, required: true },
    postTitle: { type: String, default: '' },
    objective: {
      type: String,
      enum: ['leads', 'sell', 'link', 'appointment'],
      default: 'sell',
    },
    keywords: { type: [String], default: [] },
    publicReplyTemplate: { type: String, default: '' },
    dmLink: { type: String, default: '' },
    matchMode: {
      type: String,
      enum: ['keyword', 'ai', 'both'],
      default: 'both',
    },
    triggerCount: { type: Number, default: 0, min: 0 },
    bookingUrl: { type: String, default: '' },
    whatsappHandoffPhone: { type: String, default: '' },
    handoffMessage: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

postCampaignSchema.index({ user: 1, platform: 1, externalPostId: 1 }, { unique: true });

export default mongoose.model('PostCampaign', postCampaignSchema);
