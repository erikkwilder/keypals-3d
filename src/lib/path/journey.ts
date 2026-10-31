// Journey mode on the Adventure maps: go on the adventure and it takes you step by step through a unit,
// from spot to spot, with no jumping between Learn, Practice and the rest. Free play is the same map with
// today's battles. A child's current math unit is a stretch of trail on its world's own map. The stops
// are that unit's items on My path, read from the same state in the same order, so there is no second
// list and no second progress: do a step on either one and it shows done on both.
//
//   warm-up, a book stand (Learn), a camp (Try it), a training ground (Practice), a flag (Quick check), a
//   Grumble to battle, an arcade tent, and the unit's Champion at the end
//
// A lesson's practice trip is one item on My path with two ticks, Try it and Practice (played to the end
// once, then moved on from): on the trail those two ticks are two stops, the camp and the training ground.
//
// A unit can be long, so the trail shows one day at a time: a stretch of a few stops on the world's main
// route, on the points its trails already have (trails.ts). No scenery is added or moved. The next day
// walks back the other way from where the last one ended, so the next stop is always close by, and the
// last stretch ends on the map's Champion spot.
import type { Profile } from '../engine/profile';
import { advOf, advView, cleared, nodeOpen, nodesOf, type Adventure, type MapNode, type WorldId } from '../adventure/state';
import { other, trailsOf } from '../adventure/trails';
import type { TrailWalk } from '../adventure/walk';
import { WORLD_PIN } from '../adventure/worlds';
import { nextOnPath, type ItemState, type UnitState } from './progress';
import { classUnits, playerRules } from './player.svelte';
import { worldForArea, type ItemKind, type Unit } from './units';

// ---------- which mode ----------
export type AdvMode = 'journey' | 'free';
/** Players made from this day on start in Journey; everyone before it keeps Free play until they tap Journey. */
export const JOURNEY_SINCE = Date.UTC(2026, 9, 31);
/** The mode a player chose, or the one they start in. */
export function modeOf(p: Profile): AdvMode {
  return p.adventure?.mode ?? ((p.createdAt ?? 0) >= JOURNEY_SINCE ? 'journey' : 'free');
}
/** `holds`: a grown-up or teacher is keeping the player to the path (rules.ts pathHolds): Journey it is,
 *  whatever the player chose, and their choice comes back when the rule ends. */
export const modeFor = (p: Profile, holds: boolean): AdvMode => (holds ? 'journey' : modeOf(p));
export function setMode(p: Profile, mode: AdvMode) { advOf(p).mode = mode; }

// ---------- the stops ----------
export type StopKind = 'warmup' | 'learn' | 'try' | 'practice' | 'quick' | 'battle' | 'game' | 'champion';
const KIND_STOP: Record<ItemKind, StopKind> = { warmup: 'warmup', learn: 'learn', practice: 'practice', quick: 'quick', battle: 'battle', game: 'game', check: 'champion' };
/** what each kind of stop is called */
export const STOP_WORD: Record<StopKind, string> = { warmup: 'Warm-up', learn: 'Learn', try: 'Try it', practice: 'Practice', quick: 'Quick check', battle: 'Battle', game: 'Arcade tent', champion: 'Champion' };
/** the picture on each kind of stop: the game's own pictures */
export const STOP_ICON: Record<StopKind, string> = { warmup: 'game/icon-sun.webp', learn: 'icons/book.webp', try: 'icons/pencil.webp', practice: 'icons/target.webp', quick: 'icons/flag.webp', battle: 'game/icon-grump.webp', game: 'icons/arcade.webp', champion: 'game/node-champion.webp' };
export type Stop = {
  /** the item's ref (the Try it of a trip: `<ref>/try`) */
  id: string; kind: StopKind; name: string; line: string; item: ItemState; day: number;
  /** done, or not needed ("You know this") */
  done: boolean;
  /** the one to do next */
  lit: boolean;
};
const stopName = (it: ItemState, k: StopKind) => (k === 'battle' ? 'Battle a Grumble' : k === 'champion' ? 'The unit\'s Champion' : it.name);

/** A unit's stops: My path's items, in My path's order (those it doesn't show, it doesn't show here either).
 *  The first not done is the lit one, the same item as the unit's `next`. */
export function stopsOf(s: UnitState): Stop[] {
  const out: Stop[] = [];
  const camped = new Set<string>();
  for (const it of s.items) {
    if (it.skip === 'nothing') continue;
    const k = KIND_STOP[it.kind], done = it.done || !!it.skip, day = it.day ?? 0;
    const base = { name: stopName(it, k), line: it.line, item: it, day, lit: false };
    // (a lesson's first trip is its Try it and its Practice; a lesson with a second trip goes straight on)
    if (k === 'practice' && it.lesson && !camped.has(it.lesson)) {
      camped.add(it.lesson);
      const tried = s.lessons.find(l => l.id === it.lesson)?.ticks.tryIt ?? false;
      out.push({ ...base, id: `${it.ref}/try`, kind: 'try', line: 'Have a go, with help the first time', done: done || tried });
    }
    out.push({ ...base, id: it.ref, kind: k, done });
  }
  const lit = out.find(x => !x.done);
  if (lit) lit.lit = true;
  return out;
}
/** Most stops on the trail at once (a world's main route has six points). */
export const STRETCH_MAX = 6;
/** The stops in stretches: a day each, a day too long for the trail in two. */
export function stretchesOf(stops: Stop[]): Stop[][] {
  const days: Stop[][] = [];
  for (const st of stops) {
    const last = days[days.length - 1];
    if (last && last[0].day === st.day) last.push(st); else days.push([st]);
  }
  return days.flatMap(d => {
    if (d.length <= STRETCH_MAX) return [d];
    const n = Math.ceil(d.length / STRETCH_MAX), size = Math.ceil(d.length / n);
    return Array.from({ length: n }, (_, i) => d.slice(i * size, (i + 1) * size));
  });
}

// ---------- the world and its trail ----------
/** The world a unit's stretch of trail is on. */
export function unitWorld(u: Unit): WorldId {
  const w = u.world ?? u.items.find(i => i.ref.startsWith('battle:'))?.ref.split(':')[1] ?? worldForArea(u.area);
  return (WORLD_PIN[w]?.map ? w : 'sky') as WorldId;
}
const routes = new Map<WorldId, string[]>();
/** The main route across a world: from its first stop to its last by the fewest points, on trails and
 *  points it already has (side trails to finds and the second route are left out). */
export function routeOf(world: WorldId): string[] {
  const known = routes.get(world);
  if (known) return known;
  const tr = trailsOf(world), list = nodesOf(world), from = list[0].id, to = list[list.length - 1].id;
  const prev = new Map<string, string>([[from, '']]), todo = [from];
  while (todo.length && !prev.has(to)) {
    const q = todo.shift()!;
    for (const e of tr.out[q] ?? []) {
      const n = other(e, q), k = tr.point[n].kind;
      if (e.hidden || prev.has(n) || (k !== 'stop' && k !== 'join')) continue;
      prev.set(n, q); todo.push(n);
    }
  }
  const out: string[] = [];
  for (let q = to; q; q = prev.get(q) ?? '') out.unshift(q);
  routes.set(world, out);
  return out;
}
/** A route in stretches of its six points (the Sky Islands' long route takes three). */
function legsOf(route: string[]): string[][] {
  if (route.length <= STRETCH_MAX) return [route];
  const out: string[][] = [];
  for (let i = 0; i + STRETCH_MAX < route.length; i += STRETCH_MAX - 1) out.push(route.slice(i, i + STRETCH_MAX));
  out.push(route.slice(-STRETCH_MAX));
  return out;
}
/** `n` points spread along a stretch, first to last. */
const spread = (pts: string[], n: number) => (n <= 1 ? [pts[0]] : Array.from({ length: n }, (_, i) => pts[Math.round((i * (pts.length - 1)) / (n - 1))]));
/** One stretch's way along the route: there, then back the way it came, there again... */
function stretchWay(route: string[], page: number): string[] {
  const legs = legsOf(route), both = [...legs, ...[...legs].reverse().map(l => [...l].reverse())];
  return both[page % both.length];
}
/** The trail points of a stretch's stops. The buddy stands on the first point of the way, so stops start on the
 *  next one when they leave room. A unit's last stretch ends on the Champion's own spot. */
export function stretchPoints(world: WorldId, page: number, pages: number, n: number, champion: boolean): { points: string[]; start: string } {
  const route = routeOf(world), legs = legsOf(route);
  const start = page > 0 ? stretchWay(route, page - 1).at(-1)! : route[0];
  if (champion && page === pages - 1) return { points: legs[legs.length - 1].slice(-n), start };
  const way = stretchWay(route, page);
  return { points: spread(n < way.length ? way.slice(1) : way, n), start };
}
/** The trails a stretch walks: the whole route (the way to the last stretch can be long) and the side trails
 *  to finds along it; past the lit stop is shut. */
function walkOf(world: WorldId, from: string, lit: string | null): TrailWalk {
  const tr = trailsOf(world), route = routeOf(world), on = new Set(route), edges = new Set<number>();
  for (const e of tr.edges) {
    const a = tr.point[e.a].kind, b = tr.point[e.b].kind;
    const main = on.has(e.a) && on.has(e.b), find = (a === 'chest' || a === 'bonus' || a === 'hidden') ? on.has(e.b) : (b === 'chest' || b === 'bonus' || b === 'hidden') && on.has(e.a);
    if (main || find) edges.add(e.id);
  }
  const i = lit ? route.indexOf(lit) : -1, j = route.indexOf(from);
  const shut = new Set(i < 0 ? [] : j <= i ? route.slice(i + 1) : route.slice(0, i));
  return { edges, shut };
}

// ---------- the Journey a player is on ----------
export type TrailStop = Stop & { at: string };
export type Journey = {
  state: UnitState; teacher: string | null; world: WorldId;
  /** every stop of the unit, and the ones on the trail now, each on its trail point */
  stops: Stop[]; stretch: TrailStop[];
  /** which stretch of how many */
  page: number; pages: number;
  /** the one stop to do next */
  lit: TrailStop | null;
  /** where the buddy stands when the map opens, and where it may walk */
  start: string; walk: TrailWalk;
  /** the points of this stretch's way (its trail is drawn bright) */
  way: Set<string>;
  /** stops done of all the unit's */
  done: number; of: number;
  key: string;
};
/** A unit as a Journey: its stops, and the stretch with the lit one. */
export function journeyFor(s: UnitState, teacher: string | null = null): Journey {
  const world = unitWorld(s.unit), stops = stopsOf(s), pages = stretchesOf(stops);
  const litPage = pages.findIndex(q => q.some(x => x.lit));
  const page = litPage < 0 ? pages.length - 1 : litPage, here = pages[page] ?? [];
  const champion = here.some(x => x.kind === 'champion');
  const { points, start } = stretchPoints(world, page, pages.length, here.length, champion);
  const stretch = here.map((x, i) => ({ ...x, at: points[i] }));
  const lit = stretch.find(x => x.lit) ?? null, k = lit ? stretch.indexOf(lit) : stretch.length;
  const from = k > 0 ? stretch[k - 1].at : start;
  return {
    state: s, teacher, world, stops, stretch, page, pages: pages.length, lit, start: from,
    walk: walkOf(world, from, lit?.at ?? null), way: new Set([...stretchWay(routeOf(world), page), ...points]),
    done: stops.filter(x => x.done).length, of: stops.length, key: `${s.unit.id}|${page}`,
  };
}
/** The Journey a player is on: a teacher's math unit first, then the math path, as My path has it (null: all done). */
export function journeyOf(p: Profile, now = Date.now()): Journey | null {
  const cu = classUnits(p, now).find(x => x.state.next && x.state.unit.subject === 'math');
  if (cu) return journeyFor(cu.state, cu.teacher);
  const n = nextOnPath(p, 'math', now, playerRules(p, now).grade);
  return n ? journeyFor(n.unit) : null;
}
/** Whether Adventure can open on the trail for this player (`subject`: the worlds it opened on). */
export const journeyHere = (p: Profile | null, subject: string) => !!p && subject === 'math' && !!journeyOf(p);

/** A battle stop's battle in a world: its next open battle not won yet, else the last open one again. A
 *  Champion stays for Free play: the unit's Champion is the unit check, at the end of the trail. */
export function battleNode(a: Adventure, world: WorldId): MapNode {
  const open = nodesOf(world).filter(n => n.kind === 'battle' && nodeOpen(a, n));
  return open.find(n => !cleared(a, n.id)) ?? open[open.length - 1] ?? nodesOf(world)[0];
}
export const battleStop = (p: Profile, world: WorldId) => battleNode(advView(p), world);
