// Data and chance, kindergarten to grade 7 (Common Core K.MD.B.3, 1.MD.C.4, 2.MD.D.9-10, 3.MD.B.3-4,
// 4.MD.B.4, 5.MD.B.2, 6.SP.A.3, 6.SP.B.4-5, 7.SP.C.5-8): sorting and counting prizes, picture graphs, bar
// graphs (reading them, how many more, and dragging a bar to the right height), line plots in halves,
// quarters and eighths (with dots to tap on), how likely something is (with a chance line to drag along),
// the mean as a fair share, the median, mode and range, dot plots, histograms and box plots, chance as a
// fraction, what should happen against what did, and two things at once (lists and trees).
//
// Everything happens at the Chance Fair: prizes from the ring toss, votes for balloon colours, ribbons
// measured in inches, marbles in a bag, spinners with equal parts, dice. Every skill has six rungs
// (skills/types.ts): rung 1 gentle (few groups, small counts, things in order), rung 3 the grade's core,
// rungs 4 to 6 the stretch inside the same standard (scaled graphs, eighths and mixed numbers, two steps,
// halves in the answer, closer calls). Each skill's comment says what its rungs mean. As everywhere, no
// generator draws again "until it's different": every choice comes from a list that already leaves out
// what it mustn't be (distinct counts come from a shuffled range), so a question is made in one go.
import type { Rng } from '../../engine/rng';
import { checkAnswer } from '../skills/fractions';
import { perRung, rungOf, type Answer, type Choice, type Item, type Part, type Skill } from '../skills/types';
import { COLORS, PRIZE, PRIZES, fracText, gcd, prizeWord, type Cat, type ColorId, type DataPic, type PrizeId } from './pics';

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const int = (rng: Rng, lo: number, hi: number) => Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));
/** a shuffled copy (Fisher-Yates: one pass, never loops) */
function shuffle<T>(rng: Rng, xs: readonly T[]): T[] { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.min(i, Math.floor(rng() * (i + 1))); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** k different whole numbers from lo to hi (a shuffled range: never loops) */
const distinct = (rng: Rng, lo: number, hi: number, k: number) => shuffle(rng, Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).slice(0, k);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const sum = (xs: readonly number[]) => xs.reduce((t, x) => t + x, 0);
const dec = (x: number, p = 2) => Number(x.toFixed(p));
const tx = (s: string): Part => ({ t: 'text', s });
const num = (n: number): Part => ({ t: 'num', n });
const op = (s: string): Part => ({ t: 'op', s });
const blank: Part = { t: 'blank' };
const pic = (d: DataPic): Part => ({ t: 'data', d });
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const nA = (value: number): Answer => ({ kind: 'number', value });
/** a fraction answer, or a whole number when it comes out whole (the number pad then, not the fraction pad) */
const fracOrWhole = (n: number, d: number): { answer: Answer; input: 'fraction' | 'number' } =>
  n % d === 0 ? { answer: nA(n / d), input: 'number' } : { answer: { kind: 'fraction', n, d }, input: 'fraction' };
const listText = (xs: readonly number[]) => xs.join(', ');
const check = (it: Item, a: Answer) => checkAnswer(it.answer, a);

// ---------- sort and count ----------
// rungs: 1 two kinds, 1 to 5 of each, already in rows · 2 two kinds to 7, jumbled · 3 three kinds to 9,
// jumbled · 4 three kinds to 10, and "fewest" too · 5 four kinds to 10 · 6 four kinds whose counts are
// only one apart
export const daSort: Skill = {
  id: 'da-sort', area: 'data', grade: 0, standard: 'K.MD.B.3',
  name: 'Sort and count', short: 'Sort', plain: 'Sorts things into groups, counts each group, and says which group has the most or the fewest (up to 10 in a group).',
  input: 'number', fastMs: 8000,
  subs: [{ id: 'count', label: 'how many?' }, { id: 'most', label: 'which has most?' }, { id: 'total', label: 'how many in all?' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const k = perRung(r, [2, 2, 3, 3, 4, 4]);
    const kinds = shuffle(rng, PRIZES).slice(0, k);
    const low = int(rng, 3, 6);
    const ns = r === 6 ? shuffle(rng, range(k).map(i => low + i)) : distinct(rng, 1, perRung(r, [5, 7, 9, 10, 10, 10]), k);
    const items = kinds.flatMap((p, i) => Array.from({ length: ns[i] }, () => p));
    const shown: DataPic = { kind: 'things', items: r === 1 ? items : shuffle(rng, items), sorted: r === 1 };
    const sig = kinds.map((p, i) => `${p}${ns[i]}`).join(',');
    const base = { skill: 'da-sort', key: `da-sort:${sub}`, weight: 1 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0) };
    const all = kinds.map((p, i) => `${ns[i]} ${prizeWord(p, ns[i])}`).join(', ');
    if (sub === 'most') {
      const fewest = r >= 4 && rng() < 0.5;
      const at = ns.indexOf(fewest ? Math.min(...ns) : Math.max(...ns));
      const choices: Choice[] = kinds.map(p => ({ id: p, parts: [pic({ kind: 'prize', prize: p }), tx(cap(PRIZE[p].many))] }));
      return { ...base, id: `da-sort:most:${sig}:${fewest ? 'f' : 'm'}`, ask: fewest ? 'Which kind has the fewest?' : 'Which kind has the most?', prompt: [pic(shown)],
        input: 'choice', choices, answer: { kind: 'choice', id: kinds[at] },
        explain: `There are ${all}. ${cap(PRIZE[kinds[at]].many)} have the ${fewest ? 'fewest' : 'most'}.`,
        trick: { name: 'Sort into rows', say: 'Put each kind in its own row, all starting at the same place. The longest row has the most; the shortest has the fewest.' } };
    }
    if (sub === 'total') {
      const every = r >= 5 || (r === 4 && rng() < 0.5);
      const use = every ? range(k) : [0, 1];
      const tot = sum(use.map(i => ns[i]));
      const what = every ? 'prizes' : `${PRIZE[kinds[0]].many} and ${PRIZE[kinds[1]].many}`;
      return { ...base, id: `da-sort:total:${sig}:${every ? 'all' : '2'}`, ask: `How many ${what} in all?`, prompt: [pic(shown), tx('in all'), op('='), blank],
        input: 'number', answer: nA(tot),
        explain: `${use.map(i => `${ns[i]} ${prizeWord(kinds[i], ns[i])}`).join(' + ')}: ${use.map(i => ns[i]).join(' + ')} = ${tot}.`,
        trick: { name: 'Count each group, then add', say: 'Count one kind at a time, then put the groups together: start with the biggest and count on.' } };
    }
    const t = int(rng, 0, k - 1);
    return { ...base, id: `da-sort:count:${sig}:${kinds[t]}`, ask: `How many ${PRIZE[kinds[t]].many}?`, prompt: [pic(shown), pic({ kind: 'prize', prize: kinds[t] }), op('='), blank],
      input: 'number', answer: nA(ns[t]),
      explain: `Touch each ${PRIZE[kinds[t]].one} once as you count: ${range(ns[t]).map(i => i + 1).join(', ')}. There are ${ns[t]}.`,
      trick: { name: 'Touch and count', say: 'Find every one of that kind first. Touch each one once as you count, and the last number you say is how many.' } };
  },
  check,
};

// ---------- picture graphs ----------
// rungs: 1 two rows, up to 5 pictures · 2 three rows to 6 · 3 four rows to 9 · 4 each picture stands for 2
// (3.MD.B.3) · 5 each picture is 2 or 5, with half pictures, and "how many fewer" · 6 each picture is 5 or
// 10, with half pictures, all four rows in all
function picGraph(rng: Rng, r: number) {
  const k = perRung(r, [2, 3, 4, 4, 4, 4]);
  const per = perRung(r, [1, 1, 1, 2, pick(rng, [2, 5]), pick(rng, [5, 10])]);
  const halves = r >= 5 && per % 2 === 0;
  const kinds = shuffle(rng, PRIZES).slice(0, k);
  // pictures per row, all different (halves from rung 5: 2.5 pictures and so on)
  const top = perRung(r, [5, 6, 9, 8, 7, 7]);
  const pics = distinct(rng, 1, top, k).map(n => (halves && rng() < 0.4 ? n - 0.5 : n));
  const cats: Cat[] = kinds.map((p, i) => ({ name: cap(PRIZE[p].many), n: pics[i] * per, prize: p }));
  return { cats, per, kinds };
}
export const daPicGraph: Skill = {
  id: 'da-picgraph', area: 'data', grade: 2, standard: '2.MD.D.10',
  name: 'Picture graphs', short: 'Picture graph', plain: 'Reads a picture graph: how many in a row, how many more, how many in all. Later each picture stands for 2, 5 or 10 (3.MD.B.3).',
  input: 'number', fastMs: 9000,
  subs: [{ id: 'read', label: 'how many?' }, { id: 'more', label: 'how many more?' }, { id: 'total', label: 'how many in all?' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const { cats, per } = picGraph(rng, r);
    const g: DataPic = { kind: 'picgraph', cats, per, title: 'Prizes won today' };
    const sig = cats.map(c => `${c.prize}${c.n}`).join(',') + `/${per}`;
    const key = per > 1 ? `Each picture is ${per}${cats.some(c => c.n % per) ? `, so half a picture is ${per / 2}` : ''}.` : 'Each picture is 1.';
    const base = { skill: 'da-picgraph', key: `da-picgraph:${sub}`, weight: Math.min(5, 1 + (r >= 3 ? 1 : 0) + (r >= 4 ? 1 : 0) + (sub === 'read' ? 0 : 1)) };
    const trick = per > 1
      ? { name: 'Read the key', say: `Look at the key first: each picture stands for ${per}. Count by ${per}s along the row${per % 2 === 0 ? `, and a half picture is ${per / 2}` : ''}.` }
      : { name: 'Count along the row', say: 'Each picture is one. Count along the row from the start.' };
    const rowText = (c: Cat) => (per > 1 ? `${c.n / per} pictures × ${per} = ${c.n}` : `${c.n}`);
    if (sub === 'more') {
      const order = shuffle(rng, range(cats.length)).slice(0, 2).sort((a, b) => cats[b].n - cats[a].n);
      const [a, b] = [cats[order[0]], cats[order[1]]];
      const fewer = r >= 5 && rng() < 0.5;
      return { ...base, id: `da-picgraph:more:${sig}:${a.prize}-${b.prize}:${fewer ? 'f' : 'm'}`,
        ask: fewer ? `How many fewer ${b.name.toLowerCase()} than ${a.name.toLowerCase()}?` : `How many more ${a.name.toLowerCase()} than ${b.name.toLowerCase()}?`,
        prompt: [pic(g), tx(fewer ? `${b.name} fewer` : `${a.name} more`), op('='), blank], input: 'number', answer: nA(a.n - b.n),
        explain: `${key} ${a.name}: ${rowText(a)}. ${b.name}: ${rowText(b)}. ${a.n} − ${b.n} = ${a.n - b.n}.`,
        trick: { name: 'Line them up', say: `Look where the shorter row stops. The pictures past it on the longer row are how many more${per > 1 ? `: count them by ${per}s` : ''}. Or take the small number away from the big one.` } };
    }
    if (sub === 'total') {
      const every = r >= 4 || cats.length === 2;
      const use = every ? cats : shuffle(rng, cats).slice(0, 2);
      const tot = sum(use.map(c => c.n));
      return { ...base, id: `da-picgraph:total:${sig}:${use.map(c => c.prize).join('+')}`,
        ask: every ? 'How many prizes in all?' : `How many ${use[0].name.toLowerCase()} and ${use[1].name.toLowerCase()} in all?`,
        prompt: [pic(g), tx('in all'), op('='), blank], input: 'number', answer: nA(tot),
        explain: `${key} ${use.map(c => `${c.name} ${c.n}`).join(', ')}. ${use.map(c => c.n).join(' + ')} = ${tot}.`, trick };
    }
    const c = pick(rng, cats);
    return { ...base, id: `da-picgraph:read:${sig}:${c.prize}`, ask: `How many ${c.name.toLowerCase()}?`, prompt: [pic(g), tx(c.name), op('='), blank], input: 'number', answer: nA(c.n),
      explain: `${key} ${c.name}: ${rowText(c)}.`, trick };
  },
  check,
};

// ---------- bar graphs ----------
// rungs: 1 lines every 1, up to 5 · 2 lines every 1, up to 10 · 3 lines every 2 (the bars end on a line) ·
// 4 lines every 2 with bars that end between two lines, or every 5 · 5 lines every 5 or 10, and two steps
// (two bars together against a third) · 6 lines every 10 up to 100, bars that end halfway, lying down
const VOTE = ['red', 'blue', 'yellow', 'green', 'purple'] as const satisfies readonly ColorId[];
function barGraph(rng: Rng, r: number) {
  const k = perRung(r, [3, 3, 4, 4, 4, 4]);
  const step = perRung(r, [1, 1, 2, pick(rng, [2, 2, 5]), pick(rng, [5, 10]), 10]);
  const lines = perRung(r, [5, 10, 10, 10, 10, 10]);
  const max = step * lines;
  // a bar can end on a line, or halfway (rung 4 up, when halfway is a whole number)
  const half = r >= 4 && step % 2 === 0;
  const unit = half ? step / 2 : step;
  const ns = distinct(rng, 1, Math.floor(max / unit) - (half ? 1 : 0), k).map(x => x * unit);
  const colors = shuffle(rng, VOTE).slice(0, k);
  const cats: Cat[] = colors.map((c, i) => ({ name: cap(c), n: ns[i], color: c }));
  return { cats, step, max, unit, flip: r === 6 && rng() < 0.5 };
}
export const daBars: Skill = {
  id: 'da-bars', area: 'data', grade: 3, standard: '3.MD.B.3',
  name: 'Bar graphs', short: 'Bar graph', plain: 'Reads and makes bar graphs whose lines count by 1s, 2s, 5s or 10s: how many, how many more, and dragging a bar to the right height.',
  input: 'number', fastMs: 10000,
  subs: [{ id: 'read', label: 'how many?' }, { id: 'more', label: 'how many more?' }, { id: 'make', label: 'drag the bar' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const { cats, step, max, unit, flip } = barGraph(rng, r);
    const g: DataPic = { kind: 'bars', cats, step, max, title: 'Balloon votes', flip };
    const sig = cats.map(c => `${c.color}${c.n}`).join(',') + `/${step}${flip ? 'f' : ''}`;
    const base = { skill: 'da-bars', key: `da-bars:${sub}`, weight: Math.min(5, 1 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0) + (sub === 'read' ? 0 : 1)) };
    const scale = step > 1 ? `The lines count by ${step}s.` : 'The lines count by 1s.';
    const trick = { name: 'Follow the top', say: `Run your finger from the top of the bar across to the numbers.${step > 1 ? ` The lines count by ${step}s; a bar that stops between two lines is halfway.` : ''}` };
    if (sub === 'make') {
      const h = int(rng, 0, cats.length - 1), c = cats[h];
      // rung 5 up: the new bar is told by how it compares to another
      const rel = r >= 5 && rng() < 0.6 ? cats.find((x, i) => i !== h && Math.abs(x.n - c.n) <= max / 2) : undefined;
      const say = rel ? `${c.name} got ${Math.abs(c.n - rel.n)} ${c.n > rel.n ? 'more' : 'fewer'} votes than ${rel.name.toLowerCase()}.` : `${c.name} got ${c.n} votes.`;
      return { ...base, id: `da-bars:make:${sig}:${c.color}${rel ? `~${rel.color}` : ''}`, ask: `${say} Drag the ${c.name.toLowerCase()} bar to the right height.`,
        prompt: [tx(say)], input: 'custom', custom: { name: 'bars', spec: { pic: { ...g, hide: h }, snap: unit } }, answer: nA(c.n),
        explain: `${rel ? `${rel.name} has ${rel.n}, so ${c.name.toLowerCase()} has ${rel.n} ${c.n >= rel.n ? '+' : '−'} ${Math.abs(c.n - rel.n)} = ${c.n}. ` : ''}${scale} ${c.n} is ${c.n % step ? `halfway between ${c.n - unit} and ${c.n + unit}` : `on the ${c.n} line`}.`,
        trick: { name: 'Count up the lines', say: `Count up the lines by ${step}s to the number you need.${unit < step ? ' Halfway between two lines is the number in the middle.' : ''}` } };
    }
    if (sub === 'more') {
      const two = r >= 5 && rng() < 0.5;
      if (two) {
        // the two bigger bars together, against the smallest
        const order = range(cats.length).sort((a, b) => cats[a].n - cats[b].n);
        const s = cats[order[0]], [a, b] = [cats[order[order.length - 1]], cats[order[order.length - 2]]];
        const v = a.n + b.n - s.n;
        return { ...base, weight: 5, id: `da-bars:more2:${sig}`, ask: `How many more votes for ${a.name.toLowerCase()} and ${b.name.toLowerCase()} together than for ${s.name.toLowerCase()}?`,
          prompt: [pic(g), tx(`${a.name} + ${b.name}`), op('−'), tx(s.name), op('='), blank], input: 'number', answer: nA(v),
          explain: `${scale} ${a.name} ${a.n} and ${b.name.toLowerCase()} ${b.n} make ${a.n + b.n}. ${a.n + b.n} − ${s.n} = ${v}.`,
          trick: { name: 'One step at a time', say: 'Read each bar first. Add the two together, then take away the third.' } };
      }
      const [i, j] = shuffle(rng, range(cats.length)).slice(0, 2).sort((x, y) => cats[y].n - cats[x].n);
      const a = cats[i], b = cats[j];
      return { ...base, id: `da-bars:more:${sig}:${a.color}-${b.color}`, ask: `How many more votes for ${a.name.toLowerCase()} than ${b.name.toLowerCase()}?`,
        prompt: [pic(g), tx(`${a.name} more than ${b.name}`), op('='), blank], input: 'number', answer: nA(a.n - b.n),
        explain: `${scale} ${a.name} has ${a.n}, ${b.name.toLowerCase()} has ${b.n}. ${a.n} − ${b.n} = ${a.n - b.n}.`,
        trick: { name: 'Mind the gap', say: 'Read both bars. How many more is the gap between their tops: take the smaller number away from the bigger one.' } };
    }
    const c = pick(rng, cats);
    return { ...base, id: `da-bars:read:${sig}:${c.color}`, ask: `How many votes for ${c.name.toLowerCase()}?`, prompt: [pic(g), tx(c.name), op('='), blank], input: 'number', answer: nA(c.n),
      explain: `${scale} The ${c.name.toLowerCase()} bar ${c.n % step ? `stops halfway between ${c.n - unit} and ${c.n + unit}` : `reaches the ${c.n} line`}: ${c.n}.`, trick };
  },
  check,
};

// ---------- line plots ----------
// rungs: 1 whole inches from 1 to 6 (2.MD.D.9) · 2 halves from 1 to 4 (3.MD.B.4) · 3 quarters from 0 to 2
// · 4 eighths from 0 to 1 (4.MD.B.4) · 5 mixed numbers from 1 to 3 in quarters · 6 mixed numbers from 1 to 2
// in eighths, more ribbons
function linePlot(rng: Rng, r: number) {
  const [min, max, den] = perRung(r, [[1, 6, 1], [1, 4, 2], [0, 2, 4], [0, 1, 8], [1, 3, 4], [1, 2, 8]] as [number, number, number][]);
  const ticks = (max - min) * den + 1;
  // which ticks have ribbons (never the 0 tick: a ribbon has a length), and how many on each
  const first = min === 0 ? 1 : 0;
  const used = distinct(rng, first, ticks - 1, Math.min(ticks - first, perRung(r, [4, 4, 4, 5, 5, 5]))).sort((a, b) => a - b);
  const counts = used.map(() => int(rng, 1, perRung(r, [3, 3, 4, 4, 4, 5])));
  const marks = used.flatMap((t, i) => Array.from({ length: counts[i] }, () => min + t / den));
  return { min, max, den, used, counts, marks };
}
export const daLinePlot: Skill = {
  id: 'da-lineplot', area: 'data', grade: 4, standard: '4.MD.B.4',
  name: 'Line plots', short: 'Line plots', plain: 'Makes and reads line plots of lengths in halves, quarters and eighths of an inch: how many, the longest take away the shortest, and all of one length put end to end (2.MD.D.9 to 5.MD.B.2).',
  input: 'number', fastMs: 12000,
  subs: [{ id: 'read', label: 'how many?' }, { id: 'diff', label: 'longest − shortest' }, { id: 'total', label: 'end to end' }, { id: 'make', label: 'tap the dots' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const { min, max, den, used, counts, marks } = linePlot(rng, r);
    const g: DataPic = { kind: 'line', min, max, den, marks, unit: 'inches', title: 'Ribbon lengths (inches)' };
    const at = (t: number) => min + t / den;
    const ft = (t: number) => fracText(at(t), den);
    const sig = `${min}-${max}/${den}:${used.map((t, i) => `${t}x${counts[i]}`).join(',')}`;
    const base = { skill: 'da-lineplot', key: `da-lineplot:${sub}`, weight: Math.min(5, 1 + (den >= 2 ? 1 : 0) + (den >= 4 ? 1 : 0) + (r >= 5 ? 1 : 0) + (sub === 'diff' || sub === 'total' ? 1 : 0)) };
    const trick = { name: 'One dot, one ribbon', say: 'Each dot is one ribbon. The number under a stack is how long those ribbons are.' };
    if (sub === 'make') {
      const vals = shuffle(rng, marks).slice(0, Math.min(marks.length, perRung(r, [5, 5, 6, 7, 7, 8])));
      const ticks = (max - min) * den + 1;
      const cnt = range(ticks).map(t => vals.filter(v => Math.abs(v - at(t)) < 1e-9).length);
      const id = cnt.join(',');
      const right: DataPic = { kind: 'line', min, max, den, marks: vals, unit: 'inches' };
      return { ...base, id: `da-lineplot:make:${min}-${max}/${den}:${vals.map(v => fracText(v, den)).join(',')}`, ask: 'Put a dot over the line for each ribbon: tap above its length.',
        prompt: [pic({ kind: 'list', values: vals, unit: 'in', den })], input: 'custom', custom: { name: 'dots', spec: { min, max, den, unit: 'inches' } },
        choices: [{ id, parts: [pic(right)] }], answer: { kind: 'choice', id }, weight: Math.min(5, base.weight + 1),
        explain: `One dot for each ribbon: ${range(ticks).filter(t => cnt[t]).map(t => `${cnt[t]} over ${ft(t)}`).join(', ')}.`,
        trick: { name: 'Tick them off', say: 'Take the ribbons one at a time: find its length on the line and put one dot above it. Stack dots when two are the same.' } };
    }
    if (sub === 'diff') {
      const lo = used[0], hi = used[used.length - 1], n = hi - lo;
      const { answer, input } = fracOrWhole(n, den);
      return { ...base, id: `da-lineplot:diff:${sig}`, ask: 'How much longer is the longest ribbon than the shortest?', prompt: [pic(g), tx(`${ft(hi)} − ${ft(lo)}`), op('='), blank],
        input, answer, explain: `The longest is ${ft(hi)}, the shortest ${ft(lo)}. ${ft(hi)} − ${ft(lo)} = ${fracText(n / den, den)}${den > 1 && n > den ? ` (${n}/${den})` : ''} inches.`,
        trick: { name: 'Count the jumps', say: `Find the dots furthest left and right. Count the jumps between them on the line: each jump is ${den === 1 ? '1 inch' : `1/${den} of an inch`}.` } };
    }
    if (sub === 'total') {
      const i = int(rng, 0, used.length - 1), t = used[i], c = counts[i];
      const n = c * (Math.round(at(t) * den));
      const { answer, input } = fracOrWhole(n, den);
      return { ...base, id: `da-lineplot:total:${sig}:${t}`, ask: `Put all the ${ft(t)}-inch ribbons end to end. How long is that?`, prompt: [pic(g), tx(`${c} × ${ft(t)}`), op('='), blank],
        input, answer, explain: `There are ${c} ribbons of ${ft(t)} inch${at(t) === 1 ? '' : 'es'}. ${c} × ${ft(t)} = ${fracText(n / den, den)}${den > 1 && n > den && n % den ? ` (${n}/${den})` : ''} inches.`,
        trick: { name: 'Count the dots, then times', say: 'Count the dots in that stack: that many ribbons. Add the length that many times (times it), then make wholes from the parts.' } };
    }
    const i = int(rng, 0, used.length - 1);
    return { ...base, id: `da-lineplot:read:${sig}:${used[i]}`, ask: `How many ribbons are ${ft(used[i])} inch${at(used[i]) === 1 ? '' : 'es'} long?`, prompt: [pic(g), tx(`${ft(used[i])} in`), op('='), blank],
      input: 'number', answer: nA(counts[i]), explain: `There ${counts[i] === 1 ? 'is 1 dot' : `are ${counts[i]} dots`} over ${ft(used[i])}: ${counts[i]} ribbon${counts[i] === 1 ? '' : 's'}.`, trick };
  },
  check,
};

// ---------- how likely? ----------
// rungs: 1 certain or impossible (every marble red, or none) · 2 unlikely and likely too, far apart (1 of
// 6, 5 of 6) · 3 "even chance" too (half of them) · 4 closer calls (3 of 8, 5 of 8) and spinners · 5 dice
// ("roll a 7" can't happen) · 6 the closest (4 of 10 or 6 of 10); the chance line in tenths and twelfths
const WORDS = ['impossible', 'unlikely', 'even', 'likely', 'certain'] as const;
type Word = (typeof WORDS)[number];
const WORD_TEXT: Record<Word, string> = { impossible: 'Impossible', unlikely: 'Unlikely', even: 'Even chance', likely: 'Likely', certain: 'Certain' };
const wordOf = (n: number, d: number): Word => (n === 0 ? 'impossible' : n === d ? 'certain' : 2 * n === d ? 'even' : 2 * n < d ? 'unlikely' : 'likely');
/** a bag of marbles: `red` of them red, the rest one or two other colours */
function bagOf(rng: Rng, red: number, total: number, other = pick(rng, COLORS.filter(c => c !== 'red'))): DataPic {
  const rest = total - red;
  const third = rest >= 4 && rng() < 0.4 ? pick(rng, COLORS.filter(c => c !== 'red' && c !== other)) : null;
  const b = third ? Math.floor(rest / 2) : rest;
  const marbles: { color: ColorId; n: number }[] = [{ color: 'red', n: red }, { color: other, n: b }, ...(third ? [{ color: third, n: rest - b }] : [])];
  return { kind: 'bag', marbles: marbles.filter(m => m.n > 0) };
}
const spinnerOf = (rng: Rng, red: number, total: number): DataPic => {
  const other = pick(rng, COLORS.filter(c => c !== 'red'));
  return { kind: 'spinner', parts: shuffle(rng, range(total).map(i => (i < red ? 'red' : other) as ColorId)) };
};
export const daLikely: Skill = {
  id: 'da-likely', area: 'data', grade: 2, standard: '7.SP.C.5',
  name: 'How likely?', short: 'Likely?', plain: 'Says how likely something is (impossible, unlikely, even chance, likely or certain) from a bag of marbles, a spinner or a die, and puts it on a line from impossible to certain: an early taste of 7.SP.C.5.',
  input: 'choice', fastMs: 9000,
  subs: [{ id: 'words', label: 'which word?' }, { id: 'best', label: 'which is best?' }, { id: 'line', label: 'on the chance line' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const base = { skill: 'da-likely', key: `da-likely:${sub}`, trick: { name: 'Count the chances', say: 'Count the ways it can happen and all the ways there are. None: impossible. All: certain. Half: an even chance. Fewer than half: unlikely. More: likely.' } };
    if (sub === 'line') {
      const d = perRung(r, [2, 4, pick(rng, [4, 6]), 8, 10, pick(rng, [10, 12])]);
      const n = int(rng, 1, d - 1);
      const spin = r >= 4 && rng() < 0.5;
      const tol = perRung(r, [0.16, 0.12, 0.1, 0.08, 0.06, 0.05]);
      return { ...base, id: `da-likely:line:${n}/${d}${spin ? 's' : 'b'}`, ask: `Pick one without looking. How likely is red? Drag the star along the line.`,
        prompt: [pic(spin ? spinnerOf(rng, n, d) : bagOf(rng, n, d))], input: 'custom', custom: { name: 'chance', spec: { den: d, tol } },
        line: { min: 0, max: 1, step: 1 / d, labels: 'ends', denom: d }, answer: { kind: 'point', x: n / d }, weight: Math.min(5, 2 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0)),
        explain: `${n} of the ${d} are red: ${n}/${d}. That's ${wordOf(n, d) === 'even' ? 'right in the middle' : `${2 * n < d ? 'nearer impossible' : 'nearer certain'}`}, ${n}/${d} of the way along.`,
        trick: { name: 'Cut the line', say: `Cut the line into ${d} equal steps, one for each marble or part. Red has ${n} of them: go ${n} steps from impossible.` } };
    }
    if (sub === 'best') {
      // two bags (three from rung 4); from rung 4 the bag with the most red marbles isn't always the best
      const k = r >= 4 ? 3 : 2;
      const fr = perRung(r, [
        [[1, 4], [3, 4]], [[1, 5], [4, 5]], [[1, 4], [2, 4], [3, 4]], [[3, 10], [2, 3], [1, 2]], [[2, 8], [3, 5], [4, 10]], [[4, 10], [3, 5], [5, 12]],
      ] as [number, number][][]);
      const set = shuffle(rng, fr).slice(0, k);
      const best = set.reduce((bi, f, i) => (f[0] / f[1] > set[bi][0] / set[bi][1] ? i : bi), 0);
      const ids = ['A', 'B', 'C'];
      const choices: Choice[] = set.map((f, i) => ({ id: ids[i], parts: [pic(bagOf(rng, f[0], f[1], 'blue'))] }));
      return { ...base, id: `da-likely:best:${set.map(f => f.join('/')).join(',')}`, ask: 'Pick one marble without looking. Which bag gives you the best chance of red?', prompt: [tx('Best chance of red?')],
        input: 'choice', choices, answer: { kind: 'choice', id: ids[best] }, weight: Math.min(5, 2 + (r >= 4 ? 2 : 0)),
        explain: `${set.map(f => `${f[0]} red of ${f[1]}`).join(', ')}. ${set[best][0]} of ${set[best][1]} is the biggest part of its bag.`,
        trick: { name: 'Part of the whole bag', say: 'More red marbles isn\'t enough: what counts is how much of the WHOLE bag is red. Compare red to all the marbles in each bag.' } };
    }
    // the words
    const words: Word[] = perRung(r, [['impossible', 'certain'], ['impossible', 'unlikely', 'likely', 'certain'], [...WORDS], [...WORDS], [...WORDS], [...WORDS]] as Word[][]);
    let n: number, d: number, what: Part[], say: string;
    const die = r >= 5 && rng() < 0.5;
    if (die) {
      const ev = pick(rng, [['a 7', 0], ['a number less than 7', 6], ['a 6', 1], ['a number bigger than 1', 5], ['an even number', 3], ['a 1 or a 2', 2], ['a number bigger than 2', 4]] as [string, number][]);
      n = ev[1]; d = 6; what = [pic({ kind: 'dice', faces: [] })]; say = `Roll the die. How likely is ${ev[0]}?`;
    } else {
      const want = pick(rng, words);
      d = perRung(r, [pick(rng, [3, 4, 5]), 6, pick(rng, [4, 6]), 8, 10, 10]);
      n = want === 'impossible' ? 0 : want === 'certain' ? d : want === 'even' ? d / 2 : want === 'unlikely' ? perRung(r, [1, 1, 1, pick(rng, [1, 2, 3]), pick(rng, [2, 3, 4]), 4]) : d - perRung(r, [1, 1, 1, pick(rng, [1, 2, 3]), pick(rng, [2, 3, 4]), 4]);
      const spin = r >= 4 && rng() < 0.4 && n > 0;
      what = [pic(spin ? spinnerOf(rng, n, d) : n === 0 ? { kind: 'bag', marbles: [{ color: 'blue', n: Math.ceil(d / 2) }, { color: 'green', n: Math.floor(d / 2) }] } : bagOf(rng, n, d))];
      say = spin ? 'Spin it. How likely is red?' : 'Pick one without looking. How likely is red?';
    }
    const w = wordOf(n, d);
    // four choices at most: the right word and its neighbours first
    const opts = words.length <= 4 ? words : WORDS.filter(x => x !== (w === 'impossible' || w === 'unlikely' ? 'certain' : w === 'certain' || w === 'likely' ? 'impossible' : 'certain'));
    return { ...base, id: `da-likely:words:${die ? 'die' : 'bag'}:${n}/${d}`, ask: say, prompt: what,
      input: 'choice', choices: opts.map(x => ({ id: x, parts: [tx(WORD_TEXT[x])] })), answer: { kind: 'choice', id: w }, weight: Math.min(5, 1 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0)),
      explain: `${n} of ${d} ${die ? 'numbers on the die work' : 'can be red'}: ${w === 'even' ? 'half, an even chance' : `${WORD_TEXT[w].toLowerCase()}`}.` };
  },
  check: (it, a) => (it.answer.kind === 'point' && a.kind === 'point' ? Math.abs(a.x - it.answer.x) <= ((it.custom?.spec as { tol?: number })?.tol ?? 1e-6) + 1e-9 : checkAnswer(it.answer, a)),
};

// ---------- the mean: a fair share ----------
// rungs: 1 three towers of blocks, the mean 2 to 4 · 2 four towers, the mean to 6 · 3 lists of four or five
// numbers to 20 · 4 five or six numbers to 50 · 5 a number missing: what makes the mean? · 6 the mean comes
// out with a half (x.5)
/** k numbers whose mean is m: start them all at m, then move units from one to another (never below lo) */
function withMean(rng: Rng, k: number, m: number, spread: number, lo = 1): number[] {
  const xs = Array.from({ length: k }, () => m);
  for (let s = 0; s < k * 2; s++) {
    const i = int(rng, 0, k - 1), others = range(k).filter(x => x !== i), j = pick(rng, others);
    const amt = Math.min(int(rng, 1, Math.max(1, spread)), xs[i] - lo);
    xs[i] -= amt; xs[j] += amt;
  }
  return xs;
}
export const daMean: Skill = {
  id: 'da-mean', area: 'data', grade: 6, standard: '6.SP.B.5c',
  name: 'Fair share (the mean)', short: 'Mean', plain: 'Finds the mean as a fair share: level the towers so they are all the same height, or add the numbers up and share the total by how many there are.',
  input: 'number', fastMs: 15000,
  subs: [{ id: 'level', label: 'level the towers' }, { id: 'list', label: 'from a list' }, { id: 'missing', label: 'the missing number' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const k = perRung(r, [3, 4, pick(rng, [4, 5]), pick(rng, [5, 6]), pick(rng, [4, 5]), pick(rng, [4, 6])]);
    const m = int(rng, ...perRung(r, [[2, 4], [3, 6], [6, 15], [12, 40], [10, 40], [8, 40]] as [number, number][]));
    const spread = perRung(r, [1, 2, 4, 8, 8, 8]);
    let xs = withMean(rng, k, sub === 'level' ? Math.min(m, perRung(r, [4, 6, 7, 8, 8, 8])) : m, sub === 'level' ? Math.min(spread, 2) : spread);
    // rung 6: add a half to the mean (k/2 of them one more)
    if (r === 6 && k % 2 === 0) xs = xs.map((x, i) => (i < k / 2 ? x + 1 : x));
    xs = shuffle(rng, xs);
    const tot = sum(xs), mean = dec(tot / k);
    const base = { skill: 'da-mean', key: `da-mean:${sub}`, weight: Math.min(5, 2 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0) + (sub === 'missing' ? 1 : 0)),
      trick: { name: 'Fair share', say: 'The mean is what each would get if you shared fairly: add them all up, then divide by how many there are.' } };
    if (sub === 'missing') {
      const hide = int(rng, 0, k - 1), v = xs[hide], rest = xs.filter((_, i) => i !== hide);
      return { ...base, id: `da-mean:missing:${rest.join(',')}:${mean}`, ask: `The mean of these ${k} numbers is ${mean}. What is the missing number?`,
        prompt: [pic({ kind: 'list', values: rest }), tx(`and ?  mean ${mean}`), op('→'), blank], input: 'number', answer: nA(v),
        explain: `${k} numbers with a mean of ${mean} add up to ${k} × ${mean} = ${tot}. The others make ${sum(rest)}, so the missing one is ${tot} − ${sum(rest)} = ${v}.`,
        trick: { name: 'Work back from the total', say: 'Mean times how many gives the total. Take away the numbers you know: what\'s left is the missing one.' } };
    }
    if (sub === 'level') {
      return { ...base, id: `da-mean:level:${xs.join(',')}`, ask: `Share the blocks fairly so all ${k} towers are the same height. How tall is each one?`,
        prompt: [pic({ kind: 'towers', heights: xs }), tx('each'), op('='), blank], input: 'number', answer: nA(mean),
        explain: `${xs.join(' + ')} = ${tot} blocks, shared by ${k} towers: ${tot} ÷ ${k} = ${mean}.` };
    }
    return { ...base, id: `da-mean:list:${xs.join(',')}`, ask: 'What is the mean?', prompt: [pic({ kind: 'list', values: xs }), tx('mean'), op('='), blank], input: 'number', answer: nA(mean),
      explain: `Add them: ${xs.join(' + ')} = ${tot}. Share by ${k}: ${tot} ÷ ${k} = ${mean}.` };
  },
  check,
};

// ---------- median, mode and range ----------
// rungs: 1 five numbers to 10, in order · 2 five numbers jumbled · 3 seven numbers to 20, jumbled · 4 six
// numbers to 30 (two middles: halfway) · 5 seven or eight numbers to 100 · 6 nine or ten numbers to 100
export const daMiddle: Skill = {
  id: 'da-middle', area: 'data', grade: 6, standard: '6.SP.B.5c',
  name: 'Median, mode and range', short: 'Median', plain: 'Finds the median (the middle number when they are in order), the mode (the number that comes up most) and the range (the biggest take away the smallest).',
  input: 'number', fastMs: 14000,
  subs: [{ id: 'median', label: 'the median' }, { id: 'mode', label: 'the mode' }, { id: 'range', label: 'the range' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const k = perRung(r, [5, 5, 7, 6, pick(rng, [7, 8]), pick(rng, [9, 10])]);
    const top = perRung(r, [10, 10, 20, 30, 100, 100]);
    // k-1 different numbers and one of them twice (a clear mode); the median and range work on any of them
    const vals = distinct(rng, 1, top, k - 1);
    const twice = pick(rng, vals);
    const xs = [...vals, twice];
    const sorted = xs.slice().sort((a, b) => a - b);
    const shown = r === 1 ? sorted : shuffle(rng, xs);
    const mid = k % 2 ? sorted[(k - 1) / 2] : dec((sorted[k / 2 - 1] + sorted[k / 2]) / 2);
    const base = { skill: 'da-middle', key: `da-middle:${sub}`, weight: Math.min(5, 1 + (r >= 2 ? 1 : 0) + (r >= 4 ? 1 : 0) + (r >= 6 ? 1 : 0)) };
    const prompt = (w: string): Part[] => [pic({ kind: 'list', values: shown, sorted: r === 1 }), tx(w), op('='), blank];
    if (sub === 'mode') return { ...base, id: `da-middle:mode:${shown.join(',')}`, ask: 'What is the mode: the number that comes up most?', prompt: prompt('mode'), input: 'number', answer: nA(twice),
      explain: `${twice} comes up twice; every other number once. The mode is ${twice}.`, trick: { name: 'Most often', say: 'The mode is the one you see most. Put them in order so the same numbers sit together.' } };
    if (sub === 'range') { const v = sorted[k - 1] - sorted[0]; return { ...base, id: `da-middle:range:${shown.join(',')}`, ask: 'What is the range: the biggest take away the smallest?', prompt: prompt('range'), input: 'number', answer: nA(v),
      explain: `Biggest ${sorted[k - 1]}, smallest ${sorted[0]}: ${sorted[k - 1]} − ${sorted[0]} = ${v}.`, trick: { name: 'Biggest take smallest', say: 'Find the biggest and the smallest, then take the smallest away from the biggest. That\'s how spread out they are.' } }; }
    return { ...base, id: `da-middle:median:${shown.join(',')}`, ask: 'What is the median: the middle number when they are in order?', prompt: prompt('median'), input: 'number', answer: nA(mid),
      explain: `In order: ${listText(sorted)}. ${k % 2 ? `The middle one is ${mid}.` : `Two in the middle, ${sorted[k / 2 - 1]} and ${sorted[k / 2]}: halfway between is ${mid}.`}`,
      trick: { name: 'Put them in order', say: 'Line them up from smallest to biggest, then cross one off each end until you reach the middle. Two left in the middle? Go halfway between them.' } };
  },
  check,
};

// ---------- dot plots, histograms and box plots ----------
// rungs: 1 a dot plot: how many at one number · 2 how many in all; a histogram's tallest bar; a box plot's
// middle line · 3 the mode; two bars together; the biggest and smallest · 4 at least a number; the range ·
// 5 the median from dots; fewer than a number; the middle half (the box) · 6 more bars, bigger numbers
export const daPlots: Skill = {
  id: 'da-plots', area: 'data', grade: 6, standard: '6.SP.B.4',
  name: 'Dot plots, histograms and box plots', short: 'Plots', plain: 'Reads data from a dot plot, a histogram or a box plot: how many, the most common, the median, the range, and the middle half (the box).',
  input: 'number', fastMs: 14000,
  subs: [{ id: 'dot', label: 'dot plots' }, { id: 'hist', label: 'histograms' }, { id: 'box', label: 'box plots' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const base = { skill: 'da-plots', key: `da-plots:${sub}`, weight: Math.min(5, 2 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0)) };
    if (sub === 'dot') {
      // rides each kid went on, 0 to 8
      const max = 8, ticks = distinct(rng, 0, max, perRung(r, [4, 5, 5, 6, 6, 7])).sort((a, b) => a - b);
      const cnt = distinct(rng, 1, perRung(r, [4, 5, 6, 6, 7, 7]), ticks.length);
      const marks = ticks.flatMap((t, i) => Array.from({ length: cnt[i] }, () => t));
      const g: DataPic = { kind: 'line', min: 0, max, den: 1, marks, title: 'Rides each kid went on' };
      const sig = ticks.map((t, i) => `${t}x${cnt[i]}`).join(',');
      const q = perRung(r, ['at', 'all', 'mode', 'least', 'median', pick(rng, ['median', 'least'])]);
      const total = marks.length;
      if (q === 'all') return { ...base, id: `da-plots:dot:all:${sig}`, ask: 'Each dot is one kid. How many kids in all?', prompt: [pic(g), tx('kids'), op('='), blank], input: 'number', answer: nA(total),
        explain: `Count every dot: ${cnt.join(' + ')} = ${total}.`, trick: { name: 'One dot, one kid', say: 'Each dot is one kid. Add up the stacks.' } };
      if (q === 'mode') { const i = cnt.indexOf(Math.max(...cnt)); return { ...base, id: `da-plots:dot:mode:${sig}`, ask: 'What number of rides is the most common (the mode)?', prompt: [pic(g), tx('mode'), op('='), blank], input: 'number', answer: nA(ticks[i]),
        explain: `The tallest stack is over ${ticks[i]}: ${cnt[i]} kids went on ${ticks[i]} rides.`, trick: { name: 'Tallest stack', say: 'The mode is the number under the tallest stack of dots.' } }; }
      if (q === 'least') {
        const cut = ticks[int(rng, 1, ticks.length - 1)], v = sum(ticks.map((t, i) => (t >= cut ? cnt[i] : 0)));
        return { ...base, id: `da-plots:dot:least:${sig}:${cut}`, ask: `How many kids went on ${cut} rides or more?`, prompt: [pic(g), tx(`${cut} or more`), op('='), blank], input: 'number', answer: nA(v),
          explain: `Add the stacks from ${cut} up: ${ticks.map((t, i) => (t >= cut ? cnt[i] : 0)).filter(Boolean).join(' + ')} = ${v}.`, trick: { name: 'From there up', say: 'Find the number, then add every stack from there to the right end.' } };
      }
      if (q === 'median') {
        const s = marks.slice().sort((a, b) => a - b), n = s.length, med = n % 2 ? s[(n - 1) / 2] : dec((s[n / 2 - 1] + s[n / 2]) / 2);
        return { ...base, id: `da-plots:dot:median:${sig}`, ask: 'What is the median number of rides?', prompt: [pic(g), tx('median'), op('='), blank], input: 'number', answer: nA(med),
          explain: `${n} dots. Counting in from both ends, the middle ${n % 2 ? `one is dot ${(n + 1) / 2}` : `two are dots ${n / 2} and ${n / 2 + 1}`}: ${med}.`,
          trick: { name: 'Count in from the ends', say: 'The dots are already in order from left to right. Count in from both ends at once until you meet in the middle.' } };
      }
      const i = int(rng, 0, ticks.length - 1);
      return { ...base, id: `da-plots:dot:at:${sig}:${ticks[i]}`, ask: `How many kids went on ${ticks[i]} rides?`, prompt: [pic(g), tx(`${ticks[i]} rides`), op('='), blank], input: 'number', answer: nA(cnt[i]),
        explain: `There are ${cnt[i]} dots over ${ticks[i]}.`, trick: { name: 'One dot, one kid', say: 'Find the number on the line and count the dots above it.' } };
    }
    if (sub === 'hist') {
      // minutes in the line for the big wheel, in bins of 5 or 10
      const w = perRung(r, [10, 10, 10, 5, 10, 10]), k = perRung(r, [3, 3, 4, 5, 5, 6]);
      const ns = distinct(rng, 1, perRung(r, [6, 8, 10, 12, 12, 15]), k);
      const bins = range(k).map(i => ({ lo: i * w, hi: (i + 1) * w, n: ns[i] }));
      const g: DataPic = { kind: 'hist', bins, step: perRung(r, [1, 1, 2, 2, 2, 3]), title: 'Minutes in line for the big wheel' };
      const sig = `${w}:${ns.join(',')}`;
      const q = perRung(r, ['bin', 'all', 'two', 'least', 'fewer', pick(rng, ['least', 'fewer', 'two'])]);
      const binText = (b: { lo: number; hi: number }) => `${b.lo} to ${b.hi}`;
      if (q === 'all') return { ...base, id: `da-plots:hist:all:${sig}`, ask: 'How many people waited in line in all?', prompt: [pic(g), tx('in all'), op('='), blank], input: 'number', answer: nA(sum(ns)),
        explain: `Add every bar: ${ns.join(' + ')} = ${sum(ns)}.`, trick: { name: 'Add the bars', say: 'Each bar counts the people in that range. Add the bars together.' } };
      if (q === 'two') { const i = int(rng, 0, k - 2); return { ...base, id: `da-plots:hist:two:${sig}:${i}`, ask: `How many waited from ${bins[i].lo} to ${bins[i + 1].hi} minutes?`, prompt: [pic(g), tx(`${bins[i].lo} to ${bins[i + 1].hi}`), op('='), blank], input: 'number', answer: nA(ns[i] + ns[i + 1]),
        explain: `That's two bars: ${binText(bins[i])} has ${ns[i]}, ${binText(bins[i + 1])} has ${ns[i + 1]}. ${ns[i]} + ${ns[i + 1]} = ${ns[i] + ns[i + 1]}.`, trick: { name: 'Which bars?', say: 'Find every bar inside the range you\'re asked about, then add them.' } }; }
      if (q === 'least' || q === 'fewer') {
        const c = int(rng, 1, k - 1), at = c * w, v = q === 'least' ? sum(ns.slice(c)) : sum(ns.slice(0, c));
        return { ...base, id: `da-plots:hist:${q}:${sig}:${c}`, ask: q === 'least' ? `How many waited ${at} minutes or more?` : `How many waited less than ${at} minutes?`, prompt: [pic(g), tx(q === 'least' ? `${at} or more` : `under ${at}`), op('='), blank], input: 'number', answer: nA(v),
          explain: `The bars ${q === 'least' ? `from ${at} up` : `below ${at}`}: ${(q === 'least' ? ns.slice(c) : ns.slice(0, c)).join(' + ')} = ${v}.`, trick: { name: 'Which bars?', say: 'Find where the number sits on the bottom line, then add every bar on the side you need.' } };
      }
      const i = int(rng, 0, k - 1);
      return { ...base, id: `da-plots:hist:bin:${sig}:${i}`, ask: `How many waited from ${bins[i].lo} to ${bins[i].hi} minutes?`, prompt: [pic(g), tx(binText(bins[i])), op('='), blank], input: 'number', answer: nA(ns[i]),
        explain: `The bar over ${binText(bins[i])} reaches ${ns[i]}.`, trick: { name: 'Follow the top', say: 'Find the bar for that range, then read across from its top to the numbers.' } };
    }
    // a box plot: points scored at the ring toss
    const step = perRung(r, [10, 10, 10, 5, 10, 20]), lo = 0, hi = step * 10;
    // the five numbers sit on the labelled lines, or halfway between (rungs 5 and 6: small marks show where)
    const unit = perRung(r, [10, 10, 10, 5, 5, 10]);
    const five = distinct(rng, 0, Math.round(hi / unit), 5).sort((a, b) => a - b).map(x => x * unit) as [number, number, number, number, number];
    const g: DataPic = { kind: 'box', five, lo, hi, step, title: 'Ring toss points' };
    const sig = five.join(',');
    const q = perRung(r, ['median', 'median', pick(rng, ['max', 'min']), 'range', 'iqr', pick(rng, ['iqr', 'range', 'median'])]);
    const [mn, q1, md, q3, mx] = five;
    const say: Record<string, [string, number, string]> = {
      median: ['What is the median (the line in the box)?', md, `The line inside the box is the median: ${md}.`],
      max: ['What was the highest score?', mx, `The right end of the whisker is the highest: ${mx}.`],
      min: ['What was the lowest score?', mn, `The left end of the whisker is the lowest: ${mn}.`],
      range: ['What is the range of the scores?', mx - mn, `Highest ${mx} take away lowest ${mn}: ${mx - mn}.`],
      iqr: ['How wide is the box (the middle half of the scores)?', q3 - q1, `The box goes from ${q1} to ${q3}: ${q3} − ${q1} = ${q3 - q1}.`],
    };
    const [ask, v, ex] = say[q];
    return { ...base, id: `da-plots:box:${q}:${sig}`, ask, prompt: [pic(g), tx(q === 'iqr' ? 'box' : q), op('='), blank], input: 'number', answer: nA(v), explain: ex,
      trick: { name: 'Five numbers', say: 'A box plot shows five numbers: the lowest (left end), the bottom of the box, the median (the line inside), the top of the box and the highest (right end).' } };
  },
  check,
};

// ---------- chance as a fraction ----------
// rungs: 1 a bag of 2 to 6 marbles in two colours · 2 three colours, up to 8 · 3 spinners of up to 8 parts,
// a die · 4 "red or blue" · 5 "not red", dice events (even, more than 4) · 6 bags of up to 20, three or four
// colours
export const daChance: Skill = {
  id: 'da-chance', area: 'data', grade: 7, standard: '7.SP.C.7a',
  name: 'Chance as a fraction', short: 'Chance', plain: 'Writes the chance of something as a fraction: 3 red marbles out of 8 is a 3/8 chance; a die has 6 equal ways to land.',
  input: 'fraction', fastMs: 12000,
  subs: [{ id: 'bag', label: 'marbles in a bag' }, { id: 'spinner', label: 'spinners' }, { id: 'die', label: 'a die' }, { id: 'not', label: 'not that one' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const base = { skill: 'da-chance', key: `da-chance:${sub}`, weight: Math.min(5, 2 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0)), input: 'fraction' as const,
      trick: { name: 'Ways out of all', say: 'Chance = the ways it can happen over all the ways there are. Count the ones you want on top, all of them on the bottom.' } };
    if (sub === 'die') {
      const evs = perRung(r, [
        [['a 4', 1], ['a 6', 1], ['a 1', 1]], [['a 1 or a 2', 2], ['a 5 or a 6', 2], ['a 3', 1]], [['an even number', 3], ['an odd number', 3], ['a 1 or a 6', 2]],
        [['more than 4', 2], ['less than 3', 2], ['an even number', 3]], [['less than 5', 4], ['more than 2', 4], ['not a 6', 5]], [['not a 1', 5], ['a number bigger than 1', 5], ['less than 6', 5], ['more than 3', 3]],
      ] as [string, number][][]);
      const [w, n] = pick(rng, evs);
      return { ...base, id: `da-chance:die:${w}`, ask: `Roll the die. What is the chance of ${w}?`, prompt: [pic({ kind: 'dice', faces: [] }), tx(w), op('='), blank],
        answer: { kind: 'fraction', n, d: 6 }, explain: `A die has 6 faces, all as likely. ${n} of them ${n === 1 ? 'is' : 'are'} ${w}: ${n}/6.` };
    }
    if (sub === 'spinner') {
      const d = perRung(r, [pick(rng, [2, 3, 4]), 4, pick(rng, [5, 6, 8]), 8, pick(rng, [8, 10]), pick(rng, [10, 12])]);
      const cols = shuffle(rng, COLORS).slice(0, perRung(r, [2, 2, 3, 3, 3, 4]));
      // part i gets colour i for the first few (so every colour shows), the rest at random
      const parts = shuffle(rng, range(d).map(i => cols[i < cols.length ? i : int(rng, 0, cols.length - 1)]));
      const or = r >= 4 && cols.length >= 3 && rng() < 0.5;
      const want = or ? cols.slice(0, 2) : [pick(rng, cols)];
      const n = parts.filter(c => want.includes(c)).length;
      const name = want.join(' or ');
      return { ...base, id: `da-chance:spinner:${parts.join('.')}:${name}`, ask: `Spin it. What is the chance of ${name}?`, prompt: [pic({ kind: 'spinner', parts }), tx(name), op('='), blank],
        answer: { kind: 'fraction', n, d }, explain: `${d} equal parts, ${n} of them ${name}: ${n}/${d}.` };
    }
    // a bag
    const total = int(rng, ...perRung(r, [[2, 6], [4, 8], [5, 10], [6, 12], [6, 15], [10, 20]] as [number, number][]));
    const k = Math.min(total, perRung(r, [2, 3, 3, 3, 3, pick(rng, [3, 4])]));
    const cols = shuffle(rng, COLORS).slice(0, k);
    // every colour at least one, the rest shared out at random
    const ns = cols.map(() => 1);
    for (let i = k; i < total; i++) ns[int(rng, 0, k - 1)]++;
    const bag: DataPic = { kind: 'bag', marbles: cols.map((c, i) => ({ color: c, n: ns[i] })) };
    const sig = cols.map((c, i) => `${c}${ns[i]}`).join(',');
    if (sub === 'not') {
      const i = int(rng, 0, k - 1), n = total - ns[i];
      return { ...base, id: `da-chance:not:${sig}:${cols[i]}`, ask: `Pick one without looking. What is the chance it is NOT ${cols[i]}?`, prompt: [pic(bag), tx(`not ${cols[i]}`), op('='), blank],
        answer: { kind: 'fraction', n, d: total }, explain: `${total} marbles, ${ns[i]} ${cols[i]}, so ${n} are not: ${n}/${total}.`,
        trick: { name: 'Everything else', say: 'Count the ones that are NOT that colour (or take that colour away from all of them). That goes on top; all the marbles go on the bottom.' } };
    }
    const or = r >= 4 && k >= 3 && rng() < 0.5;
    const want = or ? [0, 1] : [int(rng, 0, k - 1)];
    const n = sum(want.map(i => ns[i])), name = want.map(i => cols[i]).join(' or ');
    return { ...base, id: `da-chance:bag:${sig}:${name}`, ask: `Pick one without looking. What is the chance it is ${name}?`, prompt: [pic(bag), tx(name), op('='), blank],
      answer: { kind: 'fraction', n, d: total }, explain: `${total} marbles in all, ${n} of them ${name}: ${n}/${total}.` };
  },
  check,
};

// ---------- what should happen, and what did ----------
// rungs: 1 a half, 10 to 20 tries · 2 a half or a quarter, up to 40 · 3 thirds, quarters and sixths (a die),
// up to 60 · 4 2/3, 3/4, 2/5 up to 100 · 5 3/8 and 5/6 too, up to 320 · 6 eighths, sixths and fifths up to 800
export const daExpect: Skill = {
  id: 'da-expect', area: 'data', grade: 7, standard: '7.SP.C.6',
  name: 'What should happen?', short: 'Predict', plain: 'Uses a chance to say about how many times something should happen (a 1/4 chance in 40 spins is about 10 times), and compares it with what really happened in an experiment.',
  input: 'number', fastMs: 14000,
  subs: [{ id: 'predict', label: 'how many should?' }, { id: 'found', label: 'what happened' }, { id: 'compare', label: 'more or fewer?' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const [n, d] = pick(rng, perRung(r, [[[1, 2]], [[1, 2], [1, 4]], [[1, 3], [1, 6], [1, 4]], [[2, 3], [3, 4], [2, 5]], [[3, 4], [2, 5], [3, 8], [5, 6]], [[3, 8], [5, 6], [5, 8], [4, 5]]] as [number, number][][]));
    // the tries: a whole number of lots of the bottom number, so what should happen is a whole number
    const N = d * int(rng, ...perRung(r, [[5, 10], [5, 10], [5, 10], [5, 20], [10, 40], [20, 100]] as [number, number][]));
    const want = (N / d) * n;
    // the thing that's spun: a spinner of d parts, n red (a die for sixths)
    const die = d === 6;
    const thing: Part = die ? pic({ kind: 'dice', faces: [] }) : pic({ kind: 'spinner', parts: range(d).map(i => (i < n ? 'red' : 'blue') as ColorId) });
    const what = die ? (n === 1 ? 'a 6' : `a number bigger than ${6 - n}`) : 'red';
    const verb = die ? 'Roll the die' : 'Spin it';
    const base = { skill: 'da-expect', key: `da-expect:${sub}`, weight: Math.min(5, 2 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0)) };
    if (sub === 'found') {
      // an experiment: N tries, the thing came up k times (near what should happen, never exactly 0 or all)
      const k = Math.max(1, Math.min(N - 1, want + int(rng, -Math.max(1, Math.floor(want / 4)), Math.max(1, Math.floor(want / 4)))));
      return { ...base, id: `da-expect:found:${N}:${k}:${n}/${d}`, ask: `We ${die ? 'rolled' : 'spun'} it ${N} times and got ${what} ${k} times. What fraction of the tries was ${what}?`,
        prompt: [thing, pic({ kind: 'results', rows: [{ name: cap(what), n: k, color: die ? undefined : 'red' }, { name: 'Other', n: N - k, color: die ? undefined : 'blue' }], total: true }), tx(what), op('='), blank],
        input: 'fraction', answer: { kind: 'fraction', n: k, d: N },
        explain: `${k} of the ${N} tries: ${k}/${N}${gcd(k, N) > 1 ? ` (that's ${k / gcd(k, N)}/${N / gcd(k, N)})` : ''}. The chance says ${n}/${d}: close, but a real experiment wobbles.`,
        trick: { name: 'What really happened', say: 'An experiment\'s fraction is the times it happened over all the tries. It\'s usually near the chance, not exactly on it.' } };
    }
    if (sub === 'compare') {
      const off = int(rng, 1, Math.max(2, Math.floor(want / 3))) * (rng() < 0.5 ? -1 : 1);
      const got = Math.max(0, Math.min(N, want + off)), diff = Math.abs(got - want), more = got > want;
      return { ...base, id: `da-expect:compare:${N}:${got}:${n}/${d}`, ask: `${verb} ${N} times. We got ${what} ${got} times. How many ${more ? 'more' : 'fewer'} than should happen?`,
        prompt: [thing, tx(`${N} tries: ${what} ${got} times`), op('→'), tx(more ? 'more' : 'fewer'), blank], input: 'number', answer: nA(diff),
        explain: `It should happen about ${n}/${d} of ${N} = ${want} times. We got ${got}: ${diff} ${more ? 'more' : 'fewer'}.`,
        trick: { name: 'Chance times tries', say: 'First work out what should happen: the chance times the number of tries. Then compare it with what really happened.' } };
    }
    return { ...base, id: `da-expect:predict:${N}:${n}/${d}`, ask: `${verb} ${N} times. About how many times should you get ${what}?`, prompt: [thing, tx(`${N} times:`), tx(what), op('≈'), blank], input: 'number', answer: nA(want),
      explain: `The chance of ${what} is ${n}/${d}. ${n}/${d} of ${N}: ${N} ÷ ${d} = ${N / d}${n > 1 ? `, × ${n} = ${want}` : ''}. About ${want} times.`,
      trick: { name: 'Chance times tries', say: 'Share the tries by the bottom number, then times by the top: 1/4 of 40 is 10.' } };
  },
  check,
};

// ---------- two things at once ----------
// rungs: 1 two by two, the tree drawn · 2 two by three, the tree drawn · 3 three by three or a coin and a die,
// no picture · 4 three things at once (2 × 2 × 2, 2 × 3 × 2) · 5 four by five, the chance of one way · 6 two
// dice: the chance of a total
const HATS = ['red hat', 'blue hat', 'green hat', 'purple hat'];
const TOPS = ['shirt', 'hoodie', 'vest', 'sweater', 'jacket'];
const SHOES = ['boots', 'sneakers', 'sandals'];
export const daBoth: Skill = {
  id: 'da-both', area: 'data', grade: 7, standard: '7.SP.C.8',
  name: 'Two things at once', short: 'Two at once', plain: 'Counts every way two (or three) things can happen together with a list, a table or a tree, and finds the chance of one of them: a coin and a die have 2 × 6 = 12 ways.',
  input: 'number', fastMs: 15000,
  subs: [{ id: 'count', label: 'how many ways?' }, { id: 'find', label: 'ways with...' }, { id: 'chance', label: 'the chance' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const base = { skill: 'da-both', key: `da-both:${sub}`, weight: Math.min(5, 2 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0)),
      trick: { name: 'Every with every', say: 'Each first choice goes with every second choice: draw a tree, or times them. 3 hats and 4 tops make 3 × 4 = 12 outfits.' } };
    if (r === 6 && sub !== 'count') {
      // two dice: 36 ways
      const [w, n] = pick(rng, [['a total of 7', 6], ['doubles', 6], ['a total of 11', 2], ['a total of 2', 1], ['a total of 10', 3], ['a total of 5', 4]] as [string, number][]);
      if (sub === 'find') return { ...base, id: `da-both:find:dice:${w}`, ask: `Roll two dice. How many of the 36 ways give ${w}?`, prompt: [pic({ kind: 'dice', faces: [3, 4] }), tx(w), op('='), blank], input: 'number', answer: nA(n),
        explain: `List them: ${w === 'doubles' ? '1 1, 2 2, 3 3, 4 4, 5 5, 6 6' : `the pairs that make ${w.slice(-2).trim()}`}. That's ${n} ways.`, trick: { name: 'Make a table', say: 'Make a 6 by 6 table: one die across, the other down. Find every square that works.' } };
      return { ...base, id: `da-both:chance:dice:${w}`, ask: `Roll two dice. What is the chance of ${w}?`, prompt: [pic({ kind: 'dice', faces: [2, 5] }), tx(w), op('='), blank], input: 'fraction', answer: { kind: 'fraction', n, d: 36 },
        explain: `6 × 6 = 36 ways, all as likely. ${n} of them give ${w}: ${n}/36.`, trick: { name: 'Ways out of all', say: 'Two dice have 6 × 6 = 36 ways. Count the ways that work and put them over 36.' } };
    }
    const [a, b, c] = perRung(r, [[2, 2, 0], [2, 3, 0], [pick(rng, [3, 2]), pick(rng, [3, 6]), 0], [2, pick(rng, [2, 3]), 2], [4, 5, 0], [3, 4, pick(rng, [0, 2])]] as [number, number, number][]);
    const coin = r === 3 && b === 6;
    const L1 = coin ? ['heads', 'tails'] : HATS.slice(0, a), L2 = coin ? ['1', '2', '3', '4', '5', '6'] : TOPS.slice(0, b), L3 = SHOES.slice(0, c);
    const ways = L1.length * L2.length * Math.max(1, L3.length);
    const levels = [L1, L2, ...(c ? [L3] : [])];
    const drawn = r <= 2 || (r === 4 && sub === 'count' && rng() < 0.4);
    const say = coin ? 'Flip a coin and roll a die.' : `Pick a hat (${L1.join(', ')}) and a top (${L2.join(', ')})${c ? ` and shoes (${L3.join(', ')})` : ''}.`;
    const pr: Part[] = drawn ? [pic({ kind: 'tree', levels })] : [tx(coin ? 'coin × die' : `${L1.length} hats × ${L2.length} tops${c ? ` × ${L3.length} shoes` : ''}`)];
    const sig = `${L1.length}x${L2.length}x${L3.length}${coin ? 'c' : ''}${drawn ? 't' : ''}`;
    const times = levels.map(l => l.length).join(' × ');
    if (sub === 'count') return { ...base, id: `da-both:count:${sig}`, ask: `${say} How many different ${coin ? 'ways can they land' : 'outfits'}?`, prompt: [...pr, op('='), blank], input: 'number', answer: nA(ways),
      explain: `Each ${coin ? 'side of the coin' : 'hat'} goes with every ${coin ? 'number' : 'top'}${c ? ', and each of those with every pair of shoes' : ''}: ${times} = ${ways}.` };
    // with one particular first choice (or second)
    const first = int(rng, 0, L1.length - 1);
    const withIt = ways / L1.length;
    if (sub === 'find') return { ...base, id: `da-both:find:${sig}:${first}`, ask: `${say} How many ${coin ? 'ways' : 'outfits'} have the ${L1[first]}${coin ? ' side up' : ''}?`, prompt: [...pr, tx(L1[first]), op('='), blank], input: 'number', answer: nA(withIt),
      explain: `The ${L1[first]} goes with every ${coin ? 'number' : 'top'}${c ? ' and every pair of shoes' : ''}: ${levels.slice(1).map(l => l.length).join(' × ')} = ${withIt}.`,
      trick: { name: 'Follow one branch', say: 'Find that first choice on the tree and count every path that comes out of it.' } };
    // the chance of one exact way (or of a first choice, from rung 5)
    const one = r < 5 || rng() < 0.5;
    const second = int(rng, 0, L2.length - 1);
    const name = coin ? `${L1[first]} and a ${L2[second]}` : c ? `the ${L1[first]}` : `the ${L1[first]} with the ${L2[second]}`;
    const n = one && !c ? 1 : withIt;
    const { answer, input } = fracOrWhole(n, ways);
    return { ...base, id: `da-both:chance:${sig}:${first}:${one && !c ? second : '*'}`, ask: `${say} Every ${coin ? 'way' : 'outfit'} is as likely. What is the chance of ${name}?`, prompt: [...pr, tx(name), op('='), blank],
      input, answer, explain: `${times} = ${ways} ways in all, and ${n} of them ${n === 1 ? 'is' : 'are'} ${name}: ${n}/${ways}.`,
      trick: { name: 'Ways out of all', say: 'Count all the ways (times them), then count the ways that match. Matching ways over all the ways.' } };
  },
  check,
};

export const DATA_SKILLS: Skill[] = [daSort, daPicGraph, daLikely, daBars, daLinePlot, daMean, daMiddle, daPlots, daChance, daExpect, daBoth];
