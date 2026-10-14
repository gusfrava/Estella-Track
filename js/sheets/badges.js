// "Tus insignias" (all badges) and the celebration when new ones arrive.
import { openSheet, closeSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { allBadgesHTML, newBadgesHTML } from '../views/badges.js';
import { sparkle } from '../ui/motion.js';
import { feel } from '../ui/feel.js';

export function openBadges() {
  openSheet(allBadgesHTML());
}

export function celebrateBadges(ids) {
  if (!ids.length) return;
  openSheet(`${newBadgesHTML(ids)}<div class="actions"><button class="btn" data-k="ok">${t().pts.nice}</button></div>`,
    s => {
      s.querySelector('[data-k=ok]').onclick = () => closeSheet();
      // once the sheet has slid up: small stars twinkle around each new badge
      setTimeout(() => s.querySelectorAll('.bn-item .medal').forEach((m, i) => setTimeout(() => sparkle(m), i * 220)), 320);
    });
  feel('badge');
}
