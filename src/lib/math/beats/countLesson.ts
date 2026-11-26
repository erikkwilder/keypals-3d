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
import type { BeatLesson, Cue, Notes, Teller, World } from './types';
import type { EpisodeScene } from '../../three/episodeScene';
import { plateMeaning, type Slip } from './count';

const DEMO = 3, MINE = 5, MIXED = 7, NEXT_DAY = 6, EXTRA = 4;
type Batch = 'b4' | 'b5' | 'b6' | 'b7';

/** What's on the table in this lesson (three/countKit.ts). Each call plays and resolves when it's over. */
export interface CountWorld extends World {
  /** a tray of `n` cookies comes in (`mixed`: scattered, not in a row; `over`: the cookies take that many seconds
   *  to land, never quicker than usual) */
  trayIn(n: number, o?: { mixed?: boolean; over?: number }): Promise<void>;
  /** the tray, cookies and plates slide away (`over`: in that many seconds) */
  trayOut(over?: number): Promise<void>;
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
  /** that many plates come out in a row, and the cookies hop on, one to a plate (`over`: they take that many
   *  seconds, never quicker than usual, so they can come while the narrator says they are coming) */
  plates(n: number, over?: number): Promise<void>;
  /** the plates go, and the cookies go back to the line */
  platesOff(): Promise<void>;
  /** the table is bumped: the cookies slide into a ring, and their numbers are gone (`over`: the slide takes
   *  that many seconds) */
  bump(over?: number): Promise<void>;
  /** the cookies on their plates go off to the party (`over`: in that many seconds, never quicker than usual) */
  party(over?: number): Promise<void>;
  // pictures that go with a line as it is said (rule 37: nobody sits watching a still tray while the narrator talks)
  /** one plate comes out and one cookie hops from the tray onto it: a cookie on a plate of its own */
  plateFor(): Promise<void>;
  /** a "?" stands in the middle of the cookies: how many there are isn't known yet */
  wonder(): Promise<void>;
  /** the "?" goes, that cookie hops back onto the tray and its plate goes away */
  plateBack(): Promise<void>;
  /** a "?" on three of the mixed-up cookies, one after another: has this one been counted? */
  unsure(): Promise<void>;
  /** a friend's slip seen again on its own cookie: the one skipped (no number, red ring), or the one counted
   *  twice (its two numbers, red ring) */
  recall(slip: Slip): Promise<void>;
  /** the light goes to the `k`th cookie counted */
  pointAt(k: number): void;
}

/** When each picture comes, in seconds into its line, read off the narrator's clips (Whisper's word times for
 *  public/voice/ep.count.*.mp3): a picture arrives with the words that say it. A line recorded again needs its
 *  seconds read again. */
const AT = {
  /** "baked cookies"; "its own plate" */
  intro: { cookies: 2.8, plate: 5.3 },
  /** "how many cookies there are"; "So let's count them" */
  need: { ask: 2.6, back: 4.8 },
  /** the cookies before leave from the first word and the new ones take this long to land, the last at "all over
   *  the tray"; "hard to remember which ones you've counted" */
  mixed: { cookies: 3.9, unsure: 5.8 },
  /** "here it is, with the red ring", in each friend's line */
  ring: { pal: 1.0, buddy: 1.45 },
  /** "skip one"; "count the same one twice" */
  why: { skip: 3.1, twice: 4.0 },
  /** each number of the count said in a batch's "let's look at the numbers together" line */
  // A movement begins at the words that name it and ends about as they do (rule 45): [the second of the line it
  // begins at, how many seconds it takes]. The kit never moves quicker than usual, only slower.
  /** "with more cookies": the cookies before leave from the first word, and the new ones take this long to land */
  turn: { cookies: 1.5 },
  /** "Let's get as many plates as you said, and put one cookie on each plate" */
  you: [0.6, 3.5],
  /** "get out five plates, one for each cookie", in each batch's line */
  lay: { b4: [0.6, 2.2], b5: [0.4, 2.3], b6: [0.4, 2], b7: [0.7, 2.3] } as Record<Batch, [number, number]>,
  /** "bumps the table. Watch what happens to the cookies" */
  bump: [1.3, 2.5],
  /** "Those cookies are put away"; "found a few more cookies in the oven" */
  extra: { away: [0, 1.3], more: [2.5, 1.6] },
  /** "gets out seven plates, one for each cookie" (the line goes on: "to take them to the party") */
  party: [2.9, 3],
  /** "Sprout Bunny is off to the party!", in each ending's line */
  off: [5.3, 1.9], offExtra: [4.9, 2.3],
  /** "Here are some new cookies for Sprout Bunny's party, all over the tray" */
  check: [0.3, 3.3],
  show: { b4: [3.8, 4.55, 5, 5.35], b5: [3.25, 4, 4.4, 4.9, 5.5], b6: [4.05, 4.75, 5.25, 5.7, 6.1, 6.55], b7: [4.2, 4.8, 5.55, 6.2, 6.9, 7.3, 7.65] } as Record<Batch, number[]>,
};

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
  // (the plates start to come out as the narrator says "let's get that many plates", slowly, and the last cookie
  // is on its plate as the line ends. What the plates show, a cookie left over or a plate left empty, is marked
  // once the line is over and stands for a moment before the narrator says what it showed: the child's own
  // number is the one thing to look at then)
  await t.sayWith('ep.count.try.you', [[AT.you[0], () => w.plates(n, AT.you[1])]], n);
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
    // (`keep`: the plates stay on. They go out with the tray as the next line begins, or to the party)
    if (!keep) await w.platesOff();
    return n;
  }
  // a kind change of gear: no more asking, we look at the numbers together. The plates go while the narrator says
  // so, and are gone before the first number; then the light goes to each cookie as its number is said (it used
  // to run along by itself and be done before the first number was said)
  await t.sayWith(`ep.count.${b}.show`, [[0, () => w.platesOff()], ...AT.show[b].map((at, i): Cue => [at, () => w.pointAt(i + 1)])]);
  await t.go('Next');
  // (the plates come out as the narrator says "let's get out five plates", and are there as the line ends)
  await t.sayWith(`ep.count.try.${b}`, [[AT.lay[b][0], () => w.plates(cookies, AT.lay[b][1])]]);
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
  // (found: the red ring answers the tap at once. Not found: it comes as the narrator says "here it is")
  if (tap.got === 'yes') { t.buddy('nod'); t.pal('happy'); await t.sayWith(`ep.count.${who}.found`, [[0, () => w.showSlip()]]); }
  else await t.sayWith(`ep.count.${who}.shown`, [[AT.ring[who], () => w.showSlip()]]);
}

async function play(t: Teller, w: CountWorld): Promise<Notes> {
  // why the number matters (a moment first, so the picture has settled before anything happens)
  t.beat(0);
  await t.wait(700);
  // (each thing comes as it's named: Sprout Bunny hops, the cookies land, and one cookie gets a plate of its
  // own. Then the "?": how many plates to get out isn't known yet, so every cookie goes back to be counted)
  t.pal('hop');
  await t.sayWith('ep.count.intro', [[AT.intro.cookies, () => w.trayIn(DEMO)], [AT.intro.plate, () => w.plateFor()]]);
  await t.sayWith('ep.count.need', [[AT.need.ask, () => w.wonder()], [AT.need.back, () => w.plateBack()]]);

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

  // the child counts, with their own taps, and says how many
  t.beat(2);
  // (the three cookies slide away as the narrator begins, and the new ones land at "with more cookies": the tray
  // used to go and the new one come in silence, and only then was the line said)
  await t.sayWith('ep.count.turn', [[0, async () => { await w.trayOut(); await w.trayIn(MINE, { over: AT.turn.cookies }); }]]);
  await t.hands('Tap each cookie', () => w.tapCount(), () => w.finish());
  const first = await howMany(t, w, MINE, 'b5', 'ep.count.how', true);

  // mixed up: Sprout Bunny touches one twice, the buddy misses one, and the child finds each slip on the cookies
  t.beat(3);
  // (the five cookies and their plates slide away as the narrator begins; the new cookies tumble onto the tray
  // one after another as they're named, the last at "all over the tray"; and a "?" lands on one, then another,
  // at "which ones you've counted", once they are all there)
  let landed: Promise<void> | undefined;
  await t.sayWith('ep.count.mixed', [
    [0, () => (landed = (async () => { await w.trayOut(); await w.trayIn(MIXED, { mixed: true, over: AT.mixed.cookies }); })())],
    [AT.mixed.unsure, async () => { await landed; await w.unsure(); }]]);
  await t.say('ep.count.try.pal');
  t.pal('act');
  t.thought('pal', String(await w.slipCount('pal', 'twice')));
  await t.say('ep.count.pal.find');
  await findSlip(t, w, 'pal');
  t.thought('pal', null);
  // (Sprout Bunny's numbers come off as the narrator turns to the buddy)
  await t.sayWith('ep.count.try.buddy', [[0, () => w.clearNumbers()]]);
  t.buddy('point');
  t.thought('buddy', String(await w.slipCount('buddy', 'skip')));
  await t.say('ep.count.buddy.find');
  await findSlip(t, w, 'buddy');
  t.thought('buddy', null);
  // (why, then what to do: two short lines, not one long one for a child who only hears it. Each slip is seen
  // again on its own cookie as it's named: the one the buddy skipped, still with no number, then the one
  // Sprout Bunny counted twice, with its two numbers)
  await t.sayWith('ep.count.move.why', [[AT.why.skip, () => w.recall('skip')], [AT.why.twice, () => w.recall('twice')]]);
  await t.sayWith('ep.count.move', [[0, () => w.clearNumbers()]]);
  await t.hands('Tap each cookie', () => w.tapCount(), () => w.finish());
  const second = await howMany(t, w, MIXED, 'b7', 'ep.count.how2');

  // bumped round the tray: still as many? Then the child counts them again where they sit, starting anywhere.
  // A child who thought the number had changed hears why it hasn't (it was only said to the child who was right)
  t.beat(4);
  // (the table is bumped at "bumps", and the cookies are still sliding round, slowly, while the narrator says to
  // watch them: they stop as the line ends. The plates of the count before left on their own, before this
  // line, so that the bump is the only thing that moves a cookie while it is said)
  await t.sayWith('ep.count.try.bump', [[AT.bump[0], () => w.bump(AT.bump[1])]]);
  const moved = await t.num('How many cookies now?', 'ep.count.moved');
  // (a child who knew the number hadn't changed is told why they're right and goes on: counting them again was
  // half a minute more for a five-year-old who had already shown the idea. A child who thought it had changed
  // sees their number fail on the plates, then counts the cookies again themselves and hears why)
  if (moved === MIXED) { t.buddy('clap'); t.pal('happy'); await t.say('ep.count.moved.right'); await t.go('Next'); }
  else {
    t.myBet(String(moved)); await platesTest(t, w, moved, MIXED); t.myBet(null);
    // (the plates go and the cookies hop back to where they sat as the narrator says "let's count them again")
    await t.sayWith('ep.count.try.recount.again', [[0, () => w.platesOff()]]);
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
    // (the cookies slide away while the narrator says they're put away, and the new ones land at "found a few more")
    await t.sayWith('ep.count.extra', [[AT.extra.away[0], () => w.trayOut(AT.extra.away[1])], [AT.extra.more[0], () => w.trayIn(EXTRA, { over: AT.extra.more[1] })]]);
    await t.hands('Tap each cookie', () => w.tapCount(), () => w.finish());
    await howMany(t, w, EXTRA, 'b4', 'ep.count.how.last', true);
  }

  // the end of this story, and what the counting was for: as many plates as cookies, and off they go
  t.beat(5);
  // (the plates come out from "gets out seven plates" and are laid by "one for each cookie"; the cookies leave on
  // them from "Sprout Bunny is off to the party", and are gone as the line ends)
  if (!extra) await t.sayWith('ep.count.try.party', [[AT.party[0], () => w.plates(MIXED, AT.party[1])]]);
  t.pal('happy'); t.buddy('jump');
  const off = extra ? AT.offExtra : AT.off;
  await t.sayWith(extra ? 'ep.count.off.extra' : 'ep.count.off', [[off[0], () => w.party(off[1])]]);
  await t.wait(400);
  return { first, second, moved };
}

async function check(t: Teller, w: CountWorld) {
  // (the cookies tumble in while the narrator says they're here, the last at "all over the tray")
  await t.sayWith('ep.count.check', [[AT.check[0], () => w.trayIn(NEXT_DAY, { mixed: true, over: AT.check[1] })]]);
  await t.hands('Tap each cookie', () => w.tapCount(), () => w.finish());
  await howMany(t, w, NEXT_DAY, 'b6', 'ep.count.how2', true);
  await w.trayOut();
}

export const COUNT_LESSON: BeatLesson<CountWorld> = {
  id: 'k-count', title: 'How Many Cookies?', blurb: 'Say one number for each thing. The last number tells you how many.', set: 'kitchen', star: 'sproutbun', color: '#e58a3a',
  art: 'learn/ep/card-cookies.webp', voice: 'count', beats: 6,
  world: async (sc: EpisodeScene) => { const { CountKit } = await import('../../three/countKit'); return new CountKit(sc); },
  play, check,
  card: n => [`Your first count: ${n.first ?? '?'} cookies`, 'The last number you say when you count tells you how many there are.'],
};
