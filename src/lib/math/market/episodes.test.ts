// The decimals and money episodes play in the 3D episode like every other area: real coins and chocolate
// on the Sky Market's counter, each step a job for the hands, every answer what its picture shows, and the
// coach's words the voice lines.
import { describe, expect, it } from 'vitest';
import { ALL_LINES } from '../../content/voice';
import { SKILL_EPISODES } from '../skills/course';
import { SKILL } from '../skills/registry';
import { epLesson, isEpisode, taskFor } from '../episodes';
import { CENTS } from '../../three/coinShapes';
import { MARKET_LESSON, MARKET_LESSONS, marketLines } from './episodes';
import type { Board } from '../learn';

const money = (b: Board) => b.dots.reduce((t, d) => t + (d.shape?.k === 'coin' ? CENTS[d.shape.c] : 0), 0);
const gold = (b: Board) => b.dots.filter(d => d.shape?.k === 'chunk' && d.c === 'c').length;

describe('decimals and money episodes', () => {
  it('one for each money idea, with the skills it teaches pointing back at it', () => {
    expect(MARKET_LESSONS).toHaveLength(6);
    for (const l of MARKET_LESSONS) for (const s of l.skills) { expect(SKILL[s], s).toBeTruthy(); expect(SKILL_EPISODES[s]).toBe(l.id); }
    for (const id of Object.values(SKILL_EPISODES).filter(x => x.startsWith('dec-'))) expect(MARKET_LESSON[id], id).toBeTruthy();
  });
  it('play in the 3D episode at the Sky Market, with the point key for decimals', () => {
    for (const l of MARKET_LESSONS) {
      expect(isEpisode(l.id), l.id).toBe(true);
      const e = epLesson(l.id)!;
      expect(e.set).toBe('market');
      expect(new Set(e.teach.choices).size, l.id).toBe(3);
      expect(e.teach.choices).toContain(l.teach.q.ans);
      expect(l.teach.says, l.id).toContain(l.teach.wrong);
    }
    expect(epLesson('dec-tenths')!.point).toBe(true);
    expect(epLesson('dec-coins')!.point).toBe(false);
  });
  it('every step gives the hands a job, and the coins and chocolate are real things', () => {
    const kinds = new Set<string>();
    for (const l of MARKET_LESSONS) l.steps.forEach((s, i) => {
      const t = s.do === 'watch' ? 'watch' : taskFor(i ? l.steps[i - 1].board : null, s.board).kind;
      kinds.add(t);
      if (i > 0 && s.do !== 'watch') expect(t, `${l.id} s${i}`).not.toBe('watch');
      for (const d of s.board.dots) expect(['coin', 'chunk'], `${l.id} s${i} ${d.id}`).toContain(d.shape?.k);
    });
    expect([...kinds].sort()).toEqual(['label', 'move', 'place', 'tap', 'watch']);
  });
  it('every answer is what its picture shows', () => {
    for (const l of MARKET_LESSONS) for (const q of [l.teach.q, ...l.tries]) {
      expect(Number.isFinite(Number(q.ans)), `${l.id}: ${q.text}`).toBe(true);
      if (q.text.startsWith('How much money')) expect(Number(q.ans)).toBe(money(q.pic));
      if (q.text.includes('the bar is gold')) expect(Number(q.ans)).toBeCloseTo(gold(q.pic) / 10);
      if (q.text.includes('the slab is gold')) expect(Number(q.ans)).toBeCloseTo(gold(q.pic) / 100);
      if (q.text.startsWith('They pay')) expect(Number(q.ans)).toBe(money(q.pic) - Number(q.text.match(/costs (\d+)¢/)![1]));
      if (q.text.startsWith('Which is more')) { const [a, b] = q.text.match(/\d\.\d+/g)!.map(Number); expect(Number(q.ans)).toBe(Math.max(a, b)); }
    }
  });
  it('the coach says the same words as the voice list, and the buddy has its lines', () => {
    const said = new Map(ALL_LINES.map(l => [l.id, l.text]));
    for (const l of MARKET_LESSONS) {
      for (const [id, text] of marketLines(l)) expect(said.get(id), id).toBe(text);
      expect(said.get(`bv.kid-a.${l.id}.try`), l.id).toBe(l.teach.says);
      expect(said.get(`bv.kid-a.${l.id}.fixed`), l.id).toBe(l.teach.fixed);
    }
  });
});
