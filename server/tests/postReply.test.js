import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POST_REPLY_PLATFORMS,
  assertNotAlreadyPosted,
  canPostReplyToPlatform,
  isAlreadyPosted,
  shouldAutoReply,
} from '../services/postReply.js';

const baseUser = {
  integrations: {
    autoReplyEnabled: true,
    autoReplyThreshold: 80,
    autoReplyDailyLimit: 20,
  },
};

const baseComment = {
  platform: 'youtube',
  category: 'sales_opportunity',
  purchaseProbability: 85,
  leadTemperature: 'warm',
  suggestedReply: 'Thanks for asking!',
  externalId: 'yt-comment-1',
};

test('canPostReplyToPlatform supports youtube, facebook, instagram', () => {
  assert.equal(canPostReplyToPlatform('youtube'), true);
  assert.equal(canPostReplyToPlatform('facebook'), true);
  assert.equal(canPostReplyToPlatform('instagram'), true);
  assert.equal(canPostReplyToPlatform('whatsapp'), false);
  assert.deepEqual(POST_REPLY_PLATFORMS, ['youtube', 'facebook', 'instagram']);
});

test('isAlreadyPosted detects postedReplyAt or platformReplyId', () => {
  assert.equal(isAlreadyPosted({}), false);
  assert.equal(isAlreadyPosted({ postedReplyAt: new Date() }), true);
  assert.equal(isAlreadyPosted({ platformReplyId: 'abc' }), true);
  assert.equal(
    isAlreadyPosted({
      platformReplyId: 'pending',
      replyClaimedAt: new Date(),
    }),
    true
  );
  assert.equal(
    isAlreadyPosted({
      platformReplyId: 'pending',
      replyClaimedAt: new Date(Date.now() - 3 * 60 * 1000),
    }),
    false
  );
});

test('assertNotAlreadyPosted throws 409 when already posted', () => {
  assert.throws(
    () => assertNotAlreadyPosted({ postedReplyAt: new Date() }),
    (err) => err.status === 409
  );
});

test('shouldAutoReply respects enabled flag and threshold', () => {
  assert.equal(shouldAutoReply(baseUser, baseComment), true);

  assert.equal(
    shouldAutoReply({ integrations: { autoReplyEnabled: false } }, baseComment),
    false
  );

  assert.equal(
    shouldAutoReply(baseUser, {
      ...baseComment,
      category: 'sales_opportunity',
      purchaseProbability: 50,
      leadTemperature: 'cold',
    }),
    false
  );

  assert.equal(
    shouldAutoReply(baseUser, {
      ...baseComment,
      category: 'sales_opportunity',
      purchaseProbability: 50,
      leadTemperature: 'hot',
    }),
    true
  );
});

test('shouldAutoReply blocks spam and complaint categories', () => {
  for (const category of ['spam', 'complaint', 'shipping_issue', 'refund_request']) {
    assert.equal(
      shouldAutoReply(baseUser, { ...baseComment, category, leadTemperature: 'hot' }),
      false,
      `expected false for ${category}`
    );
  }
});

test('shouldAutoReply skips already posted comments', () => {
  assert.equal(
    shouldAutoReply(baseUser, { ...baseComment, postedReplyAt: new Date() }),
    false
  );
});

test('shouldAutoReply requires suggestedReply and externalId', () => {
  assert.equal(shouldAutoReply(baseUser, { ...baseComment, suggestedReply: '' }), false);
  assert.equal(shouldAutoReply(baseUser, { ...baseComment, externalId: '' }), false);
});
