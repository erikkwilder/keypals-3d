// My Sky Island: building with blocks, walking on what's built, the secrets and playing with the Glimmers.
import { describe, expect, it } from 'vitest';
import { newProfile, type Profile } from '../engine/profile';
import { mulberry32 } from '../engine/rng';
import { advOf, advView } from '../adventure/state';
import { GLIMMER, type GlimmerId } from '../adventure/glimmers';
import { ITEM } from './catalog';
import {
  BLOCK, MAX_BLOCKS, MAX_LAYERS, PAINTS, SHAPES, blockCount, blockList, builtOf, canPlace, ctxOf, encode, fall, findPath, floorAt, keyOf, mergeBlocks,
  paintBlock, perches, placeBlock, removeBlock, standUp, statsOf, turnBlock, undoOp, walk, worldOf, type Block, type BuildCtx, type Op, type P3, type World,
} from './blocks';
import { SECRETS, bottlePond, darkness, findSecret, foundCount, isNight, keepOutOf, noteFrom, onRock, rainToday, rocksOf, sparkleSpot, WHALE_Y, openedToday } from './secrets';
import { FRIEND_MAX, JOY, JOY_DAY, SNACKS, WISHES_DAY, WISH_GAP, XP_DAY, buySnacks, canWish, dig, feed, fetched, friendOf, grantWish, newWish, pet, wishAtWell, wishMet } from './play';
import { GIFT_SHELLS_DAY, VISIT_GAP, buyAndPlace, checkVisitor, fits, growthOf, islandOf, mergeIsland, setOut } from './save';
import { add } from '../state/merge';

const T0 = new Date('2026-10-29T09:00:00').getTime();
const H = 3600_000, DAY = 24 * H;
type Save = { blocks: string; placed: Record<string, { item: string; x: number; z: number; rot: 0 | 1 | 2 | 3 }>; mats: number[] };
const land = (): Save => ({ blocks: '', placed: {}, mats: [] });
const ctx = (s: Save, r = 5): BuildCtx => ctxOf(s, r, keepOutOf(r));
const B = (x: number, y: number, z: number, s: Block['s'] = 'cube', r: Block['r'] = 0, p = 14): Block => ({ x, y, z, s, r, p });
function put(s: Save, ...bs: Block[]) { for (const b of bs) { const r = placeBlock(s, ctx(s), b); if (!r.ok) throw new Error(`${r.why} at ${keyOf(b.x, b.y, b.z)}`); } }
const world = (s: Save, r = 5): World => { const k = rocksOf(r); return worldOf(s.blocks, [k.cave, k.sky], r + 0.35); };
/** walk toward a point for a while (like the buddy holding a key), with gravity */
function walkTo(w: World, p: P3, to: { x: number; z: number }, secs = 8) {
  let vy = 0;
  for (let t = 0; t < secs; t += 1 / 30) {
    const dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.05) break;
    walk(w, p, { x: dx / d, z: dz / d }, Math.min(d, 3 / 30));
    vy = fall(w, p, vy, 1 / 30);
  }
  for (let i = 0; i < 60; i++) vy = fall(w, p, vy, 1 / 30);
}
function player(name = 'Mia', shells = 1000): Profile { const p = newProfile(name, 'dino'); advOf(p).shells = shells; return p; }
const own = (p: Profile, ...ids: GlimmerId[]) => { const a = advOf(p); for (const id of ids) a.glimmers[id] = { level: 3, xp: 0, got: T0 }; };

describe('building with blocks', () => {
  it('places on the grass, stacks, takes away, and undoes', () => {
    const s = land(), ops: Op[] = [];
    const a = placeBlock(s, ctx(s), B(0, 0, 0)); expect(a.ok).toBe(true); if (a.ok) ops.push(a.op);
    // a second on the same square doesn't go; one on top does
    expect(placeBlock(s, ctx(s), B(0, 0, 0)).ok).toBe(false);
    const b = placeBlock(s, ctx(s), B(0, 1, 0, 'half', 0, 2)); expect(b.ok).toBe(true); if (b.ok) ops.push(b.op);
    // floating in the air (nothing next to it) doesn't go
    expect(placeBlock(s, ctx(s), B(4, 3, 4)).ok).toBe(false);
    expect(blockCount(s.blocks)).toBe(2);
    const c = removeBlock(s, keyOf(0, 0, 0)); expect(c.ok).toBe(true); if (c.ok) ops.push(c.op);
    expect(blockCount(s.blocks)).toBe(1);
    const d = paintBlock(s, ctx(s), keyOf(0, 1, 0), 9); expect(d.ok).toBe(true); if (d.ok) ops.push(d.op);
    const e = turnBlock(s, keyOf(0, 1, 0)); expect(e.ok).toBe(true); if (e.ok) ops.push(e.op);
    expect(builtOf(s.blocks).map.get(keyOf(0, 1, 0))).toMatchObject({ s: 'half', p: 9, r: 1 });
    // undo, newest first: turn, paint, take away, place, place
    for (const op of ops.reverse()) expect(undoOp(s, op)).toBe(true);
    expect(blockCount(s.blocks)).toBe(0);
  });
  it('a door takes two squares; things and blocks keep out of each other', () => {
    const p = player();
    const s = islandOf(p, T0), r = growthOf(p).r;
    const c = () => ctxOf(s, r, keepOutOf(r));
    // the starter cottage stands on squares -1..1, -4..-2: blocks can't go there
    expect(placeBlock(s, c(), B(0, 0, -6)).ok).toBe(false);
    expect(placeBlock(s, c(), B(4, 0, 2, 'door')).ok).toBe(true);
    expect(placeBlock(s, c(), B(4, 1, 2)).ok).toBe(false);
    expect(placeBlock(s, c(), B(4, 2, 2)).ok).toBe(true);
    // a flower patch can't go on a square with a block in it (block 4,2 is in square 2,1)
    expect(fits(s, r, ITEM.flowers, 2, 1, 0)).toBe(false);
    expect(fits(s, r, ITEM.flowers, -2, 1, 0)).toBe(true);
  });
  it('off the edge only as a bridge, and not too far out; special paints wait to be found', () => {
    const s = land();
    // the island (r 5) has squares out to 4.5 from the middle: block 9 is in square 5, off the edge
    expect(placeBlock(s, ctx(s), B(9, 0, 0)).ok).toBe(false);
    put(s, B(8, 0, 0));
    expect(placeBlock(s, ctx(s), B(9, 0, 0)).ok).toBe(true);
    for (let x = 10; x <= 23; x++) placeBlock(s, ctx(s), B(x, 0, 0));
    const far = Math.max(...blockList(s.blocks).map(b => b.x));
    expect((far + 0.5) * BLOCK).toBeLessThanOrEqual(5 + 0.95 + 6);
    expect(placeBlock(s, ctx(s), B(far + 1, 0, 0)).ok).toBe(false);
    const gold = PAINTS.find(p => p.kind === 'gold')!.id;
    expect(placeBlock(s, ctx(s), B(-2, 0, 2, 'cube', 0, gold)).ok).toBe(false);
    s.mats.push(gold);
    expect(placeBlock(s, ctx(s), B(-2, 0, 2, 'cube', 0, gold)).ok).toBe(true);
  });
  it('stops at the most blocks and the highest layer, and a full island stays small in the save', () => {
    const s = land(), c = ctxOf(s, 12);
    // a big island: fill columns until the limit
    let n = 0;
    outer: for (let x = -16; x < 16; x++) for (let z = -16; z < 16; z++) for (let y = 0; y < 3; y++) {
      const sh = SHAPES[(((x + z) % 8) + 8) % 8].id;
      if (placeBlock(s, c, B(x, y, z, sh === 'door' ? 'cube' : sh, ((x + 40) % 4) as Block['r'], (z + 40) % 19)).ok) n++;
      if (n >= MAX_BLOCKS + 5) break outer;
    }
    expect(blockCount(s.blocks)).toBe(MAX_BLOCKS);
    expect(placeBlock(s, c, B(20, 0, 0)).ok).toBe(false);
    expect(s.blocks.length).toBe(MAX_BLOCKS * 5);
    expect(JSON.stringify(s.blocks).length).toBeLessThan(3200);
    // every block reads back the same
    expect(encode(builtOf(s.blocks).map)).toBe(s.blocks);
    const t = land();
    for (let y = 0; y < MAX_LAYERS; y++) put(t, B(0, y, 0));
    expect(placeBlock(t, ctx(t), B(0, MAX_LAYERS, 0)).ok).toBe(false);
  });
  it('two computers merge block by block', () => {
    const base = land(); put(base, B(0, 0, 0), B(1, 0, 0));
    const a = structuredClone(base), b = structuredClone(base);
    put(a, B(2, 0, 0)); removeBlock(a, keyOf(0, 0, 0));
    put(b, B(-1, 0, 0)); paintBlock(b, ctx(b), keyOf(1, 0, 0), 4);
    const m = builtOf(mergeBlocks(a.blocks, b.blocks, base.blocks, true)).map;
    expect([...m.keys()].sort()).toEqual([keyOf(-1, 0, 0), keyOf(1, 0, 0), keyOf(2, 0, 0)].sort());
    expect(m.get(keyOf(1, 0, 0))!.p).toBe(4);
    // a door on one, a block in its top square on the other: the newer keeps its own
    const c = structuredClone(base), d = structuredClone(base);
    put(c, B(4, 0, 4, 'door')); put(d, B(4, 0, 4, 'half'), B(4, 1, 4));
    const md = builtOf(mergeBlocks(c.blocks, d.blocks, base.blocks, true)).map;
    expect(md.get(keyOf(4, 0, 4))!.s).toBe('door');
    expect(md.has(keyOf(4, 1, 4))).toBe(false);
  });
});

describe('walking on what is built', () => {
  it('walks up a ramp on to a block, but not up a block without one', () => {
    const s = land();
    // a block at x 2, and a ramp in front of it rising toward it (turned to rise toward +x)
    put(s, B(2, 0, 0), B(1, 0, 0, 'ramp', 1));
    const w = world(s), me = { x: -0.5, y: 0, z: 0.25 };
    walkTo(w, me, { x: 1.25, z: 0.25 });
    expect(me.y).toBeCloseTo(0.5, 2);
    expect(me.x).toBeCloseTo(1.25, 1);
    // straight at a block with no ramp: stopped at its side, still on the grass
    const t = land(); put(t, B(2, 0, 0));
    const w2 = world(t), you = { x: -0.5, y: 0, z: 0.25 };
    walkTo(w2, you, { x: 1.25, z: 0.25 });
    expect(you.y).toBe(0);
    expect(you.x).toBeLessThan(1);
  });
  it('half blocks and stairs are steps, a door is a way through, and walking off a tower falls', () => {
    const s = land();
    put(s, B(1, 0, 0, 'half'), B(2, 0, 0), B(3, 0, 0), B(3, 1, 0, 'stairs', 1), B(4, 0, 0), B(4, 1, 0));
    const w = world(s), me = { x: 0, y: 0, z: 0.25 };
    walkTo(w, me, { x: 2.25, z: 0.25 });
    expect(me.y).toBeCloseTo(1.0, 2);
    // on along the top and off the far end: down to the grass
    walkTo(w, me, { x: 3.2, z: 0.25 });
    expect(me.y).toBe(0);
    // a wall with a door: through the door, not through the wall
    const d = land();
    put(d, B(0, 0, 2, 'door'), B(-1, 0, 2), B(-1, 1, 2), B(1, 0, 2), B(1, 1, 2), B(0, 2, 2));
    const wd = world(d), you = { x: 0.25, y: 0, z: 0 };
    walkTo(wd, you, { x: 0.25, z: 2.2 });
    expect(you.z).toBeCloseTo(2.2, 1);
    const them = { x: -0.25, y: 0, z: 0 };
    walkTo(wd, them, { x: -0.25, z: 2.2 });
    expect(them.z).toBeLessThan(1);
  });
  it('a block put on someone lifts them on to it; perches are the high tops', () => {
    const s = land(); put(s, B(0, 0, 0), B(0, 1, 0), B(0, 2, 0));
    const w = world(s), me = { x: 0.25, y: 0, z: 0.25 };
    standUp(w, me);
    expect(me.y).toBeCloseTo(1.5, 5);
    expect(perches(w, 1)[0]).toMatchObject({ y: 1.5 });
    expect(floorAt(w, 0.25, 0.25, 0)).toBeNull();
  });
  it('a tap on a roof finds the way round to the ramp', () => {
    const s = land();
    // a 3 by 3 block roof one block up, a ramp on its west side
    for (let x = 2; x <= 4; x++) for (let z = -1; z <= 1; z++) put(s, B(x, 0, z));
    put(s, B(1, 0, 0, 'ramp', 1));
    const w = world(s);
    const path = findPath(w, { x: 2, y: 0, z: 2.5 }, { x: 1.75, y: 0.5, z: 0.25 });
    expect(path).not.toBeNull();
    const me = { x: 2, y: 0, z: 2.5 };
    for (const pt of path!) walkTo(w, me, pt, 3);
    expect(me.y).toBeCloseTo(0.5, 2);
    // nowhere to climb: no way
    const t = land(); for (let x = 2; x <= 4; x++) for (let z = -1; z <= 1; z++) put(t, B(x, 0, z));
    expect(findPath(world(t), { x: 2, y: 0, z: 2.5 }, { x: 1.75, y: 0.5, z: 0.25 })).toBeNull();
  });
});

describe('island secrets', () => {
  it('ten secrets, each with a keepsake to place and a sticker; each found once', () => {
    expect(SECRETS.length).toBeGreaterThanOrEqual(8);
    expect(SECRETS.length).toBeLessThanOrEqual(12);
    const p = player();
    for (const d of SECRETS) {
      expect(ITEM[d.keepsake]?.gift).toBe(true);
      expect(d.hint.length).toBeGreaterThan(10);
      const s = islandOf(p, T0);
      expect(findSecret(p, s, d.id, T0)).toBe(true);
      expect(findSecret(p, s, d.id, T0 + 1)).toBe(false);
      expect(s.owned[d.keepsake]).toBe(1);
      expect(p.book!.stickers[d.sticker.id]).toBeTruthy();
    }
    expect(foundCount(p.island)).toBe(SECRETS.length);
    // four of them bring a special paint
    expect(p.island!.mats.length).toBe(PAINTS.filter(x => x.special).length);
  });
  it('the treasure: the grass sparkles on a free square, digging there finds it once, then a treat a day', () => {
    const p = player(), s = islandOf(p, T0), day = '2026-10-29';
    const spot = sparkleSpot(p.id, s, growthOf(p).r, ctxOf(s, 5).things, day)!;
    expect(spot).not.toBeNull();
    expect(ctxOf(s, 5).things.has(`${spot.i},${spot.j}`)).toBe(false);
    expect(dig(p, T0)).toEqual({ first: true, treat: false });
    expect(dig(p, T0 + H)).toBeNull();
    expect(sparkleSpot(p.id, s, 5, new Set(), day)).toBeNull();
    expect(dig(p, T0 + DAY)).toEqual({ first: false, treat: true });
    expect(islandOf(p).treats).toBe(1);
  });
  it('the waterfall cave: a bridge of half blocks reaches the cave rock, and walking over finds it', () => {
    const s = land(), r = 5, k = rocksOf(r).cave;
    // half blocks along x to the rock's column, then along z out to the rock
    const kx = Math.floor(k.x / BLOCK);
    for (let x = 0; x <= kx; x++) put(s, B(x, 0, 0, 'half', 0, 15));
    for (let z = 1; z < 40; z++) { const res = placeBlock(s, ctx(s, r), B(kx, 0, z, 'half', 0, 15)); if (!res.ok) { expect(res.why).toMatch(/rock/); break; } }
    const w = world(s, r), me = { x: 0.25, y: 0, z: 0.25 };
    walkTo(w, me, { x: (kx + 0.5) * BLOCK, z: 0.25 }, 10);
    walkTo(w, me, { x: (kx + 0.5) * BLOCK, z: k.z }, 10);
    expect(onRock(k, me.x, me.y, me.z)).toBe(true);
    // without the bridge you can't get there
    const you = { x: 0.25, y: 0, z: 0.25 };
    walkTo(world(land(), r), you, { x: k.x, z: k.z }, 20);
    expect(onRock(k, you.x, you.y, you.z)).toBe(false);
  });
  it('the floating rock: ramps up three blocks and a bridge out to it', () => {
    const s = land(), r = 5, k = rocksOf(r).sky;
    expect(k.x).toBeLessThan(0);
    // a climb toward -x: ramps rising that way (turned 3), on blocks, up to three blocks high
    put(s, B(-1, 0, 0, 'ramp', 3), B(-2, 0, 0), B(-2, 1, 0, 'ramp', 3), B(-3, 0, 0), B(-3, 1, 0), B(-3, 2, 0, 'ramp', 3));
    // a road three blocks up, out along x to the rock's column, then along z to the rock
    const kx = Math.floor(k.x / BLOCK);
    for (let x = -4; x >= kx; x--) { if (Math.hypot(x, 0) * BLOCK < r - 0.5) put(s, B(x, 0, 0), B(x, 1, 0)); put(s, B(x, 2, 0)); }
    for (let z = 1; z < 40; z++) { const res = placeBlock(s, ctx(s, r), B(kx, 2, z)); if (!res.ok) { expect(res.why).toMatch(/rock/); break; } }
    const w = world(s, r), me = { x: 0.25, y: 0, z: 0.25 };
    walkTo(w, me, { x: (kx + 0.5) * BLOCK, z: 0.25 }, 12);
    expect(me.y).toBeCloseTo(1.5, 2);
    walkTo(w, me, { x: (kx + 0.5) * BLOCK, z: k.z }, 12);
    expect(onRock(k, me.x, me.y, me.z)).toBe(true);
  });
  it('night in the evening, rain by the third day, a bottle in a pond, the note from a very happy Glimmer, the whale from up high', () => {
    expect(isNight(new Date('2026-10-29T20:30:00'))).toBe(true);
    expect(isNight(new Date('2026-10-29T12:00:00'))).toBe(false);
    expect(darkness(new Date('2026-10-29T23:00:00'))).toBe(1);
    expect(darkness(new Date('2026-10-29T13:00:00'))).toBe(0);
    const p = player(), s = islandOf(p, T0);
    for (let d = 0; d < 3; d++) openedToday(s, T0 + d * DAY);
    expect(rainToday(p.id, s, s.days.last)).toBe(true);
    expect(bottlePond(s)).toBeNull();
    buyAndPlace(p, 'pond', 2, 1, 0, T0);
    expect(bottlePond(s)).not.toBeNull();
    own(p, 'puddlepup');
    setOut(p, ['puddlepup']);
    expect(noteFrom(s, ['puddlepup'])).toBeNull();
    s.friends.puddlepup = FRIEND_MAX;
    expect(noteFrom(s, ['puddlepup'])).toBe('puddlepup');
    // six blocks up is high enough to see the whale
    const t = land();
    for (let y = 0; y < 6; y++) put(t, B(0, y, 0));
    const w = world(t), me = { x: 0.25, y: 0, z: 0.25 };
    standUp(w, me);
    expect(me.y).toBeGreaterThanOrEqual(WHALE_Y);
  });
});

describe('playing with the Glimmers', () => {
  function withPals() {
    const p = player('Mia', 500);
    own(p, 'puddlepup', 'sproutbun');
    setOut(p, ['puddlepup', 'sproutbun']);
    islandOf(p, T0);
    return p;
  }
  it('petting, treats and balls make friends, only so much a day; treats get used up', () => {
    const p = withPals();
    expect(feed(p, 'puddlepup', T0).ok).toBe(false);
    expect(buySnacks(p).ok).toBe(true);
    expect(advView(p).shells).toBe(500 - SNACKS.price);
    expect(islandOf(p).treats).toBe(SNACKS.n);
    expect(feed(p, 'puddlepup', T0)).toMatchObject({ ok: true, joy: JOY.treat });
    expect(islandOf(p).treats).toBe(SNACKS.n - 1);
    expect(pet(p, 'puddlepup', T0).joy).toBe(JOY.pet);
    expect(fetched(p, 'puddlepup', T0).joy).toBe(JOY.ball);
    for (let i = 0; i < 40; i++) { pet(p, 'puddlepup', T0 + i); fetched(p, 'puddlepup', T0 + i); }
    expect(friendOf(islandOf(p), 'puddlepup')).toBe(JOY_DAY);
    // a new day: more
    expect(pet(p, 'puddlepup', T0 + DAY).joy).toBe(JOY.pet);
    // a Glimmer that doesn't live on the island gets nothing
    expect(pet(p, 'frostowl', T0).joy).toBe(0);
    // never a shell
    expect(advView(p).shells).toBe(500 - SNACKS.price);
  });
  it('a Glimmer wishes for something not built yet; building it grants the wish', () => {
    const p = withPals();
    const w = (() => { let got = null; for (let i = 0; i < 20 && !got; i++) got = newWish(p, T0, mulberry32(i)); return got; })()!;
    expect(w).not.toBeNull();
    expect(wishMet(p, islandOf(p), w.want)).toBe(false);
    // one wish at a time
    expect(newWish(p, T0 + 1, mulberry32(9))).toBeNull();
    expect(grantWish(p, T0 + 2)).toBeNull();
    const before = advOf(p).glimmers[w.id]!.xp + advOf(p).glimmers[w.id]!.level * 1000;
    // build what it wished for
    const s = islandOf(p), r = growthOf(p).r;
    const item: Record<string, string> = { pond: 'pond', fountain: 'fountain', tidepond: 'tidepond', icepool: 'icepool', pine: 'pine', sundais: 'sundais', lamp: 'lamp', stonecave: 'stonecave', boulder: 'boulder', leafgrove: 'leafgrove', flowers: 'flowers', tree: 'roundtree', bench: 'bench', swing: 'swing' };
    if (item[w.want]) { advOf(p).shells += 2000; expect(buyAndPlace(p, item[w.want], 2, 1, 0, T0).ok).toBe(true); advOf(p).shells -= 2000; }
    else {
      const c = () => ctxOf(s, r, keepOutOf(r));
      const blocks: Block[] = w.want === 'tower' ? [0, 1, 2, 3].map(y => B(6, y, 4)) : w.want === 'bridge' ? [B(8, 0, 0), B(9, 0, 0), B(10, 0, 0)]
        : w.want === 'glowblock' ? (s.mats.push(21), [B(6, 0, 4, 'cube', 0, 21)]) : w.want === 'window' ? [B(6, 0, 4, 'window')]
        : [B(5, 0, 4, 'door'), B(6, 0, 4, 'window'), ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => B(7 + (i % 2), Math.floor(i / 2), 4))];
      for (const b of blocks) { const res = placeBlock(s, c(), b); if (!res.ok) throw new Error(res.why); }
    }
    const shells = advView(p).shells;
    const g = grantWish(p, T0 + 3)!;
    expect(g).not.toBeNull();
    expect(g.joy).toBe(JOY.wish);
    expect(advOf(p).glimmers[w.id]!.xp + advOf(p).glimmers[w.id]!.level * 1000).toBeGreaterThan(before);
    expect(advView(p).shells).toBe(shells);
    // the next wish waits a while, and there are only so many a day
    expect(newWish(p, T0 + 4, mulberry32(3))).toBeNull();
    let made = 1;
    for (let i = 0; i < 20; i++) { const n = newWish(p, T0 + (i + 1) * (WISH_GAP + 1), mulberry32(i + 50)); if (n) { islandOf(p).wish = null; islandOf(p).wishes.n++; made++; } }
    expect(made).toBeLessThanOrEqual(WISHES_DAY);
  });
  it('the island gives a Glimmer only a little experience a day', () => {
    const p = withPals();
    islandOf(p).treats = 50;
    const lv = () => { const o = advOf(p).glimmers.puddlepup!; let xp = o.xp; for (let l = 1; l < o.level; l++) xp += 20 + l * 10; return xp; };
    const x0 = lv();
    for (let i = 0; i < 30; i++) feed(p, 'puddlepup', T0 + i);
    expect(lv() - x0).toBe(XP_DAY);
  });
  it('the well and the visitors together give no more than the day\'s few shells', () => {
    const p = withPals();
    advOf(p).shells += 2000;
    buyAndPlace(p, 'well', 2, 1, 0, T0); buyAndPlace(p, 'sundais', -3, 1, 0, T0); buyAndPlace(p, 'tidepond', 2, -2, 0, T0);
    expect(canWish(islandOf(p), T0)).toBe(true);
    let first = 0;
    for (let d = 0; d < 20; d++) {
      const s0 = advView(p).shells, now = T0 + d * DAY;
      for (let i = 0; i < 5; i++) checkVisitor(p, now + i * VISIT_GAP, mulberry32(d * 7 + i));
      const w = wishAtWell(p, now + 1000, mulberry32(d));
      expect(w).not.toBeNull();
      if (w!.first) first++;
      expect(wishAtWell(p, now + 2000, mulberry32(d + 1))).toBeNull();
      // pets, treats and wishes on top give none
      pet(p, 'puddlepup', now); fetched(p, 'sproutbun', now);
      expect(advView(p).shells - s0).toBeLessThanOrEqual(GIFT_SHELLS_DAY);
    }
    expect(first).toBe(1);
  });
  it('friendship, treats and secrets merge across computers', () => {
    const p = withPals(), base = structuredClone(islandOf(p));
    const a = structuredClone(base), b = structuredClone(base);
    a.friends = { puddlepup: 30 }; a.treats = 5; a.secrets = { chest: T0 }; a.mats = [20];
    b.friends = { puddlepup: 10, sproutbun: 20 }; b.treats = 2; b.secrets = { night: T0 + 5 };
    put(a as unknown as Save, B(-6, 0, 4));
    const m = mergeIsland(a, b, base, true, add);
    expect(m.friends).toEqual({ puddlepup: 30, sproutbun: 20 });
    expect(m.treats).toBe(7);
    expect(Object.keys(m.secrets).sort()).toEqual(['chest', 'night']);
    expect(m.mats).toEqual([20]);
    expect(blockCount(m.blocks)).toBe(1);
  });
  it('the build stats count towers, bridges and houses', () => {
    const s = land();
    put(s, B(0, 0, 0), B(0, 1, 0), B(0, 2, 0), B(0, 3, 0), B(8, 0, 0), B(9, 0, 0), B(10, 0, 0));
    const st = statsOf(s.blocks, 5);
    expect(st).toMatchObject({ count: 7, tallest: 4, off: 2 });
    void GLIMMER;
  });
});
