/* Painter core: seeded randomness, colour maths and soft gouache-style brushes.
   Everything here is deterministic so the backgrounds can be regenerated identically. */
'use strict';
const TAU = Math.PI * 2;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRnd(seed) {
  const r = mulberry32(seed);
  r.range = (a, b) => a + (b - a) * r();
  r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.sign = () => (r() < 0.5 ? -1 : 1);
  r.gauss = () => (r() + r() + r() + r() - 2) / 1.0; // roughly -1..1, centre weighted
  return r;
}
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function hex(c) {
  if (Array.isArray(c)) return c;
  c = c.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}
function rgba(c, a = 1) { c = hex(c); return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function mix(a, b, t) { a = hex(a); b = hex(b); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function shade(c, amt) { return amt >= 0 ? mix(c, [255, 255, 255], amt) : mix(c, [0, 0, 0], -amt); }
function jitter(c, rnd, amt = 0.06) {
  c = hex(c);
  const d = (rnd() - 0.5) * 2 * amt * 255;
  return [0, 1, 2].map((i) => clamp(c[i] + d + (rnd() - 0.5) * amt * 110, 0, 255));
}
function ramp(stops, t) { // stops: [[pos, colour], ...]
  t = clamp(t);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
      return mix(c0, c1, (t - t0) / (t1 - t0 || 1));
    }
  }
  return hex(stops[stops.length - 1][1]);
}

function makeNoise(seed) {
  const r = mulberry32(seed), P = new Float32Array(65536);
  for (let i = 0; i < P.length; i++) P[i] = r();
  const at = (x, y) => P[((y & 255) << 8) | (x & 255)];
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v);
  };
  n.fbm = (x, y, o = 4) => { let s = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < o; i++) { s += a * n(x * f, y * f); t += a; a *= 0.5; f *= 2; } return s / t; };
  return n;
}

function layer(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h || w;
  return { c, ctx: c.getContext('2d'), w, h: h || w };
}

/* ---------- brushes ---------- */
function softDab(ctx, x, y, r, col, a = 1, inner = 0) {
  const g = ctx.createRadialGradient(x, y, r * inner, x, y, r);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
function glow(ctx, x, y, r, col, a = 1, mode = 'lighter') {
  ctx.save(); ctx.globalCompositeOperation = mode; softDab(ctx, x, y, r, col, a); ctx.restore();
}
function disc(ctx, x, y, r, col, a = 1) { ctx.fillStyle = rgba(col, a); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
function ell(ctx, x, y, rx, ry, rot, col, a = 1) { ctx.fillStyle = rgba(col, a); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); }

// irregular rounded blob (the basic "dab of paint")
function blobPath(ctx, x, y, r, rnd, o = {}) {
  const n = o.n || 9, rough = o.rough ?? 0.22, sx = o.sx || 1, sy = o.sy || 1, rot = o.rot || 0;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, rr = r * (1 + (rnd() - 0.5) * 2 * rough);
    const px = Math.cos(a) * rr * sx, py = Math.sin(a) * rr * sy;
    pts.push([x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)]);
  }
  ctx.beginPath();
  const m0 = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}
function blob(ctx, x, y, r, col, rnd, o = {}) { blobPath(ctx, x, y, r, rnd, o); ctx.fillStyle = rgba(col, o.a ?? 1); ctx.fill(); }

// smooth open curve through points
function curvePath(ctx, pts) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  const l = pts[pts.length - 1]; ctx.lineTo(l[0], l[1]);
}
function stroke(ctx, pts, w, col, a = 1, cap = 'round') {
  ctx.save(); ctx.lineCap = cap; ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(col, a); ctx.lineWidth = w;
  curvePath(ctx, pts); ctx.stroke(); ctx.restore();
}
// tapered stroke (branches, stems): drawn as a chain of discs
function taper(ctx, pts, w0, w1, col, a = 1) {
  ctx.fillStyle = rgba(col, a);
  const N = pts.length;
  for (let i = 0; i < N - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], d = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(2, d / 1.5);
    for (let s = 0; s < steps; s++) {
      const t = s / steps, g = (i + t) / (N - 1);
      ctx.beginPath(); ctx.arc(lerp(x0, x1, t), lerp(y0, y1, t), lerp(w0, w1, g) / 2, 0, TAU); ctx.fill();
    }
  }
}
function sampleCurve(pts, n) { // resample a polyline to n evenly spaced points
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = d[d.length - 1], out = [];
  for (let k = 0; k < n; k++) {
    const t = (k / (n - 1)) * L; let i = 1; while (i < d.length - 1 && d[i] < t) i++;
    const u = (t - d[i - 1]) / (d[i] - d[i - 1] || 1);
    out.push([lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]);
  }
  return out;
}
function catenary(x0, y0, x1, y1, sag, n = 24) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n; out.push([lerp(x0, x1, t), lerp(y0, y1, t) + sag * 4 * t * (1 - t)]); }
  return out;
}

/* ---------- texture ---------- */
let _grainTile = null;
function grainTile() {
  if (_grainTile) return _grainTile;
  const L = layer(512, 512), id = L.ctx.createImageData(512, 512), r = mulberry32(777), n = makeNoise(31);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const i = (y * 512 + x) * 4;
    const v = (r() - 0.5) * 0.7 + (n.fbm(x / 9, y / 9, 3) - 0.5) * 1.3 + (n.fbm(x / 60, y / 60, 2) - 0.5) * 0.9;
    const dark = v < 0;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = dark ? 40 : 255;
    id.data[i + 3] = clamp(Math.abs(v) * 2.1) * 255;
  }
  L.ctx.putImageData(id, 0, 0);
  return (_grainTile = L.c);
}
// paper grain that respects the layer's existing alpha
function grain(ctx, w, h, amt = 0.07) {
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = amt;
  ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat'); ctx.fillRect(0, 0, w, h); ctx.restore();
}
// draw a layer onto another with a blur (depth of field) or plain
function stamp(dst, src, blurPx = 0, alpha = 1, comp = 'source-over') {
  dst.save(); dst.globalAlpha = alpha; dst.globalCompositeOperation = comp;
  if (blurPx) dst.filter = `blur(${blurPx}px)`;
  dst.drawImage(src, 0, 0); dst.restore();
}
function vGradient(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  for (const [t, c, a] of stops) g.addColorStop(t, rgba(c, a ?? 1));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}
