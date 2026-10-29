// The decimals and money Learn episodes: six short stories at a market stall (the painted set
// learn/market.webp), one for each idea in the area: counting coins biggest first, change by counting up,
// tenths of a chocolate bar, hundredths (and cents), comparing by lining up the points, and adding
// decimals. Each has the coach's steps with a picture, the buddy's mistake to fix, three tries and a card.
//
// The pictures are the area's own (skills/types Pic: coins, the bar of ten, the hundred-square slab), so
// SkillPrompt's MoneyPic and FractionPic draw them today. They follow the shape of the fraction episodes'
// lessons (steps, tries, teach, card) so the shared episode player can take them; skills/course.ts
// SKILL_EPISODES points each money skill at its episode id. The coach's lines are in content/voice.ts
// (ep.<id>.intro, .s0..., .card).
import type { GlimmerId } from '../../adventure/glimmers';
import type { Pic } from '../skills/types';
import { moneyText } from '../skills/decimals';

export type MarketStep = { say: string; /** the sum under the picture; [x] is lit up */ eq: string; pic: Pic | null };
/** a question with a typed answer: cents ('42'), or a decimal ('0.4'); 'a'/'b'/'same' for comparing */
export type MarketQ = { text: string; ans: string; input: 'num' | 'decimal' | 'choice'; choices?: string[]; hint: string; pic: Pic | null };
export type MarketLesson = {
  id: string; title: string; blurb: string;
  /** the Glimmer at the stall */
  star: GlimmerId;
  intro: string;
  steps: MarketStep[];
  /** the buddy's go: what it gets wrong, what it says, one more wrong choice, and the fix */
  teach: { q: MarketQ; wrong: string; says: string; decoy: string; fixed: string };
  tries: [MarketQ, MarketQ, MarketQ];
  card: string;
  /** the money skills it teaches (skills/registry) */
  skills: string[];
};

/** the market set: its painted backdrop and the Glimmers who keep the stalls */
export const MARKET_SET = { name: 'The Sky Market', backdrop: 'learn/market.webp' } as const;

const coins = (...c: number[]): Pic => ({ kind: 'coins', coins: c });
const bar = (filled: number): Pic => ({ kind: 'bar', parts: 10, filled });
const grid = (filled: number): Pic => ({ kind: 'grid', parts: 100, filled });
const cents = (c: number[]) => c.reduce((t, x) => t + Math.abs(x), 0);
const howMuch = (c: number[], hint: string): MarketQ => ({ text: 'How much money is this?', ans: String(cents(c)), input: 'num', hint, pic: coins(...c) });
const change = (paid: number, price: number, hint: string): MarketQ => ({ text: `They pay ${moneyText(paid)} for something that costs ${moneyText(price)}. How much change?`, ans: String(paid - price), input: 'num', hint, pic: coins(...(paid >= 100 ? [-100] : Array(paid / 25).fill(25))) });
const dec = (text: string, ans: number, hint: string, pic: Pic | null = null): MarketQ => ({ text, ans: String(ans), input: 'decimal', hint, pic });
const which = (a: string, b: string, ans: 'a' | 'b' | 'same', hint: string): MarketQ => ({ text: `Which is more: ${a} or ${b}?`, ans, input: 'choice', choices: [a, 'the same', b], hint, pic: null });

export const MARKET_LESSONS: MarketLesson[] = [
  {
    id: 'dec-coins', title: 'Biggest First', blurb: 'Count a pile of coins: line them up biggest first, then count on.', star: 'rollodillo', skills: ['dm-coins', 'dm-make'],
    intro: "Welcome to the sky market! Rock Candy Armadillo rolled in with a pile of coins. Let's count them, biggest first.",
    steps: [
      { say: 'Every coin has its own value. A penny is 1 cent, a nickel 5, a dime 10, and a quarter 25.', eq: '[1¢] [5¢] [10¢] [25¢]', pic: coins(1, 5, 10, 25) },
      { say: 'To count a pile, line the coins up from biggest to smallest.', eq: '25¢, 10¢, 10¢, 5¢, 1¢', pic: coins(25, 10, 10, 5, 1) },
      { say: 'Start with the quarter: 25. Then count on by tens: 35, 45.', eq: '25, [35], [45]', pic: coins(25, 10, 10) },
      { say: 'Then on by five: 50. And one more: 51 cents!', eq: '45, [50], [51] = [51¢]', pic: coins(25, 10, 10, 5, 1) },
    ],
    teach: { q: howMuch([10, 10, 5, 25], 'Biggest first: 25, then 35, 45, then 50.'), wrong: '40', says: 'Four coins? 10, 20, 30, 40. That makes 40 cents!', decoy: '45', fixed: 'Each coin has its own value. Biggest first: 25, 35, 45, 50. It is 50 cents!' },
    tries: [
      howMuch([25, 10, 5, 1, 1], '25, then 35, 40, 41, 42.'),
      howMuch([25, 25, 10, 5], '25, 50, then 60, 65.'),
      howMuch([10, 10, 10, 5, 1, 1, 1], '10, 20, 30, then 35, 36, 37, 38.'),
    ],
    card: 'You won the Biggest First card! Line the coins up from biggest to smallest, then count on.',
  },
  {
    id: 'dec-change', title: 'Count Up', blurb: 'Give change like a shopkeeper: start at the price and count up to what was paid.', star: 'teakettledrake', skills: ['dm-change'],
    intro: 'Teakettle Dragon runs the lemonade stall. A shopper pays 50 cents for a 35 cent lemonade. How much change?',
    steps: [
      { say: 'The lemonade costs 35 cents. The shopper pays with two quarters: 50 cents.', eq: 'Pay [50¢] for [35¢]', pic: coins(25, 25) },
      { say: 'Shopkeepers count up from the price. Start at 35.', eq: '[35¢]', pic: null },
      { say: 'A nickel makes 40. A dime makes 50!', eq: '35¢, [40¢], [50¢]', pic: coins(5, 10) },
      { say: 'The change is the coins you counted: a nickel and a dime. 15 cents!', eq: 'Change: [15¢]', pic: coins(10, 5) },
    ],
    teach: { q: change(100, 60, 'Count up from 60: 70, 75, then a quarter to 100.'), wrong: '50', says: 'A dollar for 60 cents? 6 take away 1... so 50 cents change!', decoy: '30', fixed: 'Count up from 60: 70, 75, then 100. That is 40 cents change!' },
    tries: [
      change(25, 15, 'Count up from 15: a dime makes 25.'),
      change(50, 20, 'Count up from 20: 25, then 50.'),
      change(100, 45, 'Count up from 45: 50, 75, 100.'),
    ],
    card: 'You won the Count Up card! Start at the price and count up to what they paid.',
  },
  {
    id: 'dec-tenths', title: 'Tenths', blurb: 'A chocolate bar of ten pieces: each piece is one tenth, 0.1.', star: 'popcornpuff', skills: ['dm-tenths'],
    intro: 'Popcorn Puffling found a chocolate bar with 10 pieces. Each piece is one tenth!',
    steps: [
      { say: 'The whole bar is 1. It snaps into 10 equal pieces.', eq: '1 bar = [10] pieces', pic: bar(10) },
      { say: 'One piece is one tenth. We write it 1 over 10, or 0.1.', eq: '[1/10] = [0.1]', pic: bar(1) },
      { say: 'Three pieces are three tenths: 0.3.', eq: '[3/10] = [0.3]', pic: bar(3) },
      { say: 'The first digit after the point counts tenths. 0.7 is 7 pieces.', eq: '[0.7] = 7 tenths', pic: bar(7) },
    ],
    teach: { q: dec('How much of the bar is gold?', 0.4, 'Count the gold pieces: that many tenths.', bar(4)), wrong: '0.04', says: '4 pieces... so it is 0.04!', decoy: '4', fixed: 'Tenths go right after the point. 4 pieces is 0.4!' },
    tries: [
      dec('How much of the bar is gold?', 0.6, 'Count the gold pieces: 6 tenths.', bar(6)),
      dec('How much of the bar is gold?', 0.9, 'Nearly the whole bar: 9 tenths.', bar(9)),
      dec('Write 2/10 as a decimal.', 0.2, '2 tenths: a 2 right after the point.'),
    ],
    card: 'You won the Tenths card! The first digit after the point counts tenths.',
  },
  {
    id: 'dec-hundredths', title: 'Hundredths', blurb: 'A slab of 100 squares, and a dollar of 100 cents: two digits after the point.', star: 'geodemole', skills: ['dm-hund'],
    intro: 'Geode Mole dug up a giant chocolate slab of 100 squares. Each square is one hundredth.',
    steps: [
      { say: '100 squares make 1 whole. One square is 1 over 100, or 0.01.', eq: '[1/100] = [0.01]', pic: grid(1) },
      { say: 'A row of 10 squares is one tenth: 0.1, the same as 0.10.', eq: '[10/100] = [0.10] = [0.1]', pic: grid(10) },
      { say: 'Three rows and 5 more squares: 35 hundredths, 0.35.', eq: '[35/100] = [0.35]', pic: grid(35) },
      { say: 'Money works the same way. A dollar is 100 cents, so 35 cents is 35 hundredths of a dollar.', eq: '35¢ = [$0.35]', pic: coins(25, 10) },
    ],
    teach: { q: dec('How much of the slab is eaten?', 0.07, '7 hundredths: a zero for no tenths, then 7.', grid(7)), wrong: '0.7', says: '7 hundredths? That is 0.7!', decoy: '7', fixed: 'Hundredths need two digits. 7 hundredths is 0.07, like 7 cents is 7 hundredths of a dollar.' },
    tries: [
      dec('How much of the slab is eaten?', 0.48, '4 rows and 8 squares: 48 hundredths.', grid(48)),
      dec('How much of the slab is eaten?', 0.05, '5 squares, no full rows: 0.05.', grid(5)),
      dec('60 cents is how many dollars?', 0.6, '60 hundredths of a dollar: 0.60, the same as 0.6.', coins(25, 25, 10)),
    ],
    card: 'You won the Hundredths card! Two digits after the point count hundredths, like cents.',
  },
  {
    id: 'dec-compare', title: 'Line Up the Points', blurb: 'Which is more, 0.5 or 0.45? Fill in a zero so both have the same digits.', star: 'rollodillo', skills: ['dm-compare'],
    intro: 'Rock Candy Armadillo wants the bigger piece of chocolate. Which is more: 0.5 or 0.45?',
    steps: [
      { say: '0.45 has more digits, so it looks bigger. But is it?', eq: '0.5 [?] 0.45', pic: null },
      { say: 'Give them the same number of digits. 0.5 is the same as 0.50.', eq: '[0.50] ? 0.45', pic: grid(50) },
      { say: '50 hundredths and 45 hundredths. 50 is more!', eq: '[0.50] > 0.45', pic: grid(45) },
      { say: 'So 0.5 is bigger. Line up the points, fill in a zero, then compare.', eq: '[0.5 > 0.45]', pic: null },
    ],
    teach: { q: which('0.3', '0.25', 'a', '0.3 is 0.30: 30 hundredths against 25.'), wrong: 'b', says: '0.25 has a 25, and 25 is more than 3. So 0.25 is more!', decoy: 'same', fixed: '0.3 is 0.30, and 30 hundredths beats 25. 0.3 is more!' },
    tries: [
      which('0.7', '0.65', 'a', '0.7 is 0.70: 70 hundredths against 65.'),
      which('0.4', '0.40', 'same', 'A zero on the end changes nothing: 0.4 is 0.40.'),
      which('0.09', '0.1', 'b', '0.1 is 0.10: 10 hundredths against 9.'),
    ],
    card: 'You won the Line Up the Points card! Fill in zeros so the digits match, then compare.',
  },
  {
    id: 'dec-add', title: 'Line Up and Add', blurb: 'Add and take away decimals: points in a line, then add like whole numbers.', star: 'teakettledrake', skills: ['dm-add', 'dm-sub'],
    intro: 'Teakettle Dragon sells a muffin for $1.25 and a juice for 50 cents. How much for both?',
    steps: [
      { say: 'Write 50 cents as $0.50, and line up the points: cents under cents.', eq: '1.25 + [0.50]', pic: coins(-100, 25, 25, 25) },
      { say: 'Add the hundredths first: 5 and 0 is 5.', eq: '1.2[5]', pic: null },
      { say: 'Then the tenths: 2 and 5 is 7.', eq: '1.[7]5', pic: null },
      { say: 'Then the ones: 1. The point drops straight down. $1.75!', eq: '1.25 + 0.50 = [1.75]', pic: coins(-100, 25, 25, 25) },
    ],
    teach: { q: dec('0.4 + 0.25 = ?', 0.65, 'Write 0.4 as 0.40, then add: 40 and 25 hundredths.'), wrong: '0.29', says: '4 and 25 is 29... so 0.29!', decoy: '0.47', fixed: 'Line up the points: 0.40 + 0.25. That is 0.65!' },
    tries: [
      dec('0.3 + 0.4 = ?', 0.7, '3 tenths and 4 tenths.'),
      dec('1.5 + 0.25 = ?', 1.75, 'Write 1.5 as 1.50, then add.'),
      dec('0.9 − 0.35 = ?', 0.55, 'Write 0.9 as 0.90, then take away 35 hundredths.'),
    ],
    card: 'You won the Line Up and Add card! Points in a line, then add like whole numbers.',
  },
];
export const MARKET_LESSON: Record<string, MarketLesson> = Object.fromEntries(MARKET_LESSONS.map(l => [l.id, l]));

/** The coach's lines for an episode, by voice-line id (content/voice.ts has the same words). */
export const marketLines = (l: MarketLesson): [string, string][] => [[`ep.${l.id}.intro`, l.intro], ...l.steps.map((s, i): [string, string] => [`ep.${l.id}.s${i}`, s.say]), [`ep.${l.id}.card`, l.card]];
