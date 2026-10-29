// The fractions Learn episodes: each fraction idea as a short story at the table, with things you can
// really cut and share: a blueberry pie in slices, a pizza, a chocolate bar that snaps into squares,
// cupcakes to share onto plates, and a plank cut into equal jumps. They play in the same episode as the
// fact tricks (math/ui/Episode.svelte): the pictures are boards whose counters have shapes (a slice, a
// square, a cupcake), so dragging, tapping and hopping work just the same.
import type { Board, Dot, Hue, Shape, Step, Tag } from './learn';
import type { SetId } from './episodes';
import type { GlimmerId } from '../adventure/glimmers';

/** a question with an answer you type: a number, or a fraction (`equiv`: an equal fraction counts too) */
export type EpQ = { text: string; ans: string; input: 'num' | 'frac'; equiv?: boolean; hint: string; hidden: string; pic: Board };
export type FracLesson = {
  id: string; title: string; blurb: string; set: SetId;
  /** the Glimmer at the table (the place's own, unless named here) */
  star?: GlimmerId;
  steps: Step[];
  tries: [EpQ, EpQ, EpQ];
  /** the buddy's go: what it gets wrong, what it says, one more wrong choice, and its "oops" */
  teach: { q: EpQ; wrong: string; says: string; decoy: string; fixed: string };
  /** which step makes the best picture (its card shows the painted art instead) */
  art: string;
  /** the fraction skill it teaches (skills/registry) */
  skill: string;
};

const board = (b: Partial<Board>): Board => ({ cell: 48, dots: [], frames: [], plates: [], line: null, tags: [], ...b });
const tag = (id: string, x: number, y: number, text: string, c: Tag['c'] = 'ink', size = 28): Tag => ({ id, x, y, text, c, size });

// ---------- the things ----------
/** where slice i of n sits (its middle), from the middle of a whole of radius R */
function sliceAt(n: number, i: number, R: number) {
  const th = (Math.PI * 2) / n, a = (i + 0.5) * th - Math.PI / 2;
  const d = n === 1 ? 0 : (4 * R * Math.sin(th / 2)) / (3 * th);
  return { dx: Math.cos(a) * d, dy: Math.sin(a) * d };
}
type Place = { x: number; y: number };
/** The slices of a pie (or pizza) cut into n: slice i is drawn at `where(i)` (its own dish, or a plate),
 *  `hue(i)` colours it (null leaves it out). */
function slices(prefix: string, food: 'pie' | 'pizza', n: number, R: number, where: (i: number) => Place | null, hue: (i: number) => Hue | null, d = 0.05): Dot[] {
  const out: Dot[] = [];
  for (let i = 0; i < n; i++) {
    const h = hue(i), p = where(i);
    if (!h || !p) continue;
    const { dx, dy } = sliceAt(n, i, R);
    const shape: Shape = { k: 'wedge', food, n, i, r: R };
    out.push({ id: `${prefix}${i}`, x: p.x + dx, y: p.y + dy, c: h, d: i * d, shape });
  }
  return out;
}
/** a chocolate bar of n squares (w wide), its middle at (x, y): square i at its place, or moved */
function squares(prefix: string, n: number, w: number, x: number, y: number, where: (i: number, home: Place) => Place | null, hue: (i: number) => Hue | null): Dot[] {
  const gap = w * 0.08, x0 = x - ((n - 1) * (w + gap)) / 2;
  const out: Dot[] = [];
  for (let i = 0; i < n; i++) {
    const h = hue(i), p = where(i, { x: x0 + i * (w + gap), y });
    if (!h || !p) continue;
    out.push({ id: `${prefix}${i}`, x: p.x, y: p.y, c: h, d: i * 0.05, shape: { k: 'chunk', w } });
  }
  return out;
}
const foil = (id: string, n: number, w: number, x: number, y: number) => ({ id, x, y, r: w, kind: 'foil' as const, w: n * w * 1.08 + 18, h: w + 18 });
const dish = (id: string, x: number, y: number, r: number, kind: 'pie' | 'pizza' = 'pie') => ({ id, x, y, r: r + 8, kind });
/** cupcakes in rows of `per`, `cell` apart, their middle at (x, y) */
function cakes(prefix: string, n: number, per: number, cell: number, x: number, y: number, hue: (i: number) => Hue): Dot[] {
  const rows = Math.ceil(n / per);
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / per), c = i % per, inRow = Math.min(per, n - r * per);
    return { id: `${prefix}${i}`, x: x + (c - (inRow - 1) / 2) * cell, y: y + (r - (rows - 1) / 2) * cell, c: hue(i), d: i * 0.04, shape: { k: 'cupcake' } as Shape };
  });
}
/** n cupcakes shared round plates: cupcake i on plate i % plates, in a little ring */
function onPlates(prefix: string, n: number, plates: Place[], pr: number, hue: (i: number, plate: number) => Hue): Dot[] {
  const per = Math.ceil(n / plates.length);
  return Array.from({ length: n }, (_, i) => {
    const p = i % plates.length, k = Math.floor(i / plates.length), a = (k / per) * Math.PI * 2 - Math.PI / 2;
    const rr = per === 1 ? 0 : pr * 0.45;
    return { id: `${prefix}${i}`, x: plates[p].x + Math.cos(a) * rr, y: plates[p].y + Math.sin(a) * rr, c: hue(i, p), d: i * 0.04, shape: { k: 'cupcake' } as Shape };
  });
}
const plate = (id: string, x: number, y: number, r: number, empty = false) => ({ id, x, y, r, empty });
const line = (to: number, den: number, at: number, hops: { a: number; b: number; label: string }[] = []) => ({ from: 0, to, at, hops, den });
const fr = (n: number, d: number) => `${n}/${d}`;

// ---------- pictures for the questions ----------
/** a pie cut into d, `on` of its slices moved to the plate */
function pieOnPlate(d: number, on: number, food: 'pie' | 'pizza' = 'pie'): Board {
  const R = 100, P = { x: 190, y: 172 }, Q = { x: 440, y: 178 };
  return board({ dishes: [dish('d', P.x, P.y, R, food)], plates: [plate('p', Q.x, Q.y, 108)], dots: slices('s', food, d, R, i => (i < on ? Q : P), i => (i < on ? 'c' : 'a')) });
}
/** two plates with a and b slices of a pie cut into da and db */
function twoPlates(a: [number, number], b: [number, number]): Board {
  const R = 92, L = { x: 170, y: 170 }, Rr = { x: 430, y: 170 };
  return board({
    plates: [plate('pl', L.x, L.y, 104), plate('pr', Rr.x, Rr.y, 104)],
    dots: [...slices('l', 'pie', a[1], R, i => (i < a[0] ? L : null), () => 'c'), ...slices('r', 'pie', b[1], R, i => (i < b[0] ? Rr : null), () => 'b')],
  });
}
/** a bar of d squares with `n` gold (the part asked about) */
function barPart(d: number, n: number): Board {
  const w = Math.min(64, 480 / d);
  return board({ dishes: [foil('f', d, w, 300, 170)], dots: squares('q', d, w, 300, 170, (_, h) => h, i => (i < n ? 'c' : 'a')) });
}
/** a plank cut into d, with the hops to `at` */
function plankTo(d: number, at: number): Board {
  return board({ line: line(d, d, at, Array.from({ length: at }, (_, i) => ({ a: i, b: i + 1, label: '' }))) });
}
/** n cupcakes shared onto k plates */
function shareOut(n: number, k: number, gold = -1): Board {
  const pr = k <= 2 ? 92 : 78, xs = Array.from({ length: k }, (_, i) => 300 + (i - (k - 1) / 2) * (k <= 2 ? 230 : 180));
  const ps = xs.map(x => ({ x, y: 175 }));
  return board({ plates: ps.map((p, i) => plate(`p${i}`, p.x, p.y, pr)), dots: onPlates('c', n, ps, pr, (_, p) => (p === gold ? 'c' : 'a')) });
}
/** two pizzas: the left cut into a halves-or-whatever with `l` gold, the right cut into b with `r` pink */
function twoPizzas(a: number, l: number, b: number, r: number): Board {
  const R = 96, L = { x: 165, y: 172 }, Rr = { x: 435, y: 172 };
  return board({ dishes: [dish('dl', L.x, L.y, R, 'pizza'), dish('dr', Rr.x, Rr.y, R, 'pizza')],
    dots: [...slices('pl', 'pizza', a, R, () => L, i => (i < l ? 'c' : 'a')), ...slices('pr', 'pizza', b, R, () => Rr, i => (i < r ? 'b' : 'a'))] });
}
const Q = (text: string, ans: string, input: EpQ['input'], hint: string, hidden: string, pic: Board, equiv = false): EpQ => ({ text, ans, input, hint, hidden, pic, equiv });

// ---------- the lessons ----------
const P = { x: 190, y: 172 }, PL = { x: 445, y: 178 }, PR = 104;

export const FRAC_LESSONS: FracLesson[] = [
  {
    id: 'frac-parts', title: 'Equal Parts', blurb: 'The bottom number is how many equal parts. The top is how many you have.', set: 'kitchen', skill: 'fr-name', art: 'learn/frac/card-pie.webp',
    steps: [
      { say: '', board: board({ dishes: [dish('d', P.x, P.y, PR)], plates: [plate('p', PL.x, PL.y, 110)], dots: slices('s', 'pie', 8, PR, () => P, () => 'a') }), eq: '8 equal slices' },
      { say: '', board: board({ dishes: [dish('d', P.x, P.y, PR)], plates: [plate('p', PL.x, PL.y, 110)], dots: slices('s', 'pie', 8, PR, i => (i < 3 ? PL : P), i => (i < 3 ? 'c' : 'a')) }), eq: '[3] of 8 slices' },
      { say: '', board: board({ dishes: [dish('d', P.x, P.y, PR)], plates: [plate('p', PL.x, PL.y, 110)], dots: slices('s', 'pie', 8, PR, i => (i < 3 ? PL : P), i => (i < 3 ? 'c' : 'a')),
        tags: [tag('top', PL.x, PL.y + 160, '3 on the plate', 'c', 24), tag('bot', P.x, P.y + 160, '8 equal parts', 'a', 24)] }), eq: '[3/8]' },
    ],
    tries: [
      Q('What fraction is on the plate?', '2/6', 'frac', 'The pie has 6 equal slices: 6 on the bottom. 2 are on the plate: 2 on top. 2/6.', 'The pie has 6 equal slices: that goes on the bottom. Count the slices on the plate for the top.', pieOnPlate(6, 2)),
      Q('What fraction is on the plate?', '5/8', 'frac', '8 equal slices, so 8 on the bottom. 5 on the plate: 5/8.', '8 equal slices, so 8 on the bottom. How many on the plate?', pieOnPlate(8, 5)),
      Q('What fraction is on the plate?', '3/4', 'frac', '4 equal slices, 3 on the plate: 3/4.', '4 equal slices: 4 on the bottom. How many on the plate?', pieOnPlate(4, 3)),
    ],
    teach: { q: Q('What fraction is on the plate?', '1/4', 'frac', 'The bottom is ALL the equal parts: 4. One is on the plate: 1/4.', '', pieOnPlate(4, 1)), wrong: '1/3', says: '1 slice on the plate and 3 left in the dish... so 1/3!', decoy: '3/4', fixed: 'The bottom number counts ALL the equal parts, not just the ones left. 4 parts, 1 on the plate: 1/4.' },
  },
  {
    id: 'frac-one-piece', title: 'One Piece', blurb: 'One of 4 equal pieces is 1/4. Three of them make 3/4.', set: 'workshop', skill: 'fr-unit', art: 'learn/frac/card-choc.webp',
    steps: [
      { say: '', board: board({ dishes: [foil('f', 4, 72, 300, 140)], dots: squares('q', 4, 72, 300, 140, (_, h) => h, () => 'a') }), eq: '4 equal squares' },
      { say: '', board: board({ dishes: [foil('f', 4, 72, 300, 140)], dots: squares('q', 4, 72, 300, 140, (i, h) => (i === 0 ? { x: 200, y: 268 } : h), i => (i === 0 ? 'c' : 'a')) }), eq: 'one piece: [1/4]' },
      { say: '', board: board({ dishes: [foil('f', 4, 72, 300, 140)], dots: squares('q', 4, 72, 300, 140, (i, h) => (i < 3 ? { x: 200 + i * 84, y: 268 } : h), i => (i < 3 ? 'c' : 'a')) }), eq: '1/4 + 1/4 + 1/4 = [3/4]' },
    ],
    tries: [
      Q('One piece of this bar is...', '1/3', 'frac', '3 equal pieces, so one of them is 1/3.', 'Count all the equal pieces for the bottom number.', barPart(3, 1)),
      Q('The gold pieces are...', '4/6', 'frac', '6 equal pieces, 4 of them gold: 4/6.', '6 equal pieces on the bottom. Count the gold ones for the top.', barPart(6, 4)),
      Q('The gold pieces are...', '3/8', 'frac', '8 equal pieces, 3 gold: 3/8.', '8 equal pieces on the bottom. How many gold?', barPart(8, 3)),
    ],
    teach: { q: Q('One piece of a bar of 5 is...', '1/5', 'frac', 'The bar has 5 equal pieces, so one piece is 1/5.', '', barPart(5, 1)), wrong: '1/4', says: 'One piece, and 4 left... so one piece is 1/4!', decoy: '4/5', fixed: 'The bar is 5 equal pieces, so each one is 1/5. Count them all, not just the ones left!' },
  },
  {
    id: 'frac-of-a-set', title: 'Part of a Set', blurb: '2 of 6 cupcakes is 2/6. 1/3 of 12? Share 12 into 3 groups.', set: 'picnic', skill: 'fr-set', art: 'learn/frac/card-cupcakes.webp',
    steps: [
      { say: '', board: board({ dots: cakes('k', 6, 6, 84, 300, 220, () => 'a') }), eq: '6 cupcakes' },
      { say: '', board: board({ dots: cakes('k', 6, 6, 84, 300, 220, i => (i < 2 ? 'c' : 'a')) }), eq: '[2] of 6 = [2/6]' },
      { say: '', board: board({ plates: shareOut(0, 3).plates, dots: cakes('t', 12, 6, 58, 300, 296, () => 'a') }), eq: '1/3 of 12', do: 'watch' },
      { say: '', board: board({ plates: shareOut(0, 3).plates, dots: onPlates('t', 12, shareOut(0, 3).plates, 78, () => 'a') }), eq: '12 shared into 3 = [4] each' },
      { say: '', board: board({ plates: shareOut(0, 3).plates, dots: onPlates('t', 12, shareOut(0, 3).plates, 78, (_, p) => (p === 0 ? 'c' : 'a')) }), eq: '1/3 of 12 = [4]' },
    ],
    tries: [
      Q('What fraction of the cupcakes are gold?', '3/5', 'frac', '5 cupcakes in all, 3 gold: 3/5.', '5 cupcakes in all on the bottom. Count the gold ones.', board({ dots: cakes('k', 5, 5, 80, 300, 170, i => (i < 3 ? 'c' : 'a')) })),
      Q('1/3 of 9 = ?', '3', 'num', 'Share 9 onto 3 plates: 3 on each. So 1/3 of 9 is 3.', 'Share 9 onto 3 plates. How many on one plate?', shareOut(9, 3)),
      Q('1/4 of 8 = ?', '2', 'num', 'Share 8 onto 4 plates: 2 on each.', 'Share 8 onto 4 plates. How many on one?', shareOut(8, 4)),
    ],
    teach: { q: Q('1/2 of 10 = ?', '5', 'num', 'Share 10 onto 2 plates: 5 on each.', '', shareOut(10, 2, 0)), wrong: '2', says: 'Half of 10? There are 2 plates... so 2!', decoy: '8', fixed: '1/2 of 10 means share 10 onto 2 plates: 5 on each. One plate is 5!' },
  },
  {
    id: 'frac-number-line', title: 'On the Line', blurb: 'Cut 0 to 1 into equal jumps, then count the jumps.', set: 'dock', skill: 'fr-line', art: 'learn/frac/card-line.webp',
    steps: [
      { say: '', board: board({ line: line(4, 4, 0) }), eq: '0 to 1, cut into 4' },
      { say: '', board: board({ line: line(4, 4, 1, [{ a: 0, b: 1, label: '1/4' }]) }), eq: 'one jump: [1/4]' },
      { say: '', board: board({ line: line(4, 4, 3, [{ a: 0, b: 1, label: '1/4' }, { a: 1, b: 2, label: '2/4' }, { a: 2, b: 3, label: '3/4' }]) }), eq: 'three jumps: [3/4]' },
      { say: '', board: board({ line: line(4, 4, 4, [{ a: 0, b: 1, label: '1/4' }, { a: 1, b: 2, label: '2/4' }, { a: 2, b: 3, label: '3/4' }, { a: 3, b: 4, label: '4/4' }]) }), eq: '4/4 = [1] whole' },
    ],
    tries: [
      Q('Where is the Glimmer?', '1/4', 'frac', 'The plank is cut into 4 equal jumps, and it made 1: 1/4.', 'How many equal jumps from 0 to 1? That\'s the bottom number.', plankTo(4, 1)),
      Q('Where is the Glimmer?', '5/6', 'frac', '6 equal jumps from 0 to 1, and it made 5: 5/6.', 'Count the jumps from 0 to 1 for the bottom.', plankTo(6, 5)),
      Q('Where is the Glimmer?', '3/8', 'frac', '8 equal jumps, 3 made: 3/8.', 'Count the jumps from 0 to 1 for the bottom.', plankTo(8, 3)),
    ],
    teach: { q: Q('Where is the Glimmer?', '2/3', 'frac', '0 to 1 is cut into 3 equal jumps, and it made 2: 2/3.', '', plankTo(3, 2)), wrong: '2/4', says: '2 hops, and I can see 4 little marks... 2/4!', decoy: '1/3', fixed: 'Count the jumps from 0 to 1, not the marks: 3 jumps. 2 of them: 2/3.' },
  },
  {
    id: 'frac-bigger', title: 'Which Is Bigger?', blurb: 'Same bottom: more is more. One piece each: fewer cuts make bigger pieces.', set: 'kitchen', skill: 'fr-compare', art: 'learn/frac/card-pie.webp',
    steps: [
      { say: '', board: board({ dishes: [dish('a', 160, 150, 90), dish('b', 440, 150, 90)], dots: [...slices('a', 'pie', 3, 90, () => ({ x: 160, y: 150 }), () => 'a'), ...slices('b', 'pie', 8, 90, () => ({ x: 440, y: 150 }), () => 'a')] }), eq: '3 slices, or 8 slices?' },
      { say: '', board: board({ dishes: [dish('a', 160, 150, 90), dish('b', 440, 150, 90)], plates: [plate('pa', 210, 300, 64), plate('pb', 390, 300, 64)],
        dots: [...slices('a', 'pie', 3, 90, i => (i === 0 ? { x: 210, y: 300 } : { x: 160, y: 150 }), i => (i === 0 ? 'c' : 'a')), ...slices('b', 'pie', 8, 90, i => (i === 0 ? { x: 390, y: 300 } : { x: 440, y: 150 }), i => (i === 0 ? 'c' : 'a'))] }), eq: '1/3 and 1/8' },
      { say: '', board: board({ dishes: [dish('a', 160, 150, 90), dish('b', 440, 150, 90)], plates: [plate('pa', 210, 300, 64), plate('pb', 390, 300, 64)],
        dots: [...slices('a', 'pie', 3, 90, i => (i === 0 ? { x: 210, y: 300 } : { x: 160, y: 150 }), i => (i === 0 ? 'c' : 'a')), ...slices('b', 'pie', 8, 90, i => (i === 0 ? { x: 390, y: 300 } : { x: 440, y: 150 }), i => (i === 0 ? 'c' : 'a'))],
        tags: [tag('big', 210, 238, 'bigger!', 'c')] }), eq: '1/3 [>] 1/8' },
      { say: '', board: twoPlates([3, 8], [5, 8]), eq: '5/8 [>] 3/8', do: 'watch' },
    ],
    tries: [
      Q('Which is bigger: 2/5 or 4/5?', '4/5', 'frac', 'Same bottom number, so more is more: 4/5.', 'The bottoms are the same. Which has more pieces?', twoPlates([2, 5], [4, 5])),
      Q('Which is bigger: 1/2 or 1/5?', '1/2', 'frac', 'One piece each: fewer cuts make bigger pieces. 1/2.', 'One piece each. Which pie was cut into fewer pieces?', twoPlates([1, 2], [1, 5])),
      Q('Which is bigger: 3/8 or 3/4?', '3/4', 'frac', 'Same tops: quarters are bigger than eighths, so 3/4.', 'Same number of pieces. Which pieces are bigger?', twoPlates([3, 8], [3, 4])),
    ],
    teach: { q: Q('Which is bigger: 1/4 or 1/6?', '1/4', 'frac', 'Cut into 4, each piece is bigger than cut into 6. 1/4 is bigger.', '', twoPlates([1, 4], [1, 6])), wrong: '1/6', says: '6 is bigger than 4, so 1/6 is bigger!', decoy: 'the same', fixed: 'More cuts make SMALLER pieces! A pie cut into 4 has bigger slices than one cut into 6. 1/4 is bigger.' },
  },
  {
    id: 'frac-equal', title: 'Same Amount', blurb: 'Same pizza, more cuts: 1/2 = 2/4 = 4/8.', set: 'picnic', star: 'puddlepup', skill: 'fr-equal', art: 'learn/frac/card-pizza.webp',
    steps: [
      { say: '', board: board({ dishes: [dish('d', 300, 170, 120, 'pizza')], dots: slices('h', 'pizza', 2, 120, () => ({ x: 300, y: 170 }), i => (i === 0 ? 'c' : 'a')) }), eq: '[1/2]' },
      { say: '', board: board({ dishes: [dish('d', 300, 170, 120, 'pizza')], dots: slices('q', 'pizza', 4, 120, () => ({ x: 300, y: 170 }), () => 'a') }), eq: 'cut into 4', do: 'watch' },
      { say: '', board: board({ dishes: [dish('d', 300, 170, 120, 'pizza')], dots: slices('q', 'pizza', 4, 120, () => ({ x: 300, y: 170 }), i => (i < 2 ? 'c' : 'a')) }), eq: '1/2 = [2/4]' },
      { say: '', board: board({ dishes: [dish('d', 300, 170, 120, 'pizza')], dots: slices('e', 'pizza', 8, 120, () => ({ x: 300, y: 170 }), i => (i < 4 ? 'c' : 'a')) }), eq: '1/2 = 2/4 = [4/8]', do: 'watch' },
    ],
    tries: [
      Q('1/2 = ?/4', '2/4', 'frac', 'Cut each half in two: 4 slices, and the half is 2 of them. 2/4.', 'Cut each half into two. How many quarters cover a half?', twoPizzas(2, 1, 4, 2)),
      Q('1/4 = ?/8', '2/8', 'frac', 'Cut each quarter in two: one quarter is 2 eighths. 2/8.', 'Cut each quarter in two. How many eighths?', twoPizzas(4, 1, 8, 2)),
      Q('2/3 = ?/6', '4/6', 'frac', 'Cut each third in two: 2 thirds is 4 sixths. 4/6.', 'Cut each third in two. How many sixths?', twoPizzas(3, 2, 6, 4)),
    ],
    teach: { q: Q('1/3 = ?/6', '2/6', 'frac', 'Twice as many cuts: twice as many slices. 1/3 = 2/6.', '', twoPizzas(3, 1, 6, 2)), wrong: '1/6', says: 'Make the bottom 6, keep the top the same... 1/6!', decoy: '3/6', fixed: 'If the bottom doubles, the top doubles too: twice as many cuts makes twice as many slices. 1/3 = 2/6.' },
  },
  {
    id: 'frac-add', title: 'Adding Slices', blurb: 'Add the tops, keep the bottom.', set: 'kitchen', skill: 'fr-add', art: 'learn/frac/card-pie.webp',
    steps: [
      { say: '', board: board({ dishes: [dish('d', P.x, P.y, PR)], plates: [plate('p', PL.x, PL.y, 110)], dots: slices('s', 'pie', 8, PR, () => P, () => 'a') }), eq: '1/8 + 2/8' },
      { say: '', board: board({ dishes: [dish('d', P.x, P.y, PR)], plates: [plate('p', PL.x, PL.y, 110)], dots: slices('s', 'pie', 8, PR, i => (i < 1 ? PL : P), i => (i < 1 ? 'c' : 'a')) }), eq: '[1/8]' },
      { say: '', board: board({ dishes: [dish('d', P.x, P.y, PR)], plates: [plate('p', PL.x, PL.y, 110)], dots: slices('s', 'pie', 8, PR, i => (i < 3 ? PL : P), i => (i < 1 ? 'c' : i < 3 ? 'b' : 'a')) }), eq: '1/8 + [2/8]' },
      { say: '', board: board({ dishes: [dish('d', P.x, P.y, PR)], plates: [plate('p', PL.x, PL.y, 110)], dots: slices('s', 'pie', 8, PR, i => (i < 3 ? PL : P), i => (i < 3 ? 'c' : 'a')), tags: [tag('sum', PL.x, PL.y - 128, '3 slices, still eighths', 'c')] }), eq: '1/8 + 2/8 = [3/8]' },
    ],
    tries: [
      Q('1/4 + 2/4 = ?', '3/4', 'frac', 'Add the tops: 1 + 2 = 3. Still quarters: 3/4.', 'Add the tops. Does the bottom change?', pieOnPlate(4, 3), true),
      Q('3/8 + 4/8 = ?', '7/8', 'frac', 'Add the tops: 3 + 4 = 7. Still eighths: 7/8.', 'Add the tops. The bottom stays.', pieOnPlate(8, 7), true),
      Q('2/6 + 3/6 = ?', '5/6', 'frac', 'Add the tops: 2 + 3 = 5. Still sixths: 5/6.', 'Add the tops. The bottom stays.', pieOnPlate(6, 5), true),
    ],
    teach: { q: Q('2/5 + 1/5 = ?', '3/5', 'frac', 'Add the tops: 2 + 1 = 3. They are still fifths: 3/5.', '', pieOnPlate(5, 3)), wrong: '3/10', says: '2 + 1 is 3, and 5 + 5 is 10... 3/10!', decoy: '2/5', fixed: 'Adding slices doesn\'t change their size! Add the tops, keep the bottom: 3/5.' },
  },
  {
    id: 'frac-take-away', title: 'Taking Away Slices', blurb: 'Take away the tops, keep the bottom.', set: 'workshop', skill: 'fr-sub', art: 'learn/frac/card-choc.webp',
    steps: [
      { say: '', board: board({ dishes: [foil('f', 6, 66, 300, 170)], dots: squares('q', 6, 66, 300, 170, (_, h) => h, i => (i < 5 ? 'a' : null)) }), eq: '5/6 of a bar' },
      { say: '', board: board({ dishes: [foil('f', 6, 66, 300, 170)], dots: squares('q', 6, 66, 300, 170, (_, h) => h, i => (i < 3 ? 'a' : null)) }), eq: '5/6 [−] 2/6' },
      { say: '', board: board({ dishes: [foil('f', 6, 66, 300, 170)], dots: squares('q', 6, 66, 300, 170, (_, h) => h, i => (i < 3 ? 'c' : null)), tags: [tag('left', 300, 104, '3 left, still sixths', 'c')] }), eq: '5/6 − 2/6 = [3/6]' },
    ],
    tries: [
      Q('4/5 − 1/5 = ?', '3/5', 'frac', 'Take away the tops: 4 − 1 = 3. Still fifths: 3/5.', 'Take away the tops. The bottom stays.', barPart(5, 3), true),
      Q('5/8 − 2/8 = ?', '3/8', 'frac', 'Take away the tops: 5 − 2 = 3. Still eighths: 3/8.', 'Take away the tops. The bottom stays.', barPart(8, 3), true),
      Q('3/4 − 1/4 = ?', '2/4', 'frac', 'Take away the tops: 3 − 1 = 2. Still quarters: 2/4.', 'Take away the tops. The bottom stays.', barPart(4, 2), true),
    ],
    teach: { q: Q('7/8 − 3/8 = ?', '4/8', 'frac', '7 − 3 = 4, and they are still eighths: 4/8.', '', barPart(8, 4)), wrong: '4/5', says: '7 − 3 is 4, and 8 − 3 is 5... 4/5!', decoy: '3/8', fixed: 'Eating some squares doesn\'t change their size! Take away the tops, keep the bottom: 4/8.' },
  },
  {
    id: 'frac-mixed', title: 'Wholes and Bits', blurb: 'Every 4 quarters make a whole, so 9/4 = 2 1/4.', set: 'kitchen', skill: 'fr-mixed', art: 'learn/frac/card-pie.webp',
    steps: [
      { say: '', board: board({ dishes: [dish('a', 110, 175, 80), dish('b', 300, 175, 80), dish('c', 490, 175, 80)] }), eq: '9 quarter slices: 9/4' },
      { say: '', board: board({ dishes: [dish('a', 110, 175, 80), dish('b', 300, 175, 80), dish('c', 490, 175, 80)],
        dots: [...slices('a', 'pie', 4, 80, () => ({ x: 110, y: 175 }), () => 'a'), ...slices('b', 'pie', 4, 80, () => ({ x: 300, y: 175 }), () => 'a'), ...slices('c', 'pie', 4, 80, i => (i === 0 ? { x: 490, y: 175 } : null), () => 'c')] }), eq: '4/4 = 1 whole' },
      { say: '', board: board({ dishes: [dish('a', 110, 175, 80), dish('b', 300, 175, 80), dish('c', 490, 175, 80)],
        dots: [...slices('a', 'pie', 4, 80, () => ({ x: 110, y: 175 }), () => 'a'), ...slices('b', 'pie', 4, 80, () => ({ x: 300, y: 175 }), () => 'a'), ...slices('c', 'pie', 4, 80, i => (i === 0 ? { x: 490, y: 175 } : null), () => 'c')],
        tags: [tag('w1', 110, 78, '1 whole', 'a'), tag('w2', 300, 78, '1 whole', 'a'), tag('bit', 490, 78, '1/4', 'c')] }), eq: '9/4 = [2 1/4]' },
    ],
    tries: [
      Q('6/4 = 1 and ?/4', '2', 'num', '4 quarters make 1 whole, and 2 quarters are left: 1 and 2/4.', '4 quarters make a whole. How many are left over?', board({ dishes: [dish('a', 200, 175, 90), dish('b', 400, 175, 90)], dots: [...slices('a', 'pie', 4, 90, () => ({ x: 200, y: 175 }), () => 'a'), ...slices('b', 'pie', 4, 90, i => (i < 2 ? { x: 400, y: 175 } : null), () => 'c')] })),
      Q('11/4 = 2 and ?/4', '3', 'num', '8 quarters make 2 wholes, and 3 are left: 2 and 3/4.', '8 quarters make 2 wholes. How many are left over?', board({ dishes: [dish('a', 110, 175, 80), dish('b', 300, 175, 80), dish('c', 490, 175, 80)], dots: [...slices('a', 'pie', 4, 80, () => ({ x: 110, y: 175 }), () => 'a'), ...slices('b', 'pie', 4, 80, () => ({ x: 300, y: 175 }), () => 'a'), ...slices('c', 'pie', 4, 80, i => (i < 3 ? { x: 490, y: 175 } : null), () => 'c')] })),
      Q('5/4 = 1 and ?/4', '1', 'num', '4 quarters make 1 whole, and 1 is left: 1 and 1/4.', '4 quarters make a whole. How many are left over?', board({ dishes: [dish('a', 200, 175, 90), dish('b', 400, 175, 90)], dots: [...slices('a', 'pie', 4, 90, () => ({ x: 200, y: 175 }), () => 'a'), ...slices('b', 'pie', 4, 90, i => (i < 1 ? { x: 400, y: 175 } : null), () => 'c')] })),
    ],
    teach: { q: Q('7/4 = how many whole pies?', '1', 'num', '4 quarters make 1 whole pie. 7 quarters is one whole pie and 3 quarters more.', '', board({ dishes: [dish('a', 200, 175, 90), dish('b', 400, 175, 90)], dots: [...slices('a', 'pie', 4, 90, () => ({ x: 200, y: 175 }), () => 'a'), ...slices('b', 'pie', 4, 90, i => (i < 3 ? { x: 400, y: 175 } : null), () => 'c')] })), wrong: '2', says: '7 quarters is nearly 8... so 2 whole pies!', decoy: '7', fixed: 'Only full dishes count as wholes! 4 quarters fill one pie, and the other 3 quarters don\'t fill a second. 1 whole pie and 3/4.' },
  },
  {
    id: 'frac-times', title: 'Lots of Pieces', blurb: '3 × 2/5 is three lots of two fifths: 6/5.', set: 'workshop', skill: 'fr-times', art: 'learn/frac/card-choc.webp',
    steps: [
      { say: '', board: board({ plates: [plate('p0', 130, 170, 82), plate('p1', 300, 170, 82), plate('p2', 470, 170, 82)] }), eq: '3 × 2/5' },
      { say: '', board: board({ plates: [plate('p0', 130, 170, 82), plate('p1', 300, 170, 82), plate('p2', 470, 170, 82)],
        dots: [0, 1, 2].flatMap(p => [0, 1].map(k => ({ id: `q${p * 2 + k}`, x: [130, 300, 470][p] + (k - 0.5) * 66, y: 170, c: 'c' as Hue, d: (p * 2 + k) * 0.05, shape: { k: 'chunk', w: 60 } as Shape }))) }), eq: '2/5 + 2/5 + 2/5' },
      { say: '', board: board({ plates: [plate('p0', 130, 170, 82), plate('p1', 300, 170, 82), plate('p2', 470, 170, 82)],
        dots: [0, 1, 2].flatMap(p => [0, 1].map(k => ({ id: `q${p * 2 + k}`, x: [130, 300, 470][p] + (k - 0.5) * 66, y: 170, c: 'c' as Hue, d: 0, shape: { k: 'chunk', w: 60 } as Shape }))),
        tags: [tag('n', 300, 82, '6 fifths', 'c')] }), eq: '3 × 2/5 = [6/5]' },
    ],
    tries: [
      Q('2 × 1/4 = ?', '2/4', 'frac', 'Two lots of 1 quarter is 2 quarters: 2/4.', 'How many quarters in two lots of one quarter?', barPart(4, 2), true),
      Q('3 × 1/5 = ?', '3/5', 'frac', 'Three lots of 1 fifth is 3 fifths: 3/5.', 'How many fifths in three lots of one fifth?', barPart(5, 3), true),
      Q('2 × 2/6 = ?', '4/6', 'frac', 'Two lots of 2 sixths is 4 sixths: 4/6.', 'Two lots of 2 sixths: how many sixths?', barPart(6, 4), true),
    ],
    teach: { q: Q('2 × 3/8 = ?', '6/8', 'frac', 'Two lots of 3 eighths is 6 eighths: 6/8.', '', barPart(8, 6)), wrong: '6/16', says: '2 × 3 is 6, and 2 × 8 is 16... 6/16!', decoy: '5/8', fixed: 'The pieces stay eighths! Only the number of pieces doubles: 6/8.' },
  },
  {
    id: 'frac-unlike', title: 'Match the Bottoms', blurb: 'Different bottoms? Make them match first, then add.', set: 'picnic', star: 'puddlepup', skill: 'fr-unlike', art: 'learn/frac/card-pizza.webp',
    steps: [
      { say: '', board: twoPizzas(2, 1, 4, 1), eq: '1/2 + 1/4' },
      { say: '', board: board({ dishes: twoPizzas(2, 1, 4, 1).dishes, dots: [...slices('m', 'pizza', 4, 96, () => ({ x: 165, y: 172 }), i => (i < 2 ? 'c' : 'a')), ...slices('pr', 'pizza', 4, 96, () => ({ x: 435, y: 172 }), i => (i < 1 ? 'b' : 'a'))] }), eq: '1/2 = [2/4]', do: 'watch' },
      { say: '', board: board({ dishes: twoPizzas(2, 1, 4, 1).dishes, dots: [...slices('m', 'pizza', 4, 96, () => ({ x: 165, y: 172 }), i => (i < 2 ? 'c' : 'a')).filter(d => d.id !== 'm2'), ...slices('pr', 'pizza', 4, 96, i => (i === 0 ? { x: 165, y: 172 } : { x: 435, y: 172 }), i => (i < 1 ? 'b' : 'a')).map(d => (d.id === 'pr0' ? { ...d, ...(() => { const a = sliceAt(4, 2, 96); return { x: 165 + a.dx, y: 172 + a.dy, shape: { k: 'wedge', food: 'pizza', n: 4, i: 2, r: 96 } as Shape }; })() } : d))] }), eq: '2/4 + 1/4' },
      { say: '', board: board({ dishes: twoPizzas(2, 1, 4, 1).dishes, dots: [...slices('m', 'pizza', 4, 96, () => ({ x: 165, y: 172 }), i => (i < 2 ? 'c' : 'a')).filter(d => d.id !== 'm2'), ...slices('pr', 'pizza', 4, 96, i => (i === 0 ? { x: 165, y: 172 } : { x: 435, y: 172 }), i => (i < 1 ? 'c' : 'a')).map(d => (d.id === 'pr0' ? { ...d, ...(() => { const a = sliceAt(4, 2, 96); return { x: 165 + a.dx, y: 172 + a.dy, shape: { k: 'wedge', food: 'pizza', n: 4, i: 2, r: 96 } as Shape }; })() } : d))], tags: [tag('s', 165, 60, '3 quarters', 'c')] }), eq: '1/2 + 1/4 = [3/4]' },
    ],
    tries: [
      Q('1/2 + 1/8 = ?', '5/8', 'frac', '1/2 is 4/8. 4/8 + 1/8 = 5/8.', 'Make the half into eighths first.', twoPizzas(2, 1, 8, 1), true),
      Q('1/4 + 1/8 = ?', '3/8', 'frac', '1/4 is 2/8. 2/8 + 1/8 = 3/8.', 'Make the quarter into eighths first.', twoPizzas(4, 1, 8, 1), true),
      Q('1/2 + 1/6 = ?', '4/6', 'frac', '1/2 is 3/6. 3/6 + 1/6 = 4/6.', 'Make the half into sixths first.', twoPizzas(2, 1, 6, 1), true),
    ],
    teach: { q: Q('1/3 + 1/6 = ?', '3/6', 'frac', '1/3 is 2/6. 2/6 + 1/6 = 3/6.', '', twoPizzas(3, 1, 6, 1)), wrong: '2/9', says: '1 + 1 is 2, and 3 + 6 is 9... 2/9!', decoy: '2/6', fixed: 'Thirds and sixths are different sizes! Make them match first: 1/3 is 2/6. Then 2/6 + 1/6 = 3/6.' },
  },
];
export const FRAC_LESSON: Record<string, FracLesson> = Object.fromEntries(FRAC_LESSONS.map(l => [l.id, l]));
export const isFracLesson = (id: string) => !!FRAC_LESSON[id];

/** Is a typed answer right? A fraction may count when it's equal (2/4 for 1/2) if the question allows. */
export function fracRight(q: EpQ, typed: string): boolean {
  if (typed === q.ans) return true;
  if (q.input !== 'frac' || !q.equiv) return false;
  const [a, b] = typed.split('/').map(Number), [c, d] = q.ans.split('/').map(Number);
  return !!b && !!d && a * d === b * c;
}
