// Ratios and percents: the pictures its questions show (drawn by ui/RatioPic.svelte) and the fruit of the
// Juice Jungle. Kept apart from types.ts so the area's own pictures live in its own files: a question line
// carries one as a { t: 'rpic' } part.

/** The jungle's fruit: painted at public/math/ratios/fruit/<id>.webp, made in 3D for the Learn episodes
 *  and Smoothie Stand. */
export type Fruit = 'straw' | 'banana' | 'berry' | 'mango' | 'kiwi' | 'orange';
export const FRUITS: Fruit[] = ['straw', 'banana', 'berry', 'mango', 'kiwi', 'orange'];
export const FRUIT: Record<Fruit, { one: string; many: string; color: string }> = {
  straw: { one: 'strawberry', many: 'strawberries', color: '#ef3b53' },
  banana: { one: 'banana', many: 'bananas', color: '#f6cf3a' },
  berry: { one: 'blueberry', many: 'blueberries', color: '#4b5fc8' },
  mango: { one: 'mango', many: 'mangoes', color: '#f7932e' },
  kiwi: { one: 'kiwi', many: 'kiwis', color: '#8cc63f' },
  orange: { one: 'orange', many: 'oranges', color: '#ff9a1f' },
};
/** "1 banana", "3 bananas" */
export const fruitWord = (f: Fruit, n: number) => (n === 1 ? FRUIT[f].one : FRUIT[f].many);

export type RatioPic =
  /** fruit on plates: each plate holds `sets` (2 strawberries and 3 bananas); `plates` of them (1 if not given) */
  | { kind: 'fruit'; sets: { f: Fruit; n: number }[]; plates?: number }
  /** a small table of x and y (proportional or not), its two column names */
  | { kind: 'table'; head: [string, string]; rows: [number, number][] }
  /** points on a grid from 0, joined by a line or not (proportional: a straight line through 0) */
  | { kind: 'graph'; pts: [number, number][]; line: boolean; max: [number, number]; names?: [string, string] }
  /** a map strip: `cm` long on the drawing, labelled with the scale */
  | { kind: 'scale'; cm: number; label: string };

/** A picture in a few words (results lists, battle cards). */
export function ratioPicText(p: RatioPic): string {
  if (p.kind === 'fruit') return p.sets.map(s => `${s.n * (p.plates ?? 1)} ${fruitWord(s.f, s.n * (p.plates ?? 1))}`).join(', ');
  if (p.kind === 'table') return p.rows.map(([x, y]) => `${x}→${y}`).join(', ');
  if (p.kind === 'graph') return `a graph through ${p.pts.map(([x, y]) => `(${x}, ${y})`).join(' ')}`;
  return `${p.cm} cm on the map`;
}
