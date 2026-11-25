// The gradebook's average and its missing work (the Gradebook tab and its spreadsheet download): work not
// started and not yet due isn't counted; past its due date with nothing done it's missing, and counts as 0.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { averageOf, gradeOf, gradebookCsv, type Assignment, type Progress } from './assignments';

const DAY = 86400000, now = Date.UTC(2026, 10, 25, 15);
const pr = (o: Partial<Progress>): Progress => ({ done: 0, right: 0, answered: 0, ms: 0, acc: null, score: 0, status: 'not started', begun: false, finishedAt: null, parts: [], ...o });
const work = (id: string, due: number | null) => ({ id, title: id, due, students: null } as unknown as Assignment);

describe('a gradebook cell', () => {
  it('not started and not due yet (or with no due date): not in the average', () => {
    expect(gradeOf(pr({}), work('a', now + 7 * DAY), now)).toEqual({ score: null, missing: false });
    expect(gradeOf(null, work('a', null), now)).toEqual({ score: null, missing: false });
  });
  it('past its due date with nothing done: missing, and counts as 0', () => {
    expect(gradeOf(pr({ status: 'late' }), work('a', now - DAY), now)).toEqual({ score: 0, missing: true });
    expect(gradeOf(null, work('a', now - DAY), now)).toEqual({ score: 0, missing: true });
  });
  it('started or done: its score counts, due or not', () => {
    expect(gradeOf(pr({ begun: true, done: 0.5, score: 50, status: 'started' }), work('a', now + DAY), now)).toEqual({ score: 50, missing: false });
    expect(gradeOf(pr({ begun: true, done: 1, score: 100, status: 'done' }), work('a', now - DAY), now)).toEqual({ score: 100, missing: false });
    expect(gradeOf(pr({ begun: true, done: 0.2, score: 20, status: 'late' }), work('a', now - DAY), now)).toEqual({ score: 20, missing: false });
  });
  it("Maria's row from the walk: math done, typing not started with a week to go, averages 100, not 50", () => {
    expect(averageOf([100, null])).toBe(100);
    expect(averageOf([null, null])).toBeNull();
    expect(averageOf([100, 0, undefined])).toBe(50);
  });
});

describe('the spreadsheet', () => {
  it('writes missing work as Missing (0), leaves work not due yet out of the average, and still says not assigned', () => {
    const a = work('Adding', now + DAY), b = work('F and J', now - DAY), c = { ...work('Extra', null), students: ['x'] } as Assignment;
    const csv = gradebookCsv([{ id: 'm', name: 'Maria' }, { id: 'n', name: 'Ana' }], [a, b, c], (sid, x) => (sid === 'm' && x.id === 'Adding' ? pr({ begun: true, done: 1, score: 100, status: 'done' }) : null), now);
    const rows = csv.trim().split('\r\n');
    expect(rows[1]).toBe('Maria,100,Done,100,0,Missing,0,,not assigned,,50');
    expect(rows[2]).toBe('Ana,,Not started,0,0,Missing,0,,not assigned,,0');
  });
});

describe('the Gradebook tab', () => {
  const src = readFileSync(new URL('./ui/GradebookTab.svelte', import.meta.url), 'utf8');
  it('says how the average works, and shows missing work as missing, not a plain 0', () => {
    expect(src).toContain('The average leaves out work not started and not due yet. Missing work (past its due date, not started) counts as 0.');
    expect(src).toContain('0<small>Missing</small>');
    expect(src).not.toContain(">0</span></td>");
  });
});
