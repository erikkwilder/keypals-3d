// The buddy row on New player fits the screen at every width: at 768 (an upright iPad) it ran from -37 to
// 805 px, because only phones (below 440 px) had smaller buddies (buddyFit.ts).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buddyFit, rowWidth, BUDDY_BORDER } from './buddyFit';

// New player's padding at the sides: 30 px, and 16 px at 440 px wide and below
const room = (w: number) => w - 2 * (w <= 440 ? 16 : 30);
const src = readFileSync(new URL('./NewPlayer.svelte', import.meta.url), 'utf8');

describe('the buddy row on New player', () => {
  it('fits inside the screen at every width from 320 up', () => {
    for (let w = 320; w <= 2560; w++) expect(rowWidth(buddyFit(w)), `${w} px wide`).toBeLessThanOrEqual(room(w));
  });

  it('keeps 110 px buddies wherever they fit: six in a row where six fit, otherwise three to a row', () => {
    for (const w of [1366, 1280, 1024, 902]) expect(buddyFit(w), `${w}`).toMatchObject({ cols: 6, size: 110 });
    for (const w of [901, 820, 768, 600, 476]) expect(buddyFit(w), `${w}`).toMatchObject({ cols: 3, size: 110 });
    expect(rowWidth(buddyFit(1366))).toBe(842);
    expect(rowWidth(buddyFit(768))).toBe(416);
  });

  it("keeps the phone layout at 390 and 360: three to a row, 80 px buddies, 298 px wide", () => {
    for (const w of [390, 360]) {
      expect(buddyFit(w)).toEqual({ cols: 3, size: 80, gap: 8, padX: 4 });
      expect(rowWidth(buddyFit(w))).toBe(298);
    }
  });

  it('is smaller only where 80 px buddies do not fit, and never jumps up as the screen narrows on a phone', () => {
    expect(buddyFit(320).size).toBe(76);
    for (let w = 321; w <= 440; w++) expect(buddyFit(w).size).toBeGreaterThanOrEqual(buddyFit(w - 1).size);
  });

  it('NewPlayer.svelte draws the buddies by it, with the padding and border it counts on', () => {
    expect(src).toMatch(/buddyFit\(/);
    expect(src).toMatch(/size=\{fit\.size\}/);
    expect(src).toMatch(/style:--cols=\{fit\.cols\}/);
    expect(src).not.toMatch(/vw < 440 \? 80 : 110/);
    expect(src).not.toMatch(/max-width: 760px/);
    expect(src).toMatch(/\.np \{[^}]*padding: 30px;/);
    expect(src).toMatch(/@media \(max-width: 440px\) \{ \.np \{ padding-left: 16px; padding-right: 16px; \}/);
    expect(src).toMatch(new RegExp(`\\.buddy \\{[^}]*border: ${BUDDY_BORDER}px solid transparent;[^}]*padding: 10px var\\(--bx\\) 8px;`));
  });
});
