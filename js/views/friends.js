// Amigos tab: search + invite, requests to answer, cheers you got this week, your friends (with their week and
// streak), requests you sent. Copying routines and cheering happen on a friend's card (sheets/friend-card.js).
import { ICONS } from '../ui/icons.js';
import { t, routineName } from '../i18n/index.js';
import { ymdOf as ymdOfMs } from '../utils/dates.js';
import { esc } from '../utils/format.js';
import { pendingIncoming, pendingOutgoing, friendList, getSocial, recentCheers } from '../state/social.js';
import { tabBar } from './partials.js';
import { appHeader } from './home.js';
import { mascotHTML } from '../ui/mascot.js';
import { avatarHTML, personText, personName } from './people.js';
import { friendLine, miniDots, when } from './friend-week.js';
import { CHEER_ICONS } from '../ui/cheer-icons.js';

const SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 17a7 7 0 1 0 0 -14a7 7 0 0 0 0 14z"/><path d="M21 21l-6 -6"/></svg>';

// opts = same as the home screen (user, localMode) for the header.
export function friendsView(state, opts) {
  const L = t(), F = L.fr;
  let h = `${appHeader(state, opts)}<h1>${F.title}</h1><p class="sub">${F.sub}</p>`;
  if (opts.localMode || !opts.user) return `${h}<div class="empty"><h3>${F.needAccount}</h3><p>${F.needAccountBody}</p></div>${tabBar('friends')}`;

  h += `<button class="fr-search" data-action="fr-search">${SEARCH}<span>${F.searchPh}</span></button>
    <button class="textbtn fr-invite" data-action="fr-invite">${ICONS.plus}<span>${F.invite}</span></button>`;

  const incoming = pendingIncoming(), outgoing = pendingOutgoing(), friends = friendList();
  if (incoming.length) {
    h += `<div class="section-head"><h2>${F.requests} <span class="count num">${incoming.length}</span></h2></div>
      <ul class="list people">${incoming.map(r => {
        const p = { uid: r.from, username: r.fromUsername, displayName: r.fromName };
        return `<li class="person">${avatarHTML(p)}${personText(p)}
          <span class="pbtns"><button class="pbtn ok" data-action="fr-accept" data-uid="${esc(p.uid)}">${F.accept}</button>
          <button class="pbtn icon" data-action="fr-decline" data-uid="${esc(p.uid)}" aria-label="${esc(F.decline)}">${ICONS.close}</button></span></li>`;
      }).join('')}</ul>`;
  }

  // Cheers from the last 7 days (tap one to open that friend's card). opts.cheersSeenAt marks the new ones.
  const cheers = recentCheers();
  if (cheers.length) {
    h += `<div class="section-head"><h2>${F.cheersTitle}</h2></div>
      <ul class="list people cheers">${cheers.map(c => {
        const f = getSocial().friends[c.from] || { username: c.fromUsername, displayName: c.fromName };
        const isNew = c.createdAt > (opts.cheersSeenAt || 0);
        return `<li><button class="cheer-item person tap${isNew ? ' new' : ''}" data-action="fr-card" data-uid="${esc(c.from)}">
          <span class="cheer-ico" aria-hidden="true">${CHEER_ICONS[c.kind] || CHEER_ICONS.fire}</span>
          <span class="ptext"><b>${esc(personName({ ...f, uid: c.from }))}</b><span>${esc(F.cheerLine(F.cheerKinds[c.kind] || F.cheerKinds.fire, routineName({ name: c.workout })))}</span></span>
          <small>${esc(when(ymdOfMs(c.createdAt)))}</small></button></li>`;
      }).join('')}</ul>`;
  }

  h += `<div class="section-head"><h2>${F.yourFriends}${friends.length ? ` <span class="count num">${friends.length}</span>` : ''}</h2></div>`;
  if (!getSocial().ready) h += `<p class="hint">${F.loading}</p>`;
  else if (!friends.length) {
    h += `<div class="fr-empty">${mascotHTML({ mood: 'amused', crop: 'bust', size: '84px' })}<div><h3>${F.emptyTitle}</h3><p>${F.emptyBody}</p></div></div>`;
  } else {
    h += `<ul class="list people">${friends.map(f => {
      const line = friendLine(f.uid);
      return `<li><button class="person tap" data-action="fr-card" data-uid="${esc(f.uid)}">
      ${avatarHTML(f)}<span class="ptext"><b>${esc(personName(f))}</b><span>${line ? esc(line) : (f.displayName ? `@${esc(f.username)}` : '')}</span></span>
      ${miniDots(f.uid)}<span class="pchev" aria-hidden="true">${ICONS.back}</span></button></li>`;
    }).join('')}</ul>`;
  }

  if (outgoing.length) {
    h += `<div class="section-head"><h2>${F.sent}</h2></div>
      <ul class="list people">${outgoing.map(r => {
        const p = { uid: r.to, username: r.toUsername, displayName: r.toName };
        return `<li class="person">${avatarHTML(p)}${personText(p)}
          <span class="pbtns"><button class="pbtn" data-action="fr-cancel" data-uid="${esc(p.uid)}">${F.cancelReq}</button></span></li>`;
      }).join('')}</ul>`;
  }
  h += tabBar('friends');
  return h;
}
