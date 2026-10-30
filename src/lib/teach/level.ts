// Where a child is on a math skill, for teachers: the one place class reports, "needs help" groups and
// "reach comfortable" goals read it. Today it comes from the skill's status (math/skills/progress.ts:
// not started, growing, solid; solid shows as "comfortable"). When skills get their own adaptive levels,
// point workingLevel at them and everything in src/lib/teach follows.
import type { Profile } from '../engine/profile';
import { mathOf } from '../math/progress';
import { groupFacts } from '../math/course';
import { factId } from '../math/facts';
import { SKILL } from '../math/skills/registry';
import { skillStatus } from '../math/skills/progress';

export type WorkingLevel = 'not started' | 'growing' | 'comfortable';
/** Lowest first. */
export const LEVELS: WorkingLevel[] = ['not started', 'growing', 'comfortable'];
export const levelRank = (l: WorkingLevel) => LEVELS.indexOf(l);
/** The level an assignment's "comfortable" goal asks for. */
export const GOAL_LEVEL: WorkingLevel = 'comfortable';
export const atLeast = (l: WorkingLevel, goal: WorkingLevel = GOAL_LEVEL) => levelRank(l) >= levelRank(goal);
/** Colours for the grids (light backgrounds with dark text). */
export const LEVEL_COLOR: Record<WorkingLevel, { bg: string; ink: string; label: string }> = {
  'not started': { bg: '#efedf3', ink: '#6d6680', label: 'Not started' },
  growing: { bg: '#fff0b8', ink: '#6a5200', label: 'Growing' },
  comfortable: { bg: '#c9f1dd', ink: '#0f5a3c', label: 'Comfortable' },
};

/** A child's working level on one skill. Fact strands (adding to 20, the times tables...) read the fact
 *  memory the way the grown-ups' skills report does; every other skill its own memory. */
export function workingLevel(p: Profile, skillId: string): WorkingLevel {
  const m = mathOf(p);
  const s = SKILL[skillId];
  if (!s) return 'not started';
  let st: 'not started' | 'growing' | 'solid';
  if (s.facts) {
    const ids = s.subs.flatMap(sb => groupFacts(sb.id)).map(factId);
    const stages = ids.map(id => m.facts[id]?.stage ?? 0);
    st = stages.every(x => x === 0) ? 'not started' : stages.filter(x => x === 3).length >= ids.length * 0.8 && stages.every(x => x >= 2) ? 'solid' : 'growing';
  } else st = skillStatus(m, skillId);
  return st === 'solid' ? 'comfortable' : st;
}
