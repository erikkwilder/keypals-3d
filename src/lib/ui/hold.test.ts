// The grown-up check's "Press and hold" (hold.svelte.ts, GrownupGate.svelte): a keyboard can hold it the way
// a real keyboard sends a held key, and a screen reader or a switch, which can't hold, goes straight on to
// the number question.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { HoldButton } from './hold.svelte';

type Ev = { key: string; repeat: boolean; preventDefault: Mock<() => void> };
const ev = (key: string, repeat = false): Ev => ({ key, repeat, preventDefault: vi.fn<() => void>() });
/** `key` held down for `ms` the way a real keyboard sends it: one keydown, then a repeat every 33 ms after
 *  half a second (not let go: the test does that) */
function downFor(h: HoldButton, key: string, ms: number): Ev[] {
  const sent = [ev(key)];
  h.keydown(sent[0]);
  for (let t = 1; t <= ms; t++) {
    vi.advanceTimersByTime(1);
    if (t >= 500 && (t - 500) % 33 === 0) { const e = ev(key, true); sent.push(e); h.keydown(e); }
  }
  return sent;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the hold from a keyboard', () => {
  it.each(['Enter', ' '])('%j held 2 s, repeats and all, fills the bar; letting go goes on to the number', (key) => {
    const done = vi.fn();
    const h = new HoldButton(done);
    const sent = downFor(h, key, 2000);
    expect(sent.filter(e => e.repeat).length).toBeGreaterThan(40);
    expect(h.fill).toBeGreaterThanOrEqual(1);
    // (not yet: the number box takes the keyboard when the key comes up, so a held Space can't type into it)
    expect(done).not.toHaveBeenCalled();
    const up = ev(key);
    h.keyup(up);
    expect(done).toHaveBeenCalledTimes(1);
    // the browser's own click for Enter or Space doesn't come as well
    for (const e of [...sent, up]) expect(e.preventDefault).toHaveBeenCalled();
  });
  it('let go before the bar is full: it empties and nothing goes on', () => {
    const done = vi.fn();
    const h = new HoldButton(done);
    downFor(h, 'Enter', 1000);
    expect(h.fill).toBeGreaterThan(0.5);
    h.keyup(ev('Enter'));
    expect(h.fill).toBe(0);
    vi.advanceTimersByTime(3000);
    expect(done).not.toHaveBeenCalled();
  });
  it('leaving the button stops the hold, as letting go does, and a new press starts again', () => {
    const done = vi.fn();
    const h = new HoldButton(done);
    downFor(h, ' ', 800);
    h.blur();
    expect(h.fill).toBe(0);
    vi.advanceTimersByTime(3000);
    expect(done).not.toHaveBeenCalled();
    downFor(h, ' ', 1700);
    h.keyup(ev(' '));
    expect(done).toHaveBeenCalledTimes(1);
  });
  it('other keys are left alone: Tab still moves on', () => {
    const done = vi.fn();
    const h = new HoldButton(done);
    for (const k of ['Tab', 'a', 'Escape']) {
      const e = ev(k);
      h.keydown(e);
      expect(e.preventDefault, k).not.toHaveBeenCalled();
    }
    vi.advanceTimersByTime(3000);
    expect(h.fill).toBe(0);
    expect(done).not.toHaveBeenCalled();
  });
  it('a second key while one holds changes nothing; the first one coming up is letting go', () => {
    const done = vi.fn();
    const h = new HoldButton(done);
    downFor(h, 'Enter', 600);
    h.keydown(ev(' '));
    h.keyup(ev(' '));
    expect(h.fill).toBeGreaterThan(0.3);
    h.keyup(ev('Enter'));
    expect(h.fill).toBe(0);
  });
});

describe('the hold from a finger or a mouse, as before', () => {
  it('full goes on at once, while still pressed', () => {
    const done = vi.fn();
    const h = new HoldButton(done);
    h.start();
    vi.advanceTimersByTime(1400);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(done).toHaveBeenCalledTimes(1);
    h.stop();
    expect(done).toHaveBeenCalledTimes(1);
  });
  it('let go early: the bar empties', () => {
    const done = vi.fn();
    const h = new HoldButton(done);
    h.start();
    vi.advanceTimersByTime(700);
    h.stop();
    expect(h.fill).toBe(0);
    vi.advanceTimersByTime(3000);
    expect(done).not.toHaveBeenCalled();
  });
});

describe('a press with no pointer behind it: a screen reader or a switch', () => {
  it('a click with detail 0 goes straight on to the number question', () => {
    const done = vi.fn();
    new HoldButton(done).click({ detail: 0 });
    expect(done).toHaveBeenCalledTimes(1);
  });
  it('a mouse or finger click (detail 1 or more) changes nothing: the pointer\'s hold does that', () => {
    const done = vi.fn();
    const h = new HoldButton(done);
    for (const detail of [1, 2, 3]) h.click({ detail });
    expect(done).not.toHaveBeenCalled();
  });
  it('a click that comes with the keyboard\'s hold is the key\'s, not a pass', () => {
    const done = vi.fn();
    const h = new HoldButton(done);
    h.keydown(ev('Enter'));
    h.click({ detail: 0 });
    vi.advanceTimersByTime(300);
    h.keyup(ev('Enter'));
    h.click({ detail: 0 });
    expect(done).not.toHaveBeenCalled();
    // a screen reader's press a moment later still goes on
    vi.advanceTimersByTime(1);
    h.click({ detail: 0 });
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('GrownupGate uses it', () => {
  const g = readFileSync(new URL('./GrownupGate.svelte', import.meta.url), 'utf8');
  it('the hold button takes the pointer, Enter and Space, leaving and clicks through HoldButton', () => {
    for (const w of ['onpointerdown={hold.start}', 'onpointerup={hold.stop}', 'onpointerleave={hold.stop}', 'onkeydown={hold.keydown}', 'onkeyup={hold.keyup}', 'onblur={hold.blur}', 'onclick={hold.click}', 'style:width="{hold.fill * 100}%"']) expect(g, w).toContain(w);
    // (each Enter repeat used to start the hold again, so the bar never filled)
    expect(g).not.toContain("e.key === 'Enter' && startHold()");
  });
  it('done is the number question, with its box focused', () => {
    expect(g).toContain("new HoldButton(() => { step = 'type'; sfx.click(); setTimeout(() => input?.focus(), 50); })");
  });
});
