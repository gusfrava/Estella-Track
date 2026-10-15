// Requires Playwright. Serve the repo on localhost:4180 before running.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, webkit, devices } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.ESTELLA_PREVIEW_URL || 'http://127.0.0.1:4180';
const output = path.join(ROOT, 'tools');

(async () => {
 const { BADGES } = await import(pathToFileURL(path.join(ROOT, 'js/data/badges.js')).href);
 const { BADGE_ART } = await import(pathToFileURL(path.join(ROOT, 'js/data/badge-art.js')).href);
 assert.deepEqual(Object.keys(BADGE_ART).sort(), BADGES.map(b => b.id).sort(), 'Only existing achievements get enabled');
 for (const b of BADGES) {
   const still = fs.readFileSync(path.join(ROOT, `icons/badges/static/${b.id}.svg`), 'utf8');
   assert.ok(!/@keyframes|<animate|animation\s*:/i.test(still), b.id + ' locked source is motionless');
   const moving = fs.readFileSync(path.join(ROOT, `icons/badges/animated/${b.id}.svg`), 'utf8');
   assert.ok(moving.includes('prefers-reduced-motion'), b.id + ' honors reduced motion');
 }
 for (const [name, engine, device, launch] of [
   ['iphone', webkit, 'iPhone 13', {}],
   ['android', chromium, 'Pixel 7', { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }],
 ]) {
   const browser = await engine.launch({ headless: true, ...launch });
   try {
     const context = await browser.newContext({ ...devices[device], locale: 'en-US' });
     const page = await context.newPage();
     const errors = [], failed = [];
     page.on('pageerror', e => errors.push(e.message));
     page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
     page.on('requestfailed', request => failed.push(request.url()));
     await page.goto(`${BASE}/tools/badges-preview.html`);
     const checkOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' horizontal overflow');
     for (const lang of ['en', 'es']) {
       await page.evaluate(async lang => { const {previewLang} = await import('/js/i18n/index.js'); previewLang(lang); }, lang);
       await page.selectOption('#wallet', 'mixed');
       await page.locator('.header-points').click();
       await page.waitForSelector('.sheet.open .badge-list');
       await page.locator('.sheet .medal-art img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
       assert.equal(await page.locator('.sheet .medal-art').count(), 22);
       assert.equal(await page.locator('.sheet .medal-art.earned').count(), 3);
       const locked = page.locator('.sheet .medal-art.locked[data-badge="w10"]');
       assert.ok((await locked.locator('img').getAttribute('src')).includes('/static/'));
       assert.equal(await locked.evaluate(el => getComputedStyle(el).filter), 'grayscale(1)');
       assert.equal(await locked.evaluate(el => el.getAnimations({subtree:true}).length), 0);
       await locked.scrollIntoViewIfNeeded();
       await page.waitForTimeout(400);
       const before = await locked.screenshot();
       await page.waitForTimeout(800);
       assert.ok(before.equals(await locked.screenshot()), name + ' locked badge pixels stay unchanged');
       const earned = page.locator('.sheet .medal-art.earned[data-badge="w1"]');
       assert.ok((await earned.locator('img').getAttribute('src')).includes('/animated/'));
       await earned.scrollIntoViewIfNeeded();
       const frame = await earned.screenshot();
       await page.waitForTimeout(950);
       assert.ok(!frame.equals(await earned.screenshot()), name + ' earned badge animates');
       await checkOverflow();
       await page.screenshot({path:path.join(output, `badges-${name}-${lang}.png`)});
       await page.emulateMedia({ reducedMotion: 'reduce' });
       await page.waitForFunction(() => [...document.querySelectorAll('.sheet .medal-art img')].every(img => img.currentSrc.includes('/static/')));
       await earned.locator('img').evaluate(img => img.decode());
       const reduced = await earned.screenshot();
       await page.waitForTimeout(500);
       assert.ok(reduced.equals(await earned.screenshot()), name + ' reduced-motion badge stays still');
       await page.evaluate(async()=>{const {closeSheet}=await import('/js/ui/sheet.js');closeSheet(true);});
       await page.emulateMedia({ reducedMotion: 'no-preference' });
     }
     for (const mode of ['locked', 'earned']) {
       await page.selectOption('#wallet', mode);
       assert.equal(await page.locator('.rw-row .medal-art.' + (mode === 'locked' ? 'locked' : 'earned')).count(), 5);
       await checkOverflow();
     }
     await page.selectOption('#wallet', 'mixed');
     await page.locator('.avatar[data-action="account"]').click();
     await page.locator('.account-language [data-lang="en"]').click();
     await page.locator('.account-language [data-lang="es"]').click();
     assert.equal(await page.locator('.account-language>b').textContent(), 'Idioma');
     await page.evaluate(async()=>{const {closeSheet}=await import('/js/ui/sheet.js');closeSheet(true);});
     await page.locator('#picker').click();
     await page.waitForSelector('.lib-item');
     assert.equal(await page.locator('.lib-chip .sticker-icon').count(), 9);
     await page.locator('.lib-chip[data-group="gluteos"]').click();
     await page.waitForTimeout(150);
     assert.equal(await page.locator('.lib-chip[data-group="gluteos"]').getAttribute('aria-pressed'), 'true');
     await checkOverflow();
     assert.deepEqual(errors, [], name + ' browser errors');
     assert.deepEqual(failed, [], name + ' failed assets');
     console.log(`PASS: ${name} (${device}) EN/ES, all 22 icons, earned motion, locked grayscale/static pixels, reduced motion, layouts, profile language, muscle filters.`);
   } finally { await browser.close(); }
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
