#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  compose-music.mjs — original soundtrack for the reception-invitation film
//
//  Everything you hear is synthesised here from scratch (pure JS DSP, no samples,
//  no npm dependencies, seeded → the output is bit-identical on every run).
//
//    node tools/compose-music.mjs                 → assets/music/reception-theme.wav + .mp3
//    node tools/compose-music.mjs --report        → also print a per-bar level table
//    node tools/compose-music.mjs --stems=<dir>   → also write one WAV per instrument
//    node tools/compose-music.mjs --no-mp3        → skip the ffmpeg step
//
//  Layout of this file
//    1. EDITABLE SECTION  tempo · harmony · melodies · cue sheet · mix   ← tweak here
//    2. DSP helpers
//    3. Instruments       piano · strings · bansuri · swarmandal · chimes · tanpura · garden
//    4. Arrangement       turns section 1 into notes
//    5. Reverb, master bus, loudness normalisation, WAV/MP3 output
//
//  Common tweaks (all in section 1 unless noted)
//    a cue moved in the edit ........ GLISSANDI / CHIMES   (`at`, in seconds)
//    different notes ................ SCORE (chords, arpeggios, pad) · PIANO_MELODY · FLUTE_PHRASES
//    bigger / gentler climax ........ STRINGS_SWELL around 30–39 s, `vel` of bars 10–12
//    louder / quieter calm section .. `vel` of bars 13–16, STRINGS_SWELL at 40–48 s
//    one instrument up or down ...... MIX (dB)        wetter / drier ........ REVERB.level, MIX sends
//    overall loudness ............... MASTER.targetLufs (the limiter keeps the peaks in check)
//    phone-speaker tone / dynamics .. MASTER.presenceDb · bassTrimDb · ride
//    length ......................... BARS · TAIL_SEC, then MASTER.fadeOutStart / silenceFrom and the
//                                     last break-points of the curves (STRINGS_*, DRONE_LEVEL, MASTER.ride)
//    instrument tone ................ the PIANO / STRINGS / FLUTE / … blocks in section 3
//  Run with --report after a change to see the level of every instrument bar by bar.
// ════════════════════════════════════════════════════════════════════════════
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ════════════════════════════════════════════════════════════════════════════
//  1. EDITABLE SECTION
// ════════════════════════════════════════════════════════════════════════════
const SEED = 20261012;        // change for a different (still deterministic) "performance"

// ── Grid ────────────────────────────────────────────────────────────────────
// 60 BPM in 3/4: 1 beat = 1.000 s, 1 bar = 3.000 s, bar k starts at t = 3k s.
// The picture is cut to this grid, so only change it together with the edit.
// The whole film has to fit one 60-second Instagram / WhatsApp story: 59.500 s in total.
const BPM = 60;
const BEATS_PER_BAR = 3;
const BARS = 19;              // full bars 0‥18 (0–57 s); the last SCORE row is the final chord, struck at 57.0
const TAIL_SEC = 2.5;         // …which rings out for this long → 59.500 s in total (2,856,000 frames)

// ── Harmony: one row per bar ────────────────────────────────────────────────
//  arp      six eighth-notes for the piano left hand ("-" = rest). The first one is
//           the bass note on the downbeat. "D4:0.5" = let that note ring 0.5 beat only
//           (used for the sus4 that has to get out of the way of the 3rd).
//  bass     optional extra low octave struck with the downbeat
//  vel      piano touch for the accompaniment, 0‥1 (≈0.3 pp · 0.45 p · 0.55 mp · 0.65 mf · 0.8 f).
//           It sets tone (soft = darker) more than level; the big dynamic arc comes from the
//           strings, the flute and how many voices play.
//  pad      string-section voicing for the bar; padBeat3 = voicing that takes over on
//           beat 3 (sus4 → 3 resolutions). Notes shared by neighbouring bars are tied.
const SCORE = [
  /*  0 prelude 0–3   */ { chord: 'D drone', pad: 'D3 A3 D4' },
  /*  1         3–6   */ { chord: 'Dadd9',  vel: 0.35, arp: 'D3 A3 E4 F#4 A4 F#4',  pad: 'D3 A3 E4 F#4' },
  /*  2         6–9   */ { chord: 'Bm7',    vel: 0.36, arp: 'B2 F#3 D4 F#4 A4 F#4', pad: 'B2 A3 D4 F#4' },
  /*  3         9–12  */ { chord: 'Gmaj7',  vel: 0.36, arp: 'G2 D3 B3 D4 F#4 D4',   pad: 'G2 B3 D4 F#4' },
  /*  4        12–15  */ { chord: 'Asus4→A', vel: 0.37, arp: 'A2 E3 A3 D4:0.5 C#4 E4', pad: 'A2 A3 D4 E4', padBeat3: 'A2 A3 C#4 E4' },
  /*  5        15–18  */ { chord: 'D/F#',   vel: 0.36, arp: 'F#2 D3 A3 D4 F#4 D4',  pad: 'F#2 A3 D4 F#4' },
  /*  6        18–21  */ { chord: 'Gadd9',  vel: 0.37, arp: 'G2 D3 A3 B3 D4 B3',    pad: 'G2 A3 B3 D4' },
  /*  7        21–24  */ { chord: 'Bm',     vel: 0.41, arp: 'B2 F#3 B3 D4 F#4 D4',  pad: 'B2 F#3 B3 D4 F#4' },
  /*  8        24–27  */ { chord: 'G',      vel: 0.49, arp: 'G2 D3 B3 D4 G4 D4',    pad: 'G2 G3 B3 D4 G4' },
  /*  9        27–30  */ { chord: 'Asus4→A', vel: 0.60, arp: 'A2 E3 A3 D4:0.5 C#4 E4', pad: 'A2 E3 A3 D4 E4 A4', padBeat3: 'A2 E3 A3 C#4 E4 A4' },
  /* 10 CLIMAX 30–33  */ { chord: 'D',      vel: 0.56, bass: 'D2',  arp: 'D3 A3 D4 F#4 D4 A3',   pad: 'D2 D3 A3 D4 F#4 A4 D5 F#5' },
  /* 11        33–36  */ { chord: 'A/C#',   vel: 0.56, bass: 'C#2', arp: 'C#3 A3 C#4 E4 C#4 A3', pad: 'C#3 A3 C#4 E4 A4 C#5 E5' },
  /* 12        36–39  */ { chord: 'Bm7',    vel: 0.55, bass: 'B1',  arp: 'B2 F#3 A3 D4 F#4 D4',  pad: 'B2 F#3 A3 D4 F#4 A4 D5' },
  /* 13 CALM   39–42  */ { chord: 'G',      vel: 0.60, arp: 'G2 D3 B3 D4 G4 -',     pad: 'G3 B3 D4' },
  /* 14        42–45  */ { chord: 'D/F#',   vel: 0.60, arp: 'F#2 D3 A3 D4 F#4 -',   pad: 'F#3 A3 D4' },
  /* 15        45–48  */ { chord: 'Em7',    vel: 0.60, arp: 'E2 B2 G3 B3 D4 -',     pad: 'E3 G3 B3 D4' },
  /* 16        48–51  */ { chord: 'Asus4→A7', vel: 0.60, arp: 'A2 E3 A3 D4:0.5 C#4 G4', pad: 'E3 A3 D4 E4', padBeat3: 'E3 G3 C#4 E4' },
  /* 17 THEME  51–54  */ { chord: 'D',      vel: 0.54, bass: 'D2', arp: 'D3 A3 D4 F#4 A4 F#4', pad: 'D3 A3 D4 F#4 A4' },
  /* 18        54–57  */ { chord: 'G/D',    vel: 0.53, bass: 'D2', arp: 'D3 G3 B3 D4 G4 D4',   pad: 'D3 G3 B3 D4 G4' },
  /* 19 FINAL  57–59.5 */ { chord: 'Dadd9', vel: 0.48, roll: 'D2 A2 D3 A3 E4 F#4 A4 D5',       pad: 'D3 A3 E4 F#4 A4' },
];

// ── Melodies ────────────────────────────────────────────────────────────────
//  "F#5 A5:2 r B5" → notes are 1 beat long unless ":beats" is given, "r" = rest,
//  "|" is only a visual bar line. `bar`/`beat` say where the line starts (beat 0 = downbeat).
//  Almost everything is D-major pentatonic (D E F# A B = raga Bhoopali).
const PIANO_MELODY = [
  { bar: 3,  vel: 0.62, notes: 'F#5 A5 B5 | A5:2 F#5' },                                 // theme, first half (mp)
  { bar: 10, vel: 0.76, octaveBelow: 0.80, notes: 'A5 B5 D6 | B5:2 A5 | F#5 A5 B5' },    // climax in octaves
  { bar: 14, beat: 1, vel: 0.55, notes: 'A5 F#5 | E5:3' },                               // small fragment (calm)
  { bar: 17, vel: 0.68, octaveBelow: 0.50, notes: 'F#5 A5 B5 | A5 F#5 E5' },             // warm restatement
];
// One entry = one breath. Notes inside a breath are slurred with a short meend (glide).
// vel → velEnd is a crescendo / diminuendo across the breath.
const FLUTE_PHRASES = [
  { bar: 5,  vel: 0.54, velEnd: 0.60, notes: 'E5 F#5 A5 | B5:2 A5:0.8' },
  { bar: 7,  vel: 0.58, velEnd: 0.58, notes: 'F#5:2 D5 | D5:2 B4:0.8' },
  { bar: 9,  vel: 0.66, velEnd: 0.98, notes: 'E5:2 F#5 | A5 B5 D6 | B5:2 A5:0.8' },      // climb + lift variation
  { bar: 12, vel: 0.92, velEnd: 0.50, notes: 'F#5 A5 B5 | A5:2.6' },                     // …settling into the calm
  { bar: 15, beat: 1, vel: 0.50, velEnd: 0.54, notes: 'E5 F#5 | A5:2.2' },               // calm fragment, answering the piano's E5
  { bar: 17, vel: 0.72, velEnd: 0.56, notes: 'F#5 A5 B5 | A5 F#5 E5 | D5:2.5' },         // restatement + cadence (D5 held into the fade)
];

// ── Cue sheet (seconds, locked to picture) ──────────────────────────────────
// Swarmandal up-glissandi: the LAST note lands exactly on `at`.
const GLISSANDI = [
  { at: 3.0,  length: 0.80, land: 'D6', notes: 12, level: 0.50 },
  { at: 15.0, length: 0.65, land: 'A5', notes: 10, level: 0.55 },
  { at: 30.0, length: 0.80, land: 'D6', notes: 16, level: 0.85 },   // the big one — curtains open
  { at: 39.0, length: 0.60, land: 'B5', notes: 9,  level: 0.42 },
  { at: 51.0, length: 0.70, land: 'D6', notes: 12, level: 0.66 },   // into the restatement
];
// Chime sparkles: the FIRST note starts exactly on `at`, the rest follow `gap` s apart.
const CHIMES = [
  { at: 4.5,  notes: 'E6',              level: 0.40 },              // soft single
  { at: 11.0, notes: 'B5 D6 F#6 B6',    level: 0.80, gap: 0.090 },  // groom's name
  { at: 17.0, notes: 'A5 D6 F#6 A6 D7', level: 0.80, gap: 0.085 },  // bride's name
  { at: 32.0, notes: 'D6 F#6 A6 D7 F#7', level: 1.30, gap: 0.090 }, // couple's names
  { at: 55.0, notes: 'D6 G6 B6 D7',     level: 1.00, gap: 0.095 },  // "Kenvi & Puru" signature
  { at: 57.0, notes: 'D7',              level: 0.45 },              // soft single on the last chord
];

// ── Dynamics over time: [seconds, dB] break-points, linear in between ───────
// String-section swell (0 dB = full strings). It keeps rising for ~1.6 s AFTER the downbeat
// at 30.0, so the climax blooms instead of banging.
const STRINGS_SWELL = [
  [0, -9], [3, -10.5], [9, -10.5], [12, -9.2], [15, -9], [21, -8.8], [24, -7.5], [27, -6.3], [29, -5.5], [30, -4],
  [31.6, -0.5], [36, -0.8], [38.4, -2.5], [40.5, -3.8], [48, -3.8], [51, -5], [54, -4.5], [57, -6.5], [59.5, -9.5],
];
// How open the string tone is: 0 = dark and veiled, 1 = full section. [seconds, 0‥1]
const STRINGS_BRIGHTNESS = [
  [0, 0.20], [9, 0.25], [15, 0.32], [21, 0.40], [27, 0.62], [30, 0.80], [31.6, 1.0], [36, 0.95],
  [39, 0.60], [41, 0.28], [48, 0.30], [51, 0.55], [57, 0.50], [59.5, 0.38],
];
// Tanpura-like drone on D/A: prelude colour, gone by bar 5, a hint again under the ending (≈49–59 s).
// (In these two curves −60 dB means "off".)
const DRONE_LEVEL = [[0, 2], [3, 0], [6, -1], [10, -6], [15, -60], [49, -60], [52, -7], [58, -7], [59.5, -14]];
// Evening-garden bed (breeze + sparse crickets): in over the first second, gone by ~10.5 s.
// Its absolute level is GARDEN.level in section 3 — it sits ≥ 25 dB under the music.
const GARDEN_LEVEL = [[0, -60], [0.8, 0], [8.6, 0], [10.4, -60]];

// ── Mix: fader (dB, 0 = as balanced) and reverb send (dB) per instrument ────
// Whatever you change here, the master stage re-normalises the result to MASTER.targetLufs.
const MIX = {
  piano:      { gain: 0.0,   send: -9.5 },
  strings:    { gain: 0.0,   send: -7.0 },
  flute:      { gain: 0.0,   send: -6.0 },
  swarmandal: { gain: 0.0,   send: -5.0 },
  chimes:     { gain: 0.0,   send: -5.0 },
  drone:      { gain: 0.0,   send: -9.0 },
  garden:     { gain: 0.0,   send: -60 },
};
const REVERB = {
  decaySec: 2.6,              // 60 dB decay of the lows/low-mids (≈2.1 s at 1 kHz, ≈1 s at 4 kHz)
  hfDamping: 0.16,            // decay at the very top relative to the bottom — smaller = darker tail
  preDelayMs: 22,
  inputHighpassHz: 150,       // keeps bass notes out of the hall (no mud)
  level: 0.0,                 // return level in dB
};

// ── Master ──────────────────────────────────────────────────────────────────
const MASTER = {
  targetLufs: -16.0,          // integrated loudness (ITU-R BS.1770)
  ceilingDb: -2.0,            // limiter ceiling (sample peak) → true peak stays under −1.5 dBTP, MP3 included
  fadeInSec: 1.5,
  fadeOutStart: 58.0,         // final fade begins (1 s after the last chord is struck at 57.0)
  silenceFrom: 59.2,          // digital silence from here to the end at 59.5
  highpassHz: 28,
  // Tone control for small (phone) speakers: lift the presence/air region a little and ease the deep bass.
  // Set both to 0 for the original, darker balance.
  presenceDb: 5.0, presenceHz: 2300,
  bassTrimDb: -2.5, bassTrimHz: 110,
  // Level ride [seconds, dB]: lifts the hushed opening and the calm card section so they are still heard on a
  // phone, while the reveal at 30 s stays the loudest moment. Use [[0, 0], [59.5, 0]] for the full dynamic range
  // (without the ride the calm section, 39–51 s, sits about 5–6 LU under the climax).
  ride: [[0, 5.5], [8, 5], [15, 3.5], [21, 2.5], [27, 1], [30, 0], [38.4, 0], [41, 2.2], [49, 2.2], [51.5, 0.6], [56, 1], [59.5, 1.5]],
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
 * the piano and the chimes.
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

// ── Felt piano ──────────────────────────────────────────────────────────────
// Additive: stretched (slightly inharmonic) partials, two strings per note a hair apart
// in pitch (slow beating + the piano's two-stage decay), highs dying first.
const PIANO = {
  level: 0.19,
  velCurve: 0.75,                       // loudness ∝ vel^velCurve
  tilt: 1.15,                           // partial k starts at k^−tilt …
  brightBaseHz: 520, brightVelHz: 2100, // … and is rolled off 12 dB/oct above base + vel·… Hz (soft felt tone)
  maxPartials: 22, maxFreq: 8000,
  decayBase: 0.45, decayPerHz: 1 / 640, // decay rate (1/s) of a partial at f Hz = base + f·perHz
  attackMs: 6, attackSoftMs: 10,        // softer notes speak more slowly
  releaseSec: 0.22,                     // damper
  detuneCents: 0.9,
  width: 0.14,                          // stereo distance between the two strings
};
const scratchA = new Float64Array(SR * 16);
const scratchB = new Float64Array(SR * 16);

function pianoNote(bus, rng, tOn, midi, vel, tOff) {
  const i0 = Math.round(tOn * SR);
  if (i0 < 0 || i0 >= N) return;
  const f0 = hz(midi);
  const inharm = Math.max(8e-5, 3.5e-4 * 2 ** ((midi - 60) * 1.1 / 12));
  const bright = PIANO.brightBaseHz + PIANO.brightVelHz * vel;
  const hold = Math.max(0.05, tOff - tOn);
  const len = Math.min(N - i0, scratchA.length, Math.ceil((hold + 8 * PIANO.releaseSec) * SR));
  scratchA.fill(0, 0, len);
  scratchB.fill(0, 0, len);
  const cents = PIANO.detuneCents * (0.6 + 0.8 * rng());
  const detA = 2 ** (-cents / 1200), detB = 2 ** (cents / 1200);
  const amp = PIANO.level * vel ** PIANO.velCurve * 2 ** ((60 - midi) / 12 * 0.10);
  for (let k = 1; k <= PIANO.maxPartials; k++) {
    const fk = k * f0 * Math.sqrt((1 + inharm * k * k) / (1 + inharm));
    if (fk > PIANO.maxFreq) break;
    const a = amp * k ** -PIANO.tilt / (1 + (fk / bright) ** 2) * (0.8 + 0.4 * rng());
    const rate = PIANO.decayBase + fk * PIANO.decayPerHz;
    const ph = k === 1 ? 0 : (rng() - 0.5) * 1.6;
    addDampedSine(scratchA, 0, len, fk * detA, a * 0.62, rate * 1.45, ph);                     // prompt sound
    addDampedSine(scratchB, 0, len, fk * detB, a * 0.38, rate * 0.72, ph + (rng() - 0.5) * 0.8); // after-sound
  }
  const attN = Math.max(8, Math.round((PIANO.attackMs + PIANO.attackSoftMs * (1 - vel)) * SR / 1000));
  const iOff = Math.round(hold * SR);
  const relK = Math.exp(-1 / (PIANO.releaseSec * SR));
  const pan = clamp((midi - 58) / 90, -0.22, 0.25);   // bass a little left, treble a little right (player's view)
  const [aL, aR] = panGains(pan - PIANO.width), [bL, bR] = panGains(pan + PIANO.width);
  let rel = 1;
  for (let i = 0; i < len; i++) {
    let e = i < attN ? 0.5 - 0.5 * Math.cos(Math.PI * i / attN) : 1;
    if (i > iOff) { rel *= relK; e *= rel; }
    bus.L[i0 + i] += (scratchA[i] * aL + scratchB[i] * bL) * e;
    bus.R[i0 + i] += (scratchA[i] * aR + scratchB[i] * bR) * e;
  }
}

// ── String pad ──────────────────────────────────────────────────────────────
// Each note = a small section of detuned "players". Every player is a saw spectrum built
// additively into a wavetable with the low-pass already baked in (band-limited → no
// aliasing) and with its own random harmonic phases (no peaky, buzzy saw waveform). There
// is a dark and a bright table per player; STRINGS_BRIGHTNESS cross-fades between them.
const STRINGS = {
  level: 0.067,
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

// ── Bansuri-like flute ──────────────────────────────────────────────────────
// One continuous pitch curve per breath: notes are joined by short glides (meend),
// vibrato arrives late on each note, and a little band-passed breath rides on top.
const FLUTE = {
  level: 0.15,
  harmonics: [1, 0.26, 0.10, 0.04, 0.016],   // partials 1‥5 at full breath (fundamental-heavy)
  breathLevel: 0.09, chiffLevel: 0.22, breathHz: 2300,
  attackSec: 0.08, releaseSec: 0.22, leadSec: 0.03,
  glideSec: 0.11,                            // meend length for a whole-tone step (wider steps take longer)
  scoopSemitones: 0.5, scoopSec: 0.11,       // each breath slides up into its first note from just below
  vibratoHz: 5.0, vibratoCents: 13, vibratoDelaySec: 0.32, vibratoRampSec: 0.45,
  pan: 0,
};
const LN2_12 = Math.LN2 / 12;
const smoothstep = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

/** notes: [{ t, dur, midi }] back to back = one breath; vel0 → vel1 across it. */
function flutePhrase(bus, rng, notes, vel0, vel1) {
  const first = notes[0], last = notes[notes.length - 1];
  const tA = first.t - FLUTE.leadSec, tB = last.t + last.dur;
  const i0 = Math.max(0, Math.round(tA * SR));
  const len = Math.min(N - i0, Math.ceil((tB - tA + FLUTE.releaseSec + 0.05) * SR));
  if (len <= 0) return;
  const pitch = new Float32Array(len), env = new Float32Array(len);
  const vib = new Float32Array(len), chiff = new Float32Array(len);
  // how each note is reached: glide from the previous pitch, or a soft re-tongue if the pitch repeats
  const reach = notes.map((nt, j) => {
    if (j === 0) return null;
    const step = Math.abs(nt.midi - notes[j - 1].midi);
    if (step === 0) return { same: true, from: nt.t };
    const g = clamp(FLUTE.glideSec * (1 + 0.1 * (step - 2)), 0.08, 0.2);
    return { same: false, from: nt.t - 0.45 * g, len: g };
  });
  const DIP = 0.06;
  let j = 0;
  for (let i = 0; i < len; i++) {
    const t = (i0 + i) / SR;
    while (j + 1 < notes.length && t >= reach[j + 1].from) j++;
    const nt = notes[j], r = reach[j], next = reach[j + 1];
    let p = nt.midi, e = 1;
    if (j === 0) p -= FLUTE.scoopSemitones * (1 - smoothstep((t - tA) / FLUTE.scoopSec));
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
    const ta = (t - tA) / FLUTE.attackSec;
    if (ta < 1) e *= Math.sin(0.5 * Math.PI * Math.max(0, ta)) ** 2;
    const tr = (t - (tB - 0.04)) / FLUTE.releaseSec;
    if (tr > 0) e *= Math.cos(0.5 * Math.PI * Math.min(1, tr)) ** 2;
    const vel = vel0 + (vel1 - vel0) * clamp((t - first.t) / (tB - first.t), 0, 1);
    pitch[i] = p;
    env[i] = e * vel;
    vib[i] = clamp((tn - FLUTE.vibratoDelaySec) / FLUTE.vibratoRampSec, 0, 1) * (nt.dur >= 0.9 ? 1 : 0.4);
    chiff[i] = vel * Math.exp(-Math.max(0, t - tA) / 0.045) * Math.min(1, Math.max(0, ta) * 4);
  }
  const H = FLUTE.harmonics;
  const tone = new Float32Array(len), noise = new Float32Array(len);
  const kVib = 1 - Math.exp(-1 / (0.04 * SR)), kEnv = 1 - Math.exp(-1 / (0.004 * SR));
  const kDrift = 1 - Math.exp(-1 / (0.25 * SR)), kAmp = 1 - Math.exp(-1 / (0.08 * SR));
  const vibInc = TAU * FLUTE.vibratoHz * (0.96 + 0.08 * rng()) / SR;
  let ph = 0, vph = rng() * TAU, vv = 0, ee = 0, drift = 0, wobble = 0;
  for (let i = 0; i < len; i++) {
    vv += (vib[i] - vv) * kVib;
    ee += (env[i] - ee) * kEnv;
    drift += (rng() - 0.5 - drift) * kDrift;       // slow pitch wander, ≈ ±4 cents
    wobble += (rng() - 0.5 - wobble) * kAmp;       // breath-pressure flutter, ≈ ±4 %
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
  filter(noise, biquad('bandpass', FLUTE.breathHz, 0.7));   // airy band around breathHz …
  const air = biquad('lowpass', 2.2 * FLUTE.breathHz);      // … with nothing left above ~8 kHz
  filter(filter(noise, air), air);
  const [gL, gR] = panGains(FLUTE.pan);
  for (let i = 0; i < len; i++) {
    const s = (tone[i] + noise[i]) * FLUTE.level;
    bus.L[i0 + i] += s * gL;
    bus.R[i0 + i] += s * gR;
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
function ksString(out, len, f, rng) {
  const period = SR / f;
  const sProd = Math.min(0.25, SWARMANDAL.hfDecayRate / (f * (1 - Math.cos(TAU * SWARMANDAL.hfDecayHz / SR))));
  const S = 0.5 - Math.sqrt(0.25 - sProd);            // loss filter y = ρ·((1−S)·x[n] + S·x[n−1]), delay ≈ S
  const rho = 10 ** (-3 / (f * SWARMANDAL.ringSec));
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
    const a = Math.abs(Math.sin(Math.PI * k * SWARMANDAL.pickPos)) / k / Math.sqrt(1 + (k * f / SWARMANDAL.pickSoftHz) ** 2);
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

// ── Evening-garden bed ──────────────────────────────────────────────────────
// A dark, slowly breathing breeze (noise low-passed far below "hiss" territory) and two
// sparse crickets. Meant to be felt rather than heard.
const GARDEN = {
  level: 0.0027,                // RMS of the breeze
  breezeHz: 360,
  crickets: [{ hz: 4380, pan: -0.6 }, { hz: 4760, pan: 0.55 }],
  cricketLevel: 0.9,            // chirp peak relative to the breeze RMS
  cricketEverySec: 1.5,
};
function renderGarden(bus, rng) {
  const end = Math.min(N, Math.round((GARDEN_LEVEL[GARDEN_LEVEL.length - 1][0] + 0.1) * SR));
  for (const ch of ['L', 'R']) {
    const x = new Float64Array(end);
    for (let i = 0; i < end; i++) x[i] = rng() * 2 - 1;
    const lp = biquad('lowpass', GARDEN.breezeHz);
    filter(filter(filter(x, lp), lp), biquad('highpass', 110));
    let sum = 0;
    for (let i = 0; i < end; i++) sum += x[i] * x[i];
    const norm = GARDEN.level / Math.sqrt(sum / end);
    const p1 = rng() * TAU, p2 = rng() * TAU;
    for (let i = 0; i < end; i++) {
      const t = i / SR;   // slow gusts
      bus[ch][i] += x[i] * norm * (0.72 + 0.28 * Math.sin(TAU * 0.13 * t + p1)) * (0.85 + 0.15 * Math.sin(TAU * 0.37 * t + p2));
    }
  }
  for (const cricket of GARDEN.crickets) {
    const [gL, gR] = panGains(cricket.pan);
    for (let t = 0.5 + rng() * 1.2; t < end / SR; t += GARDEN.cricketEverySec * (0.7 + 0.6 * rng())) {
      const pulses = rng() < 0.35 ? 4 : 3, a = GARDEN.level * GARDEN.cricketLevel * (0.6 + 0.4 * rng());
      const pulseN = Math.round(0.015 * SR);
      for (let p = 0; p < pulses; p++) {
        const i0 = Math.round((t + p * 0.03) * SR);
        for (let i = 0; i < pulseN && i0 + i < end; i++) {
          const v = a * (0.5 - 0.5 * Math.cos(TAU * i / pulseN)) * Math.sin(TAU * cricket.hz * (1 + 0.004 * p) * i / SR);
          bus.L[i0 + i] += v * gL;
          bus.R[i0 + i] += v * gR;
        }
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  4. ARRANGEMENT — turns the tables of section 1 into notes
// ════════════════════════════════════════════════════════════════════════════
// The piano melody reads the same random "touch" stream as the accompaniment, but from this
// fixed position — so adding, removing or rewriting accompaniment bars never re-rolls the
// melody (this is what kept 0–39 s sample-identical when the calm section lost a bar).
const MELODY_TOUCH_OFFSET = 8044;

function arrangePiano(bus) {
  const rng = makeRng(1);
  const touch = (v, random = rng) => clamp(v * (0.94 + 0.12 * random()), 0.05, 1);   // ±6 % velocity humanisation
  const ARP_SHAPE = [0.95, 0.74, 0.80, 0.86, 0.92, 0.80];           // lean on the downbeat, rise towards beat 3
  SCORE.forEach((row, bar) => {
    const t0 = barTime(bar), pedalUp = t0 + BAR + 0.04;             // sustain pedal changes on every bar line
    if (row.arp) {
      for (const nt of parseArp(row.arp)) {
        const idx = Math.round(nt.beat * 2);
        // a few ms of human timing; where there is an extra bass note it leads the downbeat by a hair
        const t = t0 + nt.beat * BEAT + (idx === 0 ? (row.bass ? 0.010 : 0) : (rng() - 0.4) * 0.008);
        pianoNote(bus, rng, t, nt.midi, touch(row.vel * ARP_SHAPE[idx]), nt.ring ? t + nt.ring * BEAT : pedalUp);
      }
    }
    if (row.bass) pianoNote(bus, rng, t0, midiOf(row.bass), touch(row.vel * 0.9), pedalUp);
    if (row.roll) {   // final chord: gently rolled from the bass up, then left to ring
      noteList(row.roll).forEach((m, i) => pianoNote(bus, rng, t0 + i * 0.016, m, touch(row.vel * (i === 0 ? 1 : 0.86)), TOTAL_SEC + 1));
    }
  });
  const lead = makeRng(1);
  for (let i = 0; i < MELODY_TOUCH_OFFSET; i++) lead();
  for (const line of PIANO_MELODY) {
    for (const nt of parseMelody(line.notes)) {
      const beat = (line.beat ?? 0) + nt.beat;
      const t = barTime(line.bar, beat) + (lead() - 0.4) * 0.006;
      const pedalUp = barTime(line.bar + Math.floor(beat / BEATS_PER_BAR + 1e-9) + 1) + 0.04;
      pianoNote(bus, lead, t, nt.midi, touch(line.vel, lead), pedalUp);
      if (line.octaveBelow) pianoNote(bus, lead, t + 0.004, nt.midi - 12, touch(line.vel * line.octaveBelow, lead), pedalUp);
    }
  }
}

function arrangeStrings(bus) {
  const rng = makeRng(2);
  const segments = [];   // [start, end, [midi…], starts mid-bar?]
  SCORE.forEach((row, bar) => {
    if (!row.pad) return;
    const t0 = barTime(bar), t1 = barTime(bar + 1);
    if (row.padBeat3) {
      segments.push([t0, t0 + 2 * BEAT, noteList(row.pad), false], [t0 + 2 * BEAT, t1, noteList(row.padBeat3), true]);
    } else segments.push([t0, t1, noteList(row.pad), false]);
  });
  const sounding = new Map();   // midi → { start, quick }; notes shared by neighbouring chords are tied
  const notes = [];
  segments.forEach(([t0, , list, midBar], i) => {
    for (const [m, s] of sounding) if (!list.includes(m)) { notes.push([s.start, t0, m, s.quick, midBar]); sounding.delete(m); }
    for (const m of list) if (!sounding.has(m)) sounding.set(m, { start: t0, quick: midBar });
    if (i === segments.length - 1) for (const [m, s] of sounding) notes.push([s.start, TOTAL_SEC + 2, m, s.quick, false]);
  });
  const weight = (m) => (m < 48 ? 0.9 : m > 74 ? 0.6 : m > 69 ? 0.8 : 1);   // keep basses and high violins polite
  for (const [start, end, m, quickIn, quickOut] of notes) stringNote(bus, rng, start, end, m, weight(m), quickIn, quickOut);
}

function arrangeFlute(bus) {
  const rng = makeRng(3);
  for (const phrase of FLUTE_PHRASES) {
    const t0 = barTime(phrase.bar, phrase.beat ?? 0);
    const notes = parseMelody(phrase.notes).map((nt) => ({ t: t0 + nt.beat * BEAT, dur: nt.beats * BEAT, midi: nt.midi }));
    const tEnd = notes[notes.length - 1].t + notes[notes.length - 1].dur;
    const velAt = (t) => phrase.vel + ((phrase.velEnd ?? phrase.vel) - phrase.vel) * (t - t0) / (tEnd - t0);
    let breath = [];
    const play = () => {
      if (!breath.length) return;
      const last = breath[breath.length - 1];
      flutePhrase(bus, rng, breath, velAt(breath[0].t), velAt(last.t + last.dur));
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
  const cycle = noteList(TANPURA.cycle), level = gainCurve(DRONE_LEVEL);
  const audible = (t) => [0, 1.5, 3, 4.5].some((dt) => curveAt(DRONE_LEVEL, t + dt) > -59);
  for (let beat = 0; beat * BEAT < TOTAL_SEC; beat++) {
    if (audible(beat * BEAT)) tanpuraPluck(bus, rng, beat * BEAT, cycle[beat % cycle.length], 1, beat % 2 ? 0.3 : -0.3);
  }
  for (let n = 0; n < N; n++) { bus.L[n] *= level[n]; bus.R[n] *= level[n]; }
}

function arrangeGarden(bus) {
  renderGarden(bus, makeRng(7));
  const level = gainCurve(GARDEN_LEVEL);
  for (let n = 0; n < N; n++) { bus.L[n] *= level[n]; bus.R[n] *= level[n]; }
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

// ── Look-ahead peak limiter (safety net; it only touches the tallest piano peaks) ──
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
    piano: arrangePiano, strings: arrangeStrings, flute: arrangeFlute, swarmandal: arrangeSwarmandal,
    chimes: arrangeChimes, drone: arrangeDrone, garden: arrangeGarden,
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
  console.log(`\nBar  time    chord     ${names.map((n) => n.slice(0, 7).padStart(7)).join(' ')}     MIX  ST-LUFS`);
  for (let bar = 0; bar <= BARS; bar++) {
    const a = Math.round(barTime(bar) * SR), b = Math.min(N, Math.round(barTime(bar + 1) * SR));
    const st = out.loudness.shortTerm.find((s) => Math.abs(s.t - b / SR) < 0.05);
    console.log(`${String(bar).padStart(3)} ${String(barTime(bar)).padStart(3)}–${String(+(b / SR).toFixed(1)).padEnd(4)} ` +
      `${(SCORE[bar]?.chord ?? 'tail').padEnd(8)} ${names.map((n) => cell(rmsDb(buses[n].L, buses[n].R, a, b) + g)).join(' ')} ` +
      `${cell(rmsDb(out.L, out.R, a, b))} ${st ? cell(st.lufs, 8) : ''}`);
  }
  // how far the garden bed sits under everything else, second by second
  const music = { L: new Float64Array(N), R: new Float64Array(N) };
  for (const n of names) if (n !== 'garden') for (let i = 0; i < N; i++) { music.L[i] += buses[n].L[i]; music.R[i] += buses[n].R[i]; }
  const rows = [];
  for (let t = 0; t < 11; t++) {
    const a = t * SR, b = a + SR, gdn = rmsDb(buses.garden.L, buses.garden.R, a, b);
    if (gdn > -130) rows.push(`${t}s:${(rmsDb(music.L, music.R, a, b) - gdn).toFixed(1)}`);
  }
  console.log(`\nMusic above garden bed (dB, per second): ${rows.join('  ')}`);
  const sts = out.loudness.shortTerm, at = (t) => sts.find((s) => Math.abs(s.t - t) < 0.05)?.lufs ?? NaN;
  const peakIn = (a, b) => Math.max(...sts.filter((s) => s.t >= a && s.t <= b).map((s) => s.lufs));
  const meanIn = (a, b) => { const v = sts.filter((s) => s.t >= a && s.t <= b).map((s) => s.lufs); return v.reduce((x, y) => x + y, 0) / v.length; };
  console.log(`Short-term LUFS: climax max (33–39 s) ${peakIn(33, 39).toFixed(1)} · calm mean (43–51 s) ${meanIn(43, 51).toFixed(1)} · ` +
    `difference ${(peakIn(33, 39) - meanIn(43, 51)).toFixed(1)} LU · at 9 s ${at(9).toFixed(1)} · at 57 s ${at(57).toFixed(1)}`);
}

main();

