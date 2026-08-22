import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  commentMatchesKeywords,
  commentMatchesAiSales,
  commentMatchesCampaign,
  shouldTriggerSalesAgent,
  normalizeKeywords,
} from '../services/campaignTriggers.js';

const baseUser = {
  autoDm: { enabled: true, keywords: ['price', 'link'] },
  integrations: { autoReplyThreshold: 80 },
};

const salesAnalysis = {
  category: 'sales_opportunity',
  purchaseProbability: 85,
  leadTemperature: 'hot',
};

test('normalizeKeywords trims and lowercases', () => {
  assert.deepEqual(normalizeKeywords([' LINK ', 'Price']), ['link', 'price']);
});

test('commentMatchesKeywords finds substring', () => {
  assert.equal(commentMatchesKeywords('send LINK pls', ['link']), true);
  assert.equal(commentMatchesKeywords('nice post', ['link']), false);
});

test('commentMatchesAiSales respects threshold', () => {
  assert.equal(commentMatchesAiSales(salesAnalysis, 80), true);
  assert.equal(
    commentMatchesAiSales({ category: 'sales_opportunity', purchaseProbability: 50 }, 80),
    false
  );
  assert.equal(commentMatchesAiSales({ category: 'complaint', purchaseProbability: 90 }, 80), false);
});

test('commentMatchesCampaign keyword mode', () => {
  const campaign = { active: true, matchMode: 'keyword', keywords: ['info'] };
  const comment = { text: 'need INFO please' };
  assert.equal(commentMatchesCampaign(comment, salesAnalysis, campaign, baseUser), true);
});

test('commentMatchesCampaign ai mode ignores keywords', () => {
  const campaign = { active: true, matchMode: 'ai', keywords: ['zzz'] };
  const comment = { text: 'kitne ka hai?' };
  assert.equal(
    commentMatchesCampaign(comment, salesAnalysis, campaign, baseUser),
    true
  );
});

test('shouldTriggerSalesAgent global keywords on instagram', () => {
  const comment = { platform: 'instagram', text: 'dm me the link' };
  assert.equal(
    shouldTriggerSalesAgent(baseUser, comment, { category: 'praise', purchaseProbability: 10 }, null),
    true
  );
});

test('shouldTriggerSalesAgent skips non-instagram', () => {
  const comment = { platform: 'youtube', text: 'price?' };
  assert.equal(
    shouldTriggerSalesAgent(baseUser, comment, salesAnalysis, null),
    false
  );
});

test('shouldTriggerSalesAgent disabled when autoDm off', () => {
  const comment = { platform: 'instagram', text: 'price?' };
  assert.equal(
    shouldTriggerSalesAgent({ autoDm: { enabled: false } }, comment, salesAnalysis, null),
    false
  );
});
