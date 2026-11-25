// How Many Cookies? A Kindergarten lesson on counting a set: one number for each thing, and the last
// number said is how many there are, however the things are arranged (K.CC.B.4a, 4b, 5). Sprout Bunny has
// baked cookies for a party and each needs its own plate, so the number matters: whatever number the child
// gives, that many plates come out and the cookies hop on, one each, so a wrong number shows a cookie with
// no plate or a plate left empty. Young children learn more from being shown first than from guessing
// (notes for Layers of Cubes: the problem-first gain reverses below grade 6), so the narrator counts the
// first cookies, and only then does the child count with their own taps, each tapped cookie moving over
// with its number, and the number is heard as it lands. Sprout Bunny and the buddy each count a mixed-up
// batch with a slip children really make (one cookie touched twice, one missed), and the child finds the
// cookie it happened to with a tap: watching two counts and being told what went wrong was fifty seconds
// with nothing to do. Then the cookies get bumped round the tray: are there still as many? The child
// counts them again where they sit, starting anywhere. Reading is kept to numbers; the narrator says the rest.
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
  /** the child taps the cookie the friend's count went wrong on: 'yes' for that one, 'no' for another (it
   *  shakes), 'shown' when they asked to be shown */
  tapSlip(): Promise<'yes' | 'no' | 'shown'>;
  /** a red ring on the cookie the count went wrong on */
  showSlip(): Promise<void>;
  /** the child counts the cookies where they sit: each tapped cookie gets the next number and stays put */
  tapHere(): Promise<void>;
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
  /** the cookies on their plates go off to the party */
  party(): Promise<void>;
}

const DEMO = 3, MINE = 5, MIXED = 7, NEXT_DAY = 6, EXTRA = 4;
type Batch = 'b4' | 'b5' | 'b6' | 'b7';
/** the words a run of the lesson can say, all of them */
export const COUNT_LINES = ['intro', 'need', 'try.demo', 'demo.last', 'turn', 'how', 'try.you', 'right', 'few', 'over', 'try.zero', 'zero',
  'b5.why', 'b5.show', 'try.b5', 'fit', 'mixed', 'try.pal', 'pal.find', 'pal.found', 'pal.shown', 'try.buddy', 'buddy.find', 'buddy.found', 'buddy.shown',
  'find.no.two', 'find.no.none', 'move.why', 'move', 'how2', 'b7.why', 'b7.show', 'try.b7',
  'try.bump', 'moved', 'moved.right', 'try.recount.again', 'recount.why', 'try.party', 'off', 'off.extra', 'check', 'b6.why', 'b6.show', 'try.b6',
  'extra', 'how.last', 'b4.why', 'b4.show', 'try.b4'].map(k => `ep.count.${k}`);

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
async function howMany(t: Teller, w: CountWorld, cookies: number, b: Batch, line: string, keep = false): Promise<number> {
  const n = await t.num('How many cookies?', line);
  t.myBet(String(n));
  const right = await platesTest(t, w, n, cookies);
  t.myBet(null);
  if (right) {
    const lit = w.pointCount();
    await t.say(`ep.count.${b}.why`);
    await lit;
    await t.go('Next');
    // (`keep`: the last batch of the lesson goes to the party on these plates)
    if (!keep) await w.platesOff();
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
  if (!keep) await w.platesOff();
  return n;
}

/** A friend's count went wrong on one cookie, and the child finds which: a tap that can be wrong (the cookie
 *  shakes and the narrator says what that cookie has). Two misses, or "Show me", and the red ring shows it.
 *  Either way the next line says what happened to that cookie and why the friend's number can't be right. */
async function findSlip(t: Teller, w: CountWorld, who: 'pal' | 'buddy') {
  const words = who === 'pal' ? 'Tap the cookie with two numbers' : 'Tap the cookie with no number';
  const tap = { got: 'no' as 'yes' | 'no' | 'shown' };
  for (let miss = 0; miss < 2; miss++) {
    await t.hands(words, async () => { tap.got = await w.tapSlip(); }, () => w.finish());
    if (tap.got !== 'no') break;
    // (after the first miss: what that cookie has, and what to look for. After the second the ring shows it
    // straight away: "look for it" and then showing it in the same breath would make no sense)
    if (miss === 0) await t.say(who === 'pal' ? 'ep.count.find.no.two' : 'ep.count.find.no.none');
  }
  await w.showSlip();
  if (tap.got === 'yes') { t.buddy('nod'); t.pal('happy'); }
  await t.say(`ep.count.${who}.${tap.got === 'yes' ? 'found' : 'shown'}`);
}

async function play(t: Teller, w: CountWorld): Promise<Notes> {
  // why the number matters (a moment first, so the picture has settled before anything happens)
  t.beat(0);
  await t.wait(700);
  // (the cookies come in as they're named, not after: the words and the picture together)
  const tray = w.trayIn(DEMO);
  await t.say('ep.count.intro');
  await tray;
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

  // mixed up: Sprout Bunny touches one twice, the buddy misses one, and the child finds each slip on the cookies
  t.beat(3);
  await w.trayIn(MIXED, { mixed: true });
  await t.say('ep.count.mixed');
  await t.say('ep.count.try.pal');
  t.pal('act');
  t.thought('pal', String(await w.slipCount('pal', 'twice')));
  await t.say('ep.count.pal.find');
  await findSlip(t, w, 'pal');
  t.thought('pal', null);
  await w.clearNumbers();
  await t.say('ep.count.try.buddy');
  t.buddy('point');
  t.thought('buddy', String(await w.slipCount('buddy', 'skip')));
  await t.say('ep.count.buddy.find');
  await findSlip(t, w, 'buddy');
  t.thought('buddy', null);
  await w.clearNumbers();
  // (why, then what to do: two short lines, not one long one for a child who only hears it)
  await t.say('ep.count.move.why');
  await t.say('ep.count.move');
  await t.hands('Tap each cookie', () => w.tapCount(), () => w.finish());
  const second = await howMany(t, w, MIXED, 'b7', 'ep.count.how2');

  // bumped round the tray: still as many? Then the child counts them again where they sit, starting anywhere.
  // A child who thought the number had changed hears why it hasn't (it was only said to the child who was right)
  t.beat(4);
  await t.say('ep.count.try.bump');
  await w.bump();
  const moved = await t.num('How many cookies now?', 'ep.count.moved');
  // (a child who knew the number hadn't changed is told why they're right and goes on: counting them again was
  // half a minute more for a five-year-old who had already shown the idea. A child who thought it had changed
  // sees their number fail on the plates, then counts the cookies again themselves and hears why)
  if (moved === MIXED) { t.buddy('clap'); t.pal('happy'); await t.say('ep.count.moved.right'); await t.go('Next'); }
  else {
    t.myBet(String(moved)); await platesTest(t, w, moved, MIXED); t.myBet(null); await w.platesOff();
    await t.say('ep.count.try.recount.again');
    await t.hands('Tap each cookie to count it', () => w.tapHere(), () => w.finish());
    await t.say('ep.count.recount.why');
    await t.go('Next');
  }

  // a child who hasn't yet got one right by themselves counts a small new batch on their own (rule 12a)
  // (its question says where to look: the cookie tapped last. And its plates stay on: these cookies go to the
  // party on them, so the ending doesn't lay the same plates a second time)
  let extra = false;
  if (first !== MINE && second !== MIXED && moved !== MIXED) {
    extra = true;
    await w.trayOut();
    await w.trayIn(EXTRA);
    await t.say('ep.count.extra');
    await t.hands('Tap each cookie', () => w.tapCount(), () => w.finish());
    await howMany(t, w, EXTRA, 'b4', 'ep.count.how.last', true);
  }

  // the end of this story, and what the counting was for: as many plates as cookies, and off they go
  t.beat(5);
  if (!extra) { await t.say('ep.count.try.party'); await w.plates(MIXED); }
  t.pal('happy'); t.buddy('jump');
  await t.say(extra ? 'ep.count.off.extra' : 'ep.count.off');
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
