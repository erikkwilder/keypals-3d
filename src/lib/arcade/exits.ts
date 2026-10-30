// Where an arcade game was opened from, and the ways back out of it. Every game's stop or pause card and
// its end card offer "Back to the Arcade"; a game opened from a math page (one part of math, or the Games
// list) also offers the way back to that same page, one opened from Home offers Home, and the Block Table
// opened from the Playground offers the Playground. A game reads this once, as it opens.
import { game, type Screen } from '../state/game.svelte';
import { AREA, areaOfOp } from '../math/skills/registry';
import type { AreaId } from '../math/skills/types';

/** a way back: the page's name, what its button says ("Back to Fractions", "Back Home"), and going */
export type Way = { label: string; text: string; go: () => void };
export type Exits = {
  /** opened from the Arcade's plaza */
  fromArcade: boolean;
  toArcade: () => void;
  /** the page it was opened from, when that wasn't the Arcade */
  other: Way | null;
  /** Back from the menus: wherever it was opened from */
  back: () => void;
  /** what Back says ("the Arcade", "Fractions", "Home") */
  backTo: string;
};

/** Read where this game was opened from (call once, as the game opens). `area` is the game's own part of
 *  math: its map is the way back when the game was opened from somewhere else (a link, a lesson); a game
 *  with no area (the fact games, Glimmer Drop) then just offers the Arcade. */
export function exitsOf(area?: AreaId): Exits {
  const came: Screen = game.cameFrom;
  const fromArcade = game.gameFrom === 'arcade' || came === 'arcade';
  game.gameFrom = 'map';
  // the math page as it was (its part and its way), so going back lands on the same page
  const page = { area: game.mathArea, op: game.mathOp, way: { ...game.way } };
  const toArcade = () => game.go('arcade');
  let other: Way | null = null;
  if (!fromArcade) {
    if (came === 'hub') other = { label: 'Home', text: 'Back Home', go: () => game.go('hub') };
    else if (came === 'playground') other = { label: 'the Playground', text: 'Back to the Playground', go: () => game.go('playground') };
    else if (came === 'map') {
      const part = page.op ? areaOfOp(page.op) : page.area;
      const label = part && AREA[part as AreaId] ? AREA[part as AreaId].name : page.way.math === 'games' ? 'Math games' : 'Math';
      other = {
        label, text: `Back to ${label}`,
        go: () => { game.mathArea = page.area; game.mathOp = page.op; game.way = page.way; game.setHome('math'); game.go('map'); },
      };
    } else if (area) other = { label: AREA[area].name, text: `Back to ${AREA[area].name}`, go: () => { game.mathArea = area; game.mathOp = AREA[area].op ?? null; game.setHome('math'); game.go('map'); } };
  }
  return {
    fromArcade,
    toArcade,
    other,
    back: () => (other ? other.go() : toArcade()),
    backTo: other ? other.label : 'the Arcade',
  };
}
