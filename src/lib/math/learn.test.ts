import { describe, expect, it } from 'vitest';
import { BW, BH, LESSONS, LESSON, finishLesson, hideAnswer, isLearnStop, learnedTrick, lessonForFact, lessonForStop, nextToLearn, LEARN_SHELLS } from './learn';
import { MATH_LESSONS, MATH_REGIONS, groupFacts, ruleFacts } from './course';
import { answerOf } from './facts';
import { mathOf } from './progress';
import { newProfile } from '../engine/profile';
import { advView } from '../adventure/state';

describe('Learn lessons', () => {
  it('has a lesson for every trick group, in course order, each with a few steps and three tries', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(12);
    for (const l of LESSONS) {
      expect(l.steps.length, l.id).toBeGreaterThanOrEqual(2);
      expect(l.steps.length, l.id).toBeLessThanOrEqual(5);
      expect(l.tries, l.id).toHaveLength(3);
      for (const f of l.tries) expect(Number.isInteger(answerOf(f)), `${l.id} ${f.a} ${f.b}`).toBe(true);
    }
    expect(new Set(LESSONS.map(l => l.id)).size).toBe(LESSONS.length);
  });
  it('draws every picture inside the board, with no two dots sharing an id', () => {
    const boards = LESSONS.flatMap(l => [...l.steps.map(s => [l.id, s.board] as const), ...l.tries.map(f => [l.id, l.pic(f)] as const)]);
    for (const [id, b] of boards) {
      const ids = b.dots.map(d => d.id);
      expect(new Set(ids).size, id).toBe(ids.length);
      for (const d of b.dots) {
        expect(d.x, `${id} ${d.id}`).toBeGreaterThan(0); expect(d.x, `${id} ${d.id}`).toBeLessThan(BW);
        expect(d.y, `${id} ${d.id}`).toBeGreaterThan(0); expect(d.y, `${id} ${d.id}`).toBeLessThan(BH);
      }
    }
  });
  it('the try pictures show the right number of dots for counting pictures', () => {
    // make ten first: 9 + 3 shows 12 dots; share it out: 15 ÷ 3 shows 15 dots on 3 plates
    expect(LESSON['bridge-ten'].pic({ a: 9, b: 3, op: '+' }).dots).toHaveLength(12);
    const sh = LESSON['think-times'].pic({ a: 15, b: 3, op: '/' });
    expect(sh.dots).toHaveLength(15); expect(sh.plates).toHaveLength(3);
  });
  it('every fact in the course has a lesson, and every Meet and rules stop has one to learn first', () => {
    const all = [...MATH_REGIONS.flatMap(r => r.groups.flatMap(groupFacts)), ...ruleFacts()];
    for (const f of all) expect(lessonForFact(f), JSON.stringify(f)).toBeTruthy();
    for (const l of MATH_LESSONS.filter(isLearnStop)) expect(lessonForStop(l), l.id).toBeTruthy();
    expect(lessonForStop(MATH_LESSONS.find(l => l.id === 'twins-1')!)!.id).toBe('zero-one');
    expect(lessonForStop(MATH_LESSONS.find(l => l.id === 'plus-b-1')!)!.id).toBe('bridge-ten');
    expect(lessonForFact({ a: 8, b: 5, op: '+' }).id).toBe('bridge-ten');
    expect(lessonForFact({ a: 7, b: 9 }).id).toBe('times-9');
    expect(lessonForFact({ a: 14, b: 7, op: '-' }).id).toBe('doubles-back');
  });
  it('a learned trick shows in battle with the answer left out', () => {
    const p = newProfile('Ava', 'dino');
    const m0 = mathOf(p);
    expect(learnedTrick(m0, { a: 8, b: 5, op: '+' })).toBeNull();
    const first = finishLesson(p, 'bridge-ten');
    expect(first).toMatchObject({ first: true, shells: LEARN_SHELLS });
    expect(advView(p).shells).toBe(LEARN_SHELLS);
    // a minute's lesson warms the eggs but isn't a practice session (it doesn't finish a map practice stop)
    expect(advView(p).practiceSessions).toBe(0);
    const again = finishLesson(p, 'bridge-ten');
    expect(again).toMatchObject({ first: false, shells: 0 });
    const t = learnedTrick(mathOf(p), { a: 8, b: 5, op: '+' })!;
    expect(t.name).toBe('Make ten first');
    expect(t.say).not.toMatch(/\b13\b/);
    expect(t.say).toContain('?');
  });
  it('hides the answer but keeps the fact\'s own numbers', () => {
    expect(hideAnswer('7 + 7 = 14, so 14 − 7 = 7.', { a: 14, b: 7, op: '-' })).toBe('7 + 7 = 14, so 14 − 7 = ?.');
    expect(hideAnswer('5 + what = 13? 5 + 8 = 13, so 13 − 5 = 8.', { a: 13, b: 5, op: '-' })).toBe('5 + what = 13? 5 + ? = 13, so 13 − 5 = ?.');
    expect(hideAnswer('Double 3 is 6. Double again: 12.', { a: 3, b: 4 })).toBe('Double 3 is 6. Double again: ?.');
  });
  it('suggests the lesson for the next stop first', () => {
    const p = newProfile('Ava', 'dino');
    const m = mathOf(p);
    const meet = MATH_LESSONS.find(l => l.id === 'fives-1')!;
    expect(nextToLearn(m, meet)!.id).toBe('times-5');
    finishLesson(p, 'times-5');
    expect(nextToLearn(mathOf(p), meet)!.id).not.toBe('times-5');
  });
});

describe('Learn tries', () => {
  it('each try uses its own lesson\'s trick, so the help after a miss matches the lesson', async () => {
    const { hintFor } = await import('./learn');
    for (const l of LESSONS) for (const f of l.tries) {
      if (!l.id.startsWith('times-')) expect(lessonForFact(f).id, `${l.id} ${f.a} ${f.b}`).toBe(l.id);
      expect(hintFor(l, f), `${l.id} ${f.a} ${f.b}`).toContain(String(answerOf(f)));
    }
  });
});
