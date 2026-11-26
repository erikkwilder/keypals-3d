// A lesson's spoken lines are kept on the computer while it plays, so the narrator carries on if the connection
// drops (audio/keep.ts). The player finds them by the lesson's `voice` key: the lines are ep.<voice>.*. Three of
// the four beat lessons had no key, so the player looked for ep.<lesson id>.* and kept none of their own lines
// (How Many Cookies? has no such line; for the other two that prefix is the old version's lines).
import { describe, expect, it } from 'vitest';
import { ALL_LINES } from '../../content/voice';
import { lessonClips } from '../../audio/keep';
import { BEAT_LESSONS } from './lessons';

describe("every beat lesson's own lines are the ones kept for a dropped connection", () => {
  for (const L of BEAT_LESSONS) {
    it(L.title, () => {
      const key = L.voice ?? L.id;
      const own = ALL_LINES.filter(l => l.id.startsWith(`ep.${key}.`));
      expect(own.length, `lines named ep.${key}.*`).toBeGreaterThan(10);
      const kept = new Set(lessonClips(ALL_LINES, { keys: [key] }));
      for (const l of own) expect(kept.has(l.id), l.id).toBe(true);
    });
  }
  it('the keys are the names their lines carry', () => {
    expect(Object.fromEntries(BEAT_LESSONS.map(L => [L.id, L.voice]))).toMatchObject({ 'k-count': 'count', 'frac-one-piece': 'share', 'alg-two-step': 'eq' });
  });
});
