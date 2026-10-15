// Loading screen shown while Firebase starts and the user's data loads.
import { ICONS } from '../ui/icons.js';
import { t } from '../i18n/index.js';

export const splashView = () =>
  `<div class="splash" role="status">${ICONS.star.replace('class="sticker-icon"', 'class="sticker-icon splash-star"')}<span>${t().loading}</span></div>`;
