import { describe, expect, it } from 'vitest';
import { factId, newStat, seedPartner, updateFact, weakness, FAST_MS, type FactStat } from './facts';
import { MATH_LESSON, MATH_LESSONS, PLACEMENT, lessonFacts, tableFacts, trickFor } from './course';
import { TripPicker, TRIP_LENGTH, MAX_NEW, type Item } from './picker';
import { FactMeter, MATH_RIDE, mathStars, mathTreasureFor, tripStats, type FactResult } from './meter';
import { applyMathRun, mathOf, mathUnlocked, nextMathLesson, regionPassed } from './progress';
import { migrate, newProfile, applyRun } from '../engine/profile';
import { computeStats } from '../engine/scoring';
import { Session } from '../engine/session';
import { LAYOUTS } from '../engine/layouts';
import { AWARD } from '../engine/achievements';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 27, 15);
const day = (t: number) => new Date(t).toISOString().slice(0, 10);
const fast = (at: number) => ({ ok: true, thinkMs: 1200, day: day(at), at });
const slow = (at: number) => ({ ok: true, thinkMs: 5200, day: day(at), at });
const miss = (at: number) => ({ ok: false, thinkMs: 0, day: day(at), at });

/** Play a whole trip: answer every fact with `ok(item, i)`, return what was asked. */
function play(p: TripPicker, ok: (it: Item, i: number) => boolean = () => true) {
  const out: { item: Item; ok: boolean }[] = [];
  for (let i = 0; i < 200; i++) {
    const it = p.next();
    if (!it) break;
    const right = ok(it, i);
    p.answer(right);
    out.push({ item: it, ok: right });
  }
  return out;
}

describe('fact memory', () => {
  it('blooms only after fast answers on three different days', () => {
    let s: FactStat | undefined;
    for (let i = 0; i < 6; i++) s = updateFact(s, fast(T0 + i * 60_000)); // six fast answers, one day
    expect(s!.stage).toBe(2);
    s = updateFact(s, fast(T0 + DAY));
    expect(s.stage).toBe(2);
    s = updateFact(s, slow(T0 + 2 * DAY)); // slow on a third day doesn't count
    expect(s.stage).toBe(2);
    s = updateFact(s, fast(T0 + 3 * DAY));
    expect(s.stage).toBe(3);
    expect(s.due).toBe(T0 + 4 * DAY); // first review a day later
  });
  it('moves a slip back one step, not to the start', () => {
    let s: FactStat | undefined;
    for (let d = 0; d < 3; d++) s = updateFact(s, fast(T0 + d * DAY));
    expect(s!.stage).toBe(3);
    s = updateFact(s, miss(T0 + 3 * DAY));
    expect(s.stage).toBe(2);
    s = updateFact(s, miss(T0 + 3 * DAY + 1000));
    expect(s.stage).toBe(1);
    s = updateFact(s, miss(T0 + 3 * DAY + 2000));
    expect(s.stage).toBe(1); // a sprout stays a sprout
    // a bloom that slips needs only one more fast day to bloom again
    let b: FactStat | undefined;
    for (let d = 0; d < 3; d++) b = updateFact(b, fast(T0 + d * DAY));
    b = updateFact(b, miss(T0 + 5 * DAY));
    b = updateFact(b, fast(T0 + 6 * DAY));
    expect(b.stage).toBe(3);
  });
  it('a first miss plants a sprout (met with help)', () => {
    expect(updateFact(undefined, miss(T0)).stage).toBe(1);
  });
  it('spaces reviews of a bloomed fact further apart when it stays fast', () => {
    let s: FactStat | undefined;
    for (let d = 0; d < 3; d++) s = updateFact(s, fast(T0 + d * DAY));
    const gaps: number[] = [];
    let t = s!.due;
    for (let i = 0; i < 4; i++) { s = updateFact(s, fast(t)); gaps.push(Math.round((s.due - t) / DAY)); t = s.due; }
    expect(gaps).toEqual([3, 7, 14, 30]);
    s = updateFact(s, slow(t));
    expect(s.due - t).toBe(DAY); // slow on a review: back tomorrow
  });
  it('progress on a × b plants b × a, up to a bud', () => {
    const facts: Record<string, FactStat> = {};
    facts['6x2'] = updateFact(undefined, fast(T0));
    seedPartner(facts, { a: 6, b: 2 });
    expect(facts['2x6'].stage).toBe(2);
    expect(facts['2x6'].seen).toBe(0);
    for (let d = 1; d < 3; d++) facts['6x2'] = updateFact(facts['6x2'], fast(T0 + d * DAY));
    seedPartner(facts, { a: 6, b: 2 });
    expect(facts['6x2'].stage).toBe(3);
    expect(facts['2x6'].stage).toBe(2); // never planted as a bloom: it has to earn that itself
    // and never pulled down
    facts['7x2'] = { ...newStat(), stage: 1 };
    facts['2x7'] = { ...newStat(), stage: 3 };
    seedPartner(facts, { a: 7, b: 2 });
    expect(facts['2x7'].stage).toBe(3);
  });
  it('rates unseen and missed facts weaker than fast ones', () => {
    let good: FactStat | undefined;
    for (let d = 0; d < 3; d++) good = updateFact(good, fast(T0 + d * DAY));
    const shaky = updateFact(updateFact(undefined, miss(T0)), slow(T0 + 1));
    expect(weakness(undefined)).toBe(1);
    expect(weakness(shaky)).toBeGreaterThan(weakness(good));
  });
});

describe('course', () => {
  it('has the 2s, 10s, 5s and 4s, four lessons each, plus the placement trip', () => {
    expect(MATH_LESSONS).toHaveLength(16);
    expect(MATH_LESSONS.map(l => l.id).filter(id => id.endsWith('-4')).map(id => MATH_LESSON[id].tables[0])).toEqual([2, 10, 5, 4]);
    expect(PLACEMENT.tables).toEqual([2, 10, 5, 4]);
  });
  it('gives every fact a trick', () => {
    expect(trickFor({ a: 7, b: 0 }).table).toBe(0);
    expect(trickFor({ a: 1, b: 9 }).table).toBe(1);
    expect(trickFor({ a: 6, b: 2 })).toEqual({ table: 2, a: 6 });
    expect(trickFor({ a: 4, b: 7 })).toEqual({ table: 4, a: 7 }); // a turnaround uses its partner's trick
  });
  it('lists 11 facts per table', () => {
    for (const t of [2, 10, 5, 4]) expect(tableFacts(t)).toHaveLength(11);
    expect(lessonFacts(MATH_LESSON['twins-1']).every(f => f.a <= 1 || f.b <= 1)).toBe(true);
  });
});

describe('fact picker', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i * 7919 + 1);

  it('never brings more than three new facts into a trip', () => {
    for (const l of MATH_LESSONS) for (const seed of seeds.slice(0, 10)) {
      const p = new TripPicker({ lesson: l, facts: {}, now: T0, seed });
      expect(p.newFacts.length).toBeLessThanOrEqual(3);
      expect(p.newFacts.length).toBeLessThanOrEqual(MAX_NEW[l.kind]);
      const asked = play(p);
      const unseen = new Set(asked.filter(a => a.item.reason === 'new').map(a => factId(a.item.fact)));
      expect(unseen.size).toBe(p.newFacts.length);
      expect(asked.filter(a => a.item.reason === 'new')).toHaveLength(p.newFacts.length); // each is introduced once
    }
  });
  it('a new fact comes back after 1, then 3, then 6 other facts', () => {
    const p = new TripPicker({ lesson: MATH_LESSON['twins-2'], facts: {}, now: T0, seed: 3 });
    const asked = play(p).map(a => a.item);
    const first = p.newFacts[0];
    const at = asked.map((it, i) => (factId(it.fact) === factId(first) ? i : -1)).filter(i => i >= 0);
    expect(at.length).toBeGreaterThanOrEqual(4);
    expect(at[1] - at[0]).toBe(2);
    expect(at[2] - at[1]).toBe(4);
    expect(at[3] - at[2]).toBe(7);
  });
  it('brings a missed fact back 2 to 4 facts later, every time', () => {
    let checked = 0;
    for (const l of MATH_LESSONS) for (const seed of seeds) {
      const p = new TripPicker({ lesson: l, facts: {}, now: T0, seed });
      const rng = seed;
      const asked = play(p, (_it, i) => ((i * 31 + rng) % 5) !== 0); // misses about one in five
      asked.forEach((a, i) => {
        // every miss in the planned 20 comes back (the trip runs on up to 3 facts for late ones)
        if (a.ok || i >= TRIP_LENGTH) return;
        const back = asked.findIndex((b, j) => j > i && factId(b.item.fact) === factId(a.item.fact));
        expect(back, `${l.id} seed ${seed} miss at ${i}`).toBeGreaterThan(i);
        expect(back - i).toBeGreaterThanOrEqual(2);
        expect(back - i).toBeLessThanOrEqual(4);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(500);
  });
  it('makes a trip of 20 facts, a few more only to bring late misses back', () => {
    for (const l of MATH_LESSONS) {
      expect(play(new TripPicker({ lesson: l, facts: {}, now: T0, seed: 5 }))).toHaveLength(TRIP_LENGTH);
      const missy = play(new TripPicker({ lesson: l, facts: {}, now: T0, seed: 5 }), (_it, i) => i !== 19);
      expect(missy.length).toBeGreaterThan(TRIP_LENGTH);
      expect(missy.length).toBeLessThanOrEqual(TRIP_LENGTH + 3);
    }
  });
  it('never asks the same fact twice in a row', () => {
    for (const l of MATH_LESSONS) for (const seed of seeds.slice(0, 15)) {
      const asked = play(new TripPicker({ lesson: l, facts: {}, now: T0, seed })).map(a => factId(a.item.fact));
      asked.forEach((id, i) => { if (i) expect(id, `${l.id} ${seed} at ${i}`).not.toBe(asked[i - 1]); });
    }
  });
  it('checkpoints ask every fact of the table and its turnarounds', () => {
    const p = new TripPicker({ lesson: MATH_LESSON['fours-4'], facts: {}, now: T0, seed: 9 });
    const ids = new Set(play(p).map(a => factId(a.item.fact)));
    for (let a = 0; a <= 10; a++) expect(ids.has(`${a}x4`)).toBe(true);
    for (const a of [2, 3, 5, 6, 7, 8, 9, 10]) expect(ids.has(`4x${a}`)).toBe(true);
    expect(p.newFacts).toHaveLength(0);
  });
  it('fills a trip with the facts that need it most, and reviews what is due', () => {
    const facts: Record<string, FactStat> = {};
    for (const f of tableFacts(2)) facts[factId(f)] = { ...newStat(), stage: 3, seen: 9, right: 9, times: [900], due: T0 + 5 * DAY };
    facts['7x2'] = { ...newStat(), stage: 1, seen: 4, right: 1, wrong: 3, times: [5000] }; // shaky
    facts['3x2'] = { ...facts['3x2'], due: T0 - 1000 }; // due for review
    let shaky = 0, review = 0, solid = 0;
    for (const seed of seeds) {
      const asked = play(new TripPicker({ lesson: MATH_LESSON['twins-3'], facts, now: T0, seed })).map(a => a.item);
      shaky += asked.filter(it => factId(it.fact) === '7x2').length;
      review += asked.filter(it => factId(it.fact) === '3x2').length;
      solid += asked.filter(it => factId(it.fact) === '8x2').length;
    }
    expect(shaky).toBeGreaterThan(solid * 1.5);
    expect(review).toBeGreaterThan(solid);
  });
  it("doesn't grind a table that has all bloomed: reviews due elsewhere come up", () => {
    const facts: Record<string, FactStat> = {};
    for (const f of tableFacts(2)) facts[factId(f)] = { ...newStat(), stage: 3, seen: 12, right: 12, times: [800], due: T0 + 9 * DAY };
    for (const f of tableFacts(10)) facts[factId(f)] = { ...newStat(), stage: 3, seen: 12, right: 12, times: [800], due: T0 - 1000 };
    let tens = 0, total = 0;
    for (const seed of seeds.slice(0, 10)) {
      const asked = play(new TripPicker({ lesson: MATH_LESSON['twins-3'], facts, now: T0, seed })).map(a => a.item);
      tens += asked.filter(it => it.fact.b === 10).length;
      total += asked.length;
    }
    expect(tens / total).toBeGreaterThan(0.4);
  });
  it('a new player with nothing known still gets a full trip', () => {
    const asked = play(new TripPicker({ lesson: MATH_LESSON['twins-2'], facts: {}, now: T0, seed: 1 }));
    expect(asked).toHaveLength(TRIP_LENGTH);
    expect(asked.every(a => a.item.fact.b === 2)).toBe(true);
  });
  it('the placement trip samples all four tables evenly', () => {
    const asked = play(new TripPicker({ lesson: PLACEMENT, facts: {}, now: T0, seed: 2 })).map(a => a.item.fact.b);
    expect(asked).toHaveLength(20);
    for (const t of [2, 10, 5, 4]) expect(asked.filter(b => b === t)).toHaveLength(5);
  });
});

describe('math speed and score', () => {
  const r = (ok: boolean, ms: number, think = ms * 0.6, intro = false): FactResult => ({ id: '6x2', ok, speed: !ok ? 'miss' : think <= FAST_MS ? 'fast' : 'slow', thinkMs: think, ms, intro });
  it('counts facts a minute over answering time, leaving out the trick showings', () => {
    const st = tripStats([r(true, 3000, 1000, true), ...Array.from({ length: 20 }, () => r(true, 3000))]);
    expect(st.asked).toBe(20);
    expect(st.fpm).toBe(20);
    expect(st.score).toBe(20);
    const sloppy = tripStats([...Array.from({ length: 18 }, () => r(true, 3000)), r(false, 6000), r(false, 6000)]);
    expect(sloppy.acc).toBeCloseTo(0.9);
    expect(sloppy.score).toBe(Math.round((18 / (66000 / 60000)) * 0.9));
  });
  it('gives stars as shares of the goal, the third only at 85% right or better', () => {
    const st = tripStats(Array.from({ length: 20 }, () => r(true, 3000)));
    expect(mathStars(st, 12, true)).toBe(3);
    expect(mathStars(st, 30, true)).toBe(2);
    expect(mathStars(st, 70, true)).toBe(0);
    expect(mathStars(st, 12, false)).toBe(0);
    const guessy = tripStats([...Array.from({ length: 16 }, () => r(true, 1000)), ...Array.from({ length: 4 }, () => r(false, 1000))]);
    expect(mathStars(guessy, 12, true)).toBe(2);
  });
  it('climbs the rides with facts a minute, and not by guessing', () => {
    const climb = (ok: (i: number) => boolean, ms: number) => {
      const m = new FactMeter(false);
      let t = 0;
      for (let i = 0; i < 20; i++) { m.shown(t); t += ms; m.push(ok(i), ms); for (let k = 0; k < 20; k++) m.update(t + k * 50); t += 1000; }
      return m.best;
    };
    expect(climb(() => true, 1800)).toBe(5); // about 33 a minute: the rocket
    expect(climb(() => true, 4000)).toBe(2); // 15 a minute: the skateboard
    expect(climb(() => true, 3500)).toBe(3); // about 17 a minute: the bike
    expect(climb(() => true, 9000)).toBe(0); // 6.7 a minute: walking
    expect(climb(i => i % 2 === 0, 1800)).toBeLessThan(2); // half wrong, however fast
    expect(MATH_RIDE.kids).toEqual([0, 8, 12, 16, 22, 30]);
  });
  it('maps scores to treasures', () => {
    expect(mathTreasureFor(0, false)).toBe(-1);
    expect(mathTreasureFor(14, false)).toBe(4);
    expect(mathTreasureFor(33, false)).toBe(9);
    expect(mathTreasureFor(33, true)).toBe(6);
  });
});

describe('math progress and rewards', () => {
  const results = (lessonId: string, ok = true): FactResult[] => {
    const p = new TripPicker({ lesson: MATH_LESSON[lessonId], facts: {}, now: T0, seed: 4 });
    return play(p, () => ok).map(a => ({ id: factId(a.item.fact), ok: a.ok, speed: a.ok ? 'fast' as const : 'miss' as const, thinkMs: 1000, ms: 2400, intro: a.item.reason === 'new' }));
  };
  it('old saves load with no math progress, and the typing game still saves', () => {
    const old = migrate({ version: 1, activeId: 'x', profiles: [{ ...newProfile('Ava', 'koala'), id: 'x', math: undefined }] });
    expect(old.profiles[0].math).toBeUndefined();
    const m = mathOf(old.profiles[0]);
    expect(m.home).toBe('typing');
    expect(nextMathLesson(m).id).toBe('twins-1');
    // a typing lesson still applies and saves
    const s = new Session('fff jjj fff jjj');
    let t = 1000;
    for (const ch of 'fff jjj fff jjj') { t += 220; s.press(ch, t); }
    const out = applyRun(old.profiles[0], { lessonId: 'village-1', stats: computeStats(s), stars: 2, bestRide: 1, keyboardHidden: false, finished: true, at: T0 }, LAYOUTS.qwerty);
    expect(out.record.stars).toBe(2);
    expect(out.profile.math).toBeUndefined();
  });
  it('keeps the math progress through a save and load', () => {
    const p = newProfile('Ava', 'dino');
    const rs = results('twins-2');
    const out = applyMathRun(p, { lessonId: 'twins-2', results: rs, stats: tripStats(rs), stars: 3, bestRide: 3, finished: true, at: T0 });
    const back = migrate(JSON.parse(JSON.stringify({ version: 1, activeId: out.profile.id, profiles: [out.profile] }))).profiles[0];
    expect(mathOf(back).lessons['twins-2'].stars).toBe(3);
    expect(Object.keys(mathOf(back).facts).length).toBeGreaterThan(3);
  });
  it('a trip earns the same kinds of rewards as a typing lesson', () => {
    const p = newProfile('Ava', 'dino');
    const rs = results('twins-2');
    const st = tripStats(rs);
    const out = applyMathRun(p, { lessonId: 'twins-2', results: rs, stats: st, stars: 3, bestRide: 4, finished: true, at: T0 });
    const ids = out.medals.map(m => m.id);
    expect(ids).toEqual(expect.arrayContaining(['clean', 'ride-car', 'firsttry', 'three']));
    expect(out.xp.gained).toBeGreaterThan(40);
    expect(out.treasure).toBeGreaterThanOrEqual(0);
    expect(out.profile.pals.dino!.runs).toBe(1);
    expect(out.profile.pals.dino!.dances).toBe(1);
    expect(out.stickers.map(s => s.id)).toContain('runs-1');
    expect(out.profile.days[Object.keys(out.profile.days)[0]].ms).toBe(st.ms);
    for (const m of ['quickdraw', 'bloom']) expect(AWARD[m]).toBeTruthy();
    expect(out.grew.sprouted.length + out.grew.budded.length).toBeGreaterThan(3);
  });
  it('opens lessons in order, checkpoints early, and the next region after a checkpoint', () => {
    let p = newProfile('Ava', 'dino');
    const m0 = mathOf(p);
    expect(mathUnlocked(m0, MATH_LESSON['twins-1'])).toBe(true);
    expect(mathUnlocked(m0, MATH_LESSON['twins-2'])).toBe(false);
    expect(mathUnlocked(m0, MATH_LESSON['twins-4'])).toBe(true); // test out
    expect(mathUnlocked(m0, MATH_LESSON['tens-1'])).toBe(false);
    const rs = results('twins-4');
    p = applyMathRun(p, { lessonId: 'twins-4', results: rs, stats: tripStats(rs), stars: 2, bestRide: 2, finished: true, at: T0 }).profile;
    const m1 = mathOf(p);
    expect(regionPassed(m1, 'twins')).toBe(true);
    expect(mathUnlocked(m1, MATH_LESSON['tens-1'])).toBe(true);
    expect(nextMathLesson(m1).id).toBe('tens-1');
  });
  it('the placement trip tests out of tables answered right and fast, in order', () => {
    const p = newProfile('Ava', 'dino');
    const asked = play(new TripPicker({ lesson: PLACEMENT, facts: {}, now: T0, seed: 8 })).map(a => a.item.fact);
    const rs: FactResult[] = asked.map(f => ({ id: factId(f), ok: f.b !== 5, speed: f.b !== 5 ? 'fast' : 'miss', thinkMs: 900, ms: 2000, intro: false }));
    const out = applyMathRun(p, { lessonId: PLACEMENT.id, results: rs, stats: tripStats(rs), stars: 1, bestRide: 2, finished: true, at: T0 });
    expect(out.testedOut).toEqual(['twins', 'tens']); // stops at the 5s, so the 4s aren't skipped either
    expect(nextMathLesson(mathOf(out.profile)).id).toBe('fives-1');
  });
});
