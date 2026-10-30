// Glimmer Catch's fair-play check. A Glimmer counts as caught (or bonked, for a wrong one) the moment it
// comes down within reach of the net, so running toward a right one could carry you under a wrong one
// with no way round it. Before a new Glimmer is let go, the game looks ahead: from where the buddy is
// now, can it still reach every right one in the air without ever being under a wrong one as it comes
// down, and is there always somewhere safe to stand? Only a spot that keeps all of that true is used;
// if there's none just now, the Glimmer waits a moment. The look-ahead works on a grid of spots across
// the field and small steps of time, and it allows for the Glimmers' sway and the net's reach, so the
// real game is never stricter than the plan. catchPlan.test.ts plays whole rounds with a careful player
// to check it.

/** the field, as the 3D scene has it: half its width, where Glimmers start, the height of the net */
export type Field = { half: number; top: number; net: number };
/** a Glimmer coming down: across the field, its height, how fast it falls, right or wrong */
export type Faller = { x: number; y: number; vy: number; right: boolean };

/** These match three/arcade/catch.ts: the net's reach, how far it leads the buddy, the Glimmers' sway,
 *  the band around the net where a Glimmer meets it, and how close to the edge the buddy can run. */
export const NET = { reach: 0.75, lead: 0.15, sway: 0.25, above: 0.5, below: 0.6, edge: 0.4 };
/** A wrong one is avoided only by staying this far from where it falls, all the time it's in the band. */
export const KEEP_CLEAR = NET.reach + NET.lead + NET.sway + 0.1;
/** A right one is surely caught from this close. */
export const SURE_CATCH = NET.reach - NET.lead - NET.sway;
/** How fast the plan lets a careful player run (the buddy can run 8 a second; a child steering is slower). */
export const PLAN_SPEED = 5;
const STEP = 0.1, DT = 0.05, PAD = 0.1;

/** Where a Glimmer let go at `x` (-1..1 across) falls on the field: the same as the scene's drop(). */
export const fieldX = (x: number, half: number) => Math.max(-half + 0.5, Math.min(half - 0.5, x * half));
/** A new Glimmer at the top, taking `secs` to reach the net. */
export function newFaller(x: number, secs: number, right: boolean, f: Field): Faller {
  const y = f.top + 0.6;
  return { x: fieldX(x, f.half), y, vy: (y - f.net) / secs, right };
}

/** when a Glimmer is in the band around the net (seconds from now) */
function windowOf(g: Faller, f: Field): [number, number] {
  return [(g.y - (f.net + NET.above)) / g.vy, (g.y - (f.net - NET.below)) / g.vy];
}

export type Plan = {
  /** the spots across the field (field units) */
  xs: number[];
  /** for each step of time from now: which spots the buddy can be at, never having been under a wrong one */
  can: boolean[][];
  /** for each step: the spots reachable from here from which the buddy can also stay safe to the end */
  safe: boolean[][];
  /** each right one: can it be caught (in the order of `fallers`), staying safe afterwards */
  catchable: boolean[];
  /** at some moment there's nowhere safe to stand */
  trapped: boolean;
  /** each faller's band, in steps from now */
  win: [number, number][];
};

/** Look ahead from the buddy at `px`: where it can be at each moment without meeting a wrong one. */
export function look(fallers: Faller[], px: number, f: Field, speed = PLAN_SPEED): Plan {
  const lim = f.half - NET.edge;
  const n = Math.max(1, Math.round((2 * lim) / STEP));
  const xs = Array.from({ length: n + 1 }, (_, i) => -lim + i * STEP);
  const win = fallers.map(g => { const [a, b] = windowOf(g, f); return [Math.floor((a - PAD) / DT), Math.ceil((b + PAD) / DT)] as [number, number]; });
  const steps = Math.max(1, ...win.map(w => w[1] + 1));
  const reach = Math.max(1, Math.floor((speed * DT) / STEP));
  // the spots under a wrong one, at each step
  const blocked = Array.from({ length: steps + 1 }, () => new Uint8Array(xs.length));
  fallers.forEach((g, j) => {
    if (g.right) return;
    const lo = Math.max(0, Math.ceil((g.x - KEEP_CLEAR + lim) / STEP)), hi = Math.min(xs.length - 1, Math.floor((g.x + KEEP_CLEAR + lim) / STEP));
    for (let k = Math.max(1, win[j][0]); k <= Math.min(steps, win[j][1]); k++) for (let i = lo; i <= hi; i++) if (Math.abs(xs[i] - g.x) < KEEP_CLEAR) blocked[k][i] = 1;
  });
  // where the buddy stands now may already be under a wrong one: that's the game's doing, not the plan's
  const can: boolean[][] = [xs.map((_, i) => i === nearest(xs, px))];
  let trapped = false;
  for (let k = 1; k <= steps; k++) {
    const prev = can[k - 1], row = new Array<boolean>(xs.length).fill(false);
    let any = false;
    for (let i = 0; i < xs.length; i++) {
      if (blocked[k][i]) continue;
      for (let d = -reach; d <= reach; d++) if (prev[i + d]) { row[i] = true; any = true; break; }
    }
    can.push(row);
    if (!any) { trapped = true; break; }
  }
  // working back from the end: the spots from which the buddy can stay safe all the way (catching a
  // right one is no good if it leaves the buddy cornered under a wrong one a moment later)
  const safe: boolean[][] = can.map(r => r.slice());
  if (trapped) safe.forEach(r => r.fill(false));
  else for (let k = can.length - 2; k >= 0; k--) {
    for (let i = 0; i < xs.length; i++) {
      if (!safe[k][i]) continue;
      let on = false;
      for (let d = -reach; d <= reach; d++) if (safe[k + 1][i + d]) { on = true; break; }
      safe[k][i] = on;
    }
  }
  const catchable = fallers.map((g, j) => {
    if (!g.right) return false;
    for (let k = Math.max(0, win[j][0] + 2); k <= Math.min(can.length - 1, win[j][1] - 2); k++) {
      const row = safe[k];
      for (let i = 0; i < xs.length; i++) if (row[i] && Math.abs(xs[i] - g.x) < SURE_CATCH) return true;
    }
    return false;
  });
  return { xs, can, safe, catchable, trapped, win };
}

/** Every right one in the air can be caught, and there's always a safe spot to stand. */
export function fair(fallers: Faller[], px: number, f: Field): boolean {
  const p = look(fallers, px, f);
  return !p.trapped && fallers.every((g, j) => !g.right || p.catchable[j]);
}

/** A child doesn't plan a path: they run straight at a right one and wait under it. So no wrong one comes
 *  down across that straight run (from where the buddy is to the right one) from a couple of seconds
 *  before the right one gets there until it's caught. */
export const RUN_AHEAD = 2;
export function straightRuns(fallers: Faller[], px: number, f: Field): boolean {
  const reach = NET.reach + NET.lead + NET.sway;
  for (const r of fallers) {
    if (!r.right) continue;
    const [a, b] = windowOf(r, f), lo = Math.min(px, r.x) - reach, hi = Math.max(px, r.x) + reach;
    for (const w of fallers) {
      if (w.right) continue;
      const [c, d] = windowOf(w, f);
      if (d >= a - RUN_AHEAD && c <= b && w.x > lo && w.x < hi) return false;
    }
  }
  return true;
}

/** Where to let a new Glimmer go (-1..1 across), spread out from the last one, at a spot that keeps play
 *  fair (and the straight runs clear); null when there's no such spot just now (try again in a moment). */
export function placeDrop(rng: () => number, fallers: Faller[], px: number, f: Field, d: { right: boolean; secs: number }, lastX: number, tries = 8): number | null {
  for (let t = 0; t < tries; t++) {
    let x = rng() * 1.8 - 0.9;
    if (Math.abs(x - lastX) < 0.4) x = x > 0 ? x - 0.7 : x + 0.7;
    const all = [...fallers, newFaller(x, d.secs, d.right, f)];
    if (straightRuns(all, px, f) && fair(all, px, f)) return x;
  }
  return null;
}

function nearest(xs: number[], x: number) {
  let b = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[b] - x)) b = i;
  return b;
}

/** A careful player's way ahead: a spot (field units) for each small step of time from now, toward the
 *  right one it can catch soonest along a path that stays clear of the wrong ones (or, with none to
 *  catch, somewhere safe). It holds until the Glimmers change (a new one, a catch). Used by the test. */
export function carefulPath(fallers: Faller[], px: number, f: Field): number[] {
  const p = look(fallers, px, f);
  const { xs, safe: can, win } = p;
  const reach = Math.max(1, Math.floor((PLAN_SPEED * DT) / STEP));
  const K = can.length - 1;
  let target = -1;
  fallers.forEach((g, j) => { if (p.catchable[j] && (target < 0 || win[j][0] < win[target][0])) target = j; });
  const isGoal = (k: number, i: number) => target >= 0 ? k >= win[target][0] + 2 && k <= win[target][1] - 2 && Math.abs(xs[i] - fallers[target].x) < SURE_CATCH : k === K;
  // working back from the end: the spots from which the goal can still be met
  const good: boolean[][] = Array.from({ length: K + 1 }, () => new Array<boolean>(xs.length).fill(false));
  for (let k = K; k >= 1; k--) {
    for (let i = 0; i < xs.length; i++) {
      if (!can[k][i]) continue;
      if (isGoal(k, i)) { good[k][i] = true; continue; }
      if (k < K) for (let d = -reach; d <= reach; d++) if (good[k + 1][i + d]) { good[k][i] = true; break; }
    }
  }
  const aim = target >= 0 ? fallers[target].x : px;
  const path: number[] = [];
  let at = nearest(xs, px);
  for (let k = 1; k <= K; k++) {
    let best = -1;
    for (let d = -reach; d <= reach; d++) {
      const i = at + d;
      if (i < 0 || i >= xs.length || !good[k][i]) continue;
      if (best < 0 || Math.abs(xs[i] - aim) < Math.abs(xs[best] - aim)) best = i;
    }
    if (best < 0) break;
    at = best; path.push(xs[at]);
    if (isGoal(k, at)) { for (let r = k + 1; r <= K && can[r][at]; r++) path.push(xs[at]); break; }
  }
  return path;
}

/** the planner's step of time (seconds), for the test's simulation */
export const PLAN_DT = DT;
