// Renders the app's feedback sounds into small WAV files (assets/sounds). Same moments and notes as the website's
// js/ui/feel.js (C major, one family), voiced as soft marimba/bell tones: a rounded fundamental, a quiet overtone
// that fades first, a gentle attack and a short airy echo, so nothing clicks or sounds harsh.
// Run: node scripts/make-sounds.cjs
const fs = require('node:fs');
const path = require('node:path');
const RATE = 44100, PEAK = 0.5;
const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568 };

// One mallet note. tone: 'marimba' (warm, 4th overtone) | 'bell' (brighter, 2.76× partial) | 'soft' (pure, for taps).
function note(freq, at = 0, len = 0.35, vol = 0.6, tone = 'marimba') {
  const partials = { marimba: [[1, 1, 1], [4, 0.18, 3.5]], bell: [[1, 1, 1], [2.76, 0.22, 2.5], [5.4, 0.06, 5]], soft: [[1, 1, 1]] }[tone];
  return { freq, at, len, vol, partials };
}
// A note that bends up a little as it starts (the "pop" of checks and selections).
const pop = (from, to, at, len, vol, tone) => ({ ...note(to, at, len, vol, tone), from });

function render(parts, level = 1) {
  const end = Math.max(...parts.map(p => p.at + p.len)) + 0.25;
  const dry = new Float32Array(Math.ceil(end * RATE));
  for (const p of parts) {
    const start = Math.floor(p.at * RATE), n = Math.ceil(p.len * RATE);
    const phases = p.partials.map(() => 0);
    for (let i = 0; i < n && start + i < dry.length; i++) {
      const t = i / RATE;
      const attack = Math.min(1, t / 0.006);                                   // 6 ms: soft, no click
      const bend = p.from ? p.from + (p.freq - p.from) * Math.min(1, t / 0.045) : p.freq;
      let s = 0;
      p.partials.forEach(([mult, amp, decayRate], k) => {
        phases[k] += 2 * Math.PI * bend * mult / RATE;
        s += Math.sin(phases[k]) * amp * Math.exp(-t * decayRate * (6 / p.len));
      });
      const release = Math.min(1, (p.len - t) / 0.03);                         // fade the very end to silence
      dry[start + i] += s * attack * release * p.vol;
    }
  }
  // Short, soft echo for a bit of space.
  const out = new Float32Array(dry.length);
  for (let i = 0; i < out.length; i++) {
    const e1 = i >= 3970 ? dry[i - 3970] * 0.16 : 0, e2 = i >= 7940 ? dry[i - 7940] * 0.06 : 0;
    out[i] = dry[i] + e1 + e2;
  }
  // Gentle low-pass to round off any edge, then normalize.
  let prev = 0; for (let i = 0; i < out.length; i++) { prev += (out[i] - prev) * 0.55; out[i] = prev; }
  const max = Math.max(...out.map(Math.abs)) || 1;
  return out.map(v => v / max * PEAK * level);
}

// How loud each moment is next to the others: taps barely there, the big moments fullest.
const LEVELS = { tap: 0.3, select: 0.55, check: 0.75, done: 0.85 };
const SOUNDS = {
  tap: [note(N.G5, 0, 0.09, 0.25, 'soft')],
  select: [pop(N.E5, N.G5, 0, 0.22, 0.5)],
  check: [pop(N.G5, N.C6, 0, 0.28, 0.6)],
  done: [note(N.E5, 0, 0.35, 0.5), note(N.G5, 0.08, 0.45, 0.55)],
  complete: [note(N.C5, 0, 0.4, 0.45), note(N.E5, 0.1, 0.4, 0.45), note(N.G5, 0.2, 0.45, 0.5), note(N.C6, 0.3, 0.9, 0.6, 'bell')],
  points: [note(N.A5, 0, 0.3, 0.45, 'bell'), note(N.E6, 0.08, 0.5, 0.45, 'bell')],
  badge: [N.C6, N.E6, N.G6, N.E6, N.G6].map((f, i) => note(f, i * 0.07, 0.6, 0.35, 'bell')),
  cheer: [pop(N.D5, N.A5, 0, 0.3, 0.5), pop(N.G5, N.E6, 0.09, 0.4, 0.5)],
  error: [note(392, 0, 0.3, 0.45), note(330, 0.12, 0.45, 0.45)],              // a soft falling third, not a buzzer
};

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24); head.writeUInt32LE(RATE * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

const dir = path.resolve(__dirname, '../assets/sounds');
fs.mkdirSync(dir, { recursive: true });
for (const [name, parts] of Object.entries(SOUNDS)) fs.writeFileSync(path.join(dir, `${name}.wav`), wav(render(parts, LEVELS[name] ?? 1)));
console.log(`Wrote ${Object.keys(SOUNDS).length} sounds to assets/sounds.`);
