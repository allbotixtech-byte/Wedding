/* Indian palace architecture: cusped arches, domes, chhatris, columns, balustrades. */
'use strict';

function polyPath(ctx, pts, close = true) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
// Multifoil (cusped) Mughal arch opening as a polygon. (cx, baseY) = middle of the threshold.
function cuspedArch(cx, baseY, w, h, o = {}) {
  const a = w / 2, spring = baseY - h * (o.spring ?? 0.5), b = h * (1 - (o.spring ?? 0.5)), p = o.p || 1.55, foils = o.foils || 4;
  const K = foils * 2, cusps = [];
  for (let i = 0; i <= K; i++) {
    const t = Math.PI - (i / K) * Math.PI, c = Math.cos(t), s = Math.sin(t);
    cusps.push([cx + a * Math.sign(c) * Math.pow(Math.abs(c), 2 / p), spring - b * Math.pow(Math.abs(s), 2 / p)]);
  }
  const pts = [[cx - a, baseY], [cx - a, spring]];
  for (let i = 0; i < K; i++) {
    const A = cusps[i], B = cusps[i + 1], mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
    const dx = mx - cx, dy = my - (spring + b * 0.15), d = Math.hypot(dx, dy) || 1, depth = Math.hypot(B[0] - A[0], B[1] - A[1]) * (o.depth ?? 0.36);
    const C = [mx + (dx / d) * depth, my + (dy / d) * depth];
    for (let k = 1; k <= 7; k++) { const u = k / 7, v = 1 - u; pts.push([v * v * A[0] + 2 * v * u * C[0] + u * u * B[0], v * v * A[1] + 2 * v * u * C[1] + u * u * B[1]]); }
  }
  pts.push([cx + a, spring], [cx + a, baseY]);
  return pts;
}
// soft colour variation inside a shape, like an uneven watercolour wash
function wash(ctx, pathFn, bbox, cols, rnd, n = 14, a = 0.1) {
  ctx.save(); pathFn(); ctx.clip();
  const [x, y, w, h] = bbox;
  for (let i = 0; i < n; i++) softDab(ctx, x + rnd() * w, y + rnd() * h, Math.max(w, h) * rnd.range(0.12, 0.4), rnd.pick(cols), a * rnd.range(0.5, 1.2));
  ctx.restore();
}
function ink(ctx, pathFn, col = '#3b2430', w = 1.6, a = 0.4) {
  ctx.save(); ctx.strokeStyle = rgba(col, a); ctx.lineWidth = w; ctx.lineJoin = 'round'; pathFn(); ctx.stroke(); ctx.restore();
}
function hGradRect(ctx, x, y, w, h, c0, c1, c2) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, rgba(c0)); if (c2) { g.addColorStop(0.45, rgba(c1)); g.addColorStop(1, rgba(c2)); } else g.addColorStop(1, rgba(c1));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}
// pal: {light, mid, shadow, line}
function column(ctx, x, baseY, h, w, pal, o = {}) {
  const bh = h * 0.07, ch = h * 0.085;
  hGradRect(ctx, x - w / 2, baseY - h + ch, w, h - ch - bh, pal.light, pal.mid, pal.shadow);
  // base
  hGradRect(ctx, x - w * 0.78, baseY - bh * 0.45, w * 1.56, bh * 0.45, pal.light, pal.mid, pal.shadow);
  hGradRect(ctx, x - w * 0.64, baseY - bh, w * 1.28, bh * 0.58, pal.light, pal.mid, pal.shadow);
  // lotus capital + abacus
  ctx.fillStyle = rgba(pal.mid); ctx.beginPath();
  ctx.moveTo(x - w / 2, baseY - h + ch); ctx.quadraticCurveTo(x - w * 0.56, baseY - h + ch * 0.45, x - w * 0.86, baseY - h + ch * 0.3);
  ctx.lineTo(x + w * 0.86, baseY - h + ch * 0.3); ctx.quadraticCurveTo(x + w * 0.56, baseY - h + ch * 0.45, x + w / 2, baseY - h + ch); ctx.fill();
  hGradRect(ctx, x - w * 0.92, baseY - h, w * 1.84, ch * 0.32, pal.light, pal.mid, pal.shadow);
  if (o.flutes !== 0) { ctx.strokeStyle = rgba(pal.line, 0.18); ctx.lineWidth = 1; for (let i = 1; i < 4; i++) { const fx = x - w / 2 + (w * i) / 4; ctx.beginPath(); ctx.moveTo(fx, baseY - h + ch * 1.1); ctx.lineTo(fx, baseY - bh * 1.05); ctx.stroke(); } }
  ink(ctx, () => { ctx.beginPath(); ctx.rect(x - w / 2, baseY - h + ch, w, h - ch - bh); }, pal.line, 1.3, 0.3);
}
function domePts(cx, baseY, w, h) {
  const L = [[-0.42, 0], [-0.56, -0.2], [-0.55, -0.42], [-0.4, -0.64], [-0.17, -0.82], [-0.05, -0.93], [0, -1]];
  const pts = L.map(([px, py]) => [cx + px * w, baseY + py * h]);
  for (let i = L.length - 2; i >= 0; i--) pts.push([cx - L[i][0] * w, baseY + L[i][1] * h]);
  return pts;
}
function dome(ctx, cx, baseY, w, h, pal, o = {}) {
  const pts = domePts(cx, baseY, w, h);
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); } ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); ctx.closePath(); };
  const g = ctx.createLinearGradient(cx - w * 0.56, 0, cx + w * 0.56, 0);
  g.addColorStop(0, rgba(pal.light)); g.addColorStop(0.4, rgba(pal.mid)); g.addColorStop(1, rgba(pal.shadow));
  ctx.fillStyle = g; path(); ctx.fill();
  if (o.ribs) { ctx.save(); path(); ctx.clip(); ctx.strokeStyle = rgba(pal.line, 0.16); ctx.lineWidth = 1.2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * w * 0.2, baseY); ctx.quadraticCurveTo(cx + i * w * 0.3, baseY - h * 0.5, cx, baseY - h); ctx.stroke(); } ctx.restore(); }
  ink(ctx, path, pal.line, 1.4, 0.32);
  // drum + finial
  hGradRect(ctx, cx - w * 0.46, baseY - h * 0.02, w * 0.92, h * 0.09, pal.light, pal.mid, pal.shadow);
  const f = o.finial || pal.gold || '#d9b25e';
  stroke(ctx, [[cx, baseY - h], [cx, baseY - h * 1.26]], Math.max(1.2, w * 0.022), f, 1);
  disc(ctx, cx, baseY - h * 1.07, w * 0.045, f); disc(ctx, cx, baseY - h * 1.16, w * 0.03, f);
}
// small domed pavilion on slim columns
function chhatri(ctx, cx, baseY, w, h, pal, o = {}) {
  const colH = h * 0.42, domeH = h * 0.42;
  if (o.glow) glow(ctx, cx, baseY - colH * 0.5, w * 0.9, o.glow, 0.4);
  ctx.fillStyle = rgba(o.inside || pal.shadow, o.insideA ?? 0.55); ctx.fillRect(cx - w * 0.36, baseY - colH, w * 0.72, colH);
  for (const k of [-0.38, -0.13, 0.13, 0.38]) hGradRect(ctx, cx + k * w - w * 0.035, baseY - colH, w * 0.07, colH, pal.light, pal.mid, pal.shadow);
  hGradRect(ctx, cx - w * 0.5, baseY - h * 0.03, w, h * 0.05, pal.light, pal.mid, pal.shadow);
  hGradRect(ctx, cx - w * 0.6, baseY - colH - h * 0.05, w * 1.2, h * 0.055, pal.light, pal.mid, pal.shadow);
  dome(ctx, cx, baseY - colH - h * 0.05, w * 0.8, domeH, pal, o);
}
function merlons(ctx, x0, x1, y, size, pal) {
  const n = Math.round((x1 - x0) / (size * 1.5)), step = (x1 - x0) / n;
  ctx.fillStyle = rgba(pal.mid);
  for (let i = 0; i < n; i++) { const x = x0 + step * (i + 0.5); ctx.beginPath(); ctx.moveTo(x - size * 0.5, y); ctx.lineTo(x - size * 0.5, y - size * 0.5); ctx.quadraticCurveTo(x, y - size * 1.5, x + size * 0.5, y - size * 0.5); ctx.lineTo(x + size * 0.5, y); ctx.fill(); }
}
// stone balustrade with vase-shaped balusters
function balustrade(ctx, x0, x1, topY, h, pal, o = {}) {
  const rail = h * 0.14, foot = h * 0.12, bw = h * 0.3, gap = o.gap || h * 0.42;
  const n = Math.round((x1 - x0) / gap), step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const x = x0 + step * (i + 0.5), y0 = topY + rail, y1 = topY + h - foot, bh = y1 - y0;
    const g = ctx.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0);
    g.addColorStop(0, rgba(pal.light)); g.addColorStop(0.5, rgba(pal.mid)); g.addColorStop(1, rgba(pal.shadow));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - bw * 0.2, y0);
    ctx.bezierCurveTo(x - bw * 0.22, y0 + bh * 0.3, x - bw * 0.62, y0 + bh * 0.5, x - bw * 0.42, y0 + bh * 0.8);
    ctx.quadraticCurveTo(x - bw * 0.3, y1, x - bw * 0.3, y1); ctx.lineTo(x + bw * 0.3, y1);
    ctx.quadraticCurveTo(x + bw * 0.3, y1, x + bw * 0.42, y0 + bh * 0.8);
    ctx.bezierCurveTo(x + bw * 0.62, y0 + bh * 0.5, x + bw * 0.22, y0 + bh * 0.3, x + bw * 0.2, y0); ctx.fill();
    ctx.strokeStyle = rgba(pal.line, 0.3); ctx.lineWidth = 1.3; ctx.stroke();
  }
  const band = (y, hh, grow) => { const g = ctx.createLinearGradient(0, y, 0, y + hh); g.addColorStop(0, rgba(pal.light)); g.addColorStop(0.55, rgba(pal.mid)); g.addColorStop(1, rgba(pal.shadow)); ctx.fillStyle = g; ctx.fillRect(x0 - grow, y, x1 - x0 + grow * 2, hh); ink(ctx, () => { ctx.beginPath(); ctx.rect(x0 - grow, y, x1 - x0 + grow * 2, hh); }, pal.line, 1.4, 0.3); };
  band(topY, rail, 0); band(topY + h - foot, foot, 0);
  ctx.fillStyle = rgba(pal.hi || pal.light, 0.7); ctx.fillRect(x0, topY, x1 - x0, rail * 0.22);
}
