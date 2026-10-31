// A teacher's unit (class work of the kind "a unit"): a list of path items in the teacher's order, made
// from one of the path's own units or put together by hand (skills, episodes, games, battles, a check).
// It shows at the top of the student's My path, and its progress is counted from when it was given.
import type { AssignmentData } from '../teach/assignments';
import { TYPING_SUBJECT_REFS, itemOf, unitById, type Unit } from './units';

type UnitWork = Pick<AssignmentData, 'title'> & { id: string; items?: string[]; unit?: string; subject?: string };

/** The subject a list of items belongs to (typing lessons make it typing). */
export const subjectOfItems = (refs: string[]) => (refs.some(r => TYPING_SUBJECT_REFS(r)) ? 'typing' : 'math');

/** A teacher's unit as a path unit. */
export function unitFromAssignment(a: UnitWork): Unit {
  const base = a.unit ? unitById(a.unit) : null;
  const items = a.items ?? [];
  const subject = a.subject ?? base?.subject ?? subjectOfItems(items);
  return {
    id: `class:${a.id}`, subject, area: base?.area ?? 'class', region: base?.region, n: base?.n ?? 0, name: a.title, part: base ? `${base.part} · ${base.name}` : 'Class work',
    blurb: base?.blurb ?? '', grade: base?.grade ?? null, color: base?.color ?? '#7c5cf5', art: base?.art ?? 'icons/book.webp',
    skills: base?.skills ?? [], groups: base?.groups, checkTrip: base?.checkTrip, gameNeed: 1, battleNeed: 1, world: base?.world,
    items: items.map(r => itemOf(r, subject)),
  };
}
