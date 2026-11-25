// Less motion in the 3D world. A child who gets dizzy or distracted by motion ticks the game's own "Less
// motion", or their computer asks for less (ui/motion.svelte.ts). The app shell says where to ask, and the
// stage and the scenes ask every frame, so turning it on or off counts at once, with no reload.
// What it stills is what moves for its own sake: the island's idle loops (the grass in the wind, the sea, the
// clouds, the floating rocks, the balloons, the waterfalls, the trail's surprises), the title's slow camera
// sway and its buddies' dances now and then, and a buddy breathing while it only stands there. What shows the
// child something (a buddy walking to where the answer goes, a lesson's steps, the wave when a buddy is
// picked, a giggle when it's tickled) and whatever a lesson waits on move as before: the stage's own clock,
// which the scenes and the lessons go by, never stops.

import type { Vector3 } from 'three';

let ask: () => boolean = () => false;

export const calm = {
  /** less motion, now */
  get on() { return ask(); },
  /** where to ask (the app shell: the game's "Less motion" or the computer's setting) */
  follow(f: () => boolean) { ask = f; },
};

/** The clock the decorative loops go by (the island's, the title's camera sway). It keeps the stage's time,
 *  frame for frame, and stands still with less motion, so they hold the frame they were on, and go on from
 *  it with no jump when it's turned off. */
export class DecorClock {
  t = 0;
  /** Advance by a frame; returns how far it moved (0 while still). */
  step(dt: number, still: boolean) { const d = still ? 0 : dt; this.t += d; return d; }
}

/** how long (seconds) a buddy's moves run on after a move ends, so the fade back to standing (0.3 to 0.45 s) finishes */
export const SETTLE = 0.6;

/** A buddy's moves with less motion: while it only stands there (breathing), its pose holds; a move that
 *  shows something (the wave when it's picked, a giggle when it's tickled, a dance asked for) plays as ever,
 *  and the fade back to standing finishes before it holds again. Without less motion every frame runs. */
export class IdleHold {
  private settle = 0;
  /** How far to run the moves this frame (`busy`: a move is playing). */
  step(dt: number, busy: boolean, still: boolean) {
    if (!still || busy) { this.settle = SETTLE; return dt; }
    if (this.settle > 0) { this.settle -= dt; return dt; }
    return 0;
  }
}

/** Is a buddy's move (a wave, a dance) over? One that shows something (the wave when a buddy is picked, a
 *  dance asked for in the Wardrobe) runs to its end (`until`, on the stage clock); one played now and then
 *  for its own sake (the title's) ends at once when less motion comes on, so the buddy goes back to
 *  standing and its pose holds. */
export function moveOver(t: number, until: number, forFun: boolean, still: boolean) {
  return t > until || (forFun && still);
}

/** how near (metres) a camera's ease must be for less motion to land it: the last of an ease, a pixel or two */
export const LAND = 0.02;

/** Ease a camera toward where it wants to be, `k` of the way this frame. With less motion, once it's that
 *  near, it lands, so it stands still at once instead of creeping on for a second or two (the title's camera,
 *  when its sway stops); a longer move (to the buddy just picked) eases as ever until its last couple of
 *  centimetres. Without less motion it eases as ever. */
export function easeTo(at: Vector3, want: Vector3, k: number, still: boolean) {
  if (still && at.distanceTo(want) < LAND) at.copy(want);
  else at.lerp(want, k);
}

/** How big a shake is (the camera's on a hit in a battle or a duel; the mat's, the beam's, the tray's, the
 *  crate's on a wrong answer): none with less motion. Its timer runs as ever, so whatever waits on it (a
 *  lesson, a game) waits just as long, and the helper's face and the sound still say it. */
export function shakeOf(size: number) { return calm.on ? 0 : size; }

/** how many sparkles a burst makes with less motion: a few, that stay where they're made and fade there */
export const FEW = 3;
