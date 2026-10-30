// The 100-Glimmer ladder: how every Glimmer is met, so a child playing 45 minutes a day has something to
// go after for three years and more. The first 30 come from random rolls (battles and eggs) and a child
// meets most of them within weeks; the other 70 come from goals a child can see and plan for, each with
// its progress counted from the save ("Comes to players who play 100 days: 37 so far"). When a goal is
// met a special egg arrives with a moment (LadderMoment.svelte), ready to hatch into exactly that Glimmer
// through the usual hatch (state.ts hatch). Random rolls never give a ladder Glimmer.
//
// THE SHAPE every Glimmer uses (GlimmerDef in glimmers.ts; the ladder's own are in glimmers2.ts):
//   source?: 'roll' | 'native' | 'milestone' | 'collection' | 'season' | 'secret' | 'apex'
//            (absent means 'roll': the first 30)
//   world?:  a native's math world, a WorldId ('falls', 'caves', 'market', 'peaks', 'clockwork'...)
//   champion?: the island id whose Champion it is (a world's own Champion: native, world and champion)
//   pending?: true while its 3D model isn't made: the Book shows it "On its way" and it can't be earned;
//            take it off when public/models/glimmers/<id>.glb ships, and a child who already met the goal
//            gets its egg right away (met-while-pending goals are remembered in a.ladder.waiting)
// A new math world adds its 3 natives and its Champion as GlimmerDefs with source 'native', its `world`,
// `champion` on the Champion and `pending: true`, e.g.
//   { id: 'prismgoat', name: 'Prism Goat', rarity: 'rare', element: 'stone', source: 'native', world: 'peaks',
//     pending: true, quirk: '...', power: { kind: 'shell', name: '...', text: () => '...' } }
// and its grown-up form in EVOLVED. Nothing else: the goals come from the order (by rarity) of a world's
// natives: win 10, 40 and 120 battles in the world; the Champion comes from cheering it up. Until a world's
// four are in, the Book keeps their places as "On its way" (WORLD_SLOTS below), so it always shows 100.
//
// The goals (35 world natives, 16 milestones, 5 collections, 6 seasons, 4 secrets, 4 legends):
//   milestones  right answers ever 1,000 / 5,000 / 20,000 / 50,000 / 100,000; days played 30 / 100 / 200 /
//               365 / 730 (a day is 10 minutes of anything; no streaks); typing speed 20 / 35 / 50 words a
//               minute; adding and taking away strong; times and sharing strong; every kind of math strong
//               (strong: the adaptive ability, math/skills/ability.ts, at 3.5 or more on enough answers)
//   collections meet 25 / 50 / 75 / 90 Glimmers; grow up 10
//   seasons     autumn, winter, spring, summer, New Year, the player's Keypals birthday: play on 5 days
//               inside the window (ladderSave.ts windowsOf); the egg comes back every year (stardust)
//   secrets     the bay's hidden spot, the garden's Seed Library, the secret word, a Bonus Round all right
//               and quick
//   legends     every island's and world's Champion grown up (12 once the six coming worlds are in);
//               100,000 answers and 365 days; 20 Glimmers raised to level 20, the top; all 99 others
import { dayKey, type Profile } from '../engine/profile';
import { mathOf } from '../math/progress';
import { AREA, AREAS, skillsOf } from '../math/skills/registry';
import { STRAND_SKILL, decayed } from '../math/skills/ability';
import { ALL_GLIMMERS, GLIMMER, GLIMMER_TOTAL, RARITY, rarityRank, type GlimmerDef, type GlimmerId, type GlimmerSource } from './glimmers';
import { ISLAND, ISLANDS, MAX_LEVEL, NODES, advView, advOf, cleared, worldOpen, type Adventure, type Egg, type WorldId } from './state';
import { WORLD_PIN, WORLD_PINS } from './worlds';
import { DAY_MIN, SEASON_DAYS, dayDue, ladderOf, ladderView, nextOpening, noteDay, windowNow, windowsOf, type LadderSave, type SeasonId, type SecretId } from './ladderSave';
import type { AreaId } from '../math/skills/types';

// ---------- what each source is called ----------
export const SOURCES: Record<GlimmerSource, { group: string; egg: string; blurb: string }> = {
  roll: { group: 'Everywhere', egg: '', blurb: 'Meet them grumpy in battles, or hatch them from eggs.' },
  native: { group: 'Worlds', egg: 'World egg', blurb: 'Each math world has its own. Win battles there to bring them home.' },
  milestone: { group: 'Milestones', egg: 'Milestone egg', blurb: 'For right answers, days played, fast typing and strong math. A day counts when you play 10 minutes.' },
  collection: { group: 'Collections', egg: 'Collection egg', blurb: 'For meeting lots of Glimmers and helping them grow up.' },
  season: { group: 'Seasons', egg: 'Season egg', blurb: 'Play on 5 days in a season and its egg comes. They come back every year.' },
  secret: { group: 'Secrets', egg: 'Secret egg', blurb: 'Hidden somewhere in Keypals. Keep your eyes open.' },
  apex: { group: 'Legends', egg: 'Legend egg', blurb: 'The four hardest of all. Most players take years.' },
};
export const sourceOf = (id: GlimmerId): GlimmerSource => GLIMMER[id]?.source ?? 'roll';

// ---------- the goal numbers ----------
export const RIGHT_STEPS: [GlimmerId, number][] = [['fireflyfawn', 1000], ['lighthousepuffin', 5000], ['meteorram', 20000], ['sunbursttiger', 50000], ['galaxynarwhal', 100000]];
export const DAY_STEPS: [GlimmerId, number][] = [['sunriserobin', 30], ['blossomhog', 100], ['snowpineelk', 200], ['seasonstanuki', 365], ['eldertreeturtle', 730]];
export const WPM_STEPS: [GlimmerId, number][] = [['keycricket', 20], ['zipbird', 35], ['rocketroadrunner', 50]];
export const MEET_STEPS: [GlimmerId, number][] = [['gemmagpie', 25], ['treasurecrab', 50], ['nestdragon', 75], ['prismpeacock', 90]];
export const SEASON_OF: Partial<Record<GlimmerId, SeasonId>> = { maplepanda: 'autumn', snowglobepenguin: 'winter', petalduckling: 'spring', watermelonturtle: 'summer', fireworksquirrel: 'newyear', cupcakebear: 'birthday' };
export const SECRET_OF: Partial<Record<GlimmerId, SecretId>> = { mistseahorse: 'trail', bookworm: 'hut', whisperparrot: 'word', goldgecko: 'bonus' };
/** Battles won in a native's world for its 1st, 2nd and 3rd native (by rarity). */
export const NATIVE_WINS = [10, 40, 120];
/** Strong: the ability estimate at this rung or more (the grown-ups' report says "strong" there too),
 *  resting on at least this many answers (fact strands) or this many (each skill of an area). */
export const STRONG_T = 3.5, STRONG_N = 30, STRONG_SKILL_N = 8;
const GROW_SOME = 10, BIG_RIGHT = 100000, BIG_DAYS = 365;
/** The Rainbow Unicorn: this many Glimmers raised all the way to the top level. */
export const TOP_RAISED = 20;

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const SEASON_WORDS: Record<SeasonId, { name: string; when: string }> = {
  autumn: { name: 'autumn', when: 'September to November' }, winter: { name: 'winter', when: 'December to February' },
  spring: { name: 'spring', when: 'March to May' }, summer: { name: 'summer', when: 'June to August' },
  newyear: { name: 'New Year', when: '26 December to 10 January' }, birthday: { name: 'your Keypals birthday', when: 'the two weeks from the day you joined' },
};
const SECRET_WHISPER: Record<SecretId, string> = {
  trail: 'Something sparkles behind a waterfall, far across Cloudwhale Bay.',
  hut: 'Walk up to a little round door in your garden.',
  word: 'Type a secret word on a map. It\'s the name of this game.',
  bonus: 'In a treasure room, get every one right, and quick.',
};

// ---------- what the goals read ----------
/** Everything the goals read, worked out once per look. */
export type Ctx = {
  p: Profile; a: Adventure; L: LadderSave; now: number; dk: string;
  met: number; grown: number; wpm: number;
  /** each fact strand and live area: strong now? */
  strong: Record<string, boolean>;
};
const ownedIds = (a: Adventure) => (Object.keys(a.glimmers) as GlimmerId[]).filter(id => !!GLIMMER[id] && !!a.glimmers[id]);
/** Strong on a skill (fact strands, or one skill of an area). */
function skillStrong(m: ReturnType<typeof mathOf>, skill: string, now: number, n: number): boolean {
  const ab = m.ability?.[skill];
  return !!ab && ab.n >= n && decayed(ab, now).t >= STRONG_T;
}
/** Every live kind of math: strong? (a fact strand on its own; an area once 3 in 4 of its skills are) */
export function strongAreas(p: Profile, now = Date.now()): Record<string, boolean> {
  const m = mathOf(p), out: Record<string, boolean> = {};
  for (const ar of AREAS.filter(x => x.live)) {
    if (ar.op) { out[ar.id] = skillStrong(m, STRAND_SKILL[ar.op], now, STRONG_N); continue; }
    const ss = skillsOf(ar.id);
    out[ar.id] = ss.length > 0 && ss.filter(s => skillStrong(m, s.id, now, STRONG_SKILL_N)).length >= Math.ceil(ss.length * 0.75);
  }
  return out;
}
export function ctxOf(p: Profile, now = Date.now(), L?: LadderSave): Ctx {
  const a = advView(p), owned = ownedIds(a);
  const wpm = Math.max(0, ...Object.values(p.lessons ?? {}).map(r => r?.bestWpm ?? 0));
  return { p, a, L: L ?? viewWithToday(p, a, now), now, dk: dayKey(now), met: owned.length, grown: owned.filter(id => a.glimmers[id]!.evolved).length, wpm: Math.floor(wpm), strong: strongAreas(p, now) };
}
/** The counters as they'll be once today is counted (read only). */
function viewWithToday(p: Profile, a: Adventure, now: number): LadderSave {
  const L = ladderView(p, a);
  if (!dayDue(p, a, now)) return L;
  const dk = dayKey(now), seasons = { ...L.seasons };
  for (const w of windowsOf(dk, p.createdAt)) seasons[w] = (seasons[w] ?? 0) + 1;
  return { ...L, days: L.days + 1, lastDay: dk, seasons };
}

// ---------- the worlds ----------
const worldName = (w: string) => WORLD_PIN[w]?.name ?? w;
/** A world's area (its math). */
export const worldArea = (w: string): AreaId | undefined => WORLD_PIN[w]?.area ?? ISLANDS.find(i => i.world === w && i.area)?.area;
/** Battles won in a world (every stop's clears added up). */
export function worldWins(a: Adventure, w: string): number {
  return NODES.filter(n => ISLAND[n.island].world === w).reduce((t, n) => t + (a.nodes[n.id] ?? 0), 0);
}
/** A world's natives (not its Champion), in the order their goals come: by rarity. */
export const nativesOf = (w: string) => ALL_GLIMMERS.filter(g => g.source === 'native' && g.world === w && !g.champion).sort((x, y) => rarityRank(x.rarity) - rarityRank(y.rarity));
/** The six math worlds still to come and their areas: their four Glimmers each keep a place in the Book
 *  until they're in (a world's real entries take the places over as they arrive). */
export const COMING_WORLDS: { area: AreaId; id: string; name: string }[] = (['shapes', 'measure', 'ratios', 'integers', 'algebra', 'data'] as AreaId[]).map(area => {
  const pin = WORLD_PINS.find(w => w.area === area);
  return { area, id: pin?.id ?? `world-${area}`, name: pin?.name ?? (area === 'ratios' ? 'Juice Jungle' : AREA[area]?.name ?? area) };
});
export const PER_WORLD = 4;
/** Places still kept for a coming world (4, less its Glimmers already in). */
export function worldSlots(area: AreaId): number {
  return Math.max(0, PER_WORLD - ALL_GLIMMERS.filter(g => g.source === 'native' && g.world && worldArea(g.world) === area).length);
}

// ---------- the goals ----------
export type Progress = { have: number; need: number };
export type Goal = {
  id: GlimmerId;
  /** have of need, from the save */
  progress: (x: Ctx) => Progress;
  /** the Book's line: plain words (a secret's is its whisper) */
  hint: (x: Ctx) => string;
  /** what the egg's moment says was done */
  done: (x: Ctx) => string;
  /** a few words for a small card: "37 of 100 days" */
  short: (x: Ctx) => string;
  season?: SeasonId; secret?: SecretId;
};
const step = (id: GlimmerId, need: number, have: (x: Ctx) => number, hint: (need: number, have: number) => string, done: (need: number) => string, unit: string): Goal =>
  ({ id, progress: x => ({ have: have(x), need }), hint: x => hint(need, have(x)), done: () => done(need), short: x => `${fmt(Math.min(have(x), need))} of ${fmt(need)} ${unit}` });

function nativeGoal(g: GlimmerDef): Goal {
  const w = g.world!, name = worldName(w);
  if (g.champion) {
    const node = NODES.find(n => n.island === g.champion && n.kind === 'champion');
    return {
      id: g.id, progress: x => ({ have: node && cleared(x.a, node.id) ? 1 : 0, need: 1 }),
      hint: x => (worldOpen(x.p, w as WorldId) ? `The Champion of ${name}. Cheer it up at the end of ${name}.` : `The Champion of ${name}. ${name} opens when you start ${AREA[worldArea(w)!]?.name.toLowerCase() ?? 'its math'}.`),
      done: () => `You cheered up the Champion of ${name}!`,
      short: x => (worldOpen(x.p, w as WorldId) ? `Champion of ${name}` : `Opens with ${AREA[worldArea(w)!]?.name.toLowerCase() ?? 'its math'}`),
    };
  }
  const i = Math.max(0, nativesOf(w).findIndex(n => n.id === g.id)), need = NATIVE_WINS[i] ?? 120 + 40 * (i - 2);
  return {
    id: g.id, progress: x => ({ have: worldWins(x.a, w), need }),
    hint: x => (worldOpen(x.p, w as WorldId) || worldWins(x.a, w) ? `Lives in ${name}. Win ${need} battles there: ${worldWins(x.a, w)} so far.` : `Lives in ${name}, which opens when you start ${AREA[worldArea(w)!]?.name.toLowerCase() ?? 'its math'}.`),
    done: () => `You won ${need} battles in ${name}!`,
    short: x => (worldOpen(x.p, w as WorldId) || worldWins(x.a, w) ? `${Math.min(need, worldWins(x.a, w))} of ${need} wins here` : `Opens with ${AREA[worldArea(w)!]?.name.toLowerCase() ?? 'its math'}`),
  };
}
function seasonGoal(id: GlimmerId, s: SeasonId): Goal {
  const W = SEASON_WORDS[s];
  const win = (x: Ctx) => windowNow(s, x.dk, x.p.createdAt);
  return {
    id, season: s,
    progress: x => { const w = win(x); return { have: w ? Math.min(SEASON_DAYS, x.L.seasons[w] ?? 0) : 0, need: SEASON_DAYS }; },
    hint: x => {
      const w = win(x);
      if (w) return `Play on ${SEASON_DAYS} days ${s === 'birthday' ? 'in your Keypals birthday weeks' : s === 'newyear' ? 'around New Year' : `this ${W.name}`}: ${Math.min(SEASON_DAYS, x.L.seasons[w] ?? 0)} so far.`;
      const next = nextOpening(s, x.dk, x.p.createdAt);
      const when = next ? new Date(`${next}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '';
      return s === 'birthday' ? `Comes on your Keypals birthday${when ? `, ${when}` : ''}. Play on ${SEASON_DAYS} days in the two weeks after.` : `Only in ${W.name} (${W.when}). Play on ${SEASON_DAYS} days then.`;
    },
    done: () => (s === 'birthday' ? 'Happy Keypals birthday! You played 5 days in your birthday weeks.' : s === 'newyear' ? 'Happy New Year! You played 5 days around New Year.' : `You played 5 days this ${W.name}!`),
    short: x => { const w = win(x); return w ? `${Math.min(SEASON_DAYS, x.L.seasons[w] ?? 0)} of ${SEASON_DAYS} days` : s === 'birthday' ? 'On your birthday' : s === 'newyear' ? 'Only at New Year' : `Only in ${W.name}`; },
  };
}
const secretGoal = (id: GlimmerId, s: SecretId): Goal => ({
  id, secret: s, progress: x => ({ have: x.L.secrets.includes(s) ? 1 : 0, need: 1 }), hint: () => SECRET_WHISPER[s], done: () => 'You found a secret!',
  short: x => (x.L.secrets.includes(s) ? 'Found!' : 'A secret'),
});
/** Every island's Champion (a world's own once it has one, on its way or not) and one for each math world
 *  still to come: the crown needs them all grown up. */
export function championsAll(): { ids: GlimmerId[]; coming: number } {
  const ids = [...new Set(ISLANDS.map(i => ALL_GLIMMERS.find(g => g.champion === i.id)?.id ?? i.champion))];
  const coming = COMING_WORLDS.filter(w => !ALL_GLIMMERS.some(g => g.champion && g.world && worldArea(g.world) === w.area)).length;
  return { ids, coming };
}
const grownChampions = (x: Ctx) => championsAll().ids.filter(id => x.a.glimmers[id]?.evolved).length;
const topRaised = (x: Ctx) => ownedIds(x.a).filter(id => x.a.glimmers[id]!.level >= MAX_LEVEL).length;

const MATH_STRONG = (keys: string[]) => (x: Ctx) => keys.filter(k => x.strong[k]).length;
export const GOALS: Goal[] = [
  ...RIGHT_STEPS.map(([id, n]) => step(id, n, x => x.L.right, (need, have) => `Comes to players who give ${fmt(need)} right answers: ${fmt(have)} so far.`, need => `${fmt(need)} right answers!`, 'answers')),
  ...DAY_STEPS.map(([id, n]) => step(id, n, x => x.L.days, (need, have) => `Comes to players who play ${need} days: ${have} so far.`, need => `You played ${need} days!`, 'days')),
  ...WPM_STEPS.map(([id, n]) => step(id, n, x => x.wpm, (need, have) => `Comes to typists who reach ${need} words a minute. Your best: ${have}.`, need => `You typed ${need} words a minute!`, 'words a minute')),
  step('balancepanda', 2, MATH_STRONG(['plus', 'minus']), (_, have) => `Comes when adding and taking away are both strong: ${have} of 2 so far.`, () => 'Adding and taking away are strong!', 'strong'),
  step('hydrahatchling', 2, MATH_STRONG(['times', 'share']), (_, have) => `Comes when times tables and sharing are both strong: ${have} of 2 so far.`, () => 'Times tables and sharing are strong!', 'strong'),
  { id: 'starsageowl', progress: x => ({ have: Object.values(x.strong).filter(Boolean).length, need: Object.keys(x.strong).length }),
    hint: x => `Comes when every kind of math is strong: ${Object.values(x.strong).filter(Boolean).length} of ${Object.keys(x.strong).length} so far.`, done: () => 'Every kind of math is strong!',
    short: x => `${Object.values(x.strong).filter(Boolean).length} of ${Object.keys(x.strong).length} strong` },
  ...MEET_STEPS.map(([id, n]) => step(id, n, x => x.met, (need, have) => `Comes when you have met ${need} Glimmers: ${have} so far.`, need => `You have met ${need} Glimmers!`, 'met')),
  step('acornsprite', GROW_SOME, x => x.grown, (need, have) => `Comes when ${need} of your Glimmers have grown up: ${have} so far.`, need => `${need} of your Glimmers have grown up!`, 'grown up'),
  ...(Object.entries(SEASON_OF) as [GlimmerId, SeasonId][]).map(([id, s]) => seasonGoal(id, s)),
  ...(Object.entries(SECRET_OF) as [GlimmerId, SecretId][]).map(([id, s]) => secretGoal(id, s)),
  { id: 'crownedlion',
    progress: x => { const c = championsAll(); return { have: grownChampions(x), need: c.ids.length + c.coming }; },
    hint: x => { const c = championsAll(); return `Comes when the Champion of every island and world has grown up: ${grownChampions(x)} of ${c.ids.length + c.coming} so far.`; },
    done: () => 'Every Champion has grown up!',
    short: x => { const c = championsAll(); return `${grownChampions(x)} of ${c.ids.length + c.coming} Champions`; } },
  { id: 'moonrabbit',
    progress: x => ({ have: Math.floor(50 * Math.min(1, x.L.right / BIG_RIGHT)) + Math.floor(50 * Math.min(1, x.L.days / BIG_DAYS)), need: 100 }),
    hint: x => `Comes to players with ${fmt(BIG_RIGHT)} right answers and ${BIG_DAYS} days played: ${fmt(x.L.right)} answers and ${x.L.days} days so far.`,
    done: () => `${fmt(BIG_RIGHT)} right answers and ${BIG_DAYS} days!`,
    short: x => `${fmt(Math.min(x.L.right, BIG_RIGHT))} answers, ${Math.min(x.L.days, BIG_DAYS)} days` },
  step('rainbowunicorn', TOP_RAISED, topRaised, (need, have) => `Comes when ${need} of your Glimmers reach level ${MAX_LEVEL}, the top: ${have} so far.`, need => `${need} of your Glimmers reached the top level!`, 'at the top'),
  { id: 'dragonkoi', progress: x => ({ have: ownedIds(x.a).filter(id => id !== 'dragonkoi').length, need: GLIMMER_TOTAL - 1 }),
    hint: x => `Comes to the player who has met all ${GLIMMER_TOTAL - 1} others: ${ownedIds(x.a).filter(id => id !== 'dragonkoi').length} so far.`, done: () => `You have met all ${GLIMMER_TOTAL - 1} other Glimmers!`,
    short: x => `${ownedIds(x.a).filter(id => id !== 'dragonkoi').length} of ${GLIMMER_TOTAL - 1} met` },
];
/** Every ladder Glimmer's goal (natives' made from their world). */
export function goalOf(id: GlimmerId): Goal | null {
  const g = GLIMMER[id];
  if (!g || (g.source ?? 'roll') === 'roll') return null;
  if (g.source === 'native') return nativeGoal(g);
  return GOALS.find(x => x.id === id) ?? null;
}
/** Every ladder Glimmer's id (worked out each time: a world's Glimmers may be added later). */
export const ladderIds = () => ALL_GLIMMERS.filter(g => (g.source ?? 'roll') !== 'roll').map(g => g.id);

// ---------- where each one stands ----------
export type Standing = {
  id: GlimmerId; source: GlimmerSource;
  /** met: owned. egg: its special egg is waiting in the incubator or the nest. open: still to do. */
  state: 'met' | 'egg' | 'open';
  pending: boolean; have: number; need: number; hint: string; short: string;
  /** the goal is met (a pending one's egg comes when it ships) */
  reached: boolean;
  season?: SeasonId; secret?: SecretId;
};
/** A special egg (it hatches into its own Glimmer). */
export const isLadderEgg = (e: Egg) => !!e.glimmer;
const eggFor = (a: Adventure, id: GlimmerId) => [...a.incubator, ...a.nest].some(e => e?.glimmer === id);
/** One Glimmer in the Book. */
export function standing(id: GlimmerId, x: Ctx): Standing {
  const g = GLIMMER[id], source = g.source ?? 'roll', pending = !!g.pending;
  const owned = !!x.a.glimmers[id];
  if (source === 'roll') {
    const champ = ISLANDS.find(i => i.champion === id);
    return { id, source, state: owned ? 'met' : 'open', pending, have: owned ? 1 : 0, need: 1, reached: owned,
      hint: champ ? `The Champion of ${champ.name}. Cheer it up at the end of the island.` : `${RARITY[g.rarity].name}: meet it in battles or eggs.`,
      short: champ ? `Champion of ${champ.name}` : 'Battles and eggs' };
  }
  const goal = goalOf(id)!, pr = goal.progress(x);
  const reached = pr.have >= pr.need || (!goal.season && x.L.waiting.includes(id));
  return {
    id, source, state: owned ? 'met' : eggFor(x.a, id) ? 'egg' : 'open', pending, have: Math.min(pr.have, pr.need), need: pr.need,
    hint: goal.hint(x), short: goal.short(x), reached, season: goal.season, secret: goal.secret,
  };
}

// ---------- the eggs ----------
export type LadderNews = { id: GlimmerId; source: GlimmerSource; egg: Egg; done: string };
type Plan = { eggs: { id: GlimmerId; key: string; done: string }[]; wait: GlimmerId[] };
/** Goals met now whose egg hasn't come, and goals met while their Glimmer is on its way (read only). */
export function ladderPlan(p: Profile, now = Date.now(), x = ctxOf(p, now)): Plan {
  const out: Plan = { eggs: [], wait: [] };
  for (const id of ladderIds()) {
    const goal = goalOf(id); if (!goal) continue;
    const pr = goal.progress(x), g = GLIMMER[id];
    const win = goal.season ? windowNow(goal.season, x.dk, x.p.createdAt) : null;
    const metNow = goal.season ? !!win && pr.have >= pr.need : pr.have >= pr.need;
    const waited = x.L.waiting.includes(id);
    // a season comes once per window (again next year); anything else once, and never if you have it
    const key = goal.season ? (metNow ? win! : 'waited') : 'once';
    const given = goal.season ? x.L.given[id] === key : !!x.L.given[id] || !!x.a.glimmers[id];
    if (!(metNow || waited) || given) continue;
    if (g.pending) { if (metNow && !waited) out.wait.push(id); continue; }
    out.eggs.push({ id, key, done: goal.done(x) });
  }
  return out;
}
/** Does the save need anything written (counters to start, today to count, an egg to give, a goal to
 *  remember)? Read only: so looking costs nothing when there's nothing new. */
export function ladderNeedsWrite(p: Profile, now = Date.now()): boolean {
  const a = advView(p);
  if (!a.ladder || dayDue(p, a, now)) return true;
  const pl = ladderPlan(p, now);
  return pl.eggs.length > 0 || pl.wait.length > 0;
}
/** A special egg into a free warm slot; if all three are busy it takes the place of the least-warmed one
 *  (which waits at the front of the nest with its warmth), so it can hatch right away. */
export function placeSpecial(a: Adventure, egg: Egg) {
  const free = a.incubator.findIndex(e => !e);
  if (free >= 0) { a.incubator[free] = egg; return; }
  let k = -1;
  a.incubator.forEach((e, i) => { if (e && !e.glimmer && (k < 0 || e.have / e.need < a.incubator[k]!.have / a.incubator[k]!.need)) k = i; });
  if (k < 0) { a.nest.unshift(egg); return; }
  a.nest.unshift(a.incubator[k]!);
  a.incubator[k] = egg;
}
/** Count today, remember goals met while on their way, and give the eggs of goals met (inside
 *  game.update). The news is what the moment shows. */
export function checkLadder(p: Profile, now = Date.now()): LadderNews[] {
  const a = advOf(p), L = ladderOf(p, a);
  noteDay(p, a, now);
  const pl = ladderPlan(p, now, ctxOf(p, now, L)), news: LadderNews[] = [];
  for (const id of pl.wait) if (!L.waiting.includes(id)) L.waiting.push(id);
  pl.eggs.forEach(({ id, key, done }, i) => {
    const g = GLIMMER[id], r = g.rarity;
    const egg: Egg = { id: `egg-${id}-${now.toString(36)}${i}`, rarity: r, need: RARITY[r].hatch, have: RARITY[r].hatch, got: now, glimmer: id, kind: g.source };
    placeSpecial(a, egg);
    L.given[id] = key === 'once' || key === 'waited' ? dayKey(now) : key;
    L.waiting = L.waiting.filter(w => w !== id);
    news.push({ id, source: g.source ?? 'roll', egg, done });
  });
  return news;
}
/** The minutes that make a day, for the Book's words. */
export { DAY_MIN };

// ---------- the Book ----------
export type BookPlace = { kind: 'glimmer'; s: Standing } | { kind: 'slot'; world: string; area: AreaId; n: number };
export type BookGroup = { id: GlimmerSource; name: string; blurb: string; parts: { name: string; note?: string; places: BookPlace[] }[] };
/** All 100 places, in groups: Everywhere, Worlds (by world), Milestones, Collections, Seasons, Secrets,
 *  Legends. */
export function bookOf(p: Profile, now = Date.now()): { groups: BookGroup[]; met: number; total: number; next: Standing[] } {
  const x = ctxOf(p, now);
  const st = (id: GlimmerId): BookPlace => ({ kind: 'glimmer', s: standing(id, x) });
  const of = (src: GlimmerSource) => ALL_GLIMMERS.filter(g => (g.source ?? 'roll') === src);
  const groups: BookGroup[] = [];
  groups.push({ id: 'roll', name: SOURCES.roll.group, blurb: SOURCES.roll.blurb, parts: [{ name: '', places: [...of('roll')].sort((u, v) => rarityRank(u.rarity) - rarityRank(v.rarity)).map(g => st(g.id)) }] });
  // the worlds: the three open ones first, then the ones still to come
  const worlds = [...new Set(of('native').map(g => g.world!))];
  const opens = (w: string) => (worldOpen(p, w as WorldId) ? 'Win battles here to bring them home' : `Opens when you start ${AREA[worldArea(w)!]?.name.toLowerCase() ?? 'its math'}`);
  const parts: BookGroup['parts'] = worlds.map(w => ({ name: worldName(w), note: opens(w), places: [...nativesOf(w), ...of('native').filter(g => g.world === w && g.champion)].map(g => st(g.id)) }));
  for (const cw of COMING_WORLDS) {
    const n = worldSlots(cw.area); if (!n) continue;
    const have = parts.find(pt => pt.name === cw.name);
    const slots: BookPlace[] = Array.from({ length: n }, (_, i) => ({ kind: 'slot' as const, world: cw.name, area: cw.area, n: i }));
    if (have) have.places.push(...slots); else parts.push({ name: cw.name, note: 'Coming soon', places: slots });
  }
  groups.push({ id: 'native', name: SOURCES.native.group, blurb: SOURCES.native.blurb, parts });
  for (const src of ['milestone', 'collection', 'season', 'secret', 'apex'] as GlimmerSource[])
    groups.push({ id: src, name: SOURCES[src].group, blurb: SOURCES[src].blurb, parts: [{ name: '', places: of(src).map(g => st(g.id)) }] });
  const all = groups.flatMap(g => g.parts.flatMap(pt => pt.places));
  const standings = all.filter((pl): pl is { kind: 'glimmer'; s: Standing } => pl.kind === 'glimmer').map(pl => pl.s);
  // next up: the nearest goals not reached yet (secrets and seasons out of their window aren't "near")
  const next = standings.filter(s => s.source !== 'roll' && s.state === 'open' && !s.reached && !s.secret && s.need > 0 && s.have > 0)
    .sort((u, v) => v.have / v.need - u.have / u.need).slice(0, 3);
  return { groups, met: standings.filter(s => s.state === 'met').length, total: GLIMMER_TOTAL, next };
}
