// The expressions and equations Learn episodes: seven short stories in the Comet Cat's workshop at the
// Star Lab, played in the shared episode (math/ui/Episode.svelte, three/episodeScene.ts). The things on
// the table are real: brass weights and violet mystery boxes ('weight' and 'box' counters), brass pans,
// and for equations a golden balance standing between two pans (a board's `beam`). The kid's hands do
// the trick: take the same weights off both pans so it stays level, share what's left between the
// boxes, fill the groups before adding, open the boxes, gather boxes with boxes, build the next in a
// pattern, and hop along the numbers that make an inequality true. Then the buddy has a go and gets it
// wrong, two of your own, and the trick's card. The coach's lines are in content/voice.ts (the same words).
import type { Board, Dot, Hue, Step, Tag } from '../learn';
import type { EpQ, FracLesson } from '../fracEpisodes';

export type AlgLesson = FracLesson & { /** what the counters are called in the prompts */ noun?: string };

const board = (b: Partial<Board>): Board => ({ cell: 48, dots: [], frames: [], plates: [], line: null, tags: [], ...b });
const tag = (id: string, x: number, y: number, text: string, c: Tag['c'] = 'ink', size = 28): Tag => ({ id, x, y, text, c, size });
const Q = (text: string, ans: string, hint: string, hidden: string, pic: Board): EpQ => ({ text, ans, input: 'num', hint, hidden, pic });
type P = { x: number; y: number };

// ---------- the balance: two brass pans and the golden beam between them ----------
const LP: P = { x: 165, y: 180 }, RP: P = { x: 435, y: 180 }, PR = 102;
/** where counter i of a pan sits: boxes in the back row, weights in rows of four in front. Spots are fixed
 *  by the number there were at first (`cap`), so taking some away leaves the rest where they are. */
function spot(c: P, i: number, cap: number, back: boolean, boxes: number): P {
  if (back) { const w = 50; return { x: c.x + (i - (boxes - 1) / 2) * w, y: c.y - 38 }; }
  const per = 4, cell = 36, rows = Math.ceil(cap / per), row = Math.floor(i / per), inRow = Math.min(per, cap - row * per);
  const top = boxes ? c.y + 4 : c.y - ((rows - 1) * cell) / 2;
  return { x: c.x + ((i % per) - (inRow - 1) / 2) * cell, y: top + row * cell };
}
/** a pan's counters: `boxes` mystery boxes and weights (`keep` of the `cap` there were, the first ones) */
function pan(prefix: string, c: P, boxes: number, cap: number, keep = cap, hue: Hue = 'a', boxHue: Hue = 'b'): Dot[] {
  const out: Dot[] = [];
  for (let i = 0; i < boxes; i++) out.push({ id: `${prefix}x${i}`, ...spot(c, i, boxes, true, boxes), c: boxHue, d: i * 0.05, shape: { k: 'box' } });
  for (let i = 0; i < keep; i++) out.push({ id: `${prefix}w${i}`, ...spot(c, i, cap, false, boxes), c: hue, d: 0.1 + i * 0.04, shape: { k: 'weight' } });
  return out;
}
/** the letters on the boxes (words pinned on them) */
const boxTags = (dots: Dot[], text: string, c: Tag['c'] = 'b') => dots.filter(d => d.shape?.k === 'box').map(d => tag(`t-${d.id}`, d.x, d.y + 4, text, c, 30));
/** a balance: boxes and `l` weights on the left, `r` on the right (keeping `kl` and `kr` of them) */
function balance(boxes: number, l: number, r: number, letter = '?', o: { kl?: number; kr?: number; extra?: Tag[] } = {}): Board {
  const dots = [...pan('l', LP, boxes, l, o.kl ?? l), ...pan('r', RP, 0, r, o.kr ?? r)];
  return board({ cell: 40, plates: [{ id: 'pl', x: LP.x, y: LP.y, r: PR }, { id: 'pr', x: RP.x, y: RP.y, r: PR }], beam: { a: 'pl', b: 'pr' }, dots, tags: [...boxTags(dots, letter), ...(o.extra ?? [])] });
}

// ---------- groups on plates (times first, letters, sharing out) ----------
/** weights round a plate's middle: up to 3 a row */
function onPlate(prefix: string, c: P, n: number, from = 0, hue: Hue = 'a', per = 3, cell = 34): Dot[] {
  const rows = Math.ceil(n / per);
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / per), inRow = Math.min(per, n - row * per);
    return { id: `${prefix}${from + i}`, x: c.x + ((i % per) - (inRow - 1) / 2) * cell, y: c.y + (row - (rows - 1) / 2) * cell, c: hue, d: i * 0.05, shape: { k: 'weight' } as const };
  });
}
const plate = (id: string, c: P, r: number, empty = false) => ({ id, x: c.x, y: c.y, r, empty });

// ---------- a number line (inequalities) ----------
const line = (at: number, hops: { a: number; b: number; label: string }[] = []) => ({ from: 0, to: 10, at, hops });
/** a word over a number on the line (the line runs from x 44 to 556 at y 236) */
const overLine = (id: string, n: number, text: string, c: Tag['c'] = 'ink', size = 24) => tag(id, 44 + (n / 10) * 512, 176, text, c, size);

// ---------- the lessons ----------
// 1 keep it level (□ + 3 = 8)
const ep1 = [
  balance(1, 3, 8, '?'),
  balance(1, 3, 8, '?', { kl: 0, kr: 5 }),
  balance(1, 3, 8, '5', { kl: 0, kr: 5 }),
];
// 2 two steps (2x + 1 = 7): take 1 off both, then share 6 between the two boxes
const share2 = (): Board => {
  const b = balance(2, 1, 7, 'x', { kl: 0, kr: 6 });
  // (low enough to clear the right pan: they sat in its rim)
  const A = { x: 360, y: 336 }, B = { x: 510, y: 336 };
  // the six weights left on the right go three to each little plate, one plate for each box
  const dots = b.dots.map(d => { if (!d.id.startsWith('rw')) return d; const i = Number(d.id.slice(2)); const c = i < 3 ? A : B, k = i % 3; return { ...d, x: c.x + (k - 1) * 34, y: c.y, c: 'c' as Hue }; });
  return { ...b, plates: [...b.plates, plate('ga', A, 62), plate('gb', B, 62)], dots, tags: [...boxTags(dots, 'x'), tag('ga-t', A.x, A.y + 58, '3', 'c', 26), tag('gb-t', B.x, B.y + 58, '3', 'c', 26)] };
};
const ep2 = [balance(2, 1, 7, 'x'), balance(2, 1, 7, 'x', { kl: 0, kr: 6 }), share2()];
// 3 times comes first (3 + 2 × 4)
const G1 = { x: 330, y: 175 }, G2 = { x: 480, y: 175 }, LOOSE = { x: 125, y: 175 };
const loose = onPlate('m', LOOSE, 3, 0, 'b', 3, 40);
const ep3 = [
  board({ cell: 40, plates: [plate('g1', G1, 70, true), plate('g2', G2, 70, true)], dots: loose, tags: [tag('lt', LOOSE.x, 245, '3', 'b'), tag('g1t', G1.x, 262, '4', 'ink'), tag('g2t', G2.x, 262, '4', 'ink'), tag('xt', 405, 80, '2 groups of 4', 'c', 24)] }),
  board({ cell: 40, plates: [plate('g1', G1, 70), plate('g2', G2, 70)], dots: [...loose, ...onPlate('g', G1, 4, 0, 'c', 2, 36), ...onPlate('g', G2, 4, 4, 'c', 2, 36)], tags: [tag('lt', LOOSE.x, 245, '3', 'b'), tag('g1t', G1.x, 262, '4', 'ink'), tag('g2t', G2.x, 262, '4', 'ink'), tag('xt', 405, 80, '2 × 4 = 8', 'c', 26)] }),
  board({ cell: 40, plates: [plate('g1', G1, 70), plate('g2', G2, 70)], dots: [...loose, ...onPlate('g', G1, 4, 0, 'c', 2, 36), ...onPlate('g', G2, 4, 4, 'c', 2, 36)], tags: [tag('lt', LOOSE.x, 245, '3', 'b'), tag('xt', 405, 80, '8', 'c', 30), tag('sum', 300, 300, '3 + 8 = 11', 'ink', 30)] }),
];
// 4 letters are boxes (3n when n = 4)
const PL3 = [{ x: 130, y: 170 }, { x: 300, y: 170 }, { x: 470, y: 170 }];
const boxesOn = (hue: Hue) => PL3.map((c, i): Dot => ({ id: `n${i}`, x: c.x, y: c.y - 6, c: hue, d: i * 0.12, shape: { k: 'box' } }));
const fourAround = (i: number): Dot[] => [[-34, -30], [34, -30], [-34, 34], [34, 34]].map(([dx, dy], k) => ({ id: `f${i}-${k}`, x: PL3[i].x + dx, y: PL3[i].y + dy, c: 'c', d: k * 0.06, shape: { k: 'weight' } }));
const ep4 = [
  board({ cell: 40, plates: PL3.map((c, i) => plate(`p${i}`, c, 74)), dots: boxesOn('b'), tags: [...PL3.map((c, i) => tag(`nt${i}`, c.x, c.y - 2, 'n', 'b', 30)), tag('say', 300, 290, '3n = 3 × n', 'ink', 28)] }),
  board({ cell: 40, plates: PL3.map((c, i) => plate(`p${i}`, c, 74)), dots: boxesOn('c'), tags: [...PL3.map((c, i) => tag(`nt${i}`, c.x, c.y - 2, '4', 'c', 30)), tag('say', 300, 290, 'n = 4', 'ink', 28)] }),
  board({ cell: 40, plates: PL3.map((c, i) => plate(`p${i}`, c, 74)), dots: [...boxesOn('c'), ...fourAround(0), ...fourAround(1), ...fourAround(2)], tags: [...PL3.map((c, i) => tag(`nt${i}`, c.x, c.y - 2, '4', 'c', 30)), tag('say', 300, 290, '3 × 4 = 12', 'ink', 28)] }),
];
// 5 share it out (3(x + 2) = 3x + 6): three groups of a box and 2 weights; gather boxes with boxes
const PG = [{ x: 130, y: 165 }, { x: 300, y: 165 }, { x: 470, y: 165 }];
const groups3 = (): Dot[] => PG.flatMap((c, i): Dot[] => [
  { id: `x${i}`, x: c.x - 26, y: c.y, c: 'b', d: i * 0.1, shape: { k: 'box' } },
  { id: `w${i}a`, x: c.x + 26, y: c.y - 20, c: 'a', d: i * 0.1 + 0.05, shape: { k: 'weight' } },
  { id: `w${i}b`, x: c.x + 26, y: c.y + 20, c: 'a', d: i * 0.1 + 0.08, shape: { k: 'weight' } },
]);
const PX = { x: 175, y: 175 }, PN = { x: 425, y: 175 };
const gathered = (): Dot[] => [
  ...[0, 1, 2].map((i): Dot => ({ id: `x${i}`, x: PX.x + (i - 1) * 50, y: PX.y, c: 'b', d: i * 0.08, shape: { k: 'box' } })),
  ...[0, 1, 2].flatMap((i): Dot[] => (['a', 'b'] as const).map((s, k) => ({ id: `w${i}${s}`, x: PN.x + (i - 1) * 38, y: PN.y + (k ? 20 : -20), c: 'c', d: 0.2 + i * 0.08, shape: { k: 'weight' } }))),
];
const ep5 = [
  board({ cell: 40, plates: PG.map((c, i) => plate(`g${i}`, c, 74)), dots: groups3(), tags: [...PG.map((c, i) => tag(`xt${i}`, c.x - 26, c.y + 4, 'x', 'b', 28)), tag('say', 300, 290, '3 groups of (x + 2)', 'ink', 26)] }),
  board({ cell: 40, plates: [plate('px', PX, 100), plate('pn', PN, 100)], dots: gathered(), tags: [...[0, 1, 2].map(i => tag(`xt${i}`, PX.x + (i - 1) * 50, PX.y + 4, 'x', 'b', 28)), tag('px-t', PX.x, 300, '3x', 'b', 30), tag('pn-t', PN.x, 300, '6', 'c', 30)] }),
  board({ cell: 40, plates: [plate('px', PX, 100), plate('pn', PN, 100)], dots: gathered(), tags: [...[0, 1, 2].map(i => tag(`xt${i}`, PX.x + (i - 1) * 50, PX.y + 4, 'x', 'b', 28)), tag('px-t', PX.x, 300, '3x', 'b', 30), tag('pn-t', PN.x, 300, '6', 'c', 30), tag('say', 300, 52, '3(x + 2) = 3x + 6', 'ink', 28)] }),
];
// 6 growing patterns (3, 5, 7, then 9)
const PP = [95, 235, 375, 515].map(x => ({ x, y: 165 }));
const towers = (n: number, last = 0) => [...[3, 5, 7].slice(0, n).flatMap((k, i) => onPlate(`t${i}-`, PP[i], k, 0, i === 2 ? 'c' : 'a')), ...onPlate('t3-', PP[3], last, 0, 'c')];
const nums = (show4: string) => [tag('n0', PP[0].x, 262, '3'), tag('n1', PP[1].x, 262, '5'), tag('n2', PP[2].x, 262, '7'), tag('n3', PP[3].x, 262, show4, show4 === '?' ? 'b' : 'c')];
const jumps = [tag('j0', 165, 72, '+2', 'c', 26), tag('j1', 305, 72, '+2', 'c', 26)];
const ep6 = [
  board({ cell: 40, plates: PP.map((c, i) => plate(`q${i}`, c, 64, i === 3)), dots: towers(3), tags: nums('?') }),
  board({ cell: 40, plates: PP.map((c, i) => plate(`q${i}`, c, 64, i === 3)), dots: towers(3), tags: [...nums('?'), ...jumps] }),
  board({ cell: 40, plates: PP.map((c, i) => plate(`q${i}`, c, 64)), dots: towers(3, 9), tags: [...nums('9'), ...jumps, tag('j2', 445, 72, '+2', 'c', 26)] }),
];
// 7 more than (x > 3): hop along the numbers that work; 3 itself doesn't
const ep7 = [
  board({ line: line(3), tags: [overLine('x3', 3, 'x > 3', 'b', 26)] }),
  board({ line: line(3, [{ a: 3, b: 4, label: '4 works' }, { a: 4, b: 5, label: '5 works' }, { a: 5, b: 6, label: '6 works' }]), tags: [overLine('x3', 3, 'x > 3', 'b', 26)] }),
  board({ line: line(3, [{ a: 3, b: 4, label: '4 works' }, { a: 4, b: 5, label: '5 works' }, { a: 5, b: 6, label: '6 works' }]), tags: [overLine('x3', 3, '3? No: open dot', 'b', 22)] }),
];

/** a step: what the coach says is in voice.ts (ep.<id>.s<n>); `eq` is the sum under it ([x] lit up) */
const S = (board: Board, eq: string, watch = false): Step => ({ say: '', board, eq, ...(watch ? { do: 'watch' as const } : {}) });
const ART = 'math/algebra/tile.webp';

export const ALG_LESSONS: AlgLesson[] = [
  {
    id: 'alg-balance', title: 'Keep It Level', blurb: 'A mystery box on a balance: take the same off both sides and it stays level.', set: 'lab', skill: 'al-one', art: ART, noun: 'weights',
    steps: [S(ep1[0], '□ + 3 = 8'), S(ep1[1], '□ + 3 − 3 = 8 − 3'), S(ep1[2], '□ = [5]')],
    tries: [
      Q('□ + 2 = 6. What does the box weigh?', '4', 'Take 2 off both sides: the box balances 4.', 'Take the same off both sides. What does the box balance then?', balance(1, 2, 6)),
      Q('x + 5 = 9. What is x?', '4', 'Take 5 off both sides: x = 9 − 5 = 4.', 'Take 5 off both sides.', balance(1, 5, 9, 'x')),
      Q('x + 4 = 11. What is x?', '7', 'Take 4 off both sides: x = 11 − 4 = 7.', 'Take 4 off both sides.', balance(1, 4, 11, 'x')),
    ],
    teach: { q: Q('□ + 2 = 7. What does the box weigh?', '5', 'Take 2 off both sides: 7 − 2 = 5.', '', balance(1, 2, 7)), wrong: '9', says: 'The box and 2 weigh 7, so the box weighs 9!', decoy: '2', fixed: 'Oh, I see! Take the 2 off both sides. 7 take away 2 is 5. The box weighs 5! Thank you!' },
  },
  {
    id: 'alg-two-step', title: 'Two Steps', blurb: 'Two boxes and a weight: take off the weight, then share what\'s left between the boxes.', set: 'lab', skill: 'al-two', art: ART, noun: 'weights',
    steps: [S(ep2[0], '2x + 1 = 7'), S(ep2[1], '2x = [6]'), S(ep2[2], 'x = 6 ÷ 2 = [3]')],
    tries: [
      Q('2x + 3 = 11. What is x?', '4', 'Take 3 off both sides: 2x = 8. Share by 2: x = 4.', 'Take 3 off both sides first, then share between the 2 boxes.', balance(2, 3, 11, 'x')),
      Q('3x + 1 = 10. What is x?', '3', 'Take 1 off both sides: 3x = 9. Share by 3: x = 3.', 'Take 1 off, then share between the 3 boxes.', balance(3, 1, 10, 'x')),
      Q('2x + 5 = 13. What is x?', '4', 'Take 5 off both sides: 2x = 8. Share by 2: x = 4.', 'Take 5 off, then share between the 2 boxes.', balance(2, 5, 13, 'x')),
    ],
    teach: { q: Q('2x + 4 = 10. What is x?', '3', 'Take 4 off: 2x = 6. Then share by 2: x = 3.', '', balance(2, 4, 10, 'x')), wrong: '6', says: 'I take 4 off both sides. 2x = 6. So x is 6!', decoy: '7', fixed: 'Oh, I see! Two boxes weigh 6, so I share it between them. Each box is 3! Thank you!' },
  },
  {
    id: 'alg-order', title: 'Times Comes First', blurb: 'In 3 + 2 × 4, make the groups first, then add.', set: 'lab', skill: 'al-order', art: ART, noun: 'weights',
    steps: [S(ep3[0], '3 + 2 × 4'), S(ep3[1], '2 × 4 = [8]'), S(ep3[2], '3 + 8 = [11]', true)],
    tries: [
      Q('5 + 3 × 2 = ?', '11', 'Times first: 3 × 2 = 6. Then 5 + 6 = 11.', 'Do the times first.', ep3[2]),
      Q('2 + 4 × 3 = ?', '14', 'Times first: 4 × 3 = 12. Then 2 + 12 = 14.', 'Do the times first.', ep3[2]),
      Q('10 − 2 × 3 = ?', '4', 'Times first: 2 × 3 = 6. Then 10 − 6 = 4.', 'Do the times first.', ep3[2]),
    ],
    teach: { q: Q('4 + 2 × 3 = ?', '10', 'Times first: 2 × 3 = 6, then 4 + 6 = 10.', '', ep3[2]), wrong: '18', says: '4 + 2 is 6, and 6 times 3 is 18!', decoy: '9', fixed: 'Oops! Times comes first. 2 × 3 is 6, then 4 + 6 is 10! Thank you!' },
  },
  {
    id: 'alg-letters', title: 'Letters Are Boxes', blurb: 'A letter is a box with a number inside: 3n is three boxes of n.', set: 'lab', skill: 'al-eval', art: ART, noun: 'weights',
    steps: [S(ep4[0], '3n means 3 × n', true), S(ep4[1], 'n = [4]'), S(ep4[2], '3 × 4 = [12]')],
    tries: [
      Q('2n + 1, with n = 3. What is it?', '7', '2n is 2 × 3 = 6. Then 6 + 1 = 7.', 'Put 3 in each box: 2n is 2 × 3.', ep4[2]),
      Q('4n, with n = 5. What is it?', '20', '4n is 4 × 5 = 20.', '4n means 4 × n.', ep4[2]),
      Q('n + 6, with n = 7. What is it?', '13', '7 + 6 = 13.', 'Put 7 where the n is.', ep4[2]),
    ],
    teach: { q: Q('3n, with n = 5. What is it?', '15', '3n means 3 × n: 3 × 5 = 15.', '', ep4[2]), wrong: '35', says: "3n, when n is 5? A 3 and a 5. So it's 35!", decoy: '8', fixed: 'Oh, I see! 3n means 3 times n. Three boxes of 5 make 15! Thank you!' },
  },
  {
    id: 'alg-gather', title: 'Share It Out', blurb: '3(x + 2): three groups of a box and two weights. Gather them: 3x + 6.', set: 'lab', skill: 'al-equal', art: ART, noun: 'boxes and weights',
    steps: [S(ep5[0], '3(x + 2)', true), S(ep5[1], '3x + [6]'), S(ep5[2], '3(x + 2) = [3x + 6]', true)],
    tries: [
      Q('2(x + 3) = 2x + ?', '6', 'Two groups of 3 weights: 2 × 3 = 6.', 'Times the number inside by the number outside.', ep5[2]),
      Q('4(x + 1) = 4x + ?', '4', 'Four groups of 1 weight: 4 × 1 = 4.', 'Times the number inside by the number outside.', ep5[2]),
      Q('3(x + 5) = 3x + ?', '15', 'Three groups of 5: 3 × 5 = 15.', 'Times the number inside by the number outside.', ep5[2]),
    ],
    teach: { q: Q('2(x + 4) = 2x + ?', '8', 'The 2 times everything inside: 2 × 4 = 8.', '', ep5[2]), wrong: '4', says: '2(x + 4)? That\'s 2x + 4!', decoy: '6', fixed: "Oh, I see! The 2 times everything inside. 2 × x and 2 × 4. That's 2x + 8! Thank you!" },
  },
  {
    id: 'alg-pattern', title: 'Growing Patterns', blurb: 'Find the jump from one to the next, then keep going.', set: 'lab', skill: 'al-pattern', art: ART, noun: 'weights',
    steps: [S(ep6[0], '3, 5, 7, ...', true), S(ep6[1], 'the jump is [+2]'), S(ep6[2], '7 + 2 = [9]')],
    tries: [
      Q('4, 7, 10, 13, ... What comes next?', '16', 'The jump is +3: 13 + 3 = 16.', 'What is the jump each time?', ep6[2]),
      Q('2, 6, 10, 14, ... What comes next?', '18', 'The jump is +4: 14 + 4 = 18.', 'What is the jump each time?', ep6[2]),
      Q('5, 8, 11, ... What comes next?', '14', 'The jump is +3: 11 + 3 = 14.', 'What is the jump each time?', ep6[2]),
    ],
    teach: { q: Q('1, 4, 7, 10, ... What comes next?', '13', 'The jump is +3 every time: 10 + 3 = 13.', '', ep6[2]), wrong: '11', says: '1, 4, 7, 10, and next comes 11!', decoy: '14', fixed: 'Oh, I see! The jump is 3 every time, not 1. 10 + 3 is 13! Thank you!' },
  },
  {
    id: 'alg-ineq', title: 'More Than', blurb: 'x > 3: every number bigger than 3 works, but not 3 itself.', set: 'lab', skill: 'al-ineq', art: ART, noun: 'numbers',
    steps: [S(ep7[0], 'x > 3', true), S(ep7[1], '4, 5, 6... [all work!]'), S(ep7[2], '3 doesn\'t: an [open dot]', true)],
    tries: [
      Q('x > 6. The smallest whole number that works?', '7', '6 doesn\'t work (it isn\'t more than 6), so the first one is 7.', 'Does 6 itself work?', board({ line: line(6), tags: [overLine('t', 6, 'x > 6', 'b', 26)] })),
      Q('x ≥ 4. The smallest whole number that works?', '4', '≥ means "or the same", so 4 works.', 'Does 4 itself work this time?', board({ line: line(4), tags: [overLine('t', 4, 'x ≥ 4', 'b', 26)] })),
      Q('x < 5. The biggest whole number that works?', '4', '5 isn\'t less than 5, so the biggest is 4.', 'Does 5 itself work?', board({ line: line(5), tags: [overLine('t', 5, 'x < 5', 'b', 26)] })),
    ],
    teach: { q: Q('x > 5. The smallest whole number that works?', '6', '5 isn\'t more than 5. The first one that is: 6.', '', board({ line: line(5), tags: [overLine('t', 5, 'x > 5', 'b', 26)] })), wrong: '5', says: 'x > 5, so x can be 5!', decoy: '4', fixed: "Oh, I see! 5 isn't more than 5, it's the same. The smallest that works is 6! Thank you!" },
  },
];
export const ALG_LESSON: Record<string, AlgLesson> = Object.fromEntries(ALG_LESSONS.map(l => [l.id, l]));
