// Points and badges on screen: the block on Progreso, a badge medal, the "all badges" list and the new-badge celebration.
import { t } from '../i18n/index.js';
import { esc, fmtDay } from '../utils/format.js';
import { ICONS } from '../ui/icons.js';
import { BADGES } from '../data/badges.js';
import { getWallet, points, badgeList, earnedCount } from '../state/rewards.js';

const FAMILY_ICON = { workouts: 'dumbbell', streak: 'flame', records: 'trophy', social: 'users' };

// A round medal. size: '' (row) | 'big' (celebration) | 'list'
export function medalHTML(b, size = '') {
  const icon = ICONS[FAMILY_ICON[b.family]] || ICONS.star;
  const label = /^[a-z]+\d+$/.test(b.id) && b.at > 1 ? `<em class="num">${b.at}</em>` : '';
  return `<span class="medal fam-${b.family}${b.earned ? '' : ' locked'}${size ? ' ' + size : ''}" aria-hidden="true">${icon}${label}</span>`;
}

export const badgeName = b => t().pts.names[b.id] || b.id;
export const badgeDesc = b => (t().pts.desc[b.counter] || (() => ''))(b.at);

// Progreso: the first badges (earned first, then the closest ones). Points live in the shared header.
export function rewardsBlock() {
  const P = t().pts, w = getWallet();
  if (w === undefined) return '';   // still loading (or not signed in)
  const list = badgeList().slice(0, 5);
  return `<section class="rewards">
    <div class="rw-head">
      <h2 class="rw-title">${esc(P.allTitle)}</h2>
      <button class="textbtn" data-action="badges">${P.seeAll}</button>
    </div>
    <ul class="rw-row">${list.map(b => `<li title="${esc(badgeName(b))}">${medalHTML(b)}<span>${esc(badgeName(b))}</span></li>`).join('')}</ul>
    ${!points() && !earnedCount() ? `<p class="hint">${P.empty}</p>` : ''}
  </section>`;
}

// The "Tus insignias" sheet.
export function allBadgesHTML() {
  const P = t().pts, list = badgeList();
  return `<h2>${P.allTitle}</h2>
    <p class="sub">${esc(P.earned(earnedCount(), BADGES.length))} · ${esc(P.points(points()))}</p>
    <ul class="badge-list">${list.map(b => `<li class="${b.earned ? '' : 'locked'}">${medalHTML(b, 'list')}
      <span class="bl-text"><b>${esc(badgeName(b))}</b><span>${esc(badgeDesc(b))}</span>
      ${b.earned ? `<small>${esc(P.earnedOn(fmtDay(new Date(b.earned))))}</small>`
        : `<span class="bl-bar"><i style="width:${Math.round(b.progress * 100)}%"></i></span><small class="num">${Math.min(b.count, b.at)}/${b.at}</small>`}
      </span></li>`).join('')}</ul>
    <details class="rw-how"><summary>${P.howTitle}</summary><p>${esc(P.how)}</p></details>`;
}

// The celebration for one or more new badges.
export function newBadgesHTML(ids) {
  const P = t().pts, list = ids.map(id => ({ ...BADGES.find(b => b.id === id), earned: 1 })).filter(b => b.id);
  return `<div class="badge-new">
    <h2>${list.length > 1 ? P.newBadges : P.newBadge}</h2>
    ${list.map(b => `<div class="bn-item">${medalHTML(b, 'big')}<b>${esc(badgeName(b))}</b><span>${esc(badgeDesc(b))}</span></div>`).join('')}
  </div>`;
}
