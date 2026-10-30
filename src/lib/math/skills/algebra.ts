// Expressions and equations, grades 3 to 8 (Common Core 3.OA.A.4, 4.OA.C.5, 5.OA.A.1-2, 6.EE.A.1-3,
// 6.EE.B.7-8, 7.EE.A.1, 7.EE.B.4, 8.EE.B.5, 8.F.B.4, 8.EE.C.8): missing numbers, number patterns, the
// order of operations, writing and working out expressions with letters, equal expressions (sharing out a
// times and gathering like terms), one-step and two-step equations, inequalities on a number line, slope
// from tables and graphs, and two equations at once. The area's home is the Star Lab, a sky observatory
// whose big golden balance is the picture behind every equation: a mystery box (the letter) and weights
// on one side, weights on the other, and whatever you do to one side you do to the other so it stays level.
//
// Inputs: the number pad (with a minus key and a point once answers can be negative or decimal), choices,
// and two of the area's own: a balance you take weights off both sides of ('balance', BalanceInput.svelte),
// and a number line you put a dot on, fill or leave open, and shade one way ('ray', RayInput.svelte).
// Pictures in the question (a table of x and y, a graph, a number line with a ray) are `alg` parts, and
// expressions are `expr` parts, so letters show in italics ("3n + 2").
//
// Every skill has six rungs (types.ts): rung 1 gentle (small numbers, the balance to help), rung 3 the
// grade-level core, rungs 4 to 6 the stretch inside the same standard (bigger numbers, more steps, the
// letter on the other side, decimals, and from grade 6 on negative answers). Each skill's comment says
// what its rungs mean. No generator ever draws again "until it's different": every choice comes from a
// range that already leaves out what it mustn't be, so a question is made in one go.
import type { Rng } from '../../engine/rng';
import { checkAnswer } from './fractions';
import { perRung, rungOf, type Choice, type Item, type Part, type Skill } from './types';

// ---------- pictures and specs ----------
export type Ineq = 'gt' | 'ge' | 'lt' | 'le';
export const INEQ_SIGN: Record<Ineq, string> = { gt: '>', ge: '≥', lt: '<', le: '≤' };
/** A picture in an algebra question: a table of x and y, the same as a graph (points joined by a line),
 *  a number line with a dot (filled or open) and a ray shaded one way, or a balance with boxes and weights. */
export type AlgPic =
  | { kind: 'table'; xs: number[]; ys: number[] }
  | { kind: 'graph'; xs: number[]; ys: number[] }
  | { kind: 'ray'; min: number; max: number; at: number; op: Ineq }
  | { kind: 'balance'; boxes: number; left: number; right: number; letter?: string };
/** the balance input: `boxes` mystery boxes and `left` weight with them, `right` weight on the other side;
 *  the answer is what one box weighs. `letter` names the box (x) in an equation; a plain box otherwise. */
export type BalanceSpec = { boxes: number; left: number; right: number; letter?: string };
/** the inequality input: the number line's ends (whole numbers, a tick at each) */
export type RaySpec = { min: number; max: number };

/** A choice id for an inequality: the sign and the number (gt:3 is x > 3). */
export const rayId = (op: Ineq, at: number) => `${op}:${at}`;
export function parseRay(id: string): { op: Ineq; at: number } | null {
  const [op, n] = id.split(':');
  return op in INEQ_SIGN && Number.isFinite(Number(n)) ? { op: op as Ineq, at: Number(n) } : null;
}
/** a picture in a few words, for results and battle cards */
export function algPicText(p: AlgPic): string {
  if (p.kind === 'table' || p.kind === 'graph') return `${p.kind === 'graph' ? 'graph' : 'table'}: ${p.xs.map((x, i) => `(${fm(x)}, ${fm(p.ys[i])})`).join(' ')}`;
  if (p.kind === 'ray') return `the line shows x ${INEQ_SIGN[p.op]} ${fm(p.at)}`;
  return `${p.boxes} ${p.boxes === 1 ? 'box' : 'boxes'}${p.left ? ` + ${p.left}` : ''} = ${p.right}`;
}

// ---------- little helpers ----------
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const int = (rng: Rng, lo: number, hi: number) => (hi <= lo ? lo : Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1))));
/** a decimal without float dust */
const dec = (x: number, places = 2) => Number(x.toFixed(places));
/** a number as it's written: −5 with a real minus sign, 2.5 */
export const fm = (n: number) => (n < 0 ? `−${dec(-n, 3)}` : String(dec(n, 3)));
const num = (n: number): Part => ({ t: 'num', n });
const op = (s: string): Part => ({ t: 'op', s });
const tx = (s: string): Part => ({ t: 'text', s });
const ex = (s: string): Part => ({ t: 'expr', s });
const alg = (pic: AlgPic): Part => ({ t: 'alg', pic });
const blank: Part = { t: 'blank' };
function shuffle<T>(rng: Rng, xs: readonly T[]): T[] { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** c times a letter as it's written: x, 3x, −x */
const term = (c: number, v: string) => (c === 1 ? v : c === -1 ? `−${v}` : `${fm(c)}${v}`);
/** "+ 3" or "− 3" after a term */
const plus = (n: number) => (n < 0 ? `− ${fm(-n)}` : `+ ${fm(n)}`);
const LETTERS = ['x', 'n', 'y', 'a', 'b', 'm'] as const;
/** Choices from a right answer and wrong ones (repeats and copies of the right one left out), shuffled. */
function choicesOf(rng: Rng, right: Part[], wrong: Part[][], key = (ps: Part[]) => JSON.stringify(ps)): Choice[] {
  const seen = new Set([key(right)]), out: Choice[] = [{ id: 'right', parts: right }];
  for (const w of wrong) { const k = key(w); if (seen.has(k) || out.length >= 4) continue; seen.add(k); out.push({ id: `w${out.length}`, parts: w }); }
  return shuffle(rng, out);
}
const exChoices = (rng: Rng, right: string, wrong: string[]) => choicesOf(rng, [ex(right)], wrong.map(w => [ex(w)]));
const check = (it: Item, a: Parameters<typeof checkAnswer>[1]) => checkAnswer(it.answer, a);
/** "so x = [ ]" after an equation */
const solveFor = (v: string): Part[] => [tx('so'), ex(`${v} =`), blank];

// ---------- missing numbers (3.OA.A.4, and 1.OA.D.8 for the gentle adding ones) ----------
// add · rungs: 1 sums to 10, the box second · 2 to 20, the box either side · 3 to 20 with take away too
// (□ − 5 = 9) · 4 to 100 in tens · 5 to 100, any · 6 both sides (7 + □ = 5 + 9) or hundreds in tens
// times · rungs: 1 times 2, 5 and 10, the box second · 2 tables to 5, either side · 3 every table, sharing
// too (□ ÷ 4 = 7) · 4 more sharing, the box first · 5 both sides (3 × □ = 2 × 6) · 6 tens (□ × 4 = 120)
// balance (the box on a balance: take the same off both sides) · rungs: 1 one box and up to 3, to 8 · 2 to
// 13 · 3 to 21 · 4 two boxes alone (□ + □ = 8) · 5 two boxes and weights · 6 three boxes and weights
export const alMissing: Skill = {
  id: 'al-missing', area: 'algebra', grade: 3, standard: '3.OA.A.4',
  name: 'Missing numbers', short: 'Missing', plain: 'Finds the unknown number in an equation, like 8 × □ = 48 or □ + 7 = 15, by doing the opposite.',
  input: 'number', fastMs: 8000,
  subs: [{ id: 'add', label: 'adding and taking away' }, { id: 'times', label: 'times and sharing' }, { id: 'balance', label: 'on the balance' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const base = { skill: 'al-missing', key: `al-missing:${sub}` };
    if (sub === 'balance') {
      const boxes = perRung(r, [1, 1, 1, 2, 2, 3]);
      const ans = int(rng, 1, perRung(r, [5, 8, 12, 8, 9, 8]));
      const left = r === 4 ? 0 : int(rng, r === 6 ? 0 : 1, perRung(r, [3, 5, 9, 0, 6, 6]));
      const right = boxes * ans + left;
      const lhs = [...Array(boxes).fill('□'), ...(left ? [String(left)] : [])].join(' + ');
      return {
        ...base, id: `al-missing:balance:${boxes}:${left}:${right}`, ask: 'What does one box weigh?',
        prompt: [ex(`${lhs} = ${right}`)], input: 'custom', custom: { name: 'balance', spec: { boxes, left, right } satisfies BalanceSpec },
        answer: { kind: 'number', value: ans }, weight: perRung(r, [1, 1, 2, 3, 3, 4]),
        explain: boxes === 1 ? `Take ${left} off both sides: the box weighs ${right} − ${left} = ${ans}.` : `${left ? `Take ${left} off both sides: ` : ''}${boxes} boxes weigh ${right - left}. Share it by ${boxes}: one box weighs ${ans}.`,
        trick: { name: 'Keep it level', say: 'Take the same off both sides and the balance stays level. When the boxes are on their own, the other side is what they weigh.' },
      };
    }
    if (sub === 'times') {
      const tables = perRung(r, [[2, 5, 10], [2, 3, 4, 5, 10], [2, 3, 4, 5, 6, 7, 8, 9, 10]]);
      const a = pick(rng, tables), b = int(rng, r === 1 ? 1 : 2, 10), P = a * b;
      const trick = { name: 'Think times', say: 'Times and sharing undo each other: to find the box in 6 × □ = 42, share 42 by 6.' };
      const w = perRung(r, [1, 2, 2, 3, 3, 4]);
      if (r === 6) {
        const big = 10 * b, PP = a * big, first = rng() < 0.5;
        return { ...base, id: `al-missing:times:${first ? 'b' : 'a'}${a}x${big}`, ask: 'What number goes in the box?', prompt: first ? [blank, op('×'), num(a), op('='), num(PP)] : [num(a), op('×'), blank, op('='), num(PP)], input: 'number', answer: { kind: 'number', value: big }, weight: w, explain: `${PP} ÷ ${a} = ${big}: ${a} × ${b} = ${P}, so ${a} × ${big} = ${PP}.`, trick };
      }
      if (r === 5 && rng() < 0.6) {
        // both sides: 3 × □ = 2 × 6 (another way to make the same number)
        const ds = Array.from({ length: P }, (_, i) => i + 1).filter(d => P % d === 0 && d > 1 && d < P && d !== a && d !== b && d <= 12 && P / d <= 12);
        if (ds.length) {
          const c = pick(rng, ds), d = P / c;
          return { ...base, id: `al-missing:times:${a}x?=${c}x${d}`, ask: 'What number goes in the box?', prompt: [num(a), op('×'), blank, op('='), num(c), op('×'), num(d)], input: 'number', answer: { kind: 'number', value: b }, weight: w, explain: `${c} × ${d} = ${P}. And ${P} ÷ ${a} = ${b}, so ${a} × ${b} = ${P} too.`, trick };
        }
      }
      const kinds = perRung(r, [[0], [0, 1], [0, 1, 2, 3], [2, 2, 3, 1], [0, 1, 2, 3], [0]]);
      const k = pick(rng, kinds);
      if (k === 2) return { ...base, id: `al-missing:times:?/${a}=${b}`, ask: 'What number goes in the box?', prompt: [blank, op('÷'), num(a), op('='), num(b)], input: 'number', answer: { kind: 'number', value: P }, weight: w, explain: `Sharing undoes times: ${b} × ${a} = ${P}, so ${P} ÷ ${a} = ${b}.`, trick };
      if (k === 3) return { ...base, id: `al-missing:times:${P}/?=${b}`, ask: 'What number goes in the box?', prompt: [num(P), op('÷'), blank, op('='), num(b)], input: 'number', answer: { kind: 'number', value: a }, weight: w, explain: `${P} ÷ ${b} = ${a}, so ${P} ÷ ${a} = ${b}.`, trick };
      return { ...base, id: `al-missing:times:${k}:${a}x?=${P}`, ask: 'What number goes in the box?', prompt: k === 1 ? [blank, op('×'), num(a), op('='), num(P)] : [num(a), op('×'), blank, op('='), num(P)], input: 'number', answer: { kind: 'number', value: b }, weight: w, explain: `${P} ÷ ${a} = ${b}, so ${a} × ${b} = ${P}.`, trick };
    }
    // adding and taking away
    const trick = { name: 'Undo it', say: 'Find a missing number by doing the opposite: take away to undo a plus, add to undo a take away.' };
    const w = perRung(r, [1, 1, 2, 3, 3, 4]);
    if (r === 6 && rng() < 0.5) {
      const b = int(rng, 5, 50), c = int(rng, 5, 50), a = int(rng, 1, b + c - 1), ans = b + c - a;
      return { ...base, id: `al-missing:add:${a}+?=${b}+${c}`, ask: 'What number goes in the box?', prompt: [num(a), op('+'), blank, op('='), num(b), op('+'), num(c)], input: 'number', answer: { kind: 'number', value: ans }, weight: w, explain: `${b} + ${c} = ${b + c}. Then ${b + c} − ${a} = ${ans}, so ${a} + ${ans} = ${b + c}.`, trick };
    }
    const unit = r === 4 || r === 6 ? 10 : 1, top = perRung(r, [10, 20, 20, 100, 100, 1000]);
    const S = unit * int(rng, 2, top / unit), A = unit * int(rng, 1, S / unit - 1);
    const k = pick(rng, perRung(r, [[0], [0, 1], [0, 1, 2, 3]]));
    if (k === 2) return { ...base, id: `al-missing:add:?-${A}=${S - A}`, ask: 'What number goes in the box?', prompt: [blank, op('−'), num(A), op('='), num(S - A)], input: 'number', answer: { kind: 'number', value: S }, weight: w, explain: `Undo the take away: ${S - A} + ${A} = ${S}. So ${S} − ${A} = ${S - A}.`, trick };
    if (k === 3) return { ...base, id: `al-missing:add:${S}-?=${S - A}`, ask: 'What number goes in the box?', prompt: [num(S), op('−'), blank, op('='), num(S - A)], input: 'number', answer: { kind: 'number', value: A }, weight: w, explain: `${S} − ${S - A} = ${A}: that's what was taken away.`, trick };
    return { ...base, id: `al-missing:add:${k}:${A}+?=${S}`, ask: 'What number goes in the box?', prompt: k === 1 ? [blank, op('+'), num(A), op('='), num(S)] : [num(A), op('+'), blank, op('='), num(S)], input: 'number', answer: { kind: 'number', value: S - A }, weight: w, explain: `${S} − ${A} = ${S - A}, so ${A} + ${S - A} = ${S}.`, trick };
  },
  check,
};

// ---------- number patterns and rules (4.OA.C.5) ----------
// rungs: 1 add 1 to 5 from a small start · 2 add up to 10 · 3 add or take away up to 12 · 4 doubling and
// tripling, or big steps (add 25) · 5 two-step rules (times 2, then add 1) · 6 growing jumps (+1, +2, +3)
// and square numbers. Subs: what comes next, a number missing in the middle, and which rule it is.
type Pattern = { seq: number[]; rule: string; wrong: string[]; why: (a: number, b: number) => string };
function pattern(rng: Rng, r: number): Pattern {
  const run = (start: number, f: (x: number, i: number) => number) => { const s = [start]; for (let i = 1; i < 5; i++) s.push(f(s[i - 1], i)); return s; };
  const add = (start: number, k: number): Pattern => ({ seq: run(start, x => x + k), rule: `+ ${k}`, wrong: [`+ ${k + 1}`, `− ${k}`, `× ${k}`, `+ ${Math.max(1, k - 1) === k ? k + 2 : k - 1}`], why: (a, b) => `${a} + ${k} = ${b}` });
  const sub = (start: number, k: number): Pattern => ({ seq: run(start, x => x - k), rule: `− ${k}`, wrong: [`+ ${k}`, `− ${k + 1}`, `÷ ${k}`, `− ${k + 2}`], why: (a, b) => `${a} − ${k} = ${b}` });
  const times = (start: number, k: number): Pattern => ({ seq: run(start, x => x * k), rule: `× ${k}`, wrong: [`+ ${start * k - start}`, `× ${k + 1}`, `+ ${k}`, `× ${k + 2}`], why: (a, b) => `${a} × ${k} = ${b}` });
  if (r === 1) return add(int(rng, 0, 10), int(rng, 1, 5));
  if (r === 2) return add(int(rng, 0, 20), int(rng, 2, 10));
  if (r === 3) { const k = int(rng, 2, 12); return rng() < 0.6 ? add(int(rng, 0, 30), k) : sub(k * 5 + int(rng, 0, 20), k); }
  if (r === 4) { const v = rng(); return v < 0.35 ? times(int(rng, 1, 5), 2) : v < 0.55 ? times(int(rng, 1, 2), 3) : add(int(rng, 10, 100), int(rng, 11, 25)); }
  if (r === 5) {
    const v = int(rng, 0, 2);
    if (v === 0) { const s = int(rng, 1, 4); return { seq: run(s, x => 2 * x + 1), rule: '× 2, then + 1', wrong: ['× 2', '+ 2', '× 2, then − 1'], why: (a, b) => `${a} × 2 + 1 = ${b}` }; }
    if (v === 1) { const s = int(rng, 2, 5); return { seq: run(s, x => 2 * x - 1), rule: '× 2, then − 1', wrong: ['× 2', '+ 1', '× 2, then + 1'], why: (a, b) => `${a} × 2 − 1 = ${b}` }; }
    const s = int(rng, 1, 3); return { seq: run(s, x => 3 * x - 1), rule: '× 3, then − 1', wrong: ['× 3', '+ 3', '× 2, then + 1'], why: (a, b) => `${a} × 3 − 1 = ${b}` };
  }
  if (rng() < 0.55) {
    const s = int(rng, 1, 10), j = int(rng, 1, 3);
    return { seq: run(s, (x, i) => x + j + i - 1), rule: 'the jump grows by 1', wrong: [`+ ${j}`, '× 2', `+ ${j + 1}`], why: (a, b) => `${a} + ${b - a} = ${b}` };
  }
  const k = int(rng, 1, 6);
  return { seq: run(k * k, (_, i) => (k + i) * (k + i)), rule: 'square numbers', wrong: [`+ ${2 * k + 1}`, '× 2', 'the jump grows by 1'], why: (_a, b) => `${Math.round(Math.sqrt(b))} × ${Math.round(Math.sqrt(b))} = ${b}` };
}
export const alPattern: Skill = {
  id: 'al-pattern', area: 'algebra', grade: 4, standard: '4.OA.C.5',
  name: 'Number patterns', short: 'Patterns', plain: 'Follows a number pattern from its rule (add 4, times 2, times 2 and add 1) and finds the rule from the numbers.',
  input: 'number', fastMs: 9000,
  subs: [{ id: 'next', label: 'what comes next' }, { id: 'gap', label: 'the missing one' }, { id: 'rule', label: 'what the rule is' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const p = pattern(rng, r), s = p.seq;
    const comma = (xs: Part[]) => xs.flatMap((x, i) => (i ? [op(','), x] : [x]));
    const base = { skill: 'al-pattern', key: `al-pattern:${sub}`, weight: perRung(r, [1, 1, 2, 3, 4, 4]), trick: { name: 'Find the jump', say: 'Look at the jump from each number to the next. The same jump every time? Do it again. If not, see if it doubles, or the jump grows.' } };
    if (sub === 'rule') {
      return { ...base, id: `al-pattern:rule:${s.join(',')}`, ask: 'What is the rule?', prompt: comma(s.map(num)), input: 'choice',
        choices: exChoices(rng, p.rule, p.wrong), answer: { kind: 'choice', id: 'right' }, explain: `The rule is ${p.rule}: ${p.why(s[0], s[1])}, ${p.why(s[1], s[2])}.` };
    }
    if (sub === 'gap') {
      const g = int(rng, 1, 3);
      return { ...base, id: `al-pattern:gap:${g}:${s.join(',')}`, ask: 'What number is missing?', prompt: comma(s.map((x, i) => (i === g ? blank : num(x)))), input: 'number',
        answer: { kind: 'number', value: s[g] }, explain: `The rule is ${p.rule}: ${p.why(s[g - 1], s[g])}.` };
    }
    return { ...base, id: `al-pattern:next:${s.join(',')}`, ask: 'What comes next?', prompt: [...comma(s.slice(0, 4).map(num)), op(','), blank], input: 'number',
      answer: { kind: 'number', value: s[4] }, explain: `The rule is ${p.rule}: ${p.why(s[3], s[4])}.` };
  },
  check,
};

// ---------- the order of operations and grouping (5.OA.A.1-2, 6.EE.A.1 for the squares) ----------
// times-first · rungs: 1 a + b × c with times 2, 5 or 10 · 2 tables to 5, take away too · 3 every table,
// divide too · 4 two times in one (2 × 3 + 4 × 5) · 5 four numbers (30 − 4 × 5 + 2) · 6 squares (3 + 2² × 4)
// brackets · rungs: 1 (a + b) × c with 2, 5, 10 · 2 either side, tables to 5 · 3 take away or divide in
// brackets · 4 brackets and another step · 5 two brackets ((3 + 5) × (6 − 2)) · 6 a square of brackets, or
// brackets inside brackets (2 × [3 + (4 × 5)])
// words (choices: write it down) · rungs: 1 "add, then times" · 2 "take away, then times" · 3 "times, then
// add" · 4 "times by the sum of" · 5 "the difference, divided by" · 6 "add to the product, then double it"
type Calc = { s: string; v: number; steps: string };
function timesFirst(rng: Rng, r: number): Calc {
  const tb = (lo = 2) => int(rng, lo, r <= 2 ? 5 : 10);
  if (r === 1) { const c = pick(rng, [2, 5, 10]), b = int(rng, 1, 9), a = int(rng, 1, 10); const first = rng() < 0.5; return { s: first ? `${a} + ${b} × ${c}` : `${b} × ${c} + ${a}`, v: a + b * c, steps: `Times first: ${b} × ${c} = ${b * c}. Then ${b * c} + ${a} = ${a + b * c}.` }; }
  if (r === 2) {
    const b = tb(), c = tb(), k = int(rng, 0, 2);
    if (k === 0) { const a = int(rng, 1, 20); return { s: `${a} + ${b} × ${c}`, v: a + b * c, steps: `Times first: ${b} × ${c} = ${b * c}. Then ${a} + ${b * c} = ${a + b * c}.` }; }
    if (k === 1) { const a = b * c + int(rng, 0, 15); return { s: `${a} − ${b} × ${c}`, v: a - b * c, steps: `Times first: ${b} × ${c} = ${b * c}. Then ${a} − ${b * c} = ${a - b * c}.` }; }
    const d = int(rng, 1, b * c); return { s: `${b} × ${c} − ${d}`, v: b * c - d, steps: `Times first: ${b} × ${c} = ${b * c}. Then ${b * c} − ${d} = ${b * c - d}.` };
  }
  if (r === 3) {
    const b = tb(), q = tb(), p = b * q, k = int(rng, 0, 2);
    if (k === 0) { const a = int(rng, 1, 30); return { s: `${a} + ${p} ÷ ${b}`, v: a + q, steps: `Divide first: ${p} ÷ ${b} = ${q}. Then ${a} + ${q} = ${a + q}.` }; }
    if (k === 1) { const a = q + int(rng, 0, 30); return { s: `${a} − ${p} ÷ ${b}`, v: a - q, steps: `Divide first: ${p} ÷ ${b} = ${q}. Then ${a} − ${q} = ${a - q}.` }; }
    const a = int(rng, 1, b * q); return { s: `${b} × ${q} − ${a}`, v: b * q - a, steps: `Times first: ${b} × ${q} = ${b * q}. Then ${b * q} − ${a} = ${b * q - a}.` };
  }
  if (r === 4) {
    let a = tb(), b = tb(), c = tb(), d = tb();
    if (rng() < 0.5) return { s: `${a} × ${b} + ${c} × ${d}`, v: a * b + c * d, steps: `Both times first: ${a} × ${b} = ${a * b} and ${c} × ${d} = ${c * d}. Then ${a * b} + ${c * d} = ${a * b + c * d}.` };
    if (a * b < c * d) [a, b, c, d] = [c, d, a, b];
    return { s: `${a} × ${b} − ${c} × ${d}`, v: a * b - c * d, steps: `Both times first: ${a} × ${b} = ${a * b} and ${c} × ${d} = ${c * d}. Then ${a * b} − ${c * d} = ${a * b - c * d}.` };
  }
  if (r === 5) {
    const b = tb(), c = tb(), d = int(rng, 1, 20);
    if (rng() < 0.5) { const a = b * c + int(rng, 0, 20); return { s: `${a} − ${b} × ${c} + ${d}`, v: a - b * c + d, steps: `Times first: ${b} × ${c} = ${b * c}. Then left to right: ${a} − ${b * c} = ${a - b * c}, and + ${d} makes ${a - b * c + d}.` }; }
    const q = tb(), p = b * q; return { s: `${p} ÷ ${b} + ${c} × ${d}`, v: q + c * d, steps: `Divide and times first: ${p} ÷ ${b} = ${q} and ${c} × ${d} = ${c * d}. Then ${q} + ${c * d} = ${q + c * d}.` };
  }
  const b = int(rng, 2, 5), c = int(rng, 1, 5);
  if (rng() < 0.5) { const a = int(rng, 1, 20); return { s: `${a} + ${b}² × ${c}`, v: a + b * b * c, steps: `The square first: ${b}² = ${b} × ${b} = ${b * b}. Then times: ${b * b} × ${c} = ${b * b * c}. Then ${a} + ${b * b * c} = ${a + b * b * c}.` }; }
  const bb = int(rng, 4, 10), cc = int(rng, 1, 5), dd = int(rng, 1, Math.max(1, Math.floor((bb * bb) / cc)));
  return { s: `${bb}² − ${cc} × ${dd}`, v: bb * bb - cc * dd, steps: `The square first: ${bb}² = ${bb * bb}. Then times: ${cc} × ${dd} = ${cc * dd}. Then ${bb * bb} − ${cc * dd} = ${bb * bb - cc * dd}.` };
}
function brackets(rng: Rng, r: number): Calc {
  const tb = (lo = 2) => int(rng, lo, r <= 2 ? 5 : 10);
  if (r === 1) { const c = pick(rng, [2, 5, 10]), a = int(rng, 1, 5), b = int(rng, 1, 5); return { s: `(${a} + ${b}) × ${c}`, v: (a + b) * c, steps: `Brackets first: ${a} + ${b} = ${a + b}. Then ${a + b} × ${c} = ${(a + b) * c}.` }; }
  if (r === 2) { const c = tb(), a = int(rng, 1, 9), b = int(rng, 1, 9), first = rng() < 0.5; return { s: first ? `${c} × (${a} + ${b})` : `(${a} + ${b}) × ${c}`, v: (a + b) * c, steps: `Brackets first: ${a} + ${b} = ${a + b}. Then ${a + b} × ${c} = ${(a + b) * c}.` }; }
  if (r === 3) {
    const c = tb();
    if (rng() < 0.5) { const b = int(rng, 1, 15), a = b + int(rng, 1, 9); return { s: `(${a} − ${b}) × ${c}`, v: (a - b) * c, steps: `Brackets first: ${a} − ${b} = ${a - b}. Then ${a - b} × ${c} = ${(a - b) * c}.` }; }
    const q = tb(), t = q * c, a = int(rng, 1, t - 1); return { s: `(${a} + ${t - a}) ÷ ${c}`, v: q, steps: `Brackets first: ${a} + ${t - a} = ${t}. Then ${t} ÷ ${c} = ${q}.` };
  }
  if (r === 4) {
    const c = tb(), a = int(rng, 1, 9), b = int(rng, 1, 9);
    if (rng() < 0.5) { const d = int(rng, 1, c * (a + b)); return { s: `${c} × (${a} + ${b}) − ${d}`, v: c * (a + b) - d, steps: `Brackets first: ${a} + ${b} = ${a + b}. Times: ${c} × ${a + b} = ${c * (a + b)}. Then − ${d} makes ${c * (a + b) - d}.` }; }
    const big = b + int(rng, 1, 9), d = int(rng, 1, 30); return { s: `${d} + (${big} − ${b}) × ${c}`, v: d + (big - b) * c, steps: `Brackets first: ${big} − ${b} = ${big - b}. Times: ${big - b} × ${c} = ${(big - b) * c}. Then ${d} + ${(big - b) * c} = ${d + (big - b) * c}.` };
  }
  if (r === 5) { const a = int(rng, 1, 9), b = int(rng, 1, 9), d = int(rng, 1, 9), c = d + int(rng, 1, 8); return { s: `(${a} + ${b}) × (${c} − ${d})`, v: (a + b) * (c - d), steps: `Both brackets first: ${a} + ${b} = ${a + b} and ${c} − ${d} = ${c - d}. Then ${a + b} × ${c - d} = ${(a + b) * (c - d)}.` }; }
  if (rng() < 0.5) { const a = int(rng, 1, 6), b = int(rng, 1, 6); return { s: `(${a} + ${b})²`, v: (a + b) ** 2, steps: `Brackets first: ${a} + ${b} = ${a + b}. Then the square: ${a + b} × ${a + b} = ${(a + b) ** 2}.` }; }
  const a = int(rng, 2, 5), b = int(rng, 1, 9), c = int(rng, 2, 6), d = int(rng, 2, 6);
  return { s: `${a} × [${b} + (${c} × ${d})]`, v: a * (b + c * d), steps: `The inside brackets first: ${c} × ${d} = ${c * d}. Then the big ones: ${b} + ${c * d} = ${b + c * d}. Then ${a} × ${b + c * d} = ${a * (b + c * d)}.` };
}
function orderWords(rng: Rng, r: number): { say: string; right: string; wrong: string[] } {
  const a = int(rng, 2, 12), b = int(rng, 2, 9), c = int(rng, 2, 9);
  if (r === 1) return { say: `Add ${a} and ${b}, then times by ${c}.`, right: `(${a} + ${b}) × ${c}`, wrong: [`${a} + ${b} × ${c}`, `${a} × ${c} + ${b}`, `${a} + ${b} + ${c}`] };
  if (r === 2) { const big = a + b; return { say: `Take ${b} away from ${big}, then times by ${c}.`, right: `(${big} − ${b}) × ${c}`, wrong: [`${big} − ${b} × ${c}`, `${big} × ${c} − ${b}`, `(${b} − ${big}) × ${c}`] }; }
  if (r === 3) return { say: `Times ${a} by ${b}, then add ${c}.`, right: `${a} × ${b} + ${c}`, wrong: [`${a} × (${b} + ${c})`, `${a} + ${b} × ${c}`, `(${a} + ${c}) × ${b}`] };
  if (r === 4) return { say: `Times ${c} by the sum of ${a} and ${b}.`, right: `${c} × (${a} + ${b})`, wrong: [`${c} × ${a} + ${b}`, `${c} + ${a} × ${b}`, `(${c} + ${a}) × ${b}`] };
  if (r === 5) { const big = a + b + 5; return { say: `Take ${b} from ${big}, then divide by ${c}.`, right: `(${big} − ${b}) ÷ ${c}`, wrong: [`${big} − ${b} ÷ ${c}`, `${big} ÷ ${c} − ${b}`, `${c} ÷ (${big} − ${b})`] }; }
  return { say: `Add ${a} to ${b} times ${c}, then double it.`, right: `2 × (${a} + ${b} × ${c})`, wrong: [`2 × ${a} + ${b} × ${c}`, `(2 × ${a} + ${b}) × ${c}`, `2 + ${a} + ${b} × ${c}`] };
}
export const alOrder: Skill = {
  id: 'al-order', area: 'algebra', grade: 5, standard: '5.OA.A.1',
  name: 'Order of operations', short: 'Order', plain: 'Works out expressions in the right order (brackets, then times and divide, then plus and take away) and writes them from words: 3 + 4 × 2 = 11.',
  input: 'number', fastMs: 10000,
  subs: [{ id: 'times-first', label: 'times before plus' }, { id: 'brackets', label: 'brackets first' }, { id: 'words', label: 'from words' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const trick = { name: 'Brackets first', say: 'Brackets first, then times and divide, then plus and take away, from left to right.' };
    const weight = perRung(r, [1, 2, 2, 3, 4, 4]);
    if (sub === 'words') {
      const w = orderWords(rng, r);
      return { skill: 'al-order', key: 'al-order:words', id: `al-order:words:${w.right}`, ask: 'Which one says it?', prompt: [tx(w.say)], input: 'choice',
        choices: exChoices(rng, w.right, w.wrong), answer: { kind: 'choice', id: 'right' }, weight, explain: `${w.say} That's ${w.right}: brackets keep together what's done first.`, trick };
    }
    const c = sub === 'brackets' ? brackets(rng, r) : timesFirst(rng, r);
    return { skill: 'al-order', key: `al-order:${sub}`, id: `al-order:${c.s}`, ask: 'Work it out.', prompt: [ex(c.s), op('='), blank], input: 'number',
      answer: { kind: 'number', value: c.v }, weight, explain: c.steps, trick };
  },
  check,
};

// ---------- writing expressions from words (6.EE.A.2a-b) ----------
// more or less · rungs: 1-2 "5 more than n", "n take away 5" · 3-4 "5 less than n" (not 5 − n!), "the sum
// of" · 5-6 "subtract n from 5", "increased by" · times · 1-2 "4 times n", "n shared by 4" · 3-4 "twice n",
// "half of n", "the product of" · 5-6 "the quotient of", "n squared" · two steps · 1-2 "5 more than twice n"
// · 3-4 "twice the sum of n and 5", "5 less than 3 times n" · 5-6 "the sum of n and 5, divided by 2",
// "4 times the difference of n and 5"
type WT = (k: number, v: string) => { say: string; right: string; wrong: string[] };
const WRITE: Record<string, WT[][]> = {
  'more-less': [
    [(k, v) => ({ say: `${k} more than ${v}`, right: `${v} + ${k}`, wrong: [`${v} − ${k}`, `${k}${v}`, `${k} − ${v}`] }),
      (k, v) => ({ say: `${v} take away ${k}`, right: `${v} − ${k}`, wrong: [`${k} − ${v}`, `${v} + ${k}`, `${v} ÷ ${k}`] }),
      (k, v) => ({ say: `add ${k} to ${v}`, right: `${v} + ${k}`, wrong: [`${k}${v}`, `${v} − ${k}`, `${k} − ${v}`] })],
    [(k, v) => ({ say: `${k} less than ${v}`, right: `${v} − ${k}`, wrong: [`${k} − ${v}`, `${v} + ${k}`, `${k}${v}`] }),
      (k, v) => ({ say: `the sum of ${v} and ${k}`, right: `${v} + ${k}`, wrong: [`${k}${v}`, `${v} − ${k}`, `${v} ÷ ${k}`] }),
      (k, v) => ({ say: `take ${v} away from ${k}`, right: `${k} − ${v}`, wrong: [`${v} − ${k}`, `${v} + ${k}`, `${k}${v}`] })],
    [(k, v) => ({ say: `subtract ${v} from ${k}`, right: `${k} − ${v}`, wrong: [`${v} − ${k}`, `${k} + ${v}`, `${v} ÷ ${k}`] }),
      (k, v) => ({ say: `${v} increased by ${k}`, right: `${v} + ${k}`, wrong: [`${k}${v}`, `${v} − ${k}`, `${k} − ${v}`] }),
      (k, v) => ({ say: `${v} decreased by ${k}`, right: `${v} − ${k}`, wrong: [`${k} − ${v}`, `${v} + ${k}`, `${v} ÷ ${k}`] })],
  ],
  times: [
    [(k, v) => ({ say: `${k} times ${v}`, right: `${k}${v}`, wrong: [`${v} + ${k}`, `${v} ÷ ${k}`, `${k} − ${v}`] }),
      (k, v) => ({ say: `${v} shared by ${k}`, right: `${v} ÷ ${k}`, wrong: [`${k} ÷ ${v}`, `${k}${v}`, `${v} − ${k}`] })],
    [(_k, v) => ({ say: `twice ${v}`, right: `2${v}`, wrong: [`${v} + 2`, `${v}²`, `${v} ÷ 2`] }),
      (_k, v) => ({ say: `half of ${v}`, right: `${v} ÷ 2`, wrong: [`2${v}`, `2 ÷ ${v}`, `${v} − 2`] }),
      (k, v) => ({ say: `the product of ${k} and ${v}`, right: `${k}${v}`, wrong: [`${k} + ${v}`, `${v} ÷ ${k}`, `${v} − ${k}`] }),
      (k, v) => ({ say: `${k} divided by ${v}`, right: `${k} ÷ ${v}`, wrong: [`${v} ÷ ${k}`, `${k}${v}`, `${k} − ${v}`] })],
    [(k, v) => ({ say: `the quotient of ${v} and ${k}`, right: `${v} ÷ ${k}`, wrong: [`${k} ÷ ${v}`, `${k}${v}`, `${v} − ${k}`] }),
      (_k, v) => ({ say: `${v} squared`, right: `${v}²`, wrong: [`2${v}`, `${v} + 2`, `${v} + ${v}`] }),
      (_k, v) => ({ say: `triple ${v}`, right: `3${v}`, wrong: [`${v} + 3`, `${v}³`, `${v} ÷ 3`] })],
  ],
  'two-step': [
    [(k, v) => ({ say: `${k} more than twice ${v}`, right: `2${v} + ${k}`, wrong: [`2(${v} + ${k})`, `${k}${v} + 2`, `2 + ${v} + ${k}`] }),
      (k, v) => ({ say: `3 times ${v}, plus ${k}`, right: `3${v} + ${k}`, wrong: [`3(${v} + ${k})`, `${k}${v} + 3`, `3 + ${v} + ${k}`] })],
    [(k, v) => ({ say: `twice the sum of ${v} and ${k}`, right: `2(${v} + ${k})`, wrong: [`2${v} + ${k}`, `${v} + 2${k}`, `2 + ${v} + ${k}`] }),
      (k, v) => ({ say: `${k} less than 3 times ${v}`, right: `3${v} − ${k}`, wrong: [`${k} − 3${v}`, `3(${v} − ${k})`, `3${v} + ${k}`] }),
      (k, v) => ({ say: `half of ${v}, plus ${k}`, right: `${v} ÷ 2 + ${k}`, wrong: [`(${v} + ${k}) ÷ 2`, `2${v} + ${k}`, `${v} ÷ ${k} + 2`] })],
    [(k, v) => ({ say: `the sum of ${v} and ${k}, divided by 2`, right: `(${v} + ${k}) ÷ 2`, wrong: [`${v} + ${k} ÷ 2`, `2(${v} + ${k})`, `${v} ÷ 2 + ${k}`] }),
      (k, v) => ({ say: `4 times the difference of ${v} and ${k}`, right: `4(${v} − ${k})`, wrong: [`4${v} − ${k}`, `4(${k} − ${v})`, `4 + ${v} − ${k}`] }),
      (k, v) => ({ say: `${k} less than ${v} squared`, right: `${v}² − ${k}`, wrong: [`${k} − ${v}²`, `(${v} − ${k})²`, `2${v} − ${k}`] })],
  ],
};
export const alWrite: Skill = {
  id: 'al-write', area: 'algebra', grade: 6, standard: '6.EE.A.2a',
  name: 'Write it with letters', short: 'Write it', plain: 'Writes an expression from words with a letter for the number: "5 less than n" is n − 5, "twice the sum of n and 3" is 2(n + 3).',
  input: 'choice', fastMs: 10000,
  subs: [{ id: 'more-less', label: 'more and less' }, { id: 'times', label: 'times and sharing' }, { id: 'two-step', label: 'two steps' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const tiers = WRITE[sub] ?? WRITE['more-less'];
    // the even rungs mix in the tier before now and then
    let tier = r <= 2 ? 0 : r <= 4 ? 1 : 2;
    if (r % 2 === 0 && tier > 0 && rng() < 0.3) tier--;
    const k = int(rng, 2, perRung(r, [9, 9, 12, 15, 20, 25])), v = pick(rng, r <= 2 ? ['n', 'x'] : LETTERS);
    const w = pick(rng, tiers[tier])(k, v);
    return {
      skill: 'al-write', key: `al-write:${sub}`, id: `al-write:${sub}:${w.say}`, ask: 'Which one says it with a letter?', prompt: [tx(`“${w.say}”`)], input: 'choice',
      choices: exChoices(rng, w.right, w.wrong), answer: { kind: 'choice', id: 'right' }, weight: perRung(r, [1, 2, 2, 3, 4, 4]),
      explain: `“${w.say}” is ${w.right}.`,
      trick: { name: 'Say it as a story', say: `Start with the number ${v}, then do to it what the words say, in order. "Less than" counts back from the number: 5 less than ${v} is ${v} − 5.` },
    };
  },
  check,
};

// ---------- working out expressions with letters (6.EE.A.2c) ----------
// one step · rungs: 1 n to 5, plus or times · 2 n to 10, take away too · 3 divide too, n to 12 · 4 n to 20
// · 5 bigger tables, and n² · 6 a half (n = 3.5)
// two steps · rungs: 1 2n + 1 with n to 5 · 2 kn + c · 3 kn − c · 4 brackets k(n + c) · 5 (n + c) ÷ k, n² + c
// · 6 k(n + c) − d
// two letters · rungs: 1 a + b · 2 a + 2b · 3 ab, 2a + b · 4 ab + c, a(b + 1) · 5 a² + b, 3a − 2b · 6 a(b + c),
// (a + b)²
type Ev = { e: string; v: number; how: string };
function evalOne(rng: Rng, r: number, v: string, n: number): Ev {
  const k = int(rng, 2, perRung(r, [5, 9, 9, 10, 12, 10]));
  const kinds = perRung(r, [[0, 2], [0, 1, 2], [0, 1, 2, 3], [0, 1, 2, 3], [2, 3, 4], [0, 1, 2]]);
  const kind = pick(rng, kinds);
  if (kind === 0) return { e: `${v} + ${k}`, v: n + k, how: `${fm(n)} + ${k} = ${fm(n + k)}` };
  if (kind === 1) { const kk = Math.min(k, Math.floor(n)); return kk >= 1 ? { e: `${v} − ${kk}`, v: dec(n - kk), how: `${fm(n)} − ${kk} = ${fm(n - kk)}` } : { e: `${v} + ${k}`, v: n + k, how: `${fm(n)} + ${k} = ${fm(n + k)}` }; }
  if (kind === 2) return { e: `${k}${v}`, v: dec(k * n), how: `${k}${v} means ${k} × ${v}: ${k} × ${fm(n)} = ${fm(k * n)}` };
  if (kind === 3) return { e: `${v} ÷ ${k}`, v: dec(n / k), how: `${fm(n)} ÷ ${k} = ${fm(n / k)}` };
  return { e: `${v}²`, v: n * n, how: `${v}² means ${v} × ${v}: ${n} × ${n} = ${n * n}` };
}
export const alEval: Skill = {
  id: 'al-eval', area: 'algebra', grade: 6, standard: '6.EE.A.2c',
  name: 'Work it out', short: 'Work it out', plain: 'Works out an expression for a value of its letter: 3n + 2 when n = 4 is 14 (times before plus).',
  input: 'number', fastMs: 10000,
  subs: [{ id: 'one-step', label: 'one step' }, { id: 'two-step', label: 'two steps' }, { id: 'two-letters', label: 'two letters' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const v = pick(rng, r <= 2 ? ['n', 'x'] : LETTERS);
    const base = { skill: 'al-eval', key: `al-eval:${sub}`, weight: perRung(r, [1, 2, 2, 3, 4, 4]), trick: { name: 'Swap in the number', say: 'Put the number where the letter is, then work it out: brackets first, then times, then plus. 3n means 3 × n.' } };
    let e: Ev, given: string | undefined, id: string | undefined;
    if (sub === 'two-letters') {
      const a = int(rng, 1, perRung(r, [5, 6, 9, 9, 10, 9])), b = int(rng, 1, perRung(r, [5, 6, 9, 9, 10, 9])), c = int(rng, 1, 9);
      const forms: Ev[][] = [
        [{ e: 'a + b', v: a + b, how: `${a} + ${b} = ${a + b}` }],
        [{ e: 'a + 2b', v: a + 2 * b, how: `2b = 2 × ${b} = ${2 * b}, then ${a} + ${2 * b} = ${a + 2 * b}` }, { e: '2a + b', v: 2 * a + b, how: `2a = 2 × ${a} = ${2 * a}, then ${2 * a} + ${b} = ${2 * a + b}` }],
        [{ e: 'ab', v: a * b, how: `ab means a × b: ${a} × ${b} = ${a * b}` }, { e: '2a + b', v: 2 * a + b, how: `2a = ${2 * a}, then ${2 * a} + ${b} = ${2 * a + b}` }],
        [{ e: `ab + ${c}`, v: a * b + c, how: `ab = ${a} × ${b} = ${a * b}, then + ${c} makes ${a * b + c}` }, { e: 'a(b + 1)', v: a * (b + 1), how: `brackets first: ${b} + 1 = ${b + 1}, then ${a} × ${b + 1} = ${a * (b + 1)}` }],
        [{ e: 'a² + b', v: a * a + b, how: `a² = ${a} × ${a} = ${a * a}, then + ${b} makes ${a * a + b}` }, ...(3 * a >= 2 * b ? [{ e: '3a − 2b', v: 3 * a - 2 * b, how: `3a = ${3 * a} and 2b = ${2 * b}, then ${3 * a} − ${2 * b} = ${3 * a - 2 * b}` }] : [])],
        [{ e: `a(b + ${c})`, v: a * (b + c), how: `brackets first: ${b} + ${c} = ${b + c}, then ${a} × ${b + c} = ${a * (b + c)}` }, { e: '(a + b)²', v: (a + b) ** 2, how: `brackets first: ${a} + ${b} = ${a + b}, then ${a + b} × ${a + b} = ${(a + b) ** 2}` }],
      ];
      e = pick(rng, forms[r - 1]); given = `a = ${a}, b = ${b}`; id = `al-eval:two:${e.e}:${a},${b}`;
    } else if (sub === 'two-step') {
      const n = int(rng, 1, perRung(r, [5, 10, 10, 12, 12, 15]));
      const k = int(rng, 2, perRung(r, [2, 5, 9, 9, 6, 9])), c = int(rng, 1, perRung(r, [3, 9, 12, 9, 12, 9]));
      if (r === 1) e = { e: `2${v} + 1`, v: 2 * n + 1, how: `2 × ${n} = ${2 * n}, then + 1 makes ${2 * n + 1}` };
      else if (r === 2) e = { e: `${k}${v} + ${c}`, v: k * n + c, how: `${k} × ${n} = ${k * n}, then + ${c} makes ${k * n + c}` };
      else if (r === 3) { const cc = Math.min(c, k * n); e = { e: `${k}${v} − ${cc}`, v: k * n - cc, how: `${k} × ${n} = ${k * n}, then − ${cc} makes ${k * n - cc}` }; }
      else if (r === 4) e = { e: `${k}(${v} + ${c})`, v: k * (n + c), how: `brackets first: ${n} + ${c} = ${n + c}, then ${k} × ${n + c} = ${k * (n + c)}` };
      else if (r === 5) {
        if (rng() < 0.5) { const t = k * int(rng, 2, 9), nn = Math.max(1, t - c), cc = t - nn; e = { e: `(${v} + ${cc}) ÷ ${k}`, v: t / k, how: `brackets first: ${nn} + ${cc} = ${t}, then ${t} ÷ ${k} = ${t / k}` }; given = `${v} = ${nn}`; id = `al-eval:two-step:${e.e}:${nn}`; }
        else e = { e: `${v}² + ${c}`, v: n * n + c, how: `${v}² = ${n} × ${n} = ${n * n}, then + ${c} makes ${n * n + c}` };
      } else { const d = int(rng, 1, k * (n + c)); e = { e: `${k}(${v} + ${c}) − ${d}`, v: k * (n + c) - d, how: `brackets first: ${n} + ${c} = ${n + c}, times ${k} is ${k * (n + c)}, then − ${d} makes ${k * (n + c) - d}` }; }
      given ??= `${v} = ${n}`; id ??= `al-eval:two-step:${e.e}:${n}`;
    } else {
      const n = r === 6 ? dec(int(rng, 1, 9) + 0.5, 1) : int(rng, 1, perRung(r, [5, 10, 12, 20, 12, 10]));
      e = evalOne(rng, r, v, n);
      // (divide only when it shares out evenly)
      if (e.e.includes('÷') && !Number.isInteger(e.v)) { const k = Number(e.e.split('÷ ')[1]); const nn = k * Math.max(1, Math.round(n / k)); e = { e: e.e, v: nn / k, how: `${nn} ÷ ${k} = ${nn / k}` }; given = `${v} = ${nn}`; id = `al-eval:one:${e.e}:${nn}`; }
      given ??= `${v} = ${fm(n)}`; id ??= `al-eval:one:${e.e}:${n}`;
    }
    return { ...base, id, ask: 'Swap in the number and work it out.', prompt: [tx('If'), ex(`${given},`), ex(`${e.e} =`), blank], input: 'number', answer: { kind: 'number', value: e.v }, explain: `${e.how}.` };
  },
  check,
};

// ---------- equal expressions: sharing out a times, gathering like terms (6.EE.A.3-4, 7.EE.A.1) ----------
// share (the distributive property) · rungs: 1 2(x + 3) = 2x + □ · 2 times up to 5 · 3 up to 10, either
// blank · 4 take away inside, 4(x − 2) · 5 two letters, 3(a + 2b) · 6 a number with the letter, 5(2x + 3)
// gather (like terms) · rungs: 1 2x + 3x · 2 three of them · 3 with a number, 4x + 3 + 2x · 4 take away,
// 7x − 2x · 5 two letters, 3x + 2y + x + 4y · 6 numbers too, 5x + 7 − 2x − 3
// factor (sharing back out) · rungs: 1 2x + 4 = 2(x + □) · 2 times to 5 · 3 the number outside, □(x + 3)
// · 4 take away · 5 a number with the letter inside, 6x + 9 = 3(2x + □) · 6 the biggest number that goes
// into both, 12x + 18 = □(2x + 3)
export const alEqual: Skill = {
  id: 'al-equal', area: 'algebra', grade: 6, standard: '6.EE.A.3',
  name: 'Equal expressions', short: 'Same value', plain: 'Writes expressions in another way with the same value: shares out a times (3(x + 4) = 3x + 12), gathers like terms (2x + 5x = 7x) and takes out a common number.',
  input: 'number', fastMs: 10000,
  subs: [{ id: 'share', label: 'sharing out a times' }, { id: 'gather', label: 'gathering like terms' }, { id: 'factor', label: 'taking out a number' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const v = pick(rng, r <= 2 ? ['x'] : ['x', 'n', 'y', 'a']);
    const weight = perRung(r, [1, 2, 3, 3, 4, 5]);
    const base = { skill: 'al-equal', key: `al-equal:${sub}`, weight };
    if (sub === 'gather') {
      const trick = { name: 'Gather like terms', say: `${v}'s go with ${v}'s and numbers with numbers: 2${v} and 5${v} make 7${v}, like 2 boxes and 5 boxes make 7 boxes.` };
      const a = int(rng, 1, perRung(r, [5, 6, 9, 9, 9, 9])), b = int(rng, 1, perRung(r, [5, 6, 9, 9, 9, 9]));
      if (r === 1) return { ...base, id: `al-equal:gather:${a}+${b}`, ask: 'Gather them up.', prompt: [ex(`${term(a, v)} + ${term(b, v)} =`), blank, ex(v)], input: 'number', answer: { kind: 'number', value: a + b }, explain: `${a} ${v}'s and ${b} more make ${a + b}: ${term(a + b, v)}.`, trick };
      if (r === 2) { const c = int(rng, 1, 5); return { ...base, id: `al-equal:gather:${a}+${b}+${c}`, ask: 'Gather them up.', prompt: [ex(`${term(a, v)} + ${term(b, v)} + ${term(c, v)} =`), blank, ex(v)], input: 'number', answer: { kind: 'number', value: a + b + c }, explain: `${a} + ${b} + ${c} = ${a + b + c}, so it's ${term(a + b + c, v)}.`, trick }; }
      if (r === 3) { const c = int(rng, 1, 12); return { ...base, id: `al-equal:gather:${a}+c${c}+${b}`, ask: 'Gather the like terms.', prompt: [ex(`${term(a, v)} + ${c} + ${term(b, v)} =`), blank, ex(`${v} + ${c}`)], input: 'number', answer: { kind: 'number', value: a + b }, explain: `The ${v}'s: ${a} + ${b} = ${a + b}. The number stays: ${term(a + b, v)} + ${c}.`, trick }; }
      if (r === 4) { const big = b + int(rng, 1, 9); return { ...base, id: `al-equal:gather:${big}-${b}`, ask: 'Gather them up.', prompt: [ex(`${term(big, v)} − ${term(b, v)} =`), blank, ex(v)], input: 'number', answer: { kind: 'number', value: big - b }, explain: `${big} ${v}'s take away ${b} leaves ${big - b}: ${term(big - b, v)}.`, trick }; }
      if (r === 5) { const c = int(rng, 1, 9), d = int(rng, 1, 9), w = v === 'y' ? 'x' : 'y'; return { ...base, id: `al-equal:gather:${a}${v}${c}${w}${b}${d}`, ask: 'Gather the like terms.', prompt: [ex(`${term(a, v)} + ${term(c, w)} + ${term(b, v)} + ${term(d, w)} =`), blank, ex(`${v} + ${term(c + d, w)}`)], input: 'number', answer: { kind: 'number', value: a + b }, explain: `${v}'s with ${v}'s: ${a} + ${b} = ${a + b}. ${w}'s with ${w}'s: ${c} + ${d} = ${c + d}. So ${term(a + b, v)} + ${term(c + d, w)}.`, trick }; }
      const big = b + int(rng, 1, 9), d = int(rng, 1, 9), c = d + int(rng, 1, 12);
      return { ...base, id: `al-equal:gather:${big}${v}+${c}-${b}-${d}`, ask: 'Gather the like terms.', prompt: [ex(`${term(big, v)} + ${c} − ${term(b, v)} − ${d} =`), ex(`${term(big - b, v)} +`), blank], input: 'number', answer: { kind: 'number', value: c - d }, explain: `${v}'s: ${big} − ${b} = ${big - b}. Numbers: ${c} − ${d} = ${c - d}. So ${term(big - b, v)} + ${c - d}.`, trick };
    }
    if (sub === 'factor') {
      const trick = { name: 'Share it back', say: 'Find a number that goes into both parts. Put it outside the brackets and what is left of each part inside.' };
      const a = int(rng, 2, perRung(r, [2, 5, 10, 9, 5, 6])), b = int(rng, 1, perRung(r, [5, 9, 10, 9, 5, 5]));
      if (r <= 2) return { ...base, id: `al-equal:factor:${a}(${v}+${b})`, ask: 'What goes in the box?', prompt: [ex(`${term(a, v)} + ${a * b} = ${a}(${v} +`), blank, ex(')')], input: 'number', answer: { kind: 'number', value: b }, explain: `${a * b} is ${a} × ${b}, so ${term(a, v)} + ${a * b} = ${a}(${v} + ${b}).`, trick };
      if (r === 3) return { ...base, id: `al-equal:factor:?(${v}+${b})=${a}`, ask: 'What goes in the box?', prompt: [ex(`${term(a, v)} + ${a * b} =`), blank, ex(`(${v} + ${b})`)], input: 'number', answer: { kind: 'number', value: a }, explain: `${a} × ${v} = ${term(a, v)} and ${a} × ${b} = ${a * b}: it's ${a}(${v} + ${b}).`, trick };
      if (r === 4) return { ...base, id: `al-equal:factor:${a}(${v}-${b})`, ask: 'What goes in the box?', prompt: [ex(`${term(a, v)} − ${a * b} = ${a}(${v} −`), blank, ex(')')], input: 'number', answer: { kind: 'number', value: b }, explain: `${a * b} is ${a} × ${b}, so ${term(a, v)} − ${a * b} = ${a}(${v} − ${b}).`, trick };
      const c = pick(rng, [2, 3, 5].filter(x => x !== b) as number[]);
      if (r === 5) return { ...base, id: `al-equal:factor:${a}(${c}${v}+${b})`, ask: 'What goes in the box?', prompt: [ex(`${term(a * c, v)} + ${a * b} = ${a}(${term(c, v)} +`), blank, ex(')')], input: 'number', answer: { kind: 'number', value: b }, explain: `${a} × ${b} = ${a * b}, so it's ${a}(${term(c, v)} + ${b}).`, trick };
      // the biggest: c and b share nothing, so a is the biggest number into both
      const bb = pick(rng, [1, 3, 5, 7].filter(x => x % c !== 0) as number[]);
      return { ...base, id: `al-equal:factor:?(${c}${v}+${bb})=${a}`, ask: 'What goes in the box?', prompt: [ex(`${term(a * c, v)} + ${a * bb} =`), blank, ex(`(${term(c, v)} + ${bb})`)], input: 'number', answer: { kind: 'number', value: a }, explain: `${a} goes into both: ${a} × ${term(c, v)} = ${term(a * c, v)} and ${a} × ${bb} = ${a * bb}.`, trick };
    }
    // share out
    const trick = { name: 'Share it out', say: 'The number outside times everything inside: 3(x + 4) is 3 × x and 3 × 4, so 3x + 12.' };
    const a = int(rng, 2, perRung(r, [3, 5, 10, 9, 6, 6])), b = int(rng, 1, perRung(r, [5, 9, 10, 9, 5, 5]));
    if (r <= 2 || (r === 3 && rng() < 0.5)) return { ...base, id: `al-equal:share:${a}(${v}+${b})`, ask: 'Share out the times.', prompt: [ex(`${a}(${v} + ${b}) = ${term(a, v)} +`), blank], input: 'number', answer: { kind: 'number', value: a * b }, explain: `${a} × ${v} is ${term(a, v)} and ${a} × ${b} is ${a * b}: ${term(a, v)} + ${a * b}.`, trick };
    if (r === 3) return { ...base, id: `al-equal:share:${a}(${v}+${b})x`, ask: 'Share out the times.', prompt: [ex(`${a}(${v} + ${b}) =`), blank, ex(`${v} + ${a * b}`)], input: 'number', answer: { kind: 'number', value: a }, explain: `${a} × ${v} is ${term(a, v)}: ${term(a, v)} + ${a * b}.`, trick };
    if (r === 4) return { ...base, id: `al-equal:share:${a}(${v}-${b})`, ask: 'Share out the times.', prompt: [ex(`${a}(${v} − ${b}) = ${term(a, v)} −`), blank], input: 'number', answer: { kind: 'number', value: a * b }, explain: `${a} × ${v} is ${term(a, v)} and ${a} × ${b} is ${a * b}: ${term(a, v)} − ${a * b}.`, trick };
    if (r === 5) { const w = v === 'b' ? 'c' : 'b', k = int(rng, 2, 5); return { ...base, id: `al-equal:share:${a}(${v}+${k}${w})`, ask: 'Share out the times.', prompt: [ex(`${a}(${v} + ${term(k, w)}) = ${term(a, v)} +`), blank, ex(w)], input: 'number', answer: { kind: 'number', value: a * k }, explain: `${a} × ${term(k, w)} is ${term(a * k, w)}: ${term(a, v)} + ${term(a * k, w)}.`, trick }; }
    const k = int(rng, 2, 5);
    return { ...base, id: `al-equal:share:${a}(${k}${v}+${b})`, ask: 'Share out the times.', prompt: [ex(`${a}(${term(k, v)} + ${b}) =`), blank, ex(`${v} + ${a * b}`)], input: 'number', answer: { kind: 'number', value: a * k }, explain: `${a} × ${term(k, v)} is ${term(a * k, v)}, and ${a} × ${b} is ${a * b}.`, trick };
  },
  check,
};

// ---------- one-step equations (6.EE.B.7, 7.EE.B.4 for the negative ones) ----------
// rungs: 1 to 10, on the balance (plus and times) · 2 to 20, on the balance · 3 to 100 · 4 bigger, the
// letter on the right (15 = x + 7) · 5 decimals (x + 2.5 = 7.25, 4x = 10) · 6 negative answers (x + 9 = 4)
export const alOne: Skill = {
  id: 'al-one', area: 'algebra', grade: 6, standard: '6.EE.B.7',
  name: 'One-step equations', short: 'One step', plain: 'Solves equations like x + 7 = 15, x − 4 = 9, 3x = 21 and x ÷ 4 = 5 by doing the same to both sides.',
  input: 'number', fastMs: 9000,
  subs: [{ id: 'plus', label: 'x + a' }, { id: 'minus', label: 'x − a' }, { id: 'times', label: 'times x' }, { id: 'divide', label: 'x divided' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const v = pick(rng, r <= 2 ? ['x'] : LETTERS);
    const base = { skill: 'al-one', key: `al-one:${sub}`, weight: perRung(r, [1, 2, 2, 3, 4, 4]), trick: { name: 'Same to both sides', say: 'Undo what was done to the letter, and do it to both sides: take away to undo a plus, add to undo a take away, divide to undo a times, times to undo a divide.' } };
    const top = perRung(r, [10, 20, 100, 500, 50, 20]);
    let x: number, a: number, eq: string, how: string;
    if (sub === 'times' || sub === 'divide') {
      a = int(rng, 2, perRung(r, [5, 5, 12, 25, 10, 9]));
      x = r === 5 ? dec(int(rng, 1, 19) / 2, 1) : r === 6 ? -int(rng, 1, 12) : int(rng, 1, Math.max(1, Math.floor(top / a)));
      if (sub === 'times') { const b = dec(a * x); eq = `${term(a, v)} = ${fm(b)}`; how = `Divide both sides by ${a}: ${v} = ${fm(b)} ÷ ${a} = ${fm(x)}.`; }
      else { const q = x; x = dec(q * a); eq = `${v} ÷ ${a} = ${fm(q)}`; how = `Times both sides by ${a}: ${v} = ${fm(q)} × ${a} = ${fm(x)}.`; }
    } else {
      a = r === 5 ? dec(int(rng, 1, 99) / 4, 2) : int(rng, 1, perRung(r, [9, 15, 60, 300, 0, 20]));
      x = r === 5 ? dec(int(rng, 1, 199) / 4, 2) : r === 6 ? -int(rng, 1, 15) : int(rng, 1, Math.max(1, top - a));
      if (sub === 'plus') { const b = dec(x + a); eq = r === 4 && rng() < 0.5 ? `${fm(b)} = ${v} + ${fm(a)}` : `${v} + ${fm(a)} = ${fm(b)}`; how = `Take ${fm(a)} off both sides: ${v} = ${fm(b)} − ${fm(a)} = ${fm(x)}.`; }
      else { const b = dec(x - a); if (b < 0 && r < 6) { x = dec(x + a); } const bb = dec(x - a); eq = r === 4 && rng() < 0.5 ? `${fm(bb)} = ${v} − ${fm(a)}` : `${v} − ${fm(a)} = ${fm(bb)}`; how = `Add ${fm(a)} to both sides: ${v} = ${fm(bb)} + ${fm(a)} = ${fm(x)}.`; }
    }
    const id = `al-one:${sub}:${eq}`;
    // the gentle rungs put a plus or a times on the balance: take the same off both sides
    if (r <= 2 && (sub === 'plus' || sub === 'times')) {
      const spec: BalanceSpec = sub === 'plus' ? { boxes: 1, left: a, right: dec(x + a), letter: v } : { boxes: a, left: 0, right: dec(a * x), letter: v };
      return { ...base, id, ask: `What is ${v}? Use the balance.`, prompt: [ex(eq)], input: 'custom', custom: { name: 'balance', spec }, answer: { kind: 'number', value: x }, explain: how };
    }
    return { ...base, id, ask: `What is ${v}?`, prompt: [ex(eq), ...solveFor(v)], input: 'number', answer: { kind: 'number', value: x }, explain: how };
  },
  check,
};

// ---------- inequalities on a number line (6.EE.B.8, 7.EE.B.4b) ----------
// read (which inequality does the line show?) · rungs: 1 > and < on 0 to 10 · 2 ≥ and ≤ too · 3 the same
// number in every choice · 4 a line from −10 to 10 · 5 written the other way round (3 < x) · 6 both
// draw (put the dot, fill it or not, shade a way) · rungs: 1 > and < on 0 to 10 · 2 all four signs · 3 the
// other way round (5 < x) · 4 −10 to 10 · 5 the other way round, −10 to 10 · 6 in words ("at least 4")
// solve (work it out, then draw it) · rungs: 1 x + 3 > 7 · 2 x − 2 ≤ 5 · 3 2x ≥ 10 · 4 3x + 1 < 13 · 5 an
// answer below zero · 6 x ÷ 2 + 1 ≥ 4, below zero too
const FLIP: Record<Ineq, Ineq> = { gt: 'lt', lt: 'gt', ge: 'le', le: 'ge' };
const OPEN: Record<Ineq, Ineq> = { gt: 'ge', ge: 'gt', lt: 'le', le: 'lt' };
const ineqText = (op: Ineq, at: number, v = 'x', back = false) => (back ? `${fm(at)} ${INEQ_SIGN[FLIP[op]]} ${v}` : `${v} ${INEQ_SIGN[op]} ${fm(at)}`);
const INEQ_WORDS: Record<Ineq, string> = { gt: 'more than', ge: 'at least', lt: 'less than', le: 'at most' };
export const alIneq: Skill = {
  id: 'al-ineq', area: 'algebra', grade: 6, standard: '6.EE.B.8',
  name: 'More or less', short: 'More or less', plain: 'Shows inequalities like x > 3 and x ≤ 5 on a number line (an open dot leaves the number out, a filled one counts it) and solves ones like x + 3 > 7.',
  input: 'custom', fastMs: 12000,
  subs: [{ id: 'read', label: 'read the line' }, { id: 'draw', label: 'draw it' }, { id: 'solve', label: 'solve and draw' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const neg = sub === 'solve' ? r >= 5 : r >= 4;
    const min = neg ? -10 : 0, max = 10;
    const signs: Ineq[] = r === 1 ? ['gt', 'lt'] : ['gt', 'ge', 'lt', 'le'];
    const o = pick(rng, signs);
    const at = int(rng, min + 1, max - 1);
    const base = { skill: 'al-ineq', key: `al-ineq:${sub}`, weight: perRung(r, [1, 2, 2, 3, 4, 4]), trick: { name: 'Open or filled', say: 'A filled dot counts the number too (≥ and ≤); an open dot leaves it out (> and <). Shade toward the numbers that work: bigger is to the right.' } };
    const wrongOf = (o2: Ineq, at2: number) => [rayId(FLIP[o2], at2), rayId(OPEN[o2], at2), rayId(FLIP[OPEN[o2]], at2), rayId(o2, at2 + (at2 < max - 1 ? 1 : -1))];
    const choiceFor = (id: string, back: boolean) => { const p = parseRay(id)!; return { id, parts: [ex(ineqText(p.op, p.at, 'x', back))] }; };
    const explainDraw = (o2: Ineq, at2: number) => `${ineqText(o2, at2)}: ${o2 === 'ge' || o2 === 'le' ? 'a filled dot' : 'an open dot'} at ${fm(at2)}, ${o2 === 'ge' || o2 === 'le' ? `because ${fm(at2)} counts` : `because ${fm(at2)} itself doesn't count`}, and shade to the ${o2 === 'gt' || o2 === 'ge' ? 'right (bigger)' : 'left (smaller)'}.`;
    if (sub === 'read') {
      const back = r >= 5 && rng() < (r === 5 ? 0.6 : 0.4);
      // rungs 3 up: every choice has the same number, so the dot and the way decide it
      const wrong = r >= 3 ? [rayId(FLIP[o], at), rayId(OPEN[o], at), rayId(FLIP[OPEN[o]], at)] : [rayId(FLIP[o], at), rayId(o, at + (at < max - 2 ? 2 : -2)), ...(r === 1 ? [rayId(FLIP[o], at + (at < max - 2 ? 2 : -2))] : [rayId(OPEN[o], at)])];
      const right = rayId(o, at);
      const cs = shuffle(rng, [right, ...wrong].filter((x, i, xs) => xs.indexOf(x) === i).map(id => ({ ...choiceFor(id, back && id === right), id: id === right ? 'right' : id })));
      return { ...base, id: `al-ineq:read:${right}:${back ? 'b' : ''}:${min}`, ask: 'Which one does the line show?', prompt: [alg({ kind: 'ray', min, max, at, op: o })], input: 'choice', choices: cs, answer: { kind: 'choice', id: 'right' }, explain: `The line shows ${ineqText(o, at)}${back ? ` (the same as ${ineqText(o, at, 'x', true)})` : ''}: ${explainDraw(o, at)}` };
    }
    const spec: RaySpec = { min, max };
    if (sub === 'draw') {
      const back = (r === 3 || r === 5) && rng() < 0.6, words = r === 6 && rng() < 0.6;
      const right = rayId(o, at);
      const prompt = words ? [tx(`x is ${INEQ_WORDS[o]}`), num(at)] : [ex(ineqText(o, at, 'x', back))];
      return { ...base, id: `al-ineq:draw:${right}:${back ? 'b' : words ? 'w' : ''}:${min}`, ask: 'Show it on the line: put the dot, fill it or not, and pick the way.', prompt, input: 'custom', custom: { name: 'ray', spec },
        choices: [right, ...wrongOf(o, at)].filter((x, i, xs) => xs.indexOf(x) === i).map(id => choiceFor(id, false)), answer: { kind: 'choice', id: right },
        explain: `${back ? `${ineqText(o, at, 'x', true)} is the same as ${ineqText(o, at)}. ` : words ? `${INEQ_WORDS[o]} ${at} is ${ineqText(o, at)}. ` : ''}${explainDraw(o, at)}` };
    }
    // solve, then draw (the letter's number never gets multiplied by a negative, so the sign never flips)
    const k = r >= 3 && r !== 5 ? int(rng, 2, r === 6 ? 2 : 5) : 1;
    const c = int(rng, 1, 9);
    // (halving at the top rung: an even number, so it comes out whole)
    const A = r === 6 && at % 2 !== 0 ? (at > 0 ? at - 1 : at + 1) : at;
    const right = rayId(o, A);
    let lhs: string, how: string, rhs: number;
    if (r === 6) { lhs = `x ÷ 2 ${plus(c)}`; rhs = A / 2 + c; how = `Take ${c} off both sides: x ÷ 2 ${INEQ_SIGN[o]} ${fm(A / 2)}. Times both by 2: x ${INEQ_SIGN[o]} ${fm(A)}.`; }
    else if (k > 1 && r === 4) { lhs = `${k}x ${plus(c)}`; rhs = k * A + c; how = `Take ${c} off both sides: ${k}x ${INEQ_SIGN[o]} ${fm(k * A)}. Divide both by ${k}: x ${INEQ_SIGN[o]} ${fm(A)}.`; }
    else if (k > 1) { lhs = `${k}x`; rhs = k * A; how = `Divide both sides by ${k}: x ${INEQ_SIGN[o]} ${fm(A)}.`; }
    else if (r === 2 || (r === 5 && rng() < 0.5)) { lhs = `x − ${c}`; rhs = A - c; how = `Add ${c} to both sides: x ${INEQ_SIGN[o]} ${fm(A)}.`; }
    else { lhs = `x + ${c}`; rhs = A + c; how = `Take ${c} off both sides: x ${INEQ_SIGN[o]} ${fm(A)}.`; }
    const shown = `${lhs} ${INEQ_SIGN[o]} ${fm(dec(rhs))}`;
    return { ...base, id: `al-ineq:solve:${shown}`, ask: 'Work it out, then show it on the line.', prompt: [ex(shown)], input: 'custom', custom: { name: 'ray', spec },
      choices: [right, ...wrongOf(o, A)].filter((x, i, xs) => xs.indexOf(x) === i).map(id => choiceFor(id, false)), answer: { kind: 'choice', id: right },
      explain: `${how} ${explainDraw(o, A)}` };
  },
  check,
};

// ---------- two-step equations (7.EE.B.4a) ----------
// rungs: 1 2x + b on the balance, small · 2 up to 3x, on the balance · 3 up to 5x, to 50 · 4 up to 10x, to
// 100 · 5 the letter on the right, or a decimal (2x + 1.5 = 7.5) · 6 negative answers (2x + 9 = 3)
export const alTwo: Skill = {
  id: 'al-two', area: 'algebra', grade: 7, standard: '7.EE.B.4a',
  name: 'Two-step equations', short: 'Two steps', plain: 'Solves equations like 2x + 3 = 11 and 3(x − 1) = 12: undo the plus or minus first, then the times.',
  input: 'number', fastMs: 12000,
  subs: [{ id: 'plus', label: 'ax + b' }, { id: 'minus', label: 'ax − b' }, { id: 'divide', label: 'x ÷ a + b' }, { id: 'brackets', label: 'a(x + b)' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const v = pick(rng, r <= 2 ? ['x'] : LETTERS);
    const a = int(rng, 2, perRung(r, [2, 3, 5, 10, 6, 6]));
    let b = r === 5 && sub !== 'divide' && sub !== 'brackets' && rng() < 0.5 ? dec(int(rng, 1, 19) / 2, 1) : int(rng, 1, perRung(r, [5, 9, 12, 20, 15, 12]));
    const x = r === 6 ? -int(rng, 1, 9) : int(rng, 1, perRung(r, [5, 8, 10, 12, 10, 9]));
    // (below the top rung nothing in the question is below zero: a take away stays smaller than the times)
    if (sub === 'minus' && r < 6 && b >= a * x) b = Math.max(1, a * x - 1) === a * x ? 0.5 : Math.max(1, a * x - 1);
    const base = { skill: 'al-two', key: `al-two:${sub}`, weight: perRung(r, [2, 2, 3, 4, 4, 5]), trick: { name: 'Undo in reverse', say: 'Undo the last thing done to the letter first: take off the plus or minus, then share out the times. Do each step to both sides.' } };
    let eq: string, how: string, ans = x;
    if (sub === 'minus') { const c = dec(a * x - b); eq = `${term(a, v)} − ${fm(b)} = ${fm(c)}`; how = `Add ${fm(b)} to both sides: ${term(a, v)} = ${fm(dec(c + b))}. Divide by ${a}: ${v} = ${fm(x)}.`; }
    else if (sub === 'divide') { ans = x * a; const c = x + b; eq = `${v} ÷ ${a} ${plus(b)} = ${fm(c)}`; how = `Take ${fm(b)} off both sides: ${v} ÷ ${a} = ${fm(x)}. Times both by ${a}: ${v} = ${fm(ans)}.`; }
    else if (sub === 'brackets') { const c = a * (x + b); eq = `${a}(${v} ${plus(b)}) = ${fm(c)}`; how = `Divide both sides by ${a}: ${v} ${plus(b)} = ${fm(x + b)}. Take ${fm(b)} off: ${v} = ${fm(x)}.`; }
    else { const c = dec(a * x + b); eq = `${term(a, v)} ${plus(b)} = ${fm(c)}`; how = `Take ${fm(b)} off both sides: ${term(a, v)} = ${fm(dec(c - b))}. Divide by ${a}: ${v} = ${fm(x)}.`; }
    if (r === 5 && !String(b).includes('.') && rng() < 0.5) { const [l, rr] = eq.split(' = '); eq = `${rr} = ${l}`; }
    const id = `al-two:${sub}:${eq}`;
    if (r <= 2 && sub === 'plus') {
      return { ...base, id, ask: `What is ${v}? Use the balance.`, prompt: [ex(eq)], input: 'custom', custom: { name: 'balance', spec: { boxes: a, left: b, right: a * x + b, letter: v } satisfies BalanceSpec }, answer: { kind: 'number', value: ans }, explain: how };
    }
    return { ...base, id, ask: `What is ${v}?`, prompt: [ex(eq), ...solveFor(v)], input: 'number', answer: { kind: 'number', value: ans }, explain: how };
  },
  check,
};

// ---------- slope and straight-line rules (8.EE.B.5-6, 8.F.B.4) ----------
// table / graph · rungs: 1 x from 0 by 1, slope 1 to 3, from 0 · 2 slope to 5, starting higher · 3 slope
// to 10 · 4 x goes up in 2s (rise ÷ run) · 5 x in 2s or 3s, from any start · 6 lines going down (a negative
// slope) · rule (y = □x + b, or y = mx + □, from a table) · rungs as the table's; from rung 3 the start too
type Line = { xs: number[]; ys: number[]; m: number; b: number; run: number };
function line(rng: Rng, r: number, graph: boolean): Line {
  const run = r >= 5 ? pick(rng, [1, 2, 3]) : r === 4 ? 2 : 1;
  const m = r === 6 ? -int(rng, 1, 4) : int(rng, 1, perRung(r, [3, 5, 10, 5, 5, 4]));
  const x0 = r >= 5 ? int(rng, 0, 3) : r >= 3 && !graph ? int(rng, 0, 2) : 0;
  // a downhill line starts high, so it stays on the page
  const b = r === 1 ? 0 : r === 6 ? -m * (x0 + 3 * run) + int(rng, 0, 4) : int(rng, 0, graph ? 5 : perRung(r, [0, 5, 10, 10, 12, 0]));
  const xs = [0, 1, 2, 3].map(i => x0 + i * run);
  return { xs, ys: xs.map(x => m * x + b), m, b, run };
}
export const alSlope: Skill = {
  id: 'al-slope', area: 'algebra', grade: 8, standard: '8.EE.B.5',
  name: 'Straight-line rules', short: 'Slope', plain: 'Finds the slope (how much y goes up for each 1 of x) from a table or a graph, and writes the rule y = mx + b.',
  input: 'number', fastMs: 14000,
  subs: [{ id: 'table', label: 'from a table' }, { id: 'graph', label: 'from a graph' }, { id: 'rule', label: 'the rule y = mx + b' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const L = line(rng, r, sub === 'graph');
    const pic = alg({ kind: sub === 'graph' ? 'graph' : 'table', xs: L.xs, ys: L.ys });
    const dy = L.ys[1] - L.ys[0];
    const why = L.run === 1 ? `Each time x goes up 1, y goes ${L.m < 0 ? 'down' : 'up'} ${fm(Math.abs(L.m))}: the slope is ${fm(L.m)}.` : `x goes up ${L.run} and y goes ${dy < 0 ? 'down' : 'up'} ${fm(Math.abs(dy))}: the slope is ${fm(dy)} ÷ ${L.run} = ${fm(L.m)}.`;
    const base = { skill: 'al-slope', key: `al-slope:${sub}`, weight: perRung(r, [2, 2, 3, 4, 4, 5]), trick: { name: 'Up over along', say: 'Slope is how far y goes up for each 1 that x goes along: the change in y divided by the change in x. Going down? It\'s a negative slope.' } };
    const id = `al-slope:${sub}:${L.xs.join(',')}:${L.ys.join(',')}`;
    if (sub === 'rule') {
      const askStart = r >= 3 && rng() < 0.5;
      if (askStart) return { ...base, id: `${id}:b`, ask: 'Finish the rule: what is y when x is 0?', prompt: [pic, ex(`y = ${term(L.m, 'x')} +`), blank], input: 'number', answer: { kind: 'number', value: L.b }, explain: `${why} Go back to x = 0: y = ${fm(L.b)}. So y = ${term(L.m, 'x')} ${plus(L.b)}.` };
      return { ...base, id: `${id}:m`, ask: 'Finish the rule: what times x?', prompt: [pic, ex('y ='), blank, ex(L.b ? `x ${plus(L.b)}` : 'x')], input: 'number', answer: { kind: 'number', value: L.m }, explain: `${why} So y = ${term(L.m, 'x')}${L.b ? ` ${plus(L.b)}` : ''}.` };
    }
    return { ...base, id, ask: r <= 2 ? 'How much does y go up each time x goes up 1?' : 'What is the slope?', prompt: [pic, ex('slope ='), blank], input: 'number', answer: { kind: 'number', value: L.m }, explain: why };
  },
  check,
};

// ---------- two equations at once (8.EE.C.8, light) ----------
// sum and difference (x + y = 10, x − y = 2) · rungs: 1 to 10, find x · 2 to 20, x or y · 3 to 40 · 4 x + 2y
// and x + y · 5 2x + y and x + y, bigger · 6 2x + 3y and 2x + y
// boxes (stars and moons on two balances) · rungs: 1 2s + m and s + m, small · 2-3 bigger · 4 3s + m · 5
// 3s + 2m and s + 2m · 6 bigger again
// same y (y = 2x + 1 and y = x + 4: where do they meet?) · rungs: 1 2x and x, small · 3 any slopes · 5 find
// y too · 6 bigger
export const alSystem: Skill = {
  id: 'al-system', area: 'algebra', grade: 8, standard: '8.EE.C.8',
  name: 'Two equations at once', short: 'Two at once', plain: 'Finds the numbers that make two equations true together, like x + y = 10 and x − y = 2 (x = 6, y = 4), by taking one from the other.',
  input: 'number', fastMs: 16000,
  subs: [{ id: 'sum-diff', label: 'sum and difference' }, { id: 'boxes', label: 'stars and moons' }, { id: 'same', label: 'where two lines meet' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const base = { skill: 'al-system', key: `al-system:${sub}`, weight: perRung(r, [3, 3, 4, 4, 5, 5]), trick: { name: 'Take one from the other', say: 'Line the two equations up and take one away from the other (or add them): one letter disappears, so you can find the other. Then put it back in.' } };
    const top = perRung(r, [5, 10, 20, 15, 20, 20]);
    if (sub === 'same') {
      const c = int(rng, 1, r <= 2 ? 1 : 3), a = c + int(rng, 1, r <= 2 ? 1 : 3), x = int(rng, 1, perRung(r, [5, 8, 10, 10, 12, 15])), b = int(rng, 0, 9), d = (a - c) * x + b, y = a * x + b;
      const askY = r >= 5 && rng() < 0.5;
      const e1 = `y = ${term(a, 'x')}${b ? ` + ${b}` : ''}`, e2 = `y = ${term(c, 'x')} + ${d}`;
      return { ...base, id: `al-system:same:${e1}|${e2}:${askY ? 'y' : 'x'}`, ask: askY ? 'Where do they meet? What is y there?' : 'Where do they meet? What is x there?', prompt: [ex(e1), tx('and'), ex(e2), ...solveFor(askY ? 'y' : 'x')], input: 'number', answer: { kind: 'number', value: askY ? y : x },
        explain: `They meet where ${term(a, 'x')}${b ? ` + ${b}` : ''} = ${term(c, 'x')} + ${d}. Take ${term(c, 'x')}${b ? ` and ${b}` : ''} off both sides: ${a - c === 1 ? `x = ${x}` : `${term(a - c, 'x')} = ${d - b}, so x = ${x}`}${askY ? `, and y = ${y}` : ''}.` };
    }
    if (sub === 'boxes') {
      const s = int(rng, 1, top), m = int(rng, 1, top);
      const p = perRung(r, [2, 2, 2, 3, 3, 3]), q = r >= 5 ? 2 : 1;
      const askMoon = r >= 2 && rng() < 0.4;
      const t1 = p * s + q * m, t2 = s + q * m;
      return { ...base, id: `al-system:boxes:${p}s+${q}m=${t1}|s+${q}m=${t2}:${askMoon ? 'm' : 's'}`, ask: askMoon ? 'Stars (s) and moons (m) on two balances. What does a moon weigh?' : 'Stars (s) and moons (m) on two balances. What does a star weigh?',
        prompt: [ex(`${term(p, 's')} + ${term(q, 'm')} = ${t1}`), tx('and'), ex(`s + ${term(q, 'm')} = ${t2}`), ...solveFor(askMoon ? 'm' : 's')], input: 'number', answer: { kind: 'number', value: askMoon ? m : s },
        explain: `Take the second from the first: ${p - 1 === 1 ? `s = ${s}` : `${term(p - 1, 's')} = ${t1 - t2}, so s = ${s}`}.${askMoon ? ` Then ${s} + ${term(q, 'm')} = ${t2}, so ${term(q, 'm')} = ${t2 - s} and m = ${m}.` : ''}` };
    }
    const y = int(rng, 1, top), x = y + int(rng, r <= 3 ? 1 : 0, top);
    const askY = r >= 2 && rng() < 0.4;
    if (r <= 3) {
      return { ...base, id: `al-system:sd:${x + y}|${x - y}:${askY ? 'y' : 'x'}`, ask: askY ? 'Both are true. What is y?' : 'Both are true. What is x?', prompt: [ex(`x + y = ${x + y}`), tx('and'), ex(`x − y = ${x - y}`), ...solveFor(askY ? 'y' : 'x')], input: 'number', answer: { kind: 'number', value: askY ? y : x },
        explain: `Add them: the y's cancel, so 2x = ${2 * x} and x = ${x}. Then ${x} + y = ${x + y}, so y = ${y}.` };
    }
    const [ca, cb, da, db] = r === 4 ? [1, 2, 1, 1] : r === 5 ? [2, 1, 1, 1] : [2, 3, 2, 1];
    const t1 = ca * x + cb * y, t2 = da * x + db * y;
    const e1 = `${term(ca, 'x')} + ${term(cb, 'y')} = ${t1}`, e2 = `${term(da, 'x')} + ${term(db, 'y')} = ${t2}`;
    const gone = ca === da ? 'x' : 'y';
    return { ...base, id: `al-system:sd:${e1}|${e2}:${askY ? 'y' : 'x'}`, ask: askY ? 'Both are true. What is y?' : 'Both are true. What is x?', prompt: [ex(e1), tx('and'), ex(e2), ...solveFor(askY ? 'y' : 'x')], input: 'number', answer: { kind: 'number', value: askY ? y : x },
      explain: `Take the second from the first: the ${gone}'s cancel, leaving ${gone === 'x' ? `${term(cb - db, 'y')} = ${t1 - t2}, so y = ${y}` : `${term(ca - da, 'x')} = ${t1 - t2}, so x = ${x}`}. Put it back in: ${gone === 'x' ? `x = ${x}` : `y = ${y}`}.` };
  },
  check,
};

export const ALGEBRA_SKILLS: Skill[] = [alMissing, alPattern, alOrder, alWrite, alEval, alEqual, alOne, alIneq, alTwo, alSlope, alSystem];
