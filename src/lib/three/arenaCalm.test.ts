// With less motion, the last two things that moved for their own sake: the duel arena's banners and torch
// light (they went by the stage's clock; now by the decorative clock, which holds still with less motion), and
// the lightning flash when the Grumble arrives in a battle (the Grumble's landing, its little knock, still shows).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

describe('the duel arena and the battle arrival, with less motion', () => {
  it("the duel's arena waves and flickers by the decorative clock", () => {
    expect(src('./duelScene.ts')).toContain('animateArena(this.arena, this.fx, stage.decorT);');
    expect(src('./duelScene.ts')).not.toContain('animateArena(this.arena, this.fx, t);');
  });
  it("the battle's arrival flash only without less motion; the Grumble's landing knock as ever", () => {
    expect(src('./battleScene.ts')).toMatch(/if \(!calm\.on\) this\.fx\.lightning\(c, this\.foeAt\.clone\(\)\.add\(new THREE\.Vector3\(0\.35, 0\.05, 0\.2\)\), 0xfff1a0, 0\.05\); this\.grumble\.hit\(0\.4\);/);
  });
});
