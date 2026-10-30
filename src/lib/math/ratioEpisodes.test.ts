import { describe, expect, it } from 'vitest';
import { RATIO_LESSONS, RATIO_LESSON } from './ratioEpisodes';
import { fracRight } from './fracEpisodes';
import { SETS, epLesson, isEpisode, taskFor, type Task } from './episodes';
import { SKILL_EPISODES } from './skills/course';
import { SKILL } from './skills/registry';
import { RATIO_LINES } from '../content/voice';
import manifest from '../content/voice-manifest.json';

const tasksOf = (id: string): Task['kind'][] => RATIO_LESSON[id].steps.map((s, i, all) => (s.do === 'watch' ? 'watch' : taskFor(i ? all[i - 1].board : null, s.board).kind));

describe('Ratios and percents Learn episodes', () => {
  it('seven episodes at the Jungle Juice Bar, each teaching a ratios skill, each linked from its skill', () => {
    expect(RATIO_LESSONS.length).toBe(7);
    for (const l of RATIO_LESSONS) {
      expect(l.set).toBe('juice');
      expect(SKILL[l.skill]?.area, l.id).toBe('ratios');
      expect(isEpisode(l.id)).toBe(true);
      const e = epLesson(l.id)!;
      expect(e.steps.length).toBeGreaterThanOrEqual(4);
      expect(e.art).toMatch(/^learn\/ratio\/card-.+\.webp$/);
    }
    expect(SETS.juice.backdrop).toBe('learn/ep/set-juice.webp');
    const linked = new Set(Object.entries(SKILL_EPISODES).filter(([s]) => s.startsWith('rt-')).map(([, id]) => id));
    for (const l of RATIO_LESSONS) expect(linked.has(l.id), l.id).toBe(true);
    for (const id of linked) expect(RATIO_LESSON[id], id).toBeTruthy();
  });
  it('every try and the buddy\'s question is answered by its own answer, with a picture', () => {
    for (const l of RATIO_LESSONS) for (const q of [...l.tries, l.teach.q]) {
      expect(q.ans, `${l.id}: ${q.text}`).toMatch(/^\d+$/);
      expect(fracRight(q, q.ans)).toBe(true);
      expect(q.pic.dots.length + q.pic.plates.length + (q.pic.line ? 1 : 0), `${l.id}: ${q.text}`).toBeGreaterThan(0);
    }
  });
  it("the buddy's go: three different choices with the right one, and it says its wrong answer", () => {
    for (const l of RATIO_LESSONS) {
      const e = epLesson(l.id)!;
      expect(new Set(e.teach.choices).size, l.id).toBe(3);
      expect(e.teach.choices).toContain(l.teach.q.ans);
      expect(l.teach.says, l.id).toContain(l.teach.wrong);
      expect(l.teach.wrong).not.toBe(l.teach.q.ans);
    }
  });
  it('the coach has a recorded line for every story, step and card', () => {
    const ids = new Set(RATIO_LINES.map(x => x.id)), voiced = manifest as Record<string, unknown>;
    for (const l of RATIO_LESSONS) {
      for (const id of [`ep.${l.id}.intro`, `ep.${l.id}.card`, ...l.steps.map((_, i) => `ep.${l.id}.s${i}`)]) { expect(ids.has(id), id).toBe(true); expect(voiced[id], `${id} recorded`).toBeTruthy(); }
      expect(ids.has(`ep.${l.id}.s${l.steps.length}`)).toBe(false);
    }
  });
  it('each step gives the hands a job the voice line asks for, on fruit that is there', () => {
    expect(tasksOf('rt-for-every')).toEqual(['watch', 'place', 'place', 'label']);
    expect(tasksOf('rt-two-lines')).toEqual(['watch', 'hop', 'hop', 'hop']);
    expect(tasksOf('rt-one-each')).toEqual(['watch', 'move', 'tap', 'place']);
    expect(tasksOf('rt-out-of-100')).toEqual(['watch', 'tap', 'tap', 'label']);
    expect(tasksOf('rt-percent-of')).toEqual(['watch', 'move', 'tap', 'tap']);
    expect(tasksOf('rt-percent-off')).toEqual(['watch', 'tap', 'take', 'label']);
    const say: Record<Task['kind'], RegExp> = { place: /drag/i, move: /drag/i, tap: /tap/i, take: /tap/i, label: /tap/i, hop: /tap|hop/i, watch: /./ };
    for (const l of RATIO_LESSONS) {
      tasksOf(l.id).forEach((k, i) => {
        const line = RATIO_LINES.find(x => x.id === `ep.${l.id}.s${i}`)!.text;
        expect(line, `${l.id} s${i} (${k})`).toMatch(say[k]);
        if (!i) return;
        const t = taskFor(l.steps[i - 1].board, l.steps[i].board);
        const there = (id: string) => [...l.steps[i].board.dots, ...l.steps[i].board.tags, ...l.steps[i - 1].board.dots].some(d => d.id === id);
        if ('ids' in t) for (const id of t.ids) expect(there(id), `${l.id} s${i}: ${id}`).toBe(true);
      });
      // the counters are the jungle's fruit (or coins)
      for (const s of l.steps) for (const d of s.board.dots) expect(d.shape?.k, `${l.id} ${d.id}`).toBe('fruit');
    }
  });
});
