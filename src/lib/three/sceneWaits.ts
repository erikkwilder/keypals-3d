/** Waits counted on the scene's own clock, for a lesson's world (the beat lessons' kits). A kit's movements run on
 *  the scene's clock, and that clock falls behind the wall's whenever frames are slow (the stage caps a frame's
 *  step at a twentieth of a second, so under 20 frames a second a "second" of movement takes longer than a
 *  second). A wait by setTimeout then ended before the movement it was waiting for, and the narrator went on to
 *  say what the picture hadn't shown yet. Counted here, a wait ends when the movement does, on any computer, and
 *  the lesson stands still with the picture while the page is hidden or paused. Call `tick(t)` from `update`. */
export class SceneWaits {
  private last: number | null = null;
  private list: { left: number; go: () => void }[] = [];
  /** resolves after `ms` of the scene's time */
  wait(ms: number) { return new Promise<void>(r => { this.list.push({ left: ms / 1000, go: r }); }); }
  /** calls `fn` after `ms` of the scene's time (setTimeout, on the scene's clock) */
  later(ms: number, fn: () => void) { this.list.push({ left: ms / 1000, go: fn }); }
  tick(t: number) {
    const dt = this.last == null ? 0 : Math.max(0, t - this.last);
    this.last = t;
    if (!this.list.length) return;
    const due: (() => void)[] = [];
    this.list = this.list.filter(w => { w.left -= dt; if (w.left > 0) return true; due.push(w.go); return false; });
    for (const go of due) go();
  }
  clear() { this.list = []; }
}
