// Layers of Cubes, rebuilt: the Sky Ferry needs crates of crystal cubes, and a crate that isn't packed full
// rattles and cracks them. So you need to know how many cubes to cut BEFORE you pack, and that need is the
// whole story. Nobody tells the child the formula. Their number is cut and poured, right or wrong. They
// measure the crate by rolling a cube along its edges, and those lines stay on it with their numbers. The
// buddy and Prism Hornback bet too, each with a wrong idea children really have (adding the edges, stopping
// at the floor, counting only what you can see), and the crate tries all the bets. Then the child's hand
// sweeps a row into a floor and pulls the floor up into a block, and each pull copies everything so far:
// that's why it's times. Only then is it written down. The last crates can't be filled by hand or check
// what they mean: a shut crate, a crate stood on end, and the buddy's own crate, which it packs from what
// the child showed it. If a word is said here, it's because a picture couldn't say it.
import type { BeatLesson, Notes, Teller, World } from './types';
import type { EpisodeScene } from '../../three/episodeScene';
import { meaning, seenOnly, volume, type Dims } from './crate';

export type Face = 'top' | 'front' | 'side';
/** What's on the table in this lesson (three/crateKit.ts). Each call plays and resolves when it's over. */
export interface CrateWorld extends World {
  /** the hook lowers a crate onto the table (`shut`: wooden walls and a lid; `lines`: its measures already on it) */
  crateIn(d: Dims, o?: { shut?: boolean; lines?: boolean }): Promise<void>;
  /** the hook takes it away, without a sound */
  crateOut(): Promise<void>;
  /** the opening: one cube in, a shake, a crack */
  loneCube(): Promise<void>;
  /** that many cubes are cut and poured in, and any over land on the table */
  pour(n: number): Promise<void>;
  /** cubes only where they can be seen from here */
  pourSeen(): Promise<void>;
  rattle(): Promise<void>;
  /** the empty places show */
  gaps(): Promise<void>;
  /** a full crate: a shake, no sound, the lid on */
  thunk(): Promise<void>;
  /** everything out of the crate */
  clear(): Promise<void>;
  /** roll the cube along an edge: it draws that edge's line and number */
  trace(axis: 'l' | 'w' | 'h'): Promise<void>;
  /** one row along the blue line */
  row(): Promise<void>;
  /** the child's hand copies the row across the floor, or the floor up the crate */
  sweep(axis: 'w' | 'h'): Promise<void>;
  /** act out a number for the crate with its floor done: that many in all */
  topUp(n: number): Promise<void>;
  /** do the rest of the hand's job ("Show me") */
  finish(): void;
  /** the sum, over the crate, its numbers in their lines' colours */
  writeSum(d: Dims, under?: string[], inks?: ('a' | 'b' | 'c')[]): void;
  clearSum(): void;
  /** the crate tips onto its end */
  tip(): Promise<void>;
  /** the same cubes counted again by the layers they're in now */
  recount(): Promise<void>;
  /** the walls go clear so the inside shows, or come back */
  peek(on: boolean): Promise<void>;
  /** the top layer lifts off, so the inside shows */
  liftTop(): Promise<void>;
  /** the child taps a face of the crate */
  pickFace(): Promise<Face>;
  /** that face lights, with what it is */
  showFace(f: Face): Promise<void>;
  /** the first layer of this crate, lying on `f` */
  layerOn(f: Face): Promise<void>;
  /** two loose cubes on top (the buddy takes "2" to mean 2 cubes), and away again */
  twoCubes(): Promise<void>;
  /** the second layer goes on by itself */
  secondLayer(): Promise<void>;
  /** the Glimmer eats the cracked cube from the opening */
  eatCracked(): Promise<void>;
}

const FIRST: Dims = { l: 5, w: 3, h: 2 }, SHUT: Dims = { l: 6, w: 3, h: 4 }, BUDDYS: Dims = { l: 5, w: 2, h: 2 }, NEXT_DAY: Dims = { l: 4, w: 5, h: 3 };
const STOOD: Dims = { l: 2, w: 3, h: 5 };
const WORDS = ['length', 'width', 'height', 'volume'];
/** the words a run of the lesson can say, all of them; the test holds the lesson to its budget */
export const CRATE_LINES = ['job', 'guess', 'lucky', 'measure', 'three', 'build', 'why', 'layer', 'name', 'tip', 'same', 'shut', 'help', 'off', 'check'].map(k => `ep.crate.${k}`);

/** The crate acts out a number: that many cubes go in, and the crate answers. Right or wrong, it's the same
 *  film: nothing but the world says which. */
async function actOut(t: Teller, w: CrateWorld, n: number, d: Dims): Promise<boolean> {
  t.pal('act');
  await w.pour(n);
  const m = meaning(n, d);
  if (m.kind === 'full') { await w.thunk(); t.buddy('cheer'); t.pal('happy'); await t.wait(800); return true; }
  if (m.kind === 'short') { await w.rattle(); await w.gaps(); t.buddy('shrug'); t.pal('sad'); await t.wait(900); }
  else { t.buddy('oops'); t.pal('sad'); await t.wait(1500); }
  return false;
}
/** Build it by hand, row then layers: what a child who's stuck does, so the count is their own. */
async function byHand(t: Teller, w: CrateWorld) {
  await w.row();
  await t.hands('Drag the row across the crate', () => w.sweep('w'), () => w.finish());
  await t.hands('Pull the layer up', () => w.sweep('h'), () => w.finish());
}
/** A crate nobody can fill by hand: keep trying, and a second miss builds it by hand instead of telling. */
async function shutCrate(t: Teller, w: CrateWorld, d: Dims, line: string, before?: () => Promise<void>) {
  let n = await t.num('How many cubes?', line);
  t.myBet(String(n));
  await before?.();
  await w.peek(true);
  for (let miss = 0; ; miss++) {
    if (await actOut(t, w, n, d)) break;
    await w.clear();
    if (miss >= 1) { await byHand(t, w); t.pal('happy'); t.buddy('nod'); await t.wait(600); await w.thunk(); break; }
    await w.peek(false);
    n = await t.num('How many cubes?');
    t.myBet(String(n));
    await w.peek(true);
  }
  t.myBet(null);
}

async function play(t: Teller, w: CrateWorld): Promise<Notes> {
  const d = FIRST, v = volume(d);
  // the job: why the number matters (a moment first, so the picture has settled before anything happens)
  t.beat(0);
  await t.wait(700);
  await w.crateIn(d);
  await w.loneCube();
  t.buddy('gasp'); t.pal('sad');
  await t.say('ep.crate.job');

  // a guess, with nothing to go on: whatever it is, it's cut and poured
  t.beat(1);
  const first = await t.num('How many cubes fill it?', 'ep.crate.guess');
  t.myBet(String(first));
  const lucky = await actOut(t, w, first, d);
  await w.clear();
  t.myBet(null);

  // measure it: the cube rolls along each edge, and the line and its number stay on the crate
  t.beat(2);
  await t.say(lucky ? 'ep.crate.lucky' : 'ep.crate.measure');
  await t.hands('Roll the cube along the edge', () => w.trace('l'), () => w.finish());
  await t.hands('Roll it along this edge', () => w.trace('w'), () => w.finish());
  await t.hands('Roll it up the corner', () => w.trace('h'), () => w.finish());

  // three bets: yours, then two real wrong ideas, and the crate tries them all, smallest first
  t.beat(3);
  const second = await t.num('How many cubes?', 'ep.crate.three');
  t.myBet(String(second));
  const added = d.l + d.w + d.h, floor = d.l * d.w;
  t.thought('buddy', `${d.l} + ${d.w} + ${d.h} = ${added}`); t.buddy('point');
  await t.wait(1600);
  t.thought('pal', `${d.l} × ${d.w} = ${floor}`); t.pal('hop');
  await t.wait(1600);
  for (const n of [...new Set([added, floor, second])].sort((a, b) => a - b)) {
    const won = await actOut(t, w, n, d);
    if (n === added) t.thought('buddy', null);
    if (n === floor) t.thought('pal', null);
    if (!won) await w.clear();
  }
  t.myBet(null);
  const knew = second === v;
  if (knew) await w.clear();

  // why: a row swept across makes the floor, the floor pulled up makes the block; each pull copies all of it
  t.beat(4);
  await t.say(knew ? 'ep.crate.why' : 'ep.crate.build');
  await w.row();
  await t.hands('Drag the row across the crate', () => w.sweep('w'), () => w.finish());
  t.beat(5);
  if (!knew) {
    const n = await t.num('How many in all?', 'ep.crate.layer');
    if (n === v) { t.buddy('nod'); t.pal('hop'); } else await w.topUp(n);
  }
  await t.hands('Pull the layer up', () => w.sweep('h'), () => w.finish());

  // only now is it written down, in the child's numbers, and only now does it get a name
  w.writeSum(d, WORDS);
  t.buddy('clap');
  await t.say('ep.crate.name');
  await t.go('Next');

  // stood on end: does it change? Same cubes, other layers: the order of the numbers is free
  t.beat(6);
  w.clearSum();
  const hunch = await t.pick('More cubes, or the same?', [{ id: 'more', text: 'More' }, { id: 'same', text: 'The same' }, { id: 'fewer', text: 'Fewer' }], 'ep.crate.tip');
  await w.tip();
  await w.recount();
  w.writeSum(STOOD, undefined, ['c', 'b', 'a']);
  if (hunch === 'same') { t.buddy('clap'); t.pal('happy'); } else t.buddy('gasp');
  await t.say('ep.crate.same');
  await t.go('Send it off');
  w.clearSum();
  await w.crateOut();

  // shut: you can't peek and can't count, and Prism tries counting what it can see
  t.beat(7);
  await w.crateIn(SHUT, { shut: true, lines: true });
  await shutCrate(t, w, SHUT, 'ep.crate.shut', async () => {
    t.thought('pal', `I can see ${seenOnly(SHUT).length}!`); t.pal('hop');
    await t.wait(1300);
    await w.peek(true);
    await w.pourSeen();
    await w.liftTop();
    await w.rattle();
    t.thought('pal', null); t.pal('sad');
    await w.clear();
    await w.peek(false);
  });
  await w.crateOut();

  // the buddy's crate: 5, 2 and 2. Two 2s, and the lines say which is which. The child shows it what the
  // sum means, by pointing, and it packs the crate itself from what they showed
  t.beat(8);
  await w.crateIn(BUDDYS, { lines: true });
  t.thought('buddy', '5 × 2 × 2 = ?'); t.buddy('think');
  await t.say('ep.crate.help');
  let face: Face = 'side';
  for (;;) {
    await t.hands('Tap the 5 × 2 on the crate', async () => { face = await w.pickFace(); }, () => w.finish());
    await w.showFace(face);
    if (face !== 'side') break;
    t.buddy('shrug');
  }
  t.buddy('nod');
  await w.layerOn(face);
  t.thought('buddy', '5 × 2 = 10');
  for (;;) {
    const last = await t.pick('What does the other 2 count?', [{ id: 'cubes', text: '2 cubes' }, { id: 'layers', text: '2 layers' }]);
    if (last === 'layers') break;
    await w.twoCubes();
    t.buddy('shrug');
  }
  await w.secondLayer();
  t.thought('buddy', '10 × 2 = 20'); t.buddy('cheer'); t.pal('happy');
  await w.thunk();
  await t.wait(1000);
  t.thought('buddy', null);

  // off it goes; and the cube that cracked at the very start gets eaten
  t.beat(9);
  await w.crateOut();
  await t.say('ep.crate.off');
  await w.eatCracked();
  t.buddy('jump');
  await t.wait(600);
  return { first, second };
}

async function check(t: Teller, w: CrateWorld, notes: Notes | null) {
  await w.crateIn(NEXT_DAY, { shut: true, lines: true });
  if (notes?.first != null) t.myBet(`Your first guess yesterday: ${notes.first}`);
  await shutCrate(t, w, NEXT_DAY, 'ep.crate.check');
  await w.crateOut();
}

export const CRATE_LESSON: BeatLesson<CrateWorld> = {
  id: 'sh-boxes', title: 'Layers of Cubes', blurb: 'Fill one layer, then count the layers: length × width × height.', set: 'peaks', star: 'prismhorn', color: '#2fb3a0',
  art: 'learn/shapes/card-boxes.webp', beats: 10,
  world: async (sc: EpisodeScene) => { const { CrateKit } = await import('../../three/crateKit'); return new CrateKit(sc); },
  play, check,
  card: n => [`Your first guess: ${n.first ?? '?'}`, 'The floor, times the layers.'],
};
