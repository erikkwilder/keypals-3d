// Class work: what a teacher assigns, and how far each child has got. An assignment is some math skills
// (picked by area, skill or Common Core standard), typing lessons, Learn episodes, or a Show What You
// Know, or a whole unit (a list of My path items: Learn, practice, a game, a battle and a check, from one of
// the path's units or put together by hand, path/classPath.ts); a goal (right answers, minutes, reaching
// "comfortable" on the skills, or finishing each one); a
// due date; the whole class or chosen students; and how it's scored (finishing it, accuracy, or both).
// Progress is counted from the child's own activity entries (activity.ts) since the assignment was made,
// so practising the same skills from the map counts too, not only the Class work card.
import type { Profile } from '../engine/profile';
import { dayKey } from '../engine/profile';
import { ALL_LESSONS } from '../engine/course';
import { mathOf } from '../math/progress';
import { PLACEMENTS } from '../math/course';
import { LESSONS as TRICKS } from '../math/learn';
import { FRAC_LESSONS } from '../math/fracEpisodes';
import { DATA_LESSONS } from '../math/data/episodes';
import { AREA, SKILL, SKILLS } from '../math/skills/registry';
import { SKILL_PLACEMENTS } from '../math/skills/course';
import type { AreaId } from '../math/skills/types';
import { eventsOf, type ClassEvent } from './activity';
import { atLeast, workingLevel } from './level';
import { unitFromAssignment } from '../path/classPath';
import { describe as describeItem } from '../path/units';
import { unitState } from '../path/progress';

export type What = 'skills' | 'typing' | 'learn' | 'check' | 'unit';
export type GoalType = 'right' | 'minutes' | 'comfortable' | 'finish';
export type Scoring = 'completion' | 'accuracy' | 'both';
export type AssignmentData = {
  title: string; what: What;
  /** math skills (what: skills) */
  skills: string[];
  /** typing lessons (what: typing) */
  lessons: string[];
  /** Learn episodes (what: learn) */
  episodes: string[];
  /** areas for a Show What You Know (what: check) */
  areas: string[];
  /** a unit's items, in order (what: unit; path/units.ts: ep:, trip:, skill:, game:, battle:, check), the
   *  path unit it was made from (if any) and its subject */
  items?: string[]; unit?: string; subject?: string;
  /** how the skills were picked, in words ("Fractions", "3.NF.A.1") */
  by: string;
  goal: { type: GoalType; n: number };
  scoring: Scoring;
  /** counting starts here; due at the end of this day (or no due date) */
  start: number; due: number | null;
  /** the students it's for (null: the whole class) */
  students: string[] | null;
};
export type Assignment = AssignmentData & { id: string; created: number; archived?: boolean };
export type Status = 'not started' | 'started' | 'done' | 'late';
export type Progress = {
  /** 0 to 1 */
  done: number;
  right: number; answered: number; ms: number;
  /** right of answered (null: nothing answered, or nothing to answer) */
  acc: number | null;
  /** 0 to 100, by the assignment's scoring */
  score: number;
  status: Status;
  /** when it was finished (null: not yet) */
  finishedAt: number | null;
  /** each part: a skill, lesson, episode or area, and whether it's done */
  parts: { id: string; name: string; done: boolean }[];
};

/** The goals each kind of assignment can have (the first is the usual one). */
export const GOALS_FOR: Record<What, GoalType[]> = { skills: ['right', 'minutes', 'comfortable'], typing: ['finish', 'minutes', 'right'], learn: ['finish'], check: ['finish'], unit: ['finish'] };
export const GOAL_DEFAULT: Record<GoalType, number> = { right: 30, minutes: 20, comfortable: 1, finish: 1 };

// ---------- names, for screens and the gradebook ----------
export const EPISODES = [...TRICKS.map(l => ({ id: l.id, title: l.title })), ...FRAC_LESSONS.map(l => ({ id: l.id, title: l.title })), ...DATA_LESSONS.map(l => ({ id: l.id, title: l.title }))];
const EPISODE: Record<string, string> = Object.fromEntries(EPISODES.map(e => [e.id, e.title]));
const TYPING: Record<string, string> = Object.fromEntries(ALL_LESSONS.map(l => [l.id, l.title]));
/** The Show What You Know trip for each area that has one. */
export function placementOf(area: string): string | null {
  const op = AREA[area as AreaId]?.op;
  if (op) return PLACEMENTS[op]?.id ?? null;
  return SKILL_PLACEMENTS[area as AreaId]?.id ?? null;
}
export const CHECK_AREAS = Object.keys(AREA).filter(a => AREA[a as AreaId].live && placementOf(a));
export function partName(a: Pick<AssignmentData, 'what'>, id: string): string {
  if (a.what === 'skills') return SKILL[id]?.name ?? id;
  if (a.what === 'typing') return TYPING[id] ?? id;
  if (a.what === 'learn') return EPISODE[id] ?? id;
  if (a.what === 'unit') return describeItem(id).name;
  return AREA[id as AreaId]?.name ?? id;
}
export const partsOf = (a: Pick<AssignmentData, 'what' | 'skills' | 'lessons' | 'episodes' | 'areas' | 'items'>) => ({ skills: a.skills, typing: a.lessons, learn: a.episodes, check: a.areas, unit: a.items ?? [] })[a.what] ?? [];
export function goalText(a: Pick<AssignmentData, 'goal' | 'what'>): string {
  const n = a.goal.n;
  switch (a.goal.type) {
    case 'right': return a.what === 'typing' ? `${n} words typed right` : `${n} right answers`;
    case 'minutes': return `${n} minutes`;
    case 'comfortable': return 'Comfortable on every skill';
    default: return a.what === 'learn' ? 'Watch each one' : a.what === 'check' ? 'Finish each one' : a.what === 'unit' ? 'Every part of the unit' : 'Finish each lesson';
  }
}
export const WHAT_NAME: Record<What, string> = { skills: 'Math skills', typing: 'Typing lessons', learn: 'Learn episodes', check: 'Show What You Know', unit: 'A unit' };
export const STATUS_NAME: Record<Status, string> = { 'not started': 'Not started', started: 'Started', done: 'Done', late: 'Late' };
/** A due date as people say it: "Fri, Oct 31". */
export const dueText = (due: number | null) => (due ? new Date(due).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'No due date');
/** The end of a day picked on a date input ("2026-10-31" → that day at 23:59, local time). */
export function endOfDay(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}
export const isFor = (a: Pick<AssignmentData, 'students'>, studentId: string) => !a.students || a.students.includes(studentId);

// ---------- skills: by area, by standard ----------
export const LIVE_SKILLS = SKILLS.filter(s => AREA[s.area].live);
export const skillsInArea = (area: string) => LIVE_SKILLS.filter(s => s.area === area).map(s => s.id);
export const STANDARDS = [...new Set(LIVE_SKILLS.map(s => s.standard))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
export const skillsForStandard = (code: string) => LIVE_SKILLS.filter(s => s.standard === code).map(s => s.id);

// ---------- progress ----------
/** Score out of 100. Completion: how much of the goal is done. Accuracy: right answers of all answered. */
export function scoreOf(done: number, acc: number | null, scoring: Scoring): number {
  const c = Math.round(Math.max(0, Math.min(1, done)) * 100);
  if (scoring === 'completion' || acc === null) return c;
  const a = Math.round(Math.max(0, Math.min(1, acc)) * 100);
  return scoring === 'accuracy' ? a : Math.round((c + a) / 2);
}
/** Not started, started, done (finished by the due date), or late (the due date passed first). */
export function statusOf(done: number, finishedAt: number | null, any: boolean, due: number | null, now = Date.now()): Status {
  if (done >= 1 && finishedAt !== null) return due !== null && finishedAt > due ? 'late' : 'done';
  if (due !== null && now > due) return 'late';
  return any ? 'started' : 'not started';
}

const share = (e: ClassEvent, skills: Set<string>) => {
  let r = 0, n = 0;
  for (const [sk, x] of Object.entries(e.s ?? {})) if (skills.has(sk)) { r += x.r; n += x.n; }
  return { r, n };
};

/** How far a child is on an assignment: counted from what they did since it was made. */
export function progressOf(p: Profile, a: Assignment | AssignmentData, now = Date.now()): Progress {
  const evs = eventsOf(p).filter(e => e.at >= a.start && e.at <= now);
  const goal = a.goal, ids = partsOf(a);
  let right = 0, answered = 0, ms = 0, done = 0, finishedAt: number | null = null, any = false;
  let parts: Progress['parts'] = [];
  /** the time a running total first reached the goal */
  const reach = (list: { at: number; v: number }[], need: number) => { let t = 0; for (const x of list) { t += x.v; if (t >= need) return x.at; } return null; };

  if (a.what === 'skills') {
    const set = new Set(ids);
    const mine = evs.map(e => ({ e, ...share(e, set) })).filter(x => x.n > 0);
    for (const x of mine) { right += x.r; answered += x.n; ms += x.e.n ? x.e.ms * (x.n / x.e.n) : 0; }
    any = mine.length > 0;
    const levels = ids.map(id => ({ id, name: partName(a, id), done: atLeast(workingLevel(p, id)) }));
    if (goal.type === 'right') { done = right / goal.n; finishedAt = reach(mine.map(x => ({ at: x.e.at, v: x.r })), goal.n); }
    else if (goal.type === 'minutes') { done = ms / (goal.n * 60000); finishedAt = reach(mine.map(x => ({ at: x.e.at, v: x.e.n ? x.e.ms * (x.n / x.e.n) : 0 })), goal.n * 60000); }
    else {
      done = levels.filter(l => l.done).length / Math.max(1, levels.length);
      // reached when the last skill got there: the latest practice on them (or now, if it was already so)
      if (done >= 1) finishedAt = mine.length ? mine[mine.length - 1].e.at : Math.min(now, Math.max(a.start, now));
      any = any || levels.some(l => l.done);
    }
    parts = goal.type === 'comfortable' ? levels : ids.map(id => {
      const s = mine.reduce((t, x) => t + (x.e.s?.[id]?.r ?? 0), 0);
      return { id, name: partName(a, id), done: s > 0 };
    });
  } else if (a.what === 'typing') {
    const set = new Set(ids);
    const mine = evs.filter(e => e.k === 'typing' && set.has(e.l));
    for (const e of mine) { right += e.r; answered += e.n; ms += e.ms; }
    any = mine.length > 0;
    parts = ids.map(id => ({ id, name: partName(a, id), done: mine.some(e => e.l === id && e.f) }));
    if (goal.type === 'finish') {
      done = parts.filter(x => x.done).length / Math.max(1, parts.length);
      if (done >= 1) finishedAt = Math.max(...ids.map(id => mine.find(e => e.l === id && e.f)!.at));
    } else if (goal.type === 'minutes') { done = ms / (goal.n * 60000); finishedAt = reach(mine.map(e => ({ at: e.at, v: e.ms })), goal.n * 60000); }
    else { done = right / goal.n; finishedAt = reach(mine.map(e => ({ at: e.at, v: e.r })), goal.n); }
  } else if (a.what === 'learn') {
    const m = mathOf(p), on = m.learnedOn ?? {};
    parts = ids.map(id => ({ id, name: partName(a, id), done: (m.learned ?? []).includes(id) }));
    done = parts.filter(x => x.done).length / Math.max(1, parts.length);
    any = done > 0;
    // learned on a day: counted as the end of that day (episodes from before the assignment count as done)
    if (done >= 1) finishedAt = Math.max(...ids.map(id => { const d = on[id]; if (!d) return a.start; const [y, mo, dd] = d.split('-').map(Number); return Math.max(a.start, new Date(y, mo - 1, dd, 23, 59).getTime()); }));
    if (finishedAt !== null && dayKey(finishedAt) === dayKey(now)) finishedAt = Math.min(finishedAt, now);
  } else if (a.what === 'unit') {
    // a unit: each item done the My path way, games, battles and skill practice counted since it was given
    const u = unitFromAssignment({ id: 'id' in a ? a.id : 'new', title: a.title, items: a.items, unit: a.unit, subject: a.subject });
    const st = unitState(p, u, { now, since: a.start, events: evs });
    parts = st.items.map(it => ({ id: it.ref, name: it.name, done: it.done }));
    done = st.done / Math.max(1, st.of);
    const trips = new Set(st.items.filter(i => i.ref.startsWith('trip:')).map(i => i.ref.slice(5)));
    const skills = new Set([...u.skills, ...st.items.filter(i => i.ref.startsWith('skill:')).map(i => i.ref.slice(6))]);
    const mine = evs.filter(e => trips.has(e.l) || Object.keys(e.s ?? {}).some(k => skills.has(k)) || (e.k === 'battle' && !!e.w));
    for (const e of mine) { right += e.r; answered += e.n; ms += e.ms; }
    any = mine.length > 0 || st.done > 0;
    if (done >= 1) finishedAt = mine.length ? mine[mine.length - 1].at : Math.max(a.start, Math.min(now, a.start));
  } else {
    const want = ids.map(area => ({ area, id: placementOf(area) }));
    const mine = evs.filter(e => want.some(w => w.id === e.l));
    for (const e of mine) { right += e.r; answered += e.n; ms += e.ms; }
    any = mine.length > 0;
    parts = want.map(w => ({ id: w.area, name: partName(a, w.area), done: mine.some(e => e.l === w.id && e.f) }));
    done = parts.filter(x => x.done).length / Math.max(1, parts.length);
    if (done >= 1) finishedAt = Math.max(...want.map(w => mine.find(e => e.l === w.id && e.f)!.at));
  }
  done = Math.max(0, Math.min(1, done));
  if (done < 1) finishedAt = null;
  const acc = answered ? right / answered : null;
  return { done, right, answered, ms, acc, score: scoreOf(done, a.what === 'learn' ? null : acc, a.scoring), status: statusOf(done, finishedAt, any, a.due, now), finishedAt, parts };
}

// ---------- the gradebook as a spreadsheet ----------
const csvCell = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** Students down the side, assignments across: each cell the score, then a status and progress column
 *  per assignment. Names only (the first names the teacher typed). */
export function gradebookCsv(students: { id: string; name: string }[], assignments: Assignment[], progress: (studentId: string, a: Assignment) => Progress | null): string {
  const head = ['Student'];
  for (const a of assignments) head.push(`${a.title} (score)`, `${a.title} (status)`, `${a.title} (progress %)`);
  head.push('Average score');
  const rows = [head];
  for (const s of students) {
    const row: (string | number)[] = [s.name];
    const scores: number[] = [];
    for (const a of assignments) {
      const pr = isFor(a, s.id) ? progress(s.id, a) : null;
      if (!pr) { row.push('', 'not assigned', ''); continue; }
      row.push(pr.score, STATUS_NAME[pr.status], Math.round(pr.done * 100));
      scores.push(pr.score);
    }
    row.push(scores.length ? Math.round(scores.reduce((t, x) => t + x, 0) / scores.length) : '');
    rows.push(row.map(String));
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
