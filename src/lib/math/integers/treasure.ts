// Treasure Grid: the negative numbers arcade game. A treasure map lies on the beach, a coordinate grid on
// the sand. Each clue says where a chest is buried, by its coordinates ("Dig at (3, −2)"), by a walk from a
// flag ("From the flag at (1, 4), go 3 left and 5 down") or by a mirror ("Flip (−2, 3) over the x-axis").
// Tap the crossing and dig before the tide rolls in over the map. A miss sends a sonar ping that says
// what was right (the first number? the second? a swapped pair? a minus sign?), and the tide keeps coming.
// Two minutes a round: first-try digs in a row build a combo, quick ones earn a bonus, three stars by
// score, a best score, and a daily challenge (the same day, the same clues for everyone).
//
// What the map asks grows with what the player has met: the first quadrant only (0 to 8) until the whole
// map (the four quadrants, −5 to 5) has been met; walks once moves on the map are met; mirrors once flips
// are. Each clue is pitched from the player's ability on its skill (math/skills/ability.ts) at about 90%
// right, a timed game. Each first try counts in skill memory for subs already met, and the round pays out
// like any practice; it doesn't open lessons.
import { mulberry32, type Rng } from '../../engine/rng';
import { buddyPal, dayKey, type Profile } from '../../engine/profile';
import { settlePractice, treasureFor, type Settled } from '../../engine/settle';
import { mathOf, type ArcadeRecord } from '../progress';
import { noteSkillAnswers } from '../skills/progress';
import { pitchRung, TARGET, thetaOf } from '../skills/ability';
import { neg } from '../skills/integers';
import type { GridSpec } from '../skills/types';

export type ClueKind = 'point' | 'walk' | 'flip';
export type Pt = { x: number; y: number };
export type Clue = {
  kind: ClueKind;
  /** where the chest is */
  at: Pt;
  /** a walk's flag, or the point a mirror flips */
  from?: Pt;
  /** a walk's moves in order: across (dx) or up and down (dy) */
  legs?: { dx: number; dy: number }[];
  /** a mirror's line: the x-axis (across) or the y-axis (up and down) */
  axis?: 'x' | 'y';
  /** the skill memory key this clue practises */
  key: string;
  points: number;
  /** how long until the tide covers the map */
  tideMs: number;
  /** how hard it was pitched (1..6; 3 with no ability to go by) */
  rung: number;
};

export const GAME_ID = 'treasure-grid';
export const ROUND_MS = 120_000;
/** score for one, two and three stars */
export const STAR_AT = [600, 1500, 2600] as const;
const POINTS: Record<ClueKind, number> = { point: 100, walk: 140, flip: 160 };
const TIDE: Record<ClueKind, number> = { point: 20_000, walk: 30_000, flip: 26_000 };
/** dug this soon after the clue: a quick bonus */
export const QUICK_MS = 6000;
export const QUICK_BONUS = 40;
/** the first quadrant's map, and the whole map */
export const SMALL: GridSpec = { xMin: 0, xMax: 8, yMin: 0, yMax: 8 };
export const WHOLE: GridSpec = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };

const int = (rng: Rng, lo: number, hi: number) => Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const range = (lo: number, hi: number) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);
export const pairText = (p: Pt) => `(${neg(p.x)}, ${neg(p.y)})`;

/** What the player has met in this area's memory. */
function met(p: Profile, prefix: string): boolean {
  return Object.entries(mathOf(p).skills ?? {}).some(([k, s]) => k.startsWith(prefix) && ((s.stage ?? 0) > 0 || (s.seen ?? 0) > 0));
}
/** The map this player plays on: the whole map once the four quadrants are met (or anything from grade 6
 *  on the number line, which needs them), else the first quadrant. */
export const boardFor = (p: Profile): GridSpec => (met(p, 'in-quad:') || met(p, 'in-dist:') || met(p, 'in-add:') ? WHOLE : SMALL);
/** The kinds of clue this player can get. */
export function kindsFor(p: Profile): ClueKind[] {
  const out: ClueKind[] = ['point'];
  if (met(p, 'in-plot:move') || met(p, 'in-quad:') || met(p, 'in-dist:')) out.push('walk');
  if (met(p, 'in-quad:flip')) out.push('flip');
  return out;
}
/** How hard clues should be for this player: their ability on the map skill of their board. */
export function levelFor(p: Profile, board: GridSpec): number {
  const m = mathOf(p);
  return thetaOf(m, board.xMin < 0 ? 'in-quad' : 'in-plot', Date.now(), !!p.settings.grown);
}

/** The i-th clue of a round: the first two are plain coordinates, then any kind the player has met, each
 *  pitched from their level (`level`). The rungs: 1-2 no zeros, one minus sign at most · 3 anything · 4-6
 *  walks of three moves and points on an axis. Never loops. */
export function makeClue(rng: Rng, i: number, board: GridSpec, kinds: readonly ClueKind[], level?: number): Clue {
  const pool: ClueKind[] = i < 2 ? ['point'] : kinds.filter(k => k !== 'point' || rng() < 0.6);
  const kind: ClueKind = pick(rng, pool.length ? pool : ['point']);
  const r = level === undefined ? 3 : pitchRung(level, TARGET.quick, rng);
  const four = board.xMin < 0;
  const xs = range(board.xMin, board.xMax).filter(v => r >= 3 || v !== 0), ys = range(board.yMin, board.yMax).filter(v => r >= 3 || v !== 0);
  // the chest: on the whole map, nearly always somewhere with a minus sign
  let at: Pt = { x: pick(rng, xs), y: pick(rng, ys) };
  if (four && at.x >= 0 && at.y >= 0 && rng() < 0.85) at = rng() < 0.5 ? { x: -at.x || -1, y: at.y } : { x: at.x, y: -at.y || -1 };
  if (four && r <= 2 && at.x < 0 && at.y < 0) at = { x: -at.x, y: at.y };
  const key = four ? (kind === 'flip' ? 'in-quad:flip' : 'in-quad:plot') : kind === 'walk' ? 'in-plot:move' : 'in-plot:plot';
  const base = { kind, key, points: POINTS[kind], tideMs: TIDE[kind] - (r >= 5 ? 3000 : 0), rung: r };
  if (kind === 'flip' && four) {
    const axis: 'x' | 'y' = rng() < 0.5 ? 'x' : 'y';
    // the chest's mirror over the line must be somewhere else: the flipped number isn't 0
    const t: Pt = axis === 'x' ? { x: at.x, y: at.y || pick(rng, [-2, 2]) } : { x: at.x || pick(rng, [-2, 2]), y: at.y };
    const from: Pt = axis === 'x' ? { x: t.x, y: -t.y } : { x: -t.x, y: t.y };
    return { ...base, at: t, from, axis };
  }
  if (kind === 'walk') {
    // the flag somewhere else on the map, the walk across then up or down (three moves on the higher rungs)
    const fx = pick(rng, range(board.xMin, board.xMax).filter(v => v !== at.x)), fy = pick(rng, range(board.yMin, board.yMax).filter(v => v !== at.y));
    const dx = at.x - fx, dy = at.y - fy;
    const legs = [{ dx, dy: 0 }, { dx: 0, dy }];
    if (r >= 4) {
      // the stretch: overshoot across, then come back after the up-or-down move
      const backs = [-2, -1, 1, 2].filter(b => Math.sign(b) !== Math.sign(dx) && fx + dx - b >= board.xMin && fx + dx - b <= board.xMax);
      if (backs.length) { const b = pick(rng, backs); legs.splice(0, 1, { dx: dx - b, dy: 0 }); legs.push({ dx: b, dy: 0 }); }
    }
    return { ...base, at, from: { x: fx, y: fy }, legs };
  }
  return { ...base, kind: 'point', key: four ? 'in-quad:plot' : 'in-plot:plot', points: POINTS.point, tideMs: TIDE.point - (r >= 5 ? 3000 : 0), at };
}

const leg = (l: { dx: number; dy: number }) => (l.dx ? `${Math.abs(l.dx)} ${l.dx > 0 ? 'right' : 'left'}` : `${Math.abs(l.dy)} ${l.dy > 0 ? 'up' : 'down'}`);
/** The clue in words. */
export function clueText(c: Clue): string {
  if (c.kind === 'walk') { const ls = c.legs!.map(leg); return `From the flag at ${pairText(c.from!)}, go ${ls.slice(0, -1).join(', ')} and ${ls.at(-1)}.`; }
  if (c.kind === 'flip') return `Flip ${pairText(c.from!)} over the ${c.axis}-axis.`;
  return `Dig at ${pairText(c.at)}.`;
}
/** A short version for the clue card's big line. */
export function clueShort(c: Clue): string {
  if (c.kind === 'walk') return c.legs!.map(leg).join(', then ');
  if (c.kind === 'flip') return `Mirror over the ${c.axis}-axis`;
  return pairText(c.at);
}

/** A sonar ping after a miss: what was right, and how close. `heat` 0 (far) to 1 (next door). */
export function sonar(c: Clue, dug: Pt, before?: Pt): { text: string; heat: number } {
  const d = Math.max(Math.abs(dug.x - c.at.x), Math.abs(dug.y - c.at.y));
  const heat = Math.max(0, 1 - (d - 1) / 6);
  if (dug.x === c.at.y && dug.y === c.at.x && dug.x !== dug.y) return { text: 'Swapped! The first number goes across, the second goes up or down.', heat };
  if (dug.x === -c.at.x && dug.y === c.at.y && dug.x !== 0) return { text: `Check the sign of the first number: ${c.at.x < 0 ? 'minus goes left' : 'plus goes right'}.`, heat };
  if (dug.y === -c.at.y && dug.x === c.at.x && dug.y !== 0) return { text: `Check the sign of the second number: ${c.at.y < 0 ? 'minus goes down' : 'plus goes up'}.`, heat };
  if (dug.x === c.at.x) return { text: 'Across is right! Now check up or down.', heat };
  if (dug.y === c.at.y) return { text: 'Up and down is right! Now check across.', heat };
  if (before) {
    const was = Math.max(Math.abs(before.x - c.at.x), Math.abs(before.y - c.at.y));
    if (d < was) return { text: 'Warmer! Read the clue again.', heat };
    if (d > was) return { text: 'Colder! Read the clue again.', heat };
  }
  return { text: d <= 2 ? 'So close! Read the clue again.' : 'Not here. Read the clue again.', heat };
}
/** How the clue works out, for a gentle hint after two misses. */
export function howTo(c: Clue): string {
  if (c.kind === 'walk') { let x = c.from!.x, y = c.from!.y; const steps = c.legs!.map(l => { x += l.dx; y += l.dy; return pairText({ x, y }); }); return `${pairText(c.from!)} → ${steps.join(' → ')}.`; }
  if (c.kind === 'flip') return c.axis === 'x' ? `Over the x-axis the second number changes sign: ${pairText(c.at)}.` : `Over the y-axis the first number changes sign: ${pairText(c.at)}.`;
  return `${Math.abs(c.at.x)} ${c.at.x < 0 ? 'left' : 'right'}, then ${Math.abs(c.at.y)} ${c.at.y < 0 ? 'down' : 'up'}: ${pairText(c.at)}.`;
}

/** The combo multiplier for a clue dug with `combo` first-try digs before it in a row. */
export const comboMult = (combo: number) => 1 + Math.min(combo, 8) * 0.25;
/** Points for a found chest: first try or not, the combo, and how quick. */
export const clueScore = (c: Clue, combo: number, ms: number, firstTry: boolean) => Math.round((firstTry ? c.points : c.points * 0.5) * comboMult(combo)) + (ms <= QUICK_MS ? QUICK_BONUS : 0);
export const starsFor = (score: number): 0 | 1 | 2 | 3 => (score >= STAR_AT[2] ? 3 : score >= STAR_AT[1] ? 2 : score >= STAR_AT[0] ? 1 : 0);

/** Today's challenge: the same seed for everyone on this day. */
export function dailySeed(at: number): number {
  let h = 2166136261;
  for (const ch of `treasure-${dayKey(at)}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
/** A round's clues come from one seed (the daily challenge's or a random one). */
export function clueMaker(seed: number, board: GridSpec, kinds: readonly ClueKind[], level?: number) {
  const rng = mulberry32(seed);
  let i = 0;
  return () => makeClue(rng, i++, board, kinds, level);
}

export const treasureOf = (p: Profile): ArcadeRecord => mathOf(p).arcade?.[GAME_ID] ?? { best: 0, stars: 0, plays: 0 };
export const dailyBestOf = (p: Profile, at = Date.now()) => { const d = treasureOf(p).daily; return d && d.key === dayKey(at) ? d.best : 0; };

export type TreasureRun = {
  score: number; found: number; washed: number; bestCombo: number; ms: number; at: number; daily: boolean;
  /** each clue's first dig (and the rung it was pitched at) */
  answers: { key: string; ok: boolean; thinkMs: number; rung?: number }[];
};
export type TreasureOutcome = Settled & { profile: Profile; stars: 0 | 1 | 2 | 3; newBest: boolean; newDaily: boolean; best: number };

/** A finished round: skill memory for the subs already met, the record, and the practice payout. */
export function applyTreasure(p0: Profile, run: TreasureRun): TreasureOutcome {
  const p: Profile = structuredClone(p0);
  const m = (p.math = mathOf(p));
  const mem = m.skills ?? {};
  const known = run.answers.filter(x => (mem[x.key]?.stage ?? 0) > 0 || (mem[x.key]?.seen ?? 0) > 0);
  if (known.length) noteSkillAnswers(m, known, run.at);
  const stars = starsFor(run.score);
  const rec = ((m.arcade ??= {})[GAME_ID] ??= { best: 0, stars: 0, plays: 0 });
  const newBest = run.score > rec.best;
  rec.best = Math.max(rec.best, run.score); rec.stars = Math.max(rec.stars, stars); rec.plays++;
  rec.bestCombo = Math.max(rec.bestCombo ?? 0, run.bestCombo);
  let newDaily = false;
  if (run.daily) {
    const k = dayKey(run.at);
    if (rec.daily?.key !== k) rec.daily = { key: k, best: 0 };
    newDaily = run.score > rec.daily.best;
    rec.daily.best = Math.max(rec.daily.best, run.score);
  }
  const pal = buddyPal(p);
  pal.runs++;
  if (stars === 3) pal.stars3++;
  // right answers warm the eggs like a trip's (a chest is worth a couple of facts)
  const done = settlePractice(p, { at: run.at, ms: run.ms, finished: true, stars, medals: stars === 3 ? ['three'] : [], right: Math.round(run.found * 2), xp: () => Math.round((25 + stars * 12 + Math.min(12, run.found) * 2) * (p.settings.grown ? 0.8 : 1)) , treasure: treasureFor(run.score, STAR_AT[2]) });
  return { ...done, profile: p, stars, newBest, newDaily, best: rec.best };
}
