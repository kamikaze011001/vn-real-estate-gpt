import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const output = resolve('.vercel/output');
const landing = readFileSync(resolve(output, 'static/index.html'), 'utf8');
assert.ok(landing.includes('id="cach-dung"'), 'Vercel static root must be the landing page, not the embedded widget');
assert.ok(existsSync(resolve(output, 'static/assets/icon-512.png')), 'public PNG icon must be in static output');
const fn = resolve(output, 'functions/api/index.func');
const config = JSON.parse(readFileSync(resolve(fn, '.vc-config.json'), 'utf8'));
for (const file of ['dist/index.html', 'dist-research/index.html']) {
  // Native CLI builds can retain source-file mappings until prebuilt upload;
  // other builders materialize the file directly in the function directory.
  const mapped = config.filePathMap?.[file];
  assert.ok(existsSync(resolve(fn, file)) || (mapped && existsSync(resolve(mapped))), `Missing embedded resource: ${file}`);
}
console.log('Vercel artifact verified: landing root, public icon and both embedded resources.');
