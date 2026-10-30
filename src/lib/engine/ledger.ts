// What a player earned, and when, and from what: a short list kept with the player (the last 200 times
// something came in), for My progress's "What I earned". Nothing here pays anything out: every change to
// a player goes through game.update or game.replaceProfile, and those compare the player before and after
// (ledgerSnap, then ledgerNote) and write down what came in: stars (a lesson's or a trip's, from its
// history line), shells (and shells spent), eggs, medals, stickers and Glimmers. So a new game earns its
// line here without doing anything. Old saves have no list; My progress fills in from the lesson and trip
// history, the sticker book and the Glimmers' dates, which every save already has.
// (Only types are imported: the game's first page loads this.)
import type { Profile } from './profile';

export type LedgerEntry = {
  at: number;
  /** where it came from, in words ("Typing lesson", "Adventure battle", "Shop") */
  from: string;
  /** which one exactly, for its name on the page: 'typing:village-3', 'math:twins-2', 'arcade:pizza', 'battle:meadow-0' */
  ref?: string;
  stars?: number;
  /** shells in (or, below zero, spent) */
  shells?: number;
  eggs?: number;
  medals?: string[];
  stickers?: string[];
  glimmers?: string[];
  /** what shells bought (the Shop's keys, shop/shop.ts: 'island:cottage', 'wear:party_hat'), with its spending */
  bought?: string[];
};
export const LEDGER_CAP = 200;
/** one game's results come in a few steps (the run, then a reward tapped open): they make one line */
const SAME_MS = 120_000;

export type LedgerSnap = {
  shells: number; eggs: Set<string>; glimmers: Set<string>;
  /** null: no sticker book yet (the first read builds it from old saves: that isn't earning) */
  medals: Record<string, number> | null; stickers: Set<string> | null;
  hist: number; mhist: number;
};

type Raw = {
  adventure?: { shells?: number; incubator?: ({ id: string } | null)[]; nest?: { id: string }[]; glimmers?: Record<string, unknown> };
  book?: { medals?: Record<string, number>; stickers?: Record<string, unknown> };
  history?: { at: number }[]; math?: { history?: { at: number }[] };
};

export function ledgerSnap(p: Profile): LedgerSnap {
  const r = p as unknown as Raw, a = r.adventure;
  return {
    shells: a?.shells ?? 0,
    eggs: new Set([...(a?.incubator ?? []), ...(a?.nest ?? [])].filter((e): e is { id: string } => !!e).map(e => e.id)),
    glimmers: new Set(Object.keys(a?.glimmers ?? {})),
    medals: r.book ? { ...(r.book.medals ?? {}) } : null,
    stickers: r.book ? new Set(Object.keys(r.book.stickers ?? {})) : null,
    hist: r.history?.at(-1)?.at ?? 0,
    mhist: r.math?.history?.at(-1)?.at ?? 0,
  };
}

/** Write down what came in since `before` (nothing if nothing did). A lesson or trip names itself; anything
 *  else is named by `where` (the screen it happened on). Returns the line written (or added to). */
export function ledgerNote(p: Profile, before: LedgerSnap, where: { from: string; ref?: string; bought?: string[] }, at = Date.now()): LedgerEntry | null {
  const now = ledgerSnap(p);
  const e: LedgerEntry = { at, from: where.from, ...(where.ref ? { ref: where.ref } : {}) };
  // a lesson or a trip just played: its stars, and its name
  const runs = [
    ...(p.history ?? []).filter(h => h.at > before.hist).map(h => ({ ...h, kind: 'typing' })),
    ...(p.math?.history ?? []).filter(h => h.at > before.mhist).map(h => ({ ...h, kind: 'math' })),
  ];
  if (runs.length) {
    const last = runs[runs.length - 1];
    e.stars = runs.reduce((t, h) => t + (h.stars ?? 0), 0);
    e.from = last.kind === 'typing' ? 'Typing lesson' : 'Math trip';
    e.ref = `${last.kind}:${last.lessonId}`;
  }
  const shells = Math.round(now.shells - before.shells);
  if (shells) e.shells = shells;
  const eggs = [...now.eggs].filter(id => !before.eggs.has(id)).length;
  if (eggs) e.eggs = eggs;
  const glimmers = [...now.glimmers].filter(id => !before.glimmers.has(id));
  if (glimmers.length) e.glimmers = glimmers;
  if (before.medals && now.medals) {
    const won: string[] = [];
    for (const [id, n] of Object.entries(now.medals)) for (let k = before.medals[id] ?? 0; k < n && won.length < 20; k++) won.push(id);
    if (won.length) e.medals = won;
  }
  if (before.stickers && now.stickers) {
    const got = [...now.stickers].filter(id => !before.stickers!.has(id));
    if (got.length) e.stickers = got;
  }
  // what was bought (only when shells went out for it)
  if (where.bought?.length && shells < 0) e.bought = [...where.bought];
  if (!e.stars && !e.shells && !e.eggs && !e.glimmers && !e.medals && !e.stickers) return null;
  const list = (p.ledger ??= []);
  // the same game's next step (its reward opened on the results card): onto its line
  const prev = list.at(-1);
  if (prev && prev.from === e.from && (!e.ref || prev.ref === e.ref) && at - prev.at < SAME_MS && !(e.stars && prev.stars !== undefined)) {
    if (e.stars) prev.stars = (prev.stars ?? 0) + e.stars;
    if (e.shells) prev.shells = (prev.shells ?? 0) + e.shells;
    if (e.eggs) prev.eggs = (prev.eggs ?? 0) + e.eggs;
    for (const k of ['glimmers', 'medals', 'stickers', 'bought'] as const) if (e[k]) prev[k] = [...(prev[k] ?? []), ...e[k]!];
    return prev;
  }
  list.push(e);
  if (list.length > LEDGER_CAP) list.splice(0, list.length - LEDGER_CAP);
  return e;
}

/** where something happened, by the screen showing (results come after the game: the same words) */
const FROM: Record<string, string> = {
  run: 'Typing lesson', results: 'Typing lesson', mathRun: 'Math trip', mathResults: 'Math trip', skillRun: 'Math trip', skillResults: 'Math trip',
  learn: 'Learning a trick', battle: 'Adventure battle', adventure: 'Adventure', duel: 'Family Duel', rivals: 'Rival Ghosts', glimmers: 'Glimmers',
  eggs: 'Eggs', arcade: 'Arcade', arcadePlay: 'Arcade game', pizza: 'Pizza Rush', builder: 'Number Builder', market: 'Market Dash', clockrush: 'Clock Rush',
  shifter: 'Shape Shifter', shapebuilder: 'Shape Builder', smoothie: 'Smoothie Stand', treasure: 'Treasure Grid', showdown: 'Spinner Showdown', balance: 'Balance Beam',
  bench: 'Measuring Bench', drop: 'Glimmer Drop', playground: 'Playground', island: 'My Sky Island', stickers: 'Sticker book', garden: 'Fact Garden', map: 'Practice',
  shop: 'Shop', closet: 'Wardrobe', keypals: 'Keypals', dances: 'Dances', way: 'Practice', topic: 'Practice', path: 'My path',
};
/** The words (and the exact thing) for the screen showing now. */
export function ledgerWhere(s: { screen: string; arcadeGame?: string; battleNode?: string | null }): { from: string; ref?: string } {
  const from = FROM[s.screen] ?? 'Playing';
  if (s.screen === 'arcadePlay' && s.arcadeGame) return { from, ref: `arcade:${s.arcadeGame}` };
  if (s.screen === 'battle' && s.battleNode) return { from, ref: `battle:${s.battleNode}` };
  return { from };
}
