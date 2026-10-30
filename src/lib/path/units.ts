// My path: each subject laid out like a syllabus, as units in a sensible order, each unit a short list
// that mixes the four ways to play: a Learn episode or two, the practice trips, a game round in that
// area, an Adventure battle in its world, and a unit check. It's a guide, not a cage: everything else in
// the game stays open (unless a grown-up or teacher keeps a player to it: rules.ts).
//
// Math: every area's regions (the map's islands), in grade order, the areas mixed together (Kindergarten
// counting and shapes, then grade 1 adding and taking away...). Typing: the typing course's regions, in
// order (the Open Road is free play, so it isn't a unit). A subject added to subjects.ts with no builder
// here gets a simple path from its own lists: one unit per part (chip), its things in way order.
//
// An item is a short reference (`ref`) that says how it's done and how to start it:
//   ep:<episode>     a math Learn episode           trip:<lesson>   a practice trip or typing lesson
//   game:<game>      a round of that game           battle:<world>  a battle won in that world
//   skill:<skill>    practice on one skill (a teacher's own unit)
//   check            the unit check: comfortable or better on the unit's skills (math), or the region's
//                    checkpoint run passed (typing: trip:<checkpoint>, shown as the check)
//   thing:<way>:<id> anything from a subject's lists (the simple path of a new subject)
import { REGIONS, LESSON as TYPING_LESSON, type Lesson as TypingLesson } from '../engine/course';
import { MATH_REGIONS, MATH_LESSON, STRAND, regionsOf, type MathRegion } from '../math/course';
import { LESSON as TRICK, lessonForStop } from '../math/learn';
import { SKILL_EPISODES, SKILL_LESSON, SKILL_REGIONS, type SkillRegion } from '../math/skills/course';
import { AREA, AREAS, SKILL, areaOfOp } from '../math/skills/registry';
import { STRAND_SKILL } from '../math/skills/ability';
import type { AreaId } from '../math/skills/types';
import { SUBJECT, SUBJECTS, WAY, type Subject, type Thing, type WayId } from '../subjects';
import { WORLD_PIN, WORLD_PINS } from '../adventure/worlds';
import { nodesOf, type WorldId } from '../adventure/state';

export type ItemKind = 'learn' | 'practice' | 'game' | 'battle' | 'check';
export type PathItem = { ref: string; kind: ItemKind; name: string; line: string };
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
  items: PathItem[];
};

export const KIND_NAME: Record<ItemKind, string> = { learn: 'Learn', practice: 'Practice', game: 'Game', battle: 'Adventure', check: 'Unit check' };
/** the picture for each kind of item: the four ways' own pictures, and a tick for the check */
export const KIND_ICON: Record<ItemKind, string> = { learn: WAY.learn.icon, practice: WAY.practice.icon, game: WAY.games.icon, battle: WAY.adventure.icon, check: 'icons/finish.webp' };
const WAY_OF: Record<ItemKind, WayId | null> = { learn: 'learn', practice: 'practice', game: 'games', battle: 'adventure', check: null };
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
    const t = mathThing('learn', a);
    return { kind: 'learn', name: t?.name ?? TRICK[a]?.title ?? a, line: t?.line || 'Watch your buddy, then try it' };
  }
  if (k === 'trip') {
    const tl = TYPING_LESSON[a];
    if (tl && subject === 'typing') return { kind: typingKind(tl), name: tl.title, line: tl.blurb ?? (tl.kind === 'drill' ? 'New keys: watch, then type' : tl.kind === 'checkpoint' ? 'The island\'s big run' : 'A typing lesson') };
    const ml = MATH_LESSON[a] ?? SKILL_LESSON[a];
    if (ml) return { kind: 'practice', name: ml.title, line: ml.blurb || (ml.kind === 'mix' ? 'Everything so far, mixed up' : 'A practice trip') };
    if (tl) return { kind: typingKind(tl), name: tl.title, line: 'A typing lesson' };
    return { kind: 'practice', name: a, line: 'A practice trip' };
  }
  if (k === 'skill') return { kind: 'practice', name: SKILL[a]?.name ?? a, line: '10 right answers' };
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

// ---------- math ----------
/** A region's school grade: the youngest grade among its skills. */
const regionGrade = (r: SkillRegion) => Math.min(...r.skills.map(s => SKILL[s]?.grade ?? 9));
/** The Learn episodes that teach a region's skills, in skill order, each once (the ones that exist). */
function skillEpisodes(r: SkillRegion): string[] {
  const out: string[] = [];
  for (const s of r.skills) { const ep = SKILL_EPISODES[s]; if (ep && mathThing('learn', ep) && !out.includes(ep)) out.push(ep); }
  return out.slice(0, 3);
}
function factEpisodes(r: MathRegion): string[] {
  const out: string[] = [];
  for (const l of r.lessons) { if (l.kind !== 'meet' && l.kind !== 'rules') continue; const t = lessonForStop(l); if (t && !out.includes(t.id)) out.push(t.id); }
  return out;
}
type Draft = Omit<Unit, 'n' | 'items' | 'gameNeed' | 'battleNeed'> & { order: [number, number, number]; eps: string[]; trips: string[]; game?: string; world: string };

function mathDrafts(): Draft[] {
  const out: Draft[] = [];
  const areaOrder = (a: AreaId) => AREAS.findIndex(x => x.id === a);
  // the fact strands: each region is a unit (the strand's grade, from its skill)
  for (const op of ['+', '-', 'x', '/'] as const) {
    const area = areaOfOp(op), sk = STRAND_SKILL[op], grade = SKILL[sk]?.grade ?? 1;
    const games = gamesForArea(area);
    regionsOf(op).forEach((r, i) => {
      const check = r.lessons.find(l => l.kind === 'check');
      out.push({
        id: `math:${r.id}`, subject: 'math', area, region: r.id, name: r.name, part: STRAND[op].name, blurb: r.blurb, grade,
        color: STRAND[op].color, art: `regions/${r.world}.webp`, skills: [sk], groups: r.groups, checkTrip: check?.id,
        order: [grade, i, areaOrder(area)], eps: factEpisodes(r), trips: r.lessons.filter(l => l.kind !== 'check').map(l => l.id),
        game: games.length ? games[out.filter(d => d.area === area).length % games.length]?.id : undefined, world: worldForArea(area),
      });
    });
  }
  // the other areas: each region (island) is a unit
  const seen: Record<string, number> = {};
  for (const r of SKILL_REGIONS) {
    if (!AREA[r.area]?.live) continue;
    const i = (seen[r.area] = (seen[r.area] ?? -1) + 1);
    const grade = regionGrade(r);
    const check = r.lessons.find(l => l.kind === 'check');
    out.push({
      id: `math:${r.id}`, subject: 'math', area: r.area, region: r.id, name: r.name, part: AREA[r.area].name, blurb: r.blurb, grade,
      color: AREA[r.area].color, art: r.art ?? `regions/${r.world}.webp`, skills: [...r.skills], checkTrip: check?.id,
      order: [grade, i, areaOrder(r.area)], eps: skillEpisodes(r), trips: r.lessons.filter(l => l.kind !== 'check').map(l => l.id),
      game: gamesForArea(r.area)[0]?.id, world: worldForArea(r.area),
    });
  }
  return out.sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2]);
}

// ---------- typing ----------
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

/** Number the units, and work out how many game rounds and battles each one asks for. */
function finish(drafts: Draft[]): Unit[] {
  const gameUses: Record<string, number> = {}, worldUnits: Record<string, number> = {}, worldUses: Record<string, number> = {};
  for (const d of drafts) worldUnits[d.world] = (worldUnits[d.world] ?? 0) + 1;
  return drafts.map((d, i) => {
    const { order: _o, eps, trips, game, world, ...u } = d;
    const gameNeed = game ? (gameUses[game] = (gameUses[game] ?? 0) + 1) : undefined;
    const k = (worldUses[world] = (worldUses[world] ?? 0) + 1);
    const stops = stopsIn(world);
    const battleNeed = Math.min(stops, Math.ceil((k * stops) / Math.max(1, worldUnits[world])));
    const refs = [...eps.map(e => `ep:${e}`), ...trips.map(t => `trip:${t}`), ...(game ? [`game:${game}`] : []), `battle:${world}`, d.subject === 'typing' ? (d.checkTrip ? `trip:${d.checkTrip}` : '') : 'check'].filter(Boolean);
    const items = refs.map(r => itemOf(r, d.subject));
    // the typing units' own lines: say how many battles it asks for
    for (const it of items) if (it.kind === 'battle' && battleNeed > 1) it.line = `Win ${battleNeed} stops on the map`;
    for (const it of items) if (it.kind === 'game' && gameNeed && gameNeed > 1) it.line = `Play round ${gameNeed}`;
    return { ...u, n: i + 1, gameNeed, battleNeed, items };
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

const BUILDERS: Record<string, () => Draft[]> = { math: mathDrafts, typing: typingDrafts };
const cache = new Map<string, Unit[]>();
/** A subject's path: its units in order (built once). */
export function pathOf(subject: string): Unit[] {
  let u = cache.get(subject);
  if (!u) {
    const b = BUILDERS[subject], s = SUBJECT[subject];
    u = b ? finish(b()) : s ? simpleUnits(s) : [];
    cache.set(subject, u);
  }
  return u;
}
/** The subjects that have a path (every subject in subjects.ts). */
export const PATH_SUBJECTS = () => SUBJECTS.filter(s => pathOf(s.id).length);
export const unitById = (id: string) => { const [s] = id.split(':'); return pathOf(s).find(u => u.id === id) ?? null; };
/** A grade as people say it. */
export const gradeName = (g: number | null) => (g === null ? '' : g <= 0 ? 'Kindergarten' : `Grade ${g}`);
