// Clock Rush: the measuring arcade game, in the great clockwork hall. Clocks ride in on spinning gears
// and you deal with each before it ticks past:
//   read   a big clock lands on its gear: tap the time it shows
//   catch  three clocks roll along the gear belt: tap the one that shows the time on the ticket
//   set    a clock arrives showing the wrong time: drag its hands to the ticket's time
//   train  a toy train leaves at one time and the ride takes so long: which ticket says when it arrives?
// A round is 100 seconds: right ones in a row build a combo (each one worth more), quick ones a bonus,
// and a clock that ticks past costs only the combo. Three stars by score, a best score, and a daily
// challenge (the same day, the same clocks for everyone).
//
// Every question is a real one from the area's time skills (skills/measure.ts: o'clock and half past,
// five minutes, to the minute, how long), each pitched from the child's ability on that skill at about
// 90% right (a timed game). The skills join as the child meets them; first tries count in skill memory
// for the subs already met, and the round pays out like any practice.
import { mulberry32, type Rng } from '../../engine/rng';
import { buddyPal, dayKey, type Profile } from '../../engine/profile';
import { settlePractice, type Settled } from '../../engine/settle';
import { mathOf, type ArcadeRecord } from '../progress';
import { noteSkillAnswers } from '../skills/progress';
import { makeAt, pitchRung, TARGET, thetaOf } from '../skills/ability';
import { SKILL } from '../skills/registry';
import type { Item, Part } from '../skills/types';
import { clockMins } from '../skills/measure';

export const GAME_ID = 'clock-rush';
export const ROUND_MS = 100_000;
/** score for one, two and three stars */
export const STAR_AT = [600, 1500, 2600] as const;
export type OrderKind = 'read' | 'catch' | 'set' | 'train';
export type Order = {
  kind: OrderKind;
  /** the skill question behind it (its prompt, choices and answer) */
  item: Item;
  /** catch: the time to find, and the clocks rolling by (one of them right) */
  target?: [number, number];
  clocks?: { id: string; h: number; m: number }[];
  points: number;
  /** how long it waits before ticking past */
  patienceMs: number;
  rung: number;
};
const POINTS: Record<OrderKind, number> = { read: 100, catch: 120, set: 170, train: 150 };
const PATIENCE: Record<OrderKind, number> = { read: 13_000, catch: 13_000, set: 26_000, train: 22_000 };
/** answered this soon: a quick bonus */
export const QUICK_MS = 5000;
export const QUICK_BONUS = 40;
const TIME_SKILLS = ['ms-hour', 'ms-five', 'ms-minute', 'ms-elapsed'] as const;
type TimeSkill = (typeof TIME_SKILLS)[number];

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];

/** The time skills this player gets: o'clock always; the others once they've met them (a question of
 *  them answered anywhere) or their ability says they're ready. */
export function skillsFor(p: Profile): TimeSkill[] {
  const m = mathOf(p), mem = m.skills ?? {}, now = Date.now(), g = !!p.settings.grown;
  const met = (s: string) => Object.entries(mem).some(([k, st]) => k.startsWith(`${s}:`) && ((st.stage ?? 0) > 0 || (st.seen ?? 0) > 0));
  return TIME_SKILLS.filter((s, i) => i === 0 || met(s) || thetaOf(m, s, now, g) >= 3.5);
}
/** Each time skill's ability, for pitching (math/skills/ability.ts). */
export function levelsFor(p: Profile): Partial<Record<TimeSkill, number>> {
  const m = mathOf(p), now = Date.now(), g = !!p.settings.grown;
  return Object.fromEntries(TIME_SKILLS.map(s => [s, thetaOf(m, s, now, g)]));
}
/** a choice's time, from its digital-time picture */
function timeOf(parts: Part[]): [number, number] | null {
  const p = parts[0];
  return p?.t === 'meas' && p.m.kind === 'time' ? [p.m.h, p.m.m] : null;
}

/** The i-th order of a round: the first ones are o'clock and gentle, then any time skill the player has
 *  (the newest a little more often), each at the rung its ability points to (never the words-only top
 *  rung: a timed game reads digits). Never loops. */
export function makeOrder(rng: Rng, i: number, skills: readonly TimeSkill[], levels?: Partial<Record<TimeSkill, number>>): Order {
  const skill: TimeSkill = i < 2 ? 'ms-hour' : rng() < 0.35 ? skills[skills.length - 1] : pick(rng, skills);
  const th = levels?.[skill];
  const r = Math.min(5, th === undefined ? 2 : pitchRung(th, TARGET.quick, rng));
  const s = SKILL[skill];
  if (skill === 'ms-elapsed') {
    const item = makeAt(s, rng, rng() < 0.75 ? 'later' : 'before', Math.min(r, 5));
    return { kind: 'train', item, points: POINTS.train, patienceMs: PATIENCE.train, rung: r };
  }
  const kind: OrderKind = i >= 3 && rng() < 0.2 ? 'set' : i % 2 === 0 ? 'catch' : 'read';
  if (kind === 'set') {
    const item = makeAt(s, rng, 'set', r);
    return { kind, item, points: POINTS.set, patienceMs: PATIENCE.set, rung: r };
  }
  const sub = skill === 'ms-hour' ? (r <= 1 || rng() < 0.5 ? 'oclock' : 'half') : 'read';
  const item = makeAt(s, rng, sub, r);
  if (kind === 'catch') {
    const right = item.choices!.find(c => c.id === (item.answer as { id: string }).id)!;
    const target = timeOf(right.parts) ?? [12, 0];
    const clocks = item.choices!.map(c => { const t = timeOf(c.parts) ?? [12, 0]; return { id: c.id, h: t[0], m: t[1] }; });
    return { kind, item, target, clocks, points: POINTS.catch, patienceMs: PATIENCE.catch, rung: r };
  }
  return { kind, item, points: POINTS.read, patienceMs: PATIENCE.read, rung: r };
}
/** A round's orders come from one seed (today's challenge, or a random one). */
export function orderMaker(seed: number, skills: readonly TimeSkill[], levels?: Partial<Record<TimeSkill, number>>) {
  const rng = mulberry32(seed);
  let i = 0;
  return () => makeOrder(rng, i++, skills, levels);
}
/** Whether an answer is right (a clock set right on any lap of the hands counts). */
export function rightAnswer(o: Order, a: import('../skills/types').Answer): boolean { return SKILL[o.item.skill].check(o.item, a); }
/** A catch order: the time of a clock, in 12-hour minutes */
export const clockKey = (h: number, m: number) => clockMins(h, m);

export const comboMult = (combo: number) => 1 + Math.min(combo, 8) * 0.25;
export const orderScore = (o: Order, combo: number, tookMs: number) => Math.round(o.points * comboMult(combo)) + (tookMs <= QUICK_MS ? QUICK_BONUS : 0);
export const starsFor = (score: number): 0 | 1 | 2 | 3 => (score >= STAR_AT[2] ? 3 : score >= STAR_AT[1] ? 2 : score >= STAR_AT[0] ? 1 : 0);

/** Today's challenge: the same seed for everyone on this day. */
export function dailySeed(at: number): number {
  let h = 2166136261;
  for (const c of `clock-rush-${dayKey(at)}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export const rushOf = (p: Profile): ArcadeRecord => mathOf(p).arcade?.[GAME_ID] ?? { best: 0, stars: 0, plays: 0 };
export const dailyBestOf = (p: Profile, at = Date.now()) => { const d = rushOf(p).daily; return d && d.key === dayKey(at) ? d.best : 0; };

export type RushRun = {
  score: number; done: number; missed: number; bestCombo: number; ms: number; at: number; daily: boolean;
  /** each order's first try (and the rung it was pitched at) */
  answers: { key: string; ok: boolean; thinkMs: number; rung?: number }[];
};
export type RushOutcome = Settled & { profile: Profile; stars: 0 | 1 | 2 | 3; newBest: boolean; newDaily: boolean; best: number };

/** A finished round: skill memory for the subs already met, the record, and the practice payout. */
export function applyRush(p0: Profile, run: RushRun): RushOutcome {
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
  const done = settlePractice(p, { at: run.at, ms: run.ms, finished: true, stars, medals: stars === 3 ? ['three'] : [], right: Math.round(run.done * 2), xp: () => Math.round((25 + stars * 12 + Math.min(12, run.done) * 2) * (p.settings.grown ? 0.8 : 1)) });
  return { ...done, profile: p, stars, newBest, newDaily, best: rec.best };
}
