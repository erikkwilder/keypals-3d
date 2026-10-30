// My path for the player who's playing: the rules that hold for them (their grown-ups' and their class's:
// rules.ts), their teacher's units at the top of the path, the subject the path shows, and the clock that
// counts minutes in the free-time places (the Fact Garden, My Sky Island, the Wardrobe and Shop, Dances).
import { game } from '../state/game.svelte';
import type { Profile } from '../engine/profile';
import { classesOf, type StudentClass } from '../teach/student.svelte';
import type { Assignment } from '../teach/assignments';
import { unitFromAssignment } from './classPath';
import { nextOnPath, unitState, type UnitState } from './progress';
import { addUsed, placeOf, rulesFor, type ClassSettings, type FreePlace, type Rules } from './rules';
import { PATH_SUBJECTS, type Unit } from './units';
import { pathView } from './launch';

/** The classes whose rules hold for a player: the ones that made the player (a family's own player linked
 *  to a class plays by the family's rules at home). */
export const ruledBy = (p: Profile | null): StudentClass[] => classesOf(p).filter(c => !c.home);
/** Each such class's rules, with the class's grade (the math path starts there). */
export const classRules = (p: Profile | null): ClassSettings[] => ruledBy(p).map(c => ({ ...(c.settings ?? {}), grade: c.grade }));
/** The rules for a player now. */
export const playerRules = (p: Profile, now = Date.now()): Rules => rulesFor(p, classRules(p), now);

export type ClassUnit = { unit: Unit; a: Assignment; teacher: string; state: UnitState };
/** A player's teacher's units (class work that's a unit), in the order they were given. */
export function classUnits(p: Profile | null, now = Date.now()): ClassUnit[] {
  if (!p) return [];
  return classesOf(p).flatMap(c => c.assignments.filter(a => a.what === 'unit' && !a.archived).map(a => {
    const unit = unitFromAssignment(a);
    return { unit, a, teacher: c.teacher, state: unitState(p, unit, { now, since: a.start }) };
  }));
}
/** A teacher's units as notePath wants them (counted from when each was given). */
export const classUnitsForNotes = (p: Profile) => classesOf(p).flatMap(c => c.assignments.filter(a => a.what === 'unit' && !a.archived).map(a => ({ unit: unitFromAssignment(a), since: a.start })));

/** The subject the path shows: the one picked there last, else the one Home plays. */
export const pathSubject = () => pathView.subject || game.homeGame;
/** The next thing for a player: a teacher's unit first, then the subject's own path. */
export function nextFor(p: Profile, subject?: string, now = Date.now()) {
  const cu = classUnits(p, now).find(x => x.state.next);
  if (cu) return { unit: cu.state, item: cu.state.next!, teacher: cu.teacher };
  // a subject's own page asks for that subject; Home asks for the one played last, and when that path is
  // all done, the next subject that still has something to do
  const order = subject ? [subject] : [pathSubject(), ...PATH_SUBJECTS().map(s => s.id).filter(id => id !== pathSubject())];
  for (const s of order) {
    const n = nextOnPath(p, s, now, s === 'math' ? playerRules(p, now).grade : null);
    if (n) return { ...n, teacher: null as string | null };
  }
  return null;
}

// ---------- the free-time clock ----------
/** minutes being counted now, not yet written to the save (the doors read it, so they close on time) */
export const freeClock = $state({ place: null as FreePlace | null, running: 0 });
let timer: ReturnType<typeof setInterval> | undefined;
let who: string | null = null;
/** Write the minutes counted so far into the player's save. */
function flush() {
  const p = game.save.profiles.find(x => x.id === who);
  if (p && freeClock.place && freeClock.running > 0) {
    addUsed(p, freeClock.place, freeClock.running);
    p.updatedAt = Date.now();
    game.persist();
    game.onProfileChange?.();
  }
  freeClock.running = 0;
}
/** Count time while a free-time place is on screen (App.svelte calls this whenever the screen changes). */
export function watchFree(screen: Parameters<typeof placeOf>[0], closetTab: string, playerId: string | null) {
  const place = playerId ? placeOf(screen, closetTab) : null;
  if (place === freeClock.place && playerId === who) return;
  flush();
  clearInterval(timer);
  freeClock.place = place; who = playerId;
  if (!place) return;
  let ticks = 0;
  timer = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    freeClock.running += 1000;
    if (++ticks % 30 === 0) flush();
  }, 1000);
}
