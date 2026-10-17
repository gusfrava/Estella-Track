const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
 for(const locale of ['es-ES','en-US']){
 const context=await browser.newContext({locale,viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.route('**/*',async r=>{
 const u=new URL(r.request().url());if(u.hostname!=='stella.test')return r.abort();
 const file=path.join(process.cwd(),decodeURIComponent(u.pathname)==='/'?'index.html':decodeURIComponent(u.pathname));
 try{let body=fs.readFileSync(file);if(file.endsWith('config.js'))body=body.toString().replace('const c = FIREBASE_CONFIG;','return false; const c = FIREBASE_CONFIG;');
 await r.fulfill({body,contentType:({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});}catch{await r.fulfill({status:404,body:''});}
 });
 const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://stella.test/');await page.locator('.intro').waitFor();
 assert.match(await page.locator('h1').innerText(),locale==='es-ES'?/Crea tu rutina/:/Build your routine/);
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`);}
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(5200);
 assert.equal(await page.locator('.spark-shape').evaluate(e=>getComputedStyle(e).filter),'none');
 assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.spark-shape').evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.evaluate(()=>window.originalScene=document.querySelector('.scene'));
 await page.locator('[data-action="lang"][data-lang="en"]').click();
 assert(await page.evaluate(()=>window.originalScene===document.querySelector('.scene')));
 await page.reload();await page.locator('.intro').waitFor();
 assert.match(await page.locator('h1').innerText(),/Build your routine/);
 await page.locator('[data-action="opening-signin"]').click();
 assert.equal(await page.locator('.intro').count(),0);
 await page.locator('[data-action="local-mode"]').click();await page.locator('.ob-s-welcome').waitFor();
 await page.locator('[data-action="ob-next"]').click();await page.locator('.ob-s-character').waitFor();
 await page.locator('[data-action="ob-back"]').click();await page.locator('[data-action="ob-skip-all"]').click();
 await page.waitForTimeout(500);await page.reload();await page.waitForTimeout(500);
 assert.equal(await page.locator('.intro,.ob-s-welcome').count(),0);
 assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('estellatrack.v2.local')).profile.onboarding.skippedAt));
 assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS EN/ES phone defaults, three viewport widths, finite no-shine animation, questionnaire navigation, local persistence/reload; no page errors');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
