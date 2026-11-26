#!/usr/bin/env node
// Faults inside a recorded line (rule 46): a dropout, a click or a hard splice. The first and last 100 ms of a
// clip are left out: check.mjs and edges.py look at the edges.
//
//   node scripts/voice/blips.mjs                          every clip in public/voice
//   node scripts/voice/blips.mjs --match '^ep\.count\.'   the clips whose ids match
//   node scripts/voice/blips.mjs a.mp3 b.mp3              these files
//   --debug   also every quiet stretch let go, and why
//   --survey  for tuning: the largest click score and level step of every clip, ranked
//
// How it decides (dBFS on the clip's own scale: generate.mjs levels every clip to about -20 LUFS):
//   dropout  the level (RMS over 5 ms, in 1 ms steps) falls under -55 dBFS for 15 to 120 ms, 25 dB or more under
//            the voice on both sides, with voice of -35 dBFS or more on both sides within 150 ms, AND it falls 30 dB
//            in 6 ms or less and comes back 30 dB in 6 ms or less, with voice (a periodic sound) on both sides.
//            A word's own stop (p t k b d g) or a pause between words fades out over 10 ms or more, and a
//            voiceless stop comes back as a burst of noise, not as voice: neither is flagged. "high" when the
//            voice has the same pitch on both sides (within 4 semitones): a hole in one sound.
//   click    the second difference of the samples stands 30 times or more over its own RMS on the louder side
//            (the 5 ms before or the 5 ms after, the 1 ms at the peak left out), and the jump is over -40 dBFS.
//            A voice's pulses stand well under that. A stop let go into its word is not a click: out of a hush, it
//            reaches the word (-45 dBFS) within 25 ms with no hush (8 ms under -62 dBFS) on the way.
//   splice   while the voice goes on (both sides -30 dBFS or more), the level steps 18 dB or more within 5 ms:
//            one sound butted against another with no fade.
// Warnings (the model's own voice, not a broken file: counted and listed, never failed):
//   creaky start  a word that starts after a hush (8 ms or more under -45 dBFS) in creaky voice: in its first
//                 80 ms, 30 ms or more of loud voiced sound (-30 dBFS or more, few zero crossings) pitched 10
//                 semitones or more under the clip's own median (near an octave), or not periodic. A word that
//                 merely starts low in the tune is not creak. Erik heard a blip at "every
//                 cookie": "every" started with 30 to 70 ms of creak, an octave under the narrator's pitch.
//   lone burst    a sound whose loud part (within 12 dB of its peak) lasts under 20 ms, all of it under 30 ms,
//                 peaking at -45 dBFS or more, with 10 ms or more of near silence (under -55 dBFS) on both sides:
//                 a stop let go on its own between two hushes ("touch-t-every").
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SR = 44100;
const FFMPEG = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';

/** The thresholds (tuned on the 1411 clips of 2026-11-26: see scripts/voice/README.md). */
export const T = {
  edgeMs: 100,
  floorDb: -55, // near silence
  voiceDb: -35, // the voice goes on, within reachMs
  reachMs: 150,
  depthDb: 25,
  dropMinMs: 15,
  dropMaxMs: 120,
  abruptMs: 6, // a fall or a rise (30 dB) this quick has no fade
  periodic: 0.6, // normalised autocorrelation (70-700 Hz) that counts as voice
  sameSemis: 4,
  click: 30,
  clickDb: -40,
  stepDb: 18,
  stepMs: 5,
  stepFloorDb: -30, // a word starting from a hush (-38 dBFS to -20 in 5 ms, "It") is not a splice
};
/** The warnings' thresholds. */
export const WARN = { hushDb: -45, hushMs: 8, loudDb: -30, startMs: 80, creakMs: 30, lowSemis: 10, noisyZcr: 0.15, burstMaxMs: 20, coreDb: 12, islandMaxMs: 30, burstGapMs: 10, burstDb: -45 };

export function decode(path, sr = SR) {
  const b = spawnSync(FFMPEG, ['-v', 'error', '-i', path, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 }).stdout;
  return new Float32Array(Uint8Array.from(b).buffer, 0, b.length >> 2);
}

/** RMS level (dBFS) over winMs windows, one per millisecond (frame k is centred at k ms + 0.5). */
export function envelope(x, sr = SR, winMs = 5) {
  const c = new Float64Array(x.length + 1);
  for (let i = 0; i < x.length; i++) c[i + 1] = c[i] + x[i] * x[i];
  const n = Math.floor((x.length * 1000) / sr);
  const half = Math.round((winMs * sr) / 2000);
  const e = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const mid = Math.round(((k + 0.5) * sr) / 1000);
    const a = Math.max(0, mid - half);
    const b = Math.min(x.length, mid + half);
    e[k] = 10 * Math.log10((c[b] - c[a]) / Math.max(1, b - a) + 1e-12);
  }
  return e;
}

/** How periodic x[a, b) is (best normalised autocorrelation for fLo-fHi Hz) and at what pitch. */
export function periodicity(x, a, b, sr = SR, fLo = 70, fHi = 700) {
  a = Math.max(0, Math.round(a));
  b = Math.min(x.length, Math.round(b));
  const n = b - a;
  if (n < sr * 0.012) return { p: 0, f0: 0 };
  let mean = 0;
  for (let i = a; i < b; i++) mean += x[i];
  mean /= n;
  const s = new Float64Array(n);
  for (let i = 0; i < n; i++) s[i] = x[a + i] - mean;
  const lo = Math.max(2, Math.floor(sr / fHi));
  const hi = Math.min(Math.floor(sr / fLo), Math.floor((n * 2) / 3));
  const rs = new Float64Array(hi + 2);
  let best = 0;
  for (let k = lo; k <= hi; k++) {
    let xy = 0, xx = 0, yy = 0;
    for (let i = 0; i + k < n; i++) {
      const u = s[i], v = s[i + k];
      xy += u * v; xx += u * u; yy += v * v;
    }
    rs[k] = xy / Math.sqrt(xx * yy + 1e-20);
    best = Math.max(best, rs[k]);
  }
  // the shortest lag that peaks within 0.05 of the best, so a voice is not heard an octave under itself
  for (let k = lo; k <= hi; k++) if (rs[k] >= best - 0.05 && rs[k] >= rs[k - 1] && rs[k] >= rs[k + 1]) return { p: rs[k], f0: sr / k };
  return { p: 0, f0: 0 };
}

const semis = (f, g) => {
  const d = Math.abs(12 * Math.log2(f / g));
  return Math.min(d, Math.abs(d - 12), Math.abs(d - 24)); // an octave slip of the pitch tracker is the same pitch
};
const maxOf = (e, a, b) => { let m = -Infinity; for (let k = Math.max(0, a); k < Math.min(e.length, b); k++) m = Math.max(m, e[k]); return m; };
const minOf = (e, a, b) => { let m = Infinity; for (let k = Math.max(0, a); k < Math.min(e.length, b); k++) m = Math.min(m, e[k]); return m; };
const r3 = (v) => Math.round(v * 1000) / 1000;
const zcr = (x, a, b) => {
  let z = 0;
  for (let i = Math.max(1, a); i < Math.min(x.length, b); i++) if ((x[i] >= 0) !== (x[i - 1] >= 0)) z++;
  return z / Math.max(1, b - a);
};

/** The clip's own pitch: the median over up to 40 loud, clearly periodic moments (0 if it has none). */
function medianF0(x, e, sr) {
  const at = [];
  for (let k = T.edgeMs; k < e.length - T.edgeMs; k += 10) if (e[k] >= -25) at.push(k);
  const f = [];
  for (let i = 0; i < at.length; i += Math.max(1, Math.floor(at.length / 40))) {
    const r = periodicity(x, ((at[i] - 12) * sr) / 1000, ((at[i] + 13) * sr) / 1000, sr);
    if (r.p >= 0.75) f.push(r.f0);
  }
  f.sort((a, b) => a - b);
  return f.length >= 3 ? f[f.length >> 1] : 0;
}

/** The warnings: creaky word starts and lone bursts (see the top of the file). */
export function findWarnings(x, { sr = SR, e = envelope(x, sr) } = {}) {
  const out = [];
  const n = e.length, E0 = T.edgeMs, E1 = n - T.edgeMs;
  const smp = (ms) => Math.round((ms * sr) / 1000);
  const med = medianF0(x, e, sr);
  if (med) {
    for (let k = E0 + WARN.hushMs; k < E1 - WARN.startMs; k++) {
      if (e[k] < WARN.hushDb || e[k - 1] >= WARN.hushDb) continue;
      if (maxOf(e, k - WARN.hushMs, k) >= WARN.hushDb || maxOf(e, k, k + 15) < WARN.loudDb) continue;
      let creak = 0, low = Infinity;
      for (let j = k; j < k + WARN.startMs; j += 10) {
        const a = smp(j - 7), b = smp(j + 18);
        if (e[j + 5] < WARN.loudDb || zcr(x, a, b) > WARN.noisyZcr) continue; // quiet, or noise: a burst, a breath, a hiss
        const r = periodicity(x, a, b, sr, med / 2.6, med * 1.7);
        if (r.p < 0.45 || 12 * Math.log2(r.f0 / med) <= -WARN.lowSemis) { creak += 10; if (r.p >= 0.45) low = Math.min(low, r.f0); }
      }
      if (creak >= WARN.creakMs) {
        out.push({ t: r3((k + 0.5) / 1000), kind: 'creaky start', size: creak,
          why: `${creak} ms of creak in the first ${WARN.startMs} ms of a word (${low < Infinity ? `down to ${low.toFixed(0)} Hz` : 'not periodic'}; the clip's pitch ${med.toFixed(0)} Hz)` });
        k += WARN.startMs;
      }
    }
  }
  for (let k = E0; k < E1;) {
    if (e[k] < T.floorDb) { k++; continue; }
    const s = k;
    while (k < n && e[k] >= T.floorDb) k++;
    if (k - s >= WARN.islandMaxMs || k > E1) continue;
    const peak = maxOf(e, s, k);
    let core = 0;
    for (let j = s; j < k; j++) if (e[j] >= peak - WARN.coreDb) core++;
    if (core >= WARN.burstMaxMs) continue;
    let before = 0, after = 0;
    for (let j = s - 1; j >= 0 && e[j] < T.floorDb; j--) before++;
    for (let j = k; j < n && e[j] < T.floorDb; j++) after++;
    if (before >= WARN.burstGapMs && after >= WARN.burstGapMs && peak >= WARN.burstDb) {
      out.push({ t: r3((s + 0.5) / 1000), kind: 'lone burst', size: peak,
        why: `${k - s} ms of sound (${core} ms within 12 dB of its peak, ${peak.toFixed(0)} dBFS) alone between ${before} ms and ${after} ms of near silence` });
    }
  }
  return out.sort((f, g) => f.t - g.t);
}

/** Every fault inside the clip: { t (s), kind, sure: 'high'|'medium', why }. With debug, also the candidates let go. */
export function findBlips(x, { sr = SR, debug = false } = {}) {
  const faults = [];
  const let_go = [];
  const e = envelope(x, sr);
  const n = e.length;
  const E0 = T.edgeMs, E1 = n - T.edgeMs;
  const smp = (ms) => (ms * sr) / 1000;

  // dropouts
  for (let k = E0; k < E1;) {
    if (e[k] >= T.floorDb) { k++; continue; }
    const s = k;
    while (k < n && e[k] < T.floorDb) k++;
    const t = k;
    const len = t - s;
    if (len < T.dropMinMs || len > T.dropMaxMs || t > E1) continue;
    if (maxOf(e, s - T.reachMs, s) < T.voiceDb || maxOf(e, t, t + T.reachMs) < T.voiceDb) continue;
    const at = r3((s + 0.5) / 1000);
    const lowest = minOf(e, s, t);
    const Lin = maxOf(e, s - 25, s), Lout = maxOf(e, t, t + 25);
    if (Math.min(Lin, Lout) - lowest < T.depthDb) { if (debug) let_go.push({ t: at, len, why: 'shallow' }); continue; }
    // how long the level takes to fall from within 3 dB of the voice to 30 dB under it, and to come back: a hole
    // cut in a sound does it within the 5 ms the level is measured over; a word's own ending takes longer
    let a = s - 1;
    while (a > s - 40 && e[a] < Lin - 3) a--;
    let a2 = a;
    while (a2 < t && e[a2] > Lin - 30) a2++;
    let b = t;
    while (b < t + 40 && e[b] < Lout - 3) b++;
    let b2 = b;
    while (b2 > s && e[b2] > Lout - 30) b2--;
    const fall = a2 - a, rise = b - b2;
    const pin = periodicity(x, smp(a - 25), smp(a + 1), sr);
    const pout = periodicity(x, smp(b), smp(b + 25), sr);
    const desc = `${len} ms under ${T.floorDb} dBFS (lowest ${lowest.toFixed(0)}), voice ${Lin.toFixed(0)} / ${Lout.toFixed(0)} dBFS either side, falls in ${fall} ms, back in ${rise} ms, periodic ${pin.p.toFixed(2)}/${pout.p.toFixed(2)} at ${pin.f0.toFixed(0)}/${pout.f0.toFixed(0)} Hz`;
    if (fall > T.abruptMs || rise > T.abruptMs || pin.p < T.periodic || pout.p < T.periodic) {
      if (debug) let_go.push({ t: at, len, why: desc });
      continue;
    }
    const same = semis(pin.f0, pout.f0) <= T.sameSemis;
    faults.push({ t: at, kind: 'dropout', sure: same ? 'high' : 'medium', why: desc });
  }

  // clicks: a second difference far over its own level around it. Not a stop let go into its word: out of a hush
  // (the 2-8 ms before it under -55 dBFS), and into the word: -45 dBFS within 25 ms with no hush (8 ms under -62
  // dBFS) on the way. The k of "Thank you", a "the" said as a stop, are such; a tick in a pause is not.
  const isRelease = (e, k) => {
    if (maxOf(e, k - 8, k - 2) >= -55) return false;
    for (let j = k + 2, quiet = 0; j < Math.min(e.length, k + 26); j++) {
      if (e[j] >= -45) return true;
      quiet = e[j] < -62 ? quiet + 1 : 0;
      if (quiet >= 8) return false;
    }
    return false;
  };
  const N = x.length;
  const d2 = new Float64Array(N);
  for (let i = 1; i < N - 1; i++) d2[i] = x[i + 1] - 2 * x[i] + x[i - 1];
  const c = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) c[i + 1] = c[i] + d2[i] * d2[i];
  const W = Math.round(0.005 * sr), w = Math.round(0.0005 * sr);
  const minJump = 10 ** (T.clickDb / 20);
  let maxClick = { s: 0, t: 0 };
  let lastClick = -Infinity;
  for (let i = Math.round(smp(E0)); i < Math.round(smp(E1)); i++) {
    const v = Math.abs(d2[i]);
    if (v < minJump * 0.25) continue;
    // against the louder of the 5 ms before and the 5 ms after (the 0.5 ms at the jump left out): a stop's release
    // jumps out of its silence but goes on as noise or voice; a click stands out on both sides
    const before = (c[Math.max(0, i - w)] - c[Math.max(0, i - W)]) / W;
    const after = (c[Math.min(N, i + W + 1)] - c[Math.min(N, i + w + 1)]) / W;
    const score = v / Math.sqrt(Math.max(before, after, 1e-20) + 1e-14);
    if (score > maxClick.s && v >= minJump) maxClick = { s: score, t: i / sr };
    if (score >= T.click && v >= minJump && i - lastClick > 0.02 * sr && !isRelease(e, Math.floor((i * 1000) / sr))) {
      faults.push({ t: r3(i / sr), kind: 'click', sure: score >= 2 * T.click ? 'high' : 'medium', why: `a jump ${score.toFixed(0)} times its surroundings (${(20 * Math.log10(v)).toFixed(0)} dBFS)` });
      lastClick = i;
    }
  }

  // hard splices: the level steps while the voice goes on
  let maxStep = { d: 0, t: 0 };
  let lastStep = -Infinity;
  for (let k = E0; k + T.stepMs < E1; k++) {
    const p = e[k], q = e[k + T.stepMs];
    if (Math.min(p, q) < T.stepFloorDb) continue;
    const d = Math.abs(q - p);
    if (d > maxStep.d) maxStep = { d, t: (k + T.stepMs / 2) / 1000 };
    if (d >= T.stepDb && k - lastStep > 20) {
      faults.push({ t: r3((k + T.stepMs / 2) / 1000), kind: 'splice', sure: d >= T.stepDb + 6 ? 'high' : 'medium', why: `the level steps ${d.toFixed(0)} dB in ${T.stepMs} ms (${p.toFixed(0)} to ${q.toFixed(0)} dBFS) with the voice going on` });
      lastStep = k;
    }
  }
  faults.sort((f, g) => f.t - g.t);
  return { faults, warnings: findWarnings(x, { sr, e }), let_go, maxClick, maxStep };
}

// ------------------------------------------------------------------ command line
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const DEBUG = args.includes('--debug');
  const SURVEY = args.includes('--survey');
  const JSON_OUT = args.includes('--json');
  const mi = args.indexOf('--match');
  const MATCH = mi >= 0 ? new RegExp(args[mi + 1]) : null;
  const files = args.filter((a, i) => !a.startsWith('--') && !(mi >= 0 && i === mi + 1));
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const paths = files.length
    ? files
    : readdirSync(join(ROOT, 'public', 'voice')).filter((f) => f.endsWith('.mp3') && (!MATCH || MATCH.test(f.slice(0, -4)))).sort().map((f) => join(ROOT, 'public', 'voice', f));
  let bad = 0;
  const survey = [];
  for (const p of paths) {
    const id = basename(p).replace(/\.mp3$/, '');
    const r = findBlips(decode(p), { debug: DEBUG });
    survey.push({ id, click: r.maxClick, step: r.maxStep, faults: r.faults.length, warnings: r.warnings });
    if (r.faults.length) bad++;
    if (JSON_OUT) { console.log(JSON.stringify({ id, faults: r.faults, warnings: r.warnings })); continue; }
    for (const f of r.faults) console.log(`${id}  ${f.t.toFixed(3)} s  ${f.kind} (${f.sure}): ${f.why}`);
    if (!SURVEY) for (const w of r.warnings) console.log(`${id}  ${w.t.toFixed(3)} s  warning, ${w.kind}: ${w.why}`);
    if (DEBUG) for (const g of r.let_go) console.log(`  (let go) ${id}  ${g.t.toFixed(3)} s  ${g.len} ms: ${g.why}`);
  }
  if (SURVEY) {
    const pct = (a, q) => a[Math.min(a.length - 1, Math.floor(q * a.length))];
    const cs = survey.map((s) => s.click.s).sort((a, b) => a - b), ss = survey.map((s) => s.step.d).sort((a, b) => a - b);
    console.log(`click score per clip: median ${pct(cs, 0.5).toFixed(1)}, 90% ${pct(cs, 0.9).toFixed(1)}, 99% ${pct(cs, 0.99).toFixed(1)}, max ${cs[cs.length - 1].toFixed(1)}`);
    console.log(`level step per clip: median ${pct(ss, 0.5).toFixed(1)}, 90% ${pct(ss, 0.9).toFixed(1)}, 99% ${pct(ss, 0.99).toFixed(1)}, max ${ss[ss.length - 1].toFixed(1)}`);
    console.log('top clicks: ' + [...survey].sort((a, b) => b.click.s - a.click.s).slice(0, 12).map((s) => `${s.id}@${s.click.t.toFixed(3)}=${s.click.s.toFixed(0)}`).join(' '));
    console.log('top steps: ' + [...survey].sort((a, b) => b.step.d - a.step.d).slice(0, 12).map((s) => `${s.id}@${s.step.t.toFixed(3)}=${s.step.d.toFixed(0)}`).join(' '));
    for (const kind of ['creaky start', 'lone burst']) {
      const all = survey.flatMap((s) => s.warnings.filter((w) => w.kind === kind).map((w) => ({ id: s.id, ...w })));
      const clips = new Set(all.map((w) => w.id)).size;
      console.log(`warning ${kind}: ${clips} clips (${all.length} places); worst 20:`);
      for (const w of all.sort((a, b) => b.size - a.size).slice(0, 20)) console.log(`  ${w.id}  ${w.t.toFixed(3)} s  ${w.why}`);
    }
  }
  if (!JSON_OUT) console.log(`${paths.length} clips scanned for faults inside them: ${bad} with a fault`);
  if (bad) process.exitCode = 1;
}
