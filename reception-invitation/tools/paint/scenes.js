/* The illustrated background plates. Each plate is a 2304 x 2304 square whose centre stays on the centre of
   the screen: a 9:16 phone shows the middle vertical strip, a 16:9 screen the middle horizontal band. */
'use strict';
const PLATES = {};
const S = 2304, C = S / 2;

/* ---- primitive test sheet (not shipped) ---- */
PLATES.test = function () {
  const L = layer(S, S), ctx = L.ctx, rnd = makeRnd(7);
  ctx.fillStyle = '#5a5378'; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#e9dcc6'; ctx.fillRect(0, 1500, S, 804);
  let x = 120;
  for (const k of ['blush', 'ivory', 'rose', 'wine', 'peach', 'lavender']) { rose(ctx, x, 130, 90, FLOWER[k], rnd); rose(ctx, x + 40, 300, 40, FLOWER[k], rnd); rose(ctx, x - 40, 300, 18, FLOWER[k], rnd); x += 230; }
  marigold(ctx, x, 130, 80, FLOWER.marigold, rnd); marigold(ctx, x + 180, 130, 60, FLOWER.gold, rnd); marigold(ctx, x, 300, 28, FLOWER.marigold, rnd);
  blossom(ctx, x + 180, 300, 30, FLOWER.ivory, rnd); bud(ctx, x + 260, 300, 16, 0.4, FLOWER.rose, LEAF.deep, rnd);
  floralCluster(ctx, 330, 700, 250, rnd, {});
  floralCluster(ctx, 900, 700, 200, rnd, { pals: [[FLOWER.wine, 2], [FLOWER.rose, 2], [FLOWER.blush, 2], [FLOWER.ivory, 1]] });
  floralCluster(ctx, 1400, 660, 160, rnd, { pals: [[FLOWER.marigold, 3], [FLOWER.gold, 2], [FLOWER.ivory, 1]], sprigs: 5 });
  garland(ctx, catenary(1150, 420, 1800, 420, 120), 22, rnd);
  for (let i = 0; i < 7; i++) wisteria(ctx, 1700 + i * 60, 560, rnd.range(200, 380), rnd, FLOWER.lavender);
  tree(ctx, 2050, 1500, 620, FOLIAGE.dusk, rnd, {});
  tree(ctx, 300, 1500, 480, FOLIAGE.twilight, rnd, { rim: 0.6 });
  bush(ctx, 700, 1500, 380, 150, FOLIAGE.warm, rnd, { flowers: 14 });
  const stone = { light: '#f3dcc0', mid: '#d9b99a', shadow: '#a98a82', line: '#4a2f33', gold: '#d9b25e' };
  column(ctx, 1080, 1500, 440, 54, stone);
  dome(ctx, 1300, 1500, 220, 240, stone, { ribs: true });
  chhatri(ctx, 1560, 1500, 200, 360, stone, { glow: '#ffb347' });
  const a = cuspedArch(1800, 1500, 220, 400); ctx.fillStyle = '#ffcf7a'; polyPath(ctx, a); ctx.fill(); ink(ctx, () => polyPath(ctx, a), '#4a2f33', 2, 0.5);
  balustrade(ctx, 100, 1300, 1700, 190, stone);
  lantern(ctx, 300, 1960, 44, { chain: 60 }); lantern(ctx, 520, 1990, 26, { chain: 90 });
  lanternPost(ctx, 760, 2260, 250, 30);
  ctx.fillStyle = '#1b1f48'; ctx.fillRect(1380, 1560, 924, 744);
  chandelier(ctx, 1640, 1600, 60, rnd, { chain: 40 }); chandelier(ctx, 2060, 1600, 34, rnd, { chain: 40 });
  fairyString(ctx, catenary(1400, 2150, 2280, 2120, 70), 34, 3.2, rnd);
  candle(ctx, 1500, 2280, 70); diya(ctx, 1600, 2270, 16); moon(ctx, 2180, 2000, 46, { crescent: 0.42 }); moon(ctx, 2050, 2240, 30);
  bokeh(ctx, 1900, 2000, 40, '#ffc978', 0.35);
  grain(ctx, S, S, 0.07);
  return { test: L.c };
};

/* ---------- shared scene helpers ---------- */
function skyGradient(ctx, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, S);
  for (const [t, c] of stops) g.addColorStop(t, rgba(c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
}
// long soft stratus streak lit from below
function streakCloud(ctx, x, y, w, h, body, lit, rnd, a = 0.8) {
  const n = 5 + (rnd() * 4 | 0);
  for (let i = 0; i < n; i++) {
    const px = x + rnd.range(-0.35, 0.35) * w, py = y + rnd.range(-0.5, 0.5) * h, rw = w * rnd.range(0.3, 0.6), rh = h * rnd.range(0.35, 0.7);
    ctx.save(); ctx.translate(px, py); ctx.scale(1, rh / rw);
    softDab(ctx, 0, 0, rw, body, a * rnd.range(0.35, 0.6)); softDab(ctx, 0, rw * 0.35, rw * 0.85, lit, a * rnd.range(0.3, 0.55));
    ctx.restore();
  }
}
// billowing cumulus lit from one side
function cumulus(ctx, x, y, w, h, pal, rnd, a = 1) {
  const puffs = [], n = 9 + (rnd() * 5 | 0);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), px = x + (t - 0.5) * w, env = Math.sin(t * Math.PI);
    puffs.push([px + rnd.range(-0.04, 0.04) * w, y - env * h * rnd.range(0.35, 0.95), (0.1 + env * 0.16) * w * rnd.range(0.8, 1.25)]);
  }
  for (const [px, py, r] of puffs) softDab(ctx, px, py + r * 0.25, r * 1.25, pal.shadow, 0.55 * a, 0.25);
  for (const [px, py, r] of puffs) softDab(ctx, px, py, r, pal.body, 0.7 * a, 0.35);
  for (const [px, py, r] of puffs) softDab(ctx, px + r * pal.dir[0] * 0.3, py + r * pal.dir[1] * 0.3, r * 0.62, pal.lit, 0.6 * a, 0.2);
  ctx.save(); ctx.translate(x, y + h * 0.12); ctx.scale(1, 0.16); softDab(ctx, 0, 0, w * 0.62, pal.shadow, 0.5 * a); ctx.restore();
}
function hillBand(ctx, noise, yBase, amp, freq, seed, fill, yBottom) {
  ctx.beginPath(); ctx.moveTo(0, yBottom);
  for (let x = 0; x <= S; x += 8) ctx.lineTo(x, yBase - amp * (noise.fbm(x * freq + seed, seed * 1.7, 4) - 0.35));
  ctx.lineTo(S, yBottom); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function glowArch(ctx, cx, baseY, w, h, o = {}) {
  const pts = cuspedArch(cx, baseY, w, h, o);
  if (o.halo !== 0) glow(ctx, cx, baseY - h * 0.45, Math.max(w, h) * (o.halo || 1.1), o.haloCol || '#ffb45a', o.haloA ?? 0.3);
  const g = ctx.createLinearGradient(0, baseY - h, 0, baseY);
  const st = o.stops || [[0, '#f6a85a'], [0.5, '#ffd58a'], [1, '#fff0bd']];
  for (const [t, c] of st) g.addColorStop(t, rgba(c));
  ctx.fillStyle = g; polyPath(ctx, pts); ctx.fill();
  if (o.line) ink(ctx, () => polyPath(ctx, pts), o.line, o.lineW || 1.5, o.lineA ?? 0.45);
  return pts;
}
function linGrad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [t, c, a] of stops) g.addColorStop(t, rgba(c, a ?? 1));
  return g;
}
// darken / tint only what is already painted on a layer
function veil(ctx, x, y, w, h, stops, vertical = true) {
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = vertical ? linGrad(ctx, 0, y, 0, y + h, stops) : linGrad(ctx, x, 0, x + w, 0, stops);
  ctx.fillRect(x, y, w, h); ctx.restore();
}
