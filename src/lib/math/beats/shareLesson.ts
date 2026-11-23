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
import type { BeatLesson, Notes, Teller, World } from './types';
import type { EpisodeScene } from '../../three/episodeScene';
import { fair, fairCuts, middle, piecesOf } from './share';

/** What's on the table in this lesson (three/shareKit.ts). Each call plays and resolves when it's over. */
export interface ShareWorld extends World {
  /** a bar of this many squares comes in onto the table, its number of squares standing on it */
  barIn(squares: number): Promise<void>;
  /** a plate for each friend along the front of the table */
  plates(n: number): Promise<void>;
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
  /** one piece of the same bar cut into `b` equal pieces is laid right under the child's first piece */
  besides(b: number): Promise<void>;
  /** whatever was laid under the child's pieces goes away */
  clearOther(): Promise<void>;
  /** the pieces go back onto the plates; the buddy's and the Glimmer's go into their mouths */
  eat(): Promise<void>;
  /** the bar and the plates go */
  barOut(): Promise<void>;
  /** do the rest of the hand's job ("Show me") */
  finish(): void;
}

const BAR = 8, FRIENDS = 4, BUDDY_CUTS = [1, 2, 4], LAST = 6, LAST_FRIENDS = 3, NEXT_DAY = 12;
/** the words a run of the lesson can say, all of them */
export const SHARE_LINES = ['intro', 'plates', 'cut', 'try.you', 'try.again', 'try.together', 'try.last', 'fair', 'unfair', 'again', 'together', 'half', 'half.yes',
  'eight.half.no', 'eight.quarter', 'eight.quarter.no', 'twelve.half.no', 'twelve.quarter', 'twelve.quarter.no',
  'name', 'name.why', 'try.buddy', 'buddy.ask', 'try.test', 'buddy.yes', 'buddy.no', 'more', 'which', 'try.pal', 'eighth.you', 'eighth.pal', 'eighth.same', 'eighth.why',
  'last', 'hint', 'call', 'try.name', 'call.squares', 'call.half', 'call.yes', 'eat', 'fair.together', 'check', 'check.call', 'check.call.yes', 'check.call.no'].map(k => `ep.share.${k}`);

/** Which bar's worked answer: the lines carry that bar's own numbers. */
type Key = 'eight' | 'twelve';

/** The child cuts the bar; what they made is served and lined up, and the bar says if it's fair. */
async function tryCut(t: Teller, w: ShareWorld, squares: number, friends: number, line: string): Promise<number[]> {
  let lines: number[] = [];
  await t.hands(`Tap the bar to cut it into ${friends} pieces`, async () => { lines = await w.cut(friends); }, () => w.finish());
  await t.say(line);
  await w.serve();
  const pieces = piecesOf(squares, lines);
  if (fair(pieces)) { t.buddy('cheer'); t.pal('happy'); await t.say('ep.share.fair', pieces[0]); }
  else { t.buddy('shrug'); t.pal('sad'); await t.say('ep.share.unfair'); }
  return pieces;
}
/** One cut, on a line the script can judge: a wrong one is cut, its pieces shown, and undone. */
async function cutAt(t: Teller, w: ShareWorld, words: string, ok: (g: number) => boolean, hint: number, no: string) {
  for (;;) {
    let g = hint;
    await t.hands(words, async () => { g = await w.tapCut(hint); }, () => w.finish());
    if (ok(g)) return g;
    t.buddy('shrug');
    await t.say(no);
    await w.uncut(g);
  }
}
/** Two unfair cuts: say so kindly, then halve and halve again together, each step with its reason. */
async function together(t: Teller, w: ShareWorld, squares: number, k: Key) {
  await t.say('ep.share.together');
  const mid = middle(0, squares)!, half = squares / 2;
  await t.say('ep.share.half');
  await cutAt(t, w, 'Tap the middle of the bar', g => g === mid, mid, `ep.share.${k}.half.no`);
  t.buddy('nod');
  await t.say('ep.share.half.yes', half);
  await t.say(`ep.share.${k}.quarter`);
  const quarters = [middle(0, mid)!, middle(mid, squares)!];
  const first = await cutAt(t, w, 'Tap the middle of one half', g => quarters.includes(g), quarters[0], `ep.share.${k}.quarter.no`);
  const other = quarters.find(q => q !== first)!;
  await cutAt(t, w, 'Now tap the middle of the other half', g => g === other, other, `ep.share.${k}.quarter.no`);
  await t.say('ep.share.try.together');
  await w.serve();
  t.buddy('cheer'); t.pal('happy');
  await t.say('ep.share.fair.together', squares / FRIENDS);
}
/** A bar shared by four: two tries of the child's own, then together. Resolves with the first try's pieces. */
async function shareFour(t: Teller, w: ShareWorld, squares: number, k: Key): Promise<number[]> {
  let first: number[] = [];
  for (let miss = 0; ; miss++) {
    const pieces = await tryCut(t, w, squares, FRIENDS, miss ? 'ep.share.try.again' : 'ep.share.try.you');
    if (!miss) first = pieces;
    if (fair(pieces)) break;
    await w.join();
    if (miss >= 1) { await together(t, w, squares, k); break; }
    await t.say('ep.share.again', FRIENDS);
  }
  return first;
}

async function play(t: Teller, w: ShareWorld): Promise<Notes> {
  // the job: four friends, one bar, and sharing has to be fair (a moment first, so the picture has settled)
  t.beat(0);
  await t.wait(700);
  await w.barIn(BAR);
  await t.say('ep.share.intro');
  await w.plates(FRIENDS);
  await t.say('ep.share.plates');

  // the child cuts it, wherever they like, and what they cut is served
  t.beat(1);
  await t.say('ep.share.cut');
  const first = await shareFour(t, w, BAR, 'eight');

  // only now does a piece get a name, from what the hands just made
  t.beat(2);
  w.label('1/4');
  await t.say('ep.share.name');
  await t.say('ep.share.name.why');
  await t.go('Next');

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
  await w.clearOther();

  // Pebble's idea: 8 is more than 4, so 1/8 must be more
  t.beat(4);
  await t.say('ep.share.more');
  t.thought('pal', '8 is more than 4, so 1/8 is more!'); t.pal('hop');
  const more = await t.pick('Which piece is more chocolate?', [{ id: '4', text: '1/4' }, { id: '8', text: '1/8' }, { id: 'same', text: 'The same' }], 'ep.share.which');
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
  await w.plates(LAST_FRIENDS);
  await t.say('ep.share.last');
  for (let miss = 0; ; miss++) {
    const pieces = await tryCut(t, w, LAST, LAST_FRIENDS, 'ep.share.try.last');
    if (fair(pieces)) break;
    await w.join();
    await t.say(miss >= 1 ? 'ep.share.hint' : 'ep.share.again', LAST_FRIENDS);
  }
  t.beat(6);
  const call = await t.pick('What is each piece called?', [{ id: '3', text: '1/3' }, { id: '6', text: '1/6' }, { id: '2', text: '1/2' }], 'ep.share.call');
  if (call !== '3') {
    await t.say('ep.share.try.name', Number(call));
    await w.besides(Number(call));
    t.pal('sad');
    w.label('1/3', `1/${call}`);
    await t.say(call === '6' ? 'ep.share.call.squares' : 'ep.share.call.half');
  } else { t.buddy('clap'); t.pal('happy'); w.label('1/3'); await t.say('ep.share.call.yes'); }
  await t.go('Next');
  w.label(null);
  await w.clearOther();

  // it ends with the snack: two thirds eaten, and the child's third still on their plate
  t.beat(7);
  await t.say('ep.share.eat');
  await w.eat();
  t.buddy('jump');
  await t.wait(600);
  return { fair: fair(first) ? 1 : 0, small: Math.min(...first), big: Math.max(...first) };
}

async function check(t: Teller, w: ShareWorld, notes: Notes | null) {
  await w.barIn(NEXT_DAY);
  await w.plates(FRIENDS);
  if (notes?.small != null) t.myBet(notes.fair ? 'Your first cut yesterday was fair' : `Your first cut yesterday: ${notes.small} to ${notes.big} squares`);
  await t.say('ep.share.check');
  await shareFour(t, w, NEXT_DAY, 'twelve');
  t.myBet(null);
  const call = await t.pick('What is each piece called?', [{ id: '4', text: '1/4' }, { id: '12', text: '1/12' }, { id: '3', text: '1/3' }], 'ep.share.check.call');
  w.label('1/4');
  await t.say(call === '4' ? 'ep.share.check.call.yes' : 'ep.share.check.call.no');
  await t.go('Next');
  w.label(null);
  await w.barOut();
}

export const SHARE_LESSON: BeatLesson<ShareWorld> = {
  id: 'frac-one-piece', title: 'Fair Shares', blurb: 'One of 4 equal pieces is 1/4. Cut the same bar into more pieces and each one is smaller.', set: 'workshop', star: 'pebbletort', color: '#b8743a',
  art: 'learn/frac/card-choc.webp', beats: 8,
  world: async (sc: EpisodeScene) => { const { ShareKit } = await import('../../three/shareKit'); return new ShareKit(sc); },
  play, check,
  card: n => [n.fair ? 'Your first cut was fair: every piece the same.' : `Your first cut gave pieces from ${n.small ?? '?'} to ${n.big ?? '?'} squares long.`,
    'One of 4 equal pieces is one fourth, 1/4. Cut the same bar into more pieces, and each piece is smaller.'],
};

/** (for the tests: the fair cuts of each bar in the lesson) */
export const SHARE_BARS = { first: fairCuts(BAR, FRIENDS)!, last: fairCuts(LAST, LAST_FRIENDS)!, nextDay: fairCuts(NEXT_DAY, FRIENDS)! };
