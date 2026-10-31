// The way out of an activity (an arcade game, a math area's game, a toy, Glimmer Drop): back to where it
// was started from (the Arcade, a topic's page, its Play list, Home), the same place the Pause card's
// "Back to ..." goes (game.from, kept by state/game.svelte.ts). A game reads this once, as it opens.
import { game } from '../state/game.svelte';
import { placeName } from '../nav';
import { pathRun } from '../path/launch';
import type { AreaId } from '../math/skills/types';

export type Exits = {
  /** back to where it was started from */
  back: () => void;
  /** what that place is called ("the Arcade", "Fractions", "Home") */
  backTo: string;
};

/** Where this game goes back to (`area` is kept for the callers; every game goes back where it came from). */
export function exitsOf(_area?: AreaId): Exits {
  const from = game.from;
  const name = from ? placeName(from) : 'Home';
  return {
    back: () => game.leaveActivity(),
    backTo: from?.screen === 'adventure' && pathRun.cur?.trail ? 'the trail' : name === 'Arcade' ? 'the Arcade' : name,
  };
}
