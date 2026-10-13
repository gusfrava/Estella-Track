// "Ver técnica": plays an exercise's YouTube video in a sheet (Shorts in a tall vertical player). The player only loads now (on tap), in
// YouTube's privacy-enhanced mode, and lives outside the routine screen so re-drawing the list doesn't stop it.
import { openSheet, closeSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { embedUrl, watchUrl } from '../utils/youtube.js';

// video = { id, short } from services/library.techniqueVideo(). onChange = "Cambiar video" (opens the exercise form).
export function openVideoSheet(title, { id: videoId, short = false }, onChange = null) {
  const L = t();
  openSheet(`<h2>${esc(title)}</h2>
    <div class="video-frame${short ? ' vertical' : ''}">
      <iframe src="${embedUrl(videoId)}" title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>
    <p class="hint video-note">${L.videoNote} <a href="${watchUrl(videoId, short)}" target="_blank" rel="noopener">${L.openInYouTube}</a></p>
    <div class="actions">
      <button class="btn secondary" type="button" data-k="close">${L.close}</button>
      ${onChange ? `<button class="textbtn link" type="button" data-k="change">${L.videoChange}</button>` : ''}
    </div>`,
  s => {
    s.querySelector('[data-k=close]').onclick = () => closeSheet();
    const change = s.querySelector('[data-k=change]');
    if (change) change.onclick = onChange;
  });
}
