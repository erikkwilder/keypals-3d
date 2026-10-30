// Class work from simulated play: real trips, typing lessons and arcade rounds run through the game's own
// "after a run" code, the activity entries they leave, assignment progress, scores and statuses, the
// gradebook spreadsheet, working levels, and the boards (no typed names on the world board).
import { describe, expect, it } from 'vitest';
import { applyRun, newProfile, type Profile } from '../engine/profile';
import { LAYOUTS } from '../engine/layouts';
import { applyMathRun } from '../math/progress';
import { MATH_LESSONS } from '../math/course';
import { applySkillRun, type SkillResult } from '../math/skills/progress';
import { tripStats, type FactResult } from '../math/meter';
import { applyArcade } from '../arcade/arcade';
import { activityOf, eventsOf, noteActivity, weekKey, weekStats, addEvent, EVENT_CAP, type ClassProfile } from './activity';
import { gradebookCsv, progressOf, scoreOf, statusOf, type Assignment } from './assignments';
import { workingLevel } from './level';
import { classWeekReport, needsHelp, skillsGrid, standardsReport, studentReport } from './reports';
import { ranked, setWorldBoards, trophy, worldEntry } from './boards';
import { classUrl, newAlias, showClassCode, cleanClassCode } from './names';
import { isAlias } from '../../../deploy/site/class-rules.js';
import { mergeProfile } from '../state/merge';

const MON = new Date(2026, 9, 26, 10, 0).getTime(); // Monday 26 October 2026, 10:00
const H = 3600000, DAY = 24 * H;

function skillTrip(p: Profile, at: number, key: string, right: number, wrong: number, lessonId = 'frac-a-1') {
  const results: SkillResult[] = [];
  for (let i = 0; i < right + wrong; i++) results.push({ id: `${key}#${i}`, key, label: key, ok: i < right, speed: i < right ? 'fast' : 'miss', thinkMs: 1500, ms: 4000, intro: false });
  const stats = tripStats(results);
  const out = applySkillRun(p, { lessonId, results, stats, stars: 2, bestRide: 1, finished: true, at });
  noteActivity(p, out.profile, at);
  return out.profile;
}
function factTrip(p: Profile, at: number, ids: string[], wrong = 0) {
  const results: FactResult[] = ids.map((id, i) => ({ id, ok: i >= wrong, speed: i >= wrong ? 'fast' : 'miss', thinkMs: 1200, ms: 3000, intro: false }));
  const out = applyMathRun(p, { lessonId: MATH_LESSONS[0].id, results, stats: tripStats(results), stars: 1, bestRide: 1, finished: true, at });
  noteActivity(p, out.profile, at);
  return out.profile;
}
function typingRun(p: Profile, at: number, lessonId = 'village-1', words = 40, acc = 0.9) {
  const stats = { chars: words * 5, words, wpm: 20, bonusMs: 0, score: 20, acc, errors: 3, durationMs: 120000, maxStreak: 10, finalStreak: 5, rhythmCV: 0.3, steady: true, perKey: {}, semis: 0, spaces: words };
  const out = applyRun(p, { lessonId, stats, stars: 2, bestRide: 1, keyboardHidden: false, finished: true, at }, LAYOUTS.qwerty);
  noteActivity(p, out.profile, at);
  return out.profile;
}
const asg = (o: Partial<Assignment>): Assignment => ({ id: 'a1', title: 'Fractions', what: 'skills', skills: ['fr-name'], lessons: [], episodes: [], areas: [], by: '', goal: { type: 'right', n: 20 }, scoring: 'completion', start: MON, due: MON + 4 * DAY + 14 * H, students: null, created: MON, ...o });

describe('activity entries from real play', () => {
  it('a skill trip counts right answers on its skill', () => {
    const p = skillTrip(newProfile('Maria', 'dino'), MON + H, 'fr-name:2', 8, 2);
    const ev = eventsOf(p);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ k: 'skill', l: 'frac-a-1', r: 8, n: 10, st: 2, f: 1 });
    expect(ev[0].s).toEqual({ 'fr-name': { r: 8, n: 10 } });
    expect(ev[0].ms).toBeGreaterThan(0);
  });
  it('a facts trip counts toward its strand, a typing lesson counts words', () => {
    let p = factTrip(newProfile('Sam', 'dino'), MON + H, ['3x4', '5x2', '2x2', '10x3'], 1);
    p = typingRun(p, MON + 2 * H, 'village-1', 50, 0.9);
    const [f, t] = eventsOf(p);
    expect(f.k).toBe('facts');
    expect(f.s).toEqual({ 'mult-facts': { r: 3, n: 4 } });
    expect(t).toMatchObject({ k: 'typing', l: 'village-1', n: 50, r: 45, f: 1 });
  });
  it('an arcade round counts its facts', () => {
    const p0 = newProfile('Ava', 'dino');
    const out = applyArcade(p0, { id: 'slalom', score: 5000, ms: 60000, at: MON + H, daily: true, answered: [{ f: { a: 3, b: 4, op: '+' }, ok: true, thinkMs: 900 }, { f: { a: 6, b: 2, op: '+' }, ok: false, thinkMs: 900 }] });
    const ev = activityOf(p0, out.profile, MON + H)!;
    expect(ev).toMatchObject({ k: 'arcade', l: 'slalom', r: 1, n: 2 });
    expect(ev.s).toEqual({ 'add-facts': { r: 1, n: 2 } });
  });
  it('nothing played: no entry; the newest few hundred are kept', () => {
    const p = newProfile('Ed', 'dino');
    expect(activityOf(p, structuredClone(p))).toBeNull();
    for (let i = 0; i < EVENT_CAP + 20; i++) addEvent(p, { at: MON + i * 1000, k: 'game', l: 'x', ms: 1, r: 1, n: 1 }, MON + DAY);
    expect(eventsOf(p)).toHaveLength(EVENT_CAP);
    expect(eventsOf(p)[0].at).toBe(MON + 20 * 1000);
  });
  it('two computers\' entries are both kept when copies combine, none twice', () => {
    const base = skillTrip(newProfile('Maria', 'dino'), MON + H, 'fr-name:2', 5, 0);
    const school = skillTrip(structuredClone(base), MON + 2 * H, 'fr-name:2', 4, 0);
    const home = skillTrip(structuredClone(base), MON + 3 * H, 'fr-name:3', 6, 1);
    const both = mergeProfile(school, home, base);
    expect(eventsOf(both).map(e => e.r)).toEqual([5, 4, 6]);
  });
  it('a week runs Monday to Sunday', () => {
    expect(weekKey(MON)).toBe('2026-10-26');
    expect(weekKey(MON + 6 * DAY + 13 * H)).toBe('2026-10-26');
    expect(weekKey(MON + 7 * DAY)).toBe('2026-11-02');
    expect(weekKey(MON - H * 11)).toBe('2026-10-19');
  });
});

describe('assignment progress, scores and statuses', () => {
  it('right answers on the assigned skills, counted since it was made', () => {
    let p = skillTrip(newProfile('Maria', 'dino'), MON - DAY, 'fr-name:2', 9, 0); // before: doesn't count
    p = skillTrip(p, MON + H, 'fr-name:2', 8, 2);
    p = skillTrip(p, MON + 2 * H, 'fr-unit:2', 10, 0, 'frac-a-2'); // another skill: doesn't count
    const pr = progressOf(p, asg({}), MON + 3 * H);
    expect(pr).toMatchObject({ right: 8, answered: 10, done: 0.4, score: 40, status: 'started' });
    expect(pr.acc).toBeCloseTo(0.8);
    p = skillTrip(p, MON + DAY, 'fr-name:4', 12, 0);
    const done = progressOf(p, asg({}), MON + DAY + H);
    expect(done).toMatchObject({ right: 20, done: 1, status: 'done', finishedAt: MON + DAY });
    expect(progressOf(p, asg({ scoring: 'accuracy' }), MON + DAY + H).score).toBe(91);
    expect(progressOf(p, asg({ scoring: 'both' }), MON + DAY + H).score).toBe(96);
  });
  it('late: due passed first, done or not', () => {
    let p = skillTrip(newProfile('Sam', 'dino'), MON + H, 'fr-name:2', 10, 0);
    const a = asg({ due: MON + 5 * H });
    expect(progressOf(p, a, MON + 2 * H).status).toBe('started');
    expect(progressOf(p, a, MON + 6 * H).status).toBe('late');
    p = skillTrip(p, MON + 8 * H, 'fr-name:2', 10, 0);
    expect(progressOf(p, a, MON + 9 * H)).toMatchObject({ done: 1, status: 'late' });
    expect(progressOf(newProfile('Ava', 'dino'), asg({}), MON + H).status).toBe('not started');
    expect(statusOf(0, null, false, MON, MON + 1)).toBe('late');
    expect(scoreOf(0.5, null, 'accuracy')).toBe(50);
  });
  it('minutes and typing lessons', () => {
    let p = typingRun(newProfile('Jo', 'dino'), MON + H, 'village-1', 40, 1);
    const t = asg({ what: 'typing', skills: [], lessons: ['village-1', 'village-2'], goal: { type: 'finish', n: 1 } });
    expect(progressOf(p, t, MON + 2 * H)).toMatchObject({ done: 0.5, status: 'started' });
    p = typingRun(p, MON + 3 * H, 'village-2', 40, 1);
    expect(progressOf(p, t, MON + 4 * H)).toMatchObject({ done: 1, status: 'done', finishedAt: MON + 3 * H });
    const mins = progressOf(p, asg({ what: 'typing', skills: [], lessons: ['village-1', 'village-2'], goal: { type: 'minutes', n: 8 } }), MON + 4 * H);
    expect(mins.ms).toBeGreaterThan(0);
    expect(mins.done).toBeCloseTo(mins.ms / (8 * 60000));
  });
  it('reach comfortable reads working levels', () => {
    const p = newProfile('Cy', 'dino');
    expect(workingLevel(p, 'fr-name')).toBe('not started');
    const a = asg({ goal: { type: 'comfortable', n: 1 } });
    expect(progressOf(p, a, MON + H).done).toBe(0);
    // every denominator in bloom: comfortable
    const q = structuredClone(p) as Profile;
    q.math = { home: 'math', facts: {}, lessons: {}, history: [], totals: { trips: 0, facts: 0, ms: 0 }, skills: Object.fromEntries(['2', '3', '4', '5', '6', '8', '10', '12'].map(d => [`fr-name:${d}`, { stage: 3, seen: 9, right: 9, wrong: 0, times: [], fastDays: [], last: MON, due: 0, step: 0 }])) };
    expect(workingLevel(q, 'fr-name')).toBe('comfortable');
    expect(progressOf(q, a, MON + H).done).toBe(1);
  });
  it('Learn episodes and Show What You Know', () => {
    const p = newProfile('Dee', 'dino');
    p.math = { home: 'math', facts: {}, lessons: {}, history: [], totals: { trips: 0, facts: 0, ms: 0 }, learned: ['frac-parts'], learnedOn: { 'frac-parts': '2026-10-26' } };
    const l = progressOf(p, asg({ what: 'learn', skills: [], episodes: ['frac-parts', 'frac-one-piece'], goal: { type: 'finish', n: 1 } }), MON + H);
    expect(l).toMatchObject({ done: 0.5, status: 'started' });
    const q = skillTrip(newProfile('Ed', 'dino'), MON + H, 'fr-name:2', 6, 0, 'start-fractions');
    expect(progressOf(q, asg({ what: 'check', skills: [], areas: ['fractions'], goal: { type: 'finish', n: 1 } }), MON + 2 * H)).toMatchObject({ done: 1, status: 'done' });
  });
});

describe('the gradebook and reports', () => {
  const kidA = () => skillTrip(newProfile('Maria', 'dino'), MON + H, 'fr-name:2', 20, 0);
  const kidB = () => skillTrip(newProfile('Sam', 'dino'), MON + H, 'fr-name:2', 5, 5);
  it('a spreadsheet: students down, assignments across', () => {
    const a = asg({ title: 'Fractions, part 1' }), b = asg({ id: 'a2', title: 'Typing', what: 'typing', skills: [], lessons: ['village-1'], goal: { type: 'finish', n: 1 }, students: ['s1'] });
    const profiles: Record<string, Profile> = { s1: kidA(), s2: kidB() };
    const csv = gradebookCsv([{ id: 's1', name: 'Maria' }, { id: 's2', name: 'Sam "Sammy"' }], [a, b], (sid, x) => progressOf(profiles[sid], x, MON + 2 * H));
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('Student,"Fractions, part 1 (score)","Fractions, part 1 (status)","Fractions, part 1 (progress %)",Typing (score),Typing (status),Typing (progress %),Average score');
    expect(lines[1]).toBe('Maria,100,Done,100,0,Not started,0,50');
    expect(lines[2]).toBe('"Sam ""Sammy""",25,Started,25,,not assigned,,25');
  });
  it('the week, the skills grid, standards, needs help and a student page', () => {
    const kids = [{ id: 's1', name: 'Maria', profile: kidA() }, { id: 's2', name: 'Sam', profile: kidB() }, { id: 's3', name: 'Ava', profile: null }];
    const wk = classWeekReport(kids, '2026-10-26');
    expect(wk).toMatchObject({ right: 25, played: 2, total: 3, notPlayed: ['Ava'] });
    const grid = skillsGrid(kids, ['fr-name', 'mult-facts']);
    expect(grid[0].levels).toEqual(['growing', 'not started']);
    const std = standardsReport(kids, ['3.NF.A.1']);
    expect(std[0].counts['not started'] + std[0].counts.growing + std[0].counts.comfortable).toBe(3);
    const help = needsHelp(kids, [asg({})]);
    expect(help[0]).toMatchObject({ skill: 'fr-name', growing: ['Maria', 'Sam'], notStarted: ['Ava'], of: 3 });
    const page = studentReport(kids[0], [asg({})], 4, MON + 2 * H);
    expect(page.weeks.at(-1)).toMatchObject({ week: '2026-10-26', right: 20 });
    expect(page.work[0].pr.done).toBe(1);
    expect(weekStats(kids[0].profile!, '2026-10-26').right).toBe(20);
  });
});

describe('the boards', () => {
  it('ranks by right answers; equal scores share a place', () => {
    const r = ranked([{ name: 'A', right: 5, ms: 1 }, { name: 'B', right: 9, ms: 1 }, { name: 'C', right: 5, ms: 9 }, { name: 'D', right: 1, ms: 0 }]);
    expect(r.map(x => `${x.place}${x.name}`)).toEqual(['1B', '2C', '2A', '4D']);
    expect(ranked([{ name: 'A', right: 5, ms: 1 }, { name: 'B', right: 1, ms: 9 }], 'ms')[0].name).toBe('B');
  });
  it('the class trophy fills toward the weekly goal', () => {
    expect(trophy(0, 0)).toEqual({ fill: 0, stage: 0, left: 0 });
    expect(trophy(900, 3000).stage).toBe(1);
    expect(trophy(2000, 3000).stage).toBe(2);
    expect(trophy(3100, 3000)).toEqual({ fill: 1, stage: 3, left: 0 });
  });
  it('the world board gets a made-up name, never the typed one, and only when a grown-up said yes', () => {
    const p = newProfile('Maria Lopez', 'koala') as ClassProfile;
    expect(worldEntry(p, 'slalom', '2026-10-26', 5000)).toBeNull();
    setWorldBoards(p, true);
    const e = worldEntry(p, 'slalom', '2026-10-26', 5000)!;
    expect(isAlias(e.alias)).toBe(true);
    expect(JSON.stringify(e)).not.toMatch(/Maria|Lopez/);
    expect(Object.keys(e).sort()).toEqual(['alias', 'buddy', 'day', 'game', 'score', 'who']);
    setWorldBoards(p, false);
    expect(worldEntry(p, 'slalom', '2026-10-26', 5000)).toBeNull();
    for (let i = 0; i < 100; i++) expect(isAlias(newAlias())).toBe(true);
  });
  it('class codes and links', () => {
    expect(showClassCode('FOX-PEAR-42')).toBe('fox pear 42');
    expect(cleanClassCode(' fox pear 42 ')).toBe('FOX-PEAR-42');
    expect(classUrl('FOX-PEAR-42', { hostname: 'fancyant.com', origin: 'https://fancyant.com', pathname: '/keypals/' })).toBe('https://keypals.org/#class=FOX-PEAR-42');
    expect(classUrl('FOX-PEAR-42', { hostname: '127.0.0.1', origin: 'http://127.0.0.1:8787', pathname: '/keypals/' })).toBe('http://127.0.0.1:8787/keypals/#class=FOX-PEAR-42');
  });
});
