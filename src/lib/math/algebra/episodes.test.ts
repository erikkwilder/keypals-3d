import { describe, expect, it } from 'vitest';
import { ALG_LESSONS, ALG_LESSON } from './episodes';
import { SETS, epLesson, isEpisode, taskFor, type Task } from '../episodes';
import { fracRight } from '../fracEpisodes';
import { SKILL_EPISODES } from '../skills/course';
import { SKILL } from '../skills/registry';
import { ALGEBRA_EPISODE_LINES } from '../../content/voice';
import manifest from '../../content/voice-manifest.json';

/** the job a step gives the hands (as the episode plays it: a step can ask just to be watched) */
const tasksOf = (id: string): Task['kind'][] => ALG_LESSON[id].steps.map((s, i, all) => (s.do === 'watch' ? 'watch' : taskFor(i ? all[i - 1].board : null, s.board).kind));

describe('Star Lab Learn episodes', () => {
  it('every algebra skill points at an episode, each one plays in the Star Lab, about an algebra skill', () => {
    const al = Object.entries(SKILL_EPISODES).filter(([skill]) => skill.startsWith('al-'));
    expect(al.length).toBe(11);
    for (const [, id] of al) expect(ALG_LESSON[id], id).toBeTruthy();
    expect(new Set(al.map(([, id]) => id))).toEqual(new Set(ALG_LESSONS.map(l => l.id)));
    for (const l of ALG_LESSONS) {
      const e = epLesson(l.id)!;
      expect(SKILL[l.skill].area, l.id).toBe('algebra');
      expect(l.set).toBe('lab');
      expect(SETS.lab.star).toBe('cometcat');
      expect(isEpisode(l.id)).toBe(true);
      expect(e.steps.length, l.id).toBe(3);
      // a real table (not a pie close-up): the episode gets a cover, and its card a painting
      expect(e.cover, l.id).toBeTruthy();
      expect(e.art, l.id).toMatch(/\.webp$/);
    }
  });
  it('every try is answered right by its own answer', () => {
    for (const l of ALG_LESSONS) for (const q of [...l.tries, l.teach.q]) {
      expect(q.ans, `${l.id}: ${q.text}`).toMatch(/^\d+$/);
      expect(fracRight(q, q.ans)).toBe(true);
      expect(q.pic.dots.length + q.pic.plates.length + (q.pic.line ? 1 : 0), `${l.id}: ${q.text} has a picture`).toBeGreaterThan(0);
    }
  });
  it("the buddy's go: three different choices with the right one, and it says its wrong answer", () => {
    for (const l of ALG_LESSONS) {
      const e = epLesson(l.id)!;
      expect(new Set(e.teach.choices).size, l.id).toBe(3);
      expect(e.teach.choices).toContain(l.teach.q.ans);
      expect(l.teach.wrong).not.toBe(l.teach.q.ans);
      expect(l.teach.says, l.id).toContain(l.teach.wrong);
    }
  });
  it('the coach has a recorded line for every story, step and card', () => {
    const ids = new Set(ALGEBRA_EPISODE_LINES.map(x => x.id)), voiced = manifest as Record<string, unknown>;
    for (const l of ALG_LESSONS) {
      for (const id of [`ep.${l.id}.intro`, `ep.${l.id}.card`, ...l.steps.map((_, i) => `ep.${l.id}.s${i}`)]) { expect(ids.has(id), id).toBe(true); expect(voiced[id], `${id} recorded`).toBeTruthy(); }
    }
  });
  it('the hands do the trick: take off both sides, share out, make the groups first, open the boxes, gather, build, hop', () => {
    expect(tasksOf('alg-balance')).toEqual(['watch', 'take', 'label']);
    expect(tasksOf('alg-two-step')).toEqual(['watch', 'take', 'move']);
    expect(tasksOf('alg-order')).toEqual(['watch', 'place', 'watch']);
    expect(tasksOf('alg-letters')).toEqual(['watch', 'tap', 'place']);
    expect(tasksOf('alg-gather')).toEqual(['watch', 'move', 'watch']);
    expect(tasksOf('alg-pattern')).toEqual(['watch', 'label', 'place']);
    expect(tasksOf('alg-ineq')).toEqual(['watch', 'hop', 'watch']);
  });
  it('taking off both sides keeps the balance level: the same number goes from each pan', () => {
    const [a, b] = ALG_LESSON['alg-balance'].steps.map(s => s.board);
    const gone = a.dots.filter(d => !b.dots.some(x => x.id === d.id));
    expect(gone.filter(d => d.id.startsWith('l')).length).toBe(gone.filter(d => d.id.startsWith('r')).length);
    expect(a.beam).toEqual({ a: 'pl', b: 'pr' });
  });
});
