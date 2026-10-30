import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { ANYWHERE, MATH_CHIPS, SUBJECTS, WAYS, chipNames, linksFor, thingsIn, wayCount } from './subjects';
import { AREA, AREAS } from './math/skills/registry';
import { WORLD_PINS, worldsFor } from './adventure/worlds';

const pub = (f: string) => existsSync(new URL(`../../public/${f}`, import.meta.url));

describe('subjects and their four ways to play', () => {
  it('has the four ways in one order, each with its picture', () => {
    expect(WAYS.map(w => w.id)).toEqual(['learn', 'practice', 'games', 'adventure']);
    for (const w of WAYS) expect(pub(w.icon), w.icon).toBe(true);
    // the open book, never the old easel
    expect(WAYS[0].icon).toBe('icons/book.webp');
  });

  it('gives every subject all four ways, and every thing a part it belongs to', () => {
    for (const s of SUBJECTS) {
      expect(Object.keys(s.ways).sort()).toEqual(['adventure', 'games', 'learn', 'practice']);
      expect(pub(s.icon), s.icon).toBe(true);
      const chips = new Set(s.chips.map(c => c.id));
      for (const w of WAYS) {
        const c = s.ways[w.id];
        // a way with nothing in it says what's coming instead
        if (!c.things.length) expect(c.soon, `${s.id} ${w.id}`).toBeTruthy();
        for (const t of c.things) {
          expect(t.areas.length, `${s.id} ${t.id}`).toBeGreaterThan(0);
          if (!t.soon) for (const a of t.areas) expect(chips.has(a), `${s.id} ${t.id} ${a}`).toBe(true);
          expect(pub(t.art), `${s.id} ${t.id} ${t.art}`).toBe(true);
          if (t.face) expect(pub(t.face), t.face).toBe(true);
        }
      }
    }
  });

  it('counts what each way has', () => {
    const math = SUBJECTS.find(s => s.id === 'math')!;
    expect(wayCount(math, 'learn')).toBeGreaterThan(30);
    expect(wayCount(math, 'practice')).toBeGreaterThan(100);
    expect(wayCount(math, 'games')).toBeGreaterThanOrEqual(10);
    expect(wayCount(math, 'adventure')).toBe(10);
    const typing = SUBJECTS.find(s => s.id === 'typing')!;
    expect(wayCount(typing, 'games')).toBe(0);
    expect(wayCount(typing, 'learn')).toBeGreaterThan(10);
  });

  it('filters by part and links a part to its other ways', () => {
    const math = SUBJECTS.find(s => s.id === 'math')!;
    expect(thingsIn(math, 'games', 'fractions').map(t => t.id)).toContain('pizza');
    expect(thingsIn(math, 'games', 'all').length).toBe(math.ways.games.things.length);
    const fr = linksFor(math, 'fractions');
    expect(fr.learn?.areas).toContain('fractions');
    expect(fr.games?.id).toBe('pizza');
    expect(fr.adventure?.id).toBe('falls');
    // the fact parts share the Sky Islands
    expect(linksFor(math, 'times').adventure?.id).toBe('sky');
    expect(chipNames(math, math.ways.games.things.find(t => t.id === 'slalom')!)).toBe('Plus · Minus · Times · Share');
    expect(MATH_CHIPS.map(c => c.name)).toEqual(expect.arrayContaining(['Plus', 'Minus', 'Times', 'Share', 'Fractions', 'Place value', 'Decimals and money']));
  });

  it('shows every math area in all four ways, under one name everywhere', () => {
    const math = SUBJECTS.find(s => s.id === 'math')!;
    for (const c of math.chips) for (const w of WAYS) expect(thingsIn(math, w.id, c.id).filter(t => !t.soon).length, `${c.id} ${w.id}`).toBeGreaterThan(0);
    // an area's chip, its Practice card and its Arcade game's label all read its registry name (the fact
    // strands' chips are Plus, Minus, Times and Share; their cards are places, Plus Peaks...)
    for (const a of AREAS.filter(x => x.live && !x.op)) {
      expect(math.chips.find(c => c.id === a.id)?.name).toBe(a.name);
      expect(math.ways.practice.things.find(t => t.id === a.id)?.name).toBe(a.name);
    }
    expect(AREA.measure.name).toBe('Time and measuring');
  });

  it('lists the places that take every subject', () => {
    expect(ANYWHERE.map(a => a.id)).toEqual(['arcade', 'adventure', 'drop', 'island', 'duel', 'rivals']);
    for (const a of ANYWHERE) { expect(pub(a.icon), a.icon).toBe(true); expect(pub(a.art), a.art).toBe(true); }
  });

  it('gives every world a subject, so a typing adventure shows typing worlds and math shows math', () => {
    for (const w of WORLD_PINS) expect(w.subjects.length, w.id).toBeGreaterThan(0);
    expect(worldsFor('typing').map(w => w.id)).toEqual(['sky']);
    expect(worldsFor('math').map(w => w.id)).toContain('sky');
    expect(worldsFor('math').map(w => w.id)).toContain('falls');
    const typing = SUBJECTS.find(s => s.id === 'typing')!;
    // the Sky Islands, then cards for the typing worlds still to come
    expect(wayCount(typing, 'adventure')).toBe(1);
    expect(typing.ways.adventure.things.filter(t => t.soon).length).toBeGreaterThan(0);
    expect(typing.ways.adventure.things.some(t => t.id === 'falls')).toBe(false);
  });
});
