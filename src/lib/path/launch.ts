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
import { adventureVisit, lastWorld, worldSubject } from '../adventure/worlds';
import type { PathItem, Unit } from './units';
import { unitFromAssignment } from './classPath';
import { unitState } from './progress';
import { warmLesson } from './lessonProgress';
import { battleStop, journeyOf } from './journey';
import { clearPass, pass } from './pass';
import type { AssignmentData } from '../teach/assignments';

/** the subject My path shows when it opens again (after a Learn episode, from Home) */
export const pathView = { subject: '' };
/** the path item started last and the activity it opened ("lesson:<id>", "learn:<id>", "game:<id>",
 *  "battle:<world>"), so that activity's end card can offer the next one (path/next.ts); `trail`: it was
 *  started from a stop on the Journey trail, so its end card leads back to the trail */
export const pathRun: { cur: { ref: string; subject: string; unit: string; activity: string; trail?: boolean } | null } = { cur: null };

/** `trail`: started from a stop on the Journey trail (screens/Adventure.svelte): a battle starts straight away
 *  on that world's map instead of opening it. */
export function startItem(p: Profile, u: Unit, it: PathItem, trail = false) {
  const [k, a, b] = it.ref.split(':');
  const ran = (u: Unit, it: PathItem, activity: string) => { pathRun.cur = { ref: it.ref, subject: u.subject, unit: u.id, activity, trail }; };
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
  if (k === 'warm') {
    // a warm-up: a few questions from earlier lessons, made now (the most due)
    const l = warmLesson(p, a);
    if (l) { sfx.click(); game.setHome('math'); ran(u, it, `lesson:${l.id}`); game.startSkill(l.id); }
    return;
  }
  if (k === 'trip' || k === 'quick' || (k === 'check' && u.checkTrip)) {
    const id = k === 'trip' || k === 'quick' ? a : u.checkTrip!;
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
  if (k === 'game') {
    const t = SUBJECT.math.ways.games.things.find(x => x.id === a);
    ran(u, it, `game:${a}`);
    const was = game.screen;
    pass.game = true; // (a game on the path never counts against the Arcade's limit)
    if (t) openThing(SUBJECT.math, 'games', t);
    if (game.screen === was) clearPass();
    return;
  }
  if (k === 'battle') {
    // straight to that world's map, in this subject
    sfx.click();
    const subj = u.subject === 'typing' ? 'typing' : 'math';
    game.update(pp => { advOf(pp).subject = subj; });
    worldSubject.id = subj;
    lastWorld.id = a as WorldId;
    pass.world = a; pass.fought = false; // (Path only still opens this stop, and play time doesn't hold it up)
    ran(u, it, `battle:${a}`);
    if (trail) { game.battleNode = battleStop(p, a as WorldId).id; game.battleKey++; game.go('battle'); return; }
    // (the trail's own lit stop waits on the trail; any other opens its world)
    adventureVisit.free = journeyOf(p)?.lit?.item.ref !== it.ref;
    game.go('adventure');
    return;
  }
  pathRun.cur = null;
  if (k === 'thing') {
    const s = SUBJECT[u.subject], t = s?.ways[a as WayId]?.things.find(x => x.id === b);
    const was = game.screen;
    if (a === 'adventure') { pass.world = b; pass.fought = false; }
    if (a === 'games') pass.game = true;
    if (s && t) openThing(s, a as WayId, t);
    if (game.screen === was) clearPass();
  }
}

/** A teacher's unit from the Class work card: its next item not done yet (or the first, to go again). */
export function startUnitWork(p: Profile, a: AssignmentData & { id?: string }) {
  const u = unitFromAssignment({ id: a.id ?? 'new', title: a.title, items: a.items, unit: a.unit, subject: a.subject });
  const st = unitState(p, u, { since: a.start });
  const it = st.next ?? st.items[0];
  if (it) startItem(p, u, it);
}
