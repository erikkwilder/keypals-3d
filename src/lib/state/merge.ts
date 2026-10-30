// Combining two copies of one player, when two computers both played before they caught up with each
// other (a tablet offline in the car, a laptop at home). Nothing earned on either is lost, and nothing
// is counted twice:
// - bests (stars, best scores, best ride, a Glimmer's level) take the higher;
// - collections (stickers, Glimmers, the wardrobe, tips seen, learned tricks) take everything from both;
// - running counts (shells, friendship, lessons played, minutes, medal counts) add what each computer
//   added since the copy they both started from (`base`, the last copy both agreed on); with no shared
//   copy, the higher of the two;
// - eggs: both computers' new eggs are kept, an egg hatched on either is gone, warmth adds up;
// - a fact's stage comes from the computer that asked it last (a slip after a bloom is real);
// - how hard a skill's questions are (its ability estimate) comes from the copy with clearly more
//   answers behind it, or else the newer one;
// - choices (settings, the team, who's wearing what, the name) come from whichever copy changed last.
// Fields this file doesn't know yet fall back to: objects merged key by key, numbers the higher, lists of
// words joined, anything else from the newer copy.
import type { Profile } from '../engine/profile';
import { levelFromXp } from '../engine/stickers';
import { mergeAbility } from '../math/skills/ability';
import { mergeIsland } from '../island/save'; // My Sky Island

/* eslint-disable @typescript-eslint/no-explicit-any */
type J = any;
const isObj = (x: unknown): x is Record<string, J> => !!x && typeof x === 'object' && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

// ---------- the building blocks ----------
/** a shared copy is known for this merge: a count it doesn't have yet started at zero */
let HAS_BASE = false;
/** a running count: what each side added since the shared copy (with no shared copy, the higher) */
export function add(m: unknown, t: unknown, b: unknown): number | undefined {
  if (!isNum(m) && !isNum(t)) return undefined;
  if (!isNum(b) && HAS_BASE) b = 0;
  if (!isNum(b)) return Math.max(isNum(m) ? m : 0, isNum(t) ? t : 0);
  const mm = isNum(m) ? m : b, tt = isNum(t) ? t : b;
  return Math.max(0, tt + (mm - b));
}
const max = (m: unknown, t: unknown) => (!isNum(m) && !isNum(t) ? undefined : Math.max(isNum(m) ? m : -Infinity, isNum(t) ? t : -Infinity));
const min = (m: unknown, t: unknown) => (!isNum(m) && !isNum(t) ? undefined : Math.min(isNum(m) ? m : Infinity, isNum(t) ? t : Infinity));
const or = (m: unknown, t: unknown) => (m === undefined && t === undefined ? undefined : !!m || !!t);
/** a list of words or numbers: everything from both (the newer side's order first) */
function union<T>(n: T[] | undefined, o: T[] | undefined): T[] | undefined {
  if (!n && !o) return undefined;
  return [...new Set([...(n ?? []), ...(o ?? [])])];
}
/** a list where taking things out counts (new things on either side kept, things removed on either side gone) */
function sets<T>(m: T[] | undefined, t: T[] | undefined, b: T[] | undefined, mineNewer: boolean): T[] | undefined {
  if (!m && !t) return undefined;
  if (!b && HAS_BASE) b = [];
  if (!b) return mineNewer ? union(m, t) : union(t, m);
  const inB = new Set(b), M = new Set(m ?? []), T = new Set(t ?? []);
  const keep = (x: T) => (inB.has(x) ? M.has(x) && T.has(x) : true);
  const all = mineNewer ? union(m, t)! : union(t, m)!;
  return all.filter(keep);
}
/** merge two records key by key */
function keyed(m: J, t: J, b: J, fn: (m: J, t: J, b: J) => J): J {
  if (!isObj(m) && !isObj(t)) return m ?? t;
  const out: Record<string, J> = {};
  for (const k of new Set([...Object.keys(m ?? {}), ...Object.keys(t ?? {})])) {
    const mv = m?.[k], tv = t?.[k];
    out[k] = mv === undefined ? tv : tv === undefined ? mv : fn(mv, tv, b?.[k]);
  }
  return out;
}
/** the newer copy's object, with keys only the older one has */
const newerObj = (n: J, o: J) => (isObj(n) || isObj(o) ? { ...(o ?? {}), ...(n ?? {}) } : n ?? o);

/** Anything not covered below: objects key by key, numbers the higher, lists of words joined, else the newer. */
export function generic(m: J, t: J, b: J, mineNewer: boolean): J {
  if (m === undefined) return t;
  if (t === undefined) return m;
  if (isObj(m) && isObj(t)) return keyed(m, t, b, (mv, tv, bv) => generic(mv, tv, bv, mineNewer));
  if (isNum(m) && isNum(t)) return Math.max(m, t);
  if (Array.isArray(m) && Array.isArray(t) && [...m, ...t].every(x => typeof x === 'string' || typeof x === 'number')) return mineNewer ? union(m, t) : union(t, m);
  return mineNewer ? m : t;
}

/** history lists: every entry from both, by time, the latest `cap` */
function timeline(m: J[] | undefined, t: J[] | undefined, key: (x: J) => string, cap: number): J[] | undefined {
  if (!m && !t) return undefined;
  const seen = new Map<string, J>();
  for (const x of [...(m ?? []), ...(t ?? [])]) if (x) seen.set(key(x), x);
  return [...seen.values()].sort((a, c) => (a.at ?? 0) - (c.at ?? 0)).slice(-cap);
}

// ---------- the player's parts ----------
function lessonRec(m: J, t: J, b: J, mineNewer: boolean): J {
  return {
    ...generic(m, t, b, mineNewer),
    stars: max(m.stars, t.stars), bestWpm: max(m.bestWpm, t.bestWpm), bestAcc: max(m.bestAcc, t.bestAcc), bestRide: max(m.bestRide, t.bestRide),
    attempts: add(m.attempts, t.attempts, b?.attempts), passes: add(m.passes, t.passes, b?.passes), finishes: add(m.finishes, t.finishes, b?.finishes),
    lastAt: max(m.lastAt, t.lastAt), bestScore: max(m.bestScore, t.bestScore), bestFpm: max(m.bestFpm, t.bestFpm),
    scoreSum: add(m.scoreSum, t.scoreSum, b?.scoreSum), platinum: or(m.platinum, t.platinum), testedOut: or(m.testedOut, t.testedOut),
  };
}
const ADD_PAL = ['xp', 'runs', 'chars', 'stars3', 'perfect', 'sharp', 'comebacks', 'naps', 'medalsTotal', 'dances'];
const MAX_PAL = ['bestStreak', 'bestWpm', 'ownKeys', 'rideBest', 'treasureBest'];
function pal(m: J, t: J, b: J, mineNewer: boolean): J {
  const n = mineNewer ? m : t, o = mineNewer ? t : m;
  const out: J = { ...generic(m, t, b, mineNewer) };
  for (const k of ADD_PAL) out[k] = add(m[k], t[k], b?.[k]);
  for (const k of MAX_PAL) out[k] = max(m[k], t[k]);
  out.level = levelFromXp(out.xp ?? 0).level;
  out.outfit = n.outfit ?? o.outfit; out.dance = n.dance ?? o.dance; out.perfectRow = n.perfectRow ?? o.perfectRow;
  out.stickers = keyed(m.stickers, t.stickers, b?.stickers, (a, c) => Math.min(a, c));
  out.medals = keyed(m.medals, t.medals, b?.medals, (a, c, bb) => add(a, c, bb));
  out.goalDays = union(n.goalDays, o.goalDays); out.regions = union(n.regions, o.regions); out.moves = union(n.moves, o.moves); out.seen = union(n.seen, o.seen);
  return out;
}
function book(m: J, t: J, b: J, mineNewer: boolean): J {
  return {
    ...generic(m, t, b, mineNewer),
    // a sticker is won once: keep the first time (and the buddy who won it then)
    stickers: keyed(m.stickers, t.stickers, b?.stickers, (a, c) => ((a?.at ?? Infinity) <= (c?.at ?? Infinity) ? a : c)),
    medals: keyed(m.medals, t.medals, b?.medals, (a, c, bb) => add(a, c, bb)),
    total: add(m.total, t.total, b?.total),
    fresh: sets(m.fresh, t.fresh, b?.fresh, mineNewer),
  };
}
function fact(m: J, t: J, b: J, mineNewer: boolean): J {
  // the stage, speeds and review dates from whichever asked it last; the counts add up
  const late = (m.last ?? 0) === (t.last ?? 0) ? (mineNewer ? m : t) : (m.last ?? 0) > (t.last ?? 0) ? m : t;
  return { ...late, seen: add(m.seen, t.seen, b?.seen), right: add(m.right, t.right, b?.right), wrong: add(m.wrong, t.wrong, b?.wrong), last: max(m.last, t.last) };
}
function math(m: J, t: J, b: J, mineNewer: boolean): J {
  const n = mineNewer ? m : t, o = mineNewer ? t : m;
  return {
    ...generic(m, t, b, mineNewer),
    home: n.home ?? o.home, calm: n.calm ?? o.calm, fastMs: n.fastMs ?? o.fastMs, strand: n.strand ?? o.strand, gardenSeen: newerObj(n.gardenSeen, o.gardenSeen),
    facts: keyed(m.facts, t.facts, b?.facts, (a, c, bb) => fact(a, c, bb, mineNewer)),
    // the skill areas' memory works like the facts'; each skill's ability estimate comes from the copy
    // with clearly more answers behind it, else the newer one (math/skills/ability.ts)
    skills: keyed(m.skills, t.skills, b?.skills, (a, c, bb) => fact(a, c, bb, mineNewer)),
    ability: keyed(m.ability, t.ability, b?.ability, (a, c) => mergeAbility(a, c)),
    placed: keyed(m.placed, t.placed, b?.placed, (a, c) => ((a.at ?? 0) >= (c.at ?? 0) ? a : c)),
    lessons: keyed(m.lessons, t.lessons, b?.lessons, (a, c, bb) => lessonRec(a, c, bb, mineNewer)),
    history: timeline(m.history, t.history, x => `${x.at}|${x.lessonId}`, 300),
    totals: keyed(m.totals, t.totals, b?.totals, (a, c, bb) => add(a, c, bb)),
    tricksSeen: union(n.tricksSeen, o.tricksSeen), learned: union(n.learned, o.learned),
    play: keyed(m.play, t.play, b?.play, (a, c, bb) => ({
      ...a, ...c,
      stars: Array.from({ length: Math.max(a.stars?.length ?? 0, c.stars?.length ?? 0) }, (_, i) => Math.max(a.stars?.[i] ?? 0, c.stars?.[i] ?? 0)),
      plays: add(a.plays, c.plays, bb?.plays), best: max(a.best, c.best),
    })),
  };
}

/** Eggs: kept from both, gone if hatched on either, warmth added; the incubator holds 3 and the nest 9
 *  (an egg with no room turns into 15 shells, as in the game). */
const NEST_MAX = 9, EGG_SHELLS = 15;
function eggs(m: J, t: J, b: J, mineNewer: boolean): { incubator: J[]; nest: J[]; extraShells: number } {
  const all = (a: J) => [...(a?.incubator ?? []), ...(a?.nest ?? [])].filter(Boolean) as J[];
  const byId = (xs: J[]) => new Map(xs.map(e => [e.id, e]));
  const M = byId(all(m)), T = byId(all(t)), B = byId(all(b));
  const ids = sets([...M.keys()], [...T.keys()], b || HAS_BASE ? [...B.keys()] : undefined, mineNewer) ?? [];
  const egg = (id: string) => {
    const x = M.get(id), y = T.get(id), z = B.get(id);
    if (!x || !y) return x ?? y;
    return { ...(mineNewer ? x : y), have: Math.min(x.need ?? y.need, add(x.have, y.have, z?.have) ?? 0) };
  };
  const live = new Set(ids);
  const n = mineNewer ? m : t, o = mineNewer ? t : m;
  const incubator: J[] = (n?.incubator ?? [null, null, null]).map((e: J) => (e && live.has(e.id) ? egg(e.id) : null));
  while (incubator.length < 3) incubator.push(null);
  const placed = new Set(incubator.filter(Boolean).map((e: J) => e.id));
  for (const e of (o?.incubator ?? []).filter(Boolean)) {
    if (!live.has(e.id) || placed.has(e.id)) continue;
    const slot = incubator.findIndex(x => !x);
    if (slot >= 0) { incubator[slot] = egg(e.id); placed.add(e.id); }
  }
  const nest: J[] = [];
  for (const id of ids) if (!placed.has(id)) nest.push(egg(id));
  const extra = Math.max(0, nest.length - NEST_MAX);
  return { incubator, nest: nest.slice(0, NEST_MAX), extraShells: extra * EGG_SHELLS };
}
function rivals(m: J, t: J, b: J, mineNewer: boolean): J {
  const n = mineNewer ? m : t, o = mineNewer ? t : m;
  const inbox = timeline(m.inbox, t.inbox, x => `${x.at}|${x.who}`, 6)?.reverse();
  const both = { league: max(m.league, t.league), wins: add(m.wins, t.wins, b?.wins), played: add(m.played, t.played, b?.played), inbox };
  if (m.week !== t.week) { const later = (m.week ?? '') > (t.week ?? '') ? m : t; return { ...later, ...both }; }
  const sameBase = b?.week === m.week ? b : undefined;
  return { ...o, ...n, ...both, points: add(m.points, t.points, sameBase?.points), beaten: union(n.beaten, o.beaten) };
}
function adventure(m: J, t: J, b: J, mineNewer: boolean): J {
  const n = mineNewer ? m : t, o = mineNewer ? t : m;
  const out: J = { ...generic(m, t, b, mineNewer) };
  for (const k of ['shells', 'xp', 'battles', 'wins', 'perfects', 'eggsMade', 'practiceSessions']) out[k] = add(m[k], t[k], b?.[k]);
  out.glimmers = keyed(m.glimmers, t.glimmers, b?.glimmers, (a, c) => {
    const hi = (a.level ?? 0) !== (c.level ?? 0) ? ((a.level ?? 0) > (c.level ?? 0) ? a : c) : (a.xp ?? 0) >= (c.xp ?? 0) ? a : c;
    return { ...hi, got: min(a.got, c.got), evolved: or(a.evolved, c.evolved) };
  });
  out.team = (n.team ?? o.team ?? []).map((id: J) => (id && out.glimmers?.[id] ? id : null));
  const e = eggs(m, t, b, mineNewer);
  out.incubator = e.incubator; out.nest = e.nest; out.shells = (out.shells ?? 0) + e.extraShells;
  out.nodes = keyed(m.nodes, t.nodes, b?.nodes, (a, c) => Math.max(a, c));
  out.stopAt = newerObj(n.stopAt, o.stopAt);
  out.subject = n.subject ?? o.subject; out.settings = newerObj(n.settings, o.settings);
  out.day = m.day?.key === t.day?.key ? { key: m.day?.key, ms: add(m.day?.ms, t.day?.ms, b?.day?.key === m.day?.key ? b?.day?.ms : undefined), answers: add(m.day?.answers, t.day?.answers, b?.day?.key === m.day?.key ? b?.day?.answers : undefined), right: add(m.day?.right, t.day?.right, b?.day?.key === m.day?.key ? b?.day?.right : undefined) } : (m.day?.key ?? '') > (t.day?.key ?? '') ? m.day : t.day;
  out.fresh = sets(m.fresh, t.fresh, b?.fresh, mineNewer); out.seen = union(n.seen, o.seen);
  out.gear = newerObj(n.gear, o.gear);
  if (m.wardrobe || t.wardrobe) out.wardrobe = { ...newerObj(n.wardrobe, o.wardrobe), owned: union(n.wardrobe?.owned, o.wardrobe?.owned) ?? [], looks: newerObj(n.wardrobe?.looks, o.wardrobe?.looks) ?? {} };
  out.ghost = n.ghost ?? o.ghost;
  if (m.rivals && t.rivals) out.rivals = rivals(m.rivals, t.rivals, b?.rivals, mineNewer);
  if (m.duels || t.duels) out.duels = { played: add(m.duels?.played, t.duels?.played, b?.duels?.played) ?? 0, won: add(m.duels?.won, t.duels?.won, b?.duels?.won) ?? 0 };
  return out;
}

function clean(x: J) {
  if (Array.isArray(x)) { x.forEach(clean); return; }
  if (!isObj(x)) return;
  for (const k of Object.keys(x)) { if (x[k] === undefined) delete x[k]; else clean(x[k]); }
}

/** Combine this computer's copy (`mine`) with the saved one (`theirs`), given the last copy both agreed
 *  on (`base`, if known). The result keeps this computer's id and save code. */
export function mergeProfile(mine: Profile, theirs: Profile, base?: Profile | null): Profile {
  HAS_BASE = !!base;
  try { return mergeWith(mine, theirs, base); } finally { HAS_BASE = false; }
}
function mergeWith(mine: Profile, theirs: Profile, base?: Profile | null): Profile {
  const m = mine as J, t = theirs as J, b = (base ?? undefined) as J;
  const mineNewer = (m.updatedAt ?? 0) >= (t.updatedAt ?? 0);
  const n = mineNewer ? m : t, o = mineNewer ? t : m;
  const out: J = { ...generic(m, t, b, mineNewer) };
  // who they are and what they chose: the newer copy
  for (const k of ['name', 'buddy', 'accessory', 'customText']) out[k] = n[k] ?? o[k];
  out.settings = newerObj(n.settings, o.settings);
  out.looks = newerObj(n.looks, o.looks);
  out.createdAt = min(m.createdAt, t.createdAt); out.updatedAt = max(m.updatedAt, t.updatedAt);
  out.lessons = keyed(m.lessons, t.lessons, b?.lessons, (a, c, bb) => lessonRec(a, c, bb, mineNewer));
  out.keys = keyed(m.keys, t.keys, b?.keys, (a, c, bb) => ({ ...((a.n ?? 0) >= (c.n ?? 0) ? a : c), n: add(a.n, c.n, bb?.n) }));
  out.totals = keyed(m.totals, t.totals, b?.totals, (a, c, bb) => add(a, c, bb));
  out.days = keyed(m.days, t.days, b?.days, (a, c, bb) => ({ ...a, ...c, ms: add(a.ms, c.ms, bb?.ms), runs: add(a.runs, c.runs, bb?.runs), goal: or(a.goal, c.goal) }));
  out.pals = keyed(m.pals, t.pals, b?.pals, (a, c, bb) => pal(a, c, bb, mineNewer));
  if (m.book || t.book) out.book = m.book && t.book ? book(m.book, t.book, b?.book, mineNewer) : m.book ?? t.book;
  out.history = timeline(m.history, t.history, x => `${x.at}|${x.lessonId}`, 300) ?? [];
  out.rideBest = max(m.rideBest, t.rideBest) ?? 0;
  out.buddiesMet = union(n.buddiesMet, o.buddiesMet); out.demosSeen = union(n.demosSeen, o.demosSeen); out.unlocked = union(n.unlocked, o.unlocked) ?? [];
  out.soundSetup = or(m.soundSetup, t.soundSetup); out.allBuddies = or(m.allBuddies, t.allBuddies);
  if (m.math || t.math) out.math = m.math && t.math ? math(m.math, t.math, b?.math, mineNewer) : m.math ?? t.math;
  if (m.adventure || t.adventure) out.adventure = m.adventure && t.adventure ? adventure(m.adventure, t.adventure, b?.adventure, mineNewer) : m.adventure ?? t.adventure;
  // My Sky Island: things owned add up, put-away things stay away, visitors and hearts from both (island/save.ts)
  if (m.island || t.island) out.island = m.island && t.island ? mergeIsland(m.island, t.island, b?.island, mineNewer, add) : m.island ?? t.island;
  // undefined fields stay out of the save
  clean(out);
  out.id = mine.id; out.cloud = mine.cloud;
  if (!out.cloud) delete out.cloud;
  return out as Profile;
}
