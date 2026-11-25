// The number pad by keyboard and by switch (numPadKeys.ts, NumPad.svelte): Tab reaches each key in order, Enter,
// Space or a switch's click press it once, and the screens that show the pad leave Enter and Space on its keys to
// the key. Typed digits, Backspace and Enter with no key focused stay the screens'.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keyName, padKey, padKeys, tabsToBottom } from './numPadKeys';

/** A button, inside a pad ([data-pad]) or not. */
class FakeButton { constructor(readonly inPad = true) {} closest(sel: string) { return sel === '[data-pad]' && this.inPad ? {} : null; } }
/** Something in the pad that isn't a button (its row, a gap between keys). */
class FakeDiv { closest(sel: string) { return sel === '[data-pad]' ? {} : null; } }
const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
const key = (k: string, on: object | null = null) => ({ key: k, target: on as EventTarget | null });

beforeEach(() => vi.stubGlobal('HTMLButtonElement', FakeButton));
afterEach(() => vi.unstubAllGlobals());

describe('the keys, in the order Tab reaches them', () => {
  it('the digits 1 to 9 and 0, then Erase', () => {
    expect(padKeys()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'back']);
  });
  it('the decimal point and the minus key come after the digits, and Erase last', () => {
    expect(padKeys(['.', '-'])).toEqual([...'1234567890'.split(''), '.', '-', 'back']);
    expect(padKeys(['-']).slice(-3)).toEqual(['0', '-', 'back']);
  });
});

describe('what a screen reader calls each key', () => {
  it('a digit by itself, then Point, Minus and Erase', () => {
    expect(['7', '0', '.', '-', 'back'].map(keyName)).toEqual(['7', '0', 'Point', 'Minus', 'Erase']);
  });
});

describe("Enter or Space on a key of a pad is the key's own", () => {
  it('Enter and Space on a key: the key types or erases through its click', () => {
    expect(padKey(key('Enter', new FakeButton()))).toBe(true);
    expect(padKey(key(' ', new FakeButton()))).toBe(true);
  });
  it("a digit or Backspace typed while a key has the focus stays the screen's, as typing always was", () => {
    for (const k of ['7', '0', 'Backspace', 'Delete', 'Tab', 'Escape']) expect(padKey(key(k, new FakeButton())), k).toBe(false);
  });
  it("Enter on a button outside the pad (Pause, Go, Check) stays the screen's, as it was", () => {
    expect(padKey(key('Enter', new FakeButton(false)))).toBe(false);
    expect(padKey(key(' ', new FakeButton(false)))).toBe(false);
  });
  it('Enter with nothing focused (a child typing) answers as before, and so does Enter on a part of the pad that is no key', () => {
    expect(padKey(key('Enter'))).toBe(false);
    expect(padKey(key('Enter', new FakeDiv()))).toBe(false);
  });
});

describe("the fraction pad's Tab", () => {
  it('goes from the top box to the bottom one once the top is typed, and stays on a bottom box not typed yet, as before', () => {
    expect(tabsToBottom(key('Tab'), 'n', '3', '')).toBe(true);
    expect(tabsToBottom(key('Tab'), 'd', '3', '')).toBe(true);
  });
  it("a first Tab before anything is typed, a Tab on a typed bottom box, or a Tab on a button is the browser's: it moves on to the pad's keys", () => {
    expect(tabsToBottom(key('Tab'), 'n', '', '')).toBe(false);
    expect(tabsToBottom(key('Tab'), 'd', '3', '4')).toBe(false);
    expect(tabsToBottom(key('Tab', new FakeButton()), 'n', '3', '')).toBe(false);
    expect(tabsToBottom(key('Tab', new FakeButton()), 'd', '3', '')).toBe(false);
  });
  it("other keys aren't its Tab", () => {
    expect(tabsToBottom(key('Enter'), 'n', '3', '')).toBe(false);
  });
});

describe("the pad's markup (NumPad.svelte)", () => {
  const pad = src('./NumPad.svelte');
  it("no key is kept out of Tab's reach", () => {
    expect(pad).not.toMatch(/tabindex/);
  });
  it('the keys go in padKeys order, each named by keyName, all inside [data-pad]', () => {
    expect(pad).toMatch(/const keys = \$derived\(padKeys\(extra\)\)/);
    expect(pad).toMatch(/aria-label=\{keyName\(k\)\}/);
    expect(pad).toMatch(/role="group" aria-label="Number pad"[^>]*data-pad>/);
  });
  it("a click with no pointer behind it (count 0) presses the key; a tap's own click (count 1) is left alone", () => {
    expect(pad).toMatch(/onclick=\{\(e\) => keyed\(k, e\)\}/);
    expect(pad).toMatch(/if \(e\.detail !== 0 \|\| disabled\) return;\n\s*if \(k === 'back'\) onback\(\); else ondigit\(k\);/);
    // a tap still works as it did: a digit on lifting the finger (or a drag into a box), Erase at once
    expect(pad).toMatch(/onpointerdown=\{\(e\) => down\(k, e\)\} onpointermove=\{move\} onpointerup=\{up\} onpointercancel=\{cancel\}/);
  });
  it('a held Enter presses a key once', () => {
    expect(pad).toMatch(/if \(e\.repeat && e\.key === 'Enter'\) e\.preventDefault\(\);/);
    expect(pad).toMatch(/onkeydown=\{held\}/);
  });
  it("a phone's calculator block still shows Erase beside the 0 (by CSS order)", () => {
    expect(pad).toMatch(/\.compact \.k\.back \{ order: 10; \}/);
    expect(pad).toMatch(/\.compact \.k\.zero \{ order: 11;/);
    expect(pad).toMatch(/\.compact \.k\.x \{ order: 12; \}/);
  });
  it("turns no outline off, so the game's focus ring shows on a key", () => {
    expect(pad).not.toMatch(/outline:\s*(none|0)/);
  });
});

describe('the screens that show the pad leave Enter and Space on its keys to them', () => {
  // each screen's key handler asks padKey before its own Enter (to answer) or Space
  const before: [string, string][] = [
    ['./EpisodeClassic.svelte', "if (e.key === 'Enter' || e.key === ' ') return mine(primary);"],
    ['../beats/BeatEpisode.svelte', "if (begin) { if (e.key === 'Enter' || e.key === ' ')"],
    ['../measure/MeasureEpisode.svelte', "if (e.key === 'Enter' || e.key === ' ') return mine(primary);"],
    ['../skills/ui/SkillInput.svelte', "else if (e.key === 'Enter') { e.preventDefault(); submitNumber(); }"],
    ['../skills/ui/FractionPad.svelte', "else if (e.key === 'Enter') { e.preventDefault(); clear();"],
    ['../../arcade/ui/TowerStack.svelte', "if (e.key === ' ' || e.key === 'ArrowDown')"],
    ['../../screens/MathRun.svelte', "if (e.key === 'Enter' && typed && !bad)"],
    ['../../screens/BalanceBeam.svelte', "else if (e.key === 'Enter') { e.preventDefault(); submit(); }"],
    ['../../screens/Battle.svelte', "else if (ui === 'block' && blkSigned && e.key === 'Enter')"],
  ];
  for (const [f, enter] of before) {
    it(f.split('/').pop()!, () => {
      const s = src(f), at = s.indexOf('if (padKey(e)) return;') >= 0 ? s.indexOf('if (padKey(e)) return;') : s.indexOf('|| padKey(e)) return;');
      expect(at, 'asks padKey').toBeGreaterThan(0);
      expect(s.indexOf(enter), 'its Enter').toBeGreaterThan(at);
    });
  }
  it('the inputs that already leave Enter and Space on any button to it (Round F and G) still do', () => {
    for (const f of ['../shapes/ui/Protractor.svelte', '../skills/ui/BalanceInput.svelte', '../skills/ui/DoubleLine.svelte', '../skills/ui/RatioTable.svelte', '../skills/ui/PercentBar.svelte'])
      expect(src(f), f).toMatch(/\|\| buttonKey\(e\)\) return;/);
  });
});

describe('the answer keys next to the pad are reached by Tab and pressed by keyboard or switch', () => {
  it("practice's Check (decimals and minus numbers)", () => {
    expect(src('../skills/ui/SkillInput.svelte')).toMatch(/<button class="ok" disabled=\{!text \|\| bad \|\| disabled\} \{\.\.\.press\(submitNumber\)\}>/);
  });
  it("the fraction pad's Top, Bottom and Check, which say which box is being filled", () => {
    const fp = src('../skills/ui/FractionPad.svelte');
    expect(fp).not.toMatch(/tabindex/);
    expect(fp).toMatch(/<div class="fpad" class:compact data-pad>/);
    expect(fp).toMatch(/aria-pressed=\{focus === 'n'\} \{\.\.\.press\(\(\) => go\('n'\)\)\}/);
    expect(fp).toMatch(/aria-pressed=\{focus === 'd'\} \{\.\.\.press\(\(\) => go\('d'\)\)\}/);
    expect(fp).toMatch(/<button class="ok" class:ready disabled=\{!ready \|\| disabled\} \{\.\.\.press\(/);
    expect(fp).toMatch(/tabsToBottom\(e, focus, n, d\)\) \{ e\.preventDefault\(\); go\('d'\); \}/);
  });
  it("the battle's Check for an answer below zero", () => {
    expect(src('../../screens/Battle.svelte')).toMatch(/<button class="okbtn" disabled=\{[^}]*\} \{\.\.\.press\(checkBlock\)\}>/);
  });
});
