// Renders a score (JSON notation, see score.mjs) with sampled instruments from SoundFonts (spessasynth_core,
// offline, sample-accurate) and real recordings (tabla, hand percussion, swarmandal, santoor rolls), then mixes
// and masters it.
//
//   node render.mjs <score.json> <out.wav> [--stems=<dir>] [--report] [--no-mp3] [--config=<instruments.json>] [--only=a,b]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpessaSynthProcessor, SoundBankLoader, BasicSoundBank, SpessaLog, MIDIControllers as CC } from 'spessasynth_core';
import { readScore, readHarmony, END_SEC } from './score.mjs';
import { renderTabla, renderHandPercussion, renderSwarmandal, renderSantoorRolls, percussionHits } from './samples.mjs';
import * as D from './dsp.mjs';

const SR = 48000, N = Math.round(END_SEC * SR), BLOCK = 64;
const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const flag = (n) => args.includes(`--${n}`);
const [scorePath, outWav] = args.filter((a) => !a.startsWith('--'));
if (!scorePath || !outWav) { console.error('usage: node render.mjs <score.json> <out.wav> [--stems=dir] [--report] [--no-mp3] [--config=file] [--only=parts]'); process.exit(1); }
const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(opt('config', path.join(here, 'instruments.json')));
const CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf8'));
// paths in the config are relative to the config file
const inConfigDir = (p) => (path.isAbsolute(p) ? p : path.join(path.dirname(configPath), p));
for (const k of Object.keys(CONFIG.banks)) CONFIG.banks[k] = inConfigDir(CONFIG.banks[k]);
for (const k of ['tabla', 'handPercussionSamples', 'swarmandal', 'santoorRolls']) if (CONFIG[k]?.folder) CONFIG[k].folder = inConfigDir(CONFIG[k].folder);
const score = JSON.parse(fs.readFileSync(scorePath, 'utf8'));
const only = opt('only', '') ? new Set(opt('only', '').split(',')) : null;
const want = (part) => !only || only.has(part);
const { notes, problems } = readScore(score);
const harmony = readHarmony(score);
if (problems.length) console.log(`score problems (${problems.length}):\n  ` + problems.slice(0, 30).join('\n  '));
const smooth = (x) => { x = D.clamp(x, 0, 1); return x * x * (3 - 2 * x); };

// ── sound banks (loaded once, shared by every synth instance) ────────────────
SpessaLog.setLogLevel(false, true, false);
await BasicSoundBank.isSF3DecoderReady;
const banks = {};
const bank = (id) => {
  if (!banks[id]) {
    const file = CONFIG.banks[id]; if (!file) throw new Error(`no sound bank "${id}" in the config`);
    const buf = fs.readFileSync(file);
    banks[id] = SoundBankLoader.fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  return banks[id];
};

/** Render one synth pass: `setup(synth)` configures channels, `events` are [{pos, fn}], `lanes` are block-rate automation. */
async function renderSynth(bankId, setup, events, lanes, preload) {
  const synth = new SpessaSynthProcessor(SR, { maxBufferSize: BLOCK, effectsEnabled: false, eventsEnabled: false });
  await synth.processorInitialized;
  synth.soundBankManager.addSoundBank(bank(bankId), 'main');
  synth.setSystemParameter('autoAllocateVoices', true);
  setup(synth);
  for (const [patch, lo, hi] of preload) bank(bankId).getPreset(patch, 'gs')?.preload(lo, hi);
  events.sort((a, b) => a.pos - b.pos || a.order - b.order);
  const L = new Float32Array(N), R = new Float32Array(N);
  let pos = 0, ei = 0;
  while (pos < N) {
    while (ei < events.length && events[ei].pos <= pos) events[ei++].fn(synth);
    const now = pos / SR;
    for (const lane of lanes) {
      if (now < lane.from || now > lane.to) continue;
      const v = lane.value(now);
      if (v !== lane.last) { lane.send(synth, v); lane.last = v; }
    }
    let n = Math.min(BLOCK, N - pos);
    if (ei < events.length) n = Math.min(n, Math.max(1, events[ei].pos - pos));
    synth.process(L, R, pos, n);
    pos += n;
  }
  return { L, R };
}
let order = 0;
const posOf = (t) => Math.max(0, Math.min(N - 1, Math.round(t * SR)));
const ev = (list, t, fn) => list.push({ pos: posOf(t), order: order++, fn });
function rpnBendRange(synth, ch, semis) {
  synth.controllerChange(ch, CC.registeredParameterMSB, 0); synth.controllerChange(ch, CC.registeredParameterLSB, 0);
  synth.controllerChange(ch, CC.dataEntryMSB, semis); synth.controllerChange(ch, CC.dataEntryLSB, 0);
  synth.controllerChange(ch, CC.registeredParameterMSB, 127); synth.controllerChange(ch, CC.registeredParameterLSB, 127);
}
function selectPreset(synth, ch, [msb, lsb, prog], vol = 100, pan = 64) {
  synth.controllerChange(ch, CC.bankSelect, msb); synth.controllerChange(ch, CC.bankSelectLSB, lsb); synth.programChange(ch, prog);
  synth.controllerChange(ch, CC.mainVolume, vol); synth.controllerChange(ch, CC.pan, pan); synth.controllerChange(ch, CC.expression, 127);
}
const patchOf = ([a, b, c]) => ({ bankMSB: a, bankLSB: b, program: c, isGMGSDrum: false });
const bendFor = (cents, range) => { const full = range * 12700 / 128, whole = Math.round(cents), aim = whole + Math.sign(whole) * 0.5; return Math.max(0, Math.min(16383, Math.round(8192 + aim / full * 8192))); };
const exprCC = (db) => Math.max(1, Math.min(127, Math.round(127 * 10 ** (Math.min(0, db) / 40))));
const velOf = (e, P) => Math.max(1, Math.min(127, Math.round(e.vel * (e.velScale ?? 1) * (P.velScale ?? 1) + (P.velOffset ?? 0))));

// ── melodic, breath-shaped mono lines (bansuri, violin, sitar, bass) ─────────
// Three round-robin channels let a released note ring while the next one starts; `layers` double every channel
// with another preset (e.g. shakuhachi breath under the flute) that follows the same bends and swells.
function monoLine(partName, P, evs) {
  const CH = [0, 1, 2], range = P.bendRange ?? 12, events = [], lanes = [];
  const layers = P.layers ?? [];
  const each = (ch, f) => { f(ch); layers.forEach((_, k) => f(ch + 3 * (k + 1))); };
  const ops = CH.map(() => []);            // per channel: [{t, kind:'set'|'glide', …}]
  const vib = CH.map(() => []);            // per channel: [{t0, t1, cents, hz, delay}]
  let rr = 0, chain = null, prev = null;
  const legato = (e) => !/detach|stacc|pluck/i.test(e.style) || partName === 'sitar';
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i], m = e.midis[0], next = evs[i + 1];
    const contiguous = prev && e.t - (prev.t + prev.dur) < 0.03;
    if (e.meend && chain && contiguous && Math.abs(m - chain.base) <= range - 1 && P.meend !== false) {
      const step = Math.abs(m - prev.midis[0]), g = D.clamp(0.09 + 0.014 * step + 0.1 * Math.min(1, e.dur / 1.0), 0.08, 0.3), gs = e.t - 0.45 * g;
      ops[chain.ch].push({ t: gs, kind: 'glide', from: (prev.midis[0] - chain.base) * 100, to: (m - chain.base) * 100, len: g });
      chain.off.t = e.t + e.dur + (next && legato(e) && next.t - (e.t + e.dur) < 0.03 ? 0.03 : -0.02);
    } else {
      const ch = CH[rr++ % CH.length];
      let env = null;
      if (e.kan) { const up = (P.kanCents ?? 200); env = (dt) => up * (1 - smooth(dt / 0.065)); }
      else if ((e.first || (e.meend && !contiguous)) && P.scoop) env = (dt) => -P.scoop * (1 - smooth(dt / 0.11));
      ops[ch].push({ t: e.t - 0.0005, kind: 'set', value: 0, env });
      const vel = velOf(e, P);
      const voices = e.midis;   // usually one note; parallel octaves of a string melody bend together
      ev(events, e.t, (s) => each(ch, (c) => voices.forEach((v) => s.noteOn(c, v, vel))));
      const off = { t: e.t + e.dur + (next && legato(e) && next.t - (e.t + e.dur) < 0.03 ? 0.03 : -Math.min(0.04, e.dur * 0.08)) };
      events.push({ get pos() { return posOf(off.t); }, order: order++, fn: (s) => each(ch, (c) => voices.forEach((v) => s.noteOff(c, v))) });
      chain = { ch, base: m, off };
    }
    if (P.vibrato && e.dur >= (P.vibrato.minDur ?? 0.55)) vib[chain.ch].push({ t0: e.t, t1: e.t + e.dur, cents: P.vibrato.cents, hz: P.vibrato.hz, delay: P.vibrato.delay });
    prev = e;
  }
  for (const x of events) if (Object.getOwnPropertyDescriptor(x, 'pos')?.get) { const p = x.pos; delete x.pos; x.pos = p; }
  CH.forEach((ch, k) => {
    const list = ops[k].sort((a, b) => a.t - b.t), vlist = vib[k];
    if (!list.length) return;
    const valueAt = (t) => {
      let j = -1;
      for (let i = 0; i < list.length && list[i].t <= t; i++) j = i;
      if (j < 0) return 0;
      let i0 = j; while (i0 > 0 && list[i0].kind !== 'set') i0--;
      const set = list[i0];
      let c = set.kind === 'set' ? set.value + (set.env ? set.env(t - set.t) : 0) : 0;
      for (let i = i0 + 1; i <= j; i++) { const g = list[i]; c = g.from + (g.to - g.from) * smooth((t - g.t) / g.len); }
      for (const v of vlist) if (t >= v.t0 + v.delay && t <= v.t1) {
        const ramp = smooth((t - v.t0 - v.delay) / 0.35) * (1 - smooth((t - v.t1 + 0.08) / 0.08));
        c += v.cents * ramp * Math.sin(D.TAU * v.hz * (t - v.t0));
      }
      return Math.round(c);
    };
    lanes.push({ from: 0, to: END_SEC, value: (t) => bendFor(valueAt(t), range), send: (s, v) => each(ch, (c) => s.pitchWheel(c, v)) });
  });
  // phrase arch on expression (CC11): each line swells gently to ~60% of its length and relaxes at the end
  const lines = new Map();
  for (const e of evs) { const L = lines.get(e.line) ?? { t0: e.t, t1: e.t + e.dur }; L.t0 = Math.min(L.t0, e.t); L.t1 = Math.max(L.t1, e.t + e.dur); lines.set(e.line, L); }
  const spans = [...lines.values()].sort((a, b) => a.t0 - b.t0);
  const depth = P.phraseArchDb ?? 3;
  const archAt = (t) => {
    for (const s of spans) if (t >= s.t0 && t <= s.t1 + 0.3) { const x = (t - s.t0) / Math.max(0.5, s.t1 - s.t0); return -depth + depth * Math.sin(Math.PI * D.clamp(x / 1.2, 0, 1)) ** 0.7; }
    return -depth;
  };
  CH.forEach((ch) => lanes.push({ from: 0, to: END_SEC, value: (t) => exprCC(archAt(t)), send: (s, v) => each(ch, (c) => s.controllerChange(c, CC.expression, v)) }));
  const setup = (s) => CH.forEach((ch) => {
    selectPreset(s, ch, P.preset, P.volume ?? 100, P.pan ?? 64); rpnBendRange(s, ch, range);
    layers.forEach((Lr, k) => { const c = ch + 3 * (k + 1); selectPreset(s, c, Lr.preset, Lr.volume ?? 60, Lr.pan ?? P.pan ?? 64); rpnBendRange(s, c, range); });
  });
  const preload = [[patchOf(P.preset), 0, 127], ...layers.map((Lr) => [patchOf(Lr.preset), 0, 127])];
  return { [P.bank ?? CONFIG.defaultBank]: { events, lanes, setup, preload } };
}

// ── polyphonic parts (strings, piano, santoor, harp, bells) ──────────────────
// Presets may come from different banks (byStyle entries can name one as a 4th element), so the part is
// rendered as one synth pass per bank. Lines whose style says the strings carry a tune use `melodic`.
function lineIsMelodic(lineEvs) {
  const single = lineEvs.filter((e) => e.midis.length === 1 || (e.midis.length === 2 && Math.abs(e.midis[1] - e.midis[0]) % 12 === 0)).length;
  const durs = lineEvs.map((e) => e.dur).sort((a, b) => a - b), median = durs[Math.floor(durs.length / 2)] ?? 0;
  return lineEvs.length >= 3 && single / lineEvs.length >= 0.7 && median <= 1.5 * 0.75;
}
/** Time of the first harmony change (a different chord) at or after t, or null. A note that ends exactly on a
 *  change belongs to the chord before it, so it is damped at that change rather than at the following one. */
function nextChordChange(t) {
  const u = t - 1e-3, i = harmony.findIndex((h) => h.t0 <= u && u < h.t1); if (i < 0) return null;
  for (let k = i + 1; k < harmony.length; k++) if (harmony[k].chord !== harmony[i].chord) return harmony[k].t0;
  return null;
}
function polyPart(partName, P, evs) {
  const byLine = new Map();
  for (const e of evs) { if (!byLine.has(e.line)) byLine.set(e.line, []); byLine.get(e.line).push(e); }
  const melodicLine = new Map([...byLine].map(([k, list]) => [k, P.melodic ? lineIsMelodic(list) : false]));
  const presetFor = (e) => {
    if (P.byStyle) for (const [kw, preset] of Object.entries(P.byStyle)) if (new RegExp(kw, 'i').test(e.style)) return preset;
    if (P.melodic && melodicLine.get(e.line)) return P.melodic;
    return P.preset;
  };
  const passes = {};   // bankId → { chans: Map(presetKey → ch), notes: [] }
  const defaultBank = P.bank ?? CONFIG.defaultBank;
  for (const e of evs) {
    const preset = presetFor(e), bankId = preset[3] ?? defaultBank, key = preset.slice(0, 3).join(':');
    const pass = (passes[bankId] ??= { chans: new Map(), notes: [] });
    if (!pass.chans.has(key)) pass.chans.set(key, pass.chans.size >= 9 ? pass.chans.size + 1 : pass.chans.size);
    const ch = pass.chans.get(key), vel = velOf(e, P);
    // ring: harp and santoor strings keep sounding to the end of their line (plus a tail) unless damped
    const lineEnd = Math.max(...byLine.get(e.line).map((x) => x.t + x.dur));
    const rings = P.ring && (!P.ringStyle || new RegExp(P.ringStyle, 'i').test(e.style)) && !/damp|stacc|detach/i.test(e.style);
    let off = rings ? Math.max(e.t + e.dur, lineEnd) + P.ring : e.t + e.dur + (P.legatoTail ?? 0.06);
    if (rings) { const ch2 = nextChordChange(e.t + e.dur); if (ch2 != null) off = Math.min(off, Math.max(e.t + e.dur, ch2) + (P.dampRelease ?? 0.12)); }
    for (const m of e.midis) pass.notes.push({ ch, m, on: e.t, off, vel });
  }
  const out = {};
  for (const [bankId, pass] of Object.entries(passes)) {
    const events = [], lanes = [];
    // a re-struck key releases the previous stroke just before the new one, so a ringing tail never cuts it
    const byKey = new Map();
    for (const n of pass.notes) { const k = `${n.ch}:${n.m}`; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(n); }
    for (const list of byKey.values()) {
      list.sort((a, b) => a.on - b.on);
      for (let i = 0; i < list.length; i++) {
        const n = list[i], nx = list[i + 1];
        const off = nx ? Math.min(n.off, Math.max(n.on + 0.01, nx.on - 1 / SR)) : n.off;
        ev(events, n.on, (s) => s.noteOn(n.ch, n.m, n.vel));
        ev(events, off, (s) => s.noteOff(n.ch, n.m));
      }
    }
    // line-level expression: cresc / dim / swell words in the style text, otherwise flat
    const shapes = [...byLine.values()].map((list) => ({ t0: Math.min(...list.map((e) => e.t)), t1: Math.max(...list.map((e) => e.t + e.dur)), style: list[0].style, keys: new Set(list.map((e) => presetFor(e).slice(0, 3).join(':'))) }));
    const exprAt = (t, key) => {
      let db = 0;
      for (const s of shapes) if (t >= s.t0 && t <= s.t1 && s.keys.has(key)) {
        const x = (t - s.t0) / Math.max(0.2, s.t1 - s.t0);
        if (/cresc/i.test(s.style)) db = Math.min(db, -7 * (1 - smooth(x)));
        else if (/\bdim|decresc|fade/i.test(s.style)) db = Math.min(db, -7 * smooth(x));
        else if (/swell/i.test(s.style)) db = Math.min(db, -5 + 5 * Math.sin(Math.PI * x));
      }
      return db;
    };
    const setup = (s) => { for (const [k, ch] of pass.chans) selectPreset(s, ch, k.split(':').map(Number), P.volume ?? 100, P.pan ?? 64); };
    if (P.expression !== false) for (const [k, ch] of pass.chans) lanes.push({ from: 0, to: END_SEC, value: (t) => exprCC(exprAt(t, k)), send: (s, v) => s.controllerChange(ch, CC.expression, v) });
    if (P.pedal && pass.chans.has(P.preset.slice(0, 3).join(':'))) {   // sustain pedal: re-pedal on every harmony change
      const ch = pass.chans.get(P.preset.slice(0, 3).join(':'));
      for (const h of harmony) { ev(events, h.t0 + 0.025, (s) => s.controllerChange(ch, CC.sustainPedal, 127)); ev(events, h.t1 - 0.015, (s) => s.controllerChange(ch, CC.sustainPedal, 0)); }
    }
    const preload = [...pass.chans.keys()].map((k) => [patchOf(k.split(':').map(Number)), 0, 127]);
    out[bankId] = { events, lanes, setup, preload };
  }
  return out;
}

// ── santoor: runs of fast repeated notes become real recorded tremolo rolls ──
function splitSantoorRolls(evs, R) {
  const keep = [], groups = [];
  const maxDur = (R.maxStrokeBeats ?? 0.25) * 0.75, key = (e) => e.midis.join('+');
  const next = (x, y) => y && y.line === x.line && x.dur <= maxDur && Math.abs(y.t - (x.t + x.dur)) < 0.02;
  for (let i = 0; i < evs.length;) {
    let j = i;
    while (next(evs[j], evs[j + 1]) && key(evs[j + 1]) === key(evs[i])) j++;                    // A A A A …
    if (j === i && next(evs[i], evs[i + 1])) {                                                // A B A B …
      const A = key(evs[i]), B = key(evs[i + 1]);
      let k = i + 1;
      while (next(evs[k], evs[k + 1]) && key(evs[k + 1]) === (key(evs[k]) === A ? B : A)) k++;
      if (k - i + 1 >= (R.minStrokes ?? 4) + 2) j = k;
    }
    const run = evs.slice(i, j + 1);
    if (run.length >= (R.minStrokes ?? 4)) {
      const midis = [...new Set(run.flatMap((x) => x.midis))].sort((p, q) => p - q);
      groups.push({ t0: run[0].t, t1: run[run.length - 1].t + run[run.length - 1].dur, midis, vel: Math.max(...run.map((x) => x.vel)) });
      if (R.keepSynthVel) run.forEach((x) => { x.velScale = R.keepSynthVel; keep.push(x); });
    } else keep.push(...run);
    i = j + 1;
  }
  return { keep, groups };
}

// ── harp lines that call for a swarmandal: glissandi, cascades and strums ──
function swarmandalLines(evs, S) {
  const re = new RegExp(S.styleRegex ?? 'swarmandal|gliss|sweep|cascad|shimmer|strum', 'i');
  const lines = new Map();
  for (const e of evs) if (re.test(e.style)) { if (!lines.has(e.line)) lines.set(e.line, []); lines.get(e.line).push(e); }
  const out = [];
  for (const list of [...lines.values()].sort((a, b) => a[0].t - b[0].t)) {
    const style = list[0].style, t0 = list[0].t, last = list[list.length - 1];
    if (/strum/i.test(style)) {   // strums are often written one line per string: merge lines starting together
      const prev = out[out.length - 1];
      if (prev && prev.strum && t0 - prev.t0 < 0.6) { list.forEach((e) => prev.evs.push(e)); continue; }
      out.push({ strum: true, style, t0, tLand: t0, span: 0, up: true, vel: Math.max(...list.map((e) => e.vel)), evs: [...list] });
    } else if (list.length >= (S.minNotes ?? 5)) {
      const singles = list.filter((e) => e.midis.length === 1), a = singles[0] ?? list[0], z = singles[singles.length - 1] ?? last;
      out.push({ strum: false, style, t0, tLand: z.t, span: z.t - t0, up: z.midis[0] > a.midis[0], vel: Math.max(...list.map((e) => e.vel)), evs: [...list] });
    }
  }
  return out;
}

// ── hand percussion fallback on the GM/GS drum channel (for instruments without recordings) ──
function kitPercussion(P, entries, hitsOf) {
  const events = [], rng = D.makeRng(78);
  for (const x of entries ?? []) {
    const note = P.notes?.[x.instrument]; if (!note) continue;
    for (const h of hitsOf(x)) {
      const vel = Math.max(1, Math.min(127, Math.round(127 * Number(x.level ?? 0.5) * (h.accent ? 0.85 : 0.6) * (0.9 + 0.2 * rng()))));
      ev(events, h.t, (s) => s.noteOn(9, note, vel)); ev(events, h.t + 0.2, (s) => s.noteOff(9, note));
    }
  }
  return { events, lanes: [], setup: (s) => { s.controllerChange(9, CC.bankSelect, P.kit?.[0] ?? 0); s.programChange(9, P.kit?.[2] ?? 0); s.controllerChange(9, CC.mainVolume, P.volume ?? 100); }, preload: [] };
}

// ── render every part to its own stem ─────────────────────────────────────────
const t0 = Date.now(), stems = {}, log = [];
const addStem = (name, s) => { if (!stems[name]) stems[name] = { L: new Float32Array(N), R: new Float32Array(N) }; for (let i = 0; i < N; i++) { stems[name].L[i] += s.L[i]; stems[name].R[i] += s.R[i]; } };
for (const [part, evs0] of Object.entries(notes)) {
  const P = CONFIG.parts[part]; if (!P || !evs0.length || !want(part)) continue;
  let evs = evs0;
  if (part === 'santoor' && CONFIG.santoorRolls) {
    const { keep, groups } = splitSantoorRolls(evs, CONFIG.santoorRolls);
    groups.forEach((g) => { g.damp = nextChordChange(g.t1); });
    if (groups.length) { const r = renderSantoorRolls(CONFIG.santoorRolls, groups, { N, sr: SR }); addStem('santoor', r); log.push(`santoor rolls: ${r.used.join(' · ')}`); }
    evs = keep;
  }
  if (part === 'harp' && CONFIG.swarmandal) {
    const lines = swarmandalLines(evs, CONFIG.swarmandal);
    if (lines.length) {
      const r = renderSwarmandal(CONFIG.swarmandal, lines, { score, N, sr: SR }); addStem('swarmandal', r); log.push(`swarmandal: ${r.used.join(' · ')}`);
      const under = CONFIG.swarmandal.harpUnderVel ?? 0.7;
      for (const L of lines) for (const e of L.evs) e.velScale = under;
    }
  }
  if (!evs.length) continue;
  if (!P.mono && P.portamento) {   // tune lines that ask for portamento glide into their long notes, like a Hindi film string section
    const re = new RegExp(P.portamento.styleRegex ?? 'portamento|slide', 'i'), byLine = new Map();
    for (const e of evs) { if (!byLine.has(e.line)) byLine.set(e.line, []); byLine.get(e.line).push(e); }
    const portLines = [...byLine.values()].filter((list) => re.test(list[0].style) && lineIsMelodic(list));
    for (const list of portLines) {
      list.forEach((e, k) => { const p = list[k - 1]; if (p && e.dur >= (P.portamento.minDur ?? 0.45) && Math.abs(e.midis[0] - p.midis[0]) >= 2 && e.t - (p.t + p.dur) < 0.03) e.meend = true; });
      const preset = P.melodic ?? P.preset;
      const PM = { ...P, preset: preset.slice(0, 3), bank: preset[3] ?? P.bank, mono: true, bendRange: 12, scoop: 0, kanCents: 0, vibrato: null, phraseArchDb: P.portamento.archDb ?? 2, layers: [] };
      for (const [bankId, built] of Object.entries(monoLine(part, PM, list))) addStem(part, await renderSynth(bankId, built.setup, built.events, built.lanes, built.preload));
      log.push(`${part}: portamento line at ${list[0].t.toFixed(2)} s (${list.filter((e) => e.meend).length} slides)`);
    }
    const done = new Set(portLines.flat());
    evs = evs.filter((e) => !done.has(e));
    if (!evs.length) continue;
  }
  const passes = P.mono ? monoLine(part, P, evs) : polyPart(part, P, evs);
  for (const [bankId, built] of Object.entries(passes)) addStem(part, await renderSynth(bankId, built.setup, built.events, built.lanes, built.preload));
}
const hp = score.parts?.hand_percussion ?? [];
if (hp.length && want('hand_percussion')) {
  const H = CONFIG.handPercussionSamples;
  const real = H ? hp.filter((x) => H.instruments[H.aliases?.[x.instrument] ?? x.instrument]) : [];
  if (real.length) { const r = renderHandPercussion(H, real, { score, N, sr: SR }); addStem('hand_percussion', r); log.push(`hand percussion: ${r.count} hits from recordings`); }
  const rest = hp.filter((x) => !real.includes(x));
  if (rest.length && CONFIG.parts.hand_percussion) {
    const built = kitPercussion(CONFIG.parts.hand_percussion, rest, (x) => percussionHits(x, score.meter));
    if (built.events.length) { addStem('hand_percussion', await renderSynth(CONFIG.parts.hand_percussion.bank ?? CONFIG.defaultBank, built.setup, built.events, [], [])); log.push(`hand percussion (GM kit): ${[...new Set(rest.map((x) => x.instrument))].join(', ')}`); }
  }
}
if (score.parts?.tabla?.length && CONFIG.tabla && want('tabla')) {
  const t = renderTabla(CONFIG.tabla, score.parts.tabla, { score, N, sr: SR }); addStem('tabla', t);
  log.push(`tabla: ${t.count} drum strokes${t.unknown.length ? ` (unknown bols skipped: ${t.unknown.join(', ')})` : ''}`);
}
console.log(log.join('\n'));
console.log(`rendered ${Object.keys(stems).length} stems in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// ── mix ───────────────────────────────────────────────────────────────────────
const mixL = new Float64Array(N), mixR = new Float64Array(N), sendL = new Float64Array(N), sendR = new Float64Array(N);
for (const [part, s] of Object.entries(stems)) {
  const M = CONFIG.mix[part] ?? { gain: 0, send: -12 };
  const g = D.dB(M.gain), sd = M.send <= -59 ? 0 : D.dB(M.send);
  if (M.highpass) { D.filter(s.L, D.biquad('highpass', M.highpass)); D.filter(s.R, D.biquad('highpass', M.highpass)); }
  if (M.lowpass) { D.filter(s.L, D.biquad('lowpass', M.lowpass)); D.filter(s.R, D.biquad('lowpass', M.lowpass)); }
  if (M.eq) for (const [f, gdb, q] of M.eq) { D.filter(s.L, D.biquad('peak', f, q ?? 1, SR, gdb)); D.filter(s.R, D.biquad('peak', f, q ?? 1, SR, gdb)); }
  if (M.comp) console.log(`${part}: compressor gain reduction down to ${D.compress(s.L, s.R, M.comp).toFixed(1)} dB`);
  if (M.limit) {   // percussion bus: a look-ahead limiter shaves the stroke transients, then the RMS is restored
    let pk = 0, e0 = 0, e1 = 0;
    for (let n = 0; n < N; n++) { pk = Math.max(pk, Math.abs(s.L[n]), Math.abs(s.R[n])); e0 += s.L[n] * s.L[n] + s.R[n] * s.R[n]; }
    const r = D.limiter(s.L, s.R, pk * D.dB(-M.limit.belowPeakDb));
    for (let n = 0; n < N; n++) e1 += s.L[n] * s.L[n] + s.R[n] * s.R[n];
    const mk = Math.sqrt(e0 / (e1 || 1)); for (let n = 0; n < N; n++) { s.L[n] *= mk; s.R[n] *= mk; }
    console.log(`${part}: bus limiter ${r.reduction.toFixed(1)} dB on ${(r.samples / SR * 1000).toFixed(0)} ms, makeup ${D.toDb(mk).toFixed(1)} dB`);
  }
  if (M.width != null) for (let n = 0; n < N; n++) { const m = 0.5 * (s.L[n] + s.R[n]), d = 0.5 * (s.L[n] - s.R[n]) * M.width; s.L[n] = m + d; s.R[n] = m - d; }
  for (let n = 0; n < N; n++) { const l = (s.L[n] *= g), r = (s.R[n] *= g); mixL[n] += l; mixR[n] += r; sendL[n] += l * sd; sendR[n] += r * sd; }
}
const wet = D.reverb(sendL, sendR, CONFIG.reverb);
for (let n = 0; n < N; n++) { mixL[n] += wet.L[n]; mixR[n] += wet.R[n]; }
stems.reverb = wet;

// ── master: high-pass, tone, ride from the score's dynamics, fades, loudness, limiter ───────────
const MA = CONFIG.master;
D.filter(mixL, D.biquad('highpass', MA.highpassHz)); D.filter(mixR, D.biquad('highpass', MA.highpassHz));
if (MA.presenceDb) { D.filter(mixL, D.shelf('high', MA.presenceHz, MA.presenceDb)); D.filter(mixR, D.shelf('high', MA.presenceHz, MA.presenceDb)); }
if (MA.lowShelfDb) { D.filter(mixL, D.shelf('low', MA.lowShelfHz, MA.lowShelfDb)); D.filter(mixR, D.shelf('low', MA.lowShelfHz, MA.lowShelfDb)); }
const dyn = (score.dynamics ?? []).map((d) => [Number(d.t), Number(d.level_db)]).sort((a, b) => a[0] - b[0]);
const rideAt = (t) => {
  if (!dyn.length || !MA.followScoreDynamics) return 0;
  if (t <= dyn[0][0]) return dyn[0][1];
  for (let i = 1; i < dyn.length; i++) if (t <= dyn[i][0]) { const [a, va] = dyn[i - 1], [b, vb] = dyn[i]; return va + (vb - va) * (t - a) / (b - a || 1); }
  return dyn[dyn.length - 1][1];
};
const fadeInN = MA.fadeInSec * SR, outA = MA.fadeOutStart * SR, outB = Math.round(MA.silenceFrom * SR);
for (let n = 0; n < N; n++) {
  let g = D.dB(D.clamp(rideAt(n / SR) * (MA.followScoreDynamics ?? 0), MA.rideFloorDb ?? -6, 0));
  if (n < fadeInN) g *= Math.sin(0.5 * Math.PI * n / fadeInN);
  if (n >= outB) g = 0; else if (n > outA) g *= Math.cos(0.5 * Math.PI * (n - outA) / (outB - outA)) ** 2;
  mixL[n] *= g; mixR[n] *= g;
}
const ceiling = D.dB(MA.ceilingDb);
let gain = D.dB(MA.targetLufs - D.measureLoudness(mixL, mixR).integrated), outL, outR, lim, loud;
for (let pass = 0; pass < 6; pass++) {
  outL = mixL.map((x) => x * gain); outR = mixR.map((x) => x * gain);
  lim = D.limiter(outL, outR, ceiling); loud = D.measureLoudness(outL, outR);
  const err = MA.targetLufs - loud.integrated; if (Math.abs(err) < 0.02) break; gain *= D.dB(err);
}
const tp = D.truePeakDb(outL, outR);
fs.mkdirSync(path.dirname(path.resolve(outWav)), { recursive: true });
const clipped = D.writeWav(outWav, outL, outR, SR);
console.log(`WAV ${outWav}: ${(N / SR).toFixed(3)} s · integrated ${loud.integrated.toFixed(2)} LUFS · true peak ${tp.toFixed(2)} dBTP · limiter max ${lim.reduction.toFixed(2)} dB (active ${(lim.samples / SR * 1000).toFixed(0)} ms) · clipped ${clipped}`);
if (!flag('no-mp3')) { const m = D.encodeMp3(outWav, outWav.replace(/\.wav$/i, '.mp3')); console.log(`MP3 check: wav ${m.wav.lufs} LUFS / ${m.wav.truePeak} dBTP · mp3 ${m.mp3.lufs} LUFS / ${m.mp3.truePeak} dBTP`); }
const stemDir = opt('stems', '');
if (stemDir) { fs.mkdirSync(stemDir, { recursive: true }); for (const [k, s] of Object.entries(stems)) D.writeWav(path.join(stemDir, `${k}.wav`), Float32Array.from(s.L, (x) => x * gain), Float32Array.from(s.R, (x) => x * gain), SR, true); }
if (flag('report')) {
  const rms = (s, a, b) => { let e = 0; for (let n = a; n < b; n++) e += s.L[n] * s.L[n] + s.R[n] * s.R[n]; return 10 * Math.log10(Math.max(e / (2 * (b - a)), 1e-14)) + D.toDb(gain); };
  const names = Object.keys(stems);
  console.log(`\nsection    ${names.map((n) => n.slice(0, 7).padStart(7)).join(' ')}  ST-LUFS(end)`);
  for (const [a, b] of [[0, 3], [3, 9], [9, 15], [15, 21], [21, 30], [30, 39], [39, 51], [51, 57], [57, 59.5]]) {
    const st = loud.shortTerm.find((s) => Math.abs(s.t - b) < 0.06);
    console.log(`${`${a}-${b}`.padEnd(10)} ${names.map((n) => { const v = rms(stems[n], Math.round(a * SR), Math.round(b * SR)); return (v < -90 ? '—' : v.toFixed(1)).padStart(7); }).join(' ')}  ${st ? st.lufs.toFixed(1) : ''}`);
  }
}
