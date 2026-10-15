// Keep external SVGs isolated: their filter/title IDs cannot collide with each
// other. The SVG wrapper retains the sizing used by existing icon containers.
const BASE = new URL('../../icons/stickers/', import.meta.url).href;
export function stickerIcon(path, className = '') {
  return `<svg class="sticker-icon${className ? ' ' + className : ''}" viewBox="0 0 128 128" aria-hidden="true" focusable="false"><image href="${BASE}${path}.svg" width="128" height="128"/></svg>`;
}

const MUSCLES = {
  pecho: 'chest', espalda: 'back', hombros: 'shoulders', brazos: 'arms',
  piernas: 'legs', gluteos: 'glutes-plum', core: 'core', cardio: 'cardio', movilidad: 'mobility',
};
export const muscleIcon = group => MUSCLES[group] ? stickerIcon(`muscles/${MUSCLES[group]}`) : '';
