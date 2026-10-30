// The decimals and money Learn episodes: six short stories at the counter of a sweet and coin shop in the
// Sky Market (the episode set 'market'), played in the same 3D episode as every other area
// (math/ui/Episode.svelte): real US coins and a dollar bill to drag, line up and count, and chocolate to
// snap into tenths and hundredths. One for each idea in the area: counting coins biggest first, change by
// counting up, tenths of a chocolate bar, hundredths of a slab (and cents), comparing by lining up the
// points, and adding decimals with money. Each has the coach's steps (boards: the counters are coins and
// chocolate squares), the buddy's mistake to fix, three tries and a card. skills/course.ts SKILL_EPISODES
// points each money skill at its episode id. The coach's lines are in content/voice.ts (ep.<id>.intro,
// .s0..., .card), the same words as `say` here; the buddy's in its BUDDY_WORDS (<id>.try, <id>.fixed).
import type { GlimmerId } from '../../adventure/glimmers';
import type { Board, Dot, Hue, Step, Tag } from '../learn';
import type { EpQ } from '../fracEpisodes';
import type { SetId } from '../episodes';
import { COIN_D, type CoinKind } from '../../three/coinShapes';
import { moneyText } from '../skills/decimals';

export type MarketLesson = {
  id: string; title: string; blurb: string;
  set: SetId;
  /** the Glimmer at the stall */
  star: GlimmerId;
  intro: string;
  steps: Step[];
  /** the buddy's go: what it gets wrong, what it says, one more wrong choice, and its "oops" */
  teach: { q: EpQ; wrong: string; says: string; decoy: string; fixed: string };
  tries: [EpQ, EpQ, EpQ];
  card: string;
  /** the card's painted picture */
  art: string;
  /** what the counters are called in the prompts */
  noun: string;
  /** the money skills it teaches (skills/registry) */
  skills: string[];
};

const board = (b: Partial<Board>): Board => ({ cell: 48, dots: [], frames: [], plates: [], line: null, tags: [], ...b });
const tag = (id: string, x: number, y: number, text: string, c: Tag['c'] = 'ink', size = 30): Tag => ({ id, x, y, text, c, size });
const plate = (id: string, x: number, y: number, r = 100) => ({ id, x, y, r });
const Q = (text: string, ans: string, hint: string, hidden: string, pic: Board): EpQ => ({ text, ans, input: 'num', hint, hidden, pic });
const COINS_ART = 'learn/money/card-coins.webp', CHOC_ART = 'learn/frac/card-choc.webp';

// ---------- the money ----------
// (the words go in front of the things they name: the sum's pill floats over the work's back edge)
type Coin = { id: string; c: CoinKind; x: number; y: number; hue?: Hue };
const coin = ({ id, c, x, y, hue = 'a' }: Coin): Dot => ({ id, x, y, c: hue, shape: { k: 'coin', c } });
/** coins side by side, their middle at (x, y), `gap` apart */
function row(prefix: string, kinds: CoinKind[], x: number, y: number, gap = 14, hue: (i: number) => Hue = () => 'a'): Dot[] {
  const w = kinds.reduce((t, k) => t + COIN_D[k], 0) + gap * (kinds.length - 1);
  let at = x - w / 2;
  return kinds.map((c, i) => { const cx = at + COIN_D[c] / 2; at += COIN_D[c] + gap; return { ...coin({ id: `${prefix}${i}`, c, x: cx, y }), c: hue(i), d: i * 0.06 }; });
}
/** coins in a little heap on a plate: two or three across, rows behind each other */
function heap(prefix: string, kinds: CoinKind[], x: number, y: number, hue: (i: number) => Hue = () => 'a'): Dot[] {
  const per = kinds.length <= 4 ? 2 : 3, rows = Math.ceil(kinds.length / per), dx = per === 2 ? 80 : 66, dy = rows > 2 ? 56 : 70;
  return kinds.map((c, i) => {
    const r = Math.floor(i / per), inRow = Math.min(per, kinds.length - r * per), col = i % per;
    return { ...coin({ id: `${prefix}${i}`, c, x: x + (col - (inRow - 1) / 2) * dx, y: y + (r - (rows - 1) / 2) * dy }), c: hue(i), d: i * 0.06 };
  });
}
/** a dollar bill and coins on one plate: the bill behind, the coins in front */
function billAnd(prefix: string, kinds: CoinKind[], x: number, y: number): Dot[] {
  return [coin({ id: `${prefix}b`, c: 'bill', x, y: y - 40 }), ...row(prefix, kinds, x, y + 44, 10)];
}
const CENT: Record<CoinKind, number> = { penny: 1, nickel: 5, dime: 10, quarter: 25, dollar: 100, bill: 100 };
const sum = (kinds: CoinKind[]) => kinds.reduce((t, k) => t + CENT[k], 0);

// ---------- the chocolate ----------
/** a bar of ten squares (`w` wide), its middle at (x, y); square i where `where` puts it (its home, or moved) */
function bar(prefix: string, w: number, x: number, y: number, where: (i: number, home: { x: number; y: number }) => { x: number; y: number }, hue: (i: number) => Hue): Dot[] {
  const gap = w * 0.08, x0 = x - (9 * (w + gap)) / 2;
  return Array.from({ length: 10 }, (_, i) => ({ id: `${prefix}${i}`, ...where(i, { x: x0 + i * (w + gap), y }), c: hue(i), d: i * 0.04, shape: { k: 'chunk' as const, w } }));
}
const foil = (id: string, n: number, w: number, x: number, y: number, rows = 1) => ({ id, x, y, r: w, kind: 'foil' as const, w: n * w * 1.08 + 18, h: rows * w * 1.08 + 18 });
const BW_ = 44, BX = 300, BY = 118;
/** where square i of the bar sits on the plate once it's snapped off (the first one in the middle) */
const onPlate = (i: number) => ({ x: i === 9 ? 300 : i === 8 ? 252 : 348, y: 262 });
/** the middle of the first `n` squares of the bar (for a word in front of them) */
const barMid = (n: number) => BX - (9 * BW_ * 1.08) / 2 + ((n - 1) / 2) * BW_ * 1.08;
const choc = (where: (i: number, h: { x: number; y: number }) => { x: number; y: number }, gold: (i: number) => boolean, tags: Tag[] = []) =>
  board({ dishes: [foil('f', 10, BW_, BX, BY)], plates: [plate('p', 300, 262, 72)], dots: bar('q', BW_, BX, BY, where, i => (gold(i) ? 'c' : 'a')), tags });
/** the bar of ten on its own, gold where `gold(i)` (the questions) */
const tenBar = (gold: (i: number) => boolean) => board({ dishes: [foil('f', 10, BW_, BX, 150)], dots: bar('q', BW_, BX, 150, (_, h) => h, i => (gold(i) ? 'c' : 'a')) });
/** a slab of 100 squares, 10 by 10, the first `gold` of them gold (row by row from the front, nearest you) */
const SW = 23;
function slab(gold: number): Board {
  const gap = SW * 0.1, x0 = 300 - (9 * (SW + gap)) / 2, y0 = 168 - (9 * (SW + gap)) / 2;
  const dots: Dot[] = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) dots.push({ id: `s${r}-${c}`, x: x0 + c * (SW + gap), y: y0 + r * (SW + gap), c: (9 - r) * 10 + c < gold ? 'c' : 'a', d: (r * 10 + c) * 0.004, shape: { k: 'chunk', w: SW } });
  return board({ dishes: [foil('f', 10, SW, 300, 168, 10)], dots });
}

// ---------- pictures for the questions ----------
const howMuch = (kinds: CoinKind[], hint: string, hidden: string) => Q('How much money is this?', String(sum(kinds)), hint, hidden, board({ dots: row('m', kinds, 300, 175) }));
/** two plates: the left and the right, with words in front of them */
const PL = { x: 160, y: 165 }, PR = { x: 440, y: 165 }, PLR = 112, FRONT = PL.y + PLR + 44;
const twoPlates = () => [plate('pl', PL.x, PL.y, PLR), plate('pr', PR.x, PR.y, PLR)];
/** a shopper's money on the left plate, and the price */
function change(paid: CoinKind[], price: number, hint: string, hidden: string): EpQ {
  const cents = sum(paid);
  const dots = paid.includes('bill') ? billAnd('m', paid.filter(k => k !== 'bill'), PL.x, PL.y) : heap('m', paid, PL.x, PL.y);
  return Q(`They pay ${moneyText(cents)} for something that costs ${moneyText(price)}. How much change, in cents?`, String(cents - price), hint, hidden,
    board({ plates: twoPlates(), dots, tags: [tag('paid', PL.x, FRONT, `Paid ${moneyText(cents)}`, 'a'), tag('price', PR.x, FRONT, `Costs ${moneyText(price)}`, 'b')] }));
}
const compare = (a: string, b: string, more: string, hint: string, hidden: string) =>
  Q(`Which is more, ${a} or ${b}?`, more, hint, hidden, board({ plates: twoPlates(), tags: [tag('a', PL.x, PL.y + 20, a, 'a', 44), tag('b', PR.x, PR.y + 20, b, 'b', 44)] }));

// the stories' boards
const COINS4: CoinKind[] = ['penny', 'nickel', 'dime', 'quarter'];
const four = () => row('k', COINS4, 300, 170, 44);
const PILE: CoinKind[] = ['quarter', 'dime', 'dime', 'nickel', 'penny'], PILE_IDS = ['j2', 'j0', 'j4', 'j3', 'j1'];
const lined = () => row('j', PILE, 300, 170, 24).map((d, i) => ({ ...d, id: PILE_IDS[i], d: i * 0.08 }));
const paid = () => row('p', ['quarter', 'quarter'], PL.x, PL.y, 12);
const counted = () => row('c', ['nickel', 'dime'], PR.x, PR.y, 18, () => 'c');
/** the muffin money: a dollar bill and a quarter on the left plate */
const muffin = () => [coin({ id: 'mb', c: 'bill', x: PL.x, y: PL.y - 30 }), coin({ id: 'm0', c: 'quarter', x: PL.x, y: PL.y + 48 })];
/** the juice money: two quarters at the back of the right plate */
const juice = () => [coin({ id: 'j0', c: 'quarter', x: PR.x - 42, y: PR.y - 26 }), coin({ id: 'j1', c: 'quarter', x: PR.x + 42, y: PR.y - 26 })];
const priceTags = () => [tag('a', PL.x, FRONT, '$1.25', 'a', 38), tag('b', PR.x, FRONT, '$0.50', 'b', 38)];

export const MARKET_LESSONS: MarketLesson[] = [
  {
    id: 'dec-coins', title: 'Biggest First', blurb: 'Count a pile of coins: line them up biggest first, then count on.', set: 'market', star: 'rollodillo', skills: ['dm-coins', 'dm-make'], art: COINS_ART, noun: 'coins',
    intro: "Welcome to the Sky Market! Rock Candy Armadillo rolled in with a pile of coins. Let's count them, biggest first.",
    steps: [
      { say: 'Here are four coins. A penny, a nickel, a dime and a quarter. Each one is worth a different amount.', board: board({ dots: four() }), eq: 'penny  nickel  dime  quarter' },
      { say: "Tap each coin to see what it's worth. A penny is 1 cent, a nickel is 5, a dime is 10, and a quarter is 25.",
        board: board({ dots: four(), tags: ['1¢', '5¢', '10¢', '25¢'].map((t, i) => tag(`v${i}`, four()[i].x, 262, t, 'c', 36)) }), eq: '[1¢]  [5¢]  [10¢]  [25¢]' },
      { say: "Rock Candy Armadillo's pile has five coins, all mixed up. To count them, line them up biggest first.", do: 'watch',
        board: board({ dots: [coin({ id: 'j0', c: 'dime', x: 140, y: 215 }), coin({ id: 'j1', c: 'penny', x: 235, y: 120 }), coin({ id: 'j2', c: 'quarter', x: 315, y: 230 }), coin({ id: 'j3', c: 'nickel', x: 400, y: 130 }), coin({ id: 'j4', c: 'dime', x: 470, y: 235 })] }), eq: '5 coins' },
      { say: 'Drag the coins into a line, from the biggest to the smallest.', board: board({ dots: lined() }), eq: '25¢  10¢  10¢  5¢  1¢' },
      { say: 'Now tap each coin and count on. 25, 35, 45, then 50, and 51 cents!',
        board: board({ dots: lined(), tags: ['25', '35', '45', '50', '51¢'].map((t, i) => tag(`n${i}`, lined()[i].x, 262, t, i === 4 ? 'c' : 'a', 36)) }), eq: '25, 35, 45, 50, [51¢]' },
    ],
    teach: { q: howMuch(['dime', 'dime', 'nickel', 'quarter'], 'Biggest first: 25, then 35, 45, then 50.', 'Line them up biggest first, then count on from the quarter.'), wrong: '40', says: 'Four coins? 10, 20, 30, 40. That makes 40 cents!', decoy: '45', fixed: "Oh, I see! Each coin has its own value. Biggest first: 25, 35, 45, 50. It's 50 cents! Thank you!" },
    tries: [
      howMuch(['quarter', 'dime', 'nickel', 'penny', 'penny'], 'Biggest first: 25, then 35, 40, 41, 42.', 'Start with the quarter, then count on.'),
      howMuch(['quarter', 'quarter', 'dime', 'nickel'], 'The quarters first: 25, 50, then 60, 65.', 'Start with the two quarters.'),
      howMuch(['dime', 'dime', 'dime', 'nickel', 'penny', 'penny', 'penny'], 'Count the dimes by tens: 10, 20, 30, then 35, 36, 37, 38.', 'Count the dimes by tens first, then the rest.'),
    ],
    card: 'You won the Biggest First card! Line the coins up from biggest to smallest, then count on.',
  },
  {
    id: 'dec-change', title: 'Count Up', blurb: 'Give change like a shopkeeper: start at the price and count up to what was paid.', set: 'market', star: 'teakettledrake', skills: ['dm-change'], art: COINS_ART, noun: 'coins',
    intro: 'Teakettle Dragon runs the lemonade stall. A lemonade costs 35 cents, and the shopper pays 50 cents. How much change?',
    steps: [
      { say: "The lemonade costs 35 cents. The shopper pays with two quarters. That's 50 cents.", board: board({ plates: twoPlates(), dots: paid(), tags: [tag('paid', PL.x, FRONT, 'Paid 50¢', 'a')] }), eq: 'Pay [50¢] for [35¢]' },
      { say: 'Shopkeepers count up from the price. Tap the glowing spot to start at 35.', board: board({ plates: twoPlates(), dots: paid(), tags: [tag('paid', PL.x, FRONT, 'Paid 50¢', 'a'), tag('s', PR.x, FRONT, '35', 'ink', 38)] }), eq: '[35¢]' },
      { say: 'Drag a nickel onto the plate. That makes 40. Then a dime. That makes 50!', board: board({ plates: twoPlates(), dots: [...paid(), ...counted()], tags: [tag('paid', PL.x, FRONT, 'Paid 50¢', 'a'), tag('s', PR.x, FRONT, '35 → 40 → 50', 'ink', 34)] }), eq: '35¢, [40¢], [50¢]' },
      { say: "The change is the coins you counted, a nickel and a dime. That's 15 cents!", board: board({ plates: twoPlates(), dots: [...paid(), ...counted()], tags: [tag('paid', PL.x, FRONT, 'Paid 50¢', 'a'), tag('s', PR.x, FRONT, 'Change 15¢', 'c', 38)] }), eq: 'Change [15¢]' },
    ],
    teach: { q: change(['bill'], 60, 'Count up from 60: a dime makes 70, a nickel 75, and a quarter 100. That is 40¢.', 'Start at 60 and count up to $1.'), wrong: '50', says: "A dollar for 60¢? 6 take away 1 is 5. So it's 50¢ change!", decoy: '30', fixed: "Oh, I see! Count up from 60. 70, 75, then 100. That's 40 cents change! Thank you!" },
    tries: [
      change(['quarter'], 15, 'Count up from 15: a dime makes 25. That is 10¢.', 'Start at 15 and count up to 25.'),
      change(['quarter', 'quarter'], 20, 'Count up from 20: a nickel makes 25, and a quarter makes 50. That is 30¢.', 'Start at 20 and count up to 50.'),
      change(['bill'], 45, 'Count up from 45: a nickel makes 50, then two quarters make 100. That is 55¢.', 'Start at 45 and count up to $1.'),
    ],
    card: 'You won the Count Up card! Start at the price, and count up to what they paid.',
  },
  {
    id: 'dec-tenths', title: 'Tenths', blurb: 'A chocolate bar of ten pieces: each piece is one tenth, 0.1.', set: 'market', star: 'popcornpuff', skills: ['dm-tenths'], art: CHOC_ART, noun: 'pieces',
    intro: 'Popcorn Puffling found a chocolate bar with 10 pieces. Each piece is one tenth!',
    steps: [
      { say: 'The whole bar is 1. It snaps into 10 equal pieces.', board: choc((_, h) => h, () => false), eq: '1 bar = [10] pieces' },
      { say: 'Snap off one piece, and put it on the plate. One piece is one tenth. We write it 0.1.', board: choc((i, h) => (i === 9 ? onPlate(i) : h), i => i === 9), eq: '[1/10] = [0.1]' },
      { say: "Snap off two more. Three pieces are three tenths. That's 0.3.", board: choc((i, h) => (i >= 7 ? onPlate(i) : h), i => i >= 7), eq: '[3/10] = [0.3]' },
      { say: 'The first digit after the point counts tenths. Tap each glowing spot. 3 pieces make 0.3, and the 7 left make 0.7.',
        board: choc((i, h) => (i >= 7 ? onPlate(i) : h), i => i >= 7, [tag('t3', 420, 285, '0.3', 'c', 40), tag('t7', barMid(7), 185, '0.7', 'a', 40)]), eq: '[0.3] + [0.7] = 1' },
    ],
    teach: { q: Q('How much of the bar is gold?', '0.4', 'Count the gold pieces: 4 tenths is 0.4.', 'Count the gold pieces. That many tenths.', tenBar(i => i < 4)), wrong: '0.04', says: "4 pieces? So it's 0.04!", decoy: '4', fixed: 'Oh, I see! Tenths go right after the point. 4 pieces is 0.4! Thank you!' },
    tries: [
      Q('How much of the bar is gold?', '0.6', 'Count the gold pieces: 6 tenths is 0.6.', 'Count the gold pieces. That many tenths.', tenBar(i => i < 6)),
      Q('How much of the bar is gold?', '0.9', 'Nearly the whole bar: 9 tenths is 0.9.', 'Count the gold pieces. That many tenths.', tenBar(i => i < 9)),
      Q('Write 2/10 as a decimal.', '0.2', '2 tenths: a 2 right after the point, 0.2.', 'Tenths go right after the point.', tenBar(i => i < 2)),
    ],
    card: 'You won the Tenths card! The first digit after the point counts tenths.',
  },
  {
    id: 'dec-hundredths', title: 'Hundredths', blurb: 'A slab of 100 squares, and a dollar of 100 cents: two digits after the point.', set: 'market', star: 'geodemole', skills: ['dm-hund'], art: CHOC_ART, noun: 'squares',
    intro: 'Geode Mole dug up a giant chocolate slab of 100 squares. Each square is one hundredth.',
    steps: [
      { say: '100 squares make 1 whole slab.', board: slab(0), eq: '1 slab = [100] squares' },
      { say: 'Tap the glowing square. One square is one hundredth. We write it 0.01.', board: slab(1), eq: '[1/100] = [0.01]' },
      { say: "Tap the glowing row. A row of 10 squares is one tenth. That's 0.1, the same as 0.10.", board: slab(10), eq: '[10/100] = [0.10] = [0.1]' },
      { say: "Tap to make more gold. 3 rows and 5 more squares make 35 hundredths. That's 0.35.", board: slab(35), eq: '[35/100] = [0.35]' },
      { say: 'Money works the same way. A dollar is 100 cents, so 35 cents is $0.35.', do: 'watch', board: board({ plates: [plate('p', 300, 160, 112)], dots: row('m', ['quarter', 'dime'], 300, 150, 16), tags: [tag('t', 300, 320, '35¢ = $0.35', 'c', 40)] }), eq: '35¢ = [$0.35]' },
    ],
    teach: { q: Q('How much of the slab is gold?', '0.07', '7 hundredths: a 0 for no tenths, then 7. That is 0.07.', 'No full rows are gold, so the tenths digit is 0.', slab(7)), wrong: '0.7', says: "7 hundredths? That's 0.7!", decoy: '7', fixed: 'Oh, I see! Hundredths need two digits. 7 hundredths is 0.07, like 7 cents! Thank you!' },
    tries: [
      Q('How much of the slab is gold?', '0.48', '4 rows and 8 squares: 48 hundredths is 0.48.', 'Count the gold rows as tens, then the squares.', slab(48)),
      Q('How much of the slab is gold?', '0.05', '5 squares and no full rows: 0.05.', 'No full rows are gold, so the tenths digit is 0.', slab(5)),
      Q('60¢ is how many dollars?', '0.6', '60 hundredths of a dollar: 0.60, the same as 0.6.', 'A dollar is 100 cents. 60 cents is 60 hundredths.', board({ plates: [plate('p', 300, 175, 118)], dots: heap('m', ['quarter', 'quarter', 'dime'], 300, 175) })),
    ],
    card: 'You won the Hundredths card! Two digits after the point count hundredths, like cents.',
  },
  {
    id: 'dec-compare', title: 'Line Up the Points', blurb: 'Which is more, 0.5 or 0.45? Fill in a zero so both have the same digits.', set: 'market', star: 'rollodillo', skills: ['dm-compare'], art: COINS_ART, noun: 'coins',
    intro: 'Rock Candy Armadillo wants the bigger pile of money. Which is more, 0.5 or 0.45?',
    steps: [
      { say: '0.45 has more digits, so it looks bigger. But is it?', board: board({ plates: twoPlates(), tags: [tag('a', PL.x, FRONT, '0.5', 'a', 44), tag('b', PR.x, FRONT, '0.45', 'b', 44)] }), eq: '0.5 [?] 0.45' },
      { say: 'Give them the same number of digits. Tap the glowing spot. 0.5 is the same as 0.50.', board: board({ plates: twoPlates(), tags: [tag('a', PL.x, FRONT, '0.50', 'a', 44), tag('b', PR.x, FRONT, '0.45', 'b', 44)] }), eq: '[0.50] ? 0.45' },
      { say: 'In money, 0.50 is 50 cents and 0.45 is 45 cents. Drag the coins onto the plates.',
        board: board({ plates: twoPlates(), dots: [...heap('l', ['quarter', 'quarter'], PL.x, PL.y), ...heap('r', ['quarter', 'dime', 'dime'], PR.x, PR.y)], tags: [tag('a', PL.x, FRONT, '0.50', 'a', 44), tag('b', PR.x, FRONT, '0.45', 'b', 44)] }), eq: '[50¢]  and  [45¢]' },
      { say: 'Tap each plate. 50 cents is more than 45 cents, so 0.5 is bigger! Line up the points, fill in a zero, then compare.',
        board: board({ plates: twoPlates(), dots: [...heap('l', ['quarter', 'quarter'], PL.x, PL.y), ...heap('r', ['quarter', 'dime', 'dime'], PR.x, PR.y)], tags: [tag('a', PL.x, FRONT, '0.50 is 50¢', 'c', 40), tag('b', PR.x, FRONT, '0.45 is 45¢', 'b', 40)] }), eq: '[0.5 > 0.45]' },
    ],
    teach: { q: compare('0.3', '0.25', '0.3', '0.3 is 0.30: 30 hundredths is more than 25.', 'Fill in a zero so both have two digits, then compare.'), wrong: '0.25', says: '0.25 has a 25, and 25 is more than 3. So 0.25 is more!', decoy: '0.03', fixed: 'Oh, I see! 0.3 is 0.30, and 30 hundredths is more than 25. So 0.3 is more! Thank you!' },
    tries: [
      compare('0.7', '0.65', '0.7', '0.7 is 0.70: 70 hundredths is more than 65.', 'Fill in a zero so both have two digits, then compare.'),
      compare('0.09', '0.1', '0.1', '0.1 is 0.10: 10 hundredths is more than 9.', 'Fill in a zero so both have two digits, then compare.'),
      compare('0.4', '0.38', '0.4', '0.4 is 0.40: 40 hundredths is more than 38.', 'Fill in a zero so both have two digits, then compare.'),
    ],
    card: 'You won the Line Up the Points card! Fill in zeros so the digits match, then compare.',
  },
  {
    id: 'dec-add', title: 'Line Up and Add', blurb: 'Add and take away decimals: points in a line, then add like whole numbers.', set: 'market', star: 'teakettledrake', skills: ['dm-add', 'dm-sub'], art: COINS_ART, noun: 'coins',
    intro: 'Teakettle Dragon sells a muffin for $1.25 and a juice for 50 cents. How much for both?',
    steps: [
      { say: 'The muffin is $1.25. The juice is 50 cents, and we write that $0.50. Line up the points.', board: board({ plates: twoPlates(), dots: [...muffin(), ...juice()], tags: priceTags() }), eq: '1.25 + [0.50]' },
      { say: "Put the cents together. Drag the muffin's quarter onto the juice plate.", board: board({ plates: twoPlates(), dots: [coin({ id: 'mb', c: 'bill', x: PL.x, y: PL.y }), coin({ id: 'm0', c: 'quarter', x: PR.x, y: PR.y + 42, hue: 'c' }), ...juice()], tags: priceTags() }), eq: '25¢ + 50¢' },
      { say: 'Add the cents first. Tap the glowing spot. 25 and 50 make 75 cents.', board: board({ plates: twoPlates(), dots: [coin({ id: 'mb', c: 'bill', x: PL.x, y: PL.y }), coin({ id: 'm0', c: 'quarter', x: PR.x, y: PR.y + 42, hue: 'c' }), ...juice()], tags: [tag('a', PL.x, FRONT, '$1.25', 'a', 38), tag('b', PR.x, FRONT, '75¢', 'c', 44)] }), eq: '25¢ + 50¢ = [75¢]' },
      { say: 'Then the dollars. 1 dollar and 75 cents is $1.75. The point stays in line!', board: board({ plates: twoPlates(), dots: [coin({ id: 'mb', c: 'bill', x: PL.x, y: PL.y }), coin({ id: 'm0', c: 'quarter', x: PR.x, y: PR.y + 42, hue: 'c' }), ...juice()], tags: [tag('a', PL.x, FRONT, '$1', 'a', 44), tag('b', PR.x, FRONT, '75¢', 'c', 44), tag('t', 300, FRONT + 4, '$1.75', 'c', 52)] }), eq: '1.25 + 0.50 = [1.75]' },
    ],
    teach: { q: Q('0.4 + 0.25 = ?', '0.65', 'Write 0.4 as 0.40, then add: 40 and 25 hundredths make 0.65.', 'Write 0.4 as 0.40 first.', board({ plates: twoPlates(), dots: [...heap('l', ['quarter', 'dime', 'nickel'], PL.x, PL.y), ...heap('r', ['quarter'], PR.x, PR.y)], tags: [tag('a', PL.x, FRONT, '0.40', 'a', 38), tag('b', PR.x, FRONT, '0.25', 'b', 38)] })),
      wrong: '0.29', says: "4 and 25 make 29, so it's 0.29!", decoy: '0.47', fixed: "Oh, I see! Line up the points. 0.4 is 0.40, and 40 and 25 make 65. It's 0.65! Thank you!" },
    tries: [
      Q('0.3 + 0.4 = ?', '0.7', '3 tenths and 4 tenths make 7 tenths: 0.7.', 'Add the tenths.', board({ plates: twoPlates(), dots: [...heap('l', ['dime', 'dime', 'dime'], PL.x, PL.y), ...heap('r', ['dime', 'dime', 'dime', 'dime'], PR.x, PR.y)] })),
      Q('1.5 + 0.25 = ?', '1.75', 'Write 1.5 as 1.50, then add: 1.75.', 'Write 1.5 as 1.50 first.', board({ plates: twoPlates(), dots: [...billAnd('l', ['quarter', 'quarter'], PL.x, PL.y), ...heap('r', ['quarter'], PR.x, PR.y)] })),
      Q('0.9 − 0.35 = ?', '0.55', 'Write 0.9 as 0.90. 90 take away 35 is 55, so 0.55.', 'Write 0.9 as 0.90 first.', board({ plates: [plate('p', 300, 170, 130)], dots: heap('m', ['dime', 'dime', 'dime', 'dime', 'dime', 'dime', 'dime', 'dime', 'dime'], 300, 170) })),
    ],
    card: 'You won the Line Up and Add card! Line up the points, then add like whole numbers.',
  },
];
export const MARKET_LESSON: Record<string, MarketLesson> = Object.fromEntries(MARKET_LESSONS.map(l => [l.id, l]));

/** The coach's lines for an episode, by voice-line id (content/voice.ts has the same words). */
export const marketLines = (l: MarketLesson): [string, string][] => [[`ep.${l.id}.intro`, l.intro], ...l.steps.map((s, i): [string, string] => [`ep.${l.id}.s${i}`, s.say]), [`ep.${l.id}.card`, l.card]];
