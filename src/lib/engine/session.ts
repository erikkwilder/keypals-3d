// One lesson run, with no DOM. The cursor waits on the right key: a wrong key is counted
// as a miss and the player tries again (the gentle "try again" approach).

export type Stroke = { t: number; i: number; expected: string; typed: string; ok: boolean };

export type PressResult = { ok: boolean; done: boolean; expected: string; index: number };

export class Session {
  readonly text: string;
  pos = 0;
  strokes: Stroke[] = [];
  startT: number | null = null;
  endT: number | null = null;
  streak = 0;
  maxStreak = 0;
  errors = 0;
  missedAt = new Set<number>();
  readonly timeLimitMs: number | null;

  constructor(text: string, opts: { timeLimitMs?: number } = {}) {
    this.text = text;
    this.timeLimitMs = opts.timeLimitMs ?? null;
  }

  get done(): boolean { return this.endT !== null; }
  get expected(): string { return this.text[this.pos] ?? ''; }
  get progress(): number { return this.text.length ? this.pos / this.text.length : 1; }

  press(key: string, t: number): PressResult {
    const expected = this.expected;
    if (this.done) return { ok: false, done: true, expected, index: this.pos };
    if (this.startT === null) this.startT = t;
    const ok = key === expected;
    this.strokes.push({ t, i: this.pos, expected, typed: key, ok });
    if (ok) {
      this.pos++;
      this.streak++;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;
      if (this.pos >= this.text.length) this.endT = t;
    } else {
      this.errors++;
      this.streak = 0;
      this.missedAt.add(this.pos);
    }
    return { ok, done: this.done, expected, index: this.pos };
  }

  /** For timed runs: stop when the clock runs out. Returns true if it just ended. */
  tick(t: number): boolean {
    if (this.done || this.startT === null || this.timeLimitMs === null) return false;
    if (t - this.startT >= this.timeLimitMs) { this.endT = this.startT + this.timeLimitMs; return true; }
    return false;
  }

  elapsed(t: number): number {
    if (this.startT === null) return 0;
    return (this.endT ?? t) - this.startT;
  }
}
