// "Ver técnica": plays an exercise's YouTube video in a sheet. The player only loads now (on tap), in
// YouTube's privacy-enhanced mode, and lives outside the routine screen so re-drawing the list doesn't stop it.
import { openSheet, closeSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { embedUrl, watchUrl } from '../utils/youtube.js';

export function openVideoSheet(title, videoId) {
  const L = t();
  openSheet(`<h2>${esc(title)}</h2>
    <div class="video-frame">
      <iframe src="${embedUrl(videoId)}" title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>
    <p class="hint video-note">${L.videoNote} <a href="${watchUrl(videoId)}" target="_blank" rel="noopener">${L.openInYouTube}</a></p>
    <div class="actions"><button class="btn secondary" type="button" data-k="close">${L.close}</button></div>`,
  s => { s.querySelector('[data-k=close]').onclick = () => closeSheet(); });
}
