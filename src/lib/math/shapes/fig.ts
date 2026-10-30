// A shapes picture as plain data (a question's `{ t: 'fig' }` part, a choice, the Shape Shifter's crystal,
// a Learn episode's card): crystal tiles (polygons, optionally cut into parts, with their right-angle
// squares, equal-side ticks, side lengths and lines of symmetry), angles made of two rays and an arc, open
// lines, circles with a radius or diameter, painted solids, boxes of cubes, and a grid of squares, dots or
// a coordinate plane behind. Coordinates are grid units, x right and y down, in a box `w` by `h`;
// math/shapes/ui/ShapePic.svelte draws it.
import type { P } from './geo';

/** The crystal colours (each shape's tint) */
export type FigHue = 'teal' | 'rose' | 'gold' | 'violet' | 'sky' | 'mint' | 'pale';
export const HUES: FigHue[] = ['teal', 'rose', 'gold', 'violet', 'sky', 'mint'];
export const HUE_RGB: Record<FigHue, { fill: string; edge: string; deep: string }> = {
  teal: { fill: '#2fd0bb', edge: '#14998a', deep: '#0b6a5f' },
  rose: { fill: '#ff6fa3', edge: '#d63b77', deep: '#9c2156' },
  gold: { fill: '#ffc93d', edge: '#e09a0e', deep: '#9b6200' },
  violet: { fill: '#a283ff', edge: '#6f4ff0', deep: '#4a2eb5' },
  sky: { fill: '#5cb6ff', edge: '#2a82dc', deep: '#1a59a8' },
  mint: { fill: '#6fe09a', edge: '#2fae62', deep: '#1c7840' },
  pale: { fill: '#f4f1fb', edge: '#b9b0d6', deep: '#7d74a0' },
};

/** The painted solids (public/math/shapes/solid-*.webp) */
export type SolidId = 'cube' | 'box' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'prism';
export const SOLID_NAME: Record<SolidId, string> = { cube: 'cube', box: 'rectangular prism', sphere: 'sphere', cylinder: 'cylinder', cone: 'cone', pyramid: 'pyramid', prism: 'triangular prism' };
/** faces, edges and corners of each solid (a sphere, a cylinder and a cone have curved faces: their flat ones) */
export const SOLID_FACTS: Record<SolidId, { faces: number; edges: number; corners: number; flat: number; rolls: boolean }> = {
  cube: { faces: 6, edges: 12, corners: 8, flat: 6, rolls: false }, box: { faces: 6, edges: 12, corners: 8, flat: 6, rolls: false },
  sphere: { faces: 1, edges: 0, corners: 0, flat: 0, rolls: true }, cylinder: { faces: 3, edges: 2, corners: 0, flat: 2, rolls: true },
  cone: { faces: 2, edges: 1, corners: 1, flat: 1, rolls: true }, pyramid: { faces: 5, edges: 8, corners: 5, flat: 5, rolls: false },
  prism: { faces: 5, edges: 9, corners: 6, flat: 5, rolls: false },
};

export type FigPoly = {
  pts: P[];
  hue?: FigHue;
  /** an open path (a line, a ray), not a closed tile */
  open?: boolean;
  /** dashed (a fold line, a line of symmetry) */
  dash?: boolean;
  /** lines across the tile (equal or unequal parts) */
  cuts?: [P, P][];
  /** pieces of the tile coloured in (each a polygon), on top of it */
  parts?: { pts: P[]; hue: FigHue }[];
  /** small squares in these corners (right angles) */
  right?: number[];
  /** tick marks on sides (index: how many ticks) to show equal sides */
  ticks?: Record<number, number>;
  /** words by sides (index: text), like lengths */
  sideText?: Record<number, string>;
  /** arcs in these corners, with their words (an angle's size, a letter) */
  arcs?: Record<number, string>;
  /** arrows on sides (index: how many arrowheads) to show parallel sides */
  arrows?: Record<number, number>;
  /** a word or number shown in the middle (short: '?', '25') */
  label?: string;
  /** what it is, in words, for lists and battle cards (never shown on it) */
  name?: string;
  /** an id the shape-pick input answers with */
  id?: string;
};
export type FigAngle = { at: P; from: number; to: number; len: number; hue?: FigHue; text?: string; right?: boolean; arc?: boolean };
export type FigCircle = { c: P; r: number; hue?: FigHue; radius?: string; diameter?: string; label?: string };
export type FigBox = { at: P; l: number; w: number; h: number; hue?: FigHue; /** every cube drawn (to count them) */ cubes?: boolean; /** words on its length, width and height edges */ labels?: [string, string, string] };
export type FigText = { at: P; text: string; size?: number };
export type FigDot = { at: P; text?: string; hue?: FigHue };
export type Fig = {
  w: number; h: number;
  /** behind it all: a grid of squares, dots, or a coordinate plane with numbered axes from 0 */
  grid?: 'squares' | 'dots' | 'axes';
  polys?: FigPoly[];
  angles?: FigAngle[];
  circles?: FigCircle[];
  boxes?: FigBox[];
  dots?: FigDot[];
  texts?: FigText[];
  /** a painted solid fills the picture */
  solid?: SolidId;
};

/** A shape in words for lists and battle cards ("a hexagon", "a 50° angle"). */
export function figText(f: Fig): string {
  if (f.solid) return `a ${SOLID_NAME[f.solid]}`;
  if (f.angles?.length === 1 && !f.polys?.length) { const a = f.angles[0]; return a.text ? `an angle of ${a.text}` : 'an angle'; }
  if (f.boxes?.length) { const b = f.boxes[0]; return b.labels ? `a box ${b.labels.join(' by ')}` : `a box ${b.l} by ${b.w} by ${b.h}`; }
  if (f.circles?.length) return 'a circle';
  const p = f.polys?.find(x => !x.open);
  return p?.name ?? (p ? 'a shape' : 'a picture');
}
