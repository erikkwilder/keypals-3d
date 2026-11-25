// Number Line Hop by keyboard. The line told screen readers it was a slider, but Tab never reached it and no key
// did anything, so it couldn't be played without a mouse or a finger. Now it is a slider: arrows move a marker one
// step, Page Up and Page Down ten, Home and End to the ends, and Enter or Space puts the number there, as a tap
// there does.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lineKey, lineSnap, lineSpec } from '../playground';

type Mods = { repeat?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean };
const k = (key: string, at: number, level = 1, o: Mods = {}) => lineKey({ key, ...o }, at, lineSpec(level).max, lineSnap(level));

describe('Number Line Hop by keyboard', () => {
  it('snaps where a tap does: whole numbers, and tens at level 5', () => {
    expect([1, 2, 3, 4, 5].map(lineSnap)).toEqual([1, 1, 1, 1, 10]);
  });
  it('the arrows move the marker one step', () => {
    expect(k('ArrowRight', 3)).toBe(4);
    expect(k('ArrowUp', 3)).toBe(4);
    expect(k('ArrowLeft', 3)).toBe(2);
    expect(k('ArrowDown', 3)).toBe(2);
    expect(k('ArrowRight', 40, 3)).toBe(41);
    expect(k('ArrowRight', 370, 5)).toBe(380);
    expect(k('ArrowLeft', 370, 5)).toBe(360);
  });
  it('Page Up and Page Down move ten steps, Home and End go to the ends, and nothing goes past them', () => {
    expect(k('PageUp', 3, 2)).toBe(13);
    expect(k('PageDown', 13, 2)).toBe(3);
    expect(k('PageUp', 370, 5)).toBe(470);
    expect(k('PageUp', 3)).toBe(10);
    expect(k('PageDown', 3)).toBe(0);
    expect(k('Home', 7)).toBe(0);
    expect(k('End', 7)).toBe(10);
    expect(k('End', 0, 5)).toBe(1000);
    expect(k('ArrowRight', 10)).toBe(10);
    expect(k('ArrowLeft', 0)).toBe(0);
  });
  it('Enter and Space put the number at the marker, once for a held key', () => {
    expect(k('Enter', 7)).toBe('place');
    expect(k(' ', 7)).toBe('place');
    // a held key repeats: the next number mustn't be put down by itself
    expect(k('Enter', 7, 1, { repeat: true })).toBe(7);
    expect(k(' ', 7, 1, { repeat: true })).toBe(7);
  });
  it('leaves other keys, and shortcuts with Ctrl, Alt or Cmd, to the browser', () => {
    for (const key of ['Tab', 'Escape', 'Shift', 'a', '5']) expect(k(key, 3), key).toBeNull();
    expect(k('ArrowLeft', 3, 1, { altKey: true })).toBeNull();
    expect(k('ArrowRight', 3, 1, { metaKey: true })).toBeNull();
    expect(k('Home', 3, 1, { ctrlKey: true })).toBeNull();
  });

  const src = readFileSync(new URL('./NumberLine.svelte', import.meta.url), 'utf8');
  const svg = src.split('\n').find(l => l.includes('<svg bind:this={svg}'))!;
  it('the line is a slider that Tab reaches and the keys move, with its value and the question', () => {
    expect(svg).toContain('role="slider"');
    expect(svg).toContain('tabindex="0"');
    expect(svg).toContain('onkeydown={key}');
    expect(svg).toContain('aria-valuenow={placed ?? at}');
    expect(svg).toContain('aria-valuetext={placed === null ? `${at}` :');
    expect(svg).toContain('aria-describedby={askId}');
    expect(src).toContain('<p class="ask" id={askId}>');
  });
  it('shows the marker only while the line has keyboard focus, and the game\'s focus ring', () => {
    expect(src).toContain('{#if placed === null && keyed}');
    expect(svg).toContain("onfocus={() => (keyed = !!svg?.matches(':focus-visible'))}");
    expect(svg).toContain('onblur={() => (keyed = false)}');
    expect(src).not.toMatch(/outline:\s*none/);
  });
  it('a key and a tap put the number down the same way', () => {
    expect(src).toContain("if (k === 'place') place(at); else at = k;");
    expect(src).toMatch(/function tap\(e: PointerEvent\) \{[^}]*place\(Math\.max\(0, Math\.min\(spec\.max, Math\.round\(/);
    expect(src).toContain('function place(v: number) {\n    placed = v; at = v;\n    got = linePoints(target, v, spec.max);');
  });
});
