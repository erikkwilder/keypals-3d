// Picks a skill trip's questions, the way the fact picker does for facts:
// - a Meet lesson brings in up to two new subs (a new denominator, a new kind of comparison), each shown
//   first with its trick, then back a few questions later;
// - everything else is subs already met, the shakiest and the ones due a check-up most often;
// - a missed question comes back, the same question, 2 or 3 questions later (the trip runs on a little if
//   it was near the end);
// - checkpoints and placement are a fixed shuffled set covering every sub evenly.
// Questions are made fresh from each skill's generator: gentle (level 1) until a sub is a bud.
import { mulberry32, shuffle, type Rng } from '../../engine/rng';
import { isDue, weakness, type FactStat } from '../facts';
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

const keysOf = (skill: string) => (SKILL[skill]?.subs ?? []).map(s => `${skill}:${s.id}`);
const subOf = (key: string) => key.slice(key.indexOf(':') + 1);
const skillOfKey = (key: string) => key.slice(0, key.indexOf(':'));

export class SkillTripPicker {
  readonly lesson: SkillLesson;
  readonly length: number;
  readonly newKeys: string[];
  readonly served: SkillPick[] = [];
  private readonly mem: Record<string, FactStat>;
  private readonly now: number;
  private readonly rng: Rng;
  private readonly plan: ({ key: string; reason: Reason; item?: Item } | null)[];
  private planned = 0;
  private retries: { item: Item; at: number }[] = [];
  private current: SkillPick | null = null;
  private pool: { key: string; w: number; due: boolean }[] = [];

  constructor(o: { lesson: SkillLesson; mem: Record<string, FactStat>; now: number; seed?: number; length?: number }) {
    this.lesson = o.lesson; this.mem = o.mem; this.now = o.now;
    this.rng = mulberry32(o.seed ?? Math.floor(Math.random() * 1e9));
    const l = o.lesson;
    if (l.kind === 'check' || l.kind === 'placement') {
      this.newKeys = [];
      const all = l.skills.flatMap(keysOf);
      const n = l.kind === 'placement' ? 12 : Math.min(SKILL_TRIP, Math.max(10, all.length * 2));
      const set: string[] = [];
      while (set.length < n) set.push(...shuffle(this.rng, all));
      this.plan = shuffle(this.rng, set.slice(0, n)).map(key => ({ key, reason: 'test' as const }));
      this.length = this.plan.length;
      return;
    }
    this.length = o.length ?? SKILL_TRIP;
    this.newKeys = l.learn.flatMap(keysOf).filter(k => !(this.mem[k]?.stage ?? 0)).slice(0, MAX_NEW[l.kind]);
    this.plan = Array.from({ length: this.length }, () => null);
    this.newKeys.forEach((key, j) => {
      const at = INTRO_AT[j];
      // the new sub's first question is shown with its trick; the repeats are fresh questions of it
      const first = this.make(key, 1);
      this.place(at, { key, reason: 'new', item: first });
      for (const d of REPEAT_AFTER) this.place(at + d, { key, reason: 'repeat' });
    });
    this.pool = this.knownPool();
  }

  private place(at: number, x: { key: string; reason: Reason; item?: Item }) {
    for (let i = at; i < this.plan.length; i++) if (!this.plan[i]) { this.plan[i] = x; return; }
  }

  /** A fresh question for a sub: gentle until it's a bud (checkpoints use the full range). */
  private make(key: string, level?: 1 | 2): Item {
    const s = SKILL[skillOfKey(key)];
    const lv: 1 | 2 = level ?? ((this.lesson.kind === 'check' || (this.mem[key]?.stage ?? 0) >= 2) ? 2 : 1);
    const recent = this.served.slice(-3).map(x => x.item.id);
    let it = s.make(this.rng, subOf(key), lv);
    for (let t = 0; t < 6 && recent.includes(it.id); t++) it = s.make(this.rng, subOf(key), lv);
    return it;
  }

  /** Subs to practise between the new ones, each with how much it needs it. */
  private knownPool() {
    const out: { key: string; w: number; due: boolean }[] = [];
    const seen = new Set<string>();
    this.lesson.skills.forEach((sk, i) => {
      for (const key of keysOf(sk)) {
        if (seen.has(key) || this.newKeys.includes(key)) continue;
        const st = this.mem[key];
        // a sub of a skill not met yet only comes up once its skill's lesson has been (its Meet lesson)
        const met = (st?.stage ?? 0) > 0 || st?.seen;
        if (!met && !this.lesson.learn.includes(sk) && this.lesson.kind !== 'mix') continue;
        seen.add(key);
        const due = isDue(st, this.now);
        out.push({ key, w: (i === 0 ? 0.65 : 0.4) + 2 * weakness(st, SKILL[sk].fastMs) * (met ? 1 : 0.3) + (due ? 1.6 : 0), due });
      }
    });
    return out;
  }

  get done(): boolean {
    return this.planned >= this.plan.length && (this.retries.length === 0 || this.served.length >= this.plan.length + MAX_EXTRA);
  }
  get progress(): number { return Math.min(1, this.planned / Math.max(1, this.plan.length)); }

  next(): SkillPick | null {
    if (this.done) return (this.current = null);
    const pos = this.served.length;
    const r = this.retries.findIndex(x => x.at <= pos);
    let pick: SkillPick | null = null;
    if (r >= 0) pick = { item: this.retries.splice(r, 1)[0].item, reason: 'retry' };
    else if (this.planned < this.plan.length) {
      const p = this.plan[this.planned++];
      if (p) pick = { item: p.item ?? this.make(p.key, p.reason === 'test' && this.lesson.kind === 'placement' ? 1 : undefined), reason: p.reason };
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
      // nothing met yet: the lesson's own skills, gently
      const key = this.newKeys[0] ?? keysOf(this.lesson.learn[0] ?? this.lesson.skills[0])[0];
      return { item: this.make(key, 1), reason: 'repeat' };
    }
    let w = this.rng() * pool.reduce((a, x) => a + x.w, 0);
    for (const x of pool) {
      w -= x.w;
      if (w <= 0) { x.w *= 0.5; return { item: this.make(x.key), reason: x.due ? 'review' : 'known' }; }
    }
    const x = pool[pool.length - 1];
    return { item: this.make(x.key), reason: x.due ? 'review' : 'known' };
  }

  /** A miss brings the same question back 2 or 3 questions later. */
  answer(ok: boolean) {
    const cur = this.current;
    if (!cur || ok) return;
    if (this.retries.some(x => x.item.id === cur.item.id)) return;
    this.retries.push({ item: cur.item, at: this.served.length - 1 + 2 + Math.floor(this.rng() * 2) });
  }
}
