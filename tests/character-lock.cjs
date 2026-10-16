const assert = require('node:assert/strict');
(async () => {
 const store = await import('../js/state/store.js');
 const ob = await import('../js/controllers/onboarding.js');
 for (const previous of [{}, {character:'diego',characterConfirmedAt:123}, {character:'diego',skippedAt:123}]) {
  store.updateProfile({onboarding:previous}); ob.resetOnboardingUI();
  ob.choose('character','diego'); ob.getOnboardingUI().step=1; ob.next();
  assert.equal(ob.isCharacterLocked(),false);
  ob.back();ob.choose('character','estella');
  assert.equal(store.getState().profile.onboarding.character,'estella');
 }
 store.updateProfile({onboarding:{character:'diego',completedAt:123}});
 ob.replayOnboarding();ob.choose('character','estella');
 assert.equal(ob.getOnboardingUI().answers.character,'diego');
 ob.getOnboardingUI().answers.character='estella';ob.choose('goal','strength');
 assert.equal(store.getState().profile.onboarding.character,'diego');
 console.log('PASS: selection stays editable before completion (including old early locks); completed choices survive replay and stale saves.');
})().catch(e=>{console.error(e);process.exit(1)});
