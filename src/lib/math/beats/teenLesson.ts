// Ten and Some More, Kindergarten: a number from 11 to 19 is ten ones and some more ones (K.NBT.1). The one
// idea: a full tray is 10, so a full tray and some more buns are counted on from 10 and written 10 + 5 = 15.
//
// The need: Make Ten's kitchen goes on. Sprout Bunny has baked more buns than one tray holds, and every bun
// gets a marshmallow on top, so someone has to know how many buns there are. It is shown once (a full tray and
// 3 more: 10, then 11, 12, 13). Then the child sees a full tray and 5 more and says how many in all: that many
// marshmallows really come, one onto each bun, so a number too small leaves buns with none and a number too
// big leaves marshmallows with no bun. Right or wrong, the count is then shown on the trays: the full tray is
// 10, and each bun on the second tray gets the next number. The buddy's wrong idea (one full tray and four more
// make 1 and 4, so 5: the tray counted as 1) is tried on trays of 14 and the child taps a bun that got no
// marshmallow. The Glimmer's wrong idea (the six is heard first in sixteen, so 61 is written) is tried on trays
// of 16 and the child says whether every marshmallow found a bun. A child who was not right at first counts on
// one more pair of trays with their own taps, a count word heard at each, and types the number. The sum is
// written last, from the trays then on the table, and the buns go to the party with a marshmallow each.
import type { BeatLesson, Cue, Notes, Teller, World } from './types';
import type { EpisodeScene } from '../../three/episodeScene';
import { TEN, heardIdea, meaning, rest, unitIdea } from './teen';

/** how many buns each pair of trays comes with: a full tray of 10 and the rest on the second tray */
export const DEMO = 13, FIRST = 15, BUDDY = 14, PAL = 16, ALONE = 17, NEXT_DAY = 18;
type Shown = 'p15' | 'p18';

/** what a light can go to: the blue buns (the full tray), the pink buns (the second tray), or every bun */
export type TeenLit = 'a' | 'b' | 'ab' | null;

/** What's on the table in this lesson (three/frameKit.ts with two frames): two bun trays of 10 places each,
 *  side by side (one under the other on a phone), blue buns on the first and pink buns on the second, and
 *  white marshmallows. Each call plays and resolves when it's over. */
export interface TeenWorld extends World {
  /** two trays slide onto the table, the first with `n` blue buns in its places and the second with `more`
   *  pink buns in its first places; trays that were there leave at once, with everything on them and beside
   *  them (`over`: it takes that many seconds, never quicker than usual) */
  trayIn(n: number, over?: number, more?: number): Promise<void>;
  /** `n` pink buns come one after another, each into the next empty place (`over`) */
  more(n: number, over?: number): Promise<void>;
  /** a real try: `n` marshmallows come one after another, one onto each bun that has none, the full tray's
   *  buns first; a marshmallow with no bun stops in a row in front of the trays (`over`) */
  top(n: number, over?: number): Promise<void>;
  /** the story's own marshmallows, put on by Sprout Bunny: the same movement as `top` */
  dress(n: number, over?: number): Promise<void>;
  /** every marshmallow lifts away, from the buns and from the row in front */
  topOff(): Promise<void>;
  /** yellow rings on the blue buns, the pink buns, or every bun (null: none) */
  light(what: TeenLit): void;
  /** the number 10 stands over the full tray */
  ten(): void;
  /** the light goes to the `k`th bun of the second tray, and the number `from + k` stands on it */
  point(k: number, from: number): void;
  /** a red ring on what is left over: each bun with no marshmallow, or each marshmallow with no bun */
  showLeft(): Promise<void>;
  /** the child's tap on one bun that has no marshmallow, which gets a yellow ring; a bun that has one shakes */
  tapBare(): Promise<void>;
  /** the child's taps: each pink bun tapped gets the next number after `from`, and the number is heard; a
   *  blue bun or a bun already counted shakes. When the last is counted the numbers go (a question follows) */
  tapCount(from: number): Promise<void>;
  /** do the rest of the hand's job ("Show me") */
  finish(): void;
  /** the sum stands over the trays: a + b = their total, each number in its buns' colour */
  writeSum(a: number, b: number): void;
  /** everything on the table slides away (`over`: in that many seconds) */
  clear(over?: number): Promise<void>;
}

// When each picture comes, in seconds into its line, read off the clips' word times (Whisper; the file is
// word-times.txt in the lesson's evidence folder). A picture: the second its words begin. A movement: [the
// second it begins, how many seconds it takes]. A line recorded again needs its seconds read again.
// (Whisper marks a word up to 0.3 s before its sound begins, so 0.2 s is added to its times. The count words'
// seconds are where each word's sound begins, by ffmpeg silencedetect on the clip: count-onsets.txt.)
const AT = {
  /** "Here is a full tray"; "and here are more buns on a second tray" */
  intro: { trays: [4.9, 1.4], more: [6.5, 1.6] },
  /** "a marshmallow on top" */
  need: [1, 0.7],
  /** "A full tray"; "ten buns" */
  demo: { full: 3.4, ten: 4.4 },
  /** each count word after "count on" */
  demoCount: [2.28, 2.75, 3.36],
  /** "Ten buns"; "three more buns"; "gets thirteen marshmallows" */
  full: { a: 0.2, b: 1.7, top: [4, 3] },
  /** "Here are new trays" */
  turn: [1.6, 2.6],
  /** "put as many marshmallows on the buns as you said, one on each, and see" */
  you: [0.9, 3.5],
  /** the words that point at what is left over: "not every bun", "not every marshmallow", "every bun is waiting" */
  left: { few: 1.2, over: 0.8, zero: 1 },
  /** "The full tray is ten"; then each count word */
  show: {
    p15: { ten: 2.1, count: [5.51, 6.32, 7.09, 7.76, 8.46] },
    p18: { ten: 2, count: [4.9, 6.2, 6.84, 7.48, 8.15, 8.74, 9.37, 10.18] },
  } as Record<Shown, { ten: number; count: number[] }>,
  /** "Here are new trays" */
  buddyIn: [0.2, 2.6],
  /** "one full tray"; "four more buns"; "Let's try your buddy's five marshmallows" */
  buddy: { tray: 1.2, more: 2.5, put: [6.4, 1.9] },
  /** "Look, nine buns have no marshmallow" */
  found: 2.2,
  /** "a full tray has ten buns on it"; "counts as ten" */
  why: { tray: 3.3, ten: 5.4 },
  /** each count word after "Ten, and four more" */
  so: [1.81, 2.25, 2.79, 3.58],
  /** "Here are new trays"; "starts at ten"; then each count word */
  palIn: { trays: [0.3, 1.6], ten: 3, count: [4.33, 4.85, 5.2, 5.8, 6.52, 7.18] },
  /** "writes a six and then a one"; "Let's try sixty-one marshmallows" */
  pal: { writes: 5.3, put: [8.8, 1.6] },
  /** "Look how many marshmallows"; "So many marshmallows" */
  heap: { no: 0.7, yes: 1.3 },
  /** "ten"; "six more"; "write" (the thought turns into 16); "the one first, for the full tray of ten"; "then the six"
   *  (recorded again on 26 Nov, as was the line of aloneSo: fix-word-times.txt) */
  palSo: { ten: 1, more: 1.6, write: 4.1, one: 4.3, six: 6.7 },
  /** "Here are new trays"; "The full tray is ten" */
  alone: { trays: [0.2, 2], ten: 2.4 },
  /** "seventeen" (the last bun's); "the one first, for the full tray"; "then the seven" */
  aloneSo: { last: 3.9, one: 6.4, seven: 8.6 },
  /** "write it down"; the blue buns; the pink buns; "make sixteen buns" */
  sum: { 16: { write: 0.6, a: 1.8, b: 2.6, all: 3.4 }, 17: { write: 0.6, a: 1.7, b: 2.7, all: 3.6 } } as Record<number, { write: number; a: number; b: number; all: number }>,
  /** "how many marshmallows to get"; "Off to the party they go" */
  off: { top: [2.2, 2.6], go: [5.3, 1.2] },
  /** "Here is a full tray, and some more buns" */
  check: [2.9, 2.2],
};

/** the words a run of the lesson can say, all of them */
export const TEEN_LINES = ['intro', 'need', 'demo', 'demo.count', 'demo.full', 'turn', 'how', 'try.you', 'right', 'few', 'over', 'try.zero', 'zero',
  'p15.show', 'p18.show', 'buddy.in', 'try.buddy', 'buddy.ask', 'buddy.found', 'buddy.why', 'buddy.so', 'pal.in', 'try.pal', 'pal.ask', 'pal.no',
  'pal.yes', 'pal.so', 'alone', 'alone.how', 'alone.right', 'alone.so', 'sum.16', 'sum.17', 'off', 'check'].map(k => `ep.teen.${k}`);

/** The child's number of buns in all: say whose it is, act it out whatever it is (that many marshmallows, one
 *  onto each bun), say what it showed. True when every bun has one and none is left. */
async function tryIt(t: Teller, w: TeenWorld, n: number, buns: number): Promise<boolean> {
  if (n === 0) {
    // (a stop kept on purpose: nothing is coming, so there is no movement to put under these words)
    await t.sayWith('ep.teen.try.zero', [[0, () => w.top(0)]]);
    t.buddy('shrug');
    await t.sayWith('ep.teen.zero', [[AT.left.zero, () => w.showLeft()]]);
    return false;
  }
  await t.sayWith('ep.teen.try.you', [[AT.you[0], () => w.top(n, AT.you[1])]], n);
  const m = meaning(n, buns);
  if (m.kind === 'right') { t.buddy('cheer'); t.pal('happy'); await t.say('ep.teen.right', n); return true; }
  t.buddy(m.kind === 'few' ? 'shrug' : 'oops'); t.pal('sad');
  // (what is left over is ringed at the words that point to it, not before: the line is its picture's reason.
  // "Not every bun" and "not every marshmallow" are true of one left over and of many)
  await t.sayWith(`ep.teen.${m.kind}`, [[AT.left[m.kind], () => w.showLeft()]], n);
  return false;
}

/** "How many buns in all?": the child's number is acted out, and then, right or wrong, the count is shown on
 *  the trays: the full tray is 10, and each bun on the second tray is lit and numbered as its number is said
 *  (one cue for each number, rule 42). It stays until the child taps Next. Returns their number. */
async function howMany(t: Teller, w: TeenWorld, buns: number, shown: Shown): Promise<number> {
  const n = await t.num('How many buns in all?', 'ep.teen.how');
  t.myBet(String(n));
  const right = await tryIt(t, w, n, buns);
  t.myBet(null);
  const s = AT.show[shown];
  // (a wrong number's marshmallows go at the line's start; the right child's stay on their buns)
  const off: Cue[] = right ? [] : [[0, () => w.topOff()]];
  await t.sayWith(`ep.teen.${shown}.show`, [...off, [s.ten, () => { w.light('a'); w.ten(); }], ...s.count.map((at, i): Cue => [at, () => w.point(i + 1, TEN)])]);
  await t.go('Next');
  return n;
}

async function play(t: Teller, w: TeenWorld): Promise<Notes> {
  // The need: why anyone wants to know how many buns, each thing coming as it is named.
  t.beat(0);
  await t.wait(700);
  t.pal('hop');
  await t.sayWith('ep.teen.intro', [[AT.intro.trays[0], () => w.trayIn(TEN, AT.intro.trays[1])], [AT.intro.more[0], () => w.more(rest(DEMO), AT.intro.more[1])]]);
  await t.sayWith('ep.teen.need', [[AT.need[0], () => w.dress(1, AT.need[1])]]);

  // Shown once, on a small case (Kindergarten): a full tray and 3 more.
  t.beat(1);
  await t.sayWith('ep.teen.demo', [[0, () => w.topOff()], [AT.demo.full, () => w.light('a')], [AT.demo.ten, () => w.ten()]]);
  await t.sayWith('ep.teen.demo.count', AT.demoCount.map((at, i): Cue => [at, () => w.point(i + 1, TEN)]));
  t.pal('happy');
  await t.sayWith('ep.teen.demo.full', [[AT.full.a, () => w.light('a')], [AT.full.b, () => w.light('b')], [AT.full.top[0], () => w.dress(DEMO, AT.full.top[1])]]);

  // The child's try, and the working.
  t.beat(2);
  await t.sayWith('ep.teen.turn', [[AT.turn[0], () => w.trayIn(TEN, AT.turn[1], rest(FIRST))]]);
  const first = await howMany(t, w, FIRST, 'p15');

  // The buddy's idea: one full tray and four more, so 1 and 4, which make 5. The child finds a bun that got
  // no marshmallow with a tap that can be wrong (a bun that has one shakes); the ring that answers comes with
  // the line that answers, never while the question is open (rule 41).
  t.beat(3);
  await t.sayWith('ep.teen.buddy.in', [[AT.buddyIn[0], () => w.trayIn(TEN, AT.buddyIn[1], rest(BUDDY))]]);
  t.thought('buddy', `1 + ${rest(BUDDY)} = ${unitIdea(BUDDY)}`); t.buddy('think');
  await t.sayWith('ep.teen.try.buddy', [[AT.buddy.tray, () => w.light('a')], [AT.buddy.more, () => w.light('b')], [AT.buddy.put[0], () => w.top(unitIdea(BUDDY), AT.buddy.put[1])]]);
  // (a stop kept on purpose: a question, and then a job for the child's hands)
  await t.say('ep.teen.buddy.ask');
  await t.hands('Tap a bun that needs one', () => w.tapBare(), () => w.finish());
  t.thought('buddy', null); t.buddy('oops');
  await t.sayWith('ep.teen.buddy.found', [[AT.found, () => w.showLeft()]]);
  await t.sayWith('ep.teen.buddy.why', [[AT.why.tray, () => w.light('a')], [AT.why.ten, () => w.ten()]]);
  // (the idea is closed, rules 2 and 26: the marshmallows go and the count is said from 10, each bun lit at its number)
  await t.sayWith('ep.teen.buddy.so', [[0, () => w.topOff()], ...AT.so.map((at, i): Cue => [at, () => w.point(i + 1, TEN)])]);
  t.buddy('nod');
  await t.go('Next');

  // The Glimmer's idea: counts right, then writes the number as it is heard, the six first: 61. The child
  // judges the 61 marshmallows; the red rings come with the line that answers.
  t.beat(4);
  await t.sayWith('ep.teen.pal.in', [[AT.palIn.trays[0], () => w.trayIn(TEN, AT.palIn.trays[1], rest(PAL))], [AT.palIn.ten, () => w.ten()], ...AT.palIn.count.map((at, i): Cue => [at, () => w.point(i + 1, TEN)])]);
  t.pal('act');
  await t.sayWith('ep.teen.try.pal', [[AT.pal.writes, () => t.thought('pal', String(heardIdea(PAL)))], [AT.pal.put[0], () => w.top(heardIdea(PAL), AT.pal.put[1])]]);
  const fits = await t.pick('Did every marshmallow find a bun?', [{ id: 'no', text: 'No' }, { id: 'yes', text: 'Yes' }], 'ep.teen.pal.ask');
  if (fits === 'no') { t.buddy('nod'); t.pal('sad'); } else t.buddy('shrug');
  await t.sayWith(`ep.teen.pal.${fits}`, [[AT.heap[fits], () => w.showLeft()]]);
  // (the right way to write it comes where Sprout Bunny's thought was: 61 turns into 16 at the words "write the 1 first")
  // (and the reason for the order is on the table: the full tray is lit as "the 1 first, for the full tray of 10"
  // is said, and the pink buns at "then the 6")
  await t.sayWith('ep.teen.pal.so', [[0, () => w.topOff()], [AT.palSo.ten, () => w.light('a')], [AT.palSo.more, () => w.light('b')], [AT.palSo.write, () => t.thought('pal', String(PAL))],
    [AT.palSo.one, () => w.light('a')], [AT.palSo.six, () => w.light('b')]]);
  t.pal('happy');
  await t.go('Next');
  t.thought('pal', null);

  // The child alone (rule 12a): a child who was not right at first counts on one more pair of trays with their
  // own taps, a count word heard at each, and gets the credit for the count. Then they type the number, which
  // is tried like any other. A child who was right goes on.
  t.beat(5);
  let buns = PAL;
  if (first !== FIRST) {
    await t.sayWith('ep.teen.alone', [[AT.alone.trays[0], () => w.trayIn(TEN, AT.alone.trays[1], rest(ALONE))], [AT.alone.ten, () => { w.light('a'); w.ten(); }]]);
    await t.hands('Tap each pink bun', () => w.tapCount(TEN), () => w.finish());
    const n = await t.num('How many buns in all?', 'ep.teen.alone.how');
    t.myBet(String(n));
    const right = await tryIt(t, w, n, ALONE);
    t.myBet(null);
    if (right) { t.buddy('clap'); await t.say('ep.teen.alone.right', n); }
    // (the count was theirs and was right; only the number typed was not. Its marshmallows go, and the last
    // bun's number comes back as it is named, so the child sees how seventeen is written; then the full tray is
    // lit at "the 1 first, for the full tray" and the pink buns at "then the 7", the reason for the order)
    else await t.sayWith('ep.teen.alone.so', [[0, () => w.topOff()], [AT.aloneSo.last, () => w.point(rest(ALONE), TEN)], [AT.aloneSo.one, () => w.light('a')], [AT.aloneSo.seven, () => w.light('b')]]);
    buns = ALONE;
  }

  // The written form comes last, from the trays on the table; it stays until the child moves on.
  t.beat(6);
  const s = AT.sum[buns];
  await t.sayWith(`ep.teen.sum.${buns}`, [[s.write, () => w.writeSum(TEN, rest(buns))], [s.a, () => w.light('a')], [s.b, () => w.light('b')], [s.all, () => w.light('ab')]]);
  await t.go('Next');

  // This story's own ending: every bun gets its marshmallow, and the trays go to the party.
  t.pal('happy'); t.buddy('jump');
  await t.sayWith('ep.teen.off', [[AT.off.top[0], () => w.dress(buns, AT.off.top[1])], [AT.off.go[0], () => w.clear(AT.off.go[1])]]);
  await t.wait(400);
  return { first };
}

/** The next day: one new pair of trays. */
async function check(t: Teller, w: TeenWorld) {
  await t.sayWith('ep.teen.check', [[AT.check[0], () => w.trayIn(TEN, AT.check[1], rest(NEXT_DAY))]]);
  await howMany(t, w, NEXT_DAY, 'p18');
  // (a stop kept on purpose: the trays leave after the last line, with nothing left to say over it)
  await w.clear();
}

export const TEEN_LESSON: BeatLesson<TeenWorld> = {
  id: 'pv-make-ten', title: 'Ten and Some More', blurb: 'A full tray is 10. A full tray and some more is counted on from 10.', set: 'kitchen', star: 'sproutbun', color: '#e58a3a',
  // (a stand-in: Make Ten's card, until this lesson has a painted card of its own)
  art: 'learn/ep/card-teen.webp', voice: 'teen', beats: 7,
  world: async (sc: EpisodeScene) => { const { FrameKit } = await import('../../three/frameKit'); return new FrameKit(sc, { frames: 2, topper: 'marshmallows' }); },
  play, check,
  card: n => [`Your first answer: ${n.first ?? '?'} buns for a full tray and ${rest(FIRST)} more`, 'A full tray is 10. Start at 10 and count on: 10 and 5 more make 15.'],
};
