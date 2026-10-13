// A short message that slides in at the top and goes away by itself (e.g. "¡Nuevo récord!").
// Only one at a time; a new one replaces the old.
let current = null;

export function toast(html, ms = 3200) {
  if (current) current.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = html;
  document.body.appendChild(el);
  current = el;
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => { el.remove(); if (current === el) current = null; }, 300);
  }, ms);
}
