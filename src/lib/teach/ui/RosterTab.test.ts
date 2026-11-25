// A class's Students tab, read from the source (the tab needs the teacher's page to run): who waits for the
// teacher's yes, and what the teacher reads about each.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('./RosterTab.svelte', import.meta.url), 'utf8');
const waiting = src.slice(src.indexOf('<h3>Waiting for you</h3>'), src.indexOf('<h3>Students ('));

describe('waiting for you', () => {
  it('the note names both who wait there: families linking a player from home, and pupils from Google', () => {
    expect(waiting).toContain('<p class="muted">Families linking a player from home, and students who signed in with Google, wait here for your yes. Say yes only if you know who it is.</p>');
  });
});

describe("a family's claim to a classmate", () => {
  it('shows the home player\'s own name too, so the teacher can judge it: "Mia (from home) says it\'s Maria"', () => {
    expect(waiting).toContain("{s.claims ? `${s.homeName ? `${s.homeName} (from home)` : 'A player from home'} says it's ${nameOf(s.claims)}: their progress from home and school will be put together`");
  });
});
