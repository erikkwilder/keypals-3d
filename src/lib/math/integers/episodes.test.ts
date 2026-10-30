// The negative numbers Learn episodes: every skill of the area points at one, each plays in the Ice Cave
// Chart Room with a voiced line for every step, its hands-on steps are hops on the plank or coins on the
// map, the answers can be typed with the minus key, and the buddy's mistake is a real one.
import { describe, expect, it } from 'vitest';
import { NEG_LESSONS, NEG_LESSON } from './episodes';
import { SETS, epLesson, isEpisode, taskFor, type Task } from '../episodes';
import { SKILL_EPISODES } from '../skills/course';
import { SKILL } from '../skills/registry';
import { NEGATIVE_LINES } from '../../content/voice';
import manifest from '../../content/voice-manifest.json';

const tasksOf = (id: string): Task['kind'][] => NEG_LESSON[id].steps.map((s, i, all) => (s.do === 'watch' ? 'watch' : taskFor(i ? all[i - 1].board : null, s.board).kind));

describe('Negative numbers Learn episodes', () => {
  it('seven episodes, and every skill of the area points at one of them', () => {
    expect(NEG_LESSONS.length).toBe(7);
    const neg = Object.entries(SKILL_EPISODES).filter(([s]) => s.startsWith('in-'));
    expect(neg.length).toBe(11);
    for (const [skill, id] of neg) { expect(NEG_LESSON[id], `${skill} → ${id}`).toBeTruthy(); expect(SKILL[skill]).toBeTruthy(); }
    for (const l of NEG_LESSONS) {
      const e = epLesson(l.id)!;
      expect(isEpisode(l.id)).toBe(true);
      expect(e.set).toBe('frost'); expect(SETS.frost.backdrop).toMatch(/set-frost/);
      expect(e.minus).toBe(true);
      expect(e.art, l.id).toMatch(/^learn\/int\/card-.+\.webp$/);
      expect(SKILL[l.skill], l.id).toBeTruthy();
    }
  });
  it('every answer is a whole number that can be typed (a minus sign first if it needs one)', () => {
    for (const l of NEG_LESSONS) for (const q of [...l.tries, l.teach.q]) {
      expect(q.ans, `${l.id}: ${q.text}`).toMatch(/^-?\d+$/);
      expect(q.input).toBe('num');
      expect(q.hint.length).toBeGreaterThan(5);
      expect(q.pic.line || q.pic.chart, `${l.id}: ${q.text} has a picture`).toBeTruthy();
    }
    // most of them below zero: the minus key is really needed
    expect(NEG_LESSONS.flatMap(l => l.tries).filter(q => q.ans.startsWith('-')).length).toBeGreaterThanOrEqual(12);
  });
  it("the buddy's go: three different choices with the right one, and it says its wrong answer", () => {
    for (const l of NEG_LESSONS) {
      const e = epLesson(l.id)!;
      expect(new Set(e.teach.choices).size, l.id).toBe(3);
      expect(e.teach.choices).toContain(l.teach.q.ans);
      expect(e.teach.choices).toContain(l.teach.wrong);
      expect(l.teach.wrong).not.toBe(l.teach.q.ans);
    }
  });
  it('the coach has a recorded line for every story, step and card', () => {
    const ids = new Set(NEGATIVE_LINES.map(x => x.id));
    const voiced = manifest as Record<string, unknown>;
    for (const l of NEG_LESSONS) {
      const want = [`ep.${l.id}.intro`, `ep.${l.id}.card`, ...l.steps.map((_, i) => `ep.${l.id}.s${i}`)];
      for (const id of want) { expect(ids.has(id), id).toBe(true); expect(voiced[id], `${id} recorded`).toBeTruthy(); }
      expect(ids.has(`ep.${l.id}.s${l.steps.length}`), `${l.id}: no extra step line`).toBe(false);
    }
  });
  it('the hands hop on the plank and put coins on the map', () => {
    expect(tasksOf('neg-zero')).toEqual(['watch', 'hop', 'watch', 'hop', 'label']);
    expect(tasksOf('neg-add')).toEqual(['watch', 'hop', 'watch', 'hop']);
    expect(tasksOf('neg-map')).toEqual(['watch', 'place', 'place', 'place', 'label']);
    for (const l of NEG_LESSONS) expect(tasksOf(l.id).filter(k => k !== 'watch').length, l.id).toBeGreaterThanOrEqual(2);
    // every hop on the plank lands on the plank
    for (const l of NEG_LESSONS) for (const s of l.steps) if (s.board.line) for (const h of s.board.line.hops) { expect(h.b >= s.board.line.from && h.b <= s.board.line.to, l.id).toBe(true); }
  });
});
