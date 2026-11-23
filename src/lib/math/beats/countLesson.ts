// How Many Cookies? A Kindergarten lesson on counting a set: one number for each thing, and the last
// number said is how many there are, however the things are arranged (K.CC.B.4a, 4b, 5). Sprout Bunny has
// baked cookies for a party and each needs its own plate, so the number matters: whatever number the child
// gives, that many plates come out and the cookies hop on, one each, so a wrong number shows a cookie with
// no plate or a plate left empty. Young children learn more from being shown first than from guessing
// (notes for Layers of Cubes: the problem-first gain reverses below grade 6), so the narrator counts the
// first cookies, and only then does the child count with their own taps, each tapped cookie moving over
// with its number. Sprout Bunny and the buddy each count a mixed-up batch with a slip children really
// make (one cookie touched twice, one missed), and the numbers on the cookies show it. Then the cookies
// get bumped into a ring: are there still as many? Reading is kept to numbers; the narrator says the rest.
// docs/lesson-rules.md holds the rules for every lesson; rules.ts checks the ones a test can.
import type { BeatLesson, Notes, Teller, World } from './types';
import type { EpisodeScene } from '../../three/episodeScene';
import { plateMeaning, type Slip } from './count';

/** What's on the table in this lesson (three/countKit.ts). Each call plays and resolves when it's over. */
export interface CountWorld extends World {
  /** a tray of `n` cookies slides in (`mixed`: scattered, not in a row) */
  trayIn(n: number, o?: { mixed?: boolean }): Promise<void>;
  /** the tray, cookies and plates slide away */
  trayOut(): Promise<void>;
  /** the narrator's count: each cookie in turn moves over to the line with its number */
  demoCount(): Promise<void>;
  /** the child's taps: each tapped cookie moves over to the line with the next number */
  tapCount(): Promise<void>;
  /** do the rest of the hand's job ("Show me") */
  finish(): void;
  /** a friend counts the cookies where they lie, with a slip; resolves with the number it got */
  slipCount(who: 'buddy' | 'pal', slip: Slip): Promise<number>;
  /** the numbers come off the cookies */
  clearNumbers(): Promise<void>;
  /** a light goes along the counted cookies, one number at a time, and stays on the last */
  pointCount(): Promise<void>;
  /** that many plates come out in a row, and the cookies hop on, one to a plate */
  plates(n: number): Promise<void>;
  /** the plates go, and the cookies go back to the line */
  platesOff(): Promise<void>;
  /** the table is bumped: the cookies slide into a ring, and their numbers are gone */
  bump(): Promise<void>;
  /** the narrator counts the ring again, starting from another cookie */
  recount(): Promise<void>;
  /** the cookies on their plates go off to the party */
  party(): Promise<void>;
}

const DEMO = 3, MINE = 5, MIXED = 7, NEXT_DAY = 6, EXTRA = 4;
type Batch = 'b4' | 'b5' | 'b6' | 'b7';
/** the words a run of the lesson can say, all of them */
export const COUNT_LINES = ['intro', 'need', 'try.demo', 'demo.last', 'turn', 'how', 'try.you', 'right', 'few', 'over', 'try.zero', 'zero',
  'b5.why', 'b5.show', 'try.b5', 'fit', 'mixed', 'try.pal', 'pal.twice', 'try.buddy', 'buddy.skip', 'move', 'how2', 'b7.why', 'b7.show', 'try.b7',
  'try.bump', 'moved', 'moved.right', 'try.recount', 'recount.same', 'try.party', 'off', 'check', 'b6.why', 'b6.show', 'try.b6',
  'extra', 'b4.why', 'b4.show', 'try.b4'].map(k => `ep.count.${k}`);

/** The child's number of plates: say whose it is, act it out, say what it showed. True when it fits. */
async function platesTest(t: Teller, w: CountWorld, n: number, cookies: number): Promise<boolean> {
  // (zero is no plates at all: said in its own words, not "your 0 plates weren't enough")
  if (n === 0) {
    await t.say('ep.count.try.zero');
    await w.plates(0);
    t.buddy('shrug'); t.pal('sad');
    await t.say('ep.count.zero');
    return false;
  }
  await t.say('ep.count.try.you', n);
  await w.plates(n);
  const m = plateMeaning(n, cookies);
  if (m.kind === 'full') { t.buddy('cheer'); t.pal('happy'); await t.say('ep.count.right', n); return true; }
  t.buddy(m.kind === 'short' ? 'shrug' : 'oops'); t.pal('sad');
  await t.say(m.kind === 'short' ? 'ep.count.few' : 'ep.count.over', n);
  return false;
}
/** "How many?" after the child has counted: their number is acted out with plates, and then, right or
 *  wrong, the numbers on the cookies are gone through to show where the answer comes from. */
async function howMany(t: Teller, w: CountWorld, cookies: number, b: Batch, line: string): Promise<number> {
  const n = await t.num('How many cookies?', line);
  t.myBet(String(n));
  const right = await platesTest(t, w, n, cookies);
  t.myBet(null);
  if (right) {
    const lit = w.pointCount();
    await t.say(`ep.count.${b}.why`);
    await lit;
    await t.go('Next');
    await w.platesOff();
    return n;
  }
  await w.platesOff();
  // a kind change of gear: no more asking, we look at the numbers together
  const lit = w.pointCount();
  await t.say(`ep.count.${b}.show`);
  await lit;
  await t.go('Next');
  await t.say(`ep.count.try.${b}`);
  await w.plates(cookies);
  t.pal('happy'); t.buddy('nod');
  await t.say('ep.count.fit');
  await w.platesOff();
  return n;
}

async function play(t: Teller, w: CountWorld): Promise<Notes> {
  // why the number matters (a moment first, so the picture has settled before anything happens)
  t.beat(0);
  await t.wait(700);
  await t.say('ep.count.intro');
  await w.trayIn(DEMO);
  t.pal('hop');
  await t.say('ep.count.need');

  // shown first: one number for each cookie, and the last one says how many
  t.beat(1);
  await t.say('ep.count.try.demo');
  await w.demoCount();
  const lit = w.pointCount();
  await t.say('ep.count.demo.last');
  await lit;
  await t.go('Next');
  // (no plates for the shown count: the child's own number is the first acted out, and its lines say what
  // the plates mean, which keeps the lesson short for Kindergarten)
  t.pal('happy'); t.buddy('clap');
  await w.trayOut();

  // the child counts, with their own taps, and says how many
  t.beat(2);
  await w.trayIn(MINE);
  await t.say('ep.count.turn');
  await t.hands('Tap each cookie', () => w.tapCount(), () => w.finish());
  const first = await howMany(t, w, MINE, 'b5', 'ep.count.how');
  await w.trayOut();

  // mixed up: Sprout Bunny touches one twice, the buddy misses one, and the numbers on the cookies show it
  t.beat(3);
  await w.trayIn(MIXED, { mixed: true });
  await t.say('ep.count.mixed');
  await t.say('ep.count.try.pal');
  t.pal('act');
  t.thought('pal', String(await w.slipCount('pal', 'twice')));
  t.pal('sad');
  await t.say('ep.count.pal.twice');
  t.thought('pal', null);
  await w.clearNumbers();
  await t.say('ep.count.try.buddy');
  t.buddy('point');
  t.thought('buddy', String(await w.slipCount('buddy', 'skip')));
  t.buddy('shrug');
  await t.say('ep.count.buddy.skip');
  t.thought('buddy', null);
  await w.clearNumbers();
  await t.say('ep.count.move');
  await t.hands('Tap each cookie', () => w.tapCount(), () => w.finish());
  const second = await howMany(t, w, MIXED, 'b7', 'ep.count.how2');

  // bumped into a ring: still as many? Then counted again from another cookie, to check
  t.beat(4);
  await t.say('ep.count.try.bump');
  await w.bump();
  const moved = await t.num('How many cookies now?', 'ep.count.moved');
  if (moved === MIXED) { t.buddy('clap'); t.pal('happy'); await t.say('ep.count.moved.right'); }
  else { t.myBet(String(moved)); await platesTest(t, w, moved, MIXED); t.myBet(null); await w.platesOff(); }
  await t.say('ep.count.try.recount');
  await w.recount();
  await t.say('ep.count.recount.same');
  await t.go('Next');

  // a child who hasn't yet got one right by themselves counts a small new batch on their own (rule 12a)
  let party = MIXED;
  if (first !== MINE && second !== MIXED && moved !== MIXED) {
    await w.trayOut();
    await w.trayIn(EXTRA);
    await t.say('ep.count.extra');
    await t.hands('Tap each cookie', () => w.tapCount(), () => w.finish());
    await howMany(t, w, EXTRA, 'b4', 'ep.count.how');
    party = EXTRA;
  }

  // the end of this story: a plate for every cookie, and off they go
  t.beat(5);
  await t.say('ep.count.try.party');
  await w.plates(party);
  t.pal('happy'); t.buddy('jump');
  await t.say('ep.count.off');
  await w.party();
  await t.wait(400);
  return { first, second, moved };
}

async function check(t: Teller, w: CountWorld) {
  await w.trayIn(NEXT_DAY, { mixed: true });
  await t.say('ep.count.check');
  await t.hands('Tap each cookie', () => w.tapCount(), () => w.finish());
  await howMany(t, w, NEXT_DAY, 'b6', 'ep.count.how2');
  await w.trayOut();
}

export const COUNT_LESSON: BeatLesson<CountWorld> = {
  id: 'k-count', title: 'How Many Cookies?', blurb: 'Say one number for each thing. The last number tells you how many.', set: 'kitchen', star: 'sproutbun', color: '#e58a3a',
  art: 'learn/ep/card-cookies.webp', beats: 6,
  world: async (sc: EpisodeScene) => { const { CountKit } = await import('../../three/countKit'); return new CountKit(sc); },
  play, check,
  card: n => [`Your first count: ${n.first ?? '?'} cookies`, 'The last number you say when you count tells you how many there are.'],
};
