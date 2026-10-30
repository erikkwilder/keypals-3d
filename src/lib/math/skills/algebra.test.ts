// Expressions and equations: what the fuzz test can't see. The balance's boxes and weights really weigh
// the answer, an inequality's right answer is on its line, a slope comes from its own table, nothing
// says NaN, negatives come only where the standard has them, and the Star Lab trips all open in order.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { newProfile } from '../../engine/profile';
import { mathOf } from '../progress';
import { ALGEBRA_SKILLS, parseRay, type AlgPic, type BalanceSpec, type RaySpec } from './algebra';
import { partsText } from './text';
import { SKILL } from './registry';
import { nextSkillLesson, skillRegionOpen, skillRegionsOf, skillUnlocked, SKILL_EPISODES, SKILL_LESSONS, SKILL_PLACEMENTS } from './course';
import { RUNGS, type Item } from './types';

function each(f: (it: Item, r: number) => void) {
  for (const s of ALGEBRA_SKILLS) for (const sub of s.subs) for (let r = 1; r <= RUNGS; r++) {
    const rng = mulberry32(31 + r * 7 + sub.id.length);
    for (let i = 0; i < 120; i++) f(s.make(rng, sub.id, r), r);
  }
}
const pics = (it: Item) => it.prompt.flatMap(p => (p.t === 'alg' ? [p.pic as AlgPic] : []));

describe('expressions and equations: the questions make sense', () => {
  it('reads cleanly: no NaN, undefined or Infinity anywhere', () => {
    each(it => {
      const all = `${it.ask} ${partsText(it.prompt)} ${it.explain} ${it.trick?.say ?? ''} ${(it.choices ?? []).map(c => partsText(c.parts)).join(' ')}`;
      expect(all, it.id).not.toMatch(/NaN|undefined|Infinity|\[object/);
      expect(it.trick?.name, it.id).toBeTruthy();
    });
  });
  it('the balance weighs the answer: boxes times the answer, and the weights with them, make the other side', () => {
    let n = 0;
    each(it => {
      if (it.custom?.name !== 'balance') return;
      const b = it.custom.spec as BalanceSpec, a = it.answer.kind === 'number' ? it.answer.value : NaN;
      expect(b.boxes * a + b.left, it.id).toBe(b.right);
      expect(Number.isInteger(a) && a > 0 && b.boxes >= 1 && b.boxes <= 5 && b.right <= 60, it.id).toBe(true);
      n++;
    });
    expect(n).toBeGreaterThan(500);
  });
  it('an inequality\'s answer is on its line, and it is one of the choices', () => {
    each(it => {
      if (it.skill !== 'al-ineq') return;
      const want = it.answer.kind === 'choice' ? it.answer.id : '';
      if (it.input === 'custom') {
        const p = parseRay(want), sp = it.custom!.spec as RaySpec;
        expect(p, it.id).toBeTruthy();
        expect(p!.at > sp.min && p!.at < sp.max, it.id).toBe(true);
      }
      for (const pic of pics(it)) if (pic.kind === 'ray') expect(pic.at > pic.min && pic.at < pic.max, it.id).toBe(true);
      expect(it.choices?.some(c => c.id === want), it.id).toBe(true);
      expect(new Set(it.choices!.map(c => partsText(c.parts))).size, it.id).toBe(it.choices!.length);
    });
  });
  it('a slope comes from its own table or graph', () => {
    each(it => {
      if (it.skill !== 'al-slope') return;
      const [pic] = pics(it);
      expect(pic && (pic.kind === 'table' || pic.kind === 'graph'), it.id).toBe(true);
      if (!pic || (pic.kind !== 'table' && pic.kind !== 'graph')) return;
      const m = (pic.ys[1] - pic.ys[0]) / (pic.xs[1] - pic.xs[0]);
      pic.xs.forEach((x, i) => expect(pic.ys[i], it.id).toBe(pic.ys[0] + m * (x - pic.xs[0])));
      if (it.id.endsWith(':b')) expect(it.answer).toEqual({ kind: 'number', value: pic.ys[0] - m * pic.xs[0] });
      else expect(it.answer).toEqual({ kind: 'number', value: m });
    });
  });
  it('choices: one right one, all different', () => {
    each(it => {
      if (it.input !== 'choice') return;
      expect(it.choices!.filter(c => c.id === 'right').length, it.id).toBe(1);
      expect(new Set(it.choices!.map(c => partsText(c.parts))).size, it.id).toBe(it.choices!.length);
      expect(it.choices!.length, it.id).toBeGreaterThanOrEqual(3);
    });
  });
  it('answers below zero only from grade 6, on the top rungs', () => {
    each((it, r) => {
      if (it.answer.kind !== 'number' || it.answer.value >= 0) return;
      expect(SKILL[it.skill].grade, it.id).toBeGreaterThanOrEqual(6);
      expect(r, it.id).toBeGreaterThanOrEqual(5);
    });
  });
});

describe('the Star Lab trips', () => {
  it('every algebra skill is met on a trip, in grade order, and has a Learn episode', () => {
    const met = SKILL_LESSONS.filter(l => l.area === 'algebra' && l.kind === 'meet').flatMap(l => l.learn);
    expect(new Set(met)).toEqual(new Set(ALGEBRA_SKILLS.map(s => s.id)));
    const grades = met.map(id => SKILL[id].grade);
    expect(grades).toEqual([...grades].sort((a, b) => a - b));
    for (const s of ALGEBRA_SKILLS) expect(SKILL_EPISODES[s.id], s.id).toBeTruthy();
    expect(SKILL_PLACEMENTS.algebra?.skills.length).toBe(ALGEBRA_SKILLS.length);
  });
  it('opens one stop after another: finishing each one leads to every trip', () => {
    const p = newProfile('Ava', 'dino'), m = (p.math = mathOf(p));
    const rs = skillRegionsOf('algebra');
    expect(rs.map(r => r.name)).toEqual(['Star Steps', 'The Balance Room', 'Telescope Tower']);
    expect(skillRegionOpen(m, rs[1].id)).toBe(false);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const l = nextSkillLesson(m, 'algebra');
      expect(skillUnlocked(m, l), l.id).toBe(true);
      if (seen.has(l.id)) break;
      seen.add(l.id);
      m.lessons[l.id] = { stars: 3, best: 10, bestRide: 1, finishes: 1 } as never;
    }
    for (const r of rs) for (const l of r.lessons) expect(seen.has(l.id), l.id).toBe(true);
  });
});
