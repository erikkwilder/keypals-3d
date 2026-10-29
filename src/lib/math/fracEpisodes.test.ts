import { describe, expect, it } from 'vitest';
import { FRAC_LESSONS, FRAC_LESSON, fracRight } from './fracEpisodes';
import { SETS, epLesson, isEpisode, taskFor, type Task } from './episodes';
import { SKILL_EPISODES } from './skills/course';
import { FRACTION_LINES } from '../content/voice';
import manifest from '../content/voice-manifest.json';

/** the job a step gives the hands (as the episode plays it: a step can ask just to be watched) */
const tasksOf = (id: string): Task['kind'][] => FRAC_LESSON[id].steps.map((s, i, all) => (s.do === 'watch' ? 'watch' : taskFor(i ? all[i - 1].board : null, s.board).kind));

describe('Fractions Learn episodes', () => {
  it('every fraction skill has its episode, in a place, playable as an episode', () => {
    const ids = Object.values(SKILL_EPISODES);
    expect(ids).toHaveLength(11);
    expect(FRAC_LESSONS.map(l => l.id).sort()).toEqual([...ids].sort());
    for (const [skill, id] of Object.entries(SKILL_EPISODES)) {
      const l = FRAC_LESSON[id], e = epLesson(id);
      expect(l.skill, id).toBe(skill);
      expect(SETS[l.set], id).toBeTruthy();
      expect(isEpisode(id)).toBe(true);
      expect(e?.steps.length, id).toBeGreaterThanOrEqual(3);
      expect(e?.art, id).toMatch(/^learn\/frac\/card-.+\.webp$/);
    }
  });

  it('every try is answered right by its own answer, and only an equal fraction counts as well', () => {
    for (const l of FRAC_LESSONS) {
      for (const q of [...l.tries, l.teach.q]) {
        expect(q.ans, `${l.id}: ${q.text}`).toMatch(q.input === 'frac' ? /^\d+\/\d+$/ : /^\d+$/);
        expect(fracRight(q, q.ans), `${l.id}: ${q.text}`).toBe(true);
        expect(fracRight(q, '0'), `${l.id}: ${q.text}`).toBe(false);
        expect(q.pic.dots.length + q.pic.plates.length + (q.pic.line ? 1 : 0), `${l.id}: ${q.text} has a picture`).toBeGreaterThan(0);
      }
    }
    const half = { text: '1/2 = ?', ans: '2/4', input: 'frac' as const, hint: '', hidden: '', pic: FRAC_LESSONS[0].tries[0].pic };
    expect(fracRight(half, '2/4')).toBe(true);
    expect(fracRight(half, '1/2')).toBe(false);
    expect(fracRight({ ...half, equiv: true }, '1/2')).toBe(true);
    expect(fracRight({ ...half, equiv: true }, '1/3')).toBe(false);
  });

  it("the buddy's go: three different choices with the right one, and it says its wrong answer", () => {
    for (const l of FRAC_LESSONS) {
      const e = epLesson(l.id)!;
      expect(new Set(e.teach.choices).size, l.id).toBe(3);
      expect(e.teach.choices, l.id).toContain(l.teach.q.ans);
      expect(e.teach.choices, l.id).toContain(l.teach.wrong);
      expect(l.teach.wrong, l.id).not.toBe(l.teach.q.ans);
      expect(fracRight(l.teach.q, l.teach.wrong), l.id).toBe(false);
      expect(l.teach.says, l.id).toContain(l.teach.wrong);
    }
  });

  it('the coach has a voiced line for every story, step and card', () => {
    const ids = new Set(FRACTION_LINES.map(x => x.id));
    const voiced = manifest as Record<string, unknown>;
    for (const l of FRAC_LESSONS) {
      const want = [`ep.${l.id}.intro`, `ep.${l.id}.card`, ...l.steps.map((_, i) => `ep.${l.id}.s${i}`)];
      for (const id of want) { expect(ids.has(id), id).toBe(true); expect(voiced[id], `${id} recorded`).toBeTruthy(); }
      expect(ids.has(`ep.${l.id}.s${l.steps.length}`), `${l.id}: no extra step line`).toBe(false);
    }
  });

  it('each step gives the hands a job, and a picture that changes kind is just watched', () => {
    expect(tasksOf('frac-parts')).toEqual(['watch', 'move', 'label']);
    expect(tasksOf('frac-number-line')).toEqual(['watch', 'hop', 'hop', 'hop']);
    for (const l of FRAC_LESSONS) {
      const kinds = tasksOf(l.id);
      expect(kinds[0], l.id).toBe('watch');
      expect(kinds.filter(k => k !== 'watch').length, `${l.id} has hands-on steps`).toBeGreaterThanOrEqual(1);
      // whatever the hands touch (a counter, or a word to put down) is in the picture
      l.steps.forEach((s, i) => {
        if (!i || s.do === 'watch') return;
        const t = taskFor(l.steps[i - 1].board, s.board);
        const there = (id: string) => [...s.board.dots, ...s.board.tags, ...l.steps[i - 1].board.dots].some(d => d.id === id);
        if ('ids' in t) for (const id of t.ids) expect(there(id), `${l.id} s${i}: ${id}`).toBe(true);
      });
    }
  });

  it('a slice is drawn where its own part of the whole pie is', () => {
    for (const l of FRAC_LESSONS) for (const s of l.steps) for (const d of s.board.dots) {
      if (d.shape?.k !== 'wedge') continue;
      expect(d.shape.i, `${l.id} ${d.id}`).toBeLessThan(d.shape.n);
      expect(d.shape.r, `${l.id} ${d.id}`).toBeGreaterThan(0);
    }
  });
});
