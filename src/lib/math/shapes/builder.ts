// Shape Builder (the calm geoboard toy): its twelve builds, what each asks for (a rule the dot grid checks
// too: math/shapes/rules.ts), and where they're kept (the player's arcade records, as a list of builds
// done). A build of a skill the child has met counts in that skill's memory, like a right answer.
import type { Profile } from '../../engine/profile';
import { mathOf, type ArcadeRecord } from '../progress';
import { noteSkillAnswers } from '../skills/progress';
import type { ShapeFacts } from './geo';
import type { GridRule } from './rules';

export const TOY_ID = 'shape-builder';
export type Build = { id: string; rule: GridRule; name: string; tip: string; key: string };
export const BUILDS: Build[] = [
  { id: 'tri', rule: { k: 'poly', sides: 3 }, name: 'a triangle', tip: 'Three pegs, then back to the first.', key: 'sh-sides:build' },
  { id: 'square', rule: { k: 'quad', name: 'square' }, name: 'a square', tip: 'Four equal sides and four square corners.', key: 'sh-quad:draw' },
  { id: 'rect', rule: { k: 'quad', name: 'rect-not-square' }, name: 'a long rectangle', tip: 'Square corners, but longer one way.', key: 'sh-quad:draw' },
  { id: 'five', rule: { k: 'poly', sides: 5 }, name: 'a shape with 5 sides', tip: 'Like a little house: a square with a roof.', key: 'sh-sides:build' },
  { id: 'righttri', rule: { k: 'poly', sides: 3, rightMin: 1 }, name: 'a right triangle', tip: 'A triangle with one square corner.', key: 'sh-sides:build' },
  { id: 'six', rule: { k: 'poly', sides: 6 }, name: 'a hexagon', tip: 'Six sides. An L shape counts too!', key: 'sh-sides:build' },
  { id: 'trap', rule: { k: 'quad', name: 'trapezoid' }, name: 'a trapezoid', tip: 'Just one pair of sides going the same way.', key: 'sh-quad:draw' },
  { id: 'para', rule: { k: 'quad', name: 'parallelogram' }, name: 'a parallelogram', tip: 'A rectangle that leans over.', key: 'sh-quad:draw' },
  { id: 'rhombus', rule: { k: 'quad', name: 'rhombus' }, name: 'a rhombus', tip: 'Four equal sides, but no square corners: try a diamond.', key: 'sh-quad:draw' },
  { id: 'area4', rule: { k: 'area', area: 4, shape: 'triangle' }, name: 'a triangle with area 4', tip: 'Base × height ÷ 2 = 4. Try a base of 4 and a height of 2.', key: 'sh-area:build' },
  { id: 'house', rule: { k: 'poly', sides: 5, rightMin: 2 }, name: 'a pentagon with 2 right angles', tip: 'A house shape has square corners at the bottom.', key: 'sh-sides:build' },
  { id: 'para8', rule: { k: 'area', area: 8, shape: 'parallelogram' }, name: 'a parallelogram with area 8', tip: 'Base × height = 8: a base of 4 and a height of 2.', key: 'sh-area:build' },
];
export const buildNamed = (b: Build) => b.name;
export const builderOf = (p: Profile): ArcadeRecord => mathOf(p).arcade?.[TOY_ID] ?? { best: 0, stars: 0, plays: 0, done: [] };

/** A build made: kept for good; its skill (if met) remembers it as a right answer. */
export function noteBuild(p: Profile, id: string, ok: boolean, at = Date.now()) {
  const m = (p.math = mathOf(p));
  const rec = ((m.arcade ??= {})[TOY_ID] ??= { best: 0, stars: 0, plays: 0, done: [] });
  rec.done ??= [];
  if (ok && !rec.done.includes(id)) rec.done.push(id);
  rec.best = rec.done.length;
  rec.stars = rec.best >= 12 ? 3 : rec.best >= 8 ? 2 : rec.best >= 4 ? 1 : 0;
  rec.plays++;
  const b = BUILDS.find(x => x.id === id);
  const mem = m.skills ?? {};
  if (b && ((mem[b.key]?.stage ?? 0) > 0 || (mem[b.key]?.seen ?? 0) > 0)) noteSkillAnswers(m, [{ key: b.key, ok, thinkMs: 8000 }], at);
}

/** A shape's facts in a sentence for the buddy: "3 sides, 3 corners, one right angle." */
export function shapeWords(f: ShapeFacts): string {
  const bits = [`${f.sides} sides and ${f.corners} corners`];
  if (f.right) bits.push(f.right === 1 ? 'one right angle' : `${f.right} right angles`);
  if (f.obtuse) bits.push(f.obtuse === 1 ? 'one obtuse angle' : `${f.obtuse} obtuse angles`);
  if (f.symmetry) bits.push(f.symmetry === 1 ? 'one line of symmetry' : `${f.symmetry} lines of symmetry`);
  return `${bits.join(', ')}.`.replace(/^./, c => c.toUpperCase());
}
