// Real recordings: loading (trim, high-pass, loudness measurement) and playback into a stereo stem with
// resampling (pitch), balance, fades and choking (a drum head damped by its next stroke). Used for the tabla,
// hand percussion, swarmandal sweeps and santoor rolls.
import path from 'node:path';
import * as D from './dsp.mjs';
import { BAR_SEC, BEAT_SEC, frac, tablaStrokes } from './score.mjs';

const cache = new Map();

/** Load a recording once: stereo, trimmed to [from, to] s, optionally high-passed, with its onset and loudness. */
export function loadSample(file, { sr = 48000, from = 0, to = Infinity, highpass = 0 } = {}) {
  const key = [file, from, to, highpass, sr].join('|');
  if (cache.has(key)) return cache.get(key);
  const src = D.decodeStereo(file, sr);
  const a = Math.max(0, Math.round(from * sr)), b = Math.min(src.L.length, Number.isFinite(to) ? Math.round(to * sr) : src.L.length);
  const L = src.L.slice(a, b), R = src.R.slice(a, b);
  if (highpass) for (const x of [L, R]) { D.filter(x, D.biquad('highpass', highpass, Math.SQRT1_2, sr)); D.filter(x, D.biquad('highpass', highpass, Math.SQRT1_2, sr)); }
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  let onset = 0;
  while (onset < L.length && Math.max(Math.abs(L[onset]), Math.abs(R[onset])) < peak * 0.05) onset++;
  const rmsOver = (i0, n) => { let e = 0; const i1 = Math.min(L.length, i0 + n); for (let i = i0; i < i1; i++) e += L[i] * L[i] + R[i] * R[i]; return Math.sqrt(e / (2 * Math.max(1, i1 - i0))); };
  const attackRms = rmsOver(onset, Math.round(0.08 * sr));              // loudness of a stroke
  let bodyRms = 0;                                                        // loudness of a sweep or a ring
  for (let i = 0; i + Math.round(0.4 * sr) <= L.length; i += Math.round(0.1 * sr)) bodyRms = Math.max(bodyRms, rmsOver(i, Math.round(0.4 * sr)));
  // fade in: 4 ms on a trimmed slice; 0.3 ms otherwise, so a file that starts on a non-zero sample cannot click
  { const f = Math.min(L.length, Math.round((a > 0 ? 0.004 : 0.0003) * sr)); for (let i = 0; i < f; i++) { L[i] *= i / f; R[i] *= i / f; } }
  if (b < src.L.length) { const f = Math.min(L.length, Math.round(0.03 * sr)); for (let i = 0; i < f; i++) { const g = i / f; L[L.length - 1 - i] *= g; R[R.length - 1 - i] *= g; } }
  const s = { L, R, len: L.length, sr, peak, onset, attackRms: attackRms || 1e-9, bodyRms: bodyRms || attackRms || 1e-9, name: path.basename(file) };
  cache.set(key, s);
  return s;
}

const hermite = (x, k, f) => {
  const xm1 = k > 0 ? x[k - 1] : x[k], x0 = x[k], x1 = x[k + 1] ?? x0, x2 = x[k + 2] ?? x1;
  const c = (x1 - xm1) / 2, v = x0 - x1, w = c + v, a = w + v + (x2 - x0) / 2, b = w + a;
  return ((a * f - b) * f + c) * f + x0;
};

/**
 * Mix sample `s` into out.{L,R}. `t` is when the sample's onset (or `anchor` s into the sample) should sound.
 * `until` (s after t) starts a fade of `fade` s — used for maximum lengths and for choking.
 */
export function place(out, s, { t, gain = 1, pan = 0, cents = 0, until = Infinity, fade = 0.03, anchor = null, fadeIn = 0 }) {
  const sr = s.sr, ratio = 2 ** (cents / 1200);
  const anchorIn = anchor == null ? s.onset : Math.round(anchor * sr);   // sample index that must land on t
  const start = Math.round(t * sr - anchorIn / ratio);
  const gl = gain * (pan > 0 ? 1 - pan : 1), gr = gain * (pan < 0 ? 1 + pan : 1);
  const stopAt = Number.isFinite(until) ? Math.round((t + until) * sr) : Infinity, fadeN = Math.max(1, Math.round(fade * sr)), inN = Math.round(fadeIn * sr);
  const n = Math.floor((s.len - 2) / ratio), N = out.L.length;
  for (let i = Math.max(0, -start); i < n; i++) {
    const o = start + i; if (o >= N) break;
    let g = 1;
    if (o > stopAt) { const k = (o - stopAt) / fadeN; if (k >= 1) break; g = 0.5 + 0.5 * Math.cos(Math.PI * k); }
    if (i < inN) g *= i / inN;
    const p = i * ratio, k = Math.floor(p), f = p - k;
    out.L[o] += g * gl * hermite(s.L, k, f);
    out.R[o] += g * gr * hermite(s.R, k, f);
  }
}

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** The score's tonic (pitch class) over time: from `tonic_changes`, else the key text ("D major … to E major … (bar 17"). */
export function tonicTrack(score) {
  const pc = (txt) => { const m = /^\s*([A-G])([#b]?)/.exec(txt ?? ''); return m ? (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12 : null; };
  const key = String(score.key ?? 'C major');
  const minor = /^\s*[A-G][#b]?\s*(minor|m\b)/i.test(key);
  const changes = [{ t: 0, pc: pc(key) ?? 0 }];
  if (Array.isArray(score.tonic_changes)) for (const c of score.tonic_changes) changes.push({ t: Number(c.t ?? BAR_SEC * c.bar), pc: pc(c.tonic) });
  else {
    const m = /\bto\s+([A-G][#b]?)\s+(?:major|minor)[^)]*?\(?\s*bar\s+(\d+)/i.exec(key);
    if (m) changes.push({ t: BAR_SEC * Number(m[2]), pc: pc(m[1]) });
  }
  changes.sort((a, b) => a.t - b.t);
  return { minor, at: (t) => { let p = changes[0].pc; for (const c of changes) if (c.t <= t + 1e-6) p = c.pc; return p; } };
}
/** The pitch (MIDI, fractional) nearest to `measured` whose pitch class is one of `pcs`. */
const nearestOf = (measured, pcs) => { let best = null; for (let m = Math.floor(measured) - 12; m <= Math.ceil(measured) + 12; m++) if (pcs.includes(((m % 12) + 12) % 12) && (best == null || Math.abs(m - measured) < Math.abs(best - measured))) best = m; return best; };

// ── tabla ─────────────────────────────────────────────────────────────────────
/**
 * Real tabla strokes. Each bol is split into its drums (Dha = Ge + Na …); the dayan is retuned to the song's Sa
 * and the bayan's open ring to the nearest tonic-triad tone; every stroke chokes the previous ring of the same drum.
 */
export function renderTabla(T, entries, { score, N, sr = 48000 }) {
  const out = { L: new Float32Array(N), R: new Float32Array(N) }, rng = D.makeRng(4242), tonic = tonicTrack(score);
  const strokes = {};
  const loadAll = (list, def) => (list ?? []).map((f) => (typeof f === 'string' ? { s: loadSample(path.join(T.folder, f), { sr }), pitch: def.pitch } : { s: loadSample(path.join(T.folder, f.file), { sr }), pitch: f.pitch ?? def.pitch }));
  for (const [name, def] of Object.entries(T.strokes)) strokes[name] = { ...def, samples: loadAll(def.files, def), samSamples: loadAll(def.samFiles, def) };
  const resolve = (bol) => { const b = T.aliases?.[bol] ?? bol; return T.combos?.[b] ?? (strokes[b] ? [b] : []); };
  const hits = [];
  const unknown = new Set();
  for (const x of entries ?? []) for (const st of tablaStrokes(x, score.meter)) {
    if (/^(r|-|rest)$/i.test(st.stroke)) continue;
    const parts = resolve(st.stroke);
    if (!parts.length) { unknown.add(st.stroke); continue; }
    const sam = Math.abs(st.t / BAR_SEC - Math.round(st.t / BAR_SEC)) < 1e-4;
    for (const p of parts) hits.push({ t: st.t + (strokes[p].drum === 'bayan' && parts.length > 1 ? -0.003 : 0) + (rng() - 0.5) * 0.008, stroke: p, vel: st.vel, sam });
  }
  hits.sort((a, b) => a.t - b.t);
  const rr = {};
  let samCount = 0;
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i], S = strokes[h.stroke];
    // open strokes ring on through the next ones; a closed stroke (Te, Ke …) damps its drum's ring
    const damper = hits.slice(i + 1).find((q) => strokes[q.stroke].drum === S.drum && (strokes[q.stroke].damps ?? false));
    const until = Math.min(S.maxLen ?? 9, damper ? damper.t - h.t + (S.ringOver ?? 0.015) : 9);
    let pick;
    if (h.sam && S.samSamples.length && (samCount++ % (T.samEvery ?? 2)) === 0) pick = S.samSamples[samCount % S.samSamples.length];   // a gumki (rising bayan) on sam
    else { rr[h.stroke] = ((rr[h.stroke] ?? Math.floor(rng() * S.samples.length)) + 1) % S.samples.length; pick = S.samples[rr[h.stroke]]; }
    const s = pick.s;
    let cents = 0;
    if (S.pitched !== false) {
      const p = tonic.at(h.t), measured = pick.pitch ?? (S.drum === 'bayan' ? T.bayanPitch : T.dayanSa);
      const target = S.drum === 'bayan' ? nearestOf(measured, [p, (p + (tonic.minor ? 3 : 4)) % 12, (p + 7) % 12]) : nearestOf(measured, [p]);
      cents = 100 * (target - measured);
    }
    const gain = (T.level ?? 0.3) * (T.targetRms ?? 0.1) / s.attackRms * D.dB(S.gainDb ?? 0) * h.vel ** (T.velCurve ?? 1.4) * (0.92 + 0.16 * rng());
    place(out, s, { t: h.t, gain, pan: S.pan ?? 0, cents: cents + (rng() - 0.5) * 8, until, fade: S.chokeFade ?? 0.04 });
  }
  return { ...out, count: hits.length, unknown: [...unknown] };
}

// ── hand percussion ───────────────────────────────────────────────────────────
/** Pattern text → hits: explicit tokens ("x:1/3", accented "X:1/3" or "!x:1/3", rests "r:1"), else simple keywords. */
export function percussionHits(entry, meter) {
  const t0 = BAR_SEC * Number(entry.bar) + BEAT_SEC * frac(entry.beat ?? 0), pat = String(entry.pattern ?? '').trim(), hits = [];
  if (/^(!?[xXr]):/.test(pat)) {
    let t = t0;
    for (const tok of pat.split(/\s+/)) {
      if (tok === '|') continue;
      const m = /^(!?)([xXr]):(.+)$/.exec(tok); if (!m) continue;
      const dur = frac(m[3]) * BEAT_SEC;
      if (m[2] !== 'r') hits.push({ t, dur, accent: m[1] === '!' || m[2] === 'X' });
      t += dur;
    }
    return hits;
  }
  const eighth = meter === '12/8' ? BEAT_SEC / 3 : BEAT_SEC / 2;
  if (/swell|gliss|shimmer|once|single|roll/i.test(pat)) return [{ t: t0 + (/end|last/i.test(pat) ? 3 * BEAT_SEC : 0), dur: BAR_SEC, accent: false }];
  if (/downbeat|sam/i.test(pat)) return [{ t: t0, dur: BEAT_SEC, accent: true }];
  if (/2 and 4|backbeat/i.test(pat)) return [1, 3].map((b) => ({ t: t0 + b * BEAT_SEC, dur: BEAT_SEC, accent: false }));
  for (let k = 0; k < Math.round(BAR_SEC / eighth); k++) hits.push({ t: t0 + k * eighth, dur: eighth, accent: k % (meter === '12/8' ? 3 : 2) === 0 });
  return hits;
}

export function renderHandPercussion(H, entries, { score, N, sr = 48000 }) {
  const out = { L: new Float32Array(N), R: new Float32Array(N) }, rng = D.makeRng(77);
  const inst = {};
  for (const [name, def] of Object.entries(H.instruments)) {
    inst[name] = { ...def, kinds: Object.fromEntries(Object.entries(def.strokes).map(([k, files]) => [k, files.map((f) => loadSample(path.join(H.folder, f), { sr, highpass: def.highpass ?? 0 }))])) };
  }
  const rr = {}, alt = {};
  let count = 0;
  const skipped = new Set();
  for (const x of entries ?? []) {
    const I = inst[H.aliases?.[x.instrument] ?? x.instrument];
    if (!I) { skipped.add(x.instrument); continue; }
    const lvl = Number(x.level ?? 0.5);
    for (const h of percussionHits(x, score.meter)) {
      let kind = 'hit';
      if (I.kinds.long && h.dur >= (I.longFrom ?? 9) * BEAT_SEC) kind = 'long';
      else if (I.kinds.accent && h.accent) kind = 'accent';
      else if (I.alternate) { alt[x.instrument] = !alt[x.instrument]; kind = alt[x.instrument] ? I.alternate[0] : I.alternate[1]; }
      const list = I.kinds[kind] ?? I.kinds.hit;
      const key = `${x.instrument}:${kind}`;
      rr[key] = ((rr[key] ?? Math.floor(rng() * list.length)) + 1) % list.length;
      const s = list[rr[key]], norm = (I.normalize === 'body' ? s.bodyRms : s.attackRms);
      const gain = (H.level ?? 0.3) * (H.targetRms ?? 0.1) / norm * D.dB(I.gainDb ?? 0) * lvl * (h.accent ? 1 : (I.unaccented ?? 0.7)) * (0.9 + 0.2 * rng());
      place(out, s, { t: h.t + (rng() - 0.5) * 0.006, gain, pan: I.pan ?? 0, until: I.maxLen ?? Infinity, fade: 0.25 });
      count++;
    }
  }
  return { ...out, count, skipped: [...skipped] };
}

// ── swarmandal sweeps ──────────────────────────────────────────────────────────
/** Real swarmandal sweeps for harp lines whose style asks for it, retuned from the recording's Sa to the song's tonic. */
export function renderSwarmandal(S, lines, { score, N, sr = 48000 }) {
  const out = { L: new Float32Array(N), R: new Float32Array(N) }, tonic = tonicTrack(score), rng = D.makeRng(31);
  const load = (d) => ({ ...d, s: loadSample(path.join(S.folder, d.file), { sr, from: d.from ?? 0, to: d.to ?? Infinity }) });
  const kinds = Object.fromEntries(Object.entries(S.kinds).map(([k, list]) => [k, list.map(load)]));
  const used = [], rr = {};
  for (const L of lines) {
    const kind = /strum/i.test(L.style) ? 'strum' : L.up ? (L.span >= (S.longFrom ?? 0.9) ? 'up_long' : 'up_short') : (L.span >= (S.longFrom ?? 0.9) ? 'down_long' : 'down_short');
    const list = kinds[kind]; if (!list?.length) continue;
    rr[kind] = ((rr[kind] ?? -1) + 1) % list.length;
    const d = list[rr[kind]];
    let shift = (tonic.at(L.t0) - S.recordedSa + 12) % 12; if (shift > 6) shift -= 12;
    const cents = 100 * shift - (S.tuningCents ?? 0), ratio = 2 ** (cents / 1200);
    // upward sweeps land their peak on the line's last note; downward sweeps and strums start with the line
    const at = kind.startsWith('up') ? L.tLand : L.t0, anchor = kind.startsWith('up') ? d.peak : null;
    const gain = (S.level ?? 0.3) * (S.targetRms ?? 0.1) / d.s.bodyRms * (L.vel / 127) ** 1.5 * D.dB(d.gainDb ?? 0);
    place(out, d.s, { t: at, gain, pan: (S.pan ?? 0) + (rng() - 0.5) * 0.2, cents, anchor, until: d.maxLen ?? S.maxLen ?? 6, fade: 0.8, fadeIn: anchor != null ? 0.05 : 0 });
    used.push(`${L.t0.toFixed(2)}s ${kind} ${d.file.slice(0, 40)} ${cents >= 0 ? '+' : ''}${cents}c`);
    void ratio;
  }
  return { ...out, used };
}

// ── santoor rolls ──────────────────────────────────────────────────────────────
/** Real santoor tremolo rolls: each run of fast repeated notes becomes one roll per pitch, from the nearest recorded note. */
export function renderSantoorRolls(SR_, groups, { N, sr = 48000 }) {
  const out = { L: new Float32Array(N), R: new Float32Array(N) };
  const notes = SR_.notes.map((d) => ({ ...d, s: loadSample(path.join(SR_.folder, d.file), { sr, from: d.skip ?? SR_.skip ?? 0 }) }));
  const used = [];
  for (const g of groups) for (const m of g.midis) {
    const d = notes.reduce((a, b) => (Math.abs(b.midi - m) < Math.abs(a.midi - m) ? b : a));
    const cents = 100 * (m - d.midi) - (d.offsetCents ?? 0);
    const gain = (SR_.level ?? 0.3) * (SR_.targetRms ?? 0.1) / d.s.bodyRms * (g.vel / 127) ** 1.5 / Math.sqrt(g.midis.length);
    // the roll dies away after its last stroke, but never rings on into a new chord (g.damp = next chord change)
    const release = g.damp != null ? Math.min(SR_.release ?? 0.6, Math.max(0.12, g.damp - g.t1 + 0.12)) : SR_.release ?? 0.6;
    place(out, d.s, { t: g.t0, gain, pan: SR_.pan ?? 0, cents, until: g.t1 - g.t0, fade: release, anchor: 0, fadeIn: 0.03 });
    used.push(`${g.t0.toFixed(2)}–${g.t1.toFixed(2)}s midi ${m} from ${d.file.slice(-14)} ${cents >= 0 ? '+' : ''}${cents.toFixed(0)}c`);
  }
  return { ...out, used };
}
