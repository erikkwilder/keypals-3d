// Decimals and money, grades 2 to 5 (Common Core 2.MD.C.8, 4.MD.A.2, 4.NF.C.5-7, 5.NBT.A.2-4, 5.NBT.B.7):
// counting coins, making an amount, giving change, tenths and hundredths, which is bigger, adding and
// taking away decimals, rounding, and times or divide by 10 and 100. The island's coins look like their
// own (a shell, a turtle, a fish, a whale, a sun) but are worth what US coins are worth, so a kid who
// counts them counts real money: penny 1¢, nickel 5¢, dime 10¢, quarter 25¢, a dollar 100¢.
//
// As with the fractions, no generator ever draws again "until it's different": every choice comes from a
// list that already leaves out what it mustn't be, so a question is made in one go.
import type { Rng } from '../../engine/rng';
import { checkAnswer } from './fractions';
import type { Item, Part, Pic, Skill } from './types';

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const int = (rng: Rng, lo: number, hi: number) => Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));
/** a decimal without float dust: 0.1 + 0.2 is 0.3 */
export const dec = (x: number, places = 2) => Number(x.toFixed(places));
const num = (n: number): Part => ({ t: 'num', n: dec(n, 3) });
const money = (cents: number, dollars = false): Part => ({ t: 'money', cents, dollars });
const pic = (p: Pic): Part => ({ t: 'pic', pic: p });
const op = (s: string): Part => ({ t: 'op', s });
const tx = (s: string): Part => ({ t: 'text', s });
const blank: Part = { t: 'blank' };
/** a shuffled copy (Fisher-Yates: one pass, never loops) */
function shuffle<T>(rng: Rng, xs: readonly T[]): T[] { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- the coins ----------
export const COINS = [100, 25, 10, 5, 1] as const;
export type Coin = (typeof COINS)[number];
export const COIN_NAME: Record<number, string> = { 1: 'penny', 5: 'nickel', 10: 'dime', 25: 'quarter', 100: 'dollar coin', [-100]: 'dollar bill' };
export const COIN_ART: Record<number, string> = { 1: 'penny', 5: 'nickel', 10: 'dime', 25: 'quarter', 100: 'dollar', [-100]: 'bill' };
/** a coin's (or a bill's) worth in cents */
export const worth = (c: number) => Math.abs(c);
/** money in words a kid reads: 35¢, $1.35, $2 */
export function moneyText(cents: number, dollars = false): string {
  if (cents < 100 && !dollars) return `${cents}¢`;
  const d = cents / 100;
  return `$${Number.isInteger(d) ? d.toFixed(0) : d.toFixed(2)}`;
}
/** the fewest coins for an amount, biggest first (dollars as coins when `useDollar`) */
export function fewest(cents: number, useDollar = false): number[] {
  const out: number[] = [];
  let left = cents;
  for (const c of useDollar ? COINS : COINS.slice(1)) while (left >= c) { out.push(c); left -= c; }
  return out;
}
/** running totals when counting coins biggest first: 25, 35, 45, 46 */
const runningTotals = (coins: number[]) => { let t = 0; return coins.map(c => (t += worth(c))); };

// ---------- how much money? ----------
export const dmCoins: Skill = {
  id: 'dm-coins', area: 'decimals', grade: 2, standard: '2.MD.C.8',
  name: 'Count the coins', short: 'Count coins', plain: 'Counts coins: pennies (1¢), nickels (5¢), dimes (10¢), quarters (25¢) and dollars, biggest first.',
  input: 'number', fastMs: 9000,
  subs: [{ id: 'small', label: 'pennies and nickels' }, { id: 'dimes', label: 'with dimes' }, { id: 'quarters', label: 'with quarters' }, { id: 'dollars', label: 'with dollars' }],
  make(rng, sub, level) {
    const kinds = sub === 'small' ? [5, 1] : sub === 'dimes' ? [10, 5, 1] : [25, 10, 5, 1];
    const count = level === 1 ? int(rng, 2, sub === 'small' ? 5 : 4) : int(rng, 3, sub === 'small' ? 7 : 6);
    const coins: number[] = Array.from({ length: count }, () => pick(rng, kinds));
    // with quarters: no more than three of them, so it stays under a dollar
    if (sub === 'quarters') { let q = 0; for (let i = 0; i < coins.length; i++) if (coins[i] === 25 && ++q > 3) coins[i] = 10; }
    if (sub === 'dollars') coins.unshift(...Array.from({ length: int(rng, 1, level === 1 ? 1 : 2) }, () => (rng() < 0.5 ? 100 : -100)));
    coins.sort((a, b) => worth(b) - worth(a));
    // the gentle level shows them biggest first; later they come mixed up
    const shown = level === 1 ? coins : shuffle(rng, coins);
    const total = coins.reduce((t, c) => t + worth(c), 0);
    const dollars = sub === 'dollars';
    const runs = runningTotals(coins);
    return {
      skill: 'dm-coins', key: `dm-coins:${sub}`, id: `dm-coins:${shown.join(',')}`,
      ask: dollars ? 'How much money is it, in dollars?' : 'How many cents?',
      prompt: dollars ? [pic({ kind: 'coins', coins: shown }), op('='), tx('$'), blank] : [pic({ kind: 'coins', coins: shown }), op('='), blank, tx('¢')],
      input: 'number', answer: { kind: 'number', value: dollars ? dec(total / 100) : total },
      weight: sub === 'small' ? 1 : sub === 'dimes' ? 2 : sub === 'quarters' ? 3 : 4,
      explain: `Biggest first: ${runs.map(t => moneyText(t, dollars)).join(', ')}. That's ${moneyText(total, dollars)}.`,
      trick: { name: 'Biggest first', say: `Start with the biggest coin, then count on with each one: ${runs.map(t => moneyText(t, dollars)).join(', ')}.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- make the amount (tap coins into the tray) ----------
export const dmMake: Skill = {
  id: 'dm-make', area: 'decimals', grade: 2, standard: '2.MD.C.8',
  name: 'Make the amount', short: 'Make it', plain: 'Makes an amount with coins, like 40¢ from a quarter, a dime and a nickel.',
  input: 'custom', fastMs: 12000,
  subs: [{ id: 'to-50', label: 'up to 50¢' }, { id: 'to-100', label: 'up to a dollar' }],
  make(rng, sub, level) {
    const max = sub === 'to-50' ? 50 : 99;
    // gentle: steps of five (no pennies needed); then any amount
    const target = level === 1 ? 5 * int(rng, 2, max / 5 - (sub === 'to-50' ? 0 : 1)) : int(rng, 11, max);
    const way = fewest(target);
    return {
      skill: 'dm-make', key: `dm-make:${sub}`, id: `dm-make:${target}`,
      ask: `Tap coins into the tray to make ${moneyText(target)}.`, prompt: [tx('Make'), money(target)],
      input: 'custom', custom: { name: 'coins', spec: { target, coins: [25, 10, 5, 1] } },
      answer: { kind: 'number', value: target }, weight: sub === 'to-50' ? 2 : 3,
      explain: `One way: ${way.map(c => moneyText(c)).join(' + ')} = ${moneyText(target)}.`,
      trick: { name: 'Biggest coins first', say: `Take the biggest coin that still fits, then the next: ${way.map(c => COIN_NAME[c]).join(', ')}.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- change (count up from the price) ----------
export const dmChange: Skill = {
  id: 'dm-change', area: 'decimals', grade: 4, standard: '4.MD.A.2',
  name: 'Give change', short: 'Change', plain: 'Works out change by counting up from the price to what was paid.',
  input: 'number', fastMs: 10000,
  subs: [{ id: 'to-50', label: 'paid with 50¢' }, { id: 'to-100', label: 'paid with a dollar' }, { id: 'dollars', label: 'paid with $5' }],
  make(rng, sub, level) {
    const paid = sub === 'to-50' ? 50 : sub === 'to-100' ? 100 : 500;
    const step = level === 1 ? 5 : 1;
    const lo = sub === 'dollars' ? 105 : 5, hi = paid - step;
    const price = step * int(rng, Math.ceil(lo / step), Math.floor(hi / step));
    const change = paid - price;
    const dollars = sub === 'dollars';
    // counting up: to the next ten (or dollar), then to what was paid
    const nextTen = Math.min(paid, Math.ceil(price / 10) * 10), nextDollar = Math.min(paid, Math.ceil(price / 100) * 100);
    const stops = [...new Set([price, nextTen, ...(dollars ? [nextDollar] : []), paid])].filter((x, i, a) => i === 0 || x > a[i - 1]);
    return {
      skill: 'dm-change', key: `dm-change:${sub}`, id: `dm-change:${price}/${paid}`,
      ask: `It costs ${moneyText(price, dollars)}. You pay ${moneyText(paid, dollars)}. How much change?`,
      prompt: [tx('Costs'), money(price, dollars), tx('· paid'), money(paid, dollars), tx('· change'), ...(dollars ? [tx('$')] : []), blank, ...(dollars ? [] : [tx('¢')])],
      input: 'number', answer: { kind: 'number', value: dollars ? dec(change / 100) : change },
      weight: sub === 'to-50' ? 2 : sub === 'to-100' ? 3 : 4,
      explain: `Count up from ${moneyText(price, dollars)}: ${stops.slice(1).map((s, i) => `+${moneyText(s - stops[i])} makes ${moneyText(s, dollars)}`).join(', ')}. Change: ${moneyText(change, dollars)}.`,
      trick: { name: 'Count up', say: 'Start at the price and count up to what was paid: to the next ten first, then the rest.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- tenths ----------
export const dmTenths: Skill = {
  id: 'dm-tenths', area: 'decimals', grade: 4, standard: '4.NF.C.6',
  name: 'Tenths', short: 'Tenths', plain: 'Writes tenths as decimals: 7 of 10 pieces is 7/10, or 0.7.',
  input: 'number', fastMs: 7000,
  subs: [{ id: 'pic', label: 'from a picture' }, { id: 'frac', label: 'from a fraction' }, { id: 'line', label: 'on a number line' }],
  make(rng, sub, level) {
    const n = level === 1 ? int(rng, 1, 9) : sub === 'frac' && rng() < 0.4 ? int(rng, 11, 29) : int(rng, 1, 9);
    const x = dec(n / 10, 1);
    const base = { skill: 'dm-tenths', key: `dm-tenths:${sub}`, weight: sub === 'line' ? 2 : 1, trick: { name: 'Tenths', say: 'One of ten equal pieces is a tenth: 0.1. The first place after the point counts tenths.' } };
    if (sub === 'line') {
      return { ...base, id: `dm-tenths:line:${n}`, ask: `Drag the pin to ${x}.`, prompt: [tx('Find'), num(x)], input: 'numberline', line: { min: 0, max: 1, step: 0.1, labels: 'ends' }, answer: { kind: 'point', x }, explain: `From 0 to 1 is ten jumps of 0.1. ${x} is ${n} jumps from 0.` } as Item;
    }
    if (sub === 'pic') {
      return { ...base, id: `dm-tenths:pic:${n}`, ask: 'The bar has 10 pieces. What decimal is still there?', prompt: [pic({ kind: 'bar', parts: 10, filled: n }), op('='), blank], input: 'number', answer: { kind: 'number', value: x }, explain: `${n} of the 10 pieces: ${n}/10, or ${x}.` } as Item;
    }
    return { ...base, id: `dm-tenths:frac:${n}`, ask: 'Write it as a decimal.', prompt: [{ t: 'frac', n, d: 10 }, op('='), blank], input: 'number', answer: { kind: 'number', value: x }, weight: n > 10 ? 2 : 1, explain: `${n} tenths is ${x}${n > 10 ? `: ${Math.floor(n / 10)} whole and ${n % 10} tenths` : ''}.` } as Item;
  },
  check: (it, a) => (a.kind === 'point' && it.answer.kind === 'point' ? Math.abs(a.x - it.answer.x) < 1e-6 : checkAnswer(it.answer, a)),
};

// ---------- hundredths ----------
export const dmHund: Skill = {
  id: 'dm-hund', area: 'decimals', grade: 4, standard: '4.NF.C.5',
  name: 'Hundredths', short: 'Hundredths', plain: 'Hundredths as decimals and money: 35 of 100 squares is 0.35, like 35¢ is $0.35; 3/10 is the same as 30/100.',
  input: 'number', fastMs: 8000,
  subs: [{ id: 'pic', label: 'from a picture' }, { id: 'frac', label: 'from a fraction' }, { id: 'equal', label: 'tenths into hundredths' }, { id: 'money', label: 'cents as dollars' }],
  make(rng, sub, level) {
    const n = level === 1 ? pick(rng, [5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90]) : int(rng, 1, 99);
    const x = dec(n / 100);
    const base = { skill: 'dm-hund', key: `dm-hund:${sub}`, weight: 2, trick: { name: 'Hundredths', say: 'One of a hundred equal squares is a hundredth: 0.01. Two places after the point count hundredths, just like cents in a dollar.' } };
    if (sub === 'pic') return { ...base, id: `dm-hund:pic:${n}`, ask: 'The slab has 100 squares. What decimal is still there?', prompt: [pic({ kind: 'grid', parts: 100, filled: n }), op('='), blank], input: 'number', answer: { kind: 'number', value: x }, explain: `${n} of 100 squares: ${n}/100, or ${x.toFixed(2)}.` } as Item;
    if (sub === 'money') return { ...base, id: `dm-hund:money:${n}`, ask: 'How many dollars is that?', prompt: [money(n), op('='), tx('$'), blank], input: 'number', answer: { kind: 'number', value: x }, explain: `A cent is a hundredth of a dollar, so ${n}¢ is $${x.toFixed(2)}.` } as Item;
    if (sub === 'equal') {
      const t = int(rng, 1, 9);
      return { ...base, id: `dm-hund:equal:${t}`, ask: 'How many hundredths?', prompt: [{ t: 'frac', n: t, d: 10 }, op('='), { t: 'frac', n: null, d: 100 }], input: 'number', answer: { kind: 'number', value: t * 10 }, weight: 1, explain: `Each tenth is 10 hundredths, so ${t}/10 is ${t * 10}/100 (0.${t} is 0.${t}0).` } as Item;
    }
    return { ...base, id: `dm-hund:frac:${n}`, ask: 'Write it as a decimal.', prompt: [{ t: 'frac', n, d: 100 }, op('='), blank], input: 'number', answer: { kind: 'number', value: x }, explain: `${n} hundredths is ${x.toFixed(2)}${n < 10 ? ': a zero holds the tenths place' : ''}.` } as Item;
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- which is bigger? ----------
function comparePair(rng: Rng, sub: string, level: 1 | 2): [number, number] {
  if (sub === 'tenths') {
    const a = int(rng, 1, 9), b = int(rng, 1, 8);
    return [a / 10, (b >= a ? b + 1 : b) / 10];
  }
  if (sub === 'mixed') {
    // a tenth against hundredths, close together: 0.4 or 0.38
    const t = int(rng, 2, 9), h = t * 10 + pick(rng, level === 1 ? [-3, -2, 2, 3] : [-8, -5, -2, -1, 1, 2, 5]);
    const pair: [number, number] = [t / 10, Math.max(1, Math.min(99, h)) / 100];
    return rng() < 0.5 ? pair : [pair[1], pair[0]];
  }
  // tricky: a zero that changes nothing (0.5 or 0.50), a longer number that's smaller (0.09 or 0.1), wholes
  const k = int(rng, 0, 2);
  if (k === 0) { const t = int(rng, 1, 9); return [t / 10, t / 10]; }
  if (k === 1) { const t = int(rng, 1, 8), small = int(rng, 1, 9) / 100; return rng() < 0.5 ? [small, t / 10] : [t / 10, small]; }
  const w = int(rng, 1, 4), a = dec(w + int(rng, 1, 9) / 10, 1), b = dec(w - 1 + int(rng, 90, 99) / 100);
  return rng() < 0.5 ? [a, b] : [b, a];
}
export const dmCompare: Skill = {
  id: 'dm-compare', area: 'decimals', grade: 4, standard: '4.NF.C.7',
  name: 'Which is bigger?', short: 'Bigger?', plain: 'Compares decimals by lining up the points: 0.4 is more than 0.38, and 0.5 is the same as 0.50.',
  input: 'choice', fastMs: 7000,
  subs: [{ id: 'tenths', label: 'tenths' }, { id: 'mixed', label: 'tenths and hundredths' }, { id: 'tricky', label: 'the tricky ones' }],
  make(rng, sub, level) {
    const [a, b] = comparePair(rng, sub, level);
    const id = Math.abs(a - b) < 1e-9 ? 'same' : a > b ? 'a' : 'b';
    // "0.5 or 0.50": show the second with its zero
    const zeroPair = sub === 'tricky' && id === 'same';
    const bPart: Part = zeroPair ? tx(b.toFixed(2)) : num(b);
    const side = (x: number, p: Part): Part[] => (level === 1 && sub === 'tenths' ? [pic({ kind: 'bar', parts: 10, filled: Math.round(x * 10) }), p] : [p]);
    const big = id === 'a' ? a : b, small = id === 'a' ? b : a;
    return {
      skill: 'dm-compare', key: `dm-compare:${sub}`, id: `dm-compare:${a}:${b}:${zeroPair ? 'z' : ''}`,
      ask: 'Which is bigger?', prompt: [num(a), op('or'), bPart],
      input: 'choice', choices: [{ id: 'a', parts: side(a, num(a)) }, { id: 'same', parts: [tx('The same')] }, { id: 'b', parts: side(b, bPart) }],
      answer: { kind: 'choice', id }, weight: sub === 'tenths' ? 1 : sub === 'mixed' ? 2 : 3,
      explain: id === 'same' ? `${a} and ${b.toFixed(2)} are the same: a zero on the end changes nothing.` : `Line up the points: ${big.toFixed(2)} is more than ${small.toFixed(2)}, so ${big} is bigger.`,
      trick: { name: 'Line up the point', say: 'Write both with the same number of places (0.4 is 0.40), then compare like whole numbers: 40 hundredths is more than 38.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- adding and taking away ----------
function addPair(rng: Rng, sub: string, level: 1 | 2, minus: boolean): [number, number] {
  const places = sub === 'tenths' ? 1 : 2;
  const unit = places === 1 ? 10 : 100;
  const top = level === 1 ? (places === 1 ? 9 : 99) : places === 1 ? 49 : 499;
  let a = int(rng, 1, top), b = int(rng, 1, top);
  if (sub === 'money') { a = 5 * int(rng, 5, level === 1 ? 40 : 99); b = 5 * int(rng, 2, level === 1 ? 20 : 60); }
  if (minus && b > a) [a, b] = [b, a];
  if (minus && a === b) a += places === 1 ? 1 : 5;
  return [a / unit, b / unit];
}
function addSkill(minus: boolean): Skill {
  const id = minus ? 'dm-sub' : 'dm-add';
  return {
    id, area: 'decimals', grade: 5, standard: '5.NBT.B.7',
    name: minus ? 'Take away decimals' : 'Add decimals', short: minus ? 'Take away' : 'Add', plain: minus ? 'Takes away decimals by lining up the points: 1.5 − 0.25 = 1.25.' : 'Adds decimals by lining up the points, like adding money: 1.25 + 0.5 = 1.75.',
    input: 'number', fastMs: 9000,
    subs: minus ? [{ id: 'tenths', label: 'tenths' }, { id: 'hundredths', label: 'hundredths' }] : [{ id: 'tenths', label: 'tenths' }, { id: 'hundredths', label: 'hundredths' }, { id: 'money', label: 'money' }],
    make(rng, sub, level) {
      const [a, b] = addPair(rng, sub, level, minus);
      const ans = dec(minus ? a - b : a + b);
      const isMoney = sub === 'money';
      const show = (x: number): Part => (isMoney ? money(Math.round(x * 100), true) : num(x));
      const w = Math.max(String(a).split('.')[1]?.length ?? 0, String(b).split('.')[1]?.length ?? 0);
      return {
        skill: id, key: `${id}:${sub}`, id: `${id}:${a}:${b}`,
        ask: isMoney ? 'How much is that altogether, in dollars?' : minus ? 'Take it away.' : 'Add them up.',
        prompt: [show(a), op(minus ? '−' : '+'), show(b), op('='), ...(isMoney ? [tx('$')] : []), blank],
        input: 'number', answer: { kind: 'number', value: ans }, weight: sub === 'tenths' ? 2 : 3,
        explain: `Line up the points: ${a.toFixed(w)} ${minus ? '−' : '+'} ${b.toFixed(w)} = ${ans.toFixed(w)}.`,
        trick: { name: 'Line up the point', say: `Write them one over the other with the points in a line (fill gaps with zeros), then ${minus ? 'take away' : 'add'} like whole numbers and keep the point where it is.` },
      };
    },
    check: (it, a) => checkAnswer(it.answer, a),
  };
}
export const dmAdd = addSkill(false);
export const dmSub = addSkill(true);

// ---------- rounding ----------
export const dmRound: Skill = {
  id: 'dm-round', area: 'decimals', grade: 5, standard: '5.NBT.A.4',
  name: 'Round decimals', short: 'Round', plain: 'Rounds decimals to the nearest whole number or tenth: 3.47 is about 3, or 3.5.',
  input: 'number', fastMs: 8000,
  subs: [{ id: 'whole', label: 'to a whole number' }, { id: 'tenth', label: 'to a tenth' }],
  make(rng, sub, level) {
    const w = int(rng, 0, level === 1 ? 9 : 49);
    const x = sub === 'whole' ? dec(w + int(rng, 1, 9) / 10, 1) : dec(w + int(rng, 1, 99) / 100);
    const ans = sub === 'whole' ? Math.round(x) : dec(Math.round(x * 10) / 10, 1);
    const look = sub === 'whole' ? Math.round((x - Math.floor(x)) * 10) : Math.round(x * 100) % 10;
    return {
      skill: 'dm-round', key: `dm-round:${sub}`, id: `dm-round:${sub}:${x}`,
      ask: sub === 'whole' ? `Round ${x} to the nearest whole number.` : `Round ${x} to the nearest tenth.`,
      prompt: [tx('Round'), num(x), tx(sub === 'whole' ? 'to a whole' : 'to a tenth'), op('≈'), blank],
      input: 'number', answer: { kind: 'number', value: ans }, weight: sub === 'whole' ? 2 : 3,
      explain: `Look at the next place: ${look}. ${look >= 5 ? '5 or more rounds up' : '4 or less stays'}, so ${x} rounds to ${ans}.`,
      trick: { name: 'Look next door', say: 'Look at the digit just after the place you round to: 5 or more goes up, 4 or less stays.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- times and divide by 10 and 100 ----------
export const dmTen: Skill = {
  id: 'dm-ten', area: 'decimals', grade: 5, standard: '5.NBT.A.2',
  name: 'Times and divide by 10 and 100', short: '× ÷ 10, 100', plain: 'Moves the digits: times 10 makes each digit worth ten times as much (0.4 × 10 = 4); divide by 10 does the opposite.',
  input: 'number', fastMs: 8000,
  subs: [{ id: 'x10', label: 'times 10' }, { id: 'x100', label: 'times 100' }, { id: 'd10', label: 'divide by 10' }, { id: 'd100', label: 'divide by 100' }],
  make(rng, sub, level) {
    const by = sub.endsWith('100') ? 100 : 10, times = sub.startsWith('x');
    const x = times ? (level === 1 ? int(rng, 1, 9) / 10 : dec(int(rng, 1, 99) / (rng() < 0.5 ? 10 : 100))) : level === 1 ? int(rng, 1, 9) * (by === 10 ? 1 : 10) : int(rng, 2, 999) / (rng() < 0.5 ? 1 : 10);
    const ans = dec(times ? x * by : x / by, 4);
    const moves = by === 100 ? 'two places' : 'one place';
    return {
      skill: 'dm-ten', key: `dm-ten:${sub}`, id: `dm-ten:${sub}:${x}`,
      ask: times ? 'Times it.' : 'Divide it.', prompt: [num(x), op(times ? '×' : '÷'), { t: 'num', n: by }, op('='), blank],
      input: 'number', answer: { kind: 'number', value: ans }, weight: by === 10 ? 2 : 3,
      explain: `${times ? 'Times' : 'Divide by'} ${by}: every digit moves ${moves} to the ${times ? 'left (bigger)' : 'right (smaller)'}. ${dec(x, 4)} ${times ? '×' : '÷'} ${by} = ${ans}.`,
      trick: { name: 'Slide the digits', say: `${times ? 'Times' : 'Divide by'} 10 slides every digit one place ${times ? 'bigger' : 'smaller'}; 100 slides two places.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

export const DECIMAL_SKILLS: Skill[] = [dmCoins, dmMake, dmChange, dmTenths, dmHund, dmCompare, dmAdd, dmSub, dmRound, dmTen];
