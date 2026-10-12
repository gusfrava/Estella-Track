// Data shapes. This is the single source of truth for what a routine, exercise and activity look like.
//
// State = { routines: Routine[], activities: Activity[] }
//
// Routine  = { id, name, recurring, exercises: Exercise[], weekKey, completedAt, completions: 'YYYY-MM-DD'[] }
//   recurring  – true = unchecks itself every Monday
//   weekKey    – Monday of the week its check marks belong to (recurring only)
//   completedAt – ISO time when every exercise got checked, or null
//
// Exercise = { id, name, sets, reps, weight, unit: 'kg'|'lb', done, doneAt, history: Entry[] }
//   Entry  = { d: 'YYYY-MM-DD', s: sets, r: reps, w: weight, u: unit }  – saved each time it's checked
//
// Activity = { id, sport, minutes, date: 'YYYY-MM-DD', note, created }

import { uid } from '../utils/data.js';
import { weekKey } from '../utils/dates.js';

export const blankState = () => ({ routines: [], activities: [] });

// Fills in missing fields so older or partial data never breaks the screens.
export function normalizeState(d) {
  d = d || {};
  const routines = (Array.isArray(d.routines) ? d.routines : []).map(r => ({
    recurring: true, weekKey: null, completedAt: null, completions: [], ...r,
    exercises: (Array.isArray(r.exercises) ? r.exercises : []).map(e => ({
      sets: 3, reps: 10, weight: 0, unit: 'kg', done: false, doneAt: null, history: [], ...e
    }))
  }));
  const activities = (Array.isArray(d.activities) ? d.activities : []).map(a => ({ note: '', ...a }));
  return { routines, activities };
}

export const makeRoutine = ({ name, recurring }) => ({
  id: uid(), name, recurring: !!recurring, exercises: [], weekKey: weekKey(), completedAt: null, completions: []
});

export const makeExercise = ({ name, sets, reps, weight, unit }) => ({
  id: uid(), name, sets, reps, weight, unit, done: false, doneAt: null, history: []
});

export const makeActivity = ({ sport, minutes, date, note }) => ({
  id: uid(), sport, minutes, date, note, created: new Date().toISOString()
});
