// My path from simulated play: the units for every subject (math areas in grade order, the typing
// course), items done by real play and the one to do next, Show What You Know marking units "You know
// this", where a path starts by grade, today's summary, a teacher's unit as class work, keeping a player
// to the path, and the free-time limits.
import { describe, expect, it } from 'vitest';
import { dayKey, migrate, newProfile, type Profile } from '../engine/profile';
import { REGIONS } from '../engine/course';
import { finishLesson } from '../math/learn';
import { mathOf } from '../math/progress';
import { AREAS, SKILL } from '../math/skills/registry';
import { SKILL_REGIONS } from '../math/skills/course';
import { MATH_REGIONS } from '../math/course';
import { applyPlacement, skillLadder } from '../math/skills/placement';
import { advOf, advView, DEFAULT_SETTINGS, nodesOf, playLeft, playRules } from '../adventure/state';
import { addEvent, noteActivity, activityBase } from '../teach/activity';
import { gradebookCsv, progressOf, type Assignment } from '../teach/assignments';
import { KIND_NAME, episodeSkill, episodeSkills, pathOf, PATH_SUBJECTS, unitById } from './units';
import { SKILL_LESSON } from '../math/skills/course';
import { MATH_LESSON } from '../math/course';
import { lessonForStop } from '../math/learn';
import { doneToday, itemDone, nextOnPath, notePath, pathSave, pathStates, startPath, todayLine, unitLevel, unitState, type PathProfile } from './progress';
import { addUsed, allowed, doorFor, familyPlay, pathHolds, placeOf, playFor, ruleDiffs, rulesFor, setHomeRules, timeLeft, usedMs, GAME_GRACE_MIN, type ClassSettings } from './rules';
import { clearPass, keepPass, pass, passOn } from './pass';
import { unitFromAssignment } from './classPath';
import { mergeProfile } from '../state/merge';

const MON = new Date(2026, 9, 26, 10, 0).getTime(); // Monday 26 October 2026, 10:00
const H = 3600000, DAY = 24 * H;
const kid = () => newProfile('Maria', 'dino');
/** a trip moved on from (a star), as the map records it */
function passTrip(p: Profile, id: string, at = MON) {
  const m = (p.math = mathOf(p));
  m.lessons[id] = { stars: 2, bestScore: 10, bestFpm: 10, bestAcc: 0.9, bestRide: 1, attempts: 1, finishes: 1, passes: 1, lastAt: at };
}
function comfortable(p: Profile, skills: string[], at = MON) {
  const m = (p.math = mathOf(p));
  m.ability = { ...(m.ability ?? {}), ...Object.fromEntries(skills.map(s => [s, { t: 4, n: 20, at }])) };
}

describe('the units', () => {
  it('every subject has a path; math is the curriculum: grades, then units in order (curriculum.test.ts walks it all)', () => {
    expect(PATH_SUBJECTS().map(s => s.id).sort()).toEqual(['math', 'typing']);
    const math = pathOf('math');
    const grades = math.map(u => u.grade!);
    expect(grades).toEqual([...grades].sort((x, y) => x - y));
    expect(new Set(math.map(u => u.id)).size).toBe(math.length);
    expect(math.every(u => u.id.startsWith('math:G') && (u.lessons?.length ?? 0) > 0)).toBe(true);
    // a grade's units mix the areas (Kindergarten: sorting and counting, then number partners...)
    const g2 = math.filter(u => u.grade === 2).map(u => u.area);
    expect(new Set(g2).size).toBeGreaterThan(2);
  });
  it('each unit mixes the four ways and ends with a check', () => {
    for (const u of pathOf('math')) {
      const kinds = u.items.map(i => i.kind);
      expect(['learn', 'practice', 'warmup']).toContain(kinds[0]);
      expect(kinds).toContain('practice');
      expect(kinds.some(k => k === 'game' || k === 'battle')).toBe(true);
      expect(kinds.at(-1)).toBe('check');
      expect(u.skills.every(s => SKILL[s])).toBe(true);
    }
    // the fractions unit: Pizza Rush and Fraction Falls; the fact units share the Arcade and the Sky Islands
    const fr = unitById('math:G3-U5')!;
    expect(fr.items.find(i => i.kind === 'game')!.ref).toBe('game:pizza:1');
    expect(fr.items.find(i => i.kind === 'battle')!.ref).toBe('battle:falls:1');
    expect(unitById('math:G1-U3')!.items.find(i => i.kind === 'battle')!.ref).toMatch(/^battle:sky:\d+$/);
    expect(KIND_NAME.check).toBe('Unit check');
    expect(KIND_NAME.quick).toBe('Quick check');
  });
  it('typing: the course\'s regions in order (not the Open Road), new keys as Learn, the big run as the check', () => {
    const t = pathOf('typing');
    expect(t.map(u => u.region)).toEqual(REGIONS.filter(r => r.id !== 'road').map(r => r.id));
    const v = t[0];
    expect(v.items[0]).toMatchObject({ ref: 'trip:village-1', kind: 'learn' });
    expect(v.items.at(-1)).toMatchObject({ ref: 'trip:village-9', kind: 'check' });
    expect(v.items.some(i => i.kind === 'battle')).toBe(true);
  });
  it('game rounds and battle wins count up along the path: each item asks for one more than the last', () => {
    const fr = pathOf('math').filter(u => u.area === 'fractions');
    const need = (k: string) => fr.flatMap(u => u.items.filter(i => i.kind === k).map(i => +i.ref.split(':')[2]));
    const games = need('game'), wins = need('battle');
    expect(games).toEqual(games.map((_, i) => i + 1));
    expect(wins).toEqual(wins.map((_, i) => i + 1));
    expect(games.length).toBeGreaterThan(fr.length);
  });
  it('units come as short days that mix learning and play, never all the Learn first', () => {
    for (const s of ['math', 'typing']) for (const u of pathOf(s)) {
      const days = [...new Set(u.items.map(i => i.day))];
      expect(days.every(d => typeof d === 'number')).toBe(true);
      for (const d of days) {
        const its = u.items.filter(i => i.day === d);
        expect(its.length).toBeLessThanOrEqual(7);
        // a Learn is never the last thing of a day: its practice comes straight after
        expect(its.at(-1)!.kind).not.toBe('learn');
      }
      if (s === 'math' && days.length > 2) for (const d of days.slice(0, -1)) expect(u.items.some(i => i.day === d && (i.kind === 'game' || i.kind === 'battle'))).toBe(true);
      const eps = u.items.filter(i => i.ref.startsWith('ep:'));
      if (eps.length > 1) expect(new Set(eps.map(i => i.day)).size).toBeGreaterThan(1);
    }
    const fr = unitById('math:G3-U5')!;
    expect(fr.items.map(i => i.kind).slice(0, 4)).toEqual(['warmup', 'learn', 'practice', 'game']);
    expect(fr.items.filter(i => i.day === 2).map(i => i.kind)).toEqual(['warmup', 'learn', 'practice', 'battle', 'quick']);
  });
  it('every Learn on the path is followed straight away by practice of its own lesson', () => {
    let pairs = 0;
    for (const u of pathOf('math')) u.items.forEach((it, i) => {
      if (!it.ref.startsWith('ep:')) return;
      pairs++;
      expect(u.items[i + 1].kind, `${u.id} ${it.ref}`).toBe('practice');
      expect(u.items[i + 1].lesson).toBe(it.lesson);
    });
    expect(pairs).toBeGreaterThan(60);
    // Sides and Corners goes with the trip on sides and corners, not Meet the Shapes
    const sh = unitById('math:G2-U6')!.items, at = sh.findIndex(i => i.ref === 'ep:sh-sides');
    expect(sh[at + 1].ref).toBe('trip:les-g2-sides-corners');
    expect(episodeSkill('sh-sides')).toBe('sh-sides');
  });
});

describe('done, next and you know this', () => {
  it('a new player: the first unit is current and its first item is next', () => {
    const p = kid();
    const st = pathStates(p, 'math', MON);
    expect(st[0].status).toBe('current');
    expect(st.slice(1).every(s => s.status === 'later')).toBe(true);
    expect(nextOnPath(p, 'math', MON)!.item.ref).toBe(st[0].items[0].ref);
    expect(unitLevel(p, st[0].unit, MON)).toBe('not started');
  });
  it('real play ticks items off wherever it happened, and Next moves along', () => {
    const p = kid(), u = unitById('math:G3-U5')!;
    finishLesson(p, 'frac-one-piece', MON);
    passTrip(p, 'frac-a-2');
    let s = unitState(p, u, { now: MON });
    expect(s.items.filter(i => i.done).map(i => i.ref)).toEqual(['ep:frac-one-piece', 'trip:les-g3-one-piece']);
    expect(s.next!.ref).toBe('game:pizza:1');
    // a round of Pizza Rush, a battle won on Fraction Falls
    mathOf(p); p.math!.arcade = { 'pizza-rush': { best: 100, stars: 1, plays: 1 } };
    const a = advOf(p); for (const n of nodesOf('falls').filter(n => n.kind !== 'practice').slice(0, 1)) a.nodes[n.id] = 1;
    s = unitState(p, u, { now: MON });
    expect(s.items.find(i => i.kind === 'game')!.done).toBe(true);
    expect(s.items.find(i => i.kind === 'battle')!.done).toBe(true);
    expect(s.next!.ref).toBe('ep:sh-halves');
    // the next fractions unit wants a second round and more stops
    const u2 = unitById('math:G4-U2')!;
    expect(itemDone(p, u2, u2.items.find(i => i.kind === 'game')!)).toBe(false);
  });
  it('the unit check: every lesson\'s quick check done (or the unit check run passed); typing: the checkpoint', () => {
    const p = kid(), u = unitById('math:G3-U5')!;
    expect(itemDone(p, u, u.items.at(-1)!, { now: MON })).toBe(false);
    for (const id of u.lessons!) passTrip(p, `les-${id}-qc`);
    expect(itemDone(p, u, u.items.at(-1)!, { now: MON })).toBe(true);
    const q = kid();
    passTrip(q, u.checkTrip!);
    expect(u.checkTrip).toBe('unit-G3-U5');
    expect(itemDone(q, u, u.items.at(-1)!, { now: MON })).toBe(true);
    const t = kid(), v = pathOf('typing')[0];
    t.lessons['village-9'] = { stars: 3, bestWpm: 20, bestAcc: 0.95, bestRide: 1, attempts: 1, passes: 1, lastAt: MON, bestScore: 20, scoreSum: 20, finishes: 1 };
    expect(unitState(t, v, { now: MON }).checked).toBe(true);
    expect(unitLevel(t, v)).toBe('strong');
  });
  it('Show What You Know: the lessons it showed are "You know this", open, and the path moves past them', () => {
    const p = kid(), u = unitById('math:GK-U3')!;
    for (const id of u.lessons!) passTrip(p, `les-${id}-qc`);
    const st = pathStates(p, 'math', MON);
    const k = st.find(s => s.unit.id === u.id)!;
    expect(k.status).toBe('known');
    expect(k.lessons.every(l => l.ticks.known)).toBe(true);
    // never locked: its items can still be started, and the current unit is another one
    expect(k.items.filter(i => i.kind === 'learn' || i.kind === 'practice').every(i => !i.done && i.skip === 'known')).toBe(true);
    expect(st.find(s => s.status === 'current')!.unit.id).not.toBe(u.id);
  });
  it('a path can start at a grade: the units before it are earlier ones, still open', () => {
    const p = kid();
    const st = pathStates(p, 'math', MON, 3);
    const cur = st.find(s => s.status === 'current')!;
    expect(cur.unit.grade).toBe(3);
    expect(st.filter(s => s.unit.grade! < 3).every(s => s.status === 'earlier')).toBe(true);
    expect(nextOnPath(p, 'math', MON, 3)!.unit.unit.id).toBe(cur.unit.id);
  });
});

describe('today', () => {
  it('stamps what an activity finished; things done before the path began don\'t count as today\'s', () => {
    const p = kid() as PathProfile;
    finishLesson(p, 'frac-parts', MON - 3 * DAY);
    startPath(p, MON - DAY);
    expect(pathSave(p).done!['math:G3-U5/ep:frac-parts']).toBe(0);
    expect(doneToday(p, MON)).toBe(0);
    finishLesson(p, 'frac-one-piece', MON);
    passTrip(p, 'frac-a-1', MON);
    const added = notePath(p, MON);
    expect(added).toContain('math:G3-U5/ep:frac-one-piece');
    expect(added).toContain('math:G3-U5/trip:les-g3-name-fraction');
    expect(doneToday(p, MON)).toBe(2);
    // tomorrow it starts again; a stamp never goes away
    expect(doneToday(p, MON + DAY)).toBe(0);
    const u = unitById('math:G3-U5')!;
    expect(itemDone(p, u, u.items.find(i => i.ref === 'ep:frac-one-piece')!)).toBe(true);
  });
  it("the same thing in a teacher's unit and on the path counts once", () => {
    const p = kid();
    startPath(p, MON - DAY);
    finishLesson(p, 'frac-parts', MON);
    const teacher = unitFromAssignment({ id: 'u9', title: 'Fractions week', items: ['ep:frac-parts', 'game:pizza'], subject: 'math' });
    const added = notePath(p, MON, [{ unit: teacher, since: MON - H }]);
    expect(added).toEqual(expect.arrayContaining(['math:G3-U5/ep:frac-parts', 'class:u9/ep:frac-parts']));
    expect(doneToday(p, MON)).toBe(1);
  });
  it('a check is a milestone, not one of today\'s things; a quick check ticked by Show What You Know isn\'t either', () => {
    const p = kid();
    startPath(p, MON - DAY);
    passTrip(p, 'unit-G3-U5', MON);
    expect(notePath(p, MON)).toContain('math:G3-U5/check');
    expect(doneToday(p, MON)).toBe(0);
    const m = mathOf(p);
    m.lessons['les-g3-one-piece-qc'] = { stars: 1, bestScore: 0, bestFpm: 0, bestAcc: 0, bestRide: 0, attempts: 0, finishes: 0, passes: 0, lastAt: MON, testedOut: true };
    p.math = m;
    expect(notePath(p, MON)).toContain('math:G3-U5/quick:les-g3-one-piece-qc');
    expect(doneToday(p, MON)).toBe(0);
  });
  it('one line: things today, minutes, the unit', () => {
    const p = kid();
    startPath(p, MON - DAY);
    p.days[dayKey(MON)] = { ms: 10 * 60000, runs: 2 };
    p.settings.dailyGoalMin = 20;
    finishLesson(p, 'data-sort', MON); notePath(p, MON);
    const n = nextOnPath(p, 'math', MON)!;
    expect(n.unit.unit.id).toBe('math:GK-U3');
    const t = todayLine(p, 3, n, MON);
    expect(t.line).toBe(`1 of 3 things done today · 10 of 20 minutes · Unit ${n.unit.unit.n}: just started`);
    passTrip(p, 'les-k-sort-count', MON); passTrip(p, 'les-k-sort-count-qc', MON); notePath(p, MON);
    expect(todayLine(p, 3, nextOnPath(p, 'math', MON), MON).line).toMatch(/^All 3 things done today! · 10 of 20 minutes · Unit \d+: (halfway there|almost done|just started|ready to start)$/);
  });
});

describe("a teacher's unit as class work", () => {
  const unit = (o: Partial<Assignment> = {}): Assignment => ({ id: 'u1', title: 'Pie Pantry', what: 'unit', skills: [], lessons: [], episodes: [], areas: [], by: '', goal: { type: 'finish', n: 1 }, scoring: 'completion', start: MON, due: MON + 4 * DAY, students: null, created: MON,
    items: ['ep:frac-parts', 'trip:frac-a-1', 'game:pizza', 'battle:falls', 'check'], unit: 'math:frac-a', subject: 'math', ...o });
  it('lists the unit\'s items, done the My path way; games and battles count from when it was given', () => {
    const p = kid();
    addEvent(p, { at: MON - H, k: 'game', l: 'pizza-rush', ms: 60000, r: 5, n: 6 }, MON);
    let pr = progressOf(p, unit(), MON + H);
    expect(pr.parts.map(x => x.done)).toEqual([false, false, false, false, false]);
    finishLesson(p, 'frac-parts', MON + H);
    passTrip(p, 'frac-a-1', MON + H);
    addEvent(p, { at: MON + 2 * H, k: 'game', l: 'pizza-rush', ms: 60000, r: 5, n: 6, s: { 'fr-name': { r: 5, n: 6 } } }, MON + 2 * H);
    addEvent(p, { at: MON + 3 * H, k: 'battle', l: 'adventure', ms: 60000, r: 4, n: 4, w: 'falls' }, MON + 3 * H);
    pr = progressOf(p, unit(), MON + 4 * H);
    expect(pr.parts.map(x => x.done)).toEqual([true, true, true, true, false]);
    expect(pr.done).toBeCloseTo(0.8);
    expect(pr.status).toBe('started');
    comfortable(p, unitById('math:frac-a')!.skills, MON + 4 * H);
    pr = progressOf(p, unit(), MON + 5 * H);
    expect(pr.done).toBe(1);
    expect(pr.status).toBe('done');
    // the gradebook has it like any class work
    const csv = gradebookCsv([{ id: 's1', name: 'Maria' }], [unit()], () => pr);
    expect(csv.split('\r\n')[1]).toBe('Maria,100,Done,100,100');
  });
  it('a hand-made unit: skill practice counts 10 right answers since it was given', () => {
    const p = kid();
    const a = unit({ items: ['skill:fr-equal', 'game:pizza'], unit: undefined });
    const u = unitFromAssignment(a);
    expect(u.items.map(i => i.kind)).toEqual(['practice', 'game']);
    addEvent(p, { at: MON + H, k: 'skill', l: 'class-fractions', ms: 60000, r: 10, n: 12, s: { 'fr-equal': { r: 10, n: 12 } } }, MON + H);
    expect(progressOf(p, a, MON + 2 * H).parts[0].done).toBe(true);
    expect(progressOf(p, { ...a, start: MON + 90 * 60000 }, MON + 2 * H).parts[0].done).toBe(false);
  });
  it('a battle won leaves the world on its activity entry', () => {
    const p = kid();
    const before = activityBase(p, MON);
    const a = advOf(p);
    a.day = { key: dayKey(MON), ms: 60000, answers: 5, right: 4 };
    a.nodes['falls-0'] = 1;
    const after = structuredClone(p);
    expect(noteActivity(before, after, MON)).toMatchObject({ k: 'battle', w: 'falls' });
  });
});

describe('keeping to the path', () => {
  const cls = (o: ClassSettings): ClassSettings => o;
  it('the stricter of the grown-ups\' and the class\'s rules', () => {
    const p = kid();
    expect(rulesFor(p)).toMatchObject({ keep: 'off', goal: 3, limits: {}, grade: null, from: 'none' });
    setHomeRules(p, { keep: 'first', goal: 2, grade: 2 });
    expect(rulesFor(p)).toMatchObject({ keep: 'first', goal: 2, grade: 2, from: 'home' });
    expect(rulesFor(p, [cls({ keep: 'only', goal: 4, grade: 3 })])).toMatchObject({ keep: 'only', goal: 4, grade: 3, from: 'class' });
    expect(rulesFor(p, [cls({ keep: 'off' })]).keep).toBe('first');
  });
  it('path first: the roaming places wait until today\'s path things are done; the path and its activities never', () => {
    const p = kid();
    startPath(p, MON - DAY);
    const r = rulesFor(p, [cls({ keep: 'first', goal: 2 })], MON);
    expect(pathHolds(p, r, MON)).toBe(true);
    expect(doorFor('arcade', 'outfits', p, r, MON)).toMatchObject({ kind: 'path', left: 2, from: 'class' });
    expect(doorFor('map', 'outfits', p, r, MON)).not.toBeNull();
    for (const s of ['path', 'hub', 'run', 'mathRun', 'skillRun', 'learn', 'battle', 'arcadePlay', 'pizza', 'grownups', 'teach'] as const) expect(doorFor(s, 'outfits', p, r, MON)).toBeNull();
    finishLesson(p, 'sh-sides', MON); finishLesson(p, 'sh-halves', MON); notePath(p, MON);
    expect(pathHolds(p, r, MON)).toBe(false);
    expect(doorFor('arcade', 'outfits', p, r, MON)).toBeNull();
    // path only: all day
    expect(doorFor('arcade', 'outfits', p, rulesFor(p, [cls({ keep: 'only' })], MON), MON)).toMatchObject({ kind: 'path', keep: 'only' });
  });
});

describe('free-time limits', () => {
  it('counts minutes per place per day, and stops kindly at the limit', () => {
    const p = kid();
    setHomeRules(p, { limits: { island: '10', garden: '20' } });
    const r = rulesFor(p, [], MON);
    expect(placeOf('island', 'outfits')).toBe('island');
    expect(placeOf('dances', 'outfits')).toBe('dances');
    expect(placeOf('closet', 'outfits')).toBe('closet');
    expect(placeOf('shop', 'outfits')).toBe('closet');
    expect(placeOf('map', 'outfits')).toBeNull();
    addUsed(p, 'island', 6 * 60000, MON);
    addUsed(p, 'garden', 12 * 60000, MON);
    expect(usedMs(p, 'island', MON)).toBe(6 * 60000);
    expect(timeLeft(p, 'island', r, MON).leftMin).toBeCloseTo(4);
    expect(doorFor('island', 'outfits', p, r, MON)).toBeNull();
    // the minute being counted now counts too
    expect(doorFor('island', 'outfits', p, r, MON, 4 * 60000)).toEqual({ kind: 'time', place: 'island', earned: false, from: 'home' });
    addUsed(p, 'island', 4 * 60000, MON);
    expect(doorFor('island', 'outfits', p, r, MON)).toMatchObject({ kind: 'time', place: 'island' });
    expect(doorFor('garden', 'outfits', p, r, MON)).toBeNull();
    // no limit: the Wardrobe stays open
    addUsed(p, 'closet', 90 * 60000, MON);
    expect(doorFor('closet', 'outfits', p, r, MON)).toBeNull();
    // a new day: the island opens again
    expect(usedMs(p, 'island', MON + DAY)).toBe(0);
    expect(doorFor('island', 'outfits', p, r, MON + DAY)).toBeNull();
  });
  it('earned by practice: 5 minutes, and a minute for every minute of practice; the stricter limit wins', () => {
    const p = kid();
    expect(allowed('earned', p, MON)).toBe(5);
    p.days[dayKey(MON)] = { ms: 12 * 60000, runs: 3 };
    expect(allowed('earned', p, MON)).toBe(17);
    setHomeRules(p, { limits: { dances: '30' } });
    expect(rulesFor(p, [{ limits: { dances: 'earned' } }], MON).limits.dances).toBe('earned');
    expect(rulesFor(p, [{ limits: { dances: '10' } }], MON).limits.dances).toBe('10');
    addUsed(p, 'dances', 17 * 60000, MON);
    expect(doorFor('dances', 'dances', p, rulesFor(p, [{ limits: { dances: 'earned' } }], MON), MON)).toEqual({ kind: 'time', place: 'dances', earned: true, from: 'class' });
  });
});

describe('Path only means the path', () => {
  const only = (p: ReturnType<typeof kid>) => rulesFor(p, [{ keep: 'only' }], MON);
  it('Adventure is closed like every roaming place, under Path first too', () => {
    const p = kid();
    expect(doorFor('adventure', 'outfits', p, only(p), MON)).toMatchObject({ kind: 'path', keep: 'only' });
    startPath(p, MON - DAY);
    expect(doorFor('adventure', 'outfits', p, rulesFor(p, [{ keep: 'first', goal: 2 }], MON), MON)).toMatchObject({ kind: 'path', keep: 'first' });
  });
  it('except the stop the path sends you to, for that one battle', () => {
    const p = kid(), r = only(p);
    clearPass();
    pass.world = 'falls';
    keepPass('adventure');
    expect(passOn('adventure')).toBe(true);
    expect(doorFor('adventure', 'outfits', p, r, MON, 0, { work: passOn('adventure') })).toBeNull();
    keepPass('battle');
    expect(passOn('battle')).toBe(true);
    // back on the map after it: the door again
    expect(passOn('adventure')).toBe(false);
    expect(doorFor('adventure', 'outfits', p, r, MON, 0, { work: passOn('adventure') })).toMatchObject({ kind: 'path' });
    keepPass('adventure');
    expect(pass.world).toBeNull();
  });
  it('leaving the stop for anywhere else ends it', () => {
    clearPass();
    pass.world = 'falls';
    keepPass('hub');
    expect(passOn('adventure')).toBe(false);
  });
});

describe('the door names the right person', () => {
  it('a home Path only stays the family\'s even when a class only set a limit', () => {
    const p = kid();
    setHomeRules(p, { keep: 'only' });
    const r = rulesFor(p, [{ keep: 'off', limits: { garden: '10' } }], MON);
    expect(r).toMatchObject({ keep: 'only', from: 'home', limitFrom: { garden: 'class' } });
    expect(doorFor('arcade', 'outfits', p, r, MON)).toMatchObject({ kind: 'path', keep: 'only', from: 'home' });
  });
  it('a class\'s Path only is the teacher\'s', () => {
    const p = kid();
    setHomeRules(p, { keep: 'first', limits: { garden: '30' } });
    const r = rulesFor(p, [{ keep: 'only', limits: { garden: '10' } }], MON);
    expect(r).toMatchObject({ keep: 'only', from: 'class' });
    addUsed(p, 'garden', 11 * 60000, MON);
    expect(timeLeft(p, 'garden', r, MON).open).toBe(false);
  });
  it('each limit says who set it: the shorter one', () => {
    const p = kid();
    setHomeRules(p, { limits: { island: '10', garden: '30' } });
    const r = rulesFor(p, [{ limits: { island: '20', garden: '15' } }], MON);
    expect(r.limits).toMatchObject({ island: '10', garden: '15' });
    expect(r.limitFrom).toMatchObject({ island: 'home', garden: 'class' });
  });
});

describe('the Arcade has a limit', () => {
  it('the lobby and every game count; a game on the path or in class work does not', () => {
    const p = kid();
    setHomeRules(p, { limits: { arcade: '10' } });
    const r = rulesFor(p, [], MON);
    for (const s of ['arcade', 'arcadePlay', 'pizza', 'playground', 'bench'] as const) expect(placeOf(s, 'outfits'), s).toBe('arcade');
    expect(placeOf('drop', 'outfits')).toBeNull();
    addUsed(p, 'arcade', 10 * 60000, MON);
    expect(doorFor('arcade', 'outfits', p, r, MON)).toMatchObject({ kind: 'time', place: 'arcade', from: 'home' });
    expect(doorFor('pizza', 'outfits', p, r, MON)).toMatchObject({ kind: 'time', place: 'arcade' });
    expect(doorFor('pizza', 'outfits', p, r, MON, 0, { work: true })).toBeNull();
  });
  it('a game under way may finish; a new one can\'t start', () => {
    const p = kid();
    setHomeRules(p, { limits: { arcade: '10' } });
    const r = rulesFor(p, [], MON);
    addUsed(p, 'arcade', 11 * 60000, MON);
    expect(doorFor('pizza', 'outfits', p, r, MON, 0, { playing: true })).toBeNull();
    expect(doorFor('pizza', 'outfits', p, r, MON, GAME_GRACE_MIN * 60000, { playing: true })).toMatchObject({ kind: 'time' });
    expect(doorFor('pizza', 'outfits', p, r, MON)).toMatchObject({ kind: 'time' });
  });
  it('an old save, with no Arcade limit, plays as before', () => {
    const old = migrate({ profiles: [{ id: 'a', name: 'Old', settings: { keepPath: 'first', limits: { garden: '10' } } }] }).profiles[0];
    const r = rulesFor(old, [], MON);
    expect(r.limits).toEqual({ garden: '10' });
    expect(doorFor('arcade', 'outfits', old, { ...r, keep: 'off' }, MON)).toBeNull();
    expect(r.play).toMatchObject(DEFAULT_SETTINGS);
  });
});

describe('play time: family and class', () => {
  const home = (p: ReturnType<typeof kid>, s: Partial<typeof DEFAULT_SETTINGS>) => { const a = advOf(p); a.settings = { ...a.settings, ...s }; };
  it('with no class, it is the player\'s own, and an old class with no play time changes nothing', () => {
    const p = kid();
    home(p, { rule: 'practiceFirst', capMin: 20 });
    expect(playFor(p).play).toEqual(advView(p).settings);
    expect(playFor(p, [{ keep: 'first', goal: 3, limits: {} }]).play).toEqual(advView(p).settings);
    expect(playFor(p).from).toBe('home');
  });
  it('the usual settings are nobody\'s choice, so a class can open things up', () => {
    const p = kid();
    expect(familyPlay(p)).toEqual({});
    expect(playFor(p, [{ play: { rule: 'open' } }])).toMatchObject({ play: { rule: 'open' }, from: 'class' });
  });
  it('the ratio a teacher sets is the one that counts', () => {
    const p = kid();
    expect(playFor(p, [{ play: { ratio: 2, freeMin: 5 } }]).play).toMatchObject({ ratio: 2, freeMin: 5 });
  });
  it('anything a family chose: the stricter one wins', () => {
    const p = kid();
    home(p, { rule: 'practiceFirst', ratio: 0.5, capMin: 30 });
    expect(playFor(p, [{ play: { rule: 'open', ratio: 2, capMin: 20 } }]).play).toMatchObject({ rule: 'practiceFirst', ratio: 0.5, capMin: 20 });
    home(p, { rule: 'open' });
    expect(playFor(p, [{ play: { rule: 'balanced' } }]).play.rule).toBe('balanced');
    expect(playFor(p, [{ play: { versus: false } }]).play.versus).toBe(false);
  });
  it('what battles use: the class\'s first', () => {
    const p = kid();
    home(p, { focus: 'fractions' });
    expect(playFor(p, [{ play: { focus: 'x' } }]).play.focus).toBe('x');
    expect(playFor(p, [{ play: { focus: 'all' } }]).play.focus).toBe('fractions');
  });
  it('play time reads what holds, class included', () => {
    const p = kid(), was = playRules.of;
    p.days[dayKey(MON)] = { ms: 0, runs: 0 };
    playRules.of = x => playFor(x, [{ play: { rule: 'practiceFirst' } }]).play;
    expect(playLeft(p, MON).open).toBe(false);
    playRules.of = x => playFor(x, [{ play: { rule: 'open' } }]).play;
    expect(playLeft(p, MON)).toMatchObject({ open: true, left: null });
    playRules.of = was;
  });
});

describe('the pages say who wins', () => {
  it('in the same words on both sides, and which one counts', () => {
    const p = kid();
    setHomeRules(p, { keep: 'off', goal: 2, limits: { arcade: '30', island: '10' } });
    const d = ruleDiffs(p, { keep: 'only', goal: 5, limits: { arcade: '10', island: '20' } }, MON);
    expect(d.find(x => x.key === 'keep')).toMatchObject({ label: 'Keep to the path', family: 'Free to roam', cls: 'Path only', counts: 'class' });
    expect(d.find(x => x.key === 'goal')).toMatchObject({ label: 'Things a day', family: '2', cls: '5', counts: 'class' });
    expect(d.find(x => x.key === 'limit:arcade')).toMatchObject({ label: 'Arcade', family: '30 min a day', cls: '10 min a day', counts: 'class' });
    expect(d.find(x => x.key === 'limit:island')).toMatchObject({ family: '10 min a day', cls: '20 min a day', counts: 'family' });
  });
  it('nothing to say when they agree, or for an old class with no rules', () => {
    const p = kid();
    expect(ruleDiffs(p, {}, MON)).toEqual([]);
    expect(ruleDiffs(p, { keep: 'off', goal: 3, limits: {} }, MON)).toEqual([]);
  });
  it('play time too', () => {
    const p = kid();
    expect(ruleDiffs(p, { play: { rule: 'open' } }, MON).find(x => x.key === 'rule')).toMatchObject({ family: 'Balanced', cls: 'Open', counts: 'class' });
    const a = advOf(p); a.settings = { ...a.settings, rule: 'practiceFirst' };
    expect(ruleDiffs(p, { play: { rule: 'open' } }, MON).find(x => x.key === 'rule')).toMatchObject({ family: 'Practice first', cls: 'Open', counts: 'family' });
  });
});

describe('sound off for a class', () => {
  it('only a class that says so', () => {
    const p = kid();
    expect(rulesFor(p).quiet).toBe(false);
    expect(rulesFor(p, [{ keep: 'off' }]).quiet).toBe(false);
    expect(rulesFor(p, [{ sound: 'on' }]).quiet).toBe(false);
    expect(rulesFor(p, [{ sound: 'off' }]).quiet).toBe(true);
  });
});

describe('two computers', () => {
  it("each copy's ticks and minutes are kept when the copies combine", () => {
    const base = kid() as PathProfile;
    startPath(base, MON - DAY);
    const school = structuredClone(base) as PathProfile, home = structuredClone(base) as PathProfile;
    finishLesson(school, 'frac-parts', MON); notePath(school, MON);
    finishLesson(home, 'sh-sides', MON + H); notePath(home, MON + H);
    addUsed(school, 'island', 5 * 60000, MON); addUsed(home, 'island', 7 * 60000, MON + H);
    school.updatedAt = MON; home.updatedAt = MON + H;
    const both = mergeProfile(school, home, base) as PathProfile;
    expect(Object.keys(both.path!.done!)).toEqual(expect.arrayContaining(['math:G3-U5/ep:frac-parts', 'math:G2-U6/ep:sh-sides']));
    expect(doneToday(both, MON + 2 * H)).toBe(2);
    expect(usedMs(both, 'island', MON)).toBe(7 * 60000);
  });
});
