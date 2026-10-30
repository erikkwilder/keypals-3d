// Treasure Grid's rules: the clues point where they say, the maps and kinds follow what the player has met,
// the sonar says what was right, the score and stars add up, and a round pays out and keeps its records.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { newProfile } from '../../engine/profile';
import { mathOf } from '../progress';
import { noteSkillAnswers } from '../skills/progress';
import { SMALL, WHOLE, applyTreasure, boardFor, clueMaker, clueScore, clueText, dailySeed, kindsFor, makeClue, sonar, starsFor, STAR_AT, treasureOf, type Clue } from './treasure';

const inMap = (c: Clue, b = WHOLE) => { for (const q of [c.at, c.from].filter(Boolean)) { expect(q!.x).toBeGreaterThanOrEqual(b.xMin); expect(q!.x).toBeLessThanOrEqual(b.xMax); expect(q!.y).toBeGreaterThanOrEqual(b.yMin); expect(q!.y).toBeLessThanOrEqual(b.yMax); } };

describe('Treasure Grid clues', () => {
  it('walks end where the chest is, mirrors land on it, and everything is on the map', () => {
    for (const b of [SMALL, WHOLE]) for (const lv of [0, 2, 4, 6, undefined]) {
      const rng = mulberry32(7 + (lv ?? 9));
      for (let i = 0; i < 400; i++) {
        const c = makeClue(rng, i, b, ['point', 'walk', 'flip'], lv);
        inMap(c, b);
        if (c.kind === 'walk') {
          let { x, y } = c.from!;
          for (const l of c.legs!) { x += l.dx; y += l.dy; expect(x >= b.xMin && x <= b.xMax).toBe(true); expect(l.dx === 0 || l.dy === 0).toBe(true); }
          expect({ x, y }).toEqual(c.at);
          expect(c.from).not.toEqual(c.at);
        }
        if (c.kind === 'flip') {
          expect(b).toBe(WHOLE);
          expect(c.axis === 'x' ? { x: c.from!.x, y: -c.from!.y } : { x: -c.from!.x, y: c.from!.y }).toEqual(c.at);
          expect(c.from).not.toEqual(c.at);
        }
        expect(clueText(c).length).toBeGreaterThan(8);
      }
    }
  });
  it('the first two clues are plain coordinates; the whole map nearly always has a minus sign', () => {
    const next = clueMaker(5, WHOLE, ['point', 'walk', 'flip'], 3);
    const cs = Array.from({ length: 60 }, next);
    expect(cs[0].kind).toBe('point'); expect(cs[1].kind).toBe('point');
    expect(new Set(cs.map(c => c.kind)).size).toBe(3);
    expect(cs.filter(c => c.at.x < 0 || c.at.y < 0).length).toBeGreaterThan(45);
  });
  it('the same day gives the same clues', () => {
    const at = new Date('2026-11-03T10:00:00').getTime();
    const a = clueMaker(dailySeed(at), WHOLE, ['point', 'walk'], 3), b = clueMaker(dailySeed(at + 3600_000), WHOLE, ['point', 'walk'], 3);
    for (let i = 0; i < 10; i++) expect(a()).toEqual(b());
  });
});

describe('Treasure Grid follows what the player has met', () => {
  it('the first quadrant and plain digs to begin with; the whole map, walks and mirrors once met', () => {
    const p = newProfile('Ava', 'dino');
    expect(boardFor(p)).toBe(SMALL);
    expect(kindsFor(p)).toEqual(['point']);
    const m = (p.math = mathOf(p));
    noteSkillAnswers(m, [{ key: 'in-plot:move', ok: true, thinkMs: 3000 }], Date.now());
    expect(kindsFor(p)).toEqual(['point', 'walk']);
    noteSkillAnswers(m, [{ key: 'in-quad:flip', ok: true, thinkMs: 3000 }], Date.now());
    expect(boardFor(p)).toBe(WHOLE);
    expect(kindsFor(p)).toEqual(['point', 'walk', 'flip']);
  });
});

describe('the sonar ping', () => {
  const c: Clue = { kind: 'point', at: { x: 3, y: -2 }, key: 'in-quad:plot', points: 100, tideMs: 20000, rung: 3 };
  it('says what was right', () => {
    expect(sonar(c, { x: -2, y: 3 }).text).toMatch(/Swapped/);
    expect(sonar(c, { x: -3, y: -2 }).text).toMatch(/sign of the first/);
    expect(sonar(c, { x: 3, y: 2 }).text).toMatch(/sign of the second/);
    expect(sonar(c, { x: 3, y: 4 }).text).toMatch(/Across is right/);
    expect(sonar(c, { x: 0, y: -2 }).text).toMatch(/Up and down is right/);
    expect(sonar(c, { x: 4, y: -1 }, { x: -5, y: 5 }).text).toMatch(/Warmer/);
    expect(sonar(c, { x: 4, y: -1 }).heat).toBeGreaterThan(sonar(c, { x: -5, y: 5 }).heat);
  });
});

describe('a round of Treasure Grid', () => {
  it('scores with the combo and the quick bonus, half for a second try', () => {
    const c = makeClue(mulberry32(1), 0, WHOLE, ['point']);
    expect(clueScore(c, 0, 9000, true)).toBe(100);
    expect(clueScore(c, 4, 3000, true)).toBe(240);
    expect(clueScore(c, 0, 9000, false)).toBe(50);
    expect(starsFor(STAR_AT[0] - 1)).toBe(0); expect(starsFor(STAR_AT[2])).toBe(3);
  });
  it('pays out like practice, keeps the best and today\'s best, and counts only subs already met', () => {
    const p = newProfile('Ava', 'dino');
    noteSkillAnswers((p.math = mathOf(p)), [{ key: 'in-plot:plot', ok: true, thinkMs: 3000 }], Date.now());
    const before = mathOf(p).skills!['in-plot:plot'].seen;
    const out = applyTreasure(p, { score: 1700, found: 12, washed: 1, bestCombo: 6, ms: 120000, at: Date.now(), daily: true, answers: [{ key: 'in-plot:plot', ok: true, thinkMs: 2000, rung: 3 }, { key: 'in-quad:flip', ok: true, thinkMs: 2000 }] });
    expect(out.stars).toBe(2); expect(out.newBest).toBe(true); expect(out.newDaily).toBe(true);
    expect(treasureOf(out.profile).best).toBe(1700);
    expect(mathOf(out.profile).skills!['in-plot:plot'].seen).toBe(before + 1);
    expect(mathOf(out.profile).skills!['in-quad:flip']).toBeUndefined();
    expect(out.xp.gained).toBeGreaterThan(0);
  });
});
