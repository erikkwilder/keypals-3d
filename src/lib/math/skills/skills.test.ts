import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { newProfile, migrate } from '../../engine/profile';
import { mathOf } from '../progress';
import { tripStats, mathStars } from '../meter';
import { SKILLS, SKILL, AREAS, skillsOf, keyLabel } from './registry';
import { FRACTION_SKILLS, checkAnswer } from './fractions';
import { SKILL_LESSON, SKILL_LESSONS, skillUnlocked, nextSkillLesson } from './course';
import { SkillTripPicker } from './picker';
import { applySkillRun, skillStatus, type SkillResult } from './progress';
import type { Answer, Item } from './types';

const T0 = new Date('2026-11-02T16:00:00').getTime();
const DAY = 86_400_000;

describe('skills registry', () => {
  it('lists every K-8 area, the four fact strands and fractions live', () => {
    expect(AREAS.length).toBe(13);
    expect(AREAS.filter(a => a.live).map(a => a.id)).toEqual(['plus', 'minus', 'times', 'share', 'fractions']);
    expect(skillsOf('fractions').map(s => s.id)).toEqual(['fr-name', 'fr-compare', 'fr-equal', 'fr-add']);
    for (const s of SKILLS) { expect(s.standard).toMatch(/^\d\.[A-Z]+\./); expect(s.subs.length).toBeGreaterThan(0); }
  });
  it('wraps the facts as skills without changing them', () => {
    const it = SKILL['mult-facts'].make(mulberry32(3), 'x7', 2);
    expect(it.key).toMatch(/^\d+x7$/);
    expect(SKILL['mult-facts'].check(it, it.answer)).toBe(true);
    expect(SKILL['mult-facts'].facts).toBe('x');
  });
});

describe('fraction generators', () => {
  it('make valid, varied questions for every sub at both levels, whose own answer checks right', () => {
    for (const s of FRACTION_SKILLS) for (const sub of s.subs) for (const lv of [1, 2] as const) {
      const rng = mulberry32(17 + sub.id.length * 31 + lv), ids = new Set<string>();
      for (let i = 0; i < 120; i++) {
        const it = s.make(rng, sub.id, lv);
        ids.add(it.id);
        expect(it.key).toBe(`${s.id}:${sub.id}`);
        expect(s.check(it, it.answer)).toBe(true);
        expect(it.prompt.length).toBeGreaterThan(0);
        if (it.answer.kind === 'fraction') { expect(it.answer.d).toBeGreaterThan(0); expect(it.answer.n).toBeGreaterThan(0); }
        if (it.input === 'choice') expect(it.choices!.some(c => c.id === (it.answer as { id: string }).id)).toBe(true);
        for (const p of it.prompt) if (p.t === 'pic') { expect(p.pic.filled).toBeGreaterThan(0); expect(p.pic.filled).toBeLessThan(p.pic.parts); }
      }
      // (halves have only one fraction to show, as a pie or a bar)
      expect(ids.size, `${s.id}:${sub.id}:${lv}`).toBeGreaterThan(1);
    }
  });
  it('name the fraction: a picture of n of d parts is n/d', () => {
    const it = SKILL['fr-name'].make(mulberry32(5), '8', 2);
    const p = it.prompt[0];
    expect(p.t).toBe('pic');
    if (p.t === 'pic' && it.answer.kind === 'fraction') { expect(it.answer.n).toBe(p.pic.filled); expect(it.answer.d).toBe(8); }
  });
  it('compare: picks the bigger one, or "the same" for equal fractions', () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 200; i++) {
      const it = SKILL['fr-compare'].make(rng, 'half', 2);
      const [a, , b] = it.prompt as { t: 'frac'; n: number; d: number }[];
      const va = a.n / a.d, vb = b.n / b.d, id = (it.answer as { id: string }).id;
      expect(id).toBe(Math.abs(va - vb) < 1e-9 ? 'same' : va > vb ? 'a' : 'b');
    }
  });
  it('checks: equal fractions count for name and add; numbers must match; wrong choices fail', () => {
    const add = SKILL['fr-add'].make(mulberry32(2), 'small', 1) as Item & { answer: { kind: 'fraction'; n: number; d: number } };
    const { n, d } = add.answer;
    expect(SKILL['fr-add'].check(add, { kind: 'fraction', n: n * 2, d: d * 2 })).toBe(true);
    expect(SKILL['fr-add'].check(add, { kind: 'fraction', n: n + 1, d })).toBe(false);
    expect(checkAnswer({ kind: 'number', value: 4 }, { kind: 'number', value: 4 })).toBe(true);
    expect(checkAnswer({ kind: 'choice', id: 'a' }, { kind: 'choice', id: 'b' })).toBe(false);
    expect(keyLabel('fr-name:4')).toBe('Name the fraction: quarters');
  });
});

// answer a whole trip: right (fast or slow) except where told
function playTrip(lessonId: string, p: ReturnType<typeof newProfile>, at: number, o: { miss?: number[]; slow?: boolean } = {}) {
  const lesson = SKILL_LESSON[lessonId];
  const picker = new SkillTripPicker({ lesson, mem: mathOf(p).skills ?? {}, now: at, seed: 42 });
  const results: SkillResult[] = [];
  let i = 0, pick;
  const served: string[] = [];
  while ((pick = picker.next())) {
    served.push(pick.item.id + '|' + pick.reason);
    const intro = pick.reason === 'new';
    const miss = !intro && (o.miss ?? []).includes(i);
    picker.answer(!miss);
    results.push({ id: pick.item.id, key: pick.item.key, label: pick.item.id, ok: !miss, speed: miss ? 'miss' : o.slow ? 'slow' : 'fast', thinkMs: o.slow ? 9000 : 2500, ms: 4000, intro });
    i++;
  }
  const stats = tripStats(results);
  const stars = mathStars(stats, lesson.goal, picker.done);
  return { out: applySkillRun(p, { lessonId, results, stats, stars, bestRide: 2, finished: picker.done, at }), served, results };
}

describe('skill trips', () => {
  it('a Meet lesson brings in at most two new subs, shown first with their trick, then mixes', () => {
    const lesson = SKILL_LESSON['frac-a-1'];
    const pk = new SkillTripPicker({ lesson, mem: {}, now: T0, seed: 1 });
    expect(pk.newKeys.length).toBeLessThanOrEqual(2);
    const first = pk.next()!;
    expect(first.reason).toBe('new');
    expect(first.item.skill).toBe('fr-name');
  });
  it('a miss comes back as the same question two or three later', () => {
    const pk = new SkillTripPicker({ lesson: SKILL_LESSON['frac-a-6'], mem: {}, now: T0, seed: 4 });
    pk.next(); const missed = pk.next()!; pk.answer(false);
    const after: string[] = [];
    for (let i = 0; i < 4; i++) after.push(pk.next()!.item.id);
    expect(after.slice(1, 3)).toContain(missed.item.id);
  });
  it('a checkpoint covers every sub of every skill in the region', () => {
    const pk = new SkillTripPicker({ lesson: SKILL_LESSON['frac-a-6'], mem: {}, now: T0, seed: 8 });
    const keys = new Set<string>();
    let x; while ((x = pk.next())) { keys.add(x.item.key); pk.answer(true); }
    const all = ['fr-name', 'fr-compare', 'fr-equal', 'fr-add'].flatMap(s => SKILL[s].subs.map(sb => `${s}:${sb.id}`));
    expect(all.every(k => keys.has(k))).toBe(true);
  });
  it('end to end: a trip pays like any practice, and subs grow to bloom on three quick days', () => {
    let p = newProfile('Mia', 'dino');
    const a = playTrip('frac-a-1', p, T0);
    expect(a.out.record.finishes).toBe(1);
    expect(a.out.stars).toBeUndefined; // stars live on the record
    expect(a.out.record.stars).toBeGreaterThan(0);
    expect(a.out.shells).toBeGreaterThan(0);
    expect(a.out.xp.gained).toBeGreaterThan(30);
    expect(Object.keys(a.out.profile.math!.skills!).length).toBeGreaterThan(0);
    p = a.out.profile;
    // the same lesson again on two more days, all quick: a sub blooms
    for (const d of [1, 2]) p = playTrip('frac-a-1', p, T0 + d * DAY).out.profile;
    const mem = mathOf(p).skills!;
    expect(Object.values(mem).some(s => s.stage === 3)).toBe(true);
    expect(skillStatus(mathOf(p), 'fr-name')).not.toBe('not started');
    // a slip steps a bloom back to a bud
    const bloomKey = Object.keys(mem).find(k => mem[k].stage === 3)!;
    const r = playTrip('frac-a-1', p, T0 + 3 * DAY, { miss: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] });
    expect(mathOf(r.out.profile).skills![bloomKey].stage).toBeLessThan(3);
    // fact memory untouched by skill trips
    expect(Object.keys(mathOf(p).facts)).toEqual([]);
  });
  it('lessons open in order; the checkpoint and the first are open from the start', () => {
    const m = mathOf(newProfile('Mia', 'dino'));
    expect(skillUnlocked(m, SKILL_LESSON['frac-a-1'])).toBe(true);
    expect(skillUnlocked(m, SKILL_LESSON['frac-a-6'])).toBe(true);
    expect(skillUnlocked(m, SKILL_LESSON['frac-a-2'])).toBe(false);
    expect(nextSkillLesson(m, 'fractions').id).toBe('frac-a-1');
    expect(SKILL_LESSONS.every(l => l.goal > 0 && l.skills.every(s => SKILL[s]))).toBe(true);
  });
  it('placement tests you out of the lessons you already know', () => {
    const p = newProfile('Mia', 'dino');
    const { out } = playTrip('start-fractions', p, T0);
    expect(out.testedOut.length).toBeGreaterThan(0);
    expect(out.testedOut.every(id => mathOf(out.profile).lessons[id].stars > 0)).toBe(true);
  });
  it('an old save (no skill memory) loads unchanged', () => {
    const old = newProfile('Mia', 'dino');
    old.math = { home: 'math', facts: { '6x7': { stage: 2, seen: 3, right: 3, wrong: 0, times: [2000], fastDays: [], last: 1, due: 0, step: 0 } }, lessons: {}, history: [], totals: { trips: 1, facts: 3, ms: 1000 } };
    const back = migrate({ version: 1, profiles: [old], activeId: old.id }).profiles[0];
    expect(mathOf(back).facts['6x7'].stage).toBe(2);
    expect(mathOf(back).skills).toBeUndefined();
    const a: Answer = { kind: 'number', value: 1 };
    expect(a.kind).toBe('number');
  });
});
