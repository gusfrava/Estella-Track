// Benefit-led first visit. The illustration is sample UI, never real workout data.
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { brand, langToggle } from './partials.js';

export function openingView() {
  const O = t().opening;
  return `<section class="intro ob">
    <header class="top">${brand()}${langToggle()}</header>
    <div class="scene play" aria-hidden="true">
      <div class="halo"></div><span class="sample">${esc(O.sample)}</span>
      <span class="spark-traveler"><span class="spark-shape"></span></span>
      <div class="piece routine"><div class="smalllabel">${esc(O.routineLabel)}</div><strong>${esc(O.routineName)}</strong></div>
      <div class="piece logging"><div class="smalllabel">${esc(O.setLabel)}</div><div class="setrow"><strong>${esc(O.setName)}</strong><span class="tick">✓</span></div></div>
      <div class="piece weekly"><div class="smalllabel">${esc(O.weekLabel)}</div><div class="weekrow"><span class="day">✓</span><span class="day">✓</span><span class="day empty">3</span><span class="weektext">${esc(O.weekName)}</span></div></div>
    </div>
    <h1>${esc(O.titleRoutine)}<br>${esc(O.titleProgress)}</h1>
    <p class="intro-copy">${esc(O.body)}</p>
    <div class="intro-actions"><button class="btn" data-action="opening-start">${esc(O.start)}</button>
      <button class="textbtn" data-action="opening-signin">${esc(O.signin)}</button>
      <p class="intro-hint">${esc(O.local)}</p></div>
  </section>`;
}
