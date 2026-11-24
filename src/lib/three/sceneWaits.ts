/** Waits counted on the scene's own clock, for a lesson's world (the beat lessons' kits). A kit's movements run on
 *  the scene's clock, and that clock falls behind the wall's whenever frames are slow (the stage caps a frame's
 *  step at a twentieth of a second, so under 20 frames a second a "second" of movement takes longer than a
 *  second). A wait by setTimeout then ended before the movement it was waiting for, and the narrator went on to
 *  say what the picture hadn't shown yet. Counted here, a wait ends when the movement does, on any computer, and
 *  the lesson stands still with the picture while the page is hidden or paused. Call `tick(t)` from `update`. */
export class SceneWaits {
  private last: number | null = null;
  private lastWall = 0;
  private list: { left: number; go: () => void }[] = [];
  /** seconds something was being waited for, by the scene's clock and by the wall's. On a computer that keeps up
   *  they are the same; where frames are slow the wall's is longer, and a lesson timed there takes `wall - busy`
   *  seconds less on a computer that keeps up (the play-through driver reports this) */
  busy = 0; wall = 0;
  /** resolves after `ms` of the scene's time */
  wait(ms: number) { return new Promise<void>(r => { this.list.push({ left: ms / 1000, go: r }); }); }
  /** calls `fn` after `ms` of the scene's time (setTimeout, on the scene's clock) */
  later(ms: number, fn: () => void) { this.list.push({ left: ms / 1000, go: fn }); }
  tick(t: number) {
    const dt = this.last == null ? 0 : Math.max(0, t - this.last), now = performance.now();
    if (this.last != null && this.list.length) { this.busy += dt; this.wall += (now - this.lastWall) / 1000; }
    this.last = t; this.lastWall = now;
    if (!this.list.length) return;
    const due: (() => void)[] = [];
    this.list = this.list.filter(w => { w.left -= dt; if (w.left > 0) return true; due.push(w.go); return false; });
    for (const go of due) go();
  }
  clear() { this.list = []; }
}
