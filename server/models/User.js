import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    brandName: { type: String, default: 'My Brand' },
    brandTone: {
      type: String,
      enum: ['friendly', 'professional', 'playful', 'luxury'],
      default: 'friendly',
    },
    /** Average order value used for revenue estimates (INR by default). */
    avgOrderValue: { type: Number, default: 2499, min: 0 },
    currency: { type: String, default: 'INR' },
    integrations: {
      slackWebhookUrl: { type: String, default: '' },
      /** E.164 sales phone for Meta WhatsApp Cloud API lead alerts (not a Zapier URL). */
      whatsappNotifyPhone: { type: String, default: '' },
      crmWebhookUrl: { type: String, default: '' },
    /** Auto-route hot leads (purchaseProbability >= threshold) on sync. */
      autoRouteHotLeads: { type: Boolean, default: false },
      hotLeadThreshold: { type: Number, default: 80, min: 0, max: 100 },
      /** Post suggested reply on YouTube/Facebook when rules match (sync ingest). */
      autoReplyEnabled: { type: Boolean, default: false },
      autoReplyThreshold: { type: Number, default: 80, min: 0, max: 100 },
      autoReplyDailyLimit: { type: Number, default: 50, min: 1, max: 500 },
      autoReplyTodayCount: { type: Number, default: 0, min: 0 },
      autoReplyTodayDate: { type: String, default: '' },
    },
    autoDm: {
      enabled: { type: Boolean, default: false },
      catalogueUrl: { type: String, default: '' },
      couponCode: { type: String, default: '' },
      websiteUrl: { type: String, default: '' },
    },
    /** Mock subscription until Stripe. */
    subscription: {
      planId: {
        type: String,
        enum: ['starter', 'growth', 'business', 'enterprise'],
        default: 'starter',
      },
      status: {
        type: String,
        enum: ['trialing', 'active', 'canceled'],
        default: 'trialing',
      },
      updatedAt: { type: Date, default: Date.now },
    },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
