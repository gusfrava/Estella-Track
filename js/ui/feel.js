// How the app feels: vibration and small sounds, one place for all of it.
//
// feel(kind) plays the vibration and sound for a moment in the app:
//   'tap'      any button (vibration only, very light)
//   'select'   picking an answer / an exercise
//   'check'    a set checked
//   'done'     an exercise finished, exercises added
//   'complete' a whole routine finished
//   'points'   points arrived
//   'badge'    a new badge (the "Reclamar" sparkle later)
//   'cheer'    a cheer sent or received
//   'error'    something didn't work
//
// Sounds are made on the fly with the Web Audio API (no audio files to download): short, soft, rounded tones in
// the same key so they sound like one family. The "Sonidos" and "Vibración" switches live in the account menu
// (saved on this phone). iPhone browsers can't vibrate; that arrives with the App Store version.

const KEY = 'estellatrack.feel';
const defaults = { sound: true, haptics: true };
let prefs = load();

function load() {
  try { return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch (e) { return { ...defaults }; }
}
export const feelPrefs = () => ({ ...prefs });
export function setFeelPref(name, on) {
  prefs = { ...prefs, [name]: !!on };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* private mode: lasts until reload */ }
}
export const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

// ---------- vibration ----------
const PATTERNS = {
  tap: 6, select: 10, check: 14, done: [14, 50, 22], complete: [20, 60, 20, 60, 40],
  points: [10, 40, 10], badge: [16, 50, 16, 50, 30], cheer: [10, 40, 16], error: [40, 60, 40],
};
function vibrate(kind) {
  if (!prefs.haptics || !canVibrate()) return;
  try { navigator.vibrate(PATTERNS[kind] || 8); } catch (e) { /* not allowed right now */ }
}

// ---------- sound ----------
let ctx = null, master = null;
function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  return ctx;
}
// The browser only lets sound start after the person touches the page: wake the audio on the first touch.
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => {
  const c = prefs.sound && audio();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}, { capture: true, passive: true }));

// One soft note: frequency (Hz), when (s from now), length (s), volume (0–1), waveform.
function note(freq, at = 0, len = 0.12, vol = 0.6, type = 'sine') {
  const c = audio(); if (!c) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);          // quick, soft attack
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);         // round decay, no click
  osc.connect(g); g.connect(master);
  osc.start(t0); osc.stop(t0 + len + 0.02);
}
// A tiny upward slide (for "pop" sounds).
function slide(from, to, at = 0, len = 0.09, vol = 0.5) {
  const c = audio(); if (!c) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(to, t0 + len);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len + 0.04);
  osc.connect(g); g.connect(master);
  osc.start(t0); osc.stop(t0 + len + 0.06);
}

// Notes of C major (one family of sounds).
const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568 };
const SOUNDS = {
  select: () => slide(N.E5, N.G5, 0, 0.06, 0.35),
  check: () => slide(N.G5, N.C6, 0, 0.08, 0.5),
  done: () => { note(N.E5, 0, 0.14, 0.45); note(N.G5, 0.07, 0.18, 0.45); },
  complete: () => { note(N.C5, 0, 0.16, 0.45); note(N.E5, 0.09, 0.16, 0.45); note(N.G5, 0.18, 0.16, 0.45); note(N.C6, 0.27, 0.34, 0.5); },
  points: () => { note(N.A5, 0, 0.08, 0.35, 'triangle'); note(N.E6, 0.06, 0.14, 0.35, 'triangle'); },
  badge: () => [N.C6, N.E6, N.G6, N.E6, N.G6].forEach((f, i) => note(f, i * 0.06, 0.22, 0.28, 'triangle')),   // sparkle
  cheer: () => { slide(N.D5, N.A5, 0, 0.07, 0.4); slide(N.G5, N.E6, 0.08, 0.08, 0.4); },
  error: () => { note(330, 0, 0.12, 0.35, 'triangle'); note(262, 0.1, 0.18, 0.35, 'triangle'); },
};
function play(kind) {
  if (!prefs.sound || !SOUNDS[kind]) return;
  try { if (audio()) SOUNDS[kind](); } catch (e) { /* audio not available */ }
}

export function feel(kind) {
  vibrate(kind);
  play(kind);
}
