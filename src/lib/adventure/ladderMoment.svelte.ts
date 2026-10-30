// The special eggs' moments (100-Glimmer ladder, ladder.ts): when a goal is met its egg arrives with a
// moment (LadderMoment.svelte), shown on the calm screens, never in the middle of a lesson or a battle.
import { game, type Screen } from '../state/game.svelte';
import { checkLadder, ladderNeedsWrite, type LadderNews } from './ladder';

/** Eggs that arrived and haven't had their moment yet. */
export const moment = $state<{ queue: LadderNews[] }>({ queue: [] });
/** Screens a moment may show over (and that look for new ones when opened). */
export const CALM_SCREENS = new Set<Screen>(['hub', 'map', 'adventure', 'glimmers', 'eggs', 'garden', 'arcade', 'stickers', 'closet', 'keypals', 'dances', 'shop', 'mystuff', 'subject', 'topic']);

/** Look for goals met (free when nothing's new) and queue their eggs' moments. */
export function lookForEggs(now = Date.now()) {
  const p = game.profile;
  if (!p || !ladderNeedsWrite(p, now)) return;
  let news: LadderNews[] = [];
  game.update(pp => { news = checkLadder(pp, now); });
  if (news.length) moment.queue = [...moment.queue, ...news];
}
/** The moment was seen. */
export const nextMoment = () => { moment.queue = moment.queue.slice(1); };
