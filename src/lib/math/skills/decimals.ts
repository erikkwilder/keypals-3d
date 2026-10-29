// Decimals and money, grades 2 to 5 (Common Core 2.MD.C.8, 4.MD.A.2, 4.NF.C.5-7, 5.NBT.A.2-4, 5.NBT.B.7):
// counting coins, making an amount, giving change, tenths and hundredths, which is bigger, adding and
// taking away decimals, rounding, and times or divide by 10 and 100. The island's coins look like their
// own (a shell, a turtle, a fish, a whale, a sun) but are worth what US coins are worth, so a kid who
// counts them counts real money: penny 1¢, nickel 5¢, dime 10¢, quarter 25¢, a dollar 100¢.
//
// Every skill has six rungs (types.ts): rung 1 gentle (friendly amounts, coins in order, pictures), rung 3
// the full grade-level range, rungs 4 to 6 the stretch (more coins, two things to pay for, numbers past
// one, thousandths, missing parts). Each skill's comment says what its rungs mean. As with the fractions,
// no generator ever draws again "until it's different": every choice comes from a list that already
// leaves out what it mustn't be, so a question is made in one go.
import type { Rng } from '../../engine/rng';
import { checkAnswer } from './fractions';
import { perRung, rungOf, type Item, type Part, type Pic, type Skill } from './types';

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
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

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
/** the fewest coins for an amount, biggest first (dollars as coins when `useDollar`; or from `from` only) */
export function fewest(cents: number, useDollar = false, from?: readonly number[]): number[] {
  const out: number[] = [];
  let left = cents;
  for (const c of from ?? (useDollar ? COINS : COINS.slice(1))) while (left >= c) { out.push(c); left -= c; }
  return out;
}
/** running totals when counting coins biggest first: 25, 35, 45, 46 */
const runningTotals = (coins: number[]) => { let t = 0; return coins.map(c => (t += worth(c))); };

// ---------- how much money? ----------
// rungs: 1 two to five coins, laid out biggest first · 2 up to six, still in order · 3 up to seven, mixed
// up · 4 up to nine, mixed up, more dollars · 5 up to ten · 6 up to twelve, several dollars
export const dmCoins: Skill = {
  id: 'dm-coins', area: 'decimals', grade: 2, standard: '2.MD.C.8',
  name: 'Count the coins', short: 'Count coins', plain: 'Counts coins: pennies (1¢), nickels (5¢), dimes (10¢), quarters (25¢) and dollars, biggest first.',
  input: 'number', fastMs: 9000,
  subs: [{ id: 'small', label: 'pennies and nickels' }, { id: 'dimes', label: 'with dimes' }, { id: 'quarters', label: 'with quarters' }, { id: 'dollars', label: 'with dollars' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const kinds = sub === 'small' ? [5, 1] : sub === 'dimes' ? [10, 5, 1] : [25, 10, 5, 1];
    const [lo, hi] = perRung(r, [[2, 4], [3, 5], [3, 6], [5, 8], [6, 9], [7, 11]] as [number, number][]);
    const count = int(rng, lo, hi + (sub === 'small' ? 1 : 0));
    const coins: number[] = Array.from({ length: count }, () => pick(rng, kinds));
    // with quarters: no more than three of them, and it stays under a dollar (dimes, then nickels, become pennies)
    if (sub === 'quarters') {
      let q = 0; for (let i = 0; i < coins.length; i++) if (coins[i] === 25 && ++q > 3) coins[i] = 10;
      let t = coins.reduce((a, c) => a + c, 0);
      for (const from of [10, 5]) for (let i = 0; i < coins.length && t > 99; i++) if (coins[i] === from) { t -= from - 1; coins[i] = 1; }
    }
    if (sub === 'dollars') coins.unshift(...Array.from({ length: int(rng, ...perRung(r, [[1, 1], [1, 2], [1, 2], [1, 3], [1, 4], [2, 5]] as [number, number][])) }, () => (rng() < 0.5 ? 100 : -100)));
    coins.sort((a, b) => worth(b) - worth(a));
    // the gentle rungs show them biggest first; later they come mixed up
    const shown = r <= 2 ? coins : shuffle(rng, coins);
    const total = coins.reduce((t, c) => t + worth(c), 0);
    const dollars = sub === 'dollars';
    const runs = runningTotals(coins);
    return {
      skill: 'dm-coins', key: `dm-coins:${sub}`, id: `dm-coins:${shown.join(',')}`,
      ask: dollars ? 'How much money is it, in dollars?' : 'How many cents?',
      prompt: dollars ? [pic({ kind: 'coins', coins: shown }), op('='), tx('$'), blank] : [pic({ kind: 'coins', coins: shown }), op('='), blank, tx('¢')],
      input: 'number', answer: { kind: 'number', value: dollars ? dec(total / 100) : total },
      weight: Math.min(5, (sub === 'small' ? 1 : sub === 'dimes' ? 2 : sub === 'quarters' ? 3 : 4) + (r >= 5 ? 1 : 0)),
      explain: `Biggest first: ${runs.map(t => moneyText(t, dollars)).join(', ')}. That's ${moneyText(total, dollars)}.`,
      trick: { name: 'Biggest first', say: `Start with the biggest coin, then count on with each one: ${runs.map(t => moneyText(t, dollars)).join(', ')}.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- make the amount (tap coins into the tray) ----------
// rungs: 1 steps of five (no pennies needed) · 2 mostly steps of five · 3 any amount · 4 any amount without
// quarters · 5 without dimes · 6 without nickels (the tray holds 14 coins: every one of these fits)
export const dmMake: Skill = {
  id: 'dm-make', area: 'decimals', grade: 2, standard: '2.MD.C.8',
  name: 'Make the amount', short: 'Make it', plain: 'Makes an amount with coins, like 40¢ from a quarter, a dime and a nickel.',
  input: 'custom', fastMs: 12000,
  subs: [{ id: 'to-50', label: 'up to 50¢' }, { id: 'to-100', label: 'up to a dollar' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const max = sub === 'to-50' ? 50 : 99;
    const fives = r === 1 || (r === 2 && rng() < 0.6);
    const target = fives ? 5 * int(rng, 2, max / 5 - (sub === 'to-50' ? 0 : 1)) : int(rng, 11, max);
    const coins = perRung(r, [[25, 10, 5, 1], [25, 10, 5, 1], [25, 10, 5, 1], [10, 5, 1], [25, 5, 1], [25, 10, 1]]);
    const way = fewest(target, false, coins);
    return {
      skill: 'dm-make', key: `dm-make:${sub}`, id: `dm-make:${target}${coins.length < 4 ? `:${coins.join('.')}` : ''}`,
      ask: `Tap coins into the tray to make ${moneyText(target)}.`, prompt: [tx('Make'), money(target)],
      input: 'custom', custom: { name: 'coins', spec: { target, coins } },
      answer: { kind: 'number', value: target }, weight: (sub === 'to-50' ? 2 : 3) + (coins.length < 4 ? 1 : 0),
      explain: `One way: ${way.map(c => moneyText(c)).join(' + ')} = ${moneyText(target)}.`,
      trick: { name: 'Biggest coins first', say: `Take the biggest coin that still fits, then the next: ${way.map(c => COIN_NAME[c]).join(', ')}.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- change (count up from the price) ----------
// rungs: 1 prices in tens · 2 prices in fives · 3 any price · 4 two things to pay for, in fives · 5 two
// things, any price · 6 two things, any price, more of them from $5
export const dmChange: Skill = {
  id: 'dm-change', area: 'decimals', grade: 4, standard: '4.MD.A.2',
  name: 'Give change', short: 'Change', plain: 'Works out change by counting up from the price to what was paid.',
  input: 'number', fastMs: 10000,
  subs: [{ id: 'to-50', label: 'paid with 50¢' }, { id: 'to-100', label: 'paid with a dollar' }, { id: 'dollars', label: 'paid with $5' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const paid = sub === 'to-50' ? 50 : sub === 'to-100' ? 100 : 500;
    const step = perRung(r, [10, 5, 1, 5, 1]);
    const two = r >= 4;
    const lo = Math.max(sub === 'dollars' ? 105 : 5, two ? 2 * step : step), hi = paid - step;
    const price = step * int(rng, Math.ceil(lo / step), Math.floor(hi / step));
    // two things: the first at least a step, the second the rest
    const p1 = two ? step * int(rng, 1, price / step - 1) : price, p2 = price - p1;
    const change = paid - price;
    const dollars = sub === 'dollars';
    // counting up: to the next ten (or dollar), then to what was paid
    const nextTen = Math.min(paid, Math.ceil(price / 10) * 10), nextDollar = Math.min(paid, Math.ceil(price / 100) * 100);
    const stops = [...new Set([price, nextTen, ...(dollars ? [nextDollar] : []), paid])].filter((x, i, a) => i === 0 || x > a[i - 1]);
    const tail = [tx('· paid'), money(paid, dollars), tx('· change'), ...(dollars ? [tx('$')] : []), blank, ...(dollars ? [] : [tx('¢')])];
    return {
      skill: 'dm-change', key: `dm-change:${sub}`, id: two ? `dm-change:${p1}+${p2}/${paid}` : `dm-change:${price}/${paid}`,
      ask: two ? `One thing costs ${moneyText(p1, dollars)} and another ${moneyText(p2, dollars)}. You pay ${moneyText(paid, dollars)}. How much change?` : `It costs ${moneyText(price, dollars)}. You pay ${moneyText(paid, dollars)}. How much change?`,
      prompt: two ? [tx('Costs'), money(p1, dollars), op('+'), money(p2, dollars), ...tail] : [tx('Costs'), money(price, dollars), ...tail],
      input: 'number', answer: { kind: 'number', value: dollars ? dec(change / 100) : change },
      weight: Math.min(5, (sub === 'to-50' ? 2 : sub === 'to-100' ? 3 : 4) + (two ? 1 : 0)),
      explain: `${two ? `Together they cost ${moneyText(price, dollars)}. ` : ''}Count up from ${moneyText(price, dollars)}: ${stops.slice(1).map((s, i) => `+${moneyText(s - stops[i])} makes ${moneyText(s, dollars)}`).join(', ')}. Change: ${moneyText(change, dollars)}.`,
      trick: { name: 'Count up', say: `${two ? 'Add the two prices first. Then start' : 'Start'} at the price and count up to what was paid: to the next ten first, then the rest.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- tenths ----------
// rungs: 1 tenths under one · 2 sometimes past one (14/10) · 3 past one more often · 4 a whole bar and
// part of another (1.6), a line from 0 to 2 · 5 a line to 3, fractions to 99 tenths · 6 written in words
// (three and four tenths)
const tenthWords = (n: number) => (n < 10 ? `${ONES[n]} ${n === 1 ? 'tenth' : 'tenths'}` : `${ONES[Math.floor(n / 10)]} and ${ONES[n % 10]} ${n % 10 === 1 ? 'tenth' : 'tenths'}`);
export const dmTenths: Skill = {
  id: 'dm-tenths', area: 'decimals', grade: 4, standard: '4.NF.C.6',
  name: 'Tenths', short: 'Tenths', plain: 'Writes tenths as decimals: 7 of 10 pieces is 7/10, or 0.7.',
  input: 'number', fastMs: 7000,
  subs: [{ id: 'pic', label: 'from a picture' }, { id: 'frac', label: 'from a fraction' }, { id: 'line', label: 'on a number line' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const base = { skill: 'dm-tenths', key: `dm-tenths:${sub}`, weight: sub === 'line' ? 2 : 1, trick: { name: 'Tenths', say: 'One of ten equal pieces is a tenth: 0.1. The first place after the point counts tenths.' } };
    if (sub === 'line') {
      const max = r >= 5 ? 3 : r >= 4 ? 2 : 1;
      let n = int(rng, 1, 10 * max - 1);
      if (n % 10 === 0) n++;
      const x = dec(n / 10, 1);
      return { ...base, id: `dm-tenths:line:${n}`, ask: `Drag the pin to ${x}.`, prompt: [tx('Find'), num(x)], input: 'numberline', line: { min: 0, max, step: 0.1, labels: 'ends' }, answer: { kind: 'point', x }, weight: max > 1 ? 3 : 2, explain: `From 0 to 1 is ten jumps of 0.1. ${x} is ${n} jumps from 0.` } as Item;
    }
    if (sub === 'pic') {
      const two = r >= 4 && rng() < (r === 4 ? 0.4 : 0.5);
      const n = int(rng, 1, 9), x = dec((two ? 10 + n : n) / 10, 1);
      if (two) return { ...base, id: `dm-tenths:pic:1.${n}`, ask: 'Each bar has 10 pieces. What decimal is still there?', prompt: [pic({ kind: 'bar', parts: 10, filled: 10 }), pic({ kind: 'bar', parts: 10, filled: n }), op('='), blank], input: 'number', answer: { kind: 'number', value: x }, weight: 2, explain: `A whole bar and ${n} tenths: 1 + 0.${n} = ${x}.` } as Item;
      return { ...base, id: `dm-tenths:pic:${n}`, ask: 'The bar has 10 pieces. What decimal is still there?', prompt: [pic({ kind: 'bar', parts: 10, filled: n }), op('='), blank], input: 'number', answer: { kind: 'number', value: x }, explain: `${n} of the 10 pieces: ${n}/10, or ${x}.` } as Item;
    }
    const past = rng() < perRung(r, [0, 0.2, 0.4, 0.5, 0.6, 0.6]);
    let n = past ? int(rng, 11, perRung(r, [19, 19, 29, 59, 99, 99])) : int(rng, 1, 9);
    if (n % 10 === 0) n++;
    const x = dec(n / 10, 1);
    if (r >= 6 && rng() < 0.5) return { ...base, id: `dm-tenths:words:${n}`, ask: 'Write it as a decimal.', prompt: [tx(tenthWords(n)), op('='), blank], input: 'number', answer: { kind: 'number', value: x }, weight: 3, explain: `${tenthWords(n)} is ${x}.` } as Item;
    return { ...base, id: `dm-tenths:frac:${n}`, ask: 'Write it as a decimal.', prompt: [{ t: 'frac', n, d: 10 }, op('='), blank], input: 'number', answer: { kind: 'number', value: x }, weight: n > 10 ? 2 : 1, explain: `${n} tenths is ${x}${n > 10 ? `: ${Math.floor(n / 10)} ${n >= 20 ? 'wholes' : 'whole'} and ${n % 10} tenths` : ''}.` } as Item;
  },
  check: (it, a) => (a.kind === 'point' && it.answer.kind === 'point' ? Math.abs(a.x - it.answer.x) < 1e-6 : checkAnswer(it.answer, a)),
};

// ---------- hundredths ----------
// rungs: 1 friendly amounts (25, 50, 75, tens) · 2 steps of five · 3 any number of hundredths · 4 often
// under ten (0.07: a zero holds the tenths), hundredths back into tenths (40/100 = ?/10) · 5 past one
// (135/100 is 1.35, 135 pennies is $1.35) · 6 in words (3 tenths and 5 hundredths), 0.6 = ?/100
export const dmHund: Skill = {
  id: 'dm-hund', area: 'decimals', grade: 4, standard: '4.NF.C.5',
  name: 'Hundredths', short: 'Hundredths', plain: 'Hundredths as decimals and money: 35 of 100 squares is 0.35, like 35¢ is $0.35; 3/10 is the same as 30/100.',
  input: 'number', fastMs: 8000,
  subs: [{ id: 'pic', label: 'from a picture' }, { id: 'frac', label: 'from a fraction' }, { id: 'equal', label: 'tenths into hundredths' }, { id: 'money', label: 'cents as dollars' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const small = r >= 4 && rng() < 0.35;
    const n = small ? int(rng, 1, 9) : r === 1 ? pick(rng, [5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90]) : r === 2 ? 5 * int(rng, 1, 19) : int(rng, 1, 99);
    const x = dec(n / 100);
    const base = { skill: 'dm-hund', key: `dm-hund:${sub}`, weight: 2, trick: { name: 'Hundredths', say: 'One of a hundred equal squares is a hundredth: 0.01. Two places after the point count hundredths, just like cents in a dollar.' } };
    const v = rng();
    if (sub === 'pic') return { ...base, id: `dm-hund:pic:${n}`, ask: 'The slab has 100 squares. What decimal is still there?', prompt: [pic({ kind: 'grid', parts: 100, filled: n }), op('='), blank], input: 'number', answer: { kind: 'number', value: x }, explain: `${n} of 100 squares: ${n}/100, or ${x.toFixed(2)}.` } as Item;
    if (sub === 'money') {
      if (r >= 5 && v < 0.5) { const c = int(rng, 101, 399); return { ...base, id: `dm-hund:pennies:${c}`, ask: 'How many dollars is that?', prompt: [tx(`${c} pennies`), op('='), tx('$'), blank], input: 'number', answer: { kind: 'number', value: dec(c / 100) }, weight: 3, explain: `100 pennies make a dollar, so ${c} pennies is $${(c / 100).toFixed(2)}.` } as Item; }
      return { ...base, id: `dm-hund:money:${n}`, ask: 'How many dollars is that?', prompt: [money(n), op('='), tx('$'), blank], input: 'number', answer: { kind: 'number', value: x }, explain: `A cent is a hundredth of a dollar, so ${n}¢ is $${x.toFixed(2)}.` } as Item;
    }
    if (sub === 'equal') {
      const t = int(rng, 1, 9);
      if (r >= 6 && v < 0.4) return { ...base, id: `dm-hund:equal:0.${t}`, ask: 'How many hundredths?', prompt: [num(t / 10), op('='), { t: 'frac', n: null, d: 100 }], input: 'number', answer: { kind: 'number', value: t * 10 }, weight: 3, explain: `0.${t} is ${t} tenths, and each tenth is 10 hundredths: ${t * 10}/100.` } as Item;
      if (r >= 4 && v < 0.75) return { ...base, id: `dm-hund:equal:back${t}`, ask: 'How many tenths?', prompt: [{ t: 'frac', n: t * 10, d: 100 }, op('='), { t: 'frac', n: null, d: 10 }], input: 'number', answer: { kind: 'number', value: t }, weight: 2, explain: `Every 10 hundredths make a tenth, so ${t * 10}/100 is ${t}/10.` } as Item;
      return { ...base, id: `dm-hund:equal:${t}`, ask: 'How many hundredths?', prompt: [{ t: 'frac', n: t, d: 10 }, op('='), { t: 'frac', n: null, d: 100 }], input: 'number', answer: { kind: 'number', value: t * 10 }, weight: 1, explain: `Each tenth is 10 hundredths, so ${t}/10 is ${t * 10}/100 (0.${t} is 0.${t}0).` } as Item;
    }
    if (r >= 6 && v < 0.4) {
      const t = int(rng, 1, 9), h = int(rng, 1, 9), y = dec(t / 10 + h / 100);
      return { ...base, id: `dm-hund:words:${t}.${h}`, ask: 'Write it as a decimal.', prompt: [tx(`${ONES[t]} ${t === 1 ? 'tenth' : 'tenths'} and ${ONES[h]} ${h === 1 ? 'hundredth' : 'hundredths'}`), op('='), blank], input: 'number', answer: { kind: 'number', value: y }, weight: 3, explain: `${t} tenths and ${h} hundredths: the ${t} goes in the tenths place, the ${h} in the hundredths. ${y.toFixed(2)}.` } as Item;
    }
    if (r >= 5 && v < 0.75) {
      const c = int(rng, 101, 399), y = dec(c / 100);
      return { ...base, id: `dm-hund:frac:${c}`, ask: 'Write it as a decimal.', prompt: [{ t: 'frac', n: c, d: 100 }, op('='), blank], input: 'number', answer: { kind: 'number', value: y }, weight: 3, explain: `${c} hundredths: 100 of them make a whole, so ${y.toFixed(2)}.` } as Item;
    }
    return { ...base, id: `dm-hund:frac:${n}`, ask: 'Write it as a decimal.', prompt: [{ t: 'frac', n, d: 100 }, op('='), blank], input: 'number', answer: { kind: 'number', value: x }, explain: `${n} hundredths is ${x.toFixed(2)}${n < 10 ? ': a zero holds the tenths place' : ''}.` } as Item;
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- which is bigger? ----------
// rungs: 1 tenths with a bar picture on each, far apart · 2 tenths with pictures, closer · 3 no pictures,
// tenths against hundredths close together · 4 with whole numbers (2.4 or 2.38) · 5 thousandths (0.45 or
// 0.405) · 6 the closest thousandths
function comparePair(rng: Rng, sub: string, r: number): [number, number] {
  const w = r >= 4 ? int(rng, 0, perRung(r, [0, 0, 0, 4, 9, 9])) : 0;
  if (sub === 'tenths') {
    const a = int(rng, 1, 9);
    const b = r === 2 ? Math.max(1, Math.min(9, a + pick(rng, [-3, -2, -1, 1, 2, 3]))) : int(rng, 1, 8);
    const bb = r === 2 ? (b === a ? (a === 9 ? 8 : a + 1) : b) : b >= a ? b + 1 : b;
    return [dec(w + a / 10, 1), dec(w + bb / 10, 1)];
  }
  if (sub === 'mixed') {
    // a tenth against hundredths, close together: 0.4 or 0.38 (thousandths from rung 5: 0.45 or 0.405)
    const t = int(rng, 2, 9);
    if (r >= 5) {
      const h = int(rng, 1, 9), a = dec(w + t / 10 + h / 100, 3), b = dec(w + t / 10 + pick(rng, r === 5 ? [0, 1, 2, 3] : [h - 1, h - 1, 0, 1]) / 100 + int(rng, 1, 9) / 1000, 3);
      return rng() < 0.5 ? [a, b] : [b, a];
    }
    const h = t * 10 + pick(rng, perRung(r, [[-3, -2, 2, 3], [-3, -2, -1, 1, 2, 3], [-8, -5, -2, -1, 1, 2, 5]]));
    const pair: [number, number] = [dec(w + t / 10, 1), dec(w + Math.max(1, Math.min(99, h)) / 100)];
    return rng() < 0.5 ? pair : [pair[1], pair[0]];
  }
  // tricky: a zero that changes nothing (0.5 or 0.50), a longer number that's smaller (0.09 or 0.1), wholes
  const k = int(rng, 0, 2);
  if (k === 0) { const t = int(rng, 1, 9); return [dec(w + t / 10, 1), dec(w + t / 10, 1)]; }
  if (k === 1) { const t = int(rng, 1, 8), small = r >= 5 ? dec(int(rng, 1, 99) / 1000, 3) : int(rng, 1, 9) / 100; return rng() < 0.5 ? [dec(w + small, 3), dec(w + t / 10, 1)] : [dec(w + t / 10, 1), dec(w + small, 3)]; }
  const ww = int(rng, 1, 4), a = dec(ww + int(rng, 1, 9) / 10, 1), b = dec(ww - 1 + (r >= 5 ? int(rng, 900, 999) / 1000 : int(rng, 90, 99) / 100), 3);
  return rng() < 0.5 ? [a, b] : [b, a];
}
export const dmCompare: Skill = {
  id: 'dm-compare', area: 'decimals', grade: 4, standard: '4.NF.C.7',
  name: 'Which is bigger?', short: 'Bigger?', plain: 'Compares decimals by lining up the points: 0.4 is more than 0.38, and 0.5 is the same as 0.50.',
  input: 'choice', fastMs: 7000,
  subs: [{ id: 'tenths', label: 'tenths' }, { id: 'mixed', label: 'tenths and hundredths' }, { id: 'tricky', label: 'the tricky ones' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const [a, b] = comparePair(rng, sub, r);
    const id = Math.abs(a - b) < 1e-9 ? 'same' : a > b ? 'a' : 'b';
    const places = r >= 5 ? 3 : 2;
    // "0.5 or 0.50": show the second with its zero (or two zeros)
    const zeroPair = sub === 'tricky' && id === 'same';
    const bPart: Part = zeroPair ? tx(b.toFixed(places)) : num(b);
    const side = (x: number, p: Part): Part[] => (r <= 2 && sub === 'tenths' ? [pic({ kind: 'bar', parts: 10, filled: Math.round(x * 10) }), p] : [p]);
    const big = id === 'a' ? a : b, small = id === 'a' ? b : a;
    return {
      skill: 'dm-compare', key: `dm-compare:${sub}`, id: `dm-compare:${a}:${b}:${zeroPair ? 'z' : ''}`,
      ask: 'Which is bigger?', prompt: [num(a), op('or'), bPart],
      input: 'choice', choices: [{ id: 'a', parts: side(a, num(a)) }, { id: 'same', parts: [tx('The same')] }, { id: 'b', parts: side(b, bPart) }],
      answer: { kind: 'choice', id }, weight: Math.min(5, (sub === 'tenths' ? 1 : sub === 'mixed' ? 2 : 3) + (r >= 5 ? 1 : 0)),
      explain: id === 'same' ? `${a} and ${b.toFixed(places)} are the same: a zero on the end changes nothing.` : `Line up the points: ${big.toFixed(places)} is more than ${small.toFixed(places)}, so ${big} is bigger.`,
      trick: { name: 'Line up the point', say: 'Write both with the same number of places (0.4 is 0.40), then compare like whole numbers: 40 hundredths is more than 38.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- adding and taking away ----------
// rungs: 1 under one (tenths to 0.9, hundredths to 0.99) · 2 to about 2 · 3 to about 5 · 4 to about 10,
// mixed places (1.5 + 0.25) · 5 to about 20, sometimes a missing number (1.25 + __ = 2) · 6 to about 50,
// missing numbers more often
function addPair(rng: Rng, sub: string, r: number, minus: boolean): [number, number] {
  const places = sub === 'tenths' ? 1 : 2;
  const unit = places === 1 ? 10 : 100;
  const top = perRung(r, places === 1 ? [9, 19, 49, 99, 199, 499] : [99, 199, 499, 999, 1999, 4999]);
  let a = int(rng, 1, top), b = int(rng, 1, top);
  if (sub === 'money') { a = 5 * int(rng, 5, perRung(r, [40, 60, 99, 199, 399, 999])); b = 5 * int(rng, 2, perRung(r, [20, 30, 60, 120, 200, 400])); }
  // mixed places: one of them in tenths
  else if (sub === 'hundredths' && r >= 4 && rng() < 0.4) b = 10 * Math.max(1, Math.round(b / 10));
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
    make(rng, sub, rung) {
      const r = rungOf(rung);
      const [a, b] = addPair(rng, sub, r, minus);
      const ans = dec(minus ? a - b : a + b);
      const isMoney = sub === 'money';
      const show = (x: number): Part => (isMoney ? money(Math.round(x * 100), true) : num(x));
      const w = Math.max(String(a).split('.')[1]?.length ?? 0, String(b).split('.')[1]?.length ?? 0);
      const weight = Math.min(5, (sub === 'tenths' ? 2 : 3) + (r >= 5 ? 1 : 0));
      // the stretch: the second number is missing
      if (r >= 5 && !isMoney && rng() < (r === 5 ? 0.3 : 0.4)) return {
        skill: id, key: `${id}:${sub}`, id: `${id}:${a}:?:${ans}`,
        ask: 'What is missing?', prompt: [num(a), op(minus ? '−' : '+'), blank, op('='), num(ans)],
        input: 'number', answer: { kind: 'number', value: b }, weight: Math.min(5, weight + 1),
        explain: minus ? `${a.toFixed(w)} − ${ans.toFixed(w)} = ${b.toFixed(w)}, so ${a.toFixed(w)} − ${b.toFixed(w)} = ${ans.toFixed(w)}.` : `${ans.toFixed(w)} − ${a.toFixed(w)} = ${b.toFixed(w)}, so ${a.toFixed(w)} + ${b.toFixed(w)} = ${ans.toFixed(w)}.`,
        trick: { name: 'Line up the point', say: minus ? 'What takes the first number down to the answer? Take the answer away from the first number, points lined up.' : 'What goes with the first number to make the total? Take the first number away from the total, points lined up.' },
      };
      return {
        skill: id, key: `${id}:${sub}`, id: `${id}:${a}:${b}`,
        ask: isMoney ? 'How much is that altogether, in dollars?' : minus ? 'Take it away.' : 'Add them up.',
        prompt: [show(a), op(minus ? '−' : '+'), show(b), op('='), ...(isMoney ? [tx('$')] : []), blank],
        input: 'number', answer: { kind: 'number', value: ans }, weight,
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
// rungs: 1 numbers under 10 · 2 under 20 · 3 under 50 · 4 under 100, and ones that round up into the next
// whole (3.96 → 4.0) · 5 under 200, thousandths to a tenth (3.456 → 3.5) · 6 under 1,000, two places to a
// whole (4.49 → 4: only the tenths count)
export const dmRound: Skill = {
  id: 'dm-round', area: 'decimals', grade: 5, standard: '5.NBT.A.4',
  name: 'Round decimals', short: 'Round', plain: 'Rounds decimals to the nearest whole number or tenth: 3.47 is about 3, or 3.5.',
  input: 'number', fastMs: 8000,
  subs: [{ id: 'whole', label: 'to a whole number' }, { id: 'tenth', label: 'to a tenth' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const w = int(rng, 0, perRung(r, [9, 19, 49, 99, 199, 999]));
    const v = rng();
    // the number as a whole count of its smallest place: x = N / 10^p
    let N: number, p: number;
    if (sub === 'whole') {
      if (r >= 6 && v < 0.5) { p = 2; N = 100 * w + int(rng, 1, 99); }
      else if (r >= 4 && v < 0.3) { p = 1; N = 10 * w + int(rng, 5, 9); }
      else { p = 1; N = 10 * w + int(rng, 1, 9); }
    } else if (r >= 5 && v < 0.4) { p = 3; N = 1000 * w + int(rng, 1, 999); if (N % 10 === 0) N++; }
    else if (r >= 4 && v < 0.7) { p = 2; N = 100 * w + 90 + int(rng, 5, 9); }
    else { p = 2; N = 100 * w + int(rng, 1, 99); if (N % 10 === 0) N++; }
    const x = dec(N / 10 ** p, p);
    // round to a whole (keep 0 places) or a tenth (keep 1): look at the next digit
    const keep = sub === 'whole' ? 0 : 1, cut = 10 ** (p - keep);
    const look = Math.floor(N / 10 ** (p - keep - 1)) % 10;
    const ans = dec(Math.floor((N + cut / 2) / cut) / 10 ** keep, keep);
    return {
      skill: 'dm-round', key: `dm-round:${sub}`, id: `dm-round:${sub}:${x}`,
      ask: sub === 'whole' ? `Round ${x} to the nearest whole number.` : `Round ${x} to the nearest tenth.`,
      prompt: [tx('Round'), num(x), tx(sub === 'whole' ? 'to a whole' : 'to a tenth'), op('≈'), blank],
      input: 'number', answer: { kind: 'number', value: ans }, weight: Math.min(5, (sub === 'whole' ? 2 : 3) + (r >= 5 ? 1 : 0)),
      explain: `Look at the next place: ${look}. ${look >= 5 ? '5 or more rounds up' : '4 or less stays'}, so ${x} rounds to ${ans}.`,
      trick: { name: 'Look next door', say: 'Look at the digit just after the place you round to: 5 or more goes up, 4 or less stays. The digits after that one don\'t count.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- times and divide by 10 and 100 ----------
// rungs: 1 one digit (0.4 × 10, 70 ÷ 100) · 2 two digits (4.7 × 10, 47 ÷ 10) · 3 tenths or hundredths ·
// 4 hundredths with zeros (0.05 × 100), decimals divided · 5 thousandths (0.035 × 100) · 6 four digits
// with thousandths
export const dmTen: Skill = {
  id: 'dm-ten', area: 'decimals', grade: 5, standard: '5.NBT.A.2',
  name: 'Times and divide by 10 and 100', short: '× ÷ 10, 100', plain: 'Moves the digits: times 10 makes each digit worth ten times as much (0.4 × 10 = 4); divide by 10 does the opposite.',
  input: 'number', fastMs: 8000,
  subs: [{ id: 'x10', label: 'times 10' }, { id: 'x100', label: 'times 100' }, { id: 'd10', label: 'divide by 10' }, { id: 'd100', label: 'divide by 100' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const by = sub.endsWith('100') ? 100 : 10, times = sub.startsWith('x');
    let x: number;
    if (times) x = perRung(r, [
      () => int(rng, 1, 9) / 10, () => int(rng, 11, 99) / 10, () => dec(int(rng, 1, 99) / (rng() < 0.5 ? 10 : 100)),
      () => dec(int(rng, 1, 999) / 100), () => dec(int(rng, 1, 999) / 1000, 3), () => dec(int(rng, 1001, 9999) / 1000, 3),
    ])();
    else x = perRung(r, [
      () => int(rng, 1, 9) * (by === 10 ? 1 : 10), () => int(rng, 11, 99), () => int(rng, 2, 999) / (rng() < 0.5 ? 1 : 10),
      () => dec(int(rng, 1, 999) / 10, 1), () => dec(int(rng, 1, 9999) / 100), () => dec(int(rng, 1001, 9999) / 100),
    ])();
    x = dec(x, 3);
    const ans = dec(times ? x * by : x / by, 6);
    const moves = by === 100 ? 'two places' : 'one place';
    return {
      skill: 'dm-ten', key: `dm-ten:${sub}`, id: `dm-ten:${sub}:${x}`,
      ask: times ? 'Times it.' : 'Divide it.', prompt: [num(x), op(times ? '×' : '÷'), { t: 'num', n: by }, op('='), blank],
      input: 'number', answer: { kind: 'number', value: ans }, weight: Math.min(5, (by === 10 ? 2 : 3) + (r >= 5 ? 1 : 0)),
      explain: `${times ? 'Times' : 'Divide by'} ${by}: every digit moves ${moves} to the ${times ? 'left (bigger)' : 'right (smaller)'}. ${dec(x, 4)} ${times ? '×' : '÷'} ${by} = ${ans}.`,
      trick: { name: 'Slide the digits', say: `${times ? 'Times' : 'Divide by'} 10 slides every digit one place ${times ? 'bigger' : 'smaller'}; 100 slides two places.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

export const DECIMAL_SKILLS: Skill[] = [dmCoins, dmMake, dmChange, dmTenths, dmHund, dmCompare, dmAdd, dmSub, dmRound, dmTen];
