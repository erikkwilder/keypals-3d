// The teacher's reports, worked out in the teacher's browser from each student's saved progress (a
// class of up to ~40): this week at a glance, the skills grid, the standards view, a student's own page
// and "needs help" groups. Nothing here is sent anywhere.
import type { Profile } from '../engine/profile';
import { mathOf } from '../math/progress';
import { AREA, SKILL } from '../math/skills/registry';
import type { AreaId } from '../math/skills/types';
import { eventsOf, lastWeeks, weekKey, weekStats } from './activity';
import { LEVELS, atLeast, workingLevel, type WorkingLevel } from './level';
import { LIVE_SKILLS, STANDARDS, isFor, progressOf, type Assignment, type Progress } from './assignments';

export type Kid = { id: string; name: string; profile: Profile | null };

/** This week (or any week) for the whole class. */
export function classWeekReport(kids: Kid[], week: string) {
  const rows = kids.map(k => {
    const w = k.profile ? weekStats(k.profile, week) : { right: 0, n: 0, ms: 0, stars: 0 };
    return { id: k.id, name: k.name, ms: w.ms, right: w.right, answered: w.n, acc: w.n ? w.right / w.n : null, played: w.ms > 0 || w.n > 0 };
  });
  const played = rows.filter(r => r.played);
  return {
    rows: rows.sort((a, b) => b.ms - a.ms || a.name.localeCompare(b.name)),
    minutes: Math.round(rows.reduce((t, r) => t + r.ms, 0) / 60000),
    right: rows.reduce((t, r) => t + r.right, 0),
    played: played.length, total: rows.length,
    notPlayed: rows.filter(r => !r.played).map(r => r.name),
  };
}

/** The skills to show for a grade: its own and the grades either side (fact strands always). */
export function skillsForGrade(grade: number): string[] {
  return LIVE_SKILLS.filter(s => s.facts || Math.abs(s.grade - grade) <= 1).map(s => s.id);
}
/** Students by skills, each cell a working level. */
export function skillsGrid(kids: Kid[], skills: string[]): { id: string; name: string; levels: WorkingLevel[] }[] {
  return kids.map(k => ({ id: k.id, name: k.name, levels: skills.map(s => (k.profile ? workingLevel(k.profile, s) : 'not started')) }));
}

/** Each Common Core standard the game covers: how many students are at each level on it (a student's
 *  level on a standard is their lowest level on its skills). */
export function standardsReport(kids: Kid[], only?: string[]) {
  const codes = only ?? STANDARDS;
  return codes.map(code => {
    const skills = LIVE_SKILLS.filter(s => s.standard === code);
    const per = kids.map(k => {
      const ls = skills.map(s => (k.profile ? workingLevel(k.profile, s.id) : 'not started'));
      const low = LEVELS[Math.min(...ls.map(l => LEVELS.indexOf(l)))] ?? 'not started';
      return { id: k.id, name: k.name, level: low };
    });
    const counts = Object.fromEntries(LEVELS.map(l => [l, per.filter(x => x.level === l).length])) as Record<WorkingLevel, number>;
    return { code, skills: skills.map(s => ({ id: s.id, name: s.name, grade: s.grade, area: AREA[s.area as AreaId].name })), counts, students: per };
  });
}

/** For each skill in the class's current assignments: who isn't comfortable on it yet. */
export function needsHelp(kids: Kid[], assignments: Assignment[]) {
  const skillIds = [...new Set(assignments.filter(a => !a.archived && a.what === 'skills').flatMap(a => a.skills))];
  return skillIds.map(id => {
    const assigned = kids.filter(k => assignments.some(a => !a.archived && a.what === 'skills' && a.skills.includes(id) && isFor(a, k.id)));
    const level = (k: Kid) => (k.profile ? workingLevel(k.profile, id) : 'not started');
    return {
      skill: id, name: SKILL[id]?.name ?? id, standard: SKILL[id]?.standard ?? '', plain: SKILL[id]?.plain ?? '',
      growing: assigned.filter(k => level(k) === 'growing').map(k => k.name),
      notStarted: assigned.filter(k => level(k) === 'not started').map(k => k.name),
      comfortable: assigned.filter(k => atLeast(level(k))).length, of: assigned.length,
    };
  }).filter(g => g.growing.length || g.notStarted.length);
}

/** One student's page: weeks (minutes, right answers, accuracy), skills, and every assignment. */
export function studentReport(kid: Kid, assignments: Assignment[], weeks = 8, now = Date.now()) {
  const p = kid.profile;
  const ws = lastWeeks(weeks, now).map(w => {
    const s = p ? weekStats(p, w) : { right: 0, n: 0, ms: 0, stars: 0 };
    return { week: w, minutes: Math.round(s.ms / 60000), right: s.right, answered: s.n, acc: s.n ? s.right / s.n : null };
  });
  const skills = p ? LIVE_SKILLS.map(s => ({ id: s.id, name: s.name, area: AREA[s.area].name, standard: s.standard, level: workingLevel(p, s.id) })).filter(s => s.level !== 'not started') : [];
  const work: { a: Assignment; pr: Progress }[] = p ? assignments.filter(a => isFor(a, kid.id)).map(a => ({ a, pr: progressOf(p, a, now) })) : [];
  const m = p ? mathOf(p) : null;
  const recent = p ? eventsOf(p).slice(-12).reverse() : [];
  return { weeks: ws, skills, work, learned: m?.learned?.length ?? 0, recent, thisWeek: weekKey(now) };
}
