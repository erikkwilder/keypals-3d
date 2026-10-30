// Adventure: the player's side of it. The map (three sky islands, a Champion at the end of each), the
// Glimmers you've collected and your team, eggs warming in the incubator (they hatch from right answers in
// practice), shells and the shop, the grown-ups' play-time rule, and what a battle earns.
import { mulberry32, type Rng } from '../engine/rng';
import { buddyPal, dayKey, knownFor, nextLesson, type Profile, type XpInfo } from '../engine/profile';
import type { StickerDef } from '../engine/stickers';
import type { Reward } from '../engine/rewards';
import { befriend, checkStickers } from '../engine/settle';
import { LAYOUTS } from '../engine/layouts';
import { fits } from '../engine/textgen';
import { WORDS_KIDS } from '../content/words';
import { mathOf, nextMathLesson } from '../math/progress';
import { lessonFacts } from '../math/course';
import { factId, parseFact, seedPartner, updateFact, weakness, type Fact, type Op } from '../math/facts';
import { AREA, SKILL, splitKey } from '../math/skills/registry';
import { nextSkillLesson } from '../math/skills/course';
import { noteSkillAnswers } from '../math/skills/progress';
import { factAnswers, noteAbility, strandOf, thetaOf } from '../math/skills/ability';
import type { AreaId } from '../math/skills/types';
import { EVOLVE_BOOST, GLIMMER, GLIMMERS, RARITIES, RARITY, glimmersOf, powerBase, powerNum, rarityRank, type Element, type GlimmerId, type Rarity } from './glimmers';
import { grumpFor, type MapFoe, type MischiefKind, type Pool, type Subject } from './battle';
import { championPrize, type BuddyGear, type GearItem, type Wardrobe } from './gear';
import type { RegionId } from '../engine/course';
import { newStats, noteStats, type GhostStats, type RivalState } from './ghosts';
import { parallel } from './trails';

// ---------- the map ----------
export type IslandId = 'meadow' | 'treetops' | 'bay' | 'falls' | 'caves' | 'market' | 'stars';
export type NodeKind = 'battle' | 'practice' | 'champion';
export type MapNode = { id: string; island: IslandId; kind: NodeKind; n: number };
/** The worlds on the world map: the Sky Islands (the first three islands, any math or typing), and worlds
 *  of one kind of math (Fraction Falls: every battle card is a fraction). Each world's stops are in order
 *  on their own; finishing one world doesn't open another. */
export type WorldId = 'sky' | 'falls' | 'caves' | 'market' | 'stars';
export type Island = {
  id: IslandId; world: WorldId; name: string; element: Element; region: RegionId; champion: GlimmerId; blurb: string; odds: Partial<Record<Rarity, number>>;
  /** how tough its Grumbles are (and how many shells they give): 0 for the first island */
  tier: number;
  /** a math world's area: its battles are always math, every card from this area */
  area?: AreaId;
  /** Glimmers that live here besides the ones whose home it is (a world borrows a few from the islands) */
  natives?: GlimmerId[];
  /** its own weather: every Grumble here sends this instead of its element's mischief */
  mischief?: { kind: MischiefKind; name: string };
};
export const ISLANDS: Island[] = [
  { id: 'meadow', world: 'sky', tier: 0, name: 'Sunny Meadow', element: 'sun', region: 'village', champion: 'lanternfox', blurb: 'Wildflowers, warm stones and a storm that won\'t go home.', odds: { common: 62, uncommon: 25, rare: 9, epic: 3.8, mythic: 0.2 } },
  { id: 'treetops', world: 'sky', tier: 1, name: 'Treetop Hollow', element: 'leaf', region: 'treetops', champion: 'bloomdrake', blurb: 'Rope bridges, giant leaves and grumbling up in the branches.', odds: { common: 50, uncommon: 28, rare: 14, epic: 7.7, mythic: 0.3 } },
  { id: 'bay', world: 'sky', tier: 2, name: 'Cloudwhale Bay', element: 'tide', region: 'shores', champion: 'skywhale', blurb: 'Turquoise water, a lighthouse, and something huge in the clouds.', odds: { common: 40, uncommon: 30, rare: 18, epic: 11.5, mythic: 0.5 } },
  // Fraction Falls: a pie shop at the top of the falls, little bridges from pool to pool, and a thundercloud
  // at the top that sprays everyone
  { id: 'falls', world: 'falls', tier: 1, name: 'Fraction Falls', element: 'tide', region: 'cliffs', champion: 'stormlamb', area: 'fractions',
    natives: ['bubbleocto', 'rainbootfrog', 'frostjelly'], mischief: { kind: 'rain', name: 'Waterfall spray is coming' },
    blurb: 'A pie shop, bridges from pool to pool, and a waterfall for every fraction.', odds: { common: 46, uncommon: 30, rare: 16, epic: 7.6, mythic: 0.4 } },
  // Counting Caves: crystal caves with glowing number veins, mine carts of blocks, and a crystal throne at
  // the top; its Grumbles shake crystals loose from the ceiling
  { id: 'caves', world: 'caves', tier: 1, name: 'Counting Caves', element: 'stone', region: 'burrows', champion: 'prismhorn', area: 'place',
    natives: ['geodemole', 'rollodillo', 'potgolem'], mischief: { kind: 'pebbles', name: 'Falling crystals are coming' },
    blurb: 'Crystal caves, mine carts full of blocks, and a crystal throne at the top.', odds: { common: 46, uncommon: 30, rare: 16, epic: 7.6, mythic: 0.4 } },
  // Market Isle: a floating bazaar of striped stalls, a coin fountain, a balance scale and a golden market
  // hall at the top; the wind from the awnings is its weather
  { id: 'market', world: 'market', tier: 1, name: 'Market Isle', element: 'sun', region: 'village', champion: 'prismhorn', area: 'decimals',
    natives: ['geodemole', 'popcornpuff', 'rollodillo', 'teakettledrake'], mischief: { kind: 'gust', name: 'A gust from the awnings is coming' },
    blurb: 'Striped stalls, a coin fountain and a golden market hall. Every battle card is money or decimals.', odds: { common: 46, uncommon: 30, rare: 16, epic: 7.6, mythic: 0.4 } },
  // Star Lab: a sky observatory among the stars, with brass telescopes, golden balances and a great domed
  // observatory at the top; its Grumbles send shooting stars. Its own Glimmers (adventure/starGlimmers.ts)
  // are still waiting for their 3D models, so for now star-ish Glimmers from the other islands live here
  // and the Comet Cat is its Champion.
  { id: 'stars', world: 'stars', tier: 1, name: 'Star Lab', element: 'frost', region: 'ridge', champion: 'cometcat', area: 'algebra',
    natives: ['sparkmoth', 'frostowl', 'frostjelly', 'whalecalf'], mischief: { kind: 'zap', name: 'Shooting stars are coming' },
    blurb: 'Telescopes, golden balances and a great domed observatory. Every battle card is an equation.', odds: { common: 46, uncommon: 30, rare: 16, epic: 7.6, mythic: 0.4 } },
];
export const islandsOf = (w: WorldId) => ISLANDS.filter(i => i.world === w);
export const ISLAND: Record<IslandId, Island> = Object.fromEntries(ISLANDS.map(i => [i.id, i])) as Record<IslandId, Island>;
const PATH: NodeKind[] = ['battle', 'battle', 'practice', 'battle', 'battle', 'champion'];
export const NODES: MapNode[] = ISLANDS.flatMap(isl => PATH.map((kind, n) => ({ id: `${isl.id}-${n}`, island: isl.id, kind, n })));
export const NODE: Record<string, MapNode> = Object.fromEntries(NODES.map(n => [n.id, n]));
export const nodesOf = (w: WorldId) => NODES.filter(n => ISLAND[n.island].world === w);
/** A world is open once there's something to battle with: the Sky Islands always; a math world once its
 *  area is started (a question of it answered in a trip, placement or battle). */
export function worldOpen(p: Profile, w: WorldId): boolean {
  const area = islandsOf(w).find(i => i.area)?.area;
  if (!area) return true;
  return Object.entries(mathOf(p).skills ?? {}).some(([k, s]) => (s.seen > 0 || s.stage > 0) && SKILL[splitKey(k).skill]?.area === area);
}

// ---------- the player's adventure ----------
export type Egg = { id: string; rarity: Rarity; need: number; have: number; got: number };
export type PlayRule = 'open' | 'balanced' | 'practiceFirst';
export type AdvSettings = {
  rule: PlayRule;
  /** balanced: play minutes earned per practice minute */
  ratio: number;
  /** balanced: play minutes free each day before any practice */
  freeMin: number;
  /** most play minutes a day (0: no limit) */
  capMin: number;
  /** battles use only this kind of math (or all of it): a fact kind, or a skill area such as fractions */
  focus: 'all' | Op | AreaId;
  /** Family Duel and Rival Ghosts (on this device only) are open; grown-ups can turn them off */
  versus?: boolean;
};
export const DEFAULT_SETTINGS: AdvSettings = { rule: 'balanced', ratio: 1, freeMin: 10, capMin: 0, focus: 'all' };
export type Owned = { level: number; xp: number; got: number; evolved?: boolean };
export type Adventure = {
  shells: number; xp: number;
  glimmers: Partial<Record<GlimmerId, Owned>>;
  /** up to two Glimmers battle beside your buddy */
  team: (GlimmerId | null)[];
  /** three warm slots; more eggs wait in the nest */
  incubator: (Egg | null)[];
  nest: Egg[];
  eggsMade: number;
  /** each map stop's clears */
  nodes: Record<string, number>;
  /** practice sessions finished (any game), and the count when each practice stop was reached */
  practiceSessions: number;
  stopAt: Record<string, number>;
  subject: Subject;
  /** today's play: minutes, answers */
  day: { key: string; ms: number; answers: number; right: number };
  settings: AdvSettings;
  battles: number; wins: number; perfects: number;
  /** Glimmers met but not yet looked at in the collection (the "new" dot) */
  fresh: GlimmerId[];
  /** tips and intros already shown ('intro', 'battle1', 'map1', 'strong', 'perfect') */
  seen: string[];
  /** (old saves) each buddy's hand, back and shoe gear; now the player's wardrobe below (gear.ts) */
  gear: Partial<Record<string, BuddyGear>>;
  /** the player's wearable things, and each buddy's look (gear.ts) */
  wardrobe?: Wardrobe;
  /** how this player plays (for their Rival Ghost), their Rival Ghosts season, and Family Duels played */
  ghost?: GhostStats; rivals?: RivalState; duels?: { played: number; won: number };
  /** Glimmer Drop: best scores and the chain Glimmers made (drop/save.ts) */
  drop?: import('../drop/save').DropSave;
  /** the walking map (trails.ts): the trail point the buddy stands on in each world */
  walkAt?: Partial<Record<WorldId, string>>;
  /** finds on the trails (treasure chests, hidden spots, Bonus Rounds): the day each was last collected */
  finds?: Record<string, string>;
  /** hidden spots found so far: they stay on the map once found */
  hidden?: string[];
};
export const newAdventure = (): Adventure => ({
  shells: 0, xp: 0, glimmers: {}, team: [null, null], incubator: [null, null, null], nest: [], eggsMade: 0, nodes: {},
  practiceSessions: 0, stopAt: {}, subject: 'math', day: { key: '', ms: 0, answers: 0, right: 0 }, settings: { ...DEFAULT_SETTINGS },
  battles: 0, wins: 0, perfects: 0, fresh: [], seen: [], gear: {},
});
/** The player's adventure, filled in (older saves have none). Changes go into the profile. */
export function advOf(p: Profile): Adventure {
  const a = (p.adventure ??= newAdventure());
  const d = newAdventure();
  for (const k of Object.keys(d) as (keyof Adventure)[]) if (a[k] === undefined) (a as Record<string, unknown>)[k] = d[k];
  a.settings = { ...DEFAULT_SETTINGS, ...a.settings };
  return a;
}
/** The adventure to read (filled in, nothing written): for screens. Change it with advOf inside game.update. */
/** Mark a tip as shown. */
export function markSeen(p: Profile, ...ids: string[]) { const a = advOf(p); a.seen = [...new Set([...(a.seen ?? []), ...ids])]; }
export function advView(p: Profile): Adventure {
  const a = p.adventure, d = newAdventure();
  return a ? { ...d, ...a, settings: { ...DEFAULT_SETTINGS, ...a.settings } } : d;
}
export const owns = (a: Adventure, id: GlimmerId) => !!a.glimmers[id];
export const xpNeed = (level: number) => 20 + level * 10;
export const MAX_LEVEL = 20;
export function giveXp(o: Owned, xp: number): number {
  let ups = 0;
  o.xp += xp;
  while (o.level < MAX_LEVEL && o.xp >= xpNeed(o.level)) { o.xp -= xpNeed(o.level); o.level++; ups++; }
  if (o.level >= MAX_LEVEL) o.xp = 0;
  return ups;
}

// ---------- where you are on the map ----------
export const cleared = (a: Adventure, id: string) => (a.nodes[id] ?? 0) > 0;
/** A practice stop counts once a practice session has finished since you reached it. */
export function practiceDone(a: Adventure, id: string): boolean {
  if (cleared(a, id)) return true;
  return a.stopAt[id] !== undefined && a.practiceSessions > a.stopAt[id];
}
/** The next stop in a world: the first one not done. */
export function currentNode(a: Adventure, w: WorldId = 'sky'): MapNode | null {
  for (const n of nodesOf(w)) {
    if (n.kind === 'practice' ? !practiceDone(a, n.id) : !cleared(a, n.id)) return n;
  }
  return null;
}
/** Practice stops: with the Open rule they can be stepped past (they still give their reward). */
export function canPass(a: Adventure, n: MapNode) { return n.kind !== 'practice' || practiceDone(a, n.id) || a.settings.rule === 'open'; }
/** Open once every stop before it in its own world is done (the two battles on parallel routes, stops 3
 *  and 4, don't wait for each other: either can come first; the Champion waits for both). */
export function nodeOpen(a: Adventure, n: MapNode): boolean {
  const list = nodesOf(ISLAND[n.island].world), i = list.indexOf(n);
  for (let k = 0; k < i; k++) { const m = list[k]; if (parallel(m.id, n.id)) continue; if (m.kind === 'practice' ? !canPass(a, m) : !cleared(a, m.id)) return false; }
  return true;
}
/** Mark a practice stop as reached, so the next practice session finishes it. */
export function reachStop(a: Adventure, id: string) { if (a.stopAt[id] === undefined) a.stopAt[id] = a.practiceSessions; }
/** Collect a finished practice stop's reward: 20 shells and a treat-sized warm-up for the eggs. */
export function collectStop(p: Profile, id: string): { shells: number; ready: Rarity[] } | null {
  const a = advOf(p);
  if (cleared(a, id) || !practiceDone(a, id)) return null;
  a.nodes[id] = 1; a.shells += 20;
  return { shells: 20, ready: warmEggs(p, 5) };
}

// ---------- play time: the grown-ups' rule ----------
export const PLAY_RULES: Record<PlayRule, { name: string; text: string }> = {
  open: { name: 'Open', text: 'Adventure is always open. Practice still hatches eggs and finishes the practice stops.' },
  balanced: { name: 'Balanced', text: 'Practice earns play time, plus some free minutes every day.' },
  practiceFirst: { name: 'Practice first', text: 'Adventure opens once today\'s practice goal is reached.' },
};
export function today(a: Adventure, now: number) { const k = dayKey(now); if (a.day.key !== k) a.day = { key: k, ms: 0, answers: 0, right: 0 }; return a.day; }
export function practiceMinToday(p: Profile, now = Date.now()) { return (p.days[dayKey(now)]?.ms ?? 0) / 60000; }
/** Whether Adventure is open now, and how many play minutes are left today (null: no limit). */
export function playLeft(p: Profile, now = Date.now()): { open: boolean; left: number | null; why: string } {
  // read only (screens call this while drawing)
  const a = advView(p), s = a.settings, used = (a.day.key === dayKey(now) ? a.day.ms : 0) / 60000;
  let left: number | null = null;
  if (s.rule === 'practiceFirst' && !p.days[dayKey(now)]?.goal) return { open: false, left: 0, why: 'Adventure opens once today\'s practice goal is reached.' };
  if (s.rule === 'balanced') left = s.freeMin + practiceMinToday(p, now) * s.ratio - used;
  if (s.capMin > 0) left = Math.min(left ?? Infinity, s.capMin - used);
  if (left !== null && left <= 0) return { open: false, left: 0, why: s.rule === 'balanced' && (s.capMin === 0 || used < s.capMin) ? 'Practice earns more Adventure time: every minute of practice adds play minutes.' : 'That\'s all the Adventure for today. See you tomorrow!' };
  return { open: true, left, why: '' };
}

// ---------- what a battle draws on ----------
/** Math: the facts the player has met (any kind, or the grown-ups' focus); a new player gets the first
 *  plus facts. Open cards come in once some times or plus facts are known well. `only`: a math world's
 *  area (Fraction Falls), which wins over the grown-ups' focus. */
export function mathPool(p: Profile, only?: AreaId): Pool {
  const m = mathOf(p), focus = only ?? advView(p).settings.focus;
  // a skill area the grown-ups chose (fractions...): every card is one of its questions, and the quick
  // blocks use the facts met so far
  const area = focus !== 'all' && focus.length > 1 && AREA[focus as AreaId] && !AREA[focus as AreaId].op ? (focus as AreaId) : null;
  const ok = (f: Fact) => focus === 'all' || !!area || (f.op ?? 'x') === focus;
  let facts = Object.entries(m.facts).filter(([, s]) => s.seen > 0 || s.stage > 0).map(([id, s]) => ({ f: parseFact(id), stage: s.stage })).filter(x => ok(x.f));
  if (facts.length < 8) {
    const op: Op = focus !== 'all' && !area ? (focus as Op) : facts.length ? (facts[0].f.op ?? 'x') : '+';
    const extra = lessonFacts(nextMathLesson(m, op)).filter(f => !facts.some(x => factId(x.f) === factId(f)));
    facts = facts.concat(extra.map(f => ({ f, stage: m.facts[factId(f)]?.stage ?? 0 })));
  }
  // leave out the ones with nothing to them (times 0 or 1, plus 0, take away 0, divide by 1) unless
  // that's all there is; a brand-new player gets friendly sums to 10 instead
  const real = facts.filter(x => { const op = x.f.op ?? 'x', { a, b } = x.f; return op === 'x' ? a > 1 && b > 1 : op === '+' ? a > 0 && b > 0 : op === '-' ? b > 0 && a !== b : b > 1 && a !== b; });
  if (real.length >= 6) facts = real;
  else if (focus === 'all' || area || focus === '+') {
    const have = new Set(facts.map(x => factId(x.f)));
    for (let a = 1; a <= 5; a++) for (let b = 1; b <= 5; b++) { const f: Fact = { a, b, op: '+' }; if (!have.has(factId(f))) facts.push({ f, stage: m.facts[factId(f)]?.stage ?? 0 }); }
    facts = facts.filter(x => (x.f.op ?? 'x') !== '+' || (x.f.a > 0 && x.f.b > 0));
  }
  // how shaky each one is, so battles deal the ones that need practice more often
  for (const x of facts) (x as { w?: number }).w = weakness(m.facts[factId(x.f)], m.fastMs);
  // open cards (7 × ?) are kept for later: they confused first-time players
  const skills = skillPool(m, area);
  // the player's ability on everything in the pool, so each question is pitched for them (and in a duel,
  // each side for its own player)
  const theta: Record<string, number> = {}, now = Date.now();
  for (const id of new Set([...facts.map(x => strandOf(x.f)), ...skills.map(x => splitKey(x.key).skill)])) theta[id] = thetaOf(m, id, now, !!p.settings.grown);
  return { subject: 'math', facts, open: false, skills, mix: !skills.length ? 0 : area ? 1 : focus === 'all' ? SKILL_MIX : 0, theta };
}
/** How many battle cards are skill questions once a skill area is started (the rest are facts). */
export const SKILL_MIX = 0.35;
/** The skill questions a battle can deal: every skill sub met so far in the live areas (or only the
 *  grown-ups' chosen area, which starts with its first lesson's skills when nothing is met yet), the
 *  shaky ones weighted up like facts. */
export function skillPool(m: ReturnType<typeof mathOf>, area: AreaId | null): { key: string; stage: number; w: number }[] {
  const mem = m.skills ?? {};
  const live = (key: string) => { const sk = SKILL[splitKey(key).skill]; return !!sk && !sk.facts && AREA[sk.area]?.live && (!area || sk.area === area); };
  let keys = Object.entries(mem).filter(([k, s]) => (s.seen > 0 || s.stage > 0) && live(k)).map(([k]) => k);
  if (!keys.length && area) keys = nextSkillLesson(m, area).skills.flatMap(id => SKILL[id].subs.slice(0, 2).map(sb => `${id}:${sb.id}`));
  return keys.map(key => ({ key, stage: mem[key]?.stage ?? 0, w: weakness(mem[key], SKILL[splitKey(key).skill].fastMs) }));
}
/** Typing: words made only of the keys learned so far. */
export function typingPool(p: Profile): Pool {
  const known = knownFor(p, nextLesson(p), LAYOUTS[p.settings.layout]);
  let words = WORDS_KIDS.filter(w => w.length >= 2 && w.length <= 9 && fits(w, known));
  if (words.length < 12) {
    // very early: make little letter groups from the keys there are
    const keys = [...known].filter(c => /[a-z]/.test(c));
    const rng = mulberry32(7);
    while (words.length < 24 && keys.length) words.push(Array.from({ length: 2 + Math.floor(rng() * 3) }, () => keys[Math.floor(rng() * keys.length)]).join(''));
  }
  return { subject: 'typing', words: [...new Set(words)] };
}

// ---------- who you meet ----------
function roll(rng: Rng, odds: Partial<Record<Rarity, number>>): Rarity {
  const total = RARITIES.reduce((a, r) => a + (odds[r] ?? 0), 0);
  let x = rng() * total;
  for (const r of RARITIES) { x -= odds[r] ?? 0; if (x < 0) return r; }
  return 'common';
}
/** A Glimmer of a rarity, more likely one you don't have yet, and usually one that lives on this island
 *  (so each island has creatures of its own). */
function species(rng: Rng, a: Adventure, r: Rarity, notChampions = true, island?: IslandId): GlimmerId {
  const all = glimmersOf(r).filter(g => !notChampions || !g.champion || r !== 'legendary');
  const any = all.length ? all : glimmersOf(r);
  const home = island ? any.filter(g => g.home === island || ISLAND[island].natives?.includes(g.id)) : [];
  const list = home.length && rng() < 0.7 ? home : any;
  const newOnes = list.filter(g => !owns(a, g.id));
  const from = newOnes.length && rng() < 0.65 ? newOnes : list;
  return from[Math.floor(rng() * from.length)].id;
}
/** The Grumble at a map stop: a Champion, or a Glimmer rolled by the island's odds. (How hard it hits
 *  back is the battle's to say: hitFor in battle.ts.) */
export function foeFor(p: Profile, node: MapNode, pool: Pool, seed: number): MapFoe {
  const a = advOf(p), isl = ISLAND[node.island], rng = mulberry32(seed);
  const islandN = isl.tier, weather = isl.mischief ? { mischief: isl.mischief } : {};
  if (node.kind === 'champion') {
    const g = GLIMMER[isl.champion];
    const max = grumpFor(pool, true);
    // the third island's Champion has grown up: it comes evolved, glowing, for a bigger finale
    return { glimmer: g.id, rarity: g.rarity, champion: true, element: g.element, grump: max, max, evolved: islandN >= 2, ...weather };
  }
  const r = roll(rng, isl.odds);
  // the very first battle is always Puddle Pup (the one in the story)
  const id = !a.battles && node.id === 'meadow-0' && !owns(a, 'puddlepup') ? 'puddlepup' : r === 'legendary' ? 'lanternfox' : species(rng, a, r, true, isl.id);
  const g = GLIMMER[id];
  const max = grumpFor(pool, false);
  return { glimmer: id, rarity: g.rarity, champion: false, element: g.element, grump: max, max, ...weather };
}

// ---------- eggs ----------
function newEgg(rng: Rng, a: Adventure, rarity?: Rarity): Egg {
  a.eggsMade++;
  let r = rarity ?? roll(rng, { common: 50, uncommon: 28, rare: 14, epic: 6, legendary: 1.6, mythic: 0.4 });
  // every tenth egg is at least Rare
  if (!rarity && a.eggsMade % 10 === 0 && rarityRank(r) < rarityRank('rare')) r = 'rare';
  return { id: `egg${Date.now().toString(36)}${Math.floor(rng() * 1e6).toString(36)}`, rarity: r, need: RARITY[r].hatch, have: 0, got: Date.now() };
}
export const EGG_ODDS = 'Common 50% · Uncommon 28% · Rare 14% · Epic 6% · Legendary 1.6% · Mythic 0.4%. Every 10th egg is Rare or better.';
/** A new egg (rolled, or of a rarity) put in a free warm slot or the nest: a find on the trails. */
export function giveEgg(a: Adventure, rng: Rng, rarity?: Rarity): { egg: Egg; where: 'incubator' | 'nest' | 'full' } {
  const egg = newEgg(rng, a, rarity);
  return { egg, where: store(a, egg) };
}
/** Put an egg in a free warm slot, or the nest. */
function store(a: Adventure, e: Egg): 'incubator' | 'nest' | 'full' {
  const i = a.incubator.findIndex(x => !x);
  if (i >= 0) { a.incubator[i] = e; return 'incubator'; }
  if (a.nest.length < 9) { a.nest.push(e); return 'nest'; }
  return 'full';
}
/** Right answers in practice warm every egg in the incubator. Returns the eggs that just became ready. */
export function warmEggs(p: Profile, n: number): Rarity[] {
  const a = advOf(p), ready: Rarity[] = [];
  if (n <= 0) return ready;
  for (const e of a.incubator) if (e && e.have < e.need) { e.have = Math.min(e.need, e.have + n); if (e.have >= e.need) ready.push(e.rarity); }
  return ready;
}
/** A practice session finished (typing lesson, math trip, playground game): it counts for the practice
 *  stops, and its right answers warm the eggs. (A Learn lesson only warms the eggs: a minute's lesson
 *  isn't a practice session, so it doesn't finish a practice stop on the map.) */
export function notePractice(p: Profile, rightAnswers: number, session = true): Rarity[] {
  const a = advOf(p);
  if (session) a.practiceSessions++;
  return warmEggs(p, Math.round(rightAnswers));
}
/** What a treasure found at the end of practice is worth in shells (step 0 to 9; -1: none). */
export const treasureWorth = (step: number) => (step >= 0 ? 2 * (step + 1) : 0);
/** Shells a practice session earns, for the shop: something for finishing, more for each star, medal and
 *  new sticker, and the treasure the score found (the better the treasure, the more it's worth). */
export function practiceShells(o: { stars: number; medals: number; stickers: number; treasure?: number }) {
  return 4 + o.stars * 3 + o.medals * 2 + o.stickers * 3 + treasureWorth(o.treasure ?? -1);
}
export function earnShells(p: Profile, n: number) { if (n > 0) advOf(p).shells += n; return n; }
export type Hatch = { id: GlimmerId; rarity: Rarity; isNew: boolean; level: number; ups: number };
/** Hatch a ready egg: a Glimmer of its rarity (a new one if possible). The next nest egg moves in. */
export function hatch(p: Profile, slot: number, seed = Date.now()): Hatch | null {
  const a = advOf(p), e = a.incubator[slot];
  if (!e || e.have < e.need) return null;
  const rng = mulberry32(seed);
  const newOnes = glimmersOf(e.rarity).filter(g => !owns(a, g.id));
  const id = (newOnes.length ? newOnes : glimmersOf(e.rarity))[Math.floor(rng() * (newOnes.length || glimmersOf(e.rarity).length))].id;
  const out = meet(a, id);
  a.incubator[slot] = a.nest.shift() ?? null;
  return { id, rarity: e.rarity, ...out };
}
/** A Glimmer joins (or, if you have it, it brings stardust: XP for the one you have). */
export function meet(a: Adventure, id: GlimmerId): { isNew: boolean; level: number; ups: number } {
  const o = a.glimmers[id];
  if (!o) {
    a.glimmers[id] = { level: 1, xp: 0, got: Date.now() };
    a.fresh = [...new Set([...a.fresh, id])];
    // the first two fill the team
    const empty = a.team.findIndex(t => !t);
    if (empty >= 0 && !a.team.includes(id)) a.team[empty] = id;
    return { isNew: true, level: 1, ups: 0 };
  }
  const ups = giveXp(o, RARITY[GLIMMER[id].rarity].dust);
  return { isNew: false, level: o.level, ups };
}

// ---------- the shop ----------
export type ShopItem = { id: string; name: string; price: number; text: string; egg?: Rarity };
export const SHOP: ShopItem[] = [
  { id: 'egg-common', name: 'Common egg', price: 60, egg: 'common', text: `Hatches after ${RARITY.common.hatch} right answers in practice.` },
  { id: 'egg-uncommon', name: 'Uncommon egg', price: 130, egg: 'uncommon', text: `Hatches after ${RARITY.uncommon.hatch} right answers in practice.` },
  { id: 'egg-rare', name: 'Rare egg', price: 280, egg: 'rare', text: `Hatches after ${RARITY.rare.hatch} right answers in practice.` },
  { id: 'treat', name: 'Glimmer treat', price: 40, text: 'A tasty snack: one level for the first Glimmer on your team.' },
];
export function buy(p: Profile, id: string, target?: GlimmerId): { ok: boolean; why?: string; where?: string } {
  const a = advOf(p), item = SHOP.find(s => s.id === id);
  if (!item) return { ok: false, why: 'Not in the shop.' };
  if (a.shells < item.price) return { ok: false, why: `You need ${item.price - a.shells} more shells.` };
  if (item.egg) {
    const where = store(a, newEgg(mulberry32(Date.now() % 1e9), a, item.egg));
    if (where === 'full') return { ok: false, why: 'Your nest is full: hatch some eggs first.' };
    a.shells -= item.price; a.eggsMade--; // bought eggs don't count toward the free Rare
    return { ok: true, where };
  }
  const o = target && a.glimmers[target];
  if (!o) return { ok: false, why: 'Pick a Glimmer to give the treat to.' };
  if (o.level >= MAX_LEVEL) return { ok: false, why: 'That Glimmer is at the top level already.' };
  a.shells -= item.price;
  o.xp = 0; o.level++;
  return { ok: true };
}

// ---------- what a battle earns ----------
/** Friendship from a battle: about what the same minutes of practice earn (a win is ~3 minutes; a lesson
 *  of ~3.5 minutes earns about 140), so a kid who mostly battles still sees outfits come. Practice still
 *  earns the stars, medals, shells and eggs. */
export const BATTLE_FRIENDSHIP = { win: 80, perfect: 20, champion: 120, tried: 25 };
export type BattleRun = {
  node: string; subject: Subject; won: boolean; perfect: boolean; foe: MapFoe; ms: number;
  answers: number; right: number; answered: { f: Fact; ok: boolean; thinkMs: number }[];
  /** skill questions answered (fractions...), for the skill memory and the ability */
  skillAnswers?: { key: string; ok: boolean; thinkMs: number; rung?: number }[];
  team: GlimmerId[]; crystal: boolean; treasureNose: boolean; at: number; seed: number;
};
export type BattleOutcome = {
  profile: Profile;
  /** the Glimmer you cheered up, and whether a Perfect Cheer made it rarer */
  met: { id: GlimmerId; rarity: Rarity; isNew: boolean; level: number; ups: number; shimmered: Rarity | null } | null;
  shells: number; egg: Egg | null; eggWhere: 'incubator' | 'nest' | 'full' | null;
  xp: XpInfo; rewards: Reward[];
  /** stickers this game earned (friendship ones, mostly) */
  stickers: StickerDef[];
  teamUps: { id: GlimmerId; level: number }[];
  firstClear: boolean; islandDone: IslandId | null;
  /** a Champion's gear prize, for the buddy who beat it */
  gear?: GearItem | null;
};

export function applyBattle(p: Profile, r: BattleRun): BattleOutcome {
  const a = advOf(p), rng = mulberry32(r.seed ^ 0x5bd1e995);
  const node = NODE[r.node], isl = ISLAND[node.island], islandN = isl.tier;
  const day = today(a, r.at);
  day.ms += r.ms; day.answers += r.answers; day.right += r.right;
  a.battles++;
  // how you play, for your Rival Ghost
  noteStats((a.ghost ??= newStats()), { answers: r.answers, right: r.right, thinkMs: r.answered.length ? r.answered.reduce((t, x) => t + x.thinkMs, 0) * (r.answers / r.answered.length) : r.ms * 0.55 });
  // the answers count for the fact memory, as in practice
  if (r.subject === 'math' && r.answered.length) {
    const m = (p.math = mathOf(p)), dk = dayKey(r.at);
    for (const x of r.answered) { const id = factId(x.f); m.facts[id] = updateFact(m.facts[id], { ok: x.ok, thinkMs: x.thinkMs, day: dk, at: r.at, fastMs: m.fastMs }); seedPartner(m.facts, x.f); }
    // and move how hard the questions are (a little: a battle is noisier than a trip)
    noteAbility(m, factAnswers(r.answered, r.at, m.fastMs), 'game', !!p.settings.grown);
  }
  if (r.subject === 'math' && r.skillAnswers?.length) noteSkillAnswers((p.math = mathOf(p)), r.skillAnswers, r.at);
  // your buddy's friendship, paced like practice minute for minute (BATTLE_FRIENDSHIP), and any
  // stickers it brings (the same as after practice: engine/settle.ts)
  const F = BATTLE_FRIENDSHIP;
  const { xp, rewards } = befriend(p, r.won ? F.win + (r.perfect ? F.perfect : 0) + (node.kind === 'champion' ? F.champion : 0) : F.tried);
  const stickers = checkStickers(p, r.at);
  const out: BattleOutcome = { profile: p, met: null, shells: 0, egg: null, eggWhere: null, xp, rewards, stickers, teamUps: [], firstClear: false, islandDone: null };
  // the team learns from every battle
  for (const id of r.team) { const o = a.glimmers[id]; if (o) { const ups = giveXp(o, r.won ? 12 + (r.perfect ? 6 : 0) : 4); if (ups) out.teamUps.push({ id, level: o.level }); } }
  // a digger on the team (Geode Mole) finds shells after a win; grown up, after a loss too
  const digger = r.team.map(id => ({ id, o: a.glimmers[id] })).find(x => x.o && GLIMMER[x.id].power.kind === 'dig');
  const dug = digger ? powerNum(powerBase(digger.id, 4), digger.o!.level + (digger.o!.evolved ? EVOLVE_BOOST : 0)) : 0;
  if (!r.won) { const s = 3 + (digger?.o?.evolved ? dug : 0); a.shells += s; out.shells = s; return out; }
  a.wins++; if (r.perfect) a.perfects++;
  out.firstClear = !cleared(a, r.node);
  a.nodes[r.node] = (a.nodes[r.node] ?? 0) + 1;
  if (out.firstClear && node.kind === 'champion') out.islandDone = isl.id;
  // a Champion gives its piece of gear to the buddy who beat it
  if (node.kind === 'champion') out.gear = championPrize(a, p.buddy, isl.id);
  const id = r.foe.glimmer, rarity = r.foe.rarity, shimmered: Rarity | null = null;
  out.met = { id, rarity, shimmered, ...meet(a, id) };
  // an evolved Champion stays grown up when it joins you
  if (r.foe.evolved && a.glimmers[id]) a.glimmers[id]!.evolved = true;
  // shells
  let shells = 12 + islandN * 4 + RARITY[rarity].shells + (r.perfect ? 10 : 0) + (node.kind === 'champion' ? 50 : 0) + (r.treasureNose ? 6 : 0) + dug;
  if (r.perfect && r.crystal) shells += 10 + RARITY[rarity].shells;
  a.shells += shells; out.shells = shells;
  // an egg: always after a Perfect Cheer or a Champion (Rare or better from a Champion), sometimes otherwise
  if (node.kind === 'champion' || r.perfect || rng() < 0.3) {
    const egg = newEgg(rng, a, node.kind === 'champion' ? (rng() < 0.3 ? 'epic' : 'rare') : undefined);
    out.eggWhere = store(a, egg);
    if (out.eggWhere === 'full') { a.shells += 15; out.shells += 15; } else out.egg = egg;
  }
  return out;
}

/** Glimmers on the team that are owned, with their levels. */
export function teamOf(a: Adventure) { return a.team.filter((t): t is GlimmerId => !!t && owns(a, t)).map(id => ({ id, level: a.glimmers[id]!.level, evolved: !!a.glimmers[id]!.evolved })); }
export { GLIMMERS };
