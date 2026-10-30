// Where a child is on a math skill, for teachers: the one place class reports, "needs help" groups and
// "reach comfortable" goals read it. It's the game's own adaptive ability (math/skills/ability.ts: an
// estimate per skill and fact strand, from every answer in every mode), in the same words and six-step
// ladder as the grown-ups' skills report's "Working at" column: getting started, comfortable, strong,
// stretching (or not started, with nothing to go on yet).
import type { Profile } from '../engine/profile';
import { mathOf } from '../math/progress';
import { SKILL } from '../math/skills/registry';
import { workingOf, type Working } from '../math/skills/ability';

export type WorkingLevel = Working;
/** Lowest first. */
export const LEVELS: WorkingLevel[] = ['not started', 'getting started', 'comfortable', 'strong', 'stretching'];
export const levelRank = (l: WorkingLevel) => LEVELS.indexOf(l);
/** The level an assignment's "comfortable" goal asks for (strong and stretching count too). */
export const GOAL_LEVEL: WorkingLevel = 'comfortable';
export const atLeast = (l: WorkingLevel, goal: WorkingLevel = GOAL_LEVEL) => levelRank(l) >= levelRank(goal);
/** Colours for the grids (light backgrounds with dark text), and the words SkillsReport.svelte uses. */
export const LEVEL_COLOR: Record<WorkingLevel, { bg: string; ink: string; label: string; hint: string }> = {
  'not started': { bg: '#efedf3', ink: '#6d6680', label: 'Not started', hint: 'nothing to go on yet' },
  'getting started': { bg: '#fff0b8', ink: '#6a5200', label: 'Getting started', hint: 'the gentlest questions, with pictures' },
  comfortable: { bg: '#c9f1dd', ink: '#0f5a3c', label: 'Comfortable', hint: 'grade-level questions' },
  strong: { bg: '#bfe6fb', ink: '#0f4a6a', label: 'Strong', hint: 'bigger numbers, more steps' },
  stretching: { bg: '#e3d6ff', ink: '#4b2aa8', label: 'Stretching', hint: 'the hardest versions' },
};

/** A child's working level on one skill (or fact strand: add-facts...), with the rung of six it's on (0:
 *  not started), from the adaptive ability. */
export function workingStep(p: Profile, skillId: string, now = Date.now()): { rung: number; word: WorkingLevel } {
  if (!SKILL[skillId]) return { rung: 0, word: 'not started' };
  return workingOf(mathOf(p), skillId, now);
}
/** A child's working level on one skill. */
export const workingLevel = (p: Profile, skillId: string, now = Date.now()): WorkingLevel => workingStep(p, skillId, now).word;
