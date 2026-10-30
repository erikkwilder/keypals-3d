// The trips made for the curriculum's lessons (path/curriculum.ts, lessonSpecs.ts). A skill lesson gets a
// practice trip on just its subs and rungs (`les-<lesson>`) and a short quick check (`les-<lesson>-qc`); a
// fact lesson on a few fact groups gets the same for each operation (`les-<lesson>-plus`...). They are
// filed with the other trips by id (SKILL_LESSON, MATH_LESSON), so they play, score and save like any
// trip, but they are not stops on the islands: the maps don't change. A unit's check is one more trip on
// all its lessons (`unit-<unit>`), and Show What You Know for a grade or a unit is a placement whose ladder
// is the lessons' skills (`swyk-<grade or unit>`).
//
// (No runtime imports from the math course files: they import this to build their lists.)
import type { MathLesson, MathMove } from '../math/course';
import type { SkillLesson, SkillRegion } from '../math/skills/course';
import type { Op } from '../math/facts';
import type { AreaId } from '../math/skills/types';
import { CUR_LESSONS, CUR_UNITS, type CurLesson } from './curriculum';
import { SPEC, unitTitle, type Band, type LessonSpec } from './lessonSpecs';

export const OP_NAME: Record<Op, string> = { '+': 'plus', '-': 'minus', x: 'times', '/': 'share' };
const FACT_SKILL: Record<Op, string> = { '+': 'add-facts', '-': 'sub-facts', x: 'mult-facts', '/': 'div-facts' };
export const isFactSkill = (s: string) => Object.values(FACT_SKILL).includes(s);
/** how many questions a quick check asks */
export const QC_LENGTH = 6;

export const lessonById: Record<string, CurLesson> = Object.fromEntries(CUR_LESSONS.map(l => [l.id, l]));
const skillOfKey = (k: string) => (k.includes(':') ? k.slice(0, k.indexOf(':')) : k);
/** A lesson's skill practice: its skills (in order), its memory keys (skill:sub, or a bare skill for all of it) and its rungs. */
export function skillPart(id: string): { skills: string[]; keys: string[]; rungs?: Band } | null {
  const s = SPEC[id]?.skill;
  if (!s) return null;
  return { skills: [...new Set(s.keys.map(skillOfKey))], keys: s.keys, rungs: s.rungs };
}
/** A fact lesson's groups by operation (trips made on them), or null (its region's own stops). */
const factGroups = (sp: LessonSpec) => (sp.facts && 'groups' in sp.facts ? sp.facts.groups : null);
const opsOf = (g: Partial<Record<Op, string[]>>) => (['+', '-', 'x', '/'] as Op[]).filter(o => g[o]?.length);

/** The trips a lesson's Practice step plays, in order. */
export function practiceTrips(id: string): string[] {
  const sp = SPEC[id];
  if (!sp) return [];
  if (sp.skill) return [`les-${id}`];
  const g = factGroups(sp);
  if (g) return opsOf(g).map(o => `les-${id}-${OP_NAME[o]}`);
  return sp.facts && 'trips' in sp.facts ? [...sp.facts.trips] : [];
}
/** The trips a lesson's Quick check plays (none: the check is read from how the child is doing). */
export function checkTrips(id: string): string[] {
  const sp = SPEC[id];
  if (!sp) return [];
  if (sp.skill) return [`les-${id}-qc`];
  const g = factGroups(sp);
  if (g) return opsOf(g).map(o => `les-${id}-${OP_NAME[o]}-qc`);
  return sp.facts && 'checks' in sp.facts ? [...sp.facts.checks] : [];
}
/** The fact skill and groups a fact lesson works on (from its region stops' groups, given as `regionGroups`). */
export function factPart(id: string, regionGroups: (trip: string) => { op: Op; groups: string[] } | null): { op: Op; skill: string; groups: string[] }[] {
  const sp = SPEC[id];
  if (!sp?.facts) return [];
  const g = factGroups(sp);
  if (g) return opsOf(g).map(o => ({ op: o, skill: FACT_SKILL[o], groups: g[o]! }));
  const out: { op: Op; skill: string; groups: string[] }[] = [];
  for (const t of practiceTrips(id)) {
    const r = regionGroups(t);
    if (!r) continue;
    const have = out.find(x => x.op === r.op);
    if (have) have.groups = [...new Set([...have.groups, ...r.groups])]; else out.push({ op: r.op, skill: FACT_SKILL[r.op], groups: [...r.groups] });
  }
  return out;
}
/** The rung a lesson's grade-level work sits at (3, inside its band), and how able a child must be to be
 *  comfortable with it (the same "comfortable" as everywhere: one rung below it). */
export const gradeRung = (b?: Band) => (b ? Math.max(b[0], Math.min(b[1], 3)) : 3);
export const comfortableAt = (b?: Band) => gradeRung(b) - 1;

// ---------- the trips themselves ----------
type Home = { area: AreaId; world: SkillLesson['world']; move: MathMove; goal: number };
/** Where a skill's trips run and how they score: the island its Meet is on. */
function homeOf(skill: string, regions: SkillRegion[]): Home | null {
  for (const r of regions) {
    if (!r.skills.includes(skill)) continue;
    const meet = r.lessons.find(l => l.kind === 'meet' && l.learn.includes(skill)) ?? r.lessons[0];
    return { area: r.area, world: r.world, move: meet.move, goal: meet.goal };
  }
  return null;
}
const short = (s: string) => (s.length > 40 ? `${s.slice(0, 39).trimEnd()}…` : s);

/** Every skill lesson's practice trip and quick check, and each unit's check (on its skill lessons). */
export function skillLessonTrips(regions: SkillRegion[]): SkillLesson[] {
  const out: SkillLesson[] = [];
  for (const l of CUR_LESSONS) {
    const sp = SPEC[l.id], part = skillPart(l.id);
    if (!sp?.skill || !part) continue;
    const home = homeOf(part.skills[0], regions);
    if (!home) continue;
    const base = { region: 'start', area: home.area, n: 1, skills: part.skills, goal: home.goal, move: home.move, world: home.world, subs: part.keys, rungs: part.rungs, ep: null } as const;
    out.push({ ...base, id: `les-${l.id}`, title: short(l.kidTitle), kind: 'meet', learn: part.skills, blurb: l.grownUp });
    out.push({ ...base, id: `les-${l.id}-qc`, title: short(`Quick check: ${l.kidTitle}`), kind: 'check', learn: [], blurb: 'A few questions to show you\'ve got it.', length: QC_LENGTH });
  }
  for (const u of CUR_UNITS) {
    const ls = CUR_LESSONS.filter(l => l.unit === u.id && SPEC[l.id]?.skill);
    if (!ls.length) continue;
    const keys = [...new Set(ls.flatMap(l => skillPart(l.id)!.keys))];
    const skills = [...new Set(ls.flatMap(l => skillPart(l.id)!.skills))];
    const home = homeOf(skills[0], regions);
    if (!home) continue;
    out.push({ id: `unit-${u.id}`, region: 'start', area: home.area, n: 1, title: short(`Unit check: ${unitTitle(u)}`), kind: 'check', skills, learn: [], goal: home.goal, move: home.move, world: home.world,
      blurb: 'Every kind of question in this unit. Show you\'re comfortable with all of it.', subs: keys, ep: null });
  }
  return out;
}

/** Show What You Know for a grade or a unit: a placement (an adaptive staircase, skills/placement.ts) on a
 *  ladder of the lessons' skills, a grade apart as the area ladders are (ability.ts GRADE_RUNGS), and
 *  every skill lesson's quick check it can test out. Fact lessons have the strands' own placements. */
export const swykId = (scope: string) => `swyk-${scope}`;
/** the scopes: `g0`...`g8` for a grade, a unit's id */
export const gradeScope = (g: number) => `g${g}`;
export function swykTrips(regions: SkillRegion[]): SkillLesson[] {
  const out: SkillLesson[] = [];
  const make = (scope: string, title: string, ls: CurLesson[]) => {
    const sk = ls.filter(l => SPEC[l.id]?.skill);
    if (!sk.length) return;
    const g0 = Math.min(...sk.map(l => l.grade));
    // (one grade's skills share a step on the ladder: they come from different areas, so there is no
    // order among them the way an area's own skills have one)
    const ladder: { skill: string; base: number }[] = [];
    for (const l of sk) for (const s of skillPart(l.id)!.skills) if (!ladder.some(x => x.skill === s)) ladder.push({ skill: s, base: 2.5 * (l.grade - g0) });
    const home = homeOf(ladder[0].skill, regions);
    if (!home) return;
    out.push({
      id: swykId(scope), region: 'start', area: home.area, n: 1, title: 'Show What You Know', kind: 'placement', skills: ladder.map(x => x.skill), learn: [],
      goal: home.goal, move: 'run', world: home.world, blurb: `A quick mix of ${title}. Answer what you know and skip ahead!`, ep: null,
      subs: [...new Set(sk.flatMap(l => skillPart(l.id)!.keys))], ladder,
      testOut: sk.map(l => { const p = skillPart(l.id)!; return { trip: `les-${l.id}-qc`, skills: p.skills, keys: p.keys, min: comfortableAt(p.rungs) }; }),
    });
  };
  for (let g = 0; g <= 8; g++) make(gradeScope(g), g === 0 ? 'Kindergarten' : `grade ${g}`, CUR_LESSONS.filter(l => l.grade === g));
  for (const u of CUR_UNITS) {
    const ls = CUR_LESSONS.filter(l => l.unit === u.id);
    if (ls.length >= 2) make(u.id, `this unit: ${unitTitle(u).toLowerCase()}`, ls);
  }
  return out;
}

/** The fact trips made on a lesson's own groups (within 5, ten pairs...): practice, and a quick check. */
export function factLessonTrips(goalOf: (op: Op) => number, stops: (trip: string) => { op: Op; groups: string[] } | null): MathLesson[] {
  const out: MathLesson[] = [];
  const mk = (id: string, title: string, kind: MathLesson['kind'], op: Op, groups: string[], blurb: string, length?: number): MathLesson =>
    ({ id, region: 'start', n: 1, title: short(title), kind, op, groups, learn: kind === 'check' ? groups : groups, tables: op === 'x' ? groups.map(g => +g.slice(1)) : [], goal: goalOf(op), blurb, length });
  for (const l of CUR_LESSONS) {
    const g = factGroups(SPEC[l.id] ?? { learn: null });
    if (!g) continue;
    for (const o of opsOf(g)) {
      const id = `les-${l.id}-${OP_NAME[o]}`;
      out.push(mk(id, l.kidTitle, 'practice', o, g[o]!, l.grownUp));
      out.push(mk(`${id}-qc`, `Quick check: ${l.kidTitle}`, 'check', o, g[o]!, 'A few questions to show you\'ve got it.', 8));
    }
  }
  // a unit of facts only: its check is a run on all its facts of the operation it has most of
  for (const u of CUR_UNITS) {
    const ls = CUR_LESSONS.filter(l => l.unit === u.id && SPEC[l.id]);
    if (!ls.length || ls.some(l => SPEC[l.id].skill)) continue;
    const parts = ls.flatMap(l => factPart(l.id, stops));
    const ops = opsOf(Object.fromEntries(parts.map(f => [f.op, f.groups])) as Partial<Record<Op, string[]>>);
    const op = ops.sort((a, b) => parts.filter(f => f.op === b).length - parts.filter(f => f.op === a).length)[0];
    if (!op) continue;
    const groups = [...new Set(parts.filter(f => f.op === op).flatMap(f => f.groups))].filter(gr => gr !== 'x0' && gr !== 'x1');
    out.push(mk(`unit-${u.id}`, `Unit check: ${unitTitle(u)}`, 'check', op, groups, 'Every kind of question in this unit. Show you\'re comfortable with all of it.', 16));
  }
  return out;
}

/** The trip ids a lesson's practice used before the curriculum (the plan's `trips`): moving on from one of
 *  them counts as having practised the lesson. */
export const sourceTrips = (id: string) => lessonById[id]?.trips ?? [];
