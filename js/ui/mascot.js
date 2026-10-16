// Selected companion: Estella uses inline SVG; Diego uses the approved illustrated poses.
//
// mascotHTML({ mood, crop, size, hop, label })
//   mood  'amused' (default) | 'focused' | 'excited' | 'blink'
//   crop  'full' (whole body) | 'bust' (head and shoulders, for small spots)
//   size  CSS height, e.g. '56px'
//   hop   true = celebration bounce (runs twice)
//   label accessible text; without it the mascot is decorative (hidden from screen readers)
//
// "Alive" animations are pure CSS (css/mascot.css): blinking every few seconds and a slow breath.
// They stop for people who turn on "reduce motion" in their phone settings.
import * as estella from './characters/estella.js';

import { getState } from '../state/store.js';
export const selectedCharacter = () => getState().profile?.onboarding?.character === 'diego' ? 'diego' : 'estella';
export const diegoImage = (scene = 'welcome', frame = 0) => new URL('../../icons/diego-motion/' + scene + '-' + frame + '.webp', import.meta.url).href;

const CHARACTERS = { estella };
const MOODS = ['amused', 'focused', 'excited', 'blink'];
const CROPS = {
  full: c => c.VIEWBOX,
  bust: c => c.BUST,                                                       // head + shoulders, square
};

export function mascotHTML({ character = selectedCharacter(), mood = 'amused', crop = 'full', size = '120px', hop = false, label = '' } = {}) {
  if (character === 'diego') {
    const scene = crop === 'bust' ? 'portrait' : mood === 'excited' ? 'complete' : 'welcome';
    return `<span class="mascot diego-mascot crop-${crop === 'bust' ? 'bust' : 'full'}" data-scene="${scene}" style="height:${size}" ${label ? 'role="img" aria-label="Diego"' : 'aria-hidden="true"'}>${[0,1,2,3].map(i => `<img src="${diegoImage(scene,i)}" alt="" width="640" height="640" style="--pose:${i}" draggable="false">`).join('')}</span>`;
  }
  const c = CHARACTERS[character] || estella;
  const m = MOODS.includes(mood) ? mood : 'amused';
  const v = (CROPS[crop] || CROPS.full)(c);
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="mascot mood-${m}${m === 'blink' ? '' : ' blinks'}${hop ? ' hop' : ''} crop-${crop}" style="height:${size}"
    viewBox="${v.x} ${v.y} ${v.w} ${v.h}" xmlns="http://www.w3.org/2000/svg" fill="none" ${a11y}><g class="m-body">${c.BODY}</g></svg>`;
}

// The same drawing as a standalone SVG file (for pictures drawn on a canvas, e.g. the shareable weekly recap):
// page CSS doesn't apply there, so the face to show is picked with an inline style. Returns { svg, w, h }.
export function mascotSVG({ character = selectedCharacter(), mood = 'amused', crop = 'full' } = {}) {
  if (character === 'diego') return { imageURL: diegoImage(crop === 'bust' ? 'portrait' : mood === 'excited' ? 'complete' : 'welcome'), w: 640, h: 640 };
  const c = CHARACTERS[character] || estella;
  const m = MOODS.includes(mood) ? mood : 'amused';
  const v = (CROPS[crop] || CROPS.full)(c);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${v.x} ${v.y} ${v.w} ${v.h}" width="${v.w}" height="${v.h}" fill="none">`
    + `<style>.expr{display:none}.expr-${m}{display:inline}</style><g class="m-body">${c.BODY}</g></svg>`;
  return { svg, w: v.w, h: v.h };
}
