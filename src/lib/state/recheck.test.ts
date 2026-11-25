// After a dropped connection, a change made offline reaches the online copy when the browser says it's back
// online. Before, it was sent only at the next change: coming back into view, or the quarter-hour check,
// catch up only with players whose online copy changed elsewhere (sync.ts planSync), and a child who
// stopped playing offline left the online copy behind until the next visit (recheck.ts).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { watchRechecks } from './recheck';

function setup(visibilityState: 'visible' | 'hidden' = 'visible') {
  const win = new EventTarget(), doc = Object.assign(new EventTarget(), { visibilityState });
  const calls: string[] = [];
  const timer = watchRechecks({ inView: () => calls.push('catch up'), backOnline: () => calls.push('catch up and send') }, win as unknown as Window, doc as unknown as Document);
  return { win, doc, calls, timer };
}
afterEach(() => vi.useRealTimers());

describe('checking the saved copies again, after the start', () => {
  it('back online: catches up and sends what waited, straight away', () => {
    const { win, calls, timer } = setup();
    win.dispatchEvent(new Event('online'));
    expect(calls).toEqual(['catch up and send']);
    clearInterval(timer);
  });

  it('back online while the game is out of view: sends all the same', () => {
    const { win, calls, timer } = setup('hidden');
    win.dispatchEvent(new Event('online'));
    expect(calls).toEqual(['catch up and send']);
    clearInterval(timer);
  });

  it('back in view: catches up, as before; going out of view does nothing', () => {
    const { doc, calls, timer } = setup('hidden');
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(calls).toEqual([]);
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(calls).toEqual(['catch up']);
    clearInterval(timer);
  });

  it('every quarter of an hour while in view, as before', () => {
    vi.useFakeTimers();
    const { calls, timer } = setup();
    vi.advanceTimersByTime(15 * 60000 - 1);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(['catch up']);
    clearInterval(timer);
  });

  it('cloud.svelte.ts sends every change waiting here when the browser is back online', () => {
    const src = readFileSync(new URL('./cloud.svelte.ts', import.meta.url), 'utf8');
    expect(src).toContain('watchRechecks({ inView: () => void catchUp(), backOnline: () => void catchUp().catch(() => {}).then(pushAll) });');
    // pushAll sends each player changed here since its saved copy
    expect(src).toMatch(/async function pushAll\(\) \{[\s\S]*?if \(!changedHere\(p\)\) continue;\s*try \{ await send\(p\);/);
    expect(src).not.toContain("document.addEventListener('visibilitychange'");
  });
});
