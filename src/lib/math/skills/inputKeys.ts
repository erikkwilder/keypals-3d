// Practice's own answer inputs by keyboard: the number line, the clock, the ruler, the jug, the coins, a bar and
// the chance line. Tab reaches each one and its buttons, and the keys follow the slider pattern. The arrows and
// Enter work from anywhere on the page, as they always have; Page Up, Page Down, Home, End and Space only while
// the input has focus, so elsewhere they stay the page's. A tap or a drag doesn't come through here.
import { onButton } from '../../ui/screenKeys';

export type KeyLike = { key: string; repeat?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean };
/** What a key does: the value it moves to, 'go' to answer, 'hold' for a held Enter or Space (it answers only
 *  once), or null for a key it leaves to the page (and any key with Ctrl, Alt or Cmd: the browser's). */
export type Moved = number | 'go' | 'hold' | null;
/** A slider's ends and step: its values are min, min + step, min + 2 steps... up to max. */
export type Steps = { min: number; max: number; step: number };

/** A slider by keyboard: Right and Up one step more, Left and Down one less, Page Up and Page Down ten steps,
 *  Home and End to the ends, never past them; Enter answers, and Space while it has focus. A value is always
 *  min + a whole number of steps, the same number a tap there gives; a value between two steps (a drag on the
 *  chance line) goes to the next step that way. */
export function stepKey(e: KeyLike, at: number, r: Steps, focused: boolean): Moved {
  if (e.altKey || e.ctrlKey || e.metaKey) return null;
  const n = Math.round((r.max - r.min) / r.step), i = (at - r.min) / r.step;
  const to = (k: number) => r.min + Math.max(0, Math.min(n, k)) * r.step;
  // (1e-6: a sum of steps like 2.9999999996 is on step 3)
  const up = (k: number) => to(Math.floor(i + 1e-6) + k), down = (k: number) => to(Math.ceil(i - 1e-6) - k);
  switch (e.key) {
    case 'ArrowRight': case 'ArrowUp': return up(1);
    case 'ArrowLeft': case 'ArrowDown': return down(1);
    case 'Enter': return e.repeat ? 'hold' : 'go';
  }
  if (!focused) return null;
  switch (e.key) {
    case 'PageUp': return up(10);
    case 'PageDown': return down(10);
    case 'Home': return to(0);
    case 'End': return to(n);
    case ' ': return e.repeat ? 'hold' : 'go';
  }
  return null;
}

/** The clock by keyboard. t is minutes past 12 (0 to 719) and the clock goes round: a step past 11:55 is 12:00.
 *  Right and Left turn the long hand a step (the short hand follows it, as on a real clock), Up and Down turn
 *  the short hand an hour; while it has focus Page Up and Page Down an hour too, Home to 12:00 and End to the
 *  step before it. On the easiest clock the long hand stays on 12, so its step is an hour. Enter answers, and
 *  Space while it has focus. */
export function clockKey(e: KeyLike, t: number, step: number, focused: boolean): Moved {
  if (e.altKey || e.ctrlKey || e.metaKey) return null;
  const round = (v: number) => ((v % 720) + 720) % 720;
  switch (e.key) {
    case 'ArrowRight': return round(t + step);
    case 'ArrowLeft': return round(t - step);
    case 'ArrowUp': return round(t + 60);
    case 'ArrowDown': return round(t - 60);
    case 'Enter': return e.repeat ? 'hold' : 'go';
  }
  if (!focused) return null;
  switch (e.key) {
    case 'PageUp': return round(t + 60);
    case 'PageDown': return round(t - 60);
    case 'Home': return 0;
    case 'End': return 720 - step;
    case ' ': return e.repeat ? 'hold' : 'go';
  }
  return null;
}

/** Enter or Space on a button is the button's own (a coin, Pour more, Done): an input's keys from anywhere on
 *  the page leave it to the button, which does its job through its click. */
export const buttonKey = (e: Pick<KeyboardEvent, 'key' | 'target'>): boolean => (e.key === 'Enter' || e.key === ' ') && onButton(e);

/** A practice button's handlers. It acts the moment a finger or mouse goes down, as it always has (and the
 *  focus stays where it was), and by keyboard: Enter or Space click it with no pointer, a click whose count is
 *  0. The click after a tap counts 1, so a tap never counts twice. `keyed` is for a button that does a little
 *  more by keyboard (a coin taken back hands the focus on). */
export function press(fn: () => void, keyed: () => void = fn) {
  return {
    onpointerdown: (e: PointerEvent) => { e.preventDefault(); fn(); },
    onclick: (e: MouseEvent) => { if (e.detail === 0) keyed(); },
  };
}

/** Where the chance line's star is, in the line's own words, for a screen reader: "Even chance", "Unlikely, 3
 *  of 10", or "Likely, about 7 of 10" between two marks (after a drag). */
export function chanceText(x: number, den: number): string {
  const k = Math.round(x * den), on = Math.abs(x * den - k) < 0.01;
  if (on && k === 0) return 'Impossible';
  if (on && k === den) return 'Certain';
  if (on && 2 * k === den) return 'Even chance';
  return `${x < 0.5 ? 'Unlikely' : 'Likely'}, ${on ? '' : 'about '}${k} of ${den}`;
}

const UNIT: Record<string, [string, string]> = { cm: ['centimetre', 'centimetres'], in: ['inch', 'inches'], mL: ['millilitre', 'millilitres'], L: ['litre', 'litres'] };
/** A ruler's or a jug's value in words, for a screen reader: "1 centimetre", "3.5 inches", "300 millilitres". */
export const unitText = (v: number, unit: string): string => `${v} ${UNIT[unit]?.[v === 1 ? 0 : 1] ?? unit}`;
