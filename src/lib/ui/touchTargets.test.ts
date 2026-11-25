// A finger needs a target about 44 px tall. On a tablet the save chip was 28 px, the Today card's "0 of 10
// minutes" 25 and "For teachers" 27 (walk 4, 768x1024 and 1024x768). On a touch screen (pointer: coarse) each is
// now 44; a mouse computer's look is unchanged.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
const TARGETS: [string, string][] = [['./SaveChip.svelte', '.chip'], ['../path/TodayCard.svelte', '.mins'], ['./ClassEntry.svelte', '.tlink']];

describe('tap targets on a touch screen', () => {
  for (const [file, cls] of TARGETS) it(`${cls} in ${file.split('/').pop()} is 44 px tall for a finger, and only on a touch screen`, () => {
    const s = src(file);
    expect(s).toContain(`@media (pointer: coarse) { ${cls} { min-height: 44px; } }`);
    // its rule for every screen sets no height, so a mouse computer's look stays as it was
    const base = s.match(new RegExp(`^  \\${cls} \\{[^}]*\\}`, 'm'))![0];
    expect(base).not.toMatch(/height/);
  });
});
