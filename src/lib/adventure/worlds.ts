// The world map: every world of Adventure on one painted picture (worlds-wide.webp). The Sky Islands,
// Fraction Falls, Counting Caves, Market Isle and the Chance Fair are open (Counting Caves is painted onto the picture as a
// cut-out); the rest are the math areas still to come, shown so a child can see where the adventure goes
// next. Each open world has its own painted map, wide (desktop) and tall (phones).
import type { AreaId } from '../math/skills/types';
import type { WorldId } from './state';
import type { StationId } from '../audio/stations';

export type WorldMap = { wide: string; tall: string; size: { wide: readonly [number, number]; tall: readonly [number, number] } };
export type WorldPin = {
  /** an island painted onto the world picture for a world that isn't in it (a cut-out, centred at `at`, `w`
   *  percent of the picture wide) */
  art?: { src: string; at: [number, number]; w: number };
  id: WorldId | string; name: string; blurb: string;
  /** where its island is on the world picture, in percent */
  at: [number, number];
  /** an open world's map; none: coming soon */
  map?: WorldMap;
  /** a math world's area (it opens once the area is started) */
  area?: AreaId;
  /** its own music station on Auto (the Chance Fair plays World) */
  station?: StationId;
};

export const WORLD_PINS: WorldPin[] = [
  { id: 'sky', name: 'Sky Islands', blurb: 'Sunny Meadow, Treetop Hollow and Cloudwhale Bay: any math or typing.', at: [27, 34],
    map: { wide: 'game/map-wide.webp', tall: 'game/map-tall.webp', size: { wide: [1672, 941], tall: [1024, 1536] } } },
  { id: 'falls', name: 'Fraction Falls', blurb: 'A pie shop at the top of the falls. Every battle card is a fraction.', at: [70, 27], area: 'fractions',
    map: { wide: 'game/map-falls-wide.webp', tall: 'game/map-falls-tall.webp', size: { wide: [1600, 900], tall: [1024, 1536] } } },
  { id: 'caves', name: 'Counting Caves', blurb: 'Crystal caves and mine carts of blocks. Every battle card is about tens, hundreds and big numbers.', at: [12, 63], area: 'place',
    art: { src: 'game/world-caves.webp', at: [12, 79], w: 18 },
    map: { wide: 'game/map-caves-wide.webp', tall: 'game/map-caves-tall.webp', size: { wide: [1600, 900], tall: [1024, 1536] } } },
  { id: 'peaks', name: 'Shape Peaks', blurb: 'Shapes, angles and crystals.', at: [89, 31], area: 'shapes' },
  { id: 'market', name: 'Market Isle', blurb: 'A floating bazaar. Every battle card is money or decimals.', at: [33, 60], area: 'decimals',
    map: { wide: 'game/map-market-wide.webp', tall: 'game/map-market-tall.webp', size: { wide: [1600, 900], tall: [1024, 1536] } } },
  { id: 'clockwork', name: 'Clockwork Isle', blurb: 'Clocks, lengths and weights.', at: [60, 55], area: 'measure' },
  { id: 'stars', name: 'Star Lab', blurb: 'Expressions and equations.', at: [88, 57], area: 'algebra' },
  { id: 'frost', name: 'Below Zero Caves', blurb: 'Negative numbers, under the ice.', at: [37, 87], area: 'integers' },
  { id: 'fair', name: 'Chance Fair', blurb: 'A carnival in the clouds. Every battle card is graphs, data or chance.', at: [73, 86], area: 'data', station: 'world',
    map: { wide: 'game/map-fair-wide.webp', tall: 'game/map-fair-tall.webp', size: { wide: [1600, 900], tall: [1024, 1536] } } },
];
export const WORLD_PIN = Object.fromEntries(WORLD_PINS.map(w => [w.id, w])) as Record<string, WorldPin>;
export const mapOf = (w: WorldId) => WORLD_PIN[w].map!;
/** the station a world plays on Auto (null: Adventure's usual one) */
export const stationOf = (w: string | undefined | null) => (w ? WORLD_PIN[w]?.station ?? null : null);

/** The world the Adventure map last showed, so coming back from a battle lands on the same world. */
export const lastWorld: { id: WorldId } = { id: 'sky' };
