// One way around Keypals: every screen's level and the screen above it. Back always goes up one level
// (or back to where a cross-link came from: game.visit); Esc does the same. The game's own state
// (state/game.svelte.ts) keeps where you are and the cross-links; this file is only the map.
//
//   L0 Home
//   L1 Subjects (Typing, Math) · Places (Arcade, Adventure, My Sky Island) · My stuff · Grown-ups · My path
//   L2 a Topic (Math › Fractions) · My stuff's pages (Wardrobe, Shop, Dances...) · Play together (Duel, Rivals, Boards)
//   L2 under a topic: its Practice map and its Learn and Play lists
//   L3 activities (a trip, a lesson, a Learn episode, a game, a battle): no bar, one Pause button
import type { Screen } from './game.svelte';

/** What a screen shows besides its name: the subject, the topic, a tab. Two places are the same when
 *  their screen and these match. */
export type Ctx = Record<string, string | null>;
export type Place = { screen: Screen; ctx: Ctx };

/** the game's fields each screen depends on (they go into its Place, and come back with it) */
export const CTX_FIELDS: Partial<Record<Screen, string[]>> = {
  subject: ['subject'],
  topic: ['subject', 'topic'],
  map: ['subject', 'topic', 'mathArea', 'mathOp', 'typingArea'],
  way: ['subject', 'topic', 'wayId'],
  // (a page's tabs aren't places: Back leaves the page, not the other tab)
  grownups: ['guSection'],
  learn: ['learnId'],
};

/** L3: full screen, no top bar; one Pause button (ui/PauseButton.svelte) and its card */
export const ACTIVITIES = new Set<Screen>([
  'run', 'results', 'mathRun', 'mathResults', 'skillRun', 'skillResults', 'learn', 'playground', 'battle',
  'pizza', 'builder', 'market', 'clockrush', 'bench', 'shifter', 'shapebuilder', 'smoothie', 'treasure', 'showdown', 'balance',
  'drop', 'arcadePlay',
]);
/** before a player is picked: no bar (the title, the player list, a new player, a class's sign-in) */
export const START_SCREENS = new Set<Screen>(['title', 'players', 'newPlayer', 'classLogin']);
/** My stuff's own pages */
export const STUFF_PAGES = new Set<Screen>(['keypals', 'closet', 'shop', 'dances', 'stickers', 'glimmers', 'eggs', 'garden', 'progress']);

export const isActivity = (s: Screen) => ACTIVITIES.has(s);
/** a screen with the one top bar (ui/Bar.svelte) */
export const hasBar = (s: Screen) => !ACTIVITIES.has(s) && !START_SCREENS.has(s);

const HOME: Place = { screen: 'hub', ctx: {} };
const at = (screen: Screen, ctx: Ctx = {}): Place => ({ screen, ctx });

/** The place one level up (null on Home). An activity goes back to where it was started from. */
export function parentOf(pl: Place, from: Place | null = null): Place | null {
  const c = pl.ctx;
  const subj = c.subject ?? 'math';
  switch (pl.screen) {
    case 'hub': return null;
    case 'topic': return at('subject', { subject: subj });
    case 'map': case 'way':
      return c.topic ? at('topic', { subject: subj, topic: c.topic }) : at('subject', { subject: subj });
    case 'grownups': return c.guSection ? at('grownups', { guSection: null }) : HOME;
    case 'skills': return at('grownups', { guSection: 'progress' });
    // Play together, in the Arcade: Family Duel, Rival Ghosts and the Boards
    case 'duel': case 'rivals': case 'boards': return at('arcade');
    case 'players': case 'newPlayer': case 'classLogin': case 'title': return pl.screen === 'newPlayer' ? at('players') : null;
    default:
      if (STUFF_PAGES.has(pl.screen)) return at('mystuff');
      if (ACTIVITIES.has(pl.screen)) return from ?? HOME;
      return HOME;
  }
}

/** The level a screen is on (0 Home ... 3 an activity). */
export function levelOf(pl: Place, from: Place | null = null): number {
  let n = 0, cur: Place | null = pl;
  while (cur && cur.screen !== 'hub' && n < 12) { cur = parentOf(cur, from); n++; }
  return n;
}

export function samePlace(a: Place, b: Place): boolean {
  if (a.screen !== b.screen) return false;
  const keys = CTX_FIELDS[a.screen] ?? [];
  return keys.every(k => (a.ctx[k] ?? null) === (b.ctx[k] ?? null));
}

/** Is `up` this place, or a place above it? */
export function isAbove(up: Place, pl: Place, from: Place | null = null): boolean {
  let cur: Place | null = pl, n = 0;
  while (cur && n < 12) { if (samePlace(up, cur)) return true; cur = parentOf(cur, from); n++; }
  return false;
}
