// The number pad by keyboard and by switch. Tab reaches each key: the digits, then the decimal point and the
// minus key when a question has them, then Erase, and the screen's answer key comes after the pad. Enter or
// Space, or a switch's click, press the focused key exactly as a tap does. Typed digits, Backspace and Enter
// with no key focused stay the screen's, as they always have.
import { onButton } from '../../ui/screenKeys';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/** The pad's keys in the order Tab reaches them, on a wide screen and a phone alike: the digits, the extra keys,
 *  then Erase. On a phone the calculator block puts Erase beside the 0 (the pad's CSS order), where it's always
 *  been. */
export const padKeys = (extra: readonly string[] = []): string[] => [...DIGITS, ...extra, 'back'];

/** What a screen reader calls a key: "7", "Point", "Minus", "Erase". */
export const keyName = (k: string): string => (k === 'back' ? 'Erase' : k === '-' ? 'Minus' : k === '.' ? 'Point' : k);

/** Enter or Space on one of a pad's own keys (the number pad's, or the fraction pad's Top, Bottom and Check,
 *  anything inside [data-pad]): the key does its job through its click, so a screen's own Enter (answer) and
 *  Space leave it alone. Enter or Space anywhere else, and every typed digit, stay the screen's. */
export const padKey = (e: Pick<KeyboardEvent, 'key' | 'target'>): boolean =>
  (e.key === 'Enter' || e.key === ' ') && onButton(e) && !!(e.target as Element).closest?.('[data-pad]');

/** The fraction pad's Tab, from the top box to the bottom one: while the child is typing (no button has the
 *  focus) and the top box is the one being filled. From the bottom box, or on a button, Tab is the browser's and
 *  moves on, so Tab can reach the pad's keys. */
export const tabsToBottom = (e: Pick<KeyboardEvent, 'key' | 'target'>, focus: 'n' | 'd'): boolean =>
  e.key === 'Tab' && focus === 'n' && !onButton(e);
