// The teacher's home, read from the screen's source (it needs the whole game to run).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('./Teach.svelte', import.meta.url), 'utf8');

describe("a class's tile", () => {
  it('reads "4 students · 2 waiting for you": the space before the dot is kept (a space at the start of an {#if} is dropped)', () => {
    expect(src).toContain(`student{c.students === 1 ? '' : 's'}{#if c.pending}{' · '}<em>{c.pending} waiting for you</em>{/if}`);
  });
});
