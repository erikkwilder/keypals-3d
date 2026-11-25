// A battle with less motion (calm.ts): what moves there for its own sake stands still while nothing happens,
// and its attacks, hits and reactions play as ever. The scene needs WebGL, so these read its source, as
// fx.test.ts does; the clocks themselves are tested in calm.test.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
const battle = src('./battleScene.ts');
/** a method's body: from its first line to its closing brace (two spaces in) */
const body = (s: string, start: string) => {
  const i = s.indexOf(start);
  expect(i, start).toBeGreaterThan(-1);
  return s.slice(i, s.indexOf('\n  }\n', i));
};
const update = body(battle, '  update(dt: number, t: number) {');

describe('a battle with less motion: the arena', () => {
  it('the banners wave and the torches flicker by the decorative clock, so with less motion they stand still', () => {
    expect(update).toContain('const dT = stage.decorT;');
    expect(update).toMatch(/for \(const b of this\.banners\) \{[^\n]*p\.setZ\(i, Math\.sin\(dT \* 2\.6 \+ y \* 4 \+ b\.id\) \* 0\.06 \* y\)/);
    expect(update).toContain('this.lights.forEach((l, i) => (l.intensity = 6 + Math.sin(dT * 13 + i * 2) * 0.8 + Math.sin(dT * 7.3 + i) * 0.6));');
    // neither goes by the stage's own clock any more
    const lines = update.split('\n').filter(l => /this\.banners\)|this\.lights\.forEach/.test(l));
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l).not.toMatch(/\bt \*/);
  });

  it("the faint shield's breathing while the block question is up goes by it too; its snap up doesn't", () => {
    const shield = body(battle, '  private updateShield(dt: number, dT: number) {');
    expect(update).toContain('this.updateShield(dt, dT);');
    expect(shield).toContain(': 0.78 + 0.04 * Math.sin(dT * 7);');
    expect(shield).toContain("this.shieldMode === 'up' ? 1 + 0.22 * Math.sin(Math.min(1, this.shieldAge / 0.28) * Math.PI)");
    // (and with less motion it has no flash, from before)
    expect(shield).toContain('const flash = calm.on ? 0 : this.shieldFlash;');
  });

  it('the fire bowls\' sparks and the floating motes are steady ones (none with less motion)', () => {
    expect(update).toContain('for (const f of this.fires) this.fx.emit({ steady: true, ');
    expect(update).toContain('this.moteT = 0.12; this.fx.emit({ steady: true, ');
  });
});
