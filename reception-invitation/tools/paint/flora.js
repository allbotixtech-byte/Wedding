/* Flowers, foliage and trees, painted as layered gouache dabs. */
'use strict';

const FLOWER = {
  blush: { deep: '#b56f7b', dark: '#dc9ea2', mid: '#f2c6c4', light: '#fbe2dd', hi: '#fff6f0' },
  ivory: { deep: '#ae8f66', dark: '#d8c29d', mid: '#f1e3ca', light: '#fbf2e0', hi: '#ffffff' },
  rose: { deep: '#84364f', dark: '#b4566d', mid: '#d68798', light: '#edb2bc', hi: '#fbdde1' },
  wine: { deep: '#3a0d1a', dark: '#5c1929', mid: '#82283b', light: '#a64659', hi: '#cd7a87' },
  peach: { deep: '#bd774f', dark: '#e0a079', mid: '#f5c5a2', light: '#fddfc5', hi: '#fff3e5' },
  lavender: { deep: '#5a4783', dark: '#836fae', mid: '#ad9cd2', light: '#d1c4e9', hi: '#f0eafa' },
  marigold: { deep: '#a4460a', dark: '#d5680e', mid: '#ee8c14', light: '#ffb238', hi: '#ffd778' },
  gold: { deep: '#ab7610', dark: '#d69d1a', mid: '#f0be2e', light: '#ffda5c', hi: '#fff0a6' },
};
const LEAF = { sage: '#8fa98c', deep: '#3f6248', olive: '#6f8452', euca: '#9bb8a6', dark: '#27483a', night: '#1c3a3a', lime: '#9fb56a' };

// re-tint a flower palette (e.g. dusk or night lighting)
function tintPal(pal, col, amt, dark = 0) {
  const o = {};
  for (const k in pal) o[k] = shade(mix(pal[k], col, amt), -dark);
  return o;
}

function leaf(ctx, x, y, len, ang, col, rnd, o = {}) {
  const w = len * (o.wide || 0.32) * (0.8 + rnd() * 0.4);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, -w * 0.6, 0, w * 0.6);
  g.addColorStop(0, rgba(shade(col, 0.14))); g.addColorStop(0.5, rgba(col)); g.addColorStop(1, rgba(shade(col, -0.18)));
  ctx.fillStyle = g; ctx.globalAlpha = o.a ?? 1;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.25, -w, len * 0.7, -w * 0.8, len, 0);
  ctx.bezierCurveTo(len * 0.7, w * 0.8, len * 0.25, w, 0, 0); ctx.fill();
  if (o.vein !== false && len > 14) {
    ctx.strokeStyle = rgba(shade(col, 0.3), 0.45); ctx.lineWidth = Math.max(0.8, len * 0.022);
    ctx.beginPath(); ctx.moveTo(len * 0.06, 0); ctx.quadraticCurveTo(len * 0.5, -w * 0.1, len * 0.94, 0); ctx.stroke();
  }
  ctx.restore();
}

function _petal(ctx, d, a, pr, col, edge, rnd) {
  ctx.save(); ctx.rotate(a); ctx.translate(d, 0);
  ctx.fillStyle = rgba(shade(col, -0.32), 0.3); ctx.beginPath(); ctx.ellipse(-pr * 0.06, 0, pr * 0.92, pr * 1.08, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(-pr * 0.55, 0, pr * 0.05, -pr * 0.1, 0, pr * 1.05);
  g.addColorStop(0, rgba(shade(col, -0.2))); g.addColorStop(0.6, rgba(col)); g.addColorStop(1, rgba(shade(col, 0.16)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, pr * 0.82, pr * (0.94 + rnd() * 0.1), 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(edge, 0.55); ctx.lineWidth = Math.max(0.7, pr * 0.07); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(0, 0, pr * 0.74, pr * 0.86, 0, -0.9, 0.9); ctx.stroke();
  ctx.restore();
}
// garden rose seen from the front: rings of overlapping petals around a tight spiral
function rose(ctx, x, y, r, pal, rnd) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * TAU);
  const rings = r > 22 ? [[6, 0.5, 0.56, 0.0], [5, 0.3, 0.45, 0.18], [4, 0.14, 0.34, 0.36]] : [[5, 0.46, 0.58, 0.0], [4, 0.2, 0.42, 0.3]];
  for (const [n, dist, size, dk] of rings) {
    const off = rnd() * TAU;
    for (let i = 0; i < n; i++) {
      const col = mix(mix(pal.light, pal.mid, 0.25 + rnd() * 0.5), pal.dark, dk + rnd() * 0.12);
      _petal(ctx, r * dist, off + (i / n) * TAU + (rnd() - 0.5) * 0.25, r * size * (0.92 + rnd() * 0.16), col, pal.hi, rnd);
    }
  }
  disc(ctx, 0, 0, r * 0.2, mix(pal.dark, pal.deep, 0.45));
  ctx.strokeStyle = rgba(pal.deep, 0.6); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.8, r * 0.045);
  for (let k = 0; k < 3; k++) { const s = rnd() * TAU; ctx.beginPath(); ctx.arc(0, 0, r * (0.06 + 0.065 * k), s, s + 3.9 - k * 0.6); ctx.stroke(); }
  ctx.strokeStyle = rgba(pal.light, 0.5); ctx.lineWidth = Math.max(0.6, r * 0.03);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0.5, 2.4); ctx.stroke();
  ctx.restore();
}
function marigold(ctx, x, y, r, pal, rnd) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * TAU);
  disc(ctx, 0, 0, r, pal.dark);
  const rings = [[15, 0.8, 0.25], [12, 0.6, 0.23], [9, 0.4, 0.21], [6, 0.2, 0.19]];
  rings.forEach(([n, dist, size], k) => {
    const off = rnd() * TAU;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * TAU + (rnd() - 0.5) * 0.2;
      const col = mix(pal.mid, k < 2 ? pal.light : pal.dark, 0.2 + rnd() * 0.55);
      ctx.save(); ctx.rotate(a); ctx.translate(r * dist, 0);
      ctx.fillStyle = rgba(pal.deep, 0.35); ctx.beginPath(); ctx.ellipse(-r * 0.03, 0, r * size, r * size * 0.86, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(col); ctx.beginPath(); ctx.ellipse(0, 0, r * size * 0.9, r * size * 0.74, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  });
  softDab(ctx, -r * 0.25, -r * 0.3, r * 0.7, pal.hi, 0.28);
  disc(ctx, 0, 0, r * 0.1, pal.deep, 0.7);
  ctx.restore();
}
function blossom(ctx, x, y, r, pal, rnd, centre = '#e9b949') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * TAU);
  for (let i = 0; i < 5; i++) {
    ctx.save(); ctx.rotate((i / 5) * TAU); ctx.translate(r * 0.5, 0);
    ctx.fillStyle = rgba(pal.dark, 0.5); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.56, r * 0.46, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(mix(pal.light, pal.hi, rnd() * 0.7)); ctx.beginPath(); ctx.ellipse(r * 0.03, 0, r * 0.5, r * 0.4, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  disc(ctx, 0, 0, r * 0.2, centre);
  ctx.restore();
}
function bud(ctx, x, y, r, ang, pal, leafCol, rnd) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ell(ctx, r * 0.9, 0, r, r * 0.62, 0, pal.mid); ell(ctx, r * 1.05, -r * 0.1, r * 0.7, r * 0.4, 0, pal.light, 0.8);
  ctx.strokeStyle = rgba(pal.dark, 0.7); ctx.lineWidth = Math.max(0.7, r * 0.1); ctx.beginPath(); ctx.arc(r * 0.9, 0, r * 0.5, -1, 1.6); ctx.stroke();
  ctx.restore();
  leaf(ctx, x, y, r * 1.5, ang - 0.5, leafCol, rnd, { vein: false, wide: 0.4 });
  leaf(ctx, x, y, r * 1.5, ang + 0.5, leafCol, rnd, { vein: false, wide: 0.4 });
}
// leafy stem that arcs away from a cluster
function sprig(ctx, x, y, len, ang, col, rnd, o = {}) {
  const bend = (o.bend ?? rnd.range(-0.5, 0.5)), n = o.n || Math.max(5, Math.round(len / 26));
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = ang + bend * t; pts.push([x + Math.cos(a) * len * t, y + Math.sin(a) * len * t]); }
  stroke(ctx, pts, Math.max(1.2, len * 0.012), shade(col, -0.25), 0.9);
  const L = len * (o.leaf || 0.2);
  for (let i = 1; i <= n; i++) {
    const t = i / n, [px, py] = pts[i], a = ang + bend * t, sz = L * (1 - t * 0.55);
    const c = jitter(col, rnd, 0.05);
    if (o.round) { ell(ctx, px + Math.cos(a + 1.3) * sz * 0.5, py + Math.sin(a + 1.3) * sz * 0.5, sz * 0.48, sz * 0.4, a, c); ell(ctx, px + Math.cos(a - 1.3) * sz * 0.5, py + Math.sin(a - 1.3) * sz * 0.5, sz * 0.48, sz * 0.4, a, shade(c, -0.08)); }
    else { leaf(ctx, px, py, sz, a + 0.75, c, rnd, { vein: false }); leaf(ctx, px, py, sz, a - 0.75, shade(c, -0.08), rnd, { vein: false }); }
  }
  leaf(ctx, pts[n][0], pts[n][1], L * 0.5, ang + bend, col, rnd, { vein: false });
}
function babysBreath(ctx, x, y, r, rnd, col = '#fff8ea') {
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU, d = r * Math.sqrt(rnd());
    stroke(ctx, [[x, y], [x + Math.cos(a) * d * 0.6, y + Math.sin(a) * d * 0.6], [x + Math.cos(a) * d, y + Math.sin(a) * d]], 0.9, '#a9b79a', 0.6);
    disc(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r * rnd.range(0.07, 0.13), col, 0.95);
  }
}
// hanging raceme of small florets
function wisteria(ctx, x, y, len, rnd, pal, o = {}) {
  const sway = o.sway ?? rnd.range(-0.12, 0.12) * len, rows = Math.round(len / (o.step || 7));
  const w0 = len * (o.width || 0.15);
  stroke(ctx, [[x, y], [x + sway * 0.4, y + len * 0.5], [x + sway, y + len]], 1.4, '#6f7d55', 0.8);
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < rows; i++) {
    const t = i / rows, w = w0 * Math.pow(1 - t, 0.75) + 2, cx = x + sway * t * t, cy = y + len * t;
    const k = pass === 0 ? 3 : 2 + (rnd() * 2 | 0);
    for (let j = 0; j < k; j++) {
      const px = cx + rnd.gauss() * w, py = cy + rnd.range(-4, 4), s = (o.size || 5.2) * (1 - t * 0.5) * rnd.range(0.8, 1.25);
      const col = pass === 0 ? mix(pal.deep, pal.dark, rnd()) : mix(pal.mid, t < 0.5 ? pal.light : pal.dark, rnd() * 0.8);
      ell(ctx, px, py, s, s * 0.72, rnd() * TAU, col, 0.95);
      if (pass === 1 && rnd() < 0.3) ell(ctx, px - s * 0.2, py - s * 0.25, s * 0.45, s * 0.3, 0, pal.hi, 0.75);
    }
  }
}

/* A lush arrangement: sprigs, leaves, big blooms, fillers.
   s ~ radius in px. o.pals = [[palette, weight], ...] */
function floralCluster(ctx, x, y, s, rnd, o = {}) {
  const pals = o.pals || [[FLOWER.blush, 3], [FLOWER.ivory, 3], [FLOWER.rose, 1]];
  const leafCols = o.leaves || [LEAF.sage, LEAF.deep, LEAF.euca, LEAF.olive];
  const sx = o.sx || 1, sy = o.sy || 1, rot = o.rot || 0, n = o.n || 9;
  const pickPal = () => { let t = rnd() * pals.reduce((a, p) => a + p[1], 0); for (const p of pals) { if ((t -= p[1]) <= 0) return p[0]; } return pals[0][0]; };
  const place = (d, a) => { const px = Math.cos(a) * d * sx, py = Math.sin(a) * d * sy; return [x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)]; };
  // 1. airy sprigs reaching out
  const ns = o.sprigs ?? 9;
  for (let i = 0; i < ns; i++) {
    const a = rnd() * TAU, [px, py] = place(s * 0.35, a);
    sprig(ctx, px, py, s * rnd.range(0.7, 1.25) * (o.sprigLen || 1), a + rot + rnd.range(-0.3, 0.3), rnd.pick(leafCols), rnd, { round: rnd() < 0.35, leaf: rnd.range(0.16, 0.24) });
  }
  // 2. broad leaves under the blooms
  for (let i = 0; i < n * 2.2; i++) {
    const a = rnd() * TAU, [px, py] = place(s * rnd.range(0.3, 0.75), a);
    leaf(ctx, px, py, s * rnd.range(0.3, 0.5), a + rot + rnd.range(-0.5, 0.5), jitter(rnd.pick(leafCols), rnd, 0.05), rnd);
  }
  // 3. blooms, outer small ones first, large hero blooms last
  const blooms = [];
  for (let i = 0; i < n; i++) {
    const big = i < Math.ceil(n * 0.3), d = big ? s * rnd.range(0, 0.3) : s * rnd.range(0.3, 0.82);
    blooms.push({ p: place(d, rnd() * TAU), r: s * (big ? rnd.range(0.24, 0.32) : rnd.range(0.12, 0.2)), pal: pickPal() });
  }
  blooms.sort((a, b) => a.r - b.r);
  for (const b of blooms) {
    softDab(ctx, b.p[0] + b.r * 0.18, b.p[1] + b.r * 0.25, b.r * 1.25, '#2a1a2e', 0.28);
    if (b.pal === FLOWER.marigold || b.pal === FLOWER.gold || b.pal._marigold) marigold(ctx, b.p[0], b.p[1], b.r * 0.9, b.pal, rnd);
    else rose(ctx, b.p[0], b.p[1], b.r, b.pal, rnd);
  }
  // 4. fillers
  for (let i = 0; i < n * 0.9; i++) {
    const [px, py] = place(s * rnd.range(0.25, 0.95), rnd() * TAU), t = rnd();
    if (t < 0.45) blossom(ctx, px, py, s * rnd.range(0.06, 0.1), rnd.pick([FLOWER.ivory, FLOWER.blush, FLOWER.peach]), rnd);
    else if (t < 0.75) babysBreath(ctx, px, py, s * 0.22, rnd);
    else bud(ctx, px, py, s * 0.07, rnd() * TAU, pickPal(), rnd.pick(leafCols), rnd);
  }
}
// string of marigolds along a path
function garland(ctx, pts, r, rnd, o = {}) {
  const pal = o.pals || [FLOWER.marigold, FLOWER.gold];
  let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const n = Math.max(3, Math.round(L / (r * 1.25))), P = sampleCurve(pts, n);
  P.forEach(([x, y], i) => softDab(ctx, x + r * 0.2, y + r * 0.35, r * 1.3, '#2a1420', 0.22));
  P.forEach(([x, y], i) => {
    if (o.leafEvery && i % o.leafEvery === 0) leaf(ctx, x, y, r * 2, rnd() * TAU, LEAF.deep, rnd, { vein: false });
    marigold(ctx, x + rnd.range(-1, 1) * r * 0.12, y + rnd.range(-1, 1) * r * 0.12, r * rnd.range(0.9, 1.08), pal[(i + (o.shift || 0)) % pal.length], rnd);
  });
}

/* ---------- trees & shrubs ---------- */
function leafDabs(ctx, cx, cy, R, pal, rnd, o = {}) {
  const light = o.light || [-0.55, -0.83], ls = o.leaf || Math.max(3.2, R * 0.075), sx = o.sx || 1, sy = o.sy || 1;
  const n = Math.round(((R * R * sx * sy) / (ls * ls)) * (o.density || 0.85)), dabs = [];
  for (let j = 0; j < n; j++) {
    const a = rnd() * TAU, rr = Math.sqrt(rnd()) * 1.04, nx = Math.cos(a) * rr, ny = Math.sin(a) * rr;
    let l = clamp((nx * light[0] + ny * light[1]) * 0.55 + 0.5 + (rnd() - 0.5) * 0.36);
    if (o.rim) l = Math.max(l, clamp(ny * 0.9 - 0.25) * o.rim * rnd());
    dabs.push([cx + nx * R * sx, cy + ny * R * sy, l]);
  }
  dabs.sort((a, b) => a[2] - b[2]);
  const stops = [[0, pal.base], [0.42, pal.mid], [0.78, pal.light], [1, pal.hi]];
  for (const [x, y, l] of dabs) {
    const col = jitter(ramp(stops, l), rnd, 0.035);
    ctx.fillStyle = rgba(col, 0.94); ctx.beginPath();
    ctx.ellipse(x, y, ls * rnd.range(0.6, 1.25), ls * rnd.range(0.32, 0.62), rnd() * Math.PI, 0, TAU); ctx.fill();
  }
}
function canopy(ctx, cx, cy, R, pal, rnd, o = {}) {
  const k = o.clusters || 7, cl = [{ x: cx, y: cy, r: R * 0.62 }];
  for (let i = 0; i < k; i++) {
    const a = rnd() * TAU, d = R * rnd.range(0.25, 0.62);
    cl.push({ x: cx + Math.cos(a) * d * (o.sx || 1.12), y: cy + Math.sin(a) * d * (o.sy || 0.8), r: R * rnd.range(0.3, 0.5) });
  }
  for (const c of cl) blob(ctx, c.x, c.y, c.r * 1.02, mix(pal.base, pal.mid, 0.3), rnd, { rough: 0.16, n: 11 });
  cl.sort((a, b) => b.y - a.y); // lower clumps first so upper, lit clumps overlap them
  for (const c of cl) leafDabs(ctx, c.x, c.y, c.r, pal, rnd, o);
  return cl;
}
function tree(ctx, x, groundY, h, pal, rnd, o = {}) {
  const R = h * (o.crown || 0.36), cy = groundY - h + R * 0.9, lean = o.lean || 0;
  const trunk = o.trunk || '#2b2230';
  const base = [[x, groundY], [x + lean * 0.3, groundY - h * 0.3], [x + lean, cy + R * 0.2]];
  taper(ctx, base, h * 0.085, h * 0.04, trunk);
  ctx.fillStyle = rgba(trunk); ctx.beginPath(); ctx.moveTo(x - h * 0.075, groundY + h * 0.012); ctx.quadraticCurveTo(x - h * 0.03, groundY - h * 0.01, x - h * 0.03, groundY - h * 0.09); ctx.lineTo(x + h * 0.03, groundY - h * 0.09); ctx.quadraticCurveTo(x + h * 0.03, groundY - h * 0.01, x + h * 0.075, groundY + h * 0.012); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.48 + rnd.range(-0.15, 0.15);
    taper(ctx, [[x + lean, cy + R * 0.3], [x + lean + Math.cos(a) * R * 0.4, cy + R * 0.3 + Math.sin(a) * R * 0.4], [x + lean + Math.cos(a) * R * 0.75, cy + R * 0.2 + Math.sin(a) * R * 0.7]], h * 0.034, h * 0.012, trunk);
  }
  if (o.trunkLight) stroke(ctx, base.map(([px, py]) => [px - h * 0.018, py]), h * 0.012, o.trunkLight, 0.55);
  return canopy(ctx, x + lean, cy, R, pal, rnd, o);
}
// tall, slim cypress
function cypress(ctx, x, groundY, h, w, pal, rnd, o = {}) {
  taper(ctx, [[x, groundY], [x, groundY - h * 0.2]], w * 0.16, w * 0.12, o.trunk || '#2a2030');
  const y0 = groundY - h * 0.12, y1 = groundY - h;
  ctx.fillStyle = rgba(mix(pal.base, pal.mid, 0.3)); ctx.beginPath(); ctx.moveTo(x, y1);
  ctx.bezierCurveTo(x + w * 0.5, y1 + h * 0.3, x + w * 0.62, y0 - h * 0.12, x + w * 0.2, y0);
  ctx.lineTo(x - w * 0.2, y0); ctx.bezierCurveTo(x - w * 0.62, y0 - h * 0.12, x - w * 0.5, y1 + h * 0.3, x, y1); ctx.fill();
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), cy = lerp(y0 - w * 0.3, y1 + w * 0.3, t), r = w * lerp(0.5, 0.2, t * t);
    leafDabs(ctx, x, cy, r, pal, rnd, { ...o, sy: 1.5, leaf: Math.max(2.6, w * 0.07) });
  }
}
function bush(ctx, x, groundY, w, h, pal, rnd, o = {}) {
  const cl = [];
  const k = Math.max(3, Math.round(w / (h * 0.7)));
  for (let i = 0; i < k; i++) cl.push({ x: x - w / 2 + (w * (i + 0.5)) / k + rnd.range(-0.1, 0.1) * w / k, y: groundY - h * rnd.range(0.42, 0.6), r: h * rnd.range(0.48, 0.62) });
  for (const c of cl) blob(ctx, c.x, c.y, c.r, pal.base, rnd, { rough: 0.14 });
  ctx.fillStyle = rgba(pal.base); ctx.fillRect(x - w / 2, groundY - h * 0.4, w, h * 0.42);
  for (const c of cl) leafDabs(ctx, c.x, c.y, c.r, pal, rnd, o);
  if (o.flowers) for (let i = 0; i < o.flowers; i++) {
    const c = rnd.pick(cl), a = rnd() * TAU, d = c.r * Math.sqrt(rnd()) * 0.9;
    const fp = rnd.pick(o.flowerPals || [FLOWER.blush, FLOWER.ivory]);
    const fx = c.x + Math.cos(a) * d, fy = c.y + Math.sin(a) * d * 0.9, fr = (o.flowerSize || h * 0.07) * rnd.range(0.7, 1.3);
    if (fr > 9) rose(ctx, fx, fy, fr, fp, rnd); else { disc(ctx, fx, fy, fr, fp.mid); disc(ctx, fx - fr * 0.2, fy - fr * 0.2, fr * 0.55, fp.light); }
  }
}
function grassTufts(ctx, x0, x1, y, n, col, rnd, h = 14) {
  for (let i = 0; i < n; i++) {
    const x = rnd.range(x0, x1), yy = y + rnd.range(-3, 3), k = 3 + (rnd() * 3 | 0);
    for (let j = 0; j < k; j++) {
      const a = -Math.PI / 2 + rnd.range(-0.7, 0.7), l = h * rnd.range(0.6, 1.3);
      stroke(ctx, [[x, yy], [x + Math.cos(a) * l * 0.5, yy + Math.sin(a) * l * 0.6], [x + Math.cos(a) * l, yy + Math.sin(a) * l]], rnd.range(1, 2), jitter(col, rnd, 0.06), 0.9);
    }
  }
}

const FOLIAGE = {
  twilight: { base: '#13292f', mid: '#22463f', light: '#3f6f55', hi: '#7ea873' },
  dusk: { base: '#1d2f3d', mid: '#2f5148', light: '#56805c', hi: '#a2bf7c' },
  warm: { base: '#27382a', mid: '#47663c', light: '#7d9a52', hi: '#c7cf7b' },
  night: { base: '#0c1a2c', mid: '#16303c', light: '#27504a', hi: '#4f8061' },
  sage: { base: '#3c5547', mid: '#5f7f66', light: '#8eab85', hi: '#c5d6a8' },
  far: { base: '#3a4a6e', mid: '#4d6280', light: '#6d8494', hi: '#9aa9a6' },
};
