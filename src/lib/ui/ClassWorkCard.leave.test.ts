// "Done for today" on the Class work card (read from the source: the card needs a class player to run): at the
// bottom, below the work, so a child who has finished doesn't read it as "my work is done", and big enough to
// tap on a touch screen.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('./ClassWorkCard.svelte', import.meta.url), 'utf8');
const header = src.slice(src.indexOf('<header>'), src.indexOf('</header>'));

describe('"Done for today"', () => {
  it("isn't in the card's header beside Boards, but at the bottom, below the work", () => {
    expect(header).not.toContain('Done for today');
    expect(header).toContain('>Boards</button>');
    const yay = src.indexOf('All your class work is done. Amazing!'), leave = src.indexOf('>Done for today</button>');
    expect(leave).toBeGreaterThan(yay);
    expect(leave).toBeLessThan(src.indexOf('</section>', yay));
  });
  it('keeps its words, and is at least 44 px tall on a touch screen', () => {
    expect(src).toContain(`{#if shared}<div class="leave"><button class="btn ghost sm" onclick={() => (leaving = 'ask')}>Done for today</button></div>{/if}`);
    expect(src).toMatch(/@media \(pointer: coarse\), \(max-width: 700px\) \{ \.leave \.btn \{ min-height: 44px;/);
  });
});
