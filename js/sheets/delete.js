// Delete confirmations for routines, exercises and activities (the bin icon).
import { confirmSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { findRoutine, findActivity, deleteRoutine, deleteExercise, deleteActivity } from '../state/store.js';
import { getView, goHome } from '../ui/router.js';

export function confirmDeleteRoutine(id) {
  const L = t(), r = findRoutine(id);
  if (!r) return;
  confirmSheet(L.confirmDelete(r.name), L.confirmDeleteRoutine, () => {
    const wasOpen = getView().name === 'routine' && getView().id === id;
    deleteRoutine(id);
    if (wasOpen) goHome();
  });
}

export function confirmDeleteExercise(routineId, exId) {
  const L = t(), r = findRoutine(routineId);
  const ex = r && r.exercises.find(e => e.id === exId);
  if (!ex) return;
  confirmSheet(L.confirmDelete(ex.name), L.confirmDeleteEx, () => deleteExercise(routineId, exId));
}

export function confirmDeleteActivity(id) {
  const L = t(), a = findActivity(id);
  if (!a) return;
  confirmSheet(L.confirmDelete(a.activity.sport), L.confirmDeleteAct, () => deleteActivity(id));
}
