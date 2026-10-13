// Friends state (separate from the training data in store.js): my friends, the friend requests to and from me,
// and my friends' cards. Filled by services/sync.js from Firestore listeners; read by the Amigos screen and the friend sheets.
//
// social = { ready, friends: { uid: { since, username, displayName } }, incoming: [Request], outgoing: [Request],
//            cards: { uid: { state: 'ok'|'none'|'hidden'|'error', card } },
//            cheers: { received: [Cheer] },   // newest first, the latest 30
//            myCheers: { 'friendUid|date': Cheer | null } }   // the cheer I sent for a friend's workout (cards that are open)
// Cheer = { id, from, to, fromUsername, fromName, kind: 'fire'|'strong'|'clap', date, workout, createdAt }
//   card = profileCards/{uid}, written by the server (functions/card.js). 'none' = not built yet (it's built when
//   they open the app), 'hidden' = they share their profile with nobody.
// Request = { id, from, to, fromUsername, fromName, toUsername, toName, status: 'pending'|'accepted', createdAt }
import { streakFrom, goalAt } from './selectors.js';
import { parseYmd, ymd, weekKey } from '../utils/dates.js';

const blank = () => ({ ready: false, friends: {}, incoming: [], outgoing: [], cards: {}, cheers: { received: [] }, myCheers: {} });
let social = blank();
const listeners = new Set();

export const getSocial = () => social;
export function onSocialChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const changed = () => listeners.forEach(fn => { try { fn(social); } catch (err) { console.error('[social] listener failed', err); } });

export function setFriends(friends) { social = { ...social, friends, ready: true }; changed(); }
export function setRequests({ incoming, outgoing }) { social = { ...social, incoming, outgoing }; changed(); }
export function setCard(uid, entry) { social = { ...social, cards: { ...social.cards, [uid]: entry } }; changed(); }
export function dropCard(uid) { const cards = { ...social.cards }; delete cards[uid]; social = { ...social, cards }; changed(); }
export function setCheers(received) { social = { ...social, cheers: { received } }; changed(); }
export function setMyCheer(uid, date, cheer) { social = { ...social, myCheers: { ...social.myCheers, [`${uid}|${date}`]: cheer } }; changed(); }
export function clearSocial() { social = blank(); changed(); }

// ---------- reading ----------
export const pendingIncoming = () => social.incoming.filter(r => r.status === 'pending').sort((a, b) => b.createdAt - a.createdAt);
export const pendingOutgoing = () => social.outgoing.filter(r => r.status === 'pending').sort((a, b) => b.createdAt - a.createdAt);
const sortName = f => String(f.displayName || f.username || '');
export const friendList = () => Object.entries(social.friends).map(([uid, f]) => ({ uid, ...f }))
  .sort((a, b) => sortName(a).localeCompare(sortName(b)));

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

// ---------- cheers ----------
// The cheer I sent this friend for their workout on `date`, or null.
export const myCheerFor = (uid, date) => social.myCheers[`${uid}|${date}`] || null;

// Cheers I received in the last `days` days (newest first), only from people who are still my friends.
export function recentCheers(days = 7) {
  const since = Date.now() - days * 864e5;
  return social.cheers.received.filter(c => c.createdAt >= since && social.friends[c.from]);
}

// How many of those arrived after `seenAt` (the last time I opened Amigos) — the badge on the tab.
export const unseenCheers = seenAt => recentCheers().filter(c => c.createdAt > (seenAt || 0)).length;
