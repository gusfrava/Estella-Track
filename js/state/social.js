// Friends state (separate from the training data in store.js): my friends and the friend requests to and from me.
// Filled by services/sync.js from Firestore listeners; read by the Amigos screen and the friend sheets.
//
// social = { ready, friends: { uid: { since, username, displayName } }, incoming: [Request], outgoing: [Request] }
// Request = { id, from, to, fromUsername, fromName, toUsername, toName, status: 'pending'|'accepted', createdAt }
const blank = () => ({ ready: false, friends: {}, incoming: [], outgoing: [] });
let social = blank();
const listeners = new Set();

export const getSocial = () => social;
export function onSocialChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const changed = () => listeners.forEach(fn => fn(social));

export function setFriends(friends) { social = { ...social, friends, ready: true }; changed(); }
export function setRequests({ incoming, outgoing }) { social = { ...social, incoming, outgoing }; changed(); }
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
