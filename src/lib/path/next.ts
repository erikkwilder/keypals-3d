// "Next on my path": an activity started from My path or the Today card (path/launch.ts notes which)
// offers the path's next thing on its end card, to start straight away, instead of going back to Home
// and pressing Continue there.
import type { Profile } from '../engine/profile';
import { pathRun, startItem } from './launch';
import { nextFor } from './player.svelte';
import type { PathItem, Unit } from './units';

export type PathNext = { unit: Unit; item: PathItem };

/** The next thing on the path, when the activity ending now (`activity`: "lesson:<id>", "learn:<id>") was
 *  started from it; null when it wasn't, or when the next thing is this same one again (not passed yet:
 *  the end card's Try again is the way on). */
export function pathNext(p: Profile | null, activity: string): PathNext | null {
  const r = pathRun.cur;
  if (!p || !r || r.activity !== activity) return null;
  const n = nextFor(p, r.subject);
  if (!n || (n.item.ref === r.ref && n.unit.unit.id === r.unit)) return null;
  return { unit: n.unit.unit, item: n.item };
}
/** Start it (the same way My path does). */
export function startPathNext(p: Profile, n: PathNext) { startItem(p, n.unit, n.item); }
