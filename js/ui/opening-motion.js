// Reuse the scene across unrelated redraws and language changes so its five-second
// entrance never restarts. Resize the orbit without starting another animation.
import { openingView } from '../views/opening.js';

let observer;
export function stopOpeningMotion() { observer?.disconnect(); observer = null; }

export function renderOpening(root) {
  const template = document.createElement('template');
  template.innerHTML = openingView();
  const next = template.content.firstElementChild;
  const current = root.querySelector('.intro');
  if (current) {
    const before = current.querySelectorAll('.scene .sample,.scene .smalllabel,.scene strong,.scene .weektext');
    const after = next.querySelectorAll('.scene .sample,.scene .smalllabel,.scene strong,.scene .weektext');
    before.forEach((node, i) => { node.textContent = after[i].textContent; });
    for (const selector of ['.top', 'h1', '.intro-copy', '.intro-actions']) current.querySelector(selector).replaceWith(next.querySelector(selector));
    return;
  }
  stopOpeningMotion();
  root.replaceChildren(template.content);
  const scene = root.querySelector('.scene');
  const resize = () => {
    const w = scene.clientWidth;
    if (!w) return;
    const gap = Math.max(15, scene.querySelector('.logging').offsetLeft / 2);
    scene.style.setProperty('--spark-path', `path("M ${w*.58} 20 C ${w*.82} 8, ${w-15} 42, ${w-12} 96 C ${w+6} 140, ${w+5} 196, ${w*.8} 224 C ${w*.57} 247, ${gap} 227, ${gap} 187 C ${gap-4} 173, ${gap} 166, ${gap} 155")`);
  };
  resize();
  observer = new ResizeObserver(resize);
  observer.observe(scene);
}
