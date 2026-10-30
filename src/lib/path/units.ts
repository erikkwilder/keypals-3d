// My path: each subject laid out like a syllabus, as units in a sensible order. A unit is a few short days
// (about three things each, about a quarter of an hour), and each day mixes the four ways to play the way
// a good lesson does: a little practice, a little learning with its practice straight after, then a game
// round or an Adventure battle (taking turns), and the last day ends with the unit check. Nobody sits
// through every Learn episode first and every trip after. It's a guide, not a cage: everything else in
// the game stays open (unless a grown-up or teacher keeps a player to it: rules.ts).
//
// Math: every area's regions (the map's islands), in grade order, the areas mixed together (Kindergarten
// counting and shapes, then grade 1 adding and taking away...). Typing: the typing course's regions, in
// order (the Open Road is free play, so it isn't a unit). A subject added to subjects.ts with no builder
// here gets a simple path from its own lists: one unit per part (chip), its things in way order.
//
// An item is a short reference (`ref`) that says how it's done and how to start it:
//   ep:<episode>     a math Learn episode           trip:<lesson>   a practice trip or typing lesson
//   game:<game>[:n]  a round of that game           battle:<world>[:n]  a battle won in that world
//                    (n: how many rounds or battle wins in all by then, counting earlier units too)
//   skill:<skill>    practice on one skill (a teacher's own unit)
//   check            the unit check: comfortable or better on the unit's skills (math), or the region's
//                    checkpoint run passed (typing: trip:<checkpoint>, shown as the check)
//   thing:<way>:<id> anything from a subject's lists (the simple path of a new subject)
import { REGIONS, LESSON as TYPING_LESSON, type Lesson as TypingLesson } from '../engine/course';
import { MATH_REGIONS, MATH_LESSON, STRAND, regionsOf, type MathRegion } from '../math/course';
import { LESSON as TRICK, lessonForStop } from '../math/learn';
import { FRAC_LESSONS } from '../math/fracEpisodes';
import { SHAPE_LESSONS } from '../math/shapes/episodes';
import { RATIO_LESSONS } from '../math/ratioEpisodes';
import { NEG_LESSONS } from '../math/integers/episodes';
import { DATA_LESSONS } from '../math/data/episodes';
import { ALG_LESSONS } from '../math/algebra/episodes';
import { MARKET_LESSONS } from '../math/market/episodes';
import { MEASURE_LESSONS } from '../math/measure/episodes';
import { SKILL_EPISODES, SKILL_LESSON, SKILL_REGIONS, type SkillLesson, type SkillRegion } from '../math/skills/course';
import { AREA, AREAS, SKILL, areaOfOp } from '../math/skills/registry';
import { STRAND_SKILL } from '../math/skills/ability';
import type { AreaId } from '../math/skills/types';
import { SUBJECT, SUBJECTS, WAY, type Subject, type Thing, type WayId } from '../subjects';
import { CUR_LESSONS, CUR_UNITS } from './curriculum';
import { LEARN_TEACHES, SPEC } from './lessonSpecs';
import { checkTrips, factPart, practiceTrips, skillPart, sourceTrips } from './lessonTrips';
import { WORLD_PIN, WORLD_PINS } from '../adventure/worlds';
import { nodesOf, type WorldId } from '../adventure/state';

export type ItemKind = 'learn' | 'practice' | 'game' | 'battle' | 'check' | 'warmup' | 'quick';
/** `day`: which of the unit's days it belongs to (1, 2, 3...; a teacher's own unit has none); `lesson`: the
 *  curriculum lesson it is part of (a day's warm-up and play belong to that day's lesson) */
export type PathItem = { ref: string; kind: ItemKind; name: string; line: string; day?: number; lesson?: string };
export type Unit = {
  /** `math:frac-a`, `typing:village` (a teacher's unit: `class:<assignment>`) */
  id: string; subject: string;
  /** the part of the subject (a math area, a typing region) and the map region it follows, if any */
  area: string; region?: string;
  /** its number on the path (1, 2, 3...) */
  n: number;
  name: string; part: string; blurb: string;
  /** the school grade it starts in (math), null when it has none */
  grade: number | null;
  color: string; art: string;
  /** the math skills it practises (fact regions: the strand's skill and the fact groups) */
  skills: string[]; groups?: string[];
  /** the trip a "Unit check" starts (the region's checkpoint run) */
  checkTrip?: string;
  /** how many rounds of its game, and battles won in its world, it takes (this unit is the k-th on the
   *  path to use that game or world, so each unit asks for one more) */
  gameNeed?: number; battleNeed?: number;
  /** math: its curriculum lessons, in order */
  lessons?: string[];
  items: PathItem[];
};

export const KIND_NAME: Record<ItemKind, string> = { learn: 'Learn', practice: 'Practice', game: 'Game', battle: 'Adventure', check: 'Unit check', warmup: 'Warm-up', quick: 'Quick check' };
/** the picture for each kind of item: the four ways' own pictures, a flag for a quick check, a tick for the unit check */
export const KIND_ICON: Record<ItemKind, string> = { learn: WAY.learn.icon, practice: WAY.practice.icon, game: WAY.games.icon, battle: WAY.adventure.icon, check: 'icons/finish.webp', warmup: WAY.practice.icon, quick: 'icons/flag.webp' };
const WAY_OF: Record<ItemKind, WayId | null> = { learn: 'learn', practice: 'practice', game: 'games', battle: 'adventure', check: null, warmup: 'practice', quick: null };
export const kindColor = (k: ItemKind) => { const w = WAY_OF[k]; return w ? WAY[w].color : '#2e9e6e'; };

// ---------- names of things ----------
const mathThing = (w: WayId, id: string): Thing | undefined => SUBJECT.math?.ways[w].things.find(t => t.id === id);
/** The math game for an area: its own arcade game; the fact strands share the Arcade's three. */
export function gamesForArea(area: string): Thing[] {
  const all = (SUBJECT.math?.ways.games.things ?? []).filter(t => t.kind === 'arcade' && !t.soon && t.areas.includes(area));
  const own = all.filter(t => t.areas.length === 1);
  return own.length ? own : all;
}
/** The world an area's battles happen in (the Sky Islands for the facts and for typing). */
export const worldForArea = (area: string): WorldId => (WORLD_PINS.find(w => w.area === area)?.id as WorldId | undefined) ?? 'sky';
const worldName = (w: string) => WORLD_PIN[w]?.name ?? 'the Sky Islands';
/** How many stops a world's map has (its battles, practice stop and Champion). */
const stopsIn = (w: string) => nodesOf(w as WorldId).length || 6;

/** A short reference's own name and line (for any item, built-in or a teacher's). */
export function describe(ref: string, subject = 'math'): { kind: ItemKind; name: string; line: string } {
  const [k, a, b] = ref.split(':');
  if (k === 'ep') {
    const t = mathThing('learn', a) ?? mathThing('learn', a.split('~')[0]);
    return { kind: 'learn', name: t?.name ?? TRICK[a.split('~')[0]]?.title ?? a, line: t?.line || 'Watch your buddy, then try it' };
  }
  if (k === 'trip') {
    const tl = TYPING_LESSON[a];
    if (tl && subject === 'typing') return { kind: typingKind(tl), name: tl.title, line: tl.blurb ?? (tl.kind === 'drill' ? 'New keys: watch, then type' : tl.kind === 'checkpoint' ? 'The island\'s big run' : 'A typing lesson') };
    const ml = MATH_LESSON[a] ?? SKILL_LESSON[a];
    if (ml && a.startsWith('les-')) return { kind: 'practice', name: ml.title, line: 'Practise just this, with help the first time' };
    if (ml) return { kind: 'practice', name: ml.title, line: ml.blurb || (ml.kind === 'mix' ? 'Everything so far, mixed up' : 'A practice trip') };
    if (tl) return { kind: typingKind(tl), name: tl.title, line: 'A typing lesson' };
    return { kind: 'practice', name: a, line: 'A practice trip' };
  }
  if (k === 'skill') return { kind: 'practice', name: SKILL[a]?.name ?? a, line: '10 right answers' };
  if (k === 'quick') { const t = MATH_LESSON[a] ?? SKILL_LESSON[a]; return { kind: 'quick', name: (t?.title ?? a).replace(/^Quick check: /, ''), line: 'A few questions to show you\'ve got it' }; }
  if (k === 'warm') return { kind: 'warmup', name: 'Warm-up', line: 'A few questions from earlier lessons' };
  if (k === 'game') { const t = mathThing('games', a); return { kind: 'game', name: t?.name ?? a, line: 'Play a round' }; }
  if (k === 'battle') return { kind: 'battle', name: `Battle in ${worldName(a)}`, line: 'Win a battle on the map' };
  if (k === 'thing') {
    const s = SUBJECT[subject], t = s?.ways[a as WayId]?.things.find(x => x.id === b);
    const kind: ItemKind = a === 'learn' ? 'learn' : a === 'games' ? 'game' : a === 'adventure' ? 'battle' : 'practice';
    return { kind, name: t?.name ?? b ?? '', line: t?.line ?? '' };
  }
  return { kind: 'check', name: 'Unit check', line: 'Show you\'re comfortable with all of it' };
}
const typingKind = (l: TypingLesson): ItemKind => (l.kind === 'drill' ? 'learn' : l.kind === 'checkpoint' ? 'check' : 'practice');
export const itemOf = (ref: string, subject = 'math'): PathItem => ({ ref, ...describe(ref, subject) });
/** A typing lesson (and not a math trip) among a unit's items. */
export const TYPING_SUBJECT_REFS = (ref: string) => { const [k, id] = ref.split(':'); return k === 'trip' && !!TYPING_LESSON[id] && !MATH_LESSON[id] && !SKILL_LESSON[id]; };

// ---------- math: the curriculum ----------
// Grades, then their units in curriculum order (curriculum.ts), each unit's lessons in order. A lesson is
// one idea: its Learn (only one that teaches exactly this: lessonSpecs.ts LEARN_TEACHES), its practice
// (a trip on just this idea: lessonTrips.ts) and its quick check. A unit is cut into short days, one
// lesson a day: a warm-up on earlier lessons, the Learn, the practice, a game round or an Adventure battle
// (taking turns), then the quick check of yesterday's lesson; the last day ends with the unit check.
/** A lesson's Learn, if it has one that teaches exactly its practice. */
export function lessonLearn(id: string): string | null {
  const ep = SPEC[id]?.learn ?? null;
  return ep && learnFits(id, ep) ? ep : null;
}
/** The lesson's practice keys (skill:sub, a bare skill, or a fact skill with its groups). */
export function lessonKeys(id: string): string[] {
  const sk = skillPart(id);
  if (sk) return sk.keys;
  return factPart(id, regionGroups).flatMap(f => f.groups.map(g => `${f.skill}:${g}`));
}
/** A Learn fits a lesson when everything the lesson practises is something the Learn teaches. */
export function learnFits(id: string, ep: string): boolean {
  const teaches = LEARN_TEACHES[ep] ?? [];
  const ok = (k: string) => teaches.includes(k) || teaches.includes(k.split(':')[0]);
  const ks = lessonKeys(id);
  return ks.length > 0 && ks.every(k => ok(k) || (k.includes(':') ? false : (SKILL[k]?.subs ?? []).every(sb => ok(`${k}:${sb.id}`))));
}
/** A fact stop's operation and groups. */
export const regionGroups = (t: string) => { const l = MATH_LESSON[t]; return l ? { op: l.op, groups: l.kind === 'rules' ? ['x1', 'x0'] : l.groups } : null; };
/** The area a lesson belongs to (its first skill's). */
export function lessonArea(id: string): AreaId {
  const sk = skillPart(id)?.skills[0];
  if (sk && SKILL[sk]) return SKILL[sk].area;
  const f = factPart(id, regionGroups)[0];
  return f ? areaOfOp(f.op) : 'place';
}
/** Every lesson on the math path, in order. */
export const PATH_LESSONS = CUR_LESSONS.filter(l => SPEC[l.id] && (practiceTrips(l.id).length > 0));
export const PATH_LESSON_IDS = PATH_LESSONS.map(l => l.id);
const lessonPos = new Map(PATH_LESSON_IDS.map((id, i) => [id, i]));
export const lessonIndex = (id: string) => lessonPos.get(id) ?? -1;
/** The picture for a lesson: the island its old practice was on. */
function artOf(id: string): string | null {
  for (const t of [...sourceTrips(id), ...practiceTrips(id)]) {
    const sl = SKILL_LESSON[t];
    if (sl && sl.region !== 'start') { const r = SKILL_REGIONS.find(x => x.id === sl.region); if (r) return r.art ?? `regions/${r.world}.webp`; }
    const ml = MATH_LESSON[t];
    if (ml && ml.region !== 'start') { const r = MATH_REGIONS.find(x => x.id === ml.region); if (r) return `regions/${r.world}.webp`; }
  }
  return null;
}
/** The unit check: a trip on all its skill lessons, or (a unit of facts only) its stops' run. */
function unitCheckTrip(unitId: string): string | undefined {
  const id = `unit-${unitId}`;
  return SKILL_LESSON[id] || MATH_LESSON[id] ? id : undefined;
}

function curriculumUnits(): Unit[] {
  const out: Unit[] = [];
  const rounds: Record<string, number> = {}, wins: Record<string, number> = {};
  for (const cu of CUR_UNITS) {
    const ls = PATH_LESSONS.filter(l => l.unit === cu.id);
    if (!ls.length) continue;
    const ids = ls.map(l => l.id);
    // the unit's home topic: the area most of its lessons are in (its game, world and colour)
    const count: Partial<Record<AreaId, number>> = {};
    for (const id of ids) { const a = lessonArea(id); count[a] = (count[a] ?? 0) + 1; }
    const area = (Object.entries(count) as [AreaId, number][]).sort((a, b) => b[1] - a[1])[0][0];
    const games = gamesForArea(area), world = worldForArea(area);
    const sameArea = out.filter(u => u.area === area).length;
    const game = games.length ? games[sameArea % games.length]?.id : undefined;
    let turn = 0, firstGame: number | undefined, firstWin: number | undefined;
    const play = (): string => {
      const wantGame = !!game && turn++ % 2 === 0;
      if (wantGame && game) { const n = (rounds[game] = (rounds[game] ?? 0) + 1); firstGame ??= n; return `game:${game}:${n}`; }
      const n = (wins[world] = (wins[world] ?? 0) + 1); firstWin ??= n; return `battle:${world}:${n}`;
    };
    const items: PathItem[] = [];
    const eps = new Set<string>();
    const add = (ref: string, day: number, lesson: string, extra: Partial<PathItem> = {}) => { if (!items.some(i => i.ref === ref)) items.push({ ...itemOf(ref), day, lesson, ...extra }); };
    const quick = (id: string, day: number) => { for (const t of checkTrips(id)) add(`quick:${t}`, day, id); };
    ids.forEach((id, k) => {
      const day = k + 1;
      // a warm-up on earlier lessons (any lesson with skill practice before this one on the path)
      if (PATH_LESSONS.slice(0, lessonIndex(id)).some(l => skillPart(l.id))) add(`warm:${id}`, day, id);
      const ep = lessonLearn(id);
      if (ep && !eps.has(ep)) { eps.add(ep); add(`ep:${ep}`, day, id); }
      for (const t of practiceTrips(id)) add(`trip:${t}`, day, id);
      add(play(), day, id);
      if (k > 0) quick(ids[k - 1], day);
    });
    const last = ids.length + 1;
    quick(ids[ids.length - 1], last);
    const checkTrip = unitCheckTrip(cu.id);
    items.push({ ...itemOf('check'), day: last });
    const skills = [...new Set(ids.flatMap(id => skillPart(id)?.skills ?? factPart(id, regionGroups).map(f => f.skill)))];
    const facts = ids.every(id => !skillPart(id)) ? [...new Set(ids.flatMap(id => factPart(id, regionGroups).flatMap(f => f.groups)))] : undefined;
    out.push({
      id: `math:${cu.id}`, subject: 'math', area, n: cu.n, name: cu.kidTitle, part: AREA[area].name, blurb: ls.map(l => l.kidTitle).join(' · '), grade: cu.grade,
      color: AREA[area].color, art: ids.map(artOf).find(Boolean) ?? `regions/${world}.webp`, skills, groups: facts, checkTrip,
      gameNeed: firstGame, battleNeed: firstWin, lessons: ids, items,
    });
  }
  return out;
}
/** The units the path used to have (one per island, `math:<region>`) and the new unit each one's work is
 *  in now, so a teacher's unit made from an old one, and anything else that kept an old id, still finds
 *  its unit: the unit holding most of the island's old trips' lessons. */
let oldUnits: Record<string, string> | null = null;
export function oldUnit(id: string): string | undefined {
  oldUnits ??= oldUnitMap();
  return oldUnits[id];
}
function oldUnitMap(): Record<string, string> {
  const out: Record<string, string> = {};
  const units = pathOf('math');
  const regions = [...MATH_REGIONS.map(r => ({ id: r.id, trips: r.lessons.map(l => l.id), area: areaOfOp(r.op) as string })), ...SKILL_REGIONS.map(r => ({ id: r.id, trips: r.lessons.map(l => l.id), area: r.area as string }))];
  for (const r of regions) {
    const tally = new Map<string, number>();
    for (const u of units) for (const id of u.lessons ?? []) {
      const hits = [...sourceTrips(id), ...practiceTrips(id)].filter(t => r.trips.includes(t)).length;
      if (hits) tally.set(u.id, (tally.get(u.id) ?? 0) + hits);
    }
    const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? units.find(u => u.area === r.area)?.id;
    if (best) out[`math:${r.id}`] = best;
  }
  return out;
}

// ---------- typing ----------
type Draft = Omit<Unit, 'n' | 'items' | 'gameNeed' | 'battleNeed'> & { order: [number, number, number]; eps: string[]; trips: string[]; game?: string; world: string };
function typingDrafts(): Draft[] {
  return REGIONS.filter(r => r.id !== 'road').map((r, i) => {
    const check = r.lessons.find(l => l.kind === 'checkpoint');
    return {
      id: `typing:${r.id}`, subject: 'typing', area: r.id, region: r.id, name: r.name, part: 'Typing', blurb: r.blurb, grade: null,
      color: SUBJECT.typing?.chips.find(c => c.id === r.id)?.color ?? '#7c5cf5', art: `regions/${r.id}.webp`, skills: [], checkTrip: check?.id,
      order: [0, i, 0], eps: [], trips: r.lessons.filter(l => l.kind !== 'checkpoint').map(l => l.id), world: 'sky',
    };
  });
}

/** The Learn episode a fact trip goes with: its Meet (or rules) stop's trick. */
function epForTrip(id: string): string | null {
  const f = MATH_LESSON[id];
  return f && (f.kind === 'meet' || f.kind === 'rules') ? lessonForStop(f)?.id ?? null : null;
}
/** The skills a Learn episode teaches: each skill that SKILL_EPISODES points at it. */
export function episodeSkills(ep: string): string[] {
  return Object.keys(SKILL_EPISODES).filter(s => SKILL_EPISODES[s] === ep);
}
/** Each skill episode's own skill, the one it is about (its `skill`, or the first of its `skills`). */
const OWN_SKILL: Record<string, string> = Object.fromEntries(
  ([...FRAC_LESSONS, ...SHAPE_LESSONS, ...RATIO_LESSONS, ...NEG_LESSONS, ...DATA_LESSONS, ...ALG_LESSONS, ...MARKET_LESSONS, ...MEASURE_LESSONS] as { id: string; skill?: string; skills?: string[] }[])
    .map(l => [l.id, l.skill ?? l.skills?.[0] ?? '']).filter(([, s]) => s),
);
/** The one skill an episode is about: its own, else the first it teaches. */
export const episodeSkill = (ep: string): string | undefined => OWN_SKILL[ep] ?? episodeSkills(ep)[0];

/** The practice trip that goes with a Learn episode in a unit (null: none practises it well). A fact
 *  trick goes with its own Meet (or rules) stop. A skill episode goes with a trip whose main skill (its
 *  first) is one the episode teaches: best of all its own skill, then a Meet before a practice round (a
 *  mix of everything last), then the trip that is most about the episode. Each trip follows one episode. */
function tripForEp(ep: string, trips: string[], taken: Set<string>): string | null {
  const fact = trips.find(t => !taken.has(t) && epForTrip(t) === ep);
  if (fact) return fact;
  const teaches = new Set(episodeSkills(ep)), own = episodeSkill(ep);
  // compared in order: its own skill, a Meet, how much of the trip is about the episode, how many skills shared
  const rank = (l: SkillLesson) => {
    const shared = l.skills.filter(s => teaches.has(s)).length;
    return [l.skills[0] === own ? 1 : 0, l.kind === 'meet' ? 2 : l.kind === 'mix' ? 0 : 1, shared / l.skills.length, shared];
  };
  const beats = (a: number[], b: number[]) => { const i = a.findIndex((v, k) => v !== b[k]); return i >= 0 && a[i] > b[i]; };
  let best: string | null = null, bestRank: number[] = [];
  for (const t of trips) {
    const l = SKILL_LESSON[t];
    if (!l || taken.has(t) || !teaches.has(l.skills[0])) continue;
    const r = rank(l);
    if (!best || beats(r, bestRank)) { best = t; bestRank = r; }
  }
  return best;
}
/** The one skill a "Try it" practises after an episode no trip here practises. */
function trySkill(ep: string): string {
  return episodeSkill(ep) ?? ep;
}

/** A unit's learning in order: each Learn episode just before the trip that practises what it teaches (so
 *  its practice comes straight after); an episode that no trip in the unit practises gets a short "Try it"
 *  of its skill straight after instead, spread among the trips. */
function learningOrder(d: Draft): string[] {
  const taken = new Set<string>(), before = new Map<string, string>(), alone: string[] = [];
  for (const e of d.eps) {
    const t = tripForEp(e, d.trips, taken);
    if (t) { taken.add(t); before.set(t, e); }
    else if (episodeSkills(e).length) alone.push(e);
  }
  const out: string[] = [];
  for (const t of d.trips) {
    const e = before.get(t);
    if (e) out.push(`ep:${e}`);
    out.push(`trip:${t}`);
  }
  alone.forEach((e, i) => {
    // before the 1st, 3rd, 5th... trip that isn't already right after a Learn
    const free = out.map((r, k) => ({ r, k })).filter(x => x.r.startsWith('trip:') && !out[x.k - 1]?.startsWith('ep:'));
    const at = free[Math.min(free.length - 1, i * 2)]?.k ?? out.length;
    out.splice(at, 0, `ep:${e}`, `skill:${trySkill(e)}`);
  });
  return out;
}

/** Split a unit's learning into short days: two things a day (a Learn always stays with the practice that
 *  follows it, so a day can be three), and a very short last day joins the one before. */
function intoDays(learning: string[], isLearn: (r: string) => boolean): string[][] {
  const days: string[][] = [];
  let cur: string[] = [];
  for (const r of learning) {
    cur.push(r);
    if (cur.length >= 2 && !isLearn(r)) { days.push(cur); cur = []; }
  }
  if (cur.length) { if (cur.length === 1 && days.length && !isLearn(cur[0])) days[days.length - 1].push(...cur); else days.push(cur); }
  return days;
}

/** Number the units and lay each out as days: learning, then a game round or a battle (taking turns),
 *  the unit check on the last day. Game rounds and battle wins count up along the path (earlier units'
 *  rounds count too), so each item asks for one more than the last. */
function finish(drafts: Draft[]): Unit[] {
  const rounds: Record<string, number> = {}, wins: Record<string, number> = {};
  return drafts.map((d, i) => {
    const { order: _o, eps: _e, trips: _t, game, world, ...u } = d;
    const typing = d.subject === 'typing';
    const learnRefs = learningOrder(d);
    const kindOf = (r: string) => describe(r, d.subject).kind;
    const days = intoDays(learnRefs, r => kindOf(r) === 'learn');
    // play after each day's learning: a game round and a battle take turns (typing has no game yet: a
    // battle every other day); the last day of learning is followed by the check rather than more play
    const plays: string[] = [];
    let turn = 0, firstGame: number | undefined, firstWin: number | undefined;
    const play = (dayNo: number): string | null => {
      const wantGame = !!game && (turn % 2 === 0 || typing);
      if (typing && dayNo % 2 === 1 && dayNo > 0) { turn++; return null; }
      turn++;
      if (wantGame && game) { const n = (rounds[game] = (rounds[game] ?? 0) + 1); firstGame ??= n; return `game:${game}:${n}`; }
      const n = (wins[world] = (wins[world] ?? 0) + 1); firstWin ??= n; return `battle:${world}:${n}`;
    };
    // the last day: its final review trip (the mix) moves next to the check, so the unit ends "one more
    // go at everything, then show what you know" rather than three trips in a row
    const lastDay = days[days.length - 1];
    const tail = lastDay && lastDay.length >= 2 && kindOf(lastDay[lastDay.length - 1]) !== 'learn' && kindOf(lastDay[lastDay.length - 2]) !== 'learn' ? lastDay.pop()! : null;
    const items: PathItem[] = [];
    days.forEach((day, k) => {
      // (a "Try it" after an episode: a short practice of that one skill)
      for (const r of day) items.push({ ...itemOf(r, d.subject), ...(r.startsWith('skill:') ? { line: 'Try it: 10 right answers' } : {}), day: k + 1 });
      const r = play(k);
      if (r) items.push({ ...itemOf(r, d.subject), day: k + 1 });
    });
    const check = typing ? (d.checkTrip ? `trip:${d.checkTrip}` : '') : 'check';
    const end = tail || check ? days.length + 1 : days.length;
    if (tail) items.push({ ...itemOf(tail, d.subject), day: end });
    if (check) items.push({ ...itemOf(check, d.subject), day: tail ? end : Math.max(1, days.length) });
    return { ...u, n: i + 1, gameNeed: firstGame, battleNeed: firstWin, items };
  });
}

// ---------- a subject with no builder: a simple path from its lists ----------
function simpleUnits(s: Subject): Unit[] {
  const ways: WayId[] = ['learn', 'practice', 'games', 'adventure'];
  return s.chips.map((c, i) => ({
    id: `${s.id}:${c.id}`, subject: s.id, area: c.id, n: i + 1, name: c.name, part: s.name, blurb: '', grade: null, color: c.color, art: c.art, skills: [],
    items: ways.flatMap(w => s.ways[w].things.filter(t => !t.soon && t.areas.includes(c.id)).slice(0, w === 'adventure' ? 1 : 4).map(t => itemOf(`thing:${w}:${t.id}`, s.id))),
  })).filter(u => u.items.length);
}

const BUILDERS: Record<string, () => Unit[]> = { math: curriculumUnits, typing: () => finish(typingDrafts()) };
const cache = new Map<string, Unit[]>();
/** A subject's path: its units in order (built once). */
export function pathOf(subject: string): Unit[] {
  let u = cache.get(subject);
  if (!u) {
    const b = BUILDERS[subject], s = SUBJECT[subject];
    u = b ? b() : s ? simpleUnits(s) : [];
    cache.set(subject, u);
  }
  return u;
}
/** The subjects that have a path (every subject in subjects.ts). */
export const PATH_SUBJECTS = () => SUBJECTS.filter(s => pathOf(s.id).length);
/** A unit by its id (an old island unit's id finds the unit its work is in now). */
export const unitById = (id: string): Unit | null => { const [s] = id.split(':'); const all = pathOf(s); return all.find(u => u.id === id) ?? (s === 'math' ? all.find(u => u.id === oldUnit(id)) ?? null : null); };
/** A grade as people say it. */
export const gradeName = (g: number | null) => (g === null ? '' : g <= 0 ? 'Kindergarten' : `Grade ${g}`);
