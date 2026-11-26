// A Learn lesson's Pause (the Pause button, or Esc, opens the one Pause card): the lesson stops right then, and
// Keep going carries it on from the same point. Erik, 2026-11-25: "when I hit pause, it keeps talking until it gets
// to the end of its current paragraph. If I pause the lesson, I want it to actually pause right then. And then when
// I say keep going, to have it start talking again where it left off. Even if I pause it, in the middle of
// something it was saying." The card only covered the lesson: the narrator finished the line, the lesson's world
// went on moving, and its waits ran out, so the lesson went on under the card. Now three things stand still while
// it's paused: the narrator (the line stops mid-word and is carried on from there: voice.svelte.ts holdVoice), the
// lesson's world (its moves, and the waits counted on its clock: `clock`), and the lesson's own short waits by the
// wall's clock (`sleep`). Used by the three lesson players: beats/BeatEpisode, ui/EpisodeClassic and
// measure/MeasureEpisode.
import { holdVoice, resumeVoice } from '../../audio/voice.svelte';

type Nap = { left: number; at: number; timer?: ReturnType<typeof setTimeout>; go: () => void };

export function lessonPause(now: () => number = () => performance.now()) {
  let held = false, lost = 0;
  /** the wall's clock when the lesson began, how long it has been paused in all, and since when it is now */
  const began = now(); let idle = 0, heldAt = 0;
  const naps = new Set<Nap>();
  const run = (n: Nap) => { n.at = now(); n.timer = setTimeout(() => { naps.delete(n); n.go(); }, Math.max(0, n.left)); };
  return {
    /** the lesson is paused */
    get held() { return held; },
    /** Pause: the narrator stops mid-word, the world and the waits stand still */
    hold() {
      if (held) return;
      held = true;
      holdVoice();
      const t = now();
      heldAt = t;
      for (const n of naps) { clearTimeout(n.timer); n.timer = undefined; n.left -= t - n.at; }
    },
    /** Keep going: everything carries on from where it stopped */
    carryOn() {
      if (!held) return;
      held = false;
      idle += now() - heldAt;
      for (const n of naps) run(n);
      resumeVoice();
    },
    /** the lesson is closing (left from the Pause card, or done): nothing it was waiting for carries on */
    end() {
      for (const n of naps) clearTimeout(n.timer);
      naps.clear();
      if (held) { held = false; resumeVoice(false); }
    },
    /** the clock of the lesson's world, for its scene and its kit: it stands still while the lesson is paused, so
     *  its moves stop where they are and its waits don't run out. Takes the stage's step and time, gives the
     *  lesson's. */
    clock(dt: number, t: number): [number, number] {
      if (held) { lost += dt; return [0, t - lost]; }
      return [dt, t - lost];
    },
    /** milliseconds the lesson has run, not counting the time it stood paused */
    elapsed(): number { return now() - began - idle - (held ? now() - heldAt : 0); },
    /** a wait by the wall's clock that stands still while the lesson is paused */
    sleep(ms: number): Promise<void> {
      return new Promise(go => { const n: Nap = { left: ms, at: 0, go }; naps.add(n); if (!held) run(n); });
    },
  };
}
export type LessonPause = ReturnType<typeof lessonPause>;
