// Show What You Know, as a real calibration. An area's skills sit on one ladder (ability.ts ladderOf: a
// child at level L is at about L - base on each skill), so a question is a skill at a rung, and its
// difficulty on the ladder is base + rung. The placement walks that ladder like an eye test:
//   - it starts at the rung typical for the grade (or where the child already is, if the game knows),
//   - goes up after a right answer and down after a wrong one, in big steps at first (3, 2.5, 2 rungs),
//   - and once it has seen both a right and a wrong answer, asks where the child is expected to get about
//     half right (the edge, where an answer says the most), from its best guess so far,
//   - across the area's skills, a different one each time where it can.
// After 16 questions the best guess (the most likely level given every answer, with
// a gentle pull toward the start) sets every skill: the ones it asked from their own answers too, the rest
// from the ladder (skills well below the level start high, skills above it start at the edge). Nothing is
// locked or marked done by this: the trip's own test-out rule still opens stops as before.
import type { Rng } from '../../engine/rng';
import { factRung, groupFacts, regionsOf } from '../course';
import { isRuleFact, type Op } from '../facts';
import { decayed, expected, hasEvidence, ladderOf, STRAND_SKILL, thetaOf, type Ability, type AbilityHome } from './ability';
import { SKILL } from './registry';
import type { AreaId } from './types';

export type Rung = { skill: string; base: number };
export type Probe = { skill: string; rung: number; d: number };
export type PlacedAnswer = Probe & { ok: boolean };
/** questions in a placement */
export const PLACE_SKILL_N = 16, PLACE_FACT_N = 16;
/** the steps before the first change of direction */
const STEPS = [3, 2.5, 2, 2, 1.5, 1.5];

/** The most likely level on a ladder for these answers (a grid search; the start pulls only a little, SD 6, so a child far from it is not dragged back). */
export function levelOf(answers: { d: number; ok: boolean }[], start: number, lo: number, hi: number, sd = 6): number {
  let best = start, bestLp = -Infinity;
  for (let L = lo; L <= hi + 1e-9; L += 0.05) {
    let lp = -((L - start) ** 2) / (2 * sd * sd);
    for (const a of answers) { const p = expected(L, a.d); lp += Math.log(a.ok ? p : 1 - p); }
    if (lp > bestLp) { bestLp = lp; best = L; }
  }
  return best;
}

/** The staircase: which skill and rung to ask next, and the level it points to. */
export class Staircase {
  readonly answers: PlacedAnswer[] = [];
  readonly lo: number;
  readonly hi: number;
  private cur: Probe | null = null;
  constructor(readonly ladder: Rung[], readonly start: number, readonly length: number, private readonly rng: Rng) {
    this.lo = Math.min(...ladder.map(x => x.base)) + 1;
    this.hi = Math.max(...ladder.map(x => x.base)) + 6;
  }
  get done() { return this.answers.length >= this.length; }
  /** where to ask next, on the ladder */
  private target(): number {
    const as = this.answers;
    if (!as.length) return this.start;
    const turned = as.some(a => a.ok) && as.some(a => !a.ok);
    if (!turned) { const last = as[as.length - 1]; return last.d + (last.ok ? 1 : -1) * STEPS[Math.min(STEPS.length - 1, as.length - 1)]; }
    // the edge: where the best guess says about half right (one rung above the level)
    return this.estimate() + 0.99;
  }
  next(): Probe | null {
    if (this.done) return (this.cur = null);
    const d = Math.max(this.lo, Math.min(this.hi, this.target()));
    const last = this.answers.at(-1)?.skill;
    let best: Probe | null = null, cost = Infinity;
    for (const x of this.ladder) {
      const rung = Math.max(1, Math.min(6, Math.round(d - x.base)));
      const asked = this.answers.filter(a => a.skill === x.skill).length;
      const c = Math.abs(x.base + rung - d) + 0.45 * asked + (x.skill === last && this.ladder.length > 1 ? 0.8 : 0) + this.rng() * 0.25;
      if (c < cost) { cost = c; best = { skill: x.skill, rung, d: x.base + rung }; }
    }
    return (this.cur = best);
  }
  answer(ok: boolean) {
    if (!this.cur) return;
    this.answers.push({ ...this.cur, ok });
    this.cur = null;
  }
  estimate(): number { return levelOf(this.answers, this.start, this.lo - 3, this.hi + 3); }
}

/** Where an area's placement starts: where the child already is (if the game knows), else rung 3 of the
 *  area's first skills (what's typical for the grade it starts in). */
export function placeStart(h: AbilityHome, ladder: Rung[], now = Date.now()): number {
  const known = ladder.filter(x => hasEvidence(h, x.skill));
  if (known.length) return known.reduce((t, x) => t + thetaOf(h, x.skill, now) + x.base, 0) / known.length;
  const any = Object.keys(h.ability ?? {}).length > 0;
  // elsewhere in the game: where that says they'd be on the first skill, but never below rung 2
  return any ? Math.max(2, thetaOf(h, ladder[0].skill, now) + ladder[0].base) : 3;
}
export const skillLadder = (area: AreaId): Rung[] => ladderOf(area).filter(x => !SKILL[x.skill]?.facts);
export const strandLadder = (op: Op): Rung[] => [{ skill: STRAND_SKILL[op], base: 0 }];

/** One skill's estimate from the placement: the ladder's level for it, and its own answers if it was asked. */
function skillTheta(level: number, base: number, own: PlacedAnswer[]): number {
  const prior = level - base;
  if (!own.length) return prior;
  let best = prior, bestLp = -Infinity;
  for (let t = prior - 4; t <= prior + 4 + 1e-9; t += 0.05) {
    let lp = -((t - prior) ** 2) / (2 * 0.6 * 0.6);
    for (const a of own) { const p = expected(t, a.rung); lp += Math.log(a.ok ? p : 1 - p); }
    if (lp > bestLp) { bestLp = lp; best = t; }
  }
  return best;
}
/** Set every skill on the ladder from a placement's answers (in place). Skills with plenty of evidence
 *  already keep most of it. Returns the level. */
export function applyPlacement(h: AbilityHome, ladder: Rung[], answers: PlacedAnswer[], start: number, now: number): number {
  const lo = Math.min(...ladder.map(x => x.base)) + 1, hi = Math.max(...ladder.map(x => x.base)) + 6;
  const level = levelOf(answers, start, lo - 3, hi + 3);
  const ab = (h.ability = { ...(h.ability ?? {}) });
  for (const x of ladder) {
    const own = answers.filter(a => a.skill === x.skill);
    // well below the level: start high; above it: at the edge
    const t = Math.max(0.5, Math.min(6.5, skillTheta(level, x.base, own)));
    const n = own.length ? 3 + own.length : 2;
    const old = ab[x.skill];
    if (old && old.n > 0) {
      const w = Math.min(20, old.n), was = decayed(old, now).t;
      ab[x.skill] = { t: (was * w + t * 6) / (w + 6), n: Math.max(old.n, n), at: now };
    } else ab[x.skill] = { t, n, at: now };
  }
  return level;
}

// ---------- what it found, in words for a grown-up ----------
const PLUS_SAY: Record<string, string> = { '+s': 'adding 0, 1 and 2', '+d': 'doubles and near doubles', '+t': 'making ten, plus 10 and plus 9', '+b': 'adding through ten (8 + 5)' };
const MINUS_SAY: Record<string, string> = { '-s': 'taking away 0, 1 and 2', '-d': 'doubles back and taking away 10', '-t': 'taking from 10, and taking away 9', '-b': 'thinking addition (13 − 5)' };
const groupSay = (g: string) => PLUS_SAY[g] ?? MINUS_SAY[g] ?? (g[0] === 'x' ? `the ${g.slice(1)}s` : `sharing by ${g.slice(1)}`);
/** a group's typical fact, in rungs (the middle of its facts, leaving out the 0 and 1 rules) */
const groupRung = (g: string) => { const rs = groupFacts(g).filter(f => !isRuleFact(f)).map(factRung).sort((a, b) => a - b); return rs.length ? rs[Math.floor(rs.length / 2)] : 1; };
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
/** `of`: how many there are in all (so "all of them" can be said plainly) */
export type Found = { comfortable: string[]; next: string[]; of?: number };
/** a skill's name in a sentence ("Which is bigger?" reads as "which is bigger") */
const inSentence = (name: string) => name.replace(/\?$/, '').toLowerCase();
/** An area's skills: comfortable (expected to get rung 3 right most of the time) and the next ones to grow. */
export function foundInArea(h: AbilityHome, area: AreaId, now = Date.now()): Found {
  const comfortable: string[] = [], next: string[] = [], ladder = skillLadder(area);
  for (const x of ladder) {
    const s = SKILL[x.skill], t = thetaOf(h, x.skill, now);
    if (t >= 3) comfortable.push(inSentence(s.name));
    else if (next.length < 2) next.push(inSentence(s.name));
  }
  return { comfortable, next, of: ladder.length };
}
/** A fact strand's families: comfortable (at or past their typical fact) and the next ones to grow. */
export function foundInStrand(h: AbilityHome, op: Op, now = Date.now()): Found {
  const t = thetaOf(h, STRAND_SKILL[op], now), comfortable: string[] = [], next: string[] = [];
  const groups = [...new Set(regionsOf(op).flatMap(r => r.groups))];
  for (const g of groups) {
    if (t >= groupRung(g)) comfortable.push(groupSay(g));
    else if (next.length < 2) next.push(groupSay(g));
  }
  return { comfortable, next, of: groups.length };
}
/** The sentence for the results screen and the grown-ups' report. */
export function foundText(f: Found, name: string): string {
  const all = !f.next.length && f.comfortable.length > 0 && f.comfortable.length === f.of;
  const c = all ? `Comfortable with all ${f.of} of them.` : f.comfortable.length ? `Comfortable with: ${list(f.comfortable)}.` : `Starting from the beginning, gently.`;
  const n = f.next.length ? ` Next to grow: ${list(f.next)}.` : all ? ' The questions will stretch to the hardest versions.' : '';
  return `${c}${n} ${name}'s questions are now pitched to match, and they'll keep adjusting as ${name} plays.`;
}
export type { Ability };
