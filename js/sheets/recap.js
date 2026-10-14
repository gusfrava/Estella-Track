// The weekly recap sheet, with "Compartir" (a story-size picture: services/recap-image.js).
import { openSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { toast } from '../ui/toast.js';
import { ICONS } from '../ui/icons.js';
import { recapHTML } from '../views/recap.js';
import { recapImage } from '../services/recap-image.js';
import { loadLibrary } from '../services/library.js';
import { logger } from '../utils/log.js';

const log = logger('recap');

export async function openRecap(r) {
  await loadLibrary().catch(() => null);   // exercise names in the records list
  const R = t().rc;
  openSheet(`${recapHTML(r)}
    <div class="actions"><button class="btn" data-k="share">${ICONS.share}<span>${R.share}</span></button></div>`,
  s => {
    const btn = s.querySelector('[data-k=share]');
    btn.addEventListener('click', () => share(r, btn));
  });
}

// Phones: the share menu with the picture (Instagram, WhatsApp, Save image…). Elsewhere: download it.
async function share(r, btn) {
  const R = t().rc;
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span>${esc(R.preparing)}</span>`;
  try {
    const blob = await recapImage(r);
    const file = new File([blob], `estella-${r.key}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: R.shareText }); }
      catch (err) { if (!err || err.name !== 'AbortError') throw err; }
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(`${ICONS.check}<span><b>${esc(R.downloaded)}</b></span>`);
    }
  } catch (err) {
    log.warn('share failed', err);
    toast(`<span><b>${esc(R.shareFailed)}</b></span>`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = label;
  }
}
