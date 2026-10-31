// Painted icons: one picture for each idea, in the same glossy painted style as the Adventure art, so
// every button and badge in the game looks like part of one set. They live in public/icons/ (the first
// few in public/game/). TileArt, Icon and rideIcon all draw from here.
const BASE = import.meta.env.BASE_URL;

/** The address of a painted icon. */
export const iconUrl = (name: string) => `${BASE}icons/${name}.webp`;
/** The home page set (home, dances, stickers, medals, settings, typing, math) and the Adventure icons. */
export const gameIconUrl = (name: string) => `${BASE}game/icon-${name}.webp`;

/** How the buddy moves, as a picture: the trail's run, the cliff climb, the snowy sled run and the swim. */
export const MOVE_PIC: Record<'run' | 'climb' | 'slide' | 'swim', string> = {
  run: iconUrl('ride-run-1'), climb: iconUrl('ride-climb-1'), slide: iconUrl('ride-slide-0'), swim: iconUrl('ride-swim-3'),
};

/** A dance's own painted picture (fist pump, robot, chicken, moonwalk ...). */
export const danceIconUrl = (id: string) => `${BASE}icons/dances/${id}.webp`;
/** A medal at a tier (0 Rose, 1 Silver, 2 Gold, 3 Rainbow), painted whole: ribbon, rim and face. */
export const medalArtUrl = (id: string, tier: number) => `${BASE}icons/medals/${id}-${tier}.webp`;
/** A sticker's painted die-cut backing: white edge, glossy patterned paper and its prop; the buddy goes on top. */
export const stickerArtUrl = (id: string) => `${BASE}icons/stickers/${id}.webp`;
