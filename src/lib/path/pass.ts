// What the path or class work opened just now. Path only closes Adventure and the Arcade's games stay on the
// free-time clock, except for the stop or the game the path sends you to: launch.ts writes it down as it
// starts one, and App.svelte asks here as each screen opens. It ends when you leave: after that battle, or
// once the game is over.
import type { Screen } from '../state/game.svelte';

/** The Arcade's games, wherever they're opened from. */
export const ARCADE_GAMES_SCREENS: Screen[] = ['arcadePlay', 'pizza', 'builder', 'market', 'clockrush', 'shifter', 'smoothie', 'treasure', 'showdown', 'balance', 'bench', 'shapebuilder', 'playground'];
export const pass = { world: null as string | null, game: false, fought: false };
export const clearPass = () => { pass.world = null; pass.game = false; pass.fought = false; };
export const passOn = (screen: Screen) => (!!pass.world && (screen === 'battle' || (screen === 'adventure' && !pass.fought))) || (pass.game && ARCADE_GAMES_SCREENS.includes(screen));
/** Each screen as it opens: is the pass still good here? */
export function keepPass(screen: Screen) {
  if (pass.world && screen === 'battle') { pass.fought = true; return; }
  // (back on the map after that battle: the stop is done with)
  if (pass.world && screen === 'adventure' && !pass.fought) return;
  if (pass.game && ARCADE_GAMES_SCREENS.includes(screen)) return;
  clearPass();
}
