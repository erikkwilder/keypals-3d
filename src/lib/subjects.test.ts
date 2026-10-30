import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { ANYWHERE, MATH_CHIPS, SUBJECTS, WAYS, chipNames, linksFor, thingsIn, wayCount } from './subjects';

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

  it('lists the places that take every subject', () => {
    expect(ANYWHERE.map(a => a.id)).toEqual(['arcade', 'adventure', 'drop', 'island', 'duel', 'rivals']);
    for (const a of ANYWHERE) { expect(pub(a.icon), a.icon).toBe(true); expect(pub(a.art), a.art).toBe(true); }
  });
});
