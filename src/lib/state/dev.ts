// Shortcuts for checking screens: add #run=village-1, #map, #math, #mathrun=twins-2, #garden, #results, #stickers, #closet, #dances,
// #settings, #grownups or #new to the address. #tester (works on the live site too) adds a player
// called "Tester" who has passed every lesson and has every buddy at friendship 26, for trying the
// later levels, outfits and dances; it never touches other players.
import { game } from './game.svelte';
import { ALL_LESSONS } from '../engine/course';
import { BUDDIES } from '../art/cast';
import { teamOf } from '../engine/profile';
import { MATH_LESSONS, PLACEMENTS } from '../math/course';
import { mathOf } from '../math/progress';

/** A test player with everything open: every typing lesson, math trip and playground level passed,
 *  every buddy on the team, every outfit and dance. Other players are never touched. */
export function addTester() {
  const found = game.save.profiles.find(p => p.name === 'Tester');
  if (found) { game.save.activeId = found.id; game.persist(); } else game.addPlayer('Tester', 'dino', false);
  game.update(pp => {
    const now = Date.now();
    for (const l of ALL_LESSONS) pp.lessons[l.id] = { stars: 2, bestWpm: 30, bestAcc: 0.97, bestRide: 3, attempts: 1, passes: 1, lastAt: now, bestScore: 30, scoreSum: 30, finishes: 1 };
    // friendship 26 with everyone: every outfit and dance unlocked
    teamOf(pp).xp = Math.max(teamOf(pp).xp, 11000);
    const m = (pp.math = mathOf(pp));
    for (const l of [...MATH_LESSONS, ...Object.values(PLACEMENTS)]) m.lessons[l.id] = { stars: 2, bestScore: 20, bestFpm: 20, bestAcc: 0.95, bestRide: 3, attempts: 1, finishes: 1, passes: 1, lastAt: now, treasure: 3 };
    m.play = { line: { stars: [2, 2, 2, 2, 2], plays: 5 }, bonds: { stars: [2, 2, 2, 2, 2], plays: 5 }, build: { stars: [2, 2, 2, 2, 2], plays: 5 } };
    pp.allBuddies = true;
    pp.soundSetup = true;
  });
}

export function devBoot() {
  const h = location.hash.slice(1);
  if (!h) return;
  const [key, val] = h.split('=');
  const ensure = () => { if (!game.profile) game.addPlayer('Tester', 'dino', false); };
  if (key === 'map') { ensure(); game.go('map'); }
  if (key === 'hub') { ensure(); game.go('hub'); }
  if (key === 'playground') { ensure(); game.go('playground'); }
  if (key === 'run') { ensure(); game.startLesson(val || 'village-1'); }
  if (key === 'stickers') { ensure(); game.go('stickers'); }
  if (key === 'closet') { ensure(); game.go('closet'); }
  if (key === 'dances') { ensure(); game.openCloset('dances'); }
  if (key === 'settings') { ensure(); game.go('settings'); }
  if (key === 'grownups') { ensure(); game.go('grownups'); }
  if (key === 'new') game.go('newPlayer');
  // the math game: #math (math home), #mathrun=twins-2, #garden
  if (key === 'math') { ensure(); game.setHome('math'); game.go('map'); }
  if (key === 'mathrun') { ensure(); game.setHome('math'); game.startMath(val || 'twins-1'); }
  if (key === 'garden') { ensure(); game.go('garden'); }
  if (key === 'tester') { addTester(); game.go('map'); history.replaceState(null, '', location.pathname + location.search); }
}
