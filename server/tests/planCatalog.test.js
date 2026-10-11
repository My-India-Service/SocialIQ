import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlanCatalog } from '../services/planCatalog.js';

test('admin can change name, amount, features, and free days', () => {
  const catalog = normalizePlanCatalog({
    trialDays: 14,
    plans: [
      { id: 'starter', name: 'Launch', priceInr: 499, features: 'One inbox\nAI replies' },
      { id: 'growth', name: 'Scale', priceInr: 1499, features: ['DM agent'] },
    ],
  });

  assert.equal(catalog.trialDays, 14);
  assert.equal(catalog.plans[0].name, 'Launch');
  assert.equal(catalog.plans[0].priceInr, 499);
  assert.deepEqual(catalog.plans[0].features, ['One inbox', 'AI replies']);
  assert.equal(catalog.plans[0].commentLimit, 2000);
  assert.equal(catalog.plans[1].name, 'Scale');
  assert.equal(catalog.plans[2].name, 'Pro');
});

test('rejects a blank plan name and a negative amount', () => {
  assert.throws(
    () => normalizePlanCatalog({ trialDays: 7, plans: [{ id: 'starter', name: '  ', priceInr: 10, features: ['A'] }] }),
    /Plan name is required/
  );
  assert.throws(
    () => normalizePlanCatalog({ trialDays: 7, plans: [{ id: 'starter', name: 'Starter', priceInr: -1, features: ['A'] }] }),
    /Amount/
  );
  assert.throws(() => normalizePlanCatalog({ trialDays: 400, plans: [] }), /Free days/);
});
