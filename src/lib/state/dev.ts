// Shortcuts for checking screens during development: add #run=village-1, #map, #results,
// #stickers, #closet, #settings, #grownups or #new to the address.
import { game } from './game.svelte';

export function devBoot() {
  const h = location.hash.slice(1);
  if (!h) return;
  const [key, val] = h.split('=');
  const ensure = () => { if (!game.profile) game.addPlayer('Tester', 'dino', false); };
  if (key === 'map') { ensure(); game.go('map'); }
  if (key === 'run') { ensure(); game.startLesson(val || 'village-1'); }
  if (key === 'stickers') { ensure(); game.go('stickers'); }
  if (key === 'closet') { ensure(); game.go('closet'); }
  if (key === 'settings') { ensure(); game.go('settings'); }
  if (key === 'grownups') { ensure(); game.go('grownups'); }
  if (key === 'new') game.go('newPlayer');
}
