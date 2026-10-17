// Server-owned avatar prices and purchases. Never accept a price or user ID from the client.
const PRICES = Object.freeze({
  'release-estella': 0, 'release-diego': 0, 'release-dog': 0,
  'halloween-estella': 100, 'halloween-diego': 100, 'halloween-dog': 100,
});

function fail(code) { throw Object.assign(new Error(code), { code }); }

function selectAvatar(wallet, id, purchase = false, now = Date.now()) {
  if (id !== 'initial' && !Object.hasOwn(PRICES, id)) fail('invalid-argument');
  const next = JSON.parse(JSON.stringify(wallet));
  const cost = id === 'initial' ? 0 : PRICES[id];
  const owned = Object.hasOwn(next.avatars || {}, id);
  if (cost && !owned) {
    if (!purchase) fail('permission-denied');
    if (!Number.isSafeInteger(next.points) || next.points < cost) fail('failed-precondition');
    next.points -= cost;
    next.avatars = { ...next.avatars, [id]: { purchasedAt: now, price: cost } };
  }
  next.avatarId = id;
  next.updatedAt = now;
  return next;
}

module.exports = { PRICES, selectAvatar };
