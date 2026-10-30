// Every subject in Keypals, and the four ways to play each one: Learn (watch and try), Practice (the
// map of trips that earn stars, eggs and treasure), Games (arcade games and playground toys) and
// Adventure (worlds and battles). Home, the subject pages and the compass menu all draw from this list,
// so the four ways have the same names, pictures, colours and order everywhere, and a new subject
// (Reading, Spelling...) is one more entry here. A way with nothing in it yet shows as "Coming soon".
import { ALL_LESSONS, REGIONS, type RegionId } from './engine/course';
import { MATH_LESSONS, STRAND } from './math/course';
import { LESSONS } from './math/learn';
import { FRAC_LESSONS } from './math/fracEpisodes';
import { MARKET_LESSONS } from './math/market/episodes';
import { SHAPE_LESSONS } from './math/shapes/episodes';
import { setOf, SETS } from './math/episodes';
import { AREAS, areaOfOp } from './math/skills/registry';
import { SKILL_LESSONS } from './math/skills/course';
import type { AreaId } from './math/skills/types';
import { ARCADE_GAMES } from './arcade/arcade';
import { PLAY_GAMES } from './math/playground';
import { WORLD_PINS } from './adventure/worlds';

export type WayId = 'learn' | 'practice' | 'games' | 'adventure';
/** a Glimmer's round face, for the corner of a Learn card */
const faceOf = (id: string) => `game/glimmers/face/${id}.webp`;
export type Way = { id: WayId; name: string; line: string; icon: string; color: string; dark: string; tint: string };
export const WAYS: Way[] = [
  { id: 'learn', name: 'Learn', line: 'Watch and try', icon: 'icons/book.webp', color: '#f0a92e', dark: '#a86a00', tint: '#fff6df' },
  { id: 'practice', name: 'Practice', line: 'Trips for stars and eggs', icon: 'icons/map.webp', color: '#4a8de8', dark: '#2459a8', tint: '#e8f2ff' },
  { id: 'games', name: 'Games', line: 'Arcade games and toys', icon: 'icons/arcade.webp', color: '#e2468f', dark: '#a8246a', tint: '#ffedf5' },
  { id: 'adventure', name: 'Adventure', line: 'Worlds and battles', icon: 'game/icon-grump.webp', color: '#2e9e6e', dark: '#17704a', tint: '#e6f8ef' },
];
export const WAY = Object.fromEntries(WAYS.map(w => [w.id, w])) as Record<WayId, Way>;

/** One part of a subject (Plus, Fractions, Top row...): a chip on every tab of the subject's page. */
export type Chip = { id: string; name: string; art: string; color: string };
/** One thing to do in a way: an episode, a trip map, a game, a world. `areas` are the chips it shows
 *  under ("All" shows everything); `soon` things are listed but not built yet. */
export type Thing = { id: string; name: string; line: string; art: string; areas: string[]; kind: string; face?: string; soon?: boolean };
/** `soon`: what to say while a way has nothing yet, and `tryIt`, a lesson that comes closest for now */
export type WayContent = { things: Thing[]; unit: string; soon?: string; tryIt?: { label: string; lesson: string } };
export type Subject = {
  id: string; name: string; tag: string; icon: string; color: string;
  /** the shade over its picture on Home */
  shade: string;
  chips: Chip[];
  ways: Record<WayId, WayContent>;
};

// ---------- math ----------
/** The short chip names for math's areas; an area added to the skills registry shows with its own name. */
const AREA_CHIP: Partial<Record<AreaId, string>> = {
  plus: 'Plus', minus: 'Minus', times: 'Times', share: 'Share', fractions: 'Fractions', place: 'Place value', decimals: 'Decimals and money',
  measure: 'Time and measuring', shapes: 'Shapes', ratios: 'Percents', integers: 'Below zero', algebra: 'Equations', data: 'Graphs and chance',
};
const FACT_AREAS: AreaId[] = ['plus', 'minus', 'times', 'share'];
const live = AREAS.filter(a => a.live);
export const MATH_CHIPS: Chip[] = live.map(a => ({ id: a.id, name: AREA_CHIP[a.id] ?? a.name, art: a.op ? STRAND[a.op].art : a.art, color: a.color }));
export const MATH_SOON = AREAS.filter(a => !a.live).map(a => ({ id: a.id, name: AREA_CHIP[a.id] ?? a.name, grades: a.grades, color: a.color }));

const mathLearn: Thing[] = [
  ...LESSONS.map(l => {
    const s = setOf(l.id);
    return { id: l.id, name: l.title, line: l.blurb, art: s.backdrop, face: faceOf(s.star), areas: [l.area ?? areaOfOp(l.op)], kind: 'episode' };
  }),
  ...FRAC_LESSONS.map(l => ({ id: l.id, name: l.title, line: l.blurb, art: l.art, face: faceOf(l.star ?? SETS[l.set].star), areas: ['fractions'], kind: 'episode' })),
  ...MARKET_LESSONS.map(l => ({ id: l.id, name: l.title, line: l.blurb, art: 'learn/market.webp', face: faceOf(l.star), areas: ['decimals'], kind: 'market' })),
  ...SHAPE_LESSONS.map(l => ({ id: l.id, name: l.title, line: l.blurb, art: l.art, face: faceOf(l.star ?? SETS[l.set].star), areas: ['shapes'], kind: 'episode' })),
];
const mathPractice: Thing[] = [
  ...live.map(a => ({ id: a.id, name: a.op ? STRAND[a.op].name : a.name, line: a.op ? STRAND[a.op].blurb : a.blurb, art: a.op ? STRAND[a.op].art : a.art, areas: [a.id], kind: 'trail' })),
  { id: 'garden', name: 'Fact Garden', line: 'Every fact you know, growing. Water the ones that need it.', art: 'icons/garden.webp', areas: FACT_AREAS, kind: 'review' },
];
const PLAY_AREA: Record<string, AreaId> = { line: 'place', bonds: 'plus', build: 'place', stall: 'decimals' };
const PLAY_ART: Record<string, string> = { line: 'math/play-line.webp', bonds: 'math/play-bubbles.webp', build: 'math/play-build.webp', stall: 'math/play-stall.webp' };
const mathGames: Thing[] = [
  ...ARCADE_GAMES.map(g => ({ id: g.id, name: g.name, line: g.blurb, art: g.art, areas: FACT_AREAS, kind: 'arcade' })),
  { id: 'pizza', name: 'Pizza Rush', line: 'Serve fraction pizzas to hungry Glimmers.', art: 'arcade/cab-pizza.webp', areas: ['fractions'], kind: 'arcade' },
  { id: 'builder', name: 'Number Builder', line: 'Build numbers with hundreds, tens and ones.', art: 'arcade/cab-builder.webp', areas: ['place'], kind: 'arcade' },
  { id: 'market', name: 'Market Dash', line: 'Pay and give change to Glimmer shoppers.', art: 'arcade/cab-market.webp', areas: ['decimals'], kind: 'arcade' },
  { id: 'shifter', name: 'Shape Shifter', line: 'Catch the crystal shapes that fit the rule.', art: 'arcade/cab-shapes.webp', areas: ['shapes'], kind: 'arcade' },
  ...PLAY_GAMES.map(g => ({ id: g.id, name: g.name, line: g.blurb, art: PLAY_ART[g.id] ?? 'math/strand-playground.webp', areas: [PLAY_AREA[g.id] ?? 'plus'], kind: 'toy' })),
  { id: 'blocks', name: 'Block Table', line: 'Build anything with blocks. No questions, no clock.', art: 'math/play-blocks.webp', areas: ['place'], kind: 'toy' },
  { id: 'shapebuilder', name: 'Shape Builder', line: 'Stretch glowing bands between pegs. No clock, no rush.', art: 'math/play-shapes.webp', areas: ['shapes'], kind: 'toy' },
];
const mathWorlds: Thing[] = WORLD_PINS.map(w => ({
  id: w.id, name: w.name, line: w.blurb, art: w.map ? w.map.wide : 'game/worlds-wide.webp',
  areas: w.area ? [w.area] : FACT_AREAS, kind: 'world', soon: !w.map,
}));

// ---------- typing ----------
const REGION_CHIP: Record<RegionId, string> = { village: 'Home row', treetops: 'Top row', burrows: 'Bottom row', cliffs: 'Capitals', ridge: 'Numbers', shores: 'Symbols', road: 'Open Road' };
const REGION_COLOR: Record<RegionId, string> = { village: '#7c5cf5', treetops: '#2e9e6e', burrows: '#b4561a', cliffs: '#e0567a', ridge: '#2f63bd', shores: '#13786c', road: '#d9a21b' };
export const TYPING_CHIPS: Chip[] = REGIONS.map(r => ({ id: r.id, name: REGION_CHIP[r.id], art: `regions/${r.id}.webp`, color: REGION_COLOR[r.id] }));
const typingLearn: Thing[] = ALL_LESSONS.filter(l => l.kind === 'drill').map(l => ({
  id: l.id, name: l.title, line: l.blurb ?? 'Your buddy shows which finger reaches each new key. Then you try.', art: `regions/${l.region}.webp`, areas: [l.region], kind: 'keys',
}));
const typingPractice: Thing[] = REGIONS.map(r => ({ id: r.id, name: r.name, line: r.blurb, art: `regions/${r.id}.webp`, areas: [r.id], kind: 'trail' }));
const typingWorlds: Thing[] = [{ id: 'sky', name: 'Sky Islands', line: 'Battles where you type the words to cheer up the Glimmers.', art: 'game/map-wide.webp', areas: REGIONS.map(r => r.id), kind: 'world' }];

export const SUBJECTS: Subject[] = [
  {
    id: 'typing', name: 'Typing', tag: 'All ten fingers, no peeking', icon: 'game/icon-typing.webp', color: '#7c5cf5', shade: 'rgba(84, 52, 190, .88)',
    chips: TYPING_CHIPS,
    ways: {
      learn: { things: typingLearn, unit: 'new-key lessons' },
      practice: { things: typingPractice, unit: 'lessons' },
      games: { things: [], unit: 'games', soon: 'Typing games are on the way. For now, Speed Sprint on the Open Road is a race against the clock.', tryIt: { label: 'Speed Sprint', lesson: 'road-4' } },
      adventure: { things: typingWorlds, unit: 'world' },
    },
  },
  {
    id: 'math', name: 'Math', tag: 'Add, take away, times, share and more', icon: 'game/icon-math.webp', color: '#ef7d2b', shade: 'rgba(214, 96, 24, .88)',
    chips: MATH_CHIPS,
    ways: {
      learn: { things: mathLearn, unit: 'videos' },
      practice: { things: mathPractice, unit: 'trips' },
      games: { things: mathGames, unit: 'games' },
      adventure: { things: mathWorlds, unit: 'worlds' },
    },
  },
];
export const SUBJECT = Object.fromEntries(SUBJECTS.map(s => [s.id, s])) as Record<string, Subject>;

/** How many things a way has (trips for Practice: every stop on its maps). */
export function wayCount(s: Subject, w: WayId): number {
  if (w === 'practice') return s.id === 'math' ? MATH_LESSONS.length + SKILL_LESSONS.length : s.id === 'typing' ? ALL_LESSONS.length : s.ways.practice.things.length;
  return s.ways[w].things.filter(t => !t.soon).length;
}
/** A way's things under one chip ('all': everything). */
export const thingsIn = (s: Subject, w: WayId, chip: string) => s.ways[w].things.filter(t => chip === 'all' || t.areas.includes(chip));
/** The chips a thing shows under, by name ("Plus · Minus · Times · Share"). */
export function chipNames(s: Subject, t: Thing): string {
  const all = s.chips.map(c => c.id);
  if (all.every(id => t.areas.includes(id))) return 'All';
  return t.areas.map(a => s.chips.find(c => c.id === a)?.name ?? MATH_SOON.find(c => c.id === a)?.name ?? a).join(' · ');
}
/** For an area: the first thing it has in each other way (the "Learn it / Game / World" links on its card). */
export function linksFor(s: Subject, chip: string): Partial<Record<WayId, Thing>> {
  const out: Partial<Record<WayId, Thing>> = {};
  for (const w of ['learn', 'games', 'adventure'] as WayId[]) {
    const t = s.ways[w].things.find(x => !x.soon && x.areas.includes(chip) && (w !== 'adventure' || x.areas.length === 1 || !s.ways[w].things.some(y => !y.soon && y.areas.length === 1 && y.areas.includes(chip))));
    if (t) out[w] = t;
  }
  return out;
}

/** The places that take every subject: on Home under "Play anywhere", and in the compass menu.
 *  `fun` ones are just for fun and use play time; `versus` ones show when the grown-ups allow them. */
export type Anywhere = { id: 'arcade' | 'adventure' | 'drop' | 'duel' | 'rivals'; name: string; line: string; icon: string; art: string; contain?: boolean; fun?: boolean; versus?: boolean };
export const ANYWHERE: Anywhere[] = [
  { id: 'arcade', name: 'Arcade', line: 'Every game in one place', icon: 'icons/arcade.webp', art: 'arcade/bg-plaza.webp' },
  { id: 'adventure', name: 'Adventure', line: 'Every world, battles and Glimmers', icon: 'game/icon-grump.webp', art: 'game/door-adventure.webp' },
  { id: 'drop', name: 'Glimmer Drop', line: 'Just for fun · uses play time', icon: 'drop/tile.webp', art: 'arcade/cab-drop.webp', contain: true, fun: true },
  { id: 'duel', name: 'Family Duel', line: 'Two players, one screen', icon: 'game/tile-duel.webp', art: 'game/intro-duel.webp', versus: true },
  { id: 'rivals', name: 'Rival Ghosts', line: 'Race a ghost, climb the leagues', icon: 'game/tile-rivals.webp', art: 'game/intro-rivals.webp', versus: true },
];
