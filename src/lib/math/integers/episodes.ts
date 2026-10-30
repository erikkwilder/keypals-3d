// The negative numbers Learn episodes: seven short stories in the Ice Cave Chart Room (episodes.ts set
// 'frost'), played in the same 3D episode as the fractions and the fact tricks (math/ui/Episode.svelte).
// Most happen on the numbered plank with 0 in the middle: the Glimmer hops right for plus and left for
// minus, so below zero, opposites, which is bigger, adding and taking away, and times with negatives are
// all hops the kid makes with a tap. The map episode lays a treasure map on the table (a Board `chart`)
// and the kid drags gold coins onto its crossings. Each has the coach's steps, the buddy's mistake to
// fix, three questions of their own (typed with the minus key: `minus`), and its card. The coach's lines
// are in content/voice.ts (ep.<id>.intro, .s0..., .card); skills/course.ts SKILL_EPISODES points each
// negative numbers skill at its episode.
import type { Board, Dot, Tag } from '../learn';
import type { EpQ, FracLesson } from '../fracEpisodes';

export type NegLesson = FracLesson;

const board = (b: Partial<Board>): Board => ({ cell: 48, dots: [], frames: [], plates: [], line: null, tags: [], ...b });
const tag = (id: string, x: number, y: number, text: string, c: Tag['c'] = 'ink', size = 26): Tag => ({ id, x, y, text, c, size });
type Hop = { a: number; b: number; label: string };

// ---------- the plank: −6 to 6, 0 in the middle ----------
const FROM = -6, TO = 6;
/** where number n sits across the board (episodeScene draws the plank from 44 to 556) */
const lx = (n: number) => 44 + ((n - FROM) / (TO - FROM)) * 512;
/** one hop per step from a to b (`by` at a time), each labelled (or not) */
function hops(a: number, b: number, by = 1, label = ''): Hop[] {
  const out: Hop[] = [], dir = Math.sign(b - a);
  for (let x = a; x !== b; x += dir * by) out.push({ a: x, b: x + dir * by, label });
  return out;
}
const plank = (at: number, hs: Hop[] = [], tags: Tag[] = []): Board => board({ line: { from: FROM, to: TO, at, hops: hs }, tags });
/** words under a number on the plank (under its number tag) */
const under = (id: string, n: number, text: string, c: Tag['c'] = 'ink') => tag(id, lx(n), 300, text, c, 24);
const Q = (text: string, ans: string, hint: string, hidden: string, pic: Board): EpQ => ({ text, ans, input: 'num', hint, hidden, pic });

// ---------- the map: a treasure map on the table, −5 to 5 across and −3 to 3 up ----------
const CX = 300, CY = 172, CELL = 40;
/** a grid crossing on the board */
const gp = (x: number, y: number) => ({ x: CX + x * CELL, y: CY - y * CELL });
const coin = (id: string, x: number, y: number, c: Dot['c'] = 'c', d = 0): Dot => ({ id, ...gp(x, y), c, d });
const map = (dots: Dot[] = [], tags: Tag[] = []): Board => board({ cell: 30, chart: { x: CX, y: CY, cell: CELL, xMin: -5, xMax: 5, yMin: -3, yMax: 3 }, dots, tags });
const pairTag = (id: string, x: number, y: number, text: string) => tag(id, gp(x, y).x, gp(x, y).y - 26, text, 'c', 22);

export const NEG_LESSONS: NegLesson[] = [
  {
    id: 'neg-zero', title: 'Below Zero', blurb: 'Zero is in the middle. Below zero, the numbers get a minus sign: 3 below zero is −3.', set: 'frost', skill: 'in-real', art: 'learn/int/card-thermo.webp',
    steps: [
      { say: '', board: plank(0), eq: '0 is in the middle' },
      { say: '', board: plank(3, hops(0, 3)), eq: '3 above zero: [3]' },
      { say: '', board: plank(0), eq: 'back to 0', do: 'watch' },
      { say: '', board: plank(-3, hops(0, -3)), eq: '3 below zero: [−3]' },
      { say: '', board: plank(-3, hops(0, -3), [under('lo', -3, 'below zero', 'a'), under('hi', 3, 'above zero', 'c')]), eq: 'below zero gets a [minus]' },
    ],
    tries: [
      Q('It is 2 degrees below zero. As a number?', '-2', 'Below zero gets a minus sign: −2.', 'Below zero is to the left of 0. Does it need a minus?', plank(-2, hops(0, -2))),
      Q('A fish swims 5 meters below sea level. As a number?', '-5', 'Below sea level is below zero: −5.', 'Sea level is 0. Under the water is below zero.', plank(0)),
      Q('You owe 4 shells. As a number?', '-4', 'Owing is below zero: −4.', 'Owing means you have less than nothing.', plank(0)),
    ],
    teach: { q: Q('It is 4 degrees below zero. As a number?', '-4', 'Below zero gets a minus sign: −4.', '', plank(-4, hops(0, -4))), wrong: '4', says: '4 degrees below zero? That is just 4!', decoy: '-5', fixed: 'Below zero needs a minus sign! 4 below zero is −4, four steps left of 0.' },
  },
  {
    id: 'neg-opposites', title: 'Opposites', blurb: 'Opposites are the same distance from 0 on different sides: 4 and −4. How far from 0 is |−4| = 4.', set: 'frost', skill: 'in-opp', art: 'learn/int/card-twins.webp',
    steps: [
      { say: '', board: plank(0), eq: 'start at 0' },
      { say: '', board: plank(4, hops(0, 4)), eq: '4 steps right: [4]' },
      { say: '', board: plank(0), eq: 'back to 0', do: 'watch' },
      { say: '', board: plank(-4, hops(0, -4)), eq: '4 steps left: [−4]' },
      { say: '', board: plank(-4, hops(0, -4), [under('l', -4, '4 steps', 'a'), under('r', 4, '4 steps', 'c')]), eq: '4 and −4 are [opposites]' },
    ],
    tries: [
      Q('What is the opposite of 3?', '-3', 'The same distance on the other side of 0: −3.', 'Go to the other side of 0, the same number of steps.', plank(3, hops(0, 3))),
      Q('How many steps is −5 from 0?', '5', 'Count the steps from −5 to 0: 5. Steps are never minus.', 'Count the hops back to 0.', plank(-5, hops(0, -5))),
      Q('What is the opposite of −2?', '2', 'The same distance on the other side: 2.', 'Go to the other side of 0, the same number of steps.', plank(-2, hops(0, -2))),
    ],
    teach: { q: Q('What is the opposite of −6?', '6', 'The opposite of −6 is 6: the same 6 steps, on the other side of 0.', '', plank(-6, hops(0, -6))), wrong: '-6', says: 'The opposite of minus 6? It is minus 6, of course!', decoy: '7', fixed: 'Opposites are on different sides of 0! −6 is 6 steps left, so its opposite is 6 steps right: 6.' },
  },
  {
    id: 'neg-compare', title: 'Further Right Is Bigger', blurb: 'On the number line, the one further right is bigger: −2 is bigger than −5.', set: 'frost', skill: 'in-compare', art: 'learn/int/card-dive.webp',
    steps: [
      { say: '', board: plank(-5, [], [under('a', -5, '−5', 'a')]), eq: 'start at −5' },
      { say: '', board: plank(-2, hops(-5, -2), [under('a', -5, '−5', 'a')]), eq: 'to the right: [−2]' },
      { say: '', board: plank(-2, hops(-5, -2), [under('a', -5, 'colder', 'a'), under('b', -2, 'warmer', 'c')]), eq: '−2 [>] −5' },
      { say: '', board: plank(3, [...hops(-5, -2), ...hops(-2, 3)], [under('a', -5, 'colder', 'a'), under('b', -2, 'warmer', 'c')]), eq: 'every step right is [bigger]' },
    ],
    tries: [
      Q('Which is bigger: −4 or −1?', '-1', '−1 is further right, so it is bigger.', 'Which one is closer to 0, on the right?', plank(0)),
      Q('Which is colder: −2 degrees or −6 degrees?', '-6', '−6 is further left: colder.', 'Colder means further left on the line.', plank(0)),
      Q('Which is smaller: 1 or −5?', '-5', 'Any minus number is smaller than a plus one: −5.', 'Below zero is smaller than above zero.', plank(0)),
    ],
    teach: { q: Q('Which is bigger: −7 or −3?', '-3', '−3 is further right, so it is bigger.', '', plank(-3, [], [under('a', -3, '−3', 'c')])), wrong: '-7', says: '7 is more than 3, so minus 7 is bigger!', decoy: '7', fixed: '−7 is further LEFT. Further right is bigger, so −3 is bigger than −7!' },
  },
  {
    id: 'neg-add', title: 'Adding Negatives', blurb: 'Adding hops right; adding a negative hops left. −3 + 5 = 2, and 4 + (−6) = −2.', set: 'frost', skill: 'in-add', art: 'learn/int/card-line.webp',
    steps: [
      { say: '', board: plank(-3), eq: '−3 + 5' },
      { say: '', board: plank(2, hops(-3, 2)), eq: '−3 + 5 = [2]' },
      { say: '', board: plank(4), eq: '4 + (−6)', do: 'watch' },
      { say: '', board: plank(-2, hops(4, -2)), eq: '4 + (−6) = [−2]' },
    ],
    tries: [
      Q('−4 + 6 = ?', '2', 'Start at −4 and hop 6 right: 2.', 'Start at −4. Adding 6 hops right.', plank(-4)),
      Q('3 + (−5) = ?', '-2', 'Start at 3 and hop 5 left: −2.', 'Start at 3. Adding a negative hops left.', plank(3)),
      Q('−1 + (−4) = ?', '-5', 'Start at −1 and hop 4 left: −5.', 'Start at −1. Adding a negative hops left.', plank(-1)),
    ],
    teach: { q: Q('−2 + (−3) = ?', '-5', 'Start at −2 and hop 3 left: −5.', '', plank(-2)), wrong: '5', says: 'Minus 2 plus minus 3? 2 and 3 make 5... so 5!', decoy: '-1', fixed: 'Adding a negative hops LEFT. From −2, three hops left lands on −5.' },
  },
  {
    id: 'neg-sub', title: 'Taking Away a Negative', blurb: 'Taking away hops left, even past 0. Taking away a negative turns round and hops right: 1 − (−4) = 5.', set: 'frost', skill: 'in-sub', art: 'learn/int/card-line.webp',
    steps: [
      { say: '', board: plank(2), eq: '2 − 5' },
      { say: '', board: plank(-3, hops(2, -3)), eq: '2 − 5 = [−3]' },
      { say: '', board: plank(1), eq: '1 − (−4)', do: 'watch' },
      { say: '', board: plank(5, hops(1, 5)), eq: '1 − (−4) = 1 + 4 = [5]' },
    ],
    tries: [
      Q('1 − 4 = ?', '-3', 'Start at 1 and hop 4 left: −3.', 'Start at 1. Taking away hops left, past 0.', plank(1)),
      Q('−2 − 3 = ?', '-5', 'Start at −2 and hop 3 left: −5.', 'Start at −2. Taking away hops left.', plank(-2)),
      Q('2 − (−3) = ?', '5', 'Taking away a negative is adding: 2 + 3 = 5.', 'Taking away a minus turns you round: hop right.', plank(2)),
    ],
    teach: { q: Q('3 − (−2) = ?', '5', 'Taking away a negative is adding: 3 + 2 = 5.', '', plank(3)), wrong: '1', says: '3 take away 2 is 1. Easy!', decoy: '-5', fixed: 'It takes away MINUS 2. Taking away a negative is the same as adding: 3 + 2 = 5!' },
  },
  {
    id: 'neg-times', title: 'Times With Negatives', blurb: 'Three jumps of −2 is −6. A minus in front turns the jumps round: −3 × (−2) = 6.', set: 'frost', skill: 'in-mult', art: 'learn/int/card-line.webp',
    steps: [
      { say: '', board: plank(0), eq: '3 × (−2)' },
      { say: '', board: plank(-6, hops(0, -6, 2, '−2')), eq: '3 jumps of −2 = [−6]' },
      { say: '', board: plank(0), eq: '−3 × (−2)', do: 'watch' },
      { say: '', board: plank(6, hops(0, 6, 2, '+2')), eq: 'turned round: [6]' },
    ],
    tries: [
      Q('2 × (−3) = ?', '-6', 'Two jumps of −3: −6. Different signs make minus.', 'Jump −3, two times.', plank(0)),
      Q('−2 × (−2) = ?', '4', 'Same signs make plus: 4.', 'A minus in front turns the jumps round.', plank(0)),
      Q('−6 ÷ 3 = ?', '-2', '3 × (−2) = −6, so −6 ÷ 3 = −2. Different signs make minus.', 'What times 3 makes −6?', plank(0)),
    ],
    teach: { q: Q('−3 × 2 = ?', '-6', 'Different signs make minus: −6.', '', plank(0)), wrong: '6', says: 'Times makes things bigger, so it is 6!', decoy: '-5', fixed: 'Different signs make a MINUS answer. −3 × 2 = −6.' },
  },
  {
    id: 'neg-map', title: 'The Four-Corner Map', blurb: 'Across first, then up or down. Minus goes left or down: (−3, 2) is 3 left and 2 up.', set: 'frost', skill: 'in-quad', art: 'learn/int/card-map.webp',
    steps: [
      { say: '', board: map(), eq: 'across first, then up or down' },
      { say: '', board: map([coin('a', 3, 2)]), eq: '(3, 2): 3 right, 2 up' },
      { say: '', board: map([coin('a', 3, 2, 'a'), coin('b', -3, 2)]), eq: '(−3, 2): 3 [left], 2 up' },
      { say: '', board: map([coin('a', 3, 2, 'a'), coin('b', -3, 2, 'a'), coin('c', -3, -2)]), eq: '(−3, −2): 3 left, 2 [down]' },
      { say: '', board: map([coin('a', 3, 2, 'a'), coin('b', -3, 2, 'a'), coin('c', -3, -2)], [pairTag('ta', 3, 2, '(3, 2)'), pairTag('tb', -3, 2, '(−3, 2)'), pairTag('tc', -3, -2, '(−3, −2)')]), eq: 'minus means [left] or [down]' },
    ],
    tries: [
      Q('The gold coin is at (?, 3). What is the first number?', '-2', '2 left of the middle is −2: (−2, 3).', 'Left of the middle is minus.', map([coin('a', -2, 3)])),
      Q('The gold coin is at (4, ?). What is the second number?', '-3', '3 down from the middle is −3: (4, −3).', 'Down from the middle is minus.', map([coin('a', 4, -3)])),
      Q('How many squares from (−3, 1) to (4, 1)?', '7', '3 to the middle, then 4 more: 7.', 'Count to the middle line, then on.', map([coin('a', -3, 1, 'a'), coin('b', 4, 1, 'b')])),
    ],
    teach: { q: Q('The gold coin is at (?, 2). What is the first number?', '-3', '3 left of the middle is −3: (−3, 2).', '', map([coin('a', -3, 2)])), wrong: '3', says: 'It is 3 squares from the middle, so 3!', decoy: '2', fixed: 'It is 3 squares to the LEFT. Left of the middle is minus: (−3, 2).' },
  },
];
export const NEG_LESSON: Record<string, NegLesson> = Object.fromEntries(NEG_LESSONS.map(l => [l.id, l]));
