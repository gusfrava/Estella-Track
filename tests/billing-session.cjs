const assert = require('node:assert/strict');
(async () => {
  const { createBillingSession } = await import('../js/services/billing-session.js');
  const { billingKey, isLocalBillingHost, BILLING } = await import('../js/billing-config.js');
  assert.equal(billingKey(false), null);
  assert.equal(isLocalBillingHost('gusfrava.github.io'), false);
  assert.equal(isLocalBillingHost('localhost'), true);
  assert.equal(BILLING.paywallsEnabled, false);
  let user, fail = false, release;
  const info = id => ({ entitlements: { active: id === 'beta' ? { estella_plus: { isActive: true, expirationDate: null } } : {} } });
  const api = {
    async identify(id) { user = id; },
    async customerInfo() { if (fail) throw Error('offline'); if (user === 'slow') return new Promise(resolve => { release = () => resolve(info('beta')); }); return info(user); },
    async offerings() { return { all: { estella_plus_a: { availablePackages: [] } } }; },
    async disconnect() { user = null; },
  };
  const billing = createBillingSession(api, true);
  await billing.setUser('beta');
  assert.equal(billing.getState().plus, true, 'lifetime entitlement recognized');
  const free = billing.setUser('free');
  assert.equal(billing.getState().plus, null, 'clear previous access immediately');
  await free;
  assert.equal(billing.getState().plus, false);
  fail = true; await billing.setUser('offline');
  assert.equal(billing.getState().status, 'unavailable');
  assert.equal(billing.getState().plus, null, 'unknown is not free');
  fail = false; await billing.refresh();
  assert.equal(billing.getState().status, 'ready');
  const slow = billing.setUser('slow');
  while (!release) await new Promise(resolve => setImmediate(resolve));
  const logout = billing.setUser(null);
  assert.equal(billing.getState().plus, null);
  release(); await slow; await logout;
  assert.equal(billing.getState().status, 'signed-out');
  assert.equal(billing.getState().plus, null, 'late response cannot restore access');
  const disabled = createBillingSession({ identify() { throw Error('should never initialize'); } }, false);
  await disabled.setUser('beta'); assert.equal(disabled.getState().status, 'disabled');
  console.log('PASS: beta lifetime, Free, account switch, logout race, offline recovery, release guard, paywalls off');
})().catch(e => { console.error(e); process.exitCode = 1; });
