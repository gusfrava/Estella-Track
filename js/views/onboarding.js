// Onboarding screens (one question each) and the language screen shown before sign-up.
// Buttons carry data-action; main.js maps them to controllers/onboarding.js.
import { ICONS } from '../ui/icons.js';
import { OI } from '../ui/onboarding-icons.js';
import { t, getLang } from '../i18n/index.js';
import { esc, fmtClock } from '../utils/format.js';
import { mascotHTML } from '../ui/mascot.js';
import { progressBar } from './partials.js';
import { STEPS, OPTIONAL, CHOICES, AVAILABLE_CHARACTERS, canContinue } from '../controllers/onboarding.js';

// ---------- language (first screen, before sign-up) ----------
export function languageView() {
  const L = t(), lang = getLang();
  const opt = (code, name) => `<button class="ob-opt" data-action="pick-lang" data-lang="${code}" aria-pressed="${lang === code}">
    <span class="ob-ico">${OI.language}</span><span class="ob-txt"><b>${name}</b></span><span class="ob-tick">${ICONS.check}</span></button>`;
  return `<div class="ob">
    <div class="ob-hero">${mascotHTML({ crop: 'bust', size: '96px' })}</div>
    <h1>${L.ob.langTitle}</h1><p class="sub">${L.ob.langSub}</p>
    <div class="ob-list">${opt('es', 'Español')}${opt('en', 'English')}</div>
    <div class="ob-foot"><button class="btn" data-action="lang-continue">${L.ob.next}</button></div>
  </div>`;
}

// ---------- onboarding ----------
// ui = controllers/onboarding.getOnboardingUI()
export function onboardingView(ui) {
  const L = t();
  const step = STEPS[ui.step];
  const questions = STEPS.length - 2;                         // welcome and done aren't questions
  const n = Math.min(questions, Math.max(0, ui.step));
  const top = step === 'welcome' || step === 'done' ? '' : `<div class="ob-top">
      <button class="round" data-action="ob-back" aria-label="${L.ob.back}">${ICONS.back}</button>
      ${progressBar(Math.round((n / questions) * 100), `role="progressbar" aria-label="${esc(L.ob.step(n, questions))}" aria-valuemin="0" aria-valuemax="${questions}" aria-valuenow="${n}"`)}
      ${OPTIONAL.has(step) ? `<button class="textbtn ob-skip" data-action="ob-skip">${L.ob.skip}</button>` : '<span class="ob-skip"></span>'}
    </div>`;
  const body = SCREENS[step](ui, L);
  return `<div class="ob ob-s-${step}">${top}${body}</div>`;
}

const foot = (L, label = L.ob.next, action = 'ob-next', enabled = true) =>
  `<div class="ob-foot"><button class="btn" data-action="${action}" ${enabled ? '' : 'disabled'}>${label}</button></div>`;

// One card: icon, title, optional description, check mark when chosen.
function option({ key, value, icon, title, desc = '', on, disabled = false, extra = '' }) {
  return `<button class="ob-opt${disabled ? ' off' : ''}" data-action="ob-pick" data-key="${key}" data-value="${value}" aria-pressed="${!!on}" ${disabled ? 'disabled' : ''}>
    ${icon ? `<span class="ob-ico">${icon}</span>` : ''}
    <span class="ob-txt"><b>${esc(title)}</b>${desc ? `<span>${esc(desc)}</span>` : ''}${extra}</span>
    <span class="ob-tick">${ICONS.check}</span></button>`;
}

const question = (title, sub = '') => `<h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}`;

const SCREENS = {
  welcome: (ui, L) => `<div class="ob-center">
      ${mascotHTML({ mood: 'excited', hop: true, size: '300px', label: 'Estella' })}
      <h1>${L.ob.welcomeTitle}</h1><p class="sub">${L.ob.welcomeBody}</p></div>
    <div class="ob-foot"><button class="btn" data-action="ob-next">${L.ob.start}</button>
      <button class="textbtn" data-action="ob-skip-all">${L.ob.skipAll}</button></div>`,

  character: (ui, L) => `${question(L.ob.charTitle, L.ob.charSub)}
    <div class="ob-chars">${CHOICES.character.map(c => {
      const ok = AVAILABLE_CHARACTERS.has(c);
      const name = c === 'estella' ? 'Estella' : 'Diego';
      return `<button class="ob-char${ok ? '' : ' off'}" data-action="ob-pick" data-key="character" data-value="${c}" aria-pressed="${ui.answers.character === c}" ${ok ? '' : 'disabled'}>
        <span class="ob-char-art">${ok ? mascotHTML({ character: c, size: '190px' }) : `<span class="ob-soon">${L.ob.soon}</span>`}</span>
        <b>${name}</b><span class="ob-tick">${ICONS.check}</span></button>`;
    }).join('')}</div>${foot(L)}`,

  goal: (ui, L) => `${question(L.ob.goalTitle)}<div class="ob-list">${CHOICES.goal.map(g => option({
    key: 'goal', value: g, icon: OI['goal_' + g], title: L.ob.goals[g][0], desc: L.ob.goals[g][1], on: ui.answers.goal === g })).join('')}</div>
    ${foot(L, L.ob.next, 'ob-next', canContinue())}`,

  experience: (ui, L) => `${question(L.ob.expTitle)}<div class="ob-list">${CHOICES.experience.map(x => option({
    key: 'experience', value: x, icon: OI['exp_' + x], title: L.ob.exps[x][0], desc: L.ob.exps[x][1], on: ui.answers.experience === x })).join('')}</div>
    ${foot(L, L.ob.next, 'ob-next', canContinue())}`,

  place: (ui, L) => `${question(L.ob.placeTitle, L.ob.placeSub)}<div class="ob-list">${CHOICES.place.map(x => option({
    key: 'place', value: x, icon: OI['place_' + x], title: L.ob.places[x][0], desc: L.ob.places[x][1], on: ui.answers.place === x })).join('')}</div>
    ${foot(L, L.ob.next, 'ob-next', canContinue())}`,

  days: (ui, L) => {
    const d = ui.answers.daysPerWeek;
    return `${question(L.ob.daysTitle, L.ob.daysSub)}
    <div class="ob-days" role="group" aria-label="${esc(L.ob.daysTitle)}">${[1, 2, 3, 4, 5, 6, 7].map(n =>
      `<button class="ob-day num" data-action="ob-pick" data-key="daysPerWeek" data-value="${n}" aria-pressed="${d === n}" aria-label="${esc(L.ob.daysN(n))}">${n}</button>`).join('')}</div>
    <div class="ob-days-label" aria-live="polite">${d ? `${OI.calendar}<span><b>${esc(L.ob.daysN(d))}</b>${esc(L.ob.daysLabel(d))}</span>` : ''}</div>
    ${foot(L, L.ob.next, 'ob-next', canContinue())}`;
  },

  minutes: (ui, L) => `${question(L.ob.minTitle)}<div class="ob-list">${CHOICES.minutes.map(m => option({
    key: 'minutes', value: m, icon: OI.clock, title: `${m} min`, desc: L.ob.mins[m], on: ui.answers.minutes === m })).join('')}</div>
    ${foot(L, L.ob.next, 'ob-next', canContinue())}`,

  body: (ui, L) => {
    const b = ui.body, lb = b.unit === 'lb';
    const box = (id, label, value, unit, mode = 'decimal') => `<label class="ob-num"><span>${label}</span>
      <span class="ob-num-in"><input id="${id}" class="input" type="text" inputmode="${mode}" autocomplete="off" value="${esc(value)}" data-ob-body="${id.slice(3)}"><em>${unit}</em></span></label>`;
    return `${question(L.ob.bodyTitle, L.ob.bodySub)}
    <div class="seg ob-units" role="group" aria-label="${L.unit}">
      <button type="button" data-action="ob-unit" data-unit="kg" aria-pressed="${!lb}">kg · cm</button>
      <button type="button" data-action="ob-unit" data-unit="lb" aria-pressed="${lb}">lb · ft</button>
    </div>
    <div class="ob-body">
      ${box('ob-weight', L.ob.weight, b.weight, lb ? 'lb' : 'kg')}
      ${lb
        ? `<div class="ob-hft"><span class="flabel">${L.ob.height}</span><div class="row">${box('ob-ft', '', b.ft, L.ob.feet, 'numeric')}${box('ob-inch', '', b.inch, L.ob.inches, 'numeric')}</div></div>`
        : box('ob-height', L.ob.height, b.height, 'cm', 'numeric')}
    </div>
    <p class="ob-private">${OI.scale}<span>${L.ob.bodyPrivate}</span></p>
    ${ui.error ? `<div class="formmsg err-box" role="alert">${L.ob[ui.error]}</div>` : ''}
    ${foot(L)}`;
  },

  source: (ui, L) => `${question(L.ob.srcTitle, L.ob.srcSub)}<div class="ob-list ob-compact">${CHOICES.source.map(x => option({
    key: 'source', value: x, icon: OI['src_' + x], title: L.ob.srcs[x], on: ui.answers.source === x })).join('')}</div>
    ${foot(L, L.ob.next, 'ob-next', canContinue())}`,

  done: (ui, L) => {
    if (ui.plan === 'loading' || ui.plan === null) return `<div class="ob-center">
      ${mascotHTML({ mood: 'focused', size: '200px', label: 'Estella' })}
      <h1>${L.ob.planLoading}</h1></div>`;
    const plan = Array.isArray(ui.plan) ? ui.plan.filter(r => r.exercises.length) : [];
    if (plan.length) return planScreen(ui, plan, L);
    const a = ui.answers;
    const chips = [
      a.goal && [L.ob.summaryGoal, L.ob.goals[a.goal][0]],
      a.daysPerWeek && [L.ob.summaryDays, L.ob.daysN(a.daysPerWeek)],
      a.place && [L.ob.summaryPlace, L.ob.places[a.place][0]],
    ].filter(Boolean);
    return `<div class="ob-center">
      ${mascotHTML({ mood: 'excited', hop: true, size: '280px', label: 'Estella' })}
      <h1>${L.ob.doneTitle}</h1><p class="sub">${L.ob.doneBody}</p>
      ${chips.length ? `<ul class="ob-summary">${chips.map(([k, v]) => `<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join('')}</ul>` : ''}
    </div>${foot(L, L.ob.doneGo, 'ob-finish')}`;
  },
};

// The starter plan: one card per routine (tap to see its exercises), save or skip.
function planScreen(ui, plan, L) {
  const a = ui.answers;
  const time = s => (s < 60 ? `${s} s` : s % 60 === 0 ? `${s / 60} min` : fmtClock(s));   // 30 s, 10 min, 1:30
  const dose = e => (e.type === 'time'
    ? (e.sets > 1 ? `${e.sets} × ${time(e.seconds)}` : time(e.seconds))
    : `${e.sets} × ${e.reps}${e.perSide ? ` ${L.ob.planPerSide}` : ''}`);
  const card = (r, i) => `<li><details class="ob-plan-r"${i === 0 ? ' open' : ''}>
      <summary><span class="ob-plan-n num">${i + 1}</span><span class="ob-plan-t"><b>${esc(r.name)}</b>
        <span>${esc(L.ob.planCount(r.exercises.length))}</span></span><span class="ob-plan-chev" aria-hidden="true">${ICONS.back}</span></summary>
      <ol class="ob-plan-ex">${r.exercises.map(e => `<li><span>${esc(e.name)}</span><b class="num">${esc(dose(e))}</b></li>`).join('')}</ol>
    </details></li>`;
  return `<div class="ob-plan-head">
      ${mascotHTML({ mood: 'excited', hop: true, crop: 'bust', size: '88px', label: 'Estella' })}
      <div><h1>${L.ob.planTitle}</h1><p class="sub">${esc(L.ob.planSub(plan.length, a.daysPerWeek, a.minutes))}</p></div>
    </div>
    <ul class="ob-plan">${plan.map(card).join('')}</ul>
    ${a.goal === 'fat' ? `<p class="ob-plan-note">${esc(L.ob.planNoteFat)}</p>` : ''}
    <p class="ob-plan-note">${esc(L.ob.planNote)}</p>
    <div class="ob-foot"><button class="btn" data-action="ob-save-plan">${L.ob.planSave}</button>
      <button class="textbtn" data-action="ob-finish">${L.ob.planSkip}</button></div>`;
}
