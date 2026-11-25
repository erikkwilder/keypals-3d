// Who hasn't logged in yet (the teacher's This week, Gradebook and student page), told apart from who logged
// in and hasn't played this week.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classWeekReport } from './reports';

const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

describe("who hasn't logged in yet", () => {
  it('This week lists them apart from who logged in and has not played this week', () => {
    const wk = classWeekReport([{ id: 'a', name: 'Ana', profile: null, loggedIn: false }, { id: 's', name: 'Sam', profile: null, loggedIn: true }, { id: 'z', name: 'Zed', profile: null }], '2026-11-23');
    expect(wk.notLoggedIn).toEqual(['Ana']);
    expect(wk.notPlayed).toEqual(['Sam', 'Zed']);
    expect(wk.rows.find(r => r.id === 'a')?.never).toBe(true);
  });
  it('the Gradebook, This week and the student page say so, from what the class page was told', () => {
    expect(read('./ui/GradebookTab.svelte').match(/\{#if row\.k\.loggedIn === false\}<small class="nl">Hasn't logged in yet<\/small>\{\/if\}/g)).toHaveLength(2);
    const ov = read('./ui/OverviewTab.svelte');
    expect(ov).toContain(`{wk.notLoggedIn.length === 1 ? "Hasn't" : "Haven't"} logged in yet:</b>`);
    expect(ov).toContain(`{#if r.never}<small class="nl">Hasn't logged in yet</small>{/if}`);
    expect(read('./ui/StudentPage.svelte')).toContain(`kid.loggedIn === false ? " · hasn't logged in yet"`);
    expect(read('./ui/ClassPage.svelte')).toContain('loggedIn: teach.loggedIn[s.id]');
  });
});
