// Keys a whole screen listens for (screenKeys.ts): the title's "or press any key" leaves Tab, Shift-Tab and
// the browser's shortcuts alone, and New player's Enter leaves Enter on a button to that button.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onButton, startsTheGame } from './screenKeys';

class FakeButton {}
class FakeInput {}
const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
const key = (k: string, o: { ctrl?: boolean; meta?: boolean; alt?: boolean; on?: object } = {}) =>
  ({ key: k, ctrlKey: !!o.ctrl, metaKey: !!o.meta, altKey: !!o.alt, target: (o.on ?? null) as EventTarget | null });

beforeEach(() => vi.stubGlobal('HTMLButtonElement', FakeButton));
afterEach(() => vi.unstubAllGlobals());

describe('the title\'s "or press any key"', () => {
  it('a letter, a digit, an arrow, Escape, or Enter and Space with no button focused start the game', () => {
    for (const k of ['a', 'K', '7', 'ArrowRight', 'Escape', 'Enter', ' ']) expect(startsTheGame(key(k)), k).toBe(true);
  });
  it('Shift and the other modifier keys alone don\'t, so Shift-Tab moves back instead', () => {
    for (const k of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn', 'AltGraph']) expect(startsTheGame(key(k)), k).toBe(false);
    // (Tab and Shift-Tab: the key is Tab either way)
    expect(startsTheGame(key('Tab'))).toBe(false);
  });
  it('a key pressed with Ctrl, Cmd or Alt is the browser\'s shortcut', () => {
    expect(startsTheGame(key('r', { meta: true }))).toBe(false);
    expect(startsTheGame(key('l', { ctrl: true }))).toBe(false);
    expect(startsTheGame(key('ArrowLeft', { alt: true }))).toBe(false);
  });
  it('Enter or Space on a button is that button\'s ("Let\'s play!", the FancyAnt pill)', () => {
    const b = new FakeButton();
    expect(startsTheGame(key('Enter', { on: b }))).toBe(false);
    expect(startsTheGame(key(' ', { on: b }))).toBe(false);
    expect(startsTheGame(key('a', { on: b }))).toBe(true);
  });
  it('the title asks it', () => {
    expect(src('../screens/Title.svelte')).toContain('if (game.modalOpen || !startsTheGame(e)) return;');
  });
});

describe('New player: Enter on a button is the button\'s', () => {
  it('a button is told apart from the name box and the page', () => {
    expect(onButton({ target: new FakeButton() as EventTarget })).toBe(true);
    expect(onButton({ target: new FakeInput() as EventTarget })).toBe(false);
    expect(onButton({ target: null })).toBe(false);
  });
  it('with no browser around (a test, the server), nothing is a button', () => {
    vi.unstubAllGlobals();
    expect(onButton({ target: new FakeButton() as EventTarget })).toBe(false);
  });
  const np = src('../screens/NewPlayer.svelte');
  it('the window\'s Enter goes on at the buddies and at "Almost ready!" only when no button has it', () => {
    expect(np).toContain("const enter = e.key === 'Enter' && !onButton(e);");
    expect(np).toContain('if (enter) next();');
    expect(np).toContain('} else if (step === 3 && enter) finish();');
    // (it ran finish() before the focused "I'm a grown-up" card's own click could choose it)
    expect(np).not.toMatch(/e\.key === 'Enter'\) (next|finish)\(\)/);
  });
  it('Enter in the name box still goes on; the cards and "That\'s my buddy!" go by their own click', () => {
    expect(np).toMatch(/if \(e\.key === 'Enter'\) \{\s*e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*if \(name\.trim\(\)\) next\(\);/);
    expect(np).toContain('onclick={next}>That\'s my buddy!</button>');
    expect(np).toContain('onclick={() => (grown = true)}');
  });
});
