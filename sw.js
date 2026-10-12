// Service worker: lets the installed app open without internet.
// - App files (same site): network first and always revalidated, so a new deploy shows up on the next reload; cached copy when offline.
// - Firebase SDK + Google Fonts: cached after the first load (their URLs include the version, so they never change).
// Firebase sign-in and database traffic is NOT touched here; Firestore has its own offline cache.
// If a deploy ever looks stuck, bump CACHE to 'estella-v2' and push.

const CACHE = 'estella-v2';
const CDN = [/^https:\/\/www\.gstatic\.com\/firebasejs\//, /^https:\/\/fonts\.googleapis\.com\//, /^https:\/\/fonts\.gstatic\.com\//];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(req));
  else if (CDN.some(re => re.test(req.url))) event.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    // 'no-cache' = always ask GitHub if the file changed (skips the browser's 10-minute cache).
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = (await cache.match('./index.html')) || (await cache.match('./'));
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
