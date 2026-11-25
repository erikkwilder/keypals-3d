// Less motion in the 3D world. A child who gets dizzy or distracted by motion ticks the game's own "Less
// motion", or their computer asks for less (ui/motion.svelte.ts). The app shell says where to ask, and the
// stage and the scenes ask every frame, so turning it on or off counts at once, with no reload.
// What it stills is what moves for its own sake: the island's idle loops (the grass in the wind, the sea, the
// clouds, the floating rocks, the balloons, the waterfalls, the trail's surprises), the title's slow camera
// sway and its buddies' dances now and then, and a buddy breathing while it only stands there. What shows the
// child something (a buddy walking to where the answer goes, a lesson's steps, the wave when a buddy is
// picked, a giggle when it's tickled) and whatever a lesson waits on move as before: the stage's own clock,
// which the scenes and the lessons go by, never stops.

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
