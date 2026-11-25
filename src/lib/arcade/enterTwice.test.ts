// A wrong answer typed in Tower Stack or Balance Beam is checked as its last digit goes in, and stays on screen
// a moment (1.1 s, 0.65 s). An Enter pressed then, as many children do after typing, checked the same digits
// again: Tower Stack marked the answer wrong twice, Balance Beam counted a second try (its second hint came at
// once and the beam tipped further). Now the check waits until the wrong answer has gone.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

describe('Enter after a wrong answer is not a second answer', () => {
  it('Tower Stack: no check while the wrong answer shows (busy)', () => {
    expect(src('./ui/TowerStack.svelte')).toMatch(/function check\(\) \{\n[^\n]*\n\s*if \(!fact \|\| !scene \|\| unlocked \|\| busy\) return;/);
  });
  it('Balance Beam: no submit while the wrong answer shows (bad)', () => {
    expect(src('../screens/BalanceBeam.svelte')).toMatch(/function submit\(\) \{\n[^\n]*\n\s*if \(phase !== 'play' \|\| !z \|\| solved \|\| !typed \|\| bad\) return;/);
  });
});
