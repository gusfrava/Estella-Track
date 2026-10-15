const {chromium}=require('C:/Users/gusfr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Slow image responses and rapid selections must never show stacked poses or
 // let a discarded scene finish decoding and take over the latest selection.
 const rapid=await browser.newPage({viewport:{width:390,height:844}});
 await rapid.route('**/icons/onboarding-motion/*.webp',async route=>{
   await new Promise(resolve=>setTimeout(resolve,250));await route.continue();
 });
 for(const [step,key,choices,lastScene] of [
   ['goal','goal',['strength','muscle','fat','athletic','health'],'yoga'],
   ['focus','focus',['legs','upper','arms','balanced'],'stretch'],
   ['experience','experience',['never','beginner','intermediate','advanced'],'onearm']
 ]){
   await rapid.goto('http://127.0.0.1:4180/tools/onboarding-preview.html?step='+step);
   await rapid.waitForSelector('.ob-motion');
   await rapid.evaluate(()=>{
     window.poseErrors=[];
     window.samplePoses=()=>{
       const scene=document.querySelector('.ob-motion');
       if(scene){
         const visible=[...scene.querySelectorAll('.ob-motion-frame')].filter(img=>getComputedStyle(img).opacity==='1');
         if(visible.length!==1)window.poseErrors.push('Visible poses: '+visible.length);
         if(scene.dataset.motionStatus!=='fallback'&&getComputedStyle(scene.querySelector('.ob-motion-fallback')).display!=='none')window.poseErrors.push('Fallback flashed');
       }
       window.poseSampler=requestAnimationFrame(window.samplePoses);
     };window.samplePoses();
   });
   for(const value of choices){
     await rapid.locator(`[data-key="${key}"][data-value="${value}"]`).click();
     await rapid.waitForTimeout(40);
   }
   await rapid.waitForSelector(`[data-motion="${lastScene}"][data-motion-status="ready"]`);
   await rapid.waitForTimeout(2300);
   const failures=await rapid.evaluate(()=>{cancelAnimationFrame(window.poseSampler);return window.poseErrors;});
   if(failures.length)throw Error('Rapid selection '+step+': '+failures.join(', '));
   if(await rapid.locator('.ob-motion').getAttribute('data-motion')!==lastScene)throw Error('Stale scene replaced latest selection');
 }
 await rapid.close();
 await page.goto('http://127.0.0.1:4180/tools/onboarding-preview.html');
 await page.waitForSelector('[data-motion="welcome"]');
 await page.locator('.ob-motion-frame').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
 const cssVisible=()=>page.locator('.ob-motion-frame').evaluateAll(images=>images.filter(img=>getComputedStyle(img).opacity==='1').length);
 const checkListLayout=async()=>{
   const overlap=await page.evaluate(()=>{
     const last=document.querySelector('.ob-list .ob-opt:last-child'),footer=document.querySelector('.ob-foot');
     return last&&footer&&footer.getBoundingClientRect().top<last.getBoundingClientRect().bottom-1;
   });
   if(overlap)throw Error('Continue overlaps the last answer');
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Answer screen horizontal overflow');
 };
 for(let i=0;i<6;i++){if(await cssVisible()!==1)throw Error('Animation must display exactly one frame');await page.waitForTimeout(180);}
 await page.screenshot({path:path.join(__dirname,'onboarding-welcome-mobile.png'),fullPage:true});
 await page.locator('[data-action="ob-next"]').click();
 await page.waitForSelector('[data-motion="cheer"]');
 await page.locator('[data-key="character"][data-value="estella"]').click();
 await page.locator('.ob-motion-frame').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
 if(!await page.locator('[data-key="character"][data-value="diego"]').isDisabled())throw Error('Unavailable character changed');
 await page.screenshot({path:path.join(__dirname,'onboarding-character-mobile.png'),fullPage:true});
 await page.locator('[data-action="ob-next"]').click();
 if(await page.locator('[data-action="ob-next"]').isEnabled())throw Error('Goal required validation changed');
 if(await page.locator('[data-key="goal"]').count()!==5)throw Error('Goal schema changed');
 for(const [goal,motion] of [['strength','strength'],['muscle','muscle'],['fat','model'],['athletic','soccer'],['health','yoga']]){
   await page.locator(`[data-key="goal"][data-value="${goal}"]`).click();await page.waitForSelector(`[data-motion="${motion}"]`);
   await page.locator('.ob-motion-frame').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
   if(!await page.locator('[data-action="ob-next"]').isEnabled())throw Error('Goal selection did not enable Continue');
   await checkListLayout();
 }
 await page.setViewportSize({width:320,height:640});await checkListLayout();
 await page.locator('#language').click();await checkListLayout();await page.locator('#language').click();
 await page.setViewportSize({width:390,height:844});
 await page.locator('[data-key="goal"][data-value="strength"]').click();
 await page.locator('.ob-motion-frame').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
 await page.screenshot({path:path.join(__dirname,'onboarding-goal-mobile.png'),fullPage:true});
 await page.locator('[data-action="ob-next"]').click();
 if(await page.locator('[data-key="focus"]').count()!==4)throw Error('Focus choice schema changed');
 for(const [focus,motion] of [['legs','legs'],['upper','bench'],['arms','curls'],['balanced','stretch']]){
   await page.locator(`[data-key="focus"][data-value="${focus}"]`).click();
   await page.waitForSelector(`[data-motion="${motion}"]`);
   await page.locator('.ob-motion-frame').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
   if(!await page.locator(`[data-key="focus"][data-value="${focus}"]`).evaluate(el=>el.getAttribute('aria-pressed')==='true'))throw Error('Answer selection broken');
   await checkListLayout();
 }
 await page.locator('[data-key="focus"][data-value="upper"]').click();
 await page.screenshot({path:path.join(__dirname,'onboarding-motion-mobile.png'),fullPage:true});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile horizontal overflow');
 await page.locator('[data-action="ob-next"]').click();await page.locator('[data-action="ob-back"]').click();
 if(!await page.locator('[data-key="focus"][data-value="upper"]').evaluate(el=>el.getAttribute('aria-pressed')==='true'))throw Error('Back lost selected answer');
 await page.locator('[data-action="ob-next"]').click();
 if(await page.locator('[data-action="ob-next"]').isEnabled())throw Error('Experience required validation changed');
 if(await page.locator('[data-key="experience"]').count()!==4)throw Error('Experience schema changed');
 for(const [experience,motion] of [['never','clumsy'],['beginner','trainer'],['intermediate','hack'],['advanced','onearm']]){
   await page.locator(`[data-key="experience"][data-value="${experience}"]`).click();await page.waitForSelector(`[data-motion="${motion}"]`);
   await page.locator('.ob-motion-frame').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
   await checkListLayout();
 }
 await page.locator('[data-key="experience"][data-value="beginner"]').click();
 await page.locator('.ob-motion-frame').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
 await page.screenshot({path:path.join(__dirname,'onboarding-experience-mobile.png'),fullPage:true});
 for(const [key,value,motion] of [['experience','beginner',null],['place','gym','thinking'],['daysPerWeek','3','dogwalk'],['minutes','45','calendar']]){
   if(motion){
     await page.waitForSelector(`[data-motion="${motion}"][data-motion-status="ready"]`);
     const position=await page.locator('.ob-motion-bottom').evaluate(el=>{
       const before=el.previousElementSibling,footer=el.nextElementSibling;
       return {top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,previousBottom:before.getBoundingClientRect().bottom,footerTop:footer.getBoundingClientRect().top};
     });
     if(position.top<position.previousBottom-1||position.bottom>position.footerTop+1)throw Error(motion+' overlaps answers or Continue');
     if(motion==='thinking'&&position.top-position.previousBottom<24)throw Error('Waiting art is too close to the selector');
     if(await page.locator('[data-action="ob-next"]').isEnabled())throw Error(motion+' changed required-answer validation');
     const visibleIndex=()=>page.locator('.ob-motion-bottom .ob-motion-frame').evaluateAll(images=>images.findIndex(img=>getComputedStyle(img).opacity==='1'));
     const initialFrame=await visibleIndex();await page.waitForTimeout(700);
     if(await visibleIndex()===initialFrame)throw Error(motion+' is not advancing its frames');
     await page.setViewportSize({width:320,height:640});await checkListLayout();await page.setViewportSize({width:390,height:844});
     await page.screenshot({path:path.join(__dirname,`onboarding-${motion}-mobile.png`),fullPage:true});
     // Changing a choice mid-loop must not buy another five seconds of playback.
     await page.waitForTimeout(2400);
     await page.locator(`[data-key="${key}"][data-value="${value}"]`).click();
     await page.waitForSelector(`[data-motion="${motion}"][data-motion-status="ready"]`);
     await page.waitForTimeout(2800);
     const running=()=>page.locator('.ob-motion-bottom').evaluate(el=>el.getAnimations({subtree:true}).some(a=>a.playState==='running'));
     if(await running())throw Error(motion+' restarted on selection or exceeded five seconds');
     const alternative=page.locator(`[data-key="${key}"]`).last();await alternative.click();
     await page.waitForSelector(`[data-motion="${motion}"][data-motion-status="ready"]`);
     if(await running())throw Error(motion+' restarted after it had finished');
   }
   await page.locator(`[data-key="${key}"][data-value="${value}"]`).click();await page.locator('[data-action="ob-next"]').click();
 }
 await page.locator('[data-action="ob-skip"]').click();await page.locator('[data-action="ob-skip"]').click();
 await page.waitForFunction(()=>Array.isArray(window.onboardingPreview.onboarding.getOnboardingUI().plan));
 if(!await page.locator('[data-action="ob-save-plan"]').count())throw Error('Starter plan failed');
 await page.locator('#restart').click();await page.locator('#language').click();
 await page.waitForTimeout(4700);if(await cssVisible()!==1)throw Error('Animation did not settle');
 if(await page.locator('.ob-motion-frame').first().evaluate(el=>getComputedStyle(el).opacity)!=='1')throw Error('Settled frame not visible');
 await page.setViewportSize({width:320,height:640});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Small phone overflow');
 const reduced=await browser.newPage({reducedMotion:'reduce'});await reduced.goto('http://127.0.0.1:4180/tools/onboarding-preview.html');await reduced.waitForSelector('[data-motion-status="ready"]');
 if(await reduced.locator('.ob-motion-frame').first().evaluate(el=>getComputedStyle(el).animationName)!=='none')throw Error('Reduced motion not respected');
 const fallback=await browser.newPage();await fallback.route('**/icons/onboarding-motion/welcome-1.webp',route=>route.abort());
 await fallback.goto('http://127.0.0.1:4180/tools/onboarding-preview.html');await fallback.waitForSelector('[data-motion-status="fallback"]');
 if(!await fallback.locator('.ob-motion-fallback .mascot').isVisible())throw Error('Missing image did not preserve static mascot');
 await browser.close();if(errors.length)throw Error(errors.join('\n'));console.log('PASS: rapid selections with delayed images and no overlapping poses or fallback flashes; real onboarding; all reactions; bottom placement and spacing; moving frames; five-second playback without restart on option changes; validation; navigation; starter plan; ES/EN; 320px layout; reduced motion; missing-image fallback.');
})().catch(e=>{console.error(e);process.exit(1)});
