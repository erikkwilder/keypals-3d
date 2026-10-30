import { describe, expect, it } from 'vitest';
import { bottomDone, bottomsFor, topDone } from './fracPad';

// "1, 2" typed for 1/2 is 1 over 2, never 12 on top: each box is finished by the answer's digits.
const one = (n: number, d: number) => [{ n, d }];

describe('the fraction pad: when a box is finished', () => {
  it('1/2: the 1 is the whole top, the 2 the whole bottom', () => {
    expect(topDone('1', one(1, 2))).toBe(true);
    expect(bottomDone('1', '2', one(1, 2))).toBe(true);
  });
  it('a two-digit top or bottom waits for its second digit', () => {
    expect(topDone('1', one(12, 5))).toBe(false);
    expect(topDone('12', one(12, 5))).toBe(true);
    expect(bottomDone('5', '1', one(5, 12))).toBe(false);
    expect(bottomDone('5', '12', one(5, 12))).toBe(true);
  });
  it('a digit that can never be the answer moves on straight away (and is checked, and wrong)', () => {
    expect(topDone('3', one(12, 5))).toBe(true);
    expect(bottomDone('1', '3', one(1, 12))).toBe(true);
    // 1 for a bottom of 2 is finished too: the number pad checks one digit for a one-digit answer
    expect(bottomDone('1', '1', one(1, 2))).toBe(true);
  });
  it('an equal fraction: the bottom waits for the one that goes with the top typed', () => {
    expect(bottomsFor('10', one(1, 2))).toEqual(['20']);
    expect(bottomDone('10', '2', one(1, 2))).toBe(false);
    expect(bottomDone('10', '20', one(1, 2))).toBe(true);
    expect(bottomDone('2', '4', one(1, 2))).toBe(true);
    // a reduced form of an answer written larger: 5/6 for 10/12
    expect(topDone('5', one(10, 12))).toBe(true);
    expect(bottomDone('5', '6', one(10, 12))).toBe(true);
  });
  it('choices: a box waits while it could still be any of them', () => {
    const cs = [{ n: 1, d: 2 }, { n: 1, d: 12 }, { n: 3, d: 4 }, { n: 12, d: 5 }];
    expect(topDone('1', cs)).toBe(false); // 1 or 12
    expect(topDone('3', cs)).toBe(true);
    expect(bottomDone('1', '1', cs)).toBe(false); // 1/12 still to come
    expect(bottomDone('1', '12', cs)).toBe(true);
    expect(bottomDone('1', '2', cs)).toBe(true);
  });
  it('an empty box or a bottom of 0 is never finished', () => {
    expect(topDone('', one(1, 2))).toBe(false);
    expect(bottomDone('1', '', one(1, 2))).toBe(false);
    expect(bottomDone('1', '0', one(1, 2))).toBe(false);
  });
});
