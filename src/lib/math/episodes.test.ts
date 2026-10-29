import { describe, expect, it } from 'vitest';
import { answerOf } from './facts';
import { LESSONS, checkDue, finishLesson, markChecked } from './learn';
import { EPISODE, SETS, fixChoices, taskFor, type Task } from './episodes';
import { EPISODE_LINES } from '../content/voice';
import { mathOf } from './progress';
import type { Profile } from '../engine/profile';

describe('Learn episodes', () => {
  it('every lesson has an episode in a place, with a wrong answer the trick fixes', () => {
    for (const l of LESSONS) {
      const e = EPISODE[l.id];
      expect(e, l.id).toBeTruthy();
      expect(SETS[e.set]).toBeTruthy();
      const choices = fixChoices(e);
      expect(new Set(choices).size, l.id).toBe(3);
      expect(choices).toContain(answerOf(e.teach.f));
      expect(choices).toContain(e.teach.wrong);
      expect(e.teach.wrong).not.toBe(answerOf(e.teach.f));
      expect(e.teach.says, l.id).toMatch(String(e.teach.wrong));
    }
  });

  it('the coach has a line for every story, step and card', () => {
    const ids = new Set(EPISODE_LINES.map(x => x.id));
    for (const g of ['ep.teach', 'ep.fix', 'ep.fixed', 'ep.again', 'ep.turn', 'ep.turn2', 'ep.tomorrow', 'ep.check', 'ep.checked']) expect(ids.has(g), g).toBe(true);
    for (const l of LESSONS) {
      expect(ids.has(`ep.${l.id}.intro`), l.id).toBe(true);
      expect(ids.has(`ep.${l.id}.card`), l.id).toBe(true);
      l.steps.forEach((_, i) => expect(ids.has(`ep.${l.id}.s${i}`), `${l.id} s${i}`).toBe(true));
      expect(ids.has(`ep.${l.id}.s${l.steps.length}`), `${l.id}: no extra step line`).toBe(false);
    }
  });

  it('each step gives the hands a job that matches the next picture', () => {
    const kinds = new Set<Task['kind']>();
    for (const l of LESSONS) {
      l.steps.forEach((s, i) => {
        const prev = i ? l.steps[i - 1].board : null;
        const t = taskFor(prev, s.board);
        kinds.add(t.kind);
        const next = new Map(s.board.dots.map(d => [d.id, d]));
        if (t.kind === 'place' || t.kind === 'move') for (const id of t.ids) expect(next.get(id)?.c, `${l.id} s${i} ${id}`).not.toBe('ghost');
        if (t.kind === 'take') for (const id of t.ids) expect(prev!.dots.some(d => d.id === id), `${l.id} s${i}`).toBe(true);
        if ('by' in t) expect(t.by).toBeGreaterThan(0);
        if (t.kind === 'hop') expect(t.hops.length).toBeGreaterThan(0);
      });
    }
    // every kind of job turns up somewhere
    expect([...kinds].sort()).toEqual(expect.arrayContaining(['hop', 'move', 'place', 'take', 'watch']));
  });

  it('a trick comes back for a quick check the next day, once', () => {
    const p = { math: undefined, adventure: undefined } as unknown as Profile;
    const day1 = new Date(2026, 9, 28, 10).getTime(), day2 = new Date(2026, 9, 29, 9).getTime();
    finishLesson(p, 'doubles', day1);
    expect(checkDue(mathOf(p), day1)).toBeNull();
    expect(checkDue(mathOf(p), day2)?.id).toBe('doubles');
    markChecked(p, 'doubles');
    expect(checkDue(mathOf(p), day2)).toBeNull();
    // learned again later: still checked
    finishLesson(p, 'doubles', day2);
    expect(checkDue(mathOf(p), day2 + 86400000)).toBeNull();
  });
});
