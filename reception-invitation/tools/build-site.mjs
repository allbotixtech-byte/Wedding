// "npm run build" — collects exactly the files the website needs into dist/ and checks that none is missing.
// Nothing is compiled (the site is plain HTML, CSS and JavaScript); dist/ is simply a clean copy without the
// renderer, the tools, the original artwork and the video output, ready to upload to any static web host.
//
//   node tools/build-site.mjs                  -> dist/
//   node tools/build-site.mjs --out=my-folder  -> another folder (relative to the project folder, or absolute)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const out = path.resolve(root, arg('out', 'dist'));
const MARK = '.site-build'; // dropped into every folder this script creates, so it never deletes anything else
const fail = (msg) => { console.error(`\n  Build stopped: ${msg}\n`); process.exit(1); };
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const isInside = (child, parent) => { const r = path.relative(parent, child); return r === '' || (!r.startsWith('..' + path.sep) && r !== '..' && !path.isAbsolute(r)); };

/* ---- 1. where is it safe to write? ---- */
if (isInside(root, out)) fail(`the output folder (${out}) would contain the project itself. Choose another --out folder.`);
for (const keep of ['assets', 'vendor', 'tools', 'render', 'output', 'node_modules']) {
  if (isInside(out, path.join(root, keep))) fail(`the output folder may not be inside "${keep}/". Choose another --out folder.`);
}
if (fs.existsSync(out)) {
  if (!fs.statSync(out).isDirectory()) fail(`${out} is a file, not a folder.`);
  if (fs.readdirSync(out).length && !fs.existsSync(path.join(out, MARK))) {
    fail(`${out} already exists and was not created by this script, so it is left alone.\n  Delete it yourself, or choose another folder with --out=some-folder.`);
  }
}

/* ---- 2. read the configuration and work out what the page loads ---- */
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
for (const f of ['index.html', 'styles.css', 'script.js', 'config.js', 'vendor/gsap.min.js']) {
  if (!fs.existsSync(path.join(root, f))) fail(`${f} is missing from the project folder.`);
}
let cfg;
try { const sandbox = { window: {} }; vm.runInNewContext(read('config.js'), sandbox, { filename: 'config.js', timeout: 2000 }); cfg = sandbox.window.INVITE_CONFIG; }
catch (e) { fail(`config.js has a mistake in it and cannot be read:\n    ${e.message}\n  (Usually a missing quote or comma on the line you last edited.)`); }
if (!cfg || typeof cfg !== 'object') fail('config.js does not define window.INVITE_CONFIG.');

const problems = [], warnings = [];
const need = (file, why) => { if (!file || typeof file !== 'string') { problems.push(`${why}: no file is set`); return; } if (/^(https?:)?\/\//i.test(file) || file.startsWith('data:')) return; if (!fs.existsSync(path.join(root, file))) problems.push(`${why}: ${file} does not exist`); };
const html = read('index.html'), css = read('styles.css'), js = read('script.js');
for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) need(m[1], 'script used by index.html');
for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) need(m[1], 'stylesheet used by index.html');
for (const m of css.matchAll(/url\(\s*['"]?(assets\/[^'")]+)['"]?\s*\)/g)) need(m[1], 'file used by styles.css');
const plates = new Set([...html.matchAll(/data-plate="([^"]+)"/g)].map((m) => m[1]));
const effects = new Set([...html.matchAll(/data-effect="([^"]+)"/g)].map((m) => m[1]).concat([...js.matchAll(/fxImg\('([\w-]+)'\)/g)].map((m) => m[1])));
for (const res of ['hd', 'md']) {
  for (const p of plates) need(`assets/backgrounds/${res}/${p}.webp`, 'background painting');
  for (const e of effects) need(`assets/effects/${res}/${e}.webp`, 'decoration');
}
for (const k of ['groom', 'bride', 'couple']) need((cfg.IMAGES || {})[k], `IMAGES.${k} in config.js`);
if (cfg.MUSIC) need(cfg.MUSIC, 'MUSIC in config.js'); else warnings.push('MUSIC is empty in config.js, so the website will be silent.');
for (const k of ['BRIDE_NAME', 'GROOM_NAME', 'EVENT_TYPE', 'EVENT_DATE', 'VENUE_NAME', 'VENUE_ADDRESS']) if (!String(cfg[k] || '').trim()) warnings.push(`${k} is empty in config.js.`);
if (cfg.EVENT_DATE_ISO && !/^\d{4}-\d{2}-\d{2}$/.test(cfg.EVENT_DATE_ISO)) warnings.push('EVENT_DATE_ISO should look like 2026-11-28; the "Save the date" button is hidden until it does.');
if (problems.length) fail(`${problems.length === 1 ? 'a file the invitation needs is missing' : 'some files the invitation needs are missing'}:\n    - ${problems.join('\n    - ')}`);

/* ---- 3. copy ---- */
const configText = read('config.js');
const skip = (relPath) => {
  if (relPath === 'assets/source' || relPath.startsWith('assets/source/')) return true;   // your originals + lossless cut-outs
  if (/\.wav$/i.test(relPath) && !configText.includes(relPath)) return true;              // video master of the soundtrack
  if (/(^|\/)(Thumbs\.db|desktop\.ini|\.DS_Store)$/i.test(relPath)) return true;
  return false;
};
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, MARK), 'This folder is generated by "npm run build". It is replaced on every build - do not edit files here.\n');
let count = 0, bytes = 0;
const copy = (relPath) => {
  const src = path.join(root, relPath), st = fs.statSync(src);
  if (st.isDirectory()) { for (const name of fs.readdirSync(src).sort()) { const child = `${relPath}/${name}`; if (!skip(child)) copy(child); } return; }
  const dst = path.join(out, relPath);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst); count++; bytes += st.size;
};
for (const item of ['index.html', 'styles.css', 'script.js', 'config.js', 'vendor', 'assets']) copy(item);

/* ---- 4. report ---- */
// show the folder the way it looks from where the command was typed (the project folder or the folder above it)
const here = process.cwd();
const shown = isInside(out, here) && out !== here ? path.relative(here, out) + path.sep : out;
const isDefault = out === path.join(root, 'dist');
console.log(`\n  Website bundle is ready:  ${shown}   (${count} files, ${(bytes / 1048576).toFixed(1)} MB)`);
for (const w of warnings) console.log(`  Note: ${w}`);
console.log(`
  What you can do next
    See it in the browser ......  ${isDefault ? 'npm run preview' : `node "${path.join(root, 'tools', 'serve.mjs')}" "--dir=${out}"`}
    Put it online ..............  upload everything inside that folder to any static web host
    Work on the invitation .....  npm run dev          (opens it straight from the project files)
    Make the MP4 videos ........  npm run render       (about 5 minutes; saved in output/)
`);
