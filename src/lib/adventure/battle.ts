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
import { ELEMENT, ELEMENTS, GLIMMER, powerNum, strong, type Element, type GearKind, type GlimmerId, type Rarity, type RoleId } from './glimmers';

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
  sun: { kind: 'zap', name: 'Hot flash' }, frost: { kind: 'snow', name: 'Snow flurry' }, tide: { kind: 'rain', name: 'Raincloud' },
  stone: { kind: 'pebbles', name: 'Pebble shower' }, leaf: { kind: 'gust', name: 'Leaf gust' },
};

export type Foe = { glimmer: GlimmerId; rarity: Rarity; champion: boolean; element: Element; grump: number; max: number; hit: number };
export type Member = { id: GlimmerId; level: number };
export type Setup = { pool: Pool; seed: number; sparkMax: number; role: RoleId; gear: GearKind | null; team: Member[]; foe: Foe; fastMs?: number };

export type BEvent =
  | { k: 'cast'; card: Card; value: number; ok: boolean; perfect: boolean; super: boolean }
  | { k: 'extra'; by: 'glimmer' | 'role' | 'gear'; id?: GlimmerId; what: string; value: number }
  | { k: 'heal'; by: 'glimmer' | 'role' | 'gear'; id?: GlimmerId; what: string; value: number }
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
  foe: Foe; cards: Card[]; phase: Phase; block: Block | null;
  streak: number; finale: number; turn: number; nextId: number;
  /** the Grumble skips its next mischief (frozen) / its next one is halved (dazzled) */
  frozen: boolean; dazzled: boolean;
  /** first mischiefs that do nothing (Pebble Shell, Hover) */
  free: { by: string; id?: GlimmerId }[];
  used: { hide: boolean; retry: boolean; glow: boolean; aurora: boolean; secondwind: boolean; swap: boolean };
  rights: number; mischiefs: number; perfect: boolean;
  stats: { answers: number; right: number; fast: number; blocks: number; blocked: number; damage: number; cheer: number };
  /** facts answered (for the fact memory) */
  answered: { f: Fact; ok: boolean; thinkMs: number }[];
};

export const FINALE_AT = 5;
const has = (b: Battle, kind: string) => b.team.find(m => GLIMMER[m.id].power.kind === kind);

export function newBattle(s: Setup): Battle {
  const rng = mulberry32(s.seed);
  const b: Battle = {
    subject: s.pool.subject, pool: s.pool, rng, fastMs: s.fastMs ?? 4000,
    spark: s.sparkMax, sparkMax: s.sparkMax, role: s.role, gear: s.gear, team: s.team.slice(0, 2),
    foe: { ...s.foe }, cards: [], phase: 'pick', block: null,
    streak: 0, finale: 0, turn: 0, nextId: 1, frozen: false, dazzled: false, free: [],
    used: { hide: false, retry: false, glow: false, aurora: false, secondwind: false, swap: false },
    rights: 0, mischiefs: 0, perfect: false,
    stats: { answers: 0, right: 0, fast: 0, blocks: 0, blocked: 0, damage: 0, cheer: 0 },
    answered: [],
  };
  const shell = has(b, 'shell');
  if (shell) b.free.push({ by: 'Pebble Shell', id: shell.id });
  if (s.gear === 'hover') b.free.push({ by: 'Hover' });
  deal(b);
  return b;
}

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
    b.finale += (b.gear === 'royal' ? 2 : 1) + (card.super ? 1 : 0) + (card.element === 'leaf' && has(b, 'blossom') ? 1 : 0);
    if (card.super) { b.dazzled = true; ev.push({ k: 'dazzle' }); }
  } else {
    const fox = has(b, 'hide');
    if (fox && !b.used.hide && b.streak > 0) { b.used.hide = true; ev.push({ k: 'streakKept', id: fox.id }); }
    // five right in a row fills the Finale: a slip starts the row again
    else { b.streak = 0; b.finale = 0; }
  }
  if (perfect) { b.perfect = true; ev.push({ k: 'won', perfect: true }); b.phase = 'won'; return ev; }
  if (b.foe.grump > 0) {
    // extras, each its own little cheer
    const extra = (by: 'glimmer' | 'role' | 'gear', what: string, n: number, id?: GlimmerId) => {
      if (n <= 0 || b.foe.grump <= 0) return;
      const v = Math.min(n, b.foe.grump); b.foe.grump -= v; b.stats.cheer += v;
      ev.push({ k: 'extra', by, what, value: v, id });
    };
    if (ok && b.gear === 'confetti') extra('gear', 'Confetti', 1);
    if (ok && b.role === 'speed' && (b.subject === 'math' ? a.thinkMs < 3000 : fast)) extra('role', 'Dash', 3);
    for (const m of b.team) {
      const k = GLIMMER[m.id].power.kind;
      if (k === 'splash' && ok && a.thinkMs < 4000) extra('glimmer', 'Splash', powerNum(3, m.level), m.id);
      if (k === 'ember') extra('glimmer', 'Ember puff', powerNum(4, m.level), m.id);
      if (k === 'lanterns' && ok && b.rights % 3 === 0) extra('glimmer', 'Three lanterns', powerNum(10, m.level, 3), m.id);
    }
  }
  // healing
  const heal = (by: 'glimmer' | 'role' | 'gear', what: string, n: number, id?: GlimmerId) => {
    const v = Math.min(n, b.sparkMax - b.spark); if (v <= 0) return;
    b.spark += v; ev.push({ k: 'heal', by, what, value: v, id });
  };
  if (ok && card.bloom && b.gear === 'bloomheal') heal('gear', 'Bloom', 2);
  if (ok && b.role === 'helper' && b.streak > 0 && b.streak % 3 === 0) heal('role', 'Helping hand', 3);
  for (const m of b.team) {
    const k = GLIMMER[m.id].power.kind;
    if (k === 'nibble') heal('glimmer', 'Nibble', powerNum(1, m.level, 6), m.id);
    if (k === 'song' && ok && card.element === 'tide') heal('glimmer', 'Whale song', powerNum(3, m.level), m.id);
    if (k === 'blossom' && ok) heal('glimmer', 'Blossom', powerNum(1, m.level, 8), m.id);
    if (k === 'freeze' && ok && b.streak > 0 && b.streak % 3 === 0 && !b.frozen) { b.frozen = true; ev.push({ k: 'freeze', id: m.id }); }
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
  const v = Math.min(b.foe.grump, Math.max(6, Math.round(b.foe.max * 0.3)));
  b.foe.grump -= v; b.stats.cheer += v;
  const ev: BEvent[] = [{ k: 'finale', value: v }];
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
  const limitMs = b.subject === 'math' ? 4000 + (seal ? powerNum(2, seal.level, 8) * 1000 : 0) : 0;
  const block: Block = { kind: m.kind, name: m.name, hit, limitMs, ...blockPrompt(b) };
  if (b.subject === 'typing') block.limitMs = 1600 + 650 * (block.word?.length ?? 4) + (seal ? powerNum(2, seal.level, 8) * 1000 : 0);
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
  const result: 'full' | 'half' | 'none' = !ok ? 'none' : ms <= bl.limitMs ? 'full' : 'half';
  let strength = result === 'full' ? 1 : result === 'half' ? 0.5 : 0;
  if (strength > 0 && b.role === 'builder') strength = Math.min(1, strength * 1.5);
  if (strength > 0 && b.gear === 'shieldwall') strength = Math.min(1, strength * 2);
  const damage = Math.round(bl.hit * (1 - strength));
  if (damage === 0) b.stats.blocked++;
  b.spark = Math.max(0, b.spark - damage);
  b.stats.damage += damage;
  b.block = null;
  const ev: BEvent[] = [{ k: 'mischief', kind: bl.kind, name: bl.name, damage, result: damage === 0 ? 'full' : result }];
  const whale = has(b, 'secondwind');
  if (whale && !b.used.secondwind && b.spark > 0 && b.spark <= b.sparkMax / 3) {
    b.used.secondwind = true; const v = Math.min(b.sparkMax - b.spark, powerNum(10, whale.level, 3)); b.spark += v; ev.push({ k: 'secondwind', value: v });
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
  if (b.used.glow || !has(b, 'glow')) return false;
  b.used.glow = true; return true;
}
