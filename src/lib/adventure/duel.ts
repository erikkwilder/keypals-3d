// Family Duel and Rival Ghosts: two players take turns to cheer up one grumpy Glimmer, and whoever
// cheers it up first wins it. Each side plays the Adventure rules (cards, Glimmer powers, the Finale)
// with questions at its own level. To keep it fair and about skill, the cards lie face down until you
// pick one (no hunting for the easy one), and every right answer cheers the same DUEL_CARD whatever the
// question, on bars of the same size: a six-year-old on sums and a grown-up on times tables need just as
// many right answers. Getting them right in a row (for the Finale and rain clouds) and your team of
// Glimmers and gear are what pull you ahead. Both get the same number of turns: if the one who went
// first fills their bar, the other gets a last turn, and if they fill theirs too it's a tie.
// Three right in a row sends a little rain cloud over to the other side: they block it with a quick one
// at the start of their turn, or it washes away a bit of their cheer. The Glimmer itself doesn't throw
// mischief in a duel (it's watching to see who cheers it up), and helpers that would give energy back
// give a little cheer instead, so every Glimmer helps.
import { mulberry32, type Rng } from '../engine/rng';
import { answerOf, type Fact } from '../math/facts';
import { newBattle, play, finale, FINALE_AT, type Battle, type BEvent, type Member, type Pool, type Subject, type Answer } from './battle';
import { GLIMMER, powerNum, type GearKind, type GlimmerId, type RoleId } from './glimmers';
import type { FriendId } from '../art/cast';
import type { Dress, KitKind, Slot } from './gear';

export type SideKind = 'player' | 'guest' | 'ghost';
export type GhostStyle = { acc: number; thinkMs: number; big: number };
export type SideSetup = {
  name: string; buddy: FriendId; kind: SideKind; profileId?: string;
  subject: Subject; pool: Pool; role: RoleId; gear: GearKind | null; team: Member[]; outfit: string; dance: string;
  ghost?: GhostStyle; fastMs?: number;
  /** the hand, back and shoe gear: its powers, and what it looks like */
  kit?: KitKind[]; worn?: Partial<Record<Slot, string>>;
  /** the whole look for the 3D buddy (hat, every slot, nudges) */
  dress?: Dress;
};
export type Side = SideSetup & { b: Battle; rainIn: boolean; sent: number; blocked: number; finales: number; thinkMs: number; big: number; picks: number };
export type DuelPhase = 'pick' | 'rain' | 'finale' | 'won';
export type RainPrompt = { fact?: Fact; word?: string; limitMs: number };
export type Duel = {
  sides: [Side, Side]; turn: 0 | 1; glimmer: GlimmerId; phase: DuelPhase; winner: 0 | 1 | null;
  rng: Rng; turns: number; rain: RainPrompt | null; perfect: boolean;
  /** who went first; the side that has filled its bar while the other has its last turn; a tie */
  first: 0 | 1; filled: 0 | 1 | null; tie: boolean;
};
export type DEvent = BEvent
  | { k: 'sendRain'; to: 0 | 1 }
  | { k: 'rainBlocked'; by?: string; id?: GlimmerId }
  | { k: 'rainHit'; value: number }
  | { k: 'turn'; side: 0 | 1 }
  /** the one who went first has filled their bar: the other gets one last turn to tie */
  | { k: 'lastTurn'; side: 0 | 1 };

/** three right in a row sends a rain cloud over */
export const RAIN_EVERY = 3;
/** each side's bar, and what every right answer fills of it */
export const DUEL_BAR = 100, DUEL_CARD = 10;

export function newDuel(a: SideSetup, b: SideSetup, glimmer: GlimmerId, seed: number, first: 0 | 1 = 0): Duel {
  const g = GLIMMER[glimmer];
  const side = (s: SideSetup, i: number): Side => {
    const max = DUEL_BAR;
    const bt = newBattle({ pool: s.pool, seed: seed + i * 7919, sparkMax: 99, role: s.role, gear: s.gear, team: s.team, foe: { glimmer, rarity: g.rarity, champion: false, element: g.element, grump: max, max, hit: 0 }, fastMs: s.fastMs, kit: s.kit, flat: DUEL_CARD });
    return { ...s, b: bt, rainIn: false, sent: 0, blocked: 0, finales: 0, thinkMs: 0, big: 0, picks: 0 };
  };
  return { sides: [side(a, 0), side(b, 1)], turn: first, glimmer, phase: 'pick', winner: null, rng: mulberry32(seed ^ 0x2f6b), turns: 0, rain: null, perfect: false, first, filled: null, tie: false };
}

export const cur = (d: Duel) => d.sides[d.turn];
/** How far each side has cheered (0..1). */
export const progress = (s: Side) => 1 - s.b.foe.grump / Math.max(1, s.b.foe.max);

/** Play a card for the side whose turn it is. */
export function duelPlay(d: Duel, cardId: number, a: Answer): DEvent[] {
  if (d.phase !== 'pick') return [];
  const s = cur(d);
  const card = s.b.cards.find(c => c.id === cardId);
  if (!card) return [];
  s.thinkMs += a.thinkMs;
  // the Glimmer stays still in a duel: no mischief after the card
  s.b.frozen = true;
  const ev = play(s.b, cardId, a);
  const out: DEvent[] = [];
  let ok = false;
  for (const e of ev) {
    if (e.k === 'mischief') continue;
    if (e.k === 'cast') ok = e.ok;
    if (e.k === 'heal') {
      const v = Math.min(3, e.value, s.b.foe.grump);
      if (v > 0) { s.b.foe.grump -= v; s.b.stats.cheer += v; out.push({ k: 'extra', by: e.by, id: e.id, what: e.what, value: v, item: e.item }); }
      continue;
    }
    if (e.k === 'won') continue;
    out.push(e);
  }
  if (ev.some(e => e.k === 'retry')) return out;
  // Frost Owl: three right in a row freezes the next rain cloud that comes your way
  const owl = s.team.find(m => GLIMMER[m.id].power.kind === 'freeze');
  if (ok && owl && s.b.streak > 0 && s.b.streak % 3 === 0) { s.b.free.push({ by: 'Frost Owl', id: owl.id }); out.push({ k: 'freeze', id: owl.id }); }
  if (s.b.foe.grump <= 0) return full(d, out);
  if (ok && s.b.streak > 0 && s.b.streak % RAIN_EVERY === 0) {
    const to = (1 - d.turn) as 0 | 1;
    d.sides[to].rainIn = true; s.sent++;
    out.push({ k: 'sendRain', to });
  }
  if (s.b.finale >= FINALE_AT) { d.phase = 'finale'; return out; }
  return endTurn(d, out);
}

/** The Finale: the side whose turn it is dances, then the turn passes. */
export function duelFinale(d: Duel): DEvent[] {
  if (d.phase !== 'finale') return [];
  const s = cur(d);
  s.b.phase = 'pick';
  const ev: DEvent[] = finale(s.b).filter(e => e.k !== 'won');
  s.finales++;
  if (s.b.foe.grump <= 0) return full(d, ev);
  return endTurn(d, ev);
}

/** a perfect duel: won without a wrong answer */
const clean = (s: Side) => s.b.stats.right === s.b.stats.answers;
function win(d: Duel, out: DEvent[], side: 0 | 1, tie = false): DEvent[] {
  d.phase = 'won'; d.winner = side; d.tie = tie; d.perfect = clean(d.sides[side]);
  out.push({ k: 'won', perfect: d.perfect });
  return out;
}
/** A bar is full. Whoever went first gives the other a last turn (the same number of turns each); the
 *  one who went second wins straight away, or ties if the first is already full. */
function full(d: Duel, out: DEvent[]): DEvent[] {
  if (d.filled !== null) return win(d, out, d.filled, true);
  if (d.turn === d.first) {
    d.filled = d.turn;
    out.push({ k: 'lastTurn', side: (1 - d.turn) as 0 | 1 });
    return endTurn(d, out);
  }
  return win(d, out, d.turn);
}

function endTurn(d: Duel, out: DEvent[]): DEvent[] {
  // the last turn is over without filling the bar: the one who filled first wins
  if (d.filled !== null && d.turn !== d.filled) return win(d, out, d.filled);
  d.turn = (1 - d.turn) as 0 | 1; d.turns++;
  out.push({ k: 'turn', side: d.turn });
  const n = cur(d);
  n.b.phase = 'pick';
  if (n.rainIn) {
    n.rainIn = false;
    const free = n.b.free.shift();
    if (free) out.push({ k: 'rainBlocked', by: free.by, id: free.id });
    else { d.rain = rainPrompt(n); d.phase = 'rain'; return out; }
  }
  d.phase = 'pick';
  return out;
}

const pickOne = <T>(r: Rng, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
/** A quick one to block a rain cloud: something already known, with the same time as a block in battle. */
function rainPrompt(s: Side): RainPrompt {
  const seal = s.team.find(m => GLIMMER[m.id].power.kind === 'coolhead');
  const bonus = (seal ? powerNum(2, seal.level, 8) * 1000 : 0) + (s.gear === 'shieldwall' ? 2000 : 0);
  if (s.pool.subject === 'math') {
    const known = s.pool.facts.filter(x => x.stage >= 2);
    return { fact: pickOne(s.b.rng, known.length >= 3 ? known : s.pool.facts).f, limitMs: 5000 + bonus };
  }
  const short = s.pool.words.filter(w => w.length >= 2 && w.length <= 4);
  const word = pickOne(s.b.rng, short.length ? short : s.pool.words);
  return { word, limitMs: 2000 + 800 * word.length + bonus };
}

/** Answer the rain cloud's quick one. Blocked: nothing lost. Missed: it washes away a little cheer. */
export function duelRain(d: Duel, ok: boolean, ms: number): DEvent[] {
  if (d.phase !== 'rain' || !d.rain) return [];
  const s = cur(d);
  const ev: DEvent[] = [];
  if (ok && ms <= d.rain.limitMs) { s.blocked++; ev.push({ k: 'rainBlocked' }); }
  else {
    const loss = Math.min(s.b.foe.max - s.b.foe.grump, Math.max(1, Math.round(s.b.foe.max * 0.08)));
    s.b.foe.grump += loss;
    ev.push({ k: 'rainHit', value: loss });
  }
  d.rain = null; d.phase = 'pick';
  return ev;
}

// ---------- a ghost's turn ----------
export type GhostMove = { cardId: number; answer: Answer; typed: string; thinkMs: number };
/** What a ghost does on its turn: which card (the cards are face down, so like anyone it goes for a
 *  strong one when there is one), right or not, and how long it thinks (its real pace, shortened on
 *  screen so nobody waits long). */
export function ghostMove(d: Duel): GhostMove | null {
  const s = cur(d), g = s.ghost;
  if (!g || d.phase !== 'pick' || !s.b.cards.length) return null;
  const r = d.rng;
  const cards = s.b.cards.filter(c => c.fact || c.word);
  const strong = cards.filter(c => c.super);
  const card = strong.length && r() < 0.85 ? pickOne(r, strong) : pickOne(r, cards);
  const ok = r() < Math.min(0.98, g.acc + (card.bloom ? 0.05 : 0));
  const thinkMs = Math.round(g.thinkMs * (0.6 + r() * 0.8));
  if (card.fact) {
    const right = answerOf(card.fact);
    const wrong = Math.max(0, right + (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 2)));
    const v = ok ? right : wrong;
    return { cardId: card.id, answer: { ok, value: v, thinkMs, fact: card.fact }, typed: String(v), thinkMs };
  }
  const w = card.word!;
  return { cardId: card.id, answer: { ok, value: ok ? w.length : 0, thinkMs }, typed: ok ? w : w.slice(0, Math.max(1, Math.floor(w.length / 2))), thinkMs };
}
/** A ghost's go at a rain cloud. */
export function ghostRain(d: Duel): { ok: boolean; ms: number } {
  const s = cur(d), g = s.ghost!, r = d.rng;
  const ms = Math.round(g.thinkMs * (0.4 + r() * 0.5));
  return { ok: r() < g.acc, ms };
}

// ---------- questions for a guest ----------
export type GuestLevel = 'little' | 'plus' | 'times' | 'grown';
export const GUEST_LEVELS: { id: GuestLevel; name: string; math: string; typing: string }[] = [
  { id: 'little', name: 'Just starting', math: '3 + 2', typing: 'cat' },
  { id: 'plus', name: 'Adding up to 20', math: '8 + 7', typing: 'happy' },
  { id: 'times', name: 'Times tables', math: '6 × 4', typing: 'rocket' },
  { id: 'grown', name: 'Grown-up', math: '12 × 8', typing: 'adventure' },
];
/** A guest's questions: math facts at the level they pick, or words of a matching length. */
export function guestPool(level: GuestLevel, subject: Subject, words: string[]): Pool {
  if (subject === 'typing') {
    const [lo, hi] = level === 'little' ? [2, 4] : level === 'plus' ? [4, 6] : level === 'times' ? [5, 8] : [7, 12];
    const ws = [...new Set(words.filter(w => w.length >= lo && w.length <= hi && /^[a-z]+$/.test(w)))];
    return { subject: 'typing', words: ws.length >= 12 ? ws : words.slice(0, 60) };
  }
  const facts: Fact[] = [];
  if (level === 'little') { for (let a = 1; a <= 5; a++) for (let b = 1; b <= 5; b++) facts.push({ a, b, op: '+' }); }
  else if (level === 'plus') { for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) facts.push({ a, b, op: '+' }); }
  else if (level === 'times') { for (const a of [2, 3, 4, 5, 10]) for (let b = 2; b <= 10; b++) facts.push({ a, b }); }
  else { for (let a = 6; a <= 12; a++) for (let b = 6; b <= 12; b++) facts.push({ a, b }); }
  return { subject: 'math', facts: facts.map(f => ({ f, stage: 2 })), open: false };
}
