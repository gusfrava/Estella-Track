// "Meta semanal": how many days a week you want to train. Weeks where you reach it count for your streak.
// Opened from the week card on home. The change applies from this week on.
import { openSheet, closeSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { getState, setWeeklyGoal } from '../state/store.js';
import { weeklyGoal } from '../state/selectors.js';

export function openWeeklyGoalSheet() {
  const L = t();
  let pick = weeklyGoal(getState()) || 3;
  const label = n => `<b>${esc(L.ob.daysN(n))}</b><span>${esc(L.ob.daysLabel(n))}</span>`;
  openSheet(`<h2>${L.goalTitle}</h2><p class="sub">${L.goalSub}</p>
    <div class="ob-days" role="group" aria-label="${esc(L.goalTitle)}">${[1, 2, 3, 4, 5, 6, 7].map(n =>
      `<button type="button" class="ob-day num" data-n="${n}" aria-pressed="${n === pick}" aria-label="${esc(L.ob.daysN(n))}">${n}</button>`).join('')}</div>
    <p class="goal-label" aria-live="polite">${label(pick)}</p>
    <p class="hint">${L.goalHint}</p>
    <div class="actions"><button class="btn" type="button" data-k="save">${L.save}</button></div>`,
  s => {
    s.querySelectorAll('[data-n]').forEach(b => b.onclick = () => {
      pick = Number(b.dataset.n);
      s.querySelectorAll('[data-n]').forEach(x => x.setAttribute('aria-pressed', Number(x.dataset.n) === pick));
      s.querySelector('.goal-label').innerHTML = label(pick);
    });
    s.querySelector('[data-k=save]').onclick = () => { setWeeklyGoal(pick); closeSheet(); };
  });
}
