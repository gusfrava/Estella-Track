// Usage: node scripts/make-icons.cjs "$PWD" assets/store/icon-source.jpg <out-dir>
// Builds the app icon set from the teal sticker art: cut the flat teal background out (flood fill from the edges),
// then place the art on teal or transparent canvases at the sizes each platform needs.
const Jimp = require(process.argv[2] + '/node_modules/jimp-compact');
const [, , mobile, src, out] = process.argv;
(async () => {
  const im = await Jimp.read(src), W = im.bitmap.width, H = im.bitmap.height, d = im.bitmap.data;
  // Background teal = median of the four corners' neighbourhood.
  const px = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const samples = []; for (const [x, y] of [[8, 8], [W - 9, 8], [8, H - 9], [W - 9, H - 9]]) for (let k = 0; k < 20; k++) samples.push(px(x + (k % 5) * (x < W / 2 ? 2 : -2), y + Math.floor(k / 5) * (y < H / 2 ? 2 : -2)));
  const teal = [0, 1, 2].map(c => samples.map(s => s[c]).sort((a, b) => a - b)[samples.length >> 1]);
  const close = (x, y) => { const [r, g, b] = px(x, y); return Math.hypot(r - teal[0], g - teal[1], b - teal[2]) < 70; };
  const seen = new Uint8Array(W * H), stack = [];
  for (let x = 0; x < W; x++) stack.push([x, 0], [x, H - 1]);
  for (let y = 0; y < H; y++) stack.push([0, y], [W - 1, y]);
  while (stack.length) {
    const [x, y] = stack.pop(); if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const k = y * W + x; if (seen[k] || !close(x, y)) continue;
    seen[k] = 1; d[k * 4 + 3] = 0; stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  // Soften the cut: pixels touching the background become half transparent.
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const k = y * W + x; if (!seen[k] && (seen[k - 1] || seen[k + 1] || seen[k - W] || seen[k + W])) d[k * 4 + 3] = 140; }
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const art = im.clone().crop(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  const hex = '#' + teal.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const tealInt = Jimp.rgbaToInt(teal[0], teal[1], teal[2], 255);
  const place = async (size, fraction, bg, file) => {
    const canvas = new Jimp(size, size, bg ? tealInt : 0x00000000), a = art.clone();
    a.scaleToFit(Math.round(size * fraction), Math.round(size * fraction), Jimp.RESIZE_BICUBIC);
    canvas.composite(a, Math.round((size - a.bitmap.width) / 2), Math.round((size - a.bitmap.height) / 2));
    await canvas.writeAsync(`${out}/${file}`); return canvas;
  };
  await place(1024, 0.84, true, 'icon.png');                       // iOS / legacy: full square
  await place(512, 0.84, true, 'play-store-icon.png');             // Play listing (Play rounds the corners)
  await place(1024, 0.6, false, 'android-icon-foreground.png');    // adaptive: inside the 66% safe zone
  await place(1024, 1, false, 'splash-icon.png');
  const mono = await place(1024, 0.6, false, 'android-icon-monochrome.png');
  mono.scan(0, 0, 1024, 1024, (x, y, i) => { const a = mono.bitmap.data[i + 3]; mono.bitmap.data[i] = mono.bitmap.data[i + 1] = mono.bitmap.data[i + 2] = 255; mono.bitmap.data[i + 3] = a; });
  await mono.writeAsync(`${out}/android-icon-monochrome.png`);
  // Previews of how Android masks the adaptive icon (circle) and of the small launcher size.
  const fg = await Jimp.read(`${out}/android-icon-foreground.png`);
  const circle = new Jimp(1024, 1024, tealInt).composite(fg, 0, 0);
  circle.scan(0, 0, 1024, 1024, (x, y, i) => { if (Math.hypot(x - 512, y - 512) > 512) circle.bitmap.data[i + 3] = 0; });
  await circle.writeAsync(`${out}/preview-circle.png`);
  await circle.clone().resize(96, 96).writeAsync(`${out}/preview-96.png`);
  console.log(JSON.stringify({ teal: hex, bbox: [x0, y0, x1, y1] }));
})().catch(e => { console.error(e); process.exit(1); });
