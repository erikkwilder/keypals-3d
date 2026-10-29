// Skills: the general shape of a math question, so every area from counting to equations plugs in the
// same way. A skill makes items (questions) from a seeded random number generator, checks answers, and
// says how an item is answered (a number pad, a fraction pad, choices, a number line, a grid, or a custom
// input an area adds). Each skill has small "subs" (a denominator, a kind of comparison): memory, the
// picker and the garden work per sub, the way facts work per fact.
import type { Rng } from '../../engine/rng';
import type { Op } from '../facts';

/** Every part of K-8 math. The first four are the fact strands we have; the rest are new areas. */
export type AreaId = 'plus' | 'minus' | 'times' | 'share' | 'place' | 'fractions' | 'decimals' | 'measure' | 'shapes' | 'ratios' | 'integers' | 'algebra' | 'data';

/** How an item is answered. `custom` is a hook for inputs an area brings (clock hands, shapes). */
export type InputKind = 'number' | 'fraction' | 'choice' | 'numberline' | 'grid' | 'custom';

/** A fraction picture: a pie cut into `parts` slices, or a bar cut into `parts` pieces, `filled` of them shaded. */
export type Pic = { kind: 'pie' | 'bar'; parts: number; filled: number };

/** One piece of a question line. */
export type Part =
  | { t: 'text'; s: string }
  | { t: 'num'; n: number }
  | { t: 'frac'; n: number | null; d: number | null }
  | { t: 'op'; s: string }
  | { t: 'pic'; pic: Pic }
  /** where the answer goes (a number blank) */
  | { t: 'blank' };

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
  answer: Answer;
  /** how hard, 1 (gentle) to 5: a battle card's cheer comes from it */
  weight: number;
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
  input: InputKind;
  subs: SubSkill[];
  /** quick means starting to answer within this long (fractions take longer than facts) */
  fastMs: number;
  /** a new item: `level` 1 is gentle, 2 the full range */
  make(rng: Rng, sub: string, level: 1 | 2): Item;
  /** right? (equal fractions count: 2/4 for 1/2 is right unless the item asks for its own picture) */
  check(item: Item, given: Answer): boolean;
  /** fact strands keep their own memory and picker; this skill only describes them */
  facts?: Op;
};

export type Area = {
  id: AreaId; name: string; grades: string; blurb: string; color: string;
  /** banner picture */
  art: string;
  /** live: playable now; soon: listed for grown-ups, not built yet */
  live: boolean;
  /** the fact strand it is (the first four areas) */
  op?: Op;
};
