const { chromium, webkit, devices } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const safari = process.env.TEST_BROWSER === 'webkit';
 const browser = await (safari ? webkit.launch({headless:true}) : chromium.launch({channel:'chrome',headless:true}));
 try {
 for (const device of (safari ? ['iPhone 13'] : ['iPhone 13','Pixel 7'])) {
  const context = await browser.newContext({...devices[device]});
  const page = await context.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:8081',{timeout:120000,waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'English',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Try it without an account',exact:true}).click();
  await page.getByRole('button',{name:'Not now',exact:true}).click();
  await page.getByRole('button',{name:'Add',exact:true}).click();
  await page.getByRole('button',{name:'New routine',exact:true}).click();
  await page.getByRole('textbox',{name:'Routine name',exact:true}).fill('Regression routine');
  await page.getByRole('button',{name:'Create routine',exact:true}).click();
  await page.getByRole('button',{name:'Regression routine',exact:true}).click();
  await page.getByRole('button',{name:'+ Add exercise',exact:true}).click();
  await page.getByRole('button',{name:'Create your own exercise',exact:true}).click();
  await page.getByRole('textbox',{name:'Exercise',exact:true}).fill('No-video exercise');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('button',{name:/No-video exercise.*3 sets/}).click();
  const reps=page.getByRole('textbox',{name:'Set 1 Reps',exact:true});
  await reps.fill('12');
  await page.getByRole('textbox',{name:'Set 1 Weight (kg)',exact:true}).fill('25');
  await page.getByRole('checkbox',{name:'Set 1 Mark as done',exact:true}).click();
  assert.equal(await page.getByRole('checkbox',{name:'Set 1 Mark as done',exact:true}).getAttribute('aria-checked'),'true');
  await page.getByRole('button',{name:'+ Set',exact:true}).click();
  assert.equal(await page.getByRole('textbox').count(),8);
  await page.getByRole('button',{name:'Remove 4',exact:true}).click();
  await page.getByRole('button',{name:'↓ Drop set',exact:true}).click();
  assert.equal(await page.getByRole('textbox').count(),8);
  await page.getByRole('button',{name:'Remove 2',exact:true}).click();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/No-video exercise.*3 sets/}).click();
  assert.equal(await reps.inputValue(),'12');
  assert.equal(await page.getByRole('textbox',{name:'Set 1 Weight (kg)',exact:true}).inputValue(),'25');
  await page.getByRole('checkbox',{name:'Set 2 Mark as done',exact:true}).click();
  await page.getByRole('checkbox',{name:'Set 3 Mark as done',exact:true}).click();
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('tab',{name:'Progress',exact:true}).click();
  await page.getByText('No-video exercise',{exact:true}).waitFor();
  await page.getByRole('button',{name:'See all',exact:true}).click();
  await page.getByText('0 of 22 earned · 0 points',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Your account',exact:true}).click();
  await page.getByRole('button',{name:'Español',exact:true}).click();
  await page.getByText('Tu cuenta',{exact:true}).waitFor();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByText('Tu cuenta',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`test-results/native-${device.replaceAll(' ','-')}.png`,fullPage:true});
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(device+' passed routine creation, no-video expansion, set editing, drop sets, completion, reload, progress, badges and language persistence');
 }
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});








