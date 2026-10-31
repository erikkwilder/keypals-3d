// "Load progress from a file": what a file would do to the players on this computer. A player already
// here (the same id) would be replaced by the file's copy, so the grown-up is told who first.
import type { Profile } from '../engine/profile';

export type Clash = { id: string; name: string; hereAt: number; fileAt: number };
/** The players in a file who'd replace someone on this computer. */
export function clashes(here: Profile[], file: Profile[]): Clash[] {
  return file.flatMap(f => {
    const h = here.find(x => x.id === f.id);
    return h ? [{ id: f.id, name: h.name, hereAt: h.updatedAt ?? 0, fileAt: f.updatedAt ?? 0 }] : [];
  });
}
/** The list of players once a file is loaded: the same ids replaced, new ones added. */
export function loadInto(here: Profile[], file: Profile[]): Profile[] {
  const ids = new Set(file.map(f => f.id));
  return [...here.map(x => (ids.has(x.id) ? file.find(f => f.id === x.id)! : x)), ...file.filter(f => !here.some(x => x.id === f.id))];
}
/** The words a grown-up reads before loading. */
export function clashText(c: Clash[]): string {
  const fmt = (t: number) => (t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'an earlier day');
  return c.map(x => `${x.name} is already on this computer. Loading swaps ${x.name}'s progress here for the copy in the file, from ${fmt(x.fileAt)}.`).join(' ');
}
