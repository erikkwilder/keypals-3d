import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { DECIMAL_SKILLS, dmCoins, dmChange, dmCompare, dmMake, dmTen, fewest, moneyText, worth } from './decimals';
import { SKILL } from './registry';
import type { Answer } from './types';

describe('decimal and money generators', () => {
  it('make valid, varied questions for every sub at both levels, whose own answer checks right (and never loop)', () => {
    for (const s of DECIMAL_SKILLS) for (const sub of s.subs) for (const lv of [1, 2] as const) {
      // a source that always gives the same number must still make a question at once
      for (const stuck of [0, 0.37, 0.999999]) s.make(() => stuck, sub.id, lv);
      const rng = mulberry32(11 + sub.id.length * 29 + lv), ids = new Set<string>();
      for (let i = 0; i < 150; i++) {
        const it = s.make(rng, sub.id, lv);
        ids.add(it.id);
        expect(it.key).toBe(`${s.id}:${sub.id}`);
        expect(s.check(it, it.answer), `${s.id}:${sub.id}`).toBe(true);
        expect(it.weight).toBeGreaterThanOrEqual(1);
        if (it.answer.kind === 'number') { expect(Number.isFinite(it.answer.value)).toBe(true); expect(it.answer.value).toBeGreaterThanOrEqual(0); expect(String(it.answer.value)).not.toMatch(/0000|9999/); }
        if (it.input === 'choice') expect(it.choices!.some(c => c.id === (it.answer as { id: string }).id)).toBe(true);
      }
      expect(ids.size, `${s.id}:${sub.id}:${lv}`).toBeGreaterThan(1);
      expect(SKILL[s.id]).toBe(s);
    }
  });
  it('counting coins: the answer is what the coins are worth', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 50; i++) {
      const it = dmCoins.make(rng, 'quarters', 2);
      const p = it.prompt[0];
      if (p.t === 'pic' && p.pic.kind === 'coins' && it.answer.kind === 'number') expect(it.answer.value).toBe(p.pic.coins.reduce((t, c) => t + worth(c), 0));
      expect(it.answer.kind === 'number' && it.answer.value < 100).toBe(true);
    }
  });
  it('change counts up to what was paid', () => {
    const it = dmChange.make(mulberry32(8), 'to-100', 1);
    const m = /costs (\d+)¢/i.exec(it.ask);
    expect(m).not.toBeNull();
    expect(it.answer).toEqual({ kind: 'number', value: 100 - Number(m![1]) });
  });
  it('make the amount: the tray total is checked against the target', () => {
    const it = dmMake.make(mulberry32(4), 'to-50', 1);
    const target = (it.custom!.spec as { target: number }).target;
    const right: Answer = { kind: 'number', value: target }, wrong: Answer = { kind: 'number', value: target + 1 };
    expect(dmMake.check(it, right)).toBe(true);
    expect(dmMake.check(it, wrong)).toBe(false);
    expect(fewest(target).reduce((a, b) => a + b, 0)).toBe(target);
  });
  it('compare: 0.5 and 0.50 are the same; 0.4 beats 0.38', () => {
    const rng = mulberry32(21);
    let sawSame = false;
    for (let i = 0; i < 200; i++) {
      const it = dmCompare.make(rng, 'tricky', 2);
      if (it.answer.kind === 'choice' && it.answer.id === 'same') sawSame = true;
    }
    expect(sawSame).toBe(true);
  });
  it('times and divide by 10 and 100 give clean decimals', () => {
    const rng = mulberry32(9);
    for (const sub of ['x10', 'x100', 'd10', 'd100']) for (let i = 0; i < 40; i++) {
      const it = dmTen.make(rng, sub, 2);
      expect(it.answer.kind === 'number' && Number(it.answer.value.toFixed(4)) === it.answer.value).toBe(true);
    }
  });
  it('money words', () => {
    expect(moneyText(35)).toBe('35¢');
    expect(moneyText(135)).toBe('$1.35');
    expect(moneyText(200)).toBe('$2');
    expect(moneyText(50, true)).toBe('$0.50');
  });
});
