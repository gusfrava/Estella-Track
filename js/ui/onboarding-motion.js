// Presentation only: answer storage and screen navigation stay in the onboarding controller.
import { mascotHTML } from './mascot.js';
const SCENES = new Set(['stretch', 'legs', 'bench', 'welcome', 'cheer', 'strength', 'muscle', 'model', 'soccer', 'yoga', 'curls', 'clumsy', 'trainer', 'hack', 'onearm', 'thinking', 'dogwalk', 'calendar']);
const BASE = new URL('../../icons/onboarding-motion/', import.meta.url).href;
// Single-scene bottom art keeps its screen-entry clock across answer re-renders.
let bottomTimeline = null;

// One clock selects one frame per paint. Cancel it immediately when a render
// replaces this scene, including while its images are still decoding.
if (typeof customElements !== 'undefined' && !customElements.get('estella-onboarding-motion')) {
  customElements.define('estella-onboarding-motion', class extends HTMLElement {
    connectedCallback() {
      const generation = this.generation = (this.generation || 0) + 1;
      queueMicrotask(() => {
        const frames = [...this.querySelectorAll('.ob-motion-frame')];
        Promise.all(frames.map(frame => frame.decode())).then(() => {
          if (this.isConnected && this.generation === generation) {
            let started = performance.now();
            const bottom = this.classList.contains('ob-motion-bottom');
            if (bottom) {
              const scene = this.dataset.motion;
              if (!bottomTimeline || bottomTimeline.scene !== scene) bottomTimeline = { scene, started: performance.now() };
              const elapsed = Math.min(5000, Math.max(0, performance.now() - bottomTimeline.started));
              this.style.setProperty('--ob-motion-delay', `${-elapsed}ms`);
              started = bottomTimeline.started;
            }
            this.classList.add('is-ready'); this.dataset.motionStatus = 'ready';
            const duration = bottom ? 5000 : 4400;
            const cycle = this.dataset.motion === 'dogwalk' ? 1250 : bottom ? 2500 : 2200;
            const reduced = matchMedia('(prefers-reduced-motion: reduce)');
            const paint = now => {
              if (!this.isConnected || this.generation !== generation) return;
              // A frame timestamp can precede decode completion within the same
              // browser paint. Never select frame -1 during that first tick.
              const elapsed = Math.max(0, now - started);
              const index = reduced.matches || elapsed >= duration ? 0 : Math.floor((elapsed % cycle) / (cycle / 4));
              this.dataset.frame = String(index);
              if (!reduced.matches && elapsed < duration) this.frameRequest = requestAnimationFrame(paint);
            };
            paint(performance.now());
          }
        }).catch(() => { if (this.isConnected && this.generation === generation) this.dataset.motionStatus = 'fallback'; });
      });
    }
    disconnectedCallback() {
      this.generation = (this.generation || 0) + 1;
      cancelAnimationFrame(this.frameRequest);
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
