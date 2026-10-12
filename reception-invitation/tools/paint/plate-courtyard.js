/* 2. PALACE COURTYARD AT DUSK — where the groom is introduced. Lantern-lit arcades, marigold garlands,
      a reflecting pool. The facade is kept in dusky mauve so an ivory sherwani stands out against it. */
'use strict';
PLATES.courtyard = function () {
  const rnd = makeRnd(202);
  const FY = 1500, HY = 800; // far edge of the floor, eye-level horizon used for floor perspective

  /* --- sky --- */
  const sky = layer(S, S), s = sky.ctx;
  skyGradient(s, [[0, '#272659'], [0.12, '#3d3474'], [0.24, '#62488b'], [0.34, '#9a6298'], [0.42, '#d58590'], [0.5, '#f6ae8a'], [0.58, '#ffd2a0'], [1, '#ffdcae']]);
  glow(s, C, 1150, 1100, '#ffb78a', 0.3);
  starfield(s, S, 560, 170, rnd);
  for (const [x, y, w, h] of [[330, 640, 560, 50], [1980, 580, 600, 54], [250, 860, 520, 46], [2050, 820, 560, 46], [1152, 760, 900, 30]]) streakCloud(s, x, y, w, h, '#6a4f90', '#f7ab90', rnd, 0.7);
  grain(s, S, S, 0.05);

  /* --- palace + floor --- */
  const pal = layer(S, S), p = pal.ctx;
  const W = { light: '#c9a0ae', mid: '#a47f9c', shadow: '#7b628e', line: '#3b2a4e', gold: '#f2c57c', hi: '#ecc9c4' };
  const lit = { glow: '#ffbe6a', inside: '#ffd28a', insideA: 0.9 };
  const dusk = (palette) => tintPal(palette, '#7a3f6a', 0.14);
  const MG = [dusk(FLOWER.marigold), dusk(FLOWER.gold)];

  // floor first (steps and pool sit on it)
  p.fillStyle = linGrad(p, 0, FY, 0, S, [[0, '#b990a6'], [0.25, '#9a7799'], [0.7, '#75598a'], [1, '#57406f']]);
  p.fillRect(0, FY, S, S - FY);
  p.save(); p.beginPath(); p.rect(0, FY, S, S - FY); p.clip();
  for (let i = 0; i < 40; i++) softDab(p, rnd() * S, rnd.range(FY, S), rnd.range(120, 320), rnd.pick(['#c79ab0', '#6a4f84', '#a37f9f']), 0.1);
  p.strokeStyle = rgba('#f6d8cc', 0.17); p.lineWidth = 1.6;
  for (let i = -44; i <= 44; i++) { const xn = C + i * 150; p.beginPath(); p.moveTo(xn, S); p.lineTo(C + ((xn - C) * (FY - HY)) / (S - HY), FY); p.stroke(); }
  const zn = 1 / (S - HY), zf = 1 / (FY - HY);
  for (let j = 0; j <= 16; j++) { const y = HY + 1 / (zn + ((zf - zn) * j) / 16); p.beginPath(); p.moveTo(0, y); p.lineTo(S, y); p.stroke(); }
  p.restore();

  // main wall
  p.fillStyle = linGrad(p, 0, 900, 0, FY, [[0, '#b48ca8'], [0.55, '#9a7699'], [1, '#86648f']]); p.fillRect(0, 900, S, FY - 900);
  wash(p, () => { p.beginPath(); p.rect(0, 900, S, FY - 900); }, [0, 900, S, FY - 900], ['#c9a2b4', '#7f5f8c', '#b58aa0'], rnd, 40, 0.1);
  p.save(); p.beginPath(); p.rect(0, 900, S, FY - 900); p.clip();
  for (let x = 0; x <= S; x += 110) softDab(p, x, FY - 10, 260, '#ffab6a', 0.16);
  p.restore();
  merlons(p, 0, S, 900, 17, { mid: '#a9829f' });
  p.fillStyle = rgba(W.hi, 0.5); p.fillRect(0, 1124, S, 5); p.fillStyle = rgba(W.shadow, 0.6); p.fillRect(0, 1129, S, 9);
  // roof pavilions on the wings
  for (const dx of [-985, -565, 565, 985]) chhatri(p, C + dx, 900, 124, 196, W, lit);
  // arcades
  for (const sgn of [-1, 1]) for (let k = 0; k < 4; k++) {
    const x = C + sgn * (460 + k * 210);
    glowArch(p, x, FY, 150, 330, { stops: [[0, '#9a5248'], [0.45, '#e2924f'], [1, '#ffcd86']], halo: 1.0, haloA: 0.2, line: W.line, lineW: 1.8 });
    glowArch(p, x, FY, 66, 190, { stops: [[0, '#6f3a48'], [1, '#c57648']], halo: 0 });
    garland(p, catenary(x - 72, 1168, x + 72, 1168, 30, 14), 7.5, rnd, { pals: MG, shift: k });
    lantern(p, x, 1212, 12, { chain: 26, glowR: 6 });
    glowArch(p, x, 1098, 62, 118, { stops: [[0, '#d68656'], [1, '#ffd89a']], haloA: 0.18, line: W.line });
    p.fillStyle = rgba(W.light); p.fillRect(x - 46, 1098, 92, 10); p.fillStyle = rgba(W.shadow); p.fillRect(x - 40, 1108, 80, 6);
    p.save(); p.translate(x * 2, 0); p.scale(-1, 1); p.restore();
  }
  for (const sgn of [-1, 1]) for (let k = 1; k < 5; k++) column(p, C + sgn * (355 + k * 210), FY, 372, 30, W);
  // potted shrubs between the arches
  for (const sgn of [-1, 1]) for (let k = 1; k < 5; k++) {
    const x = C + sgn * (355 + k * 210);
    p.fillStyle = '#8f5a5c'; p.beginPath(); p.moveTo(x - 26, FY - 34); p.lineTo(x + 26, FY - 34); p.lineTo(x + 19, FY + 6); p.lineTo(x - 19, FY + 6); p.closePath(); p.fill();
    bush(p, x, FY - 30, 84, 62, FOLIAGE.dusk, rnd, { flowers: 5, flowerSize: 5, rim: 0.5 });
  }

  // central pavilion
  hGradRect(p, C - 330, 830, 660, FY - 830, '#c6a2b2', '#a9859f', '#8a6c94');
  wash(p, () => { p.beginPath(); p.rect(C - 330, 830, 660, FY - 830); }, [C - 330, 830, 660, FY - 830], ['#d3aebb', '#8a6890', '#b790a6'], rnd, 22, 0.1);
  merlons(p, C - 330, C + 330, 830, 19, { mid: '#b38ea8' });
  dome(p, C, 834, 250, 150, W, { ribs: true });
  dome(p, C - 196, 834, 110, 78, W); dome(p, C + 196, 834, 110, 78, W);
  for (const sgn of [-1, 1]) { hGradRect(p, C + sgn * 330 - 21, 760, 42, FY - 760, W.light, W.mid, W.shadow); chhatri(p, C + sgn * 330, 760, 74, 114, W, lit); }
  p.strokeStyle = rgba(W.gold, 0.6); p.lineWidth = 3.2; p.strokeRect(C - 262, 884, 524, FY - 890);
  p.strokeStyle = rgba(W.gold, 0.4); p.lineWidth = 1.3; p.strokeRect(C - 249, 897, 498, FY - 903);
  const big = glowArch(p, C, FY, 380, 560, { stops: [[0, '#553052'], [0.35, '#874456'], [0.72, '#c4724c'], [1, '#eeaa62']], halo: 0.9, haloA: 0.2, line: W.line, lineW: 2.4 });
  ink(p, () => polyPath(p, big), W.gold, 4.5, 0.7);
  glowArch(p, C, FY, 150, 300, { stops: [[0, '#dc8648'], [1, '#ffd690']], halo: 1.2, haloA: 0.32 });
  for (const sgn of [-1, 1]) { disc(p, C + sgn * 172, 978, 17, W.gold, 0.55); disc(p, C + sgn * 172, 978, 9, '#8a5a6a', 0.7); }
  lantern(p, C - 104, 1068, 19, { chain: 64 }); lantern(p, C + 104, 1068, 19, { chain: 64 }); lantern(p, C, 1010, 26, { chain: 34 });
  garland(p, catenary(C - 300, 852, C, 852, 58, 20), 11, rnd, { pals: MG });
  garland(p, catenary(C, 852, C + 300, 852, 58, 20), 11, rnd, { pals: MG, shift: 1 });
  for (const [dx, len] of [[-222, 420], [-242, 300], [222, 420], [242, 300]]) garland(p, [[C + dx, 900], [C + dx, 900 + len]], 8.5, rnd, { pals: MG });
  // slender cypress trees
  for (const sgn of [-1, 1]) cypress(p, C + sgn * 420, FY + 6, 330, 84, FOLIAGE.dusk, rnd, { rim: 0.5, density: 1.1 });
  // steps
  for (let i = 0; i < 3; i++) { const x0 = C - 330 - i * 26, w = 660 + i * 52, y = FY + i * 15; p.fillStyle = rgba(mix('#e6c8c8', '#a98aa6', i / 3)); p.fillRect(x0, y, w, 15); p.fillStyle = rgba('#fff0e0', 0.5); p.fillRect(x0, y, w, 3); }
  // glossy reflections of the lit arches on the stone
  for (const sgn of [-1, 1]) for (let k = 0; k < 4; k++) { const x = C + sgn * (460 + k * 210); p.save(); p.translate(x, FY + 64); p.scale(1, 2.6); glow(p, 0, 0, 62, '#ffbf7a', 0.2); p.restore(); }
  p.save(); p.translate(C, FY + 120); p.scale(1, 1.6); glow(p, 0, 0, 230, '#ffbf7a', 0.2); p.restore();

  // reflecting pool
  const hw = (y) => 0.27 * (y - HY), Y0 = 1568, Y1 = 1846;
  const poolPath = (grow) => { p.beginPath(); p.moveTo(C - hw(Y0) - grow, Y0 - grow * 0.5); p.lineTo(C + hw(Y0) + grow, Y0 - grow * 0.5); p.lineTo(C + hw(Y1) + grow * 1.5, Y1 + grow); p.lineTo(C - hw(Y1) - grow * 1.5, Y1 + grow); p.closePath(); };
  p.fillStyle = linGrad(p, 0, Y0, 0, Y1 + 20, [[0, '#ecd0cc'], [1, '#c3a3bc']]); poolPath(18); p.fill();
  ink(p, () => poolPath(18), W.line, 1.6, 0.3);
  p.fillStyle = linGrad(p, 0, Y0, 0, Y1, [[0, '#e39a6c'], [0.22, '#b56c84'], [0.55, '#6c4b8c'], [1, '#3a3270']]); poolPath(0); p.fill();
  p.save(); poolPath(0); p.clip();
  p.save(); p.translate(C, Y0 + 30); p.scale(1, 2.2); glow(p, 0, 0, 120, '#ffd89a', 0.55); p.restore();
  for (const dx of [-104, 104]) { p.save(); p.translate(C + dx * 0.9, Y0 + 70); p.scale(1, 4); glow(p, 0, 0, 22, '#ffd08a', 0.5); p.restore(); }
  for (let i = 0; i < 90; i++) { const y = rnd.range(Y0, Y1), x = C + rnd.range(-1, 1) * hw(y), w = rnd.range(14, 90); stroke(p, [[x - w / 2, y], [x + w / 2, y]], rnd.range(1, 2.6), rnd() < 0.6 ? '#ffd2b0' : '#a79be0', rnd.range(0.12, 0.34)); }
  p.restore();
  for (let i = 0; i < 9; i++) { const y = rnd.range(Y0 + 40, Y1 - 20); diya(p, C + rnd.range(-0.8, 0.8) * hw(y), y, 9 + (y - Y0) * 0.02); }
  for (const sgn of [-1, 1]) for (let i = 0; i <= 5; i++) { const y = lerp(Y0, Y1, i / 5); diya(p, C + sgn * (hw(y) + 10 + i * 2.5), y + 2, 7 + i * 1.3); }
  // lantern posts by the pool
  for (const sgn of [-1, 1]) {
    const x = C + sgn * 392;
    lightPool(p, x, 1870, 250, 80, '#ffb45c', 0.34);
    p.save(); if (sgn < 0) { p.translate(x * 2, 0); p.scale(-1, 1); }
    lanternPost(p, x, 1870, 300, 22, { glowR: 7 }); p.restore();
  }
  veil(p, 0, 1950, S, 354, [[0, '#1a1238', 0], [1, '#1a1238', 0.5]]);
  grain(p, S, S, 0.06);

  /* --- near: floral urns on pedestals framing the scene (soft focus) --- */
  const nearRaw = layer(S, S), n = nearRaw.ctx;
  const stone = { light: '#e8cfc8', mid: '#bfa0b4', shadow: '#8a6f96', line: '#3b2a4e' };
  for (const [x, gy, k] of [[588, 2230, 1], [1716, 2230, 1], [196, 2210, 1.15], [2108, 2210, 1.15]]) {
    lightPool(n, x, gy, 300 * k, 90 * k, '#ffb45c', 0.3);
    column(n, x, gy, 350 * k, 92 * k, stone);
    n.fillStyle = '#9a6f58'; n.beginPath(); n.moveTo(x - 62 * k, gy - 440 * k); n.quadraticCurveTo(x - 86 * k, gy - 380 * k, x - 34 * k, gy - 350 * k); n.lineTo(x + 34 * k, gy - 350 * k); n.quadraticCurveTo(x + 86 * k, gy - 380 * k, x + 62 * k, gy - 440 * k); n.closePath(); n.fill();
    floralCluster(n, x, gy - 520 * k, 205 * k, rnd, { pals: [[FLOWER.blush, 3], [FLOWER.ivory, 3], [FLOWER.peach, 2], [FLOWER.rose, 1], [FLOWER.marigold, 1]], n: 12, sprigs: 11, sy: 0.9 });
    for (const sgn of [-1, 1]) lantern(n, x + sgn * 150 * k, gy - 104 * k, 34 * k, { glowR: 5.5 });
  }
  veil(n, 0, 0, S, S, [[0, '#3a2a5a', 0.16], [1, '#1a1238', 0.3]]);
  grain(n, S, S, 0.05);
  const near = layer(S, S); stamp(near.ctx, nearRaw.c, 2.2);
  return { sky: sky.c, palace: pal.c, near: near.c };
};
