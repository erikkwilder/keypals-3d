// A pupil's week goes to the boards 8 s after an activity. A child who closed the game sooner showed on the
// boards only after her next activity. Now the waiting week is sent as the page goes away (hidden or closed),
// with a request that outlives the page, and only once.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('./student.svelte.ts', import.meta.url), 'utf8');

describe("a waiting week is sent as the page goes away", () => {
  it('leaving the page (closed or hidden) sends the waiting week', () => {
    expect(src).toContain("addEventListener('pagehide', sendWaitingWeek);");
    expect(src).toMatch(/visibilitychange', \(\) => \{ if \(document\.visibilityState === 'hidden'\) sendWaitingWeek\(\); \}/);
  });
  it('with a request that outlives the page, only when one is waiting, and only once', () => {
    expect(src).toMatch(/keepalive: keep \}\)/);
    expect(src).toMatch(/export function sendWaitingWeek\(\) \{\n\s*if \(!waiting\) return;\n\s*const id = waiting;\n\s*waiting = null; clearTimeout\(timer\);/);
    expect(src).toMatch(/reportWeek\(p, true\)/);
  });
  it('the usual 8 s send clears what is waiting, so leaving later sends nothing twice', () => {
    expect(src).toMatch(/timer = setTimeout\(\(\) => \{\n\s*waiting = null;/);
  });
});
