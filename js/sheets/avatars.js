import { openSheet, onSheetClose } from '../ui/sheet.js';
import { getLang } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { AVATARS, avatarPath } from '../data/avatars.js';
import { getWallet, onRewardsChange } from '../state/rewards.js';
import { chooseAvatar } from '../services/firebase.js';

export const avatarLabels = () => getLang() === 'es' ? {
  title: 'Tu avatar', intro: 'Elige cómo apareces en tu cuenta.', release: 'Colección de lanzamiento',
  halloween: 'Especial Halloween', free: 'Gratis', owned: 'Desbloqueado', selected: 'Seleccionado',
  initial: 'Usar mi inicial', points: 'puntos', buy: 'Desbloquear por 100 puntos', cancel: 'Cancelar',
  confirm: 'Este avatar será tuyo para siempre. Se descontarán 100 puntos de tu saldo.',
  missing: n => `Te faltan ${n} puntos`, loading: 'Cargando tus puntos…', saving: 'Guardando…',
  offline: 'Conéctate a internet para cambiar tu avatar.', error: 'No se pudo guardar. Inténtalo de nuevo.',
  balance: 'Tu saldo', success: 'Avatar guardado.',
} : {
  title: 'Your avatar', intro: 'Choose how you appear on your account.', release: 'Launch collection',
  halloween: 'Halloween special', free: 'Free', owned: 'Unlocked', selected: 'Selected',
  initial: 'Use my initial', points: 'points', buy: 'Unlock for 100 points', cancel: 'Cancel',
  confirm: 'This avatar will be yours permanently. 100 points will be deducted from your balance.',
  missing: n => `You need ${n} more points`, loading: 'Loading your points…', saving: 'Saving…',
  offline: 'Connect to the internet to change your avatar.', error: 'Could not save. Please try again.',
  balance: 'Your balance', success: 'Avatar saved.',
};

let unsubscribe, currentSheet;
onSheetClose(closed => {
  if (closed !== currentSheet) return;
  unsubscribe?.(); unsubscribe = null; currentSheet = null;
});

export function openAvatarsSheet() {
  unsubscribe?.();
  const L = avatarLabels();
  let busy = false, confirm = null, message = '', active = true;
  let stop;
  const render = (first = false) => {
    const wallet = getWallet(), loaded = wallet !== undefined;
    const balance = Number(wallet?.points) || 0;
    const selected = wallet?.avatarId || 'initial';
    // Keep image nodes, focus and scroll position throughout save/snapshot updates.
    if (!first) {
      if (!active || !currentSheet?.isConnected) return;
      currentSheet.querySelector('[data-avatar-balance]').textContent = loaded ? `${L.balance}: ${balance} ${L.points}` : L.loading;
      currentSheet.querySelector('[data-avatar-status]').textContent = busy ? L.saving : message;
      for (const a of AVATARS) {
        const button = currentSheet.querySelector(`[data-avatar="${a.id}"]`);
        const locked = a.price > 0 && !wallet?.avatars?.[a.id];
        button.disabled = busy || !loaded || (locked && balance < a.price);
        button.classList.toggle('is-locked', locked);
        button.setAttribute('aria-pressed', String(selected === a.id));
        button.querySelector('[data-avatar-label]').textContent = selected === a.id ? L.selected : locked ? `🔒 ${a.price} ${L.points}` : a.price ? L.owned : L.free;
        button.querySelector('small').textContent = locked && loaded && balance < a.price ? L.missing(a.price - balance) : '';
      }
      currentSheet.querySelector('[data-initial]').disabled = busy || !loaded;
      const host = currentSheet.querySelector('[data-avatar-confirm]');
      if (host.dataset.avatarConfirm !== (confirm || '')) {
        host.dataset.avatarConfirm = confirm || '';
        host.innerHTML = confirm ? `<div class="avatar-confirm"><img src="${avatarPath(confirm)}" width="112" height="112" alt=""><p>${L.confirm}</p>
          <button class="btn" data-buy>${L.buy}</button><button class="textbtn" data-cancel>${L.cancel}</button></div>` : '';
        if (confirm) {
          host.querySelector('[data-buy]').onclick = () => save(confirm, true);
          host.querySelector('[data-cancel]').onclick = () => { confirm = null; render(); };
        }
      }
      host.querySelectorAll('button').forEach(button => { button.disabled = busy; });
      return;
    }
    const group = premium => AVATARS.filter(a => !!a.price === premium).map(a => {
      const locked = a.price > 0 && !wallet?.avatars?.[a.id];
      const disabled = busy || !loaded || (locked && balance < a.price);
      const status = selected === a.id ? L.selected : locked ? `🔒 ${a.price} ${L.points}` : a.price ? L.owned : L.free;
      return `<button class="avatar-choice ${locked ? 'is-locked' : ''}" data-avatar="${a.id}" aria-pressed="${selected === a.id}" ${disabled ? 'disabled' : ''}>
        <img src="${avatarPath(a.id)}" alt="" width="128" height="128"><b>${a.name}</b><span data-avatar-label>${status}</span>
        <small>${locked && loaded && balance < a.price ? L.missing(a.price - balance) : ''}</small></button>`;
    }).join('');
    const html = `<h2>${L.title}</h2><p>${L.intro}</p>
      <p class="avatar-balance" data-avatar-balance>${loaded ? `${L.balance}: ${balance} ${L.points}` : L.loading}</p>
      <div class="avatar-status" data-avatar-status role="status" aria-live="polite">${esc(busy ? L.saving : message)}</div>
      <div data-avatar-confirm=""></div>
      <h3>${L.release}</h3><div class="avatar-grid">${group(false)}</div>
      <h3>${L.halloween}</h3><div class="avatar-grid">${group(true)}</div>
      <button class="btn secondary" data-initial ${busy || !loaded ? 'disabled' : ''}>${L.initial}</button>`;
    currentSheet = openSheet(html, sheet => {
      sheet.querySelectorAll('[data-avatar]').forEach(button => { button.onclick = () => {
        const id = button.dataset.avatar, avatar = AVATARS.find(a => a.id === id);
        if (avatar.price && !getWallet()?.avatars?.[id]) { confirm = id; message = ''; render(); }
        else save(id, false);
      }; });
      sheet.querySelector('[data-initial]').onclick = () => save('initial', false);
      const buy = sheet.querySelector('[data-buy]');
      if (buy) buy.onclick = () => save(confirm, true);
      const cancel = sheet.querySelector('[data-cancel]');
      if (cancel) cancel.onclick = () => { confirm = null; render(); };
    });
  };
  const save = async (id, purchase) => {
    if (busy) return;
    if (!purchase && (getWallet()?.avatarId || 'initial') === id) return;
    if (!navigator.onLine) { message = L.offline; render(); return; }
    busy = true; message = ''; render();
    try { await chooseAvatar(id, purchase); confirm = null; message = L.success; }
    catch (err) { message = err.code === 'functions/failed-precondition' ? L.missing(Math.max(0, 100 - (getWallet()?.points || 0))) : L.error; }
    finally { busy = false; if (active) render(); }
  };
  render(true);
  stop = onRewardsChange(() => { if (active) render(); });
  unsubscribe = () => { active = false; stop(); };
}
