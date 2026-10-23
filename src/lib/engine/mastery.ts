// How well each key is known. Feeds the adaptive text (weak keys come up more) and the
// hints that fade by themselves as keys are mastered.

import type { KeyRun } from './scoring';

export type KeyStat = { n: number; acc: number; ms: number };

export function updateKeyStats(stats: Record<string, KeyStat>, perKey: Record<string, KeyRun>): Record<string, KeyStat> {
  const out = { ...stats };
  for (const [ch, r] of Object.entries(perKey)) {
    const tries = r.hits + r.misses;
    if (!tries) continue;
    const runAcc = r.hits / tries;
    const runMs = r.timed ? Math.min(3000, r.ms / r.timed) : null;
    const prev = out[ch];
    if (!prev) {
      out[ch] = { n: tries, acc: runAcc, ms: runMs ?? 1200 };
    } else {
      const w = Math.min(0.5, Math.max(0.15, tries / 40));
      out[ch] = {
        n: prev.n + tries,
        acc: prev.acc * (1 - w) + runAcc * w,
        ms: runMs === null ? prev.ms : prev.ms * (1 - w) + runMs * w,
      };
    }
  }
  return out;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function mastery(k: KeyStat | undefined, grown: boolean): number {
  if (!k) return 0;
  const accScore = clamp01((k.acc - 0.8) / 0.17);
  const [good, poor] = grown ? [280, 950] : [420, 1400];
  const speedScore = clamp01((poor - k.ms) / (poor - good));
  const confidence = clamp01(k.n / 25);
  return (0.6 * accScore + 0.4 * speedScore) * confidence;
}

/** char -> weakness 0..1 for known characters the player has actually tried. */
export function weakMap(stats: Record<string, KeyStat>, known: Set<string>, grown: boolean): Map<string, number> {
  const m = new Map<string, number>();
  for (const ch of known) {
    if (ch === ' ') continue;
    const k = stats[ch];
    if (!k || k.n < 4) continue;
    m.set(ch, 1 - mastery(k, grown));
  }
  return m;
}
