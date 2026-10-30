// The last few times shells came in, for the shells card in the top bar: how many, and where you were
// playing. Shells are paid in many places (lessons, trips, battles, the Arcade, the island), so instead of
// each of them writing it down, this watches the player's shells and notes every rise with the screen it
// happened on. It's kept on this computer only (a few lines per player), never in the save.
import { untrack } from 'svelte';
import { game, type Screen } from './game.svelte';
import { advView } from '../adventure/state';

export type ShellNote = { n: number; at: number; where: string };
const KEY = 'keypals-shell-log';
const KEEP = 8;

/** where shells came from, by the screen showing when they did (or just before: results come after) */
const WHERE: Partial<Record<Screen, string>> = {
  run: 'Typing lesson', results: 'Typing lesson', mathRun: 'Math trip', mathResults: 'Math trip', skillRun: 'Math trip', skillResults: 'Math trip',
  learn: 'Learning a new trick', battle: 'Adventure battle', adventure: 'Adventure', duel: 'Family Duel', rivals: 'Rival Ghosts', glimmers: 'Adventure',
  eggs: 'Adventure', arcade: 'Arcade', arcadePlay: 'Arcade game', pizza: 'Pizza Rush', builder: 'Number Builder', market: 'Market Dash', clockrush: 'Clock Rush',
  shifter: 'Shape Shifter', smoothie: 'Smoothie Stand', treasure: 'Treasure Grid', showdown: 'Spinner Showdown', balance: 'Balance Beam', playground: 'Playground',
  island: 'My Sky Island', stickers: 'Stickers and medals', garden: 'Fact Garden', map: 'Practice', hub: 'Playing',
};

function readAll(): Record<string, ShellNote[]> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}; } catch { return {}; }
}
function writeAll(all: Record<string, ShellNote[]>) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* fine: it's only a reminder */ }
}

/** the notes, newest first, for the player playing (reactive: bumps when a new one comes in) */
let bump = $state(0);
export function shellNotes(id: string | undefined): ShellNote[] {
  void bump;
  return id ? (readAll()[id] ?? []) : [];
}

// watch the shells: a rise is noted with the screen it happened on
let seen: { id: string; shells: number } | null = null;
let lastScreen: Screen = game.screen;
$effect.root(() => {
  $effect(() => {
    const p = game.profile, scr = game.screen;
    const shells = p ? advView(p).shells : 0;
    untrack(() => {
      if (!p) { seen = null; return; }
      if (!seen || seen.id !== p.id) { seen = { id: p.id, shells }; lastScreen = scr; return; }
      const rise = shells - seen.shells;
      seen.shells = shells;
      if (rise > 0) {
        const all = readAll();
        const where = WHERE[scr] && scr !== 'hub' && scr !== 'map' ? WHERE[scr]! : WHERE[lastScreen] ?? 'Playing';
        all[p.id] = [{ n: rise, at: Date.now(), where }, ...(all[p.id] ?? [])].slice(0, KEEP);
        writeAll(all);
        bump++;
      }
      lastScreen = scr;
    });
  });
});
