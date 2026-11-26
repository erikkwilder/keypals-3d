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
import type { BeatLesson, Cue, Notes, Teller, World } from './types';
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
  /** the buddy's way: all but one bag go, and all but a part of the other side, but the loose weights stay
   *  (`part`: only the bags, or only the weights, each as it is said) */
  buddyShare(part?: 'bags' | 'weights'): Promise<void>;
  /** back the way this balance started, or the way it was with the loose weights off both sides */
  reset(to: 'start' | 'bags'): Promise<void>;
  /** the lines of the equation over the balance, each with what the hands did */
  writeSteps(lines: { parts: Part[]; why: string }[]): void;
  clearSteps(): void;
  /** do the rest of the hand's job ("Show me") */
  finish(): void;
  // ---- the pictures that go with a line (Teller.sayWith): what the words say, shown as they are said ----
  /** the opening: the bags come to stand on the table in front of the empty balance, one after the other, no x on them yet */
  bagsOut(e: Eq): Promise<void>;
  /** a "?" on one bag: how heavy is it? */
  askBag(): Promise<void>;
  /** the bags and the loose weights go onto the bags' side (which goes down: the other side is empty) */
  loadLeft(): Promise<void>;
  /** the other side fills one weight at a time until it hangs level (`quick`: fast enough to end with the line that tells it) */
  fillRight(quick?: boolean): Promise<void>;
  /** the x is written on each bag, one after the other (the "?" on the first turns into it) */
  writeX(): Promise<void>;
  /** what the words are about lights for a moment, and its number with it: every bag, bag `i`, the loose weights,
   *  everything on a side (its pan's rim lights too), the weights in bag `i`'s place, the pile taken off the bags' side */
  light(what: 'bags' | 'bag' | 'loose' | 'left' | 'right' | 'guess' | 'pileL' | 'pileR' | 'pile', i?: number): Promise<void>;
  /** a new balance set out as it is told: its bags go onto the bags' side, each with its x; then its loose weights
   *  (the other side fills with fillRight) */
  bagsOn(e: Eq): Promise<void>;
  looseOn(): Promise<void>;
  /** the other side's weights move into `parts` equal piles on its pan, each with its count (`calm`: the balance
   *  doesn't swing as they move: a plan is being pictured, nothing has been tried) */
  piles(parts: number, calm?: boolean): Promise<void>;
  /** the buddy's plan before it is tried: what would come off turns see-through (all but one bag; all but one pile) */
  keep(what: 'bag' | 'pile'): void;
  /** a bright line along both pans' rims at the height they hang level at (false: gone) */
  levelLine(on: boolean): void;
  /** what the bags' side comes to with a guess in the bags' places, over them (null: gone) */
  total(n: number | null): void;
  /** the what-if: one bag alone on its side (everything else turns see-through), and the other side's count
   *  turns into a "?", because nobody knows it yet */
  alone(on: boolean): void;
  /** a 0 where the other side's pile would be: nothing has come off it */
  noneOff(): void;
  /** half of a pan's rim stays lit: the bags' side's, or both sides' (null: gone). The weights are not sorted
   *  into halves: how many half is, is the child's to say */
  half(side: 'left' | 'both' | null): void;
  /** one written line over the balance (`k`: which line), with part `hot` lit (null: gone) */
  writeLine(k: number | null, parts?: Part[], hot?: number): void;
  /** the loose weights come off the bags' side, then as many off the other side */
  offBoth(): Promise<void>;
  /** the end: every bag from today stands in a row, an x on each tag */
  tags(weights: number[], bags: number[]): Promise<void>;
  /** each tag's x turns into its bag's number, one after the other */
  writeTags(): Promise<void>;
}

const FIRST: Eq = { p: 2, q: 3, r: 11 }, BUDDY: Eq = { p: 3, q: 6, r: 21 }, ONE_MORE: Eq = { p: 4, q: 1, r: 13 };
const NEXT_DAY: Eq = { p: 2, q: 5, r: 17 };

/** the words a run of the lesson can say, all of them */
export const EQUATION_LINES = ['intro', 'scale', 'level', 'letter', 'guess', 'try.you', 'try.again', 'heavy', 'light', 'lucky', 'unlucky',
  'own.why', 'try.off', 'off.up', 'other.ask', 'try.other', 'other.yes', 'other.few', 'other.many', 'other.fix',
  'share.idea', 'share.ask', 'try.share', 'share.yes', 'share.few', 'share.many', 'share.how', 'share.done', 'write', 'write.read',
  'b.in', 'b.idea', 'b.ask', 'try.buddy', 'b.no', 'b.yes', 'b.kept', 'b.rule', 'b.own', 'try.both', 'b.right', 'b.seven', 'b.mid', 'b.share', 'b.piles', 'b.write',
  'together', 'd.in', 'try.d', 'd.mid', 'd.last', 'd.own', 'd.share', 'd.piles',
  'end', 'end.we', 'check', 'check.right', 'check.again', 'check.mid', 'check.share', 'check.piles'].map(k => `ep.eq.${k}`);

/** Pictures that must not run into each other take turns: each waits for the one before it. (A cue comes at its
 *  second of the line by the clip's clock; on a slow screen the picture before it can still be moving.) */
const turns = () => { let last: Promise<unknown> = Promise.resolve(); return (f: () => unknown) => () => (last = last.then(f)); };
const both = (w: EquationWorld) => Promise.all([w.light('left'), w.light('right')]);

/** The second of its line each picture comes at, for the lines from the buddy's idea on: each clip's own word
 *  times, from Whisper (the words each second belongs to are beside the cue that uses it). */
const AT: Record<string, number[]> = {
  // the opening's balance: "the two bags", "every weight is the same", "watch the other side"
  'ep.eq.scale': [0.2, 5.0, 6.6],
  // a try begins while it is announced (rule 45). The first test: "when that many weights go in each bag's place";
  // a later test, the weights off the other side, one bag off: as the line begins
  'ep.eq.try.you': [6.5], 'ep.eq.try.again': [0.3], 'ep.eq.try.other': [0.4], 'ep.eq.try.share': [0.5],
  // "so the other side has to lose 3 too": it loses them as that is said
  'ep.eq.other.few': [6.9], 'ep.eq.other.many': [6.6],
  // a right number: "it stayed level", each bag's number as it is said, the loose weights' number, what they make
  'ep.eq.lucky': [2.5, 4.3, 5.0, 5.3, 5.8], 'ep.eq.b.right': [2.4, 3.5, 4.3, 4.8, 5.3, 5.8], 'ep.eq.check.right': [1.7, 2.8, 3.4, 3.8, 4.4], 'ep.eq.d.own': [2.2, 3.4, 4.2, 4.6, 5.1, 5.8],
  // a new balance set out: "new bags", "loose weights", the other side ("together", "as much as")
  'ep.eq.b.in': [1.6, 3.9, 5.3], 'ep.eq.d.in': [1.8, 2.7, 3.7],
  // the buddy's plan: "one bag", "there are 3 bags", "keeps", "7 of the 21", "shared into 3 is 7"
  'ep.eq.b.idea': [1.0, 3.3, 5.4, 7.7, 10.2],
  // the buddy's way: "two bags come off", "14 of the 21 weights", "the other side" (the 14 light once they are off), "the 6 loose weights stay"
  'ep.eq.try.buddy': [2.8, 4.3, 6.9, 8.1],
  // "the bags' side went down", "heavier"
  'ep.eq.b.no': [2.6, 4.7], 'ep.eq.b.yes': [3.0, 5.2],
  // "a third of the bags", "a third of the other side", "all 6 of the loose weights", "kept too much"
  'ep.eq.b.kept': [0.7, 1.8, 3.5, 6.9],
  // "every part of it", "the loose weights too", "take them off both sides", "only bags are left"
  'ep.eq.b.rule': [2.7, 3.9, 6.9, 9.2],
  // the buddy's mistake made again: the guesses, "comes to 27", "the 21 on the other side", "7 is 21 shared into 3", "the 6 loose weights"
  'ep.eq.b.seven': [0.2, 3.4, 6.1, 8.3, 11.3],
  // "the loose weights", "the same number off the other side", "stays level"
  'ep.eq.try.both': [0.4, 3.0, 5.4], 'ep.eq.try.d': [0.3, 3.0, 4.3],
  // "both sides lost", "still level", what's left on the other side, "the bags on their own", "as much as"
  'ep.eq.b.mid': [0.2, 2.2, 5.2, 6.7, 8.6], 'ep.eq.check.mid': [0.2, 2.9, 5.7, 6.9, 8.8], 'ep.eq.d.mid': [0.2, 1.8, 4.7, 5.7, 7.6],
  // "the bags weigh the same" (-1: not said), "the weights", "are shared into equal piles", "one for each bag"
  'ep.eq.b.share': [0.5, 2.6, 3.7, 5.9], 'ep.eq.check.share': [0.1, 1.6, 2.6, 5.0], 'ep.eq.d.share': [-1.0, 3.0, 3.9, 5.9],
  // "each pile has", "one bag", "one pile" (the check: "weighs 6 weights")
  'ep.eq.b.piles': [0.2, 2.3, 3.4], 'ep.eq.check.piles': [0.2, 1.5, 2.5], 'ep.eq.d.piles': [0.2, 1.7, 2.9],
  // "how heavy", "writes each number on its tag", "the x on each bag"
  'ep.eq.end': [0.9, 3.1, 5.7], 'ep.eq.end.we': [1.2, 3.5, 6.1],
  // the next day: the bags, "5 loose weights", "as much as 17 weights", "how heavy is one bag"
  'ep.eq.check': [0.1, 1.0, 2.6, 4.6],
};

/** The second of a right number's line the bags come back at: its second sentence, once what the balance showed
 *  has been said (lucky: "Now let's find it"; the others: the two steps, told on the balance as it started). */
const BACK: Record<string, number> = { 'ep.eq.lucky': 7.7, 'ep.eq.b.right': 6.9, 'ep.eq.check.right': 5.5, 'ep.eq.d.own': 6.8 };

/** Test a number for one bag: say whose it is, put it in place of each bag, say what the balance showed. The
 *  first test says how a test works; later ones just say whose number goes in. A right number gets its own line,
 *  which says it stayed level and why, and the bags come back during its second sentence. After a miss the weights
 *  stay in the bags' places until the line is over (they are what it is about): whoever called puts the bags back,
 *  with the line that says what happens next. */
async function test(t: Teller, w: EquationWorld, e: Eq, n: number, right: string, first = false, told?: string): Promise<boolean> {
  // (rule 45: a test begins while it is announced. The first test says what to look for, and the weights start to
  // go in at "when that many weights go in each bag's place"; a later test's one short line is said as they go in.
  // Either way the words are over before the balance answers, so its tipping or staying level is watched in quiet)
  const tryLine = first ? 'ep.eq.try.you' : 'ep.eq.try.again';
  await t.sayWith(tryLine, [[AT[tryLine][0], () => { t.pal('act'); return w.swapIn(n); }]], n);
  const { tip } = swapped(e, n);
  if (tip === 0) { t.buddy('cheer'); t.pal('happy'); } else { t.buddy('shrug'); t.pal('sad'); }
  // (a miss says, in one line, what the bags' side now comes to against the other side's count on screen, which
  // way that tips it, and so whether a bag weighs more or less than their number)
  // (`told`: a miss that is a particular mistake gets its own line, which says what that mistake was)
  // (the result is shown as it's said, rule 37. A miss: the guesses light, then what the bags' side comes to stands
  // over it, then the other side's count lights, then the side that moved. The first balance's right guess: each
  // part of "4 and 4 and 3 make 11" lights as it is said, along the line the balance hangs level at. The cue
  // seconds are each clip's own word times, from Whisper)
  const line = tip === 0 ? right : told ?? (tip > 0 ? 'ep.eq.heavy' : 'ep.eq.light'), total = e.p * n + e.q;
  const guesses = () => Promise.all(Array.from({ length: e.p }, (_, i) => w.light('guess', i)));
  // (every balance's right number is shown the same way, with its own clip's seconds; and the buddy's own mistake
  // made again: the three 7s light at "7 is 21 shared into 3", then the 6 loose weights that weren't taken off)
  const at = AT[line], q = turns(), back = tip === 0 && !!at && !!BACK[line];
  const cues: Cue[] | null = tip === 0 && at ? [[at[0], () => w.levelLine(true)], ...Array.from({ length: e.p }, (_, i): Cue => [at[1 + i], () => w.light('guess', i)]),
      ...(e.q ? [[at[1 + e.p], () => w.light('loose')] as Cue] : []), [at[at.length - 1], q(async () => { await w.light('right'); w.levelLine(false); })],
      ...(BACK[line] ? [[BACK[line], q(() => w.swapBack())] as Cue] : [])]
    : at ? [[at[0], guesses], [at[1], () => { w.total(total); return w.light('left'); }], [at[2], () => w.light('right')], [at[3], guesses], [at[4], () => w.light('loose')]]
    : line === 'ep.eq.heavy' ? [[0.2, guesses], [2.4, () => { w.total(total); return w.light('left'); }], [4.7, () => w.light('right')], [6.3, () => w.light('left')]]
    : line === 'ep.eq.light' ? [[0.2, guesses], [2.4, () => { w.total(total); return w.light('left'); }], [4.9, () => w.light('right')], [6.3, () => w.light('left')]]
    : null;
  if (cues) await t.sayWith(line, cues, n, total, e.r); else await t.say(line, n, total, e.r);
  if (tip === 0 && !back) await w.swapBack();
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
    // (another try: the question waits until the balance is whole again)
    if (miss + 1 < tries) await w.swapBack();
  }
  t.myBet(null);
  // (the bags come back as the narrator says what happens next, rule 45)
  await Promise.all([t.say('ep.eq.together'), w.swapBack()]);
  await dragBoth(t, w, 'ep.eq.try.both');
  await t.hands('Drag the loose weights off, the same from each side', () => w.takeOff('both'), () => w.finish());
  await mid(t, w, `ep.eq.${k}.mid`);
  await sharedOut(t, w, e, k);
  await t.go('Next');
  return false;
}

/** A hand's job said with its pictures: the loose weights light, then the other side, then the line the balance
 *  must stay level at (it stays through the child's dragging, so a side that goes up or down is seen against it). */
const dragBoth = (t: Teller, w: EquationWorld, line: string) =>
  t.sayWith(line, [[AT[line][0], () => w.light('loose')], [AT[line][1], () => w.light('right')], [AT[line][2], () => w.levelLine(true)]]);
/** A new balance set out as it is told: its bags, its loose weights, then the other side fills until it hangs level. */
const setOut = (t: Teller, w: EquationWorld, line: string, e: Eq) => {
  const q = turns();
  return t.sayWith(line, [[AT[line][0], q(() => w.bagsOn(e))], [AT[line][1], q(() => w.looseOn())], [AT[line][2], q(() => w.fillRight(true))]]);
};
/** The loose weights are off both sides: the two piles taken off light together, both sides against the level line,
 *  what is left on the other side, the bags on their own, and that number again. */
async function mid(t: Teller, w: EquationWorld, line: string) {
  const at = AT[line];
  await t.sayWith(line, [[at[0], () => Promise.all([w.light('pileL'), w.light('pileR')])], [at[1], () => { w.levelLine(true); return both(w); }], [at[2], () => w.light('right')],
    [at[3], () => w.light('bags')], [at[4], async () => { await w.light('right'); w.levelLine(false); }]]);
}
/** The last step shown on the balance: the bags light, the weights light and move into one pile for each bag as
 *  that is said; all but one pile come off with all but one bag from "one for each bag", and one bag is seen against one pile. */
async function sharedOut(t: Teller, w: EquationWorld, e: Eq, k: 'b' | 'check' | 'd', first?: () => Promise<void>) {
  const at = AT[`ep.eq.${k}.share`], q = turns();
  // (rule 45: at "one for each bag" every pile but one starts to come off, each with its bag, so the piles are seen
  // to belong to the bags and the words do not have to stop for it. The balance staying level is watched in quiet.
  // `first`: something to finish as the line begins, the bags coming back after a missed test)
  await t.sayWith(`ep.eq.${k}.share`, [...(first ? [[0.1, q(first)] as Cue] : []), ...(at[0] < 0 ? [] : [[at[0], q(() => w.light('bags'))] as Cue]), [at[1], q(() => w.light('right'))], [at[2], q(() => w.piles(e.p))], [at[3], q(() => w.shareOut(e.p))]]);
  const p = AT[`ep.eq.${k}.piles`];
  await t.sayWith(`ep.eq.${k}.piles`, [[p[0], () => w.light('pile', 0)], [p[1], () => w.light('bag', 0)], [p[2], () => w.light('pile', 0)]]);
}

async function play(t: Teller, w: EquationWorld): Promise<Notes> {
  // the job: why one bag's weight matters, and what level means (shown filling, not told)
  t.beat(0);
  await t.wait(700);
  // (every line of the opening is shown as it is said, rule 37: the two bags come out, light together at "the same
  // amount in each", and one gets a "?" at the question; they and the loose weights go on at "go on one side", the
  // loose weights light at "every weight is the same", and the other side fills from "watch the other side")
  let q = turns();
  await t.sayWith('ep.eq.intro', [[1.6, q(() => w.bagsOut(FIRST))], [4.0, q(() => w.light('bags'))], [7.2, q(() => w.askBag())]]);
  q = turns();
  const sc = AT['ep.eq.scale'];
  await t.sayWith('ep.eq.scale', [[sc[0], q(() => w.loadLeft())], [sc[1], q(() => w.light('loose'))], [sc[2], q(() => w.fillRight())]]);
  t.pal('happy');
  // (level: a bright line along both rims; then each thing lights as it is named, the bags and the loose weights on
  // one side, the 11 on the other)
  await t.sayWith('ep.eq.level', [[0.2, () => w.light('right')], [1.1, () => w.levelLine(true)], [3.7, () => both(w)], [5.7, () => w.light('bags')], [6.7, () => w.light('loose')],
    [9.0, async () => { await w.light('right'); w.levelLine(false); }]]);
  // (the x is written on each bag as it's said, where the "?" was; one bag lights, then the weights it is counted in)
  await t.sayWith('ep.eq.letter', [[0.8, () => w.writeX()], [2.5, () => w.light('bag', 0)], [3.6, () => w.light('loose')], [6.8, () => w.light('bags')]]);

  // a guess first: any number is put in place of each bag, so x is a number and a check is a test
  t.beat(1);
  const first = await t.num('How heavy is one bag?', 'ep.eq.guess');
  t.myBet(String(first));
  const lucky = await test(t, w, FIRST, first, 'ep.eq.lucky', true);
  t.myBet(null);
  // (after a miss the bags come back as the narrator says what happens next, rule 45)
  if (!lucky) await Promise.all([t.say('ep.eq.unlucky'), w.swapBack()]);

  // the loose weights off: first from one side only (their prediction, then their hands), and it tips
  t.beat(2);
  // (why a bag on its own is what we're after, before the first step toward it. Their hands take the loose
  // weights off one side only and the balance shows what that does. A "what will happen?" choice stood here: it
  // was easy, and it and its answer were twenty seconds of a lesson that runs long)
  // (the what-if is shown: everything but one bag turns see-through, and the other side's count turns into a "?",
  // not a number: how many it would be is what the lesson is about to find. Rule 41)
  await t.sayWith('ep.eq.own.why', [[0.4, () => w.alone(true)], [2.5, () => w.levelLine(true)], [4.2, () => w.light('right')], [6.2, () => w.light('bag', 0)],
    [8.2, () => { w.levelLine(false); w.alone(false); return w.light('bag', 0); }]]);
  await t.say('ep.eq.try.off');
  await t.hands("Drag the 3 loose weights off the bags' side", () => w.takeOff('left'), () => w.finish());
  t.buddy('gasp');
  // (the line the balance hung level at comes back, so "went up" is seen against it, and it stays until the balance
  // is level again; the 3 taken off light, then a 0 stands where nothing has come off the other side)
  await t.sayWith('ep.eq.off.up', [[0.1, () => w.levelLine(true)], [2.4, () => w.light('pileL')], [4.5, () => { w.noneOff(); return w.light('right'); }], [6.0, () => w.light('left')]]);
  const other = await t.num('How many come off the other side?', 'ep.eq.other.ask');
  // (rule 45: their number starts to come off as "let's take your 3 off" is said; the balance's answer is watched in quiet)
  await t.sayWith('ep.eq.try.other', [[AT['ep.eq.try.other'][0], () => w.takeRight(other)]], other);
  const tip = offOther(FIRST, other);
  if (tip === 0) { t.pal('happy'); await t.say('ep.eq.other.yes'); }
  else {
    t.pal('sad');
    // (rule 45: the other side loses its 3 as "so the other side has to lose 3 too" is said, not in quiet afterwards)
    const miss = tip > 0 ? 'ep.eq.other.many' : 'ep.eq.other.few';
    await t.sayWith(miss, [[AT[miss][0], () => w.setRight(FIRST.r - FIRST.q)]], other);
    await t.say('ep.eq.other.fix');
  }
  await t.go('Next');
  w.levelLine(false);

  // one bag off: how many weights go with it? Their number is acted out, then the 8 is shared into 2 piles
  t.beat(3);
  // (the halving idea is said before the question, so the question can be answered from what was taught)
  // (the bag that will come off lights, then both bags, then half of the bags' pan's rim; then both sides, and half
  // of the other pan's rim. The 8 weights are not sorted into halves: how many half is, is the question. Rule 41)
  await t.sayWith('ep.eq.share.idea', [[0.6, () => w.light('bag', 1)], [2.9, () => w.light('bags')], [4.6, () => w.half('left')], [7.0, () => both(w)], [8.7, () => w.light('bag', 1)], [10.4, () => w.half('both')]]);
  const half = await t.num('How many weights come off with it?', 'ep.eq.share.ask');
  // (rule 45: the bag and their number start to come off as the line says so)
  await t.sayWith('ep.eq.try.share', [[AT['ep.eq.try.share'][0], () => w.share(half)]], half);
  const sh = oneBagOff(FIRST, half);
  if (sh === 0) { t.pal('happy'); t.buddy('clap'); await t.say('ep.eq.share.yes'); }
  else {
    t.buddy('shrug');
    // (what's left on the other side, which way it went, and so what that says about one bag)
    // (the other side is seen against the level line as it's named, then the one bag left lights)
    await t.sayWith(sh < 0 ? 'ep.eq.share.few' : 'ep.eq.share.many', sh < 0
      ? [[2.5, () => { w.levelLine(true); return w.light('right'); }], [6.3, () => w.light('left')]]
      : [[2.0, () => { w.levelLine(true); return w.light('right'); }], [5.4, () => w.light('left')]], half, Math.max(0, FIRST.r - FIRST.q - half));
    // (they go back as "Let's put them back" is said; then the two bags light, and the 8 weights, which move into
    // their 2 piles at "are shared into 2 equal piles": what is said to happen happens while it is said)
    q = turns();
    await t.sayWith('ep.eq.share.how', [[0.1, q(() => w.reset('bags'))], [3.9, q(() => w.light('bags'))], [5.7, q(() => w.light('right'))], [6.4, q(() => w.piles(FIRST.p))],
      [8.3, q(() => w.shareOut(FIRST.p))]]);   // ("one for each bag": one pile starts to come off with its bag, rule 45)
    // (the pile left lights, then the bag that came off, then the one bag left and the one pile left, along the level line)
    await t.sayWith('ep.eq.share.done', [[0.1, () => w.light('right')], [2.3, () => w.levelLine(true)], [3.2, () => w.light('bag', 1)], [5.4, () => w.light('left')], [7.3, () => w.light('right')],
      [9.4, async () => { await w.light('bag', 0); w.levelLine(false); }]]);
  }
  await t.go('Next');

  // only now is it written, and each line is written as the balance does it again (rule 37; Erik: "something that
  // shows or visualizes what it's speaking to"). The balance goes back to its start and the first line stands
  // over it: 2x lights with the two bags, 3 with the loose weights, 11 with the other side, = with the line the
  // rims hang level at. Then 3 come off both sides and "2x = 8" is written; one bag and half the weights come off
  // and "x = 4" is written. Last, the things go and the three lines stand together, each with what the hands did,
  // until the child goes on (over the empty balance, so they can be read)
  const L = written(FIRST);
  q = turns();
  await t.sayWith('ep.eq.write', [[0.1, q(() => w.reset('start'))], [2.0, q(() => w.writeLine(0, L[0].parts))],
    [5.3, q(() => { w.writeLine(0, L[0].parts, 0); return w.light('bags'); })],
    [8.3, q(() => { w.writeLine(0, L[0].parts, 2); return w.light('loose'); })],
    [10.2, q(() => { w.writeLine(0, L[0].parts, 4); return w.light('right'); })]]);
  q = turns();
  await t.sayWith('ep.eq.write.read', [[0.3, q(() => { w.writeLine(0, L[0].parts, 3); w.levelLine(true); return both(w); })],
    [3.3, q(async () => { w.writeLine(0, L[0].parts); await w.offBoth(); w.writeLine(1, L[1].parts); })],
    [7.0, q(async () => { await w.share(xOf(FIRST)); w.writeLine(2, L[2].parts); await t.wait(2600); await w.scaleOut(); w.writeSteps(L); })]]);
  await t.go('Next');
  w.clearSteps();

  // the buddy's way: share the bags but keep the loose weights. The child says first if it will work
  t.beat(4);
  // (the new balance is set out as it is told: the three bags, the 6 loose weights, then the other side fills to 21)
  await setOut(t, w, 'ep.eq.b.in', BUDDY);
  t.thought('buddy', '1 bag and 6 = 7'); t.buddy('point');
  // (the buddy's plan is pictured before it is tried: one bag lights, then all three; the two that would come off
  // turn see-through; the 21 move into 3 piles of 7 and two of those turn see-through. The 6 loose weights stay as
  // they are, so the child can see what would be left on each side when they are asked. The piles move without the
  // balance swinging: nothing has come off yet, and which way it goes is the question. Rule 41)
  q = turns();
  let at = AT['ep.eq.b.idea'];
  await t.sayWith('ep.eq.b.idea', [[at[0], q(() => w.light('bag', 0))], [at[1], q(() => w.light('bags'))], [at[2], q(() => w.keep('bag'))], [at[3], q(() => w.piles(BUDDY.p, true))],
    [at[4], q(() => { w.keep('pile'); return w.light('pile', 0); })]]);
  const works = await t.pick('Will it stay level?', [{ id: 'yes', text: 'Yes, it stays level' }, { id: 'no', text: 'No, it tips' }], 'ep.eq.b.ask');
  // (each half of the buddy's way happens as it is said: the two bags come off, then 14 of the 21 weights; the 14
  // light once they are off, and the 6 loose weights at "stay where they are")
  q = turns();
  at = AT['ep.eq.try.buddy'];
  await t.sayWith('ep.eq.try.buddy', [[at[0], q(() => w.buddyShare('bags'))], [at[1], q(() => w.buddyShare('weights'))], [at[2], q(() => w.light('pileR'))], [at[3], q(() => w.light('loose'))]]);
  t.thought('buddy', null); t.buddy('oops');
  // (the bags' side is seen below the line the balance hung level at, and the line stays while the reason is told)
  const said = works === 'no' ? 'ep.eq.b.no' : 'ep.eq.b.yes';
  await t.sayWith(said, [[AT[said][0], () => { w.levelLine(true); return w.light('left'); }], [AT[said][1], () => w.light('left')]]);
  // (why it tipped, in what the buddy did: the one bag kept, the one pile kept, then all 6 loose weights, and the
  // side that kept too much. Then the general reason and the simpler way, each its own line: the whole side, its
  // loose weights; the loose weights that should come off first; the bags that would be left. The two steps are
  // told whole here, once; the child's own turn (b.own) only names them, rule 44)
  at = AT['ep.eq.b.kept'];
  await t.sayWith('ep.eq.b.kept', [[at[0], () => w.light('bag', 0)], [at[1], () => w.light('pile', 0)], [at[2], () => w.light('loose')], [at[3], () => w.light('left')]]);
  at = AT['ep.eq.b.rule'];
  await t.sayWith('ep.eq.b.rule', [[at[0], () => w.light('left')], [at[1], () => w.light('loose')], [at[2], () => w.light('loose')],
    [at[3], async () => { await w.light('bags'); w.levelLine(false); }]]);
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
  // (every child gets one right on their own before the end, even after being helped). A child who needed the
  // buddy's balance done together gets one more, and it starts where they can succeed: its first step is done
  // together with their hands, and the last step is theirs, 4 bags against 12. A miss there is shown on the
  // balance, the 12 shared into 4 piles. (It used to start with a try at the whole balance: for this child
  // that was another half minute of being wrong before any help.)
  let extra = false, solved = ownB;
  if (!ownB) {
    extra = true;
    await setOut(t, w, 'ep.eq.d.in', ONE_MORE);
    await dragBoth(t, w, 'ep.eq.try.d');
    await t.hands('Drag the loose weight off, and the same from the other side', () => w.takeOff('both'), () => w.finish());
    await mid(t, w, 'ep.eq.d.mid');
    const n = await t.num('How heavy is one bag?', 'ep.eq.d.last');
    t.myBet(String(n));
    const own = await test(t, w, { p: ONE_MORE.p, q: 0, r: ONE_MORE.r - ONE_MORE.q }, n, 'ep.eq.d.own');
    t.myBet(null);
    solved = own;
    if (!own) await sharedOut(t, w, { p: ONE_MORE.p, q: 0, r: ONE_MORE.r - ONE_MORE.q }, 'd', () => w.swapBack());
    await t.go('Next');
    await w.scaleOut();
  }

  // the end: the numbers go on the tags where the x was
  t.beat(7);
  const today = [FIRST, BUDDY, ...(extra ? [ONE_MORE] : [])];
  t.pal('happy'); t.buddy('jump');
  // ("you found" only for a child who found one on their own; otherwise "now we know": no praise for nothing)
  // (the bags come to stand in a row, an x on each tag, as the line begins (rule 45); each x turns into its number as "writes each number on its tag"
  // is said, and the tags light again at "the x on each bag")
  const last = solved ? 'ep.eq.end' : 'ep.eq.end.we';
  q = turns();
  await t.sayWith(last, [[0.1, q(() => w.tags(today.map(xOf), today.map(e => e.p)))], [AT[last][0], q(() => w.light('bags'))], [AT[last][1], q(() => w.writeTags())], [AT[last][2], q(() => w.light('bags'))]]);
  await t.wait(600);
  return { first, own: ownB ? 1 : 0 };
}

async function check(t: Teller, w: EquationWorld, notes: Notes | null) {
  await t.wait(500);
  if (notes?.first != null) t.myBet(`Your first guess yesterday: ${notes.first}`);
  // (rule 45: the balance is set out as it is told, not in quiet before the first word: the bags, the loose weights,
  // the other side filling until it hangs level; then one bag lights for the question)
  const at = AT['ep.eq.check'], q = turns();
  await t.sayWith('ep.eq.check', [[at[0], q(() => w.bagsOn(NEXT_DAY))], [at[1], q(() => w.looseOn())], [at[2], q(() => w.fillRight(true))], [at[3], q(() => w.light('bag', 0))]]);
  t.myBet(null);
  await onOwn(t, w, NEXT_DAY, 'check');
  await w.scaleOut();
}

export const EQUATION_LESSON: BeatLesson<EquationWorld> = {
  id: 'alg-two-step', title: 'Mystery Bags', blurb: 'Take the same off both sides, then share each side: 2x + 3 = 11.', set: 'lab', star: 'cometcat', color: '#8f6bff',
  art: 'math/algebra/tile.webp', voice: 'eq', beats: 8,
  world: async (sc: EpisodeScene) => { const { BalanceKit } = await import('../../three/balanceKit'); return new BalanceKit(sc); },
  play, check,
  card: n => [`Your first guess: ${n.first ?? '?'}`, 'Whatever comes off one side comes off the other, then each side is shared into equal parts, and the balance stays level.'],
};
export { FIRST, BUDDY, ONE_MORE, NEXT_DAY };
