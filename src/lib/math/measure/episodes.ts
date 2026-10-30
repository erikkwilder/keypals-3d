// The Measurement and time Learn episodes: six short stories at the table in the Clockmaker's Workshop
// (episodes.ts SETS.clockshop), one for each big idea of the area: o'clock and half past, counting the
// minutes by fives, jumping to the hour for how long things take, starting a ruler at 0, reading the
// marks on a scale and a jug, and rows of squares for area (with a fence round them for perimeter).
//
// They play in the shared episode framework (the 3D place, the buddy and a Glimmer at the table, the
// coach's voice and words, the shortcut over what you just did, the buddy's mistake to fix, two turns of
// your own, a trick card, the next day's quick check: math/measure/MeasureEpisode.svelte), with real 3D
// things to work with on the table (three/measureKit.ts): a standing clock whose hands you drag, a ruler
// with a pencil and a crayon to slide along it, a kitchen scale and a sack to put on it, a glass jug to
// fill, and a garden bed to tile with grass. Each step is something the hands do; the coach's lines are
// in content/voice.ts (ep.<id>.intro, .s0..., .card), with the same words as here.
import type { GlimmerId } from '../../adventure/glimmers';
import type { Face } from '../skills/measure';

/** what's on the table: each thing is there when given (null or missing: not there) */
export type KitState = {
  /** a standing clock: minutes past 12 (0..719), and its face */
  clock?: { t: number; face: Face } | null;
  /** a ruler `len` long, with a pencil and a crayon (or other things) lying above it from..to */
  ruler?: { unit: 'cm' | 'in'; len: number; items: { thing: 'pencil' | 'crayon'; from: number; to: number }[] } | null;
  /** a kitchen scale (`load`: the sack is on its pan, so the needle shows `value`) */
  scale?: { max: number; step: number; label: number; value: number; unit: 'g' | 'kg'; load: boolean } | null;
  /** a glass jug with water up to `value` */
  jug?: { max: number; step: number; label: number; value: number; unit: 'mL' | 'L' } | null;
  /** a garden bed w by h squares, `tiles` of them grassed (row by row), a fence round it when `fence` */
  garden?: { w: number; h: number; tiles: number; fence: boolean } | null;
};
/** A step's job for the kid's hands (what changes on the table):
 *  - hand: drag the clock's hour or minute hand until the clock says `to` (the other hand follows like a real clock)
 *  - nums: tap each glowing number on the clock to see its minutes (5, 10, 15...)
 *  - slide: drag the ruler's thing `item` along until it starts at `to`
 *  - mark: tap the glowing mark on the ruler to read it
 *  - load: drag the sack onto the scale's pan
 *  - pour: drag the water in the jug up to `to`
 *  - tiles: drag grass tiles into the glowing squares until `to` are down (after `by`, the rest follow)
 *  - sides: tap each side of the fence to see how long it is
 *  - watch: just look and listen */
export type MTask =
  | { kind: 'watch' }
  | { kind: 'hand'; hand: 'hour' | 'minute'; to: number }
  | { kind: 'nums'; nums: number[] }
  | { kind: 'slide'; item: number; to: number }
  | { kind: 'mark'; at: number; label: string }
  | { kind: 'load' }
  | { kind: 'pour'; to: number }
  | { kind: 'tiles'; to: number; by: number }
  | { kind: 'sides' };
export type MStep = { say: string; /** the shortcut over the work; [x] is lit up */ eq: string; do: MTask; /** the table when the step starts */ at: KitState };
/** a question: a number to type, a choice to tap, or the clock (set its hands) or the jug (fill it) to work */
export type MQ = { text: string; ans: string; input: 'num' | 'choice' | 'clock' | 'pour'; choices?: string[]; hint: string; hidden: string; at: KitState };
export type MeasureLesson = {
  id: string; title: string; blurb: string;
  /** the Glimmer at the table */
  star: GlimmerId;
  intro: string;
  steps: MStep[];
  /** the buddy's go: what it gets wrong, what it says, one more wrong choice, and the fix */
  teach: { q: MQ; wrong: string; says: string; decoy: string; fixed: string };
  tries: [MQ, MQ, MQ];
  card: string;
  /** the measuring skills it teaches (skills/measure.ts) */
  skills: string[];
};

/** minutes past 12 for h:m */
export const T = (h: number, m = 0) => (h % 12) * 60 + m;
const clock = (h: number, m = 0, face: Face = 'all'): KitState => ({ clock: { t: T(h, m), face } });
const ruler = (items: { thing: 'pencil' | 'crayon'; from: number; to: number }[], len = 12, unit: 'cm' | 'in' = 'cm'): KitState => ({ ruler: { unit, len, items } });
const scale = (value: number, load = true, max = 1000, step = 100, label = 200): KitState => ({ scale: { max, step, label, value, unit: 'g', load } });
const jug = (value: number, max = 1000, step = 100, label = 200): KitState => ({ jug: { max, step, label, value, unit: 'mL' } });
const garden = (w: number, h: number, tiles: number, fence = false): KitState => ({ garden: { w, h, tiles, fence } });
const Q = (text: string, ans: string, input: MQ['input'], hint: string, hidden: string, at: KitState, choices?: string[]): MQ => ({ text, ans, input, hint, hidden, at, choices });

export const MEASURE_LESSONS: MeasureLesson[] = [
  {
    id: 'ms-oclock', title: "O'clock and Half Past", blurb: "The short hand says the hour. The long hand on 12 is o'clock, on 6 is half past.", star: 'sunsnail', skills: ['ms-hour'],
    intro: "Sunny Snail is never in a hurry, but the party starts at 3 o'clock! Let's learn to read the clock.",
    steps: [
      { say: 'A clock has two hands. The short hand tells the hour. The long hand tells the minutes.', eq: 'short hand: [hour]   long hand: [minutes]', do: { kind: 'watch' }, at: clock(12) },
      { say: "Drag the short hand to the 3. The long hand points straight up at 12, so it's 3 o'clock!", eq: "[3 o'clock] = 3:00", do: { kind: 'hand', hand: 'hour', to: T(3) }, at: clock(12) },
      { say: 'Now drag the long hand half way round, to the 6. Watch the short hand move too!', eq: 'half past 3 = [3:30]', do: { kind: 'hand', hand: 'minute', to: T(3, 30) }, at: clock(3) },
      { say: "The short hand is half way between 3 and 4. It hasn't reached 4 yet, so it's still half past 3!", eq: '[half past 3]', do: { kind: 'watch' }, at: clock(3, 30) },
    ],
    teach: { q: Q('What time is it?', '2:30', 'choice', 'The short hand has passed 2 but not reached 3: half past 2.', '', clock(2, 30)), wrong: '3:30', says: 'The short hand is near the 3... so it is half past 3!', decoy: '6:10', fixed: "The short hand has gone past 2, but it isn't at 3 yet. It's half past 2: 2:30!" },
    tries: [
      Q("Set the clock to 5 o'clock.", '5:00', 'clock', "Long hand on 12, short hand on 5.", 'Put the long hand on 12 first. Then the short hand on the hour.', clock(9)),
      Q('Set the clock to half past 8.', '8:30', 'clock', 'Long hand on 6, short hand half way between 8 and 9.', 'Half past: the long hand goes on the 6.', clock(12)),
      Q('Set the clock to half past 11.', '11:30', 'clock', 'Long hand on 6, short hand half way between 11 and 12.', 'Half past: the long hand goes on the 6.', clock(4)),
    ],
    card: "You won the O'clock card! The short hand says the hour. The long hand on 12 is o'clock, on 6 is half past.",
  },
  {
    id: 'ms-fives', title: 'Count by Fives', blurb: 'Each number on the clock is 5 more minutes. Then count the little marks by ones.', star: 'sunsnail', skills: ['ms-five', 'ms-minute'],
    intro: "Sunny Snail's train leaves at 20 past 7. Where does the long hand go? Let's count the minutes by fives.",
    steps: [
      { say: "It's 7 o'clock. The long hand is on 12, at the very start of the hour.", eq: '[7:00]', do: { kind: 'watch' }, at: clock(7) },
      { say: 'Each number is 5 more minutes. Tap the numbers to count by fives!', eq: '5, 10, 15, [20]', do: { kind: 'nums', nums: [1, 2, 3, 4] }, at: clock(7) },
      { say: "Now drag the long hand to the 4. That's 20 minutes past 7!", eq: '20 past 7 = [7:20]', do: { kind: 'hand', hand: 'minute', to: T(7, 20) }, at: clock(7) },
      { say: 'The little marks between the numbers are one minute each. Two marks past the 4 is 22 minutes: 7:22!', eq: '20 + 2 = 22 → [7:22]', do: { kind: 'watch' }, at: clock(7, 22) },
    ],
    teach: { q: Q('What time is it?', '4:40', 'choice', 'The long hand is on 8: 8 fives is 40. It is 4:40.', '', clock(4, 40)), wrong: '4:08', says: 'The long hand is on the 8... so it is 4:08!', decoy: '8:20', fixed: 'The 8 means 8 fives: 5, 10, 15, 20, 25, 30, 35, 40. It is 4:40!' },
    tries: [
      Q('What time is it?', '9:15', 'choice', 'The long hand is on 3: 3 fives is 15. 9:15.', 'Count by fives to the long hand.', clock(9, 15), ['9:15', '9:03', '3:45']),
      Q('Set the clock to 2:45.', '2:45', 'clock', 'Long hand on 9 (9 fives is 45), short hand most of the way to 3.', 'Count by fives: 45 is the 9.', clock(12)),
      Q('Set the clock to 6:25.', '6:25', 'clock', 'Long hand on 5 (5 fives is 25), short hand a little past 6.', 'Count by fives: 25 is the 5.', clock(3)),
    ],
    card: 'You won the Count by Fives card! Each number on the clock is 5 more minutes. The little marks are 1 minute each.',
  },
  {
    id: 'ms-jump', title: 'Jump to the Hour', blurb: "How long, or when does it end? Jump to the next o'clock first, then add the rest.", star: 'teakettledrake', skills: ['ms-elapsed'],
    intro: 'Teakettle Dragon put a cake in the oven at 2:40. It bakes for 35 minutes. When will it be ready?',
    steps: [
      { say: 'The cake went in at 2:40. We need to add 35 minutes.', eq: '2:40 + [35 minutes]', do: { kind: 'watch' }, at: clock(2, 40) },
      { say: "First, jump to the next o'clock. Turn the long hand on to the 12. That's 20 minutes, and now it's 3:00!", eq: '2:40 → 3:00 = [20 minutes]', do: { kind: 'hand', hand: 'minute', to: T(3) }, at: clock(2, 40) },
      { say: '35 take away 20 leaves 15 more minutes. Turn the long hand on to the 3.', eq: '3:00 + 15 = [3:15]', do: { kind: 'hand', hand: 'minute', to: T(3, 15) }, at: clock(3) },
      { say: '20 minutes and 15 minutes make 35. The cake is ready at 3:15!', eq: '2:40 + 35 minutes = [3:15]', do: { kind: 'watch' }, at: clock(3, 15) },
    ],
    teach: { q: Q('10:50 and 20 minutes later?', '11:10', 'choice', "10 minutes takes it to 11:00, then 10 more: 11:10.", '', clock(10, 50)), wrong: '10:70', says: '50 and 20 make 70... so it is 10:70!', decoy: '10:30', fixed: "A clock only goes up to 59 minutes! 10 minutes takes us to 11:00, then 10 more: 11:10." },
    tries: [
      Q('4:30 and 45 minutes later?', '5:15', 'choice', "30 minutes takes it to 5:00, then 15 more: 5:15.", "Jump to 5 o'clock first.", clock(4, 30), ['5:15', '4:75', '5:45']),
      Q('From 1:45 to 2:20 is how many minutes?', '35', 'num', "15 minutes to 2:00, then 20 more: 35 minutes.", "How long to 2 o'clock? Then add the rest.", clock(1, 45)),
      Q('7:50 and 25 minutes later?', '8:15', 'choice', "10 minutes to 8:00, then 15 more: 8:15.", "Jump to 8 o'clock first.", clock(7, 50), ['8:15', '7:75', '8:25']),
    ],
    card: "You won the Jump to the Hour card! Jump to the next o'clock first, then add the minutes that are left.",
  },
  {
    id: 'ms-zero', title: 'Start at Zero', blurb: 'Line one end up with 0, then read the number at the other end.', star: 'mushmouse', skills: ['ms-ruler', 'ms-compare'],
    intro: 'Mushroom Mouse found a crayon and a pencil. Which one is longer, and by how much? Let\'s measure them!',
    steps: [
      { say: "Here's a ruler. The crayon isn't lined up yet, so we can't read it.", eq: 'line it up with [0]', do: { kind: 'watch' }, at: ruler([{ thing: 'crayon', from: 3.5, to: 9.5 }, { thing: 'pencil', from: 2, to: 11 }]) },
      { say: 'Slide the crayon along so its end sits on the 0 line.', eq: 'it starts at [0]', do: { kind: 'slide', item: 0, to: 0 }, at: ruler([{ thing: 'crayon', from: 3.5, to: 9.5 }, { thing: 'pencil', from: 2, to: 11 }]) },
      { say: 'Now read the other end. Tap the glowing mark!', eq: 'it ends at 6: [6 cm]', do: { kind: 'mark', at: 6, label: '6 cm' }, at: ruler([{ thing: 'crayon', from: 0, to: 6 }, { thing: 'pencil', from: 2, to: 11 }]) },
      { say: 'Now line up the pencil with 0 too. It ends at 9!', eq: 'the pencil: [9 cm]', do: { kind: 'slide', item: 1, to: 0 }, at: ruler([{ thing: 'crayon', from: 0, to: 6 }, { thing: 'pencil', from: 2, to: 11 }]) },
      { say: '9 take away 6 is 3. The pencil is 3 centimetres longer!', eq: '9 − 6 = [3 cm] longer', do: { kind: 'watch' }, at: ruler([{ thing: 'crayon', from: 0, to: 6 }, { thing: 'pencil', from: 0, to: 9 }]) },
    ],
    teach: { q: Q('How long is the crayon?', '5', 'choice', 'It goes from 2 to 7: that is 5 cm.', '', ruler([{ thing: 'crayon', from: 2, to: 7 }])), wrong: '7', says: 'The crayon ends at 7... so it is 7 centimetres long!', decoy: '9', fixed: "It starts at 2, not at 0! From 2 to 7 is 5 centimetres." },
    tries: [
      Q('How long is the pencil, in cm?', '8', 'num', 'It starts at 0 and ends at 8: 8 cm.', 'Find the 0 end, then read the other end.', ruler([{ thing: 'pencil', from: 0, to: 8 }])),
      Q('How long is the crayon, in cm?', '7', 'num', 'From 3 to 10 is 7 cm.', "It doesn't start at 0. Count the spaces.", ruler([{ thing: 'crayon', from: 3, to: 10 }])),
      Q('How long is the pencil, in cm?', '8', 'num', 'From 1 to 9 is 8 cm.', "It doesn't start at 0. Count the spaces.", ruler([{ thing: 'pencil', from: 1, to: 9 }])),
    ],
    card: 'You won the Start at Zero card! Line one end up with 0, then read the number at the other end.',
  },
  {
    id: 'ms-marks', title: 'Read the Marks', blurb: 'Find the number just below, then count the marks up. Each mark might be 100!', star: 'geodemole', skills: ['ms-mass'],
    intro: 'Geode Mole is making soup! It needs 600 grams of carrots and 400 millilitres of water.',
    steps: [
      { say: 'Look at the scale. The numbers go up by 200, and every mark is 100 grams.', eq: 'each mark = [100 g]', do: { kind: 'watch' }, at: { ...scale(0, false), ...jug(0) } },
      { say: 'Drag the sack of carrots onto the scale. Watch the needle!', eq: '400, [500], [600] g', do: { kind: 'load' }, at: { ...scale(600, false), ...jug(0) } },
      { say: 'Now the water. Drag the water in the jug up to the 400 line.', eq: '[400 mL]', do: { kind: 'pour', to: 400 }, at: { ...scale(600), ...jug(0) } },
      { say: 'Find the number just below, then count the marks up. 400, then 500, then 600. Soup time!', eq: '400 + 100 + 100 = [600]', do: { kind: 'watch' }, at: { ...scale(600), ...jug(400) } },
    ],
    teach: { q: Q('How heavy is the sack?', '700', 'choice', 'One mark past 600 is 700 grams: each mark is 100.', '', scale(700)), wrong: '601', says: 'One mark past 600... so it is 601 grams!', decoy: '610', fixed: 'Each mark is 100 grams, not 1. One mark past 600 is 700 grams!' },
    tries: [
      Q('How heavy is the sack, in grams?', '300', 'num', '200, then one mark more: 300 grams.', 'Find the number below the needle, then count the marks.', scale(300)),
      Q('Pour 800 mL of water.', '800', 'pour', 'Fill it up to the 800 line.', 'Each mark is 100 mL. Count up to 800.', jug(0)),
      Q('How much water is in the jug, in mL?', '500', 'num', '400, then one mark more: 500 mL.', 'Find the number below the water, then count the marks.', jug(500)),
    ],
    card: 'You won the Read the Marks card! Find the number just below, then count the marks up.',
  },
  {
    id: 'ms-rows', title: 'Rows of Squares', blurb: 'Area is rows times how many in a row. Perimeter is all the way round.', star: 'pebbletort', skills: ['ms-area', 'ms-perim'],
    intro: 'Pebble Tortoise wants a garden 4 squares long and 3 squares wide. How many grass tiles will it need?',
    steps: [
      { say: 'Here is the garden bed: 4 squares long and 3 squares wide.', eq: '[4] long, [3] wide', do: { kind: 'watch' }, at: garden(4, 3, 0) },
      { say: 'Drag grass tiles into the first row!', eq: 'one row: [4] squares', do: { kind: 'tiles', to: 4, by: 2 }, at: garden(4, 3, 0) },
      { say: 'Now fill the other rows. Drag a tile, and the rest will follow!', eq: '3 rows of 4 = [12]', do: { kind: 'tiles', to: 12, by: 1 }, at: garden(4, 3, 4) },
      { say: '3 rows of 4 is 12 squares. That is the area: length times width, 4 times 3!', eq: '4 × 3 = [12] squares', do: { kind: 'watch' }, at: garden(4, 3, 12) },
      { say: 'Now a fence goes all the way round. Tap each side to measure it!', eq: '4 + 3 + 4 + 3 = [14]', do: { kind: 'sides' }, at: garden(4, 3, 12, true) },
    ],
    teach: { q: Q('What is the area of a garden 5 long and 2 wide?', '10', 'choice', '2 rows of 5: 5 × 2 = 10 squares.', '', garden(5, 2, 10)), wrong: '7', says: '5 and 2 make 7... so the area is 7 squares!', decoy: '14', fixed: 'Area is rows times how many in a row. 2 rows of 5 is 10 squares!' },
    tries: [
      Q('What is the area, in squares?', '15', 'num', '3 rows of 5: 15 squares.', 'Count one row, then times by the rows.', garden(5, 3, 15)),
      Q('How long is the fence all the way round?', '16', 'num', '6 + 2 + 6 + 2 = 16.', 'Add every side: two long ones and two short ones.', garden(6, 2, 12, true)),
      Q('What is the area, in squares?', '16', 'num', '4 rows of 4: 16 squares.', 'Count one row, then times by the rows.', garden(4, 4, 16)),
    ],
    card: 'You won the Rows of Squares card! Area is rows times how many in a row. Perimeter is all the way round.',
  },
];
export const MEASURE_LESSON: Record<string, MeasureLesson> = Object.fromEntries(MEASURE_LESSONS.map(l => [l.id, l]));
/** The coach's lines for an episode, by voice-line id (content/voice.ts has the same words). */
export const measureLines = (l: MeasureLesson): [string, string][] => [[`ep.${l.id}.intro`, l.intro], ...l.steps.map((s, i): [string, string] => [`ep.${l.id}.s${i}`, s.say]), [`ep.${l.id}.card`, l.card]];
/** "3:30" as minutes past 12 */
export const parseTime = (s: string) => { const [h, m] = s.split(':').map(Number); return T(h, m || 0); };
/** The three answers for fixing the buddy's mistake, in a fixed order per episode. */
export function fixChoices(l: MeasureLesson): string[] {
  const all = [l.teach.q.ans, l.teach.wrong, l.teach.decoy], k = l.id.length % 3;
  return [...all.slice(k), ...all.slice(0, k)];
}
