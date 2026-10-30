// Shortcuts for checking screens: add #run=village-1, #map, #math, #mathrun=twins-2, #garden, #arcade, #arcade=slalom, #results, #stickers, #closet, #dances,
// #settings, #grownups or #new to the address. #tester (works on the live site too) adds a player
// called "Tester" who has passed every lesson and has every buddy at friendship 26, for trying the
// later levels, outfits and dances; it never touches other players.
import { game } from './game.svelte';
import { ALL_LESSONS } from '../engine/course';
import { BUDDIES } from '../art/cast';
import { buddyPal } from '../engine/profile';
import { MATH_LESSONS, PLACEMENTS } from '../math/course';
import { mathOf } from '../math/progress';
import { advOf } from '../adventure/state';
import { lastWorld } from '../adventure/worlds';
import type { GlimmerId } from '../adventure/glimmers';
import { ITEM, ITEMS } from '../adventure/gear';

/** A test player with everything open: every typing lesson, math trip and playground level passed,
 *  every buddy on the team, every outfit and dance. Other players are never touched. */
export function addTester() {
  const found = game.save.profiles.find(p => p.name === 'Tester');
  if (found) { game.save.activeId = found.id; game.persist(); } else game.addPlayer('Tester', 'dino', false);
  game.update(pp => {
    const now = Date.now();
    for (const l of ALL_LESSONS) pp.lessons[l.id] = { stars: 2, bestWpm: 30, bestAcc: 0.97, bestRide: 3, attempts: 1, passes: 1, lastAt: now, bestScore: 30, scoreSum: 30, finishes: 1 };
    // friendship 26 with everyone: every outfit and dance unlocked
    for (const b of BUDDIES) buddyPal(pp, b.id).xp = Math.max(buddyPal(pp, b.id).xp, 11000);
    const m = (pp.math = mathOf(pp));
    for (const l of [...MATH_LESSONS, ...Object.values(PLACEMENTS)]) m.lessons[l.id] = { stars: 2, bestScore: 20, bestFpm: 20, bestAcc: 0.95, bestRide: 3, attempts: 1, finishes: 1, passes: 1, lastAt: now, treasure: 3 };
    m.play = { line: { stars: [2, 2, 2, 2, 2], plays: 5 }, bonds: { stars: [2, 2, 2, 2, 2], plays: 5 }, build: { stars: [2, 2, 2, 2, 2], plays: 5 } };
    pp.allBuddies = true;
    pp.soundSetup = true;
  });
}

export function devBoot() {
  if (import.meta.env.DEV) (window as unknown as { __game: typeof game }).__game = game;
  const h = location.hash.slice(1);
  if (!h) return;
  const [key, val] = h.split('=');
  const ensure = () => { if (!game.profile) game.addPlayer('Tester', 'dino', false); };
  if (key === 'map') { ensure(); game.go('map'); }
  if (key === 'hub') { ensure(); game.go('hub'); }
  // every little surprise at once, for checking them (src/lib/fun): #eggs-all, #eggs-all=pumpkins|snow, #eggs-all=off
  if (key === 'eggs-all') { try { if (val === 'off') localStorage.removeItem('keypals-eggs-all'); else localStorage.setItem('keypals-eggs-all', val || '1'); } catch { /* fine */ } }
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
  // a skill trip straight away: #skill=place-a-3 (any skill lesson id)
  if (key === 'skill') { ensure(); game.setHome('math'); game.startSkill(val || 'place-a-1'); }
  if (key === 'garden') { ensure(); game.go('garden'); }
  // Adventure: #adventure (or #adventure=falls for that world), #battle=meadow-0 (or falls-0), #glimmers, #eggs
  if (key === 'adventure') { ensure(); if (val === 'sky' || val === 'falls' || val === 'caves' || val === 'market' || val === 'stars') lastWorld.id = val; game.go('adventure'); }
  if (key === 'battle') { ensure(); game.battleNode = val || 'meadow-0'; game.battleKey++; game.go('battle'); }
  if (key === 'glimmers') { ensure(); game.go('glimmers'); }
  if (key === 'eggs') { ensure(); game.go('eggs'); }
  // Family Duel and Rival Ghosts: #duel, #rivals
  if (key === 'duel') { ensure(); game.duelMode = 'duel'; game.duelRival = null; game.duelKey++; game.go('duel'); }
  if (key === 'rivals') { ensure(); game.go('rivals'); }
  // Pizza Rush, the fractions arcade game: #pizza
  if (key === 'pizza') { ensure(); game.go('pizza'); }
  // Number Builder, the place value arcade game: #builder; the Playground's Block Table: #builder=toy
  if (key === 'builder') { ensure(); import('../math/place/builder').then(b => { b.builderOpen.toy = val === 'toy'; b.builderOpen.from = val === 'toy' ? 'playground' : 'map'; game.go('builder'); }); }
  // Market Dash, the money arcade game: #market
  if (key === 'market') { ensure(); game.go('market'); }
  // Balance Beam, the expressions and equations arcade game: #balance; a Star Lab episode: #alg-learn=alg-balance
  if (key === 'balance') { ensure(); game.go('balance'); }
  if (key === 'alg-learn') { ensure(); game.mathArea = 'algebra'; game.mathOp = null; game.openLearn(val || 'alg-balance', 'map'); }
  // a money Learn episode over the Decimals and money map: #market-learn=dec-coins
  if (key === 'market-learn') { ensure(); game.mathArea = 'decimals'; game.mathOp = null; game.go('map'); game.learnOverlay = val || 'dec-coins'; }
  // Glimmer Drop: #drop
  if (key === 'drop') { ensure(); game.go('drop'); }
  // the Arcade: #arcade (the plaza), #arcade=slalom|catch|tower (straight into a round), #arcade=daily
  if (key === 'arcade') { ensure(); game.setHome('math'); if (val === 'daily') import('../arcade/arcade').then(a => game.playArcade(a.dailyGame(), true)); else if (val) game.playArcade(val as 'slalom' | 'catch' | 'tower'); else game.go('arcade'); }
  // Learn: #learn (the list of tricks) or #learn=make-ten (that lesson)
  if (key === 'learn') { ensure(); game.openLearn(val || null, 'map'); }
  // evolutions: #evolve=puddlepup (level 5, ready to evolve), #evolved=puddlepup,sparkmoth (grown up, on the team)
  if (key === 'evolve' || key === 'evolved') {
    ensure();
    const ids = (val || 'puddlepup').split(',') as GlimmerId[];
    game.update(pp => {
      const a = advOf(pp);
      ids.forEach((id, i) => { const o = (a.glimmers[id] ??= { level: 1, xp: 0, got: Date.now() }); o.level = Math.max(o.level, 5); o.evolved = key === 'evolved'; if (i < 2) a.team[i] = id; });
    });
    game.glimmerSel = ids[0];
    game.go('glimmers');
  }
  // gear: #gear (the Gear tab), #gear=all (every piece for your buddy, 2000 shells), #gear=sky_kite,fairy_wings (just those, worn)
  if (key === 'gear') {
    ensure();
    if (val) game.update(pp => {
      const a = advOf(pp);
      a.shells = Math.max(a.shells, 2000);
      const g = ((a.gear ??= {})[pp.buddy] ??= { owned: [], on: {} });
      const ids = val === 'all' ? ITEMS.map(i => i.id) : val.split(',');
      for (const id of ids) { if (!ITEM[id]) continue; if (!g.owned.includes(id)) g.owned.push(id); g.on[ITEM[id].slot] = id; }
    });
    game.openCloset('gear');
  }
  if (key === 'tester') { addTester(); game.go('map'); history.replaceState(null, '', location.pathname + location.search); }
  // every sound in the game, with Play buttons (works on the live site too)
  if (key === 'sounds') void Promise.all([import('svelte'), import('../ui/SoundBoard.svelte')]).then(([s, m]) => s.mount(m.default, { target: document.body }));
}
