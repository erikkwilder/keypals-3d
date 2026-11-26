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
  /** the pieces go one onto each plate, then line up side by side from the same start, their lengths on them */
  serve(): Promise<void>;
  /** the pieces go back together into one whole bar */
  join(): Promise<void>;
  /** the name stands on every piece of the bar, and on what's laid under it (null: gone) */
  label(mine: string | null, other?: string): void;
  /** someone else's bar, the same size, cut on these lines by their knife, under the child's pieces */
  otherBar(lines: number[]): Promise<void>;
  /** that bar's pieces line up side by side too, with their lengths on them */
  testOther(): Promise<void>;
  /** one piece of the same bar cut into `b` equal pieces is laid right under the child's first piece
   *  (`k` pieces: they stand one on top of the other, and the child's stack says how many squares it has too) */
  besides(b: number, k?: number): Promise<void>;
  /** whatever was laid under the child's pieces goes away */
  clearOther(): Promise<void>;
  /** the piece on plate `from` goes onto plate `to`, standing on top of the piece there */
  give(from: number, to: number): Promise<void>;
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
   *  it, with a tick or a cross at its end (null: gone) */
  level(mark: 'yes' | 'no' | null): Promise<void>;
}

// (the buddy's pieces are 1, 1, 3 and 3 squares. They were 1, 1, 2 and 4, and the 2-square piece really is one
  // fourth of an 8-square bar: it stood beside the child's own fourths, the same height, while the narrator said
  // none of the buddy's pieces was a fourth)
const BAR = 8, FRIENDS = 4, BUDDY_CUTS = [1, 2, 5], LAST = 6, LAST_FRIENDS = 3, NEXT_DAY = 12;
/** the words a run of the lesson can say, all of them */
export const SHARE_LINES = ['intro', 'plates', 'cut', 'try.you', 'try.again', 'try.together', 'try.last', 'fair', 'unfair', 'again', 'together', 'half', 'half.yes',
  'eight.half.no', 'eight.quarter', 'eight.quarter.no', 'twelve.half.no', 'twelve.quarter', 'twelve.quarter.no',
  'name', 'name.why', 'try.buddy', 'buddy.ask', 'try.test', 'buddy.yes', 'buddy.no', 'buddy.why', 'more', 'which', 'try.pal', 'eighth.you', 'eighth.pal', 'eighth.same', 'eighth.why',
  'last', 'hint', 'call', 'try.name', 'call.squares', 'call.half', 'call.why', 'call.yes', 'try.give', 'two.have', 'two.ask', 'try.six', 'six.show', 'try.two', 'try.two.together', 'two.yes', 'two.one', 'two.six', 'two.top',
  'own.ask', 'own.yes', 'own.no', 'eat', 'fair.together', 'quarter.yes', 'check', 'check.call', 'check.call.yes', 'check.call.no'].map(k => `ep.share.${k}`);

/** Which bar's worked answer: the lines carry that bar's own numbers. */
type Key = 'eight' | 'twelve';

/** The second of its line each picture comes at, read off the clip's own word times (Whisper, word by word): a
 *  line that is recorded again needs its seconds read again. Each is the moment the words in its comment begin. */
const AT = {
  // "Here is a plate" 0.0 / "Sharing is only fair if" 2.6 / "gets a piece the same size" 4.7 (the clip is 6.0 s long)
  plates: [0.2, 2.6, 4.7],
  // (the pretend pieces go) / "Tap between two squares" 1.9 / just before "Each cut" 5.1 / "cut makes one more
  // piece" 5.4 / just before "and we stop" 7.1 / "when there are 4 pieces" 7.7 (8.8 s)
  cut: [0, 1.9, 4.5, 5.4, 6.9, 7.9],
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
  // "eats its third" 1.2 (8.7 s)
  eat: [1.2],
};
/** the squares from a up to b, each on its own, so each can be told from the next */
const each = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => [a + i]);
/** the squares of each piece, piece by piece */
const groups = (pieces: number[]) => { let at = 0; return pieces.map(n => { const g = Array.from({ length: n }, (_, i) => at + i); at += n; return g; }); };

/** The child cuts the bar; what they made is served and lined up, and the bar says if it's fair. */
async function tryCut(t: Teller, w: ShareWorld, squares: number, friends: number, line: string): Promise<number[]> {
  let lines: number[] = [];
  await t.hands(`Tap the bar to cut it into ${friends} pieces`, async () => { lines = await w.cut(friends); }, () => w.finish());
  await t.say(line);
  await w.serve();
  const pieces = piecesOf(squares, lines);
  // (a fair cut: a level line comes across the tops of the pieces as "all the same size" is said, and every piece reaches it)
  if (fair(pieces)) { t.buddy('cheer'); t.pal('happy'); await t.sayWith('ep.share.fair', [[AT.fair[0], () => w.level('yes')]], pieces[0]); }
  // (an unfair cut is told with its own numbers: the smallest and the biggest piece, in squares. Each lights as
  // it is named, and then the level line comes across at the top of the biggest: the gap over a smaller piece
  // is the chocolate that friend doesn't get)
  else {
    const lo = Math.min(...pieces), hi = Math.max(...pieces), which = (n: number) => pieces.flatMap((p, i) => p === n ? [i] : []);
    t.buddy('shrug'); t.pal('sad');
    await t.sayWith('ep.share.unfair', [[AT.unfair[0], () => w.light(which(lo))], [AT.unfair[1], () => w.light(which(hi))], [AT.unfair[2], () => { w.light(null); return w.level('no'); }]], lo, hi);
  }
  return pieces;
}
/** One cut, on a line the script can judge: a wrong one is cut, its pieces shown, and undone. */
async function cutAt(t: Teller, w: ShareWorld, words: string, ok: (g: number) => boolean, hint: number, no: string, sizes?: (g: number) => [number, number]) {
  for (;;) {
    let g = hint;
    await t.hands(words, async () => { g = await w.tapCut(hint); }, () => w.finish());
    if (ok(g)) return g;
    t.buddy('shrug');
    // (`sizes`: the two pieces that cut made, said in the line)
    await t.say(no, ...(sizes?.(g) ?? []));
    await w.uncut(g);
  }
}
/** Two unfair cuts: say so kindly, then halve and halve again together, each step with its reason. */
async function together(t: Teller, w: ShareWorld, squares: number, k: Key) {
  // (the pieces go back as it starts; then the two steps on a pretend bar over the plates: whole, cut in half,
  // and each half in half, so a piece lies over every plate. It has no squares on it, so it shows the way and
  // not where the middle of the real bar is)
  await t.sayWith('ep.share.together', [[AT.together[0], () => w.join()], [AT.together[1], () => w.plan([4])], [AT.together[2], () => w.plan([2, 2])], [AT.together[3], () => w.plan([1, 1, 1, 1])]]);
  const mid = middle(0, squares)!, half = squares / 2;
  await t.say('ep.share.half');
  await cutAt(t, w, 'Tap the middle of the bar', g => g === mid, mid, `ep.share.${k}.half.no`, g => [g, squares - g]);
  t.buddy('nod');
  // (the two halves light, each in its own colour, with its squares on it)
  await t.sayWith('ep.share.half.yes', [[AT.halfYes[0], () => w.squares([each(0, mid).flat(), each(mid, squares).flat()])]], half);
  // (the squares of one half light, each one told from the next, so they can be counted; then the other half's
  // too. The middle of a half is not marked: finding it is the child's job, rule 41. Then the pretend bar over
  // the plates: the two halves, and each one cut in half, a piece for every plate)
  const q = AT.quarter[k];
  await t.sayWith(`ep.share.${k}.quarter`, [[q[0], () => w.squares(each(0, mid))], [q[1], () => w.squares(each(0, squares))], [q[2], () => w.plan([2, 2])], [q[3], () => w.plan([1, 1, 1, 1])]]);
  const quarters = [middle(0, mid)!, middle(mid, squares)!];
  const first = await cutAt(t, w, 'Tap the middle of one half', g => quarters.includes(g), quarters[0], `ep.share.${k}.quarter.no`);
  const other = quarters.find(q => q !== first)!;
  t.buddy('nod');
  await t.say('ep.share.quarter.yes', squares / FRIENDS);
  await cutAt(t, w, 'Now tap the middle of the other half', g => g === other, other, `ep.share.${k}.quarter.no`);
  await t.say('ep.share.try.together');
  await w.serve();
  t.buddy('cheer'); t.pal('happy');
  await t.sayWith('ep.share.fair.together', [[AT.fairTogether[0], () => w.level('yes')]], squares / FRIENDS);
}
/** A bar shared by four: two tries of the child's own, then together. Resolves with the first try's pieces. */
async function shareFour(t: Teller, w: ShareWorld, squares: number, k: Key): Promise<number[]> {
  let first: number[] = [];
  for (let miss = 0; ; miss++) {
    const pieces = await tryCut(t, w, squares, FRIENDS, miss ? 'ep.share.try.again' : 'ep.share.try.you');
    if (!miss) first = pieces;
    if (fair(pieces)) break;
    if (miss >= 1) { await together(t, w, squares, k); break; }
    // (the pieces go back together as the narrator says they do)
    await t.sayWith('ep.share.again', [[AT.again[0], () => w.join()]], FRIENDS);
  }
  return first;
}

async function play(t: Teller, w: ShareWorld): Promise<Notes> {
  // the job: four friends, one bar, and sharing has to be fair (a moment first, so the picture has settled)
  t.beat(0);
  await t.wait(700);
  await w.barIn(BAR);
  await t.say('ep.share.intro');
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
  const first = await shareFour(t, w, BAR, 'eight');

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
  await t.say('ep.share.try.buddy');
  await w.otherBar(BUDDY_CUTS);
  const yes = await t.pick('Is each of these pieces one fourth?', [{ id: 'yes', text: 'Yes' }, { id: 'no', text: 'No' }], 'ep.share.buddy.ask');
  await t.say('ep.share.try.test');
  await w.testOther();
  t.thought('buddy', null); t.buddy('oops');
  await t.say(yes === 'yes' ? 'ep.share.buddy.yes' : 'ep.share.buddy.no');
  // (and what that means for the buddy's idea: 4 pieces aren't fourths just for being 4)
  await t.say('ep.share.buddy.why');
  await w.clearOther();

  // Pebble's idea: 8 is more than 4, so 1/8 must be more
  t.beat(4);
  await t.say('ep.share.more');
  t.thought('pal', '8 is more than 4, so 1/8 is more!'); t.pal('hop');
  const more = await t.pick('Which piece has more chocolate?', [{ id: '4', text: '1/4' }, { id: '8', text: '1/8' }, { id: 'same', text: 'The same' }], 'ep.share.which');
  await t.say('ep.share.try.pal');
  await w.besides(8);
  t.thought('pal', null);
  if (more === '4') { t.buddy('clap'); t.pal('happy'); } else t.pal('sad');
  await t.say(more === '4' ? 'ep.share.eighth.you' : more === '8' ? 'ep.share.eighth.pal' : 'ep.share.eighth.same');
  w.label('1/4', '1/8');
  await t.say('ep.share.eighth.why');
  await t.go('Next');
  w.label(null);
  await w.clearOther();
  await w.barOut();

  // on their own: a new bar, three friends, no help but a hint, and the child names the piece
  t.beat(5);
  await w.barIn(LAST);
  await w.plates(LAST_FRIENDS, ['Your buddy', 'Pebble', 'You']);
  await t.say('ep.share.last');
  // (a miss here gets the way to find the cuts straight away. It used to get a bare "try again" first, and a
  // child who had already needed the first bar done together spent another 45 seconds failing before any help)
  for (;;) {
    const pieces = await tryCut(t, w, LAST, LAST_FRIENDS, 'ep.share.try.last');
    if (fair(pieces)) break;
    // (the pieces go back as the narrator says so; then 2 more squares light at each "2" of "2 and 2 and 2", by
    // the clip's own clock: rule 42)
    const twos = groups([2, 2, 2]);
    await t.sayWith('ep.share.hint', [[AT.hint[0], () => w.join()], ...twos.map((_, i): Cue => [AT.hint[i + 1], () => w.squares(twos.slice(0, i + 1))])]);
  }
  t.beat(6);
  const call = await t.pick('What is each piece called?', [{ id: '3', text: '1/3' }, { id: '6', text: '1/6' }, { id: '2', text: '1/2' }], 'ep.share.call');
  if (call !== '3') {
    await t.say('ep.share.try.name', Number(call));
    await w.besides(Number(call));
    t.pal('sad');
    w.label('1/3', `1/${call}`);
    await t.say(call === '6' ? 'ep.share.call.squares' : 'ep.share.call.half');
    // (what the bottom number counts: the reason the child who was right hears, said to this child too)
    await t.say('ep.share.call.why');
  } else { t.buddy('clap'); t.pal('happy'); w.label('1/3'); await t.say('ep.share.call.yes'); }
  await t.go('Next');
  w.label(null);
  await w.clearOther();

  // the rest of grade 3's idea, on the same plates: 2 pieces of one third each is two thirds (3.NF.A.1)
  t.beat(7);
  await t.say('ep.share.try.give');
  t.pal('happy');
  await w.give(1, 2);
  // (what's on the plate and what the top number means, said before the question, so it can be answered from what was taught)
  await t.say('ep.share.two.have');
  const two = await t.pick('How much of the bar is on your plate?', [{ id: '1', text: '1/3' }, { id: '2', text: '2/3' }, { id: '6', text: '2/6' }], 'ep.share.two.ask');
  // (2/6 is acted out first: 2 pieces of the same bar cut into 6 stand beside the child's stack)
  if (two === '6') {
    await t.say('ep.share.try.six');
    await w.besides(6, 2);
    w.label(null, '2/6');
    t.buddy('think');
    await t.say('ep.share.six.show');
    // (the sixths go away before the thirds get their names, so a "1/3" never stands next to them)
    await w.clearOther();
  }
  // ("let's check" for a right answer; a wrong one has just failed, so it's worked out together, said kindly)
  await t.say(two === '2' ? 'ep.share.try.two' : 'ep.share.try.two.together');
  w.label('1/3');
  await t.wait(1200);
  w.total('2/3');
  if (two === '2') { t.buddy('clap'); t.pal('happy'); await t.say('ep.share.two.yes'); }
  // (a wrong answer: first what was wrong with it, then what the top number counts)
  else { t.buddy('think'); await t.say(two === '1' ? 'ep.share.two.one' : 'ep.share.two.six'); await t.say('ep.share.two.top'); }
  await t.go('Next');
  w.label(null); w.total(null);
  if (two === '6') await w.clearOther();

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
  await w.barIn(NEXT_DAY);
  await w.plates(FRIENDS);
  if (notes?.small != null) t.myBet(notes.fair ? 'Your first cut yesterday was fair' : `Your first cut yesterday: ${notes.small} to ${notes.big} squares`);
  await t.say('ep.share.check');
  // (yesterday's cut is a reminder for the question, not for today's answer: it goes before the child cuts,
  // so it never stands beside what's said about today's pieces)
  t.myBet(null);
  await shareFour(t, w, NEXT_DAY, 'twelve');
  const call = await t.pick('What is each piece called?', [{ id: '4', text: '1/4' }, { id: '12', text: '1/12' }, { id: '3', text: '1/3' }], 'ep.share.check.call');
  w.label('1/4');
  await t.say(call === '4' ? 'ep.share.check.call.yes' : 'ep.share.check.call.no');
  await t.go('Next');
  w.label(null);
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
