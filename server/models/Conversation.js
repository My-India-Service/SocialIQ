import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['customer', 'agent', 'system'], required: true },
    text: { type: String, required: true },
    externalId: { type: String, default: '' },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const qualificationSchema = new mongoose.Schema(
  {
    cod: { type: Boolean, default: null },
    city: { type: String, default: '' },
    pincode: { type: String, default: '' },
    phone: { type: String, default: '' },
    size: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const handoffSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['website', 'whatsapp', 'booking', 'none'],
      default: 'none',
    },
    url: { type: String, default: '' },
    sentAt: { type: Date, default: null },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    platform: {
      type: String,
      enum: ['youtube', 'instagram', 'facebook', 'whatsapp'],
      required: true,
    },
    comment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'PostCampaign' },
    externalThreadId: { type: String, default: '' },
    instagramUserId: { type: String, default: '' },
    customerHandle: { type: String, default: '' },
    postTitle: { type: String, default: '' },
    stage: {
      type: String,
      enum: ['new', 'engaged', 'qualified', 'converted', 'closed'],
      default: 'new',
    },
    qualification: { type: qualificationSchema, default: () => ({}) },
    handoff: { type: handoffSchema, default: () => ({}) },
    agentTurnCount: { type: Number, default: 0, min: 0 },
    orderValue: { type: Number, default: 0, min: 0 },
    convertedAt: { type: Date, default: null },
    messages: [messageSchema],
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

conversationSchema.index({ user: 1, lastMessageAt: -1 });
conversationSchema.index({ user: 1, comment: 1 });
conversationSchema.index({ user: 1, instagramUserId: 1 });

export default mongoose.model('Conversation', conversationSchema);
