/* 1. TWILIGHT GARDEN — the opening scene: a formal palace garden at dusk with a long water channel. */
'use strict';
PLATES.garden = function () {
  const rnd = makeRnd(101), noise = makeNoise(11);
  const HZ = 1290; // horizon
  /* --- sky --- */
  const sky = layer(S, S), s = sky.ctx;
  skyGradient(s, [[0, '#131946'], [0.14, '#1f2663'], [0.28, '#37387f'], [0.4, '#604b93'], [0.48, '#93609a'], [0.53, '#cf8391'], [0.56, '#f6b08a'], [0.6, '#ffd3a2'], [1, '#ffd9ae']]);
  glow(s, C, HZ + 20, 1000, '#ffb98a', 0.34); glow(s, C, HZ, 460, '#ffe2b0', 0.3);
  starfield(s, S, 980, 520, rnd);
  for (let i = 0; i < 26; i++) softDab(s, rnd() * S, rnd.range(80, 700), rnd.range(120, 320), '#4a4aa0', 0.05);
  moon(s, 1490, 650, 46, { crescent: 0.42 });
  const cl = { body: '#5d4c8f', lit: '#f3a290' };
  for (const [x, y, w, h] of [[380, 1010, 620, 60], [1880, 960, 700, 66], [1100, 1120, 760, 44], [300, 1180, 520, 40], [1960, 1170, 600, 44], [760, 900, 420, 34], [1650, 1060, 380, 30]]) streakCloud(s, x, y, w, h, cl.body, cl.lit, rnd, 0.85);
  cumulus(s, 250, 1215, 560, 150, { shadow: '#5a4a8c', body: '#a476a8', lit: '#ffc4a0', dir: [0.5, 0.8] }, rnd, 0.9);
  cumulus(s, 2080, 1225, 620, 170, { shadow: '#5a4a8c', body: '#a476a8', lit: '#ffc4a0', dir: [-0.5, 0.8] }, rnd, 0.9);
  grain(s, S, S, 0.05);

  /* --- far: hills, palace, tree line --- */
  const far = layer(S, S), f = far.ctx;
  hillBand(f, noise, 1228, 110, 0.0016, 3, linGrad(f, 0, 1180, 0, 1420, [[0, '#9a74a6'], [1, '#b98aa6']]), 1500);
  hillBand(f, noise, 1268, 80, 0.0024, 9, linGrad(f, 0, 1220, 0, 1440, [[0, '#74619b'], [1, '#8f6fa3']]), 1500);
  const P = { light: '#c49ab6', mid: '#8f6f9f', shadow: '#62548a', line: '#352a52', gold: '#f3c57c' };
  const base = 1306;
  glow(f, C, base - 60, 620, '#ffc98f', 0.3);
  f.save(); f.translate(C, base); f.scale(1.42, 1.42); f.translate(-C, -base);
  const lit = { glow: '#ffbe6a', inside: '#ffd28a', insideA: 0.9 };
  for (const sgn of [-1, 1]) {
    const x0 = C + sgn * 170, x1 = C + sgn * 440, xl = Math.min(x0, x1), w = Math.abs(x1 - x0);
    hGradRect(f, xl, base - 132, w, 132, sgn < 0 ? P.light : P.mid, P.mid, sgn < 0 ? P.mid : P.shadow);
    merlons(f, xl, xl + w, base - 132, 11, P);
    for (let i = 0; i < 4; i++) glowArch(f, xl + (w * (i + 0.5)) / 4, base - 14, 30, 60, { halo: 1.3, haloA: 0.22 });
    dome(f, C + sgn * 300, base - 132, 96, 80, P);
    hGradRect(f, x1 - 22, base - 250, 44, 250, P.light, P.mid, P.shadow); // corner tower
    chhatri(f, x1, base - 250, 74, 116, P, lit);
    glowArch(f, x1, base - 150, 16, 34, { halo: 1.4, haloA: 0.2 }); glowArch(f, x1, base - 60, 16, 34, { halo: 1.4, haloA: 0.2 });
  }
  hGradRect(f, C - 172, base - 196, 344, 196, P.light, P.mid, P.shadow);
  merlons(f, C - 172, C + 172, base - 196, 12, P);
  dome(f, C, base - 196, 200, 158, P, { ribs: true });
  chhatri(f, C - 140, base - 196, 66, 104, P, lit); chhatri(f, C + 140, base - 196, 66, 104, P, lit);
  glowArch(f, C, base - 6, 116, 160, { halo: 1.5, haloA: 0.42, line: P.line });
  for (const dx of [-112, 112]) glowArch(f, C + dx, base - 14, 34, 70, { halo: 1.3, haloA: 0.22 });
  for (const dx of [-112, 0, 112]) glowArch(f, C + dx, base - 126, 26, 44, { halo: 1.2, haloA: 0.18 });
  f.fillStyle = rgba(P.shadow, 0.9); f.fillRect(C - 470, base - 6, 940, 14); // terrace
  f.restore();
  f.save(); f.translate(C, base + 6); f.scale(1, 0.09); softDab(f, 0, 0, 900, '#ffc59a', 0.5); f.restore(); // haze
  const farTree = { base: '#3b3d70', mid: '#4f5685', light: '#77709a', hi: '#d39aa6' };
  for (let i = 0; i < 46; i++) {
    const x = rnd() * S; if (Math.abs(x - C) < 150) continue;
    const big = Math.abs(x - C) > 520;
    canopy(f, x, base + rnd.range(-18, 14) - (big ? 26 : 0), rnd.range(34, big ? 86 : 54), farTree, rnd, { clusters: 4, density: 0.55, light: [0, 0.9] });
  }
  grain(f, S, S, 0.05);

  /* --- mid: the garden --- */
  const mid = layer(S, S), m = mid.ctx, GY = 1312;
  m.fillStyle = linGrad(m, 0, GY, 0, S, [[0, '#465a72'], [0.12, '#2f4a55'], [0.45, '#1e3a3d'], [1, '#0f2227']]);
  m.fillRect(0, GY, S, S - GY);
  for (let i = 0; i < 60; i++) softDab(m, rnd() * S, rnd.range(GY + 40, S), rnd.range(60, 220), rnd.pick(['#2c5148', '#17302f', '#3a6352']), 0.14);
  for (let x = -100; x < S + 100; x += 90) { m.save(); m.translate(x + rnd.range(-30, 30), GY + rnd.range(0, 26)); m.scale(1, 0.3); softDab(m, 0, 0, rnd.range(150, 260), '#c9a2c4', 0.3); m.restore(); }
  const dep = (y) => (y - GY) / (S - GY);
  const half = (y) => lerp(34, 250, dep(y));              // water channel half width
  const edge = (y) => half(y) + lerp(6, 46, dep(y));      // stone coping
  const walk = (y) => edge(y) + lerp(16, 250, dep(y));    // paved walk
  const trap = (fn) => { m.beginPath(); m.moveTo(C - fn(GY), GY); m.lineTo(C + fn(GY), GY); m.lineTo(C + fn(S), S); m.lineTo(C - fn(S), S); m.closePath(); };
  m.fillStyle = linGrad(m, 0, GY, 0, S, [[0, '#c7a0ae'], [0.3, '#99809e'], [1, '#5d5078']]); trap(walk); m.fill();
  m.fillStyle = linGrad(m, 0, GY, 0, S, [[0, '#f1cdb6'], [0.4, '#c9a8b8'], [1, '#8b7a9e']]); trap(edge); m.fill();
  // water mirrors the sky: warm at the far end, indigo close to us
  m.fillStyle = linGrad(m, 0, GY, 0, S, [[0, '#ffd2a2'], [0.08, '#f2a48e'], [0.22, '#b06f9c'], [0.45, '#5a4a92'], [0.75, '#2c2f74'], [1, '#1a2058']]); trap(half); m.fill();
  m.save(); trap(half); m.clip();
  glow(m, C, GY + 30, 190, '#fff0c0', 0.6);
  for (let i = 0; i < 9; i++) { m.save(); m.translate(C + rnd.range(-6, 6), GY + 20 + i * 26); m.scale(1, 0.12); softDab(m, 0, 0, 60 + i * 9, '#ffe3a6', 0.5 - i * 0.045); m.restore(); }
  for (let i = 0; i < 150; i++) {
    const y = GY + Math.pow(rnd(), 1.7) * (S - GY), x = C + rnd.range(-1, 1) * half(y), w = lerp(10, 130, dep(y)) * rnd.range(0.4, 1);
    stroke(m, [[x - w / 2, y], [x + w / 2, y]], lerp(1, 3.2, dep(y)), rnd() < 0.6 ? '#f6c4b0' : '#9fa0e0', rnd.range(0.1, 0.34));
  }
  m.restore();
  // hedges outside the walk and lantern posts on it, painted far -> near
  const per = (y) => (y - HZ) / (S - HZ);
  const duskFlowers = [tintPal(FLOWER.blush, '#8a6ab0', 0.25), tintPal(FLOWER.ivory, '#9a84c0', 0.25), tintPal(FLOWER.rose, '#6a4a90', 0.2)];
  const rows = [[1350, 0], [1372, 1], [1398, 0], [1440, 1], [1474, 0], [1540, 1], [1600, 0], [1690, 1], [1800, 0], [1930, 1], [2120, 0], [2270, 1]];
  for (const [y, isHedge] of rows) {
    const k = per(y);
    for (const sgn of [-1, 1]) {
      if (isHedge) {
        const w = 640 * k + 46, h = 200 * k + 14, x = C + sgn * (walk(y) + w / 2 + 26 * k);
        m.save(); m.translate(x, y + 36 * k); m.scale(1, 0.2); softDab(m, 0, 0, w * 0.62, '#06121a', 0.55); m.restore();
        bush(m, x, y + 40 * k, w, h, FOLIAGE.twilight, rnd, { flowers: Math.round(10 + 18 * k), flowerSize: 5 + 16 * k, flowerPals: duskFlowers, rim: 0.7, density: 0.8 });
      } else {
        const x = C + sgn * (edge(y) + 74 * k + 6);
        lightPool(m, x, y, 330 * k + 16, 110 * k + 6, '#ffb45c', 0.36);
        m.save(); if (sgn > 0) { m.translate(x * 2, 0); m.scale(-1, 1); }
        lanternPost(m, x, y, 520 * k, 38 * k + 1.2, { glowR: 7.5 });
        m.restore();
      }
    }
  }
  for (let i = 0; i < 16; i++) { const y = GY + 40 + Math.pow(rnd(), 1.4) * 900; diya(m, C + rnd.range(-0.8, 0.8) * half(y), y, 4 + 20 * per(y)); } // floating lamps
  // tall framing trees with hanging lanterns
  const trees = [[640, 1700, 880, 0.34, -30], [1664, 1700, 900, 0.34, 30], [250, 1640, 1050, 0.36, 20], [2060, 1650, 1080, 0.36, -20], [930, 1420, 330, 0.36, 0], [1380, 1424, 350, 0.36, 0], [470, 1470, 520, 0.36, 0], [1850, 1476, 540, 0.36, 0]];
  const hangers = [];
  for (const [x, gy, h, crown, lean] of trees.sort((a, b) => a[1] - b[1])) {
    const big = h > 600;
    const pal = big ? { base: '#0f2229', mid: '#1b3b3a', light: '#34614f', hi: '#6c9a6c' } : { base: '#22384a', mid: '#2f5150', light: '#4f7a62', hi: '#9db87e' };
    const cls = tree(m, x, gy, h, pal, rnd, { crown, lean, rim: 0.85, clusters: big ? 13 : 8, sx: big ? 1.4 : 1.15, sy: big ? 0.72 : 0.8, density: 1.1, trunk: '#1a1826', trunkLight: '#c98a5a' });
    if (big) for (let i = 0; i < 4; i++) { const c = cls[1 + ((rnd() * (cls.length - 1)) | 0)]; hangers.push([c.x + rnd.range(-0.3, 0.3) * c.r, c.y + c.r * 0.55, rnd.range(60, 190), rnd.range(15, 24)]); }
  }
  for (const [x, y, ch, sz] of hangers) lantern(m, x, y + ch, sz, { chain: ch, glowR: 7 });
  fairyString(m, catenary(700, 1010, 1610, 1000, 150, 40), 46, 3.4, rnd);
  fairyString(m, catenary(660, 1090, 1650, 1085, 120, 40), 52, 2.8, rnd, { a: 0.85 });
  grassTufts(m, 0, S, 2200, 120, '#2f5a48', rnd, 26);
  veil(m, 0, 1900, S, 404, [[0, '#080e22', 0], [1, '#080e22', 0.55]]);
  grain(m, S, S, 0.06);
  return { sky: sky.c, far: far.c, mid: mid.c };
};
