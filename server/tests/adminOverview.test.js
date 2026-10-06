import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminCredentialsMatch, adminEmail } from '../config/admin.js';
import { buildAdminOverview } from '../services/adminOverview.js';

test('admin login matches only the env email and password', () => {
  const previousEmail = process.env.ADMIN_EMAIL;
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousList = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAIL = ' Owner@Example.com ';
  process.env.ADMIN_PASSWORD = 'secret-pass';
  delete process.env.ADMIN_EMAILS;
  try {
    assert.equal(adminEmail(), 'owner@example.com');
    assert.equal(adminCredentialsMatch('owner@example.com', 'secret-pass'), true);
    assert.equal(adminCredentialsMatch('owner@example.com', 'wrong'), false);
    assert.equal(adminCredentialsMatch('other@example.com', 'secret-pass'), false);
  } finally {
    if (previousEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = previousEmail;
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
    if (previousList === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = previousList;
  }
});

test('overview counts plans, onboarding, and connected accounts without tokens', () => {
  const userId = '64b000000000000000000001';
  const overview = buildAdminOverview(
    [
      {
        _id: userId,
        name: 'Asha',
        email: 'asha@example.com',
        brandName: 'Asha Co',
        createdAt: new Date('2026-01-02T00:00:00Z'),
        emailVerifiedAt: new Date('2026-01-02T01:00:00Z'),
        onboardingCompletedAt: new Date('2026-01-03T00:00:00Z'),
        onboarding: { platforms: ['instagram'], primaryGoal: 'sales' },
        subscription: { planId: 'growth', status: 'active', trialEndsAt: new Date('2020-01-01') },
      },
      {
        _id: '64b000000000000000000002',
        name: 'Pending',
        email: 'pending@example.com',
        subscription: { planId: 'starter', status: 'trialing' },
      },
    ],
    [
      {
        user: userId,
        platform: 'instagram',
        accountName: '@asha',
        status: 'connected',
        connectedAt: new Date('2026-01-04T00:00:00Z'),
        accessToken: 'secret-token',
      },
    ],
    [{ _id: userId, count: 12 }]
  );

  assert.equal(overview.stats.totalUsers, 2);
  assert.equal(overview.stats.onboarded, 1);
  assert.equal(overview.stats.pendingOnboarding, 1);
  assert.equal(overview.stats.connectedAccounts, 1);
  assert.equal(overview.stats.usersWithConnection, 1);
  assert.equal(overview.stats.plans.growth, 1);
  assert.equal(overview.stats.plans.starter, 1);
  assert.equal(overview.stats.platforms.instagram, 1);
  assert.equal(overview.users[0].commentCount, 12);
  assert.equal(overview.users[0].connections[0].accountName, '@asha');
  assert.equal('accessToken' in overview.users[0].connections[0], false);
  assert.equal(overview.users[1].commentCount, 0);
  assert.deepEqual(overview.users[1].connections, []);
});
