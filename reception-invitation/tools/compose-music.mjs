#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  compose-music.mjs — original Bollywood-style soundtrack for the reception film
//
//  A joyful "filmi" wedding arrangement: dholak in a keherwa groove, dhol, claps and
//  ghungroo, a round bass, a Bollywood string section, santoor, sitar, bansuri and a
//  shehnai lead. Everything is synthesised here from scratch (pure JS DSP, no samples,
//  no npm dependencies, seeded → bit-identical output on every run). All melodies are
//  original.
//
//    node tools/compose-music.mjs                 → assets/music/reception-theme.wav + .mp3
//    node tools/compose-music.mjs --report        → also print a per-bar level table
//    node tools/compose-music.mjs --stems=<dir>   → also write one WAV per instrument
//    node tools/compose-music.mjs --no-mp3        → skip the ffmpeg step
//
//  Layout of this file
//    1. EDITABLE SECTION  tempo · chords · plan per bar · melodies · cue sheet · mix   ← tweak here
//    2. DSP helpers
//    3. Instruments       strings · bansuri · shehnai · sitar · santoor · bass · dholak · dhol ·
//                         claps · ghungroo · cymbal · swarmandal · chimes · tanpura
//    4. Arrangement       turns section 1 into notes
//    5. Reverb, master bus, loudness normalisation, WAV/MP3 output
//
//  Common tweaks (all in section 1 unless noted)
//    a cue moved in the edit ........ GLISSANDI / CHIMES / CYMBALS / SITAR_STRUMS (`at`, in seconds)
//    more / less percussion ......... PLAN (per bar: dholak, dhol, claps, jingles, bass …, 0‥1)
//    different notes ................ CHORDS · HARMONY · BANSURI_PHRASES · SHEHNAI_PHRASES · SITAR_LINES
//    one instrument up or down ...... MIX (dB)        wetter / drier ........ REVERB.level, MIX sends
//    overall loudness ............... MASTER.targetLufs (the limiter keeps the peaks in check)
//    phone-speaker tone / dynamics .. MASTER.presenceDb · bassTrimDb · ride
//    instrument tone ................ the DHOLAK / SHEHNAI / SITAR / … blocks in section 3
//  Run with --report after a change to see the level of every instrument bar by bar.
// ════════════════════════════════════════════════════════════════════════════
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ════════════════════════════════════════════════════════════════════════════
//  1. EDITABLE SECTION
// ════════════════════════════════════════════════════════════════════════════
const SEED = 20261014;        // change for a different (still deterministic) "performance"

// ── Grid ────────────────────────────────────────────────────────────────────
// 80 BPM in 4/4: 1 beat = 0.75 s, 1 bar = 3.000 s, bar k starts at t = 3k s.
// Every scene change of the film is on a bar line, so only change this together with the edit.
// The whole film has to fit one 60-second Instagram / WhatsApp story: 59.500 s in total.
const BPM = 80;
const BEATS_PER_BAR = 4;
const BARS = 19;              // full bars 0‥18 (0–57 s); the last HARMONY row is the final hit, struck at 57.0
const TAIL_SEC = 2.5;         // …which rings out for this long → 59.500 s in total (2,856,000 frames)

// ── Chords (key of D) ───────────────────────────────────────────────────────
//  bass    root for the bass line          pad / padHi  string voicing in the verses / choruses
//  arp     four tones the santoor arpeggiates
const CHORDS = {
  'D':    { bass: 'D2',  pad: 'D3 A3 D4 F#4',   padHi: 'D3 A3 D4 F#4 A4 D5',   arp: 'D4 F#4 A4 D5' },
  'A/C#': { bass: 'C#2', pad: 'C#3 A3 C#4 E4',  padHi: 'C#3 A3 C#4 E4 A4 C#5', arp: 'C#4 E4 A4 C#5' },
  'Bm':   { bass: 'B1',  pad: 'B2 F#3 B3 D4',   padHi: 'B2 F#3 B3 D4 F#4 B4',  arp: 'B3 D4 F#4 B4' },
  'G':    { bass: 'G1',  pad: 'G2 D3 G3 B3',    padHi: 'G2 D3 G3 B3 D4 G4',    arp: 'B3 D4 G4 B4' },
  'A':    { bass: 'A1',  pad: 'A2 E3 A3 C#4',   padHi: 'A2 E3 A3 C#4 E4 A4',   arp: 'C#4 E4 A4 C#5' },
  'A7':   { bass: 'A1',  pad: 'A2 E3 G3 C#4',   padHi: 'A2 E3 G3 C#4 E4 G4',   arp: 'C#4 E4 G4 A4' },
  'Em':   { bass: 'E2',  pad: 'E3 B3 E4 G4',    padHi: 'E3 B3 E4 G4 B4 E5',    arp: 'B3 E4 G4 B4' },
  'F#m':  { bass: 'F#2', pad: 'F#3 C#4 F#4 A4', padHi: 'F#3 C#4 F#4 A4 C#5',   arp: 'C#4 F#4 A4 C#5' },
};

// ── Harmony: one row per bar, [chord, beats] ────────────────────────────────
const HARMONY = [
  /*  0 intro     0–3   envelope opens    */ [['D', 4]],
  /*  1 garden    3–6                     */ [['D', 4]],
  /*  2           6–9                     */ [['G', 2], ['A', 2]],
  /*  3 groom     9–12  groove drops in   */ [['D', 4]],
  /*  4          12–15                    */ [['G', 2], ['A', 2]],
  /*  5 bride    15–18                    */ [['Bm', 2], ['G', 2]],
  /*  6          18–21                    */ [['Em', 2], ['A', 2]],
  /*  7 together 21–24  build             */ [['G', 2], ['A', 2]],
  /*  8          24–27                    */ [['Bm', 2], ['F#m', 2]],
  /*  9          27–30  curtains          */ [['G', 2], ['A7', 2]],
  /* 10 CHORUS   30–33  the stage         */ [['D', 2], ['A/C#', 2]],
  /* 11          33–36                    */ [['Bm', 2], ['G', 2]],
  /* 12          36–39                    */ [['Em', 2], ['A', 2]],
  /* 13 card     39–42  calmer, reading   */ [['D', 4]],
  /* 14          42–45                    */ [['G', 4]],
  /* 15          45–48                    */ [['Bm', 2], ['G', 2]],
  /* 16          48–51                    */ [['Em', 2], ['A7', 2]],
  /* 17 CHORUS   51–54  finale            */ [['D', 2], ['A/C#', 2]],
  /* 18          54–57                    */ [['G', 2], ['A', 2]],
  /* 19 END      57–59.5 final hit        */ [['D', 4]],
];

// ── Plan: who plays in every bar (levels 0‥1) ───────────────────────────────
//  dholak / dhol: groove level, or 'roll' (build-up into the next bar)
//  santoor: 'shimmer' (tremolo) · 'arp16' (sixteenths) · 'arp8' (eighths)
//  strings: 'pad' · 'high'           fill: 'pickup' · 'end' (dholak fill on beat 4)
const CHORUS = { dholak: 1, dhol: 1, claps: 1, jingles: 1, bass: 1, strings: 'high', santoor: 'arp8', santoorVel: 0.34 };
const CALM = { dholak: 0.55, bass: 0.62, jingles: 0.35, strings: 'pad', santoor: 'arp8', santoorVel: 0.5 };
const PLAN = [
  /*  0 */ { santoor: 'shimmer', strings: 'pad' },
  /*  1 */ { santoor: 'arp16', santoorVel: 0.40, jingles: 0.3, strings: 'pad' },
  /*  2 */ { santoor: 'arp16', santoorVel: 0.44, jingles: 0.4, strings: 'pad', fill: 'pickup' },
  /*  3 */ { dholak: 0.82, bass: 1, jingles: 0.55, strings: 'pad', santoor: 'arp8', santoorVel: 0.36 },
  /*  4 */ { dholak: 0.82, bass: 1, jingles: 0.55, strings: 'pad', fill: 'end' },
  /*  5 */ { dholak: 0.82, bass: 1, jingles: 0.55, strings: 'pad', santoor: 'arp8', santoorVel: 0.36 },
  /*  6 */ { dholak: 0.84, bass: 1, jingles: 0.6, strings: 'pad', fill: 'end' },
  /*  7 */ { dholak: 0.9, bass: 1, claps: 0.7, jingles: 0.75, strings: 'pad' },
  /*  8 */ { dholak: 0.94, bass: 1, claps: 0.8, jingles: 0.85, dhol: 0.55, strings: 'high' },
  /*  9 */ { dholak: 'roll', dhol: 'roll', bass: 0.7, jingles: 0.6, strings: 'high' },
  /* 10 */ { ...CHORUS },
  /* 11 */ { ...CHORUS },
  /* 12 */ { ...CHORUS, fill: 'end' },
  /* 13 */ { ...CALM },
  /* 14 */ { ...CALM },
  /* 15 */ { ...CALM },
  /* 16 */ { ...CALM, dholak: 0.7, fill: 'end' },
  /* 17 */ { ...CHORUS },
  /* 18 */ { ...CHORUS, fill: 'end' },
  /* 19 */ { strings: 'high' },
];

// ── Melodies ────────────────────────────────────────────────────────────────
//  "F#5 A5:2 r B5" → notes are 1 beat (0.75 s) long unless ":beats" is given, "r" = rest,
//  "|" is only a visual bar line. `bar`/`beat` say where the line starts (beat 0 = downbeat).
//  Bansuri / shehnai: one entry = one breath, notes slurred with meend; vel → velEnd = swell.
const BANSURI_PHRASES = [
  { bar: 0, beat: 0.25, vel: 0.40, velEnd: 0.62, notes: 'A4:0.75 D5:1.25 E5:0.5 F#5' },       // alaap while the envelope opens
  { bar: 1, vel: 0.56, velEnd: 0.64, notes: 'D5 E5:0.5 F#5:0.5 A5:2' },                        // the garden
  { bar: 2, vel: 0.64, velEnd: 0.56, notes: 'B5 A5:0.5 F#5:0.5 E5:1.5' },
  { bar: 3, beat: 1, vel: 0.68, notes: 'F#5:0.5 G5:0.5 A5 F#5' },                               // verse — the groom
  { bar: 4, vel: 0.68, notes: 'G5:0.5 F#5:0.5 E5 F#5:0.5 E5:0.5 C#5' },
  { bar: 5, vel: 0.66, notes: 'D5 F#5:0.5 E5:0.5 D5 B4' },                                      // the bride
  { bar: 6, vel: 0.68, velEnd: 0.6, notes: 'E5 G5:0.5 F#5:0.5 E5:1.5' },
  { bar: 14, vel: 0.50, velEnd: 0.46, notes: 'F#5 E5 D5:2' },                                   // card: a small fragment only
  { bar: 16, vel: 0.52, velEnd: 0.72, notes: 'E5 F#5 G5 A5' },                                  // leads into the final chorus
];
// The chorus hook (the shehnai plays with circular breathing, so a whole chorus is one breath).
const HOOK_A = 'A4:0.5 D5:0.5 F#5:1.5 E5:0.5 D5:0.5 E5:0.5';                // D … A/C#
const SHEHNAI_PHRASES = [
  { bar: 10, vel: 0.80, velEnd: 0.88, notes: `${HOOK_A} | G5:0.15 F#5:0.85 G5:0.5 F#5:0.5 E5 D5 | E5:0.5 F#5:0.5 G5 F#5:0.5 E5:0.5 C#5:0.5 E5:0.5` },
  { bar: 17, vel: 0.84, velEnd: 0.70, notes: `${HOOK_A} | B5:0.5 A5:0.5 G5:0.5 F#5:0.5 E5 C#5:0.5 E5:0.5 | E5:0.12 D5:2.8` },
];
// Sitar: plucked; stepwise neighbours are sometimes reached with a meend (bend) instead of a fresh pluck.
const SITAR_LINES = [
  { bar: 7, vel: 0.62, notes: 'B4:0.5 D5:0.5 E5 C#5:0.5 E5:0.5 A5' },                          // build-up
  { bar: 8, vel: 0.68, notes: 'B5 A5:0.5 F#5:0.5 A5 F#5:0.5 C#5:0.5' },
  { bar: 9, vel: 0.74, notes: 'D5:0.5 E5:0.5 G5 A5:1.5' },
  { bar: 10, vel: 0.46, octave: -12, notes: `${HOOK_A} | F#5 G5:0.5 F#5:0.5 E5 D5 | E5:0.5 F#5:0.5 G5 F#5:0.5 E5:0.5 C#5:0.5 E5:0.5` }, // doubles the hook
  { bar: 13, beat: 2, vel: 0.42, notes: 'A4:0.5 B4:0.5 D5' },                                   // card: answers
  { bar: 15, vel: 0.46, notes: 'D5:0.5 E5:0.5 F#5 E5 D5' },
  { bar: 17, vel: 0.48, octave: -12, notes: `${HOOK_A} | B5:0.5 A5:0.5 G5:0.5 F#5:0.5 E5 C#5:0.5 E5:0.5` },
];

// ── Cue sheet (seconds, locked to picture) ──────────────────────────────────
// Swarmandal up-glissandi: the LAST note lands exactly on `at`.
const GLISSANDI = [
  { at: 3.0,  length: 0.80, land: 'D6', notes: 12, level: 0.55 },   // the envelope has opened
  { at: 15.0, length: 0.55, land: 'A5', notes: 8,  level: 0.40 },   // into the bride's scene
  { at: 30.0, length: 0.80, land: 'D6', notes: 16, level: 0.85 },   // curtains open on the stage
  { at: 39.0, length: 0.60, land: 'B5', notes: 9,  level: 0.36 },   // into the card
  { at: 51.0, length: 0.70, land: 'D6', notes: 12, level: 0.62 },   // into the finale
];
// Chime sparkles: the FIRST note starts exactly on `at`, the rest follow `gap` s apart.
const CHIMES = [
  { at: 11.0, notes: 'A5 D6 F#6 A6',  level: 0.70, gap: 0.085 },  // groom's name
  { at: 17.0, notes: 'G5 B5 D6 G6',   level: 0.70, gap: 0.085 },  // bride's name
  { at: 32.0, notes: 'A5 C#6 E6 A6',  level: 0.95, gap: 0.085 },  // couple's names
  { at: 55.0, notes: 'B5 D6 G6 B6',   level: 0.90, gap: 0.090 },  // "Kenvi & Puru" signature
  { at: 57.0, notes: 'D7',            level: 0.40 },
];
// Cymbal: 'crash' starts on `at`; 'swell' is a reversed swell that peaks exactly on `at`.
const CYMBALS = [
  { at: 9.0,  kind: 'crash', level: 0.40 },
  { at: 30.0, kind: 'swell', len: 1.4, level: 0.55 },
  { at: 30.0, kind: 'crash', level: 0.85 },
  { at: 51.0, kind: 'crash', level: 0.60 },
  { at: 57.0, kind: 'crash', level: 0.85 },
];
// Sitar chord strums on the big downbeats (first string exactly on `at`).
const SITAR_STRUMS = [
  { at: 9.0,  notes: 'D4 A4 D5',          vel: 0.62 },
  { at: 30.0, notes: 'D4 A4 D5 F#5',      vel: 0.70 },
  { at: 51.0, notes: 'D4 A4 D5',          vel: 0.62 },
  { at: 57.0, notes: 'D3 A3 D4 F#4 A4 D5', vel: 0.72 },
];

// ── Dynamics over time: [seconds, dB] break-points, linear in between ───────
const STRINGS_SWELL = [
  [0, -11], [3, -10], [9, -9.5], [21, -8.5], [27, -6.5], [29.3, -4.5], [30, -2.2], [31, -0.6], [38.4, -1],
  [39.6, -5.5], [50, -5.5], [51, -1.2], [56.6, -1], [59.5, -6],
];
const STRINGS_BRIGHTNESS = [
  [0, 0.30], [9, 0.40], [21, 0.50], [29, 0.75], [30, 0.90], [31, 1.0], [38.4, 0.95], [39.6, 0.45], [50, 0.5], [51, 0.95], [59.5, 0.6],
];
// Tanpura-like drone on D/A for the intro and under the very end (−60 dB = off).
const DRONE_LEVEL = [[0, 0], [3, -1], [8, -5], [10, -60], [56, -60], [57, -6], [59.5, -10]];

// ── Mix: fader (dB, 0 = as balanced) and reverb send (dB) per instrument ────
// Whatever you change here, the master stage re-normalises the result to MASTER.targetLufs.
const MIX = {
  strings:    { gain: 0.0, send: -7.0 },
  flute:      { gain: 0.0, send: -6.5 },   // bansuri
  shehnai:    { gain: 0.0, send: -8.0 },
  sitar:      { gain: 0.0, send: -9.0 },
  santoor:    { gain: 0.0, send: -9.0 },
  bass:       { gain: 0.0, send: -60 },
  dholak:     { gain: 0.0, send: -15 },
  dhol:       { gain: 0.0, send: -17 },
  claps:      { gain: 0.0, send: -9.0 },
  jingles:    { gain: 0.0, send: -11 },
  cymbal:     { gain: 0.0, send: -12 },
  swarmandal: { gain: 0.0, send: -5.0 },
  chimes:     { gain: 0.0, send: -5.0 },
  drone:      { gain: 0.0, send: -9.0 },
};
const REVERB = {
  decaySec: 2.0,              // 60 dB decay of the lows/low-mids — tighter than a ballad, the groove stays clear
  hfDamping: 0.16,
  preDelayMs: 18,
  inputHighpassHz: 180,       // keeps drums and bass out of the hall (no mud)
  level: 0.0,
};

// ── Master ──────────────────────────────────────────────────────────────────
const MASTER = {
  targetLufs: -16.0,          // integrated loudness (ITU-R BS.1770)
  ceilingDb: -2.0,            // limiter ceiling (sample peak) → true peak stays under −1.5 dBTP, MP3 included
  fadeInSec: 0.4,
  fadeOutStart: 58.0,         // final fade begins (1 s after the final hit at 57.0)
  silenceFrom: 59.2,          // digital silence from here to the end at 59.5
  highpassHz: 30,
  presenceDb: 3.0, presenceHz: 2500,   // tone control for small (phone) speakers
  bassTrimDb: -1.5, bassTrimHz: 100,
  // Level ride [seconds, dB]: keeps the soft intro and the card section present on a phone.
  ride: [[0, 0], [38.6, 0], [40, 1.0], [50.4, 1.0], [51, 0], [59.5, 0]],
};

// ── Output ──────────────────────────────────────────────────────────────────
const SR = 48000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets', 'music');
const OUT_WAV = path.join(OUT_DIR, 'reception-theme.wav');
const OUT_MP3 = path.join(OUT_DIR, 'reception-theme.mp3');
const MP3_BITRATE = '192k';

// ════════════════════════════════════════════════════════════════════════════
//  2. DSP HELPERS
// ════════════════════════════════════════════════════════════════════════════
const BEAT = 60 / BPM;
const BAR = BEAT * BEATS_PER_BAR;
const TOTAL_SEC = BARS * BAR + TAIL_SEC;
const N = Math.round(TOTAL_SEC * SR);
const TAU = 2 * Math.PI;

const ARGS = process.argv.slice(2);
const hasFlag = (name) => ARGS.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const flagValue = (name) => {
  const a = ARGS.find((s) => s.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : null;
};

const dB = (d) => 10 ** (d / 20);
const toDb = (x) => 20 * Math.log10(Math.max(x, 1e-12));
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const barTime = (bar, beat = 0) => (bar * BEATS_PER_BAR + beat) * BEAT;

/** Small seeded PRNG (mulberry32). Every instrument gets its own stream. */
function makeRng(salt) {
  let a = (SEED + salt * 7919) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** "F#5" → MIDI note number (A4 = 69 = 440 Hz). */
function midiOf(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note name "${name}"`);
  return 12 * (Number(m[3]) + 1) + SEMITONE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const noteList = (text) => text.trim().split(/\s+/).map(midiOf);

/** Melody text → [{ midi, beat, beats }]  (beat = offset from the start of the line). */
function parseMelody(text) {
  const out = [];
  let beat = 0;
  for (const tok of text.trim().split(/\s+/)) {
    if (tok === '|') continue;
    const [name, len] = tok.split(':');
    const beats = len ? Number(len) : 1;
    if (name !== 'r') out.push({ midi: midiOf(name), beat, beats });
    beat += beats;
  }
  return out;
}

/** Arpeggio text → [{ midi, beat, ring }]; every token is an eighth, ring = optional ":beats". */
function parseArp(text) {
  const out = [];
  text.trim().split(/\s+/).forEach((tok, i) => {
    if (tok === '-' || tok === 'r') return;
    const [name, ring] = tok.split(':');
    out.push({ midi: midiOf(name), beat: i * 0.5, ring: ring ? Number(ring) : null });
  });
  return out;
}

const newBus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });

/** Equal-power pan, p = −1 (left) … +1 (right). */
function panGains(p) {
  const a = (clamp(p, -1, 1) + 1) * Math.PI / 4;
  return [Math.cos(a), Math.sin(a)];
}

/** Value of a [seconds, value] break-point curve at time t (linear interpolation). */
function curveAt(points, t) {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (t <= points[i][0]) {
      const [t0, v0] = points[i - 1], [t1, v1] = points[i];
      return v0 + (v1 - v0) * (t - t0) / (t1 - t0);
    }
  }
  return points[points.length - 1][1];
}
/** Per-sample array of a dB break-point curve, as linear gain (≤ −59 dB → silence). */
function gainCurve(points) {
  const out = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const d = curveAt(points, n / SR);
    out[n] = d <= -59 ? 0 : dB(d);
  }
  return out;
}

/** RBJ biquad coefficients. */
function biquad(type, freq, q = Math.SQRT1_2) {
  const w = TAU * freq / SR, c = Math.cos(w), alpha = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lowpass') { b1 = 1 - c; b0 = b2 = b1 / 2; }
  else if (type === 'highpass') { b1 = -(1 + c); b0 = b2 = (1 + c) / 2; }
  else if (type === 'bandpass') { b0 = alpha; b1 = 0; b2 = -alpha; }
  else throw new Error(`Unknown filter type ${type}`);
  const a0 = 1 + alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: -2 * c / a0, a2: (1 - alpha) / a0 };
}
/** RBJ shelving filter: boosts/cuts everything above (high) or below (low) `freq` by gainDb. */
function shelf(kind, freq, gainDb) {
  const A = Math.pow(10, gainDb / 40), w = TAU * freq / SR, c = Math.cos(w), al = Math.sin(w) / 2 * Math.SQRT2, r = 2 * Math.sqrt(A) * al, s = kind === 'high' ? 1 : -1;
  const b0 = A * ((A + 1) + s * (A - 1) * c + r), b1 = -2 * s * A * ((A - 1) + s * (A + 1) * c), b2 = A * ((A + 1) + s * (A - 1) * c - r);
  const a0 = (A + 1) - s * (A - 1) * c + r, a1 = 2 * s * ((A - 1) - s * (A + 1) * c), a2 = (A + 1) - s * (A - 1) * c - r;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}
/** Run a biquad over x in place (transposed direct form II). */
function filter(x, c) {
  let z1 = 0, z2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i], y = c.b0 * v + z1;
    z1 = c.b1 * v - c.a1 * y + z2;
    z2 = c.b2 * v - c.a2 * y;
    x[i] = y;
  }
  return x;
}

/**
 * out[start…] += amp · e^(−rate·t) · sin(2πft + phase), as a rotating phasor (no Math.sin
 * in the loop). Stops once the partial has decayed by 90 dB. This is the workhorse behind
 * the chimes, the jingles and the sitar's sympathetic strings.
 */
function addDampedSine(out, start, len, f, amp, rate, phase = 0) {
  const w = TAU * f / SR, r = Math.exp(-rate / SR);
  const c = r * Math.cos(w), s = r * Math.sin(w);
  let x = amp * Math.cos(phase), y = amp * Math.sin(phase);
  const end = start + Math.min(len, out.length - start, Math.ceil(10.4 / rate * SR));
  for (let i = start; i < end; i++) {
    out[i] += y;
    const nx = x * c - y * s;
    y = x * s + y * c;
    x = nx;
  }
}


// ════════════════════════════════════════════════════════════════════════════
//  3. INSTRUMENTS
// ════════════════════════════════════════════════════════════════════════════
const scratchA = new Float64Array(SR * 16);
const scratchB = new Float64Array(SR * 16);

// ── String pad ──────────────────────────────────────────────────────────────
// Each note = a small section of detuned "players". Every player is a saw spectrum built
// additively into a wavetable with the low-pass already baked in (band-limited → no
// aliasing) and with its own random harmonic phases (no peaky, buzzy saw waveform). There
// is a dark and a bright table per player; STRINGS_BRIGHTNESS cross-fades between them.
const STRINGS = {
  level: 0.040,
  voices: 6, detuneCents: 10, spread: 0.8,
  darkHz: 620, brightHz: 1900,          // low-pass corner (12 dB/oct) at brightness 0 / 1, for the A3 string
  keytrack: 0.2,                        // corner follows pitch a little (cellos darker than violins)
  attackSec: 1.0, releaseSec: 1.5, leadSec: 0.3, // notes start swelling 0.3 s before the bar line
  quickSec: 0.35,                       // hand-over time when a single voice moves mid-bar (sus4 → 3)
  vibratoHz: 5.2, vibratoCents: 6.5, vibratoDelaySec: 0.6,
};
const TABLE = 4096;
const tableCache = new Map();
function stringTable(midi, cornerHz, player) {
  const key = `${midi}:${cornerHz}:${player}`;
  if (tableCache.has(key)) return tableCache.get(key);
  const f0 = hz(midi), fc = cornerHz * (f0 / 220) ** STRINGS.keytrack;
  const t = new Float32Array(TABLE + 1);
  const phase = makeRng(1000 + midi * 16 + player);   // same phases in this player's dark and bright table
  for (let k = 1; k * f0 < 9000; k++) {
    const a = 1 / k / Math.sqrt(1 + (k * f0 / fc) ** 4), p = phase() * TAU;
    if (a < 3e-4) break;
    for (let i = 0; i < TABLE; i++) t[i] += a * Math.sin(TAU * k * i / TABLE + p);
  }
  t[TABLE] = t[0];
  tableCache.set(key, t);
  return t;
}
const swellGain = gainCurve(STRINGS_SWELL);
const swellBright = Float32Array.from({ length: N }, (_, n) => clamp(curveAt(STRINGS_BRIGHTNESS, n / SR), 0, 1));

function stringNote(bus, rng, tOn, tOff, midi, weight = 1, quickIn = false, quickOut = false) {
  const q = STRINGS.quickSec;
  const i0 = Math.max(0, Math.round((tOn - (quickIn ? 0.4 * q : STRINGS.leadSec)) * SR));
  const iRel = Math.round((tOff - (quickOut ? 0.4 * q : STRINGS.leadSec)) * SR) - i0;
  const attN = (tOn <= 0 ? 0.2 : quickIn ? q : STRINGS.attackSec) * SR;   // the very first chord rides the master fade-in
  const relN = (quickOut ? q : STRINGS.releaseSec) * SR;
  const len = Math.min(N - i0, iRel + Math.ceil(relN));
  const V = STRINGS.voices;
  const pans = Array.from({ length: V }, (_, v) => (V > 1 ? v / (V - 1) * 2 - 1 : 0));
  for (let v = V - 1; v > 0; v--) { const j = Math.floor(rng() * (v + 1)); [pans[v], pans[j]] = [pans[j], pans[v]]; }
  const amp = STRINGS.level * weight / Math.sqrt(V);
  const vibDelayN = STRINGS.vibratoDelaySec * SR, vibRampN = 0.8 * SR;
  for (let v = 0; v < V; v++) {
    const dark = stringTable(midi, STRINGS.darkHz, v), bright = stringTable(midi, STRINGS.brightHz, v);
    const u = V > 1 ? v / (V - 1) * 2 - 1 : 0;
    const inc = hz(midi) * 2 ** ((u * STRINGS.detuneCents + (rng() - 0.5) * 3) / 1200) * TABLE / SR;
    const [gL, gR] = panGains(pans[v] * STRINGS.spread);
    const depth = 2 ** (STRINGS.vibratoCents * (0.7 + 0.6 * rng()) / 1200) - 1;
    // two slow LFOs as rotating phasors: vibrato and a gentle "bow pressure" tremor
    const vw = TAU * STRINGS.vibratoHz * (0.9 + 0.2 * rng()) / SR, vc = Math.cos(vw), vs = Math.sin(vw);
    const aw = TAU * (0.13 + 0.2 * rng()) / SR, ac = Math.cos(aw), as = Math.sin(aw);
    let vp = rng() * TAU, vx = Math.cos(vp), vy = Math.sin(vp);
    let ap = rng() * TAU, ax = Math.cos(ap), ay = Math.sin(ap);
    let phase = rng() * TABLE;
    for (let i = 0; i < len; i++) {
      const n = i0 + i;
      let e = 1;
      if (i < attN) { const s = Math.sin(0.5 * Math.PI * i / attN); e = s * s; }
      if (i > iRel) { const c = Math.cos(0.5 * Math.PI * Math.min(1, (i - iRel) / relN)); e *= c * c; }
      const vd = i < vibDelayN ? 0 : Math.min(1, (i - vibDelayN) / vibRampN);
      phase += inc * (1 + depth * vd * vy);
      if (phase >= TABLE) phase -= TABLE;
      const j = phase | 0, fr = phase - j;
      const d = dark[j] + (dark[j + 1] - dark[j]) * fr;
      const b = bright[j] + (bright[j + 1] - bright[j]) * fr;
      const s = (d + (b - d) * swellBright[n]) * e * swellGain[n] * (1 + 0.12 * ay) * amp;
      bus.L[n] += s * gL;
      bus.R[n] += s * gR;
      let t = vx * vc - vy * vs; vy = vx * vs + vy * vc; vx = t;
      t = ax * ac - ay * as; ay = ax * as + ay * ac; ax = t;
    }
  }
}


// ── Breath-driven leads: shared phrasing ────────────────────────────────────
// One continuous pitch curve per breath: notes are joined by short glides (meend), vibrato
// arrives late on each note, the breath scoops up into its first note. Used by the bansuri
// and the shehnai, which differ only in their tone generators below.
const LN2_12 = Math.LN2 / 12;
const smoothstep = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

/** notes: [{ t, dur, midi }] back to back = one breath → per-sample pitch / envelope / vibrato curves. */
function phraseControl(notes, vel0, vel1, P) {
  const first = notes[0], last = notes[notes.length - 1];
  const tA = first.t - P.leadSec, tB = last.t + last.dur;
  const i0 = Math.max(0, Math.round(tA * SR));
  const len = Math.min(N - i0, Math.ceil((tB - tA + P.releaseSec + 0.05) * SR));
  if (len <= 0) return null;
  const pitch = new Float32Array(len), env = new Float32Array(len);
  const vib = new Float32Array(len), chiff = new Float32Array(len);
  const reach = notes.map((nt, j) => {
    if (j === 0) return null;
    const step = Math.abs(nt.midi - notes[j - 1].midi);
    if (step === 0) return { same: true, from: nt.t };
    const g = clamp(P.glideSec * (1 + 0.1 * (step - 2)), 0.06, 0.2);
    return { same: false, from: nt.t - 0.45 * g, len: g };
  });
  const DIP = 0.06;
  let j = 0;
  for (let i = 0; i < len; i++) {
    const t = (i0 + i) / SR;
    while (j + 1 < notes.length && t >= reach[j + 1].from) j++;
    const nt = notes[j], r = reach[j], next = reach[j + 1];
    let p = nt.midi, e = 1;
    if (j === 0) p -= P.scoopSemitones * (1 - smoothstep((t - tA) / P.scoopSec));
    if (r && !r.same) {
      const x = (t - r.from) / r.len;
      if (x < 1) {
        p = notes[j - 1].midi + (nt.midi - notes[j - 1].midi) * smoothstep(x);
        e *= 1 - 0.16 * Math.sin(Math.PI * x);
      }
    }
    if (r && r.same && t - nt.t < DIP) e *= 1 - 0.7 * Math.cos(0.5 * Math.PI * (t - nt.t) / DIP) ** 2;
    if (next && next.same && next.from - t < DIP) e *= 1 - 0.7 * Math.cos(0.5 * Math.PI * (next.from - t) / DIP) ** 2;
    const tn = t - nt.t;
    if (nt.dur >= 1.5) e *= 1 + 0.08 * Math.sin(Math.PI * clamp(tn / nt.dur, 0, 1));   // long notes bloom a little
    const ta = (t - tA) / P.attackSec;
    if (ta < 1) e *= Math.sin(0.5 * Math.PI * Math.max(0, ta)) ** 2;
    const tr = (t - (tB - 0.04)) / P.releaseSec;
    if (tr > 0) e *= Math.cos(0.5 * Math.PI * Math.min(1, tr)) ** 2;
    const vel = vel0 + (vel1 - vel0) * clamp((t - first.t) / (tB - first.t), 0, 1);
    pitch[i] = p;
    env[i] = e * vel;
    vib[i] = clamp((tn - P.vibratoDelaySec) / P.vibratoRampSec, 0, 1) * (nt.dur >= 0.6 ? 1 : 0.4);
    chiff[i] = vel * Math.exp(-Math.max(0, t - tA) / 0.045) * Math.min(1, Math.max(0, ta) * 4);
  }
  return { i0, len, pitch, env, vib, chiff };
}

// ── Bansuri ─────────────────────────────────────────────────────────────────
// Sine-heavy tone, a little band-passed breath on top.
const FLUTE = {
  level: 0.15,
  harmonics: [1, 0.26, 0.10, 0.04, 0.016],   // partials 1‥5 at full breath (fundamental-heavy)
  breathLevel: 0.09, chiffLevel: 0.22, breathHz: 2300,
  attackSec: 0.08, releaseSec: 0.22, leadSec: 0.03,
  glideSec: 0.11, scoopSemitones: 0.5, scoopSec: 0.11,
  vibratoHz: 5.0, vibratoCents: 13, vibratoDelaySec: 0.32, vibratoRampSec: 0.45,
  pan: -0.08,
};
function flutePhrase(bus, rng, notes, vel0, vel1) {
  const c = phraseControl(notes, vel0, vel1, FLUTE);
  if (!c) return;
  const { i0, len, pitch, env, vib, chiff } = c;
  const H = FLUTE.harmonics;
  const tone = new Float32Array(len), noise = new Float32Array(len);
  const kVib = 1 - Math.exp(-1 / (0.04 * SR)), kEnv = 1 - Math.exp(-1 / (0.004 * SR));
  const kDrift = 1 - Math.exp(-1 / (0.25 * SR)), kAmp = 1 - Math.exp(-1 / (0.08 * SR));
  const vibInc = TAU * FLUTE.vibratoHz * (0.96 + 0.08 * rng()) / SR;
  let ph = 0, vph = rng() * TAU, vv = 0, ee = 0, drift = 0, wobble = 0;
  for (let i = 0; i < len; i++) {
    vv += (vib[i] - vv) * kVib;
    ee += (env[i] - ee) * kEnv;
    drift += (rng() - 0.5 - drift) * kDrift;
    wobble += (rng() - 0.5 - wobble) * kAmp;
    vph += vibInc;
    const vs = Math.sin(vph);
    const cents = FLUTE.vibratoCents * vv * vs + drift * 2000;
    ph += TAU * 440 * Math.exp((pitch[i] - 69 + cents / 100) * LN2_12) / SR;
    if (ph > TAU) ph -= TAU;
    const a = ee * (1 + wobble * 12) * (1 + 0.05 * vv * vs);
    const b = Math.min(1.25, (a / 0.7) ** 0.8);    // more breath pressure → more overtones
    let s = 0, bk = 1;
    for (let k = 0; k < H.length; k++) { s += H[k] * bk * Math.sin((k + 1) * ph); bk *= b; }
    tone[i] = s * a;
    noise[i] = (rng() * 2 - 1) * (a * FLUTE.breathLevel + chiff[i] * FLUTE.chiffLevel);
  }
  filter(noise, biquad('bandpass', FLUTE.breathHz, 0.7));
  const air = biquad('lowpass', 2.2 * FLUTE.breathHz);
  filter(filter(noise, air), air);
  const [gL, gR] = panGains(FLUTE.pan);
  for (let i = 0; i < len; i++) {
    const s = (tone[i] + noise[i]) * FLUTE.level;
    bus.L[i0 + i] += s * gL;
    bus.R[i0 + i] += s * gR;
  }
}

// ── Shehnai ─────────────────────────────────────────────────────────────────
// Double reed: a full harmonic series shaped by fixed formants (≈1.2 kHz and ≈2.7 kHz give
// the nasal "wedding" colour), quicker and wider vibrato than the flute, brighter when louder.
// Rendered additively (band-limited by construction, rolled off above ~5 kHz) so it stays smooth.
const SHEHNAI = {
  level: 0.085,
  formants: [[1180, 360, 1.0], [2700, 520, 0.55], [4000, 700, 0.15]],   // [centre Hz, width Hz, gain]
  floor: 0.10, tilt: 0.55, rolloffHz: 4800, maxFreq: 7200, maxHarmonics: 26,
  pressureBright: 0.10,          // louder → upper harmonics come up
  breathLevel: 0.018, breathHz: 3000,
  attackSec: 0.05, releaseSec: 0.14, leadSec: 0.02,
  glideSec: 0.085, scoopSemitones: 0.9, scoopSec: 0.085,
  vibratoHz: 6.0, vibratoCents: 20, vibratoDelaySec: 0.20, vibratoRampSec: 0.30,
  pan: 0.04,
};
function shehnaiSpectrum(f, press, out) {
  const S = SHEHNAI;
  let power = 0;
  for (let k = 1; k <= S.maxHarmonics; k++) {
    const fk = k * f;
    if (fk > S.maxFreq) { out[k] = 0; continue; }
    let g = S.floor;
    for (const [fc, bw, gain] of S.formants) g += gain * Math.exp(-0.5 * ((fk - fc) / bw) ** 2);
    const a = g * k ** -S.tilt / (1 + (fk / S.rolloffHz) ** 4) * press ** (S.pressureBright * (k - 1));
    out[k] = a;
    power += a * a / 2;
  }
  const norm = 1 / Math.sqrt(Math.max(power, 1e-9));   // same loudness on every pitch
  for (let k = 1; k <= S.maxHarmonics; k++) out[k] *= norm;
}
function shehnaiPhrase(bus, rng, notes, vel0, vel1) {
  const S = SHEHNAI, c = phraseControl(notes, vel0, vel1, S);
  if (!c) return;
  const { i0, len, pitch, env, vib, chiff } = c;
  const tone = new Float32Array(len), noise = new Float32Array(len);
  const amps = new Float64Array(S.maxHarmonics + 1);
  const kVib = 1 - Math.exp(-1 / (0.03 * SR)), kEnv = 1 - Math.exp(-1 / (0.004 * SR));
  const kDrift = 1 - Math.exp(-1 / (0.3 * SR)), kAmp = 1 - Math.exp(-1 / (0.06 * SR));
  const vibInc = TAU * S.vibratoHz * (0.97 + 0.06 * rng()) / SR;
  let ph = 0, vph = rng() * TAU, vv = 0, ee = 0, drift = 0, wobble = 0, f = 440;
  for (let i = 0; i < len; i++) {
    vv += (vib[i] - vv) * kVib;
    ee += (env[i] - ee) * kEnv;
    drift += (rng() - 0.5 - drift) * kDrift;
    wobble += (rng() - 0.5 - wobble) * kAmp;
    vph += vibInc;
    const vs = Math.sin(vph);
    const cents = S.vibratoCents * vv * vs + drift * 1200;
    f = 440 * Math.exp((pitch[i] - 69 + cents / 100) * LN2_12);
    ph += TAU * f / SR;
    if (ph > TAU) ph -= TAU;
    const a = ee * (1 + wobble * 8);
    if ((i & 31) === 0) shehnaiSpectrum(f, clamp(a / 0.75, 0.35, 1.2), amps);
    // Σ a_k·sin(k·ph) with the Chebyshev recursion (one sin and one cos per sample)
    const c2 = 2 * Math.cos(ph);
    let sPrev = 0, sCur = Math.sin(ph), sum = 0;
    for (let k = 1; k <= S.maxHarmonics; k++) {
      if (amps[k] === 0) break;
      sum += amps[k] * sCur;
      const sNext = c2 * sCur - sPrev; sPrev = sCur; sCur = sNext;
    }
    tone[i] = sum * a;
    noise[i] = (rng() * 2 - 1) * (a * S.breathLevel + chiff[i] * 0.05);
  }
  filter(noise, biquad('bandpass', S.breathHz, 0.8));
  const [gL, gR] = panGains(S.pan);
  for (let i = 0; i < len; i++) {
    const s = (tone[i] + noise[i]) * S.level;
    bus.L[i0 + i] += s * gL;
    bus.R[i0 + i] += s * gR;
  }
}

// ── Sitar ───────────────────────────────────────────────────────────────────
// Additive pluck with the jawari "buzz": right after the pluck a bright band of harmonics sweeps
// down the series (the same idea as the tanpura, only faster and brighter). Supports a meend — the
// note can be bent in from a neighbouring pitch. A faint sympathetic shimmer (tarab) rings along.
const SITAR = {
  level: 0.26,
  maxFreq: 6000, tilt: 0.7, sweepSec: 0.22, bandWidth: 1.4,
  ringSec: 2.2, decayBase: 1.5, decayPerHarmonic: 0.11,
  glideSec: 0.10, glideDelaySec: 0.025,
  tarab: 0.035, tarabNotes: 'D5 A4 D4', tarabSec: 1.8,
  pan: 0.22,
};
function sitarNote(bus, rng, tOn, midi, vel, durSec, fromMidi = null) {
  const i0 = Math.round(tOn * SR);
  if (i0 < 0 || i0 >= N) return;
  const len = Math.min(N - i0, Math.ceil(Math.min(SITAR.ringSec, durSec + 0.9) * SR));
  const f0 = hz(midi), K = Math.max(1, Math.floor(SITAR.maxFreq / f0));
  const BLOCK = 64, out = scratchA;
  out.fill(0, 0, len);
  const fadeN = Math.round(0.08 * SR);
  const ratioAt = (t) => {   // pitch (as a frequency ratio to the target) during the meend
    if (fromMidi === null) return 1;
    const x = smoothstep((t - SITAR.glideDelaySec) / SITAR.glideSec);
    return 2 ** ((fromMidi - midi) * (1 - x) / 12);
  };
  const ampAt = (k, t) => {
    const centre = 2 + 0.8 * K * Math.exp(-t / SITAR.sweepSec);
    const band = 0.3 + Math.exp(-0.5 * ((k - centre) / (SITAR.bandWidth + 0.12 * K)) ** 2);
    const att = Math.min(1, t / 0.0015);
    return k ** -SITAR.tilt * band * att * Math.exp(-t * (SITAR.decayBase + SITAR.decayPerHarmonic * k));
  };
  const amp = vel * SITAR.level / Math.sqrt(K * 0.35 + 1);
  for (let k = 1; k <= K; k++) {
    let x = 0, y = 0;
    const p = rng() * TAU; x = Math.cos(p); y = Math.sin(p);
    for (let b = 0; b < len; b += BLOCK) {
      const t = b / SR, end = Math.min(len, b + BLOCK);
      const w = TAU * k * f0 * ratioAt(t) / SR, c = Math.cos(w), s = Math.sin(w);
      let a = ampAt(k, t) * amp;
      const a2 = ampAt(k, end / SR) * amp, da = (a2 - a) / (end - b);
      if (a < 1e-6 && a2 < 1e-6 && t > 0.05) break;
      for (let i = b; i < end; i++) {
        out[i] += y * a;
        const nx = x * c - y * s; y = x * s + y * c; x = nx;
        a += da;
      }
    }
  }
  // tarab: sympathetic strings, tuned to the raga, answer every pluck very quietly
  for (const m of noteList(SITAR.tarabNotes)) {
    const close = Math.abs(((midi - m) % 12 + 12) % 12) === 0 ? 1 : 0.35;
    addDampedSine(out, Math.round(0.004 * SR), len - Math.round(0.004 * SR), hz(m), amp * SITAR.tarab * close, 6.91 / SITAR.tarabSec, rng() * TAU);
  }
  const [gL, gR] = panGains(SITAR.pan);
  for (let i = 0; i < len; i++) {
    const e = i > len - fadeN ? (len - i) / fadeN : 1;
    bus.L[i0 + i] += out[i] * e * gL;
    bus.R[i0 + i] += out[i] * e * gR;
  }
}

// ── Santoor (hammered dulcimer) ─────────────────────────────────────────────
// Karplus–Strong courses (the swarmandal's string model), struck brighter and closer to the
// bridge, with a shorter ring; every course has two strings a few cents apart.
const SANTOOR = {
  level: 0.128,
  ringSec: 1.7, hfDecayHz: 3000, hfDecayRate: 3.2,
  pickPos: 0.12, pickSoftHz: 6200,
  chorusCents: 5, chorusLevel: 0.7,
};
function santoorNote(bus, rng, tOn, midi, vel, pan) {
  const i0 = Math.round(tOn * SR);
  if (i0 < 0 || i0 >= N) return;
  const len = Math.min(N - i0, Math.ceil((SANTOOR.ringSec + 0.4) * SR));
  ksString(scratchA, len, hz(midi), rng, SANTOOR);
  ksString(scratchB, len, hz(midi) * 2 ** (SANTOOR.chorusCents / 1200), rng, SANTOOR);
  const [aL, aR] = panGains(pan - 0.06), [bL, bR] = panGains(pan + 0.06);
  const a = vel * SANTOOR.level, b = a * SANTOOR.chorusLevel;
  const fadeIn = 24, fadeOut = Math.round(0.2 * SR);
  for (let i = 0; i < len; i++) {
    let e = i < fadeIn ? i / fadeIn : 1;
    if (i > len - fadeOut) e *= (len - i) / fadeOut;
    bus.L[i0 + i] += (scratchA[i] * a * aL + scratchB[i] * b * bL) * e;
    bus.R[i0 + i] += (scratchA[i] * a * aR + scratchB[i] * b * bR) * e;
  }
}

// ── Bass ────────────────────────────────────────────────────────────────────
// Round, plucked filmi bass: a few harmonics (so it still reads on phone speakers), quick
// attack, a decay towards a held level, short release.
const BASS = {
  level: 0.107,
  harmonics: [1, 0.55, 0.24, 0.09, 0.035],
  attackSec: 0.005, decaySec: 0.22, sustain: 0.55, releaseSec: 0.06,
};
function bassNote(bus, tOn, durSec, midi, vel) {
  const i0 = Math.round(tOn * SR);
  if (i0 < 0 || i0 >= N) return;
  const len = Math.min(N - i0, Math.ceil((durSec + BASS.releaseSec * 6) * SR));
  const f0 = hz(midi), offN = Math.round(durSec * SR);
  const attN = BASS.attackSec * SR, kDec = Math.exp(-1 / (BASS.decaySec * SR)), kRel = Math.exp(-1 / (BASS.releaseSec * SR));
  const H = BASS.harmonics;
  const w = TAU * f0 / SR, c = Math.cos(w), s = Math.sin(w);
  let x = 1, y = 0, dec = 1, rel = 1;
  const amp = BASS.level * vel;
  for (let i = 0; i < len; i++) {
    let e = i < attN ? i / attN : BASS.sustain + (1 - BASS.sustain) * dec;
    if (i >= attN) dec *= kDec;
    if (i > offN) { rel *= kRel; e *= rel; }
    // harmonics from the fundamental phasor: sin(kθ) via Chebyshev recursion
    const c2 = 2 * x;
    let sPrev = 0, sCur = y, v = 0;
    for (let k = 0; k < H.length; k++) { v += H[k] * sCur; const sNext = c2 * sCur - sPrev; sPrev = sCur; sCur = sNext; }
    const out = v * e * amp;
    bus.L[i0 + i] += out;
    bus.R[i0 + i] += out;
    const nx = x * c - y * s; y = x * s + y * c; x = nx;
  }
}

// ── Drum helpers ────────────────────────────────────────────────────────────
/** A struck membrane: partials [ratio, level, t60 s] over a fundamental that glides down from f0·(1+glide). */
function membraneHit(out, start, f0, glide, glideSec, partials, amp, rng) {
  if (start < 0 || start >= out.length) return;
  for (const [ratio, level, t60] of partials) {
    if (ratio * f0 > 12000) continue;
    const len = Math.min(out.length - start, Math.ceil(t60 * 1.2 * SR));
    const r = Math.exp(-6.91 / (t60 * SR)), rg = Math.exp(-1 / (glideSec * SR));
    let e = amp * level, g = glide, ph = rng() * 0.3;
    const rampN = 40;
    for (let i = 0; i < len; i++) {
      ph += TAU * ratio * f0 * (1 + g) / SR;
      out[start + i] += e * Math.sin(ph) * (i < rampN ? i / rampN : 1);
      e *= r; g *= rg;
    }
  }
}
/** A short burst of filtered noise with an exponential decay. */
function noiseHit(out, start, rng, amp, decaySec, filters, maxSec = 0.15) {
  if (start < 0 || start >= out.length) return;
  const len = Math.min(out.length - start, Math.ceil(Math.min(maxSec, decaySec * 8) * SR));
  const x = new Float64Array(len), r = Math.exp(-1 / (decaySec * SR));
  let e = amp;
  for (let i = 0; i < len; i++) { x[i] = (rng() * 2 - 1) * e; e *= r; }
  for (const f of filters) filter(x, f);
  for (let i = 0; i < len; i++) out[start + i] += x[i];
}
// glue = soft saturation ceiling: the loudest transients are rounded off (tanh) so the drums sit up front
// without the master limiter having to squash them; quiet strokes pass untouched.
const monoToBus = (mono, bus, pan, glue = 0) => {
  const [gL, gR] = panGains(pan);
  for (let n = 0; n < N; n++) {
    const v = glue ? glue * Math.tanh(mono[n] / glue) : mono[n];
    bus.L[n] += v * gL; bus.R[n] += v * gR;
  }
};

// ── Dholak ──────────────────────────────────────────────────────────────────
// Two heads: the bass head ("ge") is a low thump that glides down in pitch; the treble head
// ("na", "tin") rings with near-harmonic overtones and a small slap; "ka" is a closed slap.
const DHOLAK = {
  level: 0.55, pan: -0.12, glue: 0.40,
  bass: { f: 112, glide: 0.32, glideSec: 0.035, partials: [[1, 1, 0.30], [1.58, 0.28, 0.11], [2.13, 0.12, 0.07], [2.71, 0.05, 0.05]], thump: 0.30 },
  na:   { f: 430, partials: [[1, 1, 0.17], [2, 0.48, 0.11], [3, 0.26, 0.08], [4, 0.12, 0.06], [5.02, 0.05, 0.045]], slap: 0.20 },
  tin:  { f: 505, partials: [[1, 1, 0.34], [2, 0.30, 0.20], [3, 0.10, 0.12]], slap: 0.08 },
  ka:   { f: 300, partials: [[1, 0.45, 0.035], [1.7, 0.25, 0.03]], slap: 0.50 },
};
const F_SLAP = [biquad('bandpass', 3200, 1.1)];
const F_KA = [biquad('bandpass', 1800, 1.2)];
const F_THUMP = [biquad('lowpass', 380), biquad('lowpass', 380)];
function dholakStroke(mono, rng, t, stroke, vel, bassScale = 1) {
  const D = DHOLAK, i0 = Math.round(t * SR), a = vel * D.level;
  const bass = (v) => {
    membraneHit(mono, i0, D.bass.f * (0.98 + 0.04 * rng()), D.bass.glide, D.bass.glideSec, D.bass.partials, a * v * bassScale, rng);
    noiseHit(mono, i0, rng, a * v * bassScale * D.bass.thump, 0.006, F_THUMP, 0.05);
  };
  const head = (h, v) => {
    membraneHit(mono, i0, h.f * (0.99 + 0.02 * rng()), 0.02, 0.01, h.partials, a * v, rng);
    noiseHit(mono, i0, rng, a * v * h.slap, 0.004, h === D.ka ? F_KA : F_SLAP, 0.04);
  };
  switch (stroke) {
    case 'Dha': bass(1); head(D.na, 0.85); break;
    case 'Dhi': bass(0.9); head(D.tin, 0.8); break;
    case 'Ge':  bass(0.75); break;
    case 'Na':  head(D.na, 1); break;
    case 'Ta':  head(D.na, 0.85); break;
    case 'Tin': head(D.tin, 0.9); break;
    case 'Ka':  head(D.ka, 1); break;
    default: throw new Error(`Unknown dholak stroke ${stroke}`);
  }
}

// ── Dhol ────────────────────────────────────────────────────────────────────
// The big Punjabi barrel drum: "dagga" (beater on the bass side, deep and long) and "tilli"
// (the cane stick on the treble side, a dry crack).
const DHOL = {
  level: 0.42, pan: 0.16, glue: 0.45,
  dagga: { f: 66, glide: 0.55, glideSec: 0.04, partials: [[1, 1, 0.55], [1.62, 0.32, 0.22], [2.2, 0.14, 0.12], [2.9, 0.06, 0.07]], thump: 0.45 },
  tilli: { f: 860, partials: [[1, 0.45, 0.07], [1.73, 0.34, 0.05], [2.41, 0.22, 0.04], [3.2, 0.10, 0.03]], crack: 0.55 },
};
const F_CRACK = [biquad('bandpass', 2300, 1.4)];
function dholStroke(mono, rng, t, stroke, vel) {
  const D = DHOL, i0 = Math.round(t * SR), a = vel * D.level;
  if (stroke === 'dagga') {
    membraneHit(mono, i0, D.dagga.f * (0.98 + 0.04 * rng()), D.dagga.glide, D.dagga.glideSec, D.dagga.partials, a, rng);
    noiseHit(mono, i0, rng, a * D.dagga.thump, 0.008, F_THUMP, 0.06);
  } else {
    membraneHit(mono, i0, D.tilli.f * (0.98 + 0.04 * rng()), 0, 0.01, D.tilli.partials, a, rng);
    noiseHit(mono, i0, rng, a * D.tilli.crack, 0.005, F_CRACK, 0.05);
  }
}

// ── Claps ───────────────────────────────────────────────────────────────────
// A hand clap = a few micro-bursts a few ms apart, band-passed around 1.2 kHz, plus a short tail.
const CLAP = { level: 0.63 };
const F_CLAP = [biquad('bandpass', 1250, 0.9), biquad('highpass', 450)];
function clapHit(bus, rng, t, vel, pan) {
  const i0 = Math.round(t * SR);
  if (i0 < 0 || i0 >= N) return;
  const len = Math.min(N - i0, Math.round(0.16 * SR));
  const x = new Float64Array(len);
  const bursts = [0, 0.0085, 0.0175, 0.027];
  for (let b = 0; b < bursts.length; b++) {
    const s = Math.round(bursts[b] * SR), dec = b === bursts.length - 1 ? 0.045 : 0.0035, r = Math.exp(-1 / (dec * SR));
    let e = (b === bursts.length - 1 ? 1 : 0.75) * (0.85 + 0.3 * rng());
    for (let i = s; i < len; i++) { x[i] += (rng() * 2 - 1) * e; e *= r; if (e < 1e-4) break; }
  }
  for (const f of F_CLAP) filter(x, f);
  const [gL, gR] = panGains(pan), a = vel * CLAP.level;
  for (let i = 0; i < len; i++) { bus.L[i0 + i] += x[i] * a * gL; bus.R[i0 + i] += x[i] * a * gR; }
}

// ── Ghungroo / jingles ──────────────────────────────────────────────────────
// A cluster of tiny bells (short high pings) with a breath of "tss" — the dancer's anklets.
const JINGLE = { level: 0.085, pings: 7 };
const F_TSS = [biquad('highpass', 6000), biquad('lowpass', 10000)];
function jingleHit(bus, rng, t, vel, pan) {
  const i0 = Math.round(t * SR);
  if (i0 < 0 || i0 >= N) return;
  const len = Math.min(N - i0, Math.round(0.14 * SR));
  scratchA.fill(0, 0, len);
  const a = vel * JINGLE.level;
  for (let p = 0; p < JINGLE.pings; p++) {
    const s = Math.round(rng() * 0.022 * SR), f = 3900 + rng() * 3400, t60 = 0.04 + rng() * 0.07;
    addDampedSine(scratchA, s, len - s, f, a * (0.4 + 0.6 * rng()), 6.91 / t60, rng() * TAU);
  }
  noiseHit(scratchA, 0, rng, a * 0.5, 0.006, F_TSS, 0.05);
  const [gL, gR] = panGains(pan);
  for (let i = 0; i < len; i++) { bus.L[i0 + i] += scratchA[i] * gL; bus.R[i0 + i] += scratchA[i] * gR; }
}

// ── Cymbal ──────────────────────────────────────────────────────────────────
// Soft crash: filtered noise plus a handful of inharmonic metal partials. 'swell' is the same
// sound reversed, rising into its cue.
const CYMBAL = { level: 0.072, t60: 2.4, partials: [3120, 4410, 5230, 6380, 7710, 8890] };
const F_CYM = [biquad('highpass', 3200), biquad('lowpass', 10500), biquad('lowpass', 10500)];
function cymbalHit(bus, rng, at, kind, level, swellLen = 1.2) {
  const C = CYMBAL, len = Math.round((kind === 'swell' ? swellLen : C.t60) * SR);
  const x = new Float64Array(len);
  for (let i = 0; i < len; i++) x[i] = rng() * 2 - 1;
  for (const f of F_CYM) filter(x, f);
  const metal = new Float64Array(len);
  for (const f of C.partials) addDampedSine(metal, 0, len, f * (0.99 + 0.02 * rng()), 0.35 / C.partials.length, 6.91 / (C.t60 * 0.8), rng() * TAU);
  const [gL, gR] = panGains(0.1);
  for (let i = 0; i < len; i++) {
    const u = i / len;
    const e = kind === 'swell' ? u ** 2.2 : Math.exp(-6.91 * i / (C.t60 * SR)) * Math.min(1, i / 60);
    const v = (kind === 'swell' ? x[i] : x[i] + metal[i] * 2) * e * level * C.level;
    const n = kind === 'swell' ? Math.round(at * SR) - len + i : Math.round(at * SR) + i;
    if (n < 0 || n >= N) continue;
    bus.L[n] += v * gL;
    bus.R[n] += v * gR;
  }
}

// ── Swarmandal (Indian harp) ────────────────────────────────────────────────
// Karplus–Strong strings: a delay line with a gentle loss filter in the loop. The
// fractional part of the loop length is tuned with a first-order all-pass, and the loss
// filter is scaled per string so high strings keep their shimmer as long as low ones.
const SWARMANDAL = {
  level: 0.08,
  ringSec: 3.2,                 // time for the fundamental to fall 60 dB
  hfDecayHz: 3000, hfDecayRate: 3.4, // decay rate (1/s) at hfDecayHz for every string
  pickPos: 0.22, pickSoftHz: 3600,   // plectrum position / softness → mellow, not harsh
  chorusCents: 4, chorusLevel: 0.6,  // each course = two strings a hair apart
};
function ksString(out, len, f, rng, P = SWARMANDAL) {
  const period = SR / f;
  const sProd = Math.min(0.25, P.hfDecayRate / (f * (1 - Math.cos(TAU * P.hfDecayHz / SR))));
  const S = 0.5 - Math.sqrt(0.25 - sProd);            // loss filter y = ρ·((1−S)·x[n] + S·x[n−1]), delay ≈ S
  const rho = 10 ** (-3 / (f * P.ringSec));
  const whole = Math.floor(period - S - 0.1);         // leaves 0.1‥1.1 samples for the all-pass
  const frac = period - S - whole;
  const C = (1 - frac) / (1 + frac);
  // Excitation: a plucked-string spectrum (solid fundamental, pick-position comb, softened
  // highs, random phases) laid out with the TRUE, fractional period. It is evaluated a little
  // into the past as well, so the loop filters can be started in steady state — otherwise
  // every pluck would begin with a broadband tick.
  const WARM = 64;
  const shape = new Float64Array(WARM + whole);
  let power = 0;
  for (let k = 1; k * f < 9000 && k < period / 2; k++) {
    const a = Math.abs(Math.sin(Math.PI * k * P.pickPos)) / k / Math.sqrt(1 + (k * f / P.pickSoftHz) ** 2);
    const p = rng() * TAU, w = TAU * k / period;
    for (let i = 0; i < shape.length; i++) shape[i] += a * Math.sin(w * (i - WARM) + p);
    power += a * a / 2;
  }
  const norm = 1 / Math.sqrt(power);
  let prev = 0, apIn = 0, apOut = 0;
  for (let i = 0; i < WARM; i++) {
    const x = shape[i] * norm, lp = rho * ((1 - S) * x + S * prev);
    prev = x;
    apOut = C * lp + apIn - C * apOut;
    apIn = lp;
  }
  const line = Float64Array.from(shape.subarray(WARM), (x) => x * norm);
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const x = line[idx];
    const lp = rho * ((1 - S) * x + S * prev);
    prev = x;
    const y = C * lp + apIn - C * apOut;
    apIn = lp; apOut = y;
    line[idx] = y;
    if (++idx === whole) idx = 0;
    out[i] = x;
  }
}
function swarmandalNote(bus, rng, tOn, midi, amp, pan) {
  const i0 = Math.round(tOn * SR);
  const len = Math.min(N - i0, Math.ceil((SWARMANDAL.ringSec + 0.6) * SR));
  if (len <= 0) return;
  ksString(scratchA, len, hz(midi), rng);
  ksString(scratchB, len, hz(midi) * 2 ** (SWARMANDAL.chorusCents / 1200), rng);
  const [aL, aR] = panGains(pan - 0.08), [bL, bR] = panGains(pan + 0.08);
  const a = amp * SWARMANDAL.level, b = a * SWARMANDAL.chorusLevel;
  const fadeIn = 72, fadeOut = Math.round(0.25 * SR);
  for (let i = 0; i < len; i++) {
    let e = i < fadeIn ? 0.5 - 0.5 * Math.cos(Math.PI * i / fadeIn) : 1;
    if (i > len - fadeOut) e *= (len - i) / fadeOut;
    bus.L[i0 + i] += (scratchA[i] * a * aL + scratchB[i] * b * bL) * e;
    bus.R[i0 + i] += (scratchA[i] * a * aR + scratchB[i] * b * bR) * e;
  }
}

// ── Chimes ──────────────────────────────────────────────────────────────────
// Celesta / glass-bell partials (bar modes 2.76 and 5.4 give the "ting"); deliberately
// no minor-third bell partial, so they never fight the major harmony.
const CHIME = {
  level: 0.080,
  decaySec: 2.6,                // 60 dB decay of the fundamental at D6 (higher notes a bit shorter)
  partials: [[1, 1, 1], [2.0, 0.10, 0.55], [2.76, 0.22, 0.32], [4.07, 0.07, 0.2], [5.4, 0.045, 0.14]], // [ratio, level, decay×]
  beatHz: 0.7,                  // each partial is a close pair → slow, bell-like shimmer
  maxFreq: 9000,
};
function chimeNote(bus, rng, tOn, midi, amp, pan) {
  const i0 = Math.round(tOn * SR);
  const f0 = hz(midi), t60 = CHIME.decaySec * (1175 / f0) ** 0.3;
  const len = Math.min(N - i0, Math.ceil(t60 * 1.6 * SR));
  if (len <= 0) return;
  scratchA.fill(0, 0, len);
  for (const [ratio, level, decayMul] of CHIME.partials) {
    const f = f0 * ratio;
    if (f > CHIME.maxFreq) continue;
    const rate = 6.91 / (t60 * decayMul), a = amp * CHIME.level * level, p = rng() * TAU;
    addDampedSine(scratchA, 0, len, f - CHIME.beatHz / 2, a * 0.6, rate, p);
    addDampedSine(scratchA, 0, len, f + CHIME.beatHz / 2, a * 0.4, rate * 1.15, p + 0.4);
  }
  const [gL, gR] = panGains(pan);
  const attN = 110, fadeOut = Math.round(0.1 * SR);
  for (let i = 0; i < len; i++) {
    let e = i < attN ? 0.5 - 0.5 * Math.cos(Math.PI * i / attN) : 1;
    if (i > len - fadeOut) e *= (len - i) / fadeOut;
    bus.L[i0 + i] += scratchA[i] * e * gL;
    bus.R[i0 + i] += scratchA[i] * e * gR;
  }
}

// ── Tanpura-like drone ──────────────────────────────────────────────────────
// Additive: after each soft pluck a bright band slides down through the harmonics —
// the tanpura's "jivari" shimmer — kept dark and very quiet, purely for colour.
const TANPURA = {
  level: 0.050,
  cycle: 'D3 A2 D3 D2',         // Sa Pa Sa Sa(low), one string per beat
  ringSec: 5.0, sweepSec: 1.0, maxFreq: 3000,
  attackSec: 0.22,              // slow enough that the strings swell in — a shimmer, not a pulse
  mellowHz: 1500,               // harmonics above this are progressively softened
};
function tanpuraPluck(bus, rng, tOn, midi, amp, pan) {
  const i0 = Math.round(tOn * SR);
  const len = Math.min(N - i0, Math.ceil(TANPURA.ringSec * SR));
  if (len <= 0) return;
  const f0 = hz(midi), K = Math.floor(TANPURA.maxFreq / f0), tau = TANPURA.ringSec / 4.6;
  const width = 1.5 + 0.12 * K, BLOCK = 96;
  const mellow = Array.from({ length: K + 1 }, (_, k) => 1 / (1 + (k * f0 / TANPURA.mellowHz) ** 2));
  const [gL, gR] = panGains(pan);
  const levelAt = (k, t) => {
    const centre = 1.5 + 0.7 * K * Math.exp(-t / TANPURA.sweepSec);
    const band = 0.15 + Math.exp(-0.5 * ((k - centre) / width) ** 2);
    const att = t < TANPURA.attackSec ? Math.sin(0.5 * Math.PI * t / TANPURA.attackSec) ** 2 : 1;
    const out = clamp((TANPURA.ringSec - t) / 0.5, 0, 1);
    return amp * TANPURA.level * k ** -0.8 * mellow[k] * band * att * out * Math.exp(-t / tau * (1 + 0.035 * k));
  };
  for (let k = 1; k <= K; k++) {
    const w = TAU * k * f0 * (1 + (rng() - 0.5) * 0.0006) / SR, c = Math.cos(w), s = Math.sin(w);
    const p = rng() * TAU;
    let x = Math.cos(p), y = Math.sin(p);
    for (let b = 0; b < len; b += BLOCK) {
      const end = Math.min(len, b + BLOCK);
      let a = levelAt(k, b / SR);
      const da = (levelAt(k, (b + BLOCK) / SR) - a) / BLOCK;
      for (let i = b; i < end; i++) {
        const v = y * a;
        bus.L[i0 + i] += v * gL;
        bus.R[i0 + i] += v * gR;
        const nx = x * c - y * s; y = x * s + y * c; x = nx;
        a += da;
      }
    }
  }
}


// ════════════════════════════════════════════════════════════════════════════
//  4. ARRANGEMENT — turns the tables of section 1 into notes
// ════════════════════════════════════════════════════════════════════════════
/** All chord segments: { bar, beat, beats, t0, t1, name, chord }. */
const SEGMENTS = (() => {
  const out = [];
  HARMONY.forEach((row, bar) => {
    let beat = 0;
    for (const [name, beats] of row) {
      if (!CHORDS[name]) throw new Error(`Unknown chord ${name} in bar ${bar}`);
      const t0 = barTime(bar, beat), t1 = bar === HARMONY.length - 1 ? TOTAL_SEC + 2 : barTime(bar, beat + beats);
      out.push({ bar, beat, beats, t0, t1, name, chord: CHORDS[name] });
      beat += beats;
    }
  });
  return out;
})();
const level = (v) => (typeof v === 'number' ? v : v ? 1 : 0);
// downbeats that must sit exactly on the picture (no humanisation)
const LOCKED_BARS = new Set([3, 10, 17, 19]);
const human = (rng, bar, eighth, amount = 0.008) => (eighth === 0 && LOCKED_BARS.has(bar) ? 0 : (rng() - 0.5) * amount);

function arrangeStrings(bus) {
  const rng = makeRng(2);
  const segs = SEGMENTS.filter((s) => PLAN[s.bar]?.strings);
  const sounding = new Map(), notes = [];   // notes shared by neighbouring chords are tied
  segs.forEach((s, i) => {
    const list = noteList(PLAN[s.bar].strings === 'high' ? s.chord.padHi : s.chord.pad);
    const gap = i > 0 && segs[i - 1].t1 < s.t0 - 1e-6;
    for (const [m, start] of sounding) if (gap || !list.includes(m)) { notes.push([start, i > 0 ? segs[i - 1].t1 : s.t0, m]); sounding.delete(m); }
    for (const m of list) if (!sounding.has(m)) sounding.set(m, s.t0);
    if (i === segs.length - 1) for (const [m, start] of sounding) notes.push([start, s.t1, m]);
  });
  const weight = (m) => (m < 45 ? 0.85 : m > 74 ? 0.6 : m > 69 ? 0.8 : 1);
  for (const [start, end, m] of notes) stringNote(bus, rng, start, end, m, weight(m));
}

function arrangeFlute(bus) { playBreaths(bus, makeRng(3), BANSURI_PHRASES, flutePhrase); }
function arrangeShehnai(bus) { playBreaths(bus, makeRng(8), SHEHNAI_PHRASES, shehnaiPhrase); }
function playBreaths(bus, rng, phrases, render) {
  for (const phrase of phrases) {
    const t0 = barTime(phrase.bar, phrase.beat ?? 0);
    const notes = parseMelody(phrase.notes).map((nt) => ({ t: t0 + nt.beat * BEAT, dur: nt.beats * BEAT, midi: nt.midi }));
    const tEnd = notes[notes.length - 1].t + notes[notes.length - 1].dur;
    const velAt = (t) => phrase.vel + ((phrase.velEnd ?? phrase.vel) - phrase.vel) * (t - t0) / (tEnd - t0);
    let breath = [];
    const play = () => {
      if (!breath.length) return;
      const last = breath[breath.length - 1];
      render(bus, rng, breath, velAt(breath[0].t), velAt(last.t + last.dur));
      breath = [];
    };
    for (const nt of notes) {   // a rest in the text = a new breath
      const prev = breath[breath.length - 1];
      if (prev && nt.t > prev.t + prev.dur + 1e-6) play();
      breath.push(nt);
    }
    play();
  }
}

function arrangeSitar(bus) {
  const rng = makeRng(9);
  for (const line of SITAR_LINES) {
    const t0 = barTime(line.bar, line.beat ?? 0);
    let prev = null;
    for (const nt of parseMelody(line.notes)) {
      const midi = nt.midi + (line.octave ?? 0);
      const t = t0 + nt.beat * BEAT + (rng() - 0.4) * 0.008;
      const step = prev ? Math.abs(midi - prev.midi) : 99;
      const bend = prev && Math.abs(prev.end - nt.beat) < 1e-6 && step > 0 && step <= 3 && rng() < 0.4;
      sitarNote(bus, rng, t, midi, line.vel * (0.9 + 0.2 * rng()), nt.beats * BEAT, bend ? prev.midi : null);
      prev = { midi, end: nt.beat + nt.beats };
    }
  }
  for (const s of SITAR_STRUMS) {
    noteList(s.notes).forEach((m, i) => sitarNote(bus, rng, s.at + i * 0.024, m, s.vel * (i === 0 ? 1 : 0.82), 2.2));
  }
}

function arrangeSantoor(bus) {
  const rng = makeRng(10);
  PLAN.forEach((p, bar) => {
    if (p.santoor === 'shimmer') {   // tremolo on two strings, swelling until the glissando takes over
      const t0 = barTime(bar) + 0.15, t1 = barTime(bar) + 2.2;
      let i = 0;
      for (let t = t0; t < t1; t += 1 / 13, i++) {
        const x = (t - t0) / (t1 - t0);
        santoorNote(bus, rng, t + (rng() - 0.5) * 0.006, midiOf(i % 2 ? 'A4' : 'D5'), 0.14 + 0.42 * x * x, i % 2 ? -0.25 : 0.25);
      }
      return;
    }
    if (!p.santoor) return;
    const vel = p.santoorVel ?? 0.4, step = p.santoor === 'arp16' ? 0.25 : 0.5;
    const order = p.santoor === 'arp16' ? [0, 1, 2, 3, 2, 1, 2, 3] : [0, 1, 2, 3, 1, 2, 3, 2];
    for (const s of SEGMENTS.filter((x) => x.bar === bar)) {
      const tones = noteList(s.chord.arp);
      for (let k = 0; k * step < s.beats - 1e-6; k++) {
        const beat = s.beat + k * step, onBeat = Math.abs(beat - Math.round(beat)) < 1e-6;
        const m = tones[order[k % order.length]];
        santoorNote(bus, rng, barTime(bar, beat) + (rng() - 0.5) * 0.006, m, vel * (onBeat ? 1 : 0.78) * (0.92 + 0.16 * rng()), clamp((m - 66) / 14, -0.5, 0.5));
      }
    }
  });
}

function arrangeBass(bus) {
  const rng = makeRng(11);
  for (const s of SEGMENTS) {
    const p = PLAN[s.bar], v = level(p?.bass);
    if (s.bar === HARMONY.length - 1) { bassNote(bus, s.t0, 2.3, midiOf(s.chord.bass), 1); continue; }   // final hit
    if (!v) continue;
    const root = midiOf(s.chord.bass), fifth = root + 7, oct = root + 12;
    const pattern = p.dholak === 'roll' ? [[0, root, 1.8]]
      : s.beats >= 4 ? [[0, root, 1.3], [1.5, root, 0.4], [2, fifth, 0.9], [3, oct, 0.35], [3.5, fifth, 0.4]]
        : [[0, root, 0.9], [1, root, 0.35], [1.5, fifth, 0.45]];
    for (const [beat, m, len] of pattern) {
      const t = barTime(s.bar, s.beat + beat) + (beat === 0 && s.beat === 0 && LOCKED_BARS.has(s.bar) ? 0 : (rng() - 0.5) * 0.006);
      bassNote(bus, t, len * BEAT, m, v * (beat === 0 ? 1 : 0.8) * (0.94 + 0.12 * rng()));
    }
  }
}

// Keherwa: 8 eighth-notes per bar.
const KEHERWA = ['Dha', 'Ge', 'Na', 'Tin', 'Na', 'Ka', 'Dhi', 'Na'];
const KEHERWA_ACCENT = [1.0, 0.62, 0.78, 0.70, 0.88, 0.60, 0.92, 0.74];
const FILL_END = [['Na', 0.70], ['Ta', 0.76], ['Ta', 0.86], ['Na', 1.0]];        // beat 4 in sixteenths
function arrangeDholak(bus) {
  const rng = makeRng(12), mono = new Float64Array(N);
  const hit = (t, stroke, vel, bassScale) => dholakStroke(mono, rng, t, stroke, clamp(vel * (0.92 + 0.16 * rng()), 0, 1.3), bassScale);
  PLAN.forEach((p, bar) => {
    const withDhol = level(p.dhol) > 0.7 ? 0.55 : 1;
    if (p.fill === 'pickup') FILL_END.forEach(([s, v], k) => hit(barTime(bar, 3 + k * 0.25), s, 0.45 + 0.4 * v * (k + 1) / 4, 1));
    if (bar === HARMONY.length - 1) { hit(barTime(bar), 'Dha', 1.15, 1); return; }
    if (p.dholak === 'roll') {   // the curtains: groove, then a crescendo roll into the climax
      for (let e = 0; e < 4; e++) hit(barTime(bar, e * 0.5) + human(rng, bar, e), KEHERWA[e], 0.85 * KEHERWA_ACCENT[e], 1);
      for (let k = 0; k < 4; k++) hit(barTime(bar, 2 + k * 0.25), k % 2 ? 'Ta' : 'Na', 0.55 + 0.06 * k, 1);
      for (let k = 0; k < 8; k++) hit(barTime(bar, 3 + k * 0.125), k % 2 ? 'Ta' : 'Na', 0.72 + 0.04 * k, 1);
      hit(barTime(bar, 3.5), 'Ge', 0.8, 1);
      return;
    }
    const v = level(p.dholak);
    if (!v) return;
    for (let e = 0; e < 8; e++) {
      if (p.fill === 'end' && e >= 6) continue;
      hit(barTime(bar, e * 0.5) + human(rng, bar, e), KEHERWA[e], v * KEHERWA_ACCENT[e], withDhol);
      if (v >= 0.8 && (e === 3 || e === 7) && rng() < 0.5) hit(barTime(bar, e * 0.5 + 0.25), 'Ka', v * 0.38, 1);   // ghost notes
    }
    if (p.fill === 'end') FILL_END.forEach(([s, fv], k) => hit(barTime(bar, 3 + k * 0.25) + (rng() - 0.5) * 0.004, s, v * fv, 1));
  });
  monoToBus(mono, bus, DHOLAK.pan, DHOLAK.glue);
}

const DHOL_CHAAL = ['dagga', 'tilli', 'tilli', 'dagga', 'dagga', 'tilli', 'dagga', 'tilli'];
const DHOL_ACCENT = [1.0, 0.55, 0.70, 0.80, 0.90, 0.60, 0.85, 0.65];
function arrangeDhol(bus) {
  const rng = makeRng(13), mono = new Float64Array(N);
  const hit = (t, stroke, vel) => dholStroke(mono, rng, t, stroke, clamp(vel * (0.92 + 0.16 * rng()), 0, 1.3));
  PLAN.forEach((p, bar) => {
    if (bar === HARMONY.length - 1) { hit(barTime(bar), 'dagga', 1.2); hit(barTime(bar), 'tilli', 0.9); return; }
    if (p.dhol === 'roll') {
      [2, 2.5, 3, 3.5].forEach((b, k) => hit(barTime(bar, b), 'dagga', 0.55 + 0.12 * k));
      for (let k = 0; k < 4; k++) hit(barTime(bar, 3 + k * 0.25), 'tilli', 0.5 + 0.1 * k);
      return;
    }
    const v = level(p.dhol);
    if (!v) return;
    const first = bar === 10 || bar === 17;
    for (let e = 0; e < 8; e++) {
      const stroke = DHOL_CHAAL[e];
      if (v < 0.7 && !(e === 0 || e === 4)) continue;          // a lighter dhol: downbeats only
      hit(barTime(bar, e * 0.5) + human(rng, bar, e, 0.006), stroke, v * DHOL_ACCENT[e] * (first && e === 0 ? 1.2 : 1));
    }
    if (v >= 0.7) hit(barTime(bar, 1.75), 'tilli', v * 0.35);   // ghost before the "and"
  });
  monoToBus(mono, bus, DHOL.pan, DHOL.glue);
}

function arrangeClaps(bus) {
  const rng = makeRng(14);
  PLAN.forEach((p, bar) => {
    const v = level(p.claps);
    if (!v) return;
    for (const beat of [1, 3]) {
      const t = barTime(bar, beat);
      clapHit(bus, rng, t + (rng() - 0.5) * 0.004, v * (0.9 + 0.2 * rng()), -0.3);   // two people clapping
      clapHit(bus, rng, t + 0.007 + (rng() - 0.5) * 0.004, v * (0.75 + 0.2 * rng()), 0.3);
    }
    if (p.fill === 'end') clapHit(bus, rng, barTime(bar, 3.5), v * 0.7, 0);
  });
}

function arrangeJingles(bus) {
  const rng = makeRng(15);
  PLAN.forEach((p, bar) => {
    const v = level(p.jingles);
    if (!v) return;
    for (let e = 0; e < 8; e++) jingleHit(bus, rng, barTime(bar, e * 0.5) + (rng() - 0.5) * 0.01, v * (e % 2 ? 1 : 0.5) * (0.85 + 0.3 * rng()), e % 2 ? 0.4 : -0.4);
  });
}

function arrangeCymbal(bus) {
  const rng = makeRng(16);
  for (const c of CYMBALS) cymbalHit(bus, rng, c.at, c.kind, c.level, c.len);
}

const PENTATONIC = [2, 4, 6, 9, 11];   // D E F# A B as pitch classes
function arrangeSwarmandal(bus) {
  const rng = makeRng(4);
  for (const g of GLISSANDI) {
    const pitches = [];   // walk down the scale from the landing note
    for (let m = midiOf(g.land); pitches.length < g.notes; m--) if (PENTATONIC.includes(m % 12)) pitches.unshift(m);
    pitches.forEach((m, i) => {
      const x = g.notes > 1 ? i / (g.notes - 1) : 1;
      const t = g.at - g.length * (1 - x ** 0.8);   // slightly accelerating; the last note sits exactly on the cue
      swarmandalNote(bus, rng, t, m, g.level * (0.42 + 0.58 * x) * 2 ** ((74 - m) / 12 * 0.2), -0.7 + 1.4 * x);
    });
  }
}

function arrangeChimes(bus) {
  const rng = makeRng(5);
  for (const c of CHIMES) {
    noteList(c.notes).forEach((m, i, all) => {
      const x = all.length > 1 ? i / (all.length - 1) : 0.75;
      chimeNote(bus, rng, c.at + i * (c.gap ?? 0), m, c.level * (i === 0 ? 1 : 0.88 - 0.12 * x), -0.45 + 0.9 * x);
    });
  }
}

function arrangeDrone(bus) {
  const rng = makeRng(6);
  const cycle = noteList(TANPURA.cycle), gain = gainCurve(DRONE_LEVEL);
  const audible = (t) => [0, 1.5, 3, 4.5].some((dt) => curveAt(DRONE_LEVEL, t + dt) > -59);
  for (let beat = 0; beat * BEAT < TOTAL_SEC; beat++) {
    if (audible(beat * BEAT)) tanpuraPluck(bus, rng, beat * BEAT, cycle[beat % cycle.length], 1, beat % 2 ? 0.3 : -0.3);
  }
  for (let n = 0; n < N; n++) { bus.L[n] *= gain[n]; bus.R[n] *= gain[n]; }
}

// ════════════════════════════════════════════════════════════════════════════
//  5. REVERB · MASTER · OUTPUT
// ════════════════════════════════════════════════════════════════════════════
const isPrime = (n) => {
  if (n < 2 || n % 2 === 0) return n === 2;
  for (let d = 3; d * d <= n; d += 2) if (n % d === 0) return false;
  return true;
};
const nextPrime = (x) => { let n = Math.round(x); while (!isPrime(n)) n++; return n; };
const hadamardSign = (row, col) => { let x = row & col, s = 1; while (x) { s = -s; x &= x - 1; } return s; };

const REVERB_TRIM = 2.0;   // output calibration of the network below (REVERB.level is the user-facing trim)

/**
 * Stereo hall: input high-pass → pre-delay → all-pass diffusion → 16-line feedback delay
 * network (Hadamard mixing, highs decaying faster than lows, four gently modulated lines
 * so the tail never rings metallic).
 */
function reverb(inL, inR) {
  const hp = biquad('highpass', REVERB.inputHighpassHz);
  const pre = Math.round(REVERB.preDelayMs * SR / 1000);
  const prepare = (input, diffusionMs) => {
    const x = filter(Float64Array.from(input), hp);
    x.copyWithin(pre, 0, N - pre);
    x.fill(0, 0, pre);
    for (const ms of diffusionMs) {   // Schroeder all-passes smear transients before the tank
      const d = nextPrime(ms * SR / 1000), buf = new Float64Array(d), g = 0.6;
      for (let n = 0, p = 0; n < N; n++) {
        const delayed = buf[p], w = x[n] + g * delayed;
        buf[p] = w;
        x[n] = delayed - g * w;
        if (++p === d) p = 0;
      }
    }
    return x;
  };
  const xL = prepare(inL, [4.7, 11.3, 17.9]), xR = prepare(inR, [5.3, 12.7, 19.3]);

  const LINES = 16;
  const lens = Array.from({ length: LINES }, (_, i) => nextPrime(SR * 0.026 * (0.110 / 0.026) ** (i / (LINES - 1))));
  const bufs = lens.map((n) => new Float64Array(n));
  const pos = new Int32Array(LINES);
  const gain = lens.map((n) => 10 ** (-3 * n / (REVERB.decaySec * SR)));               // 60 dB in decaySec
  const damp = gain.map((g) => 1 - 2 / (1 + g ** (1 - 1 / REVERB.hfDamping)));        // one-pole: shorter decay up high
  const tapL = lens.map((_, i) => hadamardSign(5, i)), tapR = lens.map((_, i) => hadamardSign(10, i));
  const inSign = lens.map((_, i) => hadamardSign(3, i));
  const modRate = lens.map((_, i) => (i % 4 === 1 ? TAU * (0.29 + 0.07 * i) / SR : 0)); // lines 1, 5, 9, 13 wander slowly
  const lp = new Float64Array(LINES), v = new Float64Array(LINES);
  const outL = new Float64Array(N), outR = new Float64Array(N);
  const inGain = 1 / Math.sqrt(LINES / 2), outGain = 0.25 * REVERB_TRIM;
  for (let n = 0; n < N; n++) {
    let oL = 0, oR = 0;
    for (let i = 0; i < LINES; i++) {
      const buf = bufs[i];
      let x;
      if (modRate[i]) {   // fractional read 2‥14 samples short of the full line
        const r = pos[i] + 8 + 6 * Math.sin(n * modRate[i] + i);
        let k = Math.floor(r);
        const fr = r - k;
        if (k >= lens[i]) k -= lens[i];
        const k2 = k + 1 === lens[i] ? 0 : k + 1;
        x = buf[k] + (buf[k2] - buf[k]) * fr;
      } else x = buf[pos[i]];
      lp[i] = x + damp[i] * (lp[i] - x);
      const s = gain[i] * lp[i];
      v[i] = s;
      oL += s * tapL[i];
      oR += s * tapR[i];
    }
    for (let h = 1; h < LINES; h <<= 1) {   // fast Walsh–Hadamard transform = orthogonal mixing of all lines
      for (let i = 0; i < LINES; i += h << 1) {
        for (let j = i; j < i + h; j++) { const a = v[j], b = v[j + h]; v[j] = a + b; v[j + h] = a - b; }
      }
    }
    const a = xL[n] * inGain, b = xR[n] * inGain;
    for (let i = 0; i < LINES; i++) {
      bufs[i][pos[i]] = v[i] * 0.25 + (i & 1 ? b : a) * inSign[i];
      if (++pos[i] === lens[i]) pos[i] = 0;
    }
    outL[n] = oL * outGain;
    outR[n] = oR * outGain;
  }
  const soften = biquad('lowpass', 7000);
  filter(outL, soften);
  filter(outR, soften);
  // sustained tonal music excites the two sides of the tank unevenly — level the returns
  let eL = 0, eR = 0;
  for (let n = 0; n < N; n++) { eL += outL[n] * outL[n]; eR += outR[n] * outR[n]; }
  const trim = eL > 0 && eR > 0 ? (eR / eL) ** 0.25 : 1;
  for (let n = 0; n < N; n++) { outL[n] *= trim; outR[n] /= trim; }
  return { L: outL, R: outR };
}

// ── Loudness metering (ITU-R BS.1770 / EBU R128) ────────────────────────────
function kWeighted(x) {
  const y = Float64Array.from(x);
  filter(y, { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 });
  return filter(y, { b0: 1, b1: -2, b2: 1, a1: -1.99004745483398, a2: 0.99007225036621 });
}
function measureLoudness(L, R) {
  const kl = kWeighted(L), kr = kWeighted(R);
  const cum = new Float64Array(N + 1);
  for (let n = 0; n < N; n++) cum[n + 1] = cum[n] + kl[n] * kl[n] + kr[n] * kr[n];
  const power = (a, b) => (cum[b] - cum[a]) / (b - a);
  const lufs = (p) => -0.691 + 10 * Math.log10(Math.max(p, 1e-12));
  const mean = (arr) => arr.reduce((s, p) => s + p, 0) / Math.max(1, arr.length);
  const block = 0.4 * SR, hop = 0.1 * SR;
  const blocks = [];
  for (let a = 0; a + block <= N; a += hop) blocks.push(power(a, a + block));
  const loud = blocks.filter((p) => lufs(p) > -70);                       // absolute gate
  const gated = loud.filter((p) => lufs(p) > lufs(mean(loud)) - 10);      // relative gate
  const shortTerm = [];                                                   // 3 s window, value stamped at its end
  for (let a = 0; a + 3 * SR <= N; a += hop) shortTerm.push({ t: a / SR + 3, lufs: lufs(power(a, a + 3 * SR)) });
  return { integrated: lufs(mean(gated)), shortTerm };
}

// ── Look-ahead peak limiter (safety net; it only touches the tallest drum peaks) ──
function limiter(L, R, ceiling) {
  const look = Math.round(0.005 * SR);
  const need = new Float32Array(N).fill(1);   // gain required at n, already in place `look` samples early
  let active = false;
  for (let n = 0; n < N; n++) {
    const p = Math.max(Math.abs(L[n]), Math.abs(R[n]));
    if (p <= ceiling) continue;
    active = true;
    const g = ceiling / p;
    for (let j = Math.max(0, n - look); j <= n; j++) if (g < need[j]) need[j] = g;
  }
  if (!active) return { reduction: 0, at: 0, samples: 0 };
  const release = 1 - Math.exp(-1 / (0.12 * SR));
  const held = new Float32Array(N);
  for (let n = 0, g = 1; n < N; n++) {
    g += (1 - g) * release;
    if (need[n] < g) g = need[n];
    held[n] = g;
  }
  let sum = 0, minGain = 1, at = 0, samples = 0;   // moving average over the look-ahead window → smooth, click-free gain moves
  for (let n = 0; n < N; n++) {
    sum += held[n];
    if (n >= look) sum -= held[n - look];
    const g = Math.min(1, sum / Math.min(n + 1, look));
    L[n] *= g;
    R[n] *= g;
    if (g < 0.999) samples++;
    if (g < minGain) { minGain = g; at = n / SR; }
  }
  return { reduction: -toDb(minGain), at, samples };
}

/** Inter-sample ("true") peak in dBFS, estimated with 4× band-limited interpolation. */
function truePeakDb(L, R) {
  const HALF = 12, phases = [];
  for (let p = 1; p < 4; p++) {
    const h = new Float64Array(2 * HALF);
    for (let k = 0; k < 2 * HALF; k++) {
      const x = k - HALF + 1 - p / 4;
      h[k] = Math.sin(Math.PI * x) / (Math.PI * x) * (0.5 + 0.5 * Math.cos(Math.PI * x / HALF));
    }
    phases.push(h);
  }
  let peak = 0;
  for (const x of [L, R]) {
    let top = 0;
    for (let n = 0; n < N; n++) top = Math.max(top, Math.abs(x[n]));
    peak = Math.max(peak, top);
    for (let n = HALF; n < N - HALF; n++) {
      if (Math.abs(x[n]) < 0.5 * top && Math.abs(x[n + 1]) < 0.5 * top) continue;
      for (const h of phases) {
        let s = 0;
        for (let k = 0; k < 2 * HALF; k++) s += h[k] * x[n - HALF + 1 + k];
        if (Math.abs(s) > peak) peak = Math.abs(s);
      }
    }
  }
  return toDb(peak);
}

/** High-pass, fades, then loudness-normalise into the limiter until the target is met. */
function master(L, R) {
  const hp = biquad('highpass', MASTER.highpassHz);
  filter(L, hp);
  filter(R, hp);
  if (MASTER.presenceDb) { const hs = shelf('high', MASTER.presenceHz, MASTER.presenceDb); filter(L, hs); filter(R, hs); }
  if (MASTER.bassTrimDb) { const ls = shelf('low', MASTER.bassTrimHz, MASTER.bassTrimDb); filter(L, ls); filter(R, ls); }
  if (MASTER.ride) { const ride = gainCurve(MASTER.ride); for (let n = 0; n < N; n++) { L[n] *= ride[n]; R[n] *= ride[n]; } }
  const fadeInN = MASTER.fadeInSec * SR, outA = MASTER.fadeOutStart * SR, outB = Math.round(MASTER.silenceFrom * SR);
  for (let n = 0; n < N; n++) {
    let g = n < fadeInN ? Math.sin(0.5 * Math.PI * n / fadeInN) : 1;
    if (n >= outB) g = 0;
    else if (n > outA) g *= Math.cos(0.5 * Math.PI * (n - outA) / (outB - outA)) ** 2;
    L[n] *= g;
    R[n] *= g;
  }
  const ceiling = dB(MASTER.ceilingDb);
  let gain = dB(MASTER.targetLufs - measureLoudness(L, R).integrated);
  let outL, outR, limited, loudness;
  for (let pass = 0; pass < 5; pass++) {
    outL = L.map((x) => x * gain);
    outR = R.map((x) => x * gain);
    limited = limiter(outL, outR, ceiling);
    loudness = measureLoudness(outL, outR);
    const error = MASTER.targetLufs - loudness.integrated;
    if (Math.abs(error) < 0.02) break;
    gain *= dB(error);
  }
  return { L: outL, R: outR, gain, limited, loudness };
}

// ── Files ───────────────────────────────────────────────────────────────────
/** 16-bit PCM (TPDF-dithered, exact zeros stay exact) or 32-bit float stereo WAV. */
function writeWav(file, L, R, float = false) {
  const bytes = float ? 4 : 2, dataBytes = N * 2 * bytes;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataBytes, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(float ? 3 : 1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2 * bytes, 28);
  buf.writeUInt16LE(2 * bytes, 32); buf.writeUInt16LE(8 * bytes, 34);
  buf.write('data', 36); buf.writeUInt32LE(dataBytes, 40);
  const rng = makeRng(99);
  let clipped = 0;
  const pcm = (x) => {
    if (x === 0) return 0;
    const q = Math.round(x * 32768 + rng() - rng());
    if (q > 32767 || q < -32768) clipped++;
    return clamp(q, -32768, 32767);
  };
  for (let n = 0, o = 44; n < N; n++, o += 2 * bytes) {
    if (float) { buf.writeFloatLE(L[n], o); buf.writeFloatLE(R[n], o + 4); }
    else { buf.writeInt16LE(pcm(L[n]), o); buf.writeInt16LE(pcm(R[n]), o + 2); }
  }
  writeFileSync(file, buf);
  return clipped;
}

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.error) throw new Error(`Could not run ffmpeg (is it on PATH?): ${r.error.message}`);
  if (r.status !== 0) throw new Error(`ffmpeg failed:\n${r.stderr}`);
  return r.stderr || '';
}
/** Independent measurement with ffmpeg: EBU R128 loudness, true peak, plain RMS and DC offset. */
function ffmpegMeasure(file) {
  const text = ffmpeg(['-i', file, '-af', 'astats=measure_perchannel=none,ebur128=peak=true', '-f', 'null', '-']);
  const summary = text.slice(text.lastIndexOf('Summary:'));
  const num = (re, from = summary) => { const m = re.exec(from); return m ? Number(m[1]) : NaN; };
  return {
    lufs: num(/I:\s+(-?[\d.]+) LUFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/), truePeak: num(/Peak:\s+(-?[\d.]+) dBFS/),
    rms: num(/RMS level dB: (-?[\d.]+)/, text), dc: num(/DC offset: (-?[\d.]+)/, text),
  };
}
/** WAV → MP3. LAME quietly scales its input at this bitrate (×0.97), so measure and undo that. */
function encodeMp3(wavStats) {
  const encode = (gainDb) => ffmpeg(['-y', '-loglevel', 'error', '-i', OUT_WAV, ...(gainDb ? ['-af', `volume=${gainDb.toFixed(3)}dB`] : []),
    '-codec:a', 'libmp3lame', '-b:a', MP3_BITRATE, '-ar', String(SR), '-ac', '2', OUT_MP3]);
  encode(0);
  let stats = ffmpegMeasure(OUT_MP3);
  const drift = wavStats.rms - stats.rms;
  if (Math.abs(drift) > 0.05 && Math.abs(drift) < 1) { encode(drift); stats = ffmpegMeasure(OUT_MP3); }
  return stats;
}


// ── Main ────────────────────────────────────────────────────────────────────
const rmsDb = (L, R, a, b) => {
  let s = 0;
  for (let n = a; n < b; n++) s += L[n] * L[n] + R[n] * R[n];
  return 10 * Math.log10(Math.max(s / (2 * (b - a)), 1e-14));
};
const cell = (x, w = 7) => (x < -99 ? '—' : x.toFixed(1)).padStart(w);

function main() {
  const started = Date.now();
  const step = (label, fn) => {
    const t = Date.now();
    const out = fn();
    console.log(`  ${label.padEnd(22)} ${((Date.now() - t) / 1000).toFixed(1)} s`);
    return out;
  };
  console.log(`Composing ${TOTAL_SEC.toFixed(3)} s · ${BPM} BPM · ${BEATS_PER_BAR}/4 · ${BARS} bars · seed ${SEED}`);

  // 1. play every instrument onto its own bus
  const buses = {};
  const players = {
    strings: arrangeStrings, flute: arrangeFlute, shehnai: arrangeShehnai, sitar: arrangeSitar, santoor: arrangeSantoor,
    bass: arrangeBass, dholak: arrangeDholak, dhol: arrangeDhol, claps: arrangeClaps, jingles: arrangeJingles,
    cymbal: arrangeCymbal, swarmandal: arrangeSwarmandal, chimes: arrangeChimes, drone: arrangeDrone,
  };
  for (const [name, play] of Object.entries(players)) step(name, () => play((buses[name] = newBus())));

  // 2. mix: faders + post-fader reverb sends
  const mixL = new Float64Array(N), mixR = new Float64Array(N);
  const sendL = new Float64Array(N), sendR = new Float64Array(N);
  for (const [name, bus] of Object.entries(buses)) {
    const g = dB(MIX[name].gain), s = MIX[name].send <= -59 ? 0 : dB(MIX[name].send);
    for (let n = 0; n < N; n++) {
      const l = (bus.L[n] *= g), r = (bus.R[n] *= g);
      mixL[n] += l; mixR[n] += r;
      sendL[n] += l * s; sendR[n] += r * s;
    }
  }
  const wet = step('reverb', () => reverb(sendL, sendR));
  const wetGain = dB(REVERB.level);
  for (let n = 0; n < N; n++) { wet.L[n] *= wetGain; wet.R[n] *= wetGain; mixL[n] += wet.L[n]; mixR[n] += wet.R[n]; }
  buses.reverb = wet;

  // 3. master
  const out = step('master', () => master(mixL, mixR));
  const peakDb = truePeakDb(out.L, out.R);

  // 4. files
  mkdirSync(OUT_DIR, { recursive: true });
  const clipped = writeWav(OUT_WAV, out.L, out.R);
  console.log(`\nWAV  ${path.relative(ROOT, OUT_WAV)}  ${(N / SR).toFixed(3)} s · ${SR} Hz · stereo · 16-bit`);
  console.log(`     integrated ${out.loudness.integrated.toFixed(2)} LUFS · true peak ≈ ${peakDb.toFixed(2)} dBTP · ` +
    `master gain ${toDb(out.gain).toFixed(2)} dB · limiter max ${out.limited.reduction.toFixed(2)} dB at ${out.limited.at.toFixed(2)} s (active ${(out.limited.samples / SR * 1000).toFixed(0)} ms in total) · clipped samples ${clipped}`);
  if (!hasFlag('no-mp3')) {
    const wavStats = ffmpegMeasure(OUT_WAV), mp3Stats = encodeMp3(wavStats);
    console.log(`MP3  ${path.relative(ROOT, OUT_MP3)}  ${MP3_BITRATE}`);
    for (const [label, m] of [['wav', wavStats], ['mp3', mp3Stats]]) {
      const ok = Math.abs(m.lufs - MASTER.targetLufs) <= 1 && m.truePeak <= -1.5;
      console.log(`     ffmpeg check ${label}: ${m.lufs} LUFS · LRA ${m.lra} LU · true peak ${m.truePeak} dBTP · DC ${m.dc} ${ok ? '✓' : '✗ OUT OF SPEC'}`);
      if (!ok) process.exitCode = 1;
    }
  }

  // 5. optional extras
  const stemDir = flagValue('stems');
  if (stemDir) {
    mkdirSync(stemDir, { recursive: true });
    for (const [name, bus] of Object.entries(buses)) {   // float stems at final (pre-limiter) level
      writeWav(path.join(stemDir, `${name}.wav`), bus.L.map((x) => x * out.gain), bus.R.map((x) => x * out.gain), true);
    }
    console.log(`Stems written to ${stemDir}`);
  }
  if (hasFlag('report')) report(buses, out);
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

/** --report: where the energy is, bar by bar (dBFS RMS at final level), plus the loudness arc. */
function report(buses, out) {
  const names = Object.keys(buses);
  const g = toDb(out.gain);
  console.log(`\nBar  time    chords      ${names.map((n) => n.slice(0, 6).padStart(6)).join(' ')}    MIX ST-LUFS`);
  for (let bar = 0; bar <= BARS; bar++) {
    const a = Math.round(barTime(bar) * SR), b = Math.min(N, Math.round(barTime(bar + 1) * SR));
    const st = out.loudness.shortTerm.find((s) => Math.abs(s.t - b / SR) < 0.05);
    const label = (HARMONY[bar] ?? [['tail']]).map((c) => c[0]).join('|');
    console.log(`${String(bar).padStart(3)} ${String(barTime(bar)).padStart(3)}–${String(+(b / SR).toFixed(1)).padEnd(4)} ` +
      `${label.padEnd(10)} ${names.map((n) => cell(rmsDb(buses[n].L, buses[n].R, a, b) + g, 6)).join(' ')} ` +
      `${cell(rmsDb(out.L, out.R, a, b), 6)} ${st ? cell(st.lufs, 7) : ''}`);
  }
  const sts = out.loudness.shortTerm, at = (t) => sts.find((s) => Math.abs(s.t - t) < 0.05)?.lufs ?? NaN;
  const peakIn = (a, b) => Math.max(...sts.filter((s) => s.t >= a && s.t <= b).map((s) => s.lufs));
  const meanIn = (a, b) => { const v = sts.filter((s) => s.t >= a && s.t <= b).map((s) => s.lufs); return v.reduce((x, y) => x + y, 0) / v.length; };
  console.log(`\nShort-term LUFS: chorus max (33–39 s) ${peakIn(33, 39).toFixed(1)} · card mean (43–51 s) ${meanIn(43, 51).toFixed(1)} · ` +
    `difference ${(peakIn(33, 39) - meanIn(43, 51)).toFixed(1)} LU · at 6 s ${at(6).toFixed(1)} · at 12 s ${at(12).toFixed(1)} · at 57 s ${at(57).toFixed(1)}`);
}

main();
