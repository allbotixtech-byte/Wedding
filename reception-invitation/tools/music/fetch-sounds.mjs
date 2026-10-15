#!/usr/bin/env node
// Downloads the SoundFonts and recordings listed in sources.json into tools/music/sounds/ and checks every
// file's SHA-256. Files that are already present and correct are skipped, so it is safe to run again.
//
//   node tools/music/fetch-sounds.mjs           → download what is missing (≈ 93 MB the first time)
//   node tools/music/fetch-sounds.mjs --check   → only verify, download nothing (exit code 1 if anything is missing)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { files } = JSON.parse(fs.readFileSync(path.join(here, 'sources.json'), 'utf8'));
const dir = path.join(here, 'sounds');
const checkOnly = process.argv.includes('--check');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ok = (f) => { const p = path.join(dir, f.file); return fs.existsSync(p) && fs.statSync(p).size === f.bytes && sha256(p) === f.sha256; };

export async function fetchSounds({ quiet = false } = {}) {
  const missing = files.filter((f) => !ok(f));
  if (!missing.length) { if (!quiet) console.log(`All ${files.length} sound files are present in ${path.relative(process.cwd(), dir) || dir}.`); return true; }
  if (checkOnly) { console.log(`${missing.length} of ${files.length} sound files are missing or changed:\n  ${missing.map((f) => f.file).join('\n  ')}`); return false; }
  const total = missing.reduce((s, f) => s + f.bytes, 0);
  console.log(`Downloading ${missing.length} sound files (${(total / 1e6).toFixed(1)} MB) into ${dir}`);
  for (const f of missing) {
    const dest = path.join(dir, f.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(f.url, { headers: { 'User-Agent': 'reception-invitation-music', ...(f.headers ?? {}) }, redirect: 'follow' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        if (hash !== f.sha256) throw new Error(`checksum mismatch (got ${hash.slice(0, 12)}…, expected ${f.sha256.slice(0, 12)}…)`);
        fs.writeFileSync(dest, buf);
        console.log(`  ✓ ${f.file} (${(buf.length / 1e6).toFixed(2)} MB)`);
        lastError = null;
        break;
      } catch (e) { lastError = e; if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt)); }
    }
    if (lastError) { console.error(`  ✗ ${f.file}: ${lastError.message}\n    from ${f.url}`); return false; }
  }
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fetchSounds().then((done) => process.exit(done ? 0 : 1));
}
