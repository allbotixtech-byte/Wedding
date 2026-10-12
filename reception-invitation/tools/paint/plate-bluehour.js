/* 4. BLUE-HOUR GARDEN — the couple together. Deep evening sky, lanterns hanging from overhead branches,
      soft out-of-focus lights. The floral ring that frames them is a separate sprite. */
'use strict';
PLATES.bluehour = function () {
  const rnd = makeRnd(404);
  const HZ = 1560;
  const sky = layer(S, S), s = sky.ctx;
  skyGradient(s, [[0, '#0b1035'], [0.18, '#141a50'], [0.38, '#232a70'], [0.52, '#3d3a8a'], [0.62, '#62509a'], [0.7, '#93669e'], [0.78, '#c98a9c'], [1, '#e9a995']]);
  for (let i = 0; i < 40; i++) softDab(s, rnd() * S, rnd.range(0, 1100), rnd.range(140, 380), rnd.pick(['#3b3fa6', '#5a3f9a', '#27348a']), 0.07);
  glow(s, C, 1120, 900, '#7f7ce0', 0.2);
  starfield(s, S, 1400, 900, rnd, { bias: 1.25 });
  for (const [x, y, w, h] of [[500, 1330, 620, 44], [1800, 1290, 660, 46], [1150, 1420, 800, 40]]) streakCloud(s, x, y, w, h, '#4a3f8a', '#c98aa8', rnd, 0.6);
  grain(s, S, S, 0.05);

  const gar = layer(S, S), g = gar.ctx;
  // distant tree line with little lights
  const far = { base: '#1c2152', mid: '#272f66', light: '#3f4680', hi: '#8a76a8' };
  for (let x = -40; x < S + 60; x += rnd.range(50, 90)) canopy(g, x, HZ - rnd.range(10, 50), rnd.range(44, 84), far, rnd, { clusters: 4, density: 0.5, light: [0, 0.9] });
  g.fillStyle = linGrad(g, 0, HZ, 0, S, [[0, '#1b2350'], [0.25, '#121c3c'], [1, '#080f22']]); g.fillRect(0, HZ, S, S - HZ);
  for (let i = 0; i < 46; i++) bulb(g, rnd() * S, HZ + rnd.range(-46, 10), rnd.range(1.4, 2.6), '#ffc680', 0.85);
  for (let x = -100; x < S + 100; x += 110) { g.save(); g.translate(x, HZ + rnd.range(0, 24)); g.scale(1, 0.3); softDab(g, 0, 0, rnd.range(150, 250), '#7d6fc0', 0.3); g.restore(); }
  // soft out-of-focus lights drifting through the garden
  for (let i = 0; i < 70; i++) { const x = rnd() * S, y = rnd.range(900, 2100); bokeh(g, x, y, rnd.range(14, 58), rnd.pick(['#ffc56e', '#ffd9a0', '#ffb07a', '#f6c6d0']), rnd.range(0.05, 0.16)); }
  // big trees for the wide (landscape) view
  const night = { base: '#0a152b', mid: '#13283c', light: '#22484a', hi: '#4b7a62' };
  for (const [x, gy, h, lean] of [[230, 1900, 1500, 30], [2080, 1900, 1540, -30]]) {
    const cls = tree(g, x, gy, h, night, rnd, { crown: 0.36, lean, rim: 0.9, clusters: 13, sx: 1.4, sy: 0.75, density: 1.05, trunk: '#0c0f20', trunkLight: '#b0764e' });
    for (let i = 0; i < 6; i++) { const c = cls[1 + ((rnd() * (cls.length - 1)) | 0)], ch = rnd.range(70, 240); lantern(g, c.x + rnd.range(-0.3, 0.3) * c.r, c.y + c.r * 0.5 + ch, rnd.range(17, 28), { chain: ch, glowR: 7 }); }
  }
  // overhanging branches with lanterns that frame the top of the phone layout
  for (const [x, y, R, flip] of [[560, 40, 300, 1], [1750, 30, 310, -1], [830, -90, 230, 1], [1480, -100, 240, -1]]) {
    const cls = canopy(g, x, y, R, night, rnd, { clusters: 9, sx: 1.3, sy: 0.7, rim: 0.9, density: 1.0 });
    for (let i = 0; i < 4; i++) { const c = cls[(rnd() * cls.length) | 0], ch = rnd.range(60, 330); lantern(g, c.x + rnd.range(-0.4, 0.4) * c.r, Math.max(60, c.y + c.r * 0.4) + ch, rnd.range(16, 27), { chain: ch + 200, glowR: 7 }); }
  }
  for (let i = 0; i < 5; i++) fairyString(g, catenary(520 + i * 30, 120 + i * 50, 1790 - i * 30, 110 + i * 50, 150 + i * 26, 40), 44, 2.6, rnd, { a: 0.8 });
  // low planting and lamps along the bottom
  for (let x = -60; x < S + 100; x += rnd.range(170, 260)) bush(g, x, 2330, rnd.range(300, 420), rnd.range(150, 230), night, rnd, { flowers: 9, flowerSize: 13, flowerPals: [tintPal(FLOWER.blush, '#5a4aa0', 0.35), tintPal(FLOWER.ivory, '#6a62b0', 0.35)], rim: 0.8 });
  for (let i = 0; i < 22; i++) diya(g, rnd() * S, rnd.range(1700, 2120), rnd.range(8, 15));
  grain(g, S, S, 0.06);
  return { sky: sky.c, garden: gar.c };
};
