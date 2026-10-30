// What a child did, activity by activity, so class work can count it: every trip, typing lesson and
// arcade round adds one short entry to the player's own save (`classwork`), worked out by comparing the
// player before and after (game.replaceProfile hands both here). An entry says what was played, for how
// long, and how many questions were answered right on each skill. Assignment progress, the class
// reports and this week's numbers for the boards are all read from these entries.
//
// Entries are kept by time in an object (not a list), so when two computers' copies of a player are
// combined (state/merge.ts) every entry from both is kept and none is counted twice. The newest 300, at
// most 200 days old, are kept: about 40 KB at most.
import { dayKey, type Profile } from '../engine/profile';
import { parseFact } from '../math/facts';
import { splitKey } from '../math/skills/registry';
import { SKILL_LESSON } from '../math/skills/course';
import { ISLAND, NODE } from '../adventure/state';

export type EventKind = 'skill' | 'facts' | 'typing' | 'arcade' | 'game' | 'play' | 'learn' | 'battle';
/** One activity. Short keys: there are a few hundred of these in a save. */
export type ClassEvent = {
  /** when it ended */
  at: number;
  k: EventKind;
  /** the lesson, trip or game */
  l: string;
  /** time spent */
  ms: number;
  /** answered right, and answered (typing: words typed right, and words) */
  r: number; n: number;
  /** each math skill's share: right and answered */
  s?: Record<string, { r: number; n: number }>;
  /** stars on this one */
  st?: number;
  /** finished it (to the end) */
  f?: number;
  /** a battle won: the world it was in (a stop on its map cleared), for My path and a teacher's units */
  w?: string;
};
export type ClassWork = { ev: Record<string, ClassEvent> };
/** Board settings a grown-up chose for this player (Grown-ups screen). */
export type BoardPrefs = { world?: boolean; alias?: string; id?: string };
/** A player with the class fields (they ride along in the save like any other field). */
export type ClassProfile = Profile & { classwork?: ClassWork; boards?: BoardPrefs };

export const EVENT_CAP = 300;
export const EVENT_DAYS = 200;
const DAY = 86400000;

/** The fact strands as skills: a fact's sign tells which. */
const FACT_SKILL: Record<string, string> = { '+': 'add-facts', '-': 'sub-facts', x: 'mult-facts', '/': 'div-facts' };
export const factSkillOf = (factId: string) => FACT_SKILL[parseFact(factId).op ?? 'x'];

type Stat = { right?: number; wrong?: number };
/** Right and answered since `before`, memory by memory, added up per skill. */
function deltas(after: Record<string, Stat> | undefined, before: Record<string, Stat> | undefined, skillOf: (key: string) => string | undefined, into: Record<string, { r: number; n: number }>) {
  for (const [key, a] of Object.entries(after ?? {})) {
    const b = before?.[key];
    const r = Math.max(0, (a?.right ?? 0) - (b?.right ?? 0)), w = Math.max(0, (a?.wrong ?? 0) - (b?.wrong ?? 0));
    if (!r && !w) continue;
    const sk = skillOf(key);
    if (!sk) continue;
    const t = (into[sk] ??= { r: 0, n: 0 });
    t.r += r; t.n += r + w;
  }
}
const lastAt = (xs: { at: number }[] | undefined) => xs?.length ? xs[xs.length - 1].at : 0;

/** The activity that turned `before` into `after`, or null if nothing was played. */
export function activityOf(before: Profile | undefined, after: Profile, now = Date.now()): ClassEvent | null {
  const mb = before?.math, ma = after.math;
  const s: Record<string, { r: number; n: number }> = {};
  deltas(ma?.skills, mb?.skills, k => splitKey(k).skill || undefined, s);
  deltas(ma?.facts, mb?.facts, factSkillOf, s);
  const today = dayKey(now);
  const dayMs = Math.max(0, (after.days?.[today]?.ms ?? 0) - (before?.days?.[today]?.ms ?? 0));
  let k: EventKind | null = null, l = '', ms = dayMs, r = 0, n = 0, st: number | undefined, f: number | undefined, w: string | undefined;

  const th = after.history?.[after.history.length - 1];
  const mh = ma?.history?.[ma.history.length - 1];
  if (th && th.at !== lastAt(before?.history)) {
    // a typing lesson: words typed, and how many of them right
    k = 'typing'; l = th.lessonId; st = th.stars; ms = dayMs || th.ms;
    n = Math.max(0, (after.totals?.words ?? 0) - (before?.totals?.words ?? 0)) || Math.round((th.wpm * th.ms) / 60000);
    r = Math.round(n * Math.max(0, Math.min(1, th.acc)));
    const fb = before?.lessons?.[l]?.finishes ?? 0, fa = after.lessons?.[l]?.finishes ?? 0;
    if (fa > fb) f = 1;
  } else if (mh && mh.at !== lastAt(mb?.history)) {
    // a math trip: a skill trip (fractions and on) or a facts trip
    l = mh.lessonId; k = SKILL_LESSON[l] || l.startsWith('class-') ? 'skill' : 'facts'; st = mh.stars; ms = dayMs || mh.ms;
    const fb = mb?.lessons?.[l]?.finishes ?? 0, fa = ma?.lessons?.[l]?.finishes ?? 0;
    if (fa > fb) f = 1;
  } else {
    const ab = before?.arcade ?? {}, aa = after.arcade ?? {};
    const round = (Object.keys(aa) as (keyof typeof aa)[]).find(g => (aa[g]?.plays ?? 0) > (ab[g]?.plays ?? 0));
    if (round) { k = 'arcade'; l = round; st = undefined; f = 1; }
    else {
      const gb = mb?.arcade ?? {}, ga = ma?.arcade ?? {};
      const g = Object.keys(ga).find(id => (ga[id]?.plays ?? 0) > (gb[id]?.plays ?? 0));
      const learnedNow = (ma?.learned ?? []).find(id => !(mb?.learned ?? []).includes(id));
      const db = before?.adventure?.day, da = after.adventure?.day;
      const battled = !!da && da.answers > (db && db.key === da.key ? db.answers : 0);
      if (g) { k = 'game'; l = g; f = 1; }
      else if (learnedNow) { k = 'learn'; l = learnedNow; f = 1; }
      else if (battled) {
        // a battle (or a duel): its answers, and its minutes from the Adventure's own clock
        k = 'battle'; l = 'adventure';
        const same = db && db.key === da.key;
        ms = dayMs || Math.max(0, da.ms - (same ? db.ms : 0));
        if (!Object.keys(s).length) { r = Math.max(0, da.right - (same ? db.right : 0)); n = Math.max(0, da.answers - (same ? db.answers : 0)); }
        // won: a stop on the map cleared, and which world it was in
        const nb = before?.adventure?.nodes ?? {}, na = after.adventure?.nodes ?? {};
        const node = Object.keys(na).find(id => (na[id] ?? 0) > (nb[id] ?? 0));
        if (node && NODE[node]) w = ISLAND[NODE[node].island]?.world;
      }
      else if (JSON.stringify(ma?.play ?? {}) !== JSON.stringify(mb?.play ?? {})) { k = 'play'; l = 'playground'; }
      else if (Object.keys(s).length) { k = 'game'; l = 'practice'; }
    }
  }
  if (!k) return null;
  if (k !== 'typing') { for (const x of Object.values(s)) { r += x.r; n += x.n; } }
  const ev: ClassEvent = { at: now, k, l, ms: Math.round(ms), r, n };
  if (Object.keys(s).length) ev.s = s;
  if (st) ev.st = st;
  if (f) ev.f = f;
  if (w) ev.w = w;
  return ev;
}

/** What activityOf reads from the player as it was, copied small (for game.update, which changes the
 *  player in place: battles, Learn episodes, duels). */
export function activityBase(p: Profile, now = Date.now()): Profile {
  const lite = (r?: Record<string, { right?: number; wrong?: number }>) => (r ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { right: v?.right ?? 0, wrong: v?.wrong ?? 0 }])) : undefined);
  const plays = (r?: Record<string, { plays?: number } | undefined>) => (r ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { plays: v?.plays ?? 0 }])) : undefined);
  const finishes = (r?: Record<string, { finishes?: number }>) => Object.fromEntries(Object.entries(r ?? {}).map(([k, v]) => [k, { finishes: v?.finishes ?? 0 }]));
  const today = dayKey(now), m = p.math, a = p.adventure;
  return {
    history: p.history?.length ? [p.history[p.history.length - 1]] : [],
    totals: { words: p.totals?.words ?? 0 }, lessons: finishes(p.lessons),
    days: p.days?.[today] ? { [today]: { ms: p.days[today].ms } } : {},
    arcade: plays(p.arcade as Record<string, { plays?: number }>),
    math: m ? {
      facts: lite(m.facts), skills: lite(m.skills), history: m.history?.length ? [m.history[m.history.length - 1]] : [],
      lessons: finishes(m.lessons), arcade: plays(m.arcade), play: JSON.parse(JSON.stringify(m.play ?? {})), learned: [...(m.learned ?? [])],
    } : undefined,
    adventure: a ? { day: { ...a.day }, nodes: { ...(a.nodes ?? {}) } } : undefined,
  } as unknown as Profile;
}

/** The player's entries, oldest first. */
export function eventsOf(p: Profile): ClassEvent[] {
  return Object.values((p as ClassProfile).classwork?.ev ?? {}).filter(e => e && Number.isFinite(e.at)).sort((a, b) => a.at - b.at);
}

/** Add an entry to a player (and keep the newest few hundred). */
export function addEvent(p: Profile, ev: ClassEvent, now = Date.now()) {
  const cp = p as ClassProfile;
  const ev0 = { ...(cp.classwork?.ev ?? {}) };
  let key = ev.at.toString(36);
  while (ev0[key]) key += '+';
  ev0[key] = ev;
  const keep = Object.entries(ev0).filter(([, e]) => e && now - e.at < EVENT_DAYS * DAY).sort((a, b) => b[1].at - a[1].at).slice(0, EVENT_CAP);
  cp.classwork = { ...(cp.classwork ?? {}), ev: Object.fromEntries(keep) };
}

/** Called by game.replaceProfile with the player as it was and as it's about to be saved. */
export function noteActivity(before: Profile | undefined, after: Profile, now = Date.now()): ClassEvent | null {
  const ev = activityOf(before, after, now);
  if (ev) addEvent(after, ev, now);
  return ev;
}

// ---------- weeks ----------
/** A week, by its Monday (local time): "2026-10-26". */
export function weekKey(t: number): string {
  const d = new Date(t);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d.getTime());
}
/** The days of a week (Monday first). */
export function weekDays(week: string): string[] {
  const [y, mo, d] = week.split('-').map(Number);
  return Array.from({ length: 7 }, (_, i) => dayKey(new Date(y, mo - 1, d + i, 12).getTime()));
}
/** One week for a player: right answers and stars from the entries, minutes practised from the days. */
export function weekStats(p: Profile, week: string): { right: number; n: number; ms: number; stars: number } {
  let right = 0, n = 0, stars = 0;
  for (const e of eventsOf(p)) if (weekKey(e.at) === week) { right += e.r; n += e.n; stars += e.st ?? 0; }
  const ms = weekDays(week).reduce((t, d) => t + (p.days?.[d]?.ms ?? 0), 0);
  return { right, n, ms, stars };
}
/** The weeks before and including this one, oldest first. */
export function lastWeeks(n: number, now = Date.now()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(weekKey(now - i * 7 * DAY));
  return [...new Set(out)];
}
