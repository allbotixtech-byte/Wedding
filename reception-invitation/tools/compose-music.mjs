#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  compose-music.mjs — the reception film's soundtrack, "Saanjh Ki Dor" (an original
//  Bollywood romantic instrumental), rendered from its score with sampled instruments.
//
//  The music itself is written out note by note in tools/music/score.json. It is played by
//  real recorded instruments: bansuri, violin, strings, harp, sitar and santoor from the
//  GeneralUser GS SoundFont, piano, bass and bells from MuseScore_General, and real tabla,
//  swarmandal, santoor rolls, shaker, tambourine, finger cymbals, bell tree and wind chimes
//  from CC0 recordings. Licences and credits: README.md, tools/music/sources.json.
//
//    node tools/compose-music.mjs                 → assets/music/reception-theme.wav + .mp3
//    node tools/compose-music.mjs --report        → also print each instrument's level per section
//    node tools/compose-music.mjs --stems=<dir>   → also write one WAV per instrument
//    node tools/compose-music.mjs --no-mp3        → skip the MP3
//
//  The first run downloads the SoundFonts and recordings (≈ 93 MB, checked by SHA-256) into
//  tools/music/sounds/, which is not committed. Common tweaks:
//    different notes, timing or dynamics ... tools/music/score.json (format: tools/music/score.mjs)
//    one instrument louder / softer ........ tools/music/instruments.json → "mix"
//    instrument sound (preset, vibrato …) ... tools/music/instruments.json → "parts"
//    overall loudness ....................... tools/music/instruments.json → "master".targetLufs
// ════════════════════════════════════════════════════════════════════════════
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fetchSounds } from './music/fetch-sounds.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const music = path.join(root, 'tools', 'music');
const passThrough = process.argv.slice(2).filter((a) => a === '--report' || a === '--no-mp3' || a.startsWith('--stems='));

if (!(await fetchSounds({ quiet: true }))) {
  console.error('Could not download the instrument sounds (see above). Check the internet connection and run "npm run music" again.');
  process.exit(1);
}
const out = path.join(root, 'assets', 'music', 'reception-theme.wav');
const r = spawnSync(process.execPath, [path.join(music, 'render.mjs'), path.join(music, 'score.json'), out, ...passThrough], { stdio: 'inherit' });
process.exit(r.status ?? 1);
