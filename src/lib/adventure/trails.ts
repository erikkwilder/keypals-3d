// The trails on each painted Adventure map: a small graph per world that the buddy walks along, Super
// Mario World style. Every island has its six stops (the same ids as always, so old saves keep their
// progress), and its trail splits after the practice stop into two routes, each with its own battle
// (stops 3 and 4), that meet again before the Champion. Short side trails lead to finds: a treasure chest
// off the first stop, a Bonus Round off the second, and a spot hidden behind a bush or a waterfall that
// only shows when you walk close to it. The Sky Islands' three islands are joined by stepping stones.
//
// Each trail point has a place on the wide map (desktop) and on the tall one (phones), in percent of the
// picture; each trail can bend on its way (`wide`/`tall` bend points), drawn and walked the same.
// A world with no plan here yet (a new one, before its trails are placed) walks a simple path through its
// stops instead (simplePlan), so a new world never breaks the map.
// Pure data and geometry: no screens here, and nothing from state.ts at run time (state.ts reads
// `parallel` from here, and tells it each world's stops: tellStops).
import type { IslandId, WorldId } from './state';
import { SPOTS } from './mapSpots';

export type MapKind = 'wide' | 'tall';
export type Pt = [number, number];
/** a stop (battle, practice, Champion), a find (chest, Bonus Round, hidden spot) or a place two routes meet */
export type TrailKind = 'stop' | 'chest' | 'bonus' | 'hidden' | 'join';
export type FindKind = 'chest' | 'bonus' | 'hidden';
export type TrailPoint = { id: string; island: IslandId; kind: TrailKind; at: Record<MapKind, Pt> };
export type TrailEdge = { id: number; a: string; b: string; bends: Record<MapKind, Pt[]>; hidden?: boolean };
export type Trails = {
  world: WorldId; points: TrailPoint[]; edges: TrailEdge[];
  point: Record<string, TrailPoint>;
  /** the trails leaving each point */
  out: Record<string, TrailEdge[]>;
};

type Spot = { wide: Pt; tall: Pt };
/** One island's points by their short name ('0'...'5' the stops, 'j' where the two routes meet, and the
 *  finds), and its trails: [from, to, wide bends, tall bends]. */
type IslandPlan = { pts: Record<string, Spot>; edges: [string, string, Pt[]?, Pt[]?][] };
export type WorldPlan = { islands: Partial<Record<IslandId, IslandPlan>>; links?: [string, string, Pt[]?, Pt[]?][] };

// ---------- the maps ----------
// Placed by eye on the paintings: the stops on the round stone platforms where there is one, the second
// route along a painted path or over the grass beside it, the finds on little corners of their own.
// (Partial: a world missing here walks simplePlan.)
const PLANS: Partial<Record<WorldId, WorldPlan>> = {
  sky: {
    islands: {
      meadow: {
        pts: {
          0: { wide: [10.7, 66.0], tall: [46.1, 85.0] }, 1: { wide: [17.1, 62.2], tall: [56.3, 78.2] }, 2: { wide: [22.9, 57.7], tall: [47.2, 72.1] },
          3: { wide: [16.0, 51.8], tall: [57.5, 65.0] }, 4: { wide: [27.0, 60.0], tall: [37.0, 64.5] }, 5: { wide: [29.0, 53.5], tall: [48.8, 57.5] },
          chest: { wide: [5.2, 60.5], tall: [30.0, 83.5] }, bonus: { wide: [21.5, 66.4], tall: [70.0, 76.5] }, hidden: { wide: [10.0, 46.0], tall: [68.0, 62.0] },
        },
        edges: [['0', '1'], ['1', '2'], ['2', '3'], ['2', '4'], ['3', '5', [[20.5, 46.6], [25.0, 47.5]]], ['4', '5'], ['0', 'chest'], ['1', 'bonus'], ['3', 'hidden']],
      },
      treetops: {
        pts: {
          0: { wide: [43.6, 50.8], tall: [53.1, 49.3] }, 1: { wide: [49.3, 48.0], tall: [53.6, 42.9] }, 2: { wide: [54.6, 44.7], tall: [57.0, 37.5] },
          3: { wide: [50.0, 39.5], tall: [69.7, 38.5] }, 4: { wide: [59.5, 44.0], tall: [37.5, 36.0] }, 5: { wide: [65.5, 40.5], tall: [50.4, 30.0] },
          chest: { wide: [39.5, 46.5], tall: [40.0, 46.5] }, bonus: { wide: [53.0, 52.5], tall: [67.0, 46.5] }, hidden: { wide: [62.5, 49.5], tall: [27.5, 41.5] },
        },
        edges: [['0', '1'], ['1', '2'], ['2', '3'], ['2', '4'], ['3', '5', [[54.5, 33.5], [61.5, 33.0]], [[63.0, 31.0]]], ['4', '5', [], [[42.0, 30.5]]], ['0', 'chest'], ['1', 'bonus'], ['4', 'hidden']],
      },
      bay: {
        pts: {
          0: { wide: [73.9, 43.8], tall: [58.4, 21.5] }, 1: { wide: [77.9, 40.9], tall: [53.0, 15.0] }, 2: { wide: [81.8, 37.0], tall: [62.0, 12.8] },
          3: { wide: [88.0, 40.8], tall: [79.5, 13.0] }, 4: { wide: [84.6, 31.0], tall: [67.5, 8.0] }, 5: { wide: [90.1, 24.0], tall: [76.0, 5.5] },
          chest: { wide: [72.5, 37.5], tall: [48.0, 20.5] }, bonus: { wide: [79.0, 31.5], tall: [47.5, 10.0] }, hidden: { wide: [95.5, 42.0], tall: [90.0, 17.5] },
        },
        edges: [['0', '1'], ['1', '2'], ['2', '4'], ['4', '5'], ['2', '3'], ['3', '5', [[94.0, 33.0]]], ['0', 'chest'], ['1', 'bonus'], ['3', 'hidden']],
      },
    },
    // the stepping stones from one island to the next
    links: [
      ['meadow-5', 'treetops-0', [[32.0, 53.5], [35.2, 54.6], [39.2, 52.8]], [[51.5, 53.0]]],
      ['treetops-5', 'bay-0', [[67.5, 45.5], [70.8, 45.8]], [[54.0, 24.5]]],
    ],
  },
  falls: {
    islands: {
      falls: {
        pts: {
          0: { wide: [19.1, 69.4], tall: [43.6, 78.6] }, 1: { wide: [33.9, 57.4], tall: [61.3, 59.9] }, 2: { wide: [49.4, 48.0], tall: [47.9, 43.1] },
          3: { wide: [64.4, 38.9], tall: [72.8, 31.9] }, 4: { wide: [61.0, 29.5], tall: [31.5, 43.0] }, j: { wide: [79.1, 31.1], tall: [53.7, 23.3] }, 5: { wide: [86.3, 14.4], tall: [71.3, 11.1] },
          chest: { wide: [9.5, 64.5], tall: [27.0, 80.0] }, bonus: { wide: [30.5, 47.0], tall: [78.0, 58.5] }, hidden: { wide: [70.5, 47.0], tall: [84.5, 38.0] },
        },
        edges: [
          ['0', '1', [[27.5, 64.0]], [[52.0, 67.5]]], ['1', '2', [[41.0, 52.5]], [[57.0, 50.5]]], ['2', '3', [[57.0, 44.0]], [[61.0, 38.5]]], ['3', 'j', [[71.0, 34.5]], [[62.0, 27.0]]],
          ['2', '4', [[46.0, 38.5], [53.0, 31.5]]], ['4', 'j', [[69.5, 30.0]], [[24.0, 34.5], [37.0, 26.0]]], ['j', '5', [[83.0, 22.0]], [[50.5, 17.0], [58.0, 14.5]]],
          ['0', 'chest'], ['1', 'bonus'], ['3', 'hidden'],
        ],
      },
    },
  },
  caves: {
    islands: {
      caves: {
        pts: {
          0: { wide: [22.5, 70.5], tall: [48.0, 81.6] }, 1: { wide: [34.6, 58.0], tall: [70.0, 60.0] }, 2: { wide: [49.7, 47.8], tall: [45.0, 44.4] },
          3: { wide: [63.8, 38.6], tall: [70.0, 34.0] }, 4: { wide: [57.5, 29.5], tall: [26.0, 36.5] }, j: { wide: [80.0, 30.0], tall: [47.5, 21.7] }, 5: { wide: [87.0, 18.0], tall: [73.5, 13.0] },
          chest: { wide: [12.5, 66.0], tall: [22.0, 76.0] }, bonus: { wide: [27.5, 51.0], tall: [86.0, 58.0] }, hidden: { wide: [72.5, 43.5], tall: [88.0, 33.0] },
        },
        edges: [
          ['0', '1', [[28.5, 64.5]], [[50.0, 70.0]]], ['1', '2', [[42.0, 53.5]], [[58.0, 50.0]]], ['2', '3', [[57.0, 44.0]], [[58.0, 39.5]]], ['3', 'j', [[71.5, 35.0]], [[62.0, 27.0]]],
          ['2', '4', [[44.0, 40.0], [52.0, 33.5]]], ['4', 'j', [[70.0, 27.5]], [[34.0, 27.5]]], ['j', '5', [[83.5, 24.0]], [[52.0, 16.0]]],
          ['0', 'chest'], ['1', 'bonus'], ['3', 'hidden'],
        ],
      },
    },
  },
  market: {
    islands: {
      market: {
        pts: {
          0: { wide: [19.0, 68.5], tall: [45.0, 87.5] }, 1: { wide: [34.8, 58.6], tall: [59.3, 72.0] }, 2: { wide: [47.5, 42.5], tall: [55.3, 53.2] },
          3: { wide: [64.2, 37.5], tall: [68.7, 33.2] }, 4: { wide: [61.0, 28.5], tall: [36.0, 27.5] }, j: { wide: [79.3, 31.0], tall: [55.5, 18.2] }, 5: { wide: [87.0, 15.8], tall: [71.0, 6.4] },
          chest: { wide: [8.5, 62.5], tall: [30.0, 81.5] }, bonus: { wide: [27.5, 50.5], tall: [80.0, 64.5] }, hidden: { wide: [71.0, 44.5], tall: [85.0, 30.0] },
        },
        edges: [
          ['0', '1', [[27.5, 63.0]], [[50.0, 79.0]]], ['1', '2', [[41.5, 52.0]], [[60.0, 62.5]]], ['2', '3', [[57.0, 43.5]], [[60.0, 43.0]]], ['3', 'j', [[71.5, 34.0]], [[64.0, 24.5]]],
          ['2', '4', [[49.0, 34.0], [54.0, 29.5]], [[38.0, 48.5], [40.0, 36.5]]], ['4', 'j', [[70.0, 27.0]]], ['j', '5', [[83.5, 24.0]], [[50.0, 11.0]]],
          ['0', 'chest'], ['1', 'bonus'], ['3', 'hidden'],
        ],
      },
    },
  },
  // Clockwork Isle (map-clock-*.webp). Wide: the first route over the little bridge to the platform under the
  // great balance scale, the second along the flower ledge past the jugs and up the stairs; the chest by the
  // cuckoo-clock house, the Bonus Round by the train's viaduct, the hidden spot at the clockmaker's cottage.
  // Tall: the first route up the stone path, the second round the left to the balance scale and over its bridge.
  clockwork: {
    islands: {
      clockwork: {
        pts: {
          0: { wide: [15.4, 73.6], tall: [58.8, 90.4] }, 1: { wide: [32.1, 65.4], tall: [57.3, 81.0] }, 2: { wide: [47.1, 50.8], tall: [51.9, 63.8] },
          3: { wide: [64.1, 35.5], tall: [64.4, 46.3] }, 4: { wide: [83.0, 45.0], tall: [31.5, 38.0] }, j: { wide: [79.3, 27.3], tall: [55.6, 27.9] }, 5: { wide: [87.3, 16.5], tall: [70.0, 13.8] },
          chest: { wide: [8.5, 69.5], tall: [71.0, 86.5] }, bonus: { wide: [24.5, 57.5], tall: [36.5, 68.5] }, hidden: { wide: [55.5, 32.0], tall: [82.5, 43.0] },
        },
        edges: [
          ['0', '1', [[24.0, 69.5]]], ['1', '2', [[35.0, 58.5], [40.0, 54.5]], [[56.5, 73.0]]], ['2', '3', [[52.0, 45.0], [57.0, 39.5]], [[49.0, 55.5], [53.5, 50.0]]], ['3', 'j', [[72.4, 30.5]], [[61.0, 37.0]]],
          ['2', '4', [[55.5, 46.5], [61.0, 42.5], [68.5, 41.5], [76.0, 43.0]], [[43.5, 58.5], [38.5, 48.5]]], ['4', 'j', [[82.8, 37.0]], [[44.5, 40.5], [49.5, 39.5], [48.5, 34.0]]],
          ['j', '5', [[83.0, 22.0]], [[49.5, 21.5], [55.0, 16.5]]],
          ['0', 'chest'], ['1', 'bonus', [], [[47.5, 72.5]]], ['3', 'hidden'],
        ],
      },
    },
  },
  // Shape Peaks (map-peaks-*.webp). Wide: the first route over the low bridge to the platform under the crystals
  // and up its stairs, the second by the sundial and over the high bridge; the chest by the crystal meadow, the
  // hidden spot among the crystals past stop 3. Tall: the first route up past the waterfall and over the long
  // rope bridge, the second to the crystal triangle arch; the hidden spot through the stone doorway.
  peaks: {
    islands: {
      peaks: {
        pts: {
          0: { wide: [15.3, 74.4], tall: [51.6, 81.3] }, 1: { wide: [32.8, 65.0], tall: [46.5, 57.5] }, 2: { wide: [49.6, 52.6], tall: [28.8, 49.2] },
          3: { wide: [84.8, 46.4], tall: [52.3, 37.9] }, 4: { wide: [56.0, 44.0], tall: [33.5, 38.5] }, j: { wide: [78.8, 30.3], tall: [58.3, 21.7] }, 5: { wide: [84.8, 20.2], tall: [71.0, 15.2] },
          chest: { wide: [6.5, 69.0], tall: [35.5, 78.0] }, bonus: { wide: [28.0, 57.5], tall: [67.0, 60.5] }, hidden: { wide: [92.5, 46.5], tall: [79.0, 43.0] },
        },
        edges: [
          ['0', '1', [[26.0, 70.5]], [[57.0, 72.5], [57.5, 64.5]]], ['1', '2', [[40.5, 57.0]], [[37.5, 54.0]]], ['2', '3', [[58.0, 49.5], [66.0, 47.5], [76.0, 48.0]], [[38.0, 44.0], [45.0, 40.5]]],
          ['3', 'j', [[83.5, 40.5]], [[62.0, 33.5], [70.0, 27.5]]], ['2', '4', [], [[31.0, 43.5]]], ['4', 'j', [[62.5, 42.5], [68.0, 38.0], [72.5, 34.5]], [[42.0, 30.0], [50.0, 24.5]]],
          ['j', '5', [[80.5, 24.5]], [[67.0, 17.5]]],
          ['0', 'chest'], ['1', 'bonus'], ['3', 'hidden'],
        ],
      },
    },
  },
  // Juice Jungle: from the smoothie hut over the bridge to the juice fountain; one way on by the platform
  // over the pink waterfall, the other up past the mango tree; they meet on the platform under the mango
  // treehouse. The chest by the hut, a Bonus Round in the orange trees, something behind the waterfall.
  jungle: {
    islands: {
      jungle: {
        pts: {
          0: { wide: [22.0, 71.0], tall: [50.0, 86.0] }, 1: { wide: [45.5, 50.5], tall: [61.0, 55.0] }, 2: { wide: [51.0, 43.0], tall: [69.0, 37.0] },
          3: { wide: [66.5, 38.3], tall: [42.0, 33.0] }, 4: { wide: [63.0, 29.0], tall: [73.0, 27.0] }, j: { wide: [81.0, 30.0], tall: [56.0, 21.0] }, 5: { wide: [87.2, 18.5], tall: [70.0, 7.0] },
          chest: { wide: [10.0, 72.0], tall: [33.0, 80.0] }, bonus: { wide: [37.0, 46.0], tall: [82.0, 57.0] }, hidden: { wide: [77.5, 47.0], tall: [27.0, 45.0] },
        },
        edges: [
          ['0', '1', [[31.0, 64.0], [38.0, 57.0]], [[55.0, 76.0], [56.0, 66.0]]], ['1', '2'], ['2', '3', [[57.0, 42.0], [62.0, 40.0]], [[52.0, 40.0]]], ['3', 'j', [[74.0, 33.0]], [[48.0, 27.0]]],
          ['2', '4', [[56.0, 33.0]], [[73.0, 32.0]]], ['4', 'j', [[72.0, 28.0]], [[64.0, 24.0]]], ['j', '5', [[84.0, 24.0]], [[48.0, 14.0], [57.0, 9.0]]],
          ['0', 'chest'], ['1', 'bonus'], ['3', 'hidden'],
        ],
      },
    },
  },
  frost: {
    islands: {
      frost: {
        pts: {
          0: { wide: [18.0, 76.0], tall: [56.0, 88.6] }, 1: { wide: [41.6, 66.0], tall: [61.5, 66.3] }, 2: { wide: [57.0, 52.0], tall: [62.5, 50.0] },
          3: { wide: [71.3, 35.3], tall: [60.8, 30.1] }, 4: { wide: [59.8, 31.9], tall: [44.0, 21.4] }, j: { wide: [77.8, 28.7], tall: [56.0, 18.0] }, 5: { wide: [85.0, 23.6], tall: [65.6, 13.4] },
          chest: { wide: [11.4, 65.9], tall: [14.0, 71.5] }, bonus: { wide: [39.2, 48.4], tall: [82.0, 61.0] }, hidden: { wide: [86.0, 40.0], tall: [84.0, 45.0] },
        },
        edges: [
          ['0', '1', [[29.0, 69.0]], [[56.0, 77.0], [52.0, 73.0]]], ['1', '2', [[50.0, 60.0]], [[57.0, 58.0]]], ['2', '3', [[65.0, 45.0]], [[52.0, 42.0], [58.0, 36.0]]], ['3', 'j', [[75.0, 31.0]]],
          ['2', '4', [[62.0, 45.0], [61.0, 38.0]], [[48.0, 52.0], [30.0, 48.0], [30.0, 34.0], [36.0, 26.0]]], ['4', 'j', [[67.0, 30.5], [72.0, 30.0]]], ['j', '5', [[81.0, 25.0]]],
          ['0', 'chest', [], [[38.0, 80.0]]], ['1', 'bonus'], ['3', 'hidden'],
        ],
      },
    },
  },
};

const KIND_OF = (local: string): TrailKind => (local === 'chest' || local === 'bonus' || local === 'hidden' ? local : local === 'j' ? 'join' : 'stop');

/** A world's stops, from state.ts (it tells this module once it has them: trails.ts imports nothing from
 *  state.ts at run time). Only a world with no plan needs them. */
type StopRef = { id: string; island: IslandId };
let stopsOfWorld: (world: WorldId) => StopRef[] = () => [];
export function tellStops(f: (world: WorldId) => StopRef[]) { stopsOfWorld = f; built.clear(); }

/** A world with no plan of its own yet: a simple path through its stops in order, island after island, at
 *  their places on the maps (mapSpots.ts), with no finds. A stop not placed there yet goes on a line
 *  across the picture, so the map still works. */
export function simplePlan(world: WorldId): WorldPlan {
  const stops = stopsOfWorld(world), islands: Partial<Record<IslandId, IslandPlan>> = {}, links: [string, string][] = [];
  const spread = (i: number): Spot => {
    const t = stops.length > 1 ? i / (stops.length - 1) : 0.5;
    return { wide: [15 + 70 * t, 75 - 55 * t], tall: [i % 2 ? 62 : 40, 88 - 76 * t] };
  };
  stops.forEach((s, i) => {
    const ip = (islands[s.island] ??= { pts: {}, edges: [] });
    const local = s.id.slice(s.island.length + 1), prev = stops[i - 1];
    ip.pts[local] = { wide: SPOTS.wide[s.id] ?? spread(i).wide, tall: SPOTS.tall[s.id] ?? spread(i).tall };
    if (prev?.island === s.island) ip.edges.push([prev.id.slice(s.island.length + 1), local]);
    else if (prev) links.push([prev.id, s.id]);
  });
  return { islands, links };
}

const built = new Map<WorldId, Trails>();
/** A world's trails (built once): its plan, or a simple path through its stops if it has none yet. */
export function trailsOf(world: WorldId): Trails {
  const have = built.get(world);
  if (have) return have;
  const tr = buildTrails(world, PLANS[world] ?? simplePlan(world));
  built.set(world, tr);
  return tr;
}
/** A world's trails from a plan. */
export function buildTrails(world: WorldId, plan: WorldPlan): Trails {
  const points: TrailPoint[] = [], edges: TrailEdge[] = [];
  const edge = (a: string, b: string, w?: Pt[], t?: Pt[], hidden = false) => edges.push({ id: edges.length, a, b, bends: { wide: w ?? [], tall: t ?? [] }, ...(hidden ? { hidden } : {}) });
  for (const [island, ip] of Object.entries(plan.islands) as [IslandId, IslandPlan][]) {
    for (const [local, s] of Object.entries(ip.pts)) points.push({ id: `${island}-${local}`, island, kind: KIND_OF(local), at: { wide: s.wide, tall: s.tall } });
    for (const [a, b, w, t] of ip.edges) edge(`${island}-${a}`, `${island}-${b}`, w, t, b === 'hidden');
  }
  for (const [a, b, w, t] of plan.links ?? []) edge(a, b, w, t);
  const point = Object.fromEntries(points.map(p => [p.id, p]));
  const out: Record<string, TrailEdge[]> = Object.fromEntries(points.map(p => [p.id, []]));
  for (const e of edges) { out[e.a].push(e); out[e.b].push(e); }
  return { world, points, edges, point, out };
}
/** the worlds with a plan placed by eye (any other walks simplePlan) */
export const WORLDS_WITH_TRAILS = Object.keys(PLANS) as WorldId[];

/** The two battles on parallel routes (stops 3 and 4 of an island): neither waits for the other, and the
 *  Champion waits for both. state.ts nodeOpen asks this. */
export function parallel(a: string, b: string): boolean {
  const [ia, na] = splitStop(a), [ib, nb] = splitStop(b);
  return ia === ib && ia !== '' && ((na === 3 && nb === 4) || (na === 4 && nb === 3));
}
function splitStop(id: string): [string, number] {
  const i = id.lastIndexOf('-'), n = Number(id.slice(i + 1));
  return i > 0 && Number.isInteger(n) ? [id.slice(0, i), n] : ['', -1];
}
/** a find's trail point id */
export const findId = (island: IslandId, kind: FindKind) => `${island}-${kind}`;
/** the island a trail point belongs to */
export const islandOfPoint = (world: WorldId, id: string): IslandId | null => trailsOf(world).point[id]?.island ?? null;

/** A map stop id from an older save (the stops in a straight line) on the trails: the same stop, now a
 *  trail point (every old id is kept); null if the world has no such stop. */
export function stopOnTrails(world: WorldId, oldId: string): string | null {
  const p = trailsOf(world).point[oldId];
  return p && p.kind === 'stop' ? p.id : null;
}

// ---------- geometry ----------
/** a trail's bends in order from `from` to its other end, ends included, in percent */
export function legPoints(tr: Trails, e: TrailEdge, from: string, kind: MapKind): Pt[] {
  const pts: Pt[] = [tr.point[e.a].at[kind], ...e.bends[kind], tr.point[e.b].at[kind]];
  return from === e.a ? pts : pts.slice().reverse();
}
export const other = (e: TrailEdge, id: string) => (e.a === id ? e.b : e.a);
/** percent to the picture's own pixels */
export const px = (p: Pt, size: readonly [number, number]): Pt => [(p[0] / 100) * size[0], (p[1] / 100) * size[1]];
/** a trail's length in the picture's pixels */
export function legLength(tr: Trails, e: TrailEdge, kind: MapKind, size: readonly [number, number]): number {
  const pts = legPoints(tr, e, e.a, kind).map(p => px(p, size));
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
/** the point `d` pixels along a trail from `from`, and which way it heads there (unit, picture pixels) */
export function along(tr: Trails, e: TrailEdge, from: string, d: number, kind: MapKind, size: readonly [number, number]): { at: Pt; dir: Pt } {
  const pts = legPoints(tr, e, from, kind).map(p => px(p, size));
  let left = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], L = Math.hypot(dx, dy) || 1e-6;
    if (left <= L || i === pts.length - 1) {
      const k = Math.min(1, left / L);
      return { at: [pts[i - 1][0] + dx * k, pts[i - 1][1] + dy * k], dir: [dx / L, dy / L] };
    }
    left -= L;
  }
  return { at: pts[0], dir: [0, 1] };
}
/** which way a trail sets off from a point (unit, picture pixels) */
export function setOff(tr: Trails, e: TrailEdge, from: string, kind: MapKind, size: readonly [number, number]): Pt {
  const [p, q] = legPoints(tr, e, from, kind).map(x => px(x, size));
  const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
  return [dx / L, dy / L];
}
