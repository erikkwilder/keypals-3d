// How hard each child's questions should be: an ability estimate per player and per skill (fact strands
// too), in rung units (types.ts), learned from every answer in every mode, and the one function every mode
// asks for a question's rung: pitch().
//
// It works the way Math Garden (Oefenweb) does: an Elo-style rating for the child and a fixed difficulty
// for each rung, updated after every answer with response time folded into the score (Klinkenberg,
// Straatemeier & van der Maas 2011; Pelánek 2016). Children practise best when they get about 75 to 85%
// right (Wilson et al. 2019, "the eighty-five percent rule"), so practice asks for the rung where the
// child is expected to get about 80% right:
//
//   p = 1 / (1 + exp(-(1.4 * (theta - rung) + 1.39)))      at theta = rung, p is about 0.8
//
// After each answer: score s = 1 (right and quick), 0.85 (right, slow), 0.7 (right, very slow: 3 times
// the skill's quick time or more), 0 (wrong); theta += K * (s - p) / 1.4. K starts at 1.2 while there's
// little to go on and settles to 0.25; it goes back up after three weeks away, and theta slips a little
// over a long gap (forgetting: up to half a rung after about two months). A right answer nudges the skills
// just below it in the same area up a little. Battles, duels and arcade games learn with a smaller K
// (their answers are noisier: a clock, a dragon, a sibling watching).
import type { Rng } from '../../engine/rng';
import { factRung, factRungSpec } from '../course';
import { FAST_MS, parseFact, type Fact, type FactStat, type Op } from '../facts';
import { SKILL, SKILLS, skillsOf, splitKey } from './registry';
import { RUNGS, rungOf, type AreaId, type Item, type Skill } from './types';

/** theta (rung units), how many answers it rests on, when it was last used */
export type Ability = { t: number; n: number; at: number };
/** where an answer came from: a practice trip (or the garden, or Learn), a game (battle, duel, arcade), placement */
export type Source = 'trip' | 'game' | 'placement';
/** What the estimates are read from: the math save, or the part of it they need. */
export type AbilityHome = { facts?: Record<string, FactStat>; skills?: Record<string, FactStat>; ability?: Record<string, Ability> };

const DAY = 86_400_000;
export const SLOPE = 1.4, EASE = 1.39;
/** The chance of a right answer at a rung, for a child at theta. */
export const expected = (theta: number, rung: number) => 1 / (1 + Math.exp(-(SLOPE * (theta - rung) + EASE)));
/** What each mode aims for: practice and battles 0.8; quick timed answers and teach-backs 0.9 (easier,
 *  because they're fast or brand new); placement 0.5 (to find the edge quickly). */
export const TARGET = { practice: 0.8, battle: 0.8, quick: 0.9, teach: 0.9, placement: 0.5 } as const;
/** How often a question is pitched one rung off, for variety and evidence. */
export const JITTER = 0.2;
const T_MIN = -1, T_MAX = 8;
const clampT = (t: number) => Math.max(T_MIN, Math.min(T_MAX, t));

/** An answer's score: right and quick 1, right but slow 0.85, right but very slow 0.7, wrong 0. */
export function scoreOf(ok: boolean, thinkMs: number | undefined, fastMs: number): number {
  if (!ok) return 0;
  if (!thinkMs || thinkMs <= fastMs) return 1;
  return thinkMs >= 3 * fastMs ? 0.7 : 0.85;
}
/** How far one answer moves theta: big while there's little evidence, settling to 0.25; games move it less. */
export function kOf(n: number, source: Source): number {
  const k = 0.25 + 0.95 * Math.exp(-n / 15);
  return source === 'game' ? k * 0.6 : k;
}
/** The estimate as it stands now: after a long gap it slips (up to half a rung by about two months). */
export function decayed(a: Ability, now: number): Ability {
  const days = (now - a.at) / DAY;
  const slip = 0.5 * Math.max(0, Math.min(1, (days - 7) / 53));
  return slip > 0 ? { ...a, t: a.t - slip } : a;
}
/** One answer's effect on an estimate (pure). */
export function learn(prev: Ability | undefined, prior: number, x: { rung: number; ok: boolean; thinkMs?: number; fastMs: number; at: number; source: Source }): Ability {
  const base = prev ? decayed(prev, x.at) : { t: prior, n: 0, at: x.at };
  // back after three weeks or more: listen harder again
  const n = prev && x.at - prev.at >= 21 * DAY ? Math.min(base.n, 8) : base.n;
  const p = expected(base.t, x.rung), s = scoreOf(x.ok, x.thinkMs, x.fastMs);
  return { t: clampT(base.t + (kOf(n, x.source) * (s - p)) / SLOPE), n: n + 1, at: Math.max(x.at, prev?.at ?? 0) };
}

// ---------- the fact strands as skills ----------
export const STRAND_SKILL: Record<Op, string> = { '+': 'add-facts', '-': 'sub-facts', x: 'mult-facts', '/': 'div-facts' };
export const strandOf = (f: Fact) => STRAND_SKILL[f.op ?? 'x'];

// ---------- an area's ladder: where each skill sits, so one skill's estimate says something about another ----------
/** Rungs between one grade and the next (rung 3 of a grade's skill is about rung 0.5 of the next grade's). */
export const GRADE_RUNGS = 2.5;
const LADDERS = new Map<AreaId, { skill: string; base: number }[]>();
/** The area's skills, each with its base on a shared scale: a child at level L is at about L - base on it. */
export function ladderOf(area: AreaId): { skill: string; base: number }[] {
  let l = LADDERS.get(area);
  if (!l) {
    const ss = skillsOf(area), g0 = Math.min(...ss.map(s => s.grade));
    const rank = new Map<number, number>();
    l = ss.map(s => { const k = rank.get(s.grade) ?? 0; rank.set(s.grade, k + 1); return { skill: s.id, base: GRADE_RUNGS * (s.grade - g0) + 0.6 * k }; });
    LADDERS.set(area, l);
  }
  return l;
}
export const baseOf = (skill: string) => { const s = SKILL[skill]; return s ? ladderOf(s.area).find(x => x.skill === skill)?.base ?? 0 : 0; };

// ---------- where an estimate starts ----------
/** The default for a child with nothing at all to go on: gentle (a grown-up player starts higher). */
export const START_T = 1.5, GROWN_T = 4;
const STAGE_T = [0, 1.5, 3, 4];
/** A start from the skill's own memory (saves from before abilities: sprouts were asked at the old level 1,
 *  buds and blooms at level 2, which is rung 3). */
function fromMemory(h: AbilityHome, s: Skill): number | null {
  if (s.facts) {
    const met = Object.entries(h.facts ?? {}).filter(([id, st]) => st.stage > 0 && (parseFact(id).op ?? 'x') === s.facts);
    if (met.length < 3) return null;
    const off = [0, -1, 0, 0.7];
    return met.reduce((t, [id, st]) => t + factRung(parseFact(id)) + off[st.stage], 0) / met.length;
  }
  const met = s.subs.map(sb => h.skills?.[`${s.id}:${sb.id}`]).filter((st): st is FactStat => !!st && st.stage > 0);
  return met.length ? met.reduce((t, st) => t + STAGE_T[st.stage], 0) / met.length : null;
}
/** Where an unseen skill starts: its own old memory; else the mean of the area's seen skills, moved along
 *  the area's ladder; else the grade the child works at elsewhere; else gently. */
export function priorOf(h: AbilityHome, skill: string, now = Date.now(), grown = false): number {
  const s = SKILL[skill];
  if (!s) return grown ? GROWN_T : START_T;
  const mem = fromMemory(h, s);
  if (mem !== null) return clampT(mem);
  const ab = Object.entries(h.ability ?? {}).filter(([id, a]) => id !== skill && a.n > 0 && SKILL[id]);
  const same = ab.filter(([id]) => SKILL[id].area === s.area);
  const mine = baseOf(skill);
  if (same.length) {
    let w = 0, t = 0;
    for (const [id, a] of same) { const wi = Math.min(20, a.n); w += wi; t += wi * (decayed(a, now).t + baseOf(id) - mine); }
    return Math.max(0.5, Math.min(6.5, t / w));
  }
  if (ab.length) {
    // the grade they work at: each skill says "grade g, plus (theta - 3) / 2.5 grades"
    let w = 0, g = 0;
    for (const [id, a] of ab) { const wi = Math.min(20, a.n); w += wi; g += wi * (SKILL[id].grade + (decayed(a, now).t - 3) / GRADE_RUNGS); }
    return Math.max(0.5, Math.min(5, 3 + GRADE_RUNGS * (g / w - s.grade)));
  }
  return grown ? GROWN_T : START_T;
}
/** The estimate for a skill now (or where it would start). */
export function thetaOf(h: AbilityHome, skill: string, now = Date.now(), grown = false): number {
  const a = h.ability?.[skill];
  return a ? decayed(a, now).t : priorOf(h, skill, now, grown);
}
/** Whether there's any real evidence for a skill yet (answers, or a placement). */
export const hasEvidence = (h: AbilityHome, skill: string) => (h.ability?.[skill]?.n ?? 0) > 0;

// ---------- pitch: the one way every mode chooses how hard ----------
/** The rung whose expected success is closest to the target. */
export function rungFor(theta: number, target: number): number {
  let best = 1, gap = Infinity;
  for (let r = 1; r <= RUNGS; r++) { const d = Math.abs(expected(theta, r) - target); if (d < gap) { gap = d; best = r; } }
  return best;
}
/** That rung, moved by a trip's streak (`bump`: one up after four right, one down after two misses) and,
 *  about one time in five, one step either way for variety and evidence. Neither steps up into a question
 *  the child is expected to miss more often than not (the streak's step up needs at least 50%, the
 *  jitter's 60%; otherwise the jitter steps down), and the jitter stays off the ends of the ladder (at rung
 *  1 it could only go up, at rung 6 only down). Simulated learners (adaptive.sim.test.ts) then get about
 *  80% right at every level. */
export function pitchRung(theta: number, target: number, rng?: Rng, bump = 0): number {
  const base = rungFor(theta, target);
  let r = base;
  if (bump > 0 && expected(theta, base + 1) >= 0.5) r++;
  else if (bump < 0) r--;
  if (rng && rng() < JITTER && r > 1 && r < RUNGS) r += rng() < 0.5 && expected(theta, r + 1) >= 0.6 ? 1 : -1;
  return rungOf(r);
}
export type PitchOpts = { rng?: Rng; now?: number; bump?: number; grown?: boolean };
/** How hard this child's next question on a skill (or a fact strand: add-facts...) should be. */
export function pitch(h: AbilityHome, skill: string, target: number, o: PitchOpts = {}): number {
  return pitchRung(thetaOf(h, skill, o.now, o.grown), target, o.rng, o.bump ?? 0);
}
/** A skill's question at a rung, stamped with the rung (so its answer can move the ability). */
export const makeAt = (s: Skill, rng: Rng, sub: string, rung: number): Item => ({ ...s.make(rng, sub, rung), rung: rungOf(rung) });
/** A pitched question for a memory key (`fr-name:4`). */
export function pitchItem(h: AbilityHome, key: string, target: number, rng: Rng, o: Omit<PitchOpts, 'rng'> = {}): Item {
  const { skill, sub } = splitKey(key), s = SKILL[skill];
  return makeAt(s, rng, sub, pitch(h, skill, target, { ...o, rng }));
}

// ---------- learning from answers ----------
export type AbilityAnswer = { skill: string; rung: number; ok: boolean; thinkMs?: number; fastMs?: number; at: number };
/** The skills just below one in its area (the two before it on the ladder): a right answer nudges them. */
function below(skill: string): string[] {
  const s = SKILL[skill];
  if (!s || s.facts) return [];
  const l = ladderOf(s.area), i = l.findIndex(x => x.skill === skill);
  return l.slice(Math.max(0, i - 2), i).map(x => x.skill);
}
/** Every answer moves its skill's estimate (in place, on the math save or a working copy). */
export function noteAbility(h: AbilityHome, answers: AbilityAnswer[], source: Source, grown = false): Record<string, Ability> {
  const ab = (h.ability = { ...(h.ability ?? {}) });
  for (const x of answers) {
    const s = SKILL[x.skill];
    if (!s || !Number.isFinite(x.rung)) continue;
    const prev = ab[x.skill];
    ab[x.skill] = learn(prev, prev ? 0 : priorOf(h, x.skill, x.at, grown), { rung: x.rung, ok: x.ok, thinkMs: x.thinkMs, fastMs: x.fastMs ?? s.fastMs, at: x.at, source });
    if (!x.ok) continue;
    // a right answer says a little about the easier skills under it (only ones already started)
    for (const id of below(x.skill)) {
      const y = ab[id];
      if (!y) continue;
      const t = decayed(y, x.at).t;
      ab[id] = { ...y, t: clampT(t + (0.25 * kOf(y.n, source) * (1 - expected(t, x.rung))) / SLOPE) };
    }
  }
  return ab;
}
/** Skill answers by memory key; one with no rung was asked before rungs (it counts as at their level). */
export function skillAnswers(h: AbilityHome, xs: { key: string; ok: boolean; thinkMs: number; rung?: number }[], at: number): AbilityAnswer[] {
  return xs.map(x => { const skill = splitKey(x.key).skill; return { skill, rung: x.rung ?? rungFor(thetaOf(h, skill, at), TARGET.practice), ok: x.ok, thinkMs: x.thinkMs, at }; }).filter(x => !!SKILL[x.skill] && !SKILL[x.skill].facts);
}
/** Fact answers: each fact's own rung, quick by the grown-ups' setting (times the trip rung's speed target). */
export function factAnswers(xs: { f: Fact; ok: boolean; thinkMs: number }[], at: number, fastMs = FAST_MS, tripRung?: number): AbilityAnswer[] {
  const speed = tripRung ? factRungSpec(tripRung).speed : 1;
  return xs.map(x => ({ skill: strandOf(x.f), rung: factRung(x.f), ok: x.ok, thinkMs: x.thinkMs, fastMs: fastMs * speed, at }));
}

// ---------- for grown-ups: where a child is working, in words ----------
export type Working = 'not started' | 'getting started' | 'comfortable' | 'strong' | 'stretching';
/** The rung a child works at on a skill (practice's), and what that is in words. */
export function workingOf(h: AbilityHome, skill: string, now = Date.now()): { rung: number; word: Working } {
  if (!hasEvidence(h, skill) && fromMemory(h, SKILL[skill]) === null) return { rung: 0, word: 'not started' };
  const t = thetaOf(h, skill, now), rung = rungFor(t, TARGET.practice);
  return { rung, word: t < 2 ? 'getting started' : t < 3.5 ? 'comfortable' : t < 5 ? 'strong' : 'stretching' };
}
export const WORKING_SAY: Record<Working, string> = {
  'not started': 'Not started',
  'getting started': 'Getting started: the gentlest questions, with pictures',
  comfortable: 'Comfortable: grade-level questions',
  strong: 'Strong: bigger numbers and more steps',
  stretching: 'Stretching: the hardest versions',
};

// ---------- merging two computers' estimates (state/merge.ts) ----------
/** The estimate with clearly more evidence behind it (twice as many answers and then some), else the newer. */
export function mergeAbility(a: Ability, b: Ability): Ability {
  if (a.n >= 2 * b.n + 5) return a;
  if (b.n >= 2 * a.n + 5) return b;
  return a.at >= b.at ? a : b;
}

/** (tests, grown-ups' view) every skill id with an estimate or a start */
export const ALL_SKILL_IDS = SKILLS.map(s => s.id);
