// Ratios and percents: the twelve skills say what they ask and check what they say, every kind of
// question carries its own trick, the custom inputs' answers match their pictures, and the Juice Jungle's
// three islands open one after another, with a placement that walks the area's ladder.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { newProfile } from '../../engine/profile';
import { mathOf } from '../progress';
import { tripStats, mathStars } from '../meter';
import { RATIO_SKILLS, RATIO_INPUTS, rtDnl, rtPct, rtPctOf, rtRate, rtTable, rtUnits, rtWhole, type DnlSpec, type PctBarSpec, type TableSpec } from './ratios';
import { AREA, SKILL, skillsOf } from './registry';
import { SKILL_EPISODES, SKILL_LESSON, SKILL_LESSONS, SKILL_PLACEMENTS, nextSkillLesson, skillMovedOn, skillRegionsOf, skillUnlocked, tempoOf } from './course';
import { SkillTripPicker } from './picker';
import { applySkillRun, type SkillResult } from './progress';
import { RUNGS } from './types';

const T0 = new Date('2026-11-02T16:00:00').getTime();

describe('ratios and percents skills', () => {
  it('are twelve live skills for grades 6 and 7, each with a plain description and subs', () => {
    expect(AREA.ratios.live).toBe(true);
    expect(skillsOf('ratios').map(s => s.id)).toEqual(['rt-ratio', 'rt-table', 'rt-dnl', 'rt-rate', 'rt-pct', 'rt-pctof', 'rt-whole', 'rt-units', 'rt-prop', 'rt-change', 'rt-shop', 'rt-scale']);
    for (const s of RATIO_SKILLS) {
      expect([6, 7]).toContain(s.grade);
      expect(s.standard).toMatch(/^[67]\.(RP|G)\./);
      expect(s.plain.length).toBeGreaterThan(30);
      expect(SKILL[s.id]).toBe(s);
    }
    expect(tempoOf('ratios')).toBeGreaterThan(2);
  });
  it('every question at every rung has its trick and an explanation, and custom inputs are the area\'s own', () => {
    for (const s of RATIO_SKILLS) for (const sub of s.subs) for (let r = 1; r <= RUNGS; r++) {
      const rng = mulberry32(r * 31 + sub.id.length);
      for (let i = 0; i < 40; i++) {
        const it = s.make(rng, sub.id, r);
        expect(it.trick?.say.length, `${s.id}:${sub.id}:${r}`).toBeGreaterThan(10);
        expect(it.explain.length).toBeGreaterThan(5);
        expect(it.ask.length).toBeGreaterThan(5);
        if (it.input === 'custom') expect(RATIO_INPUTS).toContain(it.custom!.name);
      }
    }
  });
  it('a ratio table\'s gap is that column\'s number, and every column is the same mix', () => {
    const rng = mulberry32(5);
    for (let r = 1; r <= 6; r++) for (const sub of ['down', 'up']) {
      const it = rtTable.make(rng, sub, r), sp = it.custom!.spec as TableSpec;
      const [c, row] = sp.gap;
      expect(it.answer).toEqual({ kind: 'number', value: sp.cols[c][row] });
      const [a, b] = sp.cols[0];
      for (const [x, y] of sp.cols) expect(x * b).toBe(y * a);
      expect(rtTable.check(it, { kind: 'number', value: sp.cols[c][row] + 1 })).toBe(false);
    }
  });
  it('a double number line: the pin goes where its number is, and both lines count the same mix', () => {
    const rng = mulberry32(9);
    for (let r = 1; r <= 6; r++) {
      const place = rtDnl.make(rng, 'place', r), sp = place.custom!.spec as DnlSpec;
      expect(place.answer).toEqual({ kind: 'point', x: Math.round(sp.at * sp.bot.step * 1000) / 1000 });
      expect(rtDnl.check(place, { kind: 'point', x: (sp.at + 1) * sp.bot.step })).toBe(false);
      expect(sp.at).toBeLessThanOrEqual(sp.n);
      const read = rtDnl.make(rng, 'read', r), sr = read.custom!.spec as DnlSpec;
      expect(read.answer).toEqual({ kind: 'number', value: Math.round(sr.at * sr.bot.step * 100) / 100 });
      // the asked tick's number is hidden: that's the gap
      expect(sr.bot.show).not.toContain(sr.at);
    }
  });
  it('the percent bar is answered in percent, in steps it can reach', () => {
    const rng = mulberry32(2);
    for (let r = 1; r <= 6; r++) for (let i = 0; i < 30; i++) {
      const it = rtPct.make(rng, 'bar', r), sp = it.custom!.spec as PctBarSpec;
      const x = (it.answer as { x: number }).x;
      expect(x % sp.step).toBe(0);
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(100);
      if (sp.whole !== null) expect(Number.isInteger((x * sp.whole) / 100)).toBe(true);
    }
  });
  it('percents and rates come out right', () => {
    const rng = mulberry32(13);
    for (let i = 0; i < 200; i++) {
      const of = rtPctOf.make(rng, ['half', 'tens', 'any'][i % 3], 1 + (i % 6));
      const [p, , N] = of.prompt.filter(x => x.t === 'num').map(x => (x as { n: number }).n).concat([0]);
      const nums = of.prompt.filter(x => x.t === 'num').map(x => (x as { n: number }).n);
      expect((of.answer as { value: number }).value).toBeCloseTo((nums[0] * nums[1]) / 100, 6);
      void p; void N;
      const wh = rtWhole.make(rng, i % 2 ? 'easy' : 'any', 1 + (i % 6));
      const [part, pct] = wh.prompt.filter(x => x.t === 'num').map(x => (x as { n: number }).n);
      expect(((wh.answer as { value: number }).value * pct) / 100).toBeCloseTo(part, 6);
    }
    const best = rtRate.make(mulberry32(4), 'best', 3);
    expect(best.input).toBe('choice');
    expect(['a', 'b', 'same']).toContain((best.answer as { id: string }).id);
    const u = rtUnits.make(mulberry32(1), 'time', 1);
    expect((u.answer as { value: number }).value % 60 === 0 || (u.answer as { value: number }).value % 24 === 0 || (u.answer as { value: number }).value % 7 === 0).toBe(true);
  });
});

// answer a whole trip, all right (or all wrong)
function playTrip(lessonId: string, p: ReturnType<typeof newProfile>, at: number, ok = true) {
  const lesson = SKILL_LESSON[lessonId];
  const picker = new SkillTripPicker({ lesson, mem: mathOf(p).skills ?? {}, now: at, seed: 42, math: mathOf(p) });
  const results: SkillResult[] = [];
  let pick;
  while ((pick = picker.next())) {
    picker.answer(ok);
    results.push({ id: pick.item.id, key: pick.item.key, label: pick.item.id, ok, speed: ok ? 'fast' : 'miss', thinkMs: 2500, ms: 4000, intro: pick.reason === 'new', rung: pick.item.rung });
  }
  const stats = tripStats(results);
  return applySkillRun(p, { lessonId, results, stats, stars: mathStars(stats, lesson.goal, picker.done), bestRide: 2, finished: picker.done, at });
}

describe('the Juice Jungle course', () => {
  it('three islands, each ending in a run, with a Meet stop for every skill and a placement', () => {
    const rs = skillRegionsOf('ratios');
    expect(rs.map(r => r.name)).toEqual(['The Fruit Stall', 'Mango Grove', 'Canopy Juice Bar']);
    for (const r of rs) { expect(r.lessons.at(-1)!.kind).toBe('check'); expect(r.art).toMatch(/^math\/ratios\/region-/); }
    const met = new Set(SKILL_LESSONS.filter(l => l.area === 'ratios' && l.kind === 'meet').flatMap(l => l.learn));
    for (const s of RATIO_SKILLS) expect(met.has(s.id), s.id).toBe(true);
    expect(SKILL_PLACEMENTS.ratios?.kind).toBe('placement');
    for (const s of RATIO_SKILLS) if (SKILL_EPISODES[s.id]) expect(SKILL_EPISODES[s.id]).toMatch(/^rt-/);
  });
  it('every trip can be reached by playing the stops in order', () => {
    let p = newProfile('Ava', 'dino');
    const all = SKILL_LESSONS.filter(l => l.area === 'ratios');
    const seen = new Set<string>();
    for (let step = 0; step < all.length + 2; step++) {
      const m = mathOf(p);
      for (const l of all) if (skillUnlocked(m, l)) seen.add(l.id);
      if (all.every(l => skillMovedOn(m, l))) break;
      const next = nextSkillLesson(m, 'ratios');
      expect(skillUnlocked(m, next), next.id).toBe(true);
      p = playTrip(next.id, p, T0 + step * 3600_000).profile;
    }
    expect([...seen].sort()).toEqual(all.map(l => l.id).sort());
    expect(all.every(l => skillMovedOn(mathOf(p), l))).toBe(true);
  });
  it('a trip on every stop asks only that stop\'s skills', () => {
    for (const l of SKILL_LESSONS.filter(x => x.area === 'ratios')) {
      const picker = new SkillTripPicker({ lesson: l, mem: {}, now: T0, seed: 7 });
      for (let i = 0; i < 14; i++) { const pk = picker.next(); if (!pk) break; expect(l.skills).toContain(pk.item.skill); picker.answer(true); }
    }
  });
  it('the placement climbs on right answers, tests out of what it can, and opens nothing on a miss', () => {
    const up = playTrip('start-ratios', newProfile('Ava', 'dino'), T0, true);
    expect(up.testedOut.length).toBeGreaterThan(0);
    expect(up.testedOut.every(id => SKILL_LESSON[id].area === 'ratios')).toBe(true);
    const down = playTrip('start-ratios', newProfile('Ava', 'dino'), T0, false);
    expect(down.testedOut.length).toBe(0);
    expect(nextSkillLesson(mathOf(down.profile), 'ratios').id).toBe('ratio-a-1');
  });
});
