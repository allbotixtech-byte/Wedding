// Tiny static web server for the invitation (no dependencies).
//   node tools/serve.mjs                 -> http://localhost:5173 and opens your browser
//   node tools/serve.mjs --port=8080     -> another port (if a port is busy the next free one is used automatically)
//   node tools/serve.mjs --no-open       -> do not open a browser tab
//   node tools/serve.mjs --dir=dist      -> serve another folder (relative to the project folder), e.g. the built site
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.ics': 'text/calendar',
  '.txt': 'text/plain; charset=utf-8',
};

function handle(root, req, res) {
  const plain = (code, text, extra = {}) => { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', ...extra }); res.end(req.method === 'HEAD' ? undefined : text); };
  if (req.method !== 'GET' && req.method !== 'HEAD') return plain(405, 'Method not allowed', { Allow: 'GET, HEAD' });
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return plain(400, 'Bad request'); }
  if (rel.includes('\0')) return plain(400, 'Bad request');
  if (rel.endsWith('/')) rel += 'index.html';
  // never serve anything outside the folder (a plain "starts with" test would also let sibling folders through)
  const file = path.join(root, rel), inside = path.relative(root, file);
  if (!inside || inside === '..' || inside.startsWith('..' + path.sep) || path.isAbsolute(inside)) return plain(403, 'Forbidden');
  let stat = null;
  try { stat = fs.statSync(file); } catch { /* missing */ }
  if (!stat || !stat.isFile()) return plain(404, 'Not found');

  const size = stat.size, type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const head = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  const send = (code, headers, range) => {
    res.writeHead(code, headers);
    if (req.method === 'HEAD' || size === 0) return res.end();
    fs.createReadStream(file, range).on('error', () => res.destroy()).pipe(res);
  };
  // byte ranges: audio seeking needs them (bytes=a-b, bytes=a-, bytes=-lastN)
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] !== '' || m[2] !== '')) {
    let start, end;
    if (m[1] === '') { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
    else { start = parseInt(m[1], 10); end = m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1); }
    if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
    return send(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 }, { start, end });
  }
  send(200, { ...head, 'Content-Length': size });
}

// port 0 = any free port. With fallback > 0, a busy port is retried on the next numbers (5173 -> 5174 -> …).
export function startServer(root, port = 0, { fallback = 0 } = {}) {
  root = path.resolve(root);
  const server = http.createServer((req, res) => {
    try { handle(root, req, res); } catch (e) { if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(String(e)); }
  });
  return new Promise((resolve, reject) => {
    let tries = 0;
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE' && port !== 0 && tries < fallback) { tries++; server.listen(port + tries, '127.0.0.1'); } else reject(e);
    });
    server.on('listening', () => { const p = server.address().port; resolve({ server, port: p, url: `http://localhost:${p}/` }); });
    server.listen(port, '127.0.0.1');
  });
}

// "Was this file started directly?" — compared through realpath and without caring about letter case,
// because Windows terminals do not agree on "c:\" versus "C:\".
function isMain() {
  try {
    const a = fs.realpathSync(process.argv[1] || ''), b = fs.realpathSync(fileURLToPath(import.meta.url));
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  } catch { return false; }
}

if (isMain()) {
  const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
  const dirArg = arg('dir', ''), dir = path.resolve(project, dirArg || '.');
  const want = parseInt(arg('port', '5173'), 10);
  if (!Number.isInteger(want) || want < 1 || want > 65535) { console.error(`"${arg('port', '')}" is not a valid port number. Example:  --port=8080`); process.exit(1); }
  if (!fs.existsSync(path.join(dir, 'index.html'))) {
    console.error(`\n  There is no index.html in ${dir}${dirArg ? '\n  Create the site bundle first with:  npm run build' : ''}\n`);
    process.exit(1);
  }
  startServer(dir, want, { fallback: 20 }).then(({ url, port }) => {
    if (port !== want) console.log(`\n  Port ${want} is already in use, so port ${port} is used instead.`);
    console.log(`\n  Reception invitation${dirArg ? ` (${dirArg})` : ''} is running at  ${url}\n  Press Ctrl+C to stop.\n`);
    if (!process.argv.includes('--no-open')) exec(process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`);
  }).catch((e) => {
    console.error(e.code === 'EADDRINUSE' ? `\n  Ports ${want}–${want + 20} are all busy. Choose another one, for example:  npm run dev -- --port=8080\n` : e);
    process.exit(1);
  });
}
