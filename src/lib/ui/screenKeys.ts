// Keys a whole screen listens for (the title's "or press any key", New player's Enter to go on), and the ones
// it leaves to something else.

/** Enter or Space on a button is that button's own ("I'm a grown-up", "Change my buddy"): a screen's own
 *  Enter, or the title's any key, leaves it to the button. */
export const onButton = (e: Pick<Event, 'target'>): boolean =>
  typeof HTMLButtonElement !== 'undefined' && e.target instanceof HTMLButtonElement;

// pressed alone, these are on their way to something else (Shift-Tab, a shortcut), not a key of their own
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn', 'AltGraph']);

/** The title's "or press any key". Not Tab (it moves between "Let's play!" and the FancyAnt pill), not a
 *  modifier key alone (Shift on its way to Shift-Tab), not a key pressed with Ctrl, Cmd or Alt (the
 *  browser's shortcuts), and not Enter or Space on a button. */
export function startsTheGame(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'target'>): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  if (e.key === 'Tab' || MODIFIERS.has(e.key)) return false;
  return !((e.key === 'Enter' || e.key === ' ') && onButton(e));
}
