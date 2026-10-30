// Walking the trails (trails.ts) with the progress in a save: which trails can be walked, where the gates
// stand (in front of a stop that isn't open yet), which way a push of the keys or the joystick goes,
// and the way to a tapped stop. Pure: the screen (ui/MapWalker.svelte) moves the buddy along what this
// works out.
import { NODE, currentNode, nodeOpen, nodesOf, type Adventure, type WorldId } from './state';
import { legLength, other, setOff, trailsOf, type MapKind, type Pt, type TrailEdge, type Trails } from './trails';

export type Ctx = { tr: Trails; kind: MapKind; size: readonly [number, number]; a: Adventure };
export const ctxOf = (world: WorldId, kind: MapKind, size: readonly [number, number], a: Adventure): Ctx => ({ tr: trailsOf(world), kind, size, a });

/** A stop that isn't open yet: a gate stands on the trail in front of it. */
export function locked(c: Ctx, id: string): boolean {
  const p = c.tr.point[id];
  return !!p && p.kind === 'stop' && !nodeOpen(c.a, NODE[id]);
}
/** A hidden spot's trail can be walked once the spot is found. */
export const usable = (c: Ctx, e: TrailEdge) => !e.hidden || !!c.a.hidden?.includes(e.b);
/** how far before a locked stop its gate stands (the picture's pixels) */
export const gateGap = (c: Ctx, len: number) => Math.min(len * 0.45, 0.065 * Math.min(c.size[0], c.size[1]));
/** How far along a trail from `from` the buddy can go: all the way, or up to the gate. */
export function reach(c: Ctx, e: TrailEdge, from: string): number {
  const L = legLength(c.tr, e, c.kind, c.size);
  return locked(c, other(e, from)) ? L - gateGap(c, L) : L;
}

/** Every point the buddy can walk to from `start` now (never into a locked stop). */
export function reachable(c: Ctx, start: string): Set<string> {
  const seen = new Set([start]), todo = [start];
  while (todo.length) {
    const p = todo.pop()!;
    for (const e of c.tr.out[p] ?? []) {
      if (!usable(c, e)) continue;
      const q = other(e, p);
      if (seen.has(q) || locked(c, q)) continue;
      seen.add(q); todo.push(q);
    }
  }
  return seen;
}

/** One trail walked: from a point toward another, `len` long, stopping `stop` along (a gate: less than len). */
export type Leg = { e: TrailEdge; from: string; to: string; len: number; stop: number };
export function legOf(c: Ctx, e: TrailEdge, from: string): Leg {
  return { e, from, to: other(e, from), len: legLength(c.tr, e, c.kind, c.size), stop: reach(c, e, from) };
}

/** The shortest way from a point to a point, trail by trail; a locked target ends at its gate. null: no way. */
export function route(c: Ctx, from: string, to: string): Leg[] | null {
  if (from === to) return [];
  const dist = new Map<string, number>([[from, 0]]), prev = new Map<string, { p: string; e: TrailEdge }>();
  const open = new Set([from]);
  const target = locked(c, to) ? null : to;
  let best: { p: string; e: TrailEdge | null; d: number } | null = null;
  while (open.size) {
    let p = '', dp = Infinity;
    for (const q of open) { const d = dist.get(q)!; if (d < dp) { dp = d; p = q; } }
    open.delete(p);
    if (best && dp >= best.d) break;
    if (p === target) { best = { p, e: null, d: dp }; break; }
    for (const e of c.tr.out[p] ?? []) {
      if (!usable(c, e)) continue;
      const q = other(e, p), L = legLength(c.tr, e, c.kind, c.size);
      // a locked target: walk up to its gate
      if (q === to && !target) { const d = dp + L - gateGap(c, L); if (!best || d < best.d) best = { p, e, d }; continue; }
      if (locked(c, q)) continue;
      if (dp + L < (dist.get(q) ?? Infinity)) { dist.set(q, dp + L); prev.set(q, { p, e }); open.add(q); }
    }
  }
  if (!best) return null;
  const legs: Leg[] = [];
  if (best.e) legs.push(legOf(c, best.e, best.p));
  for (let p = best.p; p !== from;) { const s = prev.get(p)!; legs.unshift(legOf(c, s.e, s.p)); p = s.p; }
  return legs;
}

/** The trail leaving a point most nearly the way you push (screen x, y down; unit), or null. */
export function pickTrail(c: Ctx, at: string, dir: Pt): TrailEdge | null {
  let best: TrailEdge | null = null, bd = 0.3;
  for (const e of c.tr.out[at] ?? []) {
    if (!usable(c, e)) continue;
    const [x, y] = setOff(c.tr, e, at, c.kind, c.size), d = x * dir[0] + y * dir[1];
    if (d > bd) { bd = d; best = e; }
  }
  return best;
}

/** Where the buddy starts in a world: where it was standing (if it can still stand there), else the next
 *  stop, else the Champion. An older save (no place) starts on its next stop: its progress is unchanged. */
export function startPoint(c: Ctx, world: WorldId): string {
  const list = nodesOf(world), first = list[0].id;
  const next = currentNode(c.a, world)?.id ?? list[list.length - 1].id;
  const was = c.a.walkAt?.[world];
  const home = reachable(c, first);
  if (was && c.tr.point[was] && home.has(was)) return was;
  return home.has(next) ? next : first;
}
