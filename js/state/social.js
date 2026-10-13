// Friends state (separate from the training data in store.js): my friends, the friend requests to and from me,
// and my friends' cards. Filled by services/sync.js from Firestore listeners; read by the Amigos screen and the friend sheets.
//
// social = { ready, friends: { uid: { since, username, displayName } }, incoming: [Request], outgoing: [Request],
//            cards: { uid: { state: 'ok'|'none'|'hidden'|'error', card } } }
//   card = profileCards/{uid}, written by the server (functions/card.js). 'none' = not built yet (it's built when
//   they open the app), 'hidden' = they share their profile with nobody.
// Request = { id, from, to, fromUsername, fromName, toUsername, toName, status: 'pending'|'accepted', createdAt }
import { streakFrom, goalAt } from './selectors.js';
import { parseYmd, ymd, weekKey } from '../utils/dates.js';

const blank = () => ({ ready: false, friends: {}, incoming: [], outgoing: [], cards: {} });
let social = blank();
const listeners = new Set();

export const getSocial = () => social;
export function onSocialChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const changed = () => listeners.forEach(fn => fn(social));

export function setFriends(friends) { social = { ...social, friends, ready: true }; changed(); }
export function setRequests({ incoming, outgoing }) { social = { ...social, incoming, outgoing }; changed(); }
export function setCard(uid, entry) { social = { ...social, cards: { ...social.cards, [uid]: entry } }; changed(); }
export function dropCard(uid) { const cards = { ...social.cards }; delete cards[uid]; social = { ...social, cards }; changed(); }
export function clearSocial() { social = blank(); changed(); }

// ---------- reading ----------
export const pendingIncoming = () => social.incoming.filter(r => r.status === 'pending').sort((a, b) => b.createdAt - a.createdAt);
export const pendingOutgoing = () => social.outgoing.filter(r => r.status === 'pending').sort((a, b) => b.createdAt - a.createdAt);
export const friendList = () => Object.entries(social.friends).map(([uid, f]) => ({ uid, ...f }))
  .sort((a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username));

// How I'm related to someone: 'me' | 'friend' | 'sent' (I asked) | 'received' (they asked) | 'none'
export function relation(myUid, uid) {
  if (uid === myUid) return 'me';
  if (social.friends[uid]) return 'friend';
  if (pendingOutgoing().some(r => r.to === uid)) return 'sent';
  if (pendingIncoming().some(r => r.from === uid)) return 'received';
  return 'none';
}

// Every request (any status) between me and them — removed together with the friendship.
export const requestsWith = uid => [...social.incoming, ...social.outgoing].filter(r => r.from === uid || r.to === uid);

// ---------- a friend's week ----------
// From their card: { state, goal, dates (Set of 'YYYY-MM-DD' this week), days, left, met, streak, last } where streak
// is the same object as your own weeklyStreak() (current, thisWeek, jokers, savedLast…). null while loading.
export function friendWeek(uid) {
  const entry = social.cards[uid];
  if (!entry) return null;
  if (entry.state !== 'ok') return { state: entry.state };
  const c = entry.card || {};
  const days = new Map();
  for (const [wk, digits] of Object.entries(c.weeks || {})) {
    const start = parseYmd(wk);
    days.set(wk, new Set(String(digits).split('').map(n => { const d = new Date(start); d.setDate(d.getDate() + Number(n)); return ymd(d); })));
  }
  const goals = c.goals || {};
  const goal = goalAt(goals, weekKey());
  const dates = days.get(weekKey()) || new Set();
  const n = dates.size;
  return {
    state: 'ok', goal, dates, days: n, left: goal ? Math.max(0, goal - n) : 0, met: goal ? n >= goal : n > 0,
    streak: streakFrom(days, goals), last: c.last || null, character: c.character || 'estella',
  };
}
