// Number Builder: the place value arcade game. An order card shows a number (37, "two hundred and five",
// 300 + 40 + 5, or "10 more than 243" with 243 already on the mat), and you build it with base-ten blocks
// on a place value mat: hundreds flats, tens rods and ones cubes. Ten ones on the mat snap together into
// a rod (and ten rods into a flat), so trading is part of the play. A round is 100 seconds: right builds
// in a row make a combo, quick ones earn a bonus, a wrong build just shakes (try again, the combo ends).
// Three stars by score, a best score, and a daily challenge (the same day, the same orders).
//
// The orders come from the place value skills the player has met: two-digit numbers for everyone; three
// digits, number names, expanded form and "10 more" join once their lessons have been met. Each first try
// counts in skill memory for subs already met, and the round pays out like any practice; it doesn't open
// lessons. The same mat with no clock and no orders is the Playground's Block Table.
import { mulberry32, type Rng } from '../../engine/rng';
import { buddyPal, dayKey, type Profile } from '../../engine/profile';
import { settlePractice, type Settled } from '../../engine/settle';
import { mathOf, type ArcadeRecord } from '../progress';
import { noteSkillAnswers } from '../skills/progress';
import { words, commas } from '../skills/place';
import type { Blocks } from '../skills/types';

export type BuildKind = 'two' | 'three' | 'words' | 'expanded' | 'more';
export type BuildOrder = {
  kind: BuildKind;
  /** the number to build */
  target: number;
  /** what the card says (a number, words, an expanded sum, "10 more than 243") */
  card: string;
  /** small words over the card */
  ask: string;
  /** the mat starts with this already built (the "more" orders) */
  start: number;
  /** the skill memory key this order practises */
  key: string;
  points: number;
};

export const GAME_ID = 'number-builder';
export const ROUND_MS = 100_000;
/** score for one, two and three stars */
export const STAR_AT = [700, 1700, 3000] as const;
const POINTS: Record<BuildKind, number> = { two: 100, three: 140, words: 140, expanded: 150, more: 160 };
/** built this soon after the card came: a quick bonus */
export const QUICK_MS = 9000;
export const QUICK_BONUS = 40;

const int = (rng: Rng, lo: number, hi: number) => Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];

/** a number as blocks on the mat */
export const toBlocks = (n: number): Blocks => ({ h: Math.floor(n / 100), t: Math.floor(n / 10) % 10, o: n % 10 });
/** what's on the mat, as a number */
export const valueOf = (b: Blocks) => 100 * b.h + 10 * b.t + b.o;

/** The kinds of order this player can get: what their place value memory has met. */
export function kindsFor(p: Profile): BuildKind[] {
  const mem = mathOf(p).skills ?? {};
  const met = (key: string) => Object.entries(mem).some(([k, s]) => (k === key || k.startsWith(`${key}:`)) && ((s.stage ?? 0) > 0 || (s.seen ?? 0) > 0));
  const out: BuildKind[] = ['two'];
  if (met('pv-hundreds')) out.push('three');
  if (met('pv-count:words') || met('pv-big:words')) out.push('words');
  if (met('pv-hundreds:expanded')) out.push('expanded');
  if (met('pv-skip:10') || met('pv-skip:100')) out.push('more');
  return out;
}

/** The i-th order of a round: the first three are small two-digit numbers, then everything the player
 *  has met. Never loops. */
export function makeOrder(rng: Rng, i: number, kinds: readonly BuildKind[]): BuildOrder {
  const pool: BuildKind[] = i < 3 ? ['two'] : kinds.filter(k => k !== 'two' || rng() < 0.5);
  const kind: BuildKind = pick(rng, pool.length ? pool : ['two']);
  const o = (target: number, card: string, ask: string, key: string, start = 0): BuildOrder => ({ kind, target, card, ask, start, key, points: POINTS[kind] });
  if (kind === 'two') {
    const n = i < 3 ? int(rng, 11, 49) : int(rng, 11, 99);
    return o(n, String(n), 'Build this number', 'pv-tens:read');
  }
  if (kind === 'three') {
    // sometimes with a zero in it (405, 360)
    const h = int(rng, 1, 9), z = rng();
    const t = z < 0.15 ? 0 : int(rng, 1, 9), u = z > 0.85 ? 0 : int(rng, 0, 9);
    const n = 100 * h + 10 * t + u;
    return o(n, String(n), 'Build this number', u === 0 || t === 0 ? 'pv-hundreds:zero' : 'pv-hundreds:read');
  }
  if (kind === 'words') {
    const n = rng() < 0.5 ? int(rng, 21, 120) : int(rng, 101, 999);
    return o(n, words(n), 'Build the number', n <= 120 ? 'pv-count:words' : 'pv-hundreds:read');
  }
  if (kind === 'expanded') {
    const h = int(rng, 1, 9), t = int(rng, 1, 9), u = int(rng, 1, 9);
    const n = 100 * h + 10 * t + u;
    return o(n, `${100 * h} + ${10 * t} + ${u}`, 'Build the number', 'pv-hundreds:expanded');
  }
  // 10 or 100 more or less than a number already on the mat
  const step = rng() < 0.6 ? 10 : 100, more = rng() < 0.65;
  let start = step === 10 ? int(rng, more ? 21 : 31, more ? 289 : 299) : int(rng, more ? 105 : 205, more ? 799 : 899);
  // "10 less than 205" would mean breaking a hundred into tens, which the mat doesn't do: keep a ten to take
  if (!more && step === 10 && Math.floor(start / 10) % 10 === 0) start += 10;
  const target = more ? start + step : start - step;
  return o(target, `${step} ${more ? 'more' : 'less'} than ${commas(start)}`, 'Change the blocks', step === 10 ? 'pv-skip:10' : 'pv-skip:100', start);
}

/** Whether the mat is the order (any mix of blocks worth the number counts: 1 ten 12 ones is 22). */
export const builtRight = (o: BuildOrder, b: Blocks) => valueOf(b) === o.target;

/** Ten ones become a ten, ten tens a hundred: what's left after the trades, and how many trades. */
export function tidy(b: Blocks): { b: Blocks; tens: number; hundreds: number } {
  let { h, t, o } = b, tens = 0, hundreds = 0;
  while (o >= 10) { o -= 10; t++; tens++; }
  while (t >= 10 && h < 9) { t -= 10; h++; hundreds++; }
  return { b: { h, t, o }, tens, hundreds };
}

/** The combo multiplier for a build made with `combo` right ones before it in a row. */
export const comboMult = (combo: number) => 1 + Math.min(combo, 8) * 0.25;
/** Points for a right build. */
export const orderScore = (o: BuildOrder, combo: number, tookMs: number) => Math.round(o.points * comboMult(combo)) + (tookMs <= QUICK_MS ? QUICK_BONUS : 0);
export const starsFor = (score: number): 0 | 1 | 2 | 3 => (score >= STAR_AT[2] ? 3 : score >= STAR_AT[1] ? 2 : score >= STAR_AT[0] ? 1 : 0);

/** Today's challenge: the same seed for everyone on this day. */
export function dailySeed(at: number): number {
  let h = 2166136261;
  for (const c of `builder-${dayKey(at)}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
/** A round's orders come from one seed (the daily challenge's or a random one). */
export function orderMaker(seed: number, kinds: readonly BuildKind[]) {
  const rng = mulberry32(seed);
  let i = 0;
  return () => makeOrder(rng, i++, kinds);
}

export const builderOf = (p: Profile): ArcadeRecord => mathOf(p).arcade?.[GAME_ID] ?? { best: 0, stars: 0, plays: 0 };
export const dailyBestOf = (p: Profile, at = Date.now()) => { const d = builderOf(p).daily; return d && d.key === dayKey(at) ? d.best : 0; };

export type BuildRun = {
  score: number; built: number; bestCombo: number; ms: number; at: number; daily: boolean;
  /** each order's first try */
  answers: { key: string; ok: boolean; thinkMs: number }[];
};
export type BuildOutcome = Settled & { profile: Profile; stars: 0 | 1 | 2 | 3; newBest: boolean; newDaily: boolean; best: number };

/** A finished round: skill memory for the subs already met, the record, and the practice payout. */
export function applyBuild(p0: Profile, run: BuildRun): BuildOutcome {
  const p: Profile = structuredClone(p0);
  const m = (p.math = mathOf(p));
  const mem = m.skills ?? {};
  const known = run.answers.filter(x => (mem[x.key]?.stage ?? 0) > 0 || (mem[x.key]?.seen ?? 0) > 0);
  if (known.length) noteSkillAnswers(m, known, run.at);
  const stars = starsFor(run.score);
  const rec = ((m.arcade ??= {})[GAME_ID] ??= { best: 0, stars: 0, plays: 0 });
  const newBest = run.score > rec.best;
  rec.best = Math.max(rec.best, run.score); rec.stars = Math.max(rec.stars, stars); rec.plays++;
  rec.bestCombo = Math.max(rec.bestCombo ?? 0, run.bestCombo);
  let newDaily = false;
  if (run.daily) {
    const k = dayKey(run.at);
    if (rec.daily?.key !== k) rec.daily = { key: k, best: 0 };
    newDaily = run.score > rec.daily.best;
    rec.daily.best = Math.max(rec.daily.best, run.score);
  }
  const pal = buddyPal(p);
  pal.runs++;
  if (stars === 3) pal.stars3++;
  // right builds warm the eggs like a trip's (a build is worth a couple of facts)
  const done = settlePractice(p, { at: run.at, ms: run.ms, finished: true, stars, medals: stars === 3 ? ['three'] : [], right: Math.round(run.built * 2.5), xp: () => Math.round((25 + stars * 12 + Math.min(12, run.built) * 2) * (p.settings.grown ? 0.8 : 1)) });
  return { ...done, profile: p, stars, newBest, newDaily, best: rec.best };
}
