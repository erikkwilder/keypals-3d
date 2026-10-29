import { describe, expect, it } from 'vitest';
import { ALL_LINES } from '../../content/voice';
import { SKILL_EPISODES } from '../skills/course';
import { SKILL } from '../skills/registry';
import { MARKET_LESSON, MARKET_LESSONS, marketLines } from './episodes';

describe('decimals and money episodes', () => {
  it('one for each money idea, with the skills it teaches pointing back at it', () => {
    expect(MARKET_LESSONS).toHaveLength(6);
    for (const l of MARKET_LESSONS) for (const s of l.skills) { expect(SKILL[s], s).toBeTruthy(); expect(SKILL_EPISODES[s]).toBe(l.id); }
    for (const id of Object.values(SKILL_EPISODES).filter(x => x.startsWith('dec-'))) expect(MARKET_LESSON[id], id).toBeTruthy();
  });
  it('the buddy is wrong in a way that can be fixed: three different choices', () => {
    for (const l of MARKET_LESSONS) {
      const t = l.teach;
      expect(new Set([t.q.ans, t.wrong, t.decoy]).size, l.id).toBe(3);
      expect(t.says.length).toBeGreaterThan(10);
    }
  });
  it('every answer is what its picture shows', () => {
    for (const l of MARKET_LESSONS) for (const q of [l.teach.q, ...l.tries]) {
      if (q.input === 'choice') { expect(['a', 'b', 'same']).toContain(q.ans); continue; }
      expect(Number.isFinite(Number(q.ans)), `${l.id}: ${q.text}`).toBe(true);
      if (q.pic?.kind === 'bar') expect(Number(q.ans)).toBeCloseTo(q.pic.filled / 10);
      if (q.pic?.kind === 'grid' && q.input === 'decimal') expect(Number(q.ans)).toBeCloseTo(q.pic.filled / 100);
      if (q.pic?.kind === 'coins' && q.text.startsWith('How much money')) expect(Number(q.ans)).toBe(q.pic.coins.reduce((t, c) => t + Math.abs(c), 0));
    }
  });
  it('the coach says the same words as the voice list', () => {
    const said = new Map(ALL_LINES.map(l => [l.id, l.text]));
    for (const l of MARKET_LESSONS) for (const [id, text] of marketLines(l)) expect(said.get(id), id).toBe(text);
  });
});
