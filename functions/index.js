// Estella's server functions (Firebase Cloud Functions, 2nd gen). They run on Google's servers, not on phones,
// so what they write can't be edited from the app. How to deploy: docs/SERVER.md.
//
// Friend cards (profileCards/{uid}, see card.js):
//  - cardOnSession: a workout or activity changed → update that week's days and the last workout.
//  - cardOnProfile: profile changed → name, goal, sharing; rebuilds the whole card when it's missing or outdated
//    (the app asks for that by writing cardRefreshAt); deletes the card when the account is deleted.
// Points and badges (users/{uid}/wallet/main, see rewards.js) — awarded here only, so nobody can give themselves points:
//  - workouts and the weekly goal (cardOnSession), records (rewardsOnStats), cheers (rewardsOnCheer),
//    friends (rewardsOnFriend), copied routines (sharedOnRoutine).
// Shared routines (sharedRoutines/{uid}, see routines.js) — what friends can see and copy, without weights:
//  - sharedOnRoutine: a routine was added, changed or deleted → rebuild the list.
//  - cardOnProfile also rebuilds it with the card, follows the "Rutinas" sharing setting and deletes it with the account.
const { setGlobalOptions } = require('firebase-functions/v2');
const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const card = require('./card');
const shared = require('./routines');
const rewards = require('./rewards');
const { goalAt, streakAt } = require('./streak');

// us-central1 is inside the database's location (nam7). maxInstances caps cost if something ever loops.
setGlobalOptions({ region: 'us-central1', maxInstances: 10, memory: '256MiB' });

// firebase-admin is loaded the first time a function runs, not when the file is read: `firebase deploy` reads this
// file on your computer to see which functions exist, and gives up after 10 seconds (loading firebase-admin there
// can take longer on Windows).
let admin = null;
function fsdb() {
  if (!admin) {
    const { initializeApp } = require('firebase-admin/app');
    const firestore = require('firebase-admin/firestore');
    initializeApp();
    admin = { db: firestore.getFirestore(), FieldPath: firestore.FieldPath, FieldValue: firestore.FieldValue };
  }
  return admin;
}
const db = { collection: name => fsdb().db.collection(name) };
const cardRef = uid => db.collection('profileCards').doc(uid);
const sessionsOf = uid => db.collection('users').doc(uid).collection('sessions');
const sharedRef = uid => db.collection('sharedRoutines').doc(uid);
const walletRef = uid => db.collection('users').doc(uid).collection('wallet').doc('main');
const todayUTC = () => new Date().toISOString().slice(0, 10);

// Applies reward events to someone's wallet in one transaction (several functions can run at once for one person).
// Skips people whose account doesn't exist. Friends see the number of badges on the friend card.
async function award(uid, events) {
  let badgeCount = null;
  await fsdb().db.runTransaction(async tx => {
    const [profile, snap] = await Promise.all([tx.get(db.collection('users').doc(uid)), tx.get(walletRef(uid))]);
    if (!profile.exists) return;
    // since = yesterday (UTC): the phone dates workouts in local time, which can be a day behind the server.
    let w = snap.exists ? snap.data() : rewards.newWallet(card.addDays(todayUTC(), -1));
    const before = JSON.stringify(w);
    for (const ev of events) w = rewards.applyEvent(w, ev).wallet;
    if (JSON.stringify(w) === before) return;
    tx.set(walletRef(uid), w);
    const n = Object.keys(w.badges || {}).length;
    if (!snap.exists || n !== Object.keys(snap.data().badges || {}).length) badgeCount = n;
  });
  if (badgeCount !== null) await cardRef(uid).update({ badges: badgeCount }).catch(() => {});   // no card yet: fine
}

const dataOf = snap => (snap && snap.exists ? snap.data() : null);

async function rebuildShared(uid, profile) {
  const snap = await db.collection('users').doc(uid).collection('routines').get();
  const doc = shared.buildShared(profile, snap.docs.map(d => ({ id: d.id, data: d.data() })));
  await sharedRef(uid).set(doc);
  return doc;
}

// ---------- whole card ----------
async function rebuild(uid, profile) {
  const [sessions, stats] = await Promise.all([
    sessionsOf(uid).get(),
    db.collection('users').doc(uid).collection('exerciseStats').get(),
  ]);
  const c = card.buildCard(profile, sessions.docs.map(d => d.data()), stats.docs.map(d => d.data()));
  c.builtAt = Date.now();   // when the whole card was last rebuilt (rebuilds on request are limited to one an hour)
  await cardRef(uid).set(c);
  const r = await rebuildShared(uid, profile);
  logger.info('card built', { uid, weeks: Object.keys(c.weeks).length, routines: r.routines.length });
}

// The most recent training, for "Último entreno".
async function latest(uid, profile) {
  const snap = await sessionsOf(uid).orderBy('date', 'desc').limit(15).get();
  return card.lastWorkout(profile, snap.docs.map(d => d.data()));
}

// ---------- a session changed ----------
exports.cardOnSession = onDocumentWritten('users/{uid}/sessions/{sid}', async event => {
  const uid = event.params.uid;
  const before = dataOf(event.data && event.data.before), after = dataOf(event.data && event.data.after);
  if (card.sessionKey(before) === card.sessionKey(after)) return;   // e.g. a set checked mid-workout: nothing new

  const [cardSnap, profileSnap] = await Promise.all([cardRef(uid).get(), db.collection('users').doc(uid).get()]);
  if (!profileSnap.exists) return;   // account deleted
  const profile = profileSnap.data();
  const events = [];
  if (card.sessionCounts(after)) {   // a workout or activity: points once per session
    events.push({ type: 'workout', key: `session:${event.params.sid}`, date: after.date,
      kind: after.kind === 'activity' ? 'activity' : 'gym', minutes: after.activity && after.activity.minutes });
  }

  if (cardSnap.exists) {   // no card yet: it's built from the profile
    const current = cardSnap.data();
    const weeks = new Set([before, after].filter(s => s && /^\d{4}-\d{2}-\d{2}$/.test(s.date)).map(s => card.weekKeyOf(s.date)));
    const updates = [], newWeeks = { ...(current.weeks || {}) };
    for (const wk of weeks) {
      const snap = await sessionsOf(uid).where('date', '>=', wk).where('date', '<=', card.addDays(wk, 6)).get();
      const d = card.weekDigits(snap.docs.map(x => x.data()), (current.pts || {})[wk]);
      updates.push(new (fsdb().FieldPath)('weeks', wk), d || fsdb().FieldValue.delete());
      if (d) newWeeks[wk] = d; else delete newWeeks[wk];
    }
    // Weekly goal reached with this workout → goal points + streak bonus (once per week).
    if (card.sessionCounts(after)) {
      const wk = card.weekKeyOf(after.date), goals = card.goalHistory(profile), goal = goalAt(goals, wk);
      if (goal && (newWeeks[wk] || '').length >= goal) {
        events.push({ type: 'goal', key: `goal:${wk}`, date: after.date, streak: streakAt(newWeeks, goals, wk) });
      }
    }
    updates.push('last', await latest(uid, profile), 'updatedAt', Date.now());
    try {
      await cardRef(uid).update(...updates);
    } catch (err) {
      if (err.code !== 5) throw err;   // NOT_FOUND: the card was deleted meanwhile (account deletion)
    }
  }
  if (events.length) await award(uid, events);
});

// ---------- rewards: records, cheers, friends ----------
exports.rewardsOnStats = onDocumentWritten('users/{uid}/exerciseStats/{sid}', async event => {
  const before = dataOf(event.data && event.data.before), after = dataOf(event.data && event.data.after);
  const rec = rewards.newRecord(before, after);
  if (rec) await award(event.params.uid, [{ type: 'record', key: `record:${event.params.sid}:${rec.date}`, date: rec.date }]);
});

exports.rewardsOnCheer = onDocumentCreated('cheers/{id}', async event => {
  const c = dataOf(event.data);
  if (!c || !c.from || !c.to) return;
  const id = event.params.id, date = todayUTC();
  await Promise.all([
    award(c.to, [{ type: 'cheerReceived', key: `cheerIn:${id}`, date }]),
    award(c.from, [{ type: 'cheerSent', key: `cheerOut:${id}`, date }]),
  ]);
});

exports.rewardsOnFriend = onDocumentCreated('users/{uid}/friends/{fid}', async event => {
  const uid = event.params.uid;
  const snap = await db.collection('users').doc(uid).collection('friends').get();
  await award(uid, [{ type: 'friends', count: snap.docs.length }]);
});

// ---------- the profile changed ----------
exports.cardOnProfile = onDocumentWritten('users/{uid}', async event => {
  const uid = event.params.uid;
  const before = dataOf(event.data && event.data.before), after = dataOf(event.data && event.data.after);

  if (!after) {   // account deleted (the app can't delete these: only the server writes them)
    await Promise.all([cardRef(uid).delete(), sharedRef(uid).delete(), walletRef(uid).delete()]);
    logger.info('card deleted', { uid });
    return;
  }
  if (!after.username) return;   // still setting up the account

  const cardSnap = await cardRef(uid).get();
  const current = dataOf(cardSnap);
  // The app asks for a rebuild (cardRefreshAt) when its card is missing or outdated. A rebuild reads all of a person's
  // data, so an up-to-date card is rebuilt on request at most once an hour (someone writing cardRefreshAt in a loop
  // can't run up the bill).
  const asked = after.cardRefreshAt && (!before || before.cardRefreshAt !== after.cardRefreshAt)
    && !(current && Date.now() - (current.builtAt || 0) < 3600000);
  if (!current || current.v !== card.CARD_VERSION || asked) {
    await rebuild(uid, after);
    return;
  }

  // "Rutinas" sharing changed → who can see the shared routines.
  if (shared.visibility(before) !== shared.visibility(after)) {
    await sharedRef(uid).set({ visibility: shared.visibility(after), updatedAt: Date.now() }, { merge: true });
  }

  // Only what the profile decides: name, character, who can see it, goals, and whether the last workout shows.
  const next = { ...card.header(after), goals: card.goalHistory(after) };
  const same = Object.keys(next).every(k => JSON.stringify(next[k]) === JSON.stringify(current[k]));
  const share = p => ((p && p.sharing) || {}).workouts;
  const workoutsChanged = share(before) !== share(after);
  if (same && !workoutsChanged) return;
  if (workoutsChanged) next.last = await latest(uid, after);
  // update(), not set(): the goals map is replaced as a whole, weeks/pts stay as they are.
  await cardRef(uid).update({ ...next, updatedAt: Date.now() });
});

// ---------- a routine changed ----------
exports.sharedOnRoutine = onDocumentWritten('users/{uid}/routines/{rid}', async event => {
  const uid = event.params.uid, rid = event.params.rid;
  const before = dataOf(event.data && event.data.before), after = dataOf(event.data && event.data.after);
  if (!before && after && after.source && after.source.type === 'friend') {   // "Copiar rutina" → counts for a badge
    await award(uid, [{ type: 'copy', key: `copy:${rid}`, date: todayUTC() }]);
  }
  if (shared.routineKey(rid, before) === shared.routineKey(rid, after)) return;   // e.g. only this week's progress changed
  const profileSnap = await db.collection('users').doc(uid).get();
  if (!profileSnap.exists) return;   // account being deleted
  await rebuildShared(uid, profileSnap.data());
});
