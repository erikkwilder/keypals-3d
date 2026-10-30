// The curriculum on My path (Phase 1: re-sort what exists): walks the whole math path and checks the
// acceptance numbers from the spec, the lesson trips, Show What You Know, and an old save carried over.
import { describe, expect, it } from 'vitest';
import { newProfile, type Profile } from '../engine/profile';
import { finishLesson } from '../math/learn';
import { mathOf } from '../math/progress';
import { MATH_LESSON, MATH_LESSONS, groupFacts } from '../math/course';
import { SKILL_LESSON, SKILL_LESSONS, SKILL_REGIONS } from '../math/skills/course';
import { SKILL } from '../math/skills/registry';
import { SkillTripPicker } from '../math/skills/picker';
import { applySkillRun } from '../math/skills/progress';
import { epLesson } from '../math/episodes';
import { advOf } from '../adventure/state';
import { CUR_LESSONS, CUR_UNITS } from './curriculum';
import { LEARN_TEACHES, SPEC } from './lessonSpecs';
import { checkTrips, gradeScope, isFactSkill, practiceTrips, skillPart, swykId } from './lessonTrips';
import { GAME_TOPICS, PATH_LESSON_IDS, WORLD_TOPICS, areaGrades, learnGrades, lessonLearn, learnFits, lessonKeys, lessonTopic, oldUnit, pathOf, unitById } from './units';
import { UNIT_TITLE } from './lessonSpecs';
import { trailOf } from '../nav';
import { lessonTicks } from './lessonProgress';
import { nextOnPath, notePath, pathSave, pathStates, startPath, unitState, type PathProfile } from './progress';
import { unitFromAssignment } from './classPath';
import { setHomeRules } from './rules';

const MON = new Date(2026, 9, 26, 10, 0).getTime();
const DAY = 86400000;
const kid = () => newProfile('Ana', 'dino');
const PHASE1 = CUR_LESSONS.filter(l => l.ready === 'phase1').map(l => l.id);
const math = () => pathOf('math');
/** every lesson on the path in order, with its unit and the items of its unit */
const walk = () => math().flatMap(u => (u.lessons ?? []).map(id => ({ id, unit: u, grade: CUR_LESSONS.find(l => l.id === id)!.grade })));
/** what a trip asks: its memory keys (skill trips) or fact groups */
function asks(t: string): string[] {
  const s = SKILL_LESSON[t];
  if (s) return s.skills.flatMap(sk => SKILL[sk].subs.map(sb => `${sk}:${sb.id}`).filter(k => !s.subs || s.subs.includes(k) || s.subs.includes(sk)));
  const f = MATH_LESSON[t];
  return f ? (f.kind === 'rules' ? ['facts:rules'] : f.groups.map(g => `${f.op}:${g}`)) : [];
}
function passTrip(p: Profile, id: string, at = MON) {
  const m = (p.math = mathOf(p));
  m.lessons[id] = { stars: 2, bestScore: 10, bestFpm: 10, bestAcc: 0.9, bestRide: 1, attempts: 1, finishes: 1, passes: 1, lastAt: at };
}

describe('the curriculum on the path: the acceptance numbers', () => {
  it('all 70 Phase-1 lessons are on the path, with every ready lesson (139), in curriculum order', () => {
    const ids = walk().map(x => x.id);
    expect(PHASE1).toHaveLength(70);
    expect(PHASE1.filter(id => !ids.includes(id))).toEqual([]);
    expect(ids).toEqual(PATH_LESSON_IDS);
    expect(ids).toEqual(CUR_LESSONS.map(l => l.id));
    expect(ids.length).toBe(139);
    // units in curriculum order, lessons in each unit in their order
    const order = CUR_UNITS.map(u => `math:${u.id}`).filter(id => math().some(u => u.id === id));
    expect(math().map(u => u.id)).toEqual(order);
  });
  it('0 lessons whose Learn teaches something other than its practice; Sides and Corners is followed by sides and corners only, at grade 2', () => {
    let withLearn = 0;
    const wrong: string[] = [];
    for (const { id, unit } of walk()) {
      const ep = lessonLearn(id);
      if (!ep) continue;
      withLearn++;
      if (!learnFits(id, ep)) wrong.push(id);
      // the Learn's item, if shown in this unit, is straight before practice of this lesson
      const at = unit.items.findIndex(i => i.ref === `ep:${ep}`);
      if (at >= 0 && unit.items[at].lesson === id) {
        expect(unit.items[at + 1].lesson, id).toBe(id);
        expect(unit.items[at + 1].ref.startsWith('trip:'), id).toBe(true);
      }
    }
    expect(wrong).toEqual([]);
    expect(withLearn).toBeGreaterThan(90);
    // every Learn item on the path is followed by practice of its own lesson
    for (const u of math()) u.items.forEach((it, i) => {
      if (it.kind !== 'learn') return;
      const nx = u.items[i + 1];
      expect(nx.kind, `${u.id} ${it.ref}`).toBe('practice');
      expect(nx.lesson).toBe(it.lesson);
      expect(learnFits(it.lesson!, it.ref.slice(3)), `${u.id} ${it.ref}`).toBe(true);
    });
    // Erik's case: Sides and Corners, then practice that asks only sides and corners, in grade 2
    const u = math().find(x => x.items.some(i => i.ref === 'ep:sh-sides'))!;
    expect(u.grade).toBe(2);
    const at = u.items.findIndex(i => i.ref === 'ep:sh-sides');
    const trip = u.items[at + 1].ref.slice(5);
    expect(asks(trip).sort()).toEqual(['sh-sides:corners', 'sh-sides:sides']);
    // no shape naming, no solids, no octagons from Meet the Shapes
    expect(asks(trip).some(k => k.startsWith('sh-name') || k === 'sh-sides:faces')).toBe(false);
  });
  it('0 path trips that mix two lessons: each trip belongs to one lesson and asks only its lesson\'s practice', () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [], outside: string[] = [];
    for (const { id } of walk()) {
      const mine = new Set(lessonKeys(id));
      for (const t of [...practiceTrips(id), ...checkTrips(id)]) {
        if (owner.has(t) && owner.get(t) !== id) clashes.push(`${t}: ${owner.get(t)} and ${id}`);
        owner.set(t, id);
        const sk = SKILL_LESSON[t];
        if (sk) for (const k of asks(t)) if (!mine.has(k) && !mine.has(k.split(':')[0])) outside.push(`${id} ${t} asks ${k}`);
        const f = MATH_LESSON[t];
        if (f && f.kind !== 'rules') for (const g of f.groups) if (![...mine].some(k => k.endsWith(`:${g}`))) outside.push(`${id} ${t} asks ${g}`);
      }
    }
    expect(clashes).toEqual([]);
    expect(outside).toEqual([]);
    expect(owner.size).toBeGreaterThan(250);
    // every trip on the path exists and plays
    for (const u of math()) for (const it of u.items) {
      const [k, t] = it.ref.split(':');
      if (k === 'trip' || k === 'quick') expect(!!(SKILL_LESSON[t] || MATH_LESSON[t]), it.ref).toBe(true);
      if (k === 'ep') expect(epLesson(t) || t.startsWith('ms-') || t.startsWith('dec-'), it.ref).toBeTruthy();
    }
  });
  it('0 prerequisite violations, and the grades never go down', () => {
    const w = walk(), pos = new Map(w.map((x, i) => [x.id, i]));
    const bad: string[] = [];
    for (const l of CUR_LESSONS) for (const pre of l.prerequisites) if (pos.has(pre) && pos.get(pre)! > pos.get(l.id)!) bad.push(`${l.id} needs ${pre}`);
    expect(bad).toEqual([]);
    const grades = w.map(x => x.grade);
    expect(grades.every((g, i) => i === 0 || g >= grades[i - 1])).toBe(true);
    // each unit's grade label is its own grade, never a "below grade"
    for (const u of math()) expect(u.grade).toBe(CUR_UNITS.find(c => `math:${c.id}` === u.id)!.grade);
  });
  it('every lesson has a spec the game can play: real skills and subs, rung bands inside 1-6, fact lessons on fact trips', () => {
    for (const l of CUR_LESSONS) {
      const sp = SPEC[l.id];
      expect(sp, l.id).toBeTruthy();
      if (sp.skill) {
        for (const k of sp.skill.keys) {
          const [s, sub] = k.split(':');
          expect(SKILL[s], `${l.id} ${k}`).toBeTruthy();
          expect(isFactSkill(s), `${l.id} ${k}`).toBe(false);
          if (sub) expect(SKILL[s].subs.some(x => x.id === sub), `${l.id} ${k}`).toBe(true);
        }
        if (sp.skill.rungs) { const [a, b] = sp.skill.rungs; expect(a >= 1 && b <= 6 && a <= b, l.id).toBe(true); }
      }
      if (sp.facts && 'groups' in sp.facts) for (const gs of Object.values(sp.facts.groups)) for (const g of gs!) expect(groupFacts(g).length, `${l.id} ${g}`).toBeGreaterThan(0);
      for (const ep of Object.keys(LEARN_TEACHES)) expect(epLesson(ep) || ep.startsWith('ms-') || ep.startsWith('dec-'), ep).toBeTruthy();
    }
    // the retired duplicates are off the path: ms-ratio (units and rates), sh-volume's whole-number boxes
    const asked = math().flatMap(u => u.items).flatMap(i => i.ref.startsWith('trip:') || i.ref.startsWith('quick:') ? asks(i.ref.split(':')[1]) : []);
    expect(asked.some(k => k.startsWith('ms-ratio'))).toBe(false);
    expect(asked.includes('sh-volume:cubes')).toBe(false);
  });
  it('the lesson trips are not stops on the islands: the maps keep exactly their trips', () => {
    expect(SKILL_LESSONS.some(l => l.id.startsWith('les-') || l.id.startsWith('unit-'))).toBe(false);
    expect(MATH_LESSONS.some(l => l.id.startsWith('les-'))).toBe(false);
    expect(SKILL_REGIONS.flatMap(r => r.lessons).length).toBe(SKILL_LESSONS.length);
  });
});

describe('days on the path', () => {
  it('each lesson\'s day mixes a warm-up, learning, practice and play; the quick check comes the next day; the unit check ends it', () => {
    for (const u of math()) {
      const days = [...new Set(u.items.map(i => i.day!))];
      expect(days).toEqual(days.map((_, i) => i + 1));
      for (const d of days.slice(0, -1)) {
        const its = u.items.filter(i => i.day === d);
        expect(its.some(i => i.kind === 'practice'), `${u.id} day ${d}`).toBe(true);
        expect(its.some(i => i.kind === 'game' || i.kind === 'battle'), `${u.id} day ${d}`).toBe(true);
        expect(its.at(-1)!.kind).not.toBe('learn');
        // never all the learning first: at most one Learn a day
        expect(its.filter(i => i.kind === 'learn').length).toBeLessThanOrEqual(1);
      }
      expect(u.items.at(-1)!.kind).toBe('check');
      // games and battles take turns
      const plays = u.items.filter(i => i.kind === 'game' || i.kind === 'battle').map(i => i.kind);
      if (plays.length > 1 && u.items.some(i => i.kind === 'game')) expect(plays[0]).not.toBe(plays[1]);
      // unique refs in a unit (the list is keyed by them)
      expect(new Set(u.items.map(i => i.ref)).size).toBe(u.items.length);
    }
  });
  it('the fact regions sit inside the grade 1 and grade 3 units', () => {
    const factUnits = math().filter(u => u.items.some(i => /^trip:(plus|minus|twins|tens|fives|fours|threes|nines|sixes|eights|sevens|share)-/.test(i.ref)));
    expect([...new Set(factUnits.map(u => u.grade))].sort()).toEqual([1, 2, 3]);
    expect(unitById('math:G1-U3')!.items.map(i => i.ref)).toEqual(expect.arrayContaining(['trip:plus-d-1', 'trip:plus-t-1', 'trip:minus-d-1', 'trip:minus-b-1']));
    expect(unitById('math:G3-U1')!.items.map(i => i.ref)).toEqual(expect.arrayContaining(['trip:twins-2', 'trip:tens-1', 'trip:fives-1']));
  });
});

describe('what a unit is called, and its game and world', () => {
  it('a unit\'s title says what is in it today (the plan\'s title where its lessons all fit it)', () => {
    expect(unitById('math:GK-U3')!.name).toBe('Sort and count');
    expect(unitById('math:G6-U4')!.name).toBe('Boxes with fraction edges');
    expect(unitById('math:G3-U5')!.name).toBe('Fractions');
    for (const id of Object.keys(UNIT_TITLE)) expect(unitById(`math:${id}`), id).not.toBeNull();
    // the unit check and Show What You Know use the same name
    expect(SKILL_LESSON['unit-G6-U4'].title).toBe('Unit check: Boxes with fraction edges');
  });
  it('no unit\'s game or world is about something none of its lessons are', () => {
    for (const u of math()) {
      const topics = new Set(u.lessons!.map(lessonTopic));
      const game = u.items.find(i => i.kind === 'game')?.ref.split(':')[1];
      const world = u.items.find(i => i.kind === 'battle')?.ref.split(':')[1];
      if (game) expect(GAME_TOPICS[game].some(t => topics.has(t)), `${u.id} ${game}`).toBe(true);
      if (world) expect(WORLD_TOPICS[world].some(t => topics.has(t)), `${u.id} ${world}`).toBe(true);
      expect(!!(game || world), u.id).toBe(true);
    }
    // area and the 4s: the shapes game and Shape Peaks, not the clocks; time and weight: the clocks
    const area = unitById('math:G3-U2')!, time = unitById('math:G3-U6')!;
    expect(area.items.find(i => i.kind === 'game')!.ref).toMatch(/^game:shifter:/);
    expect(area.items.find(i => i.kind === 'battle')!.ref).toMatch(/^battle:peaks:/);
    expect(time.items.find(i => i.kind === 'game')!.ref).toMatch(/^game:clockrush:/);
    expect(time.items.find(i => i.kind === 'battle')!.ref).toMatch(/^battle:clockwork:/);
    // rulers: no game is about measuring with a ruler, so its day's play is a Clockwork Isle battle
    expect(unitById('math:G2-U3')!.items.filter(i => i.kind === 'game' || i.kind === 'battle').map(i => i.ref.split(':')[1])).toEqual(['clockwork']);
  });
  it('topic pages\' grades come from the lessons: How likely? is grade 7', () => {
    expect(areaGrades('data')).toBe('K–7');
    expect(areaGrades('ratios')).toBe('6–7');
    expect(areaGrades('algebra')).toBe('1–7');
    expect(learnGrades('data-chance')).toBe('Grade 7');
    expect(learnGrades('sh-sides')).toBe('Grade 2');
    expect(trailOf({ screen: 'topic', ctx: { subject: 'math', topic: 'data' } } as never)).toBe('Math › Data and chance · Grades K–7');
  });
});

describe('ticks, Show What You Know, warm-ups', () => {
  it('a new Kindergartner starts at the very first lesson; four ticks fill in from real play', () => {
    const p = kid();
    const n = nextOnPath(p, 'math', MON)!;
    expect(n.unit.unit.grade).toBe(0);
    expect(n.item.lesson).toBe(PATH_LESSON_IDS[0]);
    const id = 'g2-sides-corners';
    expect(lessonTicks(p, id, MON)).toMatchObject({ learn: false, tryIt: false, practice: false, quick: false, known: false });
    finishLesson(p, 'sh-sides', MON);
    const m = mathOf(p);
    m.lessons[`les-${id}`] = { stars: 0, bestScore: 4, bestFpm: 4, bestAcc: 0.7, bestRide: 0, attempts: 1, finishes: 1, passes: 0, lastAt: MON };
    p.math = m;
    expect(lessonTicks(p, id, MON)).toMatchObject({ learn: true, tryIt: true, practice: false, quick: false });
    passTrip(p, `les-${id}`); passTrip(p, `les-${id}-qc`);
    expect(lessonTicks(p, id, MON)).toMatchObject({ learn: true, tryIt: true, practice: true, quick: true, done: true, known: false });
    // a lesson with no Learn of its own shows no Learn tick
    expect(lessonTicks(p, 'g2-draw-shape', MON).learn).toBeNull();
  });
  it('a grade\'s Show What You Know: a placement on the grade\'s lessons that marks what it showed "You know this" and starts the path after it', () => {
    const l = SKILL_LESSON[swykId(gradeScope(3))]!;
    expect(l.kind).toBe('placement');
    expect(l.ladder!.length).toBeGreaterThan(5);
    expect(l.testOut!.length).toBe(CUR_LESSONS.filter(x => x.grade === 3 && SPEC[x.id].skill).length);
    // a placement run that got everything right: the child is placed well up every skill
    const p = kid();
    setHomeRules(p, { grade: 3 });
    const pk = new SkillTripPicker({ lesson: l, mem: {}, now: MON, seed: 7, math: mathOf(p) });
    const results = [];
    for (let i = 0; i < 40 && !pk.done; i++) { const x = pk.next(); if (!x) break; pk.answer(true, 1500); results.push({ key: x.item.key, label: x.item.key, ok: true, ms: 1500, thinkMs: 1500, speed: 'fast' as const, rung: x.item.rung, fact: x.item.id, intro: false }); }
    const out = applySkillRun(p, { lessonId: l.id, results: results as never, stats: { asked: results.length, right: results.length, misses: 0, fast: results.length, slow: 0, acc: 1, fpm: 20, score: 20, ms: 30000, bestFastRow: 16 }, stars: 3, bestRide: 1, finished: true, at: MON });
    expect(out.testedOut.length).toBeGreaterThan(3);
    const q = out.profile;
    const known = CUR_LESSONS.filter(x => x.grade === 3 && lessonTicks(q, x.id, MON).known).map(x => x.id);
    expect(known.length).toBe(out.testedOut.length);
    // the path (from grade 3) starts at the first grade-3 lesson not known; nothing is locked
    const n = nextOnPath(q, 'math', MON, 3)!;
    expect(n.unit.unit.grade).toBe(3);
    expect(known).not.toContain(n.item.lesson);
    const st = pathStates(q, 'math', MON, 3);
    const items = st.flatMap(s => s.items);
    expect(items.filter(i => i.skip === 'known').length).toBeGreaterThan(5);
    // "You know this" is only ever on a lesson's own steps, never a warm-up, a game or a battle
    expect(items.filter(i => i.skip === 'known').every(i => i.kind === 'learn' || i.kind === 'practice' || i.kind === 'quick')).toBe(true);
  });
  it('a warm-up asks a few met questions from earlier lessons, and is skipped when there is nothing to warm up on', () => {
    const p = kid();
    const u = unitById('math:G3-U5')!, s = unitState(p, u, { now: MON });
    expect(s.items.find(i => i.ref === 'warm:g3-equal-area')!.skip).toBe('nothing');
    const m = mathOf(p);
    m.skills = { 'fr-unit:one': { stage: 2, seen: 4, right: 3, wrong: 1, times: [3000], fastDays: [], last: MON - 3 * DAY, due: MON - DAY, step: 1 } } as never;
    p.math = m;
    const s2 = unitState(p, u, { now: MON });
    expect(s2.items.find(i => i.ref === 'warm:g3-equal-area')!.skip).toBeUndefined();
  });
});

describe('an old save carries over: nothing lost', () => {
  /** a grade-6 player from before the curriculum: played the islands, earned things, mid-way through the
   *  ratios island, with the old path's ticks in the save */
  function oldSave(): PathProfile {
    const p = newProfile('Leo', 'dino') as PathProfile;
    p.updatedAt = MON - 10 * DAY;
    setHomeRules(p, { grade: 6 });
    p.book = { stickers: { 'runs-1': { at: MON - 9 * DAY, by: 'dino' }, 'three-1': { at: MON - 8 * DAY, by: 'dino' } }, medals: { clean: 3 }, total: 2, fresh: [] };
    const a = advOf(p);
    a.shells = 340; a.battles = 12;
    a.glimmers = { puddlepup: { level: 3, xp: 12, got: MON - 9 * DAY }, embernewt: { level: 1, xp: 0, got: MON - 4 * DAY } };
    a.team = ['puddlepup', 'embernewt'];
    a.incubator = [{ id: 'e1', rarity: 'rare', need: 30, have: 11, got: MON - 2 * DAY }, null, null];
    (p as unknown as { island: unknown }).island = { placed: { u1: { item: 'well', x: 2, z: 3, rot: 0 } }, coins: 5 };
    const m = mathOf(p);
    m.facts = { '6x7': { stage: 3, seen: 9, right: 8, wrong: 1, times: [2100], fastDays: ['2026-10-20'], last: MON - 5 * DAY, due: 0, step: 3 } } as never;
    m.skills = { 'rt-ratio:pic': { stage: 2, seen: 5, right: 5, wrong: 0, times: [4000], fastDays: [], last: MON - 3 * DAY, due: 0, step: 2 } } as never;
    m.learned = ['rt-for-every', 'rt-batches', 'neg-zero'];
    m.learnedOn = { 'rt-for-every': '2026-10-21', 'rt-batches': '2026-10-22', 'neg-zero': '2026-10-23' };
    p.math = m;
    passTrip(p, 'ratio-a-1', MON - 5 * DAY); passTrip(p, 'ratio-a-2', MON - 4 * DAY); passTrip(p, 'int-a-2', MON - 3 * DAY);
    // the old island path's ticks
    p.path = { done: { 'math:ratio-a/ep:rt-for-every': MON - 5 * DAY, 'math:ratio-a/trip:ratio-a-1': MON - 5 * DAY, 'math:ratio-a/ep:rt-batches': MON - 4 * DAY, 'math:ratio-a/trip:ratio-a-2': MON - 4 * DAY, 'math:int-a/trip:int-a-2': MON - 3 * DAY } };
    return p;
  }
  it('same shells, Glimmers, stickers, outfits, eggs, island and garden; the lessons done show ticked with the day they were first done', () => {
    const p = oldSave();
    const before = structuredClone(p);
    startPath(p, MON); notePath(p, MON);
    const { path: _a, ...rest } = p, { path: _b, ...was } = before;
    expect(rest).toEqual(was);
    expect(advOf(p).shells).toBe(340);
    expect(Object.keys(advOf(p).glimmers)).toEqual(['puddlepup', 'embernewt']);
    expect(p.book!.stickers).toEqual(before.book!.stickers);
    expect(advOf(p).incubator[0]).toEqual(advOf(before).incubator[0]);
    expect(p.math!.facts).toEqual(before.math!.facts);
    // the old ticks stay; the lessons they cover show ticked
    for (const k of Object.keys(before.path!.done!)) expect(pathSave(p).done![k]).toBe(before.path!.done![k]);
    expect(lessonTicks(p, 'g6-ratio', MON)).toMatchObject({ learn: true, tryIt: true, practice: true });
    expect(lessonTicks(p, 'g6-equal-ratios', MON)).toMatchObject({ learn: true, practice: true });
    expect(lessonTicks(p, 'g6-below-zero', MON)).toMatchObject({ learn: true, practice: true });
    // stamped with when they were first done, not today: nothing counts as today's
    const done = pathSave(p).done!;
    expect(done['math:G6-U2/trip:les-g6-ratio']).toBe(MON - 5 * DAY);
    expect(done['math:G6-U2/ep:rt-for-every']).toBe(MON - 5 * DAY);
    expect(Object.entries(done).filter(([, at]) => at === MON)).toEqual([]);
    expect(pathSave(p).cur).toBe(1);
    // a tick never goes away: running the step again changes nothing
    const again = structuredClone(pathSave(p));
    startPath(p, MON + DAY); notePath(p, MON + DAY);
    expect(pathSave(p).done).toEqual(again.done);
  });
  it('mid-unit: the child carries on at the first lesson not done', () => {
    const p = oldSave();
    startPath(p, MON); notePath(p, MON);
    const n = nextOnPath(p, 'math', MON, 6)!;
    expect(n.unit.unit.id).toBe('math:G6-U1');
    // the ratios unit: the Learns and practice of ratios and tables are done (from the island trips), so
    // nothing of them is asked again; what's left is the day's play, the quick checks, and double number lines
    const s = unitState(p, unitById('math:G6-U2')!, { now: MON });
    for (const it of s.items.filter(i => (i.lesson === 'g6-ratio' || i.lesson === 'g6-equal-ratios') && (i.kind === 'learn' || i.kind === 'practice'))) expect(it.done, it.ref).toBe(true);
    expect(['game', 'battle', 'quick', 'warmup']).toContain(s.next!.kind);
    expect(s.lessons.find(l => l.id === 'g6-ratio')!.ticks.practice).toBe(true);
    expect(s.lessons.find(l => l.id === 'g6-double-line')!.ticks.practice).toBe(false);
    expect(s.items.filter(i => !i.done && (i.kind === 'learn' || i.kind === 'practice')).every(i => i.lesson === 'g6-double-line')).toBe(true);
  });
  it("a teacher's unit made from an old island unit still works, and old unit ids find their new unit", () => {
    expect(oldUnit('math:frac-a')).toBe('math:G3-U5');
    expect(oldUnit('math:shapes-a')).toMatch(/^math:G[12]-U/);
    expect(oldUnit('math:ratio-a')).toBe('math:G6-U2');
    for (const r of SKILL_REGIONS) expect(unitById(`math:${r.id}`), r.id).not.toBeNull();
    const u = unitFromAssignment({ id: 'a1', title: 'Pie Pantry', items: ['ep:frac-parts', 'trip:frac-a-1', 'game:pizza', 'check'], unit: 'math:frac-a', subject: 'math' });
    expect(u.part).toBe('Fractions · Fractions');
    expect(u.checkTrip).toBe('unit-G3-U5');
    expect(u.items.map(i => i.kind)).toEqual(['learn', 'practice', 'game', 'check']);
    expect(skillPart('g3-one-piece')!.skills).toEqual(['fr-unit']);
  });
});
