import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Comment from './models/Comment.js';
import Connection from './models/Connection.js';
import { analyzeCommentRules } from './services/ai.js';

const SAMPLE_COMMENTS = [
  { platform: 'instagram', postTitle: 'Summer drop reel', author: 'Priya Mehta', authorHandle: '@priya.m', text: 'How much is this?', likes: 12, replies: 2 },
  { platform: 'instagram', postTitle: 'Summer drop reel', author: 'Arjun K', authorHandle: '@arjunk', text: 'Do you ship to Bangalore?', likes: 8, replies: 1 },
  { platform: 'youtube', postTitle: 'Unboxing the new earbuds', author: 'TechNora', authorHandle: '@technora', text: 'Is this available in black?', likes: 45, replies: 6, isVip: true },
  { platform: 'youtube', postTitle: 'Unboxing the new earbuds', author: 'Rahul S', authorHandle: '@rahuls', text: 'Mine stopped working after two weeks.', likes: 210, replies: 48 },
  { platform: 'instagram', postTitle: 'Customer love post', author: 'Sneha R', authorHandle: '@snehar', text: 'Please check your DM.', likes: 3, replies: 0 },
  { platform: 'instagram', postTitle: 'Restock story', author: 'Vikram', authorHandle: '@vik.ram', text: 'When is this back in stock?', likes: 67, replies: 11 },
  { platform: 'youtube', postTitle: 'Unboxing the new earbuds', author: 'Ananya', authorHandle: '@ananya', text: 'I bought it and it\'s amazing.', likes: 320, replies: 22 },
  { platform: 'instagram', postTitle: 'Summer drop reel', author: 'Dev Patel', authorHandle: '@devp', text: 'Is this available in XL?', likes: 19, replies: 3 },
  { platform: 'youtube', postTitle: '30-day review', author: 'Meera', authorHandle: '@meerav', text: 'Received mine yesterday and zipper broke.', likes: 88, replies: 31 },
  { platform: 'instagram', postTitle: 'Customer love post', author: 'Kabir', authorHandle: '@kabir', text: 'Love this product.', likes: 54, replies: 4 },
  { platform: 'instagram', postTitle: 'Colorways teaser', author: 'Isha', authorHandle: '@isha', text: 'Please launch this in blue.', likes: 120, replies: 18 },
  { platform: 'youtube', postTitle: 'Support FAQ', author: 'AngryBuyer', authorHandle: '@angryb', text: 'Worst support ever.', likes: 41, replies: 27 },
  { platform: 'instagram', postTitle: 'Summer drop reel', author: 'Neha', authorHandle: '@neha', text: 'Need this.', likes: 9, replies: 1 },
  { platform: 'youtube', postTitle: 'Unboxing the new earbuds', author: 'Rohan', authorHandle: '@rohan', text: 'Where can I buy?', likes: 33, replies: 5 },
  { platform: 'instagram', postTitle: 'Colorways teaser', author: 'Tara', authorHandle: '@tara', text: 'Looks nice.', likes: 6, replies: 0 },
  { platform: 'youtube', postTitle: '30-day review', author: 'BatteryGuy', authorHandle: '@battg', text: 'Battery drains too fast on the black model.', likes: 156, replies: 40 },
  { platform: 'instagram', postTitle: 'Restock story', author: 'MumbaiShopper', authorHandle: '@mumbais', text: 'Shipping to Mumbai took forever. Still waiting.', likes: 28, replies: 9 },
  { platform: 'youtube', postTitle: 'Unboxing the new earbuds', author: 'CompareKing', authorHandle: '@cmpk', text: "I'm buying Samsung instead.", likes: 72, replies: 19 },
  { platform: 'instagram', postTitle: 'Summer drop reel', author: 'SpamBot', authorHandle: '@free.crypto', text: 'DM me for crypto giveaway bit.ly/xyz', likes: 0, replies: 0 },
  { platform: 'youtube', postTitle: 'Support FAQ', author: 'RefundRita', authorHandle: '@rrita', text: 'I want a refund. Money back please.', likes: 15, replies: 3 },
  { platform: 'instagram', postTitle: 'Colorways teaser', author: 'EcoFan', authorHandle: '@ecofan', text: 'Please add a vegan option under ₹999.', likes: 94, replies: 12 },
  { platform: 'youtube', postTitle: 'App tour', author: 'NightOwl', authorHandle: '@nightowl', text: 'Wish you had dark mode.', likes: 201, replies: 35 },
  { platform: 'instagram', postTitle: 'Summer drop reel', author: 'CelebWave', authorHandle: '@celebwave', text: 'This is fire — wearing it on tour!', likes: 2400, replies: 180, isVip: true },
  { platform: 'youtube', postTitle: 'Unboxing the new earbuds', author: 'NothingFan', authorHandle: '@nfan', text: 'Nothing Phone looks better than this.', likes: 55, replies: 14 },
];

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/voxa';
  await mongoose.connect(uri);

  await Promise.all([User.deleteMany({}), Comment.deleteMany({}), Connection.deleteMany({})]);

  const password = await bcrypt.hash('demo1234', 10);
  const user = await User.create({
    name: 'Demo Founder',
    email: 'demo@voxa.app',
    password,
    brandName: 'NovaWear',
    brandTone: 'friendly',
  });

  // No OAuth stubs — connect real channels from the dashboard
  // (YouTube / Instagram / Facebook)

  const docs = SAMPLE_COMMENTS.map((c, i) => {
    const analysis = analyzeCommentRules(c.text, user.brandTone);
    const postedAt = new Date(Date.now() - i * 45 * 60 * 1000);
    return {
      user: user._id,
      ...c,
      ...analysis,
      isViral: (c.likes || 0) + (c.replies || 0) >= 100,
      postedAt,
      status: i % 5 === 0 ? 'reviewed' : 'new',
    };
  });

  await Comment.insertMany(docs);

  console.log('Seed complete');
  console.log('Login: demo@voxa.app / demo1234');
  console.log(`Loaded ${docs.length} comments for NovaWear`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
