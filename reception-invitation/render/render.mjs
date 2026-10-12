// Renders the invitation to a real MP4 by stepping the web film frame by frame in a headless browser
// and piping the frames (plus the soundtrack) into FFmpeg.
//
//   node render/render.mjs --format=vertical        -> output/reception-invitation-vertical-1080x1920.mp4  (+ a WhatsApp-sized copy)
//   node render/render.mjs --format=horizontal      -> output/reception-invitation-horizontal-1920x1080.mp4
//
// Options:  --fps=30  --crf=18  --audio=file.wav  --from=0 --to=59.5 (seconds, for test renders)  --no-whatsapp  --no-audio  --out=path.mp4
// (The WhatsApp copy is only made for a complete vertical render to the default location.)
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findBrowser } from '../tools/browser.mjs';
import { startServer } from '../tools/serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const flag = (n) => process.argv.includes(`--${n}`);
const stop = (msg) => { console.error(`\n${msg}\n`); process.exit(1); };

const format = arg('format', 'vertical');
if (format !== 'vertical' && format !== 'horizontal') stop(`Unknown --format "${format}". Use --format=vertical or --format=horizontal.`);
const [W, H] = format === 'horizontal' ? [1920, 1080] : [1080, 1920];
const fps = parseInt(arg('fps', '30'), 10);
if (!(fps >= 1 && fps <= 60)) stop(`--fps must be a number from 1 to 60 (got "${arg('fps', '')}").`);
const crf = arg('crf', '18');
const outDir = path.join(root, 'output');
const outFile = path.resolve(arg('out', path.join(outDir, `reception-invitation-${format}-${W}x${H}.mp4`)));
if (path.extname(outFile).toLowerCase() !== '.mp4') stop(`The --out file must end in .mp4 (got "${path.basename(outFile)}").`);
const partial = arg('from', '') !== '' || arg('to', '') !== '';

/* ---- everything the renderer needs, checked up front with plain-language messages ---- */
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; }
catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
  stop('The renderer is not installed yet (this is needed once).\n\n    In the reception-invitation folder run:   npm install\n    or, from the Reception folder above it:    npm run setup\n\nThen run this command again.');
}
if (spawnSync('ffmpeg', ['-version']).status !== 0) stop('FFmpeg was not found. Install it once with:\n\n    winget install Gyan.FFmpeg\n\nthen close and reopen the terminal and run this command again.');
let browserPath;
try { browserPath = findBrowser(); } catch (e) { stop(e.message); }
if (!fs.existsSync(path.join(root, 'config.js'))) stop('config.js is missing from the project folder.');

// soundtrack: the file named in config.js (MUSIC); a .wav with the same name is preferred because it is lossless
const musicRel = (/MUSIC:\s*['"]([^'"]+)['"]/.exec(fs.readFileSync(path.join(root, 'config.js'), 'utf8')) || [])[1] || 'assets/music/reception-theme.mp3';
const audio = flag('no-audio') ? null : [arg('audio', ''), musicRel.replace(/\.[a-z0-9]+$/i, '.wav'), musicRel].filter(Boolean).map((f) => path.resolve(root, f)).find((f) => fs.existsSync(f));
if (!audio && !flag('no-audio')) console.warn('! No soundtrack found (' + musicRel + ') — the video will be silent. Run "npm run music" first.');
fs.mkdirSync(path.dirname(outFile), { recursive: true });

// The video is written next to its final place under a temporary name and only swapped in when it is complete,
// so an interrupted render never leaves a broken file, and a video that is still open in a player is not a problem.
const tmpFile = outFile.replace(/\.mp4$/i, '.rendering.mp4');
const finish = (tmp, final) => {
  try { fs.renameSync(tmp, final); return final; } // replaces the previous video
  catch {
    let actual = final.replace(/\.mp4$/i, ' (new).mp4');
    try { fs.renameSync(tmp, actual); } catch { actual = tmp; }
    console.warn(`\n\n! ${path.basename(final)} is open in another program (a video player?), so it could not be replaced.\n  The new video was saved next to it as "${path.basename(actual)}". Close the player and rename it when you like.`);
    return actual;
  }
};

const { server, url } = await startServer(root, 0);
let browser, enc, saved = null;
try {
  browser = await puppeteer.launch({
    executablePath: browserPath, headless: true,
    args: ['--force-device-scale-factor=1', '--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb', '--disable-background-timer-throttling', `--window-size=${W},${H}`],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto(`${url}index.html?render=1`, { waitUntil: 'load' });
  await page.evaluate(() => window.__film.ready);
  const duration = await page.evaluate(() => window.__film.duration);
  const from = parseFloat(arg('from', '0')), to = Math.min(duration, parseFloat(arg('to', String(duration))));
  if (!(from >= 0) || !(to > from)) throw new Error(`--from and --to must be seconds between 0 and ${duration}, with --to after --from.`);
  const first = Math.round(from * fps), last = Math.round(to * fps), total = last - first;
  if (total < 1) throw new Error('That range is shorter than one frame.');
  console.log(`\nRendering ${format} ${W}x${H} @ ${fps} fps — ${total} frames (${(to - from).toFixed(1)} s)\n`);

  const ff = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', 'pipe:0'];
  if (audio) ff.push('-ss', String(from), '-i', audio);
  ff.push('-map', '0:v:0'); if (audio) ff.push('-map', '1:a:0');
  ff.push(
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p', '-r', String(fps), '-g', String(fps * 2),
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  );
  if (audio) ff.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2');
  ff.push('-t', (total / fps).toFixed(3), '-movflags', '+faststart', tmpFile);
  fs.rmSync(tmpFile, { force: true });
  enc = spawn('ffmpeg', ff, { stdio: ['pipe', 'inherit', 'inherit'] });
  const encDone = new Promise((res, rej) => { enc.on('close', (code) => (code === 0 ? res() : rej(new Error('FFmpeg stopped with an error (code ' + code + '); its message is shown above.')))); enc.on('error', rej); });
  encDone.catch(() => {}); // reported below; this only keeps Node from complaining while frames are still being sent
  let encFailed = false; enc.on('close', (code) => { if (code !== 0) encFailed = true; });
  enc.stdin.on('error', () => {});

  const t0 = Date.now();
  for (let f = first; f < last && !encFailed; f++) {
    await page.evaluate((t) => window.__film.seek(t), f / fps);
    const png = await page.screenshot({ type: 'png', optimizeForSpeed: true });
    if (!enc.stdin.write(png)) { // wait until FFmpeg has caught up (or has stopped)
      await new Promise((r) => { const go = () => { enc.stdin.off('drain', go); enc.off('close', go); r(); }; enc.stdin.once('drain', go); enc.once('close', go); });
    }
    const done = f - first + 1;
    if (done % 60 === 0 || done === total) {
      const el = (Date.now() - t0) / 1000, eta = (el / done) * (total - done);
      process.stdout.write(`\r  frame ${String(done).padStart(4)} / ${total}   ${(done / el).toFixed(1)} fps   about ${Math.ceil(eta / 60)} min left   `);
    }
  }
  enc.stdin.end();
  await encDone;
  saved = finish(tmpFile, outFile);
  console.log(`\n\nSaved  ${saved}  (${(fs.statSync(saved).size / 1048576).toFixed(1)} MB)`);
} catch (e) {
  console.error(`\n\nThe render did not finish: ${e.message}`);
  if (enc && enc.exitCode === null) { enc.kill(); await new Promise((r) => { enc.once('close', r); setTimeout(r, 3000); }); }
  try { fs.rmSync(tmpFile, { force: true }); } catch { /* still locked: verify.mjs ignores *.rendering.mp4 and the next render replaces it */ }
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
if (!saved) process.exit(1);

// A second, smaller copy for sending in WhatsApp chats (under the 16 MB that WhatsApp has long allowed for videos).
if (format === 'vertical' && !flag('no-whatsapp') && !partial && !arg('out', '')) {
  const wa = path.join(outDir, 'reception-invitation-whatsapp-720x1280.mp4'), waTmp = wa.replace(/\.mp4$/i, '.rendering.mp4'), log = path.join(root, 'render', 'ffmpeg2pass');
  const common = ['-hide_banner', '-loglevel', 'error', '-y', '-i', saved, '-vf', 'scale=720:1280:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-b:v', '1650k', '-maxrate', '2300k', '-bufsize', '4600k', '-profile:v', 'high', '-level', '3.1', '-pix_fmt', 'yuv420p', '-passlogfile', log];
  console.log('Creating the WhatsApp-sized copy…');
  const p1 = spawnSync('ffmpeg', [...common, '-pass', '1', '-an', '-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null'], { stdio: 'inherit' });
  const p2 = p1.status === 0 ? spawnSync('ffmpeg', [...common, '-pass', '2', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-movflags', '+faststart', waTmp], { stdio: 'inherit' }) : p1;
  for (const f of fs.readdirSync(path.dirname(log))) if (f.startsWith('ffmpeg2pass')) fs.rmSync(path.join(path.dirname(log), f), { force: true });
  if (p2.status === 0) { const w = finish(waTmp, wa); console.log(`Saved  ${w}  (${(fs.statSync(w).size / 1048576).toFixed(1)} MB)`); }
  else { fs.rmSync(waTmp, { force: true }); console.error('The WhatsApp-sized copy could not be created (the full-size video above is fine).'); process.exit(1); }
}
