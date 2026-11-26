// Rule 46: every recorded line is checked for faults inside it (a dropout, a click, a hard splice), not only at
// its edges. These tests hold the scanner (scripts/voice/blips.mjs) that scripts/voice/check.mjs runs on every clip.
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, decode, envelope, findBlips } from '../../../scripts/voice/blips.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ffmpeg = existsSync('/opt/homebrew/bin/ffmpeg') || spawnSync('ffmpeg', ['-version']).status === 0;

/** 0.2 s of hush, then `ms` of a voiced sound (200 Hz and its harmonics, at about -12 dBFS), then 0.2 s of hush. */
function voice(ms = 800, f0 = 200) {
  const pad = Math.round(0.2 * SR), n = Math.round((ms * SR) / 1000);
  const x = new Float32Array(pad * 2 + n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 1; k <= 8; k++) v += (0.3 / k) * Math.sin(2 * Math.PI * f0 * k * t + k);
    const fade = Math.min(1, i / (0.02 * SR), (n - i) / (0.02 * SR));
    x[pad + i] = v * fade;
  }
  return { x, from: pad, to: pad + n };
}
const kinds = (x: Float32Array) => findBlips(x).faults.map((f: { kind: string }) => f.kind);
const warned = (x: Float32Array) => findBlips(x).warnings.map((w: { kind: string }) => w.kind);

describe('the scanner for faults inside a clip (rule 46)', () => {
  it('passes a clean voiced sound, with no warning', () => {
    expect(kinds(voice().x)).toEqual([]);
    expect(warned(voice().x)).toEqual([]);
  });

  it('passes a stop between words: the voice fades out, a hush, then a burst of noise and the voice again', () => {
    const { x, from } = voice();
    const a = from + Math.round(0.35 * SR);
    const fade = Math.round(0.02 * SR), hush = Math.round(0.05 * SR), burst = Math.round(0.03 * SR);
    for (let i = 0; i < fade; i++) x[a + i] *= 0.5 + 0.5 * Math.cos((Math.PI * i) / fade);
    let seed = 7;
    const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.2;
    for (let i = 0; i < hush; i++) x[a + fade + i] = 0;
    // a burst opens over a millisecond or two, and the voice after it comes up over 10 ms
    const open = Math.round(0.0015 * SR), up = Math.round(0.01 * SR), b = a + fade + hush + burst;
    for (let i = 0; i < burst; i++) x[a + fade + hush + i] = noise() * Math.min(1, i / open) * (1 - i / burst);
    for (let i = 0; i < up; i++) x[b + i] *= i / up;
    expect(kinds(x)).toEqual([]);
  });

  it('finds a dropout: 30 ms of the voice gone, with no fade', () => {
    const { x, from } = voice();
    const a = from + Math.round(0.4 * SR);
    x.fill(0, a, a + Math.round(0.03 * SR));
    const f = findBlips(x).faults;
    const d = f.find((g: { kind: string }) => g.kind === 'dropout');
    expect(d?.sure).toBe('high');
    expect(Math.abs((d?.t ?? 0) - (a / SR + 0.015))).toBeLessThan(0.03);
  });

  it('finds a click: one sample jumping out of the voice', () => {
    const { x, from } = voice();
    x[from + Math.round(0.3 * SR)] += 0.4;
    expect(kinds(x)).toContain('click');
  });

  it('finds a hard splice: the voice drops 22 dB in one step', () => {
    const { x, from, to } = voice();
    for (let i = from; i < to; i++) x[i] *= 1.6; // about -8 dBFS
    const g = 10 ** (-22 / 20);
    for (let i = from + Math.round(0.4 * SR); i < to; i++) x[i] *= g;
    expect(kinds(x)).toContain('splice');
  });

  it('warns of a word that starts in creak: its first 50 ms an octave under the voice', () => {
    const { x, from } = voice(900);
    const n = Math.round(0.05 * SR), blend = Math.round(0.01 * SR);
    for (let i = 0; i < n; i++) {
      const t = i / SR; // repeats every 10 ms (100 Hz), its power even through each period
      const v = 0.08 * Math.sin(2 * Math.PI * 100 * t) + 0.3 * Math.sin(2 * Math.PI * 300 * t + 1) + 0.1 * Math.sin(2 * Math.PI * 500 * t + 2);
      const w = Math.max(0, (i - (n - blend)) / blend); // into the voice over the last 10 ms, with no jump
      x[from + i] = v * Math.min(1, i / (0.005 * SR)) * (1 - w) + x[from + i] * w;
    }
    expect(kinds(x)).toEqual([]);
    expect(warned(x)).toEqual(['creaky start']);
  });

  it('warns of a stop let go on its own between two hushes ("touch-t-every")', () => {
    const { x, from } = voice(900);
    const a = from + Math.round(0.4 * SR);
    const fade = Math.round(0.02 * SR), hush = Math.round(0.02 * SR), burst = Math.round(0.01 * SR), up = Math.round(0.01 * SR);
    for (let i = 0; i < fade; i++) x[a + i] *= 0.5 + 0.5 * Math.cos((Math.PI * i) / fade);
    let seed = 11;
    const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.4;
    const b = a + fade + hush, c = b + burst + hush;
    x.fill(0, a + fade, c);
    for (let i = 0; i < burst; i++) x[b + i] = noise() * Math.min(1, i / (0.0015 * SR)) * (1 - i / burst);
    for (let i = 0; i < up; i++) x[c + i] *= i / up;
    expect(kinds(x)).toEqual([]);
    expect(warned(x)).toEqual(['lone burst']);
  });

  it('leaves the first and last 100 ms to the edge checks', () => {
    const { x } = voice(800);
    x[Math.round(0.05 * SR)] = 0.5;
    expect(kinds(x)).toEqual([]);
  });

  it.skipIf(!ffmpeg)('passes a real line with its stops, and finds 25 ms cut out of one of its vowels', () => {
    const path = join(ROOT, 'public', 'voice', 'ep.count.how.mp3');
    if (!existsSync(path)) return;
    const x = decode(path);
    expect(findBlips(x).faults).toEqual([]);
    // in the middle of its longest stretch of loud voice (-25 dBFS or more), whichever take the clip is
    const e = envelope(x);
    let best = [0, 0];
    for (let k = 100, s = -1; k < e.length - 100; k++) {
      if (e[k] < -25) { s = -1; continue; }
      if (s < 0) s = k;
      if (k - s > best[1] - best[0]) best = [s, k];
    }
    expect(best[1] - best[0]).toBeGreaterThan(60);
    const a = Math.round((((best[0] + best[1]) / 2 - 12) * SR) / 1000);
    x.fill(0, a, a + Math.round(0.025 * SR));
    expect(kinds(x)).toContain('dropout');
  });
});
