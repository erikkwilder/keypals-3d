// Starting an item on My path: the right episode, trip, lesson, game or world, the same way the subject
// pages start them (nav.ts), so it plays exactly as it does from there. A Learn episode comes back to
// the path; trips and lessons end on their results, whose Home button leads back to Today's Continue.
import { game } from '../state/game.svelte';
import { sfx } from '../audio/sound';
import type { Profile } from '../engine/profile';
import { LESSON as TYPING_LESSON } from '../engine/course';
import { MATH_LESSON } from '../math/course';
import { SKILL_LESSON } from '../math/skills/course';
import { SUBJECT, type WayId } from '../subjects';
import { openThing } from '../nav';
import { classLesson } from '../teach/launch';
import { advOf, type WorldId } from '../adventure/state';
import { lastWorld, worldSubject } from '../adventure/worlds';
import type { PathItem, Unit } from './units';
import { unitFromAssignment } from './classPath';
import { unitState } from './progress';
import type { AssignmentData } from '../teach/assignments';

/** the subject My path shows when it opens again (after a Learn episode, from Home) */
export const pathView = { subject: '' };
/** the path item started last and the activity it opened ("lesson:<id>", "learn:<id>"), so that
 *  activity's end card can offer the next one (path/next.ts) */
export const pathRun: { cur: { ref: string; subject: string; unit: string; activity: string } | null } = { cur: null };
const ran = (u: Unit, it: PathItem, activity: string) => { pathRun.cur = { ref: it.ref, subject: u.subject, unit: u.id, activity }; };

export function startItem(p: Profile, u: Unit, it: PathItem) {
  const [k, a, b] = it.ref.split(':');
  pathView.subject = u.subject;
  if (k === 'ep') {
    const t = SUBJECT.math.ways.learn.things.find(x => x.id === a);
    // the market and the clockmaker's episodes open over their area's map, like from the Learn tab
    if (t && t.kind !== 'episode') { ran(u, it, `learn:${a}`); openThing(SUBJECT.math, 'learn', t); return; }
    sfx.click();
    game.setHome('math');
    game.learnCheck = false;
    ran(u, it, `learn:${a}`);
    game.openLearn(a);
    return;
  }
  if (k === 'trip' || (k === 'check' && u.checkTrip)) {
    const id = k === 'trip' ? a : u.checkTrip!;
    sfx.click();
    ran(u, it, `lesson:${id}`);
    if (TYPING_LESSON[id] && (u.subject === 'typing' || (!MATH_LESSON[id] && !SKILL_LESSON[id]))) { game.setHome('typing'); game.startLesson(id); return; }
    game.setHome('math');
    if (MATH_LESSON[id]) game.startMath(id);
    else if (SKILL_LESSON[id]) game.startSkill(id);
    return;
  }
  if (k === 'check') {
    // a teacher's unit: a trip on its skills
    const skills = u.items.filter(x => x.ref.startsWith('skill:')).map(x => x.ref.slice(6));
    const l = classLesson(skills, u.name, p);
    if (l) { sfx.click(); game.setHome('math'); ran(u, it, `lesson:${l.id}`); game.startSkill(l.id); }
    return;
  }
  if (k === 'skill') {
    const l = classLesson([a], it.name, p);
    if (l) { sfx.click(); game.setHome('math'); ran(u, it, `lesson:${l.id}`); game.startSkill(l.id); }
    return;
  }
  pathRun.cur = null;
  if (k === 'game') {
    const t = SUBJECT.math.ways.games.things.find(x => x.id === a);
    if (t) openThing(SUBJECT.math, 'games', t);
    return;
  }
  if (k === 'battle') {
    // straight to that world's map, in this subject
    sfx.click();
    const subj = u.subject === 'typing' ? 'typing' : 'math';
    game.update(pp => { advOf(pp).subject = subj; });
    worldSubject.id = subj;
    lastWorld.id = a as WorldId;
    game.go('adventure');
    return;
  }
  if (k === 'thing') {
    const s = SUBJECT[u.subject], t = s?.ways[a as WayId]?.things.find(x => x.id === b);
    if (s && t) openThing(s, a as WayId, t);
  }
}

/** A teacher's unit from the Class work card: its next item not done yet (or the first, to go again). */
export function startUnitWork(p: Profile, a: AssignmentData & { id?: string }) {
  const u = unitFromAssignment({ id: a.id ?? 'new', title: a.title, items: a.items, unit: a.unit, subject: a.subject });
  const st = unitState(p, u, { since: a.start });
  const it = st.next ?? st.items[0];
  if (it) startItem(p, u, it);
}
