// One Piece, rebuilt as a beat lesson: Pebble Tortoise made a chocolate bar of 8 squares, and 4 friends will
// share it, so the pieces have to be the same size or someone gets less. That need is the whole story. The
// child cuts the bar by tapping it, wherever they like; the pieces go onto the plates and then line up side by
// side, each with its length on it, so whether it's fair is seen before it's said. Two unfair cuts and it's
// done together: in half, then each half in half, each tap able to go wrong. Only then does a piece get its
// name, 1/4, from what the hands just made. The buddy and Pebble each bring a wrong idea children really have:
// 4 pieces must be fourths (the buddy cuts 1, 1, 2 and 4 squares), and 1/8 must be more than 1/4 because 8 is
// more than 4 (Pebble cuts a bar into 8 and its piece is laid under a fourth). Last, a new bar of 6 for 3: the
// child cuts it and names the piece alone, and it ends with the buddy and Pebble eating their thirds.
// docs/lesson-rules.md holds the rules for every lesson's words and pacing; rules.ts checks the ones a test can.
import type { BeatLesson, Cue, Notes, Teller, World } from './types';
import type { EpisodeScene } from '../../three/episodeScene';
import { fair, fairCuts, middle, piecesOf } from './share';

/** What's on the table in this lesson (three/shareKit.ts). Each call plays and resolves when it's over. */
export interface ShareWorld extends World {
  /** a bar of this many squares comes in onto the table, its number of squares standing on it */
  barIn(squares: number): Promise<void>;
  /** a plate for each friend along the front of the table (`owners`: whose each plate is, in front of it) */
  plates(n: number, owners?: string[]): Promise<void>;
  /** the child taps the bar until it's in `pieces` pieces; each tap's knife cuts on the nearest line between
   *  squares. Resolves with the lines cut (a line has that many squares to its left) */
  cut(pieces: number): Promise<number[]>;
  /** one tap, one cut; resolves with the line. `hint`: the line "Show me" cuts */
  tapCut(hint: number): Promise<number>;
  /** a cut closes up again */
  uncut(line: number): Promise<void>;
  /** the pieces go one onto each plate, then line up side by side from the same start, their lengths on them.
   *  `over` (here and below): the seconds the move may take when the narrator is talking over it; it goes more
   *  slowly to end with the words, never quicker than usual (rule 45) */
  serve(over?: number): Promise<void>;
  /** the pieces go back together into one whole bar */
  join(): Promise<void>;
  /** the name stands on every piece of the bar, and on what's laid under it (null: gone) */
  label(mine: string | null, other?: string): void;
  /** someone else's bar, the same size, cut on these lines by their knife, under the child's pieces */
  otherBar(lines: number[], over?: number): Promise<void>;
  /** that bar's pieces line up side by side too, with their lengths on them */
  testOther(over?: number): Promise<void>;
  /** one piece of the same bar cut into `b` equal pieces is laid right under the child's first piece
   *  (`k` pieces: they stand one on top of the other, and the child's stack says how many squares it has too) */
  besides(b: number, k?: number, over?: number): Promise<void>;
  /** whatever was laid under the child's pieces goes away */
  clearOther(): Promise<void>;
  /** the piece on plate `from` goes onto plate `to`, standing on top of the piece there */
  give(from: number, to: number, over?: number): Promise<void>;
  /** a word over the two pieces stacked on one plate (null: gone) */
  total(text: string | null): void;
  /** the buddy's piece (plate 0) and the Glimmer's (plate 1, unless it was given away) go into their mouths */
  eat(): Promise<void>;
  /** the bar and the plates go */
  barOut(): Promise<void>;
  /** do the rest of the hand's job ("Show me") */
  finish(): void;
  // the pictures that go with a line as it is said (rule 37). They are the lesson's own things: nothing new to read
  // but a tick or a cross, and they go when the next thing happens on the table
  /** pretend pieces, see-through, one standing on each plate, each this many squares tall, with a tick or a
   *  cross over them (null: they go) */
  pretend(heights: number[] | null, mark?: 'yes' | 'no'): Promise<void>;
  /** a pretend bar, see-through, lying over the plates in pieces this many plates long: [4] whole, [2, 2] cut in
   *  half, [1, 1, 1, 1] a piece over each plate (null: it goes) */
  plan(pieces: number[] | null): Promise<void>;
  /** the knife moves along above the bar and each line between two squares lights as it passes: where a tap can cut */
  showLines(): Promise<void>;
  /** these pieces light up and the others don't (null: none); `other`: pieces of the bar laid under */
  light(pieces: number[] | null, other?: boolean): void;
  /** these groups of the bar's squares are lit, all at once, every other group in a second colour, so each
   *  group can be told from the next (null: none). Never one after another by itself: a count is said, and a
   *  script lights one more group at each number (rule 42) */
  squares(groups: number[][] | null): void;
  /** a level line across the standing pieces at the top of the tallest, so a shorter piece shows a gap under
   *  it, with a tick or a cross at its end (null: gone). `other`: across the pieces of the bar laid under, at
   *  the height of a fair piece of it, so each of them stops short of the line or stands over it (a measure:
   *  it has no tick or cross) */
  level(mark: 'yes' | 'no' | null, other?: boolean): Promise<void>;
}

// (the buddy's pieces are 1, 1, 3 and 3 squares. They were 1, 1, 2 and 4, and the 2-square piece really is one
  // fourth of an 8-square bar: it stood beside the child's own fourths, the same height, while the narrator said
  // none of the buddy's pieces was a fourth)
const BAR = 8, FRIENDS = 4, BUDDY_CUTS = [1, 2, 5], LAST = 6, LAST_FRIENDS = 3, NEXT_DAY = 12;
/** the words a run of the lesson can say, all of them */
export const SHARE_LINES = ['intro', 'plates', 'cut', 'try.you', 'try.again', 'try.together', 'try.last', 'fair', 'fair.again', 'unfair', 'unfair.again', 'again', 'together', 'half', 'half.yes',
  'eight.half.no', 'eight.quarter', 'eight.quarter.no', 'twelve.half.no', 'twelve.quarter', 'twelve.quarter.no',
  'name', 'name.why', 'try.buddy', 'buddy.ask', 'try.test', 'buddy.yes', 'buddy.no', 'buddy.why', 'more', 'which', 'try.pal', 'eighth.you', 'eighth.pal', 'eighth.same', 'eighth.why',
  'last', 'hint', 'hint.again', 'call', 'try.name', 'call.squares', 'call.half', 'call.why', 'call.yes', 'try.give', 'two.have', 'two.ask', 'try.six', 'six.show', 'try.two', 'try.two.together', 'two.yes', 'two.one', 'two.six', 'two.top',
  'own.ask', 'own.yes', 'own.no', 'eat', 'fair.together', 'quarter.yes', 'check', 'check.call', 'check.call.yes', 'check.call.no'].map(k => `ep.share.${k}`);

/** What this child has already been told in full: said again, it is said shorter. */
type Told = { unfair: boolean; hint?: boolean; fair?: boolean };

/** Which bar's worked answer: the lines carry that bar's own numbers. */
type Key = 'eight' | 'twelve';

/** The second of its line each picture comes at, read off the clip's own word times (Whisper, word by word): a
 *  line that is recorded again needs its seconds read again. Each is the moment the words in its comment begin. */
const AT = {
  // "Here is a plate" 0.0 / "Sharing is only fair if" 2.6 / "gets a piece the same size" 4.7 (the clip is 6.0 s long)
  plates: [0.2, 2.6, 4.7],
  // (the pretend pieces stay through "You get to cut the bar for them" and go just before) "Tap between two
  // squares" 1.9 / just before "Each cut" 5.1 / "cut makes one more piece" 5.4 / just before "and we stop" 7.1 /
  // "when there are 4 pieces" 7.7 (8.8 s). They went at 0: the even pieces and their tick were up for under a second
  cut: [1.5, 1.9, 4.5, 5.4, 6.9, 7.9],
  // "The smallest piece" 3.9 / "than the biggest" 5.8 / "So one friend would get less" 7.3 (11.7 s)
  unfair: [4.2, 5.9, 7.5],
  // "are all the same size" 0.7 (6.1 s and 6.3 s)
  fair: [0.7], fairTogether: [0.7],
  // "The pieces go back together" 0.0 (7.4 s)
  again: [0.1],
  // (the pieces go back) / "so let's do it together in two steps" 4.1 / "First 2 pieces the same size" 6.9 /
  // "then each of those into 2" 9.3 (10.9 s)
  together: [0.1, 4.6, 7.2, 9.8],
  // "Both halves" 0.0 (6.2 s)
  halfYes: [0.2],
  // "Each half" 3.2 / "is 4 squares long" 3.8 / just before "Then all 4 pieces" 8.0 / "pieces will be the same
  // size" 8.9 (10.3 s); on the bar of 12: 2.8 / 3.4 / 8.0 / 8.7 (10.1 s)
  quarter: { eight: [3.2, 4.0, 7.8, 8.8], twelve: [2.8, 3.6, 7.7, 8.6] },
  // "These 4 pieces" 0.0, the "4" at 0.7 / "Each one is one of 4 equal pieces" 4.9 / "one fourth" 7.7 (10.2 s)
  name: [0.6, 5.0, 7.6],
  // "The 4 on the bottom" 0.0, the "4" at 0.4 / "The 1 on top" 5.1, the "1" at 5.3 (7.5 s)
  nameWhy: [0.4, 5.2],
  // "The pieces go back together" 0.0 / "2 and 2 and 2 make 6": each "2", at 4.0, 4.5 and 4.8 (10.9 s)
  hint: [0.1, 4.0, 4.45, 4.8],
  // the second hint: "The pieces go back together" / each "2" of "2 and 2 and 2 make 6"
  hintAgain: [0.1, 2.6, 3.5, 3.8],
  // "eats its third" 1.2 (8.7 s)
  eat: [1.2],
  // the second unfair cut's shorter line: "The smallest piece" / "than the biggest" / "So one friend would still get less"
  unfairAgain: [2.0, 3.2, 5.0],
  // "One fourth of this bar is 2 squares" / "like each of your pieces" / "1," / "1," / "3" / "and 3"
  buddy: { yes: [4.5, 6.7, 9.6, 10.2, 10.5, 11.0], no: [2.3, 4.1, 7.5, 8.2, 8.7, 9.1] },
  // "here it means the same bar" / "was shared by more friends" / "so each piece had to be smaller"
  eighthWhy: [3.0, 4.0, 5.8],
  // "This bar was cut into 3 equal pieces" / "so each piece is one third"
  callWhy: [5.5, 8.9],
  // "2 pieces on your plate" / "each one is one third of the bar" / "1 of the 3 equal pieces"
  twoHave: [1.0, 2.7, 9.2],
  // "Yours was cut into 3"
  twoSix: [5.1],
  // "counts the pieces you have" / "You have 2 thirds" / "so the top number is 2"
  twoTop: [1.9, 3.7, 5.0],

  // Rule 45: a movement begins while the narrator is saying the line about it, and the two end together. Each
  // is [the second of the line the move begins at, the seconds it may take]: the kit goes slower to fill them,
  // never quicker than usual.
  // "Pebble made this chocolate bar" 2.8: the bar comes in (8.7 s)
  intro: [2.8],
  // the pieces go onto the plates and stand up. "Each piece goes onto a plate" 1.6, one piece about every second,
  // and their lengths come at "so we can compare them" 5.8 (7.1 s) / "The pieces go onto the plates" 1.8 (4.4 s) /
  // "They go onto the plates" 2.9 (5.0 s) / "The pieces go onto the 3 plates" 2.0 (4.6 s)
  serve: { you: [1.6, 4.6], again: [1.8, 2.6], together: [2.9, 2.1], last: [2.0, 2.6] },
  // "are all the same size" 1.0: the level line (3.9 s)
  fairAgain: [1.0],
  // a wrong cut closes up as the narrator turns from its two pieces to where the middle is: "4 and 4 make 8"
  // 4.9 / "Each half has 4 squares" 4.6 / "6 and 6 make 12" 4.9 / "Each half has 6 squares" 4.8
  no: { eight: { half: 4.9, quarter: 4.6 }, twelve: { half: 4.9, quarter: 4.8 } },
  // "Your buddy cuts a bar the same size" 2.0, and the third cut is made as "into 4 pieces" ends, 4.9 (9.0 s)
  tryBuddy: [2.0, 2.9],
  // in the breath before "They stand up next to your fair ones" 2.7: the move takes 2.1 s and the clip is 4.4 s
  tryTest: [2.3, 2.1],
  // "Pebble cuts a bar" 2.9, cut under "into 8 equal pieces" 4.6 to 6.1, and one piece laid under a fourth at
  // "and one of them stands next to your fourths" 6.2 (8.5 s)
  tryPal: [2.9, 5.6],
  // (the old bar leaves at 0 and the new one comes straight after it, under "a new bar with 6 squares") "This
  // time 3 friends share it" 2.8: the plates (9.6 s)
  last: [2.8],
  // "see what your answer looks like" 0.2 (3.2 s: the move takes 3.1 to 3.5 s, so the piece lands just after the words)
  tryName: [0.2, 3.0],
  // "it goes on top of your piece" 4.6, landing at "on your plate" 6.1 (6.8 s)
  tryGive: [4.6, 2.1],
  // "Here is a bar just like it" 3.2, cut under "cut into 6 equal pieces" 4.9, and 2 pieces stood beside the
  // plate under "and 2 of those pieces stand next to your plate" 6.4 (10.1 s)
  trySix: [3.2, 6.9],
  // "Each piece gets its name" 1.2 / 2.4: the names come onto the thirds
  tryTwo: { right: 1.2, together: 2.4 },
  // the next day: the bar at 0, the plates at "4 friends will share it" 2.6 (7.7 s)
  check: [2.5],
};
/** A stop kept on purpose (rule 45): pieces that have just lined up side by side are the moment of comparing, so
 *  they stand this long, ms, before the narrator says what they showed. */
const REST = 700;
type Serve = 'you' | 'again' | 'together' | 'last';
/** The pieces go onto the plates and stand up while the narrator says they do: they start at the words that say
 *  so and the last one is standing, with its length on it, as the line ends. Then they rest. */
async function served(t: Teller, w: ShareWorld, which: Serve) {
  const [from, takes] = AT.serve[which];
  await t.sayWith(`ep.share.try.${which}`, [[from, () => w.serve(takes)]]);
  await t.wait(REST);
}
/** the squares from a up to b, each on its own, so each can be told from the next */
const each = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => [a + i]);
/** the squares of each piece, piece by piece */
const groups = (pieces: number[]) => { let at = 0; return pieces.map(n => { const g = Array.from({ length: n }, (_, i) => at + i); at += n; return g; }); };

/** The child cuts the bar; what they made is served and lined up, and the bar says if it's fair. */
async function tryCut(t: Teller, w: ShareWorld, squares: number, friends: number, line: Serve, told: Told): Promise<number[]> {
  let lines: number[] = [];
  await t.hands(`Tap the bar to cut it into ${friends} pieces`, async () => { lines = await w.cut(friends); }, () => w.finish());
  await served(t, w, line);
  const pieces = piecesOf(squares, lines);
  // (a fair cut: a level line comes across the tops of the pieces as "all the same size" is said, and every piece reaches it)
  // (why equal pieces are fair is said whole once: a child who has heard it on the first bar hears the last
  // bar's fair cut with its own numbers and the reason, shorter. Rule 44)
  if (fair(pieces)) {
    t.buddy('cheer'); t.pal('happy');
    if (told.fair) await t.sayWith('ep.share.fair.again', [[AT.fairAgain[0], () => w.level('yes')]], pieces[0], friends);
    else await t.sayWith('ep.share.fair', [[AT.fair[0], () => w.level('yes')]], pieces[0]);
    told.fair = true;
  }
  // (an unfair cut is told with its own numbers: the smallest and the biggest piece, in squares. Each lights as
  // it is named, and then the level line comes across at the top of the biggest: the gap over a smaller piece
  // is the chocolate that friend doesn't get)
  else {
    const lo = Math.min(...pieces), hi = Math.max(...pieces), which = (n: number) => pieces.flatMap((p, i) => p === n ? [i] : []);
    t.buddy('shrug'); t.pal('sad');
    // (the whole line once; after a later unfair cut the same numbers and the same reason, said shorter)
    const at = told.unfair ? AT.unfairAgain : AT.unfair;
    await t.sayWith(told.unfair ? 'ep.share.unfair.again' : 'ep.share.unfair', [[at[0], () => w.light(which(lo))], [at[1], () => w.light(which(hi))], [at[2], () => { w.light(null); return w.level('no'); }]], lo, hi);
    told.unfair = true;
  }
  return pieces;
}
/** One cut, on a line the script can judge: a wrong one is cut, its pieces shown, and undone. */
async function cutAt(t: Teller, w: ShareWorld, words: string, ok: (g: number) => boolean, hint: number, no: string, at: number, sizes?: (g: number) => [number, number]) {
  for (;;) {
    let g = hint;
    await t.hands(words, async () => { g = await w.tapCut(hint); }, () => w.finish());
    if (ok(g)) return g;
    t.buddy('shrug');
    // (`sizes`: the two pieces that cut made, said in the line. The cut stays open while its pieces are talked
    // about and closes up, `at` seconds in, as the narrator turns to where the middle is: the bar, or the half,
    // is whole again under the words about its squares, and ready for the next tap as the line ends. Rule 45)
    await t.sayWith(no, [[at, () => w.uncut(g)]], ...(sizes?.(g) ?? []));
  }
}
/** Two unfair cuts: say so kindly, then halve and halve again together, each step with its reason. */
async function together(t: Teller, w: ShareWorld, squares: number, k: Key, told: Told) {
  // (the pieces go back as it starts; then the two steps on a pretend bar over the plates: whole, cut in half,
  // and each half in half, so a piece lies over every plate. It has no squares on it, so it shows the way and
  // not where the middle of the real bar is)
  await t.sayWith('ep.share.together', [[AT.together[0], () => w.join()], [AT.together[1], () => w.plan([4])], [AT.together[2], () => w.plan([2, 2])], [AT.together[3], () => w.plan([1, 1, 1, 1])]]);
  const mid = middle(0, squares)!, half = squares / 2;
  await t.say('ep.share.half');
  await cutAt(t, w, 'Tap the middle of the bar', g => g === mid, mid, `ep.share.${k}.half.no`, AT.no[k].half, g => [g, squares - g]);
  t.buddy('nod');
  // (the two halves light, each in its own colour, with its squares on it)
  await t.sayWith('ep.share.half.yes', [[AT.halfYes[0], () => w.squares([each(0, mid).flat(), each(mid, squares).flat()])]], half);
  // (the squares of one half light, each one told from the next, so they can be counted; then the other half's
  // too. The middle of a half is not marked: finding it is the child's job, rule 41. Then the pretend bar over
  // the plates: the two halves, and each one cut in half, a piece for every plate)
  const q = AT.quarter[k];
  await t.sayWith(`ep.share.${k}.quarter`, [[q[0], () => w.squares(each(0, mid))], [q[1], () => w.squares(each(0, squares))], [q[2], () => w.plan([2, 2])], [q[3], () => w.plan([1, 1, 1, 1])]]);
  const quarters = [middle(0, mid)!, middle(mid, squares)!];
  const first = await cutAt(t, w, 'Tap the middle of one half', g => quarters.includes(g), quarters[0], `ep.share.${k}.quarter.no`, AT.no[k].quarter);
  const other = quarters.find(q => q !== first)!;
  t.buddy('nod');
  await t.say('ep.share.quarter.yes', squares / FRIENDS);
  await cutAt(t, w, 'Now tap the middle of the other half', g => g === other, other, `ep.share.${k}.quarter.no`, AT.no[k].quarter);
  await served(t, w, 'together');
  t.buddy('cheer'); t.pal('happy');
  await t.sayWith('ep.share.fair.together', [[AT.fairTogether[0], () => w.level('yes')]], squares / FRIENDS);
  told.fair = true;
}
/** A bar shared by four: two tries of the child's own, then together. Resolves with the first try's pieces. */
async function shareFour(t: Teller, w: ShareWorld, squares: number, k: Key, told: Told): Promise<number[]> {
  let first: number[] = [];
  for (let miss = 0; ; miss++) {
    const pieces = await tryCut(t, w, squares, FRIENDS, miss ? 'again' : 'you', told);
    if (!miss) first = pieces;
    if (fair(pieces)) break;
    if (miss >= 1) { await together(t, w, squares, k, told); break; }
    // (the pieces go back together as the narrator says they do)
    await t.sayWith('ep.share.again', [[AT.again[0], () => w.join()]], FRIENDS);
  }
  return first;
}

async function play(t: Teller, w: ShareWorld): Promise<Notes> {
  // the job: four friends, one bar, and sharing has to be fair (a moment first, so the picture has settled)
  t.beat(0);
  await t.wait(700);
  // (the bar comes in as the narrator says who made it. It came first, in silence, and then the line. Rule 45)
  await t.sayWith('ep.share.intro', [[AT.intro[0], () => w.barIn(BAR)]]);
  // (the plates come as they are named. Then what "fair" means, on them: pretend pieces, see-through, of four
  // different sizes with a cross, which even out to the same size and get a tick. They are plain, with no squares
  // on them, so they show what fair is and not where to cut)
  await t.sayWith('ep.share.plates', [[AT.plates[0], () => w.plates(FRIENDS)], [AT.plates[1], () => w.pretend([2.6, 1, 2.4, 2], 'no')], [AT.plates[2], () => w.pretend([2, 2, 2, 2], 'yes')]]);

  // the child cuts it, wherever they like, and what they cut is served
  t.beat(1);
  // (where a tap can cut: the knife moves along above the bar and every line between two squares lights. Then
  // "each cut makes one more piece" on a pretend bar over the plates: one cut, 2 pieces; two, 3; three, 4, a piece
  // over every plate, which is why we stop at 4)
  await t.sayWith('ep.share.cut', [[AT.cut[0], () => w.pretend(null)], [AT.cut[1], () => w.showLines()], [AT.cut[2], () => w.plan([4])], [AT.cut[3], () => w.plan([1, 3])], [AT.cut[4], () => w.plan([1, 1, 2])], [AT.cut[5], () => w.plan([1, 1, 1, 1])]]);
  const told: Told = { unfair: false };
  const first = await shareFour(t, w, BAR, 'eight', told);

  // only now does a piece get a name, from what the hands just made
  t.beat(2);
  // (the 4 pieces light as "4 pieces" is said, each in a colour its neighbour doesn't have; then one of them
  // alone; and the name comes onto every piece as it is said, not before)
  const fourths = groups(piecesOf(BAR, SHARE_BARS.first));
  await t.sayWith('ep.share.name', [[AT.name[0], () => w.squares(fourths)], [AT.name[1], () => w.light([0])], [AT.name[2], () => { w.light(null); w.label('1/4'); }]]);
  // (the 4 on the bottom: all 4 pieces of the bar light. The 1 on top: one piece alone stays lit)
  await t.sayWith('ep.share.name.why', [[AT.nameWhy[0], () => w.squares(fourths)], [AT.nameWhy[1], () => w.light([0])]]);
  await t.go('Next');
  w.light(null);

  // the buddy's idea: 4 pieces, so they must be fourths
  t.beat(3);
  t.thought('buddy', '4 pieces, so 4 fourths!'); t.buddy('point');
  // (the buddy's bar comes in and the buddy's knife cuts it while the narrator says so. Then a stop kept on
  // purpose: the question waits for the child's answer)
  await t.sayWith('ep.share.try.buddy', [[AT.tryBuddy[0], () => w.otherBar(BUDDY_CUTS, AT.tryBuddy[1])]]);
  const yes = await t.pick('Is each of these pieces one fourth?', [{ id: 'yes', text: 'Yes' }, { id: 'no', text: 'No' }], 'ep.share.buddy.ask');
  // (the buddy's pieces stand up as the narrator says they do, and rest beside the child's fair ones before
  // anything is said about them)
  await t.sayWith('ep.share.try.test', [[AT.tryTest[0], () => w.testOther(AT.tryTest[1])]]);
  await t.wait(REST);
  t.thought('buddy', null); t.buddy('oops');
  // (the child's own pieces light as "one fourth of this bar is 2 squares" is said; at "like each of your
  // pieces" a level line comes across the buddy's pieces at that height, 2 squares; then each of the buddy's
  // pieces lights as its number is said, rule 42: two stop short of the line and two stand over it)
  const by = AT.buddy[yes === 'yes' ? 'yes' : 'no'], theirs = [0, 1, 2, 3];
  await t.sayWith(yes === 'yes' ? 'ep.share.buddy.yes' : 'ep.share.buddy.no', [[by[0], () => w.squares(fourths)], [by[1], () => w.level('no', true)],
    ...theirs.map((p): Cue => [by[p + 2], () => w.light(theirs.slice(0, p + 1), true)])]);
  // (and what that means for the buddy's idea: 4 pieces aren't fourths just for being 4)
  await t.say('ep.share.buddy.why');

  // Pebble's idea: 8 is more than 4, so 1/8 must be more
  t.beat(4);
  // (the buddy's bar leaves as the narrator turns to Pebble: it left in silence before the line)
  await t.sayWith('ep.share.more', [[0, () => w.clearOther()]]);
  t.thought('pal', '8 is more than 4, so 1/8 is more!'); t.pal('hop');
  const more = await t.pick('Which piece has more chocolate?', [{ id: '4', text: '1/4' }, { id: '8', text: '1/8' }, { id: 'same', text: 'The same' }], 'ep.share.which');
  // (Pebble's bar comes in, is cut into 8 and one piece is laid under a fourth, each as the narrator says it;
  // then the two rest side by side before the narrator says which is more)
  await t.sayWith('ep.share.try.pal', [[AT.tryPal[0], () => w.besides(8, undefined, AT.tryPal[1])]]);
  await t.wait(REST);
  t.thought('pal', null);
  if (more === '4') { t.buddy('clap'); t.pal('happy'); } else t.pal('sad');
  await t.say(more === '4' ? 'ep.share.eighth.you' : more === '8' ? 'ep.share.eighth.pal' : 'ep.share.eighth.same');
  w.label('1/4', '1/8');
  // (the same bar, on the child's own pieces: its 4 pieces light, each in a colour its neighbour doesn't have;
  // then its 8 squares do, which is the bar shared by 8; then Pebble's eighth alone, the smaller piece)
  await t.sayWith('ep.share.eighth.why', [[AT.eighthWhy[0], () => w.squares(fourths)], [AT.eighthWhy[1], () => w.squares(each(0, BAR))], [AT.eighthWhy[2], () => w.light([0], true)]]);
  await t.go('Next');
  w.label(null);

  // on their own: a new bar, three friends, no help but a hint, and the child names the piece
  t.beat(5);
  // (the old bar, Pebble's eighth and the plates leave as the narrator begins, and the new bar comes in straight
  // after them, under "a new bar with 6 squares"; the 3 plates come, each with whose it is, at "This time 3
  // friends share it". They wait for the bar: every picture of a line comes at once when its clip can't play.
  // All of it came and went in silence, 3.5 s, before the line. Rule 45)
  let bar: Promise<unknown> = Promise.resolve();
  await t.sayWith('ep.share.last', [[0, () => (bar = (async () => { await w.barOut(); await w.barIn(LAST); })())],
    [AT.last[0], async () => { await bar; await w.plates(LAST_FRIENDS, ['Your buddy', 'Pebble', 'You']); }]]);
  // (a miss here gets the way to find the cuts straight away. It used to get a bare "try again" first, and a
  // child who had already needed the first bar done together spent another 45 seconds failing before any help)
  for (;;) {
    const pieces = await tryCut(t, w, LAST, LAST_FRIENDS, 'last', told);
    if (fair(pieces)) break;
    // (the pieces go back as the narrator says so; then 2 more squares light at each "2" of "2 and 2 and 2", by
    // the clip's own clock: rule 42)
    // (the hint whole once; after another miss, the way again without its reason)
    const twos = groups([2, 2, 2]), h = told.hint ? AT.hintAgain : AT.hint;
    await t.sayWith(told.hint ? 'ep.share.hint.again' : 'ep.share.hint', [[h[0], () => w.join()], ...twos.map((_, i): Cue => [h[i + 1], () => w.squares(twos.slice(0, i + 1))])]);
    told.hint = true;
  }
  t.beat(6);
  const thirds = groups(piecesOf(LAST, SHARE_BARS.last));
  const call = await t.pick('What is each piece called?', [{ id: '3', text: '1/3' }, { id: '6', text: '1/6' }, { id: '2', text: '1/2' }], 'ep.share.call');
  if (call !== '3') {
    // (the piece the child named is cut and laid under one of the child's own while the narrator says so, and
    // gets its name as it lands; the child's pieces keep their squares on them until they are named. Then the
    // two rest side by side)
    await t.sayWith('ep.share.try.name', [[AT.tryName[0], async () => { await w.besides(Number(call), undefined, AT.tryName[1]); w.label(null, `1/${call}`); }]], Number(call));
    await t.wait(REST);
    t.pal('sad');
    await t.say(call === '6' ? 'ep.share.call.squares' : 'ep.share.call.half');
    // (what the bottom number counts: the reason the child who was right hears, said to this child too. The 3
    // pieces light, each told from the next, as "cut into 3 equal pieces" is said, and "1/3" comes onto them at
    // the words "one third", not before, rule 43)
    await t.sayWith('ep.share.call.why', [[AT.callWhy[0], () => w.squares(thirds)], [AT.callWhy[1], () => { w.light(null); w.label('1/3', `1/${call}`); }]]);
  } else { t.buddy('clap'); t.pal('happy'); w.label('1/3'); await t.say('ep.share.call.yes'); }
  await t.go('Next');
  w.label(null);

  // the rest of grade 3's idea, on the same plates: 2 pieces of one third each is two thirds (3.NF.A.1)
  t.beat(7);
  // (the piece that was laid under for a wrong name leaves as the narrator begins. Pebble's piece lifts off at
  // "it goes on top of your piece" and lands on the child's plate as the line ends. Rule 45)
  await t.sayWith('ep.share.try.give', [...(call !== '3' ? [[0, () => w.clearOther()] as Cue] : []),
    [AT.tryGive[0], () => { t.pal('happy'); return w.give(1, 2, AT.tryGive[1]); }]]);
  // (what's on the plate and what the top number means, said before the question, so it can be answered from what was taught)
  // (the 2 pieces on the child's plate light together, then each in its own colour as "each one is one third"
  // is said, then one alone for "1 of the 3 equal pieces". The lights go before the question, and no "2/3" is
  // shown: rule 41)
  await t.sayWith('ep.share.two.have', [[AT.twoHave[0], () => w.light([1, 2])], [AT.twoHave[1], () => w.squares([thirds[2], thirds[1]])], [AT.twoHave[2], () => w.light([2])]]);
  w.light(null);
  const two = await t.pick('How much of the bar is on your plate?', [{ id: '1', text: '1/3' }, { id: '2', text: '2/3' }, { id: '6', text: '2/6' }], 'ep.share.two.ask');
  // (2/6 is acted out first: 2 pieces of the same bar cut into 6 stand beside the child's stack)
  if (two === '6') {
    // (the bar like it comes in, is cut into 6, and 2 of its pieces are stood beside the child's plate, each as
    // the narrator says it, and get their name as they land; then the two stacks rest side by side)
    await t.sayWith('ep.share.try.six', [[AT.trySix[0], async () => { await w.besides(6, 2, AT.trySix[1]); w.label(null, '2/6'); }]]);
    await t.wait(REST);
    t.buddy('think');
    await t.say('ep.share.six.show');
  }
  // ("let's check" for a right answer; a wrong one has just failed, so it's worked out together, said kindly)
  // (the sixths leave as this line begins, and each third gets its name at "Each piece gets its name": the
  // names wait for the sixths to be gone, so a "1/3" never stands next to them. The names came after the line,
  // and then 1.2 s of nothing. Rule 45)
  let gone: Promise<unknown> = Promise.resolve();
  await t.sayWith(two === '2' ? 'ep.share.try.two' : 'ep.share.try.two.together', [...(two === '6' ? [[0, () => (gone = w.clearOther())] as Cue] : []),
    [AT.tryTwo[two === '2' ? 'right' : 'together'], async () => { await gone; w.label('1/3'); }]]);
  if (two === '2') { w.total('2/3'); t.buddy('clap'); t.pal('happy'); await t.say('ep.share.two.yes'); }
  // (a wrong answer: first what was wrong with it, then what the top number counts. The 3 pieces the bar was cut
  // into light as "cut into 3" is said; then the 2 on the child's plate as "the pieces you have", each in its
  // own colour at "2 thirds", and "2/3" comes beside them as "the top number is 2" is said, not before, rule 43)
  else {
    t.buddy('think');
    if (two === '1') await t.say('ep.share.two.one');
    else await t.sayWith('ep.share.two.six', [[AT.twoSix[0], () => w.squares(thirds)]]);
    await t.sayWith('ep.share.two.top', [[AT.twoTop[0], () => w.light([1, 2])], [AT.twoTop[1], () => w.squares([thirds[2], thirds[1]])], [AT.twoTop[2], () => w.total('2/3')]]);
  }
  await t.go('Next');
  w.light(null);
  w.label(null); w.total(null);

  // a child who hasn't named a piece right yet gets one more to name on their own, before the end (rule 12a):
  // the buddy's piece, which they have just seen named
  t.beat(8);
  if (call !== '3' && two !== '2') {
    const own = await t.pick("How much of the bar is your buddy's piece?", [{ id: '13', text: '1/3' }, { id: '23', text: '2/3' }, { id: '16', text: '1/6' }], 'ep.share.own.ask');
    if (own === '13') { t.buddy('clap'); t.pal('happy'); }
    await t.say(own === '13' ? 'ep.share.own.yes' : 'ep.share.own.no');
  }
  // it ends with the snack: the buddy eats its third, and the child's two thirds are still on their plate
  // (the buddy eats as the narrator says it does)
  await t.sayWith('ep.share.eat', [[AT.eat[0], () => w.eat()]]);
  t.buddy('jump');
  await t.wait(600);
  return { fair: fair(first) ? 1 : 0, small: Math.min(...first), big: Math.max(...first) };
}

async function check(t: Teller, w: ShareWorld, notes: Notes | null) {
  await t.wait(700);
  if (notes?.small != null) t.myBet(notes.fair ? 'Your first cut yesterday was fair' : `Your first cut yesterday: ${notes.small} to ${notes.big} squares`);
  // (the bar comes in as the narrator names it, and the plates at "4 friends will share it", once the bar is in.
  // Rule 45)
  let bar: Promise<unknown> = Promise.resolve();
  await t.sayWith('ep.share.check', [[0, () => (bar = w.barIn(NEXT_DAY))], [AT.check[0], async () => { await bar; await w.plates(FRIENDS); }]]);
  // (yesterday's cut is a reminder for the question, not for today's answer: it goes before the child cuts,
  // so it never stands beside what's said about today's pieces)
  t.myBet(null);
  await shareFour(t, w, NEXT_DAY, 'twelve', { unfair: false });
  const call = await t.pick('What is each piece called?', [{ id: '4', text: '1/4' }, { id: '12', text: '1/12' }, { id: '3', text: '1/3' }], 'ep.share.check.call');
  w.label('1/4');
  await t.say(call === '4' ? 'ep.share.check.call.yes' : 'ep.share.check.call.no');
  await t.go('Next');
  w.label(null);
  // (a stop kept on purpose: the bar leaves after the last line, and nothing is left to say over it)
  await w.barOut();
}

export const SHARE_LESSON: BeatLesson<ShareWorld> = {
  id: 'frac-one-piece', title: 'Fair Shares', blurb: 'One of 4 equal pieces is 1/4. Cut the same bar into more pieces and each one is smaller.', set: 'workshop', star: 'pebbletort', color: '#b8743a',
  art: 'learn/frac/card-choc.webp', voice: 'share', beats: 9, keys: false,
  world: async (sc: EpisodeScene) => { const { ShareKit } = await import('../../three/shareKit'); return new ShareKit(sc); },
  play, check,
  card: n => [n.fair ? 'Your first cut was fair: every piece the same.' : `Your first cut gave pieces from ${n.small ?? '?'} to ${n.big ?? '?'} squares long.`,
    'One of 4 equal pieces is one fourth, 1/4. Cut the same bar into more pieces, and each piece is smaller.',
    '2 pieces that are each one third make two thirds, 2/3.'],
};

/** (for the tests: the fair cuts of each bar in the lesson) */
export const SHARE_BARS = { first: fairCuts(BAR, FRIENDS)!, last: fairCuts(LAST, LAST_FRIENDS)!, nextDay: fairCuts(NEXT_DAY, FRIENDS)! };
