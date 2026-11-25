// A class's page, read from the source (it needs the teacher's page to run): the tab row's Refresh fetches
// everything that changes while the class plays, and the Boards tab is fetched fresh each time it opens, so
// the teacher who made a challenge code sees the class that joined.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { updatedText } from '../reports';

const page = readFileSync(new URL('./ClassPage.svelte', import.meta.url), 'utf8');
const boards = readFileSync(new URL('./BoardsTab.svelte', import.meta.url), 'utf8');

describe("the tab row's Refresh", () => {
  it('fetches progress and the class (its board and class against class) together', () => {
    expect(page).toContain('const refresh = () => act(() => Promise.all([loadProfiles(true), refreshClass()]));');
    expect(page).toMatch(/<button class="refresh" onclick=\{refresh\}/);
  });
  it("is the only Refresh: the class board has none of its own, and the waiting challenge points to it", () => {
    expect(boards).not.toContain('>Refresh</button>');
    expect(boards).not.toContain('refreshClass');
    expect(boards).toContain('Waiting for another class to join with the code. Tap Refresh to check.');
  });
});

describe('opening the Boards tab', () => {
  it('fetches the board and the challenge again', () => {
    expect(page).toContain("if (t === 'boards') void refreshClass().catch(() => null);");
  });
});

describe('the Class work tab, and how old the numbers are', () => {
  const store = readFileSync(new URL('../teacher.svelte.ts', import.meta.url), 'utf8');
  it("opening Class work fetches everyone's progress again", () => {
    expect(page).toContain("if (t === 'work') void loadProfiles(true).catch(() => null);");
  });
  it('"Updated 3:42 pm" beside Refresh: the time of the last fetch of what the tab shows', () => {
    expect(page).toContain('{#if at}<span class="upd">{updatedText(at)}</span>{/if}<button class="refresh"');
    expect(page).toContain("const at = $derived(teach.tab === 'boards' && !teach.studentId ? teach.classAt : teach.profilesAt);");
    expect(store).toContain('teach.profilesFor = c.class.id; teach.profilesAt = Date.now();');
    expect(store).toContain('teach.classAt = Date.now();\n}');
    expect(updatedText(new Date(2026, 10, 25, 15, 42).getTime())).toBe('Updated 3:42 pm');
    expect(updatedText(new Date(2026, 10, 25, 9, 5).getTime())).toBe('Updated 9:05 am');
    expect(updatedText(new Date(2026, 10, 25, 0, 30).getTime())).toBe('Updated 12:30 am');
  });
});
