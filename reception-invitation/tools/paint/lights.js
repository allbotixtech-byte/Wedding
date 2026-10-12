/* Light sources: lanterns, fairy lights, chandeliers, candles, moon and stars. */
'use strict';

function bulb(ctx, x, y, s, col = '#ffcf7a', a = 1) {
  glow(ctx, x, y, s * 8, col, 0.22 * a); glow(ctx, x, y, s * 3.2, '#ffe6b0', 0.5 * a);
  disc(ctx, x, y, s, '#fffbe9', a);
}
// bulbs along a wire; if `groups` (array of contexts) is given the bulbs are split between them so they can twinkle
function fairyString(ctx, pts, spacing, s, rnd, o = {}) {
  if (o.wire !== false) stroke(ctx, pts, 1.1, o.wireCol || '#20182a', 0.45);
  let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const P = sampleCurve(pts, Math.max(2, Math.round(L / spacing)));
  P.forEach(([x, y], i) => {
    const c = o.groups ? o.groups[(i + (o.shift || 0)) % o.groups.length] : ctx;
    bulb(c, x + rnd.range(-1, 1), y + rnd.range(-1, 1) + (o.drop || 0), s * rnd.range(0.8, 1.2), o.col, o.a ?? 1);
  });
}
function lightPool(ctx, x, y, rx, ry, col, a) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.globalCompositeOperation = 'lighter';
  softDab(ctx, 0, 0, rx, col, a); ctx.restore();
}
function bokeh(ctx, x, y, r, col, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a * 0.75)); g.addColorStop(0.78, rgba(col, a * 0.8)); g.addColorStop(0.9, rgba(shade(col, 0.3), a)); g.addColorStop(1, rgba(col, 0));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
}

// ornate hanging lantern; (x, y) is the top hook, s the half-width of the glass
function lantern(ctx, x, y, s, o = {}) {
  const metal = o.metal || '#4a2f1c', hi = o.hi || '#c79a52', warm = o.warm || '#ffb347';
  if (o.chain) stroke(ctx, [[x, y - o.chain], [x, y]], Math.max(1, s * 0.06), metal, 0.9);
  const ga = o.glowA ?? 1;
  if (o.glow !== false) { glow(ctx, x, y + s * 1.6, s * (o.glowR || 6.5), warm, 0.36 * ga); glow(ctx, x, y + s * 1.6, s * 2.6, '#ffe2a6', 0.5 * ga); }
  ctx.save(); ctx.translate(x, y);
  // roof
  ctx.fillStyle = rgba(metal); ctx.beginPath(); ctx.arc(0, s * 0.12, s * 0.12, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, s * 0.2); ctx.bezierCurveTo(s * 0.1, s * 0.5, s * 0.5, s * 0.5, s * 0.62, s * 0.82);
  ctx.lineTo(-s * 0.62, s * 0.82); ctx.bezierCurveTo(-s * 0.5, s * 0.5, -s * 0.1, s * 0.5, 0, s * 0.2); ctx.fill();
  // glass
  const g = ctx.createRadialGradient(0, s * 1.6, s * 0.1, 0, s * 1.6, s * 1.05);
  g.addColorStop(0, '#fffbe2'); g.addColorStop(0.45, '#ffd778'); g.addColorStop(1, '#e8892c');
  ctx.fillStyle = g; ctx.beginPath();
  ctx.moveTo(-s * 0.55, s * 0.9); ctx.lineTo(-s * 0.72, s * 1.6); ctx.lineTo(-s * 0.46, s * 2.34); ctx.lineTo(s * 0.46, s * 2.34); ctx.lineTo(s * 0.72, s * 1.6); ctx.lineTo(s * 0.55, s * 0.9); ctx.closePath(); ctx.fill();
  // frame
  ctx.strokeStyle = rgba(metal); ctx.lineWidth = Math.max(1, s * 0.075); ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-s * 0.72, s * 1.6); ctx.lineTo(s * 0.72, s * 1.6);
  ctx.moveTo(0, s * 0.9); ctx.lineTo(0, s * 2.34);
  ctx.moveTo(-s * 0.28, s * 0.9); ctx.lineTo(-s * 0.37, s * 1.6); ctx.lineTo(-s * 0.23, s * 2.34);
  ctx.moveTo(s * 0.28, s * 0.9); ctx.lineTo(s * 0.37, s * 1.6); ctx.lineTo(s * 0.23, s * 2.34); ctx.stroke();
  ctx.fillStyle = rgba(metal); ctx.fillRect(-s * 0.62, s * 0.8, s * 1.24, s * 0.13); ctx.fillRect(-s * 0.52, s * 2.3, s * 1.04, s * 0.13);
  ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 2.43); ctx.lineTo(0, s * 2.78); ctx.lineTo(s * 0.3, s * 2.43); ctx.fill();
  ctx.beginPath(); ctx.arc(0, s * 2.86, s * 0.09, 0, TAU); ctx.fill();
  // metal highlight
  ctx.strokeStyle = rgba(hi, 0.8); ctx.lineWidth = Math.max(0.8, s * 0.04);
  ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.3); ctx.bezierCurveTo(-s * 0.15, s * 0.5, -s * 0.42, s * 0.55, -s * 0.52, s * 0.78); ctx.stroke();
  ctx.restore();
}
// floor-standing lantern post
function lanternPost(ctx, x, groundY, h, s, o = {}) {
  const metal = o.metal || '#3a2a22';
  taper(ctx, [[x, groundY], [x, groundY - h]], s * 0.34, s * 0.2, metal);
  ctx.fillStyle = rgba(metal); ctx.fillRect(x - s * 0.5, groundY - s * 0.16, s, s * 0.16);
  stroke(ctx, [[x, groundY - h], [x + s * 0.5, groundY - h - s * 0.9], [x + s * 1.4, groundY - h - s * 0.6]], s * 0.14, metal, 1);
  lantern(ctx, x + s * 1.4, groundY - h - s * 0.55, s, o);
}
function candle(ctx, x, y, h, o = {}) {
  const w = h * (o.w || 0.3);
  const ga = o.glowA ?? 1;
  glow(ctx, x, y - h - w * 0.8, h * (o.glowR || 2.6), '#ffb650', 0.34 * ga); glow(ctx, x, y - h - w * 0.8, h * 0.9, '#ffe9b0', 0.55 * ga);
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, '#fff3d6'); g.addColorStop(1, '#e2bf8a');
  ctx.fillStyle = g; ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = '#fff8d8'; ctx.beginPath(); ctx.ellipse(x, y - h - w * 0.85, w * 0.34, w * 0.85, 0, 0, TAU); ctx.fill();
}
function diya(ctx, x, y, s) {
  glow(ctx, x, y - s * 0.9, s * 5, '#ffad42', 0.3); glow(ctx, x, y - s * 0.9, s * 1.8, '#ffe7a8', 0.6);
  ctx.fillStyle = '#8a4a26'; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.42, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#c47a3e'; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff6cf'; ctx.beginPath(); ctx.ellipse(x, y - s * 0.75, s * 0.24, s * 0.62, 0, 0, TAU); ctx.fill();
}

// crystal chandelier; (x, y) is the ceiling point, s the unit (overall ~6s wide, ~6s tall)
function chandelier(ctx, x, y, s, rnd, o = {}) {
  const gold = o.gold || '#d8b46a', dk = '#7d5f2a', hi = '#fff3c9';
  const L = o.lights || ctx; // flames can go to a separate (twinkling) layer
  glow(ctx, x, y + s * 3.3, s * 7, '#ffbf66', 0.3); glow(ctx, x, y + s * 3.2, s * 3.6, '#ffe2a8', 0.34);
  stroke(ctx, [[x, y - (o.chain || 0)], [x, y + s * 1.5]], Math.max(1, s * 0.07), dk, 0.95);
  ell(ctx, x, y + s * 1.5, s * 0.5, s * 0.2, 0, gold);
  stroke(ctx, [[x, y + s * 1.5], [x, y + s * 4.6]], s * 0.16, gold, 1);
  for (const [yy, r] of [[2.0, 0.26], [2.9, 0.34], [4.1, 0.3]]) { disc(ctx, x, y + s * yy, s * r, gold); disc(ctx, x - s * r * 0.3, y + s * yy - s * r * 0.3, s * r * 0.4, hi, 0.8); }
  const tiers = [[6, 1.55, 2.9, 2.55, 0.34], [8, 2.75, 4.0, 3.5, 0.4]];
  for (const [n, rad, y0, y1, ry] of tiers) {
    const ends = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + 0.26; ends.push({ a, ex: x + Math.cos(a) * rad * s, ey: y + s * y1 + Math.sin(a) * rad * s * ry, back: Math.sin(a) < 0 }); }
    ends.sort((p, q) => (q.back ? 1 : 0) - (p.back ? 1 : 0));
    for (const e of ends) {
      const al = e.back ? 0.6 : 1;
      stroke(ctx, [[x, y + s * y0], [lerp(x, e.ex, 0.45), y + s * (y0 + 0.75)], [lerp(x, e.ex, 0.85), y + s * (y0 + 0.55)], [e.ex, e.ey]], s * 0.085, e.back ? dk : gold, al);
      ell(ctx, e.ex, e.ey, s * 0.2, s * 0.09, 0, gold, al);
      ctx.fillStyle = rgba('#fff5dc', al); ctx.fillRect(e.ex - s * 0.055, e.ey - s * 0.5, s * 0.11, s * 0.5);
      bulb(L, e.ex, e.ey - s * 0.62, s * 0.085, '#ffc470', al);
      // crystal drop
      stroke(ctx, [[e.ex, e.ey + s * 0.08], [e.ex, e.ey + s * 0.4]], 0.9, hi, 0.6 * al);
      ctx.fillStyle = rgba(hi, 0.85 * al); ctx.beginPath(); ctx.ellipse(e.ex, e.ey + s * 0.52, s * 0.07, s * 0.13, 0, 0, TAU); ctx.fill();
    }
    // bead swags between neighbouring arms
    const ring = ends.slice().sort((p, q) => p.a - q.a);
    for (let i = 0; i < n; i++) {
      const p = ring[i], q = ring[(i + 1) % n], al = p.back && q.back ? 0.4 : 0.85;
      const pts = catenary(p.ex, p.ey + s * 0.06, q.ex, q.ey + s * 0.06, s * 0.55, 12);
      for (const [bx, by] of pts) disc(ctx, bx, by, s * 0.04, hi, al);
    }
  }
  ctx.fillStyle = rgba(hi, 0.9); ctx.beginPath(); ctx.ellipse(x, y + s * 5.0, s * 0.16, s * 0.34, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < 16; i++) { const a = rnd() * TAU, d = rnd.range(0.6, 3) * s; disc(ctx, x + Math.cos(a) * d, y + s * 3.4 + Math.sin(a) * d * 0.5, s * rnd.range(0.02, 0.05), '#ffffff', rnd.range(0.4, 0.9)); }
}

function starfield(ctx, w, yMax, n, rnd, o = {}) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = Math.pow(rnd(), o.bias || 1.6) * yMax, r = rnd() < 0.08 ? rnd.range(1.5, 2.4) : rnd.range(0.5, 1.4);
    const a = rnd.range(0.35, 1) * (1 - (y / yMax) * 0.75);
    disc(ctx, x, y, r, rnd() < 0.3 ? '#ffe9c4' : '#f4f1ff', a);
    if (r > 1.5) glow(ctx, x, y, r * 6, '#cfd6ff', a * 0.35);
  }
}
function moon(ctx, x, y, r, o = {}) {
  const col = o.col || '#fff3d0';
  glow(ctx, x, y, r * 9, o.halo || '#b9a6e8', 0.16); glow(ctx, x, y, r * 4.2, '#ffe9c2', 0.24); glow(ctx, x, y, r * 2, '#fff6dc', 0.4);
  const M = layer(Math.ceil(r * 4), Math.ceil(r * 4)), m = M.ctx, c = r * 2;
  const g = m.createRadialGradient(c - r * 0.3, c - r * 0.3, r * 0.1, c, c, r);
  g.addColorStop(0, '#fffdf2'); g.addColorStop(1, rgba(col));
  m.fillStyle = g; m.beginPath(); m.arc(c, c, r, 0, TAU); m.fill();
  if (o.crescent) { m.globalCompositeOperation = 'destination-out'; m.filter = 'blur(1.5px)'; m.beginPath(); m.arc(c + r * o.crescent, c - r * 0.18, r * 0.98, 0, TAU); m.fill(); }
  else { m.globalCompositeOperation = 'source-atop'; softDab(m, c + r * 0.3, c - r * 0.2, r * 0.4, '#d9c8b8', 0.22); softDab(m, c - r * 0.25, c + r * 0.35, r * 0.34, '#d9c8b8', 0.18); softDab(m, c - r * 0.4, c - r * 0.3, r * 0.22, '#d9c8b8', 0.14); }
  ctx.drawImage(M.c, x - c, y - c);
}
