// Shared routines: the routines friends can see and copy ("Copiar rutina"), without weights or notes.
// Pure calculations, tested in functions/test/routines.test.js. index.js writes sharedRoutines/{uid}.
//
// sharedRoutines/{uid} = {
//   v, visibility: 'private'|'friends'|'public',   // = the person's sharing.routines; the Firestore rules check it
//   routines: [{ id, name, exercises: [{ exerciseId, name, type, perSide, sets, reps, seconds }] }],
//   updatedAt
// }
// Weights are left out on purpose: they're part of "Entrenos", and whoever copies fills in their own.

const LEVELS = ['private', 'friends', 'public'];
const MAX_ROUTINES = 30, MAX_EXERCISES = 30;
const TYPES = ['weight_reps', 'reps', 'time'];

const int = (v, d, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };

function visibility(profile) {
  const level = ((profile && profile.sharing) || {}).routines || 'friends';
  return LEVELS.includes(level) ? level : 'friends';
}

// One routine as friends see it, or null for archived / empty ones.
function shareRoutine(id, r) {
  if (!r || r.archived) return null;
  const exercises = (Array.isArray(r.exercises) ? r.exercises : []).slice(0, MAX_EXERCISES).map(e => {
    const t = (e && e.target) || {};
    const type = TYPES.includes(e && e.type) ? e.type : 'weight_reps';
    return {
      exerciseId: (e && typeof e.exerciseId === 'string' && e.exerciseId) || null,
      name: String((e && e.name) || '').slice(0, 80),
      type, perSide: !!(e && e.perSide) && type !== 'time',
      sets: int(t.sets, 3, 1, 20), reps: int(t.reps, 10, 1, 200), seconds: int(t.seconds, 60, 1, 7200),
    };
  });
  if (!exercises.length) return null;
  return { id, name: String(r.name || '').slice(0, 60), order: Number(r.order) || 0, exercises };
}

// docs = [{ id, data }] of users/{uid}/routines
function buildShared(profile, docs, now = Date.now()) {
  const routines = docs.map(d => shareRoutine(d.id, d.data)).filter(Boolean)
    .sort((a, b) => a.order - b.order).slice(0, MAX_ROUTINES)
    .map(({ order, ...r }) => r);
  return { v: 1, visibility: visibility(profile), routines, updatedAt: now };
}

// The parts of a routine that matter to friends: if these didn't change (e.g. only this week's check marks did),
// the shared copy doesn't either.
const routineKey = (id, r) => JSON.stringify(shareRoutine(id, r));

module.exports = { buildShared, shareRoutine, routineKey, visibility };
