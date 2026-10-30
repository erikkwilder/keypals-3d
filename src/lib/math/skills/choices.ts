// Some questions are asked as choices instead of typed: three or four answers to tap, the right one among
// the mistakes children really make (adding the bottom numbers, counting the unshaded pieces, forgetting
// to multiply by the top). Quick to answer and a friendly way to meet a new kind of question. Typing the
// answer is still how a skill grows all the way to a bloom, so choices come up less as a skill grows, and
// never in a checkpoint or placement.
import type { Rng } from '../../engine/rng';
import type { Answer, Choice, FracPic, Item, Part } from './types';
import type { SkillLesson } from './course';
import { sameValue } from './fractions';

type F = { n: number; d: number };
/** the right choice's id in a question asked as choices */
export const CHOICE_RIGHT = 'right';
const fracsIn = (it: Item): F[] => it.prompt.flatMap(p => (p.t === 'frac' && p.n !== null && p.d !== null ? [{ n: p.n, d: p.d }] : []));
const numsIn = (it: Item): number[] => it.prompt.flatMap(p => (p.t === 'num' ? [p.n] : []));
/** the fraction picture in a question (pies, bars and sets: money pictures don't count) */
const picIn = (it: Item): FracPic | null => { for (const p of it.prompt) if (p.t === 'pic' && (p.pic.kind === 'pie' || p.pic.kind === 'bar' || p.pic.kind === 'set')) return p.pic; return null; };
/** the gap's own bottom number, for "what goes on top?" (a fraction with its top missing) */
const gapBottom = (it: Item) => { const g = it.prompt.find(p => p.t === 'frac' && p.n === null); return g && g.t === 'frac' ? g.d : null; };

/** Wrong fractions, the likely mistakes first. */
const WRONG_FRAC: Record<string, (it: Item, a: F) => F[]> = {
  'fr-name': (it, a) => { const p = picIn(it); const d = p?.parts ?? a.d, n = p?.filled ?? a.n; return [{ n: d - n, d }, { n, d: d - n }, { n: d, d: n }, { n, d: d + 1 }]; },
  'fr-unit': (_it, a) => [{ n: 1, d: a.d - 1 }, { n: 1, d: a.d + 1 }, { n: a.d - 1, d: a.d }, { n: a.d, d: 1 }],
  'fr-set': (it, a) => { const p = picIn(it); const k = p?.parts ?? a.d, f = p?.filled ?? a.n; return [{ n: k - f, d: k }, { n: f, d: k - f }, { n: k, d: f }, { n: f, d: k + 1 }]; },
  'fr-add': (it, a) => {
    const [x, y] = fracsIn(it);
    return x && y ? [{ n: x.n + y.n, d: x.d + y.d }, { n: x.n * y.n, d: x.d }, { n: x.n + y.n + 1, d: x.d }, { n: Math.max(1, x.n + y.n - 1), d: x.d }] : [];
  },
  'fr-sub': (it, a) => {
    const fs = fracsIn(it), ns = numsIn(it);
    if (ns[0] === 1 && fs[0]) { const f = fs[0]; return [{ n: f.n, d: f.d }, { n: 1, d: f.d }, { n: f.d - f.n + 1, d: f.d }, { n: f.d - f.n, d: f.d + 1 }]; }
    const [x, y] = fs;
    return x && y ? [{ n: x.n + y.n, d: x.d }, { n: x.n - y.n + 1, d: x.d }, { n: x.n, d: x.d }, { n: Math.max(1, x.n - y.n - 1), d: x.d }] : [];
  },
  'fr-times': (it, a) => {
    const k = numsIn(it)[0], f = fracsIn(it)[0];
    return k && f ? [{ n: k * f.n, d: k * f.d }, { n: k + f.n, d: f.d }, { n: f.n, d: k * f.d }, { n: k * f.n + 1, d: f.d }] : [];
  },
  'fr-unlike': (it, a) => {
    const [x, y] = fracsIn(it);
    return x && y ? [{ n: x.n + y.n, d: x.d + y.d }, { n: x.n + y.n, d: a.d }, { n: x.n + y.n, d: Math.max(x.d, y.d) }, { n: a.n + 1, d: a.d }] : [];
  },
};
const genericFrac = (a: F): F[] => [{ n: a.n + 1, d: a.d }, { n: a.n, d: a.d + 1 }, { n: Math.max(1, a.n - 1), d: a.d }, { n: a.d, d: a.n }];

/** Wrong whole numbers, the likely mistakes first. */
const WRONG_NUM: Record<string, (it: Item, v: number) => number[]> = {
  'fr-equal': (it, v) => {
    const f = fracsIn(it)[0], to = gapBottom(it);
    if (!f || !to) return [];
    return [f.n, f.n + (to - f.d), v + 1, v - 1, to];
  },
  'fr-unit': (it, v) => { const f = fracsIn(it)[0]; return [f?.d ?? v + 2, v + 1, v - 1, 1]; },
  'fr-set': (it, v) => {
    const f = fracsIn(it)[0], whole = numsIn(it)[0];
    if (!f || !whole) return [];
    return [whole / f.d, whole * f.n, whole - v, v + whole / f.d, f.d * f.n];
  },
  'fr-mixed': (it, v) => {
    const w = numsIn(it)[0], f = fracsIn(it)[0], to = gapBottom(it);
    if (f && w !== undefined && to && f.d === to) return [w * f.d, w + f.n, w * f.n + f.d, v + 1]; // mixed to a fraction
    if (f) { const ww = w ?? 1; return [f.n - ww, ww, f.d - v, v + 1]; } // a fraction to mixed: what's left over
    return [];
  },
};
const genericNum = (v: number) => [v + 1, v - 1, v + 2, v * 2, v + 10];

const fracPart = (f: F): Part[] => [{ t: 'frac', n: f.n, d: f.d }];
const numPart = (n: number): Part[] => [{ t: 'num', n }];
function shuffled<T>(rng: Rng, xs: T[]): T[] { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** The item asked as choices (the right answer and 2-3 likely mistakes, shuffled), or null if this kind
 *  of question can't be (a number line, choices already) or there aren't enough good wrong answers. */
export function asChoices(it: Item, rng: Rng, count = 4): Item | null {
  const a = it.answer;
  let opts: Part[][] = [];
  if (it.input === 'fraction' && a.kind === 'fraction') {
    const wrong = [...(WRONG_FRAC[it.skill]?.(it, a) ?? []), ...genericFrac(a)];
    const picked: F[] = [];
    for (const w of wrong) {
      if (!Number.isInteger(w.n) || !Number.isInteger(w.d) || w.d < 1 || w.n < 0 || w.d > 99 || w.n > 99) continue;
      // never a wrong answer that's really right (2/4 when the answer is 1/2), and no two worth the same
      if (sameValue(w, a) || picked.some(p => sameValue(p, w))) continue;
      picked.push(w);
      if (picked.length >= count - 1) break;
    }
    if (picked.length < 2) return null;
    opts = [fracPart(a), ...picked.map(fracPart)];
  } else if (it.input === 'number' && a.kind === 'number' && Number.isInteger(a.value) && a.value >= 0) {
    const v = a.value;
    const wrong = [...(WRONG_NUM[it.skill]?.(it, v) ?? []), ...genericNum(v)];
    const picked: number[] = [];
    for (const w of wrong) {
      if (!Number.isInteger(w) || w < 0 || w === v || picked.includes(w)) continue;
      picked.push(w);
      if (picked.length >= count - 1) break;
    }
    if (picked.length < 2) return null;
    opts = [numPart(v), ...picked.map(numPart)];
  } else return null;
  const order = shuffled(rng, opts.map((parts, i) => ({ id: i === 0 ? CHOICE_RIGHT : `w${i}`, parts })));
  return { ...it, input: 'choice', choices: order, answer: { kind: 'choice', id: CHOICE_RIGHT } };
}

/** How often a question is asked as choices: often while a kind is new, rarely once it's growing well,
 *  never in a checkpoint or placement (a test of what you can do on your own). */
export function choiceChance(stage: number, kind: SkillLesson['kind']): number {
  if (kind === 'check' || kind === 'placement') return 0;
  return stage <= 1 ? 0.35 : stage === 2 ? 0.15 : 0.05;
}

// ---- typing a choice ----
// Choices that are all numbers (or all fractions) can be typed as well as tapped: the number pad (or the
// fraction pad) stays under them, and a typed answer picks the choice it matches.
const numIn = (c: Choice): number | null => { const p = c.parts.length === 1 ? c.parts[0] : null; return p && p.t === 'num' ? p.n : null; };
const fracIn = (c: Choice): F | null => { const p = c.parts.length === 1 ? c.parts[0] : null; return p && p.t === 'frac' && p.n !== null && p.d !== null ? { n: p.n, d: p.d } : null; };

/** How a question asked as choices can be typed too: 'number', 'fraction', or not at all (words, signs,
 *  pictures: those are tapped). */
export function typedAs(it: Item): 'number' | 'fraction' | null {
  const cs = it.input === 'choice' ? it.choices ?? [] : [];
  if (!cs.length) return null;
  if (cs.every(c => numIn(c) !== null)) return 'number';
  if (cs.every(c => fracIn(c) !== null)) return 'fraction';
  return null;
}

/** The choices as fractions (the fraction pad uses their digits to know when a box is finished, so a
 *  child typing any of them gets all of it in). */
export function choiceFractions(it: Item): F[] {
  return (it.choices ?? []).flatMap(c => { const f = fracIn(c); return f ? [f] : []; });
}

/** The choice a typed answer means: the same number, or the same fraction (else one worth the same). */
export function choiceFor(it: Item, a: Answer): string | null {
  const cs = it.choices ?? [];
  if (a.kind === 'number') return cs.find(c => numIn(c) === a.value)?.id ?? null;
  if (a.kind === 'fraction') {
    const fs = cs.map(c => ({ id: c.id, f: fracIn(c) }));
    return (fs.find(x => x.f && x.f.n === a.n && x.f.d === a.d) ?? fs.find(x => x.f && sameValue(x.f, a)))?.id ?? null;
  }
  return null;
}

/** Typing a choice's number: 'pick' once it's a whole choice and no other choice goes on from it (or on
 *  Enter), 'wrong' once no choice starts that way (or on Enter), else 'wait' for the next digit. */
export function typedChoice(it: Item, text: string, enter = false): 'pick' | 'wrong' | 'wait' {
  if (!text) return 'wait';
  const ss = (it.choices ?? []).map(c => String(numIn(c)));
  const whole = ss.includes(text), more = ss.some(s => s !== text && s.startsWith(text));
  if (more && !enter) return 'wait';
  return whole ? 'pick' : 'wrong';
}
