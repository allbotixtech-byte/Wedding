// Score reader: turns the composer's JSON notation into timed note events.
// Grid: one bar = 3.000 s = 4 beats of 0.75 s (12/8: beat = dotted quarter; 4/4: beat = quarter).
export const BAR_SEC = 3.0, BEAT_SEC = 0.75, END_SEC = 59.5;

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midiOf(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad pitch "${name}"`);
  return 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export function frac(s) {
  if (typeof s === 'number') return s;
  const t = String(s ?? '0').trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (m) return Number(m[1]) / Number(m[2]);
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);        // "1 1/2"
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  throw new Error(`bad duration/beat "${s}"`);
}
export const DYN = { ppp: 26, pp: 36, p: 50, mp: 64, mf: 80, f: 96, ff: 110, fff: 120 };

/** one line → [{ t, dur, midis:[…], vel, meend, kan, accent }] */
export function parseLine(line, part) {
  const t0 = BAR_SEC * Number(line.bar) + BEAT_SEC * frac(line.beat ?? 0);
  const baseVel = DYN[String(line.dyn ?? 'mf').toLowerCase()] ?? 80;
  const out = [];
  let t = t0;
  for (const raw of String(line.notes ?? '').trim().split(/\s+/)) {
    if (!raw || raw === '|') continue;
    let tok = raw, meend = false, kan = false, accent = false;
    while (/^[~^!]/.test(tok)) { if (tok[0] === '~') meend = true; if (tok[0] === '^') kan = true; if (tok[0] === '!') accent = true; tok = tok.slice(1); }
    const i = tok.lastIndexOf(':');
    if (i < 0) throw new Error(`${part} bar ${line.bar}: token "${raw}" has no duration`);
    const head = tok.slice(0, i), dur = frac(tok.slice(i + 1)) * BEAT_SEC;
    if (!(dur > 0)) throw new Error(`${part} bar ${line.bar}: token "${raw}" has a bad duration`);
    if (head !== 'r') {
      const midis = head.split('+').map(midiOf);
      out.push({ t, dur, midis, vel: Math.min(127, baseVel + (accent ? 12 : 0)), meend, kan, accent, style: line.style ?? '' });
    }
    t += dur;
  }
  return out;
}

export const RANGES = {
  bansuri: ['D4', 'D6'], violin: ['G3', 'E6'], strings: ['C2', 'C6'], piano: ['A0', 'C8'], santoor: ['D3', 'D6'],
  harp: ['C1', 'G7'], sitar: ['C3', 'C6'], bass: ['E1', 'G3'], bells: ['C4', 'C8'],
};
export const MONO = new Set(['bansuri', 'violin', 'sitar', 'bass']);

/** whole score → { notes: {part: [events]}, problems: [...] } */
export function readScore(score) {
  const problems = [], notes = {};
  for (const [part, lines] of Object.entries(score.parts ?? {})) {
    if (part === 'tabla' || part === 'hand_percussion') continue;
    const evs = [];
    (lines ?? []).forEach((line, li) => {
      try {
        const evs1 = parseLine(line, part);
        evs1.forEach((e, k) => { e.line = li; e.first = k === 0; e.last = k === evs1.length - 1; e.lineDyn = line.dyn ?? 'mf'; });
        evs.push(...evs1);
      } catch (e) { problems.push(e.message); }
    });
    evs.sort((a, b) => a.t - b.t);
    const r = RANGES[part];
    for (const e of evs) {
      if (e.t + e.dur > END_SEC + 1e-6) problems.push(`${part}: note at ${e.t.toFixed(2)} s runs past ${END_SEC} s`);
      if (r) for (const m of e.midis) if (m < midiOf(r[0]) || m > midiOf(r[1])) problems.push(`${part}: pitch ${m} at ${e.t.toFixed(2)} s outside ${r[0]}–${r[1]}`);
    }
    if (MONO.has(part)) for (let i = 1; i < evs.length; i++) {
      if (evs[i].t < evs[i - 1].t + evs[i - 1].dur - 1e-6) problems.push(`${part}: overlap at ${evs[i].t.toFixed(3)} s`);
      if (evs[i].midis.length > 1) problems.push(`${part}: chord in a monophonic part at ${evs[i].t.toFixed(2)} s`);
    }
    notes[part] = evs;
  }
  return { notes, problems };
}

/** harmony entries → [{ t0, t1, chord, bass, voicing:[midi] }] */
export function readHarmony(score) {
  const pitches = (txt) => (String(txt ?? '').match(/[A-G][#b]?-?\d(?!\d)/g) ?? []).map(midiOf);   // tolerant: ignores words, '+' and commas
  const h = (score.harmony ?? []).map((x) => ({ t0: BAR_SEC * Number(x.bar) + BEAT_SEC * frac(x.beat ?? 0), chord: x.chord, bass: pitches(x.bass)[0] ?? null, voicing: pitches(x.voicing) }));
  h.sort((a, b) => a.t0 - b.t0);
  h.forEach((x, i) => { x.t1 = i + 1 < h.length ? h[i + 1].t0 : END_SEC; });
  return h;
}

// ── Tabla ───────────────────────────────────────────────────────────────────
// strokes: Dha = Ge + Na, Dhin/Dhi = Ge + Tin, Ge (open bayan), Ke/Ka/Kat (closed bayan),
// Na/Ta (dayan rim), Tin/Tun (dayan open), Te/Ti/Tit/Tete (dayan closed), "-" = rest.
const DADRA = [['Dha', 1.0], ['Dhin', 0.62], ['Na', 0.72], ['Dha', 0.82], ['Tin', 0.6], ['Na', 0.7]];           // 6 eighths (= 2 beats in 12/8)
const DADRA_LIGHT = [['Dha', 0.9], ['-', 0], ['Na', 0.55], ['Ge', 0.6], ['Tin', 0.5], ['Na', 0.55]];
const KEHERWA = [['Dha', 1.0], ['Ge', 0.6], ['Na', 0.76], ['Te', 0.62], ['Na', 0.86], ['Ka', 0.55], ['Dhin', 0.9], ['Na', 0.72]]; // 8 eighths (= 4 beats in 4/4)
const KEHERWA_LIGHT = [['Dha', 0.85], ['-', 0], ['Na', 0.6], ['-', 0], ['Ge', 0.55], ['Na', 0.5], ['Dhin', 0.7], ['-', 0]];

/** one tabla entry → [{ t, stroke, vel(0..1) }] */
export function tablaStrokes(entry, meter) {
  const bar = Number(entry.bar), t0 = BAR_SEC * bar, lvl = Number(entry.level ?? 0.6);
  // optional "cresc": [from, to] scales the strokes across the bar (e.g. a tihai growing into sam)
  const [c0, c1] = Array.isArray(entry.cresc) ? entry.cresc.map(Number) : [1, 1];
  const out = [];
  const push = (t, stroke, v) => { const c = c0 + (c1 - c0) * Math.min(1, Math.max(0, (t - t0) / BAR_SEC)); if (stroke !== '-' && v > 0) out.push({ t, stroke, vel: v * lvl * c }); };
  if (entry.strokes && String(entry.strokes).trim()) {   // explicit strokes win
    let t = t0 + BEAT_SEC * frac(entry.beat ?? 0);
    for (const raw of String(entry.strokes).trim().split(/\s+/)) {
      if (raw === '|') continue;
      const accent = raw.startsWith('!'), tok = raw.replace(/^!/, '');
      const [s, d] = tok.split(':');
      push(t, s, accent ? 1 : 0.75);
      t += frac(d ?? (meter === '12/8' ? '1/3' : '1/2')) * BEAT_SEC;
    }
    return out;
  }
  const p = String(entry.pattern ?? 'none');
  const triple = meter === '12/8';
  const eighth = triple ? BEAT_SEC / 3 : BEAT_SEC / 2;
  const cycle = (pat, from = 0, to = 12) => { for (let i = from; i < (triple ? to : Math.min(to, 8)); i++) { const [s, v] = pat[i % pat.length]; push(t0 + i * eighth, s, v); } };
  if (p === 'dadra' || (p === 'theka' && triple)) cycle(triple ? DADRA : KEHERWA, 0, triple ? 12 : 8);
  else if (p === 'keherwa' || p === 'theka') cycle(KEHERWA, 0, 8);
  else if (p === 'light') cycle(triple ? DADRA_LIGHT : KEHERWA_LIGHT, 0, triple ? 12 : 8);
  else if (p === 'fill') {   // groove for three beats, then a rising fill on the last beat
    cycle(triple ? DADRA : KEHERWA, 0, triple ? 9 : 6);
    const n = triple ? 6 : 4, step = BEAT_SEC / n, fill = ['Te', 'Te', 'Ke', 'Te', 'Na', 'Ke'];
    for (let k = 0; k < n; k++) push(t0 + 3 * BEAT_SEC + k * step, fill[k % fill.length], 0.5 + 0.45 * (k + 1) / n);
  } else if (p === 'roll') {   // tirakita roll swelling across the bar into the next downbeat
    const n = 24, step = BAR_SEC / n, roll = ['Te', 'Re', 'Ki', 'Te'];
    for (let k = 0; k < n; k++) push(t0 + k * step, roll[k % 4], 0.35 + 0.6 * (k / (n - 1)) ** 1.5);
  } else if (p === 'tihai') {   // three times "Dha Te Te Dha -", landing on the next downbeat
    const unit = triple ? BEAT_SEC / 3 : BEAT_SEC / 4, phrase = [['Dha', 0.9], ['Te', 0.6], ['Te', 0.65], ['Dha', 0.95], ['-', 0]];
    const len = phrase.length * 3 - 1, start = t0 + BAR_SEC - (len - 1) * unit;   // the last Dha lands on the next downbeat (sam)
    for (let r = 0; r < 3; r++) phrase.forEach(([s, v], k) => { if (r === 2 && k === 4) return; push(start + (r * phrase.length + k) * unit, s, v * (0.85 + 0.08 * r)); });
  }
  return out;
}
