// Every times-table fact has its own memory, the way every key does in the typing game: how often it
// came up, how quickly it was answered, and where it is on the way to knowing it by heart.
//
//   not planted -> sprout (met it, with help) -> bud (right, not fast yet) -> bloom (fast on three
//   different days)
//
// A bloomed fact comes back for review after 1, 3, 7, 14 and 30 days. A slip costs one step, never
// everything. Partners help each other: progress on 6 × 2 starts 2 × 6 growing too.

/** `a × b`: b is the table it belongs to ("six twos" is 6 × 2 in the 2s). */
export type Fact = { a: number; b: number };

export const factId = (f: Fact) => `${f.a}x${f.b}`;
export const parseFact = (id: string): Fact => { const [a, b] = id.split('x').map(Number); return { a, b }; };
export const answerOf = (f: Fact) => f.a * f.b;
export const partnerOf = (f: Fact): Fact => ({ a: f.b, b: f.a });
export const sameFact = (x: Fact, y: Fact) => x.a === y.a && x.b === y.b;
/** The facts a rule covers: anything times 0 or times 1. */
export const isRuleFact = (f: Fact) => f.a <= 1 || f.b <= 1;

export type Stage = 0 | 1 | 2 | 3;
export const STAGE_NAME = ['Not planted', 'Sprout', 'Bud', 'Bloom'] as const;

/** How the latest answer went: the speed colour on the results and in the garden. */
export type Speed = 'fast' | 'slow' | 'miss';

export type FactStat = {
  stage: Stage;
  /** times asked, answered right first time, missed */
  seen: number; right: number; wrong: number;
  /** thinking time (fact shown to first digit) of the last ten right answers, in ms */
  times: number[];
  /** the days (yyyy-mm-dd) with a fast right answer since the last slip */
  fastDays: string[];
  /** when it was last asked */
  last: number;
  /** bloomed facts: when the next review is due, and which review interval it's on */
  due: number;
  step: number;
  latest?: Speed;
};

/** Days between reviews of a bloomed fact. */
export const REVIEW_DAYS = [1, 3, 7, 14, 30];
const DAY = 86_400_000;
/** Fast means starting to answer within this long (a grown-up can change it, 2 to 6 seconds). */
export const FAST_MS = 3000;
/** Bloom needs fast answers on this many different days. */
export const BLOOM_DAYS = 3;

export const newStat = (): FactStat => ({ stage: 0, seen: 0, right: 0, wrong: 0, times: [], fastDays: [], last: 0, due: 0, step: 0 });

export type Answer = {
  /** right first time (a retyped answer after a miss is not) */
  ok: boolean;
  /** thinking time in ms, for right answers */
  thinkMs: number;
  /** the day it happened (yyyy-mm-dd) and the time */
  day: string;
  at: number;
  fastMs?: number;
};

export const speedOf = (a: Pick<Answer, 'ok' | 'thinkMs' | 'fastMs'>): Speed => (!a.ok ? 'miss' : a.thinkMs <= (a.fastMs ?? FAST_MS) ? 'fast' : 'slow');

/** One answer's effect on a fact's memory. Pure: returns a new record. */
export function updateFact(prev: FactStat | undefined, ans: Answer): FactStat {
  const s: FactStat = prev ? { ...prev, times: [...prev.times], fastDays: [...prev.fastDays] } : newStat();
  const speed = speedOf(ans);
  s.seen++;
  s.last = ans.at;
  s.latest = speed;
  if (speed === 'miss') {
    s.wrong++;
    if (s.stage === 0) s.stage = 1; // met it, with help
    else if (s.stage === 3) { s.stage = 2; s.fastDays = s.fastDays.slice(-(BLOOM_DAYS - 1)); s.step = 0; s.due = 0; }
    else if (s.stage === 2) { s.stage = 1; s.fastDays = []; }
    return s;
  }
  s.right++;
  s.times.push(Math.round(ans.thinkMs));
  if (s.times.length > 10) s.times.splice(0, s.times.length - 10);
  if (speed === 'fast' && !s.fastDays.includes(ans.day)) s.fastDays.push(ans.day);
  if (s.fastDays.length > BLOOM_DAYS) s.fastDays.splice(0, s.fastDays.length - BLOOM_DAYS);
  if (s.stage === 3) {
    // a review: fast pushes the next one further out, slow brings it back tomorrow
    if (speed === 'fast') { if (ans.at >= s.due) s.step = Math.min(REVIEW_DAYS.length - 1, s.step + 1); s.due = ans.at + REVIEW_DAYS[s.step] * DAY; }
    else s.due = ans.at + DAY;
  } else if (s.fastDays.length >= BLOOM_DAYS) {
    s.stage = 3; s.step = 0; s.due = ans.at + REVIEW_DAYS[0] * DAY;
  } else s.stage = 2;
  return s;
}

/** Partner credit: a fact's progress plants its turnaround (6 × 2 helps 2 × 6) as far as a bud. */
export function seedPartner(facts: Record<string, FactStat>, f: Fact): void {
  if (f.a === f.b) return;
  const me = facts[factId(f)];
  if (!me) return;
  const pid = factId(partnerOf(f));
  const want = Math.min(me.stage, 2) as Stage;
  const p = facts[pid];
  if (!p) { if (want > 0) facts[pid] = { ...newStat(), stage: want }; return; }
  if (p.stage < want) facts[pid] = { ...p, stage: want };
}

export const isDue = (s: FactStat | undefined, now: number) => !!s && s.stage === 3 && s.due > 0 && s.due <= now;

/** The average thinking time of the recent right answers (ms), or null before any. */
export const avgThink = (s: FactStat | undefined) => (s && s.times.length ? s.times.reduce((a, b) => a + b, 0) / s.times.length : null);

/**
 * How much a known fact needs practice, 0 (solid) to 1 (shaky): its stage, how often it's missed and
 * how slowly it's answered.
 */
export function weakness(s: FactStat | undefined, fastMs = FAST_MS): number {
  if (!s || s.stage === 0) return 1;
  const stage = [1, 0.8, 0.55, 0.15][s.stage];
  const miss = s.seen ? s.wrong / s.seen : 0.5;
  const t = avgThink(s);
  const slow = t === null ? 0.5 : Math.max(0, Math.min(1, (t - fastMs * 0.5) / (fastMs * 1.5)));
  return Math.min(1, 0.55 * stage + 0.25 * miss + 0.2 * slow);
}

/** The speed colour a fact shows in the garden: its latest answer, or nothing before any. */
export const gardenColor = (s: FactStat | undefined): Speed | null => (s && s.seen ? (s.latest ?? null) : null);
