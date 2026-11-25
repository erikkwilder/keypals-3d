// "Your classes are on" (teach/approval.ts and the teacher's page): once, after an admin's yes to a teacher
// who waited, and never for anyone else.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classesOnNote } from './approval';

const DAY = 86400000, now = Date.UTC(2026, 10, 25, 15), yes = now - 2 * DAY;

describe('"Your classes are on"', () => {
  it('is for a teacher an admin said yes to after she waited, the first time her page opens after it', () => {
    expect(classesOnNote({ status: 'approved', approvedAt: yes }, null, now)).toBe(true);
    expect(classesOnNote({ status: 'approved', approvedAt: yes }, String(yes), now)).toBe(false);
    expect(classesOnNote({ status: 'approved', approvedAt: yes }, String(yes - DAY), now)).toBe(true);
  });
  it('is never for a teacher on from the start, one waiting or turned down, or a yes over 30 days old', () => {
    expect(classesOnNote({ status: 'approved' }, null, now)).toBe(false);
    expect(classesOnNote({ status: 'pending' }, null, now)).toBe(false);
    expect(classesOnNote({ status: 'declined', approvedAt: yes }, null, now)).toBe(false);
    expect(classesOnNote({ status: 'approved', approvedAt: now - 31 * DAY }, null, now)).toBe(false);
    expect(classesOnNote(null, null, now)).toBe(false);
  });
  it("says it in the page's words, over her classes and over a class she has open", () => {
    const src = readFileSync(new URL('../screens/Teach.svelte', import.meta.url), 'utf8');
    expect(src).toContain('<p><b>Your classes are on.</b> Your students can log in now.</p>');
    expect(src.match(/\{#if classesOn\}\{@render onNote\(\)\}\{\/if\}/g)).toHaveLength(2);
  });
});
