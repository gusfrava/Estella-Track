// Friends: search people, send / accept / decline / cancel requests, remove friends, invite links,
// keeping my entry in the search directory up to date, cheers, and copying a friend's routine.
// Data and rules: services/firebase.js (friends section), state/social.js, docs/DATA-MODEL.md → Friends.
import * as fb from '../services/firebase.js';
import { getState, subscribe, addRoutines } from '../state/store.js';
import { getSession } from '../state/session.js';
import { getSocial, relation, pendingIncoming, pendingOutgoing, requestsWith, myCheerFor, setMyCheer, recentCheers } from '../state/social.js';
import { norm } from '../services/library.js';
import { logger } from '../utils/log.js';

const log = logger('friends');

// The signed-in person as friends see them.
export function me() {
  const s = getSession(), p = getState().profile || {};
  return s.user ? { uid: s.user.uid, username: p.username || '', displayName: p.displayName || '' } : null;
}

// ---------- search directory ----------
// directory/{uid} = { username, displayName, nameKey, lastKey, character } exists while "Aparecer en búsquedas" is on (default on). It only holds what search shows:
// name, @username and character. Rewritten when any of those change; removed when the switch is turned off.
let lastEntry = null;   // `${uid}|${json}` of the last write, so we only write on real changes
subscribe(() => syncDirectory());

function syncDirectory() {
  const s = getSession(), p = getState().profile;
  if (!s.user || !p || !p.username || !fb.isLoaded()) return;
  const entry = p.discoverable === false ? null : {
    username: p.username, displayName: p.displayName || '', nameKey: norm(p.displayName || ''),
    lastKey: norm(p.displayName || '').split(' ').slice(1).join(' '),   // so "pérez" finds "Estrella Pérez"
    character: (p.onboarding && p.onboarding.character) || 'estella',
  };
  const key = `${s.user.uid}|${JSON.stringify(entry)}`;
  if (key === lastEntry) return;
  lastEntry = key;
  fb.setDirectoryEntry(s.user.uid, entry).then(
    () => log.debug(entry ? 'directory updated' : 'left the directory'),
    err => { lastEntry = null; log.warn('directory update failed', err); }
  );
}

// ---------- search ----------
// People whose name or @username starts with q. An exact username also finds people who turned search off
// (that's how you add someone who gave you their username). Results: [{ uid, username, displayName, character }]
export async function search(q) {
  const raw = String(q || '').trim().replace(/^@/, '');
  const uname = raw.toLowerCase().replace(/[^a-z0-9_.]/g, '');
  const name = norm(raw);
  if (Math.max(uname.length, name.length) < 2) return [];
  const [found, exactUid] = await Promise.all([
    fb.searchDirectory(uname.length >= 2 ? uname : '', name.length >= 2 ? name : ''),
    uname.length >= 3 ? fb.usernameOwner(uname).catch(() => null) : null,
  ]);
  const list = found.filter(x => x.uid !== (me() || {}).uid);
  if (exactUid && exactUid !== (me() || {}).uid && !list.some(x => x.uid === exactUid)) {
    list.unshift({ uid: exactUid, username: uname, displayName: '', character: 'estella' });
  }
  return list;
}

// One person by username (invite links). null when it doesn't exist.
export async function findByUsername(username) {
  const uname = String(username || '').toLowerCase().replace(/[^a-z0-9_.]/g, '');
  if (!uname) return null;
  const uid = await fb.usernameOwner(uname);
  if (!uid) return null;
  const entry = await fb.getDirectoryEntry(uid).catch(() => null);
  return entry || { uid, username: uname, displayName: '', character: 'estella' };
}

// ---------- requests ----------
// person = { uid, username, displayName }. Each returns a promise; the screen shows an error if it fails.
export const relationTo = uid => relation((me() || {}).uid, uid);

export async function add(person) {
  if (relationTo(person.uid) === 'received') return accept(person.uid);   // they already asked: accept instead
  await fb.sendFriendRequest(me(), person);
}

export async function accept(uid) {
  const req = pendingIncoming().find(r => r.from === uid);
  if (req) await fb.acceptFriendRequest(me(), req);
}

export async function decline(uid) {
  const req = pendingIncoming().find(r => r.from === uid);
  if (req) await fb.deleteFriendRequest(req.id);
}

export async function cancel(uid) {
  const req = pendingOutgoing().find(r => r.to === uid);
  if (req) await fb.deleteFriendRequest(req.id);
}

export async function remove(uid) {
  await fb.removeFriend(me().uid, uid, requestsWith(uid).map(r => r.id));
}

// ---------- invite link ----------
// https://…/?add=username — opens Estella and shows that person with an "Añadir" button.
export function inviteLink() {
  const u = (me() || {}).username;
  return u ? `${location.origin}${location.pathname}?add=${encodeURIComponent(u)}` : '';
}

// The ?add= of the link the app was opened with (read once, then removed from the address bar).
let pendingAdd = null;
export function readInviteFromUrl() {
  try {
    const url = new URL(location.href);
    const u = url.searchParams.get('add');
    if (!u) return;
    pendingAdd = u;
    url.searchParams.delete('add');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  } catch (e) { /* old browser: ignore */ }
}
export function takePendingInvite() { const u = pendingAdd; pendingAdd = null; return u; }

export const friendCount = () => Object.keys(getSocial().friends).length;
export const outgoingRequests = () => pendingOutgoing();
export function friendPerson(uid) { const f = getSocial().friends[uid]; return f ? { uid, ...f } : null; }

// ---------- cheers ----------
export const CHEER_KINDS = ['fire', 'strong', 'clap'];

// Cheer a friend's last workout ({ date, name }) with `kind`. Tapping the kind you already sent takes it back.
// The button changes right away; if saving fails it goes back and the promise rejects.
// Resolves 'sent' | 'changed' | 'removed'.
export async function cheer(uid, kind, workout) {
  if (!CHEER_KINDS.includes(kind) || !workout || !workout.date) return null;
  const before = myCheerFor(uid, workout.date);
  const id = fb.cheerId(me().uid, uid, workout.date);
  const removing = before && before.kind === kind;
  setMyCheer(uid, workout.date, removing ? null : { id, kind, to: uid, date: workout.date, createdAt: Date.now() });
  try {
    if (removing) await fb.deleteCheer(id);
    else await fb.sendCheer(me(), uid, { kind, date: workout.date, workout: workout.name });
  } catch (err) {
    setMyCheer(uid, workout.date, before);
    throw err;
  }
  return removing ? 'removed' : before ? 'changed' : 'sent';
}

// While a friend's card is open: keep "the cheer I sent for their last workout" up to date. Returns a stop function.
export function watchMyCheer(uid, date) {
  return fb.watchCheer(fb.cheerId(me().uid, uid, date), c => setMyCheer(uid, date, c));
}

// When I last looked at my cheers (Amigos tab), kept on this phone: newer ones get the badge on the tab.
const seenKey = () => `estellatrack.cheersSeen.${(me() || {}).uid || ''}`;
export function cheersSeenAt() {
  try { return Number(localStorage.getItem(seenKey())) || 0; } catch (e) { return 0; }
}
export function markCheersSeen() {
  const newest = Math.max(0, ...recentCheers().map(c => c.createdAt));
  if (newest <= cheersSeenAt()) return;
  try { localStorage.setItem(seenKey(), String(newest)); } catch (e) { /* private mode: the badge just stays */ }
}

// ---------- copy a friend's routine ----------
export const sharedRoutinesOf = uid => fb.getSharedRoutines(uid);

// routine = one of sharedRoutinesOf(uid).routines. Weights start empty (they fill in their own). Returns the new routine.
export function copyRoutine(friend, routine) {
  const unit = (getState().profile || {}).units === 'lb' ? 'lb' : 'kg';
  const [created] = addRoutines([{
    name: routine.name,
    source: { type: 'friend', id: friend.uid, routineId: routine.id, name: friend.username || '' },
    exercises: (routine.exercises || []).map(e => ({
      name: e.name, exerciseId: e.exerciseId, type: e.type, perSide: e.perSide,
      sets: e.sets, reps: e.reps, seconds: e.seconds, weight: 0, unit,
    })),
  }]);
  return created;
}

// Did I already copy this routine from them? (so the button can say "Copiada")
export const alreadyCopied = (friendUid, routineId) => Object.values(getState().routines)
  .some(r => r.source && r.source.type === 'friend' && r.source.id === friendUid && r.source.routineId === routineId);
