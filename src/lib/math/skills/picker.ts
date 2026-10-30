// Picks a skill trip's questions, the way the fact picker does for facts:
// - a Meet lesson brings in up to two new subs (a new denominator, a new kind of comparison), each shown
//   first with its trick, then back a few questions later;
// - everything else is subs already met, the shakiest and the ones due a check-up most often;
// - a missed question comes back, the same question, 2 or 3 questions later (the trip runs on a little if
//   it was near the end);
// - checkpoints are a fixed shuffled set covering every sub evenly; the placement (Show What You Know)
//   is an adaptive staircase across the area's skills (placement.ts).
// How hard each question is comes from the child's ability on its skill (ability.ts pitch: about 80% right
// expected), learned answer by answer as the trip goes; four right in a row tries one rung up, two misses in
// a row one rung down (and the screen shows the trick). A new sub's first question, shown with its trick,
// is pitched to be easy (90%). Checkpoints never go below rung 3 (the old full range), so passing one means
// what it always did.
import { mulberry32, shuffle, type Rng } from '../../engine/rng';
import { isDue, weakness, type FactStat } from '../facts';
import { learn, makeAt, pitchRung, priorOf, rungFor, TARGET, thetaOf, type AbilityHome } from './ability';
import { PLACE_SKILL_N, placeStart, skillLadder, Staircase } from './placement';
import { SKILL } from './registry';
import type { SkillLesson } from './course';
import type { Item } from './types';

export type Reason = 'new' | 'repeat' | 'known' | 'review' | 'retry' | 'test';
export type SkillPick = { item: Item; reason: Reason };

export const SKILL_TRIP = 16;
const MAX_NEW: Record<SkillLesson['kind'], number> = { meet: 2, practice: 1, mix: 0, check: 0, placement: 0 };
const INTRO_AT = [0, 6];
const REPEAT_AFTER = [2, 5];
const MAX_EXTRA = 3;
/** right in a row before trying a rung up; misses in a row before going one down */
export const UP_AFTER = 4, DOWN_AFTER = 2;

const keysOf = (skill: string) => (SKILL[skill]?.subs ?? []).map(s => `${skill}:${s.id}`);
/** A trip's keys of a skill: all of them, or only the lesson's own (a curriculum lesson's trip). */
export const lessonKeys = (l: Pick<SkillLesson, 'subs'>, skill: string) => keysOf(skill).filter(k => !l.subs || l.subs.includes(k) || l.subs.includes(skill));
/** A rung kept inside a lesson's band (a skill that runs across grades asks only its grade's rungs). */
export const inBand = (l: Pick<SkillLesson, 'rungs'>, r: number) => (l.rungs ? Math.max(l.rungs[0], Math.min(l.rungs[1], r)) : r);
const subOf = (key: string) => key.slice(key.indexOf(':') + 1);
const skillOfKey = (key: string) => key.slice(0, key.indexOf(':'));

/** A trip's streak: one rung up after four right in a row (back down at the next miss), one down after
 *  two misses in a row (back after two right). */
export class Streak {
  bump = 0;
  private right = 0;
  private miss = 0;
  answer(ok: boolean) {
    if (ok) {
      this.miss = 0; this.right++;
      if (this.bump < 0 && this.right >= 2) { this.bump = 0; this.right = 0; }
      else if (this.right >= UP_AFTER) { this.bump = Math.min(1, this.bump + 1); this.right = 0; }
    } else {
      this.right = 0; this.miss++;
      if (this.bump > 0) { this.bump = 0; this.miss = 0; }
      else if (this.miss >= DOWN_AFTER) { this.bump = -1; this.miss = 0; }
    }
  }
}

export class SkillTripPicker {
  readonly lesson: SkillLesson;
  readonly length: number;
  readonly newKeys: string[];
  readonly served: SkillPick[] = [];
  /** the child's abilities, learning as the trip goes (a working copy: the save is changed after the trip) */
  readonly home: AbilityHome;
  readonly streak = new Streak();
  /** the placement's staircase */
  readonly stairs: Staircase | null = null;
  private readonly mem: Record<string, FactStat>;
  private readonly now: number;
  private readonly rng: Rng;
  private readonly grown: boolean;
  private readonly plan: ({ key: string; reason: Reason; item?: Item } | null)[];
  private planned = 0;
  private retries: { item: Item; at: number }[] = [];
  private current: SkillPick | null = null;
  private pool: { key: string; w: number; due: boolean }[] = [];

  constructor(o: { lesson: SkillLesson; mem: Record<string, FactStat>; now: number; seed?: number; length?: number; math?: AbilityHome; grown?: boolean }) {
    this.lesson = o.lesson; this.mem = o.mem; this.now = o.now; this.grown = !!o.grown;
    this.home = { facts: o.math?.facts, skills: o.mem, ability: { ...(o.math?.ability ?? {}) } };
    this.rng = mulberry32(o.seed ?? Math.floor(Math.random() * 1e9));
    const l = o.lesson;
    if (l.kind === 'placement') {
      this.newKeys = [];
      const ladder = l.ladder ?? skillLadder(l.area).filter(x => l.skills.includes(x.skill));
      this.stairs = new Staircase(ladder, placeStart(this.home, ladder, o.now), PLACE_SKILL_N, this.rng);
      this.plan = [];
      this.length = PLACE_SKILL_N;
      return;
    }
    if (l.kind === 'check') {
      this.newKeys = [];
      const all = l.skills.flatMap(sk => lessonKeys(l, sk));
      const n = l.length ?? Math.min(SKILL_TRIP, Math.max(10, all.length * 2));
      let set: string[] = [];
      while (set.length < n) set.push(...shuffle(this.rng, all));
      set = set.slice(0, n);
      this.plan = shuffle(this.rng, set).map(key => ({ key, reason: 'test' as const }));
      this.length = this.plan.length;
      return;
    }
    this.length = o.length ?? SKILL_TRIP;
    this.newKeys = l.learn.flatMap(sk => lessonKeys(l, sk)).filter(k => !(this.mem[k]?.stage ?? 0)).slice(0, MAX_NEW[l.kind]);
    this.plan = Array.from({ length: this.length }, () => null);
    this.newKeys.forEach((key, j) => {
      const at = INTRO_AT[j];
      // the new sub's first question is shown with its trick; the repeats are fresh questions of it
      const first = this.make(key, 'intro');
      this.place(at, { key, reason: 'new', item: first });
      for (const d of REPEAT_AFTER) this.place(at + d, { key, reason: 'repeat' });
    });
    this.pool = this.knownPool();
  }

  private place(at: number, x: { key: string; reason: Reason; item?: Item }) {
    for (let i = at; i < this.plan.length; i++) if (!this.plan[i]) { this.plan[i] = x; return; }
  }

  /** The rung for a skill's next question: pitched at about 80% (an intro at 90%, no jitter), moved by the
   *  trip's streak; a checkpoint never below rung 3. */
  pitchFor(skill: string, how: 'ask' | 'intro' = 'ask'): number {
    const t = thetaOf(this.home, skill, this.now, this.grown);
    if (how === 'intro') return inBand(this.lesson, rungFor(t, TARGET.teach));
    const r = pitchRung(t, TARGET.practice, this.rng, this.streak.bump);
    return inBand(this.lesson, this.lesson.kind === 'check' ? Math.max(3, r) : r);
  }
  /** A fresh question for a sub at the child's rung (never the same as one of the last three). */
  private make(key: string, how: 'ask' | 'intro' = 'ask', rung?: number): Item {
    const s = SKILL[skillOfKey(key)];
    const r = rung ?? this.pitchFor(s.id, how);
    const recent = this.served.slice(-3).map(x => x.item.id);
    let it = makeAt(s, this.rng, subOf(key), r);
    for (let t = 0; t < 6 && recent.includes(it.id); t++) it = makeAt(s, this.rng, subOf(key), r);
    return it;
  }

  /** Subs to practise between the new ones, each with how much it needs it. */
  private knownPool() {
    const out: { key: string; w: number; due: boolean }[] = [];
    const seen = new Set<string>();
    this.lesson.skills.forEach((sk, i) => {
      for (const key of lessonKeys(this.lesson, sk)) {
        if (seen.has(key) || this.newKeys.includes(key)) continue;
        const st = this.mem[key];
        // in a Meet or practice lesson only subs already met come up between the new ones (a new sub is
        // always introduced first, with its trick: quarters never turn up straight after the halves intro);
        // a mix brings in everything on its island
        const met = (st?.stage ?? 0) > 0 || st?.seen;
        if (!met && this.lesson.kind !== 'mix') continue;
        seen.add(key);
        const due = isDue(st, this.now);
        out.push({ key, w: (i === 0 ? 0.65 : 0.4) + 2 * weakness(st, SKILL[sk].fastMs) * (met ? 1 : 0.3) + (due ? 1.6 : 0), due });
      }
    });
    return out;
  }

  get done(): boolean {
    if (this.stairs) return this.stairs.done;
    return this.planned >= this.plan.length && (this.retries.length === 0 || this.served.length >= this.plan.length + MAX_EXTRA);
  }
  get progress(): number { return this.stairs ? this.stairs.answers.length / this.length : Math.min(1, this.planned / Math.max(1, this.plan.length)); }
  /** How many more questions this trip asks after the one showing: the rest of the plan and the misses waiting
   *  to come back (as many as the trip runs on for). It grows when a miss is to come back. */
  get left(): number {
    if (this.stairs) return Math.max(0, this.length - this.stairs.answers.length - 1);
    const ats = this.retries.map(r => r.at).sort((a, b) => a - b);
    let pos = this.served.length, planned = this.planned, n = 0;
    // next() without the questions: a waiting miss when its turn comes, else the plan, else the misses left
    while (!(planned >= this.plan.length && (!ats.length || pos >= this.plan.length + MAX_EXTRA))) {
      if (ats.length && ats[0] <= pos) ats.shift();
      else if (planned < this.plan.length) planned++;
      else ats.shift();
      pos++; n++;
    }
    return n;
  }

  next(): SkillPick | null {
    if (this.done) return (this.current = null);
    let pick: SkillPick | null = null;
    if (this.stairs) {
      const pr = this.stairs.next();
      if (pr) {
        // the sub asked least so far in this placement
        const subs = lessonKeys(this.lesson, pr.skill).map(subOf), asked = (sub: string) => this.served.filter(x => x.item.key === `${pr.skill}:${sub}`).length;
        const least = Math.min(...subs.map(asked)), sub = shuffle(this.rng, subs.filter(s => asked(s) === least))[0];
        pick = { item: makeAt(SKILL[pr.skill], this.rng, sub, pr.rung), reason: 'test' };
      }
      if (pick) this.served.push(pick);
      return (this.current = pick);
    }
    const pos = this.served.length;
    const r = this.retries.findIndex(x => x.at <= pos);
    if (r >= 0) pick = { item: this.retries.splice(r, 1)[0].item, reason: 'retry' };
    else if (this.planned < this.plan.length) {
      const p = this.plan[this.planned++];
      if (p) pick = { item: p.item ?? this.make(p.key), reason: p.reason };
      else pick = this.pickKnown();
    } else {
      const x = this.retries.shift();
      pick = x ? { item: x.item, reason: 'retry' } : null;
    }
    if (pick) this.served.push(pick);
    return (this.current = pick);
  }

  private pickKnown(): SkillPick {
    const recent = this.served.slice(-2).map(x => x.item.key);
    let pool = this.pool.filter(x => !recent.includes(x.key));
    if (!pool.length) pool = this.pool;
    if (!pool.length) {
      // nothing met before this trip: the new subs introduced so far (never one still to come), gently
      const shown = [...new Set(this.served.filter(x => x.reason === 'new').map(x => x.item.key))];
      const from = shown.length ? shown : this.newKeys.length ? [this.newKeys[0]] : [lessonKeys(this.lesson, this.lesson.learn[0] ?? this.lesson.skills[0])[0]];
      return { item: this.make(from[Math.floor(this.rng() * from.length)]), reason: 'repeat' };
    }
    let w = this.rng() * pool.reduce((a, x) => a + x.w, 0);
    for (const x of pool) {
      w -= x.w;
      if (w <= 0) { x.w *= 0.5; return { item: this.make(x.key), reason: x.due ? 'review' : 'known' }; }
    }
    const x = pool[pool.length - 1];
    return { item: this.make(x.key), reason: x.due ? 'review' : 'known' };
  }

  /** The answer to the current question (first try): the ability learns from it, the streak moves, and a
   *  miss brings the same question back 2 or 3 questions later (not in the placement: it steps down). */
  answer(ok: boolean, thinkMs?: number) {
    const cur = this.current;
    if (!cur) return;
    if (this.stairs) { this.stairs.answer(ok); return; }
    const s = SKILL[cur.item.skill];
    if (s && cur.item.rung) {
      const ab = (this.home.ability ??= {}), prev = ab[s.id];
      ab[s.id] = learn(prev, prev ? 0 : priorOf(this.home, s.id, this.now, this.grown), { rung: cur.item.rung, ok, thinkMs, fastMs: s.fastMs, at: this.now, source: 'trip' });
    }
    this.streak.answer(ok);
    if (ok) return;
    if (this.retries.some(x => x.item.id === cur.item.id)) return;
    this.retries.push({ item: cur.item, at: this.served.length - 1 + 2 + Math.floor(this.rng() * 2) });
  }
}
