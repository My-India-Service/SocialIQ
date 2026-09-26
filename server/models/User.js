import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    googleId: { type: String, index: true, sparse: true },
    brandName: { type: String, default: 'My Brand' },
    brandDescription: { type: String, default: '' },
    brandTone: {
      type: String,
      // playful kept for legacy docs; normalize to casual on read/write
      enum: ['professional', 'friendly', 'casual', 'luxury', 'funny', 'playful'],
      default: 'friendly',
    },
    aiProfile: {
      neverSay: { type: [String], default: [] },
      alwaysMention: { type: [String], default: [] },
    },
    /** Average order value used for revenue estimates (INR by default). */
    avgOrderValue: { type: Number, default: 2499, min: 0 },
    currency: { type: String, default: 'INR' },
    integrations: {
      slackWebhookUrl: { type: String, default: '' },
      /** E.164 sales phone for Meta WhatsApp Cloud API lead alerts (not a Zapier URL). */
      whatsappNotifyPhone: { type: String, default: '' },
      crmWebhookUrl: { type: String, default: '' },
      /** Helpdesk (Freshdesk/Zendesk/Zapier) webhook for complaint tickets; falls back to CRM webhook. */
      helpdeskWebhookUrl: { type: String, default: '' },
    /** Auto-route hot leads (purchaseProbability >= threshold) on sync. */
      autoRouteHotLeads: { type: Boolean, default: false },
      hotLeadThreshold: { type: Number, default: 80, min: 0, max: 100 },
      /** Post suggested reply on YouTube/Facebook when rules match (sync ingest). */
      autoReplyEnabled: { type: Boolean, default: false },
      autoReplyThreshold: { type: Number, default: 80, min: 0, max: 100 },
      autoReplyDailyLimit: { type: Number, default: 20, min: 1, max: 500 },
      autoReplyTodayCount: { type: Number, default: 0, min: 0 },
      autoReplyTodayDate: { type: String, default: '' },
    },
    autoDm: {
      enabled: { type: Boolean, default: false },
      catalogueUrl: { type: String, default: '' },
      couponCode: { type: String, default: '' },
      websiteUrl: { type: String, default: '' },
      publicReplyTemplate: {
        type: String,
        default: 'Sent you the details in DM ❤️',
      },
      keywords: {
        type: [String],
        default: ['price', 'link', 'dm', 'info'],
      },
      bookingUrl: { type: String, default: '' },
      whatsappHandoffPhone: { type: String, default: '' },
      qualificationQuestions: {
        type: [String],
        default: ['COD available?', 'Delivery city?', 'Pincode?'],
      },
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
    onboarding: {
      platforms: { type: [String], default: [] },
      primaryGoal: {
        type: String,
        enum: ['sales', 'complaints', 'both', ''],
        default: '',
      },
    },
    moderation: {
      sensitivity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
      /** Hide flagged comments on the platform automatically during sync. */
      autoHide: { type: Boolean, default: false },
      hideCompetitorAds: { type: Boolean, default: true },
      customKeywords: { type: [String], default: [] },
    },
    crisis: {
      enabled: { type: Boolean, default: true },
      keywords: {
        type: [String],
        default: ['scam', 'fraud', 'fake', 'cheat', 'consumer court', 'police complaint', 'boycott'],
      },
      /** Extra recipient; account email always receives alerts. */
      alertEmail: { type: String, default: '' },
      lastCheckedAt: { type: Date, default: null },
    },
    checkout: {
      enabled: { type: Boolean, default: false },
      upiId: { type: String, default: '' },
      payeeName: { type: String, default: '' },
      /** Send payment link automatically when DM qualification completes. */
      sendInDm: { type: Boolean, default: true },
    },
    faq: {
      type: [
        {
          intent: { type: String, required: true },
          answer: { type: String, default: '' },
          enabled: { type: Boolean, default: true },
        },
      ],
      default: [],
    },
    onboardingCompletedAt: { type: Date, default: null },
    emailVerifiedAt: { type: Date, default: null },
    emailOtpHash: { type: String, default: null },
    emailOtpExpires: { type: Date, default: null },
    emailOtpPurpose: { type: String, enum: ['verify', 'login', null], default: null },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
