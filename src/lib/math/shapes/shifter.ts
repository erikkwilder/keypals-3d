// Shape Shifter: the shapes and angles arcade game. Crystal shapes tumble down over the peaks; a rule card
// says which ones to catch ("Triangles", "4 equal sides", "An obtuse angle", "A line of symmetry"). Tap a
// crystal that fits and it flies into the crystal basket; tap one that doesn't and it shatters (the combo
// goes); let one that fits fall past and the combo goes too. A new rule every few catches. Ninety seconds a
// round: combos, three stars, a best score and today's challenge (the same day, the same crystals).
//
// The rules come from the area's skills, and only the ones the player has met (naming shapes always): each
// rule is pitched from the child's ability on its skill (math/skills/ability.ts) like every timed game, so
// at a gentle rung the shapes that don't fit look nothing like the ones that do, and higher up they are
// close (a rhombus among squares, a 100° corner among right angles). Whether a crystal fits is worked out
// from its corners (math/shapes/geo.ts), never assumed. Each tap counts in skill memory for subs already
// met, and the round pays out like any practice.
import { mulberry32, type Rng } from '../../engine/rng';
import { buddyPal, dayKey, type Profile } from '../../engine/profile';
import { settlePractice, treasureFor, type Settled } from '../../engine/settle';
import { mathOf, type ArcadeRecord } from '../progress';
import { noteSkillAnswers } from '../skills/progress';
import { pitchRung, TARGET, thetaOf } from '../skills/ability';
import { factsOf, middle, parallelPairs, symmetryLines, type P } from './geo';
import { KIND_NAME, an, shapeOf, type Kind } from './kinds';
import type { FigHue } from './fig';

export const GAME_ID = 'shape-shifter';
export const ROUND_MS = 90_000;
/** score for one, two and three stars */
export const STAR_AT = [1200, 3000, 5200] as const;
/** a rule stays this long, or this many right catches */
export const RULE_MS = 15_000, RULE_CATCHES = 5;

export type RuleId = 'triangles' | 'squares' | 'circles' | 'four' | 'five' | 'six' | 'rect' | 'eq4' | 'right' | 'obtuse' | 'acute' | 'sym' | 'parallel' | 'righttri';
/** A crystal: its corners round its middle (about 1 unit across), how it looks, whether it fits the rule
 *  it was made for, what it is in words, and (a wedge) its angle. */
export type Piece = { pts: P[]; tint: FigHue; fits: boolean; name: string; why: string; angle?: number; round?: boolean };
type Rule = {
  id: RuleId; word: string; say: string;
  /** the skill memory key a catch practises, and the skill whose ability pitches it */
  key: string; skill: string;
  fits: (pts: P[], angle?: number) => boolean;
  /** kinds to make, at a rung: ones that should fit and ones that shouldn't */
  yes: (r: number) => Kind[]; no: (r: number) => Kind[];
  /** an angle rule's crystals are wedges */
  wedge?: boolean;
};

const facts = (pts: P[]) => factsOf(pts);
const RULES: Rule[] = [
  { id: 'triangles', word: 'Triangles', say: 'Catch every triangle!', key: 'sh-name:flat', skill: 'sh-name', fits: p => facts(p).sides === 3,
    yes: () => ['triangle', 'right-triangle'], no: r => (r <= 2 ? ['square', 'circle', 'hexagon'] : ['square', 'rectangle', 'pentagon', 'trapezoid', 'kite', 'rhombus']) },
  { id: 'squares', word: 'Squares', say: 'Catch every square!', key: 'sh-name:flat', skill: 'sh-name', fits: p => facts(p).family.includes('square'),
    yes: () => ['square'], no: r => (r <= 2 ? ['triangle', 'circle', 'hexagon'] : r <= 4 ? ['rectangle', 'rhombus', 'trapezoid', 'triangle'] : ['rectangle', 'rhombus', 'kite']) },
  { id: 'circles', word: 'Circles', say: 'Catch every circle!', key: 'sh-name:flat', skill: 'sh-name', fits: p => p.length > 20,
    yes: () => ['circle'], no: r => (r <= 2 ? ['triangle', 'square', 'rectangle'] : ['hexagon', 'octagon', 'pentagon']) },
  { id: 'four', word: '4 sides', say: 'Catch the shapes with 4 sides!', key: 'sh-sides:sides', skill: 'sh-sides', fits: p => p.length <= 20 && facts(p).sides === 4,
    yes: r => (r <= 2 ? ['square', 'rectangle'] : ['square', 'rectangle', 'rhombus', 'trapezoid', 'kite', 'quadrilateral', 'parallelogram']), no: r => (r <= 2 ? ['triangle', 'circle', 'hexagon'] : ['triangle', 'pentagon', 'hexagon', 'arrow']) },
  { id: 'five', word: '5 corners', say: 'Catch the shapes with 5 corners!', key: 'sh-sides:corners', skill: 'sh-sides', fits: p => p.length <= 20 && facts(p).corners === 5,
    yes: () => ['pentagon'], no: r => (r <= 2 ? ['triangle', 'square', 'circle'] : ['hexagon', 'square', 'trapezoid', 'kite']) },
  { id: 'six', word: '6 sides', say: 'Catch the shapes with 6 sides!', key: 'sh-sides:sides', skill: 'sh-sides', fits: p => p.length <= 20 && facts(p).sides === 6,
    yes: () => ['hexagon', 'ell'], no: r => (r <= 3 ? ['square', 'triangle', 'circle'] : ['pentagon', 'octagon', 'arrow']) },
  { id: 'rect', word: 'Rectangles', say: 'Catch the rectangles. Squares are rectangles too!', key: 'sh-quad:find', skill: 'sh-quad', fits: p => p.length <= 20 && facts(p).family.includes('rectangle'),
    yes: () => ['rectangle', 'square'], no: r => (r <= 3 ? ['triangle', 'hexagon', 'trapezoid'] : ['parallelogram', 'rhombus', 'trapezoid', 'kite']) },
  { id: 'eq4', word: '4 equal sides', say: 'Catch the shapes with 4 equal sides!', key: 'sh-quad:name', skill: 'sh-quad', fits: p => p.length <= 20 && facts(p).sides === 4 && facts(p).equalSides,
    yes: () => ['square', 'rhombus'], no: r => (r <= 3 ? ['triangle', 'rectangle', 'hexagon'] : ['rectangle', 'kite', 'parallelogram', 'trapezoid']) },
  { id: 'right', word: 'A right angle', say: 'Catch the shapes with a square corner!', key: 'sh-angle:kind', skill: 'sh-angle', fits: p => p.length <= 20 && facts(p).right > 0,
    yes: () => ['square', 'rectangle', 'right-triangle', 'ell'], no: r => (r <= 3 ? ['hexagon', 'pentagon', 'circle'] : ['rhombus', 'parallelogram', 'triangle', 'hexagon']) },
  { id: 'obtuse', word: 'An obtuse angle', say: 'Catch the shapes with a corner wider than a square corner!', key: 'sh-angle:kind', skill: 'sh-angle', fits: p => p.length <= 20 && facts(p).obtuse > 0,
    yes: () => ['hexagon', 'pentagon', 'parallelogram', 'trapezoid'], no: () => ['square', 'rectangle', 'right-triangle'] },
  { id: 'acute', word: 'Acute angles', say: 'Catch the angles smaller than a square corner!', key: 'sh-angle:kind', skill: 'sh-angle', wedge: true, fits: (_p, a) => (a ?? 90) < 90,
    yes: () => [], no: () => [] },
  { id: 'sym', word: 'A line of symmetry', say: 'Catch the shapes you could fold in half to match!', key: 'sh-lines:sym', skill: 'sh-lines', fits: p => p.length > 20 || symmetryLines(p).length > 0,
    yes: () => ['square', 'rectangle', 'kite', 'hexagon', 'pentagon', 'arrow'], no: () => ['quadrilateral', 'parallelogram', 'ell'] },
  { id: 'parallel', word: 'Parallel sides', say: 'Catch the shapes with sides that go the same way!', key: 'sh-lines:pairs', skill: 'sh-lines', fits: p => p.length <= 20 && parallelPairs(p).length > 0,
    yes: () => ['rectangle', 'parallelogram', 'trapezoid', 'hexagon', 'square'], no: () => ['triangle', 'kite', 'quadrilateral', 'pentagon'] },
  { id: 'righttri', word: 'Right triangles', say: 'Catch the triangles with a square corner!', key: 'sh-family:tri', skill: 'sh-family', fits: p => p.length <= 20 && facts(p).sides === 3 && facts(p).right > 0,
    yes: () => ['right-triangle'], no: () => ['triangle'] },
];
export const RULE: Record<RuleId, Rule> = Object.fromEntries(RULES.map(r => [r.id, r])) as Record<RuleId, Rule>;
/** what a rule practises, in order of the area (naming first) */
export const RULE_ORDER: RuleId[] = RULES.map(r => r.id);

/** The rules this player can get: naming shapes always; the rest once their skill has been met. */
export function rulesFor(p: Profile): RuleId[] {
  const mem = mathOf(p).skills ?? {};
  const met = (skill: string) => Object.entries(mem).some(([k, s]) => k.startsWith(`${skill}:`) && ((s.stage ?? 0) > 0 || (s.seen ?? 0) > 0));
  return RULES.filter(r => r.skill === 'sh-name' || met(r.skill)).map(r => r.id);
}
/** How hard each rule is for this player: their ability on its skill. */
export function levelsFor(p: Profile): Partial<Record<RuleId, number>> {
  const m = mathOf(p), now = Date.now(), g = !!p.settings.grown;
  return Object.fromEntries(RULES.map(r => [r.id, thetaOf(m, r.skill, now, g)])) as Partial<Record<RuleId, number>>;
}

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const TINTS: FigHue[] = ['teal', 'rose', 'gold', 'violet', 'sky', 'mint'];
/** corners round the middle, about 2 units across */
const norm = (pts: P[]): P[] => { const [cx, cy] = middle(pts); return pts.map(([x, y]) => [(x - cx) / 5, (y - cy) / 5] as P); };
const fan = (deg: number): P[] => [[0, 0], ...Array.from({ length: 11 }, (_, i) => { const a = (deg * i * Math.PI) / 180 / 10; return [1.5 * Math.cos(a), -1.5 * Math.sin(a)] as P; })];
/** A crystal for a rule: one that fits (`want`) or one that doesn't, at a rung. The kind is only a
 *  suggestion; the geometry decides (a "no" that happens to fit becomes a plain one that surely doesn't). */
export function makePiece(rng: Rng, rule: RuleId, want: boolean, r: number): Piece {
  const R = RULE[rule];
  const tint = pick(rng, TINTS);
  if (R.wedge) {
    const deg = want ? pick(rng, r <= 2 ? [30, 45, 60] : r <= 4 ? [40, 60, 75, 80] : [70, 80, 85]) : pick(rng, r <= 2 ? [120, 150, 90] : r <= 4 ? [95, 110, 130, 90] : [95, 100, 90]);
    // a wedge's middle is where its corner is, near the bottom left: centre it
    const pts = fan(deg), [cx, cy] = middle(pts);
    const name = deg < 90 ? `a ${deg}° angle (acute)` : deg === 90 ? 'a right angle (90°)' : `a ${deg}° angle (obtuse)`;
    return { pts: pts.map(([x, y]) => [x - cx, y - cy] as P), tint, fits: R.fits([], deg), name, why: deg === 90 ? 'a square corner is not smaller than a square corner' : deg > 90 ? 'it is wider than a square corner' : 'it is smaller than a square corner', angle: deg };
  }
  const kinds = want ? R.yes(r) : R.no(r);
  const kind = pick(rng, kinds);
  const wild = r >= 4 && rng() < 0.5;
  const turn = r <= 1 ? 0 : Math.floor(rng() * 12) * 15;
  let pts = norm(shapeOf(rng, kind, { wild, turn }));
  let fits = R.fits(pts);
  let name = an(KIND_NAME[kind]);
  if (fits !== want) {
    // (a safe stand-in: a plain shape that surely does or doesn't fit)
    const safe: Kind = want ? R.yes(1)[0] ?? 'square' : R.no(1)[0] ?? 'circle';
    pts = norm(shapeOf(rng, safe, { turn }));
    fits = R.fits(pts); name = an(KIND_NAME[safe]);
  }
  const f = pts.length > 20 ? null : facts(pts);
  const why = !f ? 'it is round, with no corners or sides' : `it has ${f.sides} sides${f.right ? `, ${f.right === 1 ? 'a right angle' : `${f.right} right angles`}` : ''}${f.obtuse && rule === 'obtuse' ? ', an obtuse angle' : ''}`;
  return { pts, tint, fits, name, why, round: pts.length > 20 };
}

/** The combo multiplier for a catch with `combo` right ones before it in a row. */
export const comboMult = (combo: number) => 1 + Math.min(combo, 8) * 0.25;
export const catchScore = (combo: number) => Math.round(100 * comboMult(combo));
export const starsFor = (score: number): 0 | 1 | 2 | 3 => (score >= STAR_AT[2] ? 3 : score >= STAR_AT[1] ? 2 : score >= STAR_AT[0] ? 1 : 0);

/** Today's challenge: the same seed for everyone on this day. */
export function dailySeed(at: number): number {
  let h = 2166136261;
  for (const c of `shifter-${dayKey(at)}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** A round's rules and crystals, all from one seed: the rule order, and each crystal for the rule showing. */
export class Round {
  private rng: Rng;
  private order: RuleId[] = [];
  private oi = 0;
  private sinceFit = 0;
  rule: RuleId;
  rung: number;
  constructor(seed: number, private rules: RuleId[], private levels: Partial<Record<RuleId, number>> = {}) {
    this.rng = mulberry32(seed);
    const pool = rules.length ? rules : ['triangles' as RuleId];
    // shuffled, never the same rule twice running; naming shapes first for a gentle start
    const sh = pool.slice().sort(() => this.rng() - 0.5);
    const first = sh.find(r => RULE[r].skill === 'sh-name') ?? sh[0];
    this.order = [first, ...sh.filter(r => r !== first)];
    this.rule = this.order[0];
    this.rung = this.pitch(this.rule);
  }
  private pitch(r: RuleId) { const th = this.levels[r]; return th === undefined ? 3 : pitchRung(th, TARGET.quick, this.rng); }
  /** the next rule (a different one when there's a choice) */
  nextRule(): RuleId {
    this.oi = (this.oi + 1) % this.order.length;
    this.rule = this.order[this.oi];
    this.rung = this.pitch(this.rule);
    return this.rule;
  }
  /** the next crystal: about half fit, and never more than two in a row that don't */
  piece(): Piece {
    const want = this.sinceFit >= 2 || this.rng() < 0.5;
    this.sinceFit = want ? 0 : this.sinceFit + 1;
    return makePiece(this.rng, this.rule, want, this.rung);
  }
  /** where across the sky (0..1), away from the last */
  lane(last: number): number { const x = 0.12 + this.rng() * 0.76; return Math.abs(x - last) < 0.18 ? (x + 0.38) % 0.88 + 0.06 : x; }
}

export const shifterOf = (p: Profile): ArcadeRecord => mathOf(p).arcade?.[GAME_ID] ?? { best: 0, stars: 0, plays: 0 };
export const dailyBestOf = (p: Profile, at = Date.now()) => { const d = shifterOf(p).daily; return d && d.key === dayKey(at) ? d.best : 0; };

export type ShifterRun = {
  score: number; caught: number; wrong: number; bestCombo: number; ms: number; at: number; daily: boolean;
  /** each tap (a catch or a wrong tap), with the rung it was pitched at */
  answers: { key: string; ok: boolean; thinkMs: number; rung?: number }[];
};
export type ShifterOutcome = Settled & { profile: Profile; stars: 0 | 1 | 2 | 3; newBest: boolean; newDaily: boolean; best: number };

/** A finished round: skill memory for the subs already met, the record, and the practice payout. */
export function applyShifter(p0: Profile, run: ShifterRun): ShifterOutcome {
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
  // right catches warm the eggs like a trip's answers
  const done = settlePractice(p, { at: run.at, ms: run.ms, finished: true, stars, medals: stars === 3 ? ['three'] : [], right: run.caught, xp: () => Math.round((25 + stars * 12 + Math.min(20, run.caught)) * (p.settings.grown ? 0.8 : 1)) , treasure: treasureFor(run.score, STAR_AT[2]) });
  return { ...done, profile: p, stars, newBest, newDaily, best: rec.best };
}
