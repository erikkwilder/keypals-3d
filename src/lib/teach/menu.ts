// The Menu's entries that aren't places of their own: My path (what's next, for everyone), Class
// work (for a player in a class) and the Boards.
import { game } from '../state/game.svelte';
import type { Profile } from '../engine/profile';
import { classesOf } from './student.svelte';
import { progressOf } from './assignments';
import { doneToday } from '../path/progress';
import { nextFor, playerRules } from '../path/player.svelte';

export type MenuTile = { id: string; name: string; line: string; img?: string; hot?: boolean; go: () => void };

export function classTiles(p: Profile): MenuTile[] {
  const cs = classesOf(p);
  const out: MenuTile[] = [];
  // My path: today's things and the unit you're on
  const rules = playerRules(p), next = nextFor(p), done = doneToday(p);
  out.push({ id: 'path', name: 'My path', img: 'icons/path.webp', line: `${Math.min(done, rules.goal)} of ${rules.goal} today${!next ? '' : next.teacher ? ` · ${next.unit.unit.name}` : ` · Unit ${next.unit.unit.n}`}`, hot: done < rules.goal, go: () => game.go('path') });
  if (cs.length) {
    const work = cs.flatMap(c => c.assignments);
    const open = work.filter(a => progressOf(p, a).done < 1).length;
    out.push({ id: 'classwork', name: 'Class work', img: 'icons/book.webp', line: work.length ? (open ? `${open} to do for ${cs[0].teacher}` : 'All done!') : cs[0].name, hot: open > 0, go: () => game.go('hub') });
  }
  if (p.cloud) out.push({ id: 'boards', name: 'Boards', img: 'icons/chart.webp', line: cs.length ? 'Your class this week' : 'Family and world', go: () => game.go('boards') });
  return out;
}
