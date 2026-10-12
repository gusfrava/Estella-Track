// One-time move from v1 (everything in one object) to v2 (one document per routine / session / exercise history).
// convertV1() is a pure function: v1 data in → v2 { routines, sessions, stats } out. It never touches storage.
// Document ids are deterministic (same v1 data → same ids), so running it twice can't create duplicates.
//
// v1 shape: { routines: [{ id, name, recurring, weekKey, completedAt, completions[],
//                          exercises: [{ id, name, sets, reps, weight, unit, done, doneAt, history: [{ d, s, r, w, u }] }] }],
//             activities: [{ id, sport, minutes, date, note, created }] }

import { normalizeRoutine, normalizeSession, normalizeStat, normalizeTarget, setsFromTarget } from '../state/model.js';
import { weekKey, weekKeyOf, ymdOf, todayStr } from '../utils/dates.js';

export function hasV1Data(v1) {
  return !!(v1 && ((v1.routines || []).length || (v1.activities || []).length));
}

export function convertV1(v1) {
  const out = { routines: {}, sessions: {}, stats: {} };
  if (!v1) return out;
  const now = Date.now();
  const thisWeek = weekKey();

  (v1.routines || []).forEach((r, i) => {
    if (!r || !r.id) return;
    const exercises = (r.exercises || []).filter(e => e && e.id);
    const routine = normalizeRoutine(r.id, {
      name: r.name, order: i, recurring: r.recurring !== false, archived: false, createdAt: now, updatedAt: now,
      exercises: exercises.map(e => ({ id: e.id, exerciseId: null, name: e.name, type: 'weight_reps', target: normalizeTarget(e) })),
    });

    // Per-exercise history.
    exercises.forEach(e => {
      out.stats[e.id] = normalizeStat(e.id, { name: e.name, points: (e.history || []).map(h => ({ d: h.d, s: h.s, r: h.r, w: h.w, u: h.u })) });
    });

    // This week's check marks (or, if not recurring, the latest ones) → the routine's current session.
    const checked = exercises.filter(e => e.done);
    const stillCurrent = checked.length && (r.recurring === false || r.weekKey === thisWeek);
    const usedEntries = new Set();
    if (stillCurrent) {
      const firstDone = Math.min(...checked.map(e => e.doneAt || now));
      const date = ymdOf(firstDone);
      const id = `m-${r.id}-current`;
      out.sessions[id] = normalizeSession(id, {
        kind: 'gym', routineId: r.id, routineName: r.name, date, weekKey: weekKeyOf(date),
        status: r.completedAt ? 'done' : 'in_progress',
        startedAt: firstDone, finishedAt: r.completedAt ? Date.parse(r.completedAt) || now : null, updatedAt: now,
        exercises: checked.map(e => {
          const d = e.doneAt ? ymdOf(e.doneAt) : date;
          usedEntries.add(`${e.id}|${d}`);
          return { id: e.id, name: e.name, doneAt: e.doneAt || firstDone, sets: setsFromTarget(normalizeTarget(e)) };
        }),
      });
      routine.current = { sessionId: id, weekKey: weekKeyOf(date) };
    }

    // Older check-offs → one finished session per routine per day.
    const byDay = {};
    exercises.forEach(e => (e.history || []).forEach(h => {
      if (!h || !h.d || usedEntries.has(`${e.id}|${h.d}`)) return;
      (byDay[h.d] = byDay[h.d] || []).push({ id: e.id, name: e.name, doneAt: null, sets: setsFromTarget(normalizeTarget({ sets: h.s, reps: h.r, weight: h.w, unit: h.u })) });
    }));
    for (const [d, list] of Object.entries(byDay)) {
      const id = `m-${r.id}-${d}`;
      out.sessions[id] = normalizeSession(id, {
        kind: 'gym', routineId: r.id, routineName: r.name, date: d, weekKey: weekKeyOf(d), status: 'done',
        startedAt: 0, finishedAt: null, updatedAt: now, exercises: list,
      });
    }

    out.routines[routine.id] = routine;
  });

  (v1.activities || []).forEach(a => {
    if (!a || !a.id) return;
    const date = a.date || todayStr();
    out.sessions[a.id] = normalizeSession(a.id, {
      kind: 'activity', date, weekKey: weekKeyOf(date), status: 'done',
      createdAt: Date.parse(a.created) || now, updatedAt: now,
      activity: { sport: a.sport, minutes: a.minutes, note: a.note || '' },
    });
  });

  return out;
}

// v2 data → the list of document writes the sync layer understands.
export function writesFor(v2) {
  const w = [];
  for (const col of ['routines', 'sessions', 'stats']) {
    for (const [id, data] of Object.entries(v2[col] || {})) w.push({ op: 'set', col, id, data });
  }
  return w;
}
