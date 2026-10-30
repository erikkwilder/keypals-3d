// The Data and chance episodes: each one plays in the shared episode (epLesson), every step but the
// watched ones gives the kid's hands something to do, every line the coach says exists, and the buddy's
// mistake is one of the three answers to fix it with.
import { describe, expect, it } from 'vitest';
import { epLesson, isEpisode, taskFor, SETS } from '../episodes';
import { DATA_EPISODE_LINES } from '../../content/voice';
import { SKILL_EPISODES } from '../skills/course';
import { SKILL } from '../skills/registry';
import { DATA_LESSONS } from './episodes';

describe('data and chance episodes', () => {
  it('play at the fair booth, each with a skill, voice lines for every step, and hands-on steps', () => {
    const lines = new Set(DATA_EPISODE_LINES.map(l => l.id));
    expect(DATA_LESSONS.length).toBeGreaterThanOrEqual(5);
    for (const l of DATA_LESSONS) {
      expect(isEpisode(l.id)).toBe(true);
      const ep = epLesson(l.id)!;
      expect(ep.set).toBe('fair');
      expect(SETS[ep.set].star).toBe('popcornpuff');
      expect(SKILL[l.skill]?.area).toBe('data');
      for (const k of ['intro', 'card', ...l.steps.map((_, i) => `s${i}`)]) expect(lines.has(`ep.${l.id}.${k}`), `${l.id} ${k}`).toBe(true);
      l.steps.forEach((s, i) => {
        if (i === 0 || s.do === 'watch') return;
        expect(taskFor(l.steps[i - 1].board, s.board).kind, `${l.id} step ${i}`).not.toBe('watch');
      });
      expect(ep.teach.choices).toContain(ep.teach.q.ans);
      expect(ep.teach.choices).toContain(ep.teach.wrong);
      expect(new Set(ep.teach.choices).size).toBe(3);
    }
  });
  it('every data skill points at one of them', () => {
    for (const s of Object.values(SKILL).filter(x => x.area === 'data')) expect(DATA_LESSONS.map(l => l.id), s.id).toContain(SKILL_EPISODES[s.id]);
  });
});
