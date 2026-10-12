/* Decorative sprites used on top of the plates: floral corners, rose bed, wisteria, foreground foliage,
   balustrade, floral ring, velvet curtain, petals, wax seal and paper textures. */
'use strict';

PLATES.sprites = function () {
  const out = {};
  const lush = [[FLOWER.blush, 3], [FLOWER.ivory, 3], [FLOWER.rose, 1.3], [FLOWER.peach, 1], [FLOWER.wine, 0.4]];

  /* corner-floral: sits in a top-left corner (mirror it with CSS for the others) */
  {
    const L = layer(1000, 1000), c = L.ctx, rnd = makeRnd(611);
    for (const [x, y, a, len] of [[420, 120, 0.05, 520], [120, 420, 1.52, 520], [520, 200, 0.3, 380], [200, 520, 1.27, 380], [300, 300, 0.78, 420]]) sprig(c, x, y, len, a, rnd.pick([LEAF.sage, LEAF.euca, LEAF.deep]), rnd, { bend: rnd.range(-0.25, 0.25), round: rnd() < 0.4 });
    floralCluster(c, 800, 96, 78, rnd, { pals: lush, n: 6, sprigs: 5 });
    floralCluster(c, 96, 800, 78, rnd, { pals: lush, n: 6, sprigs: 5 });
    floralCluster(c, 580, 150, 128, rnd, { pals: lush, n: 9, sprigs: 7, sx: 1.25, sy: 0.85 });
    floralCluster(c, 150, 580, 128, rnd, { pals: lush, n: 9, sprigs: 7, sx: 0.85, sy: 1.25 });
    floralCluster(c, 270, 270, 215, rnd, { pals: lush, n: 14, sprigs: 10 });
    grain(c, 1000, 1000, 0.05);
    out['corner-floral'] = L.c;
  }

  /* rose-bed: a wide bank of flowers for the bottom of a frame */
  {
    const W = 2600, H = 660, L = layer(W, H), c = L.ctx, rnd = makeRnd(622);
    for (let i = 0; i < 260; i++) leaf(c, rnd() * W, H - rnd.range(0, 230), rnd.range(70, 150), -Math.PI / 2 + rnd.range(-1.1, 1.1), jitter(rnd.pick([LEAF.sage, LEAF.deep, LEAF.euca, LEAF.olive]), rnd, 0.05), rnd);
    c.fillStyle = rgba(LEAF.deep); c.fillRect(0, H - 60, W, 60);
    for (let i = 0; i < 26; i++) sprig(c, rnd() * W, H - rnd.range(150, 300), rnd.range(180, 330), -Math.PI / 2 + rnd.range(-0.8, 0.8), rnd.pick([LEAF.sage, LEAF.euca, LEAF.deep]), rnd, { round: rnd() < 0.4 });
    const xs = []; for (let x = 90; x < W; x += rnd.range(190, 250)) xs.push(x);
    xs.sort(() => rnd() - 0.5);
    for (const x of xs) floralCluster(c, x, H - rnd.range(150, 250), rnd.range(170, 230), rnd, { pals: lush, n: 13, sprigs: 6, sy: 0.82 });
    for (let x = 40; x < W; x += rnd.range(120, 170)) floralCluster(c, x, H - rnd.range(20, 70), rnd.range(110, 150), rnd, { pals: lush, n: 9, sprigs: 2, sy: 0.8 });
    grain(c, W, H, 0.05);
    out['rose-bed'] = L.c;
  }

  /* wisteria: hangs from a top edge */
  {
    const W = 1200, H = 1000, L = layer(W, H), c = L.ctx, rnd = makeRnd(633);
    stroke(c, [[-20, 30], [300, 60], [640, 34], [960, 62], [1220, 30]], 13, '#5a4a3a', 1);
    for (let i = 0; i < 90; i++) { const x = rnd() * W, y = rnd.range(0, 110); leaf(c, x, y, rnd.range(60, 120), Math.PI / 2 + rnd.range(-1.3, 1.3), jitter(rnd.pick([LEAF.sage, LEAF.olive, LEAF.deep, LEAF.lime]), rnd, 0.06), rnd); }
    const R = [];
    for (let x = 20; x < W; x += rnd.range(34, 60)) R.push([x, rnd.range(30, 110), rnd.range(260, 820) * (0.55 + 0.45 * Math.abs(Math.sin(x / 190)))]);
    R.sort((a, b) => a[2] - b[2]);
    for (const [x, y, len] of R) wisteria(c, x, y, len, rnd, rnd() < 0.82 ? FLOWER.lavender : FLOWER.blush, { step: 5, size: 6.6, width: 0.085 });
    for (let i = 0; i < 40; i++) { const x = rnd() * W; leaf(c, x, rnd.range(0, 70), rnd.range(50, 100), Math.PI / 2 + rnd.range(-1.2, 1.2), jitter(rnd.pick([LEAF.sage, LEAF.olive]), rnd, 0.06), rnd); }
    grain(c, W, H, 0.05);
    out.wisteria = L.c;
  }

  /* foliage-fg: dark evening foliage for a bottom-left corner (foreground, usually blurred) */
  {
    const N = 1200, L = layer(N, N), c = L.ctx, rnd = makeRnd(644);
    const cols = ['#10242c', '#17343a', '#1f4544', '#0c1a26', '#2a5a4c'];
    for (let i = 0; i < 46; i++) { const a = -rnd.range(0.05, 1.5), len = rnd.range(380, 1050); sprig(c, rnd.range(-40, 260), N - rnd.range(-40, 260), len, a, rnd.pick(cols), rnd, { bend: rnd.range(-0.35, 0.35), leaf: rnd.range(0.13, 0.2), n: Math.round(len / 60) }); }
    for (let i = 0; i < 150; i++) { const a = -rnd.range(0, 1.57), d = rnd.range(60, 760) * Math.sqrt(rnd()); leaf(c, Math.cos(a) * d + rnd.range(-30, 60), N + Math.sin(a) * d + rnd.range(-60, 30), rnd.range(120, 280), a + rnd.range(-0.7, 0.7), jitter(rnd.pick(cols), rnd, 0.04), rnd, { wide: 0.36 }); }
    const duskPal = [tintPal(FLOWER.blush, '#5a4aa0', 0.32, 0.08), tintPal(FLOWER.ivory, '#6a62b0', 0.32, 0.08), tintPal(FLOWER.rose, '#4a3a90', 0.25, 0.1)];
    for (const [x, y, r] of [[250, 900, 92], [470, 1040, 80], [120, 700, 70], [640, 1120, 64], [340, 720, 56], [90, 1060, 86], [800, 1150, 52], [180, 480, 48]]) { softDab(c, x + 10, y + 16, r * 1.3, '#050a18', 0.4); rose(c, x, y, r, rnd.pick(duskPal), rnd); }
    c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = linGrad(c, 0, 0, N, N, [[0, '#ffb45c', 0.16], [0.5, '#ffb45c', 0], [1, '#050a18', 0.3]]); c.fillRect(0, 0, N, N); c.restore();
    grain(c, N, N, 0.05);
    out['foliage-fg'] = L.c;
  }

  /* balustrade: marble rail the bride rests her hand on */
  {
    const W = 3200, H = 640, L = layer(W, H), c = L.ctx, rnd = makeRnd(655);
    const pal = { light: '#f6e4e2', mid: '#d3b9c8', shadow: '#a089ae', line: '#4a3550', hi: '#fffaf4' };
    c.fillStyle = linGrad(c, 0, 60, 0, H, [[0, '#2a2450', 0.0], [0.3, '#2a2450', 0.25], [1, '#1a1838', 0.5]]); c.fillRect(0, 100, W, H - 100); // dusk seen between balusters
    balustrade(c, -40, W + 40, 44, 540, pal, { gap: 150 });
    c.fillStyle = linGrad(c, 0, 20, 0, 70, [[0, pal.hi], [1, pal.light]]); c.fillRect(0, 20, W, 44); // capping stone
    ink(c, () => { c.beginPath(); c.rect(-10, 20, W + 20, 44); }, pal.line, 1.6, 0.35);
    c.fillStyle = linGrad(c, 0, 584, 0, H, [[0, pal.mid], [1, pal.shadow]]); c.fillRect(0, 584, W, H - 584);
    wash(c, () => { c.beginPath(); c.rect(0, 0, W, H); }, [0, 0, W, H], ['#ffd9c0', '#8f7aa8', '#ffeede'], rnd, 60, 0.07);
    c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = linGrad(c, 0, 0, 0, H, [[0, '#ffc9a0', 0.12], [0.4, '#6a5a9a', 0.1], [1, '#2a2450', 0.42]]); c.fillRect(0, 0, W, H); c.restore();
    grain(c, W, H, 0.06);
    out.balustrade = L.c;
  }

  /* floral-ring: a moon-gate of roses with fairy lights */
  {
    const N = 1900, cx = N / 2, R = 700, L = layer(N, N), c = L.ctx, rnd = makeRnd(666);
    const wgt = (a) => 1 + 0.42 * Math.cos(a - 2.3) + 0.28 * Math.cos(a + 0.75); // heavier bottom-left and top-right
    for (let i = 0; i < 70; i++) { const a = (i / 70) * TAU + rnd.range(-0.03, 0.03), r = R + rnd.range(-40, 40); sprig(c, cx + Math.cos(a) * r, cx + Math.sin(a) * r, rnd.range(170, 300) * wgt(a), a + rnd.sign() * rnd.range(1.1, 1.9), rnd.pick([LEAF.sage, LEAF.euca, LEAF.deep, LEAF.olive]), rnd, { round: rnd() < 0.35, bend: rnd.range(-0.4, 0.4) }); }
    for (let i = 0; i < 26; i++) { const a = Math.PI + rnd.range(0.25, Math.PI - 0.25), r = R - 50; wisteria(c, cx + Math.cos(a) * r, cx + Math.sin(a) * r + 20, rnd.range(120, 330), rnd, rnd.pick([FLOWER.lavender, FLOWER.ivory, FLOWER.blush]), { size: 6.5, step: 6 }); }
    const cl = [];
    for (let i = 0; i < 34; i++) { const a = (i / 34) * TAU + rnd.range(-0.05, 0.05); cl.push([a, R + rnd.range(-26, 26), rnd.range(92, 128) * wgt(a)]); }
    cl.sort((p, q) => Math.sin(p[0]) - Math.sin(q[0])); // top first, bottom (nearest) last
    for (const [a, r, s] of cl) floralCluster(c, cx + Math.cos(a) * r, cx + Math.sin(a) * r, s, rnd, { pals: lush, n: 9, sprigs: 3, rot: a + Math.PI / 2, sx: 1.25, sy: 0.9 });
    for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU + rnd.range(-0.03, 0.03), r = R + rnd.range(-70, 70); bulb(c, cx + Math.cos(a) * r, cx + Math.sin(a) * r, rnd.range(3, 4.4), '#ffcf7a', 0.95); }
    grain(c, N, N, 0.05);
    out['floral-ring'] = L.c;
  }

  /* curtain: one velvet panel (left side; mirror for the right) */
  {
    const W = 1100, H = 2400, L = layer(W, H), c = L.ctx, rnd = makeRnd(677);
    c.fillStyle = '#6c1830'; c.fillRect(0, 0, W, H);
    let x = 0;
    while (x < W - 60) {
      const w = rnd.range(70, 150);
      const g = c.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, '#3d0a1a'); g.addColorStop(0.35, '#7f2038'); g.addColorStop(0.55, '#a8384f'); g.addColorStop(0.7, '#8a2540'); g.addColorStop(1, '#3d0a1a');
      c.fillStyle = g; c.fillRect(x, 0, w + 1, H); x += w;
    }
    for (let i = 0; i < 60; i++) softDab(c, rnd() * W, rnd() * H, rnd.range(120, 400), rnd.pick(['#2a0612', '#b0445a', '#5a1428']), 0.07);
    c.fillStyle = linGrad(c, 0, 0, 0, H, [[0, '#18040c', 0.62], [0.12, '#18040c', 0.1], [0.75, '#18040c', 0], [1, '#18040c', 0.4]]); c.fillRect(0, 0, W, H);
    // gold braid on the leading edge and a fringe along the hem
    const gx = W - 62;
    c.fillStyle = linGrad(c, gx, 0, W, 0, [[0, '#8a6420'], [0.3, '#f3d58a'], [0.55, '#caa04a'], [0.8, '#f6e2a6'], [1, '#8a6420']]); c.fillRect(gx, 0, 62, H);
    for (let y = 16; y < H; y += 46) { c.fillStyle = rgba('#7a5416', 0.7); c.beginPath(); c.moveTo(gx + 31, y); c.lineTo(gx + 50, y + 23); c.lineTo(gx + 31, y + 46); c.lineTo(gx + 12, y + 23); c.closePath(); c.fill(); disc(c, gx + 31, y + 23, 6, '#fff3c6', 0.9); }
    c.fillStyle = linGrad(c, 0, H - 120, 0, H - 76, [[0, '#8a6420'], [0.5, '#f3d58a'], [1, '#a47a2a']]); c.fillRect(0, H - 120, W, 44);
    for (let fx = 4; fx < W; fx += 9) stroke(c, [[fx, H - 78], [fx + rnd.range(-2, 2), H - rnd.range(4, 22)]], 4, rnd.pick(['#d9b25e', '#f3d58a', '#b98d3e']), 1);
    grain(c, W, H, 0.07);
    L.c._quality = 0.86;
    out.curtain = L.c;
  }

  /* petals: sprite strip of 8 petals (160 px cells) for the falling-petal effect */
  {
    const N = 160, L = layer(N * 8, N), c = L.ctx, rnd = makeRnd(688);
    const defs = [[FLOWER.blush, 0], [FLOWER.ivory, 0], [FLOWER.rose, 0], [FLOWER.peach, 0], [FLOWER.blush, 1], [FLOWER.rose, 1], [FLOWER.marigold, 2], [FLOWER.gold, 2]];
    defs.forEach(([pal, kind], i) => {
      c.save(); c.translate(i * N + N / 2, N / 2);
      const g = c.createLinearGradient(-60, 0, 60, 0); g.addColorStop(0, rgba(pal.dark)); g.addColorStop(0.5, rgba(pal.mid)); g.addColorStop(1, rgba(pal.light));
      c.fillStyle = g; c.beginPath();
      if (kind === 0) { c.moveTo(-62, 0); c.bezierCurveTo(-30, -52, 40, -56, 62, -14); c.quadraticCurveTo(48, 0, 62, 14); c.bezierCurveTo(40, 56, -30, 52, -62, 0); }
      else if (kind === 1) { c.moveTo(-64, 4); c.bezierCurveTo(-34, -40, 30, -44, 64, -8); c.bezierCurveTo(36, 40, -24, 38, -64, 4); }
      else { c.moveTo(-64, 0); c.bezierCurveTo(-30, -26, 30, -30, 64, -10); c.quadraticCurveTo(56, 0, 64, 10); c.bezierCurveTo(30, 30, -30, 26, -64, 0); }
      c.fill();
      c.save(); c.clip(); softDab(c, 10, -22, 54, pal.hi, 0.6); softDab(c, -44, 8, 40, pal.deep, 0.3); c.restore();
      c.strokeStyle = rgba(pal.deep, 0.28); c.lineWidth = 1.6; c.lineCap = 'round';
      for (const k of [-0.5, 0, 0.5]) { c.beginPath(); c.moveTo(-54, 0); c.quadraticCurveTo(0, k * 30, 48, k * 34); c.stroke(); }
      c.restore();
    });
    L.c._mdScale = 1;
    out.petals = L.c;
  }

  /* seal: wax seal (the monogram is added on top in HTML so it follows config.js) */
  {
    const N = 640, L = layer(N, N), c = L.ctx, rnd = makeRnd(699), cx = N / 2;
    softDab(c, cx + 8, cx + 16, 310, '#1a0610', 0.45);
    const edge = () => blobPath(c, cx, cx, 268, rnd, { n: 13, rough: 0.07 });
    const g = c.createRadialGradient(cx - 70, cx - 90, 30, cx, cx, 290);
    g.addColorStop(0, '#b23a52'); g.addColorStop(0.5, '#8a2138'); g.addColorStop(1, '#561022');
    c.fillStyle = g; edge(); c.fill();
    c.save(); c.clip();
    softDab(c, cx - 120, cx - 140, 190, '#ffd0d6', 0.22); softDab(c, cx + 130, cx + 150, 220, '#2a050f', 0.4);
    c.restore();
    // pressed centre with a bevel
    c.strokeStyle = rgba('#3d0915', 0.75); c.lineWidth = 16; c.beginPath(); c.arc(cx + 3, cx + 4, 196, 0, TAU); c.stroke();
    c.strokeStyle = rgba('#e7909f', 0.5); c.lineWidth = 7; c.beginPath(); c.arc(cx - 3, cx - 4, 199, Math.PI * 0.85, Math.PI * 1.75); c.stroke();
    const g2 = c.createRadialGradient(cx - 50, cx - 60, 20, cx, cx, 200); g2.addColorStop(0, '#a02f47'); g2.addColorStop(1, '#771a2f');
    c.fillStyle = g2; c.beginPath(); c.arc(cx, cx, 190, 0, TAU); c.fill();
    c.strokeStyle = rgba('#e3b56a', 0.75); c.lineWidth = 3; c.beginPath(); c.arc(cx, cx, 168, 0, TAU); c.stroke();
    for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; disc(c, cx + Math.cos(a) * 179, cx + Math.sin(a) * 179, 2.6, '#e3b56a', 0.75); }
    softDab(c, cx - 80, cx - 96, 60, '#ffe2e6', 0.18);
    grain(c, N, N, 0.06);
    L.c._mdScale = 1;
    out.seal = L.c;
  }

  /* card-paper: handmade ivory paper for the invitation card */
  {
    const W = 1200, H = 1700, L = layer(W, H), c = L.ctx, rnd = makeRnd(710);
    c.fillStyle = '#fbf3e3'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) softDab(c, rnd() * W, rnd() * H, rnd.range(120, 420), rnd.pick(['#fffaf0', '#f3e2c4', '#f7e9d2', '#f6dcd0']), 0.2);
    for (let i = 0; i < 500; i++) { const x = rnd() * W, y = rnd() * H, a = rnd() * TAU, l = rnd.range(8, 34); stroke(c, [[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]], 0.8, rnd.pick(['#d9c3a0', '#ffffff']), 0.25); }
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); vg.addColorStop(0, 'rgba(201,160,108,0)'); vg.addColorStop(1, 'rgba(201,160,108,0.3)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    grain(c, W, H, 0.035);
    L.c._quality = 0.88;
    out['card-paper'] = L.c;
  }

  /* envelope-paper: blush paper with a tone-on-tone embossed floral pattern */
  {
    const N = 1600, L = layer(N, N), c = L.ctx, rnd = makeRnd(721);
    c.fillStyle = '#f0d5cc'; c.fillRect(0, 0, N, N);
    for (let i = 0; i < 70; i++) softDab(c, rnd() * N, rnd() * N, rnd.range(160, 460), rnd.pick(['#f8e4dc', '#e6c1b8', '#f3dbd0']), 0.22);
    const motif = (x, y, s, col, a) => {
      c.save(); c.translate(x, y); c.strokeStyle = rgba(col, a); c.fillStyle = rgba(col, a * 0.5); c.lineWidth = 2.2; c.lineCap = 'round';
      for (let i = 0; i < 8; i++) { c.save(); c.rotate((i / 8) * TAU); c.beginPath(); c.ellipse(s * 0.5, 0, s * 0.3, s * 0.13, 0, 0, TAU); c.fill(); c.stroke(); c.restore(); }
      c.beginPath(); c.arc(0, 0, s * 0.14, 0, TAU); c.stroke();
      for (const sgn of [-1, 1]) { c.beginPath(); c.moveTo(0, sgn * s * 0.85); c.quadraticCurveTo(sgn * s * 0.5, sgn * s * 1.2, sgn * s * 0.2, sgn * s * 1.7); c.stroke(); c.beginPath(); c.ellipse(sgn * s * 0.42, sgn * s * 1.28, s * 0.3, s * 0.12, sgn * 0.9, 0, TAU); c.stroke(); }
      c.restore();
    };
    for (let r = -1; r < 13; r++) for (let q = -1; q < 12; q++) { const x = q * 150 + (r % 2 ? 75 : 0), y = r * 140; motif(x + 2.5, y + 3, 34, '#b98a86', 0.34); motif(x - 2, y - 2.5, 34, '#fff6f0', 0.6); motif(x, y, 34, '#e9c7bf', 0.5); }
    const vg = c.createRadialGradient(N / 2, N / 2, N * 0.25, N / 2, N / 2, N * 0.78); vg.addColorStop(0, 'rgba(120,60,70,0)'); vg.addColorStop(1, 'rgba(120,60,70,0.3)');
    c.fillStyle = vg; c.fillRect(0, 0, N, N);
    grain(c, N, N, 0.08);
    L.c._quality = 0.88;
    out['envelope-paper'] = L.c;
  }
  return out;
};
