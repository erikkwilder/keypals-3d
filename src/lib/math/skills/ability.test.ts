// The ability engine: the model, the update, where estimates start, old saves, and every mode asking
// pitch() (practice, fact trips, battles, duels, arcade orders, Learn, the playground).
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { migrate, newProfile, type Profile } from '../../engine/profile';
import { mathOf } from '../progress';
import { tripStats } from '../meter';
import { MATH_LESSON, factRung } from '../course';
import { TripPicker } from '../picker';
import { epLesson, teachRung } from '../episodes';
import { mathPool } from '../../adventure/state';
import { newDuel, type SideSetup } from '../../adventure/duel';
import { levelsFor, makeOrder } from '../pizza/rush';
import { readyLevel, playUnlocked } from '../playground';
import { SKILL_LESSON } from './course';
import { SkillTripPicker } from './picker';
import { applySkillRun, type SkillResult } from './progress';
import { decayed, expected, kOf, learn, noteAbility, pitch, priorOf, rungFor, TARGET, thetaOf, workingOf, type Ability } from './ability';

const T0 = Date.UTC(2026, 10, 2, 16);
const DAY = 86_400_000;
const at = (t: number, n = 30): Ability => ({ t, n, at: T0 });

describe('the model', () => {
  it('a child at theta = rung gets about 80% right; the rung for a target is the closest', () => {
    expect(expected(3, 3)).toBeCloseTo(0.8, 2);
    expect(rungFor(3, TARGET.practice)).toBe(3);
    expect(rungFor(3, TARGET.quick)).toBe(2); // quick answers one easier
    expect(rungFor(3, TARGET.placement)).toBe(4); // placement looks for the edge
    expect(rungFor(-2, 0.8)).toBe(1); expect(rungFor(9, 0.8)).toBe(6);
  });
  it('learns from each answer: right up, wrong down, slow right a little less; big steps early, small later; games move it less', () => {
    const r = learn(undefined, 3, { rung: 3, ok: true, thinkMs: 1000, fastMs: 6000, at: T0, source: 'trip' });
    const w = learn(undefined, 3, { rung: 3, ok: false, thinkMs: 1000, fastMs: 6000, at: T0, source: 'trip' });
    const slow = learn(undefined, 3, { rung: 3, ok: true, thinkMs: 9000, fastMs: 6000, at: T0, source: 'trip' });
    const vslow = learn(undefined, 3, { rung: 3, ok: true, thinkMs: 20000, fastMs: 6000, at: T0, source: 'trip' });
    expect(r.t).toBeGreaterThan(3); expect(w.t).toBeLessThan(3);
    expect(slow.t).toBeLessThan(r.t); expect(vslow.t).toBeLessThan(slow.t);
    expect(r.n).toBe(1);
    expect(kOf(0, 'trip')).toBeCloseTo(1.2, 5); expect(kOf(200, 'trip')).toBeCloseTo(0.25, 2);
    expect(kOf(10, 'game')).toBeLessThan(kOf(10, 'trip'));
  });
  it('forgets a little over a long gap (half a rung by two months) and listens harder after three weeks away', () => {
    expect(decayed(at(4), T0 + 3 * DAY).t).toBe(4);
    expect(decayed(at(4), T0 + 60 * DAY).t).toBeCloseTo(3.5, 5);
    expect(decayed(at(4), T0 + 200 * DAY).t).toBeCloseTo(3.5, 5);
    const soon = learn(at(4, 200), 0, { rung: 4, ok: true, fastMs: 6000, at: T0 + DAY, source: 'trip' });
    const away = learn(at(4, 200), 0, { rung: 4, ok: true, fastMs: 6000, at: T0 + 25 * DAY, source: 'trip' });
    expect(away.t - decayed(at(4, 200), T0 + 25 * DAY).t).toBeGreaterThan(soon.t - 4);
  });
});

describe('where an estimate starts', () => {
  it('from the area\'s other skills, moved along the ladder by grade', () => {
    const h = { ability: { 'fr-name': at(5), 'fr-unit': at(5) } };
    const equal = priorOf(h, 'fr-equal', T0), unlike = priorOf(h, 'fr-unlike', T0);
    expect(equal).toBeLessThan(5); expect(unlike).toBeLessThan(equal); // grade 4, then grade 5
  });
  it('from the grade the child works at in other areas, or gently with nothing at all', () => {
    expect(priorOf({}, 'fr-name', T0)).toBe(1.5);
    expect(priorOf({}, 'fr-name', T0, true)).toBe(4); // a grown-up player
    const strong = priorOf({ ability: { 'pv-add': at(6), 'pv-round': at(6) } }, 'fr-name', T0);
    const weak = priorOf({ ability: { 'pv-add': at(1), 'pv-round': at(1) } }, 'fr-name', T0);
    expect(strong).toBeGreaterThan(weak);
  });
  it('old saves (no abilities, only memory from the level 1 / level 2 days) start where they were', () => {
    // a sub at "bud" was being asked at the old level 2, which is rung 3
    const bud = { stage: 2 as const, seen: 6, right: 5, wrong: 1, times: [5000], fastDays: [], last: T0, due: 0, step: 0 };
    expect(thetaOf({ skills: { 'fr-name:4': bud, 'fr-name:2': bud } }, 'fr-name', T0)).toBe(3);
    const sprout = { ...bud, stage: 1 as const };
    expect(rungFor(thetaOf({ skills: { 'fr-name:4': sprout } }, 'fr-name', T0), TARGET.practice)).toBeLessThanOrEqual(2);
  });
  it('a right answer nudges the skills just below it up a little; a wrong one nudges nothing else', () => {
    const h = { ability: { 'fr-name': at(2), 'fr-set': at(2), 'fr-line': at(2), 'fr-compare': at(2) } };
    noteAbility(h, [{ skill: 'fr-equal', rung: 4, ok: true, at: T0 }], 'trip');
    expect(h.ability['fr-line'].t).toBeGreaterThan(2); expect(h.ability['fr-compare'].t).toBeGreaterThan(2);
    expect(h.ability['fr-name'].t).toBe(2); // not right below it
    const before = { ...h.ability['fr-compare'] };
    noteAbility(h, [{ skill: 'fr-equal', rung: 4, ok: false, at: T0 }], 'trip');
    expect(h.ability['fr-compare']).toEqual(before);
  });
});

describe('old saves load and play', () => {
  it('a save from before rungs (no abilities) plays a skill trip, a fact trip and a battle pool, and gets estimates', () => {
    const old = newProfile('Mia', 'dino');
    old.math = { home: 'math', facts: { '6x7': { stage: 2, seen: 3, right: 3, wrong: 0, times: [2000], fastDays: [], last: 1, due: 0, step: 0 } }, lessons: {}, history: [], totals: { trips: 1, facts: 3, ms: 1000 },
      skills: { 'fr-name:4': { stage: 2, seen: 4, right: 4, wrong: 0, times: [3000], fastDays: [], last: 1, due: 0, step: 0 } } };
    const p = migrate({ version: 1, profiles: [old], activeId: old.id }).profiles[0];
    const m = mathOf(p);
    expect(m.ability).toBeUndefined();
    const pk = new SkillTripPicker({ lesson: SKILL_LESSON['frac-a-1'], mem: m.skills ?? {}, now: T0, seed: 2, math: m });
    const results: SkillResult[] = [];
    let x; while ((x = pk.next())) { pk.answer(true, 2000); results.push({ id: x.item.id, key: x.item.key, label: x.item.id, ok: true, speed: 'fast', thinkMs: 2000, ms: 3000, intro: x.reason === 'new', rung: x.item.rung }); }
    expect(results.every(r => r.rung! >= 1 && r.rung! <= 6)).toBe(true);
    const out = applySkillRun(p, { lessonId: 'frac-a-1', results, stats: tripStats(results), stars: 2, bestRide: 1, finished: true, at: T0 });
    expect(mathOf(out.profile).ability!['fr-name'].n).toBeGreaterThan(5);
    const fp = new TripPicker({ lesson: MATH_LESSON['sevens-2'], facts: m.facts, now: T0, seed: 3, math: m });
    expect(fp.next()).not.toBeNull();
    expect(mathPool(p).subject).toBe('math');
  });
});

describe('every mode asks pitch()', () => {
  const kid = (name: string, t: number): Profile => {
    const p = newProfile(name, 'dino');
    const m = (p.math = mathOf(p));
    m.skills = { 'fr-name:4': { stage: 2, seen: 9, right: 8, wrong: 1, times: [4000], fastDays: [], last: T0, due: 0, step: 0 }, 'fr-name:8': { stage: 2, seen: 9, right: 8, wrong: 1, times: [4000], fastDays: [], last: T0, due: 0, step: 0 } };
    m.ability = { 'fr-name': at(t), 'add-facts': at(t), 'mult-facts': at(t), 'fr-equal': at(t), 'fr-add': at(t), 'pv-hundreds': at(t), 'pv-count': at(t) };
    return p;
  };
  it('practice: a strong child\'s questions are on higher rungs than a beginner\'s on the same lesson', () => {
    const rungs = (t: number) => { const m = mathOf(kid('x', t)), pk = new SkillTripPicker({ lesson: SKILL_LESSON['frac-a-6'], mem: m.skills!, now: T0, seed: 4, math: m }); const out: number[] = []; let x; while ((x = pk.next())) { out.push(x.item.rung!); pk.answer(true, 2000); } return out; };
    const lo = rungs(1.2), hi = rungs(5.5), mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(hi)).toBeGreaterThan(mean(lo) + 2.5);
  });
  it('fact trips: a strong child meets harder facts, more new ones, and no dot pictures; a beginner gets dots', () => {
    const harder = (t: number) => { const m = mathOf(kid('x', t)), pk = new TripPicker({ lesson: MATH_LESSON['plus-b-1'], facts: {}, now: T0, seed: 5, math: m }); return pk; };
    expect(harder(1).spec.dots).toBe(true);
    expect(harder(5.5).spec.dots).toBe(false);
    expect(harder(6).newFacts.length).toBeGreaterThan(harder(1).newFacts.length);
  });
  it('family duels are fair: a big sister and a little brother each get questions pitched for themselves', () => {
    const side = (p: Profile): SideSetup => ({ name: p.name, buddy: 'dino', kind: 'player', subject: 'math', pool: mathPool(p, 'fractions'), role: 'heart', gear: null, team: [], outfit: 'none', dance: 'dance_hiphop' });
    const sis = kid('Sis', 5.5), bro = kid('Bro', 1.2);
    let sR = 0, bR = 0, n = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const d = newDuel(side(sis), side(bro), 'puddlepup', seed);
      for (const c of d.sides[0].b.cards) if (c.item) { sR += c.item.rung!; n++; }
      for (const c of d.sides[1].b.cards) if (c.item) bR += c.item.rung!;
    }
    expect(n).toBeGreaterThan(50);
    expect(sR / n).toBeGreaterThan(bR / n + 2.5);
  });
  it('arcade orders, Learn\'s own tries and the playground follow the child\'s level too', () => {
    const lo = levelsFor(kid('a', 1)), hi = levelsFor(kid('b', 6));
    const big = (lv: typeof lo) => { const rng = mulberry32(3); let s = 0; for (let i = 0; i < 60; i++) { const o = makeOrder(rng, i + 4, ['tap', 'cut'], lv); s += o.want.d; } return s / 60; };
    expect(big(hi)).toBeGreaterThan(big(lo) + 2); // bigger bottoms on the pizzas
    const easy = epLesson('count-on', teachRung(mathOf(kid('a', 1)), 'count-on'))!, hard = epLesson('count-on', teachRung(mathOf(kid('b', 6)), 'count-on'))!;
    expect(easy.tries[1].text).toBe(epLesson('count-on')!.tries[1].text); // the lesson's own, for a beginner
    expect(Number(hard.tries[1].ans)).toBeGreaterThan(Number(easy.tries[1].ans));
    expect(readyLevel(kid('b', 6), 'build')).toBe(5);
    expect(playUnlocked(kid('b', 6), 'build', 4)).toBe(true);
    expect(playUnlocked(newProfile('c', 'dino'), 'build', 4)).toBe(false); // nothing to go by: as before
  });
  it('pitch, and the words grown-ups see', () => {
    const m = mathOf(kid('a', 4.2));
    expect(pitch(m, 'fr-name', TARGET.practice)).toBe(4);
    expect(workingOf(m, 'fr-name').word).toBe('strong');
    expect(workingOf(mathOf(newProfile('x', 'dino')), 'fr-name').word).toBe('not started');
    expect(factRung({ a: 7, b: 8 })).toBe(6); expect(factRung({ a: 2, b: 9 })).toBe(1); expect(factRung({ a: 8, b: 5, op: '+' })).toBe(6); expect(factRung({ a: 7, b: 4, op: '+' })).toBe(4);
  });
});
