import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { FRACTION_SKILLS, checkAnswer, sameValue } from './fractions';
import { asChoices, choiceChance, choiceFor, choiceFractions, typedAs, typedChoice, CHOICE_RIGHT } from './choices';
import { PLACE_SKILLS } from './place';
import { DECIMAL_SKILLS } from './decimals';
import type { Part } from './types';

const fracOf = (ps: Part[]) => { const p = ps[0]; return p.t === 'frac' ? { n: p.n!, d: p.d! } : null; };
const numOf = (ps: Part[]) => { const p = ps[0]; return p.t === 'num' ? p.n : null; };

describe('questions asked as choices', () => {
  it('every fraction and number question can be asked as 3 or 4 choices with exactly one right answer', () => {
    let made = 0;
    for (const sk of FRACTION_SKILLS) {
      if (sk.input !== 'fraction' && sk.input !== 'number') continue;
      for (const sub of sk.subs) for (const level of [1, 2] as const) for (let seed = 1; seed <= 40; seed++) {
        const it = sk.make(mulberry32(seed * 7 + level), sub.id, level);
        if (it.input !== 'fraction' && it.input !== 'number') continue;
        const ch = asChoices(it, mulberry32(seed));
        expect(ch, `${it.id}`).not.toBeNull();
        made++;
        const cs = ch!.choices!;
        expect(cs.length).toBeGreaterThanOrEqual(3);
        expect(cs.length).toBeLessThanOrEqual(4);
        expect(cs.filter(c => c.id === CHOICE_RIGHT)).toHaveLength(1);
        // the right choice is the real answer, and no wrong one is secretly right (2/4 for 1/2)
        if (it.answer.kind === 'fraction') {
          const vals = cs.map(c => fracOf(c.parts)!);
          expect(sameValue(vals[cs.findIndex(c => c.id === CHOICE_RIGHT)], it.answer)).toBe(true);
          for (const [i, v] of vals.entries()) if (cs[i].id !== CHOICE_RIGHT) expect(sameValue(v, it.answer), `${it.id} ${v.n}/${v.d}`).toBe(false);
          // and no two choices are worth the same
          for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++) expect(sameValue(vals[i], vals[j])).toBe(false);
        } else if (it.answer.kind === 'number') {
          const vals = cs.map(c => numOf(c.parts));
          expect(new Set(vals).size).toBe(vals.length);
          expect(vals[cs.findIndex(c => c.id === CHOICE_RIGHT)]).toBe(it.answer.value);
        }
        // a pick checks the usual way
        expect(checkAnswer(ch!.answer, { kind: 'choice', id: CHOICE_RIGHT })).toBe(true);
        expect(checkAnswer(ch!.answer, { kind: 'choice', id: cs.find(c => c.id !== CHOICE_RIGHT)!.id })).toBe(false);
      }
    }
    expect(made).toBeGreaterThan(500);
  });
  it('the classic mistake is among the choices: adding the bottoms', () => {
    const add = FRACTION_SKILLS.find(s => s.id === 'fr-add')!;
    const it = add.make(mulberry32(3), 'small', 1);
    const [x, y] = it.prompt.filter(p => p.t === 'frac').map(p => (p.t === 'frac' ? { n: p.n!, d: p.d! } : null)!);
    const ch = asChoices(it, mulberry32(9))!;
    const vals = ch.choices!.map(c => fracOf(c.parts)!);
    expect(vals.some(v => v.n === x.n + y.n && v.d === x.d + y.d)).toBe(true);
  });
  it('choices come often while a kind is new, rarely once it blooms, never in a test', () => {
    expect(choiceChance(0, 'meet')).toBeGreaterThan(choiceChance(2, 'practice'));
    expect(choiceChance(2, 'practice')).toBeGreaterThan(choiceChance(3, 'mix'));
    expect(choiceChance(0, 'check')).toBe(0);
    expect(choiceChance(1, 'placement')).toBe(0);
  });
  it('a number line or a question that is already choices stays as it is', () => {
    for (const id of ['fr-line', 'fr-compare']) {
      const sk = FRACTION_SKILLS.find(s => s.id === id)!;
      expect(asChoices(sk.make(mulberry32(5), sk.subs[0].id, 1), mulberry32(1))).toBeNull();
    }
  });
  it('number choices can be typed: the typed number picks its choice', () => {
    const sk = FRACTION_SKILLS.find(s => s.id === 'fr-equal')!;
    for (let seed = 1; seed <= 30; seed++) {
      const ch = asChoices(sk.make(mulberry32(seed), sk.subs[0].id, 1), mulberry32(seed))!;
      expect(typedAs(ch)).toBe('number');
      for (const c of ch.choices!) {
        const n = numOf(c.parts)!;
        expect(choiceFor(ch, { kind: 'number', value: n })).toBe(c.id);
        // typed in full it's picked (straight away unless another choice goes on from it, then on Enter)
        const longer = ch.choices!.some(o => o !== c && String(numOf(o.parts)).startsWith(String(n)));
        expect(typedChoice(ch, String(n))).toBe(longer ? 'wait' : 'pick');
        expect(typedChoice(ch, String(n), true)).toBe('pick');
      }
      expect(choiceFor(ch, { kind: 'number', value: 999 })).toBeNull();
    }
  });
  it('a typed number that no choice starts with is wrong straight away, a part of one waits', () => {
    const it0 = { skill: 'x', key: 'x:1', id: 'q', ask: '', prompt: [], input: 'choice' as const, weight: 1, explain: '',
      choices: [{ id: 'a', parts: [{ t: 'num' as const, n: 12 }] }, { id: 'b', parts: [{ t: 'num' as const, n: 15 }] }, { id: 'c', parts: [{ t: 'num' as const, n: 1 }] }],
      answer: { kind: 'choice' as const, id: 'b' } };
    expect(typedChoice(it0, '1')).toBe('wait');
    expect(typedChoice(it0, '1', true)).toBe('pick');
    expect(typedChoice(it0, '15')).toBe('pick');
    expect(typedChoice(it0, '3')).toBe('wrong');
    expect(typedChoice(it0, '16')).toBe('wrong');
    expect(typedChoice(it0, '')).toBe('wait');
  });
  it('fraction choices take the fraction pad: the same fraction, else one worth the same', () => {
    const add = FRACTION_SKILLS.find(s => s.id === 'fr-add')!;
    const ch = asChoices(add.make(mulberry32(3), 'small', 1), mulberry32(9))!;
    expect(typedAs(ch)).toBe('fraction');
    expect(choiceFractions(ch)).toHaveLength(ch.choices!.length);
    const r = fracOf(ch.choices!.find(c => c.id === CHOICE_RIGHT)!.parts)!;
    expect(choiceFor(ch, { kind: 'fraction', n: r.n, d: r.d })).toBe(CHOICE_RIGHT);
    expect(choiceFor(ch, { kind: 'fraction', n: r.n * 3, d: r.d * 3 })).toBe(CHOICE_RIGHT);
    expect(choiceFor(ch, { kind: 'fraction', n: 97, d: 98 })).toBeNull();
  });
  it('choices of words and signs (comparing) are only tapped', () => {
    for (const sk of [...FRACTION_SKILLS, ...PLACE_SKILLS, ...DECIMAL_SKILLS]) {
      if (sk.input !== 'choice') continue;
      const it = sk.make(mulberry32(4), sk.subs[0].id, 1);
      expect(typedAs(it), sk.id).toBeNull();
    }
  });
});
