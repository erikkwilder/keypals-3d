// Ride icons for the ride ladder, banners, medals and charts: the six speed steps of each way of moving.
import { RIDES } from '../engine/rides';
import { iconUrl } from './icons';

/** The speed steps the screens pass in a pale grey for "not reached yet": shown faded. */
const NOT_YET = new Set(['#cfc7e2', '#cbc2de', '#d9d2e8']);

/**
 * A speed step's painted picture as SVG markup in a 48 x 48 box, so every `<svg viewBox="0 0 48 48">`
 * that shows one keeps working. The trail: footprints, sneaker, skateboard, bike, race car, rocket. The
 * cliff: hold, rope, climbing shoe, helmet, grappling hook, rocket boots. The slope: saucer, skis, sled,
 * snowboard, bobsled, avalanche. The bay: swim ring, arm bands, goggles, flippers, dolphin, torpedo.
 * The colour only says whether it's reached yet (the pale greys fade it).
 */
export function rideIcon(tier: number, color = 'currentColor', move: 'run' | 'climb' | 'slide' | 'swim' = 'run'): string {
  const t = Math.max(0, Math.min(RIDES.length - 1, tier));
  const faded = NOT_YET.has(color.toLowerCase()) ? ' opacity=".4"' : '';
  return `<image href="${iconUrl(`ride-${move}-${t}`)}" x="1" y="1" width="46" height="46" preserveAspectRatio="xMidYMid meet"${faded}/>`;
}
