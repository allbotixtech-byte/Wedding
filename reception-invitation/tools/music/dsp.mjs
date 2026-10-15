// DSP toolkit for the mix: filters, a stereo hall reverb, loudness metering (BS.1770), a look-ahead limiter,
// true-peak estimate, WAV writing and ffmpeg helpers. Everything works on whole Float32/Float64 arrays.
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export const TAU = 2 * Math.PI;
export const dB = (d) => 10 ** (d / 20);
export const toDb = (x) => 20 * Math.log10(Math.max(x, 1e-12));
export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RBJ biquad coefficients (lowpass / highpass / bandpass / peak). */
export function biquad(type, freq, q = Math.SQRT1_2, sr = 48000, gainDb = 0) {
  const w = TAU * freq / sr, c = Math.cos(w), alpha = Math.sin(w) / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lowpass') { b1 = 1 - c; b0 = b2 = b1 / 2; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha; }
  else if (type === 'highpass') { b1 = -(1 + c); b0 = b2 = (1 + c) / 2; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha; }
  else if (type === 'bandpass') { b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha; }
  else if (type === 'peak') { const A = 10 ** (gainDb / 40); b0 = 1 + alpha * A; b1 = -2 * c; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * c; a2 = 1 - alpha / A; }
  else throw new Error(`unknown filter ${type}`);
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}
/** RBJ shelving filter: boosts/cuts above (high) or below (low) `freq` by gainDb. */
export function shelf(kind, freq, gainDb, sr = 48000) {
  const A = Math.pow(10, gainDb / 40), w = TAU * freq / sr, c = Math.cos(w), al = Math.sin(w) / 2 * Math.SQRT2, r = 2 * Math.sqrt(A) * al, s = kind === 'high' ? 1 : -1;
  const b0 = A * ((A + 1) + s * (A - 1) * c + r), b1 = -2 * s * A * ((A - 1) + s * (A + 1) * c), b2 = A * ((A + 1) + s * (A - 1) * c - r);
  const a0 = (A + 1) - s * (A - 1) * c + r, a1 = 2 * s * ((A - 1) - s * (A + 1) * c), a2 = (A + 1) - s * (A - 1) * c - r;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}
/** Run a biquad over x in place (transposed direct form II). */
export function filter(x, c) {
  let z1 = 0, z2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i], y = c.b0 * v + z1;
    z1 = c.b1 * v - c.a1 * y + z2;
    z2 = c.b2 * v - c.a2 * y;
    x[i] = y;
  }
  return x;
}

// ── Stereo hall: input high-pass → pre-delay → all-pass diffusion → 16-line FDN (Hadamard mixing,
//    highs decaying faster than lows, four slowly modulated lines so the tail never rings metallic).
const isPrime = (n) => { if (n < 2 || n % 2 === 0) return n === 2; for (let d = 3; d * d <= n; d += 2) if (n % d === 0) return false; return true; };
const nextPrime = (x) => { let n = Math.round(x); while (!isPrime(n)) n++; return n; };
const hadamardSign = (row, col) => { let x = row & col, s = 1; while (x) { s = -s; x &= x - 1; } return s; };
export function reverb(inL, inR, { decaySec = 2.2, hfDamping = 0.18, preDelayMs = 24, inputHighpassHz = 170, sr = 48000 } = {}) {
  const N = inL.length;
  const hp = biquad('highpass', inputHighpassHz, Math.SQRT1_2, sr);
  const pre = Math.round(preDelayMs * sr / 1000);
  const prepare = (input, diffusionMs) => {
    const x = filter(Float64Array.from(input), hp);
    x.copyWithin(pre, 0, N - pre);
    x.fill(0, 0, pre);
    for (const ms of diffusionMs) {
      const d = nextPrime(ms * sr / 1000), buf = new Float64Array(d), g = 0.6;
      for (let n = 0, p = 0; n < N; n++) { const delayed = buf[p], w = x[n] + g * delayed; buf[p] = w; x[n] = delayed - g * w; if (++p === d) p = 0; }
    }
    return x;
  };
  const xL = prepare(inL, [4.7, 11.3, 17.9]), xR = prepare(inR, [5.3, 12.7, 19.3]);
  const LINES = 16;
  const lens = Array.from({ length: LINES }, (_, i) => nextPrime(sr * 0.026 * (0.110 / 0.026) ** (i / (LINES - 1))));
  const bufs = lens.map((n) => new Float64Array(n)), pos = new Int32Array(LINES);
  const gain = lens.map((n) => 10 ** (-3 * n / (decaySec * sr)));
  const damp = gain.map((g) => 1 - 2 / (1 + g ** (1 - 1 / hfDamping)));
  const tapL = lens.map((_, i) => hadamardSign(5, i)), tapR = lens.map((_, i) => hadamardSign(10, i)), inSign = lens.map((_, i) => hadamardSign(3, i));
  const modRate = lens.map((_, i) => (i % 4 === 1 ? TAU * (0.29 + 0.07 * i) / sr : 0));
  const lp = new Float64Array(LINES), v = new Float64Array(LINES);
  const outL = new Float64Array(N), outR = new Float64Array(N);
  const inGain = 1 / Math.sqrt(LINES / 2), outGain = 0.5;
  for (let n = 0; n < N; n++) {
    let oL = 0, oR = 0;
    for (let i = 0; i < LINES; i++) {
      const buf = bufs[i];
      let x;
      if (modRate[i]) {
        const r = pos[i] + 8 + 6 * Math.sin(n * modRate[i] + i);
        let k = Math.floor(r); const fr = r - k;
        if (k >= lens[i]) k -= lens[i];
        const k2 = k + 1 === lens[i] ? 0 : k + 1;
        x = buf[k] + (buf[k2] - buf[k]) * fr;
      } else x = buf[pos[i]];
      lp[i] = x + damp[i] * (lp[i] - x);
      const s = gain[i] * lp[i];
      v[i] = s; oL += s * tapL[i]; oR += s * tapR[i];
    }
    for (let h = 1; h < LINES; h <<= 1) for (let i = 0; i < LINES; i += h << 1) for (let j = i; j < i + h; j++) { const a = v[j], b = v[j + h]; v[j] = a + b; v[j + h] = a - b; }
    const a = xL[n] * inGain, b = xR[n] * inGain;
    for (let i = 0; i < LINES; i++) { bufs[i][pos[i]] = v[i] * 0.25 + (i & 1 ? b : a) * inSign[i]; if (++pos[i] === lens[i]) pos[i] = 0; }
    outL[n] = oL * outGain; outR[n] = oR * outGain;
  }
  const soften = biquad('lowpass', 7500, Math.SQRT1_2, sr);
  filter(outL, soften); filter(outR, soften);
  let eL = 0, eR = 0;
  for (let n = 0; n < N; n++) { eL += outL[n] * outL[n]; eR += outR[n] * outR[n]; }
  const trim = eL > 0 && eR > 0 ? (eR / eL) ** 0.25 : 1;
  for (let n = 0; n < N; n++) { outL[n] *= trim; outR[n] /= trim; }
  return { L: outL, R: outR };
}

// ── Loudness (ITU-R BS.1770 / EBU R128), 48 kHz K-weighting ─────────────────
function kWeighted(x) {
  const y = Float64Array.from(x);
  filter(y, { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 });
  return filter(y, { b0: 1, b1: -2, b2: 1, a1: -1.99004745483398, a2: 0.99007225036621 });
}
export function measureLoudness(L, R, sr = 48000) {
  const N = L.length, kl = kWeighted(L), kr = kWeighted(R), cum = new Float64Array(N + 1);
  for (let n = 0; n < N; n++) cum[n + 1] = cum[n] + kl[n] * kl[n] + kr[n] * kr[n];
  const power = (a, b) => (cum[b] - cum[a]) / (b - a), lufs = (p) => -0.691 + 10 * Math.log10(Math.max(p, 1e-12));
  const mean = (arr) => arr.reduce((s, p) => s + p, 0) / Math.max(1, arr.length);
  const block = 0.4 * sr, hop = 0.1 * sr, blocks = [];
  for (let a = 0; a + block <= N; a += hop) blocks.push(power(a, a + block));
  const loud = blocks.filter((p) => lufs(p) > -70), gated = loud.filter((p) => lufs(p) > lufs(mean(loud)) - 10);
  const shortTerm = [];
  for (let a = 0; a + 3 * sr <= N; a += hop) shortTerm.push({ t: a / sr + 3, lufs: lufs(power(a, a + 3 * sr)) });
  return { integrated: lufs(mean(gated)), shortTerm };
}
/** Look-ahead peak limiter (5 ms), smooth release. Works in place. */
export function limiter(L, R, ceiling, sr = 48000) {
  const N = L.length, look = Math.round(0.005 * sr), need = new Float32Array(N).fill(1);
  let active = false;
  for (let n = 0; n < N; n++) {
    const p = Math.max(Math.abs(L[n]), Math.abs(R[n]));
    if (p <= ceiling) continue;
    active = true;
    const g = ceiling / p;
    for (let j = Math.max(0, n - look); j <= n; j++) if (g < need[j]) need[j] = g;
  }
  if (!active) return { reduction: 0, at: 0, samples: 0 };
  const release = 1 - Math.exp(-1 / (0.12 * sr)), held = new Float32Array(N);
  for (let n = 0, g = 1; n < N; n++) { g += (1 - g) * release; if (need[n] < g) g = need[n]; held[n] = g; }
  let sum = 0, minGain = 1, at = 0, samples = 0;
  for (let n = 0; n < N; n++) {
    sum += held[n]; if (n >= look) sum -= held[n - look];
    const g = Math.min(1, sum / Math.min(n + 1, look));
    L[n] *= g; R[n] *= g;
    if (g < 0.999) samples++;
    if (g < minGain) { minGain = g; at = n / sr; }
  }
  return { reduction: -toDb(minGain), at, samples };
}
/** Inter-sample peak in dBFS (4× band-limited interpolation). */
export function truePeakDb(L, R) {
  const N = L.length, HALF = 12, phases = [];
  for (let p = 1; p < 4; p++) {
    const h = new Float64Array(2 * HALF);
    for (let k = 0; k < 2 * HALF; k++) { const x = k - HALF + 1 - p / 4; h[k] = Math.sin(Math.PI * x) / (Math.PI * x) * (0.5 + 0.5 * Math.cos(Math.PI * x / HALF)); }
    phases.push(h);
  }
  let peak = 0;
  for (const x of [L, R]) {
    let top = 0;
    for (let n = 0; n < N; n++) top = Math.max(top, Math.abs(x[n]));
    peak = Math.max(peak, top);
    for (let n = HALF; n < N - HALF; n++) {
      if (Math.abs(x[n]) < 0.5 * top && Math.abs(x[n + 1]) < 0.5 * top) continue;
      for (const h of phases) { let s = 0; for (let k = 0; k < 2 * HALF; k++) s += h[k] * x[n - HALF + 1 + k]; if (Math.abs(s) > peak) peak = Math.abs(s); }
    }
  }
  return toDb(peak);
}
/** 16-bit PCM (TPDF dither; exact zeros stay zero) or 32-bit float stereo WAV. Returns clipped-sample count. */
export function writeWav(file, L, R, sr = 48000, float = false) {
  const N = L.length, bytes = float ? 4 : 2, dataBytes = N * 2 * bytes, buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataBytes, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(float ? 3 : 1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2 * bytes, 28); buf.writeUInt16LE(2 * bytes, 32); buf.writeUInt16LE(8 * bytes, 34);
  buf.write('data', 36); buf.writeUInt32LE(dataBytes, 40);
  const rng = makeRng(99);
  let clipped = 0;
  const pcm = (x) => { if (x === 0) return 0; const q = Math.round(x * 32768 + rng() - rng()); if (q > 32767 || q < -32768) clipped++; return clamp(q, -32768, 32767); };
  for (let n = 0, o = 44; n < N; n++, o += 2 * bytes) {
    if (float) { buf.writeFloatLE(L[n], o); buf.writeFloatLE(R[n], o + 4); }
    else { buf.writeInt16LE(pcm(L[n]), o); buf.writeInt16LE(pcm(R[n]), o + 2); }
  }
  writeFileSync(file, buf);
  return clipped;
}
export function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.error) throw new Error(`could not run ffmpeg (is it on PATH?): ${r.error.message}`);
  if (r.status !== 0) throw new Error(`ffmpeg failed:\n${r.stderr}`);
  return r.stderr || '';
}
/** EBU R128 loudness, true peak, RMS and DC offset measured by ffmpeg. */
export function ffmpegMeasure(file) {
  const text = ffmpeg(['-i', file, '-af', 'astats=measure_perchannel=none,ebur128=peak=true', '-f', 'null', '-']);
  const summary = text.slice(text.lastIndexOf('Summary:'));
  const num = (re, from = summary) => { const m = re.exec(from); return m ? Number(m[1]) : NaN; };
  return { lufs: num(/I:\s+(-?[\d.]+) LUFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/), truePeak: num(/Peak:\s+(-?[\d.]+) dBFS/), rms: num(/RMS level dB: (-?[\d.]+)/, text), dc: num(/DC offset: (-?[\d.]+)/, text) };
}
/** WAV → MP3 (libmp3lame). LAME scales its input slightly at this bitrate, so measure and undo that. */
export function encodeMp3(wavFile, mp3File, { bitrate = '192k', sr = 48000 } = {}) {
  const wav = ffmpegMeasure(wavFile);
  const encode = (gainDb) => ffmpeg(['-y', '-loglevel', 'error', '-i', wavFile, ...(gainDb ? ['-af', `volume=${gainDb.toFixed(3)}dB`] : []), '-codec:a', 'libmp3lame', '-b:a', bitrate, '-ar', String(sr), '-ac', '2', mp3File]);
  encode(0);
  let mp3 = ffmpegMeasure(mp3File);
  const drift = wav.rms - mp3.rms;
  if (Math.abs(drift) > 0.05 && Math.abs(drift) < 1) { encode(drift); mp3 = ffmpegMeasure(mp3File); }
  return { wav, mp3 };
}
/** Decode any audio file with ffmpeg to mono Float32 at `sr`. */
export function decodeMono(file, sr = 48000) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(sr), '-f', 'f32le', 'pipe:1'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg could not decode ${file}: ${r.stderr}`);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4).slice();
}
/** Decode any audio file with ffmpeg to stereo Float32 at `sr` (mono files are duplicated). */
export function decodeStereo(file, sr = 48000) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '2', '-ar', String(sr), '-f', 'f32le', 'pipe:1'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg could not decode ${file}: ${r.stderr}`);
  const x = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4), n = x.length / 2;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = x[2 * i]; R[i] = x[2 * i + 1]; }
  return { L, R };
}
/**
 * Stereo-linked feed-forward compressor (soft knee, peak detector), in place. The threshold sits `belowPeakDb`
 * under the signal's own peak, and the RMS is restored afterwards so the stem keeps its place in the balance
 * while its transients come down. Returns the deepest gain reduction in dB.
 */
export function compress(L, R, { belowPeakDb = 8, ratio = 3, attackMs = 4, releaseMs = 90, kneeDb = 6, sr = 48000 } = {}) {
  let peak = 0, e0 = 0;
  for (let i = 0; i < L.length; i++) { peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); e0 += L[i] * L[i] + R[i] * R[i]; }
  if (!peak || !e0) return 0;
  const thr = toDb(peak) - belowPeakDb, aA = Math.exp(-1 / (attackMs * sr / 1000)), aR = Math.exp(-1 / (releaseMs * sr / 1000));
  let env = 0, deepest = 0, e1 = 0;
  for (let i = 0; i < L.length; i++) {
    const over = toDb(Math.max(Math.abs(L[i]), Math.abs(R[i]))) - thr;
    const gr = 2 * over < -kneeDb ? 0 : 2 * Math.abs(over) <= kneeDb ? (1 / ratio - 1) * (over + kneeDb / 2) ** 2 / (2 * kneeDb) : (1 / ratio - 1) * over;
    env = gr < env ? aA * env + (1 - aA) * gr : aR * env + (1 - aR) * gr;
    const g = 10 ** (env / 20);
    L[i] *= g; R[i] *= g; e1 += L[i] * L[i] + R[i] * R[i];
    if (env < deepest) deepest = env;
  }
  const makeup = Math.sqrt(e0 / e1);
  for (let i = 0; i < L.length; i++) { L[i] *= makeup; R[i] *= makeup; }
  return deepest;
}
