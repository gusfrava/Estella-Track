const assert=require('node:assert/strict');const fs=require('node:fs');const {pathToFileURL}=require('node:url');const path=require('node:path');
(async()=>{
 const load=p=>import(pathToFileURL(path.resolve(p)).href);
 const store=await load('js/state/store.js');
 const {mascotHTML,selectedCharacter}=await load('js/ui/mascot.js');
 const {onboardingView}=await load('js/views/onboarding.js');
 const {STEPS,AVAILABLE_CHARACTERS,getOnboardingUI}=await load('js/controllers/onboarding.js');
 getOnboardingUI();
 assert(AVAILABLE_CHARACTERS.has('diego'));
 assert.equal(selectedCharacter(),'estella');
 store.updateProfile({onboarding:{character:'diego',completedAt:123,goal:'strength'}});
 assert.equal(selectedCharacter(),'diego');
 assert.match(mascotHTML({crop:'bust'}),/portrait-0.webp/);
 assert.match(mascotHTML({mood:'excited'}),/complete-0.webp/);
 let assets=0;
 for(const character of ['estella','diego'])for(let step=0;step<STEPS.length;step++){
  const html=onboardingView({...getOnboardingUI(),step,answers:{character,goal:'strength',focus:'arms',experience:'advanced',place:'gym',daysPerWeek:3,minutes:45},plan:[]});
  for(const match of html.matchAll(/src="(file:[^"]+)"/g)){assert(fs.existsSync(new URL(match[1])),match[1]);assets++;}
  if(['goal','focus','experience','place','days','minutes'].includes(STEPS[step]))assert.match(html,new RegExp(`data-character="${character}"`));
 }
 for(const name of fs.readdirSync('icons/diego-motion').filter(name=>name.endsWith('.webp')))assert(fs.statSync('icons/diego-motion/'+name).size>1000);
 store.updateProfile({onboarding:{...store.getState().profile.onboarding,character:'estella'}});
 assert.equal(store.getState().profile.onboarding.completedAt,123);
 assert.match(mascotHTML(),/^<svg/);
 console.log(`PASS: both characters across all onboarding screens, ${assets} asset references, saved selection, portraits and celebrations.`);
})().catch(e=>{console.error(e);process.exit(1)});



