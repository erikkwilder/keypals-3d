// Skills: the general shape of a math question, so every area from counting to equations plugs in the
// same way. A skill makes items (questions) from a seeded random number generator, checks answers, and
// says how an item is answered (a number pad, a fraction pad, choices, a number line, a grid, or a custom
// input an area adds). Each skill has small "subs" (a denominator, a kind of comparison): memory, the
// picker and the garden work per sub, the way facts work per fact.
//
// ---- for whoever adds an area: rungs, ability and pitch() ----
// RUNGS. A skill's difficulty is a ladder of six rungs: `make(rng, sub, rung)` with rung 1..6. Rung 1 is
// the gentlest version of the skill (small numbers, helper pictures), rung 3 the full grade-level range,
// and rungs 4 to 6 stretch it inside the same standard (bigger numbers, more steps, missing parts, closer
// choices, fewer helper pictures). Rungs never change WHICH sub is asked (memory picks that): they change
// how hard that sub's question is. Write what each rung means in a comment on the skill, take the rung
// through `rungOf()` (it clamps and rounds, and old saves' level 1 and 2 come in as rungs 1 and 2), and
// keep the rule every generator follows: never draw again "until it's different", so a question is made
// in one go whatever the random numbers are. The fuzz test (skills/rungs.test.ts) makes 200 items of
// every sub at every rung and checks each one with its own answer.
// ABILITY. Per player and per skill (fact strands too: add-facts, sub-facts, mult-facts, div-facts) the
// game keeps an estimate in rung units, `{ t, n, at }` (theta, how many answers it rests on, last used),
// in MathProgress.ability (skills/ability.ts). At theta = rung a child gets about 80% right:
// p = 1 / (1 + exp(-(1.4 * (theta - rung) + 1.39))). Every answer in every mode moves it (an Elo update
// with response time folded in); an unseen skill starts from the area's other skills (adjusted by grade
// order), from the grade the child plays at elsewhere, or gently.
// PITCH. Nothing calls `make` with a made-up level: everything asks `pitch(math, skill, target)` (or
// `pitchItem` for a memory key), which returns the rung whose expected success is closest to the target
// (practice 0.8, quick timed answers 0.9, placement 0.5), with a one-step jitter now and then. A new area
// gets all of this for free: give its skills a grade, write their six rungs, register them.
import type { Rng } from '../../engine/rng';
import type { Op } from '../facts';
import type { Fig } from '../shapes/fig';

/** Every part of K-8 math. The first four are the fact strands we have; the rest are new areas. */
export type AreaId = 'plus' | 'minus' | 'times' | 'share' | 'place' | 'fractions' | 'decimals' | 'measure' | 'shapes' | 'ratios' | 'integers' | 'algebra' | 'data';

/** How an item is answered. `custom` is a hook for inputs an area brings (clock hands, shapes). */
export type InputKind = 'number' | 'fraction' | 'choice' | 'numberline' | 'grid' | 'custom';

/** A fraction picture: a pie cut into `parts` slices, a bar cut into `parts` pieces, or a set of `parts`
 *  cupcakes, `filled` of them shaded (or iced). */
export type FracPic = { kind: 'pie' | 'bar' | 'set'; parts: number; filled: number };
/** Money and decimal pictures: coins (their values in cents, 100 for a dollar coin, -100 for a dollar
 *  bill), or a chocolate slab of 100 squares, `filled` of them still there (hundredths). */
export type Pic = FracPic | { kind: 'coins'; coins: number[] } | { kind: 'grid'; parts: 100; filled: number };

/** Pictures for negative numbers and the coordinate plane (skills/integers.ts, drawn by ui/IntPic):
 *  a thermometer reading `at`, a sea-level gauge with a Glimmer `at` a height (below 0 is under the
 *  water), a number line with dots and hops, and a coordinate plane with points (`seg`: a line joins
 *  the first two). Ticks every `step`, numbers written every `label`. */
export type IntPic =
  | { kind: 'thermo'; min: number; max: number; at: number; step: number; label: number }
  | { kind: 'depth'; min: number; max: number; at: number; step: number; label: number; who: 'swim' | 'fly' }
  | { kind: 'nline'; min: number; max: number; step: number; label: number; dots: { x: number; c: 'a' | 'b' | 'c'; tag?: string }[]; hops?: { a: number; b: number }[] }
  | { kind: 'plane'; xMin: number; xMax: number; yMin: number; yMax: number; pts: { x: number; y: number; c: 'a' | 'b' | 'c'; tag?: string }[]; seg?: boolean };

/** A number as base-ten blocks: thousands cubes, hundreds flats, tens rods and ones cubes. */
export type Blocks = { th?: number; h: number; t: number; o: number };

/** One piece of a question line. */
export type Part =
  | { t: 'text'; s: string }
  /** a number (`paren`: a negative one written in brackets inside a sum, 4 + (−3)) */
  | { t: 'num'; n: number; paren?: boolean }
  | { t: 'frac'; n: number | null; d: number | null }
  | { t: 'op'; s: string }
  | { t: 'pic'; pic: Pic }
  /** base-ten blocks (place value) */
  | { t: 'blocks'; b: Blocks }
  /** an amount of money: 35¢, or $1.35 from a dollar up (or when `dollars`) */
  | { t: 'money'; cents: number; dollars?: boolean }
  /** where the answer goes (a number blank) */
  | { t: 'blank' }
  /** a measuring picture (a clock, a ruler, a scale, a jug, squares, a box: skills/measure.ts) */
  | { t: 'meas'; m: import('./measure').MeasPic }
  /** a shapes picture: crystal shapes, angles, solids, boxes (math/shapes/fig.ts) */
  | { t: 'fig'; fig: Fig }
  /** a ratios picture: fruit on plates, a table, a graph, a map strip (skills/ratioPic.ts) */
  | { t: 'rpic'; pic: import('./ratioPic').RatioPic }
  /** a point on the coordinate plane, written (3, −2) */
  | { t: 'pt'; x: number; y: number }
  /** a negative-numbers picture (thermometer, sea level, number line, coordinate plane) */
  | { t: 'ipic'; pic: IntPic };

export type Choice = { id: string; parts: Part[] };

export type Answer =
  | { kind: 'number'; value: number }
  | { kind: 'fraction'; n: number; d: number }
  | { kind: 'choice'; id: string }
  | { kind: 'point'; x: number; y?: number };

export type LineSpec = { min: number; max: number; step: number; /** label every tick, or just the ends */ labels: 'ends' | 'all'; /** fractions: tick labels as n/d */ denom?: number };
export type GridSpec = { xMin: number; xMax: number; yMin: number; yMax: number };

export type Item = {
  skill: string;
  /** memory key: the skill and its sub (`fr-name:4`) */
  key: string;
  /** unique for this exact question (a missed one comes back as the same question) */
  id: string;
  /** what the player is asked: an instruction above, and the question line */
  ask: string;
  prompt: Part[];
  input: InputKind;
  choices?: Choice[];
  line?: LineSpec;
  grid?: GridSpec;
  /** a custom input's name and settings (areas register the component) */
  custom?: { name: string; spec: unknown };
  /** the number pad always has its minus key (negative numbers: the sign is part of the answer, so a
   *  positive answer mustn't give itself away), and the answer is checked with Check; 'decimal': a
   *  decimal point key too (decimals below zero) */
  signed?: boolean | 'decimal';
  answer: Answer;
  /** how hard, 1 (gentle) to 5: a battle card's cheer comes from it */
  weight: number;
  /** the rung it was made at (1..6), stamped by pitch() so the answer can move the ability */
  rung?: number;
  /** after a miss: the answer in words, and the trick */
  explain: string;
  trick?: { name: string; say: string };
};

export type SubSkill = { id: string; label: string };

export type Skill = {
  id: string;
  area: AreaId;
  /** the school grade it belongs to (0 = kindergarten) */
  grade: number;
  /** the Common Core standard it covers */
  standard: string;
  /** its name for kids, and what it means in plain words for grown-ups */
  name: string;
  plain: string;
  /** a word or two for its bed sign in the garden (the name if not given) */
  short?: string;
  input: InputKind;
  subs: SubSkill[];
  /** quick means starting to answer within this long (fractions take longer than facts) */
  fastMs: number;
  /** a new item at a rung, 1 (gentlest) to 6 (the stretch); see the top of this file */
  make(rng: Rng, sub: string, rung: number): Item;
  /** right? (equal fractions count: 2/4 for 1/2 is right unless the item asks for its own picture) */
  check(item: Item, given: Answer): boolean;
  /** fact strands keep their own memory and picker; this skill only describes them */
  facts?: Op;
};

export type Area = {
  id: AreaId; name: string; grades: string; blurb: string; color: string;
  /** banner picture */
  art: string;
  /** the sign on its garden plot (a fraction, a ruler...); the first letter of its name if not given */
  sign?: string;
  /** live: playable now; soon: listed for grown-ups, not built yet */
  live: boolean;
  /** the fact strand it is (the first four areas) */
  op?: Op;
};

/** The number of rungs on every skill's ladder. */
export const RUNGS = 6;
/** A rung as a whole number 1..6 (anything else is clamped; old level 1 and 2 come in as rungs 1 and 2). */
export const rungOf = (r: number): number => Math.max(1, Math.min(RUNGS, Math.round(Number.isFinite(r) ? r : 1)));
/** One value per rung: `perRung(r, [a, b, c])` is a at rung 1, b at 2, and c from rung 3 up. */
export const perRung = <T>(r: number, xs: readonly T[]): T => xs[Math.min(xs.length, rungOf(r)) - 1];
