// Starting class work from the Class work card: the right activity, limited to what was assigned.
// Math skills start a skill trip built from the assigned skills (a trip is a lesson with a skill list:
// one is made for the assignment and filed with the others under `class-<area>`), or, for a fact strand
// (adding to 20, the times tables...), that strand's next trip. Typing starts the next assigned lesson,
// Learn the next episode, Show What You Know the next area's placement.
import { game } from '../state/game.svelte';
import type { Profile } from '../engine/profile';
import { mathOf, nextMathLesson } from '../math/progress';
import { PLACEMENTS } from '../math/course';
import { AREA, SKILL } from '../math/skills/registry';
import { skillStatus } from '../math/skills/progress';
import { SKILL_LESSON, SKILL_PLACEMENTS, skillRegionsOf, type SkillLesson } from '../math/skills/course';
import type { AreaId } from '../math/skills/types';
import { eventsOf } from './activity';
import { progressOf, type AssignmentData } from './assignments';

/** A skill trip on exactly these skills (one area's). Meets a skill not started yet with its trick first. */
export function classLesson(skills: string[], title: string, p: Profile): SkillLesson | null {
  const ok = skills.filter(id => SKILL[id] && !SKILL[id].facts);
  if (!ok.length) return null;
  const area = SKILL[ok[0]].area as AreaId;
  const same = ok.filter(id => SKILL[id].area === area);
  const m = mathOf(p);
  const fresh = same.some(id => skillStatus(m, id) === 'not started');
  const mixes = skillRegionsOf(area).flatMap(r => r.lessons).filter(l => l.kind === 'mix');
  const goal = mixes.length ? Math.round(mixes.reduce((t, l) => t + l.goal, 0) / mixes.length) : 5;
  const lesson: SkillLesson = {
    id: `class-${area}`, region: 'start', area, n: 1, title: title.slice(0, 40) || 'Class work', kind: fresh ? 'meet' : 'mix',
    skills: same, learn: fresh ? same : [], goal, move: 'run', world: skillRegionsOf(area)[0]?.world ?? 'village',
    blurb: same.length <= 3 ? `Class work: ${same.map(id => SKILL[id].name).join(', ')}.` : `Class work: ${same.length} ${AREA[area].name.toLowerCase()} skills, from ${SKILL[same[0]].name.toLowerCase()} to ${SKILL[same[same.length - 1]].name.toLowerCase()}.`,
  };
  (SKILL_LESSON as Record<string, SkillLesson>)[lesson.id] = lesson;
  return lesson;
}

/** Right answers on each assigned skill since the assignment was made (to start with the least practised). */
function rightSince(p: Profile, a: AssignmentData, id: string) {
  return eventsOf(p).filter(e => e.at >= a.start).reduce((t, e) => t + (e.s?.[id]?.r ?? 0), 0);
}

/** Open the activity for an assignment. */
export function startAssignment(p: Profile, a: AssignmentData) {
  const pr = progressOf(p, a);
  if (a.what === 'skills') {
    const order = [...a.skills].filter(id => SKILL[id]).sort((x, y) => rightSince(p, a, x) - rightSince(p, a, y));
    const first = order[0];
    if (!first) return;
    const f = SKILL[first].facts;
    if (f) { game.setHome('math'); game.startMath(nextMathLesson(mathOf(p), f).id); return; }
    const lesson = classLesson([first, ...order.filter(id => id !== first)], a.title, p);
    if (lesson) { game.setHome('math'); game.startSkill(lesson.id); }
    return;
  }
  const next = pr.parts.find(x => !x.done)?.id ?? pr.parts[0]?.id;
  if (!next) return;
  if (a.what === 'typing') { game.setHome('typing'); game.startLesson(next); return; }
  if (a.what === 'learn') { game.openLearn(next, 'hub'); return; }
  // Show What You Know
  const op = AREA[next as AreaId]?.op;
  game.setHome('math');
  if (op) game.startMath(PLACEMENTS[op].id);
  else { const l = SKILL_PLACEMENTS[next as AreaId]; if (l) game.startSkill(l.id); }
}
