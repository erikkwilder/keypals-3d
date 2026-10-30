// Building with blocks on My Sky Island: snap-together pieces half a metre on a side (a square of the island
// is two by two of them, and the buddy is about two and a half blocks tall). Cubes, half blocks, ramps,
// stairs, arches, round pillars, fences, windows, doors and glass, in a paint box of colours and a few
// textures (wood, stone, brick, hedge, roof tiles). Basic blocks are free and plentiful so a child can build
// big; the special paints (crystal, gold, glowing, cloud) are found in the island's secrets or bought for a
// few shells.
//
// Blocks stack and can stand on each other anywhere on the island's squares that a thing isn't standing on;
// off the edge they have to join on to another block (a bridge), up to REACH metres out. The save keeps them
// as one short string, five letters a block (where, which piece turned which way, which paint), so even a
// full island (MAX_BLOCKS) stays a few kilobytes; two computers' copies merge block by block.
//
// The walking rules are here too, as plain numbers: where the ground is under a point (the grass, the top of
// a block, partway up a ramp), whether something is in the way at body height, a step with sliding along
// walls, and a short path finder so a tap on a roof walks round to the ramp. The buddy and the Glimmers use
// them (three/islandScene.ts); island.test.ts checks them.
import { ITEM } from './catalog';
import type { Rot } from './save';

/** a block's size, in metres */
export const BLOCK = 0.5;
/** the most blocks on an island (a few kilobytes in the save) */
export const MAX_BLOCKS = 600;
/** how high you can build, in blocks (8 metres) */
export const MAX_LAYERS = 16;
/** how far past the island's edge a bridge can reach, in metres */
export const REACH = 6;
/** how high a walker steps up without a ramp (a half block is fine, a whole one is a wall) */
export const STEP = 0.3;
/** the room a walker needs over its head */
export const CLEAR = 0.95;
/** round a walker's middle, how high something can be before it bumps into it (less than a block) */
const BODY_STEP = 0.42;

// ---------- the pieces ----------
export type ShapeId = 'cube' | 'half' | 'ramp' | 'stairs' | 'arch' | 'pillar' | 'fence' | 'window' | 'door' | 'glass';
export type ShapeDef = { id: ShapeId; name: string; blurb: string; tall: number };
/** (the order is the save's: add new pieces at the end) */
export const SHAPES: ShapeDef[] = [
  { id: 'cube', name: 'Block', blurb: 'A whole block. Stack them up!', tall: 1 },
  { id: 'half', name: 'Half block', blurb: 'Half as tall. Good for steps.', tall: 1 },
  { id: 'ramp', name: 'Ramp', blurb: 'Walk up it! Turn it to point the way up.', tall: 1 },
  { id: 'stairs', name: 'Stairs', blurb: 'Two steps up.', tall: 1 },
  { id: 'arch', name: 'Arch', blurb: 'Put it over a gap for a doorway.', tall: 1 },
  { id: 'pillar', name: 'Pillar', blurb: 'A round column.', tall: 1 },
  { id: 'fence', name: 'Fence', blurb: 'A little fence.', tall: 1 },
  { id: 'window', name: 'Window', blurb: 'It lights up at night.', tall: 1 },
  { id: 'door', name: 'Door', blurb: 'Two blocks tall. Walk through it!', tall: 2 },
  { id: 'glass', name: 'Glass', blurb: 'See right through it.', tall: 1 },
];
export const SHAPE = Object.fromEntries(SHAPES.map(s => [s.id, s])) as Record<ShapeId, ShapeDef>;
const SHAPE_N = new Map(SHAPES.map((s, i) => [s.id, i]));

// ---------- the paint box ----------
export type PaintKind = 'plain' | 'wood' | 'stone' | 'brick' | 'leaf' | 'roof' | 'crystal' | 'gold' | 'glow' | 'cloud';
export type PaintDef = { id: number; name: string; kind: PaintKind; color: number; special?: { price: number; secret: string } };
/** (the order is the save's: add new paints at the end) */
export const PAINTS: PaintDef[] = [
  { id: 0, name: 'White', kind: 'plain', color: 0xfbf7ee },
  { id: 1, name: 'Cream', kind: 'plain', color: 0xf4dfb4 },
  { id: 2, name: 'Red', kind: 'plain', color: 0xe8584f },
  { id: 3, name: 'Orange', kind: 'plain', color: 0xf59a3c },
  { id: 4, name: 'Yellow', kind: 'plain', color: 0xf8d64e },
  { id: 5, name: 'Lime', kind: 'plain', color: 0xa6d84f },
  { id: 6, name: 'Green', kind: 'plain', color: 0x4fae5a },
  { id: 7, name: 'Teal', kind: 'plain', color: 0x3fc1b0 },
  { id: 8, name: 'Sky', kind: 'plain', color: 0x7cc8f2 },
  { id: 9, name: 'Blue', kind: 'plain', color: 0x4a78d8 },
  { id: 10, name: 'Purple', kind: 'plain', color: 0x9b6ad8 },
  { id: 11, name: 'Pink', kind: 'plain', color: 0xf58ab8 },
  { id: 12, name: 'Brown', kind: 'plain', color: 0x9a6a44 },
  { id: 13, name: 'Grey', kind: 'plain', color: 0xa9a7a4 },
  { id: 14, name: 'Wood', kind: 'wood', color: 0xffffff },
  { id: 15, name: 'Stone', kind: 'stone', color: 0xffffff },
  { id: 16, name: 'Brick', kind: 'brick', color: 0xffffff },
  { id: 17, name: 'Hedge', kind: 'leaf', color: 0xffffff },
  { id: 18, name: 'Roof tiles', kind: 'roof', color: 0xffffff },
  { id: 19, name: 'Crystal', kind: 'crystal', color: 0xd9a8ff, special: { price: 60, secret: 'cave' } },
  { id: 20, name: 'Gold', kind: 'gold', color: 0xf5c542, special: { price: 80, secret: 'chest' } },
  { id: 21, name: 'Glowing', kind: 'glow', color: 0xffd36b, special: { price: 40, secret: 'night' } },
  { id: 22, name: 'Cloud', kind: 'cloud', color: 0xffffff, special: { price: 40, secret: 'skyrock' } },
];
export const SPECIAL = PAINTS.filter(p => p.special);
/** the paint a new builder starts with */
export const FIRST_PAINT = 14;

// ---------- one block ----------
export type Block = { x: number; y: number; z: number; s: ShapeId; r: Rot; p: number };
/** the letters a block is written with (printable, nothing JSON has to escape) */
const ALPHA = (() => { let a = ''; for (let c = 0x21; c <= 0x7e; c++) if (c !== 0x22 && c !== 0x5c) a += String.fromCharCode(c); return a; })();
const IDX = new Map([...ALPHA].map((c, i) => [c, i]));
const OFF = Math.floor(ALPHA.length / 2);
/** the furthest a block can be from the middle, in blocks either way */
export const SPAN = OFF - 1;
export const keyOf = (x: number, y: number, z: number) => `${x},${y},${z}`;
export const colKey = (x: number, z: number) => `${x},${z}`;
function enc(b: Block): string {
  return ALPHA[b.x + OFF] + ALPHA[b.y] + ALPHA[b.z + OFF] + ALPHA[(SHAPE_N.get(b.s) ?? 0) * 4 + b.r] + ALPHA[b.p];
}
function dec(c: string): Block | null {
  if (c.length !== 5) return null;
  const n = [...c].map(ch => IDX.get(ch));
  if (n.some(v => v === undefined)) return null;
  const [x, y, z, sr, p] = n as number[];
  const shape = SHAPES[sr >> 2];
  if (!shape || !PAINTS[p]) return null;
  return { x: x - OFF, y, z: z - OFF, s: shape.id, r: (sr & 3) as Rot, p };
}
export const codeOf = enc;
export const blockOf = dec;

// ---------- the save: decoding, remembered ----------
type Built = { map: Map<string, Block>; occ: Map<string, string>; cols: Map<string, Block[]> };
const MEMO = new Map<string, Built>();
/** Every block, by the key of its square ("x,y,z"), and which squares are taken (a door takes two). Read
 *  only: the result is shared. */
export function builtOf(str: string | undefined): Built {
  const s = str ?? '';
  let b = MEMO.get(s);
  if (b) return b;
  const map = new Map<string, Block>();
  for (let i = 0; i + 5 <= s.length; i += 5) { const bl = dec(s.slice(i, i + 5)); if (bl) map.set(keyOf(bl.x, bl.y, bl.z), bl); }
  b = index(map);
  if (MEMO.size > 6) MEMO.delete(MEMO.keys().next().value!);
  MEMO.set(s, b);
  return b;
}
function index(map: Map<string, Block>): Built {
  const occ = new Map<string, string>(), cols = new Map<string, Block[]>();
  for (const [k, b] of map) {
    for (let t = 0; t < SHAPE[b.s].tall; t++) occ.set(keyOf(b.x, b.y + t, b.z), k);
    const ck = colKey(b.x, b.z);
    let c = cols.get(ck); if (!c) cols.set(ck, (c = []));
    c.push(b);
  }
  for (const c of cols.values()) c.sort((a, b) => a.y - b.y);
  return { map, occ, cols };
}
/** Write blocks back as the save's string (in a steady order, so the same blocks always read the same). */
export function encode(map: Map<string, Block>): string {
  return [...map.values()].sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x).map(enc).join('');
}
export const blockList = (str: string | undefined) => [...builtOf(str).map.values()];
export const blockCount = (str: string | undefined) => builtOf(str).map.size;

/** the square of the island (catalog things' grid) a block column stands in */
export const cellOfCol = (x: number) => Math.floor((x + 1) / 2);
/** the middle of a block column, in metres */
export const colMid = (x: number) => (x + 0.5) * BLOCK;
/** the island's squares with a block in them (things can't go there) */
export function blockCells(str: string | undefined): Set<string> {
  const out = new Set<string>();
  for (const b of builtOf(str).map.values()) out.add(`${cellOfCol(b.x)},${cellOfCol(b.z)}`);
  return out;
}

// ---------- building ----------
/** What building needs from the island: its size, the squares things stand on, the paints unlocked, and
 *  places blocks can't go (the secret rocks). */
export type BuildCtx = { r: number; things: Set<string>; mats: number[]; keepOut?: (x: number, y: number, z: number) => boolean };
type Save = { blocks?: string; placed: Record<string, { item: string; x: number; z: number; rot: Rot }>; mats?: number[] };
/** the squares things stand on */
export function thingCells(s: Save): Set<string> {
  const out = new Set<string>();
  for (const pl of Object.values(s.placed)) {
    const it = ITEM[pl.item]; if (!it) continue;
    const w = pl.rot % 2 ? it.d : it.w, d = pl.rot % 2 ? it.w : it.d;
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) out.add(`${pl.x + i},${pl.z + j}`);
  }
  return out;
}
export const ctxOf = (s: Save, r: number, keepOut?: BuildCtx['keepOut']): BuildCtx => ({ r, things: thingCells(s), mats: s.mats ?? [], keepOut });
export const paintOk = (mats: number[], p: number) => !!PAINTS[p] && (!PAINTS[p].special || mats.includes(p));
const onIsland = (i: number, j: number, r: number) => Math.hypot(i, j) <= r - 0.5;
const SIDES: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

export type Op = { key: string; before: string | null; after: string | null };
export type BuildResult = { ok: true; op: Op } | { ok: false; why: string };

/** Can a block go here? (`but`: a block being changed, which doesn't count as in the way) */
export function canPlace(str: string | undefined, ctx: BuildCtx, b: Block, but?: string): { ok: true } | { ok: false; why: string } {
  const { map, occ } = builtOf(str);
  const sh = SHAPE[b.s];
  if (!sh || !PAINTS[b.p] || b.r < 0 || b.r > 3 || !Number.isInteger(b.x) || !Number.isInteger(b.y) || !Number.isInteger(b.z)) return { ok: false, why: 'That piece doesn\'t fit.' };
  if (!paintOk(ctx.mats, b.p)) return { ok: false, why: `Find or buy ${PAINTS[b.p].name.toLowerCase()} blocks first.` };
  if (b.y < 0 || b.y + sh.tall > MAX_LAYERS) return { ok: false, why: 'That\'s as high as you can build!' };
  if (Math.abs(b.x) > SPAN || Math.abs(b.z) > SPAN) return { ok: false, why: 'That\'s too far out.' };
  if (!but && map.size >= MAX_BLOCKS) return { ok: false, why: `That's ${MAX_BLOCKS} blocks: the most an island can hold. Take some away to build more.` };
  for (let t = 0; t < sh.tall; t++) { const o = occ.get(keyOf(b.x, b.y + t, b.z)); if (o && o !== but) return { ok: false, why: 'There\'s a block there already.' }; }
  const i = cellOfCol(b.x), j = cellOfCol(b.z), on = onIsland(i, j, ctx.r);
  if (on && ctx.things.has(`${i},${j}`)) return { ok: false, why: 'Something is standing there.' };
  if (!on && Math.hypot(colMid(b.x), colMid(b.z)) > ctx.r + 0.95 + REACH) return { ok: false, why: 'That\'s too far out.' };
  for (let t = 0; t < sh.tall; t++) if (ctx.keepOut?.(b.x, b.y + t, b.z)) return { ok: false, why: 'A rock is in the way.' };
  // on the island's grass, or joined on to another block (off the edge: a bridge)
  if (!(on && b.y === 0)) {
    let joined = false;
    for (let t = 0; t < sh.tall && !joined; t++) for (const [dx, dy, dz] of SIDES) {
      const o = occ.get(keyOf(b.x + dx, b.y + t + dy, b.z + dz));
      if (o && o !== but) { joined = true; break; }
    }
    if (!joined) return { ok: false, why: on ? 'Put it on the ground or on another block.' : 'Build out from a block, like a bridge.' };
  }
  return { ok: true };
}
function write(s: Save, map: Map<string, Block>) { s.blocks = encode(map); }
/** Put a block down (inside game.update). */
export function placeBlock(s: Save, ctx: BuildCtx, b: Block): BuildResult {
  const c = canPlace(s.blocks, ctx, b);
  if (!c.ok) return c;
  const map = new Map(builtOf(s.blocks).map), key = keyOf(b.x, b.y, b.z);
  map.set(key, { ...b });
  write(s, map);
  return { ok: true, op: { key, before: null, after: enc(b) } };
}
/** Take a block away (by the key of any square it fills). */
export function removeBlock(s: Save, key: string): BuildResult {
  const { map, occ } = builtOf(s.blocks), k = occ.get(key) ?? key, b = map.get(k);
  if (!b) return { ok: false, why: 'There\'s no block there.' };
  const next = new Map(map); next.delete(k);
  write(s, next);
  return { ok: true, op: { key: k, before: enc(b), after: null } };
}
/** Paint a block. */
export function paintBlock(s: Save, ctx: BuildCtx, key: string, p: number): BuildResult {
  const { map, occ } = builtOf(s.blocks), k = occ.get(key) ?? key, b = map.get(k);
  if (!b) return { ok: false, why: 'There\'s no block there.' };
  if (!paintOk(ctx.mats, p)) return { ok: false, why: `Find or buy ${PAINTS[p]?.name.toLowerCase() ?? 'that paint'} first.` };
  if (b.p === p) return { ok: false, why: 'It\'s that colour already.' };
  const nb = { ...b, p }, next = new Map(map); next.set(k, nb);
  write(s, next);
  return { ok: true, op: { key: k, before: enc(b), after: enc(nb) } };
}
/** Turn a block a quarter. */
export function turnBlock(s: Save, key: string): BuildResult {
  const { map, occ } = builtOf(s.blocks), k = occ.get(key) ?? key, b = map.get(k);
  if (!b) return { ok: false, why: 'There\'s no block there.' };
  const nb = { ...b, r: ((b.r + 1) % 4) as Rot }, next = new Map(map); next.set(k, nb);
  write(s, next);
  return { ok: true, op: { key: k, before: enc(b), after: enc(nb) } };
}
/** Undo a change: what was there before comes back (if its squares are still free). */
export function undoOp(s: Save, op: Op): boolean {
  const { map, occ } = builtOf(s.blocks), next = new Map(map);
  next.delete(op.key);
  if (op.before) {
    const b = dec(op.before);
    if (!b) return false;
    for (let t = 0; t < SHAPE[b.s].tall; t++) { const o = occ.get(keyOf(b.x, b.y + t, b.z)); if (o && o !== op.key) return false; }
    if (next.size >= MAX_BLOCKS) return false;
    next.set(op.key, b);
  }
  write(s, next);
  return true;
}

// ---------- two computers ----------
/** Combine two copies' blocks with the copy both started from: a block added on either stays, one taken
 *  away on either goes, one changed on both keeps the newer copy's; squares two blocks both claim (a door
 *  over a new block) keep the newer copy's, and the total stays within MAX_BLOCKS. */
export function mergeBlocks(m: string | undefined, t: string | undefined, b: string | undefined, mineNewer: boolean): string {
  const M = builtOf(m).map, T = builtOf(t).map, B = builtOf(b).map;
  const n = mineNewer ? M : T, o = mineNewer ? T : M;
  const out = new Map<string, Block>();
  for (const k of new Set([...M.keys(), ...T.keys()])) {
    const x = n.get(k), y = o.get(k), base = B.get(k);
    // changed on both: the one that changed from the shared copy (both: the newer's)
    if (x && y) out.set(k, base && enc(x) === enc(base) ? y : x);
    else if (x || y) { const one = (x ?? y)!; if (!base || enc(base) !== enc(one)) out.set(k, one); }
  }
  // the newer copy's blocks first, then the other's, each only where its squares are free
  const keep = new Map<string, Block>(), taken = new Set<string>();
  const order = [...out.entries()].sort(([ka], [kb]) => (n.has(kb) ? 1 : 0) - (n.has(ka) ? 1 : 0));
  for (const [k, bl] of order) {
    if (keep.size >= MAX_BLOCKS) break;
    const sq = Array.from({ length: SHAPE[bl.s].tall }, (_, i) => keyOf(bl.x, bl.y + i, bl.z));
    if (sq.some(q => taken.has(q))) continue;
    sq.forEach(q => taken.add(q)); keep.set(k, bl);
  }
  return encode(keep);
}

// ---------- what's built, for wishes and secrets ----------
export type BuildStats = { count: number; top: number; off: number; doors: number; windows: number; ramps: number; glows: number; tallest: number };
export function statsOf(str: string | undefined, r: number): BuildStats {
  const { map, cols } = builtOf(str);
  let off = 0, doors = 0, windows = 0, ramps = 0, glows = 0, top = 0;
  for (const b of map.values()) {
    if (!onIsland(cellOfCol(b.x), cellOfCol(b.z), r)) off++;
    if (b.s === 'door') doors++;
    if (b.s === 'window') windows++;
    if (b.s === 'ramp' || b.s === 'stairs') ramps++;
    if (PAINTS[b.p]?.kind === 'glow') glows++;
    top = Math.max(top, b.y + SHAPE[b.s].tall);
  }
  // the tallest stack standing on the ground, counted in blocks from the grass
  let tallest = 0;
  for (const c of cols.values()) { let h = 0; for (const b of c) { if (b.y !== h) break; h += SHAPE[b.s].tall; } tallest = Math.max(tallest, h); }
  return { count: map.size, top, off, doors, windows, ramps, glows, tallest };
}

// ---------- walking ----------
/** a flat-topped rock a walker can stand on (the secret rocks off the edge) */
export type Rock = { x: number; z: number; r: number; top: number };
/** What a walker walks on: the blocks by column, the rocks, and the island's grass (a circle). */
export type World = { cols: Map<string, Block[]>; rocks: Rock[]; groundR: number };
export const worldOf = (str: string | undefined, rocks: Rock[], groundR: number): World => ({ cols: builtOf(str).cols, rocks, groundR });

const C = [1, 0, -1, 0], S = [0, 1, 0, -1];
/** A point in a block's own frame (it faces +z when not turned; turned like the island's things). */
export function toLocal(wx: number, wz: number, r: Rot): [number, number] { return [wx * C[r] + wz * S[r], -wx * S[r] + wz * C[r]]; }
/** How high the solid part of a block reaches at a point in its column (fx, fz from 0 to 1 across it),
 *  in blocks from its bottom; -1: nothing solid there (a doorway, beside a pillar). */
export function solidTop(b: Block, fx: number, fz: number): number {
  const [lx, lz] = toLocal(fx - 0.5, fz - 0.5, b.r);
  switch (b.s) {
    case 'half': return 0.5;
    // a ramp rises from its front (+z) to its back
    case 'ramp': return Math.max(0, Math.min(1, 0.5 - lz));
    // two steps: the low one at the front
    case 'stairs': return lz >= 0 ? 0.5 : 1;
    case 'pillar': return Math.hypot(lx, lz) <= 0.4 ? 1 : -1;
    case 'fence': return Math.abs(lz) <= 0.14 ? 1 : -1;
    case 'door': return -1;
    default: return 1;
  }
}
/** The solid things at a point, bottom to top, in metres: blocks, rocks, the grass. */
export function spansAt(w: World, wx: number, wz: number): [number, number][] {
  const out: [number, number][] = [];
  if (Math.hypot(wx, wz) <= w.groundR) out.push([-1e9, 0]);
  for (const k of w.rocks) if (Math.hypot(wx - k.x, wz - k.z) <= k.r) out.push([-1e9, k.top]);
  const cx = Math.floor(wx / BLOCK), cz = Math.floor(wz / BLOCK), col = w.cols.get(colKey(cx, cz));
  if (col) {
    const fx = wx / BLOCK - cx, fz = wz / BLOCK - cz;
    for (const b of col) { const t = solidTop(b, fx, fz); if (t > 0) out.push([b.y * BLOCK, (b.y + t) * BLOCK]); }
  }
  return out;
}
/** Where a walker with its feet at `feetY` would stand at a point: the highest solid top it can step up to
 *  with room over its head; null if there's nowhere (a wall, or off the edge). */
export function floorAt(w: World, wx: number, wz: number, feetY: number, step = STEP, clear = CLEAR): number | null {
  const sp = spansAt(w, wx, wz);
  let best: number | null = null;
  for (const [, t] of sp) {
    if (t > feetY + step + 1e-6 || (best !== null && t <= best)) continue;
    if (sp.some(([c0, c1]) => c1 > t + 1e-6 && c0 < t + clear - 1e-6)) continue;
    best = t;
  }
  return best;
}
/** Is something solid at body height at a point (above a step, below the head)? */
export function wallAt(w: World, wx: number, wz: number, feetY: number, step = STEP, clear = CLEAR): boolean {
  return spansAt(w, wx, wz).some(([c0, c1]) => c1 > feetY + step + 1e-6 && c0 < feetY + clear - 1e-6);
}
export type P3 = { x: number; y: number; z: number };
/** Move a walker by (dx, dz) if it can go there: ground under its middle, nothing at body height round its
 *  front. Its feet go up a step or a ramp at once (falling is `fall`). */
export function tryMove(w: World, p: P3, dx: number, dz: number, r = 0.15, step = STEP, clear = CLEAR): boolean {
  const nx = p.x + dx, nz = p.z + dz;
  const f = floorAt(w, nx, nz, p.y, step, clear);
  if (f === null) return false;
  // round its front, anything higher than a big step is in the way (the side of a ramp isn't: a whole block is)
  const len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len, feet = Math.max(f, p.y), body = Math.max(step, BODY_STEP);
  for (const a of [-1.2, -0.6, 0, 0.6, 1.2]) {
    const c = Math.cos(a), s = Math.sin(a);
    if (wallAt(w, nx + (ux * c - uz * s) * r, nz + (ux * s + uz * c) * r, feet, body, clear)) return false;
  }
  p.x = nx; p.z = nz;
  // up a step or a ramp, or down a ramp; a bigger drop is a fall
  if (f > p.y || p.y - f <= step) p.y = f;
  return true;
}
/** A walk of `dist` toward a direction, sliding along a wall it meets at an angle. Returns how far it got. */
export function walk(w: World, p: P3, dir: { x: number; z: number }, dist: number, r = 0.15, step = STEP, clear = CLEAR): number {
  if (dist <= 0) return 0;
  const x0 = p.x, z0 = p.z;
  // (in short hops, so a quick step can't jump over a thin fence)
  const n = Math.max(1, Math.ceil(dist / 0.1)), dx = (dir.x * dist) / n, dz = (dir.z * dist) / n;
  for (let i = 0; i < n; i++) {
    if (tryMove(w, p, dx, dz, r, step, clear)) continue;
    if (Math.abs(dx) > 1e-5 && tryMove(w, p, dx, 0, r, step, clear)) continue;
    if (Math.abs(dz) > 1e-5 && tryMove(w, p, 0, dz, r, step, clear)) continue;
    break;
  }
  return Math.hypot(p.x - x0, p.z - z0);
}
/** Gravity: down to the ground under its middle. Returns the new falling speed. */
export function fall(w: World, p: P3, vy: number, dt: number): number {
  const f = floorAt(w, p.x, p.z, p.y);
  if (f === null || f >= p.y - 1e-4) { if (f !== null && f > p.y) p.y = f; return 0; }
  vy += 9.8 * dt;
  p.y = Math.max(f, p.y - vy * dt);
  return p.y <= f + 1e-4 ? 0 : vy;
}
/** Someone a block was put on top of climbs out on to it (the lowest place with room, at or above their feet). */
export function standUp(w: World, p: P3): void {
  if (floorAt(w, p.x, p.z, p.y) !== null) return;
  const sp = spansAt(w, p.x, p.z), tops = sp.map(([, t]) => t).filter(t => t >= p.y).sort((a, b) => a - b);
  for (const t of tops) if (!sp.some(([c0, c1]) => c1 > t + 1e-6 && c0 < t + CLEAR - 1e-6)) { p.y = t; return; }
}
/** The ground at a point for someone standing on it now (the highest solid top at or a step above their feet). */
export const groundAt = (w: World, wx: number, wz: number, feetY = 0) => floorAt(w, wx, wz, feetY) ?? feetY;

/**
 * A path over the blocks from one point to another, square by square (half a metre), up ramps and steps and
 * down drops, round walls; `blocked` says a square's middle is taken by one of the island's things. The
 * points to walk through (the last is `to`), or null when there's no way there.
 */
export function findPath(w: World, from: P3, to: P3, blocked: (x: number, z: number, y: number) => boolean = () => false, maxNodes = 6000): P3[] | null {
  const cx = (v: number) => Math.floor(v / BLOCK), mid = (c: number) => (c + 0.5) * BLOCK;
  const sx = cx(from.x), sz = cx(from.z), tx = cx(to.x), tz = cx(to.z);
  const f0 = floorAt(w, mid(sx), mid(sz), from.y + 0.05) ?? from.y;
  type N = { x: number; z: number; y: number; prev: N | null };
  const key = (n: { x: number; z: number; y: number }) => `${n.x},${n.z},${Math.round(n.y * 20)}`;
  const start: N = { x: sx, z: sz, y: f0, prev: null };
  const seen = new Set([key(start)]), q: N[] = [start];
  let found: N | null = null;
  for (let h = 0; h < q.length && q.length < maxNodes; h++) {
    const n = q[h];
    if (n.x === tx && n.z === tz && Math.abs(n.y - to.y) < 0.35) { found = n; break; }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = n.x + dx, nz = n.z + dz;
      // through the edge between the two squares, then to the middle of the next
      const e = floorAt(w, mid(n.x) + dx * (BLOCK * 0.5 + 0.02), mid(n.z) + dz * (BLOCK * 0.5 + 0.02), n.y);
      if (e === null) continue;
      const f = floorAt(w, mid(nx), mid(nz), Math.max(e, n.y));
      if (f === null || blocked(mid(nx), mid(nz), f)) continue;
      const nn: N = { x: nx, z: nz, y: f, prev: n }, k = key(nn);
      if (seen.has(k)) continue;
      seen.add(k); q.push(nn);
    }
  }
  if (!found) return null;
  const pts: P3[] = [];
  for (let n: N | null = found; n && n.prev; n = n.prev) pts.unshift({ x: mid(n.x), y: n.y, z: mid(n.z) });
  if (pts.length) pts.pop();
  pts.push({ x: to.x, y: found.y, z: to.z });
  return pts;
}
/** High places to perch: the tops of stacks at least `min` metres up with room over them, highest first. */
export function perches(w: World, min = 1): P3[] {
  const out: P3[] = [];
  for (const col of w.cols.values()) {
    const b = col[col.length - 1], x = (b.x + 0.5) * BLOCK, z = (b.z + 0.5) * BLOCK;
    const f = floorAt(w, x, z, (b.y + SHAPE[b.s].tall) * BLOCK);
    if (f !== null && f >= min) out.push({ x, y: f, z });
  }
  return out.sort((a, b) => b.y - a.y);
}
