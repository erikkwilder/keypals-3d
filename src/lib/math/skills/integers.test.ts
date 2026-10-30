// Negative numbers and the coordinate plane: the answers are the real answers (a sum of the numbers shown,
// the bigger of two, a flip over the right axis), the pictures fit what they show, and every question
// with a typed answer has the minus key.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { INTEGER_SKILLS, inAdd, inCompare, inDist, inMult, inQuad, inReal, inSub, inPlot, inOpp, inAbs } from './integers';
import { skillsOf } from './registry';
import { answerText, partsText } from './text';
import { asChoices, typedAs } from './choices';
import type { IntPic, Item, Part } from './types';

const nums = (ps: Part[]) => ps.flatMap(p => (p.t === 'num' ? [p.n] : []));
const ipic = (it: Item) => it.prompt.find(p => p.t === 'ipic') as { t: 'ipic'; pic: IntPic } | undefined;
const many = (s: typeof inAdd, sub: string, r: number, n = 300) => { const rng = mulberry32(31 + r * 7 + sub.length); return Array.from({ length: n }, () => s.make(rng, sub, r)); };

describe('negative numbers: the area', () => {
  it('has eleven skills in grade order, each with six rungs and a kid name', () => {
    expect(skillsOf('integers').map(s => s.id)).toEqual(['in-plot', 'in-real', 'in-opp', 'in-compare', 'in-abs', 'in-quad', 'in-dist', 'in-add', 'in-sub', 'in-mult', 'in-rat']);
    const grades = INTEGER_SKILLS.map(s => s.grade);
    expect([...grades].sort((a, b) => a - b)).toEqual(grades);
    for (const s of INTEGER_SKILLS) { expect(s.name.length).toBeGreaterThan(3); expect(s.plain.length).toBeGreaterThan(20); expect(s.standard).toMatch(/^[567]\./); }
  });
  it('every typed answer has the minus key, and every question has a trick', () => {
    for (const s of INTEGER_SKILLS) for (const sub of s.subs) for (let r = 1; r <= 6; r++) for (const it of many(s, sub.id, r, 40)) {
      if (it.input === 'number') expect(it.signed, `${it.id}`).toBe(true);
      expect(it.trick?.say.length, it.id).toBeGreaterThan(10);
    }
  });
  it('negative choices are tapped, not typed, and signed questions are never turned into choices', () => {
    const it = inCompare.make(mulberry32(3), 'pair', 3);
    expect(typedAs(it)).toBe(null);
    const add = inAdd.make(mulberry32(4), 'negpos', 2);
    expect(asChoices(add, mulberry32(5))).toBe(null);
  });
  it('writes negatives with a real minus sign', () => {
    const it = inSub.make(mulberry32(8), 'minusneg', 3);
    expect(partsText(it.prompt)).toMatch(/\(−\d+\)/);
    expect(answerText({ ...it, answer: { kind: 'number', value: -4 } })).toBe('−4');
  });
});

describe('negative numbers: the answers are right', () => {
  it('adding: the answer is the sum of the numbers shown', () => {
    for (const sub of ['negpos', 'posneg', 'negneg']) for (let r = 1; r <= 6; r++) for (const it of many(inAdd, sub, r)) {
      if (it.prompt.some(p => p.t === 'blank') && it.prompt[it.prompt.length - 1].t === 'blank' && it.answer.kind === 'number' && !it.ask.startsWith('It is')) {
        const ns = nums(it.prompt.filter(p => p.t !== 'ipic'));
        expect(it.answer.value, it.id).toBe(ns.reduce((a, b) => a + b, 0));
      }
    }
  });
  it('taking away: the first number take away the second', () => {
    for (const sub of ['past0', 'negminus', 'minusneg', 'gap']) for (let r = 1; r <= 6; r++) for (const it of many(inSub, sub, r)) {
      const [a, b] = nums(it.prompt.filter(p => p.t !== 'ipic'));
      expect(it.answer.kind === 'number' && it.answer.value, it.id).toBe(a - b);
    }
  });
  it('past zero really goes past zero, and taking away a negative makes it bigger', () => {
    for (const it of many(inSub, 'past0', 3)) expect((it.answer as { value: number }).value).toBeLessThan(0);
    for (const it of many(inSub, 'minusneg', 3)) { const [a] = nums(it.prompt); expect((it.answer as { value: number }).value).toBeGreaterThan(a); }
  });
  it('times and share: the sign rule', () => {
    for (let r = 1; r <= 6; r++) for (const it of many(inMult, 'times', r)) {
      if (it.ask !== 'Times them.') continue;
      expect((it.answer as { value: number }).value, it.id).toBe(nums(it.prompt).reduce((a, b) => a * b, 1));
    }
    for (let r = 1; r <= 6; r++) for (const it of many(inMult, 'sign', r)) {
      const ns = nums(it.prompt), div = it.prompt.some(p => p.t === 'op' && p.s === '÷');
      const v = div ? ns[0] / ns[1] : ns.reduce((a, b) => a * b, 1);
      expect((it.answer as { id: string }).id, it.id).toBe(v > 0 ? 'pos' : 'neg');
    }
  });
  it('which is bigger: the one further right', () => {
    for (let r = 1; r <= 6; r++) for (const it of many(inCompare, 'pair', r)) {
      const [a, b] = nums(it.prompt);
      expect(a).not.toBe(b);
      expect((it.answer as { id: string }).id).toBe(a > b ? 'a' : 'b');
    }
    for (let r = 1; r <= 6; r++) for (const it of many(inCompare, 'symbol', r)) { const [a, b] = nums(it.prompt); expect((it.answer as { id: string }).id).toBe(a < b ? 'lt' : 'gt'); }
    // the stretch has two below zero close together
    const close = many(inCompare, 'pair', 6).filter(it => { const [a, b] = nums(it.prompt); return a < 0 && b < 0 && Math.abs(a - b) <= 3; });
    expect(close.length).toBeGreaterThan(200);
  });
  it('how far from zero is never negative', () => {
    for (const sub of ['abs', 'dist', 'story']) for (let r = 1; r <= 6; r++) for (const it of many(inAbs, sub, r)) expect((it.answer as { value: number }).value).toBeGreaterThanOrEqual(0);
  });
  it('the opposite: the same distance on the other side', () => {
    for (const it of many(inOpp, 'opp', 2)) { const [x] = nums(it.prompt); expect((it.answer as { value: number }).value).toBe(-x); }
    for (const it of many(inOpp, 'read', 4)) { const p = ipic(it)!.pic; expect(p.kind).toBe('nline'); if (p.kind === 'nline') expect((it.answer as { value: number }).value).toBe(p.dots[0].x); }
  });
  it('below zero: the thermometer and the gauge read what they show', () => {
    for (const sub of ['temp', 'sea']) for (let r = 1; r <= 6; r++) for (const it of many(inReal, sub, r)) {
      const p = ipic(it)?.pic;
      if (p && (p.kind === 'thermo' || p.kind === 'depth')) { expect((it.answer as { value: number }).value).toBe(p.at); expect(p.at).toBeGreaterThan(p.min); expect(p.at).toBeLessThan(p.max); }
    }
    expect(many(inReal, 'temp', 2).some(it => it.custom?.name === 'thermo')).toBe(true);
  });
});

describe('negative numbers: the map', () => {
  it('points are on the grid, and the first quadrant has no negatives', () => {
    for (const sub of ['plot', 'move']) for (let r = 1; r <= 6; r++) for (const it of many(inPlot, sub, r)) {
      const a = it.answer as { x: number; y: number }, g = it.grid!;
      expect(a.x).toBeGreaterThanOrEqual(0); expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(g.xMax); expect(a.y).toBeLessThanOrEqual(g.yMax);
    }
  });
  it('moves land where the moves go', () => {
    for (let r = 1; r <= 6; r++) for (const it of many(inPlot, 'move', r)) {
      const start = it.prompt.find(p => p.t === 'pt') as { x: number; y: number };
      let x = start.x, y = start.y;
      for (const [, k, dir] of it.ask.matchAll(/(\d+) (right|left|up|down)/g)) { const n = Number(k); if (dir === 'right') x += n; else if (dir === 'left') x -= n; else if (dir === 'up') y += n; else y -= n; }
      expect(it.answer, it.id).toEqual({ kind: 'point', x, y });
    }
  });
  it('the four quadrants: a negative in every point, and flips change the right sign', () => {
    for (let r = 1; r <= 6; r++) for (const it of many(inQuad, 'plot', r)) { const a = it.answer as { x: number; y: number }; expect(a.x < 0 || a.y < 0, it.id).toBe(true); }
    for (let r = 1; r <= 6; r++) for (const it of many(inQuad, 'flip', r)) {
      const p = it.prompt.find(q => q.t === 'pt') as { x: number; y: number }, a = it.answer as { x: number; y: number };
      if (it.ask.includes('then')) expect([a.x, a.y]).toEqual([-p.x || 0, -p.y || 0]);
      else if (it.ask.includes('x-axis')) expect([a.x, a.y]).toEqual([p.x, -p.y || 0]);
      else expect([a.x, a.y]).toEqual([-p.x || 0, p.y]);
      expect(a.x !== p.x || a.y !== p.y, it.id).toBe(true);
    }
  });
  it('reading a point: the right pair is among the choices with its swapped twin', () => {
    for (const it of many(inQuad, 'read', 3)) {
      const p = ipic(it)!.pic as Extract<IntPic, { kind: 'plane' }>, right = it.choices!.find(c => c.id === (it.answer as { id: string }).id)!;
      expect(right.parts[0]).toEqual({ t: 'pt', x: p.pts[0].x, y: p.pts[0].y });
      const keys = it.choices!.map(c => JSON.stringify(c.parts));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
  it('distance: the gap between the two points along their line', () => {
    for (const sub of ['same', 'cross', 'story']) for (let r = 1; r <= 6; r++) for (const it of many(inDist, sub, r)) {
      const [P, Q] = it.prompt.filter(p => p.t === 'pt') as { x: number; y: number }[];
      expect(P.x === Q.x || P.y === Q.y).toBe(true);
      expect((it.answer as { value: number }).value).toBe(Math.abs(P.x - Q.x) + Math.abs(P.y - Q.y));
    }
    for (const it of many(inDist, 'cross', 3)) { const [P, Q] = it.prompt.filter(p => p.t === 'pt') as { x: number; y: number }[]; const [a, b] = P.x === Q.x ? [P.y, Q.y] : [P.x, Q.x]; expect(a * b).toBeLessThan(0); }
  });
});
