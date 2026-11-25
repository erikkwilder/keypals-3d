// Less motion, for the whole game: on when the game's own "Less motion" is ticked (Settings), or when the
// computer asks for less motion (its reduce-motion setting, which a child who needs it sets once for every
// app and site), and it follows the computer's setting as that changes. The page's data-motion (app.css
// stills the CSS animations by it), Home's live buddy, the FancyAnt film and the 3D world (three/calm.ts:
// the island's idle loops, the title's camera sway, buddies breathing) go by it. The computer's setting
// doesn't change the game's own: that stays as it was left.
import { game } from '../state/game.svelte';

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
let computer = $state(media?.matches ?? false);
const follow = (e: { matches: boolean }) => { computer = e.matches; };
// (older Safari has only addListener)
if (media?.addEventListener) media.addEventListener('change', follow); else media?.addListener?.(follow);

export const motion = {
  /** the computer asks for less motion */
  get computer() { return computer; },
  /** less motion: the game's own "Less motion", or the computer's setting */
  get reduced() { return computer || !!game.settings.reducedMotion; },
};
