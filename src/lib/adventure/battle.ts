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
import { ELEMENT, ELEMENTS, EVOLVE_BOOST, GLIMMER, powerNum, strong, type Element, type GearKind, type GlimmerId, type Rarity, type RoleId } from './glimmers';
import type { KitKind } from './gear';

export type Subject = 'math' | 'typing';
/** What a battle draws on. Math: facts and how well each is known (stage 3 = in bloom), and whether open
 *  cards (7 × ?) are in play. Typing: words the player can type with the keys learned so far. */
export type Pool = { subject: 'math'; facts: { f: Fact; stage: number }[]; open: boolean } | { subject: 'typing'; words: string[] };

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
  /** a fact already in bloom in the Fact Garden */
  bloom: boolean;
};

export type MischiefKind = 'zap' | 'snow' | 'rain' | 'pebbles' | 'gust';
export const MISCHIEF: Record<Element, { kind: MischiefKind; name: string }> = {
  sun: { kind: 'zap', name: 'A zap is coming' }, frost: { kind: 'snow', name: 'Snowballs are coming' }, tide: { kind: 'rain', name: 'Rain is coming' },
  stone: { kind: 'pebbles', name: 'Pebbles are coming' }, leaf: { kind: 'gust', name: 'Wind is coming' },
};

export type Foe = { glimmer: GlimmerId; rarity: Rarity; champion: boolean; element: Element; grump: number; max: number; hit: number; evolved?: boolean };
/** `evolved`: grown up, so its power works as if it were EVOLVE_BOOST levels higher, plus its own perk */
export type Member = { id: GlimmerId; level: number; evolved?: boolean };
/** `kit`: the hand, back and shoe gear's powers and any set bonus (gear.ts) */
export type Setup = { pool: Pool; seed: number; sparkMax: number; role: RoleId; gear: GearKind | null; team: Member[]; foe: Foe; fastMs?: number; kit?: KitKind[] };

export type BEvent =
  | { k: 'cast'; card: Card; value: number; ok: boolean; perfect: boolean; super: boolean }
  | { k: 'extra'; by: 'glimmer' | 'role' | 'gear'; id?: GlimmerId; what: string; value: number; item?: string }
  | { k: 'heal'; by: 'glimmer' | 'role' | 'gear'; id?: GlimmerId; what: string; value: number; item?: string }
  /** a piece of gear did something that isn't cheer or energy (a bubble shield, an extra Finale star, half a hit) */
  | { k: 'gear'; item: string; what: string; did: string }
  | { k: 'freeze'; id: GlimmerId }
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

export type Block = { kind: MischiefKind; name: string; hit: number; limitMs: number; fact?: Fact; word?: string };
export type Phase = 'pick' | 'block' | 'won' | 'lost';

export type Battle = {
  subject: Subject; pool: Pool; rng: Rng; fastMs: number;
  spark: number; sparkMax: number; role: RoleId; gear: GearKind | null; team: Member[];
  /** hand, back and shoe gear (and set bonuses) */
  kit: KitKind[];
  foe: Foe; cards: Card[]; phase: Phase; block: Block | null;
  streak: number; finale: number; turn: number; nextId: number;
  /** the Grumble skips its next mischief (frozen) / its next one is halved (dazzled) */
  frozen: boolean; dazzled: boolean;
  /** first mischiefs that do nothing (Pebble Shell, Hover) */
  free: { by: string; id?: GlimmerId }[];
  used: { hide: boolean; retry: boolean; glow: boolean; aurora: boolean; secondwind: boolean; swap: boolean };
  /** times a twice-a-battle power has gone (an evolved Fern Fox, Spark Moth or Sky Whale gets two) */
  twice: { hide: number; glow: number; secondwind: number };
  rights: number; mischiefs: number; perfect: boolean;
  stats: { answers: number; right: number; fast: number; blocks: number; blocked: number; damage: number; cheer: number };
  /** facts answered (for the fact memory) */
  answered: { f: Fact; ok: boolean; thinkMs: number }[];
};

export const FINALE_AT = 5;
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
    spark: s.sparkMax, sparkMax: s.sparkMax, role: s.role, gear: s.gear, team: s.team.slice(0, 2), kit: s.kit ?? [],
    foe: { ...s.foe }, cards: [], phase: 'pick', block: null,
    streak: 0, finale: 0, turn: 0, nextId: 1, frozen: false, dazzled: false, free: [],
    used: { hide: false, retry: false, glow: false, aurora: false, secondwind: false, swap: false },
    twice: { hide: 0, glow: 0, secondwind: 0 },
    rights: 0, mischiefs: 0, perfect: false,
    stats: { answers: 0, right: 0, fast: 0, blocks: 0, blocked: 0, damage: 0, cheer: 0 },
    answered: [],
  };
  const shell = has(b, 'shell');
  if (shell) b.free.push({ by: 'Pebble Shell', id: shell.id });
  if (shell?.evolved) b.free.push({ by: 'Boulder Shell', id: shell.id });
  // a Great Aurora Stag starts you off with two Finale stars
  if (evo(b, 'aurora')) b.finale = 2;
  if (s.gear === 'hover') b.free.push({ by: 'Hover' });
  // gear that works from the start: Spring Shoes (more energy), Fairy Wings (Finale stars), the Sky set
  if (kit(b, 'spring')) { b.sparkMax += 4; b.spark += 4; }
  if (kit(b, 'wings')) b.finale = Math.max(b.finale, 2);
  if (kit(b, 'skyset')) b.free.push({ by: 'Sky set' });
  deal(b);
  return b;
}
const kit = (b: Battle, k: KitKind) => b.kit.includes(k);

/** Spark to start a battle with: grows with the buddy's friendship level. */
export const sparkFor = (level: number, role: RoleId) => 12 + Math.min(18, Math.max(1, level)) + (role === 'heart' ? 6 : 0);

/** How big a Grumble is: about seven good cards' worth (a Champion, about eleven), so there's room for a Finale. */
export function grumpFor(pool: Pool, champion: boolean): number {
  const avg = pool.subject === 'math'
    ? pool.facts.reduce((a, x) => a + Math.max(1, answerOf(x.f)), 0) / Math.max(1, pool.facts.length)
    : pool.words.reduce((a, w) => a + w.length, 0) / Math.max(1, pool.words.length);
  return Math.max(champion ? 30 : 16, Math.round(avg * (champion ? 11 : 7)));
}

// ---------- cards ----------
const pick = <T>(rng: Rng, xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];

function newCard(b: Battle, element: Element): Card {
  return { id: b.nextId++, element, name: ELEMENT[element].card, super: strong(element, b.foe.element), bloom: false };
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
    const facts = b.pool.facts;
    const finishers = facts.filter(x => answerOf(x.f) === g);
    const used = new Set<string>();
    els.forEach((e, i) => {
      const c = newCard(b, e);
      const openOk = b.pool.subject === 'math' && b.pool.open && i === 1 && b.rng() < 0.6;
      if (i === 0 && finishers.length && b.rng() < 0.75) { const x = pick(b.rng, finishers); c.fact = x.f; c.bloom = x.stage === 3; }
      else if (openOk) {
        const base = facts.filter(x => (x.f.op ?? 'x') === 'x' || x.f.op === '+');
        const x = base.length ? pick(b.rng, base) : null;
        if (x) c.open = { a: x.f.a, op: x.f.op ?? 'x', max: 10 };
      }
      if (!c.fact && !c.open) {
        // mostly facts not shown yet this hand, a few in bloom
        for (let t = 0; t < 8; t++) { const x = pick(b.rng, facts); const id = `${x.f.a}${x.f.op ?? 'x'}${x.f.b}`; if (!used.has(id) || t === 7) { used.add(id); c.fact = x.f; c.bloom = x.stage === 3; break; } }
      }
      cards.push(c);
    });
  } else {
    const words = b.pool.words;
    const finish = words.filter(w => w.length === g);
    const used = new Set<string>();
    els.forEach((e, i) => {
      const c = newCard(b, e);
      // a spread of lengths: short, middle, long
      const want = i === 0 && finish.length && b.rng() < 0.75 ? finish : words.filter(w => i === 0 ? w.length <= 4 : i === 1 ? w.length >= 4 && w.length <= 6 : w.length >= 5);
      let w = '';
      for (let t = 0; t < 8; t++) { w = pick(b.rng, want.length ? want : words); if (!used.has(w)) break; }
      used.add(w); c.word = w;
      cards.push(c);
    });
  }
  b.cards = cards;
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
export type Answer = { ok: boolean; value: number; thinkMs: number; fact?: Fact };

/** Play a card. Math: `value` is the answer typed, `fact` the fact answered (an open card's, once its
 *  number is chosen). Typing: `value` is the letters typed right. Returns the events to show. */
export function play(b: Battle, cardId: number, a: Answer): BEvent[] {
  const card = b.cards.find(c => c.id === cardId);
  if (!card || b.phase !== 'pick') return [];
  const ev: BEvent[] = [];
  const fact = a.fact ?? card.fact;
  const ok = b.subject === 'math' ? !!fact && a.ok && a.value === answerOf(fact) : a.ok && a.value > 0;
  // the Wizard Hat: one wrong answer becomes a retry
  if (!ok && b.gear === 'retry' && !b.used.retry) { b.used.retry = true; return [{ k: 'retry' }]; }
  b.stats.answers++;
  if (fact) b.answered.push({ f: fact, ok, thinkMs: a.thinkMs });
  const value = ok ? (b.subject === 'math' ? answerOf(fact!) : a.value) : 0;
  const fast = ok && (b.subject === 'math' ? a.thinkMs <= b.fastMs : a.thinkMs <= 450 * Math.max(1, value) + 600);
  const perfect = ok && value === b.foe.grump;
  b.foe.grump = Math.max(0, b.foe.grump - value);
  b.stats.cheer += value;
  ev.push({ k: 'cast', card, value, ok, perfect, super: ok && card.super });
  if (ok) {
    b.stats.right++; if (fast) b.stats.fast++;
    b.rights++; b.streak++;
    b.finale += (b.gear === 'royal' ? 2 : 1) + (card.super ? 1 : 0) + (card.element === 'leaf' && has(b, 'blossom') ? 1 : 0) + (card.element === 'tide' && evo(b, 'song') ? 1 : 0);
    if (card.super) { b.dazzled = true; ev.push({ k: 'dazzle' }); }
    // gear: Rocket Sneakers fill an extra star on a fast answer; the Bubble Wand's bubble every 4th
    if (fast && kit(b, 'zoom') && b.finale < FINALE_AT) { b.finale++; ev.push({ k: 'gear', item: 'rocket_sneakers', what: 'Rocket Sneakers', did: '+1 Finale star' }); }
    if (kit(b, 'bubble') && b.rights % 4 === 0) { b.free.push({ by: 'Bubble Wand' }); ev.push({ k: 'gear', item: 'bubble_wand', what: 'Bubble Wand', did: 'bubble shield!' }); }
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
    if (ok && b.role === 'speed' && (b.subject === 'math' ? a.thinkMs < 3000 : fast)) extra('role', 'Dash', 3);
    for (const m of b.team) {
      const k = GLIMMER[m.id].power.kind;
      if (k === 'splash' && ok && a.thinkMs < 4000) extra('glimmer', 'Splash', powerNum(3, lv(m)), m.id);
      if (k === 'ember') extra('glimmer', 'Ember puff', powerNum(4, lv(m)), m.id);
      if (k === 'lanterns' && ok && b.rights % 3 === 0) extra('glimmer', 'Three lanterns', powerNum(10, lv(m), 3), m.id);
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
  const m = MISCHIEF[b.foe.element];
  b.mischiefs++;
  let hit = b.foe.hit;
  if (b.dazzled) { hit = Math.ceil(hit / 2); b.dazzled = false; }
  if (b.frozen) { b.frozen = false; return [{ k: 'mischief', kind: m.kind, name: m.name, damage: 0, result: 'skip', why: 'frozen' }, ...nextTurn(b)]; }
  const free = b.free.shift();
  if (free) return [{ k: 'mischief', kind: m.kind, name: m.name, damage: 0, result: 'skip', why: free.by, id: free.id }, ...nextTurn(b)];
  if (b.role === 'steady' && b.mischiefs % 2 === 0) hit = Math.ceil(hit / 2);
  const seal = has(b, 'coolhead');
  const limitMs = b.subject === 'math' ? 5000 + (seal ? powerNum(2, lv(seal), 8) * 1000 : 0) + (b.gear === 'shieldwall' ? 2000 : 0) : 0;
  const block: Block = { kind: m.kind, name: m.name, hit, limitMs, ...blockPrompt(b) };
  if (b.subject === 'typing') block.limitMs = 2000 + 800 * (block.word?.length ?? 4) + (seal ? powerNum(2, lv(seal), 8) * 1000 : 0) + (b.gear === 'shieldwall' ? 2000 : 0);
  b.block = block;
  b.phase = 'block';
  return [];
}

function blockPrompt(b: Battle): { fact?: Fact; word?: string } {
  if (b.pool.subject === 'math') {
    // a quick one: something already known if there is anything
    const known = b.pool.facts.filter(x => x.stage >= 2);
    return { fact: pick(b.rng, known.length >= 3 ? known : b.pool.facts).f };
  }
  const short = b.pool.words.filter(w => w.length >= 2 && w.length <= 4);
  return { word: pick(b.rng, short.length ? short : b.pool.words) };
}

/** Answer the block prompt. `ok` right (typing: typed with no slips), `ms` how long it took. */
export function block(b: Battle, ok: boolean, ms: number): BEvent[] {
  const bl = b.block;
  if (!bl || b.phase !== 'block') return [];
  b.stats.blocks++;
  if (b.subject === 'math' && bl.fact) b.answered.push({ f: bl.fact, ok, thinkMs: ms });
  // right and in time: blocked. Too late or wrong: it lands
  const result: 'full' | 'none' = ok && ms <= bl.limitMs ? 'full' : 'none';
  // the Hero Cape catches half of a hit that lands
  const caped = result === 'none' && kit(b, 'cape');
  const damage = result === 'full' ? 0 : caped ? Math.ceil(bl.hit / 2) : bl.hit;
  if (damage === 0) b.stats.blocked++;
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
    b.used.secondwind = true; const v = Math.min(b.sparkMax - b.spark, powerNum(10, lv(whale), 3)); b.spark += v; ev.push({ k: 'secondwind', value: v });
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
