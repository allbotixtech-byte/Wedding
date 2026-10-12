// Paints the illustrated backgrounds and decorative sprites with tools/paint/*.js (run inside a headless
// browser canvas) and saves them as WebP files in assets/backgrounds/{hd,md} and assets/effects.
//
//   node tools/paint-backgrounds.mjs                 -> paint everything
//   node tools/paint-backgrounds.mjs garden stage    -> only these plates
//   node tools/paint-backgrounds.mjs --preview=DIR garden   -> quick flattened JPEG previews into DIR
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findBrowser } from './browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; }
catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
  console.error(`
The painter is not installed yet (this is needed once).

    In the reception-invitation folder run:   npm install
    or, from the Reception folder above it:    npm run setup
`);
  process.exit(1);
}
const args = process.argv.slice(2);
const previewDir = (args.find((a) => a.startsWith('--preview=')) || '').split('=')[1];
const previewSize = +((args.find((a) => a.startsWith('--size=')) || '').split('=')[1] || 1100);
const onlyLayers = (args.find((a) => a.startsWith('--layers=')) || '').split('=')[1];
const bg = (args.find((a) => a.startsWith('--bg=')) || '').split('=')[1];
let names = args.filter((a) => !a.startsWith('--'));

const browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true, args: ['--allow-file-access-from-files'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(pathToFileURL(path.join(root, 'tools/paint/index.html')).href);
  if (!names.length) names = await page.evaluate(() => window.PAINT.names().filter((n) => n !== 'test'));
  const save = (file, dataUrl) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64')); return fs.statSync(file).size; };
  for (const name of names) {
    const t0 = Date.now();
    if (previewDir) {
      const res = await page.evaluate((n, o) => window.PAINT.run(n, o), name, { preview: previewSize, only: onlyLayers ? onlyLayers.split(',') : null, bg });
      const f = path.join(previewDir, `${name}${onlyLayers ? '-' + onlyLayers.replace(/,/g, '+') : ''}.jpg`);
      save(f, res.preview);
      console.log(`preview ${f} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      continue;
    }
    const res = await page.evaluate((n) => window.PAINT.run(n), name);
    for (const [layerName, e] of Object.entries(res.layers)) {
      const isSprite = name === 'sprites';
      const base = isSprite ? layerName : `${name}-${layerName}`;
      const dir = isSprite ? 'assets/effects' : 'assets/backgrounds';
      const a = save(path.join(root, dir, 'hd', `${base}.webp`), e.hd);
      const b = save(path.join(root, dir, 'md', `${base}.webp`), e.md);
      console.log(`${base}  ${e.w}x${e.h}  hd ${(a / 1024).toFixed(0)} KB  md ${(b / 1024).toFixed(0)} KB`);
    }
    console.log(`  ${name} painted in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
} finally {
  await browser.close();
}
