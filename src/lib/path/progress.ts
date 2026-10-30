// Where a player is on My path: which items are done (crossed off with a tick), the unit they're on and
// the one item to do next, how comfortable they are with each unit (in words), and what they did today.
//
// An item is done by what the player really did, wherever they did it (the path is a guide: practising
// from the map counts too):
//   Learn          the episode was watched to the end (math), or the new-key lesson moved on from (typing)
//   Practice       the trip moved on from (a star, or finished twice, or the island tested out)
//   Game           this many rounds of the unit's game (each unit with the same game asks for one more)
//   Adventure      this many stops won on the world's map (spread over the units that battle there)
//   Unit check     comfortable or better on every skill in the unit (the game's own ability estimate,
//                  math/skills/ability.ts), or the island's checkpoint run passed; typing: the checkpoint
// A unit whose check is done before its items are is "You know this" (Show What You Know does that): it
// stays open for review and the path moves on past it.
//
// Each item is stamped in the player's save the first time it's seen done (`path.done`, by unit and item,
// with when), so a tick never goes away and "2 of 3 things done today" can be counted. A teacher's unit
// (class work) counts games, battles and skill practice from when it was given (teach/activity.ts).
import type { Profile } from '../engine/profile';
import { dayKey, movedOn, passed, todayMs } from '../engine/profile';
import { LESSON as TYPING_LESSON } from '../engine/course';
import { MATH_LESSON, factRung, groupFacts } from '../math/course';
import { isRuleFact } from '../math/facts';
import { mathMovedOn, mathOf, mathPassed, type MathProgress } from '../math/progress';
import { isLearned } from '../math/learn';
import { SKILL_LESSON, skillMovedOn, skillPassed } from '../math/skills/course';
import { SKILL } from '../math/skills/registry';
import { STRAND_SKILL, hasEvidence, thetaOf, workingOf, type Working } from '../math/skills/ability';
import { advView, cleared, nodesOf, type WorldId } from '../adventure/state';
import { arcadeOf, ARCADE, type ArcadeId } from '../arcade/arcade';
import { eventsOf, type ClassEvent } from '../teach/activity';
import { PATH_SUBJECTS, describe, pathOf, type ItemKind, type PathItem, type Unit } from './units';

/** What My path keeps in the player's save (it rides along like any other part: state/merge.ts joins two
 *  computers' copies key by key). */
export type PathSave = {
  /** items seen done: `<unit>/<ref>` and when (0: before the path began) */
  done?: Record<string, number>;
  /** minutes in the free-time places today (rules.ts) */
  time?: { day: string; ms: Record<string, number> };
};
export type PathProfile = Profile & { path?: PathSave };
export const pathSave = (p: Profile): PathSave => (p as PathProfile).path ?? {};
export const itemKey = (u: Pick<Unit, 'id'>, it: Pick<PathItem, 'ref'>) => `${u.id}/${it.ref}`;

// ---------- the evidence ----------
/** each area game's record in the math save, by its card's id */
export const GAME_KEY: Record<string, string> = { pizza: 'pizza-rush', builder: 'number-builder', market: 'market-dash', clockrush: 'clock-rush', shifter: 'shape-shifter', smoothie: 'smoothie-stand', treasure: 'treasure-grid', showdown: 'spinner-showdown', balance: 'balance-beam' };
/** Rounds played of a game (the Arcade's three, an area's own game, or a playground toy). */
export function gamePlays(p: Profile, id: string): number {
  if (id in ARCADE) return arcadeOf(p)[id as ArcadeId]?.plays ?? 0;
  const m = mathOf(p), key = GAME_KEY[id];
  if (key) return m.arcade?.[key]?.plays ?? 0;
  return (m.play as Record<string, { plays?: number }> | undefined)?.[id]?.plays ?? 0;
}
/** Stops won (or practice stops finished) on a world's map. */
export function stopsWon(p: Profile, w: string): number {
  const a = advView(p);
  return nodesOf(w as WorldId).filter(n => cleared(a, n.id)).length;
}
/** Battles won on a world's map in all (each stop counts every time it's won; practice stops don't count). */
export function battlesWon(p: Profile, w: string): number {
  const a = advView(p);
  return nodesOf(w as WorldId).filter(n => n.kind !== 'practice').reduce((t, n) => t + (a.nodes[n.id] ?? 0), 0);
}
/** A fact group's typical fact, in rungs (the middle of its facts, leaving out the 0 and 1 rules). */
const groupRung = (g: string) => { const rs = groupFacts(g).filter(f => !isRuleFact(f)).map(factRung).sort((a, b) => a - b); return rs.length ? rs[Math.floor(rs.length / 2)] : 1; };

export type Level = Working;
/** Where a child is on a fact strand's groups: the strand's ability against the groups' typical fact. */
function factLevel(m: MathProgress, skill: string, groups: string[], now: number): Level {
  if (!hasEvidence(m, skill) && workingOf(m, skill, now).word === 'not started') return 'not started';
  const d = thetaOf(m, skill, now) - Math.max(...groups.map(groupRung));
  return d < 0 ? 'getting started' : d < 1.5 ? 'comfortable' : d < 3 ? 'strong' : 'stretching';
}
const RANK: Level[] = ['not started', 'getting started', 'comfortable', 'strong', 'stretching'];
const atLeastComfortable = (l: Level) => RANK.indexOf(l) >= 2;
/** The math a unit's check asks about: each skill (or fact strand with its groups) and how far along. */
export function unitLevels(p: Profile, u: Unit, now = Date.now()): { skill: string; name: string; level: Level }[] {
  const m = mathOf(p);
  const out: { skill: string; name: string; level: Level }[] = [];
  const add = (skill: string, groups?: string[]) => {
    if (!SKILL[skill] || out.some(x => x.skill === skill)) return;
    out.push({ skill, name: SKILL[skill].name, level: groups?.length ? factLevel(m, skill, groups, now) : workingOf(m, skill, now).word });
  };
  if (u.groups?.length) add(u.skills[0], u.groups);
  else for (const s of u.skills) add(s);
  // a teacher's unit: the skills of its trips and skill practice
  for (const it of u.items) {
    const [k, id] = it.ref.split(':');
    if (k === 'skill') add(id);
    if (k === 'trip' && u.subject !== 'typing') {
      const ml = MATH_LESSON[id], sl = SKILL_LESSON[id];
      if (ml && ml.region !== 'start') add(STRAND_SKILL[ml.op], ml.groups);
      if (sl) for (const s of sl.skills) add(s);
    }
  }
  return out;
}
/** The unit as one word: its weakest skill that's started (or not started at all). */
export function unitLevel(p: Profile, u: Unit, now = Date.now()): Level {
  if (u.subject === 'typing') {
    const ids = pathOf('typing').find(x => x.id === u.id)?.items.map(i => i.ref.split(':')[1]) ?? [];
    const cp = u.checkTrip;
    if (cp && (p.lessons[cp]?.stars ?? 0) >= 3) return 'strong';
    if (cp && passed(p, cp)) return 'comfortable';
    return ids.some(id => passed(p, id)) ? 'getting started' : 'not started';
  }
  const ls = unitLevels(p, u, now).map(x => x.level);
  const started = ls.filter(l => l !== 'not started');
  if (!started.length) return 'not started';
  return started.reduce((lo, l) => (RANK.indexOf(l) < RANK.indexOf(lo) ? l : lo));
}
export const LEVEL_WORD: Record<Level, string> = { 'not started': 'Not started', 'getting started': 'Getting started', comfortable: 'Comfortable', strong: 'Strong', stretching: 'Strong' };

/** How a check is done: the island's checkpoint run passed, or comfortable on every skill. */
function checkDone(p: Profile, u: Unit, now: number): boolean {
  const m = mathOf(p), t = u.checkTrip;
  if (t && (MATH_LESSON[t] ? mathPassed(m, t) : SKILL_LESSON[t] ? skillPassed(m, t) : passed(p, t))) return true;
  const ls = unitLevels(p, u, now);
  return ls.length > 0 && ls.every(x => atLeastComfortable(x.level));
}
function tripDone(p: Profile, u: Unit, id: string): boolean {
  if (u.subject === 'typing' || (!MATH_LESSON[id] && !SKILL_LESSON[id] && TYPING_LESSON[id])) return movedOn(p, id);
  const m = mathOf(p);
  if (MATH_LESSON[id]) return mathMovedOn(m, MATH_LESSON[id]);
  if (SKILL_LESSON[id]) return skillMovedOn(m, SKILL_LESSON[id]);
  return false;
}
const gameEvent = (e: ClassEvent, id: string) => (e.k === 'arcade' || e.k === 'game' || e.k === 'play') && (e.l === id || e.l === GAME_KEY[id] || (e.k === 'play' && e.l === 'playground'));
/** Whether one item is done. `since`: a teacher's unit counts games, battles and skill practice from then. */
export function itemDone(p: Profile, u: Unit, it: PathItem, o: { now?: number; since?: number; events?: ClassEvent[] } = {}): boolean {
  const now = o.now ?? Date.now();
  if (pathSave(p).done?.[itemKey(u, it)] !== undefined && o.since === undefined) return true;
  const [k, a, b] = it.ref.split(':');
  const evs = () => (o.events ?? eventsOf(p)).filter(e => e.at >= (o.since ?? 0) && e.at <= now);
  switch (k) {
    case 'ep': return isLearned(mathOf(p), a);
    case 'trip': return it.kind === 'check' ? passed(p, a) : tripDone(p, u, a);
    // n on the item (game:pizza:3) is how many rounds, or battle wins, in all by then
    case 'game': return o.since !== undefined ? evs().some(e => gameEvent(e, a)) : gamePlays(p, a) >= (b ? +b : u.gameNeed ?? 1);
    case 'battle': return o.since !== undefined ? evs().some(e => e.k === 'battle' && e.w === a) : b ? battlesWon(p, a) >= +b : stopsWon(p, a) >= (u.battleNeed ?? 1);
    case 'skill': return evs().reduce((t, e) => t + (e.s?.[a]?.r ?? 0), 0) >= 10 || atLeastComfortable(workingOf(mathOf(p), a, now).word);
    case 'check': return checkDone(p, u, now);
    default: return false;
  }
}

// ---------- a unit, and the whole path ----------
export type ItemState = PathItem & { done: boolean };
/** earlier: before the grade the path starts at (open, not needed) */
export type UnitStatus = 'done' | 'known' | 'current' | 'later' | 'earlier';
export type UnitState = { unit: Unit; items: ItemState[]; done: number; of: number; checked: boolean; status: UnitStatus; level: Level; next: ItemState | null };

/** One unit's items, ticked, and how far along. */
export function unitState(p: Profile, u: Unit, o: { now?: number; since?: number; events?: ClassEvent[] } = {}): UnitState {
  const now = o.now ?? Date.now();
  const events = o.events ?? (o.since !== undefined ? eventsOf(p) : undefined);
  const items = u.items.map(it => ({ ...it, done: itemDone(p, u, it, { ...o, now, events }) }));
  const done = items.filter(i => i.done).length, of = items.length;
  const checked = items.some(i => i.kind === 'check' && i.done);
  const status: UnitStatus = done >= of ? 'done' : checked ? 'known' : 'later';
  return { unit: u, items, done, of, checked, status, level: unitLevel(p, u, now), next: items.find(i => !i.done) ?? null };
}
/** Every unit of a subject's path, the first one not done (and not known already) marked current. A path
 *  can start at a grade (a class's grade, or the one a grown-up picked): the units before it are earlier
 *  ones, open for anyone who wants them, and the path begins after them. */
export function pathStates(p: Profile, subject: string, now = Date.now(), fromGrade: number | null = null): UnitState[] {
  const out = pathOf(subject).map(u => unitState(p, u, { now }));
  if (fromGrade !== null && fromGrade > 0) for (const s of out) if (s.status === 'later' && s.unit.grade !== null && s.unit.grade < fromGrade) s.status = 'earlier';
  const cur = out.find(s => s.status === 'later');
  if (cur) cur.status = 'current';
  return out;
}
/** The one thing to do next on a subject's path (null: the whole path is done). */
export function nextOnPath(p: Profile, subject: string, now = Date.now(), fromGrade: number | null = null): { unit: UnitState; item: ItemState } | null {
  const cur = pathStates(p, subject, now, fromGrade).find(s => s.status === 'current');
  return cur?.next ? { unit: cur, item: cur.next } : null;
}

// ---------- stamping, and today ----------
/** Stamp every item already done (when the path first meets a player): they count, but not as today's. */
export function startPath(p: Profile, now = Date.now()) {
  const pp = p as PathProfile;
  if (pp.path?.done) return;
  const done: Record<string, number> = {};
  for (const s of PATH_SUBJECTS()) for (const u of pathOf(s.id)) for (const it of u.items) if (itemDone(p, u, it, { now })) done[itemKey(u, it)] = 0;
  pp.path = { ...(pp.path ?? {}), done };
}
/** After an activity: stamp the items it finished. `extra`: a teacher's units, counted from when given.
 *  Returns the keys stamped now. */
export function notePath(p: Profile, now = Date.now(), extra: { unit: Unit; since: number }[] = []): string[] {
  const pp = p as PathProfile;
  if (!pp.path?.done) startPath(p, now);
  const done = { ...(pp.path!.done ?? {}) };
  const added: string[] = [];
  const stamp = (u: Unit, it: PathItem, since?: number) => {
    const k = itemKey(u, it);
    if (done[k] !== undefined) return;
    if (itemDone(p, u, it, { now, since })) { done[k] = now; added.push(k); }
  };
  for (const s of PATH_SUBJECTS()) for (const u of pathOf(s.id)) for (const it of u.items) stamp(u, it);
  for (const x of extra) for (const it of x.unit.items) stamp(x.unit, it, x.since);
  if (added.length) pp.path = { ...pp.path, done };
  return added;
}
/** The kind of a stamped item, from its key. */
export function kindOfKey(key: string): ItemKind {
  const i = key.indexOf('/');
  const unit = key.slice(0, i), ref = key.slice(i + 1);
  return describe(ref, unit.split(':')[0]).kind;
}
/** The things done today on the path: learn, practice, game and battle items (a check is a milestone,
 *  not a thing to do, so a Show What You Know that passes ten checks at once doesn't fill the day). */
export function doneToday(p: Profile, now = Date.now()): number {
  const today = dayKey(now);
  // (the same thing in a teacher's unit and on the path counts once)
  const refs = Object.entries(pathSave(p).done ?? {}).filter(([k, at]) => at > 0 && dayKey(at) === today && kindOfKey(k) !== 'check').map(([k]) => k.slice(k.indexOf('/') + 1));
  return new Set(refs).size;
}

export type Today = { done: number; goal: number; min: number; goalMin: number; unit: string | null; line: string };
/** "2 of 3 things done today · 10 of 20 minutes · Unit 2: almost done" */
export function todayLine(p: Profile, goal: number, next: { unit: UnitState } | null, now = Date.now()): Today {
  const done = doneToday(p, now), min = Math.floor(todayMs(p, now) / 60000), goalMin = p.settings.dailyGoalMin;
  const u = next?.unit;
  let unit: string | null = null;
  if (u) {
    const f = u.done / Math.max(1, u.of);
    unit = `${u.unit.id.startsWith('class:') ? u.unit.name : `Unit ${u.unit.n}`}: ${f >= 0.66 ? 'almost done' : f >= 0.4 ? 'halfway there' : f > 0 ? 'just started' : 'ready to start'}`;
  }
  const parts = [done >= goal ? `All ${goal} things done today!` : `${done} of ${goal} thing${goal === 1 ? '' : 's'} done today`, `${min} of ${goalMin} minutes`];
  if (unit) parts.push(unit);
  return { done, goal, min, goalMin, unit, line: parts.join(' · ') };
}
