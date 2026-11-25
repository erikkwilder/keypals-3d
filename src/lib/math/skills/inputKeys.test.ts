// Practice's own answer inputs by keyboard: the key rules (inputKeys.ts), and each fixed input's markup read
// from its source (Tab reaches it, it says what it is and its value, its buttons work by keyboard).
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buttonKey, chanceText, clockKey, press, stepKey, unitText } from './inputKeys';

const K = (key: string, more: object = {}) => ({ key, ...more });

describe('stepKey: a slider by keyboard', () => {
  const Q = { min: 0, max: 1, step: 0.25 };
  it('the arrows move one step, from anywhere on the page', () => {
    for (const f of [false, true]) {
      expect(stepKey(K('ArrowRight'), 0.5, Q, f)).toBe(0.75);
      expect(stepKey(K('ArrowUp'), 0.5, Q, f)).toBe(0.75);
      expect(stepKey(K('ArrowLeft'), 0.5, Q, f)).toBe(0.25);
      expect(stepKey(K('ArrowDown'), 0.5, Q, f)).toBe(0.25);
    }
  });
  it('never goes past the ends', () => {
    expect(stepKey(K('ArrowRight'), 1, Q, false)).toBe(1);
    expect(stepKey(K('ArrowLeft'), 0, Q, false)).toBe(0);
  });
  it('Page Up and Page Down go ten steps, Home and End to the ends, only while it has focus', () => {
    const N = { min: -10, max: 10, step: 1 };
    expect(stepKey(K('PageUp'), -5, N, true)).toBe(5);
    expect(stepKey(K('PageUp'), 3, N, true)).toBe(10);
    expect(stepKey(K('PageDown'), 3, N, true)).toBe(-7);
    expect(stepKey(K('PageDown'), -3, N, true)).toBe(-10);
    expect(stepKey(K('Home'), 4, N, true)).toBe(-10);
    expect(stepKey(K('End'), 4, N, true)).toBe(10);
    for (const k of ['PageUp', 'PageDown', 'Home', 'End', ' ']) expect(stepKey(K(k), 4, N, false), k).toBeNull();
  });
  it('Enter answers from anywhere, Space while it has focus, and a held one answers only once', () => {
    expect(stepKey(K('Enter'), 0.5, Q, false)).toBe('go');
    expect(stepKey(K(' '), 0.5, Q, true)).toBe('go');
    expect(stepKey(K('Enter', { repeat: true }), 0.5, Q, false)).toBe('hold');
    expect(stepKey(K(' ', { repeat: true }), 0.5, Q, true)).toBe('hold');
  });
  it('leaves other keys, and any key with Ctrl, Alt or Cmd, to the page', () => {
    for (const k of ['a', '5', 'Tab', 'Escape', 'Backspace']) expect(stepKey(K(k), 0.5, Q, true), k).toBeNull();
    for (const m of ['ctrlKey', 'altKey', 'metaKey']) expect(stepKey(K('ArrowRight', { [m]: true }), 0.5, Q, true), m).toBeNull();
  });
  it('gives exactly the numbers a tap gives (min + a whole number of steps), however many presses', () => {
    const line = { min: 0, max: 1, step: 0.1 };
    let at = line.min;
    for (let k = 1; k <= 10; k++) {
      at = stepKey(K('ArrowRight'), at, line, false) as number;
      expect(at).toBe(line.min + Math.round((k / 10) * 10) * line.step);
    }
    expect(stepKey(K('End'), 0, line, true)).toBe(line.min + 10 * line.step);
  });
  it('a value between two steps (a drag) goes to the next step that way', () => {
    const sixths = { min: 0, max: 1, step: 1 / 6 };
    expect(stepKey(K('ArrowRight'), 0.4, sixths, false)).toBeCloseTo(3 / 6, 12);
    expect(stepKey(K('ArrowLeft'), 0.4, sixths, false)).toBeCloseTo(2 / 6, 12);
    // a sum of steps is still on its step
    expect(stepKey(K('ArrowRight'), 0.1 + 0.2, { min: 0, max: 1, step: 0.1 }, false)).toBeCloseTo(0.4, 12);
  });
});

describe('clockKey: the clock by keyboard', () => {
  it('Right and Left turn the long hand a step, Up and Down the short hand an hour', () => {
    expect(clockKey(K('ArrowRight'), 180, 5, false)).toBe(185);
    expect(clockKey(K('ArrowLeft'), 180, 5, false)).toBe(175);
    expect(clockKey(K('ArrowUp'), 185, 5, false)).toBe(245);
    expect(clockKey(K('ArrowDown'), 185, 5, false)).toBe(125);
  });
  it('goes round: a step past 11:55 is 12:00, and back', () => {
    expect(clockKey(K('ArrowRight'), 715, 5, false)).toBe(0);
    expect(clockKey(K('ArrowLeft'), 0, 5, false)).toBe(715);
    expect(clockKey(K('ArrowDown'), 30, 30, false)).toBe(690);
  });
  it('on the easiest clock (the long hand stays on 12) every arrow moves an hour', () => {
    expect(clockKey(K('ArrowRight'), 180, 60, false)).toBe(240);
    expect(clockKey(K('ArrowLeft'), 180, 60, false)).toBe(120);
  });
  it('Page Up and Page Down an hour, Home 12:00, End the step before it, only while it has focus', () => {
    expect(clockKey(K('PageUp'), 180, 5, true)).toBe(240);
    expect(clockKey(K('PageDown'), 30, 5, true)).toBe(690);
    expect(clockKey(K('Home'), 425, 5, true)).toBe(0);
    expect(clockKey(K('End'), 0, 5, true)).toBe(715);
    for (const k of ['PageUp', 'PageDown', 'Home', 'End', ' ']) expect(clockKey(K(k), 180, 5, false), k).toBeNull();
  });
  it('Enter is Done from anywhere, Space while it has focus, once for a held key; Ctrl, Alt and Cmd are the browser\'s', () => {
    expect(clockKey(K('Enter'), 180, 5, false)).toBe('go');
    expect(clockKey(K(' '), 180, 5, true)).toBe('go');
    expect(clockKey(K('Enter', { repeat: true }), 180, 5, false)).toBe('hold');
    expect(clockKey(K('ArrowRight', { metaKey: true }), 180, 5, true)).toBeNull();
    expect(clockKey(K('x'), 180, 5, true)).toBeNull();
  });
});

describe('buttons by keyboard', () => {
  afterEach(() => { delete (globalThis as { HTMLButtonElement?: unknown }).HTMLButtonElement; });
  it('Enter or Space on a button is left to the button; other keys and other places are not', () => {
    class Btn {}
    (globalThis as { HTMLButtonElement?: unknown }).HTMLButtonElement = Btn;
    expect(buttonKey({ key: 'Enter', target: new Btn() as EventTarget })).toBe(true);
    expect(buttonKey({ key: ' ', target: new Btn() as EventTarget })).toBe(true);
    expect(buttonKey({ key: 'ArrowRight', target: new Btn() as EventTarget })).toBe(false);
    expect(buttonKey({ key: 'Enter', target: {} as EventTarget })).toBe(false);
  });
  it('press: a tap acts once, on the way down; Enter or Space (a click with no pointer) acts too', () => {
    const fn = vi.fn(), keyed = vi.fn();
    const p = press(fn);
    const down = { preventDefault: vi.fn() };
    p.onpointerdown(down as unknown as PointerEvent);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(down.preventDefault).toHaveBeenCalled();
    p.onclick({ detail: 1 } as MouseEvent); // the click after the tap
    expect(fn).toHaveBeenCalledTimes(1);
    p.onclick({ detail: 0 } as MouseEvent); // Enter or Space
    expect(fn).toHaveBeenCalledTimes(2);
    const q = press(fn, keyed);
    q.onclick({ detail: 0 } as MouseEvent);
    expect(keyed).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('what a screen reader hears', () => {
  it('the chance line in its own words', () => {
    expect(chanceText(0.5, 10)).toBe('Even chance');
    expect(chanceText(0, 4)).toBe('Impossible');
    expect(chanceText(1, 4)).toBe('Certain');
    expect(chanceText(0.25, 4)).toBe('Unlikely, 1 of 4');
    expect(chanceText(0.5 + 1 / 6 + 1 / 6, 6)).toBe('Likely, 5 of 6');
    expect(chanceText(0.43, 10)).toBe('Unlikely, about 4 of 10');
  });
  it('a length or an amount with its unit', () => {
    expect(unitText(1, 'cm')).toBe('1 centimetre');
    expect(unitText(7, 'cm')).toBe('7 centimetres');
    expect(unitText(3.5, 'in')).toBe('3.5 inches');
    expect(unitText(1, 'in')).toBe('1 inch');
    expect(unitText(300, 'mL')).toBe('300 millilitres');
    expect(unitText(2, 'L')).toBe('2 litres');
  });
});

// each fixed input, read from its source
const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
/** a tag from its < to its > (an arrow function's => or a >= inside it doesn't end it) */
const tags = (s: string, name: string) => s.match(new RegExp(`<${name}\\b(?:=>|>=|[^>])*>`, 'g')) ?? [];
/** slider: it is one; text: its value is read out in words (a time, a unit, a fraction) */
const INPUTS: { name: string; file: string; slider: boolean; text?: boolean }[] = [
  { name: 'the number line', file: './ui/NumberLineInput.svelte', slider: true, text: true },
  { name: 'the clock', file: './ui/ClockInput.svelte', slider: true, text: true },
  { name: 'the ruler', file: './ui/RulerInput.svelte', slider: true, text: true },
  { name: 'the jug', file: './ui/JugInput.svelte', slider: true, text: true },
  { name: 'the coins', file: './ui/CoinTray.svelte', slider: false },
  { name: 'a bar', file: '../data/ui/BarDrag.svelte', slider: true },
  { name: 'the chance line', file: '../data/ui/ChanceLine.svelte', slider: true, text: true },
];
describe.each(INPUTS)('$name', ({ file, slider, text }) => {
  const s = src(file);
  it.runIf(slider)('Tab reaches it, and it says what it is and its value', () => {
    const el = [...tags(s, 'svg'), ...tags(s, 'div')].filter(t => t.includes('role="slider"'));
    expect(el).toHaveLength(1);
    for (const a of ['tabindex="0"', 'aria-label=', 'aria-valuemin=', 'aria-valuemax=', 'aria-valuenow=', ...(text ? ['aria-valuetext='] : [])]) expect(el[0], a).toContain(a);
  });
  it('nothing in it is kept from Tab, and every button works by keyboard', () => {
    expect(s).not.toContain('tabindex="-1"');
    const buttons = tags(s, 'button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) expect(b).toContain('{...press(');
  });
  it('its keys leave Enter and Space on a button to the button, and the focus ring isn\'t turned off', () => {
    expect(s).toMatch(/\|\| buttonKey\(e\)\) return;/);
    expect(s).not.toMatch(/outline:\s*(none|0)/);
  });
});
describe('the coins, by keyboard', () => {
  const s = src('./ui/CoinTray.svelte');
  it('a coin taken back hands the focus on, and a screen reader hears the tray and its new total', () => {
    expect(s).toContain('{...press(() => take(x.k), () => void takeByKey(x.k))}');
    expect(s).toMatch(/<div class="tray"[^>]*role="group" aria-label="Your tray: \{money\(total\)\}"/);
    expect(s).toContain('<span class="sum" aria-live="polite">{money(total)}</span>');
  });
});
