// A Learn lesson's Pause: the lesson stops right then, and Keep going carries it on from the same point
// (lessonPause.ts). The narrator's part is held by "a lesson's Pause stills the narrator" in audio/away.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const voice = vi.hoisted(() => ({ holds: 0, resumes: [] as boolean[] }));
vi.mock('../../audio/voice.svelte', () => ({
  holdVoice: () => { voice.holds++; },
  resumeVoice: (carryOn = true) => { voice.resumes.push(carryOn); },
}));
import { lessonPause } from './lessonPause';

beforeEach(() => { vi.useFakeTimers(); voice.holds = 0; voice.resumes = []; });
afterEach(() => { vi.useRealTimers(); });
const P0 = () => lessonPause(() => Date.now());

describe("a lesson's Pause", () => {
  it('holds the narrator once and carries it on once', () => {
    const P = P0();
    P.hold(); P.hold();
    expect([P.held, voice.holds]).toEqual([true, 1]);
    P.carryOn(); P.carryOn();
    expect([P.held, voice.resumes]).toEqual([false, [true]]);
  });
  it("the world's clock stands still while paused and goes on from where it stopped", () => {
    const P = P0();
    expect(P.clock(0.016, 10)).toEqual([0.016, 10]);
    P.hold();
    expect(P.clock(0.5, 10.5)).toEqual([0, 10]);
    expect(P.clock(0.5, 11)).toEqual([0, 10]);
    P.carryOn();
    expect(P.clock(0.25, 11.25)).toEqual([0.25, 10.25]);
  });
  it("the lesson's own waits don't run out while paused", async () => {
    const P = P0();
    let done = false;
    void P.sleep(1000).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(400);
    P.hold();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(done).toBe(false);
    P.carryOn();
    await vi.advanceTimersByTimeAsync(599);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
  it('a wait asked for while paused starts at Keep going', async () => {
    const P = P0();
    P.hold();
    let done = false;
    void P.sleep(300).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(5000);
    expect(done).toBe(false);
    P.carryOn();
    await vi.advanceTimersByTimeAsync(300);
    expect(done).toBe(true);
  });
  it('a lesson left while paused: nothing it waited for carries on, and the narrator is let go silently', async () => {
    const P = P0();
    let done = false;
    void P.sleep(200).then(() => (done = true));
    P.hold();
    P.end();
    await vi.advanceTimersByTimeAsync(5000);
    expect([done, P.held, voice.resumes]).toEqual([false, false, [false]]);
  });
});

describe('the three lesson players use it', () => {
  const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
  for (const f of ['../beats/BeatEpisode.svelte', './EpisodeClassic.svelte', '../measure/MeasureEpisode.svelte']) {
    it(f.split('/').pop()!, () => {
      const s = src(f);
      expect(s).toContain('const P = lessonPause();');
      expect(s).toContain('const sleep = (ms: number) => P.sleep(ms);');
      expect(s).toContain('<PauseButton esc={false} onpause={P.hold} onresume={P.carryOn}');
      expect(s).toContain("function pauseHere() { if (!game.pause) { P.hold(); game.openPause(P.carryOn,");
      expect(s).toMatch(/update: \(dt, t\) => \{ const \[d, lt\] = P\.clock\(dt, t\); s\.update\(d, lt\);/);
      expect(s).toContain('P.end(); hush();');
      // (no wait by the wall's clock that would run out under the card)
      expect(s).not.toMatch(/const late = setTimeout/);
    });
  }
});
