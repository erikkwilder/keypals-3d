// Shortcuts for checking screens: add #run=village-1, #map, #results, #stickers, #closet, #dances,
// #settings, #grownups or #new to the address. #tester (works on the live site too) adds a player
// called "Tester" who has passed every lesson and has every buddy at friendship 26, for trying the
// later levels, outfits and dances; it never touches other players.
import { game } from './game.svelte';
import { ALL_LESSONS } from '../engine/course';
import { BUDDIES } from '../art/cast';
import { newPalProgress } from '../engine/stickers';

function tester() {
  const found = game.save.profiles.find(p => p.name === 'Tester');
  if (found) { game.save.activeId = found.id; game.persist(); } else game.addPlayer('Tester', 'dino', false);
  game.update(pp => {
    const now = Date.now();
    for (const l of ALL_LESSONS) pp.lessons[l.id] = { stars: 2, bestWpm: 30, bestAcc: 0.97, bestRide: 3, attempts: 1, passes: 1, lastAt: now, bestScore: 30, scoreSum: 30, finishes: 1 };
    // friendship 26 with everyone: every outfit and dance unlocked
    for (const b of BUDDIES) (pp.pals[b.id] ??= newPalProgress()).xp = 11000;
    pp.soundSetup = true;
  });
}

export function devBoot() {
  const h = location.hash.slice(1);
  if (!h) return;
  const [key, val] = h.split('=');
  const ensure = () => { if (!game.profile) game.addPlayer('Tester', 'dino', false); };
  if (key === 'map') { ensure(); game.go('map'); }
  if (key === 'run') { ensure(); game.startLesson(val || 'village-1'); }
  if (key === 'stickers') { ensure(); game.go('stickers'); }
  if (key === 'closet') { ensure(); game.go('closet'); }
  if (key === 'dances') { ensure(); game.openCloset('dances'); }
  if (key === 'settings') { ensure(); game.go('settings'); }
  if (key === 'grownups') { ensure(); game.go('grownups'); }
  if (key === 'new') game.go('newPlayer');
  if (key === 'tester') { tester(); game.go('map'); history.replaceState(null, '', location.pathname + location.search); }
}
