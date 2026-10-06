import { effectivePlanId, isTrialActive, PLAN_IDS } from '../config/plans.js';

const PLATFORMS = ['youtube', 'instagram', 'facebook', 'linkedin', 'tiktok', 'x', 'whatsapp'];
const STATUSES = ['trialing', 'active', 'canceled'];

export function buildAdminOverview(users, connections, commentCounts) {
  const commentsByUser = new Map(commentCounts.map((row) => [String(row._id), row.count || 0]));
  const connsByUser = new Map();

  for (const connection of connections) {
    const key = String(connection.user);
    if (!connsByUser.has(key)) connsByUser.set(key, []);
    connsByUser.get(key).push({
      platform: connection.platform,
      accountName: connection.accountName || '',
      status: connection.status || 'connected',
      connectedAt: connection.connectedAt || connection.createdAt || null,
      lastSyncedAt: connection.lastSyncedAt || null,
    });
  }

  const plans = Object.fromEntries(PLAN_IDS.map((id) => [id, 0]));
  const statuses = Object.fromEntries(STATUSES.map((id) => [id, 0]));
  const platforms = Object.fromEntries(PLATFORMS.map((id) => [id, 0]));
  let onboarded = 0;
  let emailVerified = 0;
  let usersWithConnection = 0;

  const rows = users.map((user) => {
    const id = String(user._id);
    const planId = PLAN_IDS.includes(user.subscription?.planId) ? user.subscription.planId : 'starter';
    const status = STATUSES.includes(user.subscription?.status) ? user.subscription.status : 'trialing';
    plans[planId] += 1;
    statuses[status] += 1;
    if (user.onboardingCompletedAt) onboarded += 1;
    if (user.emailVerifiedAt) emailVerified += 1;

    const userConnections = connsByUser.get(id) || [];
    if (userConnections.some((c) => c.status === 'connected')) usersWithConnection += 1;
    for (const connection of userConnections) {
      if (connection.status === 'connected' && platforms[connection.platform] != null) {
        platforms[connection.platform] += 1;
      }
    }

    return {
      id,
      name: user.name,
      email: user.email,
      brandName: user.brandName || '',
      createdAt: user.createdAt || null,
      emailVerifiedAt: user.emailVerifiedAt || null,
      onboardingCompletedAt: user.onboardingCompletedAt || null,
      onboarding: {
        platforms: user.onboarding?.platforms || [],
        primaryGoal: user.onboarding?.primaryGoal || '',
      },
      subscription: {
        planId,
        status,
        updatedAt: user.subscription?.updatedAt || null,
        trialEndsAt: user.subscription?.trialEndsAt || null,
        trialActive: isTrialActive(user),
        effectivePlanId: effectivePlanId(user),
      },
      commentCount: commentsByUser.get(id) || 0,
      connections: userConnections,
    };
  });

  return {
    stats: {
      totalUsers: users.length,
      onboarded,
      pendingOnboarding: users.length - onboarded,
      emailVerified,
      connectedAccounts: connections.filter((c) => c.status === 'connected').length,
      usersWithConnection,
      plans,
      statuses,
      platforms,
    },
    users: rows,
  };
}
