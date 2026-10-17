const test = require('node:test');
const assert = require('node:assert/strict');
const { PRICES, selectAvatar } = require('../avatars');
const { newWallet, applyEvent } = require('../rewards');
const wallet = points => ({ ...newWallet('2026-10-01'), points });

test('all three Halloween avatars cost exactly 100 points; release avatars are free', () => {
  assert.deepEqual(Object.values(PRICES), [0, 0, 0, 100, 100, 100]);
  for (const id of Object.keys(PRICES)) {
    const before = wallet(100), after = selectAvatar(before, id, true, 123);
    assert.equal(after.points, 100 - PRICES[id]);
    assert.equal(before.points, 100);
    assert.equal(after.avatarId, id);
  }
});
test('insufficient funds, unknown IDs and selecting unowned premium avatars are rejected', () => {
  assert.throws(() => selectAvatar(wallet(99), 'halloween-diego', true), { code: 'failed-precondition' });
  assert.throws(() => selectAvatar(wallet(100), 'halloween-diego'), { code: 'permission-denied' });
  for (const id of ['bad', '__proto__', 'constructor', null]) {
    assert.throws(() => selectAvatar(wallet(100), id, true), { code: 'invalid-argument' });
  }
});
test('retrying a purchase or selecting an owned avatar never charges twice', () => {
  const first = selectAvatar(wallet(100), 'halloween-estella', true, 123);
  const retry = selectAvatar(first, 'halloween-estella', true, 456);
  assert.equal(retry.points, 0);
  assert.equal(retry.avatars['halloween-estella'].purchasedAt, 123);
  assert.equal(selectAvatar(retry, 'initial').avatarId, 'initial');
  assert.equal(selectAvatar(retry, 'halloween-estella').points, 0);
  assert.throws(() => selectAvatar(retry, 'halloween-dog', true), { code: 'failed-precondition' });
});
test('earning points after a purchase preserves ownership and selection', () => {
  const bought = selectAvatar(wallet(100), 'halloween-dog', true);
  const earned = applyEvent(bought, { type: 'friends', count: 1 }).wallet;
  assert.deepEqual(earned.avatars, bought.avatars);
  assert.equal(earned.avatarId, bought.avatarId);
});
