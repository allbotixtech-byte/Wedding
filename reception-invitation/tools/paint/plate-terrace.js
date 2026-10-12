/* 3. TERRACE AT DUSK — the bride looks out from a palace terrace over a lake and an illuminated garden.
      (The balustrade she rests her hand on is a separate sprite so it always lines up with her.) */
'use strict';
PLATES.terrace = function () {
  const rnd = makeRnd(303), noise = makeNoise(33);
  const HZ = 1300;
  /* --- sky --- */
  const sky = layer(S, S), s = sky.ctx;
  skyGradient(s, [[0, '#22275e'], [0.1, '#353777'], [0.22, '#584b93'], [0.34, '#8e6dab'], [0.44, '#c88bb0'], [0.52, '#f0a9a2'], [0.58, '#ffcfa6'], [1, '#ffd9b2']]);
  glow(s, C, HZ, 1050, '#ffbfa0', 0.3);
  starfield(s, S, 760, 260, rnd);
  moon(s, 800, 700, 54, { halo: '#e2bdee' });
  for (const [x, y, w, h] of [[420, 1000, 600, 50], [1900, 940, 640, 56], [1300, 1090, 700, 40], [600, 1150, 480, 36], [1700, 1180, 520, 36]]) streakCloud(s, x, y, w, h, '#7a5fa4', '#ffb6a6', rnd, 0.75);
  const cp = { shadow: '#77609f', body: '#c394bb', lit: '#ffd2b6' };
  cumulus(s, 210, 1250, 760, 120, { ...cp, dir: [0.5, 0.7] }, rnd, 0.85);
  cumulus(s, 2080, 1256, 820, 130, { ...cp, dir: [-0.5, 0.7] }, rnd, 0.85);
  grain(s, S, S, 0.05);

  /* --- vista --- */
  const vis = layer(S, S), v = vis.ctx;
  hillBand(v, noise, 1258, 130, 0.0015, 5, linGrad(v, 0, 1170, 0, 1420, [[0, '#9079b2'], [1, '#bd9cbc']]), 1520);
  hillBand(v, noise, 1298, 78, 0.0027, 12, linGrad(v, 0, 1240, 0, 1440, [[0, '#6f6a9f'], [1, '#9484ae']]), 1520);
  // lake catching the last light
  v.fillStyle = linGrad(v, 0, 1324, 0, 1384, [[0, '#ffd0aa'], [0.5, '#e7a3a8'], [1, '#9c80b4']]); v.fillRect(0, 1324, S, 60);
  for (let i = 0; i < 70; i++) { const y = rnd.range(1328, 1380), x = rnd() * S, w = rnd.range(30, 160); stroke(v, [[x, y], [x + w, y]], rnd.range(1, 2.4), rnd() < 0.6 ? '#fff0d4' : '#b497c8', rnd.range(0.2, 0.5)); }
  // far shore lights
  for (let i = 0; i < 60; i++) { const x = rnd() * S; bulb(v, x, rnd.range(1316, 1326), rnd.range(1.2, 2.2), '#ffc680', 0.8); }
  const P = { light: '#c7a2c0', mid: '#967aa8', shadow: '#6b5a90', line: '#372c55', gold: '#f3c57c' };
  const lit = { glow: '#ffbe6a', inside: '#ffd28a', insideA: 0.95 };
  // a little lakeside palace
  for (const [x, w, h] of [[1480, 170, 60], [1650, 110, 44]]) { hGradRect(v, x - w / 2, 1324 - h, w, h, P.light, P.mid, P.shadow); for (let i = 0; i < Math.round(w / 34); i++) glowArch(v, x - w / 2 + 17 + i * 34, 1322, 14, 30, { halo: 1.3, haloA: 0.2 }); }
  dome(v, 1480, 1264, 84, 64, P); chhatri(v, 1410, 1264, 44, 70, P, lit); chhatri(v, 1550, 1264, 44, 70, P, lit); chhatri(v, 1650, 1280, 50, 78, P, lit);
  v.save(); v.translate(1500, 1352); v.scale(1, 0.5); glow(v, 0, 0, 120, '#ffd9a0', 0.5); v.restore();
  // garden below the terrace
  v.fillStyle = linGrad(v, 0, 1380, 0, S, [[0, '#566a82'], [0.1, '#34515c'], [0.4, '#213c42'], [1, '#12252a']]); v.fillRect(0, 1380, S, S - 1380);
  for (let x = -100; x < S + 100; x += 100) { v.save(); v.translate(x + rnd.range(-30, 30), 1384 + rnd.range(0, 20)); v.scale(1, 0.3); softDab(v, 0, 0, rnd.range(150, 250), '#d6aecb', 0.34); v.restore(); }
  const rowPal = (t) => ({ base: mix('#3c426f', '#162c33', t), mid: mix('#525b88', '#27484a', t), light: mix('#7c789f', '#4a785f', t), hi: mix('#d9a3ae', '#a6c183', t) });
  for (let d = 0; d < 6; d++) {
    const yb = 1420 + d * 150 + d * d * 6, R = 44 + d * 27, pal = rowPal(d / 5), tops = [];
    if (d === 1) { chhatri(v, 860, yb - 30, 210, 330, { light: '#e7c6c4', mid: '#b995b4', shadow: '#84699c', line: P.line, gold: P.gold }, { glow: '#ffbe6a', inside: '#ffd9a0', insideA: 0.95, ribs: true }); lightPool(v, 860, yb - 24, 330, 60, '#ffb45c', 0.4); }
    for (let x = -R; x < S + R; x += R * rnd.range(1.25, 1.8)) {
      if (rnd() < 0.2 || (d === 1 && Math.abs(x - 860) < 190)) continue;
      const cy = yb - R * rnd.range(0.5, 0.8);
      lightPool(v, x, yb + R * 0.2, R * 2.2, R * 0.5, '#ffb45c', 0.16);
      canopy(v, x, cy, R * rnd.range(0.85, 1.2), pal, rnd, { clusters: 5, density: 0.75, rim: 0.8, light: [-0.4, -0.85] });
      tops.push([x, cy - R * 0.35]);
    }
    for (let i = 0; i + 1 < tops.length; i++) if (rnd() < 0.62) fairyString(v, catenary(tops[i][0], tops[i][1], tops[i + 1][0], tops[i + 1][1], R * 0.5, 16), 15 + d * 5, 1.5 + d * 0.38, rnd, { a: 0.9 });
    for (let i = 0; i < 5 + d; i++) { const t = tops[(rnd() * tops.length) | 0]; if (t) lantern(v, t[0] + rnd.range(-0.5, 0.5) * R, t[1] + R * rnd.range(0.7, 1.2), 5 + d * 2.2, { chain: R * 0.4, glowR: 7 }); }
  }
  grain(v, S, S, 0.06);
  return { sky: sky.c, vista: vis.c };
};
