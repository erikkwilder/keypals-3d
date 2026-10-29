import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { newProfile } from '../../engine/profile';
import { mathOf } from '../progress';
import { SKILL, skillsOf } from './registry';
import { PLACE_SKILLS, blocksOf, commas, words, itemBlocks } from './place';
import { SKILL_LESSON, SKILL_LESSONS, skillRegionsOf, nextSkillLesson } from './course';
import { SkillTripPicker } from './picker';
import type { Answer } from './types';

const value = (b: { th?: number; h: number; t: number; o: number }) => 1000 * (b.th ?? 0) + 100 * b.h + 10 * b.t + b.o;

describe('place value skills', () => {
  it('are nine skills in the place area, K to 4, with standards', () => {
    expect(skillsOf('place').map(s => s.id)).toEqual(['pv-count', 'pv-skip', 'pv-tens', 'pv-hundreds', 'pv-compare', 'pv-add', 'pv-sub', 'pv-round', 'pv-big']);
    for (const s of PLACE_SKILLS) { expect(s.standard).toMatch(/^\d\.(NBT|CC)\./); expect(s.grade).toBeLessThanOrEqual(4); }
  });
  it('make valid, varied questions for every sub at both levels, whose own answer checks right', () => {
    for (const s of PLACE_SKILLS) for (const sub of s.subs) for (const lv of [1, 2] as const) {
      const rng = mulberry32(23 + sub.id.length * 13 + lv), ids = new Set<string>();
      for (let i = 0; i < 150; i++) {
        const it = s.make(rng, sub.id, lv);
        ids.add(it.id);
        expect(it.key).toBe(`${s.id}:${sub.id}`);
        expect(s.check(it, it.answer)).toBe(true);
        expect(it.weight).toBeGreaterThanOrEqual(1); expect(it.weight).toBeLessThanOrEqual(5);
        if (it.answer.kind === 'number') { expect(Number.isInteger(it.answer.value)).toBe(true); expect(it.answer.value).toBeGreaterThanOrEqual(0); }
        if (it.input === 'choice') expect(it.choices!.some(c => c.id === (it.answer as { id: string }).id)).toBe(true);
        for (const b of itemBlocks(it)) { expect(b.t).toBeLessThanOrEqual(9); expect(b.o).toBeLessThanOrEqual(9); expect(b.h).toBeLessThanOrEqual(9); }
      }
      expect(ids.size, `${s.id}:${sub.id}:${lv}`).toBeGreaterThan(3);
    }
  });
  it('never loops: a generator returns on every seed, even a stuck random source', () => {
    const stuck = [0, 0.37, 0.5, 0.9999];
    for (const s of PLACE_SKILLS) for (const sub of s.subs) for (const lv of [1, 2] as const) for (const v of stuck) {
      const it = s.make(() => v, sub.id, lv);
      expect(s.check(it, it.answer)).toBe(true);
    }
  });
  it('blocks pictures show the number they mean', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const it = SKILL['pv-hundreds'].make(rng, 'read', 2);
      expect(value(itemBlocks(it)[0])).toBe((it.answer as { value: number }).value);
      const tn = SKILL['pv-tens'].make(rng, 'read', 2);
      expect(value(itemBlocks(tn)[0])).toBe((tn.answer as { value: number }).value);
    }
    expect(blocksOf(4072)).toEqual({ th: 4, h: 0, t: 7, o: 2 });
  });
  it('adding and taking away: the right sums, and "regroup" really regroups', () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 200; i++) {
      const a = SKILL['pv-add'].make(rng, 'regroup', 2);
      const m = a.id.match(/pv-add:(\d+)\+(\d+)/)!;
      expect(+m[1] % 10 + (+m[2] % 10)).toBeGreaterThanOrEqual(10);
      expect((a.answer as { value: number }).value).toBe(+m[1] + +m[2]);
      const s = SKILL['pv-sub'].make(rng, 'regroup', 2);
      const n = s.id.match(/pv-sub:(\d+)-(\d+)/)!;
      expect(+n[1] % 10).toBeLessThan(+n[2] % 10);
      expect((s.answer as { value: number }).value).toBe(+n[1] - +n[2]);
      expect((s.answer as { value: number }).value).toBeGreaterThan(0);
    }
  });
  it('rounding rounds half up, comparing picks the right sign', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 200; i++) {
      const it = SKILL['pv-round'].make(rng, '100', 2);
      const n = +it.id.split(':')[2];
      expect((it.answer as { value: number }).value).toBe(Math.floor(n / 100 + 0.5) * 100);
      const c = SKILL['pv-compare'].make(rng, 'big', 2);
      const [, a, b] = c.id.split(':').map(Number);
      expect((c.answer as { id: string }).id).toBe(a < b ? 'lt' : a > b ? 'gt' : 'eq');
    }
  });
  it('writes number names and commas the way kids read them', () => {
    expect(words(43)).toBe('forty-three');
    expect(words(105)).toBe('one hundred and five');
    expect(words(47382)).toBe('forty-seven thousand, three hundred and eighty-two');
    expect(commas(47382)).toBe('47,382');
    expect(commas(999)).toBe('999');
    const it = SKILL['pv-big'].make(mulberry32(3), 'words', 2);
    expect(SKILL['pv-big'].check(it, it.answer as Answer)).toBe(true);
  });
});

describe('place value lessons', () => {
  it('three islands in Counting Caves, each ending in a run, plus a placement', () => {
    expect(skillRegionsOf('place').map(r => r.name)).toEqual(['Counting Steps', 'The Gem Mine', 'The Big Vault']);
    for (const r of skillRegionsOf('place')) expect(r.lessons.at(-1)!.kind).toBe('check');
    expect(SKILL_LESSON['start-place'].kind).toBe('placement');
    const p = newProfile('Ava', 'dino');
    expect(nextSkillLesson(mathOf(p), 'place').id).toBe('place-a-1');
  });
  it('a trip on every lesson serves only that lesson\'s skills', () => {
    for (const l of SKILL_LESSONS.filter(x => x.area === 'place')) {
      const picker = new SkillTripPicker({ lesson: l, mem: {}, now: Date.now(), seed: 3 });
      for (let i = 0; i < 12; i++) {
        const pk = picker.next();
        if (!pk) break;
        expect(l.skills).toContain(pk.item.skill);
        picker.answer(true);
      }
    }
  });
});
