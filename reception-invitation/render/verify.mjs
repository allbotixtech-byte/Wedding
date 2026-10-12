// Quality check for the rendered videos in output/ : file, size, codecs, duration, audio, black frames,
// silent gaps — and it saves a contact sheet of frames (output/qa/) so you can eyeball every scene.
//   node render/verify.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'output'), qaDir = path.join(outDir, 'qa');
const run = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 }); return (r.stdout || '') + (r.stderr || ''); };
if (spawnSync('ffprobe', ['-version']).status !== 0 || spawnSync('ffmpeg', ['-version']).status !== 0) {
  console.error('\nFFmpeg was not found. Install it once with:\n\n    winget install Gyan.FFmpeg\n\nthen close and reopen the terminal and run this command again.\n');
  process.exit(1);
}
// (*.rendering.mp4 is a render that is still running or was interrupted)
const files = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => f.toLowerCase().endsWith('.mp4') && !f.includes('.rendering.')).sort() : [];
if (!files.length) { console.error('\nThere are no MP4 files in output/ yet. Create them with:  npm run render\n'); process.exit(1); }
fs.mkdirSync(qaDir, { recursive: true });

const expected = { vertical: [1080, 1920], horizontal: [1920, 1080], whatsapp: [720, 1280] };
let allOk = true;
for (const f of files) {
  const file = path.join(outDir, f);
  let info;
  try { info = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { encoding: 'utf8' }).stdout || '{}'); }
  catch (e) { info = {}; }
  if (!info.streams) { console.log(`\n${f}\n  FAIL  the file cannot be read (is it still being rendered?)`); allOk = false; continue; }
  const v = (info.streams || []).find((s) => s.codec_type === 'video'), a = (info.streams || []).find((s) => s.codec_type === 'audio');
  const dur = parseFloat(info.format?.duration || '0'), size = fs.statSync(file).size / 1048576;
  const kind = Object.keys(expected).find((k) => f.includes(k)), want = expected[kind] || [];
  const checks = [];
  const check = (label, ok, detail) => { checks.push(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`); if (!ok) allOk = false; };
  check('video stream is H.264', v?.codec_name === 'h264', v ? `${v.codec_name}, ${v.pix_fmt}, profile ${v.profile}` : 'no video stream');
  check('resolution', !!v && (!want.length || (v.width === want[0] && v.height === want[1])), v ? `${v.width} x ${v.height}` : '');
  check('frame rate is 30 fps', v?.r_frame_rate === '30/1', v?.r_frame_rate);
  check('audio stream is AAC', a?.codec_name === 'aac', a ? `${a.codec_name}, ${a.sample_rate} Hz, ${a.channels} ch` : 'NO AUDIO');
  check('duration between 50 and 70 s (and under 60 s for stories)', dur >= 50 && dur <= 70, `${dur.toFixed(2)} s${dur < 60 ? '' : ' (longer than one 60-second story)'}`);
  if (kind === 'whatsapp') check('under the 16 MB WhatsApp limit', size < 16, `${size.toFixed(1)} MB`);
  // black frames: only the closing fade may be black
  const black = [...run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vf', 'blackdetect=d=0.3:pic_th=0.98:pix_th=0.06', '-an', '-f', 'null', '-']).matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => [parseFloat(m[1]), parseFloat(m[2])]);
  const badBlack = black.filter(([s]) => s < dur - 2);
  check('no black frames before the closing fade', badBlack.length === 0, black.length ? black.map(([s, e]) => `${s.toFixed(2)}–${e.toFixed(2)} s`).join(', ') : 'none at all');
  // frozen picture (a still slideshow would fail this)
  const frozen = [...run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vf', 'freezedetect=n=0.0008:d=1.2', '-an', '-f', 'null', '-']).matchAll(/freeze_start: ([\d.]+)/g)].map((m) => parseFloat(m[1])).filter((s) => s < dur - 1.5);
  check('picture is always in motion', frozen.length === 0, frozen.length ? 'frozen from ' + frozen.map((s) => s.toFixed(1) + ' s').join(', ') : '');
  // audio: loudness and silent gaps
  if (a) {
    const sil = [...run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'silencedetect=noise=-50dB:d=0.5', '-vn', '-f', 'null', '-']).matchAll(/silence_start: ([\d.]+)/g)].map((m) => parseFloat(m[1])).filter((s) => s < dur - 1.5);
    check('music plays throughout', sil.length === 0, sil.length ? 'silence from ' + sil.join(', ') : '');
    const loud = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-vn', '-f', 'null', '-']);
    const I = /I:\s+(-?[\d.]+) LUFS/.exec(loud.slice(loud.lastIndexOf('Summary'))), pk = /Peak:\s+(-?[\d.]+) dBFS/.exec(loud.slice(loud.lastIndexOf('Summary')));
    check('loudness is sensible', !!I && parseFloat(I[1]) > -20 && parseFloat(I[1]) < -12, I ? `${I[1]} LUFS integrated, true peak ${pk ? pk[1] : '?'} dBTP` : '');
  }
  // contact sheet: 12 frames spread over the film
  const n = 12, cols = kind === 'horizontal' ? 4 : 6, tw = kind === 'horizontal' ? 480 : 270;
  const sheet = path.join(qaDir, f.replace(/\.mp4$/, '') + '-frames.jpg');
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-vf', `fps=${(n / dur).toFixed(5)},scale=${tw}:-2,tile=${cols}x${Math.ceil(n / cols)}`, '-frames:v', '1', '-q:v', '3', sheet]);
  console.log(`\n${f}   (${size.toFixed(1)} MB)\n${checks.join('\n')}\n  frames saved to ${path.relative(root, sheet)}`);
}
console.log(allOk ? '\nAll checks passed.\n' : '\nSome checks FAILED — see above.\n');
process.exit(allOk ? 0 : 1);
