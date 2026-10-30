// The Cheer Duel. Your buddy (with up to two Glimmers) faces a Grumble: a Glimmer gone grey and grumpy in
// the storm. Each turn you pick one of three power cards and answer it; the number you make is how much you
// cheer it up, and landing exactly on zero is a Perfect Cheer. Then the Grumble does some mischief, and you
// block it by answering a quick one in time. Five right in a row fills the Finale.
//
// Bonuses never change the number you made (so planning an exact finish always works): they come as their
// own little extras afterwards (a Glimmer's ember puff, a speedster's dash), or as healing, freezing and
// Finale stars. Pure: the screen calls play / block / finale / swap and animates the events that come back.
import { mulberry32, type Rng } from '../engine/rng';
import { answerOf, type Fact, type Op } from '../math/facts';
import { SKILL, splitKey } from '../math/skills/registry';
import type { Answer as SkillAnswer, AreaId, Item } from '../math/skills/types';
import { factFitFor, makeAt, pitchRung, STRAND_SKILL, TARGET } from '../math/skills/ability';
import { ELEMENT, ELEMENTS, EVOLVE_BOOST, GLIMMER, powerBase, powerNum, strong, type Element, type GearKind, type GlimmerId, type Rarity, type RoleId } from './glimmers';
import type { KitKind } from './gear';

export type Subject = 'math' | 'typing';
/** What a battle draws on. Math: facts and how well each is known (stage 3 = in bloom), and whether open
 *  cards (7 × ?) are in play; skills from the other areas (fractions...) by memory key (`skill:sub`), and
 *  how many of the cards are those (`mix`, 0..1); `area`: a math world's own area (Fraction Falls...), whose
 *  questions the quick blocks come from too when it has ones with a whole-number answer (else, and
 *  everywhere else, blocks are facts); and the player's ability on each skill and fact strand (`theta`,
 *  math/skills/ability.ts), so every question is pitched for them: the cards at about 80% right, the quick
 *  blocks at 90% (a guest's pool has none: it is their chosen level).
 *  Typing: words the player can type with the keys learned so far. */
export type Pool = { subject: 'math'; facts: { f: Fact; stage: number; w?: number }[]; open: boolean; skills?: { key: string; stage: number; w?: number }[]; mix?: number; area?: AreaId; theta?: Record<string, number> } | { subject: 'typing'; words: string[] };
/** What a skill question cheers: more for the harder ones (its weight, 1..5), shown on the card. */
export const itemCheer = (it: Item) => 4 + 4 * Math.max(1, Math.min(5, it.weight));

export type Card = {
  id: number; element: Element; name: string;
  /** strong against the Grumble's element */
  super: boolean;
  /** math: a fact to answer */
  fact?: Fact;
  /** math: an open card, `a op ?`: pick the missing number (0..max), then answer */
  open?: { a: number; op: Op; max: number };
  /** typing: a word to type */
  word?: string;
  /** math: a skill question (a fraction to name, two to compare...) and the cheer it's worth */
  item?: Item; value?: number;
  /** a fact already in bloom in the Fact Garden */
  bloom: boolean;
  /** one you missed earlier in this battle, back for another go */
  again?: boolean;
};

export type MischiefKind = 'zap' | 'snow' | 'rain' | 'pebbles' | 'gust';
export const MISCHIEF: Record<Element, { kind: MischiefKind; name: string }> = {
  sun: { kind: 'zap', name: 'A zap is coming' }, frost: { kind: 'snow', name: 'Snowballs are coming' }, tide: { kind: 'rain', name: 'Rain is coming' },
  stone: { kind: 'pebbles', name: 'Pebbles are coming' }, leaf: { kind: 'gust', name: 'Wind is coming' },
};

/** `mischief`: the island's own weather, sent instead of the element's (Fraction Falls' spray). `hit`: what
 *  its counterattack takes when it lands (sized to the buddy's energy by hitFor; 0 in a duel). */
export type Foe = { glimmer: GlimmerId; rarity: Rarity; champion: boolean; element: Element; grump: number; max: number; hit: number; evolved?: boolean; mischief?: { kind: MischiefKind; name: string } };
/** A Grumble as the map picks it (who, how grumpy, its weather): the battle sizes its hit. */
export type MapFoe = Omit<Foe, 'hit'>;
/** `evolved`: grown up, so its power works as if it were EVOLVE_BOOST levels higher, plus its own perk */
export type Member = { id: GlimmerId; level: number; evolved?: boolean };
/** `kit`: the hand, back and shoe gear's powers and any set bonus (gear.ts). `flat`: every right answer
 *  cheers this much whatever the question (duels: little sums and big times tables count the same). */
export type Setup = { pool: Pool; seed: number; sparkMax: number; role: RoleId; gear: GearKind | null; team: Member[]; foe: Foe; fastMs?: number; kit?: KitKind[]; flat?: number };

export type BEvent =
  /** `slips` and `power` (typing): wrong keys pressed in the word, and the share of its cheer that landed */
  | { k: 'cast'; card: Card; value: number; ok: boolean; perfect: boolean; super: boolean; slips?: number; power?: number }
  | { k: 'extra'; by: 'glimmer' | 'role' | 'gear'; id?: GlimmerId; what: string; value: number; item?: string }
  | { k: 'heal'; by: 'glimmer' | 'role' | 'gear'; id?: GlimmerId; what: string; value: number; item?: string }
  /** a piece of gear did something that isn't cheer or energy (a bubble shield, an extra Finale star, half a hit) */
  | { k: 'gear'; item: string; what: string; did: string }
  | { k: 'freeze'; id: GlimmerId }
  /** a Glimmer blew a shield (Bubble Octopus, Snowflake Jelly) that stops the next rain or zap */
  | { k: 'bubble'; id: GlimmerId; what: string }
  | { k: 'dazzle' }
  | { k: 'streakKept'; id: GlimmerId }
  | { k: 'retry' }
  | { k: 'finaleReady' }
  | { k: 'aurora' }
  | { k: 'finale'; value: number }
  | { k: 'mischief'; kind: MischiefKind; name: string; damage: number; result: 'full' | 'half' | 'none' | 'skip'; why?: string; id?: GlimmerId }
  | { k: 'secondwind'; value: number }
  | { k: 'won'; perfect: boolean }
  | { k: 'lost' };

/** A counterattack to block: a fact, a word, or (in a math world) one of its area's questions with a
 *  whole-number answer (below zero too), given longer by how quick that kind of question is (blockMs). `half`: already
 *  halved (a Strong card's dazzle, Steady): a Hero Cape doesn't halve it again */
export type Block = { kind: MischiefKind; name: string; hit: number; half?: boolean; limitMs: number; fact?: Fact; word?: string; item?: Item };
export type Phase = 'pick' | 'block' | 'won' | 'lost';

export type Battle = {
  subject: Subject; pool: Pool; rng: Rng; fastMs: number;
  spark: number; sparkMax: number; role: RoleId; gear: GearKind | null; team: Member[];
  /** hand, back and shoe gear (and set bonuses) */
  kit: KitKind[];
  /** every right answer cheers this much (0: as much as the answer, as in a battle) */
  flat: number;
  foe: Foe; cards: Card[]; phase: Phase; block: Block | null;
  streak: number; finale: number; turn: number; nextId: number;
  /** the Grumble skips its next mischief (frozen) / its next one is halved (dazzled) */
  frozen: boolean; dazzled: boolean;
  /** first mischiefs that do nothing (Pebble Shell, Hover) */
  free: { by: string; id?: GlimmerId }[];
  /** shields given this battle, from helpers and gear together (SHIELDS_MAX at most) */
  shields: number;
  used: { hide: boolean; retry: boolean; glow: boolean; aurora: boolean; secondwind: boolean; swap: boolean };
  /** times a twice-a-battle power has gone (an evolved Fern Fox, Spark Moth or Sky Whale gets two) */
  twice: { hide: number; glow: number; secondwind: number };
  rights: number; mischiefs: number; perfect: boolean;
  /** counterattacks that got through in a row (each is bigger than the last; a block calms it down) */
  bold: number;
  stats: { answers: number; right: number; fast: number; blocks: number; blocked: number; damage: number; cheer: number };
  /** facts answered (for the fact memory) */
  answered: { f: Fact; ok: boolean; thinkMs: number }[];
  /** skill questions answered, by memory key and the rung asked (for the skill memory and the ability) */
  skillAnswers: { key: string; ok: boolean; thinkMs: number; rung?: number }[];
  /** facts (or words) missed in this battle: one comes back in each new hand until it's answered right */
  missed: (Fact | string)[];
};

export const FINALE_AT = 5;
/** how often a hand has a card that finishes the Grumble exactly, when one exists */
export const FINISHER_ODDS = 0.4;
const has = (b: Battle, kind: string) => b.team.find(m => GLIMMER[m.id].power.kind === kind);
/** the level a member's power works at (evolved ones are stronger) */
const lv = (m: Member) => m.level + (m.evolved ? EVOLVE_BOOST : 0);
/** an evolved member with this power (its perk applies) */
const evo = (b: Battle, kind: string) => b.team.find(m => m.evolved && GLIMMER[m.id].power.kind === kind);
/** a once-a-battle power that an evolved Glimmer gets twice: may it go now? (counts the use) */
function again(b: Battle, key: 'hide' | 'glow' | 'secondwind', m: Member): boolean {
  if (b.twice[key] >= (m.evolved ? 2 : 1)) return false;
  b.twice[key]++; return true;
}

export function newBattle(s: Setup): Battle {
  const rng = mulberry32(s.seed);
  const b: Battle = {
    subject: s.pool.subject, pool: s.pool, rng, fastMs: s.fastMs ?? 4000,
    spark: s.sparkMax, sparkMax: s.sparkMax, role: s.role, gear: s.gear, team: s.team.slice(0, 2), kit: s.kit ?? [], flat: s.flat ?? 0,
    foe: { ...s.foe }, cards: [], phase: 'pick', block: null,
    streak: 0, finale: 0, turn: 0, nextId: 1, frozen: false, dazzled: false, free: [], shields: 0,
    used: { hide: false, retry: false, glow: false, aurora: false, secondwind: false, swap: false },
    twice: { hide: 0, glow: 0, secondwind: 0 },
    rights: 0, mischiefs: 0, perfect: false, bold: 0,
    stats: { answers: 0, right: 0, fast: 0, blocks: 0, blocked: 0, damage: 0, cheer: 0 },
    answered: [],
    skillAnswers: [],
    missed: [],
  };
  // Pebble Shell blocks the first rain or zap, Pinecone Curl the first two; a grown-up Boulder Tortoise
  // blocks two as well (a grown-up Pine Pangolin gives energy back instead: see the Grumble's turn)
  const shell = has(b, 'shell');
  if (shell) for (let i = 0; i < Math.max(powerBase(shell.id, 1), shell.evolved ? 2 : 0); i++) shield(b, { by: GLIMMER[shell.id].power.name, id: shell.id });
  // a Great Aurora Stag starts you off with two Finale stars
  if (evo(b, 'aurora')) b.finale = 2;
  if (s.gear === 'hover') shield(b, { by: 'Hover' });
  // gear that works from the start: Spring Shoes (more energy), Fairy Wings (Finale stars), the Sky set
  if (kit(b, 'spring')) { b.sparkMax += 4; b.spark += 4; }
  if (kit(b, 'wings')) b.finale = Math.max(b.finale, 2);
  if (kit(b, 'skyset')) shield(b, { by: 'Sky set' });
  deal(b);
  return b;
}
const kit = (b: Battle, k: KitKind) => b.kit.includes(k);
/** Shields from helpers and gear (a Pebble Shell, Hover, the Sky set, a bubble...) stop this many
 *  counterattacks a battle at most, all together, so a pile of them never makes blocking unnecessary. */
export const SHIELDS_MAX = 2;
/** Give a shield for a coming counterattack, if there's room for one this battle. */
function shield(b: Battle, s: { by: string; id?: GlimmerId }): boolean {
  if (b.shields >= SHIELDS_MAX) return false;
  b.shields++; b.free.push(s); return true;
}

/** Energy to start a battle with: a little more as the buddy's friendship grows (20 up to 30), and Big
 *  Heart's 6 on top. */
export const sparkFor = (level: number, role: RoleId) => 20 + Math.floor(Math.min(20, Math.max(1, level)) / 2) + (role === 'heart' ? 6 : 0);
/** How hard counterattacks bite (tuned with battleBalance.test.ts: miss them all and you lose nearly
 *  every battle, miss about half and you lose 2 to 4 in 10). `hits`: how many first-size hits empty your
 *  energy. Typing battles are shorter (every word cheers), so each hit is bigger; a Champion's battle is
 *  longer, so its hits are smaller but there are more of them. `bolder`: each one that gets through right
 *  after another is this much bigger again (x1.5, x2.25...), so no pile of energy and shields makes
 *  missing them safe; blocking one calms the Grumble down again. `tier`: each later island, a bit more. */
export const COUNTER = { hits: { math: 4.8, mathChampion: 6, typing: 3.4, typingChampion: 4.2 }, bolder: 0.5, tier: 0.05 };
export function hitFor(o: { champion: boolean; tier: number; level: number; subject: Subject }): number {
  const n = COUNTER.hits[o.subject === 'typing' ? (o.champion ? 'typingChampion' : 'typing') : o.champion ? 'mathChampion' : 'math'];
  return Math.ceil(sparkFor(o.level, 'speed') / (n * (1 - COUNTER.tier * Math.max(0, o.tier))));
}

/** How big a Grumble is: about seven good cards' worth (a Champion, about eleven), so there's room for a Finale. */
export function grumpFor(pool: Pool, champion: boolean): number {
  let avg = pool.subject === 'math'
    ? pool.facts.reduce((a, x) => a + Math.max(1, answerOf(x.f)), 0) / Math.max(1, pool.facts.length)
    : pool.words.reduce((a, w) => a + w.length, 0) / Math.max(1, pool.words.length);
  // skill cards: what one of each kind is worth, mixed in as often as they're dealt
  const mix = skillMix(pool);
  if (mix > 0 && pool.subject === 'math' && pool.skills?.length) {
    const rng = mulberry32(7);
    const items = pool.skills.map(x => makeItem(rng, x, pool)).filter((it): it is Item => !!it);
    const iavg = items.reduce((a, it) => a + itemCheer(it), 0) / Math.max(1, items.length);
    avg = (1 - mix) * avg + mix * iavg;
  }
  return Math.max(champion ? 30 : 16, Math.round(avg * (champion ? 11 : 7)));
}

// ---------- cards ----------
const pick = <T>(rng: Rng, xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];

function newCard(b: Battle, element: Element): Card {
  return { id: b.nextId++, element, name: ELEMENT[element].card, super: strong(element, b.foe.element), bloom: false };
}
/** How many of a math hand's cards are skill questions (all of them when there are no facts to deal). */
const skillMix = (pool: Pool) => (pool.subject !== 'math' || !pool.skills?.length ? 0 : !pool.facts.length ? 1 : Math.max(0, Math.min(1, pool.mix ?? 0)));
/** A fresh question for a skill memory key, pitched for the player (about 80% right); with no ability to
 *  go by (a guest), gentle until it's budding and grade level after. */
function makeItem(rng: Rng, x: { key: string; stage: number }, pool?: Pool): Item | null {
  const { skill, sub } = splitKey(x.key), s = SKILL[skill];
  if (!s || s.facts) return null;
  const t = pool?.subject === 'math' ? pool.theta?.[skill] : undefined;
  return makeAt(s, rng, sub, t === undefined ? (x.stage >= 2 ? 3 : 1) : pitchRung(t, TARGET.battle, rng));
}
/** Each fact strand's rung for this hand (or this block), pitched at a target with a little jitter. */
function strandRungs(b: Battle, target: number): Record<string, number> {
  const th = b.pool.subject === 'math' ? b.pool.theta : undefined, out: Record<string, number> = {};
  if (th) for (const id of Object.values(STRAND_SKILL)) if (th[id] !== undefined) out[id] = pitchRung(th[id], target, b.rng);
  return out;
}
/** A quick one to block with (a rain cloud in a duel too): something already known if there is anything,
 *  pitched easy (about 90% right: there's a clock). */
export function quickFact(b: Battle): Fact {
  if (b.pool.subject !== 'math') return { a: 1, b: 1 };
  const known = b.pool.facts.filter(x => x.stage >= 2), from = known.length >= 3 ? known : b.pool.facts;
  const th = b.pool.theta, rungs = strandRungs(b, TARGET.quick);
  return pickWeighted(b.rng, from.map(x => ({ ...x, w: 0 })), x => factFitFor(th, x.f, rungs)).f;
}
/** Whether a question can be a block: the block box is a number pad, so a whole number typed on it (no
 *  decimal point, no picking or dragging). A plain one sends as soon as it's typed; a negative numbers
 *  question (`signed`) gets the minus key and a Check button there, whatever the sign of its answer, so a
 *  positive answer doesn't give itself away. */
export const blockable = (it: Item) => it.input === 'number' && it.answer.kind === 'number' && Number.isInteger(it.answer.value) && (it.signed === true || (it.answer.value >= 0 && !it.signed));
/** A block the box answers with its minus key and Check (a negative numbers question). */
export const signedBlock = (it?: Item) => !!it && it.signed === true;
/** A quick one from a math world's own area, pitched easy like a fact block (about 90% right): something
 *  already known if there's enough of it, the first of a few tries that the block box can take; null when
 *  the area has none (then the block is a fact). */
export function quickItem(b: Battle): Item | null {
  if (b.pool.subject !== 'math' || !b.pool.area || !b.pool.skills?.length) return null;
  const known = b.pool.skills.filter(x => x.stage >= 2), from = (known.length >= 3 ? known : b.pool.skills).map(x => ({ ...x, w: 0 }));
  const th = b.pool.theta;
  for (let t = 0; t < 12; t++) {
    const x = pickWeighted(b.rng, from), { skill, sub } = splitKey(x.key), s = SKILL[skill];
    if (!s || s.facts || s.area !== b.pool.area) continue;
    const it = makeAt(s, b.rng, sub, th?.[skill] === undefined ? (x.stage >= 2 ? 3 : 1) : pitchRung(th[skill], TARGET.quick, b.rng));
    if (blockable(it)) return it;
  }
  return null;
}
/** How long a block gives: 5 seconds for a fact (about one and a half times a quick one), and the same
 *  share of a quick answer for an area's question (counting coins takes longer than 3 + 4), up to 20. */
export const blockMs = (it?: Item) => (it ? Math.min(20000, Math.max(5000, Math.round((SKILL[it.skill]?.fastMs ?? 3000) * 5 / 3 / 500) * 500)) : 5000);
function itemCard(b: Battle, c: Card, x: { key: string; stage: number }): boolean {
  const it = makeItem(b.rng, x, b.pool);
  if (!it) return false;
  c.item = it; c.value = itemCheer(it); c.bloom = x.stage === 3;
  return true;
}

/** A fresh hand: three cards (four with the Lasso), different elements, and when the Grumble is nearly
 *  cheered up, usually one card that can land exactly. */
export function deal(b: Battle) {
  const n = b.gear === 'lasso' ? 4 : 3;
  const els = shuffled(b.rng, ELEMENTS).slice(0, n);
  // the Top Hat's magic: the first hand always has a strong card
  if (b.gear === 'magic' && b.turn === 0) { const st = ELEMENTS.find(e => strong(e, b.foe.element))!; if (!els.includes(st)) els[0] = st; }
  const cards: Card[] = [];
  const g = b.foe.grump;
  if (b.pool.subject === 'math') {
    const facts = b.pool.facts, skills = b.pool.skills ?? [], mix = skillMix(b.pool);
    // the facts that suit the player's rung come up most (about 80% right)
    const theta = b.pool.theta, rungs = strandRungs(b, TARGET.battle), fit = (x: { f: Fact }) => factFitFor(theta, x.f, rungs);
    const finishers = b.flat || mix >= 1 ? [] : facts.filter(x => answerOf(x.f) === g);
    const used = new Set<string>();
    els.forEach((e, i) => {
      const c = newCard(b, e);
      // a skill question (fractions...) for some cards, as many as the pool's mix; one missed earlier in
      // this battle comes back (a fresh one like it) in the second card until it's answered right
      if (mix > 0) {
        const backKey = i === 1 ? b.missed.find((m): m is string => typeof m === 'string') : undefined;
        if (backKey && itemCard(b, c, { key: backKey, stage: skills.find(x => x.key === backKey)?.stage ?? 1 })) { c.again = true; used.add(backKey); cards.push(c); return; }
        if (mix >= 1 || b.rng() < mix) {
          let x = pickWeighted(b.rng, skills);
          for (let t = 0; t < 6 && used.has(x.key) && skills.length > 1; t++) x = pickWeighted(b.rng, skills);
          if (itemCard(b, c, x)) { used.add(x.key); cards.push(c); return; }
        }
      }
      const openOk = b.pool.subject === 'math' && b.pool.open && i === 1 && b.rng() < 0.6;
      // a card that lands it exactly turns up sometimes, not nearly always: a Perfect Cheer (and its egg)
      // should take planning, and small sums used to get one almost every battle
      if (i === 0 && finishers.length && b.rng() < FINISHER_ODDS) { const x = pick(b.rng, finishers); c.fact = x.f; c.bloom = x.stage === 3; }
      else if (openOk) {
        const base = facts.filter(x => (x.f.op ?? 'x') === 'x' || x.f.op === '+');
        const x = base.length ? pick(b.rng, base) : null;
        if (x) c.open = { a: x.f.a, op: x.f.op ?? 'x', max: 10 };
      }
      // a fact missed earlier in this battle comes back (in the second card) until it's answered right
      const back = i === 1 ? b.missed.find((m): m is Fact => typeof m !== 'string') : undefined;
      if (!c.fact && back) { c.fact = back; c.again = true; c.open = undefined; used.add(`${back.a}${back.op ?? 'x'}${back.b}`); }
      if (!c.fact && !c.open && facts.length) {
        // mostly facts not shown yet this hand; the shaky ones (missed lately, slow, not in bloom) more often
        for (let t = 0; t < 8; t++) { const x = pickWeighted(b.rng, facts, fit); const id = `${x.f.a}${x.f.op ?? 'x'}${x.f.b}`; if (!used.has(id) || t === 7) { used.add(id); c.fact = x.f; c.bloom = x.stage === 3; break; } }
      }
      cards.push(c);
    });
  } else {
    const words = b.pool.words;
    const finish = b.flat ? [] : words.filter(w => w.length === g);
    // all right answers count the same in a duel, so its words are all about the player's usual length
    const mid = [...words].sort((x, y) => x.length - y.length)[Math.floor(words.length / 2)]?.length ?? 4;
    const usual = words.filter(w => Math.abs(w.length - mid) <= 1);
    const used = new Set<string>();
    els.forEach((e, i) => {
      const c = newCard(b, e);
      // a spread of lengths: short, middle, long
      const want = b.flat ? usual : i === 0 && finish.length && b.rng() < FINISHER_ODDS ? finish : words.filter(w => i === 0 ? w.length <= 4 : i === 1 ? w.length >= 4 && w.length <= 6 : w.length >= 5);
      let w = '';
      // a word missed earlier in this battle comes back until it's typed right
      const back = i === 1 ? b.missed.find((m): m is string => typeof m === 'string') : undefined;
      if (back) { w = back; c.again = true; }
      else for (let t = 0; t < 8; t++) { w = pick(b.rng, want.length ? want : words); if (!used.has(w)) break; }
      used.add(w); c.word = w;
      cards.push(c);
    });
  }
  b.cards = cards;
}

/** A fact from the pool, the weak ones (w: 0 known cold .. 1 shaky) up to three times as likely, times how
 *  well each suits the player's rung (`fit`). */
function pickWeighted<T extends { w?: number }>(rng: Rng, xs: readonly T[], fit: (x: T) => number = () => 1): T {
  const wt = (x: T) => (1 + 2 * (x.w ?? 0)) * fit(x);
  const tot = xs.reduce((a, x) => a + wt(x), 0);
  let r = rng() * tot;
  for (const x of xs) { r -= wt(x); if (r <= 0) return x; }
  return xs[xs.length - 1];
}
function shuffled<T>(rng: Rng, xs: readonly T[]): T[] { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Trickster: a new hand, once a turn. */
export function swap(b: Battle): boolean {
  if (b.role !== 'trick' || b.used.swap || b.phase !== 'pick') return false;
  b.used.swap = true; deal(b); return true;
}

/** The fact an open card makes once the missing number is chosen. */
export const openFact = (o: NonNullable<Card['open']>, n: number): Fact => (o.op === 'x' ? { a: o.a, b: n } : { a: o.a, b: n, op: o.op });

// ---------- your turn ----------
/** Typing: `slips` is how many wrong keys were pressed while typing the word (see typePower). */
export type Answer = { ok: boolean; value: number; thinkMs: number; fact?: Fact; given?: SkillAnswer; slips?: number };

/** Typing: how much of a word's cheer lands, 0..1. Every key right first time is full power; each wrong key
 *  takes a share off, so one slip on a long word costs a little, and enough of them leave nothing: four on
 *  a short word (four letters or fewer), up to six on a long one. The same in battles and duels. */
export const slipRoom = (len: number) => Math.max(4, Math.min(6, len));
export const typePower = (len: number, slips: number) => Math.max(0, 1 - Math.max(0, slips) / slipRoom(len));
/** A cheer with the typing power taken into account: at least 1 while any power is left, 0 when none is. */
export const powered = (n: number, power: number) => (power <= 0 ? 0 : Math.max(1, Math.round(n * power)));

/** Play a card. Math: `value` is the answer typed, `fact` the fact answered (an open card's, once its
 *  number is chosen); a skill card's answer is `given` (checked here, by its skill). Typing: `ok` the word
 *  was finished, `slips` the wrong keys pressed on the way (they lower its power: typePower; with too
 *  many it cheers nothing and counts as a miss). Returns the events to show. */
export function play(b: Battle, cardId: number, a: Answer): BEvent[] {
  const card = b.cards.find(c => c.id === cardId);
  if (!card || b.phase !== 'pick') return [];
  const ev: BEvent[] = [];
  const fact = card.item ? undefined : a.fact ?? card.fact;
  const it = card.item, sk = it ? SKILL[it.skill] : undefined;
  // typing: the word's power after its slips
  const len = card.word?.length ?? Math.max(1, a.value), slips = Math.max(0, a.slips ?? 0);
  const power = b.subject === 'typing' && !it ? typePower(len, slips) : 1;
  const ok = it ? !!a.given && !!sk && sk.check(it, a.given) : b.subject === 'math' ? !!fact && a.ok && a.value === answerOf(fact) : a.ok && power > 0;
  // the Wizard Hat: one wrong answer becomes a retry
  if (!ok && b.gear === 'retry' && !b.used.retry) { b.used.retry = true; return [{ k: 'retry' }]; }
  b.stats.answers++;
  if (fact) b.answered.push({ f: fact, ok, thinkMs: a.thinkMs });
  if (it) b.skillAnswers.push({ key: it.key, ok, thinkMs: a.thinkMs, rung: it.rung });
  // remember a miss so it comes back; a right answer clears it
  const key: Fact | string | undefined = fact ?? it?.key ?? card.word;
  if (key !== undefined) {
    const same = (m: Fact | string) => (typeof m === 'string' || typeof key === 'string' ? m === key : m.a === key.a && m.b === key.b && (m.op ?? 'x') === (key.op ?? 'x'));
    const i = b.missed.findIndex(same);
    if (ok && i >= 0) b.missed.splice(i, 1);
    else if (!ok && i < 0) b.missed.push(key);
  }
  const real = ok ? (it ? card.value ?? itemCheer(it) : b.subject === 'math' ? answerOf(fact!) : powered(len, power)) : 0;
  const value = ok ? (b.flat ? powered(b.flat, power) : real) : 0;
  const fast = ok && (it ? a.thinkMs <= (sk?.fastMs ?? b.fastMs) : b.subject === 'math' ? a.thinkMs <= b.fastMs : a.thinkMs <= 450 * len + 600);
  // landing it exactly is a battle thing: in a duel every answer counts the same
  const perfect = ok && !b.flat && value === b.foe.grump;
  b.foe.grump = Math.max(0, b.foe.grump - value);
  b.stats.cheer += value;
  ev.push({ k: 'cast', card, value, ok, perfect, super: ok && card.super, ...(b.subject === 'typing' && !it ? { slips, power } : {}) });
  if (ok) {
    b.stats.right++; if (fast) b.stats.fast++;
    b.rights++; b.streak++;
    b.finale += (b.gear === 'royal' ? 2 : 1) + (card.super ? 1 : 0) + (card.element === 'leaf' && has(b, 'blossom') ? 1 : 0) + (card.element === 'tide' && evo(b, 'song') ? 1 : 0)
      // a grown-up booster (Solar Snail, Toadstool Mouse, Rainbow Ram): cards of its element fill an extra star
      + b.team.filter(m => m.evolved && GLIMMER[m.id].power.kind === 'boost' && GLIMMER[m.id].element === card.element).length;
    if (card.super) { b.dazzled = true; ev.push({ k: 'dazzle' }); }
    // gear: Rocket Sneakers fill an extra star on a fast answer; the Bubble Wand's bubble every 4th
    if (fast && kit(b, 'zoom') && b.finale < FINALE_AT) { b.finale++; ev.push({ k: 'gear', item: 'rocket_sneakers', what: 'Rocket Sneakers', did: '+1 Finale star' }); }
    if (kit(b, 'bubble') && b.rights % 4 === 0 && shield(b, { by: 'Bubble Wand' })) { ev.push({ k: 'gear', item: 'bubble_wand', what: 'Bubble Wand', did: 'bubble shield!' }); }
  } else {
    const fox = has(b, 'hide');
    if (fox && b.streak > 0 && again(b, 'hide', fox)) { b.used.hide = true; ev.push({ k: 'streakKept', id: fox.id }); }
    // five right in a row fills the Finale: a slip starts the row again
    else { b.streak = 0; b.finale = 0; }
  }
  if (perfect) { b.perfect = true; ev.push({ k: 'won', perfect: true }); b.phase = 'won'; return ev; }
  if (b.foe.grump > 0) {
    // extras, each its own little cheer
    const extra = (by: 'glimmer' | 'role' | 'gear', what: string, n: number, id?: GlimmerId, item?: string) => {
      if (n <= 0 || b.foe.grump <= 0) return;
      const v = Math.min(n, b.foe.grump); b.foe.grump -= v; b.stats.cheer += v;
      ev.push({ k: 'extra', by, what, value: v, id, item });
    };
    if (ok && b.gear === 'confetti') extra('gear', 'Confetti', 1);
    if (ok && kit(b, 'kite') && b.streak > 0 && b.streak % 3 === 0) extra('gear', 'Sky Kite', 3, undefined, 'sky_kite');
    if (fast && kit(b, 'rocketpack')) extra('gear', 'Rocket Pack', 2, undefined, 'rocket_pack');
    if (ok && b.role === 'speed' && (b.subject === 'math' && !b.flat && !it ? a.thinkMs < 3000 : fast)) extra('role', 'Dash', 3);
    for (const m of b.team) {
      const k = GLIMMER[m.id].power.kind, pw = GLIMMER[m.id].power.name;
      if (k === 'splash' && ok && (b.flat || it ? fast : a.thinkMs < 4000)) extra('glimmer', pw, powerNum(powerBase(m.id, 3), lv(m)), m.id);
      if (k === 'ember') extra('glimmer', pw, powerNum(powerBase(m.id, 4), lv(m)), m.id);
      if (k === 'lanterns' && ok && b.rights % 3 === 0) extra('glimmer', pw, powerNum(powerBase(m.id, 10), lv(m), 3), m.id);
      // cards of its own element cheer more (Sunny Snail: Sun cards)
      if (k === 'boost' && ok && card.element === GLIMMER[m.id].element) extra('glimmer', pw, powerNum(powerBase(m.id, 2), lv(m)), m.id);
      // the first right answer of the battle pops (grown up: the first two)
      if (k === 'opener' && ok && b.rights <= (m.evolved ? 2 : 1)) extra('glimmer', pw, powerNum(powerBase(m.id, 6), lv(m)), m.id);
      // grown-up perks
      if (m.evolved && ok) {
        if (k === 'splash' && card.element === 'tide') extra('glimmer', 'Tidal splash', 2, m.id);
        if (k === 'ember' && card.element === 'sun') extra('glimmer', 'Flare', 3, m.id);
        if (k === 'crystal' && card.super) extra('glimmer', 'Diamond shine', 2, m.id);
        if (k === 'blossom' && card.element === 'leaf') extra('glimmer', 'Bloom breath', 2, m.id);
      }
    }
  }
  // healing
  const heal = (by: 'glimmer' | 'role' | 'gear', what: string, n: number, id?: GlimmerId, item?: string) => {
    const v = Math.min(n, b.sparkMax - b.spark); if (v <= 0) return;
    b.spark += v; ev.push({ k: 'heal', by, what, value: v, id, item });
  };
  if (ok && card.bloom && b.gear === 'bloomheal') heal('gear', 'Bloom', 2);
  if (ok && kit(b, 'playset') && b.rights % 5 === 0) heal('gear', 'Playground set', 3, undefined, 'bubble_wand');
  if (fast && kit(b, 'champset')) heal('gear', 'Champion set', 1, undefined, 'rocket_pack');
  if (ok && b.role === 'helper' && b.streak > 0 && b.streak % 3 === 0) heal('role', 'Helping hand', 3);
  for (const m of b.team) {
    const k = GLIMMER[m.id].power.kind;
    if (k === 'nibble') heal('glimmer', 'Nibble', powerNum(1, lv(m), 6), m.id);
    if (k === 'nibble' && m.evolved && ok && card.super) heal('glimmer', 'Blossom snack', 2, m.id);
    if (k === 'song' && ok && card.element === 'tide') heal('glimmer', 'Whale song', powerNum(3, lv(m)), m.id);
    if (k === 'blossom' && ok) heal('glimmer', 'Blossom', powerNum(1, lv(m), 8), m.id);
    if (k === 'freeze' && ok && b.streak > 0 && b.streak % (m.evolved ? 2 : 3) === 0 && !b.frozen) { b.frozen = true; ev.push({ k: 'freeze', id: m.id }); }
    // a shield every few right answers (grown up: one sooner)
    if (k === 'bubbles' && ok && b.rights % Math.max(2, powerBase(m.id, 5) - (m.evolved ? 1 : 0)) === 0 && shield(b, { by: GLIMMER[m.id].power.name, id: m.id })) { ev.push({ k: 'bubble', id: m.id, what: GLIMMER[m.id].power.name }); }
    if (k === 'aurora' && ok && !b.used.aurora && b.rights >= 2) { b.used.aurora = true; b.finale = Math.max(b.finale, FINALE_AT); ev.push({ k: 'aurora' }); }
  }
  b.finale = Math.min(FINALE_AT, b.finale);
  if (b.foe.grump <= 0) { ev.push({ k: 'won', perfect: false }); b.phase = 'won'; return ev; }
  if (b.finale >= FINALE_AT && ok) ev.push({ k: 'finaleReady' });
  ev.push(...grumbleTurn(b));
  return ev;
}

/** The Finale: your buddy's big moment, when the meter is full. */
export function finale(b: Battle): BEvent[] {
  if (b.finale < FINALE_AT || b.phase !== 'pick') return [];
  b.finale = 0;
  // a Starlight Fox makes the Finale 10 bigger
  // the Boombox turns it up: twice as strong
  const v = Math.min(b.foe.grump, (Math.max(6, Math.round(b.foe.max * 0.3)) + (evo(b, 'lanterns') ? 10 : 0)) * (kit(b, 'boombox') ? 2 : 1));
  b.foe.grump -= v; b.stats.cheer += v;
  const ev: BEvent[] = [{ k: 'finale', value: v }];
  if (kit(b, 'boombox')) ev.unshift({ k: 'gear', item: 'boombox', what: 'Boombox', did: 'twice as strong!' });
  if (b.foe.grump <= 0) { ev.push({ k: 'won', perfect: false }); b.phase = 'won'; }
  return ev;
}

// ---------- the Grumble's turn ----------
function grumbleTurn(b: Battle): BEvent[] {
  const m = b.foe.mischief ?? MISCHIEF[b.foe.element];
  b.mischiefs++;
  const full = Math.round(b.foe.hit * Math.pow(1 + COUNTER.bolder, b.bold));
  // halves don't pile up: a dazzled Grumble, Steady and the Hero Cape each make a hit half, never a quarter
  let half = false;
  if (b.dazzled) { half = true; b.dazzled = false; }
  if (b.frozen) { b.frozen = false; return [{ k: 'mischief', kind: m.kind, name: m.name, damage: 0, result: 'skip', why: 'frozen' }, ...nextTurn(b)]; }
  const free = b.free.shift();
  if (free) {
    const ev: BEvent[] = [{ k: 'mischief', kind: m.kind, name: m.name, damage: 0, result: 'skip', why: free.by, id: free.id }];
    // a grown-up Pine Pangolin's curl gives 2 energy back each time it blocks
    const pango = free.id ? b.team.find(t => t.id === free.id && t.evolved && GLIMMER[t.id].power.kind === 'shell' && powerBase(t.id, 1) >= 2) : undefined;
    if (pango && b.spark < b.sparkMax) { const v = Math.min(2, b.sparkMax - b.spark); b.spark += v; ev.push({ k: 'heal', by: 'glimmer', what: 'Pine curl', value: v, id: pango.id }); }
    return [...ev, ...nextTurn(b)];
  }
  if (b.role === 'steady' && b.mischiefs % 2 === 0) half = true;
  const hit = half ? Math.ceil(full / 2) : full;
  const seal = has(b, 'coolhead');
  const prompt = blockPrompt(b);
  const limitMs = b.subject === 'math' ? blockMs(prompt.item) + (seal ? powerNum(2, lv(seal), 8) * 1000 : 0) + (b.gear === 'shieldwall' ? 2000 : 0) : 0;
  const block: Block = { kind: m.kind, name: m.name, hit, half, limitMs, ...prompt };
  if (b.subject === 'typing') block.limitMs = 2000 + 800 * (block.word?.length ?? 4) + (seal ? powerNum(2, lv(seal), 8) * 1000 : 0) + (b.gear === 'shieldwall' ? 2000 : 0);
  b.block = block;
  b.phase = 'block';
  return [];
}

function blockPrompt(b: Battle): { fact?: Fact; word?: string; item?: Item } {
  if (b.pool.subject === 'math') { const item = quickItem(b); return item ? { item } : { fact: quickFact(b) }; }
  const short = b.pool.words.filter(w => w.length >= 2 && w.length <= 4);
  return { word: pick(b.rng, short.length ? short : b.pool.words) };
}

/** Answer the block prompt. `ok` right (typing: typed with no slips), `ms` how long it took. */
export function block(b: Battle, ok: boolean, ms: number): BEvent[] {
  const bl = b.block;
  if (!bl || b.phase !== 'block') return [];
  b.stats.blocks++;
  if (b.subject === 'math' && bl.fact) b.answered.push({ f: bl.fact, ok, thinkMs: ms });
  if (bl.item) b.skillAnswers.push({ key: bl.item.key, ok, thinkMs: ms, rung: bl.item.rung });
  // right and in time: blocked. Too late or wrong: it lands
  const result: 'full' | 'none' = ok && ms <= bl.limitMs ? 'full' : 'none';
  // the Hero Cape catches half of a hit that lands
  const caped = result === 'none' && kit(b, 'cape') && !bl.half;
  const damage = result === 'full' ? 0 : caped ? Math.ceil(bl.hit / 2) : bl.hit;
  if (damage === 0) b.stats.blocked++;
  b.bold = result === 'full' ? 0 : b.bold + 1;
  b.spark = Math.max(0, b.spark - damage);
  b.stats.damage += damage;
  b.block = null;
  const ev: BEvent[] = [{ k: 'mischief', kind: bl.kind, name: bl.name, damage, result }];
  if (caped) ev.push({ k: 'gear', item: 'hero_cape', what: 'Hero Cape', did: 'only half the hit' });
  if (result === 'full' && b.role === 'builder' && b.spark < b.sparkMax) { b.spark += 1; ev.push({ k: 'heal', by: 'role', what: 'Builder', value: 1 }); }
  if (result === 'full' && kit(b, 'cloudstep') && b.spark < b.sparkMax) { const v = Math.min(2, b.sparkMax - b.spark); b.spark += v; ev.push({ k: 'heal', by: 'gear', what: 'Cloud Slippers', value: v, item: 'cloud_slippers' }); }
  // a Blizzard Seal turns every block into a little cheer
  const seal = evo(b, 'coolhead');
  if (result === 'full' && seal && b.foe.grump > 0) {
    const v = Math.min(2, b.foe.grump); b.foe.grump -= v; b.stats.cheer += v;
    ev.push({ k: 'extra', by: 'glimmer', what: 'Snow flurry', value: v, id: seal.id });
    if (b.foe.grump <= 0) { ev.push({ k: 'won', perfect: false }); b.phase = 'won'; return ev; }
  }
  const whale = has(b, 'secondwind');
  if (whale && b.spark > 0 && b.spark <= b.sparkMax / 3 && again(b, 'secondwind', whale)) {
    b.used.secondwind = true; const v = Math.min(b.sparkMax - b.spark, powerNum(powerBase(whale.id, 10), lv(whale), 3)); b.spark += v; ev.push({ k: 'secondwind', value: v });
  }
  if (b.spark <= 0) { b.phase = 'lost'; ev.push({ k: 'lost' }); return ev; }
  ev.push(...nextTurn(b));
  return ev;
}

function nextTurn(b: Battle): BEvent[] {
  b.turn++; b.used.swap = false; b.phase = 'pick'; b.block = null;
  deal(b);
  return [];
}

/** Spark Moth's glow: once a battle (the screen shows the trick for a card). */
export function useGlow(b: Battle): boolean {
  const moth = has(b, 'glow');
  if (!moth || !again(b, 'glow', moth)) return false;
  b.used.glow = true; return true;
}
/** Can Hint still be used this battle? (an evolved Sunbeam Moth gives two) */
export function glowLeft(b: Battle): boolean { const moth = has(b, 'glow'); return !!moth && b.twice.glow < (moth.evolved ? 2 : 1); }
