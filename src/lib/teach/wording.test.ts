// Small wordings on the boards and the teacher's pages: class against class for children in whole numbers,
// minutes never "0" for time that was played, and a student's weeks written like every other date.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eachText, minText, minutesOf } from './boards';
import { weekText } from './reports';

const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

describe('class against class for children', () => {
  it('a whole number: "about 11 right each" for 10.7', () => {
    expect(eachText(10.7)).toBe('about 11 right each');
    expect(eachText(12)).toBe('12 right each');
    expect(eachText(0)).toBe('0 right each');
    expect(eachText(0.3)).toBe('about 1 right each');
  });
  it("the children's board says it; the teacher's keeps the exact average", () => {
    expect(read('../screens/Boards.svelte')).toContain('<span class="n">{eachText(x.avg)}</span>');
    expect(read('./ui/BoardsTab.svelte')).toContain('<span class="n">{x.avg} a student</span>');
  });
});

describe('minutes', () => {
  it('never "0 min" for time played: 28 s of practice is "under 1 min"', () => {
    expect(minText(28000)).toBe('under 1 min');
    expect(minText(0)).toBe('0 min');
    expect(minText(30000)).toBe('1 min');
    expect(minText(12 * 60000 + 10000)).toBe('12 min');
    expect(minutesOf(28000)).toBe('under 1');
  });
  it('the boards, This week and the student page go by it', () => {
    expect(read('./ui/BoardsTab.svelte')).toContain('<span class="m">{minText(r.ms)}</span>');
    expect(read('../screens/Boards.svelte')).toContain('minText(r.ms)');
    const ov = read('./ui/OverviewTab.svelte');
    expect(ov).toContain(`<b>{m}</b><span>{m === 1 || m === 'under 1' ? 'minute' : 'minutes'} practised</span>`);
    expect(ov).toContain('<td>{minutesOf(r.ms)}</td>');
    expect(read('./ui/StudentPage.svelte')).toContain('<td>{minutesOf(w.ms)}</td>');
  });
});

describe("a student's weeks", () => {
  it('read like every other date, "Mon, Nov 23", not "2026-11-23"', () => {
    expect(weekText('2026-11-23')).toBe('Mon, Nov 23');
    expect(read('./ui/StudentPage.svelte')).toContain('<tr><td>{weekText(w.week)}</td>');
  });
});
