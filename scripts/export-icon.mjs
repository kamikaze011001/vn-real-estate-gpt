import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync('site/assets/icon.svg', 'utf8');
mkdirSync('artifacts/icons', { recursive: true });
for (const size of [32, 48, 128, 512]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  const output = size === 512 ? 'site/assets/icon-512.png' : `artifacts/icons/icon-${size}.png`;
  writeFileSync(output, png);
  console.log(`${output}: ${size}×${size}`);
}
