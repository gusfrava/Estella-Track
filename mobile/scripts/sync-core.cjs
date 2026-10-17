// Copy platform-independent logic verbatim; adapt only documented platform boundaries.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mobile = path.resolve(__dirname, '..');
const root = path.dirname(mobile);
const target = path.join(mobile, 'src/core');
const files = ['billing-config.js', 'services/billing-session.js', 'config.js', 'state/model.js', 'state/store.js', 'state/selectors.js', 'state/session.js', 'state/social.js', 'state/rewards.js', 'state/recap.js', 'state/progress.js', 'utils/data.js', 'utils/dates.js', 'utils/format.js', 'utils/log.js', 'utils/youtube.js', 'utils/username.js', 'i18n/index.js', 'i18n/en.js', 'i18n/es.js', 'data/badges.js', 'data/badge-art.js', 'services/starter-plan.js', 'controllers/onboarding.js', 'controllers/friends.js'];
for (const file of files) {
  const output = path.join(target, file);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.copyFileSync(path.join(root, 'js', file), output);
}
const onboardingFile = path.join(target, 'controllers/onboarding.js');
fs.copyFileSync(path.join(root, 'js/services/migrate.js'), path.join(target, 'services/migrate.js'));
fs.writeFileSync(onboardingFile, fs.readFileSync(onboardingFile, 'utf8').replace(
  'export const onOnboardingChange = fn => listeners.add(fn);',
  'export const onOnboardingChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };'
));
// The website keeps a hidden recap and seen cheers in localStorage, which native lacks: use the mobile storage adapter.
const patch = (file, pairs) => {
  const full = path.join(target, file);
  let source = fs.readFileSync(full, 'utf8');
  for (const [from, to] of pairs) { if (!source.includes(from)) throw new Error(`${file} changed: ${from}`); source = source.replace(from, to); }
  fs.writeFileSync(full, source);
};
patch('state/recap.js', [
  ["import { getState } from './store.js';", "import { getState } from './store.js';\nimport { lsGet, lsSet } from '../services/storage.js';"],
  ['`estellatrack.recapHidden.', '`native.recapHidden.'],
  ['localStorage.getItem(hiddenKey(uid))', 'lsGet(hiddenKey(uid))'],
  ['localStorage.setItem(hiddenKey(uid), wk)', 'lsSet(hiddenKey(uid), wk)'],
]);
patch('controllers/friends.js', [
  ["import { logger } from '../utils/log.js';", "import { logger } from '../utils/log.js';\nimport { lsGet, lsSet } from '../services/storage.js';"],
  ['`estellatrack.cheersSeen.', '`native.cheersSeen.'],
  ['localStorage.getItem(seenKey())', 'lsGet(seenKey())'],
  ['localStorage.setItem(seenKey(), String(newest))', 'lsSet(seenKey(), String(newest))'],
]);
// Account avatars: the website builds an image URL from import.meta.url; native bundles the same WebP files.
const avatarDir = path.join(mobile, 'assets/avatars');
fs.mkdirSync(avatarDir, { recursive: true });
const avatarFiles = fs.readdirSync(path.join(root, 'icons/avatars')).filter(f => f.endsWith('.webp'));
for (const file of avatarFiles) fs.copyFileSync(path.join(root, 'icons/avatars', file), path.join(avatarDir, file));
fs.copyFileSync(path.join(root, 'js/data/avatars.js'), path.join(target, 'data/avatars.js'));
patch('data/avatars.js', [
  ["export const avatarPath = id => new URL(`../../icons/avatars/${id}.webp`, import.meta.url).href;",
   'const IMAGES = {\n' + avatarFiles.map(f => `  ${JSON.stringify(f.replace('.webp', ''))}: require('../../../assets/avatars/${f}'),`).join('\n') + '\n};\nexport const avatarPath = id => IMAGES[id];'],
]);
let library = fs.readFileSync(path.join(root, 'js/services/library.js'), 'utf8');
library = library.replace("const get = path => fetch(path).then(r => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); });", "const get = path => Promise.resolve(path.endsWith('exercise-videos.json') ? require('../data/exercise-videos.json') : require('../data/exercises.json'));");
fs.writeFileSync(path.join(target, 'services/library.js'), library);
for (const file of ['exercises.json', 'exercise-videos.json']) fs.copyFileSync(path.join(root, 'data', file), path.join(target, 'data', file));
let firebase = fs.readFileSync(path.join(root, 'js/services/firebase.js'), 'utf8');
const from = firebase.indexOf('export async function loadFirebase(lang)');
const to = firebase.indexOf('export const isLoaded');
firebase = firebase.slice(0, from) + `export async function loadFirebase(lang) {
  if (FB) return FB;
  const [appM, a, f, platform] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore'), import('../../services/auth-persistence')]);
  const app = appM.getApps().length ? appM.getApp() : appM.initializeApp(FIREBASE_CONFIG);
  const auth = platform.configuredAuth(app);
  auth.languageCode = lang;
  FB = { auth, db: f.getFirestore(app), a, f };
  return FB;
}
` + firebase.slice(to);
// Native apps can't open the Google popup: sign in (and re-confirm before deleting) with the ID token from
// services/google-sign-in. The browser preview has no native sign-in, so it keeps the website's popup.
const native = "const nativeGoogle = () => import('../../services/google-sign-in');";
for (const [from, to] of [
  ['export async function signInWithGoogle() {', `${native}\nexport async function signInWithGoogle() {\n  const g = await nativeGoogle();\n  if (g.googleSignInAvailable) {\n    const idToken = await g.googleIdToken();\n    if (idToken) await FB.a.signInWithCredential(FB.auth, FB.a.GoogleAuthProvider.credential(idToken));\n    return;\n  }`],
  ['    await FB.a.reauthenticateWithPopup(user, new FB.a.GoogleAuthProvider());', `    const g = await nativeGoogle();\n    if (!g.googleSignInAvailable) { await FB.a.reauthenticateWithPopup(user, new FB.a.GoogleAuthProvider()); return; }\n    const idToken = await g.googleIdToken();\n    if (!idToken) throw Object.assign(new Error('cancelled'), { code: 'auth/popup-closed-by-user' });\n    await FB.a.reauthenticateWithCredential(user, FB.a.GoogleAuthProvider.credential(idToken));`],
  ['export const signOut = () => FB.a.signOut(FB.auth);', 'export const signOut = async () => { await (await nativeGoogle()).googleSignOut(); return FB.a.signOut(FB.auth); };'],
  // The website loads Cloud Functions from the CDN at runtime; the app bundles the installed SDK instead.
  ["  const sdk = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-functions.js`);", "  const sdk = await import('firebase/functions');"],
]) { if (!firebase.includes(from)) throw new Error(`services/firebase.js changed: ${from}`); firebase = firebase.replace(from, to); }
fs.writeFileSync(path.join(target, 'services/firebase.js'), firebase);
const motionDir = path.join(mobile, 'assets/motion');
fs.mkdirSync(motionDir, { recursive: true });
const frames = fs.readdirSync(path.join(root, 'icons/onboarding-motion')).filter(f => f.endsWith('.webp'));
for (const file of frames) fs.copyFileSync(path.join(root, 'icons/onboarding-motion', file), path.join(motionDir, file));
const scenes = [...new Set(frames.map(f => f.replace(/-\d.webp$/, '')))];
fs.writeFileSync(path.join(mobile, 'src/theme/motions.js'), 'export const motions = {\n' + scenes.map(s => `${JSON.stringify(s)}: [${[0,1,2,3].map(i => `require('../../assets/motion/${s}-${i}.webp')`).join(',')}],`).join('\n') + '\n};\n');
// Diego's approved poses: the same onboarding scenes plus 'portrait' (busts) and 'complete' (celebration).
const diegoDir = path.join(mobile, 'assets/diego-motion');
fs.mkdirSync(diegoDir, { recursive: true });
const diegoFrames = fs.readdirSync(path.join(root, 'icons/diego-motion')).filter(f => f.endsWith('.webp'));
for (const file of diegoFrames) fs.copyFileSync(path.join(root, 'icons/diego-motion', file), path.join(diegoDir, file));
const diegoScenes = [...new Set(diegoFrames.map(f => f.replace(/-\d.webp$/, '')))];
fs.writeFileSync(path.join(mobile, 'src/theme/diego-motions.js'), 'export const diegoMotions = {\n' + diegoScenes.map(s => `${JSON.stringify(s)}: [${[0,1,2,3].map(i => `require('../../assets/diego-motion/${s}-${i}.webp')`).join(',')}],`).join('\n') + '\n};\n');
// react-native-svg cannot run the stickers' feMorphology filter: it drops the outline and clips the artwork.
// Native gets the same look as plain layers: the artwork's silhouette, its stroke widened by the dilate
// radius on each side, drawn once as the offset ink shadow and once as the cream outline.
function nativeSticker(svg) {
  const filter = svg.match(/<filter[^>]*>[\s\S]*?<\/filter>/)?.[0];
  if (!filter) return svg;
  const radius = Number(filter.match(/radius="([\d.]+)"/)[1]);
  const [, dx, dy] = filter.match(/dx="([-\d.]+)" dy="([-\d.]+)"/);
  const [, shadow, opacity] = filter.match(/flood-color="([^"]+)" flood-opacity="([\d.]+)"/);
  const outline = [...filter.matchAll(/flood-color="([^"]+)"/g)].at(-1)[1];
  const defsEnd = svg.indexOf('</defs>') + '</defs>'.length;
  const open = svg.indexOf('<g', defsEnd), close = svg.lastIndexOf('</g>') + '</g>'.length;
  const artwork = svg.slice(open, close).replace(/\sfilter="[^"]*"/, '');
  const silhouette = color => artwork.replace(/\sid="[^"]*"/g, '')
    .replace(/\b(fill|stroke)="(?!none")[^"]*"/g, `$1="${color}"`)
    .replace(/stroke-width="([\d.]+)"/g, (_, width) => `stroke-width="${Number(width) + radius * 2}"`);
  return svg.slice(0, svg.indexOf('<defs>')) + svg.slice(defsEnd, open)
    + `<g transform="translate(${dx} ${dy})" opacity="${opacity}">${silhouette(shadow)}</g>${silhouette(outline)}${artwork}`
    + svg.slice(close);
}
const art = {};
for (const category of fs.readdirSync(path.join(root, 'icons/stickers'))) {
  for (const file of fs.readdirSync(path.join(root, 'icons/stickers', category))) {
    if (file.endsWith('.svg')) art[file.replace('.svg','')] = nativeSticker(fs.readFileSync(path.join(root, 'icons/stickers', category, file), 'utf8'));
  }
}
for (const file of fs.readdirSync(path.join(root, 'icons/badges/static'))) if (file.endsWith('.svg')) art['badge-' + file.replace('.svg','')] = fs.readFileSync(path.join(root, 'icons/badges/static', file), 'utf8');
for (const [file, symbol, prefix] of [['icons.js','ICONS','ui-'],['onboarding-icons.js','OI','ob-']]) {
  const source = fs.readFileSync(path.join(root,'js/ui',file),'utf8').replace(/^import .*$/gm,'').replace(/export const /g,'const ');
  const icons = vm.runInNewContext(source + `\n${symbol}`, { stickerIcon: name => art[name.split('/').pop()] });
  for (const [key, svg] of Object.entries(icons)) art[prefix+key] = svg.replaceAll('currentColor','#2B1B12').replace('class="ti"','stroke-width="2.2"');
}
const character = vm.runInNewContext(fs.readFileSync(path.join(root,'js/ui/characters/estella.js'),'utf8').replace(/export const /g,'const ') + '\n({VIEWBOX,BUST,BODY})');
const bust = character.BUST;
art['mascot-bust'] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bust.x} ${bust.y} ${bust.w} ${bust.h}" fill="none"><style>.expr{display:none}.expr-amused{display:inline}</style>${character.BODY}</svg>`.replace(/var\([^,]+,([^\)]+)\)/g,'$1');
for (const key of Object.keys(art)) art[key] = art[key].replace(/\saria-[a-z-]+="[^"]*"/g, '').replace(/<title[^>]*>[\s\S]*?<\/title>/g, '');
fs.writeFileSync(path.join(mobile, 'src/theme/art.json'), JSON.stringify(art));
console.log(`Synced ${files.length} shared modules, exercise library, ${frames.length} motion frames, ${diegoFrames.length} Diego frames and SVG artwork.`);


