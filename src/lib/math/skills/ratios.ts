// Ratios and percents, grades 6 and 7 (Common Core 6.RP.A.1-3, 7.RP.A.2-3 and a little of 7.G.A.1), told
// at the Juice Jungle's fruit stalls: ratio words ("for every 2 strawberries, 3 bananas"), ratio tables,
// double number lines, unit rates and best buys, percent as "out of 100", percent of a number, finding the
// whole, converting units, proportional or not (tables, graphs and the constant), percent up and down,
// sales, tax and tips, and scale drawings.
//
// Every skill has six rungs (types.ts): rung 1 gentle (one plate of fruit, friendly numbers, pictures),
// rung 3 the full grade-level range, rungs 4 to 6 the stretch (the other way round, back to one group,
// bigger numbers, cents, two steps). Each skill's comment says what its rungs mean. Each kind of question
// has its own trick, so a miss gets the help that fits it. No generator ever draws again "until it's
// different": every choice comes from a list (or a sum) that already leaves out what it mustn't be.
import type { Rng } from '../../engine/rng';
import { checkAnswer } from './fractions';
import { moneyText } from './decimals';
import { perRung, rungOf, type Answer, type Item, type Part, type Skill } from './types';
import { FRUIT, FRUITS, fruitWord, type Fruit, type RatioPic } from './ratioPic';

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const int = (rng: Rng, lo: number, hi: number) => Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** a decimal without float dust */
const dec = (x: number, places = 2) => Number(x.toFixed(places));
const tx = (s: string): Part => ({ t: 'text', s });
const num = (n: number): Part => ({ t: 'num', n: dec(n, 3) });
const op = (s: string): Part => ({ t: 'op', s });
const blank: Part = { t: 'blank' };
const pic = (p: RatioPic): Part => ({ t: 'rpic', pic: p });
const usd = (d: number): Part => ({ t: 'money', cents: Math.round(d * 100), dollars: true });
const pctP = (n: number): Part[] => [num(n), op('%')];
const n = (value: number): Answer => ({ kind: 'number', value: dec(value, 4) });
const $ = (d: number) => moneyText(Math.round(d * 100), true);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const many = (f: Fruit) => FRUIT[f].many;
/** two different fruits */
function twoFruits(rng: Rng): [Fruit, Fruit] { const i = int(rng, 0, 5); return [FRUITS[i], FRUITS[(i + int(rng, 1, 5)) % 6]]; }
/** three different fruits */
function threeFruits(rng: Rng): [Fruit, Fruit, Fruit] { const [f, g] = twoFruits(rng); return [f, g, pick(rng, FRUITS.filter(x => x !== f && x !== g))]; }
/** pairs with nothing to share (2 : 3, not 2 : 4), small to bigger */
const COPRIME: [number, number][] = [[1, 2], [2, 1], [1, 3], [3, 1], [2, 3], [3, 2], [3, 4], [4, 3], [2, 5], [5, 2], [3, 5], [5, 3], [4, 5], [5, 4], [1, 4], [4, 1]];
const coprime = (rng: Rng, max: number) => pick(rng, COPRIME.filter(([a, b]) => a <= max && b <= max));
const yesNo = [{ id: 'yes', parts: [tx('Yes, proportional')] }, { id: 'no', parts: [tx('No')] }];

// ---------- ratio words ----------
// rungs: 1 one plate of fruit: "for every 2 strawberries, how many bananas?" · 2 one plate, the ratio said
// the other way ("2 to what?") · 3 two or three plates: count them all (6 : 9) · 4 order matters: the second
// fruit first · 5 the plates tipped together: back to one group · 6 three kinds of fruit, two of them asked
export const rtRatio: Skill = {
  id: 'rt-ratio', area: 'ratios', grade: 6, standard: '6.RP.A.1',
  name: 'Ratio words', short: 'Ratios', plain: 'Uses ratio words: "for every 2 strawberries there are 3 bananas", strawberries to bananas is 2 : 3, and strawberries to all the fruit is 2 : 5.',
  input: 'number', fastMs: 8000,
  subs: [{ id: 'pic', label: 'from a picture' }, { id: 'words', label: 'in words' }, { id: 'whole', label: 'part to whole' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const [f, g, h] = threeFruits(rng);
    const top = perRung(r, [3, 4, 4, 4, 4, 3]);
    const a = int(rng, 1, top), b = int(rng, 1, top);
    const base = { skill: 'rt-ratio', key: `rt-ratio:${sub}`, input: 'number' as const };
    const order = { name: 'Order matters', say: 'A ratio goes in the order of its words: the thing named first comes first.' };
    if (sub === 'pic') {
      if (r >= 6) {
        const c = int(rng, 1, 3), k = int(rng, 1, 2), second = rng() < 0.5;
        const x = second ? b : a, xf = second ? g : f;
        return { ...base, id: `rt-ratio:pic3:${f}${a}${g}${b}${h}${c}x${k}:${second ? 1 : 0}`, ask: `${cap(many(xf))} to ${many(h)}?`,
          prompt: [pic({ kind: 'fruit', sets: [{ f, n: a }, { f: g, n: b }, { f: h, n: c }], plates: k }), num(k * x), op(':'), blank], answer: n(k * c), weight: 4,
          explain: `${k * x} ${fruitWord(xf, k * x)} and ${k * c} ${fruitWord(h, k * c)}: ${k * x} : ${k * c}. The ${many(second ? f : g)} don't count here.`,
          trick: { name: 'Only the two you need', say: 'Count just the two fruits the question names, in its order. Leave the other one out.' } };
      }
      if (r === 5) {
        const k = int(rng, 2, 3);
        return { ...base, id: `rt-ratio:back:${f}${a}${g}${b}x${k}`, ask: `All mixed up! For every ${a} ${fruitWord(f, a)}, how many ${many(g)}?`,
          prompt: [pic({ kind: 'fruit', sets: [{ f, n: k * a }, { f: g, n: k * b }] }), num(a), op(':'), blank], answer: n(b), weight: 4,
          explain: `${k * a} ${fruitWord(f, k * a)} and ${k * b} ${fruitWord(g, k * b)} make ${k} groups of ${a} and ${b}. So for every ${a}, ${b}.`,
          trick: { name: 'Split into groups', say: `Make ${k} equal groups: ${k * a} ÷ ${k} = ${a}, and ${k * b} ÷ ${k} = ${b}.` } };
      }
      const k = r <= 2 ? 1 : int(rng, 2, 3);
      const p = pic({ kind: 'fruit', sets: [{ f, n: a }, { f: g, n: b }], plates: k });
      if (r === 4) return { ...base, id: `rt-ratio:rev:${f}${a}${g}${b}x${k}`, ask: `${cap(many(g))} to ${many(f)}?`, prompt: [p, blank, op(':'), num(k * a)], answer: n(k * b), weight: 3,
        explain: `${cap(many(g))} come first: ${k * b} ${fruitWord(g, k * b)} to ${k * a} ${fruitWord(f, k * a)}, so ${k * b} : ${k * a}.`, trick: order };
      if (r === 3) return { ...base, id: `rt-ratio:all:${f}${a}${g}${b}x${k}`, ask: `Count them all. ${cap(many(f))} to ${many(g)}?`, prompt: [p, num(k * a), op(':'), blank], answer: n(k * b), weight: 2,
        explain: `${k} plates of ${b} ${fruitWord(g, b)}: ${k * b}. So ${k * a} : ${k * b}.`, trick: { name: 'Count by groups', say: `Every plate has ${b} ${fruitWord(g, b)}: count by ${b}s.` } };
      return { ...base, id: `rt-ratio:one:${f}${a}${g}${b}:${r}`, ask: r === 1 ? `For every ${a} ${fruitWord(f, a)}, how many ${many(g)}?` : `${cap(many(f))} to ${many(g)} is ${a} to what?`, prompt: [p, num(a), op(':'), blank], answer: n(b), weight: 1,
        explain: `On the plate: ${a} ${fruitWord(f, a)} and ${b} ${fruitWord(g, b)}. ${a} : ${b}.`,
        trick: { name: 'For every', say: `Look at one plate: for every ${a} ${fruitWord(f, a)} there ${b === 1 ? 'is' : 'are'} ${b} ${fruitWord(g, b)}.` } };
    }
    if (sub === 'words') {
      const [p, q] = coprime(rng, perRung(r, [3, 4, 5, 5, 5, 5]));
      const k = int(rng, 2, perRung(r, [2, 2, 3, 4, 5, 6]));
      if (r >= 6) return { ...base, id: `rt-ratio:wback:${f}${p}${g}${q}x${k}`, ask: `For every ${p} ${fruitWord(f, p)} there ${q === 1 ? 'is' : 'are'} ${q} ${fruitWord(g, q)}. There are ${k * q} ${many(g)}. How many ${many(f)}?`,
        prompt: [num(p), op(':'), num(q), op('='), blank, op(':'), num(k * q)], answer: n(k * p), weight: 4,
        explain: `${k * q} ${many(g)} is ${k} groups of ${q}. ${k} groups of ${p} ${fruitWord(f, p)}: ${k * p}.`,
        trick: { name: 'How many groups?', say: `Find how many groups there are (${k * q} ÷ ${q} = ${k}), then times the other number by it.` } };
      if (r === 5) return { ...base, id: `rt-ratio:wscale:${f}${p}${g}${q}x${k}`, ask: `For every ${p} ${fruitWord(f, p)} there ${q === 1 ? 'is' : 'are'} ${q} ${fruitWord(g, q)}. There are ${k * p} ${many(f)}. How many ${many(g)}?`,
        prompt: [num(p), op(':'), num(q), op('='), num(k * p), op(':'), blank], answer: n(k * q), weight: 4,
        explain: `${k * p} ${many(f)} is ${k} groups of ${p}, so ${k} groups of ${q}: ${k * q} ${many(g)}.`,
        trick: { name: 'How many groups?', say: `Find how many groups there are (${k * p} ÷ ${p} = ${k}), then times the other number by it.` } };
      if (r === 4) return { ...base, id: `rt-ratio:wsimp:${f}${p}${g}${q}x${k}`, ask: `A bowl has ${k * p} ${many(f)} and ${k * q} ${many(g)}. For every ${p} ${fruitWord(f, p)}, how many ${many(g)}?`,
        prompt: [num(k * p), op(':'), num(k * q), op('='), num(p), op(':'), blank], answer: n(q), weight: 3,
        explain: `${k * p} : ${k * q} is ${k} groups of ${p} : ${q}. So for every ${p}, ${q}.`,
        trick: { name: 'Share both the same', say: `Divide both numbers by the same number (${k}): ${k * p} ÷ ${k} = ${p} and ${k * q} ÷ ${k} = ${q}.` } };
      const x = r === 3 ? k * p : p, y = r === 3 ? k * q : q;
      if (r === 2) return { ...base, id: `rt-ratio:wrev:${f}${x}${g}${y}`, ask: `A smoothie has ${x} ${x === 1 ? 'scoop' : 'scoops'} of ${FRUIT[f].one} for every ${y} of ${FRUIT[g].one}. ${cap(FRUIT[g].one)} to ${FRUIT[f].one}?`,
        prompt: [blank, op(':'), num(x)], answer: n(y), weight: 2, explain: `${cap(FRUIT[g].one)} first: ${y} : ${x}.`, trick: order };
      return { ...base, id: `rt-ratio:w:${f}${x}${g}${y}:${r}`, ask: r === 1 ? `A smoothie has ${x} ${x === 1 ? 'scoop' : 'scoops'} of ${FRUIT[f].one} for every ${y} of ${FRUIT[g].one}. ${cap(FRUIT[f].one)} to ${FRUIT[g].one}?` : `A bowl has ${x} ${many(f)} and ${y} ${many(g)}. ${cap(many(f))} to ${many(g)}?`,
        prompt: [num(x), op(':'), blank], answer: n(y), weight: r === 1 ? 1 : 2, explain: `${cap(FRUIT[f].one)} first, then ${FRUIT[g].one}: ${x} : ${y}.`, trick: order };
    }
    // part to whole
    const all = { name: 'Count them all', say: 'Part to whole: the whole is every fruit, so add the parts together.' };
    if (r >= 5) {
      const [p, q] = coprime(rng, 5), k = int(rng, 2, r === 5 ? 5 : 8), w = p + q;
      if (r === 6) return { ...base, id: `rt-ratio:split:${f}${p}${g}${q}x${k}`, ask: `${cap(many(f))} to ${many(g)} is ${p} : ${q}. There are ${k * w} fruits in all. How many ${many(f)}?`,
        prompt: [num(p), op(':'), num(q), tx(`· ${k * w} in all`), op('→'), blank, tx(many(f))], answer: n(k * p), weight: 5,
        explain: `Every group has ${p} + ${q} = ${w} fruits. ${k * w} ÷ ${w} = ${k} groups, so ${k} × ${p} = ${k * p} ${many(f)}.`,
        trick: { name: 'Fruits in a group', say: `Add the parts to see how big one group is (${w}), find how many groups, then times.` } };
      return { ...base, id: `rt-ratio:outof:${f}${p}${w}x${k}`, ask: `${p} of every ${w} fruits are ${many(f)}. There are ${k * w} fruits. How many are ${many(f)}?`,
        prompt: [num(p), op(':'), num(w), op('='), blank, op(':'), num(k * w)], answer: n(k * p), weight: 4,
        explain: `${k * w} fruits is ${k} groups of ${w}, and each group has ${p} ${fruitWord(f, p)}: ${k * p}.`,
        trick: { name: 'How many groups?', say: `${k * w} ÷ ${w} = ${k} groups. Times ${p} by ${k}.` } };
    }
    const k = r === 4 ? int(rng, 2, 3) : 1;
    const p1 = pic({ kind: 'fruit', sets: [{ f, n: a }, { f: g, n: b }], plates: k });
    if (r === 3) return { ...base, input: 'fraction', id: `rt-ratio:frac:${f}${a}${g}${b}`, ask: `What fraction of the fruit is ${many(f)}?`, prompt: [p1], answer: { kind: 'fraction', n: a, d: a + b }, weight: 3,
      explain: `${a} of the ${a + b} fruits are ${many(f)}: ${a}/${a + b}.`, trick: { name: 'Part over whole', say: `The top is the part (${a}). The bottom is all the fruit: ${a} + ${b} = ${a + b}.` } };
    return { ...base, id: `rt-ratio:whole:${f}${a}${g}${b}x${k}:${r}`, ask: r === 2 ? `${a} ${fruitWord(f, a)} and ${b} ${fruitWord(g, b)}. ${cap(many(f))} to all the fruit?` : `${cap(many(f))} to all the fruit?`,
      prompt: r === 2 ? [num(a), op(':'), blank] : [p1, num(k * a), op(':'), blank], answer: n(k * (a + b)), weight: r === 4 ? 3 : 2,
      explain: `All the fruit: ${k * a} + ${k * b} = ${k * (a + b)}. So ${k * a} : ${k * (a + b)}.`, trick: all };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- ratio tables ----------
export type TableSpec = { fruits: [Fruit, Fruit]; cols: [number, number][]; gap: [number, 0 | 1] };
/** the batches in each column, per rung (the first one is what's given) */
function batches(rng: Rng, r: number): { mults: number[]; gap: number } {
  if (r === 1) return { mults: [1, 2, 3], gap: 2 };
  if (r === 2) return { mults: [1, 2, 3, 4], gap: int(rng, 1, 3) };
  if (r === 3) return { mults: [1, 2, pick(rng, [4, 5]), pick(rng, [6, 10])], gap: int(rng, 2, 3) };
  if (r === 5) return { mults: [1, pick(rng, [3, 4]), pick(rng, [6, 8]), pick(rng, [9, 12])], gap: int(rng, 1, 3) };
  // 4 and 6: the first column is more than one batch, so the way on goes back through one batch
  const m0 = r === 4 ? pick(rng, [2, 3]) : pick(rng, [2, 3, 4]);
  const odd = [3, 5, 7, 9, 10, 11, 13].filter(x => x % m0 !== 0);
  return r === 4 ? { mults: [m0, 2 * m0, pick(rng, odd.slice(0, 3))], gap: 2 } : { mults: [m0, pick(rng, odd.slice(0, 2)), pick(rng, odd.slice(2, 4)), pick(rng, odd.slice(4))], gap: int(rng, 1, 3) };
}
// rungs: 1 three columns, one more batch each time, the gap at the end · 2 four columns, the gap anywhere
// after the first · 3 jumps (one, two, five, ten batches) · 4 the first column is two or three batches: go
// back to one batch first · 5 bigger mixes and jumps · 6 the biggest, the first column not one batch
export const rtTable: Skill = {
  id: 'rt-table', area: 'ratios', grade: 6, standard: '6.RP.A.3a',
  name: 'Ratio tables', short: 'Tables', plain: 'Fills in a ratio table: the same mix in bigger batches (2 : 3, 4 : 6, 6 : 9), going back to one batch when it helps.',
  input: 'custom', fastMs: 12000,
  subs: [{ id: 'down', label: 'the second fruit' }, { id: 'up', label: 'the first fruit' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const [f, g] = twoFruits(rng);
    const [a, b] = r >= 5 ? pick(rng, COPRIME.concat([[5, 6], [6, 5], [4, 7], [7, 4]] as [number, number][])) : coprime(rng, r <= 2 ? 3 : 5);
    const { mults, gap } = batches(rng, r);
    const row: 0 | 1 = sub === 'down' ? 1 : 0;
    const cols = mults.map(m => [m * a, m * b] as [number, number]);
    const want = cols[gap][row], m = mults[gap], m0 = mults[0];
    const spec: TableSpec = { fruits: [f, g], cols, gap: [gap, row] };
    const back = m0 > 1;
    return {
      skill: 'rt-table', key: `rt-table:${sub}`, id: `rt-table:${f}${g}:${mults.join('.')}:${a}:${b}:${gap}${row}`,
      ask: back ? 'Keep the same mix. Fill in the gap.' : 'Every batch is the same mix. Fill in the gap.',
      prompt: [pic({ kind: 'fruit', sets: [{ f, n: cols[0][0] }, { f: g, n: cols[0][1] }] }), op('→'), tx(back ? `${m0} batches` : 'one batch')],
      input: 'custom', custom: { name: 'ratiotable', spec }, answer: n(want), weight: Math.min(5, r <= 2 ? 2 : r <= 4 ? 3 : 4),
      explain: back ? `${cols[0][0]} : ${cols[0][1]} is ${m0} batches of ${a} : ${b}. ${m} batches: ${m * a} : ${m * b}.` : `${m} batches of ${a} : ${b} is ${m * a} : ${m * b}.`,
      trick: back ? { name: 'Back to one batch', say: `Divide the first column by ${m0} to get one batch (${a} : ${b}), then times it by ${m}.` } : { name: 'Times both', say: `Each column is more batches of the same mix: times both numbers by the same number (${m}).` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- double number lines ----------
/** Two lines that count the same mix: tick k is k × step on each. `show` are the ticks with their number;
 *  `place`: drag the pin on the bottom line to `at` (a value); `read`: type the bottom number at tick `at`. */
export type DnlLane = { f: Fruit | 'cup'; step: number; show: number[] };
export type DnlSpec = { top: DnlLane; bot: DnlLane; n: number; at: number; mode: 'place' | 'read' };
const laneWord = (f: Fruit | 'cup', k: number) => (f === 'cup' ? (k === 1 ? 'cup' : 'cups') : fruitWord(f, k));
// rungs: 1 four ticks, the top line counts cups by ones · 2 five ticks, bigger steps · 3 six ticks, any steps up
// to 6 · 4 the top numbers hidden too: count both lines · 5 half-way ticks (4 cups : 6 lemons, so 2 cups is
// half way) · 6 eight ticks, bigger steps, both lines mostly hidden
export const rtDnl: Skill = {
  id: 'rt-dnl', area: 'ratios', grade: 6, standard: '6.RP.A.3a',
  name: 'Double number lines', short: 'Two lines', plain: 'Uses a double number line: two lines that count the same mix side by side (2 cups for every 3 oranges: 4 for 6, 6 for 9).',
  input: 'custom', fastMs: 12000,
  subs: [{ id: 'read', label: 'read the line' }, { id: 'place', label: 'put the pin on' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const f = pick(rng, FRUITS);
    const N = perRung(r, [4, 5, 6, 6, 6, 8]);
    let ts: number, bs: number, show: number[], at: number;
    if (r === 5) {
      const [a, b] = pick(rng, [[2, 4], [4, 6], [2, 6], [6, 4], [4, 10], [6, 10], [2, 10], [8, 6]] as [number, number][]);
      ts = a / 2; bs = b / 2; show = [0, 2]; at = pick(rng, [1, 3, 5]);
    } else {
      ts = r === 1 ? 1 : r === 2 ? pick(rng, [1, 2]) : int(rng, 1, r === 6 ? 5 : 3);
      bs = r === 1 ? int(rng, 2, 3) : int(rng, 2, perRung(r, [3, 5, 6, 6, 6, 9]));
      if (bs === ts) bs++;
      show = [0, 1]; at = int(rng, 2, N);
    }
    const topAll = r <= 3;
    const spec: DnlSpec = { top: { f: 'cup', step: ts, show: topAll ? Array.from({ length: N + 1 }, (_, i) => i) : show }, bot: { f, step: bs, show }, n: N, at, mode: sub === 'place' ? 'place' : 'read' };
    const tv = dec(at * ts), bv = dec(at * bs), unitTop = dec(show[1] * ts), unitBot = dec(show[1] * bs);
    const base = { skill: 'rt-dnl', key: `rt-dnl:${sub}`, input: 'custom' as const, custom: { name: 'dnl', spec }, weight: Math.min(5, r <= 2 ? 2 : r <= 4 ? 3 : 4) };
    const mix = `${unitTop} ${laneWord('cup', unitTop)} for every ${unitBot} ${laneWord(f, unitBot)}`;
    if (sub === 'place') return { ...base, id: `rt-dnl:place:${f}:${ts}:${bs}:${N}:${at}:${r}`, ask: `${cap(mix)}. Drag the pin to ${bv} ${laneWord(f, bv)}.`,
      prompt: [num(unitTop), op(':'), num(unitBot), op('→'), op('?'), op(':'), num(bv)], answer: { kind: 'point', x: bv },
      explain: `Count the bottom line by ${bs}s: ${Array.from({ length: at }, (_, i) => dec((i + 1) * bs)).join(', ')}. That's the tick under ${tv} ${laneWord('cup', tv)}.`,
      trick: r === 5 ? { name: 'Half way', say: `The tick half way to ${unitBot} is ${bs}. Count on in ${bs}s.` } : { name: 'Count the steps', say: `Every tick on the bottom line is ${bs} more. Count along in ${bs}s until you reach ${bv}.` } };
    return { ...base, id: `rt-dnl:read:${f}:${ts}:${bs}:${N}:${at}:${r}`, ask: `${cap(mix)}. How many ${many(f as Fruit)} for ${tv} ${laneWord('cup', tv)}?`,
      prompt: [num(unitTop), op(':'), num(unitBot), op('='), num(tv), op(':'), blank], answer: n(bv),
      explain: `${tv} ${laneWord('cup', tv)} is ${at} ${r === 5 ? 'half-steps' : 'steps'} along. ${at} × ${bs} = ${bv} ${laneWord(f, bv)}.`,
      trick: r === 5 ? { name: 'Half way', say: `Half of ${unitTop} ${laneWord('cup', unitTop)} needs half of ${unitBot}: ${bs}. Then count on.` } : { name: 'Step for step', say: `Every step along the top is a step along the bottom: ${ts} more ${laneWord('cup', ts)} up top, ${bs} more ${laneWord(f, bs)} below.` } };
  },
  check: (it, a) => (a.kind === 'point' && it.answer.kind === 'point' ? Math.abs(a.x - it.answer.x) < 1e-6 : checkAnswer(it.answer, a)),
};

// ---------- unit rates and best buys ----------
const THINGS = [['smoothie', 'smoothies'], ['juice', 'juices'], ['fruit cup', 'fruit cups'], ['mango', 'mangoes'], ['coconut', 'coconuts']] as const;
const MOVERS = [['sloth', 'climbs', 'metres'], ['monkey', 'swings', 'metres'], ['juice boat', 'floats', 'kilometres'], ['toucan', 'flies', 'kilometres']] as const;
// rungs: 1 one costs a whole number of dollars, up to 5 · 2 up to 6 of them, up to $8 each · 3 speeds and
// other rates ("12 metres in 4 minutes") · 4 more of them, dearer · 5 cents ($1.50 each) · 6 cents, more
// of them; the best buy with prices close together
export const rtRate: Skill = {
  id: 'rt-rate', area: 'ratios', grade: 6, standard: '6.RP.A.2',
  name: 'Unit rates', short: 'Rates', plain: 'Finds a unit rate (how much for one: 4 smoothies for $12 is $3 each), uses it for more, and picks the better buy.',
  input: 'number', fastMs: 10000,
  subs: [{ id: 'unit', label: 'how much for one' }, { id: 'more', label: 'how much for more' }, { id: 'best', label: 'the better buy' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const [one, lots] = pick(rng, THINGS);
    const k = int(rng, 2, perRung(r, [5, 6, 6, 9, 6, 9]));
    // the price of one, in dollars (cents from rung 5)
    const u = r >= 5 ? pick(rng, [0.5, 0.75, 1.25, 1.5, 2.25, 2.5, 3.5, 4.5]) : int(rng, 1, perRung(r, [5, 8, 8, 12, 12, 12]));
    const base = { skill: 'rt-rate', key: `rt-rate:${sub}`, input: 'number' as const };
    const forOne = { name: 'One first', say: 'A unit rate is how much for ONE. Share the price out: price ÷ how many.' };
    if (sub === 'best') {
      // two deals; from rung 3 the counts differ, so compare the price of one
      const k2 = r <= 2 ? k : int(rng, 2, perRung(r, [5, 6, 6, 9, 6, 9]));
      const step = r >= 5 ? 0.25 : r >= 4 ? 0.5 : 1;
      const d = pick(rng, r >= 4 ? [-1, 1, 0] : [-2, -1, 1, 2]) * step;
      const u2 = dec(u + d >= step ? u + d : u + Math.abs(d));
      const same = Math.abs(u2 - u) < 1e-9;
      const deal = (c: number, uu: number): Part[] => [num(c), tx(c === 1 ? one : lots), tx('for'), usd(c * uu)];
      const id = same ? 'same' : u < u2 ? 'a' : 'b';
      return { ...base, input: 'choice', id: `rt-rate:best:${k}x${u}:${k2}x${u2}`, ask: 'Which is the better buy?', prompt: [...deal(k, u), op('or'), ...deal(k2, u2)],
        choices: [{ id: 'a', parts: deal(k, u) }, { id: 'same', parts: [tx('The same')] }, { id: 'b', parts: deal(k2, u2) }], answer: { kind: 'choice', id }, weight: Math.min(5, 2 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0)),
        explain: `One costs ${$(u)} in the first deal and ${$(u2)} in the second. ${same ? 'They cost the same.' : `${$(Math.min(u, u2))} is cheaper.`}`,
        trick: { name: 'Price of one', say: 'Work out the price of ONE in each deal (price ÷ how many), then compare.' } };
    }
    if (r === 3 || (r === 4 && rng() < 0.4)) {
      const [who, verb, unit] = pick(rng, MOVERS);
      const speed = int(rng, 2, 9), t = int(rng, 2, 6), more = int(rng, 2, 9);
      if (sub === 'unit') return { ...base, id: `rt-rate:speed:${who}:${speed}x${t}`, ask: `A ${who} ${verb} ${speed * t} ${unit} in ${t} minutes. How many ${unit} a minute?`,
        prompt: [num(speed * t), tx(unit), tx(`in ${t} min`), op('→'), blank, tx('a minute')], answer: n(speed), weight: 3,
        explain: `${speed * t} ÷ ${t} = ${speed} ${unit} every minute.`, trick: { name: 'Per minute', say: '"A minute" means ONE minute: divide the distance by the minutes.' } };
      return { ...base, id: `rt-rate:speedmore:${who}:${speed}x${t}:${more}`, ask: `A ${who} ${verb} ${speed * t} ${unit} in ${t} minutes. How far in ${more} minutes?`,
        prompt: [num(speed * t), tx(`in ${t}`), op('→'), blank, tx(`in ${more}`)], answer: n(speed * more), weight: 3,
        explain: `${speed * t} ÷ ${t} = ${speed} a minute. ${speed} × ${more} = ${speed * more} ${unit}.`, trick: { name: 'One minute first', say: 'Find how far in ONE minute, then times it by the minutes you want.' } };
    }
    if (sub === 'unit') return { ...base, id: `rt-rate:unit:${k}x${u}`, ask: `${k} ${lots} cost ${$(k * u)}. How much is one?`,
      prompt: [num(k), tx(lots), op('='), usd(k * u), tx(`· 1 ${one} =`), tx('$'), blank], answer: n(u), weight: r >= 5 ? 4 : 2,
      explain: `${$(k * u)} ÷ ${k} = ${$(u)} each.`, trick: forOne };
    // more: rung 1-2 from one; 4 from several; 6 now and then "how many can you buy?"
    const want0 = int(rng, 2, perRung(r, [6, 9, 9, 12, 9, 12])), want = r >= 3 && want0 === k ? want0 + 1 : want0;
    if (r <= 2) return { ...base, id: `rt-rate:more1:${u}x${want}`, ask: `One ${one} costs ${$(u)}. How much for ${want}?`,
      prompt: [num(1), tx(one), op('='), usd(u), tx(`· ${want} =`), tx('$'), blank], answer: n(u * want), weight: 1,
      explain: `${want} × ${$(u)} = ${$(u * want)}.`, trick: { name: 'Times the rate', say: 'You know the price of one: times it by how many you want.' } };
    if (r === 6 && rng() < 0.4) {
      const money = u * k * want;
      return { ...base, id: `rt-rate:howmany:${k}x${u}:${want}`, ask: `${k} ${lots} cost ${$(k * u)}. How many can you buy with ${$(money)}?`,
        prompt: [num(k), tx(lots), op('='), usd(k * u), tx('·'), usd(money), op('='), blank, tx(lots)], answer: n(k * want), weight: 5,
        explain: `One costs ${$(u)}. ${$(money)} ÷ ${$(u)} = ${k * want} ${lots}.`, trick: { name: 'Price of one', say: 'Find the price of one, then see how many of those fit into your money.' } };
    }
    return { ...base, id: `rt-rate:more:${k}x${u}:${want}`, ask: `${k} ${lots} cost ${$(k * u)}. How much for ${want}?`,
      prompt: [num(k), tx(lots), op('='), usd(k * u), tx(`· ${want} =`), tx('$'), blank], answer: n(u * want), weight: r >= 5 ? 4 : 3,
      explain: `One costs ${$(k * u)} ÷ ${k} = ${$(u)}. ${want} × ${$(u)} = ${$(u * want)}.`, trick: { name: 'One first, then more', say: 'Two steps: the price of ONE (divide), then times it by how many you want.' } };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- percent: out of 100 ----------
export type PctBarSpec = { whole: number | null; f: Fruit; step: number; labels: 'all' | 'ends'; want: number };
// rungs: 1 tens (30% of the slab, 7/10) · 2 fives, quarters and halves · 3 any number of squares; fifths and
// twentieths; the bar with a whole to share · 4 "not shaded", decimals as percents · 5 more than one whole
// (135%), percents back to fractions · 6 the trickiest: eighths (37.5%), what's left of 100%
export const rtPct: Skill = {
  id: 'rt-pct', area: 'ratios', grade: 6, standard: '6.RP.A.3c',
  name: 'Percents', short: 'Percent', plain: 'Knows a percent is "out of 100": 35 of 100 squares is 35%, 3/10 is 30%, 1/4 is 25%; shades a percent bar.',
  input: 'number', fastMs: 8000,
  subs: [{ id: 'grid', label: 'squares out of 100' }, { id: 'frac', label: 'fractions as percents' }, { id: 'bar', label: 'the percent bar' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const base = { skill: 'rt-pct', key: `rt-pct:${sub}`, input: 'number' as const };
    const outOf100 = { name: 'Out of 100', say: 'Percent means "out of 100". Count how many of the 100 squares: that number is the percent.' };
    if (sub === 'grid') {
      const x = r === 1 ? 10 * int(rng, 1, 9) : r === 2 ? 5 * int(rng, 1, 19) : int(rng, 1, 99);
      if (r === 6) return { ...base, id: `rt-pct:left:${x}`, ask: `${x}% of the slab is eaten. What percent is left?`, prompt: [num(100), op('%'), op('−'), ...pctP(x), op('='), blank, op('%')], answer: n(100 - x), weight: 3,
        explain: `The whole slab is 100%. 100 − ${x} = ${100 - x}%.`, trick: { name: 'The whole is 100%', say: 'All of it is 100%. Take away the part that is gone.' } };
      if (r === 5 && rng() < 0.6) return { ...base, id: `rt-pct:over:${x}`, ask: 'Each slab has 100 squares. What percent is there?', prompt: [{ t: 'pic', pic: { kind: 'grid', parts: 100, filled: 100 } }, { t: 'pic', pic: { kind: 'grid', parts: 100, filled: x } }, op('='), blank, op('%')], answer: n(100 + x), weight: 4,
        explain: `A whole slab is 100%, and ${x} more squares: ${100 + x}%.`, trick: { name: 'More than 100%', say: 'A whole slab is 100%. Count on from 100 with the next slab.' } };
      const not = r >= 4 && rng() < 0.5;
      return { ...base, id: `rt-pct:grid:${not ? 'n' : ''}${x}:${r === 1 ? 't' : ''}`, ask: not ? 'What percent of the slab is eaten?' : 'What percent of the slab is still there?', prompt: [{ t: 'pic', pic: { kind: 'grid', parts: 100, filled: x } }, op('='), blank, op('%')], answer: n(not ? 100 - x : x), weight: r <= 2 ? 1 : 2,
        explain: not ? `${x} squares are there, so ${100 - x} of 100 are eaten: ${100 - x}%.` : `${x} of the 100 squares: ${x}%.`,
        trick: not ? { name: 'The rest of 100', say: 'Count what IS there, then take it away from 100.' } : outOf100 };
    }
    if (sub === 'frac') {
      if (r === 4 && rng() < 0.5) { const h = int(rng, 1, 99); return { ...base, id: `rt-pct:dec:${h}`, ask: 'Write it as a percent.', prompt: [num(h / 100), op('='), blank, op('%')], answer: n(h), weight: 2,
        explain: `${(h / 100).toFixed(2)} is ${h} hundredths: ${h}%.`, trick: { name: 'Two places', say: 'Hundredths are "out of 100": the two digits after the point are the percent.' } }; }
      if (r === 5 && rng() < 0.5) {
        const d = pick(rng, [10, 20, 25, 50]), t = int(rng, 1, d - 1), p = (t * 100) / d;
        return { ...base, id: `rt-pct:tofrac:${p}/${d}`, ask: 'How many on top?', prompt: [...pctP(p), op('='), { t: 'frac', n: null, d }], answer: n(t), weight: 3,
          explain: `${p}% is ${p}/100, and ${p}/100 = ${t}/${d}.`, trick: { name: 'Over 100, then share', say: `Write it over 100, then divide top and bottom by the same number (100 ÷ ${d} = ${100 / d}).` } };
      }
      const ds = perRung(r, [[10], [100, 2, 4], [5, 20, 25, 50, 4], [5, 20, 25, 50, 4, 10], [20, 25, 50, 4, 5], [8, 40, 4, 20]]);
      const d = pick(rng, ds), t = d === 100 ? int(rng, 1, 99) : int(rng, 1, d - 1), p = dec((t * 100) / d, 2);
      return { ...base, id: `rt-pct:frac:${t}/${d}`, ask: 'Write it as a percent.', prompt: [{ t: 'frac', n: t, d }, op('='), blank, op('%')], answer: n(p), weight: d === 10 || d === 100 ? 1 : d === 8 || d === 40 ? 4 : 2,
        explain: d === 100 ? `${t} out of 100 is ${t}%.` : `Make the bottom 100: ${t}/${d} = ${p}/100, so ${p}%.`,
        trick: d === 100 ? outOf100 : { name: 'Make it out of 100', say: `Times the top and the bottom by the same number so the bottom is 100 (${d} × ${dec(100 / d, 2)} = 100).` } };
    }
    // the bar: shade it to a percent, or to a share of the fruit it stands for
    const step = r === 1 ? 10 : r <= 2 || r >= 5 ? 5 : 10;
    const f = pick(rng, FRUITS);
    if (r <= 2) {
      const p = step * int(rng, 1, 100 / step - 1);
      const spec: PctBarSpec = { whole: null, f, step, labels: r === 1 ? 'all' : 'ends', want: p };
      return { ...base, input: 'custom', custom: { name: 'pctbar', spec }, id: `rt-pct:bar:${p}:${r}`, ask: `Shade ${p}% of the bar.`, prompt: [tx('Shade'), ...pctP(p)], answer: { kind: 'point', x: p }, weight: 1,
        explain: `The whole bar is 100%. ${p}% is ${p / 10} of the 10 big parts.`, trick: { name: 'Tens of percent', say: 'The bar is cut into 10 parts of 10%. Count the parts.' } };
    }
    const whole = pick(rng, perRung(r, [[10], [10], [10, 20, 50], [20, 40, 50, 80], [20, 40, 60, 80], [40, 60, 80, 120, 200]]));
    // percents of this whole that come out as whole fruits
    const ok = Array.from({ length: 100 / step - 1 }, (_, i) => (i + 1) * step).filter(p => Number.isInteger((p * whole) / 100));
    const p = pick(rng, ok), part = (p * whole) / 100;
    const spec: PctBarSpec = { whole, f, step, labels: 'ends', want: p };
    return { ...base, input: 'custom', custom: { name: 'pctbar', spec }, id: `rt-pct:barof:${whole}:${p}:${f}`, ask: `The bar is ${whole} ${many(f)}. Shade ${part} of them. What percent is that?`,
      prompt: [num(part), tx('of'), num(whole), op('='), op('?'), op('%')], answer: { kind: 'point', x: p }, weight: Math.min(5, r),
      explain: `${part} of ${whole} is ${part}/${whole} = ${p}/100: ${p}%.`, trick: { name: 'Make it out of 100', say: `Write it as ${part} out of ${whole}, then make the bottom 100.` } };
  },
  check: (it, a) => (a.kind === 'point' && it.answer.kind === 'point' ? Math.abs(a.x - it.answer.x) < 1e-6 : checkAnswer(it.answer, a)),
};

// ---------- percent of a number ----------
const PCTS: Record<string, number[]> = { half: [50, 25, 75, 100], tens: [10, 20, 30, 40, 60, 70, 80, 90], any: [5, 15, 35, 45, 12, 65, 85, 95] };
/** the smallest whole number that p% of comes out whole (25% → 4, 15% → 20) */
const unitFor = (p: number) => 100 / gcd(p, 100);
function pctTrick(p: number, N: number) {
  if (p === 50) return { name: 'Half', say: `50% is half: ${N} ÷ 2.` };
  if (p === 25) return { name: 'Half of a half', say: `25% is a quarter: half of ${N}, then half again.` };
  if (p === 75) return { name: 'Three quarters', say: `Find 25% (a quarter of ${N}), then times it by 3.` };
  if (p === 100) return { name: 'All of it', say: '100% is the whole thing.' };
  if (p === 10) return { name: 'Divide by ten', say: `10% is a tenth: ${N} ÷ 10.` };
  if (p % 10 === 0) return { name: 'Tens of percent', say: `Find 10% first (${N} ÷ 10 = ${N / 10}), then times it by ${p / 10}.` };
  if (p === 5) return { name: 'Half of ten percent', say: `Find 10% (${N} ÷ 10), then half of it.` };
  if (p % 5 === 0) return { name: 'Tens and a five', say: `${p}% is ${p - 5}% and 5%: find 10% first, and half of 10% for the 5%.` };
  return { name: 'One percent', say: `1% is ${N} ÷ 100. Times it by ${p}.` };
}
// rungs: 1 numbers up to 40 · 2 up to 100 · 3 up to 200 · 4 up to 400, told as a story · 5 up to 1,000 · 6
// halves in the answer (15% of 30 is 4.5)
export const rtPctOf: Skill = {
  id: 'rt-pctof', area: 'ratios', grade: 6, standard: '6.RP.A.3c',
  name: 'Percent of a number', short: '% of', plain: 'Finds a percent of a number: 50% is half, 10% is a tenth, 25% is a quarter, and 30% is three lots of 10%.',
  input: 'number', fastMs: 10000,
  subs: [{ id: 'half', label: 'halves and quarters' }, { id: 'tens', label: 'tens of percent' }, { id: 'any', label: 'any percent' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const p = pick(rng, sub === 'any' && r <= 2 ? [5, 15, 25] : sub === 'half' && r >= 3 ? [50, 25, 75] : PCTS[sub] ?? PCTS.half);
    const u = unitFor(p), max = perRung(r, [40, 100, 200, 400, 1000, 200]);
    // the number: a multiple of the unit (or of half the unit on rung 6, so the answer can end in .5)
    const half = r === 6 && u % 2 === 0 && (p * (u / 2)) % 100 !== 0;
    const step = half ? u / 2 : u;
    const N = step * int(rng, Math.max(1, Math.ceil((r >= 3 ? 20 : 4) / step)), Math.max(1, Math.floor(max / step)));
    const ans = dec((p * N) / 100, 2);
    const f = pick(rng, FRUITS);
    const story = r === 4 || (r >= 5 && rng() < 0.4);
    return {
      skill: 'rt-pctof', key: `rt-pctof:${sub}`, id: `rt-pctof:${p}:${N}:${story ? f : ''}`,
      ask: story ? `${p}% of the ${N} ${many(f)} are ripe. How many is that?` : `What is ${p}% of ${N}?`,
      prompt: [...pctP(p), tx('of'), num(N), op('='), blank], input: 'number', answer: n(ans),
      weight: Math.min(5, (sub === 'half' ? 1 : sub === 'tens' ? 2 : 3) + (r >= 4 ? 1 : 0)),
      explain: `${p}% of ${N} is ${p}/100 of ${N}: ${N} ÷ 100 × ${p} = ${ans}.`, trick: pctTrick(p, N),
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- find the whole ----------
// rungs: 1 50% of small numbers · 2 50%, 25% and 10% · 3 tens of percent · 4 told as a story · 5 bigger
// wholes, 75% and 40% · 6 fives (15%, 35%) and wholes up to 1,000
export const rtWhole: Skill = {
  id: 'rt-whole', area: 'ratios', grade: 6, standard: '6.RP.A.3c',
  name: 'Find the whole', short: 'Whole', plain: 'Finds the whole from a part and its percent: if 12 is 25%, the whole is 4 × 12 = 48.',
  input: 'number', fastMs: 12000,
  subs: [{ id: 'easy', label: 'half, quarter, tenth' }, { id: 'any', label: 'any percent' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const ps = sub === 'easy' ? perRung(r, [[50], [50, 25, 10], [50, 25, 10, 20], [25, 10, 20, 50], [25, 10, 20, 5], [10, 20, 5, 25]]) : perRung(r, [[50, 20], [20, 40], [20, 30, 40, 60], [30, 40, 60, 75], [40, 60, 75, 80], [15, 35, 45, 75]]);
    const p = pick(rng, ps), u = unitFor(p);
    const max = perRung(r, [20, 60, 100, 200, 500, 1000]);
    const W = u * int(rng, Math.max(1, Math.ceil(8 / u)), Math.max(1, Math.floor(max / u)));
    const part = (p * W) / 100;
    const f = pick(rng, FRUITS);
    const story = r === 4 || (r >= 5 && rng() < 0.5);
    const g = gcd(p, 100), times = 100 / g, parts = p / g;
    return {
      skill: 'rt-whole', key: `rt-whole:${sub}`, id: `rt-whole:${p}:${W}:${story ? f : ''}`,
      ask: story ? `${part} ${many(f)} fill ${p}% of the crate. How many fill the whole crate?` : `${part} is ${p}% of what number?`,
      prompt: [num(part), op('='), ...pctP(p), tx('of'), blank], input: 'number', answer: n(W), weight: Math.min(5, (sub === 'easy' ? 2 : 3) + (r >= 4 ? 1 : 0)),
      explain: parts === 1 ? `${p}% is 1/${times} of the whole, so the whole is ${times} × ${part} = ${W}.` : `${p}% is ${parts}/${times}. ${part} ÷ ${parts} = ${part / parts} for each ${100 / times}%, and ${times} of those make 100%: ${W}.`,
      trick: parts === 1 ? { name: 'Times up to 100%', say: `${p}% fits into 100% ${times} times, so times the part by ${times}.` } : { name: 'One piece first', say: `Find ${100 / times}% first (${part} ÷ ${parts}), then times it up to 100%.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- converting units ----------
type Unit = [string, string, string, string, number];
const UNITS: Record<string, Unit[]> = {
  length: [['foot', 'feet', 'inch', 'inches', 12], ['yard', 'yards', 'foot', 'feet', 3], ['metre', 'metres', 'centimetre', 'centimetres', 100], ['kilometre', 'kilometres', 'metre', 'metres', 1000]],
  time: [['hour', 'hours', 'minute', 'minutes', 60], ['minute', 'minutes', 'second', 'seconds', 60], ['day', 'days', 'hour', 'hours', 24], ['week', 'weeks', 'day', 'days', 7]],
  cups: [['pint', 'pints', 'cup', 'cups', 2], ['quart', 'quarts', 'cup', 'cups', 4], ['gallon', 'gallons', 'quart', 'quarts', 4], ['quart', 'quarts', 'pint', 'pints', 2]],
};
/** two steps: yards to inches, hours to seconds, gallons to cups */
const TWO: Record<string, [string, string, string, number, number]> = { length: ['yards', 'inches', 'feet', 3, 12], time: ['hours', 'seconds', 'minutes', 60, 60], cups: ['gallons', 'cups', 'quarts', 4, 4] };
const u1 = (u: Unit, k: number, big: boolean) => (big ? (k === 1 ? u[0] : u[1]) : (k === 1 ? u[2] : u[3]));
// rungs: 1 bigger to smaller, 1 to 3 of them · 2 up to 6 · 3 either way (36 inches = 3 feet) · 4 mixed (2 feet
// 5 inches) · 5 two steps (2 yards = 72 inches) · 6 halves (1.5 hours = 90 minutes, 30 inches = 2.5 feet)
export const rtUnits: Skill = {
  id: 'rt-units', area: 'ratios', grade: 6, standard: '6.RP.A.3d',
  name: 'Convert units', short: 'Units', plain: 'Converts units with a rate: 1 foot = 12 inches, so 3 feet = 36 inches and 48 inches = 4 feet.',
  input: 'number', fastMs: 10000,
  subs: [{ id: 'length', label: 'lengths' }, { id: 'time', label: 'time' }, { id: 'cups', label: 'cups and quarts' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const list = UNITS[sub] ?? UNITS.length;
    const u = pick(rng, r <= 2 ? list.filter(x => x[4] <= 100) : list), k = int(rng, perRung(r, [1, 2, 2, 2, 2, 1]), perRung(r, [3, 6, 9, 5, 4, 9]));
    const base = { skill: 'rt-units', key: `rt-units:${sub}`, input: 'number' as const };
    const down = { name: 'Bigger to smaller: times', say: `1 ${u[0]} is ${u[4]} ${u[3]}. More small ones fit, so times by ${u[4]}.` };
    const up = { name: 'Smaller to bigger: divide', say: `${u[4]} ${u[3]} make 1 ${u[0]}. Fewer big ones, so divide by ${u[4]}.` };
    if (r === 5) {
      const [bigs, smalls, mid, a, b] = TWO[sub] ?? TWO.length, kk = int(rng, 2, 4);
      return { ...base, id: `rt-units:two:${sub}:${kk}`, ask: `How many ${smalls} in ${kk} ${bigs}?`, prompt: [num(kk), tx(bigs), op('='), blank, tx(smalls)], answer: n(kk * a * b), weight: 5,
        explain: `${kk} ${bigs} is ${kk * a} ${mid}, and ${kk * a} × ${b} = ${kk * a * b} ${smalls}.`, trick: { name: 'One step at a time', say: `Go through the middle unit: first to ${mid} (× ${a}), then to ${smalls} (× ${b}).` } };
    }
    if (r === 6) {
      const half = u[4] % 2 === 0;
      if (half && rng() < 0.5) return { ...base, id: `rt-units:half:${u[0]}:${k}`, ask: `How many ${u[3]} in ${k}.5 ${u[1]}?`, prompt: [num(k + 0.5), tx(u[1]), op('='), blank, tx(u[3])], answer: n((k + 0.5) * u[4]), weight: 5,
        explain: `${k} ${u1(u, k, true)} is ${k * u[4]} ${u[3]}, and half a ${u[0]} is ${u[4] / 2} more: ${(k + 0.5) * u[4]}.`, trick: { name: 'Half a unit', say: `A half is half of ${u[4]}: ${u[4] / 2}. Add it on.` } };
      if (half) return { ...base, id: `rt-units:tohalf:${u[0]}:${k}`, ask: `How many ${u[1]} is ${(k + 0.5) * u[4]} ${u[3]}?`, prompt: [num((k + 0.5) * u[4]), tx(u[3]), op('='), blank, tx(u[1])], answer: n(k + 0.5), weight: 5,
        explain: `${(k + 0.5) * u[4]} ÷ ${u[4]} = ${k + 0.5} ${u[1]}.`, trick: up };
    }
    if (r === 4 && u[4] > 2) {
      const extra = int(rng, 1, u[4] - 1);
      return { ...base, id: `rt-units:mixed:${u[0]}:${k}:${extra}`, ask: `How many ${u[3]} in all?`, prompt: [num(k), tx(u1(u, k, true)), num(extra), tx(u1(u, extra, false)), op('='), blank, tx(u[3])], answer: n(k * u[4] + extra), weight: 4,
        explain: `${k} ${u1(u, k, true)} is ${k * u[4]} ${u[3]}, plus ${extra}: ${k * u[4] + extra}.`, trick: { name: 'Change, then add', say: `Change the ${u[1]} into ${u[3]} first (× ${u[4]}), then add the ${extra} on.` } };
    }
    const toBig = r >= 3 && rng() < 0.5;
    if (toBig) return { ...base, id: `rt-units:up:${u[0]}:${k}`, ask: `How many ${u[1]} is ${k * u[4]} ${u[3]}?`, prompt: [num(k * u[4]), tx(u[3]), op('='), blank, tx(u[1])], answer: n(k), weight: 3,
      explain: `${u[4]} ${u[3]} make 1 ${u[0]}: ${k * u[4]} ÷ ${u[4]} = ${k}.`, trick: up };
    return { ...base, id: `rt-units:down:${u[0]}:${k}`, ask: `How many ${u[3]} in ${k} ${u1(u, k, true)}?`, prompt: [num(k), tx(u1(u, k, true)), op('='), blank, tx(u[3])], answer: n(k * u[4]), weight: r <= 2 ? 1 : 2,
      explain: `1 ${u[0]} is ${u[4]} ${u[3]}, so ${k} × ${u[4]} = ${k * u[4]}.`, trick: down };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- proportional or not ----------
const PAIRS = [['cups', 'cost ($)'], ['minutes', 'metres'], ['mangoes', 'seeds'], ['scoops', 'smoothies'], ['hours', 'pages']] as const;
// rungs: 1 clear cases (y = 2x, or x + 3) · 2 three rows, k up to 5 · 3 close calls (2x + 1) · 4 bigger
// numbers, the k from a graph's point · 5 halves (k = 1.5), a curve through 0 · 6 rows out of order, one row a
// little off
export const rtProp: Skill = {
  id: 'rt-prop', area: 'ratios', grade: 7, standard: '7.RP.A.2',
  name: 'Proportional?', short: 'Proportional', plain: 'Tells whether two amounts are proportional (y is always the same number times x: a straight line through 0) and finds that number, the constant of proportionality.',
  input: 'choice', fastMs: 12000,
  subs: [{ id: 'table', label: 'from a table' }, { id: 'k', label: 'the constant' }, { id: 'graph', label: 'from a graph' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const [hx, hy] = pick(rng, PAIRS);
    const k = r >= 5 ? pick(rng, [1.5, 2.5, 0.5, 3.5]) : int(rng, 2, perRung(r, [3, 5, 6, 9, 9, 9]));
    const xs0 = r >= 5 ? [2, 4, 6, 8] : r === 1 ? [1, 2, 3] : r === 2 ? [1, 2, 4] : [2, 3, 5, 6];
    const xs = r === 6 ? [xs0[2], xs0[0], xs0[3], xs0[1]] : xs0;
    const base = { skill: 'rt-prop', key: `rt-prop:${sub}` };
    if (sub === 'k') {
      const rows: [number, number][] = xs.map(x => [x, dec(k * x)]);
      return { ...base, input: 'number', id: `rt-prop:k:${k}:${xs.join('.')}:${hx}`, ask: `${cap(hy)} is always the same number times ${hx}. What number?`,
        prompt: [pic({ kind: 'table', head: [hx, hy], rows }), tx('y ='), blank, op('×'), tx('x')], answer: n(k), weight: r >= 5 ? 4 : 2,
        explain: `${rows[0][1]} ÷ ${rows[0][0]} = ${k}, and every row gives the same: y = ${k}x.`, trick: { name: 'y ÷ x', say: 'Divide y by x in any row. In a proportional table it always comes out the same: that is the constant.' } };
    }
    // proportional half the time
    const yes = rng() < 0.5;
    const c = r <= 2 ? int(rng, 2, 4) : 1;
    const off = r === 6 && !yes && rng() < 0.6;
    const fn = (x: number, i: number) => dec(yes ? k * x : off ? k * x + (i === 1 ? 1 : 0) : k * x + c);
    const curve = r >= 5 && !yes && sub === 'graph' && rng() < 0.5;
    if (sub === 'graph') {
      const gx = [0, 1, 2, 3, 4];
      const pts: [number, number][] = gx.map(x => [x, curve ? dec(x * x * (k / 2)) : yes ? dec(k * x) : dec(k * x + c)]);
      const max = Math.max(...pts.map(p => p[1]));
      return { ...base, input: 'choice', id: `rt-prop:graph:${yes ? 'y' : curve ? 'c' : 'n'}:${k}:${c}:${r}`, ask: 'Is it proportional?', prompt: [pic({ kind: 'graph', pts, line: true, max: [4, Math.ceil(max / 2) * 2], names: [hx, hy] })],
        choices: yesNo, answer: { kind: 'choice', id: yes ? 'yes' : 'no' }, weight: r >= 3 ? 3 : 2,
        explain: yes ? 'A straight line that starts at 0: proportional.' : curve ? 'It starts at 0, but it bends: not proportional.' : `It doesn't start at 0 (at 0 it is already ${c}): not proportional.`,
        trick: { name: 'Straight, through 0', say: 'Proportional on a graph means a STRAIGHT line that goes through 0.' } };
    }
    const rows: [number, number][] = xs.map((x, i) => [x, fn(x, i)]);
    return { ...base, input: 'choice', id: `rt-prop:table:${rows.map(x => x.join(',')).join(';')}:${hx}`, ask: `Is ${hy} proportional to ${hx}?`, prompt: [pic({ kind: 'table', head: [hx, hy], rows })],
      choices: yesNo, answer: { kind: 'choice', id: yes ? 'yes' : 'no' }, weight: r >= 3 ? 3 : 2,
      explain: yes ? `y ÷ x is ${k} in every row: proportional.` : `y ÷ x isn't the same in every row (${rows.map(([x, y]) => dec(y / x, 2)).join(', ')}): not proportional.`,
      trick: { name: 'Same y ÷ x', say: 'Divide y by x in each row. All the same? Proportional. Any different? Not.' } };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- percent up and down ----------
// rungs: 1 10%, 50%, 100% of round numbers · 2 20% and 25% · 3 any tens of percent · 4 fives (15%) · 5 bigger
// numbers · 6 bigger numbers, any of them
export const rtChange: Skill = {
  id: 'rt-change', area: 'ratios', grade: 7, standard: '7.RP.A.3',
  name: 'Percent up and down', short: 'Up and down', plain: 'Works out a percent increase or decrease (40 up by 25% is 50) and finds the percent change (50 to 60 is up 20%).',
  input: 'number', fastMs: 12000,
  subs: [{ id: 'up', label: 'going up' }, { id: 'down', label: 'going down' }, { id: 'find', label: 'how much percent' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const ps = perRung(r, [[10, 50, 100], [10, 20, 25, 50], [10, 20, 25, 30, 40, 50, 60], [5, 15, 20, 25, 30, 40], [5, 15, 25, 35, 40, 60, 75], [5, 15, 35, 45, 12, 60, 75]]);
    const p = pick(rng, sub === 'down' ? ps.filter(x => x < 100) : ps), u = unitFor(p);
    const max = perRung(r, [100, 100, 200, 300, 600, 1000]);
    const uu = r <= 2 ? (u * 10) / gcd(u, 10) : u;
    const N = uu * int(rng, Math.max(1, Math.ceil(10 / uu)), Math.max(1, Math.floor(max / uu)));
    const d = (p * N) / 100;
    const f = pick(rng, FRUITS);
    const base = { skill: 'rt-change', key: `rt-change:${sub}`, input: 'number' as const, weight: Math.min(5, 2 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0) + (sub === 'find' ? 1 : 0)) };
    if (sub === 'find') {
      const upward = rng() < 0.5 || p === 100;
      const to = upward ? N + d : N - d;
      return { ...base, id: `rt-change:find:${N}:${to}`, ask: `The stall had ${N} ${many(f)}. Now it has ${to}. By what percent did it go ${upward ? 'up' : 'down'}?`,
        prompt: [num(N), op('→'), num(to), op('='), tx(upward ? 'up' : 'down'), blank, op('%')], answer: n(p),
        explain: `It went ${upward ? 'up' : 'down'} by ${d}. ${d} out of ${N} (where it started) is ${p}%.`,
        trick: { name: 'Change over start', say: 'Find how much it changed, then put that over where it STARTED, and make it out of 100.' } };
    }
    const up = sub === 'up';
    const ans = up ? N + d : N - d;
    return { ...base, id: `rt-change:${sub}:${N}:${p}`, ask: up ? `A jug holds ${N} cups of juice. The new jug holds ${p}% more. How many cups does it hold?` : `A bunch had ${N} ${many(f)}. ${p}% were eaten. How many are left?`,
      prompt: [num(N), op(up ? '+' : '−'), ...pctP(p), op('='), blank], answer: n(ans),
      explain: `${p}% of ${N} is ${d}. ${N} ${up ? '+' : '−'} ${d} = ${ans}.`,
      trick: { name: up ? 'Find it, add it' : 'Find it, take it away', say: `First find ${p}% of ${N}, then ${up ? 'add it on' : 'take it away'}. (Or in one go: ${up ? 100 + p : 100 - p}% of ${N}.)` } };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- sales, tax and tips ----------
/** a price from lo to hi dollars whose p% is: whole dollars ('dollars'), whole cents from a whole-dollar
 *  price ('whole'), or whole cents from a price with cents ('cents') */
function priceFor(rng: Rng, p: number, lo: number, hi: number, how: 'dollars' | 'whole' | 'cents') {
  const step = how === 'dollars' ? (100 / gcd(p, 100)) * 100 : how === 'whole' ? 100 : 100 / gcd(p, 100);
  const k = Math.max(1, int(rng, Math.ceil((lo * 100) / step), Math.max(1, Math.floor((hi * 100) / step))));
  return (step * k) / 100;
}
// rungs: 1 10% and 50% off round prices · 2 20% and 25% · 3 tips of 15% and 20%, any whole-dollar price ·
// 4 the total with the tip or the tax, what you save · 5 prices with cents · 6 cents and odd percents
export const rtShop: Skill = {
  id: 'rt-shop', area: 'ratios', grade: 7, standard: '7.RP.A.3',
  name: 'Sales, tax and tips', short: 'Shopping', plain: 'Uses percents for money: 25% off a $20 hat is $15, a 15% tip on $40 is $6, and 5% tax on $40 makes $42.',
  input: 'number', fastMs: 14000,
  subs: [{ id: 'sale', label: 'sales' }, { id: 'tax', label: 'tax' }, { id: 'tip', label: 'tips' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const P: Record<string, number[][]> = {
      sale: [[10, 50], [20, 25, 50], [10, 20, 25, 30, 40], [20, 25, 30, 40], [10, 20, 25, 30], [15, 35, 20, 25]],
      tax: [[10], [10, 5], [5, 10], [5, 8, 10], [5, 6, 8], [6, 7, 8, 9]],
      tip: [[10], [10, 20], [15, 20], [15, 20, 18], [15, 20, 18], [15, 18, 20, 22]],
    };
    const p = pick(rng, perRung(r, P[sub] ?? P.sale));
    const price = priceFor(rng, p, perRung(r, [10, 10, 8, 8, 5, 5]), perRung(r, [50, 60, 80, 120, 60, 90]), r <= 2 ? 'dollars' : r <= 4 ? 'whole' : 'cents');
    const amt = dec((price * p) / 100);
    const base = { skill: 'rt-shop', key: `rt-shop:${sub}`, input: 'number' as const, weight: Math.min(5, 2 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0)) };
    const find = { name: `${p}% of the price`, say: `Find ${p}% of ${$(price)} first: ${p === 10 ? 'divide by 10' : `10% is ${$(price / 10)}, then use it`}.` };
    if (sub === 'sale') {
      const save = r >= 4 && rng() < 0.4;
      if (save) return { ...base, id: `rt-shop:save:${price}:${p}`, ask: `A ${$(price)} sun hat is ${p}% off. How much do you save?`, prompt: [usd(price), op('−'), ...pctP(p), tx('· save'), tx('$'), blank], answer: n(amt),
        explain: `${p}% of ${$(price)} is ${$(amt)}: that's what you save.`, trick: find };
      return { ...base, id: `rt-shop:sale:${price}:${p}`, ask: `A ${$(price)} sun hat is ${p}% off. What do you pay?`, prompt: [usd(price), op('−'), ...pctP(p), op('='), tx('$'), blank], answer: n(price - amt),
        explain: `${p}% of ${$(price)} is ${$(amt)}. ${$(price)} − ${$(amt)} = ${$(price - amt)}.`,
        trick: { name: 'Find it, take it off', say: `Find ${p}% of the price, then take it off. (Or pay ${100 - p}% of it in one go.)` } };
    }
    const total = r >= 4 && (sub === 'tax' || rng() < 0.5);
    const what = sub === 'tax' ? 'tax' : 'tip';
    if (!total) return { ...base, id: `rt-shop:${sub}:${price}:${p}`, ask: sub === 'tax' ? `The tax is ${p}% on a ${$(price)} lamp. How much is the tax?` : `The bill is ${$(price)}. You leave a ${p}% tip. How much is the tip?`,
      prompt: [...pctP(p), tx('of'), usd(price), op('='), tx('$'), blank], answer: n(amt), explain: `${p}% of ${$(price)} is ${$(amt)}.`, trick: find };
    return { ...base, id: `rt-shop:${sub}total:${price}:${p}`, ask: sub === 'tax' ? `A ${$(price)} lamp has ${p}% tax. What is the total?` : `The bill is ${$(price)}, and you add a ${p}% tip. What is the total?`,
      prompt: [usd(price), op('+'), ...pctP(p), op('='), tx('$'), blank], answer: n(price + amt),
      explain: `The ${what} is ${$(amt)}. ${$(price)} + ${$(amt)} = ${$(price + amt)}.`,
      trick: { name: 'Find it, add it on', say: `Find the ${what} (${p}% of the price), then add it to the price.` } };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- scale drawings ----------
const PLACES = ['the waterfall', 'the smoothie hut', 'the mango tree', 'the rope bridge', 'the juice pool'] as const;
// rungs: 1 1 cm stands for 2, 5 or 10 km, up to 5 cm · 2 up to 8 cm · 3 1 cm for anything up to 20 · 4 2 cm
// stands for 5 (not one centimetre) · 5 half centimetres · 6 3 cm for 50 m, and drawings to their real size
export const rtScale: Skill = {
  id: 'rt-scale', area: 'ratios', grade: 7, standard: '7.G.A.1',
  name: 'Scale drawings', short: 'Scale', plain: 'Uses a scale: on a map where 1 cm stands for 5 km, 4 cm is 20 km, and 20 km is 4 cm.',
  input: 'number', fastMs: 12000,
  subs: [{ id: 'map', label: 'map to real' }, { id: 'back', label: 'real to map' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const where = pick(rng, PLACES);
    const cmPer = r >= 6 ? 3 : r === 4 ? 2 : 1;
    const per = r <= 2 ? pick(rng, [2, 5, 10]) : r === 4 ? pick(rng, [5, 3, 7]) : r === 6 ? pick(rng, [50, 20, 10]) : int(rng, 2, 20);
    const unit = r === 6 ? 'm' : 'km';
    const label = `${cmPer} cm = ${per} ${unit}`;
    // the map length: whole centimetres (in steps of the scale's own cm), or half ones on rung 5
    const steps = int(rng, 2, perRung(r, [5, 8, 10, 6, 10, 6]));
    const cm = r === 5 ? dec(int(rng, 3, 19) / 2, 1) : steps * cmPer;
    const real = dec((cm / cmPer) * per, 2);
    const base = { skill: 'rt-scale', key: `rt-scale:${sub}`, input: 'number' as const, weight: Math.min(5, 2 + (r >= 4 ? 1 : 0) + (r >= 5 ? 1 : 0)) };
    if (sub === 'back') return { ...base, id: `rt-scale:back:${label}:${cm}`, ask: `On the map, ${label}. How many cm for ${real} ${unit} to ${where}?`,
      prompt: [tx(label), op('·'), num(real), tx(unit), op('='), blank, tx('cm')], answer: n(cm),
      explain: `${real} ÷ ${per} = ${dec(cm / cmPer, 2)} lots of ${per} ${unit}${cmPer > 1 ? `, and each lot is ${cmPer} cm` : ''}: ${cm} cm.`,
      trick: { name: 'How many lots?', say: `Find how many lots of ${per} ${unit} fit in ${real}, then that many lots of ${cmPer} cm.` } };
    return { ...base, id: `rt-scale:map:${label}:${cm}`, ask: `On the map, ${label}. ${cap(where)} is ${cm} cm away. How far is it really?`,
      prompt: [pic({ kind: 'scale', cm, label }), op('='), blank, tx(unit)], answer: n(real),
      explain: `${cm} cm is ${dec(cm / cmPer, 2)} lots of ${cmPer} cm, and each lot is ${per} ${unit}: ${real} ${unit}.`,
      trick: cmPer === 1 ? { name: 'Times the scale', say: `Every centimetre is ${per} ${unit}: times the centimetres by ${per}.` } : { name: 'Lots of the scale', say: `Count how many lots of ${cmPer} cm, then times by ${per}.` } };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

export const RATIO_SKILLS: Skill[] = [rtRatio, rtTable, rtDnl, rtRate, rtPct, rtPctOf, rtWhole, rtUnits, rtProp, rtChange, rtShop, rtScale];
/** the custom inputs this area brings (registered in ui/SkillInput.svelte) */
export const RATIO_INPUTS = ['ratiotable', 'dnl', 'pctbar'] as const;
export type { Item };
