// Presentation only: answer storage and screen navigation stay in the onboarding controller.
import { mascotHTML } from './mascot.js';
const SCENES = new Set(['stretch', 'legs', 'bench', 'welcome', 'cheer', 'strength', 'muscle', 'model', 'soccer', 'yoga', 'curls', 'clumsy', 'trainer', 'hack', 'onearm', 'thinking', 'dogwalk', 'calendar']);
const BASE = new URL('../../icons/onboarding-motion/', import.meta.url).href;
// Single-scene bottom art keeps its screen-entry clock across answer re-renders.
let bottomTimeline = null;

// Start the short CSS sequence only once every frame is decoded. A slow or missing
// image leaves the existing mascot visible; removed screens need no timer cleanup.
if (typeof customElements !== 'undefined' && !customElements.get('estella-onboarding-motion')) {
  customElements.define('estella-onboarding-motion', class extends HTMLElement {
    connectedCallback() {
      queueMicrotask(() => {
        const frames = [...this.querySelectorAll('.ob-motion-frame')];
        Promise.all(frames.map(frame => frame.decode())).then(() => {
          if (this.isConnected) {
            if (this.classList.contains('ob-motion-bottom')) {
              const scene = this.dataset.motion;
              if (!bottomTimeline || bottomTimeline.scene !== scene) bottomTimeline = { scene, started: performance.now() };
              const elapsed = Math.min(5000, Math.max(0, performance.now() - bottomTimeline.started));
              this.style.setProperty('--ob-motion-delay', `${-elapsed}ms`);
            }
            this.classList.add('is-ready'); this.dataset.motionStatus = 'ready';
          }
        }).catch(() => { if (this.isConnected) this.dataset.motionStatus = 'fallback'; });
      });
    }
    disconnectedCallback() {
      if (!this.classList.contains('ob-motion-bottom')) return;
      const scene = this.dataset.motion;
      queueMicrotask(() => {
        const current = document.querySelector('.ob-motion-bottom');
        if (bottomTimeline?.scene === scene && current?.dataset.motion !== scene) bottomTimeline = null;
      });
    }
  });
}

export function onboardingMotionHTML(scene = 'welcome', { compact = false, card = false, bottom = false } = {}) {
  const name = SCENES.has(scene) ? scene : 'stretch';
  return `<estella-onboarding-motion class="ob-motion${compact ? ' ob-motion-compact' : ''}${card ? ' ob-motion-card' : ''}${bottom ? ' ob-motion-bottom' : ''}" data-motion="${name}" aria-hidden="true">
    <span class="ob-motion-fallback">${mascotHTML({ size: '100%' })}</span>
    <span class="ob-motion-star ob-motion-star-a">✦</span>
    <span class="ob-motion-star ob-motion-star-b">✧</span>
    <div class="ob-motion-frames">${[0, 1, 2, 3].map(i =>
      `<img class="ob-motion-frame" src="${BASE}${name}-${i}.webp" alt="" width="720" height="640" decoding="async" draggable="false">`).join('')}</div>
  </estella-onboarding-motion>`;
}

export const focusMotion = focus => ({ legs: 'legs', upper: 'bench', arms: 'curls' }[focus] || 'stretch');
export const goalMotion = goal => ({ strength: 'strength', muscle: 'muscle', fat: 'model', athletic: 'soccer', health: 'yoga' }[goal] || 'welcome');
export const experienceMotion = experience => ({ never: 'clumsy', beginner: 'trainer', intermediate: 'hack', advanced: 'onearm' }[experience] || 'welcome');
