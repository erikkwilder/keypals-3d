// Mystery Bags (grade 7, two-step equations, 7.EE.B.4a), rebuilt as a beat lesson. The Comet Cat has bags of
// star sand that all weigh the same, and sets a puzzle: how heavy is one bag? (It is said to be a puzzle because
// it is one. The story used to say the cat "needs" the weight for its tags and that a balance was "the only
// way", and a child would ask why it doesn't just weigh one bag.) Two bags and 3 loose weights hang level with
// 11 weights. The child guesses first, and any
// guess is tested by putting that many weights in place of each bag, so x is a number from the start, and
// checking means putting the number back in, not looking. Then their hands take the 3 off one side only and
// the balance tips; they say how many must come off the other side, and their number is acted out. One bag
// comes off and they say how many weights go with it. The buddy shares the bags into three but keeps the
// loose weights, and it tips; that balance, put back, is the child's to do in their head (a miss twice is done
// together by hand, then one more on their own). The equation is written only after the hands, one line per
// moment of the balance. It ends with the numbers
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

const FIRST: Eq = { p: 2, q: 3, r: 11 }, BUDDY: Eq = { p: 3, q: 6, r: 21 }, ONE_MORE: Eq = { p: 4, q: 1, r: 13 };
const NEXT_DAY: Eq = { p: 2, q: 5, r: 17 };

/** the words a run of the lesson can say, all of them */
export const EQUATION_LINES = ['intro', 'scale', 'level', 'letter', 'guess', 'try.you', 'try.again', 'heavy', 'light', 'lucky', 'unlucky',
  'own.why', 'try.off', 'off.up', 'other.ask', 'try.other', 'other.yes', 'other.few', 'other.many', 'other.fix',
  'share.idea', 'share.ask', 'try.share', 'share.yes', 'share.few', 'share.many', 'share.how', 'share.done', 'write', 'write.read',
  'b.in', 'b.idea', 'b.ask', 'try.buddy', 'b.no', 'b.yes', 'b.kept', 'b.rule', 'b.own', 'try.both', 'b.right', 'b.seven', 'b.mid', 'b.share', 'b.piles', 'b.write',
  'together', 'd.in', 'd.right', 'try.d', 'd.mid', 'd.last', 'd.own', 'd.share', 'd.piles',
  'end', 'end.we', 'check', 'check.right', 'check.again', 'check.mid', 'check.share', 'check.piles'].map(k => `ep.eq.${k}`);

/** Test a number for one bag: say whose it is, put it in place of each bag, say what the balance showed. The
 *  first test says how a test works; later ones just say whose number goes in. A right number gets its own line,
 *  which says it stayed level and why. */
async function test(t: Teller, w: EquationWorld, e: Eq, n: number, right: string, first = false, told?: string): Promise<boolean> {
  await t.say(first ? 'ep.eq.try.you' : 'ep.eq.try.again', n);
  t.pal('act');
  await w.swapIn(n);
  const { tip } = swapped(e, n);
  if (tip === 0) { t.buddy('cheer'); t.pal('happy'); } else { t.buddy('shrug'); t.pal('sad'); }
  // (a miss says, in one line, what the bags' side now comes to against the other side's count on screen, which
  // way that tips it, and so whether a bag weighs more or less than their number)
  // (`told`: a miss that is a particular mistake gets its own line, which says what that mistake was)
  await t.say(tip === 0 ? right : told ?? (tip > 0 ? 'ep.eq.heavy' : 'ep.eq.light'), n, e.p * n + e.q, e.r);
  await w.swapBack();
  return tip === 0;
}

/** A balance worked out on its own: each try is tested; then, said kindly, it's done together by hand. In the
 *  lesson that is after one try (a second try with the same hint took a minute and taught nothing new); the next
 *  day's check gives two. */
async function onOwn(t: Teller, w: EquationWorld, e: Eq, k: 'b' | 'check'): Promise<boolean> {
  const tries = k === 'check' ? 2 : 1;
  for (let miss = 0; miss < tries; miss++) {
    const n = await t.num('How heavy is one bag?', miss ? `ep.eq.${k}.again` : undefined);
    t.myBet(String(n));
    // (the other side shared into as many parts as there are bags, with the loose weights still on: the buddy's
    // own mistake, made again. It's told so, not just "less than your number")
    const buddys = k === 'b' && e.q > 0 && n * e.p === e.r ? 'ep.eq.b.seven' : undefined;
    if (await test(t, w, e, n, `ep.eq.${k}.right`, false, buddys)) { t.myBet(null); await t.go('Next'); return true; }
  }
  t.myBet(null);
  await t.say('ep.eq.together');
  await t.say('ep.eq.try.both');
  await t.hands('Drag the loose weights off, the same from each side', () => w.takeOff('both'), () => w.finish());
  await t.say(`ep.eq.${k}.mid`);
  // (why piles, and how many: said before they form)
  await t.say(`ep.eq.${k}.share`);
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
  const lucky = await test(t, w, FIRST, first, 'ep.eq.lucky', true);
  t.myBet(null);
  if (!lucky) await t.say('ep.eq.unlucky');

  // the loose weights off: first from one side only (their prediction, then their hands), and it tips
  t.beat(2);
  // (why a bag on its own is what we're after, before the first step toward it. Their hands take the loose
  // weights off one side only and the balance shows what that does. A "what will happen?" choice stood here: it
  // was easy, and it and its answer were twenty seconds of a lesson that runs long)
  await t.say('ep.eq.own.why');
  await t.say('ep.eq.try.off');
  await t.hands("Drag the 3 loose weights off the bags' side", () => w.takeOff('left'), () => w.finish());
  t.buddy('gasp');
  await t.say('ep.eq.off.up');
  const other = await t.num('How many come off the other side?', 'ep.eq.other.ask');
  await t.say('ep.eq.try.other', other);
  await w.takeRight(other);
  const tip = offOther(FIRST, other);
  if (tip === 0) { t.pal('happy'); await t.say('ep.eq.other.yes'); }
  else { t.pal('sad'); await t.say(tip > 0 ? 'ep.eq.other.many' : 'ep.eq.other.few', other); await w.setRight(FIRST.r - FIRST.q); await t.say('ep.eq.other.fix'); }
  await t.go('Next');

  // one bag off: how many weights go with it? Their number is acted out, then the 8 is shared into 2 piles
  t.beat(3);
  // (the halving idea is said before the question, so the question can be answered from what was taught)
  await t.say('ep.eq.share.idea');
  const half = await t.num('How many weights come off with it?', 'ep.eq.share.ask');
  await t.say('ep.eq.try.share', half);
  await w.share(half);
  const sh = oneBagOff(FIRST, half);
  if (sh === 0) { t.pal('happy'); t.buddy('clap'); await t.say('ep.eq.share.yes'); }
  else {
    t.buddy('shrug');
    // (what's left on the other side, which way it went, and so what that says about one bag)
    await t.say(sh < 0 ? 'ep.eq.share.few' : 'ep.eq.share.many', half, Math.max(0, FIRST.r - FIRST.q - half));
    await t.say('ep.eq.share.how');
    await w.reset('bags');
    await w.shareOut(FIRST.p);
    await t.say('ep.eq.share.done');
  }
  await t.go('Next');

  // only now is it written, one line for each moment of the balance (over the empty balance, so it can be read)
  await w.scaleOut();
  w.writeSteps(written(FIRST));
  await t.say('ep.eq.write');
  await t.say('ep.eq.write.read');
  await t.go('Next');
  w.clearSteps();

  // the buddy's way: share the bags but keep the loose weights. The child says first if it will work
  t.beat(4);
  await w.scaleIn(BUDDY);
  await t.say('ep.eq.b.in');
  t.thought('buddy', '1 bag and 6 = 7'); t.buddy('point');
  await t.say('ep.eq.b.idea');
  const works = await t.pick('Will it stay level?', [{ id: 'yes', text: 'Yes, it stays level' }, { id: 'no', text: 'No, it tips' }], 'ep.eq.b.ask');
  await t.say('ep.eq.try.buddy');
  await w.buddyShare();
  t.thought('buddy', null); t.buddy('oops');
  await t.say(works === 'no' ? 'ep.eq.b.no' : 'ep.eq.b.yes');
  // (why it tipped, in what the buddy did; then the general reason and the simpler way, each its own line)
  await t.say('ep.eq.b.kept');
  await t.say('ep.eq.b.rule');
  await t.go('Next');

  // the same balance, put back, is the child's own: both steps in their head, and the balance tests the answer
  t.beat(5);
  await Promise.all([t.say('ep.eq.b.own'), w.reset('start')]);
  const ownB = await onOwn(t, w, BUDDY, 'b');
  await w.scaleOut();
  t.beat(6);
  // (written down for a child who needed the steps done together. One who solved it alone has just been told
  // the two steps in their own numbers, and has seen them written once already)
  if (!ownB) {
    w.writeSteps(written(BUDDY));
    await t.say('ep.eq.b.write');
    await t.go('Next');
    w.clearSteps();
  }
  // (every child gets one right on their own before the end, even after being helped). One try at the whole
  // balance; then, said kindly, the first step is done together with their hands, and the last step is still
  // theirs: 4 bags against 12. A miss there is shown on the balance, the 12 shared into 4 piles. (More tries at
  // the whole balance, with the same hint each time, took minutes and taught nothing new.)
  let extra = false, solved = ownB;
  if (!ownB) {
    extra = true;
    await w.scaleIn(ONE_MORE);
    const n1 = await t.num('How heavy is one bag?', 'ep.eq.d.in');
    t.myBet(String(n1));
    const got = await test(t, w, ONE_MORE, n1, 'ep.eq.d.right');
    t.myBet(null);
    solved = got;
    if (!got) {
      await t.say('ep.eq.try.d');
      await t.hands('Drag the loose weight off, and the same from the other side', () => w.takeOff('both'), () => w.finish());
      await t.say('ep.eq.d.mid');
      const n = await t.num('How heavy is one bag?', 'ep.eq.d.last');
      t.myBet(String(n));
      const own = await test(t, w, { p: ONE_MORE.p, q: 0, r: ONE_MORE.r - ONE_MORE.q }, n, 'ep.eq.d.own');
      t.myBet(null);
      solved = own;
      if (!own) { await t.say('ep.eq.d.share'); await w.shareOut(ONE_MORE.p); await t.say('ep.eq.d.piles'); }
    }
    await t.go('Next');
    await w.scaleOut();
  }

  // the end: the numbers go on the tags where the x was
  t.beat(7);
  const today = [FIRST, BUDDY, ...(extra ? [ONE_MORE] : [])];
  await w.tags(today.map(xOf), today.map(e => e.p));
  t.pal('happy'); t.buddy('jump');
  // ("you found" only for a child who found one on their own; otherwise "now we know": no praise for nothing)
  await t.say(solved ? 'ep.eq.end' : 'ep.eq.end.we');
  await t.wait(600);
  return { first, own: ownB ? 1 : 0 };
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
export { FIRST, BUDDY, ONE_MORE, NEXT_DAY };
