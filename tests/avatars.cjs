const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const { AVATARS } = await import('../js/data/avatars.js');
 const { PRICES } = require('../functions/avatars');
 const { setWallet } = await import('../js/state/rewards.js');
 const { accountAvatarHTML, isAvatarOnlyWalletChange } = await import('../js/ui/avatar.js');
 const before = {points:100,avatarId:'release-estella',updatedAt:1,badges:{}};
 assert.equal(isAvatarOnlyWalletChange({...before,avatarId:'release-diego',updatedAt:2},before),true);
 assert.equal(isAvatarOnlyWalletChange({...before,points:0},before),false);
 assert.equal(isAvatarOnlyWalletChange({...before,badges:{w1:123}},before),false);
 assert.equal(isAvatarOnlyWalletChange(before,undefined),false);
 for (const avatar of AVATARS) {
  assert.equal(avatar.price, PRICES[avatar.id]);
  assert(fs.statSync(`icons/avatars/${avatar.id}.webp`).size > 1000);
 }
 setWallet(undefined); assert.equal(accountAvatarHTML('<J>'), '&lt;J&gt;');
 setWallet({ avatarId: 'halloween-estella', points: 100 });
 assert.equal(accountAvatarHTML('J'), 'J');
 setWallet({ avatarId: 'halloween-estella', points: 0, avatars: { 'halloween-estella': { price: 100 } } });
 assert.match(accountAvatarHTML('J'), /halloween-estella.webp/);
 setWallet({ avatarId: 'release-diego', points: 0 });
 assert.match(accountAvatarHTML('J'), /release-diego.webp/);
 setWallet({ avatarId: 'invalid' }); assert.equal(accountAvatarHTML('J'), 'J');
 console.log('PASS: avatar catalog prices, six assets, ownership rendering and initial fallback.');
})().catch(e => {console.error(e);process.exit(1)});
