// Renders the website's feedback sounds (js/ui/feel.js, made live with Web Audio) into small WAV files for the
// phone: the same notes, envelopes and volumes, so both apps sound alike. Run: node scripts/make-sounds.cjs
const fs = require('node:fs');
const path = require('node:path');
const RATE = 44100, MASTER = 0.22;
const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568 };

// Exponential ramp between two values over [t0, t1], like AudioParam.exponentialRampToValueAtTime.
const expRamp = (a, b, t0, t1, t) => a * Math.pow(b / a, Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
const wave = (type, phase) => type === 'sine' ? Math.sin(phase) : (2 / Math.PI) * Math.asin(Math.sin(phase));   // triangle

function render(parts) {
  const end = Math.max(...parts.map(p => p.at + p.len + 0.08));
  const out = new Float32Array(Math.ceil(end * RATE));
  for (const p of parts) {
    let phase = 0;
    const start = Math.floor(p.at * RATE), stop = Math.ceil((p.at + p.len + 0.06) * RATE);
    for (let i = start; i < stop && i < out.length; i++) {
      const t = i / RATE - p.at;
      const freq = p.to ? expRamp(p.from, p.to, 0, p.slideLen, t) : p.from;
      phase += 2 * Math.PI * freq / RATE;
      const gain = t < p.attack ? expRamp(0.0001, p.vol, 0, p.attack, t) : expRamp(p.vol, 0.0001, p.attack, p.release, t);
      out[i] += wave(p.type, phase) * gain * MASTER;
    }
  }
  return out;
}
const note = (freq, at = 0, len = 0.12, vol = 0.6, type = 'sine') => ({ from: freq, at, len, vol, type, attack: 0.012, release: len });
const slide = (from, to, at = 0, len = 0.09, vol = 0.5) => ({ from, to, slideLen: len, at, len: len + 0.04, vol, type: 'triangle', attack: 0.01, release: len + 0.04 });

const SOUNDS = {
  select: [slide(N.E5, N.G5, 0, 0.06, 0.35)],
  check: [slide(N.G5, N.C6, 0, 0.08, 0.5)],
  done: [note(N.E5, 0, 0.14, 0.45), note(N.G5, 0.07, 0.18, 0.45)],
  complete: [note(N.C5, 0, 0.16, 0.45), note(N.E5, 0.09, 0.16, 0.45), note(N.G5, 0.18, 0.16, 0.45), note(N.C6, 0.27, 0.34, 0.5)],
  points: [note(N.A5, 0, 0.08, 0.35, 'triangle'), note(N.E6, 0.06, 0.14, 0.35, 'triangle')],
  badge: [N.C6, N.E6, N.G6, N.E6, N.G6].map((f, i) => note(f, i * 0.06, 0.22, 0.28, 'triangle')),
  cheer: [slide(N.D5, N.A5, 0, 0.07, 0.4), slide(N.G5, N.E6, 0.08, 0.08, 0.4)],
  error: [note(330, 0, 0.12, 0.35, 'triangle'), note(262, 0.1, 0.18, 0.35, 'triangle')],
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
for (const [name, parts] of Object.entries(SOUNDS)) fs.writeFileSync(path.join(dir, `${name}.wav`), wav(render(parts)));
console.log(`Wrote ${Object.keys(SOUNDS).length} sounds to assets/sounds.`);
