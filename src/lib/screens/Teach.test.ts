// The teacher's home, read from the screen's source (it needs the whole game to run).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('./Teach.svelte', import.meta.url), 'utf8');

describe("a class's tile", () => {
  it('reads "4 students · 2 waiting for you": the space before the dot is kept (a space at the start of an {#if} is dropped)', () => {
    expect(src).toContain(`student{c.students === 1 ? '' : 's'}{#if c.pending}{' · '}<em>{c.pending} waiting for you</em>{/if}`);
  });
});

// a teacher we turned down isn't offered what would only make classes no student can enter
const teachPage = readFileSync(new URL('./Teach.svelte', import.meta.url), 'utf8');
describe('a turned-down teacher', () => {
  it('gets no "Make your first one" and no New class form; classes made while waiting are still listed', () => {
    expect(teachPage).toContain("{:else if status !== 'declined'}\n              <p class=\"muted\">No classes yet. Make your first one below.</p>");
    const form = teachPage.indexOf('<form class="newc"');
    expect(teachPage.lastIndexOf("{#if status !== 'declined'}", form)).toBeGreaterThan(teachPage.lastIndexOf('{/if}', form));
    expect(teachPage).toContain("{#if status !== 'declined' || teach.classes.length}");
  });
});
