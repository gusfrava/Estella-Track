// Routine screen: progress bar, title, exercise list (finished ones at the bottom), add button.
// Tapping an exercise opens it in place with one row per set (reps × weight, ✓). ui.openId = the open one.
import { ICONS } from '../ui/icons.js';
import { t, getLang } from '../i18n/index.js';
import { esc, fmtDay, fmtNum, fmtClock } from '../utils/format.js';
import { nextMonday, pad2 } from '../utils/dates.js';
import { orderedExercises, routineProgress, planChange, isRoutineDone, setsToShow, lastTime } from '../state/selectors.js';
import { editDeleteButtons, progressBar } from './partials.js';
import { mascotHTML } from '../ui/mascot.js';
import { searchUrl } from '../utils/youtube.js';
import { techniqueVideo, libraryExercise } from '../services/library.js';

export function routineView(state, r, ui = {}) {
  const L = t();
  const { done, total, pct } = routineProgress(r);
  const { pending, done: checked } = orderedExercises(r);

  let h = `
  <div class="topbar">
    <button class="round" data-action="home" aria-label="${L.back}">${ICONS.back}</button>
    ${progressBar(pct, `role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"`)}
    <span class="count num">${pad2(done)}/${pad2(total)}</span>
  </div>
  <div class="rhead">
    ${mascotHTML({ crop: 'bust', size: '56px', mood: isRoutineDone(r) ? 'excited' : done || anyLogged(r) ? 'focused' : 'amused' })}
    <div><h1>${esc(r.name)}</h1><p class="sub">${esc(L.exercisesN(total))} · ${r.recurring ? L.weekly : L.once}</p></div>
    ${editDeleteButtons('routine', r.id, r.name)}
  </div>`;

  if (isRoutineDone(r)) {
    const nextReset = fmtDay(nextMonday(), { weekday: 'long', day: 'numeric', month: 'short' });
    h += `<div class="banner">${ICONS.star}<span>${esc(r.recurring ? L.doneThisWeek(nextReset) : L.doneOnce)}</span></div>`;
  }

  h += total
    ? `<ul class="list exlist">${[...pending, ...checked].map(i => exerciseItem(state, r, i, i.ex.id === ui.openId)).join('')}</ul>`
    : `<div class="empty" style="margin-top:26px"><h3>${L.emptyRoutineTitle}</h3><p>${L.emptyRoutineBody}</p></div>`;

  h += `<button class="add-ex" data-action="new-ex">${ICONS.plus}<span>${L.addExercise}</span></button>`;
  if (done) h += `<button class="textbtn reset" data-action="reset">${L.resetProgress}</button>`;
  return h;
}

// Something already logged this session (even a single set) → the mascot looks focused.
const anyLogged = r => orderedExercises(r).pending.some(i => i.logged && i.logged.sets.some(x => x.done));

// item = { ex: routine exercise, logged: this session's entry or null, done: every set checked }
function exerciseItem(state, r, item, open) {
  const L = t();
  const { ex, logged, done } = item;
  const sets = setsToShow(item);
  const nDone = sets.filter(x => x.done).length;
  const partial = !done && nDone > 0;
  const stats = setsSummary(done ? logged.sets : setsToShow({ ex, logged: null }), ex.type);
  const checkLabel = done ? L.markUndone : partial ? L.setsDoneOf(nDone, sets.length) + '. ' + L.markDone : L.markDone;
  return `<li class="ex${done ? ' done' : ''}${open ? ' open' : ''}${partial ? ' partial' : ''}" data-flip="${ex.id}">
    <div class="ex-row">
      <button class="check" data-action="toggle" data-id="${ex.id}" aria-pressed="${done}" aria-label="${checkLabel}: ${esc(ex.name)}">${partial ? `<span class="check-n num">${nDone}/${sets.length}</span>` : ICONS.check}</button>
      <button class="ex-body" data-action="expand" data-id="${ex.id}" aria-expanded="${open}" aria-controls="sets-${ex.id}">
        <span class="ex-name">${esc(ex.name)}</span>
        <span class="stats">${stats}${deltaHTML(planChange(state, ex), ex.target.unit)}</span>
      </button>
      ${editDeleteButtons('ex', ex.id, ex.name)}
    </div>
    ${open ? setsPanel(state, r, ex, sets) : ''}
  </li>`;
}

// "↑ +2.5 kg" / "↑ +2 reps" / "↑ +0:15"
function deltaHTML({ diff, kind }, unit) {
  if (!diff) return '';
  const L = t();
  const amount = kind === 'time' ? fmtClock(Math.abs(diff)) : `${fmtNum(Math.abs(diff))} ${kind === 'reps' ? L.repsU : unit}`;
  return `<span class="delta${diff < 0 ? ' down' : ''}">${diff > 0 ? '↑ +' : '↓ −'}${amount}</span>`;
}

// One set as short text: "10×60" (weight × reps), "12" (reps only), "1:30" (time), "10/8×12" (per side),
// "↓8×47,5" (drop).
function setText(x, type) {
  const drop = x.kind === 'drop' ? '↓' : '';
  if (type === 'time') return drop + fmtClock(x.seconds);
  const reps = x.repsR == null ? String(x.reps) : `${x.reps}/${x.repsR}`;
  if (type === 'reps') return drop + reps;
  return `${drop}${reps}×${x.weight > 0 ? fmtNum(x.weight) : '–'}`;
}
const setsUnit = (sets, type) => (type === 'time' ? '' : type === 'reps' ? ` ${t().repsU}` : ` ${sets[0].unit}`);

// "3 series · 10 reps · 60 kg" when all sets are the same, otherwise "10×60 · 10×62,5 · 8×62,5 kg".
function setsSummary(sets, type) {
  const L = t();
  if (!sets.length) return '';
  const a = sets[0];
  const same = sets.every(x => x.kind === 'normal' && x.reps === a.reps && x.repsR === a.repsR && x.weight === a.weight
    && x.unit === a.unit && x.seconds === a.seconds);
  if (same) {
    const n = `<span><b>${sets.length}</b> ${L.setsU(sets.length)}</span>`;
    if (type === 'time') return `${n}<span><b>${fmtClock(a.seconds)}</b></span>`;
    // per side: "10 reps por lado", or "10/8 reps" when the sides differ
    const reps = a.repsR == null ? `<span><b>${a.reps}</b> ${L.repsU}</span>`
      : a.repsR === a.reps ? `<span><b>${a.reps}</b> ${L.repsU} ${L.eachSide}</span>`
      : `<span><b>${a.reps}/${a.repsR}</b> ${L.repsU}</span>`;
    if (type === 'reps') return n + reps;
    return n + reps + (a.weight > 0 ? `<span><b>${fmtNum(a.weight)}</b> ${a.unit}</span>` : '');   // no weight yet: nothing (filled in the first time)
  }
  return `<span class="setline">${sets.map(x => `<b>${setText(x, type)}</b>`).join(' · ')}${setsUnit(sets, type)}</span>`;
}

// History points are formatted by what they hold, so older points still read right after a type change.
function pointText(p) {
  if (p.t != null) return `${p.s}× ${fmtClock(p.t)}`;
  return `${p.s}×${p.r}${p.w > 0 ? ` · ${fmtNum(p.w)} ${p.u}` : ''}`;
}

function lastTimeLine(last, type) {
  const L = t();
  if (!last) return '';
  const when = fmtDay(new Date(last.date + 'T12:00:00'));
  const what = last.sets ? last.sets.map(x => setText(x, type)).join(' · ') + setsUnit(last.sets, type) : pointText(last.point);
  return `<p class="last"><b>${L.lastTime}</b> (${esc(when)}): <span class="num">${esc(what)}</span></p>`;
}

// "▶ Ver técnica": your own video, else the library's, both play in a sheet; otherwise a YouTube search (new tab).
// Next to it, "Añadir video" / "Cambiar video" opens the exercise form at the video link.
function techniqueButton(ex) {
  const L = t();
  const label = `<span aria-hidden="true">▶</span> ${L.watchTechnique}`;
  const edit = `<button class="tech-edit textbtn link" data-action="edit-video" data-id="${ex.id}">${ex.video ? L.videoChange : L.videoAdd}</button>`;
  if (techniqueVideo(ex)) return `<div class="tech-row"><button class="tech" data-action="video" data-id="${ex.id}">${label}</button>${edit}</div>`;
  const lib = libraryExercise(ex.exerciseId);
  const en = getLang() === 'en';
  const q = `${en && lib ? lib.en : ex.name} ${en ? 'proper form' : 'técnica'}`;
  return `<div class="tech-row"><a class="tech" href="${esc(searchUrl(q))}" target="_blank" rel="noopener">${label}</a>${edit}</div>`;
}

// Number for an input box: no thousands separator; decimal comma in Spanish (both are accepted when reading).
const inputNum = n => String(n).replace('.', getLang() === 'es' ? ',' : '.');

// A box in a set row. field = 'reps' | 'repsR' | 'weight' | 'min' | 'sec' (min + sec are saved together as seconds).
function setInput(ex, i, field, value, label) {
  const mode = field === 'weight' ? 'decimal' : 'numeric';
  return `<input class="set-in num" type="text" inputmode="${mode}" enterkeyhint="done" autocomplete="off" data-set="${field}" data-id="${ex.id}" data-i="${i}" value="${value}" aria-label="${label}">`;
}

// The open exercise: one row per set (drops indented under their set). The row's boxes depend on the exercise:
//   weight × reps  # [reps] × [weight] kg ✓ ×      per side: # [L] [R] [weight] ✓ ×
//   reps only      # [reps] reps ✓ ×               per side: # [L] [R] ✓ ×
//   time           # [min] : [sec] ✓ ×
// Inputs save when you leave them (change event, see main.js).
function setsPanel(state, r, ex, sets) {
  const L = t();
  const { type, perSide } = ex;
  const normals = sets.filter(x => x.kind !== 'drop').length;
  let n = 0;
  const rows = sets.map((x, i) => {
    const drop = x.kind === 'drop';
    if (!drop) n++;
    const name = drop ? L.dropOf(n) : L.setN(n);
    const right = x.repsR == null ? x.reps : x.repsR;
    let boxes;
    if (type === 'time') {
      boxes = `${setInput(ex, i, 'min', Math.floor(x.seconds / 60), `${name}: ${L.minutes}`)}<span class="set-x" aria-hidden="true">:</span>`
        + `${setInput(ex, i, 'sec', pad2(x.seconds % 60), `${name}: ${L.seconds}`)}<span></span>`;
    } else if (perSide) {
      boxes = setInput(ex, i, 'reps', x.reps, `${name}: ${L.repsU} ${L.left}`) + setInput(ex, i, 'repsR', right, `${name}: ${L.repsU} ${L.right}`)
        + (type === 'weight_reps' ? setInput(ex, i, 'weight', inputNum(x.weight), `${name}: ${L.weight} (${x.unit})`) : '');
    } else if (type === 'reps') {
      boxes = `${setInput(ex, i, 'reps', x.reps, `${name}: ${L.repsU}`)}<span class="set-u left">${L.repsU}</span>`;
    } else {
      boxes = `${setInput(ex, i, 'reps', x.reps, `${name}: ${L.repsU}`)}<span class="set-x" aria-hidden="true">×</span>`
        + `${setInput(ex, i, 'weight', inputNum(x.weight), `${name}: ${L.weight} (${x.unit})`)}<span class="set-u">${x.unit}</span>`;
    }
    const canDelete = drop || normals > 1;
    return `<li class="set${x.done ? ' done' : ''}${drop ? ' drop' : ''}">
      <span class="set-n num" aria-hidden="true">${drop ? '↓' : n}</span>
      ${boxes}
      <button class="set-check" data-action="set-tick" data-id="${ex.id}" data-i="${i}" aria-pressed="${!!x.done}" aria-label="${name}: ${x.done ? L.markUndone : L.markDone}">${ICONS.check}</button>
      ${canDelete ? `<button class="set-del" data-action="set-del" data-id="${ex.id}" data-i="${i}" aria-label="${L.removeSet}: ${name}">×</button>` : '<span></span>'}
    </li>`;
  }).join('');
  const unit = sets[0] ? sets[0].unit : ex.target.unit;
  const head = type === 'time' ? [L.minShort, '', L.secShort, '']
    : perSide ? [L.leftShort, L.rightShort, ...(type === 'weight_reps' ? [unit] : [])]
    : type === 'reps' ? [L.repsU, ''] : [L.repsU, '', L.weight, ''];
  const layout = type === 'time' ? 't-time' : perSide ? (type === 'reps' ? 't-side-reps' : 't-side') : `t-${type}`;
  const canDrop = type === 'weight_reps' && sets.length < 50;
  return `<div class="sets ${layout}" id="sets-${ex.id}">
    ${techniqueButton(ex)}
    ${lastTimeLine(lastTime(state, r, ex.id), type)}
    <div class="set-head" aria-hidden="true"><span>#</span>${head.map(h => `<span>${h}</span>`).join('')}<span></span><span></span></div>
    <ol class="setlist">${rows}</ol>
    ${sets.length < 50 ? `<div class="set-actions${canDrop ? ' two' : ''}">
      <button class="add-set" data-action="set-add" data-id="${ex.id}" aria-label="${L.addSet}">${ICONS.plus}<span>${canDrop ? L.addSetShort : L.addSet}</span></button>
      ${canDrop ? `<button class="add-set drop" data-action="set-drop" data-id="${ex.id}" aria-label="${L.addDropLong}"><span aria-hidden="true">↓</span><span>${L.addDrop}</span></button>` : ''}
    </div>` : ''}
  </div>`;
}
