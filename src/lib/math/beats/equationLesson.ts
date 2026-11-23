// Mystery Bags (grade 7, two-step equations, 7.EE.B.4a), rebuilt as a beat lesson. The Comet Cat has bags of
// star sand that all weigh the same and needs to write one bag's weight on the tags. The only way to find it
// is a balance: two bags and 3 loose weights hang level with 11 weights. The child guesses first, and any
// guess is tested by putting that many weights in place of each bag, so x is a number from the start, and
// checking means putting the number back in, not looking. Then their hands take the 3 off one side only and
// the balance tips; they say how many must come off the other side, and their number is acted out. One bag
// comes off and they say how many weights go with it. The buddy shares the bags into three but keeps the
// loose weights, and it tips. The child does the next one with their hands and the last on their own. The
// equation is written only after the hands, one line per moment of the balance. It ends with the numbers
// written on the tags where the x was. docs/lesson-rules.md holds the rules; rules.ts checks the ones a test can.
import type { BeatLesson, Notes, Teller, World } from './types';
import type { EpisodeScene } from '../../three/episodeScene';
import { offOther, oneBagOff, swapped, xOf, written, type Eq, type Part } from './equation';

/** What's on the table in this lesson (three/balanceKit.ts). Each call plays and resolves when it's over. */
export interface EquationWorld extends World {
  /** the bags and loose weights go on the left, then the right fills one weight at a time until it hangs level */
  scaleIn(e: Eq): Promise<void>;
  /** everything comes off, and the balance stands empty */
  scaleOut(): Promise<void>;
  /** every bag lifts off, and `n` weights go in each bag's place: the balance shows what that weighs */
  swapIn(n: number): Promise<void>;
  /** the weights in the bags' places go, and the bags come back */
  swapBack(): Promise<void>;
  /** the child's hands drag loose weights off: from the bags' side only, or from both sides until it's level */
  takeOff(from: 'left' | 'both'): Promise<void>;
  /** `n` weights come off the other side */
  takeRight(n: number): Promise<void>;
  /** the other side ends up with `n` weights (some come back, or more go) */
  setRight(n: number): Promise<void>;
  /** one bag comes off the bags' side, and `n` weights off the other side */
  share(n: number): Promise<void>;
  /** the other side's weights move into `parts` equal piles; all but one pile go, with all but one bag */
  shareOut(parts: number): Promise<void>;
  /** the buddy's way: all but one bag go, and all but a part of the other side, but the loose weights stay */
  buddyShare(): Promise<void>;
  /** back the way this balance started, or the way it was with the loose weights off both sides */
  reset(to: 'start' | 'bags'): Promise<void>;
  /** the lines of the equation over the balance, each with what the hands did */
  writeSteps(lines: { parts: Part[]; why: string }[]): void;
  clearSteps(): void;
  /** do the rest of the hand's job ("Show me") */
  finish(): void;
  /** the end: every bag from today stands in a row, and its tag's x turns into its number */
  tags(weights: number[], bags: number[]): Promise<void>;
}

const FIRST: Eq = { p: 2, q: 3, r: 11 }, BUDDY: Eq = { p: 3, q: 6, r: 21 }, OWN: Eq = { p: 3, q: 2, r: 20 }, ONE_MORE: Eq = { p: 4, q: 1, r: 13 };
const NEXT_DAY: Eq = { p: 2, q: 5, r: 17 };

/** the words a run of the lesson can say, all of them */
export const EQUATION_LINES = ['intro', 'scale', 'level', 'letter', 'guess', 'try.you', 'heavy', 'light', 'right', 'lucky', 'unlucky',
  'off.why', 'off.ask', 'try.off', 'off.up', 'off.no', 'other.ask', 'try.other', 'other.yes', 'other.few', 'other.many', 'other.fix',
  'share.ask', 'try.share', 'share.yes', 'share.few', 'share.many', 'share.how', 'share.done', 'write', 'write.read',
  'b.in', 'b.idea', 'b.ask', 'try.buddy', 'b.no', 'b.yes', 'b.rule', 'b.back', 'try.both', 'b.off', 'b.ask2', 'b.right', 'b.again', 'b.together', 'b.piles', 'b.write',
  'c.in', 'c.ask', 'c.right', 'c.again', 'together', 'c.mid', 'c.piles', 'd.in', 'd.right', 'd.again', 'd.hint',
  'end', 'check', 'check.right', 'check.again', 'check.mid', 'check.piles'].map(k => `ep.eq.${k}`);

/** Test a number for one bag: say whose it is, put it in place of each bag, say what the balance showed. */
async function test(t: Teller, w: EquationWorld, e: Eq, n: number): Promise<boolean> {
  await t.say('ep.eq.try.you', n);
  t.pal('act');
  await w.swapIn(n);
  const { tip } = swapped(e, n);
  if (tip === 0) { t.buddy('cheer'); t.pal('happy'); } else { t.buddy('shrug'); t.pal('sad'); }
  await t.say(tip === 0 ? 'ep.eq.right' : tip > 0 ? 'ep.eq.heavy' : 'ep.eq.light', n);
  await w.swapBack();
  return tip === 0;
}

/** A balance worked out on its own: two tries, each tested; then, said kindly, it's done together by hand. */
async function onOwn(t: Teller, w: EquationWorld, e: Eq, k: 'c' | 'check'): Promise<boolean> {
  for (let miss = 0; ; miss++) {
    const n = await t.num('How heavy is one bag?', miss ? `ep.eq.${k}.again` : k === 'c' ? 'ep.eq.c.ask' : undefined);
    t.myBet(String(n));
    if (await test(t, w, e, n)) { t.myBet(null); await t.say(`ep.eq.${k}.right`); await t.go('Next'); return true; }
    if (miss >= 1) break;
  }
  t.myBet(null);
  await t.say('ep.eq.together');
  await t.say('ep.eq.try.both');
  await t.hands('Drag the loose weights off, the same from each side', () => w.takeOff('both'), () => w.finish());
  await t.say(`ep.eq.${k}.mid`);
  await w.shareOut(e.p);
  await t.say(`ep.eq.${k}.piles`);
  await t.go('Next');
  return false;
}

async function play(t: Teller, w: EquationWorld): Promise<Notes> {
  // the job: why one bag's weight matters, and what level means (shown filling, not told)
  t.beat(0);
  await t.wait(700);
  await t.say('ep.eq.intro');
  await t.say('ep.eq.scale');
  await w.scaleIn(FIRST);
  t.pal('happy');
  await t.say('ep.eq.level');
  await t.say('ep.eq.letter');

  // a guess first: any number is put in place of each bag, so x is a number and a check is a test
  t.beat(1);
  const first = await t.num('How heavy is one bag?', 'ep.eq.guess');
  t.myBet(String(first));
  const lucky = await test(t, w, FIRST, first);
  t.myBet(null);
  await t.say(lucky ? 'ep.eq.lucky' : 'ep.eq.unlucky');

  // the loose weights off: first from one side only (their prediction, then their hands), and it tips
  t.beat(2);
  await t.say('ep.eq.off.why');
  const guess = await t.pick('What will happen?', [{ id: 'up', text: "The bags' side goes up" }, { id: 'down', text: "The bags' side goes down" }, { id: 'level', text: 'It stays level' }], 'ep.eq.off.ask');
  await t.say('ep.eq.try.off');
  await t.hands("Drag the 3 loose weights off the bags' side", () => w.takeOff('left'), () => w.finish());
  t.buddy(guess === 'up' ? 'nod' : 'gasp');
  await t.say(guess === 'up' ? 'ep.eq.off.up' : 'ep.eq.off.no');
  const other = await t.num('How many come off the other side?', 'ep.eq.other.ask');
  await t.say('ep.eq.try.other', other);
  await w.takeRight(other);
  const tip = offOther(FIRST, other);
  if (tip === 0) { t.pal('happy'); await t.say('ep.eq.other.yes'); }
  else { t.pal('sad'); await t.say(tip > 0 ? 'ep.eq.other.many' : 'ep.eq.other.few', other); await w.setRight(FIRST.r - FIRST.q); await t.say('ep.eq.other.fix'); }
  await t.go('Next');

  // one bag off: how many weights go with it? Their number is acted out, then the 8 is shared into 2 piles
  t.beat(3);
  const half = await t.num('How many weights come off with it?', 'ep.eq.share.ask');
  await t.say('ep.eq.try.share', half);
  await w.share(half);
  const sh = oneBagOff(FIRST, half);
  if (sh === 0) { t.pal('happy'); t.buddy('clap'); await t.say('ep.eq.share.yes'); }
  else {
    t.buddy('shrug');
    await t.say(sh < 0 ? 'ep.eq.share.few' : 'ep.eq.share.many', half);
    await t.say('ep.eq.share.how');
    await w.reset('bags');
    await w.shareOut(FIRST.p);
    await t.say('ep.eq.share.done');
  }
  await t.go('Next');

  // only now is it written, one line for each moment of the balance
  w.writeSteps(written(FIRST));
  await t.say('ep.eq.write');
  await t.say('ep.eq.write.read');
  await t.go('Next');
  w.clearSteps();
  await w.scaleOut();

  // the buddy's way: share the bags but keep the loose weights. The child says first if it will work
  t.beat(4);
  await w.scaleIn(BUDDY);
  await t.say('ep.eq.b.in');
  t.thought('buddy', 'Share by 3: 1 bag and 6 = 7'); t.buddy('point');
  await t.say('ep.eq.b.idea');
  const works = await t.pick('Will it stay level?', [{ id: 'yes', text: 'Yes, it stays level' }, { id: 'no', text: 'No, it tips' }], 'ep.eq.b.ask');
  await t.say('ep.eq.try.buddy');
  await w.buddyShare();
  t.thought('buddy', null); t.buddy('oops');
  await t.say(works === 'no' ? 'ep.eq.b.no' : 'ep.eq.b.yes');
  await t.say('ep.eq.b.rule');
  await t.go('Next');
  await t.say('ep.eq.b.back');
  await w.reset('start');

  // the child's own hands do it, then the child says what one bag weighs
  t.beat(5);
  await t.say('ep.eq.try.both');
  await t.hands('Drag the loose weights off, the same from each side', () => w.takeOff('both'), () => w.finish());
  t.buddy('nod');
  await t.say('ep.eq.b.off');
  let ownB = false;
  for (let miss = 0; ; miss++) {
    const n = await t.num('How heavy is one bag?', miss ? 'ep.eq.b.again' : 'ep.eq.b.ask2');
    t.myBet(String(n));
    if (await test(t, w, { ...BUDDY, q: 0, r: BUDDY.r - BUDDY.q }, n)) { ownB = true; t.myBet(null); await t.say('ep.eq.b.right'); await t.go('Next'); break; }
    if (miss >= 1) { t.myBet(null); await t.say('ep.eq.b.together'); await w.shareOut(BUDDY.p); await t.say('ep.eq.b.piles'); await t.go('Next'); break; }
  }
  w.writeSteps(written(BUDDY));
  await t.say('ep.eq.b.write');
  await t.go('Next');
  w.clearSteps();
  await w.scaleOut();

  // on their own: no hands, the balance only tests the answer
  t.beat(6);
  await w.scaleIn(OWN);
  await t.say('ep.eq.c.in');
  const ownC = await onOwn(t, w, OWN, 'c');
  await w.scaleOut();
  // (every child gets one right on their own before the end, even after being helped)
  let extra = false;
  if (!ownB && !ownC) {
    extra = true;
    await w.scaleIn(ONE_MORE);
    for (let miss = 0; miss < 6; miss++) {
      const n = await t.num('How heavy is one bag?', miss === 0 ? 'ep.eq.d.in' : miss === 1 ? 'ep.eq.d.again' : 'ep.eq.d.hint');
      t.myBet(String(n));
      if (await test(t, w, ONE_MORE, n)) { t.myBet(null); await t.say('ep.eq.d.right'); await t.go('Next'); break; }
    }
    t.myBet(null);
    await w.scaleOut();
  }

  // the end: the numbers go on the tags where the x was
  t.beat(7);
  const today = [FIRST, BUDDY, OWN, ...(extra ? [ONE_MORE] : [])];
  await w.tags(today.map(xOf), today.map(e => e.p));
  t.pal('happy'); t.buddy('jump');
  await t.say('ep.eq.end');
  await t.wait(600);
  return { first, own: ownB || ownC ? 1 : 0 };
}

async function check(t: Teller, w: EquationWorld, notes: Notes | null) {
  await w.scaleIn(NEXT_DAY);
  if (notes?.first != null) t.myBet(`Your first guess yesterday: ${notes.first}`);
  await t.say('ep.eq.check');
  t.myBet(null);
  await onOwn(t, w, NEXT_DAY, 'check');
  await w.scaleOut();
}

export const EQUATION_LESSON: BeatLesson<EquationWorld> = {
  id: 'alg-two-step', title: 'Mystery Bags', blurb: 'Take the same off both sides, then share each side: 2x + 3 = 11.', set: 'lab', star: 'cometcat', color: '#8f6bff',
  art: 'math/algebra/tile.webp', beats: 8,
  world: async (sc: EpisodeScene) => { const { BalanceKit } = await import('../../three/balanceKit'); return new BalanceKit(sc); },
  play, check,
  card: n => [`Your first guess: ${n.first ?? '?'}`, 'Whatever comes off one side comes off the other, then each side is shared into equal parts, and the balance stays level.'],
};
export { FIRST, BUDDY, OWN, ONE_MORE, NEXT_DAY };
