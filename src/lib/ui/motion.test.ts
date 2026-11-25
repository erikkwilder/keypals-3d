// The computer's reduce-motion setting counts, not only the game's own "Less motion": a child who gets sick
// or distracted from motion says so once, in the computer's settings, for every app and site. Before, only
// the FancyAnt film read it (motion.svelte.ts).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const settings = vi.hoisted(() => ({ reducedMotion: false }));
vi.mock('../state/game.svelte', () => ({ game: { get settings() { return settings; } } }));

/** the computer's reduce-motion setting, which the test changes as a person would in the computer's settings */
function computerAsks(asks: boolean) {
  const heard: ((e: { matches: boolean }) => void)[] = [];
  const list = { matches: asks, addEventListener: (type: string, f: (e: { matches: boolean }) => void) => { if (type === 'change') heard.push(f); } };
  vi.stubGlobal('matchMedia', (q: string) => { expect(q).toBe('(prefers-reduced-motion: reduce)'); return list; });
  return (now: boolean) => { list.matches = now; heard.forEach(f => f({ matches: now })); };
}
async function load() { vi.resetModules(); return (await import('./motion.svelte')).motion; }
afterEach(() => { vi.unstubAllGlobals(); settings.reducedMotion = false; });

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('less motion', () => {
  it("is off when neither the game's own setting nor the computer asks for it", async () => {
    computerAsks(false);
    const motion = await load();
    expect([motion.computer, motion.reduced]).toEqual([false, false]);
  });

  it("is on when the game's own Less motion is ticked", async () => {
    computerAsks(false);
    const motion = await load();
    settings.reducedMotion = true;
    expect([motion.computer, motion.reduced]).toEqual([false, true]);
  });

  it("is on when the computer asks for less motion, whatever the game's own setting", async () => {
    computerAsks(true);
    const motion = await load();
    expect([motion.computer, motion.reduced]).toEqual([true, true]);
    expect(settings.reducedMotion).toBe(false); // the game's own setting is left as it was
  });

  it('follows the computer as its setting changes, without a reload', async () => {
    const change = computerAsks(false);
    const motion = await load();
    change(true);
    expect(motion.reduced).toBe(true);
    change(false);
    expect(motion.reduced).toBe(false);
  });

  it('works where there is no matchMedia at all', async () => {
    const motion = await load();
    expect(motion.reduced).toBe(false);
  });

  it("the page's data-motion, Home's live buddy and the FancyAnt film go by it", () => {
    const app = read('../../App.svelte');
    expect(app).toContain("document.documentElement.dataset.motion = motion.reduced ? 'reduced' : 'full';");
    expect(app).not.toMatch(/s\.reducedMotion \? 'reduced'/);
    expect(read('../fun/FunLayer.svelte')).toContain('quiet: () => motion.reduced');
    expect(read('../fun/liveBuddy.ts')).toMatch(/this\.quiet\(\) \? \[\]/); // asked at each move, so it's live
    const intro = read('./FancyAntIntro.svelte');
    expect(intro).toContain('motion.reduced');
    expect(intro).not.toContain('matchMedia(');
  });

  it('Settings shows Less motion ticked and not changeable when the computer asks, and says why', () => {
    const s = read('../screens/Settings.svelte');
    expect(s).toContain('disabled={motion.computer} checked={s.reducedMotion || motion.computer}');
    expect(s).toContain('{#if motion.computer}<p class="hint">Your computer asks for less motion.</p>{/if}');
  });
});
