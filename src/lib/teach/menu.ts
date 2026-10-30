// The compass menu's entries for classes: Class work (for a player in a class) and the Boards.
import { game } from '../state/game.svelte';
import type { Profile } from '../engine/profile';
import { classesOf } from './student.svelte';
import { progressOf } from './assignments';

export type MenuTile = { id: string; name: string; line: string; img?: string; hot?: boolean; go: () => void };

export function classTiles(p: Profile): MenuTile[] {
  const cs = classesOf(p);
  const out: MenuTile[] = [];
  if (cs.length) {
    const work = cs.flatMap(c => c.assignments);
    const open = work.filter(a => progressOf(p, a).done < 1).length;
    out.push({ id: 'classwork', name: 'Class work', img: 'icons/book.webp', line: work.length ? (open ? `${open} to do for ${cs[0].teacher}` : 'All done!') : cs[0].name, hot: open > 0, go: () => game.go('hub') });
  }
  if (p.cloud) out.push({ id: 'boards', name: 'Boards', img: 'icons/chart.webp', line: cs.length ? 'Your class this week' : 'Family and world', go: () => game.go('boards') });
  return out;
}
