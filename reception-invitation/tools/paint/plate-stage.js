/* 5. THE RECEPTION STAGE — a garden reception at night: a pergola stage with a wall of roses inside a
      cusped arch, chandeliers, draped fabric, curtains of fairy lights and a petal-strewn aisle.
      The fairy lights are also exported as two extra layers so they can twinkle. */
'use strict';

function drapePanel(ctx, x0, x1, y0, y1, col, rnd, tieSide) {
  // a curtain gathered to one side with a tie-back
  const w = x1 - x0, tx = tieSide < 0 ? x0 + w * 0.2 : x1 - w * 0.2, ty = lerp(y0, y1, 0.56);
  const outer = tieSide < 0 ? x0 : x1, inner = tieSide < 0 ? x1 : x0;
  const path = () => {
    ctx.beginPath(); ctx.moveTo(outer, y0); ctx.lineTo(inner, y0);
    ctx.bezierCurveTo(inner, lerp(y0, ty, 0.55), lerp(inner, tx, 0.5), lerp(y0, ty, 0.9), tx + tieSide * -w * 0.06, ty);
    ctx.bezierCurveTo(tx + tieSide * -w * 0.2, lerp(ty, y1, 0.4), tx + tieSide * -w * 0.12, lerp(ty, y1, 0.8), tx + tieSide * -w * 0.16, y1);
    ctx.lineTo(outer, y1); ctx.closePath();
  };
  ctx.save(); path(); ctx.clip();
  ctx.fillStyle = rgba(col); ctx.fillRect(x0, y0, w, y1 - y0);
  for (let i = 0; i < 9; i++) { // folds fan out from the tie
    const fx = lerp(x0, x1, (i + 0.5) / 9);
    ctx.strokeStyle = rgba(shade(col, i % 2 ? -0.26 : 0.3), 0.5); ctx.lineWidth = w * 0.06;
    ctx.beginPath(); ctx.moveTo(fx, y0); ctx.quadraticCurveTo(lerp(fx, tx, 0.6), lerp(y0, ty, 0.7), tx + (fx - tx) * 0.12, ty); ctx.quadraticCurveTo(tx + (fx - tx) * 0.3, lerp(ty, y1, 0.5), tx + (fx - tx) * 0.45, y1); ctx.stroke();
  }
  ctx.fillStyle = linGrad(ctx, 0, y0, 0, y1, [[0, '#ffffff', 0.18], [0.5, '#ffffff', 0], [1, '#3a2a4a', 0.3]]); ctx.fillRect(x0, y0, w, y1 - y0);
  ctx.restore();
  ink(ctx, path, '#6a5030', 1.4, 0.3);
  ell(ctx, tx, ty, w * 0.1, w * 0.045, 0, '#cfa65a'); // tie-back
  stroke(ctx, [[tx, ty], [tx + tieSide * -4, ty + w * 0.2]], 3, '#cfa65a', 1); disc(ctx, tx + tieSide * -4, ty + w * 0.22, w * 0.03, '#e6c477');
}
function swag(ctx, x0, x1, y, drop, col) {
  const mx = (x0 + x1) / 2;
  const path = () => { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.quadraticCurveTo(mx, y + drop * 2, x0, y); ctx.closePath(); };
  ctx.fillStyle = linGrad(ctx, 0, y, 0, y + drop, [[0, shade(col, 0.12)], [1, shade(col, -0.2)]]); path(); ctx.fill();
  ctx.save(); path(); ctx.clip();
  for (let i = 1; i < 5; i++) { ctx.strokeStyle = rgba(shade(col, i % 2 ? -0.3 : 0.3), 0.4); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo(mx, y + drop * 2 * (i / 5), x1, y); ctx.stroke(); }
  ctx.restore();
  ink(ctx, path, '#6a5030', 1.3, 0.3);
}
function tassel(ctx, x, y, s) {
  stroke(ctx, [[x, y], [x, y + s * 1.2]], s * 0.14, '#cfa65a', 1); disc(ctx, x, y + s * 1.3, s * 0.22, '#e6c477');
  ctx.fillStyle = '#cfa65a'; ctx.beginPath(); ctx.moveTo(x - s * 0.2, y + s * 1.4); ctx.lineTo(x + s * 0.2, y + s * 1.4); ctx.lineTo(x + s * 0.28, y + s * 2.4); ctx.lineTo(x - s * 0.28, y + s * 2.4); ctx.closePath(); ctx.fill();
}
function sofa(ctx, cx, baseY, w, h) {
  const ivory = '#f7ecda', sh = '#d9c5a8', gold = '#cfa65a';
  ctx.fillStyle = gold; for (const dx of [-0.42, 0.42]) ctx.fillRect(cx + dx * w - 5, baseY - h * 0.14, 10, h * 0.14);
  const back = () => { ctx.beginPath(); ctx.moveTo(cx - w * 0.5, baseY - h * 0.3); ctx.bezierCurveTo(cx - w * 0.52, baseY - h * 0.8, cx - w * 0.36, baseY - h * 0.92, cx - w * 0.22, baseY - h * 0.9); ctx.bezierCurveTo(cx - w * 0.1, baseY - h * 1.1, cx + w * 0.1, baseY - h * 1.1, cx + w * 0.22, baseY - h * 0.9); ctx.bezierCurveTo(cx + w * 0.36, baseY - h * 0.92, cx + w * 0.52, baseY - h * 0.8, cx + w * 0.5, baseY - h * 0.3); ctx.closePath(); };
  ctx.fillStyle = linGrad(ctx, 0, baseY - h * 1.1, 0, baseY - h * 0.3, [[0, '#fffaf0'], [1, sh]]); back(); ctx.fill();
  ctx.save(); back(); ctx.clip();
  for (let r = 0; r < 5; r++) for (let c = 0; c < 12; c++) { const x = cx - w * 0.46 + (c + (r % 2) * 0.5) * (w * 0.92 / 11.5), y = baseY - h * 0.98 + r * h * 0.14; softDab(ctx, x, y, h * 0.08, '#b89c78', 0.35); disc(ctx, x, y, 2.2, gold, 0.9); }
  ctx.restore();
  ink(ctx, back, gold, 4, 0.95);
  // arms + seat
  for (const sgn of [-1, 1]) { ctx.fillStyle = linGrad(ctx, 0, baseY - h * 0.62, 0, baseY - h * 0.14, [[0, ivory], [1, sh]]); ctx.beginPath(); ctx.ellipse(cx + sgn * w * 0.5, baseY - h * 0.5, w * 0.075, h * 0.13, 0, 0, TAU); ctx.fill(); ctx.fillRect(cx + sgn * w * 0.5 - w * 0.075, baseY - h * 0.5, w * 0.15, h * 0.36); ink(ctx, () => { ctx.beginPath(); ctx.ellipse(cx + sgn * w * 0.5, baseY - h * 0.5, w * 0.075, h * 0.13, 0, 0, TAU); }, gold, 2.5, 0.9); }
  ctx.fillStyle = linGrad(ctx, 0, baseY - h * 0.46, 0, baseY - h * 0.14, [[0, '#fffaf0'], [1, sh]]);
  ctx.beginPath(); ctx.roundRect(cx - w * 0.46, baseY - h * 0.46, w * 0.92, h * 0.22, h * 0.08); ctx.fill();
  ctx.fillStyle = sh; ctx.fillRect(cx - w * 0.5, baseY - h * 0.26, w, h * 0.12);
  ctx.fillStyle = gold; ctx.fillRect(cx - w * 0.5, baseY - h * 0.16, w, h * 0.03);
  for (const [dx, rot, col] of [[-0.3, -0.2, '#f1c9c4'], [0.3, 0.2, '#f1c9c4'], [0, 0, '#e9d3a8']]) { ctx.save(); ctx.translate(cx + dx * w, baseY - h * 0.56); ctx.rotate(rot); ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-w * 0.085, -h * 0.13, w * 0.17, h * 0.26, 8); ctx.fill(); ctx.strokeStyle = rgba('#8a6a4a', 0.35); ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore(); }
}

PLATES.stage = function () {
  const rnd = makeRnd(505);
  const TOP = 790, PY = 1440, FRONT = 1505, G = 1450; // beam, platform back edge, platform front edge, ground line
  const LA = layer(S, S), LB = layer(S, S), groups = [LA.ctx, LB.ctx];

  /* --- back: night sky, garden, palace wings --- */
  const back = layer(S, S), k = back.ctx;
  skyGradient(k, [[0, '#0b1033'], [0.2, '#121848'], [0.42, '#1e2562'], [0.56, '#343379'], [0.628, '#51438a'], [0.632, '#1a2348'], [1, '#0a1226']]);
  for (let i = 0; i < 30; i++) softDab(k, rnd() * S, rnd.range(0, 1000), rnd.range(140, 360), rnd.pick(['#2f33a0', '#4a3a98']), 0.06);
  starfield(k, S, 1250, 760, rnd, { bias: 1.3 });
  glow(k, C, 1180, 1050, '#ffb46a', 0.17); glow(k, C, 1220, 600, '#ffd08a', 0.16);
  const N = { light: '#4d4c8c', mid: '#373873', shadow: '#25285c', line: '#12143a', gold: '#d9b25e' };
  const dim = { stops: [[0, '#8a5a4a'], [1, '#d9a468']], halo: 1.2, haloA: 0.12 };
  for (const sgn of [-1, 1]) {
    const x0 = sgn < 0 ? -20 : C + 760, w = C - 760 + 20;
    hGradRect(k, x0, 1080, w, G - 1080, N.light, N.mid, N.shadow); merlons(k, x0, x0 + w, 1080, 15, N);
    for (let i = 0; i < 5; i++) { const x = x0 + (w * (i + 0.5)) / 5; glowArch(k, x, G, 62, 150, dim); glowArch(k, x, 1230, 34, 62, dim); }
    chhatri(k, C + sgn * 1060, 1080, 120, 190, N, { glow: '#ffb45c', inside: '#f0bf78', insideA: 0.85 });
    chhatri(k, C + sgn * 840, 1080, 96, 150, N, { glow: '#ffb45c', inside: '#f0bf78', insideA: 0.85 });
    for (let x = x0; x < x0 + w; x += 90) softDab(k, x, G - 10, 200, '#ffa860', 0.12);
  }
  const night = { base: '#0a152b', mid: '#13283c', light: '#22484a', hi: '#4b7a62' };
  for (const [dx, h] of [[-960, 980], [960, 1000], [-720, 800], [720, 780]]) {
    const cls = tree(k, C + dx, G + 20, h, night, rnd, { crown: 0.36, rim: 0.9, clusters: 12, sx: 1.3, sy: 0.75, density: 1.05, trunk: '#0c0f20', trunkLight: '#b0764e' });
    for (let i = 0; i < 5; i++) { const c = cls[1 + ((rnd() * (cls.length - 1)) | 0)], ch = rnd.range(50, 190); lantern(k, c.x + rnd.range(-0.3, 0.3) * c.r, c.y + c.r * 0.5 + ch, rnd.range(13, 21), { chain: ch, glowR: 7 }); }
  }
  // the canopy of fairy lights sweeping up from the stage (bulbs go to the twinkle layers)
  const strings = [];
  for (let i = 0; i < 9; i++) { const t = i / 8, a = [C + (t - 0.5) * 1180, TOP - 6], b = [lerp(-260, S + 260, t), lerp(60, -40, Math.abs(t - 0.5) * 2)]; strings.push(catenary(a[0], a[1], b[0], b[1], 110 + 120 * Math.abs(t - 0.5), 40)); }
  strings.forEach((pts, i) => { stroke(k, pts, 1, '#05081c', 0.5); fairyString(k, pts, 40, 3, rnd, { wire: false, groups, shift: i }); });
  for (let i = 0; i < 30; i++) softDab(k, rnd() * S, rnd.range(G, S), rnd.range(100, 300), rnd.pick(['#18304a', '#0c1830']), 0.2);
  grain(k, S, S, 0.05);

  /* --- stage, behind the light curtains --- */
  const sb = layer(S, S), b = sb.ctx;
  for (const sgn of [-1, 1]) { const x0 = sgn < 0 ? C - 560 : C + 300; b.fillStyle = linGrad(b, 0, TOP, 0, PY, [[0, '#1c2058'], [1, '#34306e']]); b.fillRect(x0, TOP + 30, 260, PY - TOP - 30); }
  // champagne satin panel with the rose wall inside a cusped arch
  hGradRect(b, C - 300, TOP + 30, 600, PY - TOP - 30, '#f3e2c4', '#fff4dc', '#e6cfa8');
  for (let i = 0; i < 12; i++) { const x = C - 300 + i * 50 + 25; b.fillStyle = rgba(i % 2 ? '#c8ab7c' : '#ffffff', 0.16); b.fillRect(x - 9, TOP + 30, 18, PY - TOP - 30); }
  const arch = cuspedArch(C, PY, 510, 592, { foils: 5, spring: 0.44 });
  b.save(); polyPath(b, arch); b.clip();
  b.fillStyle = '#d9b9a8'; b.fillRect(C - 270, PY - 610, 540, 610);
  for (let i = 0; i < 300; i++) leaf(b, C + rnd.range(-265, 265), PY - rnd.range(0, 600), rnd.range(22, 40), rnd() * TAU, jitter(rnd.pick([LEAF.sage, LEAF.euca, LEAF.deep, LEAF.olive]), rnd, 0.05), rnd, { vein: false });
  const wallPals = [FLOWER.ivory, FLOWER.ivory, FLOWER.ivory, FLOWER.blush, FLOWER.blush, FLOWER.blush, FLOWER.peach, FLOWER.rose];
  const pts = [];
  for (let y = PY - 600; y < PY + 20; y += 31) for (let x = C - 270; x < C + 280; x += 33) pts.push([x + rnd.range(-13, 13), y + rnd.range(-13, 13), rnd.range(15, 27)]);
  pts.sort(() => rnd() - 0.5);
  for (const [x, y, r] of pts) { softDab(b, x + 3, y + 5, r * 1.2, '#4a2a3a', 0.25); rose(b, x, y, r, rnd.pick(wallPals), rnd); }
  b.fillStyle = (() => { const g = b.createRadialGradient(C, PY - 330, 60, C, PY - 300, 430); g.addColorStop(0, 'rgba(255,236,196,0.2)'); g.addColorStop(0.55, 'rgba(255,236,196,0)'); g.addColorStop(1, 'rgba(60,30,60,0.42)'); return g; })();
  b.fillRect(C - 300, PY - 620, 600, 640);
  b.restore();
  ink(b, () => polyPath(b, arch), '#b98d3e', 11, 1); ink(b, () => polyPath(b, arch), '#f6dc9a', 4, 0.95);
  // curtains of fairy lights in the side bays
  for (const sgn of [-1, 1]) for (let i = 0; i < 11; i++) {
    const x = (sgn < 0 ? C - 560 : C + 300) + 18 + i * 22.4;
    fairyString(b, [[x, TOP + 36], [x + rnd.range(-3, 3), PY - 30]], 25, 2.4, rnd, { groups, shift: i, wireCol: '#0a0c2a' });
  }

  /* --- stage, in front of the light curtains --- */
  const sf = layer(S, S), f = sf.ctx;
  const IV = { light: '#fffaf0', mid: '#f1e3ca', shadow: '#cdb48e', line: '#6a5030' };
  // aisle carpet
  const AY = 1577, cw = (y) => lerp(282, 640, (y - AY) / (S - AY));
  f.fillStyle = linGrad(f, 0, AY, 0, S, [[0, '#f2dccb'], [0.4, '#d7b9b4'], [1, '#9a7e98']]);
  f.beginPath(); f.moveTo(C - cw(AY), AY); f.lineTo(C + cw(AY), AY); f.lineTo(C + cw(S), S); f.lineTo(C - cw(S), S); f.closePath(); f.fill();
  for (const sgn of [-1, 1]) for (const inset of [0.04, 0.075]) stroke(f, [[C + sgn * cw(AY) * (1 - inset), AY], [C + sgn * cw(S) * (1 - inset), S]], inset < 0.05 ? 5 : 2, '#cfa65a', 0.75);
  f.save(); f.translate(C, AY + 60); f.scale(1, 0.8); glow(f, 0, 0, 420, '#ffd9a0', 0.14); f.restore();
  const petalCols = ['#f2c6c4', '#fbe2dd', '#d68798', '#fff6f0', '#edb2bc', '#b4566d'];
  for (let i = 0; i < 520; i++) { const y = AY + Math.pow(rnd(), 1.3) * (S - AY), kk = lerp(0.5, 1.7, (y - AY) / (S - AY)), x = C + rnd.gauss() * cw(y) * 0.9; ell(f, x, y, 7 * kk * rnd.range(0.6, 1.3), 4 * kk * rnd.range(0.6, 1.2), rnd() * TAU, rnd.pick(petalCols), rnd.range(0.7, 1)); }
  // platform and steps
  f.fillStyle = linGrad(f, 0, PY, 0, FRONT, [[0, '#d9c4a2'], [1, '#f6ead6']]);
  f.beginPath(); f.moveTo(C - 590, PY); f.lineTo(C + 590, PY); f.lineTo(C + 630, FRONT); f.lineTo(C - 630, FRONT); f.closePath(); f.fill();
  hGradRect(f, C - 630, FRONT, 1260, 72, '#e9d7b8', '#f4e7cf', '#cdb590');
  f.fillStyle = '#cfa65a'; f.fillRect(C - 630, FRONT, 1260, 5); f.fillRect(C - 630, FRONT + 64, 1260, 4);
  for (let i = 0; i < 3; i++) { const w = 440 + i * 62, y = FRONT + i * 24; hGradRect(f, C - w / 2, y, w, 24, '#eadbc0', '#fbf1de', '#d2bb98'); f.fillStyle = rgba('#fffdf4', 0.8); f.fillRect(C - w / 2, y, w, 4); f.fillStyle = rgba('#cfa65a', 0.8); f.fillRect(C - w / 2, y + 21, w, 2.5); }
  // pillars, drapes, beam
  for (const sgn of [-1, 1]) {
    const x0 = sgn < 0 ? C - 560 : C + 300, x1 = x0 + 260;
    drapePanel(f, x0, x0 + 124, TOP + 30, PY, '#f3dcc8', rnd, -1);
    drapePanel(f, x1 - 124, x1, TOP + 30, PY, '#f3dcc8', rnd, 1);
  }
  for (const dx of [-560, -300, 300, 560]) {
    column(f, C + dx, PY, PY - TOP - 28, 46, IV, { flutes: 1 });
    f.fillStyle = '#cfa65a'; f.fillRect(C + dx - 25, TOP + 92, 50, 7); f.fillRect(C + dx - 25, PY - 96, 50, 7);
    f.save(); f.translate(C + dx, PY - 20); f.scale(1, 0.5); glow(f, 0, 0, 120, '#ffc27a', 0.4); f.restore();
  }
  hGradRect(f, C - 604, TOP - 12, 1208, 46, '#efe0c4', '#fff8ea', '#d6bf9a');
  f.fillStyle = '#cfa65a'; f.fillRect(C - 604, TOP - 12, 1208, 5); f.fillRect(C - 604, TOP + 29, 1208, 5);
  for (const [x0, x1, drop] of [[C - 560, C - 300, 46], [C - 300, C, 58], [C, C + 300, 58], [C + 300, C + 560, 46]]) swag(f, x0 + 6, x1 - 6, TOP + 34, drop, '#f0d9bc');
  for (const dx of [-560, -300, 0, 300, 560]) tassel(f, C + dx, TOP + 36, 26);
  // cascades of blossom hanging in the central bay
  const strandPals = [FLOWER.ivory, FLOWER.blush, FLOWER.lavender, FLOWER.ivory];
  for (let x = C - 262; x <= C + 262; x += 21) { const d = Math.abs(x - C) / 262; wisteria(f, x, TOP + 40, 60 + 190 * d * d + rnd.range(0, 50), rnd, rnd.pick(strandPals), { size: 5.5, step: 6 }); }
  // sofa and candle stands
  sofa(f, C, PY + 6, 370, 196);
  for (const sgn of [-1, 1]) {
    const x = C + sgn * 244;
    stroke(f, [[x, PY + 4], [x, PY - 230]], 7, '#cfa65a', 1); ell(f, x, PY + 2, 30, 8, 0, '#b98d3e');
    for (const [dx, dy] of [[-26, 0], [0, -22], [26, 0]]) { stroke(f, [[x, PY - 200], [x + dx, PY - 214 + dy * 0.2], [x + dx, PY - 232 + dy]], 4, '#cfa65a', 1); candle(f, x + dx, PY - 232 + dy, 44, { glowR: 2.2 }); }
    floralCluster(f, x, PY - 8, 52, rnd, { n: 7, sprigs: 5 });
  }
  // floral urns in the side bays
  for (const sgn of [-1, 1]) {
    const x = C + sgn * 430;
    column(f, x, PY, 250, 50, IV, { flutes: 1 });
    f.fillStyle = '#cfa65a'; f.beginPath(); f.moveTo(x - 40, PY - 310); f.quadraticCurveTo(x - 56, PY - 270, x - 22, PY - 250); f.lineTo(x + 22, PY - 250); f.quadraticCurveTo(x + 56, PY - 270, x + 40, PY - 310); f.closePath(); f.fill();
    floralCluster(f, x, PY - 372, 112, rnd, { pals: [[FLOWER.ivory, 3], [FLOWER.blush, 3], [FLOWER.rose, 1], [FLOWER.peach, 1]], n: 11, sprigs: 9 });
  }
  // garland of roses along the beam with fuller sprays over each pillar
  for (let x = C - 600; x <= C + 600; x += 40) { leaf(f, x, TOP - 12, 44, rnd.range(-2.4, -0.7), rnd.pick([LEAF.sage, LEAF.deep, LEAF.euca]), rnd); rose(f, x + rnd.range(-8, 8), TOP - 14 + rnd.range(-9, 9), rnd.range(15, 24), rnd.pick(wallPals), rnd); }
  const sprayPals = [[FLOWER.ivory, 3], [FLOWER.blush, 3], [FLOWER.rose, 1.2], [FLOWER.peach, 1], [FLOWER.wine, 0.5]];
  for (const [dx, r] of [[-560, 118], [-300, 100], [300, 100], [560, 118]]) floralCluster(f, C + dx, TOP - 30, r, rnd, { pals: sprayPals, n: 11, sprigs: 10, sy: 0.85 });
  floralCluster(f, C, TOP - 36, 150, rnd, { pals: sprayPals, n: 14, sprigs: 12, sx: 1.6, sy: 0.7 });
  // chandeliers (flames go to the twinkle layers as well)
  glow(f, C, TOP + 140, 150, '#5a3040', 0.0); chandelier(f, C, TOP + 30, 36, rnd, {}); chandelier(f, C - 430, TOP + 30, 21, rnd, {}); chandelier(f, C + 430, TOP + 30, 21, rnd, {});
  // flowers and lamps along the platform edge, the steps and the aisle
  for (let x = C - 600; x <= C + 600; x += 150) if (Math.abs(x - C) > 230) garland(f, catenary(x, FRONT + 8, x + 150, FRONT + 8, 26, 12), 8, rnd, { pals: [FLOWER.blush, FLOWER.ivory, FLOWER.rose] });
  for (const sgn of [-1, 1]) {
    floralCluster(f, C + sgn * 588, FRONT + 40, 122, rnd, { pals: sprayPals, n: 12, sprigs: 10 });
    for (let i = 0; i < 3; i++) candle(f, C + sgn * (236 + i * 31), FRONT + 24 + i * 24, 34 + i * 4, { glowR: 1.8, glowA: 0.6 });
  }
  for (const y of [1650, 1760, 1915, 2130]) {
    const kk = (y - 1400) / (S - 1400);
    for (const sgn of [-1, 1]) {
      const x = C + sgn * (cw(y) + 60 * kk + 34);
      lightPool(f, x, y, 260 * kk + 60, 80 * kk + 20, '#ffb45c', 0.2);
      lantern(f, x + sgn * 96 * kk + sgn * 20, y - 2.9 * (20 + 44 * kk), 20 + 44 * kk, { glowR: 4.2, glowA: 0.5 });
      floralCluster(f, x - sgn * 16 * kk, y - 20 * kk, 60 + 130 * kk, rnd, { pals: sprayPals, n: 9, sprigs: 7, sy: 0.8 });
      candle(f, x - sgn * 96 * kk - sgn * 34, y + 12 * kk, 26 + 56 * kk, { glowR: 1.5, glowA: 0.55 });
    }
  }
  glow(f, C, 1130, 560, '#ffcf8a', 0.1);
  veil(f, 0, 2000, S, 304, [[0, '#0a1024', 0], [1, '#0a1024', 0.5]]);
  grain(f, S, S, 0.05);

  /* --- assemble --- */
  const stage = layer(S, S), st = stage.ctx;
  stamp(st, sb.c); stamp(st, sf.c);
  grain(sb.ctx, S, S, 0.05);
  // the back layer keeps the lights dimly lit; the twinkle layers add the sparkle on top
  stamp(k, LA.c, 0, 0.5); stamp(k, LB.c, 0, 0.5);
  // the sky dissolves into flat night blue at the very top, so the page can extend it upwards without a seam
  k.fillStyle = linGrad(k, 0, 0, 0, 380, [[0, '#0b1033', 1], [0.3, '#0b1033', 0.92], [1, '#0b1033', 0]]); k.fillRect(0, 0, S, 380);
  for (const L of [LA, LB]) { L.ctx.globalCompositeOperation = 'destination-out'; L.ctx.fillStyle = linGrad(L.ctx, 0, 0, 0, 380, [[0, '#000', 1], [0.3, '#000', 0.92], [1, '#000', 0]]); L.ctx.fillRect(0, 0, S, 380); L.ctx.globalCompositeOperation = 'source-over'; }
  for (const L of [LA, LB]) { L.ctx.globalCompositeOperation = 'destination-out'; L.ctx.drawImage(sf.c, 0, 0); L.ctx.globalCompositeOperation = 'source-over'; }
  // side-bay light curtains must sit behind the drapes: bake a dim copy into the stage layer itself
  const stage2 = layer(S, S), s2 = stage2.ctx;
  stamp(s2, sb.c); stamp(s2, LA.c, 0, 0.45); stamp(s2, LB.c, 0, 0.45);
  // (only the part inside the stage structure, so the sky canopy is not doubled)
  s2.globalCompositeOperation = 'destination-in'; s2.fillStyle = '#000'; s2.fillRect(C - 606, TOP - 14, 1212, PY - TOP + 14); s2.globalCompositeOperation = 'source-over';
  stamp(s2, sf.c);
  LA.c._quality = 0.86; LB.c._quality = 0.86;
  return { back: back.c, stage: stage2.c, lightsA: LA.c, lightsB: LB.c };
};
