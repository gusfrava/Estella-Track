// Keep badge artwork vector-only: WebKit rasterizes SVG morphology filters at
// low resolution when the image is displayed at mobile badge sizes.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

for (const variant of ['static', 'animated']) {
  const directory = path.join(root, 'icons/badges', variant);
  for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.svg'))) {
    const file = path.join(directory, name);
    let svg = fs.readFileSync(file, 'utf8');
    if (!svg.includes('<filter')) continue;
    // The rim and number plaque define the sticker silhouette. Draw their
    // outline and offset shadow as ordinary paths, behind the original art.
    const rim = svg.match(/<g id="[^"]+-base">(<(?:circle|path)\b[^>]*\/>)/)?.[1];
    if (!rim) throw new Error('Missing badge rim: ' + name);
    const silhouette = rim.replace(/ fill="[^"]*"/, '')
      + '<rect x="43" y="87" width="42" height="24" rx="9"/>';
    const border = `<g stroke-width="9"><g transform="translate(2 4)" fill="#2B1B12" stroke="#2B1B12" opacity=".25">${silhouette}</g><g fill="#FFF1E1" stroke="#FFF1E1">${silhouette}</g></g>`;
    svg = svg.replace(/<filter\b[\s\S]*?<\/filter>/g, '')
      .replace(/ filter="url\(#[^)]+\)"/g, '')
      .replace(/(<g id="[^"]+-base">)/, border + '$1');
    // One small face previously occupied only a fraction of the medal and sat
    // off-center. Fill the available center so its expression is legible.
    if (name === 'f1.svg') {
      svg = svg.replace('translate(25 23) scale(.60)', 'translate(-2 -25) scale(1.5)');
    }
    fs.writeFileSync(file, svg);
  }
}
