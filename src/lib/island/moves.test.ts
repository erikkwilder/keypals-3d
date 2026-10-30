// My Sky Island: the buddy's own moves on what's built (it steps up on to a block, jumps up two, can't
// walk through them), and what the E key works on (homes to go into, trees and the lookout to climb).
import { describe, expect, it } from 'vitest';
import { BLOCK, BUDDY_STEP, JUMP_UP, STEP, ctxOf, findPath, floorAt, keyOf, placeBlock, walk, wallAt, worldOf, type Block, type World } from './blocks';
import { CLIMB, HOMES, ITEM } from './catalog';
import { keepOutOf, rocksOf } from './secrets';

type Save = { blocks: string; placed: Record<string, { item: string; x: number; z: number; rot: 0 | 1 | 2 | 3 }>; mats: number[] };
const land = (): Save => ({ blocks: '', placed: {}, mats: [] });
const B = (x: number, y: number, z: number, p = 14): Block => ({ x, y, z, s: 'cube', r: 0, p });
function put(s: Save, ...bs: Block[]) { for (const b of bs) { const r = placeBlock(s, ctxOf(s, 5, keepOutOf(5)), b); if (!r.ok) throw new Error(`${r.why} at ${keyOf(b.x, b.y, b.z)}`); } }
const world = (s: Save): World => { const k = rocksOf(5); return worldOf(s.blocks, [k.cave, k.sky], 5.35); };

describe('the buddy on the blocks', () => {
  it('steps up on to one block, but two blocks are a wall it has to jump', () => {
    const s = land();
    // a row of blocks one high at x 2..3, and two high at x 6..7 (blocks), in the z = 0 row
    for (let z = -1; z <= 1; z++) put(s, B(2, 0, z), B(3, 0, z), B(6, 0, z), B(6, 1, z), B(7, 0, z), B(7, 1, z));
    const w = world(s);
    // the buddy walks east from the grass: up on to the one-high blocks (a Glimmer's smaller step can't)
    const me = { x: 0.4, y: 0, z: 0.25 };
    walk(w, me, { x: 1, z: 0 }, 0.9, 0.15, BUDDY_STEP);
    expect(me.y).toBeCloseTo(BLOCK, 5);
    const glim = { x: 0.4, y: 0, z: 0.25 };
    walk(w, glim, { x: 1, z: 0 }, 0.9, 0.15, STEP);
    expect(glim.y).toBe(0);
    expect(glim.x).toBeLessThan(1);
    // off the far side, then the two-high stack stops it: it can't walk through
    walk(w, me, { x: 1, z: 0 }, 4, 0.15, BUDDY_STEP);
    expect(me.y).toBe(0);
    expect(me.x).toBeLessThan(3);
    expect(wallAt(w, 3.1, 0.25, 0, BUDDY_STEP)).toBe(true);
  });
  it('jumps high enough to land on two blocks, not three', () => {
    expect(JUMP_UP).toBeGreaterThan(2 * BLOCK);
    expect(JUMP_UP).toBeLessThan(3 * BLOCK);
    const s = land();
    put(s, B(4, 0, 0), B(4, 1, 0), B(6, 0, 0), B(6, 1, 0), B(6, 2, 0));
    const w = world(s);
    // at the top of a jump, the feet are over a two-high stack's top, and under a three-high one's
    expect(floorAt(w, 2.25, 0.25, JUMP_UP, 0.02)).toBeCloseTo(2 * BLOCK, 5);
    expect(floorAt(w, 3.25, 0.25, JUMP_UP, 0.02)).toBeNull();
  });
  it('a tap on a one-high roof walks the buddy up without a ramp (its step), but not a Glimmer', () => {
    const s = land();
    for (let x = 2; x <= 4; x++) for (let z = -1; z <= 1; z++) put(s, B(x, 0, z));
    const w = world(s), from = { x: 2, y: 0, z: 2.5 }, to = { x: 1.75, y: 0.5, z: 0.25 };
    expect(findPath(w, from, to)).toBeNull();
    const path = findPath(w, from, to, () => false, 6000, BUDDY_STEP);
    expect(path).not.toBeNull();
    expect(path!.at(-1)!.y).toBeCloseTo(BLOCK, 5);
  });
});

describe('what the E key works on', () => {
  it('homes to go into and things to climb are all in the catalogue (and nothing is both)', () => {
    for (const id of HOMES) expect(ITEM[id]?.kind, id).toBe('home');
    for (const id of CLIMB) expect(ITEM[id], id).toBeTruthy();
    for (const id of CLIMB) expect(HOMES.has(id)).toBe(false);
    // every home you can buy has a room
    for (const i of Object.values(ITEM)) if (i.kind === 'home') expect(HOMES.has(i.id), i.id).toBe(true);
    // every tree with a trunk can be climbed
    for (const i of Object.values(ITEM)) if (i.kind === 'nature' && i.trunk) expect(CLIMB.has(i.id), i.id).toBe(true);
  });
});
