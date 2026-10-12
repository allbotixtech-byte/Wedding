/* ============================================================================
   Reception invitation — film engine

   The whole invitation is ONE timeline that is a pure function of time:
   renderAt(t) puts every element, the camera and every particle where it belongs
   at second t. The website plays it against the soundtrack; the MP4 renderer
   (render/render.mjs) steps through it frame by frame with ?render=1. Nothing in
   here uses CSS animations or random timers, so the two are always identical.
   ============================================================================ */
(function () {
  'use strict';

  const CFG = window.INVITE_CONFIG || {};
  const TXT = CFG.TEXT || {};
  const Q = new URLSearchParams(location.search);
  const RENDER = Q.has('render');
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const stage = $('#stage');
  const audio = $('#music');

  /* Scene start times in seconds. They sit on the 3-second bars of the soundtrack (60 BPM, 3/4).
     The film is 59.5 s long so that it fits a single 60-second Instagram / WhatsApp story. */
  const T = { open: 0, s1: 3, s2: 9, s3: 15, s4: 21, s5: 30, s6: 39, s7: 51, fade: 57.35, end: 59.5 };
  const DURATION = T.end;

  /* ------------------------------------------------------------------ content */
  const first = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  const SIGN = `${first(CFG.BRIDE_NAME)} & ${first(CFG.GROOM_NAME)}`;
  const DATE_LINE = [CFG.EVENT_DAY, CFG.EVENT_DATE].filter(Boolean).join(', ');

  function fillContent() {
    const put = (sel, fn) => $$(sel).forEach((el) => { el.textContent = fn(el) || ''; });
    put('[data-text]', (el) => TXT[el.dataset.text]);
    put('[data-name]', (el) => (el.dataset.name === 'bride' ? CFG.BRIDE_NAME : CFG.GROOM_NAME));
    put('[data-together]', (el) => (TXT.together || [])[+el.dataset.together]);
    put('[data-closing]', (el) => (TXT.closing || [])[+el.dataset.closing]);
    put('[data-sign]', () => SIGN);
    put('[data-event-type]', () => CFG.EVENT_TYPE);
    put('[data-date]', () => DATE_LINE);
    put('[data-venue]', () => CFG.VENUE_NAME);
    put('[data-address-inline]', () => CFG.VENUE_ADDRESS);
    const lines = (el, arr) => { el.textContent = ''; arr.filter(Boolean).forEach((l) => { const s = document.createElement('span'); s.textContent = l; el.append(s); }); };
    $$('[data-address]').forEach((el) => lines(el, CFG.VENUE_ADDRESS_LINES && CFG.VENUE_ADDRESS_LINES.length ? CFG.VENUE_ADDRESS_LINES : [CFG.VENUE_ADDRESS]));
    $$('[data-foot]').forEach((el) => lines(el, [[CFG.EVENT_TYPE, DATE_LINE].filter(Boolean).join('  ·  '), CFG.VENUE_SHORT || CFG.VENUE_NAME]));
    $$('[data-monogram]').forEach((el) => { el.innerHTML = ''; const a = document.createElement('span'), b = document.createElement('i'), c = document.createElement('span'); a.textContent = first(CFG.BRIDE_NAME).charAt(0); b.textContent = '&'; c.textContent = first(CFG.GROOM_NAME).charAt(0); el.append(a, b, c); });
    // optional details: only shown when filled in, never as empty placeholders
    const opt = (sel, value) => $$(sel).forEach((el) => { el.hidden = !value; el.textContent = value || ''; });
    opt('[data-time]', CFG.EVENT_TIME); opt('[data-rsvp]', CFG.RSVP_DETAILS);
    document.title = `${SIGN} — ${CFG.EVENT_TYPE} Invitation`;
    stage.classList.toggle('no-couple', CFG.SHOW_COUPLE_PORTRAIT === false);
    // split text that is revealed letter by letter / word by word
    $$('[data-split]').forEach((el) => {
      const mode = el.dataset.split, text = el.textContent, words = text.split(' ');
      el.textContent = ''; el.setAttribute('aria-label', text);
      words.forEach((w, i) => {
        const ws = document.createElement('span'); ws.className = 'w'; ws.setAttribute('aria-hidden', 'true');
        if (mode === 'letters') for (const ch of w) { const c = document.createElement('span'); c.className = 'ch'; c.textContent = ch; ws.append(c); }
        else ws.textContent = w;
        el.append(ws); if (i < words.length - 1) el.append(' ');
      });
      el._parts = $$(mode === 'letters' ? '.ch' : '.w', el);
    });
  }

  /* ------------------------------------------------------------------ assets */
  const bigSide = Math.max(window.innerWidth, window.innerHeight) * Math.min(window.devicePixelRatio || 1, 2);
  const RES = Q.get('res') || (RENDER || bigSide > 1700 ? 'hd' : 'md');
  const fxImg = (name) => `assets/effects/${RES}/${name}.webp`;
  const petalSheet = new Image();

  function loadAssets() {
    const waits = [];
    const ready = (img) => new Promise((res) => { if (img.complete && img.naturalWidth) return res(); img.addEventListener('load', res, { once: true }); img.addEventListener('error', () => { console.warn('missing image', img.src); res(); }, { once: true }); });
    $$('img[data-plate]').forEach((img) => { img.src = `assets/backgrounds/${RES}/${img.dataset.plate}.webp`; });
    $$('img[data-effect]').forEach((img) => { img.src = fxImg(img.dataset.effect); });
    $$('img[data-char]').forEach((img) => { img.src = (CFG.IMAGES || {})[img.dataset.char]; });
    $$('#stage img').forEach((img) => { img.decoding = 'sync'; waits.push(ready(img).then(() => (RENDER && img.decode ? img.decode().catch(() => {}) : null))); });
    // textures used as CSS backgrounds / masks
    const css = document.createElement('style');
    css.textContent = `#stage{--img-card:url("${fxImg('card-paper')}");--img-env:url("${fxImg('envelope-paper')}");--img-curtain:url("${fxImg('curtain')}");--img-corner:url("${fxImg('corner-floral')}");--img-wisteria:url("${fxImg('wisteria')}")}` +
      $$('[data-mask]').map((el) => `.sheen[data-mask="${el.dataset.mask}"]{--mask:url("${(CFG.IMAGES || {})[el.dataset.mask]}")}`).join('');
    document.head.append(css);
    for (const n of ['card-paper', 'envelope-paper', 'curtain']) { const im = new Image(); im.src = fxImg(n); waits.push(ready(im)); }
    petalSheet.src = fxImg('petals'); waits.push(ready(petalSheet));
    if (document.fonts && document.fonts.load) {
      for (const f of ['400 1em "Great Vibes"', '500 1em "Cormorant Garamond"', 'italic 500 1em "Cormorant Garamond"', '600 1em "Cormorant Garamond"', '700 1em "Cormorant Garamond"', '500 1em "Cinzel"', '600 1em "Cinzel"']) waits.push(document.fonts.load(f).catch(() => {}));
      waits.push(document.fonts.ready);
    }
    if (CFG.MUSIC) audio.src = CFG.MUSIC;
    return Promise.all(waits);
  }

  /* ------------------------------------------------------------------ layout */
  let L = { w: 1080, h: 1920, u: 10.8, land: false };
  function measure() {
    const w = stage.clientWidth, h = stage.clientHeight, land = w > h;
    const u = (land ? Math.min(h, (w * 9) / 16) : Math.min(w, (h * 9) / 16)) / 100;
    const st = stage.style;
    st.setProperty('--u', u + 'px'); st.setProperty('--sw', w + 'px'); st.setProperty('--sh', h + 'px'); st.setProperty('--ws', Math.max(w, h) + 'px');
    stage.classList.toggle('landscape', land); stage.classList.toggle('portrait', !land);
    return { w, h, u, land };
  }

  /* ------------------------------------------------------------------ particles (pure functions of time) */
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const R = mulberry32(20261128);
  const FX = { petals: 0, fire: 0, dust: 0, stars: 0, ring: 0, ringR: 1 };
  const fxc = $('#fx'), g = fxc.getContext('2d');
  const PETALS = Array.from({ length: 62 }, (_, i) => ({ k: R() < 0.12 ? 6 + (i % 2) : i % 6, z: 0.5 + Math.pow(R(), 1.7) * 1.7, x0: R(), y0: R(), vy: 0.04 + R() * 0.045, sway: 0.02 + R() * 0.05, sf: 0.5 + R() * 0.9, ph: R() * 6.283, rs: (R() - 0.5) * 1.7, fs: 0.7 + R() * 1.5, fp: R() * 6.283, a: 0.7 + R() * 0.3 }));
  const BURST = Array.from({ length: 170 }, (_, i) => ({ k: i % 6, d: R() * 0.45, life: 0.5 + R() * 0.25, y: R(), amp: (R() - 0.5) * 0.3, rise: (R() - 0.3) * 0.25, s: 3.5 + R() * 8, r0: R() * 6.283, rs: (R() - 0.5) * 7, fs: 2 + R() * 4, ang: R() * 6.283, rad: 0.35 + R() * 0.85 }));
  const FLIES = Array.from({ length: 38 }, () => ({ x: R(), y: 0.22 + R() * 0.76, ax: 0.015 + R() * 0.04, ay: 0.012 + R() * 0.03, f1: 0.25 + R() * 0.5, f2: 0.4 + R() * 0.7, f3: 0.2 + R() * 0.5, p1: R() * 6.283, p2: R() * 6.283, p3: R() * 6.283, ft: 0.9 + R() * 1.6, pt: R() * 6.283, s: 0.9 + R() * 1.3 }));
  const DUST = Array.from({ length: 78 }, () => ({ x: R(), y: R(), v: 0.012 + R() * 0.03, f: 0.5 + R() * 1.2, p: R() * 6.283, s: 0.24 + R() * 0.5, ft: 1.2 + R() * 2.6, pt: R() * 6.283 }));
  const STARS = Array.from({ length: 30 }, () => ({ x: R(), y: R() * 0.46, s: 0.7 + R() * 1.3, ft: 0.7 + R() * 1.7, pt: R() * 6.283 }));
  const RING = Array.from({ length: 54 }, (_, i) => ({ a: (i / 54) * 6.283 + R() * 0.1, r: 0.92 + R() * 0.2, s: 0.6 + R() * 1.2, ft: 2 + R() * 4, pt: R() * 6.283, w: 0.4 + R() * 0.5 }));
  const SPARK = Array.from({ length: 34 }, () => ({ x: R(), y: R(), d: R() * 0.55, life: 0.3 + R() * 0.28, s: 0.8 + R() * 1.7 }));
  let petalBursts = [], sparkBursts = [];
  let glowSprite, sparkSprite, petalBlur, fxDpr = 1;

  function makeSprites() {
    const mk = (n, draw) => { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); return c; };
    glowSprite = mk(96, (c, n) => { const gr = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, 'rgba(255,252,224,1)'); gr.addColorStop(0.16, 'rgba(255,236,160,0.85)'); gr.addColorStop(0.45, 'rgba(255,205,96,0.25)'); gr.addColorStop(1, 'rgba(255,190,80,0)'); c.fillStyle = gr; c.fillRect(0, 0, n, n); });
    sparkSprite = mk(128, (c, n) => {
      const h = n / 2, gr = c.createRadialGradient(h, h, 0, h, h, h * 0.5); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,244,200,0.7)'); gr.addColorStop(1, 'rgba(255,224,150,0)');
      c.fillStyle = gr; c.fillRect(0, 0, n, n);
      for (const rot of [0, Math.PI / 2]) { c.save(); c.translate(h, h); c.rotate(rot); const lg = c.createLinearGradient(-h, 0, h, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,253,240,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = lg; c.beginPath(); c.moveTo(-h, 0); c.quadraticCurveTo(0, -n * 0.035, h, 0); c.quadraticCurveTo(0, n * 0.035, -h, 0); c.fill(); c.restore(); }
    });
    petalBlur = document.createElement('canvas'); petalBlur.width = petalSheet.naturalWidth || 1280; petalBlur.height = petalSheet.naturalHeight || 160;
    const pb = petalBlur.getContext('2d');
    if ('filter' in pb) pb.filter = 'blur(5px)';
    if (petalSheet.naturalWidth) pb.drawImage(petalSheet, 0, 0);
  }
  function sizeFx() {
    fxDpr = RENDER ? 1 : Math.min(window.devicePixelRatio || 1, L.w * (window.devicePixelRatio || 1) > 1400 ? 1.25 : 1.6);
    fxc.width = Math.round(L.w * fxDpr); fxc.height = Math.round(L.h * fxDpr);
  }
  function drawPetal(k, x, y, size, rot, flip, alpha, blurred) {
    if (alpha <= 0.004 || !petalSheet.naturalWidth) return;
    g.save(); g.globalAlpha = Math.min(1, alpha); g.translate(x, y); g.rotate(rot); g.scale(1, 0.22 + 0.78 * Math.abs(flip));
    g.drawImage(blurred ? petalBlur : petalSheet, k * 160, 0, 160, 160, -size / 2, -size / 2, size, size); g.restore();
  }
  function drawFx(t) {
    const w = L.w, h = L.h, u = L.u;
    g.setTransform(fxDpr, 0, 0, fxDpr, 0, 0); g.clearRect(0, 0, w, h);
    // twinkling stars + rising gold dust + fireflies (additive)
    g.globalCompositeOperation = 'lighter';
    if (FX.stars > 0.01) for (const s of STARS) { const tw = Math.pow(0.5 + 0.5 * Math.sin(t * s.ft + s.pt), 4), sz = u * s.s * (1.2 + tw * 2.2); g.globalAlpha = FX.stars * tw * 0.9; g.drawImage(sparkSprite, s.x * w - sz / 2, s.y * h - sz / 2, sz, sz); }
    if (FX.dust > 0.01) for (const d of DUST) { const y = (((d.y - t * d.v) % 1.1) + 1.1) % 1.1 - 0.05, x = d.x + Math.sin(t * d.f + d.p) * 0.02, tw = 0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(t * d.ft + d.pt), 2), sz = u * d.s * 2.6; g.globalAlpha = FX.dust * tw * 0.85; g.drawImage(glowSprite, x * w - sz / 2, y * h - sz / 2, sz, sz); }
    if (FX.fire > 0.01) for (const f of FLIES) { const x = f.x + Math.sin(t * f.f1 + f.p1) * f.ax + Math.sin(t * f.f2 + f.p2) * f.ax * 0.5, y = f.y + Math.cos(t * f.f3 + f.p3) * f.ay + Math.sin(t * f.f1 * 0.7 + f.p2) * f.ay * 0.6, tw = 0.12 + 0.88 * Math.pow(0.5 + 0.5 * Math.sin(t * f.ft + f.pt), 3), sz = u * f.s * 3.4; g.globalAlpha = FX.fire * tw; g.drawImage(glowSprite, x * w - sz / 2, y * h - sz / 2, sz, sz); }
    // sparkle ring around the wax seal
    if (FX.ring > 0.01) { const cx = w / 2, cy = h * 0.52, base = u * 20.5 * FX.ringR; for (const s of RING) { const a = s.a + t * s.w, rr = base * s.r, tw = Math.pow(0.5 + 0.5 * Math.sin(t * s.ft + s.pt), 2), sz = u * s.s * (1.6 + tw * 2.4); g.globalAlpha = FX.ring * (0.25 + 0.75 * tw); g.drawImage(sparkSprite, cx + Math.cos(a) * rr - sz / 2, cy + Math.sin(a) * rr - sz / 2, sz, sz); } }
    // sparkles that bloom around a line of text as it appears
    for (const b of sparkBursts) { const e = (t - b.t) / b.d; if (e <= 0 || e >= 1) continue; for (let i = 0; i < b.n; i++) { const s = SPARK[(i + b.seed) % SPARK.length], q = (e - s.d) / s.life; if (q <= 0 || q >= 1) continue; const a = Math.sin(q * Math.PI), sz = u * s.s * (1.4 + 2.6 * a); g.globalAlpha = a * 0.95; g.drawImage(sparkSprite, (b.x + (s.x * 1.2 - 0.1) * b.w) * w - sz / 2, (b.y + (s.y * 1.5 - 0.25) * b.h) * h - sz / 2, sz, sz); } }
    g.globalCompositeOperation = 'source-over';
    // drifting petals
    if (FX.petals > 0.01) for (const p of PETALS) {
      const sp = p.vy * (0.55 + p.z * 0.5), y = ((p.y0 + t * sp) % 1.26) - 0.13;
      const x = ((((p.x0 + Math.sin(t * p.sf + p.ph) * p.sway + t * 0.011 * p.z) % 1.24) + 1.24) % 1.24) - 0.12;
      drawPetal(p.k, x * w, y * h, u * (1.5 + p.z * 2.5), p.ph + t * p.rs, Math.cos(t * p.fs + p.fp), FX.petals * p.a * (p.z > 1.55 ? 0.85 : 1), p.z > 1.55);
    }
    // petal flurries used as scene transitions
    for (const b of petalBursts) {
      const e = (t - b.t) / b.d; if (e <= 0 || e >= 1) continue;
      const n = Math.round(BURST.length * (b.amount || 1));
      for (let i = 0; i < n; i++) {
        const p = BURST[i], q = (e - p.d) / p.life; if (q <= 0 || q >= 1) continue;
        const ease = q * q * (3 - 2 * q), a = Math.pow(Math.sin(q * Math.PI), 0.6);
        let x, y;
        if (b.kind === 'wipe') { x = lerp(-0.25, 1.25, ease); y = p.y + Math.sin(q * Math.PI) * p.amp - q * p.rise; }
        else { const ang = p.ang + q * 3.6, rad = (0.1 + 0.8 * q) * p.rad; x = 0.5 + Math.cos(ang) * rad * (L.land ? 0.62 : 1); y = 1.08 - q * 1.3 + Math.sin(ang) * 0.1; }
        drawPetal(p.k, x * w, y * h, u * p.s * (b.scale || 1), p.r0 + q * p.rs, Math.cos(q * p.fs * 3 + p.ang), a, p.s > 9);
      }
    }
    g.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ the timeline */
  let tl = null;
  const touched = new Set();
  let idleEls = [], glints = [], twA, twB;

  function build() {
    if (tl) { tl.kill(); gsap.set(Array.from(touched), { clearProps: 'all' }); touched.clear(); }
    L = measure(); sizeFx();
    const u = L.u, P = !L.land;
    Object.assign(FX, { petals: 0, fire: 0, dust: 0, stars: 0, ring: 0, ringR: 1 });
    petalBursts = []; sparkBursts = [];
    // measure where the sparkles should bloom before anything is moved
    const rectOf = (sel) => { const el = typeof sel === 'string' ? $(sel) : sel, r = el.getBoundingClientRect(); return { x: r.left / L.w, y: r.top / L.h, w: r.width / L.w, h: r.height / L.h }; };
    const sparkle = (sel, at, n = 22, d = 2.3) => sparkBursts.push({ ...rectOf(sel), t: at, d, n, seed: sparkBursts.length * 7 });
    sparkle('.c2 .t-name', 11.0); sparkle('.c3 .t-name', 17.0); sparkle('.c4 .t-line-accent', 26.0, 18);
    sparkle('.t-couple', 32.0, 30, 2.8); sparkle('.t-invite strong', 34.7, 16, 2); sparkle('.t-sign', 55.0, 26, 2.8);

    tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out', lazy: false } });
    const reg = (x) => { gsap.utils.toArray(x).forEach((el) => touched.add(el)); return x; };
    const set = (el, vars, at = 0) => tl.set(reg(el), vars, at);
    const to = (el, vars, at) => tl.to(reg(el), vars, at);
    const ft = (el, from, vars, at, init = true) => { if (init) tl.set(reg(el), from, 0); return tl.fromTo(el, from, { ...vars, immediateRender: false }, at); };
    const fx = (vars, at, dur = 1.2) => tl.to(FX, { ...vars, duration: dur, ease: 'sine.inOut' }, at);
    const isScene = (el) => typeof el === 'string' && /^#s\d$/.test(el);
    const showAt = (el, at, dur = 0.8) => { set(el, { autoAlpha: 0 }, 0); if (isScene(el)) set(el, { display: 'block' }, Math.max(0.01, at - 0.12)); to(el, { autoAlpha: 1, duration: dur, ease: 'sine.inOut' }, at); };
    const hideAt = (el, at) => set(el, isScene(el) ? { autoAlpha: 0, display: 'none' } : { autoAlpha: 0 }, at);
    const block = (el, t0, t1) => { set(el, { autoAlpha: 0 }, 0); set(el, { autoAlpha: 1 }, t0); set(el, { autoAlpha: 0 }, t1); };
    const letters = (el, at, stagger = 0.034, dur = 0.7) => { const ch = (typeof el === 'string' ? $(el) : el)._parts; set(ch, { opacity: 0, yPercent: 45 }, 0); to(ch, { opacity: 1, yPercent: 0, duration: dur, stagger, ease: 'power2.out' }, at); };
    const wipe = (el, at, dur = 1.1) => { set(el, { clipPath: 'inset(-30% 110% -30% -10%)' }, 0); to(el, { clipPath: 'inset(-30% -10% -30% -10%)', duration: dur, ease: 'power2.inOut' }, at); };
    const rise = (el, at, o = {}) => { set(el, { opacity: 0, y: (o.y == null ? 2.2 : o.y) * u }, 0); to(el, { opacity: 1, y: 0, duration: o.dur || 0.9, stagger: o.stagger || 0, ease: 'power2.out' }, at); };
    const leave = (el, at, dur = 0.55) => to(el, { opacity: 0, y: -1.2 * u, duration: dur, ease: 'power1.in' }, at);
    const cam = (sc, t0, t1, a, b, ease = 'sine.inOut', init = true) => {
      $$('.layer', $(sc)).forEach((layer) => {
        const d = parseFloat(layer.dataset.depth || '1');
        const A = { scale: 1 + (a.z - 1) * d, xPercent: (a.x || 0) * d, yPercent: (a.y || 0) * d };
        const B = { scale: 1 + (b.z - 1) * d, xPercent: (b.x || 0) * d, yPercent: (b.y || 0) * d };
        ft(layer, A, { ...B, duration: t1 - t0, ease }, t0, init);
      });
    };
    const world = (sc, v) => gsap.set(reg($(sc + ' .world')), v);
    const bloom = (peak, at, up = 0.45, down = 0.8) => { to('#bloom', { opacity: peak, duration: up, ease: 'sine.in' }, at); to('#bloom', { opacity: 0, duration: down, ease: 'sine.out' }, at + up); };

    /* ===== 0 · the sealed envelope opens ===== */
    set('#envelope', { autoAlpha: 1 }, 0);
    ft('.seal-ring', { opacity: 0, scale: 0.72 }, { opacity: 1, scale: 1, duration: 1.1, ease: 'sine.out' }, 0.35);
    to('#seal', { scale: 1.055, duration: 0.55, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.75);
    fx({ ring: 1 }, 0.3, 0.9);
    to('#seal', { scale: 1.42, opacity: 0, rotation: 12, duration: 0.55, ease: 'power2.in' }, 1.9);
    to('.seal-ring', { scale: 2.6, opacity: 0, duration: 0.8, ease: 'power2.out' }, 1.95);
    tl.to(FX, { ringR: 4.2, duration: 1.1, ease: 'power2.out' }, 1.95); fx({ ring: 0 }, 2.05, 0.9);
    to(['.env-copy', '.env-hint'], { opacity: 0, duration: 0.45, ease: 'power1.in' }, 1.85);
    bloom(0.5, 2.1, 0.3, 1.1);
    hideAt('.env-base', 2.28);
    to('.flap-t', { yPercent: -106, duration: 1.3, ease: 'power3.inOut' }, 2.25);
    to('.flap-b', { yPercent: 106, duration: 1.3, ease: 'power3.inOut' }, 2.33);
    to('.flap-l', { xPercent: -106, duration: 1.25, ease: 'power3.inOut' }, 2.4);
    to('.flap-r', { xPercent: 106, duration: 1.25, ease: 'power3.inOut' }, 2.4);
    hideAt('#envelope', 3.75);

    /* ===== 1 · a magical beginning ===== */
    set('#s1', { autoAlpha: 1, display: 'block' }, 0); hideAt('#s1', 9.5);
    world('#s1', { scale: 1.04 });
    cam('#s1', 1.4, 9.8, { z: 1.0, y: P ? 2.4 : 1.2 }, { z: 1.22, y: P ? -1.4 : -0.6 });
    ft('#s1 .fg-bl', { scale: 1, xPercent: 0, yPercent: 0 }, { scale: 1.55, xPercent: -26, yPercent: 20, duration: 8.4, ease: 'sine.inOut' }, 1.4);
    ft('#s1 .fg-br', { scale: 1, xPercent: 0, yPercent: 0 }, { scale: 1.55, xPercent: 26, yPercent: 20, duration: 8.4, ease: 'sine.inOut' }, 1.4);
    fx({ petals: 0.75, fire: 1, stars: 1 }, 2.3, 1.6);
    block('.c1', 3.5, 8.6); letters('.t-opening', 4.0, 0.042, 0.8); leave('.t-opening', 7.6, 0.7);
    // the floral frame grows in
    set('#frame', { autoAlpha: 0 }, 0); set('#frame', { autoAlpha: 1 }, 7.2);
    ft('.frame-line', { opacity: 0, scale: 1.035 }, { opacity: 1, scale: 1, duration: 1.4, ease: 'power2.out' }, 7.5);
    [['tl', '0% 0%', -14], ['tr', '100% 0%', 14], ['bl', '0% 100%', 14], ['br', '100% 100%', -14]].forEach(([k, origin, rot], i) => {
      ft('.frame-corner.' + k, { opacity: 0, scale: 0.5, rotation: rot, transformOrigin: origin }, { opacity: 1, scale: 1, rotation: 0, duration: 1.5, ease: 'back.out(1.25)' }, 7.3 + i * 0.12);
    });
    petalBursts.push({ t: 8.3, d: 1.9, kind: 'swirl', amount: 0.6 });
    bloom(0.72, 8.45, 0.5, 0.9);

    /* ===== 2 · introducing the groom ===== */
    showAt('#s2', 8.75, 0.5); hideAt('#s2', 15.45);
    world('#s2', P ? { scale: 1.05 } : { scale: 1.08, yPercent: -3 });
    cam('#s2', 8.7, 15.6, { z: 1.0, y: 0.7 }, { z: 1.12, y: -0.7 });
    fx({ petals: 0.5, fire: 0.3, dust: 0.75, stars: 0.5 }, 8.9, 1.2);
    ft('#groom .actor-move', { opacity: 0, yPercent: 4.5, scale: 1.035 }, { opacity: 1, yPercent: 0, scale: 1, duration: 1.5, ease: 'power2.out' }, 9.1);
    ft('#groom .actor-shadow', { opacity: 0 }, { opacity: 1, duration: 1.2 }, 9.3);
    to('#groom .actor-move', { scale: 1.035, duration: 4.8, ease: 'sine.inOut' }, 10.6);
    ft('#groom .sheen', { backgroundPosition: '140% 0' }, { backgroundPosition: '-40% 0', duration: 1.6, ease: 'sine.inOut' }, 10.0);
    block('.c2', 9.5, 14.9); ft('.c2 .copy-veil', { opacity: 0 }, { opacity: 1, duration: 1.1, ease: 'sine.inOut' }, 9.5); to('.c2 .copy-veil', { opacity: 0, duration: 0.6 }, 14.15);
    letters('.c2 .t-label', 9.75, 0.03, 0.6); wipe('.c2 .t-name', 11.0, 1.15);
    ft('.c2 .t-flourish', { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: 0.9, ease: 'power2.out' }, 11.75);
    leave(['.c2 .t-label', '.c2 .t-name', '.c2 .t-flourish'], 14.15);
    // petals sweep across and carry us to the bride
    petalBursts.push({ t: 14.2, d: 1.9, kind: 'wipe', amount: 1 });
    bloom(0.42, 14.55, 0.45, 0.8);

    /* ===== 3 · introducing the bride ===== */
    showAt('#s3', 14.7, 0.6); hideAt('#s3', 21.5);
    world('#s3', P ? { scale: 1.04 } : { scale: 1.06, yPercent: -2 });
    cam('#s3', 14.6, 21.7, { z: 1.0, x: 0.9 }, { z: 1.1, x: -0.9 });
    fx({ petals: 0.8, fire: 0.55, dust: 0.45, stars: 0.8 }, 15.0, 1.2);
    ft('#bride .actor-move', { opacity: 0, yPercent: 3.5, scale: 1.03 }, { opacity: 1, yPercent: 0, scale: 1, duration: 1.5, ease: 'power2.out' }, 15.05);
    to('#bride .actor-move', { scale: 1.03, duration: 4.6, ease: 'sine.inOut' }, 16.6);
    ft('#bride .sheen', { backgroundPosition: '140% 0' }, { backgroundPosition: '-40% 0', duration: 1.7, ease: 'sine.inOut' }, 16.0);
    block('.c3', 15.5, 20.9); ft('.c3 .copy-veil', { opacity: 0 }, { opacity: 1, duration: 1.1, ease: 'sine.inOut' }, 15.5); to('.c3 .copy-veil', { opacity: 0, duration: 0.6 }, 20.15);
    letters('.c3 .t-label', 15.75, 0.03, 0.6); wipe('.c3 .t-name', 17.0, 1.15);
    ft('.c3 .t-flourish', { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: 0.9, ease: 'power2.out' }, 17.75);
    leave(['.c3 .t-label', '.c3 .t-name', '.c3 .t-flourish'], 20.15);
    petalBursts.push({ t: 20.3, d: 1.8, kind: 'swirl', amount: 0.5 });
    bloom(0.34, 20.5, 0.5, 0.9);

    /* ===== 4 · a celebration of togetherness ===== */
    showAt('#s4', 20.6, 0.85); hideAt('#s4', 29.42);
    world('#s4', { scale: 1.04 });
    cam('#s4', 20.5, 30, { z: 1.0, y: 0.6 }, { z: 1.14, y: -0.8 });
    fx({ petals: 0.9, fire: 1, dust: 0.5, stars: 1 }, 20.9, 1.4);
    ft('.portrait-ring', { opacity: 0, scale: 0.84, rotation: -9 }, { opacity: 1, scale: 1, rotation: 0, duration: 1.9, ease: 'power2.out' }, 20.85);
    ft('.portrait-halo', { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 1.8, ease: 'sine.out' }, 21.1);
    ft(['#pairPortrait', '#pairDuo'], { opacity: 0, yPercent: 4, scale: 0.97 }, { opacity: 1, yPercent: 0, scale: 1, duration: 1.7, ease: 'power2.out' }, 21.45);
    ft('.portrait-bed', { opacity: 0, yPercent: 14 }, { opacity: 1, yPercent: 0, duration: 1.4 }, 21.3);
    ft('#portrait', { scale: 1 }, { scale: 1.045, duration: 7.2, ease: 'sine.inOut' }, 22.4);
    block('.c4', 21.4, 29.4);
    ft('.c4-veil', { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'sine.inOut' }, 21.5);
    const tLines = $$('.c4 .t-line');
    letters(tLines[0], 22.0, 0.04, 0.75); letters(tLines[1], 24.0, 0.04, 0.75); wipe(tLines[2], 26.0, 1.2);
    leave(tLines, 27.95, 0.55); to('.c4-veil', { opacity: 0, duration: 0.7 }, 27.9);
    // frame bows out, the curtains draw closed, then part on the reception
    to('.frame-corner', { opacity: 0, scale: 0.7, duration: 0.8, ease: 'power2.in', stagger: 0.05 }, 27.75);
    to('.frame-line', { opacity: 0, duration: 0.7 }, 27.85);
    hideAt('#frame', 29.3);
    set('#curtains', { autoAlpha: 0 }, 0); set('#curtains', { autoAlpha: 1 }, 28.3); hideAt('#curtains', 31.6);
    ft('.curtain-l', { scaleX: 0.2, xPercent: -32 }, { scaleX: 1, xPercent: 0, duration: 0.95, ease: 'power2.inOut' }, 28.4);
    ft('.curtain-r', { scaleX: 0.2, xPercent: 32 }, { scaleX: 1, xPercent: 0, duration: 0.95, ease: 'power2.inOut' }, 28.4);
    ft('.curtain-top', { opacity: 0 }, { opacity: 1, duration: 0.9 }, 28.4);
    // they start to part just before the music blooms at 30.0
    to('.curtain-l', { scaleX: 0.2, xPercent: -32, duration: 1.95, ease: 'power2.inOut' }, 29.5);
    to('.curtain-r', { scaleX: 0.2, xPercent: 32, duration: 1.95, ease: 'power2.inOut' }, 29.5);
    to('.curtain-top', { opacity: 0, duration: 1.3 }, 30.1);
    fx({ petals: 0, fire: 0, stars: 0, dust: 0 }, 28.5, 0.8);

    /* ===== 5 · the reception invitation reveal ===== */
    const W5 = P ? { scale: 1.1, xPercent: 0, yPercent: 23.6 } : { scale: 1.25, xPercent: 11.5, yPercent: 2.5 };
    const W6 = P ? { scale: 1.16, xPercent: 0, yPercent: 10 } : { scale: 1.22, xPercent: 0, yPercent: 2 };
    const W7 = P ? { scale: 1.2, xPercent: 0, yPercent: 12.8 } : { scale: 1.3, xPercent: -11, yPercent: 3 };
    set('#s5', { autoAlpha: 0 }, 0); set('#s5', { display: 'block' }, 29.25); set('#s5', { autoAlpha: 1 }, 29.42);
    set('#s5 .world', { scale: W5.scale, xPercent: 0, yPercent: P ? 1 : 2 }, 0);
    to('#s5 .world', { xPercent: W5.xPercent, yPercent: W5.yPercent, duration: 4.2, ease: 'power2.inOut' }, 30.0);
    cam('#s5', 29.4, 34.4, { z: 1.36 }, { z: 1.0 }, 'power2.inOut');
    fx({ petals: 0.7, fire: 0.4, dust: 0.9, stars: 0.85 }, 29.9, 1.6);
    petalBursts.push({ t: 29.8, d: 2.6, kind: 'swirl', amount: 0.55, scale: 0.8 });
    block('.c5', 31.3, 39.0);
    ft('.c5-veil', { opacity: 0 }, { opacity: 1, duration: 1.4, ease: 'sine.inOut' }, 31.3);
    const [nBride, nGroom] = $$('.t-couple .n');
    wipe(nBride, 32.0, 1.0); rise('.t-couple .amp', 32.55, { y: 1, dur: 0.6 }); wipe(nGroom, 32.75, 1.0);
    ft('.c5 .t-flourish', { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: 0.9 }, 33.4);
    letters('.t-invite > span', 34.0, 0.022, 0.55);
    ft('.t-invite strong', { opacity: 0, scale: 0.9, y: 1.2 * u }, { opacity: 1, scale: 1, y: 0, duration: 1.0, ease: 'power3.out' }, 34.6);
    { const w = $('.t-message')._parts; set(w, { opacity: 0, y: 1 * u }, 0); to(w, { opacity: 1, y: 0, duration: 0.7, stagger: 0.05, ease: 'power2.out' }, 35.3); }
    leave(['.t-couple', '.c5 .t-flourish', '.t-invite', '.t-message'], 38.15, 0.6);
    to('.c5-veil', { opacity: 0, duration: 0.8 }, 38.2);

    /* ===== 6 · date and venue card ===== */
    to('#stageDim', { opacity: 1, duration: 1.3, ease: 'sine.inOut' }, 38.4);
    to('#s5 .world', { ...W6, duration: 2.2, ease: 'sine.inOut' }, 38.4);
    cam('#s5', 39, T.s7, { z: 1.0 }, { z: 1.04 }, 'none', false);
    fx({ petals: 0.3, fire: 0.25, dust: 0.85 }, 38.6, 1.2);
    set('#cardLayer', { autoAlpha: 0 }, 0); set('#cardLayer', { autoAlpha: 1 }, 38.9); hideAt('#cardLayer', T.s7 + 0.1);
    ft('#card', { opacity: 0, yPercent: 55, rotationX: 26, scale: 0.92, transformOrigin: '50% 100%' }, { opacity: 1, yPercent: 0, rotationX: 0, scale: 1, duration: 1.5, ease: 'power3.out' }, 38.95);
    ft('.card-floral.tl', { opacity: 0, scale: 0.5, rotation: -16, transformOrigin: '30% 30%' }, { opacity: 1, scale: 1, rotation: 0, duration: 1.3, ease: 'back.out(1.3)' }, 39.6);
    ft('.card-floral.br', { opacity: 0, scale: 0.5, rotation: -16, transformOrigin: '70% 70%' }, { opacity: 1, scale: 1, rotation: 0, duration: 1.3, ease: 'back.out(1.3)' }, 39.8);
    ft('.card-shine', { backgroundPosition: '140% 0' }, { backgroundPosition: '-40% 0', duration: 1.4, ease: 'sine.inOut' }, 39.9);
    // the details arrive quickly so that date and venue stay on screen, complete, for as long as possible
    rise('.card-kicker', 40.0, { y: 1.4, dur: 0.75 });
    const cn = $$('.card-names span');
    wipe(cn[0], 40.4, 0.8); rise(cn[1], 40.8, { y: 0.8, dur: 0.45 }); wipe(cn[2], 40.95, 0.8);
    ft('.card-rule', { opacity: 0, scaleX: 0.3 }, { opacity: 1, scaleX: 1, duration: 0.7 }, 41.4);
    rise('.card-date', 41.7, { y: 1.4, dur: 0.8 }); rise('.card-time', 41.95, { y: 1.2, dur: 0.7 });
    rise('.card-label', 42.15, { y: 1.2, dur: 0.65 }); rise('.card-venue', 42.4, { y: 1.4, dur: 0.8 });
    rise($$('.card-address span'), 42.7, { y: 1, dur: 0.65, stagger: 0.13 }); rise('.card-rsvp', 43.2, { y: 1, dur: 0.65 });
    sparkBursts.push({ x: 0.5 - (P ? 0.3 : 0.2), y: 0.5 - 0.02, w: P ? 0.6 : 0.4, h: 0.05, t: 41.7, d: 2.2, n: 14, seed: 91 });
    to('#card', { y: -0.9 * u, duration: 2.35, ease: 'sine.inOut', yoyo: true, repeat: 3 }, 40.7);
    to('.card-shine', { backgroundPosition: '140% 0', duration: 0.01 }, 45.6);
    to('.card-shine', { backgroundPosition: '-40% 0', duration: 1.7, ease: 'sine.inOut' }, 46.0);
    to('#card', { opacity: 0, yPercent: -7, scale: 1.035, duration: 0.85, ease: 'power2.in' }, 50.2);
    to('#stageDim', { opacity: 0.42, duration: 1.3, ease: 'sine.inOut' }, 50.35); // keeps the stage softly out of focus behind the couple

    /* ===== 7 · grand reception finale ===== */
    to('#s5 .world', { ...W7, duration: 2.4, ease: 'sine.inOut' }, 50.25);
    cam('#s5', T.s7, DURATION, { z: 1.04 }, { z: 1.095 }, 'sine.inOut', false);
    fx({ petals: 0.9, fire: 0.65, dust: 0.9, stars: 0.9 }, 50.6, 1.4);
    ft('#duo .rail', { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'sine.inOut' }, 50.5);
    ft('.duo-shadow', { opacity: 0 }, { opacity: 1, duration: 1.2 }, 51.0);
    ft('.duo-groom', { opacity: 0, yPercent: 4, scale: 1.02 }, { opacity: 1, yPercent: 0, scale: 1, duration: 1.4, ease: 'power2.out' }, 50.75);
    ft('.duo-bride', { opacity: 0, yPercent: 4, scale: 1.02 }, { opacity: 1, yPercent: 0, scale: 1, duration: 1.4, ease: 'power2.out' }, 51.05);
    ft('#duoBed', { opacity: 0, yPercent: 30 }, { opacity: 1, yPercent: 0, duration: 1.3, ease: 'power2.out' }, 50.6);
    ft('#duo', { scale: 1, transformOrigin: '50% 100%' }, { scale: 1.035, duration: 6.6, ease: 'sine.inOut' }, 52.2);
    block('.c7', 51.3, DURATION + 0.1);
    ft('.c7-veil', { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'sine.inOut' }, 51.3);
    for (const [sel, at] of [['.t-closing:not(.t-closing-2)', 51.8], ['.t-closing-2', 53.4]]) { const w = $(sel)._parts; set(w, { opacity: 0, y: 1.1 * u }, 0); to(w, { opacity: 1, y: 0, duration: 0.7, stagger: 0.07, ease: 'power2.out' }, at); }
    wipe('.t-sign', 55.0, 1.2); rise('.t-foot', 55.85, { y: 1.2, dur: 0.85 });
    // graceful fade-out: the picture dims first, the signature lingers, then everything goes dark
    fx({ petals: 0, fire: 0, dust: 0, stars: 0 }, T.fade - 0.1, 1.4);
    to('#fade', { opacity: 1, duration: 1.5, ease: 'sine.inOut' }, T.fade);
    to(['.t-closing', '.c7-veil'], { opacity: 0, duration: 1.1, ease: 'sine.inOut' }, T.fade);
    to(['.t-sign', '.t-foot'], { opacity: 0, duration: 0.6, ease: 'sine.in' }, 58.65);
    tl.set({}, {}, DURATION);

    idleEls = $$('.actor-idle'); glints = $$('.glint'); twA = $('#twA'); twB = $('#twB');
    idleEls.forEach(reg); reg(twA); reg(twB); // (glints keep their inline positions, so they are not reset on rebuild)
  }

  /* small living details that are not worth a tween each: breathing figures, twinkling lights, jewellery glints */
  function idle(t) {
    idleEls.forEach((el, i) => {
      const y = Math.sin(t * 1.15 + i * 1.7) * 0.12 * L.u, rot = Math.sin(t * 0.8 + i * 2.3) * 0.22, sy = 1 + Math.sin(t * 1.5 + i) * 0.003;
      el.style.transform = `translate3d(0,${y.toFixed(2)}px,0) rotate(${rot.toFixed(3)}deg) scale(1,${sy.toFixed(4)})`;
    });
    if (t > 29.5) {
      twA.style.opacity = (0.42 + 0.58 * (0.5 + 0.5 * Math.sin(t * 5.3))).toFixed(3);
      twB.style.opacity = (0.42 + 0.58 * (0.5 + 0.5 * Math.sin(t * 4.1 + 2.2))).toFixed(3);
    }
    glints.forEach((el, i) => {
      const v = Math.pow(Math.max(0, Math.sin(t * (1.25 + 0.31 * i) + i * 1.9)), 7);
      el.style.opacity = v.toFixed(3); el.style.transform = `scale(${(0.5 + v * 0.7).toFixed(3)}) rotate(${(t * 20 + i * 40).toFixed(1)}deg)`;
    });
  }

  let lastT = 0;
  function renderAt(t) {
    t = clamp(t, 0, DURATION); lastT = t;
    tl.time(t);
    idle(t); drawFx(t);
    if (progressEl) progressEl.style.width = Math.min(100, (t / (DURATION - 0.3)) * 100).toFixed(2) + '%';
  }

  /* ------------------------------------------------------------------ playback (website) */
  const ui = $('#ui'), progressEl = $('#progress'), endEl = $('#end'), btnPlay = $('#btnPlay'), btnMute = $('#btnMute');
  let playing = false, started = false, finished = false, tBase = 0, perfBase = 0, rafId = 0, audioOK = true;
  const clock = () => (playing ? tBase + (performance.now() - perfBase) / 1000 : tBase);
  function tick() {
    let t = clock();
    if (audioOK && !audio.paused && audio.readyState > 2) { const at = audio.currentTime; if (Math.abs(at - t) > 0.1) { tBase = at; perfBase = performance.now(); t = at; } }
    if (t >= DURATION) { renderAt(DURATION); finish(); return; }
    renderAt(t);
    if (playing) rafId = requestAnimationFrame(tick);
  }
  function play() {
    if (playing) return;
    if (finished) { finished = false; endEl.classList.remove('show'); endEl.hidden = true; tBase = 0; }
    playing = true; perfBase = performance.now(); btnPlay.classList.remove('paused'); btnPlay.setAttribute('aria-label', 'Pause');
    if (audioOK && audio.src) { try { audio.currentTime = tBase; } catch (e) { /* not seekable yet */ } const p = audio.play(); if (p && p.catch) p.catch(() => { audioOK = false; }); }
    cancelAnimationFrame(rafId); rafId = requestAnimationFrame(tick);
  }
  function pause() {
    if (!playing) return;
    tBase = clock(); playing = false; audio.pause(); cancelAnimationFrame(rafId);
    btnPlay.classList.add('paused'); btnPlay.setAttribute('aria-label', 'Play');
  }
  function seek(t) { tBase = clamp(t, 0, DURATION - 0.05); perfBase = performance.now(); try { audio.currentTime = tBase; } catch (e) { /* ignore */ } renderAt(tBase); }
  function finish() {
    playing = false; finished = true; audio.pause(); cancelAnimationFrame(rafId);
    btnPlay.classList.add('paused'); endEl.hidden = false; requestAnimationFrame(() => endEl.classList.add('show'));
  }
  function replay() { pause(); finished = false; endEl.classList.remove('show'); endEl.hidden = true; tBase = 0; audioOK = true; renderAt(0); play(); }
  function start() { if (started) return; started = true; stage.classList.add('started'); ui.classList.add('show'); play(); }

  function wireUi() {
    $('#envelope').addEventListener('click', start);
    btnPlay.addEventListener('click', (e) => { e.stopPropagation(); if (!started) return start(); playing ? pause() : play(); });
    btnMute.addEventListener('click', (e) => { e.stopPropagation(); audio.muted = !audio.muted; btnMute.classList.toggle('muted', audio.muted); btnMute.setAttribute('aria-label', audio.muted ? 'Unmute music' : 'Mute music'); });
    $('#btnAgain').addEventListener('click', (e) => { e.stopPropagation(); started = true; stage.classList.add('started'); ui.classList.add('show'); replay(); });
    $('#btnReplay').addEventListener('click', replay);
    audio.addEventListener('error', () => { audioOK = false; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!started) start(); else playing ? pause() : play(); }
      else if (e.key === 'm' || e.key === 'M') btnMute.click();
      else if (e.key === 'r' || e.key === 'R') $('#btnAgain').click();
      else if (started && e.key === 'ArrowRight') seek(clock() + 3);
      else if (started && e.key === 'ArrowLeft') seek(clock() - 3);
    });
    // final-screen helpers
    const map = $('#btnMap'), cal = $('#btnCal');
    if (CFG.SHOW_DIRECTIONS_BUTTON === false) map.remove();
    else map.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([CFG.VENUE_NAME, CFG.VENUE_ADDRESS].filter(Boolean).join(', '));
    if (CFG.SHOW_CALENDAR_BUTTON === false || !/^\d{4}-\d{2}-\d{2}$/.test(CFG.EVENT_DATE_ISO || '')) cal.remove();
    else cal.addEventListener('click', () => {
      const d = CFG.EVENT_DATE_ISO.replace(/-/g, ''), next = new Date(CFG.EVENT_DATE_ISO + 'T00:00:00Z'); next.setUTCDate(next.getUTCDate() + 1);
      const d2 = next.toISOString().slice(0, 10).replace(/-/g, ''), esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1');
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Reception Invitation//EN', 'BEGIN:VEVENT', `UID:reception-${d}@invitation`, `DTSTAMP:${d}T000000Z`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${d2}`, `SUMMARY:${esc(SIGN + ' — ' + CFG.EVENT_TYPE)}`, `LOCATION:${esc([CFG.VENUE_NAME, CFG.VENUE_ADDRESS].filter(Boolean).join(', '))}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'reception-save-the-date.ics'; document.body.append(a); a.click(); a.remove();
    });
    let rz = 0;
    window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { const t = clock(); build(); renderAt(Math.min(t, DURATION)); }, 160); });
  }

  /* ------------------------------------------------------------------ boot */
  if (RENDER) document.documentElement.classList.add('is-render');
  if (location.protocol === 'file:') document.documentElement.classList.add('is-file'); // CSS masks need http(s); skip the light sweep when opened by double-click
  gsap.config({ force3D: true, nullTargetWarn: false });
  gsap.ticker.lagSmoothing(0);
  fillContent();
  const boot = loadAssets().then(() => {
    makeSprites(); build(); renderAt(Q.has('t') ? parseFloat(Q.get('t')) : 0);
    $('#loading').classList.add('done');
    if (!RENDER) { wireUi(); if (Q.has('t')) { started = true; stage.classList.add('started'); tBase = parseFloat(Q.get('t')) || 0; ui.classList.add('show'); btnPlay.classList.add('paused'); } }
    return true;
  });
  // used by render/render.mjs
  window.__film = { duration: DURATION, fps: 30, ready: boot, seek: (t) => { renderAt(t); return t; }, times: T };
})();
