// "Next on my path": an activity started from My path or the Today card (path/launch.ts notes which)
// offers the path's next thing on its end card, to start straight away, instead of going back to Home
// and pressing Continue there. Every end card a path step can reach has it: trips and lessons, Learn
// episodes, the games and battles. An activity started from a stop on the Journey trail leads back to
// the trail instead, with the next stop lit (path/journey.ts).
import type { Profile } from '../engine/profile';
import { game } from '../state/game.svelte';
import { pathRun, startItem } from './launch';
import { nextFor, playerRules } from './player.svelte';
import { journeyOf, STOP_ICON, STOP_WORD } from './journey';
import { pathHolds } from './rules';
import { KIND_ICON, KIND_NAME, type PathItem, type Unit } from './units';

export type PathNext = {
  unit: Unit; item: PathItem;
  /** leads back to the Journey trail, where this is the next stop */
  trail?: boolean;
  /** the button's words and picture */
  word: string; name: string; icon: string;
};

/** The activity was started from a stop on the Journey trail. */
export const onTrail = (activity: string) => { const r = pathRun.cur; return !!r?.trail && r.activity === activity; };

/** The next thing on the path, when the activity ending now (`activity`: "lesson:<id>", "learn:<id>",
 *  "game:<id>", "battle:<world>") was started from it; null when it wasn't, or when the next thing is this
 *  same one again (not passed yet: the end card's Try again is the way on). From the Journey trail: the trail
 *  and its next stop, even when that's this same step again (a Try it goes on to its Practice there). */
export function pathNext(p: Profile | null, activity: string): PathNext | null {
  const r = pathRun.cur;
  if (!p || !r || r.activity !== activity) return null;
  if (r.trail) {
    const j = journeyOf(p), s = j?.lit;
    return j && s ? { unit: j.state.unit, item: s.item, trail: true, word: `Next stop · ${STOP_WORD[s.kind]}`, name: s.name, icon: STOP_ICON[s.kind] } : null;
  }
  const n = nextFor(p, r.subject);
  if (!n || (n.item.ref === r.ref && n.unit.unit.id === r.unit)) return null;
  return { unit: n.unit.unit, item: n.item, word: `Next on my path · ${KIND_NAME[n.item.kind]}`, name: n.item.name, icon: KIND_ICON[n.item.kind] };
}
/** Take it: back to the trail, or start it the same way My path does. */
export function startPathNext(p: Profile, n: PathNext) {
  // (a market or clock episode plays over the page it was started from: closing it is going back)
  const over = !!game.learnOverlay;
  game.learnOverlay = null; game.learnCheck = false;
  if (!n.trail) startItem(p, n.unit, n.item);
  else if (!over) game.leaveActivity();
}
/** Enter on a game's end card: true when the path took it (the game's own Enter plays again otherwise). */
export function endEnter(p: Profile | null, activity: string): boolean {
  const n = pathNext(p, activity);
  if (p && n) startPathNext(p, n);
  return !!n || !mayRepeat(p, activity);
}
/** Whether an end card may offer this same thing again: not while a grown-up or teacher is keeping the player
 *  to the path, and not from the Journey trail, where the lit stop is the one way on. */
export function mayRepeat(p: Profile | null, activity: string): boolean {
  if (!p) return true;
  return !onTrail(activity) && !pathHolds(p, playerRules(p));
}
