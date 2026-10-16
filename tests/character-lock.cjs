const assert = require('node:assert/strict');
(async () => {
 const store = await import('../js/state/store.js');
 const ob = await import('../js/controllers/onboarding.js');
 store.updateProfile({ onboarding: {} });
 ob.resetOnboardingUI();
 ob.choose('character', 'diego');
 assert.equal(ob.isCharacterLocked(), false);
 ob.choose('character', 'estella');
 ob.choose('character', 'diego');
 ob.getOnboardingUI().step = 1;
 ob.next();
 assert.equal(ob.isCharacterLocked(), true);
 ob.back();
 ob.choose('character', 'estella');
 assert.equal(ob.getOnboardingUI().answers.character, 'diego');
 ob.replayOnboarding();
 ob.choose('character', 'estella');
 assert.equal(store.getState().profile.onboarding.character, 'diego');
 // Even stale UI answers cannot overwrite the confirmed companion on another save.
 ob.getOnboardingUI().answers.character = 'estella';
 ob.choose('goal', 'strength');
 assert.equal(store.getState().profile.onboarding.character, 'diego');
 for (const marker of ['completedAt', 'skippedAt']) {
  store.updateProfile({ onboarding: {character:'estella', [marker]:123} });
  ob.resetOnboardingUI(); ob.choose('character','diego');
  assert.equal(store.getState().profile.onboarding.character,'estella');
 }
 console.log('PASS: confirmation locks choice; back, replay, stale saves and legacy profiles preserve it.');
})().catch(e => { console.error(e); process.exit(1); });
