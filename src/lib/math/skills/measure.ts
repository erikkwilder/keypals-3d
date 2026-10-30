// Measurement and time, grades 1 to 6 (Common Core 1.MD.A.1-2, 1.MD.B.3, 2.MD.A.1-4, 2.MD.C.7, 3.MD.A.1-2,
// 3.MD.C.5-7, 3.MD.D.8, 4.MD.A.1-2, 5.MD.A.1, 5.MD.C.3-5, 6.RP.A.3): telling time on a clock with hands
// (o'clock and half past, five minutes and a.m. or p.m., to the minute), how long things take, comparing
// lengths, measuring with a ruler, weighing and pouring, area, perimeter, changing units, the volume of a
// box of cubes, and changing units with ratios.
//
// The area brings its own pictures (a 'meas' part: a clock, a ruler with something on it, a scale, a jug,
// a garden of squares, a box of cubes, a table) drawn by skills/ui/MeasurePic.svelte, and its own inputs:
// clock hands to drag ('clock'), a ribbon to pull along a ruler ('ruler') and water to pour into a jug
// ('jug'), in skills/ui/ (registered in SkillInput). Times are in 12-hour minutes (3:30 is 210), so a
// clock answer is right whatever the hour hand's lap.
//
// Every skill has six rungs (types.ts): rung 1 gentle (every number on the clock face, things starting at
// 0, small numbers, grid lines to count), rung 3 the grade-level range, rungs 4 to 6 the stretch (fewer
// numbers on the face, things not starting at 0, between the labels, missing sides, bigger numbers, small
// units back to big ones). Each skill's comment says what its rungs mean. As in the other areas, no
// generator draws again "until it's different": every choice comes from a list that already leaves out
// what it mustn't be, so a question is made in one go.
import type { Rng } from '../../engine/rng';
import { checkAnswer } from './fractions';
import { perRung, rungOf, type Choice, type Item, type Part, type Skill } from './types';

const int = (rng: Rng, lo: number, hi: number) => Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
function shuffle<T>(rng: Rng, xs: readonly T[]): T[] { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const dec = (x: number, p = 2) => Number(x.toFixed(p));
const tx = (s: string): Part => ({ t: 'text', s });
const num = (n: number): Part => ({ t: 'num', n });
const op = (s: string): Part => ({ t: 'op', s });
const blank: Part = { t: 'blank' };

// ---------- the area's pictures ----------
/** things to measure: painted, lying left to right (public/math/measure/<thing>.webp) */
export type Thing = 'pencil' | 'crayon' | 'caterpillar' | 'brush' | 'carrot' | 'key' | 'feather' | 'spoon';
export const THINGS: Thing[] = ['pencil', 'crayon', 'caterpillar', 'brush', 'carrot', 'key', 'feather', 'spoon'];
export const THING_NAME: Record<Thing, string> = { pencil: 'pencil', crayon: 'crayon', caterpillar: 'caterpillar', brush: 'paintbrush', carrot: 'carrot', key: 'key', feather: 'feather', spoon: 'spoon' };
/** a face's numbers: all twelve, just 12, 3, 6 and 9, or none (marks only) */
export type Face = 'all' | 'quarters' | 'none';
/** a rectangle on a squared garden, in squares */
export type Rect = { x: number; y: number; w: number; h: number };
/** a side's words, from (x1, y1) to (x2, y2) on the outline */
export type Side = { x1: number; y1: number; x2: number; y2: number; text: string };
export type MeasPic =
  /** a clock with hands showing h:m */
  | { kind: 'clock'; h: number; m: number; face: Face }
  /** a digital time (3:30), with a.m. or p.m. when given */
  | { kind: 'time'; h: number; m: number; ap?: 'a.m.' | 'p.m.' }
  /** one thing, small (in a choice) */
  | { kind: 'thing'; thing: Thing }
  /** things lying above a ruler from `from` to `to` (in its units); `ticks` marks per unit (2: halves) */
  | { kind: 'ruler'; unit: 'cm' | 'in'; len: number; ticks: number; items: { thing: Thing; from: number; to: number }[] }
  /** things in rows (lined up at the left, or not), on squared paper when `grid`; `units`: a row of cubes or clips under the first */
  | { kind: 'lengths'; items: { thing: Thing; from: number; len: number }[]; grid: boolean; max: number; units?: 'cube' | 'clip' }
  /** a dial scale: the needle at `value`, marks every `step`, numbers every `label` */
  | { kind: 'scale'; max: number; step: number; label: number; value: number; unit: 'g' | 'kg'; load: string }
  /** a jug of water up to `value`, marks every `step`, numbers every `label` */
  | { kind: 'jug'; max: number; step: number; label: number; value: number; unit: 'mL' | 'L' }
  /** a garden made of rectangles: squares drawn when `grid` ('edge': just along two sides), sides' words, a cut-out corner */
  | { kind: 'shape'; rects: Rect[]; grid: boolean | 'edge'; sides: Side[]; fence?: boolean; cut?: Rect }
  /** a box of unit cubes, l by w by h: every cube drawn, or a plain box with its edges' lengths */
  | { kind: 'box'; l: number; w: number; h: number; cubes: boolean; labels?: [string, string, string] }
  /** a little table of matching amounts (a ratio table), one cell a gap */
  | { kind: 'table'; head: [string, string]; rows: [string, string][] };
export const meas = (m: MeasPic): Part => ({ t: 'meas', m });

// ---------- time ----------
/** 1..12 */
export const hour12 = (h: number) => ((((h - 1) % 12) + 12) % 12) + 1;
/** minutes past 12 o'clock on a 12-hour clock (0..719): 3:30 is 210 */
export const clockMins = (h: number, m: number) => (hour12(h) % 12) * 60 + m;
export const fromMins = (t: number): [number, number] => { const x = ((Math.round(t) % 720) + 720) % 720; return [hour12(Math.floor(x / 60) || 12), x % 60]; };
/** 3:05 */
export const timeText = (h: number, m: number) => `${hour12(h)}:${String(m).padStart(2, '0')}`;
/** in words: 3 o'clock, half past 3, quarter to 4, 20 past 6, 13 minutes to 8 */
export function timeWords(h: number, m: number): string {
  const H = hour12(h), N = hour12(h + 1);
  if (m === 0) return `${H} o'clock`;
  if (m === 30) return `half past ${H}`;
  if (m === 15) return `quarter past ${H}`;
  if (m === 45) return `quarter to ${N}`;
  if (m < 30) return m % 5 ? `${m} ${m === 1 ? 'minute' : 'minutes'} past ${H}` : `${m} past ${H}`;
  const to = 60 - m;
  return to % 5 ? `${to} ${to === 1 ? 'minute' : 'minutes'} to ${N}` : `${to} to ${N}`;
}
const timePart = (h: number, m: number, ap?: 'a.m.' | 'p.m.') => meas({ kind: 'time', h: hour12(h), m, ap });
/** a clock answer: the same time whatever the hour hand's lap */
const sameTime = (it: Item, a: { kind: string; value?: number }) =>
  it.answer.kind === 'number' && a.kind === 'number' ? ((((a.value ?? 0) - it.answer.value) % 720) + 720) % 720 === 0 : false;
/** Choices of times: the right one and the first different wrong ones (as clocks' digital times, or words). */
function timeChoices(rng: Rng, right: [number, number], wrongs: [number, number][], n: number, words: boolean): { choices: Choice[]; id: string } {
  const key = ([h, m]: [number, number]) => clockMins(h, m);
  const seen = new Set([key(right)]), out: [number, number][] = [];
  for (const w of wrongs) {
    if (w[1] < 0 || w[1] > 59 || seen.has(key(w))) continue;
    seen.add(key(w)); out.push([hour12(w[0]), w[1]]);
    if (out.length >= n - 1) break;
  }
  const all = shuffle(rng, [right, ...out]);
  const ids = ['a', 'b', 'c', 'd'];
  const choices = all.map(([h, m], i) => ({ id: ids[i], parts: words ? [tx(timeWords(h, m))] : [timePart(h, m)] }));
  return { choices, id: ids[all.findIndex(t => key(t) === key(right))] };
}
/** some far-off times, for the gentle rungs */
const farTimes = (h: number, m: number): [number, number][] => [[h + 4, m], [h + 7, (m + 30) % 60], [h + 9, m], [h + 2, (m + 30) % 60]];
const faceFor = (r: number): Face => (r >= 5 ? 'none' : r >= 4 ? 'quarters' : 'all');
const CLOCK_TRICK = { name: 'Short hand, long hand', say: 'The short hand tells the hour. The long hand tells the minutes: count by 5 for every number it passes.' };

/** a clock to set by dragging its hands */
export type ClockSpec = { face: Face; snap: number; start: number; show: boolean; lock?: 'minute' };
function setItem(skill: string, sub: string, r: number, h: number, m: number, rng: Rng, o: { snap: number; words: boolean; lock?: 'minute'; show: boolean }, weight: number, trick: { name: string; say: string }): Item {
  const face = faceFor(r);
  // it starts at another time: a different hour, on the hour (or the hour hand alone moves from there)
  const start = clockMins(h + int(rng, 2, 9), o.lock ? 0 : pick(rng, [0, 0, 10, 40]));
  const spec: ClockSpec = { face, snap: o.snap, start, show: o.show, lock: o.lock };
  return {
    skill, key: `${skill}:${sub}`, id: `${skill}:set:${timeText(h, m)}:${face}${o.words ? 'w' : ''}`,
    ask: o.lock ? 'Drag the short hand to show the time.' : 'Drag the hands to show the time.',
    prompt: [tx('Set the clock to'), o.words ? tx(timeWords(h, m)) : timePart(h, m)],
    input: 'custom', custom: { name: 'clock', spec },
    answer: { kind: 'number', value: clockMins(h, m) }, weight,
    explain: `${timeWords(h, m)}: the long hand on ${m === 0 ? 12 : m % 5 ? `${m} minutes (${Math.floor(m / 5)} numbers and ${m % 5} little marks)` : m / 5}, the short hand ${m === 0 ? 'on' : m < 30 ? 'just past' : 'past halfway from'} ${hour12(h)}.`,
    trick,
  };
}

// ---------- o'clock and half past ----------
// rungs: 1 every number on the face, three far-apart choices (setting: the short hand only) · 2 closer
// choices · 3 four choices with the hour-after slip (half past 3 is not 4:30) · 4 only 12, 3, 6 and 9 on
// the face · 5 no numbers, just marks · 6 no numbers, and the times in words
export const msHour: Skill = {
  id: 'ms-hour', area: 'measure', grade: 1, standard: '1.MD.B.3',
  name: "O'clock and half past", short: "O'clock", plain: "Tells and shows times in hours and half hours on a clock with hands: the short hand says the hour, the long hand on 12 is o'clock and on 6 is half past.",
  input: 'choice', fastMs: 8000,
  subs: [{ id: 'oclock', label: "o'clock" }, { id: 'half', label: 'half past' }, { id: 'set', label: 'set the clock' }],
  make(rng, sub, rung) {
    const r = rungOf(rung), face = faceFor(r), words = r >= 6;
    const h = int(rng, 1, 12);
    if (sub === 'set') {
      const half = r >= 3 && rng() < 0.6;
      return setItem('ms-hour', sub, r, h, half ? 30 : 0, rng, { snap: 30, words: r === 4 || words, lock: r <= 2 ? 'minute' : undefined, show: r <= 3 }, r >= 4 ? 2 : 1,
        half ? { name: 'Half past', say: 'For half past, put the long hand on 6. The short hand goes halfway past the hour.' } : { name: "O'clock", say: "For o'clock, the long hand points straight up at 12, and the short hand points at the hour." });
    }
    const m = sub === 'half' ? 30 : 0;
    const wrongs: [number, number][] = r === 1 ? farTimes(h, m) : r === 2 ? [[h + 1, m], [h + 3, m], ...farTimes(h, m)]
      : m === 30 ? [[h + 1, 30], [h, 0], [h + 1, 0], [h - 1, 30]] : [[h + 1, 0], [h - 1, 0], [12, (h * 5) % 60], [h, 30]];
    const { choices, id } = timeChoices(rng, [h, m], wrongs, r <= 2 ? 3 : 4, words);
    return {
      skill: 'ms-hour', key: `ms-hour:${sub}`, id: `ms-hour:${sub}:${h}:${face}${words ? 'w' : ''}`,
      ask: 'What time is it?', prompt: [meas({ kind: 'clock', h, m, face })],
      input: 'choice', choices, answer: { kind: 'choice', id }, weight: Math.min(5, (m ? 2 : 1) + (r >= 5 ? 1 : 0)),
      explain: m ? `The long hand is on 6: half past. The short hand is halfway past ${h}, so it is half past ${h}, ${timeText(h, 30)}.` : `The long hand is on 12 and the short hand on ${h}: ${h} o'clock, ${timeText(h, 0)}.`,
      trick: m ? { name: 'Half past', say: `At half past, the short hand has gone halfway to the next number. Read the number it just passed: ${h}, not ${hour12(h + 1)}.` } : CLOCK_TRICK,
    };
  },
  check: (it, a) => (it.input === 'custom' ? sameTime(it, a as { kind: string; value?: number }) : checkAnswer(it.answer, a)),
};

// ---------- five minutes, and a.m. or p.m. ----------
// rungs: 1 quarter past, half past and quarter to, every number on the face · 2 any five minutes in the
// first half hour · 3 any five minutes, four choices with the slips (the long hand on 4 is 20 minutes,
// not 4) · 4 only 12, 3, 6 and 9 · 5 no numbers · 6 no numbers, times in words (25 to 9). a.m. or p.m.:
// 1-2 breakfast and bedtime · 3 lunch and the afternoon · 4 noon and just after · 5 hours later from the
// morning · 6 across noon and midnight
type Event = { what: string; h: number; m: number; ap: 'a.m.' | 'p.m.'; easy: boolean };
const EVENTS: Event[] = [
  { what: 'Wake up', h: 7, m: 0, ap: 'a.m.', easy: true }, { what: 'Eat breakfast', h: 7, m: 30, ap: 'a.m.', easy: true },
  { what: 'Go to bed', h: 8, m: 0, ap: 'p.m.', easy: true }, { what: 'Bath time', h: 7, m: 15, ap: 'p.m.', easy: true },
  { what: 'Look at the stars', h: 9, m: 30, ap: 'p.m.', easy: true }, { what: 'School starts', h: 8, m: 30, ap: 'a.m.', easy: true },
  { what: 'Eat lunch', h: 12, m: 30, ap: 'p.m.', easy: false }, { what: 'Play after school', h: 3, m: 30, ap: 'p.m.', easy: false },
  { what: 'Eat dinner', h: 6, m: 0, ap: 'p.m.', easy: false }, { what: 'Morning snack', h: 10, m: 15, ap: 'a.m.', easy: false },
  { what: 'Walk the dog at sunrise', h: 6, m: 15, ap: 'a.m.', easy: false }, { what: 'Soccer after lunch', h: 1, m: 45, ap: 'p.m.', easy: false },
];
export const msFive: Skill = {
  id: 'ms-five', area: 'measure', grade: 2, standard: '2.MD.C.7',
  name: 'Five minutes', short: '5 minutes', plain: 'Tells and writes time to the nearest five minutes from a clock with hands (the long hand on 4 is 20 minutes), and knows a.m. (morning) from p.m. (afternoon and night).',
  input: 'choice', fastMs: 9000,
  subs: [{ id: 'read', label: 'read the clock' }, { id: 'set', label: 'set the clock' }, { id: 'ampm', label: 'a.m. or p.m.' }],
  make(rng, sub, rung) {
    const r = rungOf(rung), face = faceFor(r), words = r >= 6;
    const h = int(rng, 1, 12);
    const m = r === 1 ? pick(rng, [15, 30, 45]) : r === 2 ? 5 * int(rng, 1, 6) : 5 * int(rng, 1, 11);
    if (sub === 'ampm') {
      const AP: Choice[] = [{ id: 'am', parts: [tx('a.m.')] }, { id: 'pm', parts: [tx('p.m.')] }];
      const AMPM = { name: 'a.m. and p.m.', say: 'a.m. is the morning, from midnight to noon. p.m. is from noon on: the afternoon, the evening and the night.' };
      if (r >= 5) {
        // hours later (or earlier) from a time: does it go past noon?
        const start = int(rng, r === 5 ? 6 : 8, 11), add = r === 5 ? int(rng, 1, 3) : int(rng, 2, 6), end = start + add, sm = pick(rng, [0, 15, 30]);
        const ansAp: 'a.m.' | 'p.m.' = end >= 12 ? 'p.m.' : 'a.m.';
        return {
          skill: 'ms-five', key: 'ms-five:ampm', id: `ms-five:ampm:${start}+${add}:${sm}`,
          ask: `It is ${timeText(start, sm)} a.m. What about ${add} ${add === 1 ? 'hour' : 'hours'} later: a.m. or p.m.?`, prompt: [timePart(start, sm, 'a.m.'), op('+'), tx(`${add} ${add === 1 ? 'hour' : 'hours'}`), op('='), timePart(end, sm)],
          input: 'choice', choices: AP, answer: { kind: 'choice', id: ansAp === 'a.m.' ? 'am' : 'pm' }, weight: 3,
          explain: `${add} ${add === 1 ? 'hour' : 'hours'} after ${timeText(start, sm)} in the morning is ${timeText(end, sm)}${end >= 12 ? ': it went past 12 noon, so it is p.m.' : ', still before noon: a.m.'}`, trick: AMPM,
        };
      }
      const pool = EVENTS.filter(e => (r <= 2 ? e.easy : r === 3 ? !e.easy : true));
      const e = r === 4 && rng() < 0.5 ? { what: pick(rng, ['Eat lunch', 'Lunch bell rings', 'Picnic in the park']), h: 12, m: pick(rng, [0, 15, 30]), ap: 'p.m.' as const, easy: false } : pick(rng, pool);
      return {
        skill: 'ms-five', key: 'ms-five:ampm', id: `ms-five:ampm:${e.what}:${e.h}:${e.m}`,
        ask: `${e.what} at ${timeText(e.h, e.m)}: a.m. or p.m.?`, prompt: [tx(e.what), tx('at'), timePart(e.h, e.m)],
        input: 'choice', choices: AP, answer: { kind: 'choice', id: e.ap === 'a.m.' ? 'am' : 'pm' }, weight: r >= 3 ? 2 : 1,
        explain: e.ap === 'a.m.' ? `${e.what} at ${timeText(e.h, e.m)} happens in the morning: a.m.` : e.h === 12 ? `12 o'clock in the day is noon. From noon on it is p.m.` : `${e.what} at ${timeText(e.h, e.m)} happens in the afternoon or evening: p.m.`,
        trick: AMPM,
      };
    }
    if (sub === 'set') return setItem('ms-five', sub, r, h, m, rng, { snap: 5, words: r === 4 || words, show: r <= 3 }, Math.min(5, 2 + (r >= 4 ? 1 : 0) + (r >= 6 ? 1 : 0)),
      { name: 'Count by fives', say: `Put the long hand where you count ${m} by fives (5, 10, 15...: ${m / 5} numbers round). Then the short hand just after ${hour12(h)}.` });
    // the slips: the number the long hand points at read as minutes, the hour after, counting from the wrong side, swapped hands
    const k = m / 5;
    const wrongs: [number, number][] = r === 1 ? [[h + 3, m], [h, (m + 30) % 60], ...farTimes(h, m)] : r === 2 ? [[h, (m + 15) % 60], [h + 2, m], ...farTimes(h, m)]
      : [[h, k], [m >= 30 ? h + 1 : h - 1, m], [h, 60 - m], [k, (h * 5) % 60], [h, m + 5], [h, m - 5]];
    const { choices, id } = timeChoices(rng, [h, m], wrongs, r <= 2 ? 3 : 4, words);
    return {
      skill: 'ms-five', key: 'ms-five:read', id: `ms-five:read:${h}:${m}:${face}${words ? 'w' : ''}`,
      ask: 'What time is it?', prompt: [meas({ kind: 'clock', h, m, face })],
      input: 'choice', choices, answer: { kind: 'choice', id }, weight: Math.min(5, 2 + (r >= 4 ? 1 : 0) + (r >= 6 ? 1 : 0)),
      explain: `The long hand is on ${k}: count by fives, ${Array.from({ length: Math.min(k, 6) }, (_, i) => (i + 1) * 5).join(', ')}${k > 6 ? '...' : ''} ${m} minutes. The short hand has passed ${h}: ${timeText(h, m)}.`,
      trick: k <= 2 ? CLOCK_TRICK : { name: 'Count by fives', say: `Each number on the clock is 5 more minutes. The long hand on ${k} is ${k} fives: ${m} minutes, not ${k}.` },
    };
  },
  check: (it, a) => (it.input === 'custom' ? sameTime(it, a as { kind: string; value?: number }) : checkAnswer(it.answer, a)),
};

// ---------- to the minute ----------
// rungs: 1 a minute or two past a five, every number on the face · 2 any minute · 3 any minute, four
// choices a minute or two apart · 4 only 12, 3, 6 and 9 · 5 no numbers · 6 no numbers, minutes to the
// hour in words (13 minutes to 8)
export const msMinute: Skill = {
  id: 'ms-minute', area: 'measure', grade: 3, standard: '3.MD.A.1',
  name: 'To the minute', short: 'Minutes', plain: 'Tells and writes time to the nearest minute: count by fives to the last number the long hand passed, then on by ones.',
  input: 'choice', fastMs: 11000,
  subs: [{ id: 'read', label: 'read the clock' }, { id: 'set', label: 'set the clock' }],
  make(rng, sub, rung) {
    const r = rungOf(rung), face = faceFor(r), words = r >= 6;
    const h = int(rng, 1, 12);
    // never on a five (that's the last skill's): one to four little marks past one
    const m = Math.min(59, 5 * int(rng, 0, 11) + (r === 1 ? int(rng, 1, 2) : int(rng, 1, 4)));
    const five = 5 * Math.floor(m / 5), extra = m - five;
    const trick = { name: 'Fives, then ones', say: `Count by fives to the last number the long hand passed (${five}), then on by ones for the little marks: ${Array.from({ length: extra }, (_, i) => five + i + 1).join(', ')}.` };
    if (sub === 'set') return setItem('ms-minute', sub, r, h, m, rng, { snap: 1, words: r === 4 || words, show: r <= 2 }, Math.min(5, 3 + (r >= 4 ? 1 : 0) + (r >= 6 ? 1 : 0)), trick);
    const wrongs: [number, number][] = r === 1 ? [[h, five + 5 + extra], [h + 2, m], ...farTimes(h, m)] : r === 2 ? [[h, m + 5], [h, m - 5], [h + 1, m], ...farTimes(h, m)]
      : [[h, m + 1], [h, m - 1], [h, five + 5 - extra], [h, m + 2], [m >= 30 ? h + 1 : h - 1, m], [h, m - 2]];
    const { choices, id } = timeChoices(rng, [h, m], wrongs, r <= 2 ? 3 : 4, words);
    return {
      skill: 'ms-minute', key: 'ms-minute:read', id: `ms-minute:read:${h}:${m}:${face}${words ? 'w' : ''}`,
      ask: 'What time is it?', prompt: [meas({ kind: 'clock', h, m, face })],
      input: 'choice', choices, answer: { kind: 'choice', id }, weight: Math.min(5, 3 + (r >= 4 ? 1 : 0) + (r >= 6 ? 1 : 0)),
      explain: `Count by fives to ${five}, then ${extra} little ${extra === 1 ? 'mark' : 'marks'} more: ${m} minutes. ${timeText(h, m)}${words ? `, ${timeWords(h, m)}` : ''}.`,
      trick,
    };
  },
  check: (it, a) => (it.input === 'custom' ? sameTime(it, a as { kind: string; value?: number }) : checkAnswer(it.answer, a)),
};

// ---------- how long? (elapsed time) ----------
// rungs: 1 whole hours (2:00, and 3 hours later) · 2 half hours · 3 minutes in fives, inside the hour ·
// 4 fives across the hour (2:45 and 30 minutes) · 5 any minutes across the hour · 6 an hour and some
// minutes, and from the morning into the afternoon (a.m. and p.m.)
const TASKS = [
  { what: 'The cake bakes for', later: 'When is the cake ready?', before: 'The cake is ready at {end}. It baked for {d}. When did it go in?' },
  { what: 'The film lasts', later: 'When does the film end?', before: 'The film ends at {end}. It lasted {d}. When did it start?' },
  { what: 'The train ride takes', later: 'When does the train get there?', before: 'The train gets there at {end}. The ride took {d}. When did it leave?' },
  { what: 'Soccer practice lasts', later: 'When does practice end?', before: 'Practice ends at {end}. It lasted {d}. When did it start?' },
  { what: 'The pizza bakes for', later: 'When is the pizza ready?', before: 'The pizza is ready at {end}. It baked for {d}. When did it go in?' },
];
const durText = (d: number) => (d % 60 === 0 ? `${d / 60} ${d === 60 ? 'hour' : 'hours'}` : d > 60 ? `1 hour ${d - 60} min` : `${d} minutes`);
function span(rng: Rng, r: number): { h: number; m: number; d: number } {
  switch (r) {
    case 1: return { h: int(rng, 1, 8), m: 0, d: 60 * int(rng, 1, 4) };
    case 2: { const m = pick(rng, [0, 30]); return { h: int(rng, 1, 9), m, d: pick(rng, [30, 60, 90, 120]) }; }
    case 3: { const m = 5 * int(rng, 0, 6); return { h: int(rng, 1, 11), m, d: 5 * int(rng, 1, (55 - m) / 5) }; }
    case 4: { const m = 5 * int(rng, 6, 11); return { h: int(rng, 1, 10), m, d: 5 * int(rng, Math.ceil((65 - m) / 5), 11) }; }
    case 5: { const m = int(rng, 20, 58); return { h: int(rng, 1, 10), m, d: int(rng, Math.max(8, 61 - m), 59) }; }
    default: { return { h: int(rng, 9, 11), m: int(rng, 0, 59), d: 60 + int(rng, 5, 55) }; }
  }
}
export const msElapsed: Skill = {
  id: 'ms-elapsed', area: 'measure', grade: 3, standard: '3.MD.A.1',
  name: 'How long?', short: 'How long', plain: 'Works out how long something takes, when it ends or when it began: jump to the next o\'clock, then add the rest.',
  input: 'choice', fastMs: 14000,
  subs: [{ id: 'later', label: 'when it ends' }, { id: 'howlong', label: 'how long it takes' }, { id: 'before', label: 'when it began' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const { h, m, d } = span(rng, r);
    const t0 = h * 60 + m, t1 = t0 + d;
    const [eh, em] = [Math.floor(t1 / 60), t1 % 60];
    const noon = r >= 6;
    const ap0: 'a.m.' | undefined = noon ? 'a.m.' : undefined, ap1 = noon ? (eh >= 12 ? 'p.m.' as const : 'a.m.' as const) : undefined;
    const task = pick(rng, TASKS);
    const toNext = m ? 60 - m : 0;
    const stepWords = d >= 60 && m === 0 ? `Count the hours: ${Array.from({ length: Math.floor(d / 60) }, (_, i) => timeText(h + i + 1, 0)).join(', ')}${d % 60 ? `, then ${d % 60} minutes more` : ''}.`
      : m + d < 60 ? `Count on ${d} minutes from ${timeText(h, m)}: the hour stays ${hour12(h)}.`
      : `${toNext} minutes takes ${timeText(h, m)} to ${timeText(h + 1, 0)}${d - toNext ? `, then ${durText(d - toNext)} more` : ''}.`;
    const trick = { name: 'Jump to the hour', say: 'Jump to the next o\'clock first, then add the minutes that are left. A clock goes up to 59 minutes, then the hour goes up.' };
    if (sub === 'howlong') {
      const hours = r === 1;
      return {
        skill: 'ms-elapsed', key: 'ms-elapsed:howlong', id: `ms-elapsed:howlong:${timeText(h, m)}+${d}`,
        ask: hours ? `It starts at ${timeText(h, m)} and ends at ${timeText(eh, em)}. How many hours?` : `It starts at ${timeText(h, m)}${ap0 ? ' a.m.' : ''} and ends at ${timeText(eh, em)}${ap1 ? ` ${ap1}` : ''}${ap1 ? '' : '.'} How many minutes is that?`,
        prompt: [meas({ kind: 'clock', h: hour12(h), m, face: faceFor(r - 1) }), op('→'), meas({ kind: 'clock', h: hour12(eh), m: em, face: faceFor(r - 1) }), op('='), blank, tx(hours ? 'hours' : 'minutes')],
        input: 'number', answer: { kind: 'number', value: hours ? d / 60 : d }, weight: Math.min(5, 2 + (r >= 4 ? 1 : 0) + (r >= 6 ? 1 : 0)),
        explain: `${stepWords} ${hours ? `That's ${d / 60} hours.` : `Altogether ${d} minutes${d > 60 ? ` (1 hour is 60 minutes, and ${d - 60} more)` : ''}.`}`, trick,
      };
    }
    if (sub === 'before') {
      const wrongs: [number, number][] = [[eh, (em - d % 60 + 60) % 60], [h + 1, m], [h - 1, m], [h, (m + 5) % 60], [h, (m + 55) % 60], [h, (m + 10) % 60]];
      const { choices, id } = timeChoices(rng, [h, m], wrongs, r <= 2 ? 3 : 4, false);
      const q = task.before.replace('{end}', `${timeText(eh, em)}${ap1 ? ` ${ap1}` : ''}`).replace('{d}', durText(d)).replace('..', '.');
      return {
        skill: 'ms-elapsed', key: 'ms-elapsed:before', id: `ms-elapsed:before:${timeText(eh, em)}-${d}`,
        ask: q, prompt: [op('?'), op('+'), tx(durText(d)), op('='), timePart(eh, em, ap1)],
        input: 'choice', choices, answer: { kind: 'choice', id }, weight: Math.min(5, 3 + (r >= 5 ? 1 : 0)),
        explain: `Go back ${durText(d)} from ${timeText(eh, em)}: it began at ${timeText(h, m)}${ap0 ? ' a.m.' : '.'}`,
        trick: { name: 'Count back', say: 'Go back to the o\'clock first, then back the minutes that are left.' },
      };
    }
    const wrongs: [number, number][] = [[h, (m + d) % 60], [eh + 1, em], [eh, (em + 5) % 60], [eh - 1, em], [eh, (em + 55) % 60], [eh, (em + 10) % 60], [eh + 2, em]];
    const { choices, id } = timeChoices(rng, [eh, em], wrongs, r <= 2 ? 3 : 4, false);
    return {
      skill: 'ms-elapsed', key: 'ms-elapsed:later', id: `ms-elapsed:later:${timeText(h, m)}+${d}`,
      ask: `${task.what} ${durText(d)} from ${timeText(h, m)}${ap0 ? ' a.m.' : '.'} ${task.later}`,
      prompt: [meas({ kind: 'clock', h: hour12(h), m, face: faceFor(r - 1) }), op('+'), tx(durText(d)), op('='), op('?')],
      input: 'choice', choices, answer: { kind: 'choice', id }, weight: Math.min(5, 2 + (r >= 4 ? 1 : 0) + (r >= 6 ? 1 : 0)),
      explain: `${stepWords} It ends at ${timeText(eh, em)}${ap1 ? ` ${ap1}` : '.'}`, trick,
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- longer or shorter (comparing lengths) ----------
// rungs: 1 lined up at the left, very different · 2 lined up, closer · 3 lined up, one or two apart ·
// 4 not lined up (count the squares under each) · 5 not lined up, and "which is shorter?" · 6 not lined
// up, one apart, or the same. Cubes: 1 two to five cubes · 2 to eight · 3 to ten · 4 to twelve · 5 paper
// clips (a bigger unit) · 6 how many cubes longer is one than the other
function twoThings(rng: Rng, n: number): Thing[] { const s = shuffle(rng, THINGS); return s.slice(0, n); }
export const msCompare: Skill = {
  id: 'ms-compare', area: 'measure', grade: 1, standard: '1.MD.A.1',
  name: 'Longer or shorter', short: 'Longer?', plain: 'Compares and orders lengths by lining things up, and measures a length with same-size units laid end to end (cubes, paper clips) with no gaps.',
  input: 'choice', fastMs: 7000,
  subs: [{ id: 'longer', label: 'which is longer' }, { id: 'order', label: 'longest and shortest' }, { id: 'units', label: 'count the cubes' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    if (sub === 'units') {
      const [a, b] = twoThings(rng, 2);
      if (r >= 6) {
        const la = int(rng, 5, 11), lb = int(rng, 2, la - 1);
        return {
          skill: 'ms-compare', key: 'ms-compare:units', id: `ms-compare:units:diff:${la}-${lb}`,
          ask: `How many cubes longer is the ${THING_NAME[a]} than the ${THING_NAME[b]}?`, prompt: [meas({ kind: 'lengths', items: [{ thing: a, from: 0, len: la }, { thing: b, from: 0, len: lb }], grid: true, max: 12, units: 'cube' }), op('='), blank, tx('cubes longer')],
          input: 'number', answer: { kind: 'number', value: la - lb }, weight: 3,
          explain: `The ${THING_NAME[a]} is ${la} cubes and the ${THING_NAME[b]} is ${lb}: ${la} − ${lb} = ${la - lb} cubes longer.`,
          trick: { name: 'Count, then compare', say: 'Count each one in cubes, then take the shorter from the longer.' },
        };
      }
      const clip = r === 5;
      const n = int(rng, ...perRung(r, [[2, 5], [3, 8], [4, 10], [6, 12], [3, 7]] as [number, number][]));
      return {
        skill: 'ms-compare', key: 'ms-compare:units', id: `ms-compare:units:${a}:${n}${clip ? 'c' : ''}`,
        ask: `How many ${clip ? 'paper clips' : 'cubes'} long is the ${THING_NAME[a]}?`, prompt: [meas({ kind: 'lengths', items: [{ thing: a, from: 0, len: n }], grid: false, max: Math.max(n, clip ? 7 : 12), units: clip ? 'clip' : 'cube' }), op('='), blank, tx(clip ? 'clips' : 'cubes')],
        input: 'number', answer: { kind: 'number', value: n }, weight: n > 8 ? 2 : 1,
        explain: `${n} ${clip ? 'paper clips' : 'cubes'} fit from one end of the ${THING_NAME[a]} to the other.`,
        trick: { name: 'End to end', say: `Start at one end and count each ${clip ? 'clip' : 'cube'} to the other end. No gaps, no overlaps.` },
      };
    }
    const shorter = r >= 5 && rng() < 0.5;
    const lined = r <= 3;
    if (sub === 'order') {
      const things = twoThings(rng, 3);
      const gap = perRung(r, [3, 2, 1, 2, 1, 1]);
      const base = int(rng, 2, 4);
      const lens = shuffle(rng, [base, base + gap, base + 2 * gap]);
      const from = lens.map(l => (lined ? 0 : int(rng, 0, Math.max(0, 11 - l))));
      const items = things.map((t, i) => ({ thing: t, from: from[i], len: lens[i] }));
      const want = shorter ? Math.min(...lens) : Math.max(...lens);
      const k = lens.indexOf(want);
      return {
        skill: 'ms-compare', key: 'ms-compare:order', id: `ms-compare:order:${lens.join('.')}:${from.join('.')}:${shorter ? 's' : 'l'}`,
        ask: shorter ? 'Which is the shortest?' : 'Which is the longest?', prompt: [meas({ kind: 'lengths', items, grid: !lined, max: 12 })],
        input: 'choice', choices: things.map((t, i) => ({ id: String(i), parts: [meas({ kind: 'thing', thing: t }), tx(`the ${THING_NAME[t]}`)] })), answer: { kind: 'choice', id: String(k) },
        weight: lined ? 1 : 2,
        explain: `The ${THING_NAME[things[k]]} is ${want} squares long: the ${shorter ? 'shortest' : 'longest'}.`,
        trick: lined ? { name: 'Line them up', say: 'Line up the left ends. The one that sticks out furthest on the right is the longest.' } : { name: 'Count the squares', say: 'They don\'t start in the same place, so count the squares each one covers.' },
      };
    }
    const [a, b] = twoThings(rng, 2);
    const diff = perRung(r, [int(rng, 3, 5), int(rng, 2, 3), int(rng, 1, 2), int(rng, 1, 3), int(rng, 1, 2), int(rng, 0, 1)]);
    const la0 = int(rng, 2, 10 - diff);
    const [la, lb] = rng() < 0.5 ? [la0 + diff, la0] : [la0, la0 + diff];
    const fa = lined ? 0 : int(rng, 0, 12 - la), fb = lined ? 0 : int(rng, 0, 12 - lb);
    const id = la === lb ? 'same' : (la > lb) !== shorter ? 'a' : 'b';
    const choices: Choice[] = [{ id: 'a', parts: [meas({ kind: 'thing', thing: a }), tx(`the ${THING_NAME[a]}`)] }, { id: 'b', parts: [meas({ kind: 'thing', thing: b }), tx(`the ${THING_NAME[b]}`)] }];
    if (r >= 6) choices.push({ id: 'same', parts: [tx('The same')] });
    return {
      skill: 'ms-compare', key: 'ms-compare:longer', id: `ms-compare:longer:${la}@${fa}:${lb}@${fb}:${shorter ? 's' : 'l'}`,
      ask: shorter ? 'Which is shorter?' : 'Which is longer?', prompt: [meas({ kind: 'lengths', items: [{ thing: a, from: fa, len: la }, { thing: b, from: fb, len: lb }], grid: !lined, max: 12 })],
      input: 'choice', choices, answer: { kind: 'choice', id }, weight: Math.min(5, lined ? 1 : 2 + (r >= 6 ? 1 : 0)),
      explain: la === lb ? `Both are ${la} squares long: the same.` : `The ${THING_NAME[a]} is ${la} squares long and the ${THING_NAME[b]} ${lb}.`,
      trick: lined ? { name: 'Line them up', say: 'With the left ends lined up, look at the right ends: the one that goes further is longer.' } : { name: 'Count the squares', say: 'They start in different places, so the ends can fool you. Count the squares each one covers.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- with a ruler ----------
// rungs: 1 starts at 0, centimetres to 10 · 2 inches to 6, or centimetres to 15 · 3 to 12 inches or 20
// centimetres · 4 doesn't start at 0 (count from where it starts) · 5 not at 0, longer rulers · 6 two
// things: how much longer is one (draw: half inches). Estimate: 1-2 a silly unit against a sensible one ·
// 3 three units · 4 which unit to use · 5 how many of a unit · 6 feet or yards, close guesses
const SIZES: { what: string; cm: string; m: string; inch: string; ft: string; yd: string; pick: 'cm' | 'm' | 'in' | 'ft' | 'yd' }[] = [
  { what: 'a pencil', cm: '15 cm', m: '15 m', inch: '6 in', ft: '6 ft', yd: '6 yd', pick: 'cm' },
  { what: 'a paper clip', cm: '3 cm', m: '3 m', inch: '1 in', ft: '1 ft', yd: '1 yd', pick: 'cm' },
  { what: 'a door', cm: '2 cm', m: '2 m', inch: '7 in', ft: '7 ft', yd: '7 yd', pick: 'm' },
  { what: 'a school bus', cm: '12 cm', m: '12 m', inch: '40 in', ft: '40 ft', yd: '40 yd', pick: 'm' },
  { what: 'a book', cm: '25 cm', m: '25 m', inch: '10 in', ft: '10 ft', yd: '10 yd', pick: 'in' },
  { what: 'a bed', cm: '2 cm', m: '2 m', inch: '6 in', ft: '6 ft', yd: '6 yd', pick: 'ft' },
  { what: 'a football field', cm: '100 cm', m: '100 m', inch: '100 in', ft: '100 ft', yd: '100 yd', pick: 'yd' },
  { what: 'your hand', cm: '12 cm', m: '12 m', inch: '5 in', ft: '5 ft', yd: '5 yd', pick: 'in' },
];
export type RulerSpec = { unit: 'cm' | 'in'; len: number; start: number; snap: number; thing: Thing };
export const msRuler: Skill = {
  id: 'ms-ruler', area: 'measure', grade: 2, standard: '2.MD.A.1',
  name: 'Use a ruler', short: 'Ruler', plain: 'Measures with a ruler in inches and centimetres (line one end up with 0, read the other end), draws a length, and picks a sensible unit and estimate.',
  input: 'number', fastMs: 9000,
  subs: [{ id: 'read', label: 'read the ruler' }, { id: 'draw', label: 'pull to a length' }, { id: 'estimate', label: 'estimate' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    if (sub === 'estimate') {
      const s = pick(rng, SIZES);
      const metric = s.pick === 'cm' || s.pick === 'm';
      const right = metric ? (s.pick === 'cm' ? s.cm : s.m) : s.pick === 'in' ? s.inch : s.pick === 'ft' ? s.ft : s.yd;
      if (r === 4) {
        const units = metric ? ['centimetres', 'metres'] : ['inches', 'feet', 'yards'];
        const want = { cm: 'centimetres', m: 'metres', in: 'inches', ft: 'feet', yd: 'yards' }[s.pick];
        return {
          skill: 'ms-ruler', key: 'ms-ruler:estimate', id: `ms-ruler:estimate:unit:${s.what}`,
          ask: `Which unit would you use to measure ${s.what}?`, prompt: [tx(`Measure ${s.what} in...`)],
          input: 'choice', choices: units.map(u => ({ id: u, parts: [tx(u)] })), answer: { kind: 'choice', id: want }, weight: 2,
          explain: `${s.what[0].toUpperCase()}${s.what.slice(1)} is about ${right}: ${want} fit it best.`,
          trick: { name: 'Pick a good unit', say: 'Small things: centimetres or inches. Big things: metres, feet or yards.' },
        };
      }
      const all = metric ? [s.cm, s.m] : [s.inch, s.ft, s.yd];
      // the gentle rungs: the right one and the silliest other one; then all of them; then close guesses
      // (the right unit with other amounts)
      const far = all.filter(x => x !== right).at(right === all[0] ? -1 : 0)!;
      const close = r >= 5 ? [right, right.replace(/^\d+/, n => String(Number(n) * 10)), right.replace(/^\d+/, n => String(Math.max(2, Math.round(Number(n) / 3)) === Number(n) ? Number(n) + 2 : Math.max(2, Math.round(Number(n) / 3))))] : null;
      const opts = [...new Set(close ?? (r <= 2 ? [right, far] : r === 3 && metric ? [s.cm, s.m, `${right.split(' ')[0]} km`] : all))];
      return {
        skill: 'ms-ruler', key: 'ms-ruler:estimate', id: `ms-ruler:estimate:${s.what}:${opts.length}${close ? 'c' : ''}`,
        ask: `About how long is ${s.what}?`, prompt: [tx(`${s.what[0].toUpperCase()}${s.what.slice(1)} is about...`)],
        input: 'choice', choices: shuffle(rng, opts).map((o, i) => ({ id: o === right ? 'right' : `w${i}`, parts: [tx(o)] })), answer: { kind: 'choice', id: 'right' }, weight: r >= 5 ? 3 : 2,
        explain: `${s.what[0].toUpperCase()}${s.what.slice(1)} is about ${right}.`,
        trick: { name: 'Think of one you know', say: 'A centimetre is about as wide as your finger, a metre is a big step. An inch is a thumb joint, a foot is a big book, a yard is a big step.' },
      };
    }
    const inches = r === 2 || r === 3 ? rng() < 0.5 : r >= 4 ? rng() < 0.4 : false;
    const unit: 'cm' | 'in' = inches ? 'in' : 'cm';
    const len = inches ? (r <= 2 ? 6 : 12) : perRung(r, [10, 15, 20, 20, 30, 30]);
    const thing = pick(rng, THINGS);
    const u = inches ? 'inches' : 'centimetres', us = inches ? 'in' : 'cm';
    if (sub === 'draw') {
      const half = r >= 6 && inches;
      const L = half ? int(rng, 2, 9) + 0.5 : int(rng, perRung(r, [3, 3, 4, 3, 5, 4]), Math.min(len - 2, perRung(r, [10, 12, 18, 10, 20, 20])));
      const start = r >= 4 ? int(rng, 1, Math.max(1, Math.floor(len - L - 1))) : 0;
      const spec: RulerSpec = { unit, len, start, snap: half ? 0.5 : 1, thing };
      return {
        skill: 'ms-ruler', key: 'ms-ruler:draw', id: `ms-ruler:draw:${unit}:${start}+${L}`,
        ask: `Pull the ribbon to make it ${half ? `${Math.floor(L)} and a half` : L} ${u} long.`, prompt: [tx('Make it'), half ? tx(`${Math.floor(L)}½`) : num(L), tx(us)],
        input: 'custom', custom: { name: 'ruler', spec }, answer: { kind: 'number', value: start + L }, weight: Math.min(5, 2 + (start ? 1 : 0) + (half ? 1 : 0)),
        explain: start ? `It starts at ${start}, so the end goes at ${start} + ${L} = ${start + L}.` : `It starts at 0, so the end goes on ${L}.`,
        trick: start ? { name: 'Count from the start', say: `It doesn't start at 0. Count ${L} ${u} on from ${start}.` } : { name: 'Start at 0', say: 'Start at the 0 line, not the end of the ruler, and stop on the number.' },
      };
    }
    if (r >= 6) {
      // two things: how much longer
      const [ta, tb] = twoThings(rng, 2);
      const la = int(rng, 4, len - 2), lb = int(rng, 2, la - 1);
      return {
        skill: 'ms-ruler', key: 'ms-ruler:read', id: `ms-ruler:read:diff:${unit}:${la}-${lb}`,
        ask: `How much longer is the ${THING_NAME[ta]} than the ${THING_NAME[tb]}?`, prompt: [meas({ kind: 'ruler', unit, len, ticks: inches ? 1 : 1, items: [{ thing: ta, from: 0, to: la }, { thing: tb, from: 0, to: lb }] }), op('='), blank, tx(us)],
        input: 'number', answer: { kind: 'number', value: la - lb }, weight: 4,
        explain: `The ${THING_NAME[ta]} is ${la} ${us} and the ${THING_NAME[tb]} ${lb} ${us}: ${la} − ${lb} = ${la - lb} ${us} longer.`,
        trick: { name: 'Measure, then take away', say: 'Read both lengths, then take the shorter from the longer.' },
      };
    }
    const L = int(rng, 2, Math.min(len - 1, perRung(r, [9, 12, 16, 12, 22, 22])));
    const from = r >= 4 ? int(rng, 1, len - L) : 0;
    return {
      skill: 'ms-ruler', key: 'ms-ruler:read', id: `ms-ruler:read:${unit}:${from}+${L}`,
      ask: `How long is the ${THING_NAME[thing]}?`, prompt: [meas({ kind: 'ruler', unit, len, ticks: 1, items: [{ thing, from, to: from + L }] }), op('='), blank, tx(us)],
      input: 'number', answer: { kind: 'number', value: L }, weight: Math.min(5, (inches ? 2 : 1) + (from ? 2 : 0)),
      explain: from ? `It goes from ${from} to ${from + L}: ${from + L} − ${from} = ${L} ${us}.` : `It starts at 0 and ends at ${L}: ${L} ${us}.`,
      trick: from ? { name: 'Count the spaces', say: `It doesn't start at 0. Count the spaces from ${from} to ${from + L}, or take ${from} away from ${from + L}.` } : { name: 'Start at 0', say: 'Line one end up with the 0 line. The number at the other end is the length.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- weigh and pour (mass and liquid volume) ----------
// rungs: 1 kilograms or litres to 5, every mark numbered · 2 to 10, every other mark numbered · 3 grams
// or millilitres to 1,000 in hundreds · 4 marks every 50 · 5 to 2,000, numbers every 500 · 6 two things:
// how much heavier, or both jugs together (pour: start with some in, pour more)
type Dial = { max: number; step: number; label: number; big: boolean };
const dialFor = (r: number): Dial => perRung(r, [
  { max: 5, step: 1, label: 1, big: true }, { max: 10, step: 1, label: 2, big: true }, { max: 1000, step: 100, label: 200, big: false },
  { max: 1000, step: 50, label: 250, big: false }, { max: 2000, step: 100, label: 500, big: false }, { max: 1000, step: 50, label: 200, big: false },
]);
const LOADS = ['bag of apples', 'pumpkin', 'bag of flour', 'sack of potatoes', 'melon', 'bag of oranges', 'teddy', 'box of blocks'];
export type JugSpec = { max: number; step: number; label: number; unit: 'mL' | 'L'; start: number };
export const msMass: Skill = {
  id: 'ms-mass', area: 'measure', grade: 3, standard: '3.MD.A.2',
  name: 'Weigh and pour', short: 'Weigh, pour', plain: 'Reads scales and jugs in grams, kilograms, millilitres and litres (count the marks between the numbers), and adds or takes away amounts.',
  input: 'number', fastMs: 10000,
  subs: [{ id: 'scale', label: 'read the scale' }, { id: 'jug', label: 'read the jug' }, { id: 'pour', label: 'pour to a mark' }],
  make(rng, sub, rung) {
    const r = rungOf(rung), d = dialFor(r);
    const unitS: 'g' | 'kg' = d.big ? 'kg' : 'g', unitJ: 'mL' | 'L' = d.big ? 'L' : 'mL';
    const marks = d.max / d.step;
    const v = d.step * int(rng, 1, marks - 1);
    const between = v % d.label !== 0;
    const readTrick = { name: 'Count the marks', say: `Find the number just below, then count the marks up: each mark is ${d.step} ${sub === 'scale' ? unitS : unitJ}.` };
    if (sub === 'pour') {
      const start = r >= 6 ? d.step * int(rng, 1, Math.floor(marks / 3)) : 0;
      const more = d.step * int(rng, 1, marks - start / d.step - 1);
      const target = start + more;
      const spec: JugSpec = { max: d.max, step: d.step, label: d.label, unit: unitJ, start };
      return {
        skill: 'ms-mass', key: 'ms-mass:pour', id: `ms-mass:pour:${d.max}/${d.step}:${start}+${more}`,
        ask: start ? `The jug has ${start} ${unitJ}. Pour in ${more} ${unitJ} more.` : `Pour ${target} ${unitJ} of water into the jug.`, prompt: start ? [num(start), tx(unitJ), op('+'), num(more), tx(unitJ)] : [tx('Pour'), num(target), tx(unitJ)],
        input: 'custom', custom: { name: 'jug', spec }, answer: { kind: 'number', value: target }, weight: Math.min(5, (d.big ? 1 : 2) + (target % d.label ? 1 : 0) + (start ? 1 : 0)),
        explain: start ? `${start} + ${more} = ${target} ${unitJ}: fill it to the ${target} line.` : `Fill it up to the ${target} line${target % d.label ? `: ${target - (target % d.label)}, then ${(target % d.label) / d.step} ${(target % d.label) / d.step === 1 ? 'mark' : 'marks'} more` : ''}.`,
        trick: start ? { name: 'Add first', say: 'Add what is in the jug and what you pour. Then fill it to that line.' } : readTrick,
      };
    }
    if (sub === 'jug') {
      if (r >= 6) {
        const a = d.step * int(rng, 2, marks / 2 - 1), b = d.step * int(rng, 1, marks / 2 - 1);
        return {
          skill: 'ms-mass', key: 'ms-mass:jug', id: `ms-mass:jug:two:${a}+${b}`,
          ask: `Pour both jugs into one. How much water is that?`, prompt: [meas({ kind: 'jug', max: d.max, step: d.step, label: d.label, value: a, unit: unitJ }), op('+'), meas({ kind: 'jug', max: d.max, step: d.step, label: d.label, value: b, unit: unitJ }), op('='), blank, tx(unitJ)],
          input: 'number', answer: { kind: 'number', value: a + b }, weight: 4,
          explain: `${a} ${unitJ} and ${b} ${unitJ}: ${a} + ${b} = ${a + b} ${unitJ}.`, trick: { name: 'Read, then add', say: 'Read each jug at the top of the water, then add the two amounts.' },
        };
      }
      return {
        skill: 'ms-mass', key: 'ms-mass:jug', id: `ms-mass:jug:${d.max}/${d.step}:${v}`,
        ask: 'How much water is in the jug?', prompt: [meas({ kind: 'jug', max: d.max, step: d.step, label: d.label, value: v, unit: unitJ }), op('='), blank, tx(unitJ)],
        input: 'number', answer: { kind: 'number', value: v }, weight: Math.min(5, (d.big ? 1 : 2) + (between ? 1 : 0) + (r >= 5 ? 1 : 0)),
        explain: between ? `The water is ${(v % d.label) / d.step} ${(v % d.label) / d.step === 1 ? 'mark' : 'marks'} above ${v - (v % d.label)}, and each mark is ${d.step}: ${v} ${unitJ}.` : `The water is right on the ${v} line: ${v} ${unitJ}.`,
        trick: readTrick,
      };
    }
    const load = pick(rng, LOADS);
    if (r >= 6) {
      const a = d.step * int(rng, marks / 2, marks - 1), b = d.step * int(rng, 1, marks / 2 - 1), other = pick(rng, LOADS.filter(x => x !== load));
      return {
        skill: 'ms-mass', key: 'ms-mass:scale', id: `ms-mass:scale:diff:${a}-${b}`,
        ask: `How much heavier is the ${load} than the ${other}?`, prompt: [meas({ kind: 'scale', max: d.max, step: d.step, label: d.label, value: a, unit: unitS, load }), op('−'), meas({ kind: 'scale', max: d.max, step: d.step, label: d.label, value: b, unit: unitS, load: other }), op('='), blank, tx(unitS)],
        input: 'number', answer: { kind: 'number', value: a - b }, weight: 4,
        explain: `${a} ${unitS} − ${b} ${unitS} = ${a - b} ${unitS} heavier.`, trick: { name: 'Read, then take away', say: 'Read both scales, then take the lighter one away from the heavier one.' },
      };
    }
    return {
      skill: 'ms-mass', key: 'ms-mass:scale', id: `ms-mass:scale:${d.max}/${d.step}:${v}`,
      ask: `How heavy is the ${load}?`, prompt: [meas({ kind: 'scale', max: d.max, step: d.step, label: d.label, value: v, unit: unitS, load }), op('='), blank, tx(unitS)],
      input: 'number', answer: { kind: 'number', value: v }, weight: Math.min(5, (d.big ? 1 : 2) + (between ? 1 : 0) + (r >= 5 ? 1 : 0)),
      explain: between ? `The needle is ${(v % d.label) / d.step} ${(v % d.label) / d.step === 1 ? 'mark' : 'marks'} past ${v - (v % d.label)}, and each mark is ${d.step}: ${v} ${unitS}.` : `The needle points right at ${v}: ${v} ${unitS}.`,
      trick: readTrick,
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- area ----------
const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
/** the words on a rectangle's top and left sides */
const rectSides = (w: number, h: number, u: string, x = 0, y = 0): Side[] => [{ x1: x, y1: y, x2: x + w, y2: y, text: `${w} ${u}` }, { x1: x, y1: y, x2: x, y2: y + h, text: `${h} ${u}` }];
/** an L: a w by h rectangle with an a by b corner bite out of its top right (a < w, b < h) */
function lShape(w: number, h: number, a: number, b: number): Rect[] { return [rect(0, 0, w - a, h), rect(w - a, b, a, h - b)]; }
const UNITS = ['cm', 'm', 'ft', 'in'];
export const msArea: Skill = {
  id: 'ms-area', area: 'measure', grade: 3, standard: '3.MD.C.7',
  name: 'Area', short: 'Area', plain: 'Finds area by counting unit squares, by multiplying length times width, and by splitting a shape into rectangles and adding.',
  input: 'number', fastMs: 10000,
  subs: [{ id: 'count', label: 'count squares' }, { id: 'multiply', label: 'length times width' }, { id: 'combine', label: 'shapes of rectangles' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const u = r >= 3 ? pick(rng, UNITS) : '';
    const sq = u ? `square ${u}` : 'squares';
    const trickMul = { name: 'Rows times columns', say: 'The squares come in equal rows. Count one row, count the rows, and times them: length times width.' };
    if (sub === 'count') {
      const [w, h] = perRung(r, [[int(rng, 2, 3), int(rng, 2, 3)], [int(rng, 2, 4), int(rng, 2, 5)], [int(rng, 3, 6), int(rng, 3, 6)], [int(rng, 4, 8), int(rng, 3, 7)], [int(rng, 5, 9), int(rng, 4, 8)], [int(rng, 6, 10), int(rng, 5, 9)]] as [number, number][]);
      const partial = r >= 4;
      return {
        skill: 'ms-area', key: 'ms-area:count', id: `ms-area:count:${w}x${h}${partial ? 'e' : ''}`,
        ask: partial ? 'Only some squares are drawn. What is the area?' : 'Count the squares. What is the area?', prompt: [meas({ kind: 'shape', rects: [rect(0, 0, w, h)], grid: partial ? 'edge' : true, sides: [] }), op('='), blank, tx('squares')],
        input: 'number', answer: { kind: 'number', value: w * h }, weight: Math.min(5, 1 + (r >= 3 ? 1 : 0) + (partial ? 1 : 0) + (r >= 6 ? 1 : 0)),
        explain: `${h} rows of ${w}: ${h} × ${w} = ${w * h} squares.`, trick: r <= 2 ? { name: 'Count every square', say: 'Count each square once: go along each row, one row at a time.' } : trickMul,
      };
    }
    if (sub === 'multiply') {
      if (r >= 6) {
        const a = int(rng, 3, 9), b = int(rng, 3, 9), U = pick(rng, UNITS);
        return {
          skill: 'ms-area', key: 'ms-area:multiply', id: `ms-area:multiply:miss:${a}x${b}`,
          ask: `The rug is ${a * b} square ${U}. One side is ${a} ${U}. How long is the other side?`, prompt: [meas({ kind: 'shape', rects: [rect(0, 0, a, b)], grid: false, sides: [{ x1: 0, y1: 0, x2: a, y2: 0, text: `${a} ${U}` }, { x1: 0, y1: 0, x2: 0, y2: b, text: '?' }] }), tx(`Area ${a * b} square ${U}`), op('·'), tx('side ='), blank, tx(U)],
          input: 'number', answer: { kind: 'number', value: b }, weight: 4,
          explain: `${a} × ? = ${a * b}, and ${a} × ${b} = ${a * b}: the other side is ${b} ${U}.`, trick: { name: 'Think times', say: 'Area is length times width, so ask: what times this side makes the area?' },
        };
      }
      const [w, h] = perRung(r, [[int(rng, 2, 3), int(rng, 2, 5)], [int(rng, 2, 5), int(rng, 2, 5)], [int(rng, 3, 9), int(rng, 2, 9)], [int(rng, 4, 10), int(rng, 3, 10)], [int(rng, 11, 15), int(rng, 3, 9)]] as [number, number][]);
      const grid = r <= 2;
      return {
        skill: 'ms-area', key: 'ms-area:multiply', id: `ms-area:multiply:${w}x${h}${grid ? 'g' : ''}`,
        ask: 'What is the area?', prompt: [meas({ kind: 'shape', rects: [rect(0, 0, w, h)], grid, sides: rectSides(w, h, u) }), op('='), blank, tx(sq)],
        input: 'number', answer: { kind: 'number', value: w * h }, weight: Math.min(5, 2 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0)),
        explain: `Length times width: ${w} × ${h} = ${w * h} ${sq}.`, trick: trickMul,
      };
    }
    // shapes made of rectangles
    const w = int(rng, ...perRung(r, [[3, 4], [4, 5], [4, 7], [6, 9], [6, 10], [8, 12]] as [number, number][]));
    const h = int(rng, ...perRung(r, [[2, 3], [3, 5], [4, 6], [5, 8], [5, 9], [6, 10]] as [number, number][]));
    if (r === 1) {
      const w2 = int(rng, 1, 3);
      return {
        skill: 'ms-area', key: 'ms-area:combine', id: `ms-area:combine:two:${w}x${h}+${w2}`,
        ask: 'Two gardens side by side. What is the area of both?', prompt: [meas({ kind: 'shape', rects: [rect(0, 0, w, h), rect(w, 0, w2, h)], grid: true, sides: [] }), op('='), blank, tx('squares')],
        input: 'number', answer: { kind: 'number', value: (w + w2) * h }, weight: 2,
        explain: `${w * h} squares and ${w2 * h} squares: ${w * h} + ${w2 * h} = ${(w + w2) * h}.`, trick: { name: 'Add the parts', say: 'Find the area of each part, then add them.' },
      };
    }
    const a = int(rng, 1, w - 2), b = int(rng, 1, h - 2);
    const area = w * h - a * b;
    const cut = r === 5;
    const rects = cut ? [rect(0, 0, w, h)] : lShape(w, h, a, b);
    const grid = r <= 2;
    // the sides' words: all of them on the gentle rungs; at the top, only the outside lengths
    const U = u || 'm';
    const sides: Side[] = grid ? [] : r >= 6
      ? [{ x1: 0, y1: 0, x2: 0, y2: h, text: `${h} ${U}` }, { x1: 0, y1: h, x2: w, y2: h, text: `${w} ${U}` }, { x1: 0, y1: 0, x2: w - a, y2: 0, text: `${w - a} ${U}` }, { x1: w, y1: b, x2: w, y2: h, text: `${h - b} ${U}` }]
      : cut ? [...rectSides(w, h, U), { x1: w - a, y1: 0, x2: w, y2: 0, text: '' }, { x1: w - a, y1: b, x2: w, y2: b, text: `${a} ${U}` }, { x1: w, y1: 0, x2: w, y2: b, text: `${b} ${U}` }]
      : [{ x1: 0, y1: 0, x2: w - a, y2: 0, text: `${w - a} ${U}` }, { x1: 0, y1: 0, x2: 0, y2: h, text: `${h} ${U}` }, { x1: w - a, y1: b, x2: w, y2: b, text: `${a} ${U}` }, { x1: w, y1: b, x2: w, y2: h, text: `${h - b} ${U}` }];
    return {
      skill: 'ms-area', key: 'ms-area:combine', id: `ms-area:combine:${w}x${h}-${a}x${b}${cut ? 'c' : ''}${grid ? 'g' : ''}${r >= 6 ? 'o' : ''}`,
      ask: cut ? 'A corner is cut out. What is the area that is left?' : 'What is the area of the whole garden?', prompt: [meas({ kind: 'shape', rects, grid, sides, cut: cut ? rect(w - a, 0, a, b) : undefined }), op('='), blank, tx(grid ? 'squares' : `square ${U}`)],
      input: 'number', answer: { kind: 'number', value: area }, weight: Math.min(5, 2 + (r >= 3 ? 1 : 0) + (r >= 5 ? 1 : 0)),
      explain: cut ? `The whole rectangle is ${w} × ${h} = ${w * h}. Take away the corner, ${a} × ${b} = ${a * b}: ${w * h} − ${a * b} = ${area}.` : `Split it into two rectangles: ${w - a} × ${h} = ${(w - a) * h} and ${a} × ${h - b} = ${a * (h - b)}. ${(w - a) * h} + ${a * (h - b)} = ${area}.`,
      trick: cut ? { name: 'Whole, take away', say: 'Find the area of the whole rectangle, then take away the piece that is missing.' } : { name: 'Split and add', say: 'Cut the shape into rectangles, find each area, and add them.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- perimeter ----------
// rungs: 1 small rectangles · 2 bigger rectangles · 3 L shapes · 4 bigger L shapes, two sides not
// written (opposite sides match) · 5 a missing side from the perimeter · 6 bigger numbers, L shapes
// with sides to work out
const outline = (rs: Rect[]) => {
  // perimeter of a union of grid rectangles: count unit edges with one side inside
  const cells = new Set<string>();
  for (const q of rs) for (let x = q.x; x < q.x + q.w; x++) for (let y = q.y; y < q.y + q.h; y++) cells.add(`${x},${y}`);
  let p = 0;
  for (const c of cells) { const [x, y] = c.split(',').map(Number); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!cells.has(`${x + dx},${y + dy}`)) p++; }
  return p;
};
export const msPerim: Skill = {
  id: 'ms-perim', area: 'measure', grade: 3, standard: '3.MD.D.8',
  name: 'Perimeter', short: 'Perimeter', plain: 'Finds the perimeter (the distance all the way round) by adding the sides, and finds a missing side when the perimeter is known.',
  input: 'number', fastMs: 11000,
  subs: [{ id: 'grid', label: 'count round the edge' }, { id: 'add', label: 'add the sides' }, { id: 'missing', label: 'a missing side' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const U = pick(rng, UNITS);
    const trick = { name: 'All the way round', say: 'Walk all the way round the fence and add every side. A rectangle has two pairs of matching sides.' };
    if (sub === 'grid') {
      const w = int(rng, ...perRung(r, [[2, 3], [3, 5], [3, 6], [4, 7], [4, 8], [5, 9]] as [number, number][])), h = int(rng, ...perRung(r, [[1, 3], [2, 4], [3, 5], [3, 6], [4, 7], [4, 8]] as [number, number][]));
      const L = r >= 3 && h >= 3 && w >= 3;
      const a = L ? int(rng, 1, w - 2) : 0, b = L ? int(rng, 1, h - 2) : 0;
      const rects = L ? lShape(w, h, a, b) : [rect(0, 0, w, h)];
      const p = outline(rects);
      return {
        skill: 'ms-perim', key: 'ms-perim:grid', id: `ms-perim:grid:${w}x${h}-${a}x${b}`,
        ask: 'Count the edges all the way round. What is the perimeter?', prompt: [meas({ kind: 'shape', rects, grid: true, sides: [], fence: true }), op('='), blank, tx('units')],
        input: 'number', answer: { kind: 'number', value: p }, weight: Math.min(5, 1 + (L ? 1 : 0) + (r >= 5 ? 1 : 0)),
        explain: L ? `Go round the edge: ${p} units. (The bite out of the corner doesn't change it: the sides just move in.)` : `${w} + ${h} + ${w} + ${h} = ${p} units all the way round.`, trick,
      };
    }
    if (sub === 'missing') {
      if (r >= 5) {
        const s = int(rng, 3, r >= 6 ? 15 : 9);
        return {
          skill: 'ms-perim', key: 'ms-perim:missing', id: `ms-perim:missing:sq:${s}`,
          ask: `A square has a perimeter of ${4 * s} ${U}. How long is each side?`, prompt: [meas({ kind: 'shape', rects: [rect(0, 0, 4, 4)], grid: false, sides: [{ x1: 0, y1: 0, x2: 4, y2: 0, text: '?' }], fence: true }), tx(`Perimeter ${4 * s} ${U}`), op('·'), tx('side ='), blank, tx(U)],
          input: 'number', answer: { kind: 'number', value: s }, weight: 4,
          explain: `A square has 4 equal sides: ${4 * s} ÷ 4 = ${s} ${U}.`, trick: { name: 'Share the perimeter', say: 'All four sides of a square are the same, so share the perimeter into 4.' },
        };
      }
      const w = int(rng, 3, perRung(r, [6, 9, 12, 15])), h = int(rng, 2, perRung(r, [5, 8, 10, 12]));
      const P = 2 * (w + h);
      return {
        skill: 'ms-perim', key: 'ms-perim:missing', id: `ms-perim:missing:${w}x${h}`,
        ask: `The perimeter is ${P} ${U}. How long is the missing side?`, prompt: [meas({ kind: 'shape', rects: [rect(0, 0, Math.min(w, 12), Math.min(h, 8))], grid: false, sides: [{ x1: 0, y1: 0, x2: Math.min(w, 12), y2: 0, text: `${w} ${U}` }, { x1: 0, y1: 0, x2: 0, y2: Math.min(h, 8), text: '?' }], fence: true }), tx(`Perimeter ${P} ${U}`), op('·'), tx('? ='), blank, tx(U)],
        input: 'number', answer: { kind: 'number', value: h }, weight: Math.min(5, 3 + (r >= 3 ? 1 : 0)),
        explain: `The two ${w} ${U} sides make ${2 * w}. ${P} − ${2 * w} = ${P - 2 * w} for the other two, so each is ${h} ${U}.`,
        trick: { name: 'Take away what you know', say: 'Take the sides you know away from the perimeter, then share what is left between the matching sides.' },
      };
    }
    const w = int(rng, ...perRung(r, [[2, 6], [4, 12], [5, 12], [6, 15], [8, 20], [10, 30]] as [number, number][]));
    const h = int(rng, ...perRung(r, [[2, 5], [3, 9], [4, 10], [5, 12], [6, 15], [8, 25]] as [number, number][]));
    if (r >= 3 && r !== 4 && w >= 4 && h >= 4) {
      const a = int(rng, 1, w - 2), b = int(rng, 1, h - 2);
      const sw = Math.min(w, 12), sh = Math.min(h, 9), sa = Math.max(1, Math.min(sw - 1, Math.round(a * sw / w))), sb = Math.max(1, Math.min(sh - 1, Math.round(b * sh / h)));
      const all = r === 3;
      const sides: Side[] = [
        { x1: 0, y1: 0, x2: sw - sa, y2: 0, text: `${w - a}` }, { x1: sw - sa, y1: 0, x2: sw - sa, y2: sb, text: all ? `${b}` : '' }, { x1: sw - sa, y1: sb, x2: sw, y2: sb, text: `${a}` },
        { x1: sw, y1: sb, x2: sw, y2: sh, text: `${h - b}` }, { x1: 0, y1: sh, x2: sw, y2: sh, text: all ? `${w}` : '' }, { x1: 0, y1: 0, x2: 0, y2: sh, text: `${h}` },
      ];
      return {
        skill: 'ms-perim', key: 'ms-perim:add', id: `ms-perim:add:L:${w}x${h}-${a}x${b}${all ? 'a' : ''}`,
        ask: all ? 'Add all the sides. What is the perimeter?' : 'Two sides have no number: work them out first. What is the perimeter?', prompt: [meas({ kind: 'shape', rects: lShape(sw, sh, sa, sb), grid: false, sides: sides.map(s => ({ ...s, text: s.text ? `${s.text} ${U}` : '' })), fence: true }), op('='), blank, tx(U)],
        input: 'number', answer: { kind: 'number', value: 2 * (w + h) }, weight: all ? 3 : 4,
        explain: `${w - a} + ${b} + ${a} + ${h - b} + ${w} + ${h} = ${2 * (w + h)} ${U}.${all ? '' : ` (The bottom is ${w - a} + ${a} = ${w}, the short step is ${h} − ${h - b} = ${b}.)`}`,
        trick: all ? trick : { name: 'Opposite sides match', say: 'The pieces on one side add up to the side across from them. Find the missing ones, then add everything.' },
      };
    }
    const two = r >= 4;
    const sw = Math.min(w, 12), sh = Math.min(h, 8);
    return {
      skill: 'ms-perim', key: 'ms-perim:add', id: `ms-perim:add:${w}x${h}${two ? '2' : ''}`,
      ask: two ? 'Opposite sides match. What is the perimeter?' : 'Add all the sides. What is the perimeter?', prompt: [meas({ kind: 'shape', rects: [rect(0, 0, sw, sh)], grid: false, fence: true, sides: two ? rectSides(sw, sh, U).map((s, i) => ({ ...s, text: `${i ? h : w} ${U}` })) : [{ x1: 0, y1: 0, x2: sw, y2: 0, text: `${w} ${U}` }, { x1: sw, y1: 0, x2: sw, y2: sh, text: `${h} ${U}` }, { x1: 0, y1: sh, x2: sw, y2: sh, text: `${w} ${U}` }, { x1: 0, y1: 0, x2: 0, y2: sh, text: `${h} ${U}` }] }), op('='), blank, tx(U)],
      input: 'number', answer: { kind: 'number', value: 2 * (w + h) }, weight: Math.min(5, 2 + (two ? 1 : 0) + (r >= 5 ? 1 : 0)),
      explain: `${w} + ${h} + ${w} + ${h} = ${2 * (w + h)} ${U}.`, trick,
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- big units to small (and back) ----------
// rungs: 1 tens, hundreds and thousands (metres to centimetres, kilograms to grams), 1 to 5 of them ·
// 2 any pair, 2 to 5 · 3 any pair, up to 10 · 4 mixed (3 ft 4 in = ? in) · 5 small back to big (48 in =
// ? ft) · 6 small to big with a half or a decimal (250 cm = 2.5 m)
type Pair = { big: string; small: string; k: number; easy: boolean };
/** a unit's name for an amount: 1 day, 9 days (the short ones stay as they are) */
const PLURAL: Record<string, string> = { day: 'days', week: 'weeks', yr: 'years', months: 'months', days: 'days' };
const SINGLE: Record<string, string> = { day: 'day', week: 'week', yr: 'year', months: 'month', days: 'day' };
const unitOf = (u: string, n: number) => (n === 1 ? SINGLE[u] ?? u : PLURAL[u] ?? u);
const PAIRS: Record<string, Pair[]> = {
  length: [{ big: 'm', small: 'cm', k: 100, easy: true }, { big: 'cm', small: 'mm', k: 10, easy: true }, { big: 'km', small: 'm', k: 1000, easy: true }, { big: 'ft', small: 'in', k: 12, easy: false }, { big: 'yd', small: 'ft', k: 3, easy: false }],
  weight: [{ big: 'kg', small: 'g', k: 1000, easy: true }, { big: 'L', small: 'mL', k: 1000, easy: true }, { big: 'lb', small: 'oz', k: 16, easy: false }, { big: 'gal', small: 'qt', k: 4, easy: false }, { big: 'qt', small: 'pt', k: 2, easy: false }],
  time: [{ big: 'hr', small: 'min', k: 60, easy: true }, { big: 'min', small: 'sec', k: 60, easy: true }, { big: 'day', small: 'hr', k: 24, easy: false }, { big: 'week', small: 'days', k: 7, easy: false }, { big: 'yr', small: 'months', k: 12, easy: false }],
};
export const msConvert: Skill = {
  id: 'ms-convert', area: 'measure', grade: 4, standard: '4.MD.A.1',
  name: 'Change the units', short: 'Units', plain: 'Changes a measurement from a bigger unit to a smaller one (3 ft = 36 in: times 12) and, from grade 5, back again (divide), including mixed units like 2 hr 15 min.',
  input: 'number', fastMs: 10000,
  subs: [{ id: 'length', label: 'length' }, { id: 'weight', label: 'weight and liquid' }, { id: 'time', label: 'time' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const pairs = PAIRS[sub] ?? PAIRS.length;
    const pr = pick(rng, r === 1 ? pairs.filter(x => x.easy) : pairs);
    const say1 = `1 ${unitOf(pr.big, 1)} = ${pr.k} ${unitOf(pr.small, pr.k)}`;
    const big2small = { name: 'Big to small: times', say: `A big unit holds lots of small ones (${say1}), so going to the small unit you times by ${pr.k}.` };
    const small2big = { name: 'Small to big: divide', say: `Small units make fewer big ones (${say1}), so going to the big unit you divide by ${pr.k}.` };
    if (r >= 5) {
      const half = r === 6 && rng() < 0.6 && pr.k % 2 === 0;
      const n = half ? int(rng, 1, 5) + 0.5 : int(rng, 2, r === 6 ? 12 : 9);
      const s = dec(n * pr.k, 2);
      return {
        skill: 'ms-convert', key: `ms-convert:${sub}`, id: `ms-convert:${pr.small}>${pr.big}:${s}`,
        ask: `How many ${unitOf(pr.big, 2)}?`, prompt: [num(s), tx(unitOf(pr.small, s)), op('='), blank, tx(unitOf(pr.big, n))],
        input: 'number', answer: { kind: 'number', value: n }, weight: half ? 5 : 4,
        explain: `${say1}, so ${s} ÷ ${pr.k} = ${n} ${unitOf(pr.big, n)}.`, trick: small2big,
      };
    }
    if (r === 4) {
      const n = int(rng, 1, 6), extra = int(rng, 1, pr.k - 1);
      return {
        skill: 'ms-convert', key: `ms-convert:${sub}`, id: `ms-convert:mix:${pr.big}:${n}+${extra}`,
        ask: `How many ${unitOf(pr.small, 2)} is that altogether?`, prompt: [num(n), tx(unitOf(pr.big, n)), num(extra), tx(unitOf(pr.small, extra)), op('='), blank, tx(unitOf(pr.small, 2))],
        input: 'number', answer: { kind: 'number', value: n * pr.k + extra }, weight: 4,
        explain: `${n} ${pr.big} = ${n} × ${pr.k} = ${n * pr.k} ${pr.small}, and ${extra} more: ${n * pr.k + extra} ${pr.small}.`,
        trick: { name: 'Change, then add', say: `Change the ${pr.big} into ${pr.small} first (times ${pr.k}), then add the ${pr.small} that are left.` },
      };
    }
    const n = int(rng, perRung(r, [1, 2, 2]), perRung(r, [5, 5, 10]));
    return {
      skill: 'ms-convert', key: `ms-convert:${sub}`, id: `ms-convert:${pr.big}>${pr.small}:${n}`,
      ask: `How many ${unitOf(pr.small, 2)}?`, prompt: [num(n), tx(unitOf(pr.big, n)), op('='), blank, tx(unitOf(pr.small, 2))],
      input: 'number', answer: { kind: 'number', value: n * pr.k }, weight: Math.min(5, (pr.easy ? 2 : 3) + (r >= 3 ? 1 : 0)),
      explain: `${say1}, so ${n} ${unitOf(pr.big, n)} = ${n} × ${pr.k} = ${n * pr.k} ${unitOf(pr.small, 2)}.`, trick: big2small,
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- volume (boxes of cubes) ----------
// rungs: 1 one layer of cubes · 2 two layers · 3 up to 4 by 3 by 3 · 4 a plain box with its edges'
// lengths · 5 the bottom's area times the height · 6 a missing edge from the volume
export const msVolume: Skill = {
  id: 'ms-volume', area: 'measure', grade: 5, standard: '5.MD.C.5',
  name: 'Volume of a box', short: 'Volume', plain: 'Finds the volume of a box by counting unit cubes, by layers, and with length × width × height; adds two boxes together.',
  input: 'number', fastMs: 12000,
  subs: [{ id: 'cubes', label: 'count the cubes' }, { id: 'multiply', label: 'length × width × height' }, { id: 'combine', label: 'two boxes' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const trick = { name: 'Layers', say: 'Count the cubes in the bottom layer (length times width), then times by how many layers high.' };
    const dims = (): [number, number, number] => perRung(r, [[int(rng, 2, 3), int(rng, 2, 3), 1], [int(rng, 2, 3), int(rng, 2, 3), 2], [int(rng, 2, 4), int(rng, 2, 3), int(rng, 2, 3)], [int(rng, 3, 6), int(rng, 2, 5), int(rng, 2, 4)], [int(rng, 3, 8), int(rng, 2, 6), int(rng, 2, 5)], [int(rng, 4, 10), int(rng, 3, 6), int(rng, 2, 6)]] as [number, number, number][]);
    const [l, w, h] = dims();
    const V = l * w * h;
    if (sub === 'cubes') {
      return {
        skill: 'ms-volume', key: 'ms-volume:cubes', id: `ms-volume:cubes:${l}x${w}x${h}`,
        ask: 'How many cubes make this box?', prompt: [meas({ kind: 'box', l, w, h, cubes: true }), op('='), blank, tx('cubes')],
        input: 'number', answer: { kind: 'number', value: V }, weight: Math.min(5, 1 + (h > 1 ? 1 : 0) + (r >= 4 ? 1 : 0) + (r >= 6 ? 1 : 0)),
        explain: `${l} × ${w} = ${l * w} in each layer, and ${h} ${h === 1 ? 'layer' : 'layers'}: ${l * w} × ${h} = ${V} cubes.`, trick,
      };
    }
    const U = pick(rng, ['cm', 'in', 'ft', 'm']);
    if (sub === 'combine') {
      const [l2, w2, h2] = [int(rng, 1, Math.max(1, l - 1)), w, int(rng, 1, h + 1)];
      const V2 = l2 * w2 * h2;
      return {
        skill: 'ms-volume', key: 'ms-volume:combine', id: `ms-volume:combine:${l}x${w}x${h}+${l2}x${w2}x${h2}`,
        ask: 'Two boxes glued together. What is the volume of both?', prompt: [meas({ kind: 'box', l, w, h, cubes: r <= 2, labels: r <= 2 ? undefined : [`${l} ${U}`, `${w} ${U}`, `${h} ${U}`] }), op('+'), meas({ kind: 'box', l: l2, w: w2, h: h2, cubes: r <= 2, labels: r <= 2 ? undefined : [`${l2} ${U}`, `${w2} ${U}`, `${h2} ${U}`] }), op('='), blank, tx(r <= 2 ? 'cubes' : `cubic ${U}`)],
        input: 'number', answer: { kind: 'number', value: V + V2 }, weight: Math.min(5, 3 + (r >= 4 ? 1 : 0)),
        explain: `${l} × ${w} × ${h} = ${V}, and ${l2} × ${w2} × ${h2} = ${V2}. ${V} + ${V2} = ${V + V2}.`,
        trick: { name: 'Each box, then add', say: 'Find the volume of each box (length × width × height), then add the two.' },
      };
    }
    if (r >= 6) {
      return {
        skill: 'ms-volume', key: 'ms-volume:multiply', id: `ms-volume:multiply:miss:${l}x${w}x${h}`,
        ask: `The box holds ${V} cubic ${U}. It is ${l} ${U} long and ${w} ${U} wide. How tall is it?`, prompt: [meas({ kind: 'box', l, w, h, cubes: false, labels: [`${l} ${U}`, `${w} ${U}`, '?'] }), tx(`Volume ${V}`), op('·'), tx('height ='), blank, tx(U)],
        input: 'number', answer: { kind: 'number', value: h }, weight: 5,
        explain: `${l} × ${w} = ${l * w} on the bottom. ${l * w} × ? = ${V}, so the height is ${V} ÷ ${l * w} = ${h} ${U}.`,
        trick: { name: 'Think times', say: 'Times the length by the width for the bottom layer, then ask how many layers make the volume.' },
      };
    }
    if (r === 5) {
      return {
        skill: 'ms-volume', key: 'ms-volume:multiply', id: `ms-volume:multiply:base:${l * w}x${h}`,
        ask: `The bottom of the box is ${l * w} square ${U}. It is ${h} ${U} tall. What is its volume?`, prompt: [tx(`Bottom ${l * w} sq ${U}`), op('×'), tx(`${h} ${U} tall`), op('='), blank, tx(`cubic ${U}`)],
        input: 'number', answer: { kind: 'number', value: V }, weight: 4,
        explain: `Each layer is ${l * w}, and there are ${h} layers: ${l * w} × ${h} = ${V} cubic ${U}.`, trick,
      };
    }
    const cubes = r <= 2;
    return {
      skill: 'ms-volume', key: 'ms-volume:multiply', id: `ms-volume:multiply:${l}x${w}x${h}${cubes ? 'c' : ''}`,
      ask: 'What is the volume of the box?', prompt: [meas({ kind: 'box', l, w, h, cubes, labels: [`${l} ${U}`, `${w} ${U}`, `${h} ${U}`] }), op('='), blank, tx(`cubic ${U}`)],
      input: 'number', answer: { kind: 'number', value: V }, weight: Math.min(5, 2 + (r >= 3 ? 1 : 0) + (r >= 4 ? 1 : 0)),
      explain: `Length × width × height: ${l} × ${w} × ${h} = ${V} cubic ${U}.`, trick,
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- units with ratios (grade 6, light) ----------
// rungs: tables: 1 from 1, doubling · 2 any count · 3 going back (inches to feet) · 4-6 bigger units and
// counts. Steps: 1-2 two steps (yards to feet to inches) · 3 bigger, or hours to seconds · 4 a half
// (2.5 ft = 30 in) · 5 halves both ways · 6 quarters (1.75 hr). Rates: 1-3 how much for one (miles in
// each hour) · 4-6 how much for one, then for more
const TABLES: [string, string, number][] = [['feet', 'inches', 12], ['yards', 'feet', 3], ['hours', 'minutes', 60], ['metres', 'centimetres', 100], ['pounds', 'ounces', 16], ['gallons', 'quarts', 4], ['days', 'hours', 24], ['kilograms', 'grams', 1000]];
const RATES: { what: string; per: string; unit: string }[] = [
  { what: 'A snail crawls {a} inches in {b} minutes.', per: 'How many inches does it crawl each minute?', unit: 'inches' },
  { what: 'A train goes {a} miles in {b} hours.', per: 'How many miles does it go each hour?', unit: 'miles' },
  { what: 'A tap fills {a} litres in {b} minutes.', per: 'How many litres does it fill each minute?', unit: 'litres' },
  { what: 'Pip reads {a} pages in {b} days.', per: 'How many pages does Pip read each day?', unit: 'pages' },
];
export const msRatio: Skill = {
  id: 'ms-ratio', area: 'measure', grade: 6, standard: '6.RP.A.3',
  name: 'Units and rates', short: 'Rates', plain: 'Uses ratio reasoning to change units (a table of feet and inches, two steps, halves) and finds a unit rate (miles in each hour).',
  input: 'number', fastMs: 14000,
  subs: [{ id: 'table', label: 'a table of units' }, { id: 'steps', label: 'two steps and halves' }, { id: 'rate', label: 'how much for one' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    if (sub === 'rate') {
      const t = pick(rng, RATES), b = int(rng, 2, perRung(r, [4, 5, 6, 8, 9, 12])), each = int(rng, 2, perRung(r, [10, 12, 15, 20, 25, 30])), a = b * each;
      const more = r >= 4 ? int(rng, 2, 9) : 0;
      const q = t.what.replace('{a}', String(a)).replace('{b}', String(b));
      return {
        skill: 'ms-ratio', key: 'ms-ratio:rate', id: `ms-ratio:rate:${t.unit}:${a}/${b}${more ? `x${more}` : ''}`,
        ask: more ? `${q} At that speed, how many ${t.unit} in ${more}?` : `${q} ${t.per}`, prompt: [tx(`${a} ${t.unit} in ${b}`), op('→'), tx(more ? `in ${more}` : 'in 1'), op('='), blank],
        input: 'number', answer: { kind: 'number', value: more ? each * more : each }, weight: Math.min(5, 3 + (more ? 1 : 0) + (r >= 6 ? 1 : 0)),
        explain: more ? `${a} ÷ ${b} = ${each} for one, so ${each} × ${more} = ${each * more}.` : `${a} ÷ ${b} = ${each} for each one.`,
        trick: { name: 'Find one first', say: 'Divide to find how much for one. Then times to find how much for any number.' },
      };
    }
    const [big, small, k] = pick(rng, r <= 2 ? TABLES.filter(x => x[2] <= 60) : TABLES);
    if (sub === 'steps') {
      if (r <= 3) {
        // two steps: yards to feet to inches, or hours to minutes to seconds
        const yd = r < 3 || rng() < 0.5, n = int(rng, 2, perRung(r, [2, 3, 5]));
        return {
          skill: 'ms-ratio', key: 'ms-ratio:steps', id: `ms-ratio:steps:${yd ? 'yd' : 'hr'}:${n}`,
          ask: yd ? 'How many inches?' : 'How many seconds?', prompt: yd ? [num(n), tx('yards'), op('='), blank, tx('inches')] : [num(n), tx('hours'), op('='), blank, tx('seconds')],
          input: 'number', answer: { kind: 'number', value: yd ? n * 36 : n * 3600 }, weight: 3,
          explain: yd ? `${n} yards = ${n * 3} feet, and ${n * 3} feet = ${n * 3} × 12 = ${n * 36} inches.` : `${n} hours = ${n * 60} minutes, and ${n * 60} minutes = ${n * 60} × 60 = ${n * 3600} seconds.`,
          trick: { name: 'One step at a time', say: yd ? 'Change to the middle unit first (yards to feet), then to the last one (feet to inches).' : 'Change to the middle unit first (hours to minutes), then to the last one (minutes to seconds).' },
        };
      }
      // halves and quarters: 2.5 ft = 30 in, or back again
      const [big2, small2, k2] = pick(rng, TABLES.filter(x => x[2] % 4 === 0));
      const n = int(rng, 1, 6) + (r === 6 ? pick(rng, [0.25, 0.5, 0.75]) : 0.5), back = r >= 5 && rng() < 0.5;
      const s2 = n * k2;
      return {
        skill: 'ms-ratio', key: 'ms-ratio:steps', id: `ms-ratio:steps:part:${big2}:${n}${back ? 'b' : ''}`,
        ask: back ? `How many ${big2}?` : `How many ${small2}?`, prompt: back ? [num(s2), tx(small2), op('='), blank, tx(big2)] : [num(n), tx(big2), op('='), blank, tx(small2)],
        input: 'number', answer: { kind: 'number', value: back ? n : s2 }, weight: r === 6 ? 5 : 4,
        explain: back ? `${s2} ÷ ${k2} = ${n} ${big2}.` : `${n} ${big2} is ${Math.floor(n)} and ${n % 1 === 0.5 ? 'a half' : n % 1 === 0.25 ? 'a quarter' : 'three quarters'}: ${Math.floor(n) * k2} + ${(n % 1) * k2} = ${s2} ${small2}.`,
        trick: { name: 'Part of a unit', say: `Half of 1 ${big2.replace(/s$/, '')} is half of ${k2}: ${k2 / 2} ${small2}. A quarter is ${k2 / 4}. Add it to the whole ones.` },
      };
    }
    // the table: 1 → k, 2 → 2k, then a gap
    const back = r >= 3 && rng() < 0.6;
    const ns = r === 1 ? [1, 2, 4] : [1, int(rng, 2, 3), int(rng, 4, perRung(r, [6, 9, 12, 12, 15, 20]))];
    const gap = ns[2];
    const rows: [string, string][] = ns.map((n, i) => i < 2 ? [String(n), String(n * k)] : back ? ['?', String(n * k)] : [String(n), '?']);
    return {
      skill: 'ms-ratio', key: 'ms-ratio:table', id: `ms-ratio:table:${big}:${gap}${back ? 'b' : ''}`,
      ask: 'Fill in the table.', prompt: [meas({ kind: 'table', head: [big, small], rows }), op('·'), tx('? ='), blank],
      input: 'number', answer: { kind: 'number', value: back ? gap : gap * k }, weight: Math.min(5, 2 + (back ? 1 : 0) + (r >= 4 ? 1 : 0)),
      explain: back ? `Every ${k} ${small} make 1 ${big.replace(/s$/, '')}: ${gap * k} ÷ ${k} = ${gap} ${big}.` : `Each ${big.replace(/s$/, '')} is ${k} ${small}: ${gap} × ${k} = ${gap * k} ${small}.`,
      trick: { name: 'Same times every row', say: `Every row of the table times by the same number (${k}). Times to go right, divide to go left.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

export const MEASURE_SKILLS: Skill[] = [msHour, msCompare, msFive, msRuler, msMinute, msElapsed, msMass, msArea, msPerim, msConvert, msVolume, msRatio];

/** A measuring picture in a few words (results, battle cards). */
export function measText(m: MeasPic): string {
  switch (m.kind) {
    case 'clock': return `a clock at ${timeText(m.h, m.m)}`;
    case 'time': return `${timeText(m.h, m.m)}${m.ap ? ` ${m.ap}` : ''}`;
    case 'thing': return THING_NAME[m.thing];
    case 'ruler': return m.items.map(x => `a ${THING_NAME[x.thing]} from ${x.from} to ${x.to} ${m.unit}`).join(' and ');
    case 'lengths': return m.items.map(x => `a ${THING_NAME[x.thing]} ${x.len} long`).join(', ');
    case 'scale': return `${m.load} on a scale`;
    case 'jug': return 'a jug of water';
    case 'shape': return 'a garden of squares';
    case 'box': return `a ${m.l} by ${m.w} by ${m.h} box`;
    case 'table': return `a table of ${m.head[0]} and ${m.head[1]}`;
  }
}
