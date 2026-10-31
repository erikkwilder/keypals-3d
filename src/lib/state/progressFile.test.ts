import { describe, expect, it } from 'vitest';
import { newProfile, type Profile } from '../engine/profile';
import { clashes, clashText, loadInto } from './progressFile';

const kid = (name: string, id: string, at = 0): Profile => ({ ...newProfile(name, 'dino'), id, updatedAt: at });

describe('loading progress from a file', () => {
  it('asks only about players who would be replaced, by name', () => {
    const here = [kid('Mia', 'a', 200), kid('Theo', 'b')];
    expect(clashes(here, [kid('Ana', 'c')])).toEqual([]);
    const c = clashes(here, [kid('Mia old', 'a', Date.UTC(2026, 9, 12, 12)), kid('Ana', 'c')]);
    expect(c.map(x => x.name)).toEqual(['Mia']);
    expect(clashText(c)).toContain("Loading swaps Mia's progress here for the copy in the file, from Oct 12");
  });
  it('replaces the same ids, adds the new ones and leaves everyone else alone', () => {
    const here = [kid('Mia', 'a'), kid('Theo', 'b')];
    expect(loadInto(here, [kid('Mia old', 'a'), kid('Ana', 'c')]).map(x => x.name)).toEqual(['Mia old', 'Theo', 'Ana']);
  });
});
