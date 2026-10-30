// Negative numbers and the coordinate plane, grades 5 to 7 (Common Core 5.G.A.1-2, 6.NS.C.5-8, 6.G.A.3,
// 7.NS.A.1-3): points on a map, below zero in real life (temperatures, sea level, owing money), opposites
// on the number line, which is bigger, how far from zero, all four quadrants, distance on the map, adding,
// taking away, times and sharing with negatives, and (lightly) fractions and decimals below zero. The
// pictures are the area's own (types.ts IntPic, drawn by ui/IntPic.svelte): a thermometer, a sea-level
// gauge with a Glimmer swimming or flying, a number line with dots, a coordinate plane with points. Points
// are tapped on the coordinate grid (input 'grid'), dragged on a number line ('numberline') or a
// thermometer (custom 'thermo'); typed answers use the number pad with its minus key always there
// (`signed`), so a positive answer never gives itself away.
//
// Every skill has six rungs (types.ts): rung 1 gentle (small numbers, a picture to count on), rung 3 the
// full grade-level range, rungs 4 to 6 the stretch (bigger numbers, fewer labels, missing numbers, more
// steps). Each skill's comment says what its rungs mean. As in every area, no generator ever draws again
// "until it's different": every choice comes from a list that already leaves out what it mustn't be, so a
// question is made in one go whatever the random numbers. Each kind of question carries the trick for the
// mistake children make with it (the sign of a sum of two negatives, the swapped pair, -7 "bigger" than -3).
import type { Rng } from '../../engine/rng';
import { checkAnswer } from './fractions';
import { perRung, rungOf, type Choice, type GridSpec, type IntPic, type Item, type LineSpec, type Part, type Skill } from './types';

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const int = (rng: Rng, lo: number, hi: number) => Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));
/** a shuffled copy (Fisher-Yates: one pass, never loops) */
function shuffle<T>(rng: Rng, xs: readonly T[]): T[] { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** whole numbers lo..hi */
const range = (lo: number, hi: number) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);
/** a whole number from 1 to `hi`, made negative `neg` of the time */
const signed = (rng: Rng, lo: number, hi: number, neg = 0.5) => { const k = int(rng, lo, hi); return rng() < neg ? -k : k; };
/** a decimal without float dust */
export const dec = (x: number, places = 3) => Number(x.toFixed(places));
/** a number written the way a kid reads it: −3 with a real minus sign */
export const neg = (n: number) => (n < 0 ? `−${String(dec(-n))}` : String(dec(n)));
/** a number inside a sum: (−3) in brackets */
const br = (n: number) => (n < 0 ? `(${neg(n)})` : neg(n));
const pair = (x: number, y: number) => `(${neg(x)}, ${neg(y)})`;

const num = (n: number): Part => ({ t: 'num', n: dec(n) });
/** a number inside a sum: a negative one in brackets */
const numB = (n: number): Part => ({ t: 'num', n: dec(n), paren: n < 0 });
const op = (s: string): Part => ({ t: 'op', s });
const tx = (s: string): Part => ({ t: 'text', s });
const pt = (x: number, y: number): Part => ({ t: 'pt', x, y });
const pic = (p: IntPic): Part => ({ t: 'ipic', pic: p });
const blank: Part = { t: 'blank' };
type Trick = { name: string; say: string };

/** an item of this area: its key from the skill and sub, the rest as given */
function item(skill: string, sub: string, id: string, o: Omit<Item, 'skill' | 'key' | 'id'>): Item {
  return { skill, key: `${skill}:${sub}`, id: `${skill}:${sub}:${id}`, ...o, weight: Math.max(1, Math.min(5, Math.round(o.weight))) };
}
/** a number to type (the minus key always there) */
function typed(skill: string, sub: string, id: string, ask: string, prompt: Part[], value: number, weight: number, explain: string, trick: Trick): Item {
  return item(skill, sub, id, { ask, prompt, input: 'number', signed: true, answer: { kind: 'number', value: dec(value) }, weight, explain, trick });
}
/** choices (given in order; `right` is the right one's id) */
function choose(skill: string, sub: string, id: string, ask: string, prompt: Part[], choices: Choice[], right: string, weight: number, explain: string, trick: Trick): Item {
  return item(skill, sub, id, { ask, prompt, input: 'choice', choices, answer: { kind: 'choice', id: right }, weight, explain, trick });
}
/** a point to tap on the coordinate grid */
function plot(skill: string, sub: string, id: string, ask: string, prompt: Part[], grid: GridSpec, x: number, y: number, weight: number, explain: string, trick: Trick): Item {
  return item(skill, sub, id, { ask, prompt, input: 'grid', grid, answer: { kind: 'point', x, y }, weight, explain, trick });
}
/** a pin to drag on the number line */
function onLine(skill: string, sub: string, id: string, ask: string, prompt: Part[], line: LineSpec, x: number, weight: number, explain: string, trick: Trick): Item {
  return item(skill, sub, id, { ask, prompt, input: 'numberline', line, answer: { kind: 'point', x: dec(x) }, weight, explain, trick });
}
/** pair choices: the right pair and the likely mistakes (the first ones that are new and on the grid) */
function pairChoices(rng: Rng, x: number, y: number, wrong: [number, number][], lo: number, hi: number, count: number): { choices: Choice[]; right: string } {
  const seen = new Set([`${x},${y}`]), keep: [number, number][] = [];
  for (const [a, b] of wrong) {
    const k = `${a},${b}`;
    if (seen.has(k) || a < lo || a > hi || b < lo || b > hi) continue;
    seen.add(k); keep.push([a, b]);
    if (keep.length >= count - 1) break;
  }
  const all = shuffle(rng, [[x, y] as [number, number], ...keep]);
  const ids = ['a', 'b', 'c', 'd'];
  const choices = all.map(([a, b], i) => ({ id: ids[i], parts: [pt(a, b)] }));
  return { choices, right: ids[all.findIndex(([a, b]) => a === x && b === y)] };
}
const sameCheck = (it: Item, a: Parameters<Skill['check']>[1]) => checkAnswer(it.answer, a);
/** a point check that forgives float dust (decimals on a number line) */
const pointCheck = (it: Item, a: Parameters<Skill['check']>[1]) =>
  a.kind === 'point' && it.answer.kind === 'point' ? Math.abs(a.x - it.answer.x) < 1e-6 && Math.abs((a.y ?? 0) - (it.answer.y ?? 0)) < 1e-6 : checkAnswer(it.answer, a);

// ---------- points on the map (the first quadrant) ----------
// rungs: 1 a grid to 5, no zeros · 2 to 6 · 3 to 8, points on an axis too (a zero) · 4 to 10, the read
// choices closer · 5 to 10, moves with three legs · 6 to 10, anything (moves that go back on themselves)
const ACROSS: Trick = { name: 'Across, then up', say: 'The first number says how far across. The second says how far up. Walk along the floor before you climb the ladder!' };
const legWord = (d: number, h: boolean) => `${Math.abs(d)} ${h ? (d > 0 ? 'right' : 'left') : d > 0 ? 'up' : 'down'}`;
export const inPlot: Skill = {
  id: 'in-plot', area: 'integers', grade: 5, standard: '5.G.A.1',
  name: 'Points on the map', short: 'Points', plain: 'Plots and reads points on a grid: (3, 5) is 3 across and 5 up. The first number goes across, the second up.',
  input: 'grid', fastMs: 8000,
  subs: [{ id: 'plot', label: 'put a point' }, { id: 'read', label: 'name a point' }, { id: 'move', label: 'moves on the map' }],
  make(rng, sub, rung) {
    const r = rungOf(rung), N = perRung(r, [5, 6, 8, 10, 10, 10]), lo = r >= 3 ? 0 : 1;
    const grid: GridSpec = { xMin: 0, xMax: N, yMin: 0, yMax: N };
    const x = int(rng, lo, N);
    // (the second number differs from the first on the gentle rungs, so a swapped pair shows)
    const ys = range(lo, N).filter(v => r >= 5 || v !== x), y = pick(rng, ys);
    const explain = `Start at (0, 0). Go ${x} across, then ${y} up: ${pair(x, y)}.`;
    if (sub === 'read') {
      const { choices, right } = pairChoices(rng, x, y, [[y, x], [x + 1, y], [x, y + 1], [x - 1, y], [x, y - 1], [x + 1, y + 1], [x - 1, y - 1]], 0, N, r <= 2 ? 3 : 4);
      return choose('in-plot', sub, `${x},${y}/${N}`, 'Which pair names the gold point?', [pic({ kind: 'plane', xMin: 0, xMax: N, yMin: 0, yMax: N, pts: [{ x, y, c: 'c' }] })], choices, right, r >= 4 ? 2 : 1,
        `It is ${x} across and ${y} up, so it's ${pair(x, y)}. Across first!`, ACROSS);
    }
    if (sub === 'move') {
      // the end and the start are both on the map; the moves join them
      const sx = int(rng, 0, N), sy = int(rng, 0, N);
      const exs = range(0, N).filter(v => v !== sx), eys = range(0, N).filter(v => r >= 2 ? v !== sy : true);
      const ex = pick(rng, exs), ey = r === 1 ? sy : pick(rng, eys);
      const dx = ex - sx, dy = ey - sy;
      const legs: string[] = [];
      // the stretch: the across move in two parts, one of them back the other way
      const backs = r >= 5 ? [-3, -2, -1, 1, 2, 3].filter(b => dx - b !== 0 && Math.sign(b) !== Math.sign(dx - b) && sx + dx - b >= 0 && sx + dx - b <= N) : [];
      if (backs.length && (r === 6 || rng() < 0.6)) { const b = pick(rng, backs); legs.push(legWord(dx - b, true)); if (dy) legs.push(legWord(dy, false)); legs.push(legWord(b, true)); }
      else if (r >= 4 && dy && rng() < 0.4) { legs.push(legWord(dy, false), legWord(dx, true)); }
      else { legs.push(legWord(dx, true)); if (dy) legs.push(legWord(dy, false)); }
      const said = legs.length > 1 ? `${legs.slice(0, -1).join(', ')} and ${legs.at(-1)}` : legs[0];
      return plot('in-plot', sub, `${sx},${sy}>${legs.join('/')}`, `Start at ${pair(sx, sy)}. Go ${said}. Tap where you end up.`, [tx('Start'), pt(sx, sy), tx(`go ${said}`)], grid, ex, ey, 2 + (legs.length > 2 ? 1 : 0) + (r >= 5 ? 1 : 0),
        `Right and left change the first number; up and down change the second. ${pair(sx, sy)} ends at ${pair(ex, ey)}.`,
        { name: 'Right adds, left takes away', say: 'Going right adds to the first number, going left takes away. Going up adds to the second number, going down takes away.' });
    }
    return plot('in-plot', sub, `${x},${y}/${N}`, `Put the treasure at ${pair(x, y)}.`, [tx('Dig at'), pt(x, y)], grid, x, y, r >= 4 ? 2 : 1, explain, ACROSS);
  },
  check: sameCheck,
};

// ---------- below zero in real life ----------
// rungs: 1 a thermometer from −5 to 5, every mark numbered · 2 to ±10, numbers every 2; sometimes in
// words · 3 to ±10, numbers every 5 · 4 to ±20 in twos · 5 to ±30 in fives, the opposite of a story ("up 12
// is +12; down 12 is?") · 6 to ±40 in twos, bigger stories (a drop of 250 m)
const BELOW: Trick = { name: 'Below zero is minus', say: 'Above zero is a plain number. Below zero gets a minus sign: 3 below zero is −3.' };
const SEA: Trick = { name: 'Sea level is zero', say: 'Sea level is 0. Up in the air is plus, under the water is minus: 20 meters under is −20.' };
const GAIN: Trick = { name: 'Plus or minus?', say: 'Having, winning, going up or forward is plus. Owing, losing, going down or back is minus.' };
/** [what plus means, what minus means] for a story number k */
const STORIES: ((k: number) => [string, string])[] = [
  k => [`You have $${k} saved.`, `You owe a friend $${k}.`],
  k => [`You win ${k} points.`, `You lose ${k} points.`],
  k => [`The lift goes up ${k} floors.`, `The lift goes down ${k} floors.`],
  k => [`You take ${k} steps forward.`, `You take ${k} steps back.`],
  k => [`The kite climbs ${k} meters.`, `The anchor drops ${k} meters.`],
];
export const inReal: Skill = {
  id: 'in-real', area: 'integers', grade: 6, standard: '6.NS.C.5',
  name: 'Below zero', short: 'Below zero', plain: 'Uses negative numbers for real things: 5 degrees below zero is −5, 20 meters under the sea is −20, owing $8 is −8.',
  input: 'number', fastMs: 8000,
  subs: [{ id: 'temp', label: 'temperatures' }, { id: 'sea', label: 'above and below sea level' }, { id: 'money', label: 'owing, losing, going down' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const [R, step, label] = perRung(r, sub === 'sea' ? [[5, 1, 1], [10, 1, 2], [10, 1, 5], [20, 2, 10], [50, 5, 10], [100, 10, 50]] : [[5, 1, 1], [10, 1, 2], [10, 1, 5], [20, 2, 10], [30, 5, 10], [40, 2, 10]] as [number, number, number][]);
    // a reading on the scale: a mark (not zero, not the very end), below zero most of the time
    const marks = range(1, R / step - 1).map(k => k * step);
    const k = pick(rng, marks), at = rng() < 0.7 ? -k : k;
    const words = r >= 2 && rng() < (r >= 4 ? 0.5 : 0.35);
    if (sub === 'temp') {
      // set the thermometer yourself: drag the red line to a temperature said in words
      if (rng() < 0.3) return item('in-real', sub, `set${at}/${R}`, { ask: `It is ${k} degrees ${at < 0 ? 'below' : 'above'} zero. Drag the thermometer to show it.`, prompt: [tx(`${k}° ${at < 0 ? 'below' : 'above'} zero`)],
        input: 'custom', signed: true, custom: { name: 'thermo', spec: { min: -R, max: R, step, label } }, answer: { kind: 'number', value: at }, weight: r >= 3 ? 2 : 1,
        explain: `${k} ${at < 0 ? 'below' : 'above'} zero is ${neg(at)}°: ${k / step} ${k / step === 1 ? 'mark' : 'marks'} ${at < 0 ? 'down' : 'up'} from 0.`, trick: BELOW });
      if (words) return typed('in-real', sub, `w${at}`, 'Write the temperature as a number.', [tx(`${k} degrees ${at < 0 ? 'below' : 'above'} zero`), op('='), blank, tx('°')], at, r >= 4 ? 2 : 1,
        `${k} degrees ${at < 0 ? 'below zero is −' : 'above zero is '}${k}°.`, BELOW);
      return typed('in-real', sub, `t${at}/${R}`, 'What temperature does the thermometer show?', [pic({ kind: 'thermo', min: -R, max: R, at, step, label }), op('='), blank, tx('°')], at, r >= 3 ? 2 : 1,
        `The red line stops ${k / step} ${k / step === 1 ? 'mark' : 'marks'} ${at < 0 ? 'below' : 'above'} 0. That's ${neg(at)}°.`, label > step ? { name: 'Count the marks', say: `Find 0, then count the marks: each one is ${step}. Below zero gets a minus sign.` } : BELOW);
    }
    if (sub === 'sea') {
      const what = at < 0 ? pick(rng, ['A submarine is', 'A fish swims', 'A diver is']) : pick(rng, ['A gull flies', 'A balloon floats', 'A lighthouse lamp is']);
      if (words) return typed('in-real', sub, `w${at}`, 'Write it as a number. Sea level is 0.', [tx(`${what} ${k} meters ${at < 0 ? 'below' : 'above'} sea level`), op('→'), blank], at, r >= 4 ? 2 : 1,
        `${at < 0 ? 'Below' : 'Above'} sea level is ${at < 0 ? 'minus' : 'plus'}: ${neg(at)}.`, SEA);
      return typed('in-real', sub, `p${at}/${R}`, 'How high is the Glimmer? Sea level is 0.', [pic({ kind: 'depth', min: -R, max: R, at, step, label, who: at < 0 ? 'swim' : 'fly' }), op('='), blank], at, r >= 3 ? 2 : 1,
        `It is ${k} ${at < 0 ? 'under' : 'above'} the water: ${neg(at)}.`, SEA);
    }
    // stories: owing, losing, going down...
    const kk = perRung(r, [() => int(rng, 2, 9), () => int(rng, 2, 20), () => int(rng, 5, 50), () => int(rng, 10, 100), () => int(rng, 5, 60), () => 5 * int(rng, 20, 100)])();
    const st = pick(rng, STORIES)(kk), minus = rng() < 0.65, v = minus ? -kk : kk;
    if (r === 5 && rng() < 0.7) {
      // the opposite story: plus one way, so what's the other?
      const [p, m] = st;
      return typed('in-real', sub, `o${v}:${p}`, 'Write it as a number.', [tx(`"${minus ? p : m}" is ${minus ? '+' : '−'}${kk}.`), tx(`"${minus ? m : p}" is`), blank], v, 3,
        `It's the opposite way, so the opposite number: ${neg(v)}.`, { name: 'The other way is the opposite', say: 'If one way is +12, the other way is −12: the same size, the other sign.' });
    }
    return typed('in-real', sub, `s${v}:${st[0]}`, 'Write it as a positive or negative number.', [tx(minus ? st[1] : st[0]), op('→'), blank], v, r >= 4 ? 2 : 1,
      `${minus ? 'Owing, losing, going down or back is minus' : 'Having, winning, going up or forward is plus'}: ${neg(v)}.`, GAIN);
  },
  check: sameCheck,
};

// ---------- opposites and the number line ----------
// rungs: 1 a line from −5 to 5, every number written; the opposite of a small number · 2 −6 to 6; to ±20 ·
// 3 −10 to 10; to ±100; "the opposite of 4" on the line · 4 −10 to 10 with only the ends written; the
// opposite of the opposite · 5 −25 to 25 in fives; −(−8) written with signs · 6 −20 to 20 in twos, only the
// ends written; three flips −(−(−3))
const LEFT: Trick = { name: 'Left of zero', say: 'Negative numbers live to the left of 0. −4 is 4 steps left of 0, just as 4 is 4 steps right.' };
const FLIP: Trick = { name: 'Flip the side', say: 'Opposites are the same distance from 0 on different sides: 5 and −5. Two flips bring you back where you started.' };
export const inOpp: Skill = {
  id: 'in-opp', area: 'integers', grade: 6, standard: '6.NS.C.6',
  name: 'Opposites on the line', short: 'Opposites', plain: 'Finds negative numbers on a number line and their opposites: −4 is 4 left of 0, its opposite is 4, and the opposite of −(−4) is −4.',
  input: 'numberline', fastMs: 7000,
  subs: [{ id: 'line', label: 'on the number line' }, { id: 'opp', label: 'the opposite' }, { id: 'read', label: 'read the line' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    if (sub === 'line') {
      const [R, step, labels] = perRung(r, [[5, 1, 'all'], [6, 1, 'all'], [10, 1, 'all'], [10, 1, 'ends'], [25, 5, 'all'], [20, 2, 'ends']] as [number, number, 'all' | 'ends'][]);
      const k = step * int(rng, 1, R / step - 1), x = rng() < 0.7 ? -k : k;
      const line: LineSpec = { min: -R, max: R, step, labels };
      if (r >= 3 && rng() < 0.4) return onLine('in-opp', sub, `o${x}/${R}${labels}`, `Drag the pin to the opposite of ${neg(-x)}.`, [tx('the opposite of'), num(-x)], line, x, 3,
        `The opposite of ${neg(-x)} is the same distance from 0 on the other side: ${neg(x)}.`, FLIP);
      return onLine('in-opp', sub, `${x}/${R}${labels}`, `Drag the pin to ${neg(x)}.`, [tx('Find'), num(x)], line, x, labels === 'ends' ? 3 : r >= 3 ? 2 : 1,
        `${neg(x)} is ${k} ${x < 0 ? 'left' : 'right'} of 0.`, labels === 'ends' ? { name: 'Find zero first', say: 'Zero is right in the middle. Count the marks from 0: left for minus, right for plus.' } : LEFT);
    }
    if (sub === 'read') {
      const [R, step, label] = perRung(r, [[5, 1, 1], [10, 1, 2], [10, 1, 5], [20, 2, 10], [50, 5, 25], [100, 10, 50]] as [number, number, number][]);
      const k = step * int(rng, 1, R / step - 1), x = rng() < 0.75 ? -k : k;
      return typed('in-opp', sub, `${x}/${R}`, 'What number is at the gold dot?', [pic({ kind: 'nline', min: -R, max: R, step, label, dots: [{ x, c: 'c' }] }), op('='), blank], x, label > step ? 2 + (r >= 5 ? 1 : 0) : 1,
        `Count from 0: the dot is ${k / step} ${k / step === 1 ? 'mark' : 'marks'} ${x < 0 ? 'left' : 'right'}${step > 1 ? `, ${step} each` : ''}. ${neg(x)}.`, { name: 'Count from zero', say: 'Find 0, then count the jumps to the dot. Left of 0 gets a minus sign.' });
    }
    // the opposite, written out
    const top = perRung(r, [9, 20, 100, 50, 100, 100]);
    const x = r === 1 ? int(rng, 1, 9) : signed(rng, 1, top);
    if (r >= 6 && rng() < 0.6) return typed('in-opp', sub, `ooo${x}`, 'What is it?', [op('−'), op('('), op('−'), { t: 'num', n: x, paren: true }, op(')'), op('='), blank], -x, 4,
      `Three flips: ${neg(x)}, then ${neg(-x)}, then ${neg(x)}, then ${neg(-x)}. An odd number of flips lands on the other side.`, FLIP);
    if (r >= 5 && rng() < 0.6) return typed('in-opp', sub, `oo${x}`, 'What is it?', [op('−'), { t: 'num', n: x, paren: true }, op('='), blank], -x, 3,
      `The minus in front means "the opposite of": the opposite of ${neg(x)} is ${neg(-x)}.`, { name: 'Minus means opposite', say: 'A minus sign in front means "the opposite of": −(−8) is the opposite of −8, which is 8.' });
    if (r >= 4 && rng() < 0.5) return typed('in-opp', sub, `2${x}`, 'What is it?', [tx('the opposite of the opposite of'), num(x), op('='), blank], x, 3,
      `Flip ${neg(x)} to ${neg(-x)}, then flip back: ${neg(x)}.`, FLIP);
    return typed('in-opp', sub, `1${x}`, 'What is the opposite?', [tx('the opposite of'), num(x), op('='), blank], -x, r >= 3 ? 2 : 1,
      `The opposite of ${neg(x)} is the same distance from 0 on the other side: ${neg(-x)}.`, FLIP);
  },
  check: pointCheck,
};

// ---------- which is bigger? ----------
// rungs: 1 a negative against a positive (to 9) · 2 a negative against 0 or a small positive · 3 two
// negatives to 10 · 4 two negatives close together to 20 · 5 to 50, the trap (−30 or −3) · 6 to 100, close
// together; four to order
const RIGHT_BIG: Trick = { name: 'Further right is bigger', say: 'On the number line the one further right is bigger. −3 is right of −7, so −3 is bigger, even though 7 looks bigger.' };
const PLUS_BEATS: Trick = { name: 'Plus beats minus', say: 'Every positive number is bigger than every negative number, and 0 is bigger than every negative too.' };
/** two different numbers for comparing at a rung (never the same) */
function comparePair(rng: Rng, r: number): [number, number] {
  if (r === 1) { const a = -int(rng, 1, 9), b = int(rng, 1, 9); return rng() < 0.5 ? [a, b] : [b, a]; }
  if (r === 2) { const a = -int(rng, 1, 9), b = int(rng, 0, 3); return rng() < 0.5 ? [a, b] : [b, a]; }
  const R = perRung(r, [9, 9, 10, 20, 50, 100]);
  if (r === 5 && rng() < 0.4) { const k = int(rng, 2, 9), a = -k, b = -10 * k; return rng() < 0.5 ? [a, b] : [b, a]; }
  const a = -int(rng, 2, R);
  const near = r === 4 || r === 6 ? [1, 2, 3] : range(1, Math.max(2, R - 1));
  // (the other one is a few away from the first, on either side, still below zero)
  const offs = near.flatMap(d => [d, -d]).filter(d => a + d < 0 && a + d >= -R);
  return [a, a + pick(rng, offs)];
}
export const inCompare: Skill = {
  id: 'in-compare', area: 'integers', grade: 6, standard: '6.NS.C.7',
  name: 'Bigger or smaller?', short: 'Bigger?', plain: 'Compares and orders negative numbers by where they sit on the number line: −3 > −7 because −3 is further right; −8° is colder than −3°.',
  input: 'choice', fastMs: 6000,
  subs: [{ id: 'pair', label: 'which is bigger' }, { id: 'symbol', label: '< or >' }, { id: 'story', label: 'colder, deeper' }, { id: 'order', label: 'smallest and biggest' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    if (sub === 'order') {
      const R = perRung(r, [9, 10, 15, 20, 50, 100]), n = r >= 4 ? 4 : 3;
      // at least two below zero (one far down: the one that "looks" biggest), the rest anywhere
      const negs = shuffle(rng, range(1, R).map(k => -k)).slice(0, 2);
      const rest = shuffle(rng, range(-R, R).filter(v => v !== 0 && !negs.includes(v))).slice(0, n - 2);
      const all = [...negs, ...rest];
      const want = rng() < 0.5 ? 'smallest' : 'biggest';
      const best = want === 'smallest' ? Math.min(...all) : Math.max(...all);
      const ids = ['a', 'b', 'c', 'd'];
      const shown = shuffle(rng, all);
      return choose('in-compare', sub, `${want}:${[...all].sort((a, b) => a - b).join(',')}`, `Which is the ${want}?`, [tx(`the ${want}`)], shown.map((v, i) => ({ id: ids[i], parts: [num(v)] })), ids[shown.indexOf(best)], n === 4 ? 3 : 2,
        `In order: ${[...all].sort((a, b) => a - b).map(neg).join(', ')}. The ${want} is ${neg(best)}.`, { name: 'Line them up', say: 'Picture the number line. The one furthest left is the smallest, the one furthest right is the biggest.' });
    }
    const [a, b] = comparePair(rng, r);
    const big = Math.max(a, b), small = Math.min(a, b);
    const trick = a < 0 && b < 0 ? RIGHT_BIG : PLUS_BEATS;
    const w = r >= 5 ? 3 : r >= 3 ? 2 : 1;
    if (sub === 'symbol') return choose('in-compare', sub, `${a}:${b}`, 'Which sign goes in the gap?', [num(a), op('?'), num(b)], [{ id: 'lt', parts: [op('<')] }, { id: 'gt', parts: [op('>')] }], a < b ? 'lt' : 'gt', w,
      `${neg(a)} is ${a < b ? 'less' : 'more'} than ${neg(b)}: ${neg(a)} ${a < b ? '<' : '>'} ${neg(b)}.`, { name: 'The open mouth eats the bigger one', say: 'The open side of < or > faces the bigger number, and bigger means further right on the number line.' });
    if (sub === 'story') {
      const kind = pick(rng, ['cold', 'warm', 'deep', 'high'] as const);
      const unit = kind === 'cold' || kind === 'warm' ? '°' : ' m';
      const ask = kind === 'cold' ? 'Which is colder?' : kind === 'warm' ? 'Which is warmer?' : kind === 'deep' ? 'Which diver is deeper?' : 'Which is higher up?';
      const want = kind === 'cold' || kind === 'deep' ? small : big;
      return choose('in-compare', sub, `${kind}:${a}:${b}`, ask, [tx(ask)], [{ id: 'a', parts: [num(a), tx(unit.trim())] }, { id: 'b', parts: [num(b), tx(unit.trim())] }], want === a ? 'a' : 'b', w,
        `${neg(small)}${unit} is further down than ${neg(big)}${unit}, so ${neg(want)}${unit} is ${kind === 'cold' ? 'colder' : kind === 'warm' ? 'warmer' : kind === 'deep' ? 'deeper' : 'higher'}.`,
        { name: 'Colder is smaller', say: 'Colder and deeper mean further down: the smaller number. −8° is colder than −3°, and −20 m is deeper than −5 m.' });
    }
    return choose('in-compare', sub, `${a}:${b}`, 'Which is bigger?', [num(a), op('or'), num(b)], [{ id: 'a', parts: [num(a)] }, { id: 'b', parts: [num(b)] }], big === a ? 'a' : 'b', w,
      `${neg(big)} is further right on the number line than ${neg(small)}, so ${neg(big)} is bigger.`, trick);
  },
  check: sameCheck,
};

// ---------- how far from zero (absolute value) ----------
// rungs: 1 |−k| to 9 with the line drawn · 2 to 20 · 3 to 100, stories in words · 4 two of them added
// (|−3| + |5|), how far apart two numbers are with the line · 5 one taken from another (|−9| − |4|), stories
// comparing two debts · 6 bigger numbers, the size of a difference |3 − 8|
const STEPS: Trick = { name: 'Steps to zero', say: 'Absolute value is how many steps a number is from 0. Steps are never negative, so |−8| = 8 and |8| = 8.' };
export const inAbs: Skill = {
  id: 'in-abs', area: 'integers', grade: 6, standard: '6.NS.C.7c',
  name: 'How far from zero', short: 'Far from 0', plain: 'Absolute value: how far a number is from 0, so |−8| = 8. Owing $30 is a bigger debt than owing $20, even though −30 < −20.',
  input: 'number', fastMs: 7000,
  subs: [{ id: 'abs', label: 'absolute value' }, { id: 'dist', label: 'steps on the line' }, { id: 'story', label: 'how much below, how much owed' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const top = perRung(r, [9, 20, 100, 50, 100, 500]);
    if (sub === 'abs') {
      if (r >= 6 && rng() < 0.5) {
        const a = signed(rng, 1, 20), bs = range(-20, 20).filter(v => v !== a), b = pick(rng, bs), d = Math.abs(a - b);
        return typed('in-abs', sub, `d${a}:${b}`, 'What is it?', [op('|'), num(a), op('−'), numB(b), op('|'), op('='), blank], d, 4, `${neg(a)} − ${br(b)} = ${neg(a - b)}, and |${neg(a - b)}| = ${d}.`, { name: 'Inside first', say: 'Work out what is inside the bars first. Then take its distance from 0.' });
      }
      if (r >= 5 && rng() < 0.5) {
        const a = signed(rng, 5, 50, 0.7), bb = int(rng, 1, Math.abs(a)), b = rng() < 0.5 ? -bb : bb;
        return typed('in-abs', sub, `m${a}:${b}`, 'What is it?', [op('|'), num(a), op('|'), op('−'), op('|'), num(b), op('|'), op('='), blank], Math.abs(a) - bb, 3, `|${neg(a)}| is ${Math.abs(a)} and |${neg(b)}| is ${bb}: ${Math.abs(a)} − ${bb} = ${Math.abs(a) - bb}.`, STEPS);
      }
      if (r >= 4 && rng() < 0.5) {
        const a = signed(rng, 1, 30, 0.7), b = signed(rng, 1, 30, 0.6);
        return typed('in-abs', sub, `p${a}:${b}`, 'What is it?', [op('|'), num(a), op('|'), op('+'), op('|'), num(b), op('|'), op('='), blank], Math.abs(a) + Math.abs(b), 3, `|${neg(a)}| is ${Math.abs(a)} and |${neg(b)}| is ${Math.abs(b)}: together ${Math.abs(a) + Math.abs(b)}.`, STEPS);
      }
      const x = r === 1 ? -int(rng, 1, 9) : signed(rng, 1, top, 0.75);
      const help = r === 1 ? [pic({ kind: 'nline', min: -10, max: 10, step: 1, label: 1, dots: [{ x, c: 'c' }], hops: [{ a: 0, b: x }] })] : [];
      return typed('in-abs', sub, `${x}`, 'How far is it from 0?', [...help, op('|'), num(x), op('|'), op('='), blank], Math.abs(x), r >= 3 ? 2 : 1, `|${neg(x)}| is how far ${neg(x)} is from 0: ${Math.abs(x)} steps.`, STEPS);
    }
    if (sub === 'dist') {
      if (r >= 4) {
        const R = perRung(r, [10, 10, 10, 10, 20, 50]);
        const a = -int(rng, 1, R), b = int(rng, 1, R), d = b - a;
        const help = r === 4 ? [pic({ kind: 'nline', min: -10, max: 10, step: 1, label: 1, dots: [{ x: a, c: 'a' }, { x: b, c: 'b' }] })] : [];
        return typed('in-abs', sub, `ab${a}:${b}`, `How many steps from ${neg(a)} to ${b}?`, [...help, tx('from'), num(a), tx('to'), num(b), op('='), blank], d, 3,
          `From ${neg(a)} to 0 is ${-a} steps, and from 0 to ${b} is ${b}: ${-a} + ${b} = ${d}.`, { name: 'Stop at zero', say: 'Count the steps to 0, then on from 0: add the two.' });
      }
      // (on rung 2 the line goes in twos, so the number is even)
      const xx = r === 1 ? -int(rng, 1, 9) : r === 2 ? -2 * int(rng, 1, 9) : -int(rng, 1, 20);
      const help = r <= 2 ? [pic({ kind: 'nline', min: r === 1 ? -10 : -20, max: r === 1 ? 10 : 20, step: r === 1 ? 1 : 2, label: r === 1 ? 1 : 10, dots: [{ x: xx, c: 'c' }] })] : [];
      return typed('in-abs', sub, `0${xx}`, `How many steps is ${neg(xx)} from 0?`, [...help, tx('from'), num(xx), tx('to'), num(0), op('='), blank], -xx, r >= 3 ? 2 : 1, `${neg(xx)} is ${-xx} steps left of 0.`, STEPS);
    }
    // stories: how much below, how much owed
    if (r >= 5 && rng() < 0.5) {
      const a = int(rng, 5, top), bs = range(2, top).filter(v => v !== a), b = pick(rng, bs);
      const more = Math.max(a, b), less = Math.min(a, b);
      return typed('in-abs', sub, `owe${a}:${b}`, `Mia's balance is −$${a}. Leo's is −$${b}. How much more does ${a > b ? 'Mia' : 'Leo'} owe?`, [tx('Mia'), num(-a), tx('Leo'), num(-b), tx('· more owed $'), blank], more - less, 4,
        `Mia owes $${a} and Leo owes $${b}. ${more} − ${less} = ${more - less}. The bigger debt is the further-down number.`, { name: 'Debt is the size', say: 'How much you owe is the size of the number: −$30 is owing 30. A bigger debt is a smaller number!' });
    }
    const k = int(rng, 2, Math.min(top, r <= 2 ? 20 : top));
    const st = pick(rng, [
      [`A diver is at −${k} m.`, 'How many meters below sea level?', 'meters'],
      [`It is −${k}°.`, 'How many degrees below zero?', 'degrees'],
      [`Your balance is −$${k}.`, 'How much do you owe?', 'dollars'],
      [`The cave floor is at −${k} m.`, 'How deep is it?', 'meters'],
    ] as const);
    return typed('in-abs', sub, `${st[2]}${k}:${st[0]}`, `${st[0]} ${st[1]}`, [tx(st[0]), tx(st[1]), blank], k, r >= 3 ? 2 : 1, `−${k} is ${k} below zero: ${k} ${st[2]}.`, STEPS);
  },
  check: sameCheck,
};

// ---------- all four quadrants ----------
// rungs: 1 a grid from −4 to 4, one number negative · 2 −5 to 5, any corner · 3 −5 to 5, points on an
// axis too · 4 −6 to 6, flips over one line · 5 −6 to 6, flips over both lines · 6 −7 to 7, anything
const QUAD: Trick = { name: 'Across, then up or down', say: 'Start at (0, 0). The first number goes across: plus is right, minus is left. The second goes up or down: plus is up, minus is down.' };
export const inQuad: Skill = {
  id: 'in-quad', area: 'integers', grade: 6, standard: '6.NS.C.6',
  name: 'The whole map', short: 'Four corners', plain: 'Plots and reads points in all four quadrants: (−3, 2) is 3 left and 2 up. Flipping over the x-axis changes the sign of the second number.',
  input: 'grid', fastMs: 8000,
  subs: [{ id: 'plot', label: 'put a point' }, { id: 'read', label: 'name a point' }, { id: 'flip', label: 'flip over an axis' }],
  make(rng, sub, rung) {
    const r = rungOf(rung), R = perRung(r, [4, 5, 5, 6, 6, 7]);
    const grid: GridSpec = { xMin: -R, xMax: R, yMin: -R, yMax: R };
    // a point with at least one negative number (and on the gentle rungs exactly one, and no zeros)
    const vals = range(-R, R).filter(v => r >= 3 || v !== 0);
    let x = pick(rng, vals), y = pick(rng, vals.filter(v => v !== x || r >= 5));
    if (r === 1) { const a = int(rng, 1, R), b = pick(rng, range(1, R).filter(v => v !== a)); [x, y] = rng() < 0.5 ? [-a, b] : [a, -b]; }
    else if (x >= 0 && y >= 0) { if (y > 0 && rng() < 0.5) y = -y; else x = x === 0 ? -int(rng, 1, R) : -x; }
    if (sub === 'read') {
      const { choices, right } = pairChoices(rng, x, y, [[y, x], [-x, y], [x, -y], [-y, x], [-x, -y], [x + 1, y], [x, y - 1]], -R, R, r === 1 ? 3 : 4);
      return choose('in-quad', sub, `${x},${y}/${R}`, 'Which pair names the gold point?', [pic({ kind: 'plane', xMin: -R, xMax: R, yMin: -R, yMax: R, pts: [{ x, y, c: 'c' }] })], choices, right, r >= 4 ? 3 : 2,
        `It is ${Math.abs(x)} ${x < 0 ? 'left' : 'right'} and ${Math.abs(y)} ${y < 0 ? 'down' : 'up'}: ${pair(x, y)}.`, QUAD);
    }
    if (sub === 'flip') {
      // which line: the x-axis (across) changes the second number; the y-axis the first; both, both
      const lines = r >= 5 ? ['x', 'y', 'both'] : ['x', 'y'];
      const pool = lines.filter(l => (l === 'x' ? y !== 0 : l === 'y' ? x !== 0 : x !== 0 || y !== 0));
      const ln = pick(rng, pool.length ? pool : ['both']);
      const fx = ln === 'x' ? x : -x, fy = ln === 'y' ? y : -y;
      const words = ln === 'x' ? 'the x-axis (the line across)' : ln === 'y' ? 'the y-axis (the line up and down)' : 'the x-axis, then the y-axis';
      return plot('in-quad', sub, `${ln}${x},${y}/${R}`, `Flip ${pair(x, y)} over ${words}. Tap where it lands.`, [tx('Flip'), pt(x, y), tx(ln === 'both' ? 'over both axes' : `over the ${ln}-axis`)], grid, fx || 0, fy || 0, ln === 'both' ? 4 : 3,
        ln === 'x' ? `Over the x-axis the first number stays and the second changes sign: ${pair(fx || 0, fy || 0)}.` : ln === 'y' ? `Over the y-axis the second number stays and the first changes sign: ${pair(fx || 0, fy || 0)}.` : `Both numbers change sign: ${pair(fx || 0, fy || 0)}.`,
        { name: 'Mirror flip', say: 'Flip over the x-axis: change the sign of the second number. Flip over the y-axis: change the sign of the first.' });
    }
    return plot('in-quad', sub, `${x},${y}/${R}`, `Put the treasure at ${pair(x, y)}.`, [tx('Dig at'), pt(x, y)], grid, x, y, r >= 3 ? 2 : 1,
      `Start at (0, 0). Go ${Math.abs(x)} ${x < 0 ? 'left' : 'right'}, then ${Math.abs(y)} ${y < 0 ? 'down' : 'up'}.`, QUAD);
  },
  check: sameCheck,
};

// ---------- distance on the map ----------
// rungs: 1 the map drawn, both on one side, to 5 · 2 the map drawn, either side, to 6 · 3 to 8, the map
// sometimes · 4 to 10, no map · 5 to 20 · 6 to 50, up-and-down and across
const SAME_SIDE: Trick = { name: 'Same side: take away', say: 'Both points on the same side of the axis? Take the smaller distance from the bigger: 7 − 2 = 5.' };
const CROSS: Trick = { name: 'Across the axis: add', say: 'Points on opposite sides of the axis? Add their distances from it: 3 + 5 = 8.' };
export const inDist: Skill = {
  id: 'in-dist', area: 'integers', grade: 6, standard: '6.NS.C.8',
  name: 'How far on the map', short: 'Map distance', plain: 'Finds the distance between two points on a line across or up and down: (−3, 4) to (5, 4) is 3 + 5 = 8.',
  input: 'number', fastMs: 9000,
  subs: [{ id: 'same', label: 'on one side' }, { id: 'cross', label: 'across an axis' }, { id: 'story', label: 'map stories' }],
  make(rng, sub, rung) {
    const r = rungOf(rung), R = perRung(r, [5, 6, 8, 10, 20, 50]);
    const across = rng() < 0.5;
    const cross = sub === 'cross' || (sub === 'story' && rng() < 0.6);
    // the two places along the line that changes, and where the line is
    let a: number, b: number;
    if (cross) { a = -int(rng, 1, R - 1); b = int(rng, 1, R - 1); }
    else { const s = rng() < 0.6 ? -1 : 1, ks = shuffle(rng, range(1, R - 1)); a = s * ks[0]; b = s * (ks[1] ?? ks[0] + 1); }
    if (rng() < 0.5) [a, b] = [b, a];
    const at = signed(rng, 1, R - 1);
    const P = across ? [a, at] : [at, a], Q = across ? [b, at] : [at, b];
    const d = Math.abs(a - b);
    const showMap = R <= 10 && (r <= 2 || (r === 3 && rng() < 0.5));
    const map = showMap ? [pic({ kind: 'plane', xMin: -R, xMax: R, yMin: -R, yMax: R, pts: [{ x: P[0], y: P[1], c: 'a', tag: 'A' }, { x: Q[0], y: Q[1], c: 'b', tag: 'B' }], seg: true })] : [];
    const explain = cross ? `${neg(a)} is ${Math.abs(a)} from the axis and ${neg(b)} is ${Math.abs(b)} on the other side: ${Math.abs(a)} + ${Math.abs(b)} = ${d}.` : `Both are on the same side: ${Math.max(Math.abs(a), Math.abs(b))} − ${Math.min(Math.abs(a), Math.abs(b))} = ${d}.`;
    const trick = cross ? CROSS : SAME_SIDE;
    const w = (cross ? 2 : 1) + (r >= 4 ? 1 : 0) + (r >= 6 ? 1 : 0);
    if (sub === 'story') {
      const [p, q] = pick(rng, [['The boat', 'the island'], ['The penguin', 'its igloo'], ['The diver', 'the treasure'], ['The ship', 'the lighthouse']] as const);
      return typed('in-dist', sub, `${P}:${Q}`, `${p} is at ${pair(P[0], P[1])}. ${q[0].toUpperCase() + q.slice(1)} is at ${pair(Q[0], Q[1])}. How many squares apart?`, [...map, tx(p), pt(P[0], P[1]), tx(q), pt(Q[0], Q[1]), op('='), blank], d, w, explain, trick);
    }
    return typed('in-dist', sub, `${P}:${Q}`, 'How far apart are the two points?', [...map, pt(P[0], P[1]), tx('to'), pt(Q[0], Q[1]), op('='), blank], d, w, explain, trick);
  },
  check: sameCheck,
};

// ---------- adding with negatives ----------
// rungs: 1 within 5, a number line to count on · 2 within 10, the line · 3 within 10, temperature
// stories · 4 within 20 · 5 within 50, three numbers · 6 within 100, a missing number (−7 + ? = 3)
const HOP: Trick = { name: 'Hop on the line', say: 'Adding a positive number hops right on the number line. Adding a negative number hops left.' };
const BIGGER_WINS: Trick = { name: 'Bigger size wins', say: 'Different signs? Take the smaller size from the bigger, and keep the sign of the bigger one: −3 + 5 = 2, and 3 + (−5) = −2.' };
const TWO_MINUS: Trick = { name: 'Minus and minus', say: 'Two negatives make a bigger negative: add the sizes and keep the minus. −2 + (−6) = −8.' };
const ZERO_PAIR: Trick = { name: 'Opposites make zero', say: 'A number and its opposite add up to 0: 6 + (−6) = 0. Like owing $6 and paying $6 back.' };
/** a little number line that shows the start (and the hops on the gentlest rung) */
function sumLine(a: number, b: number, hop: boolean): Part[] {
  const s = a + b, lo = Math.min(0, a, s), hi = Math.max(0, a, s);
  const min = Math.min(-5, lo - 1), max = Math.max(5, hi + 1);
  return [pic({ kind: 'nline', min, max, step: 1, label: max - min > 14 ? 2 : 1, dots: [{ x: a, c: 'a' }], hops: hop ? [{ a, b: a + b }] : undefined })];
}
export const inAdd: Skill = {
  id: 'in-add', area: 'integers', grade: 7, standard: '7.NS.A.1',
  name: 'Adding negatives', short: 'Add ±', plain: 'Adds positive and negative numbers: −3 + 5 = 2, 4 + (−7) = −3, −2 + (−6) = −8, and a number and its opposite make 0.',
  input: 'number', fastMs: 8000,
  subs: [{ id: 'negpos', label: 'minus plus a plus' }, { id: 'posneg', label: 'plus a minus' }, { id: 'negneg', label: 'minus plus a minus' }, { id: 'zero', label: 'opposites make zero' }],
  make(rng, sub, rung) {
    const r = rungOf(rung), R = perRung(r, [5, 10, 10, 20, 50, 100]);
    const k1 = int(rng, 1, R), k2 = pick(rng, range(1, R).filter(v => v !== k1 || sub === 'negneg'));
    const w = perRung(r, [1, 2, 2, 3, 3, 4]);
    if (sub === 'zero') {
      const k = int(rng, 1, R), a = rng() < 0.5 ? -k : k;
      if (r >= 6 || (r >= 4 && rng() < 0.6)) {
        const want = r >= 5 ? pick(rng, range(-R, R).filter(v => v !== 0 && v !== a)) : 0, b = want - a;
        return typed('in-add', sub, `m${a}:${want}`, 'What is missing?', [num(a), op('+'), blank, op('='), num(want)], b, w + 1,
          want === 0 ? `${neg(a)} + ${br(-a)} = 0: the opposite of ${neg(a)} is ${neg(-a)}.` : `From ${neg(a)} to ${neg(want)} is ${Math.abs(b)} ${b > 0 ? 'right' : 'left'}: ${neg(b)}.`, want === 0 ? ZERO_PAIR : HOP);
      }
      return typed('in-add', sub, `z${a}`, 'Add them.', [num(a), op('+'), numB(-a), op('='), blank], 0, w, `${neg(a)} and ${neg(-a)} are opposites: they make 0.`, ZERO_PAIR);
    }
    const [a, b] = sub === 'negpos' ? [-k1, k2] : sub === 'posneg' ? [k1, -k2] : [-k1, -k2];
    const s = a + b;
    const trick = sub === 'negneg' ? TWO_MINUS : r <= 2 ? HOP : BIGGER_WINS;
    const explain = sub === 'negneg' ? `${k1} + ${k2} = ${k1 + k2}, and both are minus: ${neg(s)}.` : `Start at ${neg(a)} and hop ${Math.abs(b)} ${b > 0 ? 'right' : 'left'}: you land on ${neg(s)}.`;
    // three numbers
    if (r >= 5 && rng() < 0.35) {
      const c = signed(rng, 1, R);
      return typed('in-add', sub, `3${a}:${b}:${c}`, 'Add them up.', [num(a), op('+'), numB(b), op('+'), numB(c), op('='), blank], s + c, w + 1,
        `Two at a time: ${neg(a)} + ${br(b)} = ${neg(s)}, then ${neg(s)} + ${br(c)} = ${neg(s + c)}.`, { name: 'Two at a time', say: 'Add the first two, then add the third to that. Or put the minus ones together and the plus ones together.' });
    }
    // temperature stories
    if (r >= 3 && sub !== 'negneg' && rng() < 0.3) {
      return typed('in-add', sub, `t${a}:${b}`, `It is ${neg(a)}°. Then it gets ${Math.abs(b)} degrees ${b > 0 ? 'warmer' : 'colder'}. What is the temperature now?`, [num(a), tx('°'), tx(b > 0 ? `${Math.abs(b)}° warmer` : `${Math.abs(b)}° colder`), op('→'), blank, tx('°')], s, w,
        `${neg(a)} + ${br(b)} = ${neg(s)}°.`, HOP);
    }
    const help = r <= 2 ? sumLine(a, b, false) : [];
    return typed('in-add', sub, `${a}:${b}`, 'Add them.', [...help, num(a), op('+'), numB(b), op('='), blank], s, w, explain, trick);
  },
  check: sameCheck,
};

// ---------- taking away with negatives ----------
// rungs: 1 within 5 with the number line · 2 within 10 with the line · 3 within 10 · 4 within 20 · 5 within
// 50 · 6 within 100, a negative taken from a negative both ways
export const inSub: Skill = {
  id: 'in-sub', area: 'integers', grade: 7, standard: '7.NS.A.1c',
  name: 'Taking away with negatives', short: 'Take away ±', plain: 'Takes away with negative numbers: 3 − 7 = −4, −2 − 5 = −7, and taking away a negative adds: 4 − (−3) = 7. The gap from −6° to 4° is 10°.',
  input: 'number', fastMs: 9000,
  subs: [{ id: 'past0', label: 'past zero' }, { id: 'negminus', label: 'minus take away' }, { id: 'minusneg', label: 'take away a minus' }, { id: 'gap', label: 'how far apart' }],
  make(rng, sub, rung) {
    const r = rungOf(rung), R = perRung(r, [5, 10, 10, 20, 50, 100]);
    const w = perRung(r, [1, 2, 2, 3, 3, 4]);
    const help = (a: number, b: number) => (r <= 2 ? sumLine(a, -b, false) : []);
    if (sub === 'past0') {
      const a = int(rng, 1, R - 1), b = int(rng, a + 1, R);
      return typed('in-sub', sub, `${a}:${b}`, 'Take it away.', [...help(a, b), num(a), op('−'), num(b), op('='), blank], a - b, w,
        `${a} − ${a} takes you to 0, and ${b - a} more takes you to ${neg(a - b)}.`, { name: 'Through zero', say: 'Taking away past 0: first take away enough to reach 0, then keep going left. 3 − 7: 3 gets you to 0, 4 more is −4.' });
    }
    if (sub === 'negminus') {
      const a = -int(rng, 1, R), b = int(rng, 1, R);
      return typed('in-sub', sub, `${a}:${b}`, 'Take it away.', [...help(a, b), num(a), op('−'), num(b), op('='), blank], a - b, w,
        `Start at ${neg(a)} and go ${b} further left: ${neg(a - b)}.`, { name: 'Further down', say: 'Taking away from a negative number goes further left: −2 − 5 = −7. Add the sizes, keep the minus.' });
    }
    if (sub === 'minusneg') {
      const a = r <= 2 ? int(rng, 0, R) : signed(rng, 1, R), b = -int(rng, 1, R);
      return typed('in-sub', sub, `${a}:${b}`, 'Take it away.', [num(a), op('−'), numB(b), op('='), blank], a - b, w + (a < 0 ? 1 : 0),
        `Taking away ${neg(b)} is adding ${-b}: ${neg(a)} + ${-b} = ${neg(a - b)}.`, { name: 'Take away a minus: add', say: 'Taking away a negative is the same as adding: 4 − (−3) = 4 + 3 = 7. Two minuses side by side make a plus.' });
    }
    // the gap: how much warmer, how far up
    const lo = -int(rng, 1, R), hi = rng() < 0.65 ? int(rng, 1, R) : pick(rng, range(lo + 1, -1).length ? range(lo + 1, -1) : [0]);
    const d = hi - lo;
    const st = pick(rng, [
      [`How much warmer is ${neg(hi)}° than ${neg(lo)}°?`, `${neg(hi)}°`, `${neg(lo)}°`, 'degrees'],
      [`A diver at ${neg(lo)} m swims up to ${neg(hi)} m. How far up?`, `${neg(hi)} m`, `${neg(lo)} m`, 'meters'],
      [`The temperature goes from ${neg(lo)}° to ${neg(hi)}°. How many degrees did it go up?`, `${neg(hi)}°`, `${neg(lo)}°`, 'degrees'],
    ] as const);
    return typed('in-sub', sub, `${lo}:${hi}:${st[3]}`, st[0], [num(hi), op('−'), numB(lo), op('='), blank], d, w + 1,
      `${neg(hi)} − ${br(lo)} = ${d}${hi > 0 ? `: ${-lo} up to 0, then ${hi} more` : ''}.`, { name: 'Count the gap', say: 'How far apart? Take the lower one from the higher one: 4 − (−6) = 10. Count up to 0, then on.' });
  },
  check: sameCheck,
};

// ---------- times and sharing with negatives ----------
// rungs: 1 the 2, 5 and 10 tables, one negative · 2 tables to 5, either one negative · 3 tables to 10, both
// negative too · 4 tables to 12, a missing number · 5 three numbers · 6 bigger numbers (−15 × 4, −144 ÷ 12)
const SIGNS: Trick = { name: 'Same signs, plus', say: 'Same signs make a positive answer; different signs make a negative one. Then times or share as usual.' };
const COUNT_MINUS: Trick = { name: 'Count the minuses', say: 'Count the minus signs: an even number of them makes plus, an odd number makes minus.' };
function factors(rng: Rng, r: number): [number, number] {
  const T = perRung(r, [[2, 5, 10], range(2, 5), range(2, 10), range(2, 12), range(2, 6), range(2, 12)]);
  const a = pick(rng, T), b = r >= 6 && rng() < 0.5 ? int(rng, 11, 25) : pick(rng, T);
  // which are negative: one (gentle), either, or both
  const both = r >= 3 && rng() < 0.35;
  return both ? [-a, -b] : rng() < 0.5 ? [-a, b] : [a, -b];
}
export const inMult: Skill = {
  id: 'in-mult', area: 'integers', grade: 7, standard: '7.NS.A.2',
  name: 'Times and share with negatives', short: '× ÷ ±', plain: 'Multiplies and divides with negatives: same signs give a positive answer, different signs a negative one. −3 × 4 = −12, −6 × (−2) = 12, −12 ÷ 3 = −4.',
  input: 'number', fastMs: 8000,
  subs: [{ id: 'times', label: 'times' }, { id: 'divide', label: 'sharing' }, { id: 'sign', label: 'plus or minus?' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const [a, b] = factors(rng, r), p = a * b;
    const w = perRung(r, [1, 2, 2, 3, 4, 4]);
    if (sub === 'sign') {
      const more = r >= 4 ? perRung(r, [[], [], [], [signed(rng, 2, 5)], [signed(rng, 2, 5)], [signed(rng, 2, 5), signed(rng, 2, 3)]]) : [];
      const all = [a, b, ...more], prod = all.reduce((t, v) => t * v, 1), minus = all.filter(v => v < 0).length;
      const divide = r === 3 && rng() < 0.5;
      const parts: Part[] = divide ? [num(p), op('÷'), numB(a)] : all.flatMap((v, i) => (i ? [op('×'), numB(v)] : [num(v)]));
      const isPlus = divide ? b > 0 : prod > 0;
      return choose('in-mult', sub, `${divide ? 'd' : 't'}${all.join(',')}`, 'Is the answer positive or negative?', parts, [{ id: 'pos', parts: [tx('Positive (+)')] }, { id: 'neg', parts: [tx('Negative (−)')] }], isPlus ? 'pos' : 'neg', w,
        divide ? `${neg(p)} ÷ ${br(a)}: ${(p < 0) === (a < 0) ? 'same signs, so positive' : 'different signs, so negative'}.` : `${minus} minus ${minus === 1 ? 'sign' : 'signs'}: ${minus % 2 ? 'odd, so negative' : 'even, so positive'}.`, all.length > 2 ? COUNT_MINUS : SIGNS);
    }
    if (sub === 'divide') {
      if (r >= 4 && rng() < 0.3) return typed('in-mult', sub, `m${p}:${a}`, 'What is missing?', [num(p), op('÷'), blank, op('='), num(b)], a, w + 1, `${neg(p)} ÷ ${br(a)} = ${neg(b)}, because ${neg(a)} × ${br(b)} = ${neg(p)}.`, SIGNS);
      return typed('in-mult', sub, `${p}:${a}`, 'Share it.', [num(p), op('÷'), numB(a), op('='), blank], b, w,
        `${Math.abs(p)} ÷ ${Math.abs(a)} = ${Math.abs(b)}, and ${(p < 0) === (a < 0) ? 'the signs are the same, so it\'s positive' : 'the signs are different, so it\'s negative'}: ${neg(b)}.`, SIGNS);
    }
    if (r >= 5 && rng() < 0.5) {
      const c = signed(rng, 2, r === 5 ? 3 : 5), all = [a, b, c], q = p * c, minus = all.filter(v => v < 0).length;
      return typed('in-mult', sub, `3${all.join(',')}`, 'Times them.', [num(a), op('×'), numB(b), op('×'), numB(c), op('='), blank], q, 5,
        `${Math.abs(a)} × ${Math.abs(b)} × ${Math.abs(c)} = ${Math.abs(q)}, and ${minus} minus ${minus === 1 ? 'sign is' : 'signs are'} ${minus % 2 ? 'odd: negative' : 'even: positive'}. ${neg(q)}.`, COUNT_MINUS);
    }
    if (r >= 4 && rng() < 0.3) return typed('in-mult', sub, `m${a}:${p}`, 'What is missing?', [num(a), op('×'), blank, op('='), num(p)], b, w + 1, `${neg(a)} × ${br(b)} = ${neg(p)}.`, SIGNS);
    return typed('in-mult', sub, `${a}:${b}`, 'Times them.', [num(a), op('×'), numB(b), op('='), blank], p, w,
      `${Math.abs(a)} × ${Math.abs(b)} = ${Math.abs(p)}, and ${(a < 0) === (b < 0) ? 'the signs are the same, so it\'s positive' : 'the signs are different, so it\'s negative'}: ${neg(p)}.`, SIGNS);
  },
  check: sameCheck,
};

// ---------- fractions and decimals below zero ----------
// rungs: 1 halves on a line from −2 to 2 · 2 halves to ±3 · 3 tenths between −1 and 1 · 4 quarters to ±2
// (as decimals) · 5 halves to ±5 with only the ends written; bigger sums · 6 tenths to ±2, three numbers
const HALVES: Trick = { name: 'Same rules, smaller steps', say: 'Decimals below zero work like whole numbers below zero: further left is smaller, and the sign rules stay the same.' };
export const inRat: Skill = {
  id: 'in-rat', area: 'integers', grade: 7, standard: '7.NS.A.1d',
  name: 'Fractions and decimals below zero', short: 'Below 0: ½ 0.5', plain: 'Places, compares, adds and multiplies negative decimals and fractions: −1.5 is halfway between −1 and −2; −0.5 × 6 = −3; −3 ÷ 4 = −0.75.',
  input: 'number', fastMs: 10000,
  subs: [{ id: 'line', label: 'on the number line' }, { id: 'compare', label: 'which is bigger' }, { id: 'add', label: 'add and take away' }, { id: 'times', label: 'times and share' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const [R, step, labels] = perRung(r, [[2, 0.5, 'all'], [3, 0.5, 'all'], [1, 0.1, 'ends'], [2, 0.25, 'ends'], [5, 0.5, 'ends'], [2, 0.1, 'ends']] as [number, number, 'all' | 'ends'][]);
    const n = Math.round(R / step);
    // a point on the line that isn't a whole number (mostly below zero)
    const parts = range(1, n - 1).filter(k => !Number.isInteger(dec(k * step))), k = pick(rng, parts.length ? parts : [1]);
    const x = dec((rng() < 0.75 ? -k : k) * step);
    const w = perRung(r, [1, 2, 2, 3, 3, 4]);
    if (sub === 'line') return onLine('in-rat', sub, `${x}/${R}`, `Drag the pin to ${neg(x)}.`, [tx('Find'), num(x)], { min: -R, max: R, step, labels }, x, w,
      `${neg(x)} is between ${neg(x < 0 ? Math.ceil(x) : Math.floor(x))} and ${neg(x < 0 ? Math.floor(x) : Math.ceil(x))}, ${k} small ${k === 1 ? 'step' : 'steps'} of ${step} from 0.`,
      { name: 'Between the wholes', say: '−1.5 is halfway between −1 and −2. Find the whole numbers on each side first, then the small steps.' });
    if (sub === 'compare') {
      // two different decimals: below zero both (from rung 2), closer together higher up
      const ys = range(1, n - 1).map(j => dec(j * step)).filter(v => v !== Math.abs(x));
      const yy = pick(rng, ys.length ? ys : [dec(Math.abs(x) + step)]);
      const y = r === 1 ? yy : -yy;
      const a = rng() < 0.5 ? x : y, b = a === x ? y : x, big = Math.max(a, b);
      return choose('in-rat', sub, `${a}:${b}`, 'Which is bigger?', [num(a), op('or'), num(b)], [{ id: 'a', parts: [num(a)] }, { id: 'b', parts: [num(b)] }], big === a ? 'a' : 'b', w,
        `${neg(big)} is further right on the number line, so it's bigger.`, a < 0 && b < 0 ? { name: 'Closer to zero is bigger', say: 'Two below zero: the one closer to 0 is bigger. −0.25 is bigger than −0.5.' } : RIGHT_BIG);
    }
    if (sub === 'times') {
      // (sharing a whole number: only by 2, 4 or 5, so the decimal ends)
      const m = perRung(r, [range(2, 6), range(2, 4), range(2, 9), [2, 4, 5], range(2, 9), range(2, 5)]);
      const t = pick(rng, m), sgn = r >= 5 && rng() < 0.5 ? -1 : 1;
      if (r === 2 || r === 4 || (r === 6 && rng() < 0.5)) {
        // sharing: a negative whole number shared into a decimal (−3 ÷ 4 = −0.75), or a negative decimal shared
        const top = r === 4 ? -pick(rng, range(1, 7).filter(v => v % t !== 0 || t === 1)) : dec(x * t), q = dec(top / (sgn * t));
        return typed('in-rat', sub, `d${top}:${sgn * t}`, 'Share it.', [num(top), op('÷'), numB(sgn * t), op('='), blank], q, w + 1,
          `${neg(Math.abs(top))} ÷ ${t} = ${dec(Math.abs(top) / t)}, and ${(top < 0) === (sgn < 0) ? 'the signs are the same: positive' : 'the signs are different: negative'}. ${neg(q)}.`, SIGNS);
      }
      const p = dec(x * sgn * t);
      return typed('in-rat', sub, `t${x}:${sgn * t}`, 'Times them.', [num(x), op('×'), numB(sgn * t), op('='), blank], p, w,
        `${dec(Math.abs(x))} × ${t} = ${dec(Math.abs(p))}, and ${(x < 0) === (sgn < 0) ? 'the signs are the same: positive' : 'the signs are different: negative'}. ${neg(p)}.`, SIGNS);
    }
    // adding and taking away
    const W = perRung(r, [3, 3, 2, 3, 10, 5]);
    const b = r <= 2 ? int(rng, 1, W) : pick(rng, [dec(int(rng, 1, W * Math.round(1 / step)) * step), int(rng, 1, W)]);
    const minus = r >= 2 && rng() < 0.4, bb = minus ? -b : b;
    if (r >= 6 && rng() < 0.4) {
      const c = dec(-int(rng, 1, 9) * 0.1), s3 = dec(x + bb + c);
      return typed('in-rat', sub, `3${x}:${bb}:${c}`, 'Add them up.', [num(x), op('+'), numB(bb), op('+'), numB(c), op('='), blank], s3, 5,
        `${neg(x)} + ${br(bb)} = ${neg(dec(x + bb))}, then + ${br(c)} = ${neg(s3)}.`, HALVES);
    }
    const s = dec(x + bb);
    return typed('in-rat', sub, `${x}:${bb}`, 'Add them.', [num(x), op('+'), numB(bb), op('='), blank], s, w,
      `Start at ${neg(x)} and go ${dec(Math.abs(bb))} ${bb > 0 ? 'right' : 'left'}: ${neg(s)}.`, bb < 0 ? TWO_MINUS : HOP);
  },
  check: pointCheck,
};

export const INTEGER_SKILLS: Skill[] = [inPlot, inReal, inOpp, inCompare, inAbs, inQuad, inDist, inAdd, inSub, inMult, inRat];
