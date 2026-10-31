import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// An item's moving parts are found by name when it's placed. The kit's merge step used to swallow a named
// mesh (the Whale Kite's string), and the crash on every frame left the whole island blank.
describe('island items', () => {
  const src = readFileSync(new URL('./props3d.ts', import.meta.url), 'utf8');
  it('keeps anything named out of the merge, not only what is inside something named', () => {
    expect(src).toMatch(/for \(let q: THREE\.Object3D \| null = m; q && q !== root; q = q\.parent\) if \(q\.name\) return;/);
  });
  it('every name a moving part looks for is given to something', () => {
    const looked = [...src.matchAll(/getObjectByName\('([^']+)'\)/g)].map(m => m[1]);
    const given = new Set([...src.matchAll(/\.name = '([^']+)'/g)].map(m => m[1]));
    expect(looked.length).toBeGreaterThan(5);
    for (const n of looked) expect(given.has(n), n).toBe(true);
  });
});
