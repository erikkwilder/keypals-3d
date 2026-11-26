// Make Ten, Kindergarten: for a number from 1 to 9, find the number that makes 10 with it (K.OA.4). The one
// idea: on a tray with 10 places, the empty places tell how many more make 10.
//
// The need: Sprout Bunny bakes buns for a party, and the bun tray (a ten frame: two rows of five places) goes
// into the oven only when every place has a bun, so someone has to know how many more buns to make. It is
// shown once (9 blue buns, 1 empty place, 1 pink bun). Then the child sees 7 blue buns and says how many more:
// that many pink buns really come, each into an empty place, so a number too small leaves a place empty and a
// number too big leaves buns with no place. Right or wrong, the reason is then shown on the tray: each empty
// place needs one bun, so the empty places are counted. The buddy's wrong idea (the tray holds 10, so 10 more:
// a number from the question given back) is tried on a tray of 6 and the child says whether every bun found a
// place; a child who said 10 themselves has it played once, with their own try. The Glimmer's wrong idea (count
// the empty bottom row, miss the empty places in the top row) is tried on a tray of 3 and the child taps a
// place that was missed. A child who was not right at first fills one more tray with their own taps, a count
// word heard at each. The sum is written last, from the tray that is then full, and the tray goes into the oven.
import type { BeatLesson, Cue, Notes, Teller, World } from './types';
import type { EpisodeScene } from '../../three/episodeScene';
import { bottomRowIdea, meaning, partner, wholeIdea } from './ten';

/** how many blue buns each tray comes with */
export const DEMO = 9, FIRST = 7, BUDDY = 6, PAL = 3, EXTRA = 8, NEXT_DAY = 4;
type Shown = 'p3' | 'p6';

/** what a light can go to: a row of places, every place, the empty places, or the counters of one colour */
export type Lit = 'top' | 'bottom' | 'all' | 'empty' | 'a' | 'b' | null;

/** What's on the table in this lesson (three/frameKit.ts): a ten frame and counters in two colours. In this
 *  story the frame is a bun tray, the first colour's counters are blue buns and the second's pink buns. Each
 *  call plays and resolves when it's over. */
export interface FrameWorld extends World {
  /** a ten frame slides onto the table with `n` counters of the first colour already in its first places (top
   *  row first, from the left); one that was there leaves at once, with everything on it and beside it
   *  (`over`: it takes that many seconds, never quicker than usual) */
  trayIn(n: number, over?: number): Promise<void>;
  /** `n` counters of the first colour drop into the frame's first empty places, one after another (`over`) */
  fill(n: number, over?: number): Promise<void>;
  /** `n` counters of the second colour come one after another, each into an empty place (`from` 'bottom': the
   *  bottom row's places first); one with no place stops in a row in front of the frame (`over`) */
  more(n: number, over?: number, from?: 'top' | 'bottom'): Promise<void>;
  /** the second colour's counters slide away, and the places they were in are empty again */
  moreOff(): Promise<void>;
  /** the counters that found no place slide away one after another, and the ones in the frame stay (`over`) */
  spareOff(over?: number): Promise<void>;
  /** yellow rings on a row's places, on every place, on the empty places, or on one colour's counters (null: none) */
  light(what: Lit): void;
  /** the light goes to the `k`th of the places that had no counter of the first colour, and its number stands there */
  point(k: number): void;
  /** a red ring on what is left over: each empty place, or each counter with no place */
  showLeft(): Promise<void>;
  /** the child's taps: each empty place tapped gets a counter of the second colour and the next number, and
   *  the number is heard; a place that has a counter shakes */
  tapFill(): Promise<void>;
  /** the child's tap on one empty place, which gets a yellow ring; a place that has a counter shakes */
  tapEmpty(): Promise<void>;
  /** do the rest of the hand's job ("Show me") */
  finish(): void;
  /** the sum stands over the frame: a + b = 10, each number in its counters' colour */
  writeSum(a: number, b: number): void;
  /** everything on the table slides away (`over`: in that many seconds) */
  clear(over?: number): Promise<void>;
}

// When each picture comes, in seconds into its line, read off the clips' word times (Whisper; the file is
// word-times.txt in the lesson's evidence folder). A picture: the second its words begin. A movement: [the
// second it begins, how many seconds it takes]. A line recorded again needs its seconds read again.
const AT = {
  /** "This is the bun tray"; "Five in the top row"; "five in the bottom row" */
  intro: { tray: [2.9, 1.3], top: 6, bottom: 7.5 },
  /** "with a bun in every place"; "So Sprout Bunny needs to know" */
  need: { every: 2.5, more: 4.8 },
  /** "Here are nine blue buns on the tray"; "One place is still empty" */
  demo: { buns: [1.1, 2], empty: 3.2 },
  /** "pink bun in the empty place" */
  put: [1.4, 1.3],
  /** "Nine blue buns"; "one pink bun"; "make ten" */
  full: { a: 1.4, b: 2.5, all: 3.1 },
  /** "Here is a new tray, with seven blue buns on it" */
  turn: [1.3, 2.5],
  /** "put as many pink buns on the tray as you said, and see if it is full" */
  you: [0.3, 3.5],
  /** "Let's put ten pink buns on the tray and see if it is full", when the child and the buddy both said 10 */
  both: [3.2, 3],
  /** "look", in each line that says what a wrong number showed; where 2 or more places are left, "empty places" */
  left: { few: 3.1, places: 4.6, over: 1.3, zero: 3 },
  /** "The tray holds ten buns in all"; "seven were on it already"; "only the empty places" */
  bothWhy: { all: 0.1, had: 2, empty: 4 },
  /** "Each empty place needed one bun" */
  why: 0.2,
  /** each number of the count said after "so we count the empty places": where each count word's sound begins (ffmpeg
   *  silencedetect on the clip; Whisper's word times agree to within 0.1 s) */
  show: { p3: [4.91, 5.47, 6.1], p6: [5, 5.69, 6.15, 6.61, 7.18, 7.91] } as Record<Shown, number[]>,
  /** "put one pink bun in each empty place" */
  fix: [0.5, 2],
  /** "Here is another tray, with six blue buns on it" */
  buddyIn: [0.1, 2.6],
  /** "so it needs ten more. Let's try your buddy's ten pink buns": ten buns need the 3.2 s from "so" */
  buddy: [2.2, 3.2],
  /** "Six buns have no place"; "six places had a bun already"; "Only the empty places", in the two lines that answer the question */
  ring: { no: { left: 1.2, had: 3, only: 5.3 }, yes: { left: 1.8, had: 3.3, only: 5.5 } },
  /** "There were four empty places": the buns with no place go one after another from the line's start, and the
   *  last has gone at "four more buns", where the pink buns on the tray are lit */
  so: { off: [0, 2.3], pink: 2.4 },
  /** "Here is a tray with three blue buns on it" */
  palIn: [2.5, 2],
  /** "the empty places in the bottom row"; "Let's try Sprout Bunny's five pink buns" */
  pal: { row: 1, put: [4.3, 2.6] },
  /** "The top row has two empty places too" */
  found: 1.2,
  /** "put two more pink buns in the top row" */
  top: [0.6, 1.9],
  /** "Here is one more tray, just for you, with eight blue buns on it" */
  extra: [0.1, 3.2],
  /** "One bun went into each empty place" */
  done: 1.6,
  /** "We write"; the first number's buns; the second's; "make ten" */
  sum: { 3: { write: 0.1, a: 3.1, b: 4.4, all: 5.3 }, 8: { write: 0.3, a: 3, b: 4.3, all: 5.1 } } as Record<number, { write: number; a: number; b: number; all: number }>,
  /** "so into the oven it goes" */
  off: [1.3, 1.8],
  /** "This tray has four blue buns on it" */
  check: [2.2, 1.8],
};

/** the words a run of the lesson can say, all of them */
export const TEN_LINES = ['intro', 'need', 'demo', 'try.demo', 'demo.full', 'turn', 'how', 'try.you', 'try.both', 'right', 'few', 'few.places', 'over',
  'try.zero', 'zero', 'both.why', 'why', 'p3.show', 'p6.show', 'try.fix', 'fit', 'buddy.in', 'try.buddy', 'buddy.ask', 'buddy.no',
  'buddy.yes', 'buddy.so', 'pal.in', 'try.pal', 'pal.ask', 'pal.found', 'try.top', 'extra', 'extra.done', 'sum.3', 'sum.8', 'off', 'check'].map(k => `ep.ten.${k}`);

/** The child's number of more buns: say whose it is, act it out whatever it is, say what it showed. True when
 *  it fills the tray. (`both`: the child said 10, which is the buddy's idea too, so it is played once for the
 *  two of them and the buddy's reason is given here.) */
async function tryIt(t: Teller, w: FrameWorld, n: number, have: number, both: boolean): Promise<boolean> {
  if (n === 0) {
    // (a stop kept on purpose: nothing is coming, so there is no movement to put under these words)
    await t.sayWith('ep.ten.try.zero', [[0, () => w.more(0)]]);
    t.buddy('shrug');
    await t.sayWith('ep.ten.zero', [[AT.left.zero, () => w.showLeft()]]);
    return false;
  }
  if (both) { t.thought('buddy', String(n)); t.buddy('point'); }
  const at = both ? AT.both : AT.you;
  await t.sayWith(both ? 'ep.ten.try.both' : 'ep.ten.try.you', [[at[0], () => w.more(n, at[1])]], n);
  const m = meaning(n, have);
  if (m.kind === 'full') { t.buddy('cheer'); t.pal('happy'); await t.say('ep.ten.right', n); return true; }
  t.buddy(m.kind === 'short' ? 'shrug' : 'oops'); t.pal('sad');
  // (what is left over is ringed at the word that points to it, not before: the line is its picture's reason)
  // (what is said is what is shown, rule 40: "an empty place" only when exactly one place is left)
  const places = m.kind === 'short' && m.missing > 1;
  const line = m.kind === 'over' ? 'ep.ten.over' : places ? 'ep.ten.few.places' : 'ep.ten.few';
  await t.sayWith(line, [[m.kind === 'over' ? AT.left.over : places ? AT.left.places : AT.left.few, () => w.showLeft()]], n);
  if (both) {
    await t.sayWith('ep.ten.both.why', [[AT.bothWhy.all, () => w.light('all')], [AT.bothWhy.had, () => w.light('a')], [AT.bothWhy.empty, () => w.light('b')]]);
    t.thought('buddy', null);
  }
  return false;
}

/** "How many more?": the child's number is acted out, and then, right or wrong, where the answer comes from is
 *  shown on the tray: each empty place needs one bun. It stays until the child taps Next. Returns their number. */
async function howMany(t: Teller, w: FrameWorld, have: number, shown: Shown, first: boolean): Promise<number> {
  const n = await t.num('How many more buns?', 'ep.ten.how');
  t.myBet(String(n));
  const right = await tryIt(t, w, n, have, first && n === wholeIdea(have));
  t.myBet(null);
  if (right) {
    // (the right child hears why: the pink buns sit exactly where the empty places were)
    await t.sayWith('ep.ten.why', [[AT.why, () => w.light('b')]], n);
    await t.go('Next');
    return n;
  }
  // (the change from asking to showing is said kindly, the pink buns go, and the count said inside the line
  // lights each empty place as its number is said: one cue for each number, rule 42)
  await t.sayWith(`ep.ten.${shown}.show`, [[0, () => w.moreOff()], ...AT.show[shown].map((at, i): Cue => [at, () => w.point(i + 1)])]);
  await t.go('Next');
  await t.sayWith('ep.ten.try.fix', [[AT.fix[0], () => w.more(partner(have), AT.fix[1])]]);
  t.buddy('nod'); t.pal('happy');
  await t.say('ep.ten.fit');
  return n;
}

async function play(t: Teller, w: FrameWorld): Promise<Notes> {
  // The need: why anyone wants to know how many more, each thing coming as it is named.
  t.beat(0);
  await t.wait(700);
  t.pal('hop');
  await t.sayWith('ep.ten.intro', [[AT.intro.tray[0], () => w.trayIn(0, AT.intro.tray[1])], [AT.intro.top, () => w.light('top')], [AT.intro.bottom, () => w.light('bottom')]]);
  await t.sayWith('ep.ten.need', [[AT.need.every, () => w.light('all')], [AT.need.more, () => w.light(null)]]);

  // Shown once, on a small case (Kindergarten): 9 and 1.
  t.beat(1);
  await t.sayWith('ep.ten.demo', [[AT.demo.buns[0], () => w.fill(DEMO, AT.demo.buns[1])], [AT.demo.empty, () => w.light('empty')]]);
  t.pal('act');
  await t.sayWith('ep.ten.try.demo', [[AT.put[0], () => w.more(partner(DEMO), AT.put[1])]]);
  t.pal('happy');
  await t.sayWith('ep.ten.demo.full', [[AT.full.a, () => w.light('a')], [AT.full.b, () => w.light('b')], [AT.full.all, () => w.light('all')]]);

  // The child's try, and the working.
  t.beat(2);
  await t.sayWith('ep.ten.turn', [[AT.turn[0], () => w.trayIn(FIRST, AT.turn[1])]]);
  const first = await howMany(t, w, FIRST, 'p3', true);

  // The buddy's idea: the tray holds 10, so 10 more. (A child who said 10 has just had it played with their own
  // try, and its reason: it is not news to them, so it is not played again.)
  t.beat(3);
  if (first !== wholeIdea(FIRST)) {
    await t.sayWith('ep.ten.buddy.in', [[AT.buddyIn[0], () => w.trayIn(BUDDY, AT.buddyIn[1])]]);
    t.thought('buddy', String(wholeIdea(BUDDY))); t.buddy('point');
    await t.sayWith('ep.ten.try.buddy', [[AT.buddy[0], () => w.more(wholeIdea(BUDDY), AT.buddy[1])]]);
    // (the ring that answers comes with the line that answers, never while the question is open: rule 41)
    const fits = await t.pick('Did every bun find a place?', [{ id: 'no', text: 'No' }, { id: 'yes', text: 'Yes' }], 'ep.ten.buddy.ask');
    t.thought('buddy', null);
    const at = AT.ring[fits];
    if (fits === 'no') { t.buddy('nod'); t.pal('happy'); } else t.buddy('shrug');
    await t.sayWith(`ep.ten.buddy.${fits}`, [[at.left, () => w.showLeft()], [at.had, () => w.light('a')], [at.only, () => w.light('b')]]);
    // (the idea is closed, rules 2 and 26: the buns with no place go while the line says how many places were
    // empty, and the pink buns that did find a place are lit as their number is said)
    await t.sayWith('ep.ten.buddy.so', [[AT.so.off[0], () => w.spareOff(AT.so.off[1])], [AT.so.pink, () => w.light('b')]]);
    await t.go('Next');
  }

  // The Glimmer's idea: count the empty bottom row and miss the empty places in the top row. The child finds
  // a missed place with a tap that can be wrong (a place with a bun shakes).
  t.beat(4);
  await t.sayWith('ep.ten.pal.in', [[AT.palIn[0], () => w.trayIn(PAL, AT.palIn[1])]]);
  t.thought('pal', String(bottomRowIdea(PAL))); t.pal('act');
  await t.sayWith('ep.ten.try.pal', [[AT.pal.row, () => w.light('bottom')], [AT.pal.put[0], () => w.more(bottomRowIdea(PAL), AT.pal.put[1], 'bottom')]]);
  // (a stop kept on purpose: a question, and then a job for the child's hands)
  await t.say('ep.ten.pal.ask');
  await t.hands('Tap an empty place', () => w.tapEmpty(), () => w.finish());
  t.thought('pal', null); t.pal('sad');
  await t.sayWith('ep.ten.pal.found', [[AT.found, () => w.showLeft()]]);
  await t.sayWith('ep.ten.try.top', [[AT.top[0], () => w.more(partner(PAL) - bottomRowIdea(PAL), AT.top[1])]]);
  t.pal('happy'); t.buddy('nod');
  await t.say('ep.ten.fit');

  // The child alone (rule 12a): a child who was not right at first fills one more tray with their own taps, a
  // count word heard at each, and gets the credit. A child who was right goes on.
  t.beat(5);
  let a = PAL;
  if (first !== partner(FIRST)) {
    await t.sayWith('ep.ten.extra', [[AT.extra[0], () => w.trayIn(EXTRA, AT.extra[1])]]);
    await t.hands('Tap each empty place', () => w.tapFill(), () => w.finish());
    t.buddy('clap'); t.pal('happy');
    await t.sayWith('ep.ten.extra.done', [[AT.done, () => w.light('b')]]);
    a = EXTRA;
  }

  // The written form comes last, from the tray that is now full; it stays until the child moves on.
  t.beat(6);
  const s = AT.sum[a];
  await t.sayWith(`ep.ten.sum.${a}`, [[s.write, () => w.writeSum(a, partner(a))], [s.a, () => w.light('a')], [s.b, () => w.light('b')], [s.all, () => w.light('all')]]);
  await t.go('Next');

  // This story's own ending: the full tray goes into the oven.
  t.pal('happy'); t.buddy('jump');
  await t.sayWith('ep.ten.off', [[AT.off[0], () => w.clear(AT.off[1])]]);
  await t.wait(400);
  return { first };
}

/** The next day: one new tray. */
async function check(t: Teller, w: FrameWorld) {
  await t.sayWith('ep.ten.check', [[AT.check[0], () => w.trayIn(NEXT_DAY, AT.check[1])]]);
  await howMany(t, w, NEXT_DAY, 'p6', false);
  // (a stop kept on purpose: the tray leaves after the last line, with nothing left to say over it)
  await w.clear();
}

export const TEN_LESSON: BeatLesson<FrameWorld> = {
  id: 'make-ten', title: 'Make Ten', blurb: 'The empty places on a tray of 10 tell you how many more make 10.', set: 'kitchen', star: 'sproutbun', color: '#e58a3a',
  // (the old Make Ten had no painted card; this is the kitchen's card from How Many Cookies?, as a stand-in)
  art: 'learn/ep/card-cookies.webp', voice: 'ten', beats: 7,
  world: async (sc: EpisodeScene) => { const { FrameKit } = await import('../../three/frameKit'); return new FrameKit(sc); },
  play, check,
  card: n => [`Your first answer: ${n.first ?? '?'} more buns for the tray with ${FIRST}`, 'Count the empty places on a tray of 10: that many more make 10.'],
};
