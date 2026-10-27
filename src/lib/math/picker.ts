// Picks each trip's facts, one at a time. A trip is 20 facts:
// - at most three new ones (Meet 3, Practice 2, Mix 1), each met first with its trick and then coming
//   back after 1, 3 and 6 other facts so it sticks;
// - everything else is facts the player already knows, the shakiest and the ones due for review most
//   often (learning a few new facts among mostly known ones is "incremental rehearsal");
// - a missed fact comes back 2 to 4 facts later (and the trip runs on a little if it was near the end);
// - a table that has all bloomed doesn't get ground over: its facts weigh little, and facts due for
//   review from other tables fill the trip.
// Checkpoints ask every fact of the table both ways round; the placement trip samples every table.

import { lessonFacts, ruleFacts, tableFacts, TABLES, type MathLesson } from './course';
import { factId, isDue, isRuleFact, partnerOf, sameFact, weakness, type Fact, type FactStat } from './facts';
import { mulberry32, shuffle, type Rng } from '../engine/rng';

export const TRIP_LENGTH = 20;
export const MAX_NEW: Record<MathLesson['kind'], number> = { meet: 3, practice: 2, mix: 1, rules: 0, check: 0, placement: 0 };
/** after its first time, a new fact comes back after 1, then 3, then 6 other facts */
const REPEAT_AFTER = [2, 6, 13];
/** where the new facts come in (planned positions) */
const INTRO_AT = [1, 5, 9];
/** a trip runs on at most this many facts past 20 to bring back late misses */
const MAX_EXTRA = 3;

export type Reason = 'new' | 'repeat' | 'known' | 'review' | 'retry' | 'test';
export type Item = { fact: Fact; reason: Reason };

type Opts = { lesson: MathLesson; facts: Record<string, FactStat>; now: number; seed?: number; length?: number; fastMs?: number };

export class TripPicker {
  readonly lesson: MathLesson;
  readonly length: number;
  /** the facts this trip introduces */
  readonly newFacts: Fact[];
  /** what's been asked so far */
  readonly served: Item[] = [];
  private readonly facts: Record<string, FactStat>;
  private readonly now: number;
  private readonly rng: Rng;
  private readonly fastMs?: number;
  /** the planned 20: fixed facts (new, repeats, tests) or null for "pick a known fact then" */
  private readonly plan: (Item | null)[];
  private planned = 0;
  private retries: { fact: Fact; at: number }[] = [];
  private current: Item | null = null;
  private pool: { fact: Fact; w: number; due: boolean }[] = [];

  constructor(o: Opts) {
    this.lesson = o.lesson;
    this.facts = o.facts;
    this.now = o.now;
    this.rng = mulberry32(o.seed ?? Math.floor(Math.random() * 1e9));
    this.fastMs = o.fastMs;
    this.length = o.length ?? TRIP_LENGTH;
    const stat = (f: Fact) => o.facts[factId(f)];

    if (o.lesson.kind === 'check' || o.lesson.kind === 'placement' || o.lesson.kind === 'rules') {
      this.newFacts = [];
      this.plan = this.testPlan().map(fact => ({ fact, reason: 'test' as const }));
      this.length = this.plan.length;
      return;
    }

    // new facts: the first table's facts not met yet, in teaching order (the 0 and 1 facts belong to the rules)
    const first = o.lesson.tables[0];
    this.newFacts = tableFacts(first).filter(f => !isRuleFact(f) && (stat(f)?.stage ?? 0) === 0).slice(0, MAX_NEW[o.lesson.kind]);
    this.plan = Array.from({ length: this.length }, () => null);
    this.newFacts.forEach((fact, j) => {
      const at = INTRO_AT[j];
      this.place(at, { fact, reason: 'new' });
      for (const d of REPEAT_AFTER) this.place(at + d, { fact, reason: 'repeat' });
    });
    this.pool = this.knownPool();
  }

  /** Put a fixed fact at a planned position, or the next free one after it (or drop it past the end). */
  private place(at: number, item: Item) {
    for (let i = at; i < this.plan.length; i++) if (!this.plan[i]) { this.plan[i] = item; return; }
  }

  /** Checkpoints, the rules and the placement trip: a fixed, shuffled set with no fact twice in a row. */
  private testPlan(): Fact[] {
    const l = this.lesson;
    let set: Fact[];
    if (l.kind === 'check') {
      const t = l.tables[0];
      // all eleven facts of the table, and the turnarounds (t × 0, then t × 2 to t × 10): 20
      set = [...tableFacts(t), ...tableFacts(t).filter(f => f.a !== 1 && f.a !== t).map(partnerOf)];
    } else if (l.kind === 'rules') {
      set = shuffle(this.rng, ruleFacts()).slice(0, this.length);
    } else {
      set = l.tables.flatMap(t => shuffle(this.rng, tableFacts(t).filter(f => !isRuleFact(f))).slice(0, Math.ceil(this.length / l.tables.length))).slice(0, this.length);
    }
    return shuffle(this.rng, set);
  }

  /** Facts to practise between the new ones, each with how much it needs it. */
  private knownPool() {
    const l = this.lesson, seen = new Set<string>(), out: { fact: Fact; w: number; due: boolean }[] = [];
    const add = (fact: Fact, base: number) => {
      const id = factId(fact);
      if (seen.has(id) || this.newFacts.some(n => sameFact(n, fact))) return;
      const s = this.facts[id];
      const due = isDue(s, this.now);
      seen.add(id);
      // a 0 or 1 fact not met yet is an easy filler, not the weakest fact of all
      const need = !s?.stage && isRuleFact(fact) ? 0.2 : 2 * weakness(s, this.fastMs);
      out.push({ fact, w: base + need + (due ? 1.6 : 0), due });
    };
    const known = (f: Fact) => (this.facts[factId(f)]?.stage ?? 0) > 0;
    l.tables.forEach((t, i) => {
      for (const f of tableFacts(t)) {
        // the 0 and 1 facts are easy fillers even before they've come up (the rules cover them)
        if (known(f) || isRuleFact(f)) add(f, i === 0 ? 0.65 : 0.4);
        // mixes bring in turnarounds the partner credit has planted
        if (l.kind === 'mix' && !isRuleFact(f) && known(partnerOf(f))) add(partnerOf(f), 0.3);
      }
    });
    // reviews due from anywhere on the trail
    for (const t of TABLES) for (const f of [...tableFacts(t), ...tableFacts(t).map(partnerOf)]) if (isDue(this.facts[factId(f)], this.now)) add(f, 0.4);
    // a small pool gets the rules lesson's known facts too, so a new player has something to fill with
    if (out.filter(x => !isRuleFact(x.fact)).length < 6) for (const f of ruleFacts()) add(f, known(f) ? 0.1 : 0.05);
    // a table that has all bloomed: its own facts stop crowding out everything else
    const own = out.filter(x => x.fact.b === l.tables[0] && !isRuleFact(x.fact));
    if (own.length >= 9 && own.every(x => (this.facts[factId(x.fact)]?.stage ?? 0) === 3 && !x.due)) for (const x of own) x.w *= 0.35;
    return out;
  }

  get done(): boolean {
    return this.planned >= this.plan.length && (this.retries.length === 0 || this.served.length >= this.plan.length + MAX_EXTRA);
  }

  /** How far through the trip (0..1). */
  get progress(): number { return Math.min(1, this.planned / Math.max(1, this.plan.length)); }

  /** The next fact to ask, or null when the trip is over. */
  next(): Item | null {
    if (this.done) return (this.current = null);
    const pos = this.served.length;
    // a missed fact coming back takes priority
    const r = this.retries.findIndex(x => x.at <= pos);
    let item: Item | null = null;
    if (r >= 0) item = { fact: this.retries.splice(r, 1)[0].fact, reason: 'retry' };
    else if (this.planned < this.plan.length) {
      item = this.plan[this.planned++] ?? null;
      const last = this.served.at(-1);
      // a planned fact never follows itself (a retry may have just brought it): it waits one more
      if (item && last && sameFact(item.fact, last.fact)) { this.place(this.planned, item); item = null; }
      item ??= this.pickKnown();
    }
    else {
      // past the end: bring the waiting misses back now
      const x = this.retries.shift();
      item = x ? { fact: x.fact, reason: 'retry' } : null;
    }
    if (item) this.served.push(item);
    return (this.current = item);
  }

  /** A fact the player knows, by need, never the same as either of the last two. */
  private pickKnown(): Item {
    const recent = this.served.slice(-2).map(i => factId(i.fact));
    const upcoming = this.plan[this.planned] ? factId(this.plan[this.planned]!.fact) : null;
    let pool = this.pool.filter(x => !recent.includes(factId(x.fact)) && factId(x.fact) !== upcoming);
    if (!pool.length) pool = this.pool.filter(x => !recent.includes(factId(x.fact)));
    if (!pool.length) {
      // nothing known yet: go over the new facts again
      const back = this.newFacts.find(f => !recent.includes(factId(f))) ?? this.newFacts[0] ?? tableFacts(this.lesson.tables[0])[0];
      return { fact: back, reason: 'repeat' };
    }
    let r = this.rng() * pool.reduce((a, x) => a + x.w, 0);
    for (const x of pool) {
      r -= x.w;
      if (r <= 0) { x.w *= 0.45; return { fact: x.fact, reason: x.due ? 'review' : 'known' }; }
    }
    const x = pool[pool.length - 1];
    return { fact: x.fact, reason: x.due ? 'review' : 'known' };
  }

  /** The answer to the current fact: a miss brings it back 2 or 3 facts later (4 at the most). */
  answer(ok: boolean) {
    const cur = this.current;
    if (!cur || ok) return;
    const pos = this.served.length - 1;
    if (this.retries.some(x => sameFact(x.fact, cur.fact))) return;
    // the retry takes the place of a planned repeat coming up too soon
    for (let i = this.planned; i < Math.min(this.plan.length, this.planned + 4); i++) if (this.plan[i] && sameFact(this.plan[i]!.fact, cur.fact)) this.plan[i] = null;
    this.retries.push({ fact: cur.fact, at: pos + 2 + Math.floor(this.rng() * 2) });
  }
}
