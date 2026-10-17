// Renders the store listing images from assets/store/listing/frames.html with headless Chrome:
//   assets/store/listing/appstore/<lang>/NN.png  1290×2796 (iPhone 6.9")
//   assets/store/listing/play/<lang>/NN.png      1080×1920 (Google Play phone)
// The app captures they use live in assets/store/listing/screens/<lang>/.
// Usage: node scripts/store-listing.cjs [en|es|all] [ios|play|all] [1,2,…]
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const arg = (i, all) => (!process.argv[i] || process.argv[i] === 'all' ? all : process.argv[i].split(','));
const langs = arg(2, ['en', 'es']), sizes = arg(3, ['ios', 'play']), nums = arg(4, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DIR = path.resolve(__dirname, '../assets/store/listing');
const DIMS = { ios: [1290, 2796], play: [1080, 1920] }, FOLDER = { ios: 'appstore', play: 'play' };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'estella-listing-'));
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9335', `--user-data-dir=${profile}`, '--allow-file-access-from-files', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  try {
    let page;
    for (let i = 0; i < 40 && !page; i++) { await wait(250); try { page = (await (await fetch('http://127.0.0.1:9335/json/list')).json()).find(t => t.type === 'page'); } catch { /* starting */ } }
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    let id = 0; const pending = new Map();
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.method === 'Runtime.exceptionThrown') console.error('page error:', m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
    const send = (method, params = {}) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
    await send('Page.enable'); await send('Runtime.enable');
    for (const size of sizes) {
      const [w, h] = DIMS[size];
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      for (const lang of langs) {
        const out = path.join(DIR, FOLDER[size], lang); fs.mkdirSync(out, { recursive: true });
        for (const n of nums) {
          await send('Page.navigate', { url: `${pathToFileURL(path.join(DIR, 'frames.html')).href}?n=${n}&lang=${lang}&size=${size}` });
          for (let i = 0; i < 80; i++) { await wait(150); const r = await send('Runtime.evaluate', { expression: 'document.body && document.body.dataset.ready', returnByValue: true }); if (r.result?.result?.value === '1') break; }
          await wait(300);
          const { result } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
          const file = path.join(out, `${String(n).padStart(2, '0')}.png`);
          fs.writeFileSync(file, Buffer.from(result.data, 'base64')); console.log('saved', path.relative(DIR, file));
        }
      }
    }
    ws.close();
  } finally { chrome.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
