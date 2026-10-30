// The shapes and angles Learn episodes, in the crystal workshop at Shape Peaks: each main idea as a short
// story at the table with crystal tiles you can really move. Count a shape's corners by tapping them; share
// a crystal bar into equal halves and quarters; slide a square corner into angles to see which are right,
// acute and obtuse; cut a rectangle corner to corner to find a triangle's area; fill a box with layers of
// cubes; tear the corners off a triangle and line them up into a straight line; and move the little
// squares from the short sides of a right triangle onto its long side. They play in the shared episode
// (math/ui/Episode.svelte): the tiles are counters with a shape of their own ({ k: 'tile' }), so dragging,
// tapping and turning work just like the fraction episodes' slices.
import type { Board, Dot, Hue, Shape, Tag } from '../learn';
import type { FracLesson, EpQ } from '../fracEpisodes';

type P = [number, number];
type Tint = Extract<Shape, { k: 'tile' }>['tint'];
const board = (b: Partial<Board>): Board => ({ cell: 48, dots: [], frames: [], plates: [], line: null, tags: [], ...b });
const tag = (id: string, x: number, y: number, text: string, c: Tag['c'] = 'ink', size = 28): Tag => ({ id, x, y, text, c, size });
const centre = (ps: P[]): P => [ps.reduce((t, p) => t + p[0], 0) / ps.length, ps.reduce((t, p) => t + p[1], 0) / ps.length];
/** a crystal tile from its corners on the board (it sits at their middle), moved by (dx, dy) and turned `rot` degrees */
function tile(id: string, pts: P[], c: Hue, tint?: Tint, more: { dx?: number; dy?: number; rot?: number; h?: number; d?: number } = {}): Dot {
  const [cx, cy] = centre(pts);
  return { id, x: cx + (more.dx ?? 0), y: cy + (more.dy ?? 0), c, d: more.d, rot: more.rot, shape: { k: 'tile', pts: pts.map(([x, y]) => [x - cx, y - cy] as P), tint, h: more.h } };
}
const poly = (n: number, r: number, cx: number, cy: number, rot = 0): P[] => Array.from({ length: n }, (_, i) => { const a = ((rot - 90 + (360 * i) / n) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as P; });
/** words just outside each corner, numbered 1, 2, 3... */
const cornerTags = (prefix: string, pts: P[]): Tag[] => {
  const [cx, cy] = centre(pts);
  return pts.map(([x, y], i) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1; return tag(`${prefix}${i}`, x + (dx / d) * 30, y + (dy / d) * 30 + 8, String(i + 1), 'c', 30); });
};
/** a fan (an angle's corner) with its point at (vx, vy), from flat to `deg` degrees up and round */
const fan = (vx: number, vy: number, R: number, from: number, deg: number): P[] => [[vx, vy], ...Array.from({ length: 13 }, (_, i) => { const a = ((from + (deg * i) / 12) * Math.PI) / 180; return [vx + R * Math.cos(a), vy - R * Math.sin(a)] as P; })];
/** a turn of a board point about the origin, anticlockwise as seen from above (board y points down) */
const spin = ([x, y]: P, deg: number): P => { const a = (deg * Math.PI) / 180; return [x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a)]; };
const Q = (text: string, ans: string, input: EpQ['input'], hint: string, hidden: string, pic: Board): EpQ => ({ text, ans, input, hint, hidden, pic });
const one = (id: string, pts: P[], tint: Tint, tags: Tag[] = [], c: Hue = 'a') => board({ dots: [tile(id, pts, c, tint)], tags });

// ---------- 1. sides and corners ----------
const TRI: P[] = [[150, 104], [212, 212], [88, 212]];
const SQ: P[] = [[247, 104], [353, 104], [353, 210], [247, 210]];
const HEX = poly(6, 60, 455, 158, 30);
const threeShapes = (tags: Tag[]) => board({ dots: [tile('tri', TRI, 'a', 'violet'), tile('sq', SQ, 'a', 'teal'), tile('hex', HEX, 'a', 'sky')], tags });
const PENT = poly(5, 105, 300, 172), OCT = poly(8, 105, 300, 172, 22.5);
const ARROW: P[] = [[150, 140], [300, 140], [300, 80], [450, 172], [300, 264], [300, 204], [150, 204]];

// ---------- 2. equal parts ----------
const half = (x0: number, x1: number): P[] => [[x0, 118], [x1, 118], [x1, 228], [x0, 228]];
const quarter = (c: number, r: number): P[] => { const x = 128 + c * 74, y = 98 + r * 74; return [[x, y], [x + 72, y], [x + 72, y + 72], [x, y + 72]]; };
const PLATE = { id: 'p', x: 465, y: 172, r: 104 };
const strips = (ws: number[]) => { let x = 128; return ws.map(w => { const p: P[] = [[x, 98], [x + w - 2, 98], [x + w - 2, 244], [x, 244]]; x += w; return p; }); };
function cutPic(pieces: P[][], gold: number[], tint: Tint): Board { return board({ dots: pieces.map((p, i) => tile(`c${i}`, p, gold.includes(i) ? 'c' : 'a', tint)) }); }
const HEX3 = (() => { const h = poly(6, 110, 300, 172, 30); return [0, 2, 4].map(i => [[300, 172], h[i], h[(i + 1) % 6], h[(i + 2) % 6]] as P[]); })();
const TRI4 = (() => { const a: P = [300, 52], b: P = [430, 278], c: P = [170, 278], m = (p: P, q: P): P => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; const ab = m(a, b), bc = m(b, c), ca = m(c, a); return [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]] as P[][]; })();
const DIAG4 = (() => { const s: P[] = [[200, 72], [400, 72], [400, 272], [200, 272]], c: P = [300, 172]; return s.map((p, i) => [p, s[(i + 1) % 4], c]) as P[][]; })();
const BAR2 = [[[150, 110], [300, 110], [300, 234], [150, 234]], [[300, 110], [450, 110], [450, 234], [300, 234]]] as P[][];

// ---------- 3. angles ----------
const VA: P = [62, 250], VB: P = [236, 250], VC: P = [446, 250];
const WA = fan(VA[0], VA[1], 125, 0, 45), WB = fan(VB[0], VB[1], 112, 0, 90), WC = fan(VC[0], VC[1], 105, 0, 135);
const CARD = (vx: number, vy: number): P[] => [[vx, vy], [vx + 58, vy], [vx + 58, vy - 58], [vx, vy - 58]];
const CARD_HOME: P = [300, 64];
const angles = (card: P, tags: Tag[] = []) => board({ dots: [tile('wa', WA, 'a', 'violet', { h: 5 }), tile('wb', WB, 'a', 'teal', { h: 5 }), tile('wc', WC, 'a', 'rose', { h: 5 }), tile('card', CARD(card[0], card[1]), 'c', 'gold', { h: 9 })], tags });
const RECT: P[] = [[180, 112], [420, 112], [420, 232], [180, 232]];
const RTRI: P[] = [[200, 70], [200, 260], [420, 260]];
const RTRAP: P[] = [[180, 100], [330, 100], [430, 250], [180, 250]];
const DIAMOND = poly(4, 120, 300, 172, 0);

// ---------- 4. half a rectangle ----------
const T1: P[] = [[190, 110], [410, 230], [190, 230]], T2: P[] = [[190, 110], [410, 110], [410, 230]];
const G: P[] = [[150, 236], [350, 236], [232, 112]], LL: P[] = [[150, 112], [232, 112], [150, 236]], RR: P[] = [[232, 112], [350, 112], [350, 236]];
const triPic = (b: number, h: number) => {
  const W = 46 * b, H = 40 * h, x0 = 300 - W / 2, y1 = 172 + H / 2, apex = x0 + W * 0.35;
  return board({ dots: [tile('t', [[x0, y1], [x0 + W, y1], [apex, y1 - H]], 'a', 'teal')], tags: [tag('b', 300, y1 + 34, `base ${b}`, 'b', 26), tag('h', apex + 16, y1 - H / 2, `height ${h}`, 'a', 24)] });
};

// ---------- 5. layers of cubes ----------
const FX = [52, 308], FY = 128, FC = 48;
const cubeAt = (i: number, frame: number) => ({ x: FX[frame] + (i % 5) * FC + FC / 2, y: FY + Math.floor(i / 5) * FC + FC / 2 });
const layer = (prefix: string, frame: number, c: Hue): Dot[] => Array.from({ length: 10 }, (_, i) => ({ id: `${prefix}${i}`, ...cubeAt(i, frame), c, d: i * 0.05 }));
const FRAMES = [{ id: 'f0', x: FX[0], y: FY }, { id: 'f1', x: FX[1], y: FY }];
const grid = (cols: number, rows: number, c: Hue): Dot[] => Array.from({ length: cols * rows }, (_, i) => ({ id: `g${i}`, x: 300 + ((i % cols) - (cols - 1) / 2) * 50, y: 172 + (Math.floor(i / cols) - (rows - 1) / 2) * 50, c }));

// ---------- 6. angles in a triangle ----------
const A: P = [170, 205], B: P = [430, 205], C: P = [276, 21], K = 0.34;
const along = (p: P, q: P, k = K): P => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
const PA: P[] = [A, along(A, B), along(A, C)], PB: P[] = [B, along(B, C), along(B, A)], PC: P[] = [C, along(C, A), along(C, B)];
const MID: P[] = [along(A, B), along(B, A), along(B, C), along(C, B), along(C, A), along(A, C)];
const LINE: P[] = [[70, 302], [530, 302], [530, 310], [70, 310]], PT: P = [300, 302];
/** the table is drawn a little deeper than the picture (episodeScene's DEPTH): a turn happens on the table,
 *  so a turned tile's corner is worked out there and brought back */
const DEPTH = 1.15;
const spinOnTable = ([x, y]: P, deg: number): P => { const [a, b] = spin([x, y * DEPTH], deg); return [a, b / DEPTH]; };
/** a corner piece turned `rot` and slid so its point sits on the line's middle */
function onLine(id: string, pts: P[], c: Hue, tint: Tint, rot: number): Dot {
  const [cx, cy] = centre(pts), v = spinOnTable([pts[0][0] - cx, pts[0][1] - cy], rot);
  const at: P = [PT[0] - v[0], PT[1] - v[1]];
  return { ...tile(id, pts, c, tint), x: at[0], y: at[1], rot };
}
const corners = (a: Dot, b: Dot, c: Dot, tags: Tag[] = []) => board({ dots: [tile('line', LINE, 'a', 'pale', { h: 3 }), tile('mid', MID, 'a', 'pale'), a, b, c], tags });
const tagAt = (id: string, d: Dot, text: string, c: Tag['c']) => tag(id, d.x, d.y + 10, text, c, 24);
const CA = tile('ca', PA, 'a', 'violet'), CB = tile('cb', PB, 'b'), CC = tile('cc', PC, 'c');
const LA = onLine('ca', PA, 'a', 'violet', 120), LB = onLine('cb', PB, 'b', undefined, -130), LC = onLine('cc', PC, 'c', undefined, 170);
const triAngles = (a: string, b: string, c: string) => board({ dots: [tile('t', [[170, 250], [430, 250], [276, 66]], 'a', 'sky')], tags: [tag('a', 214, 236, a, 'ink', 26), tag('b', 386, 236, b, 'ink', 26), tag('c', 277, 108, c, 'c', 28)] });

// ---------- 7. squares on the sides ----------
const U = 26, R0: P = [240, 228], TOP: P = [240, 228 - 3 * U], END: P = [240 + 4 * U, 228];
const cellsIn = (o: P, ex: P, ey: P, n: number): P[] => Array.from({ length: n * n }, (_, k) => { const i = k % n, j = Math.floor(k / n); return [o[0] + ((i + 0.5) / n) * ex[0] + ((j + 0.5) / n) * ey[0], o[1] + ((i + 0.5) / n) * ex[1] + ((j + 0.5) / n) * ey[1]] as P; });
const SMALL = cellsIn([240 - 3 * U, TOP[1]], [3 * U, 0], [0, 3 * U], 3), MEDIUM = cellsIn([240, 228], [4 * U, 0], [0, 4 * U], 4);
const HYP: P = [END[0] - TOP[0], END[1] - TOP[1]], NRM: P = [HYP[1], -HYP[0]];
const BIG = cellsIn(TOP, HYP, NRM, 5), TILT = (Math.atan2(HYP[1] * DEPTH, HYP[0]) * -180) / Math.PI;
const cell = (s: number): P[] => [[-s / 2, -s / 2], [s / 2, -s / 2], [s / 2, s / 2], [-s / 2, s / 2]];
const cellDot = (id: string, at: P, c: Hue, tint: Tint, rot = 0): Dot => ({ id, x: at[0], y: at[1], c, rot, shape: { k: 'tile', pts: cell(U - 3), tint, h: 6 } });
const OUTLINE: P[] = [TOP, END, [END[0] + NRM[0], END[1] + NRM[1]], [TOP[0] + NRM[0], TOP[1] + NRM[1]]];
function pyth(smallIn: boolean, mediumIn: boolean, tags: Tag[] = []): Board {
  return board({ dots: [
    tile('rt', [R0, TOP, END], 'a', 'sky'), tile('big', OUTLINE, 'a', 'pale', { h: 1.5 }),
    ...SMALL.map((p, i) => cellDot(`s${i}`, smallIn ? BIG[i] : p, 'a', 'violet', smallIn ? TILT : 0)),
    ...MEDIUM.map((p, i) => cellDot(`m${i}`, mediumIn ? BIG[9 + i] : p, 'b', undefined, mediumIn ? TILT : 0)),
  ], tags });
}
const pythPic = (a: string, b: string, c: string) => board({ dots: [tile('rt', [[220, 250], [220, 250 - 120], [220 + 160, 250]], 'a', 'sky')], tags: [tag('a', 190, 196, a, 'ink', 28), tag('b', 300, 284, b, 'ink', 28), tag('c', 318, 172, c, c === '?' ? 'c' : 'ink', 28)] });

export const SHAPE_LESSONS: FracLesson[] = [
  {
    id: 'sh-sides', title: 'Sides and Corners', blurb: 'Touch each corner as you count. A shape has as many sides as corners.', set: 'peaks', skill: 'sh-sides', art: 'learn/shapes/card-sides.webp',
    steps: [
      { say: '', board: threeShapes([]), eq: 'Every shape has sides and corners' },
      { say: '', board: threeShapes(cornerTags('t', TRI)), eq: '[3] corners: a triangle' },
      { say: '', board: threeShapes([...cornerTags('t', TRI), ...cornerTags('s', SQ)]), eq: '[4] corners: a square' },
      { say: '', board: threeShapes([...cornerTags('t', TRI), ...cornerTags('s', SQ), ...cornerTags('h', HEX)]), eq: '[6] corners: a hexagon' },
      { say: '', board: threeShapes([tag('n3', 150, 250, '3 sides', 'a', 26), tag('n4', 300, 250, '4 sides', 'a', 26), tag('n6', 455, 250, '6 sides', 'a', 26)]), eq: 'as many sides as [corners]', do: 'watch' },
    ],
    tries: [
      Q('How many corners?', '5', 'num', 'Touch one corner and go round: 1, 2, 3, 4, 5.', 'Touch one corner and go round, counting each one once.', one('p', PENT, 'violet')),
      Q('How many sides?', '8', 'num', 'Count the sides round once: 8. It\'s an octagon.', 'Count each side once, all the way round.', one('o', OCT, 'teal')),
      Q('How many corners?', '7', 'num', 'Round once: 7 corners, even the ones that point in.', 'Go round once. Count the corners that point in too.', one('w', ARROW, 'sky')),
    ],
    teach: { q: Q('How many corners?', '5', 'num', 'Start at one corner and stop when you get back to it: 5.', '', one('q', poly(5, 105, 300, 172, 36), 'rose')), wrong: '6', says: '1, 2, 3, 4, 5, 6! I went all the way round. 6 corners!', decoy: '4', fixed: "Oops! I counted the first corner twice. I should stop when I get back to the start. It's 5 corners! Thank you!" },
  },
  {
    id: 'sh-halves', title: 'Equal Parts', blurb: 'Halves, thirds and quarters: every part exactly the same size.', set: 'peaks', skill: 'sh-parts', art: 'learn/shapes/card-halves.webp',
    steps: [
      { say: '', board: board({ plates: [PLATE], dots: BAR2.map((p, i) => tile(`h${i}`, p, i ? 'c' : 'a', 'teal')) }), eq: 'one crystal bar to share' },
      { say: '', board: board({ plates: [PLATE], dots: [tile('h0', BAR2[0], 'a', 'teal'), tile('h1', BAR2[1], 'c', 'teal', { dx: 465 - 375, dy: 0 })] }), eq: '2 equal parts: each is [one half]' },
      { say: '', board: board({ plates: [PLATE], dots: [0, 1, 2, 3].map(i => tile(`q${i}`, quarter(i % 2, Math.floor(i / 2)), i === 1 ? 'c' : 'a', 'violet')) }), eq: '4 equal parts', do: 'watch' },
      { say: '', board: board({ plates: [PLATE], dots: [0, 1, 2, 3].map(i => { const q = quarter(i % 2, Math.floor(i / 2)), [cx, cy] = centre(q); return tile(`q${i}`, q, i === 1 ? 'c' : 'a', 'violet', i === 1 ? { dx: 465 - cx, dy: 172 - cy } : {}); }) }), eq: 'each one is [one quarter]: 1/4' },
      { say: '', board: board({ plates: [PLATE], dots: strips([22, 30, 40, 56]).map((p, i) => tile(`u${i}`, p, 'b', undefined)), tags: [tag('no', 200, 284, 'not the same size', 'b', 26)] }), eq: 'quarters must be [the same size]', do: 'watch' },
    ],
    tries: [
      Q('What fraction is gold?', '1/3', 'frac', 'The hexagon is cut into 3 equal parts. 1 is gold: 1/3.', 'Count ALL the equal parts for the bottom.', cutPic(HEX3, [0], 'sky')),
      Q('What fraction is gold?', '1/4', 'frac', '4 equal triangles, 1 gold: 1/4.', 'Count ALL the equal parts for the bottom.', cutPic(TRI4, [3], 'violet')),
      Q('What fraction is gold?', '2/4', 'frac', '4 equal parts, 2 gold: 2/4 (that\'s a half).', 'Count ALL the equal parts for the bottom, the gold ones for the top.', cutPic(DIAG4, [0, 2], 'teal')),
    ],
    teach: { q: Q('What fraction is gold?', '1/4', 'frac', '4 equal parts, 1 gold: 1/4.', '', cutPic(DIAG4, [1], 'teal')), wrong: '1/3', says: "1 gold piece, and 3 that aren't. So it's 1/3!", decoy: '1/2', fixed: "Oh, I see! The bottom counts all 4 equal parts. 1 is gold, so it's 1/4. Thank you!" },
  },
  {
    id: 'sh-angles', title: 'Right, Acute, Obtuse', blurb: 'Fit a square corner in: just right is a right angle, smaller is acute, wider is obtuse.', set: 'peaks', skill: 'sh-angle', art: 'learn/shapes/card-angles.webp',
    steps: [
      { say: '', board: angles(CARD_HOME), eq: 'Which corner is the widest?' },
      { say: '', board: angles(VB), eq: 'It fits exactly: a [right angle], 90°' },
      { say: '', board: angles(VA), eq: 'Smaller than a square corner: [acute]' },
      { say: '', board: angles(VC), eq: 'Wider than a square corner: [obtuse]' },
      { say: '', board: angles(CARD_HOME, [tag('ka', 118, 290, 'acute', 'a', 28), tag('kb', 292, 290, 'right', 'c', 28), tag('kc', 470, 290, 'obtuse', 'b', 28)]), eq: 'acute · [right] · obtuse', do: 'watch' },
    ],
    tries: [
      Q('How many right angles?', '4', 'num', 'Every corner of a rectangle is a square corner: 4 right angles.', 'Try a square corner in each corner.', one('r', RECT, 'teal')),
      Q('How many acute angles?', '2', 'num', 'One corner is square; the other two are smaller: 2 acute angles.', 'Which corners are smaller than a square corner?', one('t', RTRI, 'violet')),
      Q('How many right angles?', '2', 'num', 'The two corners on the left are square: 2 right angles.', 'Try a square corner in each corner.', one('z', RTRAP, 'sky')),
    ],
    teach: { q: Q('How many right angles?', '4', 'num', 'Every corner of a square is a right angle, even turned: 4.', '', one('d', DIAMOND, 'rose')), wrong: '0', says: "It's standing on its point, so its corners aren't square any more. It has 0!", decoy: '2', fixed: "Oh, I see! Turning a shape doesn't change its corners. A square always has 4 right angles. Thank you!" },
  },
  {
    id: 'sh-tri-area', title: 'Half a Rectangle', blurb: 'A triangle is half of a rectangle: base × height ÷ 2.', set: 'peaks', skill: 'sh-area', art: 'learn/shapes/card-area.webp',
    steps: [
      { say: '', board: board({ dots: [tile('t1', T1, 'a', 'teal'), tile('t2', T2, 'c')], tags: [tag('b', 300, 262, 'base 4', 'b', 26), tag('h', 140, 175, 'height 3', 'a', 26)] }), eq: 'a rectangle: 4 × 3 = [12] squares' },
      { say: '', board: board({ dots: [tile('t1', T1, 'a', 'teal'), tile('t2', T2, 'c', undefined, { dx: 150 })], tags: [tag('b', 300, 262, 'base 4', 'b', 26), tag('h', 140, 175, 'height 3', 'a', 26)] }), eq: 'cut corner to corner: [2 equal] triangles' },
      { say: '', board: board({ dots: [tile('t1', T1, 'a', 'teal'), tile('t2', T2, 'c', undefined, { dx: 150 })], tags: [tag('x1', 252, 200, '6', 'ink', 32), tag('x2', 486, 152, '6', 'ink', 32)] }), eq: 'each is half: 12 ÷ 2 = [6]', do: 'watch' },
      { say: '', board: board({ dots: [tile('g', G, 'c'), tile('l', LL, 'b'), tile('r', RR, 'b')] }), eq: 'any triangle fits in a rectangle', do: 'watch' },
      { say: '', board: board({ dots: [tile('g', G, 'c'), tile('l', LL, 'b', undefined, { dx: 200 }), tile('r', RR, 'b')] }), eq: 'the two pink corners make [the same triangle]' },
      { say: '', board: board({ dots: [tile('g', G, 'c'), tile('l', LL, 'b', undefined, { dx: 200 }), tile('r', RR, 'b')], tags: [tag('f', 300, 290, 'area = base × height ÷ 2', 'c', 26)] }), eq: 'triangle = [base × height ÷ 2]', do: 'watch' },
    ],
    tries: [
      Q('What is the area of the triangle?', '10', 'num', '5 × 4 = 20, and half of it is 10.', 'Base × height, then halve it.', triPic(5, 4)),
      Q('What is the area of the triangle?', '9', 'num', '6 × 3 = 18, and half of it is 9.', 'Base × height, then halve it.', triPic(6, 3)),
      Q('What is the area of the triangle?', '20', 'num', '8 × 5 = 40, and half of it is 20.', 'Base × height, then halve it.', triPic(8, 5)),
    ],
    teach: { q: Q('What is the area of the triangle?', '12', 'num', '6 × 4 = 24, and half of it is 12.', '', triPic(6, 4)), wrong: '24', says: '6 × 4 is 24, so the triangle is 24!', decoy: '10', fixed: "Oops! That's the whole rectangle. The triangle is half of it. Half of 24 is 12! Thank you!" },
  },
  {
    id: 'sh-boxes', title: 'Layers of Cubes', blurb: 'Fill one layer, then count the layers: length × width × height.', set: 'peaks', skill: 'sh-volume', art: 'learn/shapes/card-boxes.webp',
    steps: [
      { say: '', board: board({ frames: FRAMES, tags: [tag('l', 172, 258, '5 long', 'a', 24), tag('w', 30, 176, '2', 'a', 24)] }), eq: 'an empty box, 5 long and 2 wide' },
      { say: '', board: board({ frames: FRAMES, dots: layer('a', 0, 'a') }), eq: 'one layer: 5 × 2 = [10] cubes' },
      { say: '', board: board({ frames: FRAMES, dots: [...layer('a', 0, 'a'), ...layer('b', 1, 'b')] }), eq: 'two layers: 10 + 10 = [20]' },
      { say: '', board: board({ frames: FRAMES, dots: [...layer('a', 0, 'a'), ...layer('b', 1, 'b')], tags: [tag('l1', 172, 258, 'layer 1', 'a', 26), tag('l2', 428, 258, 'layer 2', 'b', 26)] }), eq: 'volume = 5 × 2 × 2 = [20]', do: 'watch' },
    ],
    tries: [
      Q('A box has 3 layers like this. How many cubes?', '30', 'num', '10 in a layer, 3 layers: 10 × 3 = 30.', 'How many in one layer? Then times the layers.', board({ frames: [FRAMES[0]], dots: layer('a', 0, 'a'), tags: [tag('x', 450, 176, '× 3 layers', 'c', 30)] })),
      Q('4 long, 3 wide, 2 layers. How many cubes?', '24', 'num', '4 × 3 = 12 in a layer, 2 layers: 24.', 'Length × width for a layer, then times the layers.', board({ dots: grid(4, 3, 'a'), tags: [tag('x', 470, 176, '× 2 layers', 'c', 30)] })),
      Q('5 long, 2 wide, 4 layers. How many cubes?', '40', 'num', '5 × 2 = 10 in a layer, 4 layers: 40.', 'Length × width for a layer, then times the layers.', board({ frames: [FRAMES[0]], dots: layer('a', 0, 'a'), tags: [tag('x', 450, 176, '× 4 layers', 'c', 30)] })),
    ],
    teach: { q: Q('2 layers of 5 × 2. How many cubes?', '20', 'num', '10 in each layer, 2 layers: 20.', '', board({ frames: FRAMES, dots: [...layer('a', 0, 'a'), ...layer('b', 1, 'b')] })), wrong: '9', says: '5 + 2 + 2 makes 9 cubes!', decoy: '10', fixed: "Oops! It's times, not plus. 5 × 2 is 10 in a layer, and 2 layers make 20! Thank you!" },
  },
  {
    id: 'sh-tri-180', title: 'Angles in a Triangle', blurb: 'Tear off a triangle\'s three corners: they make a straight line, 180°.', set: 'peaks', skill: 'sh-anglefacts', art: 'learn/shapes/card-angles.webp',
    steps: [
      { say: '', board: corners(CA, CB, CC, [tagAt('na', CA, '60°', 'a'), tagAt('nb', CB, '50°', 'b'), tagAt('nc', CC, '70°', 'c')]), eq: 'a triangle\'s three corners' },
      { say: '', board: corners(CA, CB, LC, [tagAt('na', CA, '60°', 'a'), tagAt('nb', CB, '50°', 'b'), tagAt('nc', LC, '70°', 'c')]), eq: 'tear off a corner: [70°]' },
      { say: '', board: corners(LA, CB, LC, [tagAt('na', LA, '60°', 'a'), tagAt('nb', CB, '50°', 'b'), tagAt('nc', LC, '70°', 'c')]), eq: '70° + [60°]' },
      { say: '', board: corners(LA, LB, LC, [tagAt('na', LA, '60°', 'a'), tagAt('nb', LB, '50°', 'b'), tagAt('nc', LC, '70°', 'c')]), eq: '70° + 60° + [50°]' },
      { say: '', board: corners(LA, LB, LC, [tagAt('na', LA, '60°', 'a'), tagAt('nb', LB, '50°', 'b'), tagAt('nc', LC, '70°', 'c'), tag('all', 300, 330, 'a straight line: 180°', 'c', 26)]), eq: '60° + 50° + 70° = [180°]', do: 'watch' },
    ],
    tries: [
      Q('Two angles are 50° and 60°. What is the third?', '70', 'num', '50 + 60 = 110, and 180 − 110 = 70.', 'Add the two, then take that from 180.', triAngles('50°', '60°', '?')),
      Q('Two angles are 90° and 35°. What is the third?', '55', 'num', '90 + 35 = 125, and 180 − 125 = 55.', 'Add the two, then take that from 180.', triAngles('90°', '35°', '?')),
      Q('Two angles are 40° and 40°. What is the third?', '100', 'num', '40 + 40 = 80, and 180 − 80 = 100.', 'Add the two, then take that from 180.', triAngles('40°', '40°', '?')),
    ],
    teach: { q: Q('Two angles are 80° and 60°. What is the third?', '40', 'num', '80 + 60 = 140, and 180 − 140 = 40.', '', triAngles('80°', '60°', '?')), wrong: '140', says: '80 + 60 is 140, so the third one is 140!', decoy: '220', fixed: 'Oops! All three angles make 180 together. 180 take away 140 is 40! Thank you!' },
  },
  {
    id: 'sh-pyth', title: 'Squares on the Sides', blurb: 'The squares on the two short sides of a right triangle fill the square on the long side.', set: 'peaks', skill: 'sh-pyth', art: 'learn/shapes/card-pyth.webp',
    steps: [
      { say: '', board: pyth(false, false, [tag('a', 202, 194, '3', 'a', 30), tag('b', 292, 268, '4', 'b', 30)]), eq: 'a right triangle, sides 3 and 4' },
      { say: '', board: pyth(true, false, [tag('b', 292, 268, '4', 'b', 30)]), eq: '3 × 3 = [9] little squares' },
      { say: '', board: pyth(true, true), eq: '9 + 4 × 4 = 9 + 16 = [25]' },
      { say: '', board: pyth(true, true, [tag('c', 370, 126, '25 = 5 × 5', 'c', 30)]), eq: '3² + 4² = [5²]: the long side is 5', do: 'watch' },
    ],
    tries: [
      Q('The short sides are 6 and 8. How long is the long side?', '10', 'num', '36 + 64 = 100, and 10 × 10 = 100.', 'Square each short side and add. What number times itself makes that?', pythPic('6', '8', '?')),
      Q('The short sides are 5 and 12. How long is the long side?', '13', 'num', '25 + 144 = 169, and 13 × 13 = 169.', 'Square each short side and add. What number times itself makes that?', pythPic('5', '12', '?')),
      Q('The short sides are 8 and 15. How long is the long side?', '17', 'num', '64 + 225 = 289, and 17 × 17 = 289.', 'Square each short side and add. What number times itself makes that?', pythPic('8', '15', '?')),
    ],
    teach: { q: Q('The short sides are 3 and 4. How long is the long side?', '5', 'num', '9 + 16 = 25, and 5 × 5 = 25.', '', pythPic('3', '4', '?')), wrong: '7', says: '3 + 4 is 7, so the long side is 7!', decoy: '25', fixed: "Oops! Add the squares, not the sides. 9 + 16 is 25, and 5 × 5 is 25. It's 5! Thank you!" },
  },
];
export const SHAPE_LESSON: Record<string, FracLesson> = Object.fromEntries(SHAPE_LESSONS.map(l => [l.id, l]));
