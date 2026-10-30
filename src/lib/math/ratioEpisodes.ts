// The ratios and percents Learn episodes, at the Jungle Juice Bar with Mushroom Mouse: each idea as a short
// story with real fruit on the table to move about. Batches of the same smoothie mix (ratio words, ratio
// tables), the double number line as hops along a plank (cups on the line, oranges on the hops), sharing
// fruit into cups for the price of one, a tray of 100 blueberries for percent, sharing into four for 25%,
// and gold coins for a sale. They play in the shared episode (math/ui/Episode.svelte) like the fractions
// ones: the pictures are boards whose counters are fruit (three/fruitShapes.ts), so the kid's hands drag,
// tap and hop them the same way.
import type { Board, Dot, Hue, Tag } from './learn';
import type { FracLesson, EpQ } from './fracEpisodes';
import type { FruitKind } from '../three/fruitShapes';

const board = (b: Partial<Board>): Board => ({ cell: 48, dots: [], frames: [], plates: [], line: null, tags: [], ...b });
const tag = (id: string, x: number, y: number, text: string, c: Tag['c'] = 'ink', size = 26): Tag => ({ id, x, y, text, c, size });
const plate = (id: string, x: number, y: number, r: number, empty = false) => ({ id, x, y, r, empty });
const Q = (text: string, ans: string, hint: string, hidden: string, pic: Board): EpQ => ({ text, ans, input: 'num', hint, hidden, pic });
type Place = { x: number; y: number };

/** fruit on a plate (or anywhere) in rows of `per`, `cell` apart, their middle at `at` */
function heap(prefix: string, kinds: FruitKind[], at: Place, cell: number, per = 3, hue: (i: number) => Hue = () => 'a'): Dot[] {
  const rows = Math.ceil(kinds.length / per);
  return kinds.map((f, i) => {
    const r = Math.floor(i / per), c = i % per, inRow = Math.min(per, kinds.length - r * per);
    return { id: `${prefix}${i}`, x: at.x + (c - (inRow - 1) / 2) * cell, y: at.y + (r - (rows - 1) / 2) * cell * 0.9, c: hue(i), d: i * 0.04, shape: { k: 'fruit', f } };
  });
}
const many = (f: FruitKind, n: number) => Array.from({ length: n }, () => f);
/** one batch of a smoothie mix on plate i of a row */
function batch(i: number, at: Place, mix: [FruitKind, number][], cell: number, hue: Hue = 'a'): Dot[] {
  return heap(`p${i}-`, mix.flatMap(([f, n]) => many(f, n)), at, cell, 3, () => hue);
}
/** k plates of the same mix in a row (for questions) */
function batches(k: number, mix: [FruitKind, number][], tags: Tag[] = []): Board {
  const xs = Array.from({ length: k }, (_, i) => 300 + (i - (k - 1) / 2) * (k <= 2 ? 220 : 175));
  const pr = k <= 2 ? 92 : 80;
  return board({ cell: 44, plates: xs.map((x, i) => plate(`q${i}`, x, 170, pr)), dots: xs.flatMap((x, i) => batch(i, { x, y: 170 }, mix, 42)), tags });
}
/** n of a fruit shared onto k plates (`gold`: those plates' fruit glow) */
function shared(f: FruitKind, n: number, k: number, gold: number[] = [], prefix = 'm'): Board {
  const xs = Array.from({ length: k }, (_, i) => 300 + (i - (k - 1) / 2) * Math.min(150, 560 / k));
  const pr = Math.min(70, 280 / k);
  const per = n / k;
  return board({ cell: per > 4 ? 34 : 40, plates: xs.map((x, i) => plate(`pl${i}`, x, 190, pr)), dots: xs.flatMap((x, i) => heap(`${prefix}${i}-`, many(f, per), { x, y: 190 }, per > 4 ? 30 : 36, per > 4 ? 3 : 2, () => (gold.includes(i) ? 'c' : 'a'))) });
}
/** n of a fruit waiting in rows at the top, each with the id it has once shared onto k plates (`shared`) */
function pile(f: FruitKind, n: number, k: number, prefix = 'm'): Dot[] {
  const per = Math.min(10, n), rows = Math.ceil(n / per);
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i % k}-${Math.floor(i / k)}`, x: 300 + ((i % per) - (per - 1) / 2) * 38, y: 62 + (Math.floor(i / per) - (rows - 1) / 2) * 36, c: 'a' as Hue, d: i * 0.03, shape: { k: 'fruit' as const, f } }));
}
/** a 10 by 10 tray of blueberries, the first `gold` of them gold */
function hundred(gold: number, tags: Tag[] = []): Board {
  return board({ cell: 26, dots: Array.from({ length: 100 }, (_, i) => ({ id: `h${i}`, x: 183 + (i % 10) * 26, y: 52 + Math.floor(i / 10) * 26, c: (i < gold ? 'c' : 'a') as Hue, d: (i % 10) * 0.01, shape: { k: 'fruit', f: 'berry' } as Dot['shape'] })), tags });
}
/** gold coins for a price, in rows of 5: the `off` last ones pink (the part taken off), `gone` of them taken away */
function coins(n: number, off = 0, gone = false, tags: Tag[] = []): Board {
  const rows = Math.ceil(n / 5), cell = 50;
  const dots: Dot[] = [];
  for (let i = 0; i < n; i++) {
    const isOff = i >= n - off;
    if (isOff && gone) continue;
    dots.push({ id: `c${i}`, x: 300 + ((i % 5) - 2) * cell, y: 175 + (Math.floor(i / 5) - (rows - 1) / 2) * cell * 0.92, c: isOff ? 'b' : 'a', d: i * 0.03, shape: { k: 'fruit', f: 'coin' } });
  }
  return board({ cell: 46, dots, tags });
}
/** a plank of cups with hops of oranges: `labels` on the hops (empty ones to count) */
function plank(to: number, at: number, labels: string[], tags: Tag[] = []): Board {
  return board({ line: { from: 0, to, at, hops: labels.map((label, i) => ({ a: i, b: i + 1, label })) }, tags });
}

// ---------- the lessons ----------
const P3 = [{ x: 120, y: 165 }, { x: 300, y: 165 }, { x: 480, y: 165 }];
const MIX: [FruitKind, number][] = [['straw', 2], ['banana', 3]];
const S4 = [75, 165, 255, 345, 435, 525];

export const RATIO_LESSONS: FracLesson[] = [
  {
    id: 'rt-for-every', title: 'For Every', blurb: 'For every 2 strawberries, 3 bananas: the ratio 2 : 3. More batches, same mix.', set: 'juice', skill: 'rt-ratio', art: 'learn/ratio/card-fruit.webp',
    steps: [
      { say: '', board: board({ cell: 44, plates: [plate('a', P3[0].x, P3[0].y, 84)], dots: batch(0, P3[0], MIX, 42) }), eq: '2 strawberries : 3 bananas' },
      { say: '', board: board({ cell: 44, plates: [plate('a', P3[0].x, P3[0].y, 84), plate('b', P3[1].x, P3[1].y, 84)], dots: [...batch(0, P3[0], MIX, 42), ...batch(1, P3[1], MIX, 42)] }), eq: '2 batches: [4 : 6]' },
      { say: '', board: board({ cell: 44, plates: P3.map((p, i) => plate('abc'[i], p.x, p.y, 84)), dots: P3.flatMap((p, i) => batch(i, p, MIX, 42)) }), eq: '3 batches: [6 : 9]' },
      { say: '', board: board({ cell: 44, plates: P3.map((p, i) => plate('abc'[i], p.x, p.y, 84)), dots: P3.flatMap((p, i) => batch(i, p, MIX, 42)),
        tags: [tag('t0', P3[0].x, 282, '2 : 3', 'c'), tag('t1', P3[1].x, 282, '4 : 6', 'c'), tag('t2', P3[2].x, 282, '6 : 9', 'c')] }), eq: '2 : 3 = 4 : 6 = [6 : 9]' },
    ],
    tries: [
      Q('How many oranges in all?', '8', 'Every batch has 4 oranges. 2 batches: 4, 8. So 8 oranges.', 'Count the oranges in one batch, then count by that for each batch.', batches(2, [['kiwi', 1], ['orange', 4]], [tag('r', 300, 300, '1 kiwi : 4 oranges', 'c')])),
      Q('How many mangoes in all?', '9', 'Every batch has 3 mangoes. 3 batches: 3, 6, 9.', 'How many mangoes in one batch? Count by that number.', batches(3, [['mango', 3], ['straw', 2]], [tag('r', 300, 300, '3 mangoes : 2 strawberries', 'c')])),
      Q('How many blueberries in all?', '10', 'Every batch has 5 blueberries. 2 batches: 5, 10.', 'How many blueberries in one batch?', batches(2, [['banana', 2], ['berry', 5]], [tag('r', 300, 300, '2 bananas : 5 blueberries', 'c')])),
    ],
    teach: { q: Q('How many bananas in all?', '9', 'Every batch has 3 bananas. 3 batches: 3, 6, 9.', '', batches(3, MIX, [tag('r', 300, 300, '2 strawberries : 3 bananas', 'c')])), wrong: '5', says: '2 strawberries and 3 bananas... 2 + 3 is 5!', decoy: '6', fixed: 'Each batch has 3 bananas, and there are 3 batches: 3, 6, 9. Count the bananas in every batch!' },
  },
  {
    id: 'rt-batches', title: 'Bigger Batches', blurb: 'A ratio table: times both numbers by the same number. 1 : 2 is 10 : 20.', set: 'juice', skill: 'rt-table', art: 'learn/ratio/card-fruit.webp',
    steps: [
      { say: '', board: board({ cell: 40, plates: [plate('a', 100, 140, 70)], dots: batch(0, { x: 100, y: 140 }, [['mango', 1], ['straw', 2]], 38), tags: [tag('t0', 100, 260, '1 : 2', 'c')] }), eq: '1 mango : 2 strawberries' },
      { say: '', board: board({ cell: 40, plates: [plate('a', 100, 140, 70), plate('b', 245, 140, 70)], dots: [...batch(0, { x: 100, y: 140 }, [['mango', 1], ['straw', 2]], 38), ...batch(1, { x: 245, y: 140 }, [['mango', 2], ['straw', 4]], 38)],
        tags: [tag('t0', 100, 260, '1 : 2', 'c'), tag('t1', 245, 260, '2 : 4', 'c')] }), eq: '2 batches: [2 : 4]' },
      { say: '', board: board({ cell: 40, plates: [plate('a', 100, 140, 70), plate('b', 245, 140, 70), plate('c', 390, 140, 70)], dots: [...batch(0, { x: 100, y: 140 }, [['mango', 1], ['straw', 2]], 38), ...batch(1, { x: 245, y: 140 }, [['mango', 2], ['straw', 4]], 38), ...batch(2, { x: 390, y: 140 }, [['mango', 3], ['straw', 6]], 38)],
        tags: [tag('t0', 100, 260, '1 : 2', 'c'), tag('t1', 245, 260, '2 : 4', 'c'), tag('t2', 390, 260, '3 : 6', 'c')] }), eq: '3 batches: [3 : 6]' },
      { say: '', board: board({ cell: 40, plates: [plate('a', 100, 140, 70), plate('b', 245, 140, 70), plate('c', 390, 140, 70)], dots: [...batch(0, { x: 100, y: 140 }, [['mango', 1], ['straw', 2]], 38), ...batch(1, { x: 245, y: 140 }, [['mango', 2], ['straw', 4]], 38), ...batch(2, { x: 390, y: 140 }, [['mango', 3], ['straw', 6]], 38)],
        tags: [tag('t0', 100, 260, '1 : 2', 'c'), tag('t1', 245, 260, '2 : 4', 'c'), tag('t2', 390, 260, '3 : 6', 'c'), tag('x', 520, 140, '× 10', 'b', 30), tag('t3', 520, 260, '10 : 20', 'c', 30)] }), eq: '1 : 2 = 10 : [20]' },
    ],
    tries: [
      Q('5 batches: how many strawberries?', '10', 'Times both by 5: 1 × 5 = 5 mangoes, 2 × 5 = 10 strawberries.', 'One batch has 2 strawberries. Times it by the batches.', batches(1, [['mango', 1], ['straw', 2]], [tag('a', 300, 290, '1 : 2  →  5 : ?', 'c')])),
      Q('4 batches: how many oranges?', '12', 'Times both by 4: 3 × 4 = 12 oranges.', 'One batch has 3 oranges. Times it by 4.', batches(1, [['kiwi', 1], ['orange', 3]], [tag('a', 300, 290, '1 : 3  →  4 : ?', 'c')])),
      Q('10 batches: how many blueberries?', '30', 'Times both by 10: 3 × 10 = 30 blueberries.', 'One batch has 3 blueberries. Times it by 10.', batches(1, [['banana', 2], ['berry', 3]], [tag('a', 300, 290, '2 : 3  →  20 : ?', 'c')])),
    ],
    teach: { q: Q('4 mangoes: how many strawberries?', '6', '4 mangoes is 2 batches. Times both by 2: 3 × 2 = 6.', '', batches(2, [['mango', 2], ['straw', 3]], [tag('a', 300, 300, '2 : 3  →  4 : ?', 'c')])), wrong: '5', says: '2 mangoes became 4, that\'s 2 more. So 3 + 2 = 5!', decoy: '8', fixed: '4 mangoes is 2 batches! Times BOTH numbers by 2: 3 × 2 = 6 strawberries. Same mix, bigger batch.' },
  },
  {
    id: 'rt-two-lines', title: 'Two Lines', blurb: 'A double number line: cups along the plank, oranges on the hops, step for step.', set: 'juice', skill: 'rt-dnl', art: 'learn/ratio/card-line.webp',
    steps: [
      { say: '', board: plank(4, 0, [], [tag('h', 300, 96, '1 cup of juice = 3 oranges', 'c')]), eq: 'cups on the plank' },
      { say: '', board: plank(4, 1, ['3'], [tag('h', 300, 96, '1 cup of juice = 3 oranges', 'c')]), eq: '[1] cup : [3] oranges' },
      { say: '', board: plank(4, 3, ['3', '6', '9'], [tag('h', 300, 96, '1 cup of juice = 3 oranges', 'c')]), eq: '3 cups : [9] oranges' },
      { say: '', board: plank(4, 4, ['3', '6', '9', '12'], [tag('h', 300, 96, '1 cup of juice = 3 oranges', 'c')]), eq: '4 cups : [12] oranges' },
    ],
    tries: [
      Q('How many bananas for 4 cups?', '8', 'Every hop is 2 more bananas: 2, 4, 6, 8.', 'Count the hops to 4 cups, 2 bananas for each.', plank(5, 4, ['2', '', '', ''], [tag('h', 300, 96, '1 cup = 2 bananas', 'c')])),
      Q('How many strawberries for 3 cups?', '15', 'Every hop is 5 more: 5, 10, 15.', 'Count by 5s, one for each hop.', plank(4, 3, ['5', '', ''], [tag('h', 300, 96, '1 cup = 5 strawberries', 'c')])),
      Q('How many kiwis for 5 cups?', '20', 'Every hop is 4 more: 4, 8, 12, 16, 20.', 'Count by 4s, one for each hop.', plank(6, 5, ['4', '', '', '', ''], [tag('h', 300, 96, '1 cup = 4 kiwis', 'c')])),
    ],
    teach: { q: Q('How many oranges for 4 cups?', '12', 'Every hop is 3 more: 3, 6, 9, 12.', '', plank(4, 4, ['3', '', '', ''], [tag('h', 300, 96, '1 cup = 3 oranges', 'c')])), wrong: '7', says: '4 cups, and 3 oranges... 4 + 3 is 7!', decoy: '9', fixed: 'Every hop is one more cup AND three more oranges: 3, 6, 9, 12. Count the hops in threes!' },
  },
  {
    id: 'rt-one-each', title: 'One for One', blurb: 'The price of one: share it out, then times it up for more.', set: 'juice', skill: 'rt-rate', art: 'learn/ratio/card-share.webp',
    steps: [
      { say: '', board: board({ cell: 36, plates: S4.slice(0, 4).map((x, i) => plate(`pl${i}`, x, 230, 42)), dots: heap('b', many('berry', 12), { x: 300, y: 70 }, 34, 6) }), eq: '12 blueberries for 4 smoothies' },
      { say: '', board: board({ cell: 36, plates: S4.slice(0, 4).map((x, i) => plate(`pl${i}`, x, 230, 42)), dots: Array.from({ length: 12 }, (_, k) => { const p = k % 4, j = Math.floor(k / 4); return { id: `b${k}`, x: S4[p] + (j - 1) * 24, y: 230 + (j === 1 ? -14 : 8), c: 'a' as Hue, d: k * 0.05, shape: { k: 'fruit' as const, f: 'berry' as const } }; }) }), eq: '12 ÷ 4 = [3] each' },
      { say: '', board: board({ cell: 36, plates: S4.slice(0, 4).map((x, i) => plate(`pl${i}`, x, 230, 42)), dots: Array.from({ length: 12 }, (_, k) => { const p = k % 4, j = Math.floor(k / 4); return { id: `b${k}`, x: S4[p] + (j - 1) * 24, y: 230 + (j === 1 ? -14 : 8), c: (p === 0 ? 'c' : 'a') as Hue, d: 0, shape: { k: 'fruit' as const, f: 'berry' as const } }; }) }), eq: 'One smoothie: [3] blueberries' },
      { say: '', board: board({ cell: 36, plates: S4.map((x, i) => plate(`pl${i}`, x, 230, 42)), dots: Array.from({ length: 18 }, (_, k) => { const p = k < 12 ? k % 4 : 4 + ((k - 12) % 2), j = k < 12 ? Math.floor(k / 4) : Math.floor((k - 12) / 2); return { id: `b${k}`, x: S4[p] + (j - 1) * 24, y: 230 + (j === 1 ? -14 : 8), c: (p === 0 ? 'c' : 'a') as Hue, d: 0, shape: { k: 'fruit' as const, f: 'berry' as const } }; }) }), eq: '6 smoothies: 6 × 3 = [18]' },
    ],
    tries: [
      Q('How many in one smoothie?', '2', 'Share 8 onto 4 cups: 2 in each. 8 ÷ 4 = 2.', 'Share them out evenly. How many on one plate?', shared('straw', 8, 4)),
      Q('How many in one smoothie?', '5', 'Share 15 onto 3 cups: 5 in each. 15 ÷ 3 = 5.', 'Share them out evenly. How many on one plate?', shared('kiwi', 15, 3)),
      Q('How many in one smoothie?', '2', 'Share 12 onto 6 cups: 2 in each. 12 ÷ 6 = 2.', 'Share them out evenly. How many on one plate?', shared('orange', 12, 6)),
    ],
    teach: { q: Q('How many in ONE smoothie?', '2', 'Share 10 onto 5 cups: 2 in each.', '', shared('banana', 10, 5)), wrong: '5', says: 'There are 5 smoothies... so 5 bananas in each!', decoy: '10', fixed: 'Share the 10 bananas onto the 5 cups: 2 in each. 10 ÷ 5 = 2. That\'s the amount for ONE!' },
  },
  {
    id: 'rt-out-of-100', title: 'Out of 100', blurb: 'Percent means "out of 100": 35 of 100 blueberries is 35%.', set: 'juice', skill: 'rt-pct', art: 'learn/ratio/card-percent.webp',
    steps: [
      { say: '', board: hundred(0), eq: '100 blueberries' },
      { say: '', board: hundred(30), eq: '30 out of 100 = [30%]' },
      { say: '', board: hundred(35), eq: '35 out of 100 = [35%]' },
      { say: '', board: hundred(35, [tag('g', 90, 90, '35% gold', 'c'), tag('b', 510, 250, '65% blue', 'a')]), eq: '35% + 65% = [100%]' },
    ],
    tries: [
      Q('What percent is gold?', '40', '4 full rows of 10 are gold: 40 out of 100, 40%.', 'Count the gold ones. Out of 100, that number is the percent.', hundred(40)),
      Q('What percent is gold?', '25', '2 rows and 5 more: 25 out of 100, 25%.', 'Count the gold rows by tens, then the extra ones.', hundred(25)),
      Q('What percent is gold?', '72', '7 rows and 2 more: 72 out of 100, 72%.', 'Count the gold rows by tens, then the extra ones.', hundred(72)),
    ],
    teach: { q: Q('What percent is gold?', '50', '5 rows of 10 are gold: 50 out of 100, 50%.', '', hundred(50)), wrong: '5', says: 'I can see 5 gold rows... so 5%!', decoy: '15', fixed: 'Each row is 10 blueberries! 5 rows is 50 out of the 100: 50%. Count every one, not just the rows!' },
  },
  {
    id: 'rt-percent-of', title: 'Percent Of', blurb: '25% is a quarter: share into 4. 50% is half, 10% is a tenth.', set: 'juice', skill: 'rt-pctof', art: 'learn/ratio/card-percent.webp',
    steps: [
      { say: '', board: board({ cell: 34, plates: shared('mango', 20, 4).plates, dots: pile('mango', 20, 4) }), eq: '25% of 20 mangoes?' },
      { say: '', board: shared('mango', 20, 4), eq: '4 equal parts: each is [25%]' },
      { say: '', board: shared('mango', 20, 4, [0]), eq: '25% of 20 = [5]' },
      { say: '', board: shared('mango', 20, 4, [0, 1, 2]), eq: '75% of 20 = [15]' },
    ],
    tries: [
      Q('50% of 12 = ?', '6', '50% is half: share 12 onto 2 plates, 6 on each.', 'Half of it: share it onto 2 plates.', shared('orange', 12, 2, [0], 'q')),
      Q('25% of 16 = ?', '4', '25% is a quarter: share 16 onto 4 plates, 4 on each.', 'A quarter: share it onto 4 plates.', shared('straw', 16, 4, [0], 'q')),
      Q('25% of 12 = ?', '3', '25% is a quarter: share 12 onto 4 plates, 3 on each.', 'A quarter: share it onto 4 plates.', shared('kiwi', 12, 4, [0], 'q')),
    ],
    teach: { q: Q('25% of 8 = ?', '2', '25% is a quarter: share 8 onto 4 plates, 2 on each.', '', shared('mango', 8, 4, [0], 'q')), wrong: '25', says: 'It says 25 percent... so the answer is 25!', decoy: '4', fixed: '25 percent is one quarter! Share 8 onto 4 plates: 2 on each. So 25% of 8 is 2.' },
  },
  {
    id: 'rt-percent-off', title: 'Percent Off', blurb: '25% off $20: find 25% of the price ($5), then take it off. You pay $15.', set: 'juice', skill: 'rt-shop', art: 'learn/ratio/card-sale.webp',
    steps: [
      { say: '', board: coins(20, 0, false, [tag('p', 300, 40, 'a $20 blender', 'c')]), eq: '$20, 25% off' },
      { say: '', board: coins(20, 5, false, [tag('p', 300, 40, 'a $20 blender', 'c')]), eq: '25% of $20 = [$5]' },
      { say: '', board: coins(20, 5, true, [tag('p', 300, 40, 'a $20 blender', 'c')]), eq: '$20 − $5 = [$15]' },
      { say: '', board: coins(20, 5, true, [tag('p', 300, 40, 'a $20 blender', 'c'), tag('y', 300, 305, 'You pay $15', 'c', 30)]), eq: 'You pay [$15]' },
    ],
    tries: [
      Q('$10, 50% off. You pay $...', '5', '50% of $10 is $5 off. $10 − $5 = $5.', 'Find 50% of the price first, then take it off.', coins(10, 5)),
      Q('$20, 10% off. You pay $...', '18', '10% of $20 is $2 off. $20 − $2 = $18.', 'Find 10% of the price first, then take it off.', coins(20, 2)),
      Q('$12, 25% off. You pay $...', '9', '25% of $12 is $3 off. $12 − $3 = $9.', 'Find 25% of the price first, then take it off.', coins(12, 3)),
    ],
    teach: { q: Q('$20, 50% off. You pay $...', '10', '50% of $20 is $10 off. $20 − $10 = $10.', '', coins(20, 10)), wrong: '15', says: '50% off... take away 5 dollars: $15!', decoy: '30', fixed: '50 percent is HALF! Half of $20 is $10 off, so you pay $10.' },
  },
];
export const RATIO_LESSON: Record<string, FracLesson> = Object.fromEntries(RATIO_LESSONS.map(l => [l.id, l]));
export const isRatioLesson = (id: string) => !!RATIO_LESSON[id];
/** what the counters are called in the prompts */
export const RATIO_NOUN: Record<string, string> = { 'rt-for-every': 'fruit', 'rt-batches': 'fruit', 'rt-two-lines': 'hops', 'rt-one-each': 'blueberries', 'rt-out-of-100': 'blueberries', 'rt-percent-of': 'mangoes', 'rt-percent-off': 'coins' };
export const RATIO_COLOR = '#f07a3a';
