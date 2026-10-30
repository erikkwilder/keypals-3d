// The Data and chance Learn episodes, at the fair booth (set 'fair': Popcorn Puffling's game stall at the
// Chance Fair). Each idea is a short story with real things on the counter, in the same episode as the
// fractions (math/ui/Episode.svelte): the kid's hands sort a jumble of prize blocks into rows, build a bar
// graph block by block, stack dots over a ribbon plank, move blocks from a tall tower to a short one until
// the towers are level (the mean), line towers up to find the middle one (the median), pick from a bowl
// of blocks with their eyes closed (chance as a fraction) and dress two hats in every top (two things at
// once). Then the trick on top, the buddy's mistake to fix, two to try, and the trick's card. The coach's
// lines are in content/voice.ts (ep.<id>.intro, .s0..., .card).
import type { Board, Dot, Hue, Step, Tag } from '../learn';
import type { EpQ, FracLesson } from '../fracEpisodes';

const board = (b: Partial<Board>): Board => ({ cell: 44, dots: [], frames: [], plates: [], line: null, tags: [], ...b });
const tag = (id: string, x: number, y: number, text: string, c: Tag['c'] = 'ink', size = 26): Tag => ({ id, x, y, text, c, size });
const Q = (text: string, ans: string, input: EpQ['input'], hint: string, hidden: string, pic: Board, equiv = false): EpQ => ({ text, ans, input, hint, hidden, pic, equiv });
const B = 44;
/** where towers and bars stand on the counter */
const BASE = 256;
/** a column of n blocks standing on the counter at (x, y), block k stacked k up, each hue(k) */
const column = (prefix: string, x: number, n: number, hue: (k: number) => Hue, y = BASE, from = 0): Dot[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${from + i}`, x, y, up: from + i, c: hue(from + i), d: i * 0.05 }));

// ---------- sort and count ----------
/** a jumble of blocks: `n` of each hue, scattered over the counter (the same places every time) */
function jumble(ns: [number, number, number], prefix = 'j'): Dot[] {
  const hues: Hue[] = ['a', 'b', 'c'];
  const all = hues.flatMap((h, i) => Array.from({ length: ns[i] }, (_, k) => ({ h, id: `${prefix}${h}${k}` })));
  // a loose grid, shuffled by a fixed pattern so the colours are mixed
  const cols = 6, order = all.map((_, i) => (i * 7 + 3) % all.length);
  return order.map((src, i) => {
    const it = all[src], r = Math.floor(i / cols), c = i % cols;
    return { id: it.id, x: 110 + c * 76 + ((r * 31 + c * 17) % 24) - 12, y: 80 + r * 74 + ((c * 23 + r * 11) % 20) - 10, c: it.h, d: i * 0.03 };
  });
}
const ROWY: Record<Hue, number> = { a: 90, b: 170, c: 250, ghost: 0 };
/** the jumble with the hues in `done` sorted into their rows */
function sorted(ns: [number, number, number], done: Hue[]): Dot[] {
  const hues: Hue[] = ['a', 'b', 'c'];
  const j = jumble(ns);
  return j.map(d => {
    if (!done.includes(d.c)) return d;
    const k = Number(d.id.slice(2));
    return { ...d, x: 170 + k * 64, y: ROWY[d.c] };
  }).concat([]).filter(d => hues.includes(d.c));
}
const SORT_N: [number, number, number] = [5, 3, 4];
const rowTags = (done: Hue[]): Tag[] => (['a', 'b', 'c'] as Hue[]).filter(h => done.includes(h)).map(h => tag(`row-${h}`, 90, ROWY[h], h === 'a' ? 'Blue' : h === 'b' ? 'Pink' : 'Gold', h, 24));

// ---------- bar graphs ----------
const BX = { a: 230, b: 370 };
function bars(blue: number, pink: number, extra: { gold?: number; axis?: boolean; title?: boolean } = {}): Board {
  // (axis: the count of each bar, in front of it)
  const counts = extra.axis ? [tag('nb', BX.a, BASE + 44, String(blue), 'a', 30), tag('np', BX.b, BASE + 44, String(pink), 'b', 30)] : [];
  return board({
    dots: [...column('bb', BX.a, blue, k => (extra.gold !== undefined && k >= extra.gold ? 'c' : 'a')), ...column('bp', BX.b, pink, () => 'b')],
    tags: [tag('lb', BX.a, BASE + 76, 'Blue', 'a', 24), tag('lp', BX.b, BASE + 76, 'Pink', 'b', 24), ...(extra.title ? [tag('t', 300, BASE - 190, 'Balloon votes', 'ink', 24)] : []), ...counts],
  });
}

// ---------- line plots: a ribbon plank from 0 to 1 inch, in quarters ----------
const LX0 = 44, LX1 = 556, LY = 236;
const tickX = (n: number, to = 4) => LX0 + (n / to) * (LX1 - LX0);
/** dots stacked over the plank: counts[n] over n quarters */
function plot(counts: number[], gold: string[] = []): Board {
  // the dots stand in a stack just behind their number on the plank
  const dots = counts.flatMap((c, n) => Array.from({ length: c }, (_, k) => ({ id: `d${n}-${k}`, x: tickX(n), y: LY - 40, up: k, c: (gold.includes(`d${n}-${k}`) ? 'c' : n % 2 ? 'b' : 'a') as Hue, d: k * 0.08 })));
  return board({ cell: 38, line: { from: 0, to: 4, at: 0, hops: [], den: 4 }, dots });
}

// ---------- towers (the mean and the median) ----------
/** towers of blocks side by side at xs, each a hue; ids by tower */
function towers(hs: number[], hue: (t: number, k: number) => Hue, xs?: number[], ids?: string[]): Dot[] {
  const n = hs.length, X = xs ?? hs.map((_, i) => 300 + (i - (n - 1) / 2) * (n > 3 ? 100 : 120));
  return hs.flatMap((h, t) => Array.from({ length: h }, (_, k) => ({ id: `${ids?.[t] ?? `t${t}`}-${k}`, x: X[t], y: BASE, up: k, c: hue(t, k), d: (t * 4 + k) * 0.03 })));
}
/** each tower's height, on the counter in front of it */
const towerTags = (hs: number[], xs?: number[]) => { const n = hs.length, X = xs ?? hs.map((_, i) => 300 + (i - (n - 1) / 2) * (n > 3 ? 100 : 120)); return hs.map((h, t) => tag(`h${t}`, X[t], BASE + 46, String(h), 'ink', 30)); };

// ---------- a bowl of blocks (chance) ----------
const BOWL = { x: 300, y: 178, r: 132 };
function bowl(ns: [number, number, number], prefix = 'm'): Board {
  const hues: Hue[] = ['a', 'b', 'c'];
  const all = hues.flatMap((h, i) => Array.from({ length: ns[i] }, () => h));
  // mixed up the same way every time, in a little round heap
  const mixed = all.map((h, i) => ({ h, k: (i * 5 + 2) % all.length })).sort((a, b) => a.k - b.k).map(x => x.h);
  const n = mixed.length;
  const dots: Dot[] = mixed.map((h, i) => {
    const ring = i === 0 ? 0 : i < 7 ? 1 : 2, inRing = ring === 1 ? Math.min(6, n - 1) : n - 7, j = ring === 1 ? i - 1 : i - 7, a = (j / Math.max(1, inRing)) * Math.PI * 2;
    const rr = ring * 46;
    return { id: `${prefix}${i}`, x: BOWL.x + Math.cos(a) * rr, y: BOWL.y + Math.sin(a) * rr * 0.9, c: h, d: i * 0.04 };
  });
  return board({ plates: [{ id: 'bowl', x: BOWL.x, y: BOWL.y, r: BOWL.r }], dots });
}

// ---------- two at once: hats on plates, every top with every hat ----------
function hats(nHats: number, tops: number, filled = nHats): Board {
  const xs = Array.from({ length: nHats }, (_, i) => 300 + (i - (nHats - 1) / 2) * (nHats > 2 ? 180 : 230));
  const hue: Hue[] = ['a', 'b', 'c', 'a'];
  const r = nHats > 2 ? 82 : 100;
  return board({
    plates: xs.map((x, i) => ({ id: `h${i}`, x, y: 196, r, empty: i >= filled })),
    dots: xs.flatMap((x, i) => (i >= filled ? [] : Array.from({ length: tops }, (_, k) => {
      const a = (k / tops) * Math.PI * 2 - Math.PI / 2, rr = tops === 1 ? 0 : r * 0.5;
      return { id: `o${i}-${k}`, x: x + Math.cos(a) * rr, y: 196 + Math.sin(a) * rr, c: hue[k % hue.length], d: k * 0.08 };
    }))),
    tags: xs.map((x, i) => tag(`hat${i}`, x, 196 - r - 22, ['Red hat', 'Blue hat', 'Green hat', 'Purple hat'][i], 'ink', 22)),
  });
}

export const DATA_LESSONS: FracLesson[] = [
  {
    id: 'data-sort', title: 'Sort and Count', blurb: 'Put each kind in its own row, then count. The longest row has the most.', set: 'fair', skill: 'da-sort', art: 'learn/data/card-sort.webp',
    steps: [
      { say: '', board: board({ dots: jumble(SORT_N) }), eq: 'A jumble of prize blocks' },
      { say: '', board: board({ dots: sorted(SORT_N, ['a']), tags: rowTags(['a']) }), eq: 'Blue: [5]' },
      { say: '', board: board({ dots: sorted(SORT_N, ['a', 'b']), tags: rowTags(['a', 'b']) }), eq: 'Pink: [3]' },
      { say: '', board: board({ dots: sorted(SORT_N, ['a', 'b', 'c']), tags: rowTags(['a', 'b', 'c']) }), eq: 'Gold: [4]' },
      { say: '', board: board({ dots: sorted(SORT_N, ['a', 'b', 'c']), tags: [...rowTags(['a', 'b', 'c']), tag('na', 170 + 5 * 64, ROWY.a, '5', 'a', 30), tag('nb', 170 + 3 * 64, ROWY.b, '3', 'b', 30), tag('nc', 170 + 4 * 64, ROWY.c, '4', 'c', 30)] }), eq: 'Blue 5, gold 4, pink 3: blue has [the most]' },
    ],
    tries: [
      Q('How many gold blocks?', '3', 'num', 'Find the gold ones and touch each one once: 1, 2, 3.', 'Find the gold ones first, then touch each one once as you count.', board({ dots: jumble([4, 6, 3], 'q') })),
      Q('How many pink blocks?', '6', 'num', 'Pink ones, one touch each: 1, 2, 3, 4, 5, 6.', 'Find the pink ones, then touch each one once as you count.', board({ dots: jumble([4, 6, 3], 'q') })),
      Q('How many blocks in all?', '9', 'num', 'Count each row and put them together: 3 + 2 + 4 = 9.', 'Count each row, then add the rows together.', board({ dots: sorted([3, 2, 4], ['a', 'b', 'c']), tags: rowTags(['a', 'b', 'c']) })),
    ],
    teach: { q: Q('How many gold blocks?', '6', 'num', 'Touch each gold block once, so none get missed: 6.', '', board({ dots: jumble([3, 2, 6], 't') })), wrong: '5', says: 'I counted the gold ones really fast: 1, 2, 3, 4, 5. Five!', decoy: '7', fixed: 'One was hiding! Touch each one ONCE as you count, and none get missed: 6 gold blocks.' },
  },
  {
    id: 'data-bars', title: 'Build a Bar Graph', blurb: 'Stack a block for every vote. The tops show how many; the gap shows how many more.', set: 'fair', skill: 'da-bars', art: 'learn/data/card-bars.webp',
    steps: [
      { say: '', board: bars(0, 0, { title: true }), eq: 'Blue balloons or pink balloons?' },
      { say: '', board: bars(5, 0, { title: true }), eq: 'Blue: [5] votes' },
      { say: '', board: bars(5, 2, { title: true }), eq: 'Pink: [2] votes' },
      { say: '', board: bars(5, 2, { title: true, axis: true }), eq: 'Read across from the top: blue [5], pink 2', do: 'watch' },
      { say: '', board: bars(5, 2, { title: true, axis: true, gold: 2 }), eq: '5 − 2 = [3] more for blue' },
    ],
    tries: [
      Q('How many votes for pink?', '4', 'num', 'The pink bar is 4 blocks tall: 4 votes.', 'Count the pink blocks from the bottom up.', bars(3, 4, { title: true, axis: true })),
      Q('How many more votes for blue than pink?', '4', 'num', 'Blue 6, pink 2. The gap between their tops: 6 − 2 = 4.', 'Look at the blue blocks higher than the pink top. Count them.', bars(6, 2, { title: true, axis: true })),
      Q('How many votes in all?', '8', 'num', 'Blue 3 and pink 5: 3 + 5 = 8.', 'Read both bars, then add them.', bars(3, 5, { title: true, axis: true })),
    ],
    teach: { q: Q('How many more votes for blue than pink?', '2', 'num', 'The gap between the tops: 6 − 4 = 2.', '', bars(6, 4, { title: true, axis: true })), wrong: '10', says: 'Blue has 6 and pink has 4. 6 and 4 make 10!', decoy: '4', fixed: 'How many MORE is the gap between the tops, not both added up: 6 take away 4 is 2.' },
  },
  {
    id: 'data-lineplot', title: 'Dots on a Line', blurb: 'One dot for each ribbon, over its length. Taller stacks mean more ribbons that long.', set: 'fair', skill: 'da-lineplot', art: 'learn/data/card-line.webp',
    steps: [
      { say: '', board: plot([0, 0, 0, 0, 0]), eq: 'Ribbon lengths, in inches' },
      { say: '', board: plot([0, 1, 0, 0, 0]), eq: 'A ribbon [1/4] inch long: one dot' },
      { say: '', board: plot([0, 1, 3, 0, 0]), eq: 'Three ribbons are 2/4 inch: [3] dots' },
      { say: '', board: plot([0, 1, 3, 2, 0]), eq: '[2] ribbons are 3/4 inch' },
      { say: '', board: plot([0, 1, 3, 2, 0], ['d1-0', 'd3-0']), eq: 'Longest − shortest: 3/4 − 1/4 = [2/4] inch' },
    ],
    tries: [
      Q('How many ribbons are 3/4 inch long?', '3', 'num', 'Find 3/4 under the line and count the dots above it: 3.', 'Find 3/4 under the line, then count the dots above it.', plot([0, 2, 1, 3, 1])),
      Q('How many ribbons in all?', '6', 'num', 'One dot is one ribbon: 1 + 2 + 2 + 1 = 6.', 'Each dot is one ribbon. Count every dot.', plot([0, 1, 2, 2, 1])),
      Q('How much longer is the longest ribbon than the shortest?', '3/4', 'frac', 'Longest 1 (that is 4/4), shortest 1/4: 4/4 − 1/4 = 3/4.', 'Find the dots furthest left and right. Count the quarter jumps between them.', plot([0, 1, 2, 0, 1]), true),
    ],
    teach: { q: Q('How many ribbons are 2/4 inch long?', '3', 'num', 'Count the dots above 2/4: 3 ribbons.', '', plot([0, 1, 3, 2, 0])), wrong: '2', says: '2/4? It has a 2 on top... so 2 ribbons!', decoy: '4', fixed: 'The fraction under the line is how LONG the ribbon is. Count the dots stacked above 2/4: 3 ribbons.' },
  },
  {
    id: 'data-mean', title: 'Fair Share', blurb: 'The mean is a fair share: level the towers out, or add them up and share by how many.', set: 'fair', skill: 'da-mean', art: 'learn/data/card-mean.webp',
    steps: [
      { say: '', board: board({ dots: towers([5, 1, 3], t => (t === 1 ? 'b' : 'a')), tags: towerTags([5, 1, 3]) }), eq: 'Three towers: 5, 1 and 3' },
      { say: '', board: board({ dots: [...towers([3, 1, 3], t => (t === 1 ? 'b' : 'a')), ...column('t0-', 300, 2, () => 'c', BASE, 1).map((d, i) => ({ ...d, id: `t0-${3 + i}` }))] }), eq: 'Move 2 from the tallest to the shortest' },
      { say: '', board: board({ dots: [...towers([3, 1, 3], t => (t === 1 ? 'b' : 'a')), ...column('t0-', 300, 2, () => 'c', BASE, 1).map((d, i) => ({ ...d, id: `t0-${3 + i}` }))], tags: towerTags([3, 3, 3]) }), eq: 'Fair share: every tower is [3]. That is the mean!', do: 'watch' },
      { say: '', board: board({ dots: [...towers([3, 1, 3], t => (t === 1 ? 'b' : 'a')), ...column('t0-', 300, 2, () => 'c', BASE, 1).map((d, i) => ({ ...d, id: `t0-${3 + i}` }))], tags: [...towerTags([3, 3, 3]), tag('sum', 300, BASE + 80, '5 + 1 + 3 = 9 · 9 ÷ 3 = 3', 'ink', 26)] }), eq: 'Add them: 9. Share by 3: [3] each', do: 'watch' },
    ],
    tries: [
      Q('Level the towers. How tall is each one?', '4', 'num', '4 + 2 + 6 = 12 blocks, shared by 3 towers: 4 each.', 'Move blocks from the tall towers to the short ones until they match.', board({ dots: towers([4, 2, 6], () => 'a'), tags: towerTags([4, 2, 6]) })),
      Q('Level the towers. How tall is each one?', '3', 'num', '1 + 5 + 3 + 3 = 12, shared by 4 towers: 3 each.', 'Add them all up, then share by how many towers there are.', board({ dots: towers([1, 5, 3, 3], () => 'a'), tags: towerTags([1, 5, 3, 3]) })),
      Q('What is the mean of the towers?', '4', 'num', '7 + 2 + 3 = 12, shared by 3: 4.', 'Add them all up, then share by how many there are.', board({ dots: towers([7, 2, 3], () => 'a'), tags: towerTags([7, 2, 3]) })),
    ],
    teach: { q: Q('What is the mean of the towers?', '4', 'num', '6 + 2 + 4 = 12, shared by 3 towers: 4 each.', '', board({ dots: towers([6, 2, 4], () => 'a'), tags: towerTags([6, 2, 4]) })), wrong: '6', says: 'The mean? The tallest tower has 6 blocks, so it\'s 6!', decoy: '12', fixed: 'The mean is a FAIR share, not the tallest. Add them: 6 + 2 + 4 = 12, then share by 3 towers: 4 each.' },
  },
  {
    id: 'data-median', title: 'The Middle One', blurb: 'Line them up from smallest to biggest. The median is the one in the middle.', set: 'fair', skill: 'da-middle', art: 'learn/data/card-median.webp',
    steps: [
      { say: '', board: board({ dots: towers([4, 6, 2, 5, 3], () => 'a', undefined, ['h4', 'h6', 'h2', 'h5', 'h3']) }), eq: 'Five towers, all mixed up' },
      { say: '', board: board({ dots: towers([2, 3, 4, 5, 6], () => 'a', undefined, ['h2', 'h3', 'h4', 'h5', 'h6']), tags: towerTags([2, 3, 4, 5, 6]) }), eq: 'In order, smallest to biggest', do: 'watch' },
      { say: '', board: board({ dots: towers([2, 3, 4, 5, 6], t => (t === 2 ? 'c' : 'a'), undefined, ['h2', 'h3', 'h4', 'h5', 'h6']), tags: towerTags([2, 3, 4, 5, 6]) }), eq: 'The middle one: [4]. That is the median!' },
      { say: '', board: board({ dots: towers([2, 3, 4, 5, 6], t => (t === 2 ? 'c' : t === 0 || t === 4 ? 'b' : 'a'), undefined, ['h2', 'h3', 'h4', 'h5', 'h6']), tags: towerTags([2, 3, 4, 5, 6]) }), eq: 'Range: biggest − smallest = 6 − 2 = [4]' },
    ],
    tries: [
      Q('What is the median?', '3', 'num', 'In order: 1, 3, 5. The middle one is 3.', 'Put them in order first, then find the middle one.', board({ dots: towers([5, 1, 3], () => 'a'), tags: towerTags([5, 1, 3]) })),
      Q('What is the median?', '4', 'num', 'In order: 2, 3, 4, 6, 7. The middle one is 4.', 'Put them in order, then cross one off each end until one is left.', board({ dots: towers([2, 7, 4, 6, 3], () => 'a'), tags: towerTags([2, 7, 4, 6, 3]) })),
      Q('What is the range?', '4', 'num', 'Tallest 6, shortest 2: 6 − 2 = 4.', 'Find the tallest and the shortest, then take one from the other.', board({ dots: towers([3, 6, 2, 5], () => 'a'), tags: towerTags([3, 6, 2, 5]) })),
    ],
    teach: { q: Q('What is the median?', '4', 'num', 'In order: 2, 4, 6. Now the middle one is 4.', '', board({ dots: towers([6, 2, 4], () => 'a'), tags: towerTags([6, 2, 4]) })), wrong: '2', says: 'The middle tower is the one with 2 blocks, so the median is 2!', decoy: '6', fixed: 'Put them in ORDER first: 2, 4, 6. Now the middle one is 4.' },
  },
  {
    id: 'data-chance', title: 'Chance in a Bowl', blurb: 'The chance is the ways it can happen over all the ways: 3 gold of 8 blocks is 3/8.', set: 'fair', skill: 'da-chance', art: 'learn/data/card-chance.webp',
    steps: [
      { say: '', board: bowl([5, 3, 0]), eq: '8 blocks in the bowl. Close your eyes and pick one!' },
      { say: '', board: board({ ...bowl([5, 3, 0]), dots: bowl([5, 3, 0]).dots.map(d => (d.c === 'b' ? { ...d, c: 'c' as Hue } : d)) }), eq: 'We want gold: [3] gold blocks' },
      { say: '', board: board({ ...bowl([5, 3, 0]), dots: bowl([5, 3, 0]).dots.map(d => (d.c === 'b' ? { ...d, c: 'c' as Hue } : d)), tags: [tag('top', 300, 22, '3 gold · 8 in all', 'ink', 26)] }), eq: '3 out of 8: a [3/8] chance', do: 'watch' },
      { say: '', board: board({ ...bowl([5, 3, 0]), dots: bowl([5, 3, 0]).dots.map(d => (d.c === 'b' ? { ...d, c: 'c' as Hue } : d)), tags: [tag('top', 300, 22, '3/8 is less than half (4/8)', 'ink', 26)] }), eq: 'Less than half: [unlikely], but it can happen', do: 'watch' },
    ],
    tries: [
      Q('Close your eyes and pick one. What is the chance of gold?', '2/6', 'frac', '2 gold of 6 blocks in all: 2/6.', 'Gold ones on top, ALL the blocks on the bottom.', bowl([4, 0, 2]), true),
      Q('Close your eyes and pick one. What is the chance of gold?', '5/8', 'frac', '5 gold of 8 blocks in all: 5/8.', 'Count the gold ones for the top and all of them for the bottom.', bowl([3, 0, 5]), true),
      Q('Close your eyes and pick one. What is the chance of gold?', '1/6', 'frac', '1 gold of 6 blocks in all: 1/6.', 'Count the gold ones for the top and all of them for the bottom.', bowl([3, 2, 1]), true),
    ],
    teach: { q: Q('What is the chance of gold?', '2/6', 'frac', '2 gold of 6 blocks: 2/6.', '', bowl([4, 0, 2]), true), wrong: '2/4', says: '2 gold and 4 blue... so it\'s 2/4!', decoy: '4/6', fixed: 'The bottom counts ALL the blocks in the bowl, the gold ones too: 2 of 6 is 2/6.' },
  },
  {
    id: 'data-both', title: 'Two at Once', blurb: 'Every hat goes with every top: 2 hats and 3 tops make 2 × 3 = 6 outfits.', set: 'fair', skill: 'da-both', art: 'learn/data/card-both.webp',
    steps: [
      { say: '', board: hats(2, 3, 0), eq: '2 hats, and 3 tops: blue, pink and gold' },
      { say: '', board: hats(2, 3, 1), eq: 'The red hat with each top: [3] outfits' },
      { say: '', board: hats(2, 3, 2), eq: 'The blue hat with each top: [3] more' },
      { say: '', board: board({ ...hats(2, 3, 2), tags: [...hats(2, 3, 2).tags, tag('x', 300, 330, '2 hats × 3 tops', 'ink', 24)] }), eq: '2 × 3 = [6] outfits', do: 'watch' },
    ],
    tries: [
      Q('How many different outfits?', '6', 'num', '3 hats, each with 2 tops: 3 × 2 = 6.', 'Every hat goes with every top. Count them all, or times them.', hats(3, 2)),
      Q('How many different outfits?', '8', 'num', '2 hats, each with 4 tops: 2 × 4 = 8.', 'Every hat goes with every top: times the hats by the tops.', hats(2, 4)),
      Q('How many different outfits?', '9', 'num', '3 hats, each with 3 tops: 3 × 3 = 9.', 'Every hat goes with every top: times the hats by the tops.', hats(3, 3)),
    ],
    teach: { q: Q('How many different outfits?', '12', 'num', 'Every hat goes with every top: 3 × 4 = 12.', '', hats(3, 4)), wrong: '7', says: '3 hats and 4 tops: 3 + 4 = 7 outfits!', decoy: '9', fixed: 'Every hat goes with EVERY top, so it is times, not plus: 3 × 4 = 12 outfits.' },
  },
];
export const DATA_LESSON: Record<string, FracLesson> = Object.fromEntries(DATA_LESSONS.map(l => [l.id, l]));
/** the colour of the Data and chance episodes (their cards and buttons) */
export const DATA_COLOR = '#e85d9a';
