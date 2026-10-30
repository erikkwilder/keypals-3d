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
  it('lists every K-8 area, the four fact strands, fractions, decimals and measurement live', () => {
    expect(AREAS.length).toBe(13);
    expect(AREAS.filter(a => a.live).map(a => a.id)).toEqual(['plus', 'minus', 'times', 'share', 'fractions', 'place', 'decimals', 'measure', 'shapes', 'ratios', 'integers']);
    expect(skillsOf('fractions').map(s => s.id)).toEqual(['fr-name', 'fr-unit', 'fr-set', 'fr-line', 'fr-compare', 'fr-equal', 'fr-add', 'fr-sub', 'fr-mixed', 'fr-times', 'fr-unlike']);
    for (const s of SKILLS) { expect(s.standard).toMatch(/^[\dK]\.[A-Z]+\./); expect(s.subs.length).toBeGreaterThan(0); }
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
        for (const p of it.prompt) if (p.t === 'pic') { if (p.pic.kind === 'coins') expect(p.pic.coins.length).toBeGreaterThan(0); else { expect(p.pic.filled).toBeGreaterThan(0); expect(p.pic.filled).toBeLessThan(p.pic.parts); } }
      }
      // (halves have only one fraction to show, as a pie or a bar)
      expect(ids.size, `${s.id}:${sub.id}:${lv}`).toBeGreaterThan(1);
    }
  });
  it('name the fraction: a picture of n of d parts is n/d', () => {
    const it = SKILL['fr-name'].make(mulberry32(5), '8', 2);
    const p = it.prompt[0];
    expect(p.t).toBe('pic');
    if (p.t === 'pic' && p.pic.kind !== 'coins' && it.answer.kind === 'fraction') { expect(it.answer.n).toBe(p.pic.filled); expect(it.answer.d).toBe(8); }
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
    const pk = new SkillTripPicker({ lesson: SKILL_LESSON['frac-a-7'], mem: {}, now: T0, seed: 4 });
    pk.next(); const missed = pk.next()!; pk.answer(false);
    const after: string[] = [];
    for (let i = 0; i < 4; i++) after.push(pk.next()!.item.id);
    expect(after.slice(1, 3)).toContain(missed.item.id);
  });
  it('a checkpoint covers every sub of every skill in the region', () => {
    const pk = new SkillTripPicker({ lesson: SKILL_LESSON['frac-a-7'], mem: {}, now: T0, seed: 8 });
    const keys = new Set<string>();
    let x; while ((x = pk.next())) { keys.add(x.item.key); pk.answer(true); }
    const all = ['fr-name', 'fr-unit', 'fr-set', 'fr-line', 'fr-compare'].flatMap(s => SKILL[s].subs.map(sb => `${s}:${sb.id}`));
    expect(all.every(k => keys.has(k))).toBe(true);
  });
  it('end to end: a trip pays like any practice, and subs grow to bloom on three quick days', () => {
    let p = newProfile('Mia', 'dino');
    const a = playTrip('frac-a-1', p, T0);
    expect(a.out.record.finishes).toBe(1);
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
    const blooms = Object.keys(mem).filter(k => mem[k].stage === 3);
    const r = playTrip('frac-a-1', p, T0 + 3 * DAY, { miss: Array.from({ length: 40 }, (_, i) => i) });
    const missed = new Set(r.results.filter(x => !x.ok).map(x => x.key));
    const hit = blooms.filter(k => missed.has(k));
    expect(hit.length).toBeGreaterThan(0);
    for (const k of hit) expect(mathOf(r.out.profile).skills![k].stage).toBeLessThan(3);
    // fact memory untouched by skill trips
    expect(Object.keys(mathOf(p).facts)).toEqual([]);
  });
  it('lessons open in order; the checkpoint and the first are open from the start', () => {
    const m = mathOf(newProfile('Mia', 'dino'));
    expect(skillUnlocked(m, SKILL_LESSON['frac-a-1'])).toBe(true);
    expect(skillUnlocked(m, SKILL_LESSON['frac-a-7'])).toBe(true);
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

describe('the whole fractions area', () => {
  it('no generator loops, whatever the random numbers (constant sources included)', () => {
    for (const v of [0, 0.37, 0.5, 0.999999]) {
      const rng = () => v;
      for (const s of FRACTION_SKILLS) for (const sub of s.subs) for (const lv of [1, 2] as const) {
        const it = s.make(rng, sub.id, lv);
        expect(s.check(it, it.answer), `${s.id}:${sub.id}:${lv}@${v}`).toBe(true);
        if (it.answer.kind === 'fraction') { expect(it.answer.n).toBeGreaterThan(0); expect(Number.isInteger(it.answer.n) && Number.isInteger(it.answer.d)).toBe(true); }
        if (it.answer.kind === 'number') expect(Number.isFinite(it.answer.value) && it.answer.value > 0).toBe(true);
      }
    }
  });
  it('every lesson draws on real skills, each region ends in a checkpoint, and the placement walks the area\'s ladder', () => {
    expect(SKILL_LESSONS.filter(l => l.area === 'fractions').length).toBe(18);
    for (const r of ['frac-a', 'frac-b', 'frac-c']) expect(SKILL_LESSONS.filter(l => l.region === r).at(-1)!.kind).toBe('check');
    const run = (ok: boolean) => {
      const pl = new SkillTripPicker({ lesson: SKILL_LESSON['start-fractions'], mem: {}, now: T0, seed: 3 });
      const asked: { skill: string; rung: number }[] = [];
      let x; while ((x = pl.next())) { asked.push({ skill: x.item.skill, rung: x.item.rung! }); expect(x.reason).toBe('test'); pl.answer(ok); }
      return asked;
    };
    const up = run(true), down = run(false);
    expect(up.length).toBeGreaterThanOrEqual(12); expect(up.length).toBeLessThanOrEqual(16);
    expect(new Set(up.map(a => a.skill)).size).toBeGreaterThanOrEqual(6); // across the area, not one skill
    const order = FRACTION_SKILLS.map(s => s.id), late = (xs: typeof up) => xs.slice(-6).reduce((t, a) => t + order.indexOf(a.skill) + a.rung, 0) / 6;
    expect(late(up)).toBeGreaterThan(late(down) + 5); // all right climbs to later skills and higher rungs
    expect(down.slice(-4).every(a => a.rung <= 2 && order.indexOf(a.skill) <= 4)).toBe(true);
  });
  it('a Meet lesson only asks the subs it has introduced', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const pk = new SkillTripPicker({ lesson: SKILL_LESSON['frac-a-1'], mem: {}, now: T0, seed });
      const shown = new Set<string>();
      let x; while ((x = pk.next())) {
        if (x.reason === 'new') shown.add(x.item.key);
        expect(shown.has(x.item.key), `${x.item.key} (${x.reason}) before its intro`).toBe(true);
        pk.answer(true);
      }
    }
  });
  it('checks the new kinds: a pin on the line, mixed numbers, different bottoms and sets', () => {
    const line = SKILL['fr-line'].make(mulberry32(3), 'to-one', 2);
    const want = (line.answer as { x: number }).x, step = line.line!.step;
    expect(SKILL['fr-line'].check(line, { kind: 'point', x: Math.round(want / step) * step })).toBe(true);
    expect(SKILL['fr-line'].check(line, { kind: 'point', x: want + step })).toBe(false);
    const mixed = SKILL['fr-mixed'].make(mulberry32(4), 'to-frac', 2);
    const [w, f] = mixed.prompt as [{ t: 'num'; n: number }, { t: 'frac'; n: number; d: number }];
    expect((mixed.answer as { value: number }).value).toBe(w.n * f.d + f.n);
    const un = SKILL['fr-unlike'].make(mulberry32(5), 'both', 2);
    const { n, d } = un.answer as { n: number; d: number };
    expect(SKILL['fr-unlike'].check(un, { kind: 'fraction', n: n * 3, d: d * 3 })).toBe(true);
    const set = SKILL['fr-set'].make(mulberry32(6), 'name', 2);
    const p = set.prompt[0];
    expect(p.t === 'pic' && p.pic.kind === 'set').toBe(true);
    const of = SKILL['fr-set'].make(mulberry32(7), 'of', 2);
    const [top, , whole] = of.prompt as [{ t: 'frac'; n: number; d: number }, unknown, { t: 'num'; n: number }];
    expect((of.answer as { value: number }).value).toBe((whole.n / top.d) * top.n);
  });
});
