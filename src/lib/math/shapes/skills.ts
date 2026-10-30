// Shapes and angles, kindergarten to grade 8 (Common Core K.G, 1.G, 2.G, 3.G, 4.MD.C, 4.G, 5.G.B, 6.G,
// 7.G.B and 8.G): naming flat and solid shapes, sides and corners, equal parts, four-sided shapes, angles
// (their kinds, measuring with a protractor, making them, adding them), lines and symmetry, the families of
// shapes, the area of triangles and other polygons, boxes (volume, nets and surface area), angle facts,
// circles, the Pythagorean theorem, and slides, flips and turns. Every picture is a crystal shape
// (math/shapes/fig.ts); the area brings four inputs of its own: tap the shapes that fit ('shape-pick'),
// turn a protractor and read it ('protractor'), drag a ray to make an angle ('angle-maker'), and tap pegs
// on a dot grid to make a shape ('dot-grid').
//
// Every skill has six rungs (skills/types.ts): rung 1 gentle (upright shapes, round numbers, a picture to
// help), rung 3 the grade's core, rungs 4 to 6 the stretch inside the same standard (shapes turned and
// lopsided, closer choices, fives and single degrees, more steps, missing parts). Each skill's comment says
// what its rungs are. No generator ever draws again "until it's different": every choice comes from a list
// that already leaves out what it mustn't be, so a question is made in one go.
import type { Rng } from '../../engine/rng';
import { checkAnswer } from '../skills/fractions';
import { perRung, rungOf, type Answer, type Choice, type Item, type Part, type Skill } from '../skills/types';
import { HUES, SOLID_FACTS, SOLID_NAME, type Fig, type FigAngle, type FigHue, type FigPoly, type SolidId } from './fig';
import { factsOf, fit, regular, symmetryLines, turn, type P } from './geo';
import { KIND_NAME, an, isA, others, plural, shapeOf, type Kind } from './kinds';
import { CUTS_FOR, PARTS_WORD, PART_WORD, cut, type CutKind } from './pieces';
import { decodePts, encodePts, exampleFor, ruleOk, ruleText, type GridRule } from './rules';

// ---------- little helpers ----------
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const int = (rng: Rng, lo: number, hi: number) => Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));
function shuffle<T>(rng: Rng, xs: readonly T[]): T[] { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** n different items from a list (shuffled; never loops) */
const some = <T>(rng: Rng, xs: readonly T[], n: number) => shuffle(rng, xs).slice(0, n);
/** a decimal without float dust */
const dec = (x: number, places = 3) => Number(x.toFixed(places));
const tx = (s: string): Part => ({ t: 'text', s });
const num = (n: number): Part => ({ t: 'num', n });
const op = (s: string): Part => ({ t: 'op', s });
const blank: Part = { t: 'blank' };
const fig = (f: Fig): Part => ({ t: 'fig', fig: f });
const hueOf = (rng: Rng): FigHue => pick(rng, HUES);
const tile = (pts: P[], hue: FigHue, more: Partial<FigPoly> = {}): FigPoly => ({ pts, hue, ...more });
const one = (pts: P[], hue: FigHue, more: Partial<FigPoly> = {}, extra: Partial<Fig> = {}): Fig => ({ w: 10, h: 10, polys: [tile(pts, hue, more)], ...extra });
const round1 = (x: number) => Math.round(x * 10) / 10;
const idOf = (pts: P[]) => pts.map(([x, y]) => `${round1(x)},${round1(y)}`).join(' ');
/** word choices, shuffled; the answer is the right word's id */
function wordChoices(rng: Rng, right: string, wrong: string[]): Choice[] {
  return shuffle(rng, [right, ...wrong.filter(w => w !== right)]).map(w => ({ id: w, parts: [tx(w)] }));
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** a picture of a kind of shape (a circle is drawn round) */
function kindFig(rng: Rng, kind: Kind, wild: boolean, deg: number, hue = hueOf(rng)): Fig {
  if (kind === 'circle') return { w: 10, h: 10, circles: [{ c: [5, 5], r: 4.1, hue }] };
  return one(shapeOf(rng, kind, { wild, turn: deg }), hue, { name: an(KIND_NAME[kind]) });
}
const deg = (rng: Rng, r: number) => (r <= 1 ? 0 : r === 2 ? pick(rng, [0, 15, 30, 45]) : int(rng, 0, 35) * 10);
const base = (skill: string, sub: string) => ({ skill, key: `${skill}:${sub}` });
const check = (it: Item, a: Answer) => checkAnswer(it.answer, a);

// ---------- name the shape (K) ----------
const FLAT_WHY: Partial<Record<Kind, string>> = {
  circle: 'round all the way, with no corners', triangle: '3 straight sides and 3 corners', square: '4 equal sides and 4 square corners',
  rectangle: '4 sides and 4 square corners', hexagon: '6 sides and 6 corners', pentagon: '5 sides and 5 corners', octagon: '8 sides and 8 corners',
  rhombus: '4 equal sides, leaning over', trapezoid: '4 sides, and just one pair of them go the same way',
};
const SOLID_WHY: Record<SolidId, string> = {
  cube: '6 square faces, like a dice', box: '6 rectangle faces, like a cereal box', sphere: 'round all over, like a ball', cylinder: 'two round flat faces, like a can',
  cone: 'one round flat face and a point, like an ice cream cone', pyramid: 'a square bottom and triangles that meet at a point', prism: 'two triangle ends joined by rectangles, like a tent',
};
// rungs: 1 circle, triangle, square, rectangle sitting flat, three choices · 2 the same, turned · 3 adds
// hexagons and lopsided, skinny ones · 4 adds pentagons and octagons, four choices · 5 adds rhombuses and
// trapezoids · 6 the least usual members of every kind, turned any way. Solids: 1-2 cube, sphere, cylinder,
// cone · 3-4 adds pyramids and boxes · 5-6 adds triangular prisms, four choices. Find them all: 1 four
// shapes · 2 five, turned · 3 six with lopsided ones · 4 seven · 5-6 eight, the targets in their least
// usual shapes beside lookalikes.
export const shName: Skill = {
  id: 'sh-name', area: 'shapes', grade: 0, standard: 'K.G.A.2',
  name: 'Name the shape', short: 'Shape names', plain: 'Names flat shapes (circle, triangle, square, rectangle, hexagon) and solid ones (cube, sphere, cylinder, cone), whichever way they are turned.',
  input: 'choice', fastMs: 5000,
  subs: [{ id: 'flat', label: 'flat shapes' }, { id: 'solid', label: 'solid shapes' }, { id: 'find', label: 'find them all' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const pool: Kind[] = ['circle', 'triangle', 'square', 'rectangle', ...(r >= 3 ? ['hexagon' as Kind] : []), ...(r >= 4 ? ['pentagon', 'octagon'] as Kind[] : []), ...(r >= 5 ? ['rhombus', 'trapezoid'] as Kind[] : [])];
    const trick = { name: 'Count the corners', say: 'Count the sides and the corners, and look for square corners. Turning a shape round never changes its name.' };
    if (sub === 'solid') {
      const sp: SolidId[] = ['cube', 'sphere', 'cylinder', 'cone', ...(r >= 3 ? ['pyramid', 'box'] as SolidId[] : []), ...(r >= 5 ? ['prism' as SolidId] : [])];
      const s = pick(rng, sp), n = r >= 5 ? 4 : 3;
      const choices = wordChoices(rng, SOLID_NAME[s], some(rng, sp.filter(x => x !== s), n - 1).map(x => SOLID_NAME[x]));
      return { ...base('sh-name', sub), id: `sh-name:solid:${s}:${choices.map(c => c.id).join('|')}`, ask: 'What solid shape is it?', prompt: [fig({ w: 10, h: 10, solid: s })],
        input: 'choice', choices, answer: { kind: 'choice', id: SOLID_NAME[s] }, weight: r >= 5 ? 2 : 1,
        explain: `It's ${an(SOLID_NAME[s])}: ${SOLID_WHY[s]}.`, trick: { name: 'Faces and points', say: 'Look at its faces: flat or round? Does it have a point? A cube has 6 squares; a cylinder has 2 circles.' } };
    }
    if (sub === 'find') {
      const targets: Kind[] = ['triangle', 'square', 'circle', ...(r >= 2 ? ['rectangle' as Kind] : []), ...(r >= 3 ? ['hexagon' as Kind] : [])];
      const k = pick(rng, targets), n = perRung(r, [4, 5, 6, 7, 8, 8]);
      const decoys = others(k, [...pool, 'pentagon', 'hexagon', 'trapezoid', 'rhombus'].filter((x, i, a) => a.indexOf(x) === i) as Kind[]);
      const hits = int(rng, 1, Math.max(1, Math.floor(n / 2)));
      const kinds = shuffle(rng, [...Array(hits).fill(k), ...Array.from({ length: n - hits }, () => pick(rng, decoys))] as Kind[]);
      const wild = (i: number) => r >= 5 ? i % 2 === 0 : r >= 3 && i % 3 === 0;
      const figs = kinds.map((kk, i) => kindFig(rng, kk, wild(i), deg(rng, r)));
      const ans = kinds.map((kk, i) => (kk === k ? i : -1)).filter(i => i >= 0).join(',');
      const word = KIND_NAME[k];
      return { ...base('sh-name', sub), id: `sh-name:find:${k}:${n}:${kinds.join('.')}:${r >= 5 ? 'w' : r >= 3 ? 'm' : 's'}`, ask: `Tap every ${word}, then tap Done.`, prompt: [tx(`Find every ${word}`)],
        input: 'custom', custom: { name: 'shape-pick', spec: { figs, word } }, choices: [{ id: ans, parts: [tx(`the ${hits === 1 ? word : `${hits} ${plural(word)}`}`)] }],
        answer: { kind: 'choice', id: ans }, weight: Math.min(5, 1 + Math.floor(n / 3)),
        explain: `There ${hits === 1 ? `is 1 ${word}` : `are ${hits} ${plural(word)}`}: ${FLAT_WHY[k] ?? ''}.`, trick };
    }
    const kind = pick(rng, pool), wild = r >= 3 && rng() < perRung(r, [0, 0, 0.35, 0.4, 0.5, 0.75]), turnBy = deg(rng, r);
    const n = r >= 4 ? 4 : 3;
    const choices = wordChoices(rng, KIND_NAME[kind], some(rng, others(kind, pool), n - 1).map(x => KIND_NAME[x]));
    return { ...base('sh-name', sub), id: `sh-name:flat:${kind}:${wild ? 'w' : ''}${turnBy}:${n}`, ask: 'What shape is it?', prompt: [fig(kindFig(rng, kind, wild, turnBy))],
      input: 'choice', choices, answer: { kind: 'choice', id: KIND_NAME[kind] }, weight: Math.min(5, 1 + (r >= 4 ? 1 : 0) + (wild ? 1 : 0)),
      explain: `It's ${an(KIND_NAME[kind])}: ${FLAT_WHY[kind] ?? ''}.`, trick };
  },
  check: (it, a) => (it.custom?.name === 'shape-pick' && a.kind === 'choice' && it.answer.kind === 'choice' ? samePicks(a.id, it.answer.id) : check(it, a)),
};
/** Two lists of picked shapes ("0,3,5") are the same picks. */
export const samePicks = (a: string, b: string) => a.split(',').filter(Boolean).map(Number).sort((x, y) => x - y).join(',') === b.split(',').filter(Boolean).map(Number).sort((x, y) => x - y).join(',');

// ---------- sides and corners (1-2) ----------
/** a convex shape with n corners, all on a circle (each corner clear to see), or a shape with dents */
function polyWith(rng: Rng, n: number, irregular: boolean): P[] {
  if (!irregular) return regular(n, 4.2, 5, 5, int(rng, 0, 7) * 5);
  const step = 360 / n;
  const as = Array.from({ length: n }, (_, i) => i * step + (rng() - 0.5) * step * 0.45);
  return as.map(a => [5 + 4.2 * Math.cos((a * Math.PI) / 180), 5 + 4.2 * Math.sin((a * Math.PI) / 180)] as P);
}
function dented(rng: Rng, n: number): P[] {
  if (n === 6) return fit(turn([[0, 0], [2, 0], [2, 3], [5, 3], [5, 5], [0, 5]], int(rng, 0, 3) * 90, 2.5, 2.5), 10, 10);
  if (n === 7) return fit(turn([[0, 2], [3, 2], [3, 0], [6, 3], [3, 6], [3, 4], [0, 4]], int(rng, 0, 3) * 90, 3, 3), 10, 10);
  // a star with n/2 points
  const k = n / 2;
  return Array.from({ length: n }, (_, i) => { const a = ((-90 + (i * 180) / k) * Math.PI) / 180, rr = i % 2 ? 2.1 : 4.4; return [5 + rr * Math.cos(a), 5 + rr * Math.sin(a)] as P; });
}
// rungs: 1 triangles and squares sitting flat (dots on the corners) · 2 up to 5 sides, turned · 3 up to 6,
// lopsided ones · 4 up to 8 · 5 shapes with dents (an arrow, an L, a star) · 6 up to 10 corners, dents and
// all. Faces: 1-2 a cube's or a box's faces · 3 the flat faces of any solid · 4 corners · 5 a box's edges ·
// 6 the edges of pyramids and prisms. Build on the dot grid: 1 three sides · 2 four · 3 five · 4 six · 5 five
// with a right angle · 6 six with at least two right angles.
export const shSides: Skill = {
  id: 'sh-sides', area: 'shapes', grade: 2, standard: '2.G.A.1',
  name: 'Sides and corners', short: 'Sides', plain: 'Counts the sides and corners of flat shapes and the faces, edges and corners of solid ones, and draws a shape with a given number of sides.',
  input: 'number', fastMs: 6000,
  subs: [{ id: 'sides', label: 'count the sides' }, { id: 'corners', label: 'count the corners' }, { id: 'faces', label: 'faces of solids' }, { id: 'build', label: 'make a shape' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const trick = { name: 'Touch and count', say: 'Put your finger on one corner and go round, counting each corner once. A shape has as many sides as corners.' };
    if (sub === 'faces') {
      const which = perRung(r, ['faces', 'faces', 'faces', 'corners', 'edges', 'edges'] as const);
      const sp: SolidId[] = r <= 2 ? ['cube', 'box'] : which === 'faces' ? ['cube', 'box', 'pyramid', 'prism', 'cylinder', 'cone'] : which === 'corners' ? ['cube', 'pyramid', 'prism', 'box'] : r === 5 ? ['cube', 'box'] : ['pyramid', 'prism'];
      const s = pick(rng, sp), f = SOLID_FACTS[s];
      const ans = which === 'faces' ? f.flat : which === 'corners' ? f.corners : f.edges;
      const word = which === 'faces' ? 'flat faces' : which === 'corners' ? 'corners' : 'edges';
      return { ...base('sh-sides', sub), id: `sh-sides:faces:${s}:${which}`, ask: `How many ${word} does the ${SOLID_NAME[s]} have?`, prompt: [fig({ w: 10, h: 10, solid: s }), op('='), blank],
        input: 'number', answer: { kind: 'number', value: ans }, weight: Math.min(5, 1 + (which === 'faces' ? 0 : which === 'corners' ? 1 : 2) + (r >= 3 ? 1 : 0)),
        explain: `${cap(an(SOLID_NAME[s]))} has ${f.flat} flat faces, ${f.edges} edges and ${f.corners} corners. ${which === 'edges' ? 'An edge is where two faces meet.' : which === 'corners' ? 'A corner is where edges meet at a point.' : ''}`.trim(),
        trick: { name: 'Count round it', say: which === 'edges' ? 'Count the edges round the top, round the bottom, then the ones going up.' : which === 'corners' ? 'Count the corners on top, then the corners on the bottom.' : 'Count the face on top, the bottom, then the faces round the sides.' } };
    }
    if (sub === 'build') {
      const rule: GridRule = perRung(r, [{ k: 'poly', sides: 3 }, { k: 'poly', sides: 4 }, { k: 'poly', sides: 5 }, { k: 'poly', sides: 6 }, { k: 'poly', sides: 5, rightMin: 1 }, { k: 'poly', sides: 6, rightMin: 2 }] as GridRule[]);
      return gridItem('sh-sides', sub, rule, 6, Math.min(5, r), trick);
    }
    const nPool = perRung(r, [[3, 4], [3, 4, 5], [3, 4, 5, 6], [4, 5, 6, 7, 8], [6, 7, 10], [6, 7, 8, 9, 10]]);
    const n = pick(rng, nPool);
    const dents = r >= 5 && (n === 6 || n === 7 || n === 10 || (r === 6 && n === 8)) && rng() < 0.7;
    const pts = dents ? dented(rng, n) : n <= 4 && r === 1 ? shapeOf(rng, n === 3 ? 'triangle' : 'square') : polyWith(rng, n, r >= 3);
    const corners = sub === 'corners';
    const f = one(pts, hueOf(rng), {}, corners && r === 1 ? { dots: pts.map(p => ({ at: p })) } : {});
    return { ...base('sh-sides', sub), id: `sh-sides:${sub}:${n}:${dents ? 'd' : r >= 3 ? 'i' : 'r'}:${idOf(pts).slice(0, 18)}`, ask: corners ? 'How many corners?' : 'How many sides?', prompt: [fig(f), op('='), blank],
      input: 'number', answer: { kind: 'number', value: n }, weight: Math.min(5, n <= 4 ? 1 : n <= 6 ? 2 : 3 + (dents ? 1 : 0)),
      explain: `Go round once: ${Array.from({ length: n }, (_, i) => i + 1).join(', ')}. It has ${n} ${corners ? 'corners' : 'sides'}${dents ? ', even the ones that point in' : ''}.`, trick };
  },
  check: (it, a) => gridCheck(it, a) ?? check(it, a),
};
/** A make-it-on-the-dot-grid item: the rule, an example shape for the answer. */
function gridItem(skill: string, sub: string, rule: GridRule, size: number, weight: number, trick: { name: string; say: string }): Item {
  const ex = exampleFor(rule), id = encodePts(ex);
  return { ...base(skill, sub), id: `${skill}:${sub}:${JSON.stringify(rule)}`, ask: ruleText(rule), prompt: [tx(ruleText(rule).replace(/\.$/, ''))],
    input: 'custom', custom: { name: 'dot-grid', spec: { cols: size, rows: size, rule } }, choices: [{ id, parts: [fig({ w: size - 1, h: size - 1, grid: 'dots', polys: [tile(ex, 'teal')] })] }],
    answer: { kind: 'choice', id }, weight: Math.max(1, Math.min(5, weight)),
    explain: `One way is shown. ${ruleText(rule)}`, trick };
}
/** A dot-grid answer: any shape that follows the rule (null: not a dot-grid item). */
function gridCheck(it: Item, a: Answer): boolean | null {
  if (it.custom?.name !== 'dot-grid') return null;
  if (a.kind !== 'choice') return false;
  const pts = decodePts(a.id), rule = (it.custom.spec as { rule: GridRule }).rule;
  return !!pts && ruleOk(rule, pts);
}

// ---------- equal parts (2-3) ----------
// rungs: 1 halves of rectangles and circles · 2 halves and quarters · 3 thirds too · 4 cuts across the
// corners, triangles and hexagons · 5 sixths and eighths, the same parts in different shapes · 6 unequal
// cuts that are very close, and several parts coloured in
export const shParts: Skill = {
  id: 'sh-parts', area: 'shapes', grade: 2, standard: '2.G.A.3',
  name: 'Equal parts', short: 'Equal parts', plain: 'Cuts shapes into equal parts and names them: halves, thirds and quarters (and, in grade 3, each part as a fraction of the whole: 1/4).',
  input: 'choice', fastMs: 7000,
  subs: [{ id: 'equal', label: 'equal or not' }, { id: 'name', label: 'halves, thirds, quarters' }, { id: 'frac', label: 'each part as a fraction' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const ns = perRung(r, [[2], [2, 4], [2, 3, 4], [2, 3, 4], [3, 4, 6, 8], [2, 3, 4, 6, 8]]);
    const n = pick(rng, ns);
    const kinds = CUTS_FOR[n].filter(k => (r <= 3 ? k === 'strips' || k === 'grid' || k === 'circle' : true));
    const ck: CutKind = pick(rng, kinds.length ? kinds : CUTS_FOR[n]);
    const trick = { name: 'Same size pieces', say: 'Equal parts are all exactly the same size. 2 equal parts are halves, 3 are thirds, 4 are quarters.' };
    const pic = (c: ReturnType<typeof cut>, gold: number[], hue: FigHue): Fig => ({ w: 10, h: 10, polys: c.pieces.map((pp, i) => tile(pp, gold.includes(i) ? 'gold' : hue)) });
    if (sub === 'equal') {
      const off = perRung(r, [0.5, 0.42, 0.34, 0.26, 0.18, 0.1]);
      const good = rng() < 0.5 && r >= 3 ? pick(rng, CUTS_FOR[n]) : ck;
      const opts = [{ id: 'a', c: cut(good, n, 0) }, { id: 'b', c: cut(ck, n, off) }, { id: 'c', c: cut(pick(rng, CUTS_FOR[n]), n, off * 1.3) }];
      const hue = hueOf(rng);
      const choices = shuffle(rng, opts).map((o, i) => ({ id: ['x', 'y', 'z'][i] + o.id, parts: [fig(pic(o.c, [], hue))] }));
      const right = choices.find(c => c.id.endsWith('a'))!.id;
      return { ...base('sh-parts', sub), id: `sh-parts:equal:${n}:${good}:${ck}:${off}:${choices.map(c => c.id).join('')}`, ask: `Which one is cut into ${PARTS_WORD[n]}: ${n} equal parts?`, prompt: [tx(`${n} equal parts`)],
        input: 'choice', choices, answer: { kind: 'choice', id: right }, weight: Math.min(5, 1 + (r >= 4 ? 2 : r >= 2 ? 1 : 0)),
        explain: `In the right one every part is the same size. The others have big and small parts, so they aren't ${PARTS_WORD[n]}.`, trick };
    }
    const c = cut(ck, n, 0), hue = hueOf(rng);
    // (several parts gold from rung 4: never all of them)
    const many = sub === 'frac' && r >= 4 && n > 2 ? int(rng, 2, n - 1) : 1;
    const gold = Array.from({ length: many }, (_, i) => i);
    if (sub === 'name') {
      const right = an(PART_WORD[n]), wrong = [2, 3, 4, 6, 8].filter(x => x !== n && (r >= 5 || x <= 4)).map(x => an(PART_WORD[x]));
      const choices = wordChoices(rng, right, some(rng, wrong, r >= 5 ? 3 : 2));
      return { ...base('sh-parts', sub), id: `sh-parts:name:${n}:${ck}:${choices.map(x => x.id).join('|')}`, ask: 'The shape is cut into equal parts. The gold part is...', prompt: [fig(pic(c, gold, hue))],
        input: 'choice', choices, answer: { kind: 'choice', id: right }, weight: Math.min(5, n <= 2 ? 1 : n <= 4 ? 2 : 3),
        explain: `${n} equal parts: each one is ${right}.`, trick };
    }
    return { ...base('sh-parts', sub), id: `sh-parts:frac:${n}:${many}:${ck}`, ask: 'What fraction of the shape is gold?', prompt: [fig(pic(c, gold, hue)), op('='), blank],
      input: 'fraction', answer: { kind: 'fraction', n: many, d: n }, weight: Math.min(5, (n <= 4 ? 1 : 2) + (many > 1 ? 1 : 0)),
      explain: `${n} equal parts, so each is 1/${n}. ${many} ${many === 1 ? 'is' : 'are'} gold: ${many}/${n}.`,
      trick: { name: 'Bottom: all the parts', say: 'The bottom number is how many equal parts in all. The top is how many are gold.' } };
  },
  check: (it, a) => check(it, a),
};

// ---------- four-sided shapes (3) ----------
const QUADS: Kind[] = ['square', 'rectangle', 'rhombus', 'trapezoid', 'parallelogram', 'kite'];
const QUAD_WHY: Partial<Record<Kind, string>> = {
  square: '4 equal sides and 4 right angles', rectangle: '4 right angles', rhombus: '4 equal sides', parallelogram: '2 pairs of sides that go the same way (parallel)',
  trapezoid: 'just one pair of sides that go the same way', kite: 'two short sides next to each other and two long ones', quadrilateral: '4 sides',
};
// rungs: 1 squares and rectangles sitting flat · 2 adds rhombuses, turned · 3 adds trapezoids and
// parallelograms · 4 adds kites, four choices · 5 lopsided members, turned more · 6 every kind, the least
// usual members. Find: 1-2 every quadrilateral · 3 every rectangle (squares count) · 4 every rhombus ·
// 5 every parallelogram · 6 every shape with 4 right angles. Make one: 1 a square · 2 a rectangle that
// isn't a square · 3 four sides but not a rectangle · 4 a trapezoid · 5 a parallelogram · 6 a rhombus.
export const shQuad: Skill = {
  id: 'sh-quad', area: 'shapes', grade: 3, standard: '3.G.A.1',
  name: 'Four-sided shapes', short: '4 sides', plain: 'Knows the four-sided shapes (quadrilaterals): squares, rectangles, rhombuses, trapezoids and parallelograms, and that a square is also a rectangle and a rhombus.',
  input: 'choice', fastMs: 6000,
  subs: [{ id: 'name', label: 'name it' }, { id: 'find', label: 'find the family' }, { id: 'draw', label: 'make one' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const pool = QUADS.slice(0, perRung(r, [2, 3, 5, 6, 6, 6]));
    const trick = { name: 'Check the sides and corners', say: 'Are the sides equal? Are the corners square? Do the sides go the same way? A square is a rectangle AND a rhombus.' };
    if (sub === 'draw') {
      const rule: GridRule = { k: 'quad', name: perRung(r, ['square', 'rect-not-square', 'not-rect', 'trapezoid', 'parallelogram', 'rhombus'] as const) };
      return gridItem('sh-quad', sub, rule, 6, r, trick);
    }
    if (sub === 'find') {
      const fam = perRung(r, ['quadrilateral', 'quadrilateral', 'rectangle', 'rhombus', 'parallelogram', 'rectangle'] as Kind[]);
      const word = r === 6 ? 'shape with 4 right angles' : KIND_NAME[fam];
      const n = perRung(r, [5, 6, 6, 7, 8, 8]);
      const all: Kind[] = r <= 2 ? ['square', 'rectangle', 'trapezoid', 'triangle', 'pentagon', 'hexagon', 'circle', 'kite'] : [...QUADS, 'quadrilateral', 'triangle'];
      const yes = all.filter(k => isA(k, fam)), no = all.filter(k => !isA(k, fam));
      const hits = int(rng, 2, Math.max(2, Math.floor(n / 2)));
      const kinds = shuffle(rng, [...Array.from({ length: hits }, (_, i) => yes[(i + int(rng, 0, yes.length - 1)) % yes.length]), ...Array.from({ length: n - hits }, () => pick(rng, no))]);
      const figs = kinds.map((k, i) => kindFig(rng, k, r >= 5 && i % 2 === 1, deg(rng, r)));
      const ans = kinds.map((k, i) => (isA(k, fam) ? i : -1)).filter(i => i >= 0).join(',');
      const note = fam === 'rectangle' ? ' Squares count too!' : fam === 'rhombus' ? ' Squares count too!' : fam === 'parallelogram' ? ' Rectangles, squares and rhombuses count too!' : '';
      return { ...base('sh-quad', sub), id: `sh-quad:find:${fam}:${r}:${kinds.join('.')}`, ask: `Tap every ${word}, then tap Done.${note}`, prompt: [tx(`Find every ${word}`)],
        input: 'custom', custom: { name: 'shape-pick', spec: { figs, word } }, choices: [{ id: ans, parts: [tx(`every ${word}`)] }],
        answer: { kind: 'choice', id: ans }, weight: Math.min(5, r),
        explain: `${cap(an(KIND_NAME[fam]))} has ${QUAD_WHY[fam] ?? '4 sides'}.${note}`, trick };
    }
    const kind = pick(rng, pool), wild = r >= 5 && rng() < 0.6, t = r === 1 ? 0 : deg(rng, r);
    const n = r >= 4 ? 4 : r >= 2 ? 3 : 2;
    const choices = wordChoices(rng, KIND_NAME[kind], some(rng, others(kind, QUADS.slice(0, Math.max(3, pool.length))), n - 1).map(k => KIND_NAME[k]));
    return { ...base('sh-quad', sub), id: `sh-quad:name:${kind}:${wild ? 'w' : ''}${t}:${n}`, ask: 'What is this four-sided shape?', prompt: [fig(kindFig(rng, kind, wild, t))],
      input: 'choice', choices, answer: { kind: 'choice', id: KIND_NAME[kind] }, weight: Math.min(5, 1 + QUADS.indexOf(kind) / 2 + (wild ? 1 : 0)),
      explain: `It's ${an(KIND_NAME[kind])}: ${QUAD_WHY[kind]}.`, trick };
  },
  check: (it, a) => gridCheck(it, a) ?? (it.custom?.name === 'shape-pick' && a.kind === 'choice' && it.answer.kind === 'choice' ? samePicks(a.id, it.answer.id) : check(it, a)),
};

// ---------- angles (4) ----------
const angleFig = (from: number, size: number, more: Partial<FigAngle> = {}): Fig => ({ w: 10, h: 10, angles: [{ at: [5, 6.2], from, to: from + size, len: 4.4, arc: true, ...more }] });
const ANGLE_WHY = { right: 'a square corner: exactly 90°', acute: 'smaller than a square corner: under 90°', obtuse: 'bigger than a square corner but less than a straight line: between 90° and 180°', straight: 'a straight line: 180°' };
const kindName = (d: number) => (d === 90 ? 'right' : d < 90 ? 'acute' : d === 180 ? 'straight' : 'obtuse');
// rungs: kinds: 1 clear right, acute and obtuse (30°, 90°, 150°) · 2 the same, turned · 3 any tens · 4 near a
// right angle (60° to 120°) · 5 adds straight angles, four choices · 6 within 10° of a right angle, turned.
// Measure with the protractor: 1 thirties, already lined up · 2 tens, lined up · 3 tens, turn it to line it
// up · 4 fives, turn it · 5 fives, opening the other way (read the other row of numbers) · 6 fives, any way.
// Make an angle: 1 a right angle · 2 thirties · 3 tens · 4 fives · 5 fives, fewer numbers on the guide ·
// 6 fives past 90°, only every 30° marked. Add them up: 1 two parts in tens · 2 a right angle cut in two:
// find a part · 3 any degrees · 4 a straight angle cut in two · 5 three parts · 6 a full turn in three.
export const shAngle: Skill = {
  id: 'sh-angle', area: 'shapes', grade: 4, standard: '4.MD.C.6',
  name: 'Angles', short: 'Angles', plain: 'Knows right, acute and obtuse angles, measures angles with a protractor, makes an angle of a given size, and adds angles that sit side by side (4.MD.C.5-7).',
  input: 'choice', fastMs: 8000,
  subs: [{ id: 'kind', label: 'right, acute or obtuse' }, { id: 'measure', label: 'measure with a protractor' }, { id: 'make', label: 'make an angle' }, { id: 'add', label: 'angles that add up' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const trick = { name: 'The square corner', say: 'Hold a square corner (a corner of paper) in the angle. Fits exactly: right. Smaller: acute. Bigger: obtuse.' };
    if (sub === 'measure') {
      const step = perRung(r, [30, 10, 10, 5, 5, 5]);
      const d = step * int(rng, 1, Math.floor(175 / step));
      const left = r === 5 || (r === 6 && rng() < 0.5);
      const from = r <= 2 ? (left ? 180 - d : 0) : int(rng, 0, 11) * 30 + (r >= 4 ? 15 : 0);
      const aligned = r <= 2;
      return { ...base('sh-angle', sub), id: `sh-angle:measure:${d}:${from}:${left ? 'L' : 'R'}:${step}`, ask: aligned ? 'Read the protractor: how many degrees?' : 'Turn the protractor so 0 lies on one side of the angle. How many degrees?',
        prompt: [tx('The angle is'), blank, tx('°')], input: 'custom', custom: { name: 'protractor', spec: { deg: d, from, aligned, left, step } },
        answer: { kind: 'number', value: d }, weight: Math.min(5, 1 + Math.floor(r / 1.5)),
        explain: `One side lies on 0. The other side crosses ${d} on the same row of numbers. The angle is ${d}°.`,
        trick: { name: 'Start at 0', say: 'Put the middle of the protractor on the corner and 0 along one side. Read the row of numbers that starts at 0, where the other side crosses.' } };
    }
    if (sub === 'make') {
      const step = perRung(r, [90, 30, 10, 5, 5, 5]);
      const lo = r === 6 ? 95 : step;
      const d = r === 1 ? 90 : step * int(rng, Math.ceil(lo / step), Math.floor(175 / step));
      const from = r <= 3 ? 0 : int(rng, 0, 3) * 90;
      const guide = perRung(r, ['full', 'full', 'full', 'full', 'tens', 'thirties'] as const);
      return { ...base('sh-angle', sub), id: `sh-angle:make:${d}:${from}:${guide}`, ask: `Drag the glowing side to make an angle of ${d}°.`, prompt: [tx('Make'), num(d), tx('°')],
        input: 'custom', custom: { name: 'angle-maker', spec: { target: d, from, guide, step: Math.min(step, 5), live: r === 1 } },
        answer: { kind: 'number', value: d }, weight: Math.min(5, 1 + Math.floor(r / 1.5)),
        explain: `${d}° is ${d === 90 ? 'a square corner' : d < 90 ? 'less than a square corner' : 'more than a square corner'}. Follow the protractor's numbers from 0 round to ${d}.`,
        trick: { name: 'Start at 0', say: `Count round from the 0 side: ${d < 90 ? 'less than 90 is smaller than a square corner' : d === 90 ? '90 is a square corner' : 'past 90 is wider than a square corner'}.` } };
    }
    if (sub === 'add') {
      const total = r <= 3 ? 90 * (rng() < 0.5 || r === 2 ? 1 : 0) : r === 6 ? 360 : 180;
      const parts = r >= 5 ? 3 : 2, step = r === 1 || r === 2 ? 10 : 5;
      const whole = r === 1 || (r === 3 && total === 0) ? step * int(rng, 6, 16) : total;
      const cuts: number[] = [];
      let left = whole;
      // each part at least 20° (or two steps), none hogging the whole
      for (let i = 0; i < parts - 1; i++) {
        const minRest = Math.max(20, step * 2) * (parts - 1 - i), lo = Math.ceil(Math.max(20, step * 2) / step);
        const v = step * int(rng, lo, Math.max(lo, Math.min(Math.floor((left * 0.65) / step), Math.floor((left - minRest) / step))));
        cuts.push(v); left -= v;
      }
      cuts.push(left);
      const findPart = r >= 2 && !(r === 3 && total === 0);
      const hide = findPart ? int(rng, 0, parts - 1) : -1;
      const ans = findPart ? cuts[hide] : whole;
      // the picture: rays from 0 round through each part
      const at: P = [5, whole === 360 ? 5 : 7.4], len = whole === 360 ? 4 : 4.4;
      let a = whole === 180 || whole === 360 ? 0 : int(rng, 0, 3) * 10;
      const angs: FigAngle[] = cuts.map((v, i) => { const g: FigAngle = { at, from: a, to: a + v, len, arc: true, text: i === hide ? '?' : `${v}°`, right: v === 90, hue: (['teal', 'rose', 'gold'] as FigHue[])[i] }; a += v; return g; });
      const what = whole === 90 ? 'a right angle (90°)' : whole === 180 ? 'a straight line (180°)' : whole === 360 ? 'a full turn (360°)' : null;
      return { ...base('sh-angle', sub), id: `sh-angle:add:${whole}:${cuts.join('+')}:${hide}`, ask: findPart ? `Together the angles make ${what}. What is the missing angle?` : 'What is the whole angle?',
        prompt: [fig({ w: 10, h: 10, angles: angs }), op('='), blank, tx('°')], input: 'number', answer: { kind: 'number', value: ans }, weight: Math.min(5, 1 + Math.floor(r / 1.4)),
        explain: findPart ? `${whole} − ${cuts.filter((_, i) => i !== hide).join(' − ')} = ${ans}°.` : `${cuts.join(' + ')} = ${whole}°.`,
        trick: { name: 'Parts make the whole', say: 'Angles side by side add up to the whole angle. A missing part is the whole take away the parts you know.' } };
    }
    const pool = perRung(r, [[30, 90, 150], [30, 45, 90, 135, 150], [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170], [60, 70, 80, 90, 100, 110, 120], [40, 70, 80, 90, 100, 110, 140, 180], [80, 85, 90, 95, 100]]);
    const d = pick(rng, pool), from = r === 1 ? 0 : int(rng, 0, 11) * 30;
    const kinds = r >= 5 ? ['right', 'acute', 'obtuse', 'straight'] : ['right', 'acute', 'obtuse'];
    const right = kindName(d);
    return { ...base('sh-angle', sub), id: `sh-angle:kind:${d}:${from}:${kinds.length}`, ask: 'What kind of angle is it?', prompt: [fig(angleFig(from, d, { right: d === 90, arc: d !== 90 }))],
      input: 'choice', choices: kinds.map(k => ({ id: k, parts: [tx(k)] })), answer: { kind: 'choice', id: right }, weight: Math.min(5, 1 + (Math.abs(d - 90) <= 20 ? 2 : 0) + (from ? 1 : 0)),
      explain: `It's ${an(right)} angle: ${ANGLE_WHY[right as keyof typeof ANGLE_WHY]}.`, trick };
  },
  check: (it, a) => check(it, a),
};

// ---------- lines and symmetry (4) ----------
const line = (a: P, b: P, hue: FigHue): FigPoly => ({ pts: [a, b], hue, open: true });
// rungs: pairs: 1 flat parallel lines, or a plus sign · 2 turned · 3 adds lines that are neither · 4 lines
// that would cross if they were longer · 5 a T and an L (perpendicular without crossing in the middle) ·
// 6 nearly parallel or nearly square (a few degrees off). Lines of symmetry: 1 one or two (a kite, a
// rectangle) · 2 adds squares and triangles with equal sides · 3 adds pentagons, hexagons, rhombuses · 4
// adds shapes with none · 5 adds octagons and arrows · 6 stars and turned shapes. Fold: 1 a rectangle, a
// fold the long way or across a corner · 2 triangles and kites · 3-4 turned · 5-6 folds very close to a
// true one.
export const shLines: Skill = {
  id: 'sh-lines', area: 'shapes', grade: 4, standard: '4.G.A.3',
  name: 'Lines and symmetry', short: 'Lines', plain: 'Knows parallel and perpendicular lines (4.G.A.1) and finds lines of symmetry: a fold that makes the two halves match (4.G.A.3).',
  input: 'choice', fastMs: 7000,
  subs: [{ id: 'pairs', label: 'parallel or perpendicular' }, { id: 'sym', label: 'count the lines of symmetry' }, { id: 'fold', label: 'find the fold' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    if (sub === 'pairs') {
      const opts = r >= 3 ? ['parallel', 'perpendicular', 'neither'] : ['parallel', 'perpendicular'];
      const want = pick(rng, opts);
      const t = r === 1 ? 0 : int(rng, 0, 17) * 10;
      let a1: P, a2: P, b1: P, b2: P;
      if (want === 'parallel') [a1, a2, b1, b2] = r === 6 ? [[1, 3], [7, 3], [3, 6.5], [9.5, 6.5]] : [[1, 3.5], [9, 3.5], [1, 6.5], [9, 6.5]];
      else if (want === 'perpendicular') {
        const kind = r >= 5 ? pick(rng, ['T', 'L', 'apart']) : r >= 4 ? pick(rng, ['plus', 'apart']) : 'plus';
        [a1, a2, b1, b2] = kind === 'T' ? [[1, 3], [9, 3], [5, 3], [5, 9]] : kind === 'L' ? [[2, 8], [9, 8], [2, 8], [2, 1]] : kind === 'apart' ? [[1, 7], [6, 7], [8, 1], [8, 5]] : [[1, 5], [9, 5], [5, 1], [5, 9]];
      } else {
        // crossing (or, from rung 4, apart but would cross if longer); rung 6: nearly parallel or nearly square
        const lean = r === 6 ? pick(rng, [8, 12, 80]) : pick(rng, [25, 35, 55, 60]);
        const rad = (lean * Math.PI) / 180, apart = lean < 20 || (r >= 4 && rng() < 0.5);
        // (apart: short enough not to reach the flat line)
        const c: P = apart ? [5, 4] : [5, 7], L = apart ? Math.min(3.6, 2.4 / Math.max(0.1, Math.sin(rad))) : 3.6;
        [a1, a2] = [[1, 7], [9, 7]];
        [b1, b2] = [[c[0] - L * Math.cos(rad), c[1] + L * Math.sin(rad)], [c[0] + L * Math.cos(rad), c[1] - L * Math.sin(rad)]];
      }
      const pts = turn([a1, a2, b1, b2], t, 5, 5);
      const f: Fig = { w: 10, h: 10, polys: [line(pts[0], pts[1], 'teal'), line(pts[2], pts[3], 'rose')] };
      return { ...base('sh-lines', sub), id: `sh-lines:pairs:${want}:${t}:${idOf(pts)}`, ask: 'Are the two lines parallel, perpendicular, or neither?', prompt: [fig(f)],
        input: 'choice', choices: opts.map(o => ({ id: o, parts: [tx(o)] })), answer: { kind: 'choice', id: want }, weight: Math.min(5, 1 + Math.floor(r / 2)),
        explain: want === 'parallel' ? 'They go the same way and never meet, however long they get: parallel.' : want === 'perpendicular' ? 'They meet (or would meet) at a square corner: perpendicular.' : 'They would cross, but not at a square corner: neither.',
        trick: { name: 'Train tracks and square corners', say: 'Parallel lines are like train tracks: always the same distance apart. Perpendicular lines make a square corner.' } };
    }
    const kinds: Kind[] = perRung(r, [['kite', 'rectangle'], ['kite', 'rectangle', 'square'], ['rectangle', 'square', 'pentagon', 'hexagon', 'rhombus'], ['rectangle', 'square', 'hexagon', 'parallelogram', 'quadrilateral', 'rhombus'], ['octagon', 'arrow', 'ell', 'parallelogram', 'pentagon'], ['octagon', 'hexagon', 'arrow', 'parallelogram', 'kite', 'trapezoid']] as Kind[][]);
    const tri = r >= 2 && rng() < 0.25;
    const t = r >= 3 ? int(rng, 0, 11) * 15 : 0;
    let pts: P[] = tri ? (r >= 4 && rng() < 0.4 ? fit([[0, 5], [6, 5], [1.5, 0]], 10, 10) : regular(3, 4.4, 5, 5.6)) : shapeOf(rng, pick(rng, kinds), { turn: 0 });
    if (r === 6 && rng() < 0.3) pts = Array.from({ length: 10 }, (_, i) => { const a = ((-90 + i * 36) * Math.PI) / 180, rr = i % 2 ? 2 : 4.4; return [5 + rr * Math.cos(a), 5 + rr * Math.sin(a)] as P; });
    pts = turn(pts, t, 5, 5);
    const lines = symmetryLines(pts);
    if (sub === 'sym') {
      const n = lines.length;
      return { ...base('sh-lines', sub), id: `sh-lines:sym:${idOf(pts)}`, ask: 'How many lines of symmetry does it have?', prompt: [fig(one(pts, hueOf(rng))), op('='), blank],
        input: 'number', answer: { kind: 'number', value: n }, weight: Math.min(5, 1 + (n >= 3 ? 1 : 0) + (n === 0 ? 1 : 0) + (t ? 1 : 0)),
        explain: n === 0 ? 'No fold makes the two halves match, so it has none.' : `There ${n === 1 ? 'is 1 fold' : `are ${n} folds`} that make the two halves match exactly.`,
        trick: { name: 'Fold it in your head', say: 'A line of symmetry is a fold where both halves match exactly, like a mirror. Try every way across: corner to corner, side to side.' } };
    }
    // fold: one true line of symmetry and two that aren't
    if (!lines.length) pts = turn(shapeOf(rng, 'kite'), t, 5, 5);
    const ls = symmetryLines(pts), good = ls[int(rng, 0, ls.length - 1)];
    const c: P = [(good.a[0] + good.b[0]) / 2, (good.a[1] + good.b[1]) / 2];
    const spin = (deg2: number, shift = 0): [P, P] => { const [a, b] = turn([good.a, good.b], deg2, c[0], c[1]); return [[a[0] + shift, a[1]], [b[0] + shift, b[1]]]; };
    const near = perRung(r, [45, 40, 35, 30, 20, 15]);
    // wrong folds: turned a little from the true one, or beside it (never another true one)
    const isTrue = ([a, b]: [P, P]) => ls.some(l => Math.abs((l.b[0] - l.a[0]) * (b[1] - a[1]) - (l.b[1] - l.a[1]) * (b[0] - a[0])) < 1e-3 && Math.abs((a[0] - l.a[0]) * (l.b[1] - l.a[1]) - (a[1] - l.a[1]) * (l.b[0] - l.a[0])) < 1e-3);
    const bad: [P, P][] = [spin(near), spin(-near, r >= 5 ? 0.8 : 0), spin(near / 2), spin(0, 1.4), spin(-near / 2)].filter(l => !isTrue(l)).slice(0, 2);
    const hue = hueOf(rng);
    const opts = [{ ok: true, l: [good.a, good.b] as [P, P] }, ...bad.map(l => ({ ok: false, l }))];
    const choices = shuffle(rng, opts).map((o, i) => ({ id: (o.ok ? 'y' : 'n') + i, parts: [fig({ w: 10, h: 10, polys: [tile(pts, hue), { pts: o.l, open: true, dash: true, hue: 'violet' }] })] }));
    const right = choices.find(x => x.id.startsWith('y'))!.id;
    return { ...base('sh-lines', sub), id: `sh-lines:fold:${idOf(pts)}:${near}:${choices.map(x => x.id).join('')}`, ask: 'Which dashed line is a line of symmetry?', prompt: [tx('Find the fold')],
      input: 'choice', choices, answer: { kind: 'choice', id: right }, weight: Math.min(5, 1 + Math.floor(r / 2)),
      explain: 'Fold along the right line and the two halves match exactly. Along the others, one side sticks out.',
      trick: { name: 'Mirror halves', say: 'Imagine a mirror on the line. Does the half you can see make the whole shape? Then it is a line of symmetry.' } };
  },
  check: (it, a) => check(it, a),
};

// ---------- families of shapes (5) ----------
const STATEMENTS: [string, boolean, string][][] = [
  [['Is every square a rectangle?', true, 'A square has 4 right angles, so it is a rectangle too.'], ['Is every rectangle a square?', false, 'A rectangle can be long and thin: its sides needn\'t be equal.'], ['Is a square a quadrilateral?', true, 'It has 4 sides, so yes.'], ['Does every triangle have 3 corners?', true, '3 sides, 3 corners: always.']],
  [['Is every square a rhombus?', true, 'A rhombus has 4 equal sides. A square does too.'], ['Is every rhombus a square?', false, 'A rhombus can lean over: its corners needn\'t be square.'], ['Is every rectangle a quadrilateral?', true, 'It has 4 sides, so yes.'], ['Can a rectangle have just 2 right angles?', false, 'A rectangle always has 4 right angles.']],
  [['Is every rhombus a parallelogram?', true, 'Its opposite sides are parallel, so yes.'], ['Is every parallelogram a rectangle?', false, 'A parallelogram can lean over, so its corners aren\'t always square.'], ['Is every rectangle a parallelogram?', true, 'Its opposite sides are parallel.'], ['Is every quadrilateral a parallelogram?', false, 'A kite or a trapezoid has 4 sides but not 2 pairs of parallel sides.']],
  [['Can a triangle have 2 right angles?', false, 'Two right angles make 180° already, with nothing left for the third corner.'], ['Can a right triangle have 2 equal sides?', true, 'Yes: half a square, cut corner to corner.'], ['Is every equilateral triangle isosceles?', true, 'Isosceles means at least 2 equal sides. It has 3.'], ['Can a triangle have 2 obtuse angles?', false, 'Two obtuse angles would be more than 180°.']],
  [['Is every kite a rhombus?', false, 'A kite has two pairs of equal sides next to each other; they needn\'t all be equal.'], ['Is every rhombus a kite?', true, 'Its sides next to each other are equal, so it is a kite too.'], ['Can an obtuse triangle be equilateral?', false, 'An equilateral triangle\'s corners are all 60°.'], ['Can a trapezoid have a right angle?', true, 'Yes: a trapezoid with one side standing straight up has two.']],
  [['Is every square a parallelogram, a rectangle and a rhombus?', true, 'All three: parallel sides, 4 right angles and 4 equal sides.'], ['Is every parallelogram with a right angle a rectangle?', true, 'One right angle in a parallelogram makes all four right angles.'], ['Is every rhombus with a right angle a square?', true, 'Equal sides and a right angle: that is a square.'], ['Can a scalene triangle have a line of symmetry?', false, 'All its sides are different, so no fold can match the halves.']],
];
const BEST: Kind[] = ['square', 'rectangle', 'rhombus', 'parallelogram', 'trapezoid', 'kite'];
/** a quadrilateral's marks: equal-side ticks, right angles and parallel arrows */
function marked(pts: P[]): Partial<FigPoly> {
  const f = factsOf(pts), ls = pts.map((p, i) => Math.hypot(p[0] - pts[(i + 1) % pts.length][0], p[1] - pts[(i + 1) % pts.length][1]));
  const ticks: Record<number, number> = {}, groups: number[] = [];
  ls.forEach((l, i) => { let g = groups.findIndex(x => Math.abs(x - l) < 1e-3); if (g < 0) { groups.push(l); g = groups.length - 1; } if (ls.filter(m => Math.abs(m - l) < 1e-3).length > 1) ticks[i] = g + 1; });
  const right = f.angles.map((a, i) => (Math.abs(a - 90) < 0.5 ? i : -1)).filter(i => i >= 0);
  const arrows: Record<number, number> = {};
  if (pts.length === 4) {
    const vec = (i: number) => [pts[(i + 1) % 4][0] - pts[i][0], pts[(i + 1) % 4][1] - pts[i][1]];
    [[0, 2], [1, 3]].forEach(([i, j], k) => { const u = vec(i), v = vec(j); if (Math.abs(u[0] * v[1] - u[1] * v[0]) < 1e-6 * (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]))) { arrows[i] = k + 1; arrows[j] = k + 1; } });
  }
  return { ticks, right, arrows };
}
// rungs: triangles: 1 by its angles, a right angle marked · 2 by its sides, with equal-side ticks · 3 either
// way · 4 its angles written in degrees · 5 its sides written as lengths · 6 numbers, turned, very close
// (91°). Always true?: 1 squares and rectangles · 2 rhombuses · 3 parallelograms · 4 triangles' angles · 5
// kites, trapezoids · 6 shapes in three families at once. Best name: 1 square or rectangle · 2 adds
// rhombuses · 3 parallelograms · 4 trapezoids · 5 kites · 6 every kind, four choices that all fit.
export const shFamily: Skill = {
  id: 'sh-family', area: 'shapes', grade: 5, standard: '5.G.B.4',
  name: 'Shape families', short: 'Families', plain: 'Sorts shapes into families by their sides and angles: every square is a rectangle and a rhombus; triangles are right, acute or obtuse, and equilateral, isosceles or scalene (5.G.B.3-4).',
  input: 'choice', fastMs: 8000,
  subs: [{ id: 'tri', label: 'kinds of triangle' }, { id: 'always', label: 'always true?' }, { id: 'best', label: 'the best name' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const trick = { name: 'The family tree', say: 'Quadrilaterals → parallelograms → rectangles and rhombuses → squares. Each one has everything the one above it has, and more.' };
    if (sub === 'always') {
      const [q, yes, why] = pick(rng, STATEMENTS[r - 1]);
      return { ...base('sh-family', sub), id: `sh-family:always:${q}`, ask: q, prompt: [tx(q)], input: 'choice', choices: [{ id: 'yes', parts: [tx('Yes')] }, { id: 'no', parts: [tx('No')] }],
        answer: { kind: 'choice', id: yes ? 'yes' : 'no' }, weight: Math.min(5, 1 + Math.floor(r / 2)), explain: `${yes ? 'Yes' : 'No'}: ${why}`, trick };
    }
    if (sub === 'tri') {
      const byAngle = r === 1 || r === 4 ? true : r === 2 || r === 5 ? false : rng() < 0.5;
      const kinds = byAngle ? ['right', 'acute', 'obtuse'] : ['equilateral', 'isosceles', 'scalene'];
      const want = pick(rng, kinds);
      // corner angles that make each kind (top angle, bottom left, bottom right)
      const near = r === 6;
      const A: Record<string, [number, number, number][]> = {
        right: [[90, 50, 40], [90, 30, 60], [90, 45, 45]], acute: near ? [[89, 46, 45], [80, 50, 50]] : [[60, 60, 60], [70, 55, 55], [50, 65, 65]],
        obtuse: near ? [[91, 44, 45], [100, 40, 40]] : [[120, 30, 30], [110, 40, 30], [130, 25, 25]],
        equilateral: [[60, 60, 60]], isosceles: [[40, 70, 70], [90, 45, 45], [120, 30, 30], [50, 65, 65]], scalene: [[90, 30, 60], [75, 40, 65], [100, 50, 30], [80, 60, 40]],
      };
      const [top, bl] = pick(rng, A[want]);
      const br = 180 - top - bl;
      // build it: base from (0,0) to (1,0), angles bl at the left and br at the right
      const tb = Math.tan((bl * Math.PI) / 180), tr = Math.tan((br * Math.PI) / 180);
      const x = tr / (tb + tr), y = x * tb;
      let pts: P[] = [[x, -y], [0, 0], [1, 0]];
      pts = fit(turn(pts, r === 6 ? int(rng, 0, 7) * 45 : 0, 0.5, 0), 10, 10);
      const angs = [top, bl, br];
      const ls = pts.map((p, i) => Math.hypot(p[0] - pts[(i + 1) % 3][0], p[1] - pts[(i + 1) % 3][1]));
      const unit = 6 / Math.max(...ls);
      const more: Partial<FigPoly> = byAngle
        ? (r >= 4 ? { arcs: Object.fromEntries(angs.map((a, i) => [i, `${a}°`])) } : { right: angs.map((a, i) => (a === 90 ? i : -1)).filter(i => i >= 0) })
        : (r >= 5 ? { sideText: Object.fromEntries(ls.map((l, i) => [i, `${Math.round(l * unit * 10) / 10}`])) } : marked(pts));
      return { ...base('sh-family', sub), id: `sh-family:tri:${want}:${angs.join('-')}:${byAngle ? 'a' : 's'}:${r >= 4 ? 'n' : 'm'}`, ask: `What kind of triangle is it, by its ${byAngle ? 'angles' : 'sides'}?`,
        prompt: [fig(one(pts, hueOf(rng), more))], input: 'choice', choices: kinds.map(k => ({ id: k, parts: [tx(k)] })), answer: { kind: 'choice', id: want },
        weight: Math.min(5, 1 + Math.floor(r / 1.5)),
        explain: byAngle ? (want === 'right' ? 'One corner is a right angle (90°): a right triangle.' : want === 'obtuse' ? 'One corner is bigger than 90°: an obtuse triangle.' : 'Every corner is less than 90°: an acute triangle.')
          : (want === 'equilateral' ? 'All 3 sides are equal: equilateral.' : want === 'isosceles' ? 'Just 2 sides are equal: isosceles.' : 'No two sides are equal: scalene.'),
        trick: { name: 'Look at one thing', say: byAngle ? 'By angles: any right angle? Right triangle. Any corner over 90°? Obtuse. All under 90°? Acute.' : 'By sides: 3 equal? Equilateral. 2 equal? Isosceles. None? Scalene.' } };
    }
    const pool = BEST.slice(0, perRung(r, [2, 3, 4, 5, 6, 6]));
    const kind = pick(rng, pool), t = r >= 3 ? int(rng, 0, 7) * 45 : 0;
    const pts = turn(shapeOf(rng, kind, { wild: r >= 5 && rng() < 0.5 }), t, 5, 5);
    const fits = BEST.filter(k => isA(kind, k));
    const wrong = r === 6 ? [...fits.filter(k => k !== kind), 'quadrilateral', ...BEST.filter(k => !fits.includes(k))].slice(0, 3) : some(rng, pool.filter(k => k !== kind), Math.min(2, pool.length - 1));
    const choices = wordChoices(rng, KIND_NAME[kind], wrong.map(k => KIND_NAME[k as Kind] ?? k));
    return { ...base('sh-family', sub), id: `sh-family:best:${kind}:${t}:${choices.map(c => c.id).join('|')}`, ask: 'What is the BEST name for this shape? (Read its marks.)', prompt: [fig(one(pts, hueOf(rng), marked(pts)))],
      input: 'choice', choices, answer: { kind: 'choice', id: KIND_NAME[kind] }, weight: Math.min(5, 1 + Math.floor(r / 1.5)),
      explain: `The marks show ${QUAD_WHY[kind]}: the best (most exact) name is ${KIND_NAME[kind]}.${fits.length > 1 ? ` It's also ${fits.filter(k => k !== kind).map(k => an(KIND_NAME[k])).join(' and ')}.` : ''}`, trick };
  },
  check: (it, a) => check(it, a),
};

// ---------- area of triangles and other polygons (6) ----------
// rungs: triangles: 1 a right triangle on squares (half a rectangle) · 2 any triangle on squares, base and
// height along the grid · 3 base and height written, no squares · 4 a leaning triangle, its height outside ·
// 5 halves in the answer (base × height odd) · 6 the height from the area. Four-sided: 1-2 parallelograms
// on squares · 3 parallelograms with numbers · 4 trapezoids on squares · 5 trapezoids with numbers · 6 a
// side from the area. Put together: 1 an L on squares · 2 an L with numbers · 3 a house (rectangle and
// triangle) · 4 a rectangle with a corner cut off · 5 a trapezoid split · 6 a frame (a hole in it). Make it
// on the dot grid: 1 a rectangle of 6 · 2 of 12 · 3 a triangle of 4 · 4 of 6 · 5 a parallelogram of 6 · 6 a
// triangle of 5.
export const shArea: Skill = {
  id: 'sh-area', area: 'shapes', grade: 6, standard: '6.G.A.1',
  name: 'Area of triangles and more', short: 'Area', plain: 'Finds the area of triangles (half of base × height), parallelograms, trapezoids and shapes made of pieces.',
  input: 'number', fastMs: 12000,
  subs: [{ id: 'tri', label: 'triangles' }, { id: 'quad', label: 'parallelograms and trapezoids' }, { id: 'compose', label: 'shapes made of pieces' }, { id: 'build', label: 'make an area' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    if (sub === 'build') {
      const rule: GridRule = perRung(r, [{ k: 'area', area: 6, shape: 'rectangle' }, { k: 'area', area: 12, shape: 'rectangle' }, { k: 'area', area: 4, shape: 'triangle' }, { k: 'area', area: 6, shape: 'triangle' }, { k: 'area', area: 6, shape: 'parallelogram' }, { k: 'area', area: 5, shape: 'triangle' }] as GridRule[]);
      return gridItem('sh-area', sub, rule, 6, r, { name: 'Half a rectangle', say: 'A triangle is half of a rectangle with the same base and height: base × height ÷ 2.' });
    }
    if (sub === 'tri') {
      const trick = { name: 'Half a rectangle', say: 'Every triangle is half of a rectangle with the same base and height. Area = base × height ÷ 2.' };
      const grid = r <= 2;
      // (rung 5: an odd base and height, so the area has a half; otherwise base × height is even)
      const B = r === 5 ? 2 * int(rng, 1, 6) + 1 : r <= 2 ? int(rng, 2, 7) : int(rng, 3, 14);
      const h0 = r === 5 ? 2 * int(rng, 1, 5) + 1 : r <= 2 ? int(rng, 2, 6) : int(rng, 2, 12);
      const hh = r !== 5 && (B * h0) % 2 ? h0 + 1 : h0;
      const area = (B * hh) / 2;
      const apex = r === 1 ? 0 : r === 4 ? B + int(rng, 1, 3) : int(rng, 1, Math.max(1, B - 1));
      const W = Math.max(B, apex) + 1, H = hh + 1;
      const pts: P[] = [[0.5, H - 0.5], [B + 0.5, H - 0.5], [apex + 0.5, H - 0.5 - hh]];
      const polys: FigPoly[] = [tile(pts, hueOf(rng), grid ? {} : { sideText: { 0: `${B}` } })];
      if (!grid || r === 2) polys.push({ pts: [[apex + 0.5, H - 0.5 - hh], [apex + 0.5, H - 0.5]], open: true, dash: true, hue: 'violet' });
      if (r === 4) polys.push({ pts: [[B + 0.5, H - 0.5], [apex + 0.5, H - 0.5]], open: true, dash: true, hue: 'pale' });
      const texts = grid ? [] : [{ at: [apex + 0.5 + 0.35, H - 0.5 - hh / 2] as P, text: `${hh}` }];
      if (r === 6) {
        return { ...base('sh-area', sub), id: `sh-area:tri:h:${B}:${hh}`, ask: `The triangle's area is ${area} square units and its base is ${B}. How tall is it?`,
          prompt: [fig({ w: W, h: H, polys: [tile(pts, 'gold', { sideText: { 0: `${B}` } }), { pts: [[apex + 0.5, H - 0.5 - hh], [apex + 0.5, H - 0.5]], open: true, dash: true, hue: 'violet' }], texts: [{ at: [apex + 0.85, H - 0.5 - hh / 2], text: '?' }] }), op('='), blank],
          input: 'number', answer: { kind: 'number', value: hh }, weight: 5, explain: `Area = base × height ÷ 2, so ${area} × 2 = ${B} × height. ${area * 2} ÷ ${B} = ${hh}.`, trick };
      }
      return { ...base('sh-area', sub), id: `sh-area:tri:${B}x${hh}:${apex}:${grid ? 'g' : 'n'}`, ask: 'What is the area of the triangle, in square units?',
        prompt: [fig({ w: W, h: H, grid: grid ? 'squares' : undefined, polys, texts }), op('='), blank], input: 'number', answer: { kind: 'number', value: dec(area) },
        weight: Math.min(5, 1 + Math.floor(r / 1.4)), explain: `Base ${B}, height ${hh}: ${B} × ${hh} = ${B * hh}, and half of that is ${dec(area)}.`, trick };
    }
    if (sub === 'quad') {
      const trap = r >= 4;
      const grid = r === 1 || r === 2 || r === 4;
      const h = int(rng, 2, grid ? 5 : 9);
      if (!trap) {
        const b = int(rng, 2, grid ? 6 : 12), s = int(rng, 1, grid ? 3 : 4);
        const W = b + s + 1, H = h + 1;
        const pts: P[] = [[s + 0.5, 0.5], [b + s + 0.5, 0.5], [b + 0.5, H - 0.5], [0.5, H - 0.5]];
        return { ...base('sh-area', sub), id: `sh-area:pg:${b}:${h}:${s}:${grid ? 'g' : 'n'}`, ask: 'What is the area of the parallelogram?',
          prompt: [fig({ w: W, h: H, grid: grid ? 'squares' : undefined, polys: [tile(pts, hueOf(rng), grid ? {} : { sideText: { 2: `${b}` } }), { pts: [[s + 0.5, 0.5], [s + 0.5, H - 0.5]], open: true, dash: true, hue: 'violet' }], texts: grid ? [] : [{ at: [s + 0.85, H / 2], text: `${h}` }] }), op('='), blank],
          input: 'number', answer: { kind: 'number', value: b * h }, weight: Math.min(5, 1 + r),
          explain: `Cut the triangle off one end and slide it to the other: a rectangle ${b} by ${h}. ${b} × ${h} = ${b * h}.`, trick: { name: 'Slide the corner', say: 'A parallelogram\'s area is base × height: cut off the leaning corner and it fits on the other end, making a rectangle.' } };
      }
      const a = int(rng, 2, grid ? 4 : 9), extra = int(rng, 1, grid ? 3 : 6), b = a + extra;
      const area = ((a + b) * h) / 2;
      if (r === 6 && Number.isInteger(area)) {
        return { ...base('sh-area', sub), id: `sh-area:trap:h:${a}:${b}:${h}`, ask: `A trapezoid has parallel sides ${a} and ${b} and an area of ${area}. How tall is it?`, prompt: [tx(`(${a} + ${b}) ÷ 2 × height = ${area}`), op('·'), tx('height ='), blank],
          input: 'number', answer: { kind: 'number', value: h }, weight: 5, explain: `The average of the parallel sides is ${(a + b) / 2}. ${area} ÷ ${(a + b) / 2} = ${h}.`, trick: { name: 'Average the parallel sides', say: 'A trapezoid is like a rectangle as wide as the average of its two parallel sides.' } };
      }
      const left = int(rng, 0, extra), W = b + 1, H = h + 1;
      const pts: P[] = [[left + 0.5, 0.5], [left + a + 0.5, 0.5], [b + 0.5, H - 0.5], [0.5, H - 0.5]];
      return { ...base('sh-area', sub), id: `sh-area:trap:${a}:${b}:${h}:${left}:${grid ? 'g' : 'n'}`, ask: 'What is the area of the trapezoid?',
        prompt: [fig({ w: W, h: H, grid: grid ? 'squares' : undefined, polys: [tile(pts, hueOf(rng), grid ? {} : { sideText: { 0: `${a}`, 2: `${b}` } }), { pts: [[left + 0.5, 0.5], [left + 0.5, H - 0.5]], open: true, dash: true, hue: 'violet' }], texts: grid ? [] : [{ at: [left + 0.85, H / 2], text: `${h}` }] }), op('='), blank],
        input: 'number', answer: { kind: 'number', value: dec(area) }, weight: Math.min(5, 2 + Math.floor(r / 2)),
        explain: `The parallel sides are ${a} and ${b}; their average is ${(a + b) / 2}. × height ${h} = ${dec(area)}.`, trick: { name: 'Average the parallel sides', say: 'Add the two parallel sides, halve it, and times by the height: (a + b) ÷ 2 × h.' } };
    }
    // put together
    const trick = { name: 'Cut it into pieces', say: 'Cut the shape into rectangles and triangles, find each area, and add them. For a hole, take its area away.' };
    const hue = hueOf(rng);
    if (r <= 2 || r === 4) {
      const W = int(rng, 4, 8), H = int(rng, 4, 7), cw = int(rng, 1, W - 2), ch = int(rng, 1, H - 2);
      const pts: P[] = r === 4
        ? [[0.5, 0.5], [W - cw + 0.5, 0.5], [W + 0.5, ch + 0.5], [W + 0.5, H + 0.5], [0.5, H + 0.5]]
        : [[0.5, 0.5], [W - cw + 0.5, 0.5], [W - cw + 0.5, ch + 0.5], [W + 0.5, ch + 0.5], [W + 0.5, H + 0.5], [0.5, H + 0.5]];
      const area = r === 4 ? W * H - (cw * ch) / 2 : W * H - cw * ch;
      return { ...base('sh-area', sub), id: `sh-area:L:${W}:${H}:${cw}:${ch}:${r === 4 ? 'cut' : r === 1 ? 'g' : 'n'}`, ask: 'What is the area of the whole shape?',
        prompt: [fig({ w: W + 1, h: H + 1, grid: r === 1 ? 'squares' : undefined, polys: [tile(pts, hue, r === 1 ? {} : r === 4 ? { sideText: { 0: `${W - cw}`, 2: `${H - ch}`, 3: `${W}`, 4: `${H}` } } : { sideText: { 0: `${W - cw}`, 3: `${H - ch}`, 4: `${W}`, 5: `${H}` } })] }), op('='), blank],
        input: 'number', answer: { kind: 'number', value: dec(area) }, weight: Math.min(5, 1 + r),
        explain: r === 4 ? `The whole rectangle is ${W} × ${H} = ${W * H}. The corner cut off is a triangle ${cw} × ${ch} ÷ 2 = ${(cw * ch) / 2}. ${W * H} − ${(cw * ch) / 2} = ${dec(area)}.` : `The big rectangle ${W} × ${H} = ${W * H}, take away the missing corner ${cw} × ${ch} = ${cw * ch}: ${dec(area)}.`, trick };
    }
    if (r === 3 || r === 5) {
      const W = r === 3 ? int(rng, 4, 8) * 1 : int(rng, 4, 8), H = int(rng, 2, 5), roof = int(rng, 2, 4);
      const pts: P[] = r === 3 ? [[0.5, roof + 0.5], [W / 2 + 0.5, 0.5], [W + 0.5, roof + 0.5], [W + 0.5, roof + H + 0.5], [0.5, roof + H + 0.5]]
        : [[0.5, roof + 0.5], [roof + 0.5, 0.5], [W + roof + 0.5, 0.5], [W + roof + 0.5, roof + H + 0.5], [0.5, roof + H + 0.5]];
      const area = r === 3 ? W * H + (W * roof) / 2 : (W + roof) * (roof + H) - (roof * roof) / 2;
      const roofLine: FigPoly[] = r === 3 ? [{ pts: [[W / 2 + 0.5, 0.5], [W / 2 + 0.5, roof + 0.5]], open: true, dash: true, hue: 'violet' }] : [];
      return { ...base('sh-area', sub), id: `sh-area:house:${W}:${H}:${roof}:${r}`, ask: 'What is the area of the whole shape?',
        prompt: [fig({ w: W + (r === 5 ? roof : 0) + 1, h: H + roof + 1, polys: [tile(pts, hue, r === 3 ? { sideText: { 2: `${H}`, 3: `${W}` } } : { sideText: { 1: `${W}`, 2: `${H + roof}`, 3: `${W + roof}`, 4: `${H}` } }), ...roofLine], texts: r === 3 ? [{ at: [W / 2 + 0.9, roof / 2 + 0.5], text: `${roof}` }] : [] }), op('='), blank],
        input: 'number', answer: { kind: 'number', value: dec(area) }, weight: 4,
        explain: r === 3 ? `The rectangle: ${W} × ${H} = ${W * H}. The roof triangle: ${W} × ${roof} ÷ 2 = ${(W * roof) / 2}. Together: ${dec(area)}.` : `The whole rectangle ${W + roof} × ${H + roof} = ${(W + roof) * (H + roof)}, minus the corner triangle ${roof} × ${roof} ÷ 2 = ${(roof * roof) / 2}: ${dec(area)}.`, trick };
    }
    const W = int(rng, 5, 9), H = int(rng, 4, 8), hw = int(rng, 1, W - 3), hh = int(rng, 1, H - 3);
    return { ...base('sh-area', sub), id: `sh-area:frame:${W}:${H}:${hw}:${hh}`, ask: `A ${W} by ${H} rug has a ${hw} by ${hh} hole in it. What area is left?`,
      prompt: [fig({ w: W + 1, h: H + 1, polys: [tile([[0.5, 0.5], [W + 0.5, 0.5], [W + 0.5, H + 0.5], [0.5, H + 0.5]], hue, { sideText: { 0: `${W}`, 1: `${H}` } }), tile([[1.5, 1.5], [hw + 1.5, 1.5], [hw + 1.5, hh + 1.5], [1.5, hh + 1.5]], 'pale', { sideText: { 0: `${hw}`, 1: `${hh}` } })] }), op('='), blank],
      input: 'number', answer: { kind: 'number', value: W * H - hw * hh }, weight: 5, explain: `${W} × ${H} = ${W * H}, take away the hole ${hw} × ${hh} = ${hw * hh}: ${W * H - hw * hh}.`, trick };
  },
  check: (it, a) => gridCheck(it, a) ?? check(it, a),
};

// ---------- boxes: volume, nets and surface area (6) ----------
const CUBE_NETS: P[][] = [
  [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]], [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [3, 2]], [[1, 0], [1, 1], [0, 1], [2, 1], [3, 1], [2, 2]],
  [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [3, 2]], [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2]],
];
const NOT_NETS: P[][] = [
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]], [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [2, 1]],
  [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1]],
];
const netFig = (cells: P[], hue: FigHue): Fig => {
  const w = Math.max(...cells.map(c => c[0])) + 1, h = Math.max(...cells.map(c => c[1])) + 1;
  return { w: Math.max(w, h) + 0.6, h: Math.max(w, h) + 0.6, polys: cells.map(([x, y]) => tile([[x + 0.3, y + 0.3], [x + 1.3, y + 0.3], [x + 1.3, y + 1.3], [x + 0.3, y + 1.3]], hue)) };
};
// rungs: count the cubes: 1 one layer, 2 by 3 · 2 one layer up to 4 by 3 · 3 two layers · 4 three layers
// · 5 up to 4 by 4 by 4 · 6 a missing edge from the cubes. Length × width × height: 1-2 small whole numbers ·
// 3 up to 10 · 4 up to 12 · 5 half lengths (2½) · 6 a missing edge. Nets: 1-2 which net folds into a cube ·
// 3 a cube's surface area · 4 a box's from its sizes · 5 bigger boxes · 6 a cube's edge from its surface.
export const shVolume: Skill = {
  id: 'sh-volume', area: 'shapes', grade: 6, standard: '6.G.A.2',
  name: 'Boxes: volume and nets', short: 'Volume', plain: 'Finds the volume of a box by counting cube layers and with length × width × height, even with half lengths (6.G.A.2), and uses nets for surface area (6.G.A.4).',
  input: 'number', fastMs: 11000,
  subs: [{ id: 'cubes', label: 'count the cubes' }, { id: 'lwh', label: 'length × width × height' }, { id: 'net', label: 'nets and surface' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const trick = { name: 'Layers of cubes', say: 'Count the cubes in one layer (length × width), then times by the number of layers (the height).' };
    if (sub === 'cubes') {
      const l = int(rng, 2, r <= 1 ? 3 : 4), w = int(rng, 2, r <= 1 ? 2 : r >= 5 ? 4 : 3), h = perRung(r, [1, 1, 2, 3, int(rng, 2, 4), int(rng, 2, 4)]);
      if (r === 6) {
        return { ...base('sh-volume', sub), id: `sh-volume:cubes:h:${l}:${w}:${h}`, ask: `This box holds ${l * w * h} cubes. Its bottom layer is ${l} by ${w}. How many layers tall is it?`, prompt: [fig({ w: 10, h: 10, boxes: [{ at: [5, 6], l, w, h: 1, cubes: true, hue: 'sky' }] }), tx('layers ='), blank],
          input: 'number', answer: { kind: 'number', value: h }, weight: 4, explain: `One layer is ${l} × ${w} = ${l * w} cubes. ${l * w * h} ÷ ${l * w} = ${h} layers.`, trick };
      }
      return { ...base('sh-volume', sub), id: `sh-volume:cubes:${l}:${w}:${h}`, ask: 'How many cubes make this box? (Some are hidden behind.)', prompt: [fig({ w: 10, h: 10, boxes: [{ at: [5, 6], l, w, h, cubes: true, hue: pick(rng, ['sky', 'teal', 'violet'] as FigHue[]) }] }), op('='), blank],
        input: 'number', answer: { kind: 'number', value: l * w * h }, weight: Math.min(5, h), explain: `One layer: ${l} × ${w} = ${l * w}. ${h} ${h === 1 ? 'layer' : 'layers'}: ${l * w} × ${h} = ${l * w * h}.`, trick };
    }
    if (sub === 'lwh') {
      const hi = perRung(r, [4, 5, 10, 12, 6, 10]);
      const half = r === 5;
      const l = int(rng, 2, hi) + (half ? 0.5 : 0), w = int(rng, 2, Math.min(hi, 8)), h = half ? 2 * int(rng, 1, 3) : int(rng, 2, Math.min(hi, 9));
      const v = dec(l * w * h);
      if (r === 6) {
        return { ...base('sh-volume', sub), id: `sh-volume:lwh:miss:${l}:${w}:${h}`, ask: `A box is ${l} long and ${w} wide, and holds ${v} cubic units. How tall is it?`, prompt: [num(l), op('×'), num(w), op('×'), blank, op('='), num(v)],
          input: 'number', answer: { kind: 'number', value: h }, weight: 5, explain: `${l} × ${w} = ${l * w} for each layer. ${v} ÷ ${l * w} = ${h}.`, trick };
      }
      const L = (x: number) => (x % 1 ? `${Math.floor(x)}½` : `${x}`);
      return { ...base('sh-volume', sub), id: `sh-volume:lwh:${l}:${w}:${h}`, ask: 'What is the volume of the box, in cubic units?',
        prompt: [fig({ w: 10, h: 10, boxes: [{ at: [5, 6], l: Math.min(6, Math.ceil(l)), w: Math.min(4, w), h: Math.min(4, h), hue: pick(rng, ['gold', 'rose', 'mint'] as FigHue[]), labels: [L(l), `${w}`, `${h}`] }] }), op('='), blank],
        input: 'number', answer: { kind: 'number', value: v }, weight: Math.min(5, 1 + Math.floor(r / 1.4)),
        explain: `Volume = length × width × height = ${L(l)} × ${w} × ${h} = ${v}.`, trick: { name: 'Length × width × height', say: 'The bottom layer holds length × width cubes; times the height for all the layers.' } };
    }
    if (r <= 2) {
      const good = pick(rng, CUBE_NETS), bad = some(rng, NOT_NETS, 2), hue = hueOf(rng);
      const choices = shuffle(rng, [{ id: 'yes', c: good }, { id: 'n1', c: bad[0] }, { id: 'n2', c: bad[1] }]).map((o, i) => ({ id: `${o.id}${i}`, parts: [fig(netFig(o.c, hue))] }));
      return { ...base('sh-volume', sub), id: `sh-volume:net:${choices.map(c => c.id).join('')}:${CUBE_NETS.indexOf(good)}:${r}`, ask: 'Which one folds up into a cube?', prompt: [tx('Fold it into a cube')],
        input: 'choice', choices, answer: { kind: 'choice', id: choices.find(c => c.id.startsWith('yes'))!.id }, weight: 2,
        explain: 'A cube needs 6 squares, and folded up no two may land on the same side. The right one has a bottom, a top and four sides all around.', trick: { name: 'Fold it in your head', say: 'Pick one square as the bottom. Fold the others up round it: every side of the cube must get exactly one square.' } };
    }
    if (r === 3 || r === 6) {
      const e = int(rng, 2, r === 3 ? 6 : 10), sa = 6 * e * e;
      return r === 3
        ? { ...base('sh-volume', sub), id: `sh-volume:net:cube:${e}`, ask: `A cube's edges are ${e} long. What is its surface area (all 6 faces)?`, prompt: [fig(netFig(CUBE_NETS[0], 'teal')), tx(`each square ${e} × ${e}`), op('·'), tx('surface ='), blank],
          input: 'number', answer: { kind: 'number', value: sa }, weight: 3, explain: `Each face is ${e} × ${e} = ${e * e}. 6 faces: 6 × ${e * e} = ${sa}.`, trick: { name: 'Add up every face', say: 'The net shows every face laid flat. Find each one\'s area and add them all.' } }
        : { ...base('sh-volume', sub), id: `sh-volume:net:edge:${e}`, ask: `A cube's surface area is ${sa}. How long is each edge?`, prompt: [tx(`6 faces = ${sa}`), op('·'), tx('edge ='), blank],
          input: 'number', answer: { kind: 'number', value: e }, weight: 5, explain: `One face is ${sa} ÷ 6 = ${e * e}, which is ${e} × ${e}. The edge is ${e}.`, trick: { name: 'Add up every face', say: 'A cube has 6 equal square faces: one face is the surface area ÷ 6.' } };
    }
    const l = int(rng, 2, r === 4 ? 6 : 12), w = int(rng, 2, r === 4 ? 5 : 9), h = int(rng, 2, r === 4 ? 5 : 9);
    const sa = 2 * (l * w + l * h + w * h);
    return { ...base('sh-volume', sub), id: `sh-volume:net:box:${l}:${w}:${h}`, ask: `A box is ${l} long, ${w} wide and ${h} tall. What is its surface area?`,
      prompt: [fig({ w: 10, h: 10, boxes: [{ at: [5, 6], l: Math.min(6, l), w: Math.min(4, w), h: Math.min(4, h), hue: 'violet', labels: [`${l}`, `${w}`, `${h}`] }] }), op('='), blank],
      input: 'number', answer: { kind: 'number', value: sa }, weight: Math.min(5, r), explain: `Top and bottom: 2 × ${l} × ${w} = ${2 * l * w}. Front and back: 2 × ${l} × ${h} = ${2 * l * h}. The ends: 2 × ${w} × ${h} = ${2 * w * h}. In all: ${sa}.`,
      trick: { name: 'Faces come in pairs', say: 'A box has 3 pairs of matching faces: top and bottom, front and back, the two ends. Find one of each, add, and double.' } };
  },
  check: (it, a) => check(it, a),
};

// ---------- angle facts (7) ----------
const rayFig = (angs: FigAngle[], lines: [P, P][] = [], polys: FigPoly[] = []): Fig => ({ w: 10, h: 10, angles: angs, polys: [...lines.map(([a, b]) => ({ pts: [a, b], open: true, hue: 'pale' as FigHue })), ...polys] });
// rungs: on a straight line: 1 two angles in tens · 2 in fives · 3 any degrees · 4 three angles on a line ·
// 5 x and 2x on a line · 6 x + 20 and 2x + 10. Round a point and across: 1 opposite angles (vertical),
// tens · 2 the neighbour of an opposite angle · 3 three angles round a point · 4 four round a point · 5
// opposite angles 2x and 80 · 6 3x and x + 40. In a triangle: 1 two angles given, tens · 2 any degrees ·
// 3 a right triangle · 4 an isosceles triangle (two equal) · 5 the outside angle · 6 x, 2x and 3x.
export const shAngleFacts: Skill = {
  id: 'sh-anglefacts', area: 'shapes', grade: 7, standard: '7.G.B.5',
  name: 'Angle facts', short: 'Angle facts', plain: 'Uses angle facts to find a missing angle: angles on a straight line make 180°, round a point 360°, opposite (vertical) angles are equal, and a triangle\'s angles make 180°.',
  input: 'number', fastMs: 12000,
  subs: [{ id: 'line', label: 'on a straight line' }, { id: 'point', label: 'round a point' }, { id: 'triangle', label: 'in a triangle' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const step = r === 1 ? 10 : r === 2 ? 5 : 1;
    if (sub === 'line') {
      const trick = { name: 'A line makes 180°', say: 'Angles that sit together on a straight line add up to 180°.' };
      const L: [P, P] = [[0.6, 6.5], [9.4, 6.5]], at: P = [5, 6.5];
      if (r >= 5) {
        // rung 5: x and k·x on a line (x = 180 ÷ (k + 1)); rung 6: x + 20° and 2x + 10° (x = 50)
        const k = r === 5 ? pick(rng, [2, 3, 5]) : 2, x = r === 5 ? 180 / (k + 1) : 50;
        const big = r === 5 ? k * x : 2 * x + 10, labels = r === 5 ? [`${k}x`, 'x'] : ['2x + 10°', 'x + 20°'];
        return { ...base('sh-anglefacts', sub), id: `sh-anglefacts:line:x:${r}:${k}`, ask: 'The angles sit on a straight line. What is x?', prompt: [fig(rayFig([{ at, from: 0, to: big, len: 4, arc: true, text: labels[0], hue: 'teal' }, { at, from: big, to: 180, len: 4, arc: true, text: labels[1], hue: 'rose' }], [L])), tx('x ='), blank],
          input: 'number', answer: { kind: 'number', value: x }, weight: 5, explain: r === 5 ? `x + ${k}x = ${k + 1}x = 180°, so x = 180 ÷ ${k + 1} = ${x}°.` : `x + 20 + 2x + 10 = 180, so 3x + 30 = 180, 3x = 150 and x = ${x}°.`, trick };
      }
      const parts = r === 4 ? 3 : 2;
      const a1 = step * int(rng, Math.ceil(20 / step), Math.floor((parts === 3 ? 90 : 160) / step));
      const a2 = parts === 3 ? step * int(rng, Math.ceil(20 / step), Math.floor((160 - a1) / step)) : 0;
      const ans = 180 - a1 - a2;
      const angs: FigAngle[] = [{ at, from: 0, to: a1, len: 4, arc: true, text: `${a1}°`, hue: 'teal' }];
      if (parts === 3) angs.push({ at, from: a1, to: a1 + a2, len: 4, arc: true, text: `${a2}°`, hue: 'gold' });
      angs.push({ at, from: a1 + a2, to: 180, len: 4, arc: true, text: '?', hue: 'rose' });
      return { ...base('sh-anglefacts', sub), id: `sh-anglefacts:line:${a1}:${a2}`, ask: 'The angles sit on a straight line. What is the missing angle?', prompt: [fig(rayFig(angs, [L])), op('='), blank, tx('°')],
        input: 'number', answer: { kind: 'number', value: ans }, weight: Math.min(5, 1 + r), explain: `180 − ${[a1, a2].filter(Boolean).join(' − ')} = ${ans}°.`, trick };
    }
    if (sub === 'point') {
      const trick = { name: 'Opposite angles match', say: 'Where two lines cross, opposite angles are equal and neighbours make 180°. All the way round a point is 360°.' };
      const at: P = [5, 5];
      if (r <= 2 || r >= 5) {
        const a = r >= 5 ? 0 : step * int(rng, Math.ceil(30 / step), Math.floor(150 / step));
        const lines = (t: number): [P, P][] => [[[0.8, 5], [9.2, 5]], [[5 - 4.2 * Math.cos((t * Math.PI) / 180), 5 + 4.2 * Math.sin((t * Math.PI) / 180)], [5 + 4.2 * Math.cos((t * Math.PI) / 180), 5 - 4.2 * Math.sin((t * Math.PI) / 180)]]];
        if (r >= 5) {
          const [k, extra] = r === 5 ? [2, 0] : [3, 40];
          const x = r === 5 ? int(rng, 20, 70) : 20;
          const val = r === 5 ? k * x : x + extra;
          const known = r === 5 ? `${val}°` : 'x + 40°';
          const unknown = r === 5 ? '2x' : '3x';
          return { ...base('sh-anglefacts', sub), id: `sh-anglefacts:point:x:${r}:${x}`, ask: 'Two lines cross. Opposite angles are equal. What is x?', prompt: [fig(rayFig([{ at, from: 0, to: val, len: 3.2, arc: true, text: unknown, hue: 'teal' }, { at, from: 180, to: 180 + val, len: 3.2, arc: true, text: known, hue: 'rose' }], lines(val))), tx('x ='), blank],
            input: 'number', answer: { kind: 'number', value: x }, weight: 5, explain: r === 5 ? `2x = ${val}°, so x = ${x}.` : `3x = x + 40, so 2x = 40 and x = 20. Both angles are 60°.`, trick };
        }
        const nb = r === 2 && rng() < 0.6;
        return { ...base('sh-anglefacts', sub), id: `sh-anglefacts:point:v:${a}:${nb ? 'n' : 'o'}`, ask: nb ? 'Two lines cross. What is the angle next to it?' : 'Two lines cross. What is the opposite angle?',
          prompt: [fig(rayFig(nb ? [{ at, from: 0, to: a, len: 3.2, arc: true, text: `${a}°`, hue: 'teal' }, { at, from: a, to: 180, len: 3.2, arc: true, text: '?', hue: 'rose' }] : [{ at, from: 0, to: a, len: 3.2, arc: true, text: `${a}°`, hue: 'teal' }, { at, from: 180, to: 180 + a, len: 3.2, arc: true, text: '?', hue: 'rose' }], lines(a))), op('='), blank, tx('°')],
          input: 'number', answer: { kind: 'number', value: nb ? 180 - a : a }, weight: Math.min(5, 1 + r), explain: nb ? `Neighbours on a line make 180°: 180 − ${a} = ${180 - a}°.` : `Opposite angles are equal: ${a}°.`, trick };
      }
      const parts = r === 3 ? 3 : 4;
      const vals: number[] = [];
      let left = 360;
      for (let i = 0; i < parts - 1; i++) { const v = 5 * int(rng, 8, Math.max(8, Math.floor((left - 40 * (parts - 1 - i)) / 5 / (parts - i)) * 1 + 6)); vals.push(v); left -= v; }
      vals.push(left);
      let a0 = 0;
      const angs = vals.map((v, i) => { const g: FigAngle = { at, from: a0, to: a0 + v, len: 3.6, arc: true, text: i === parts - 1 ? '?' : `${v}°`, hue: (['teal', 'gold', 'violet', 'rose'] as FigHue[])[i] }; a0 += v; return g; });
      return { ...base('sh-anglefacts', sub), id: `sh-anglefacts:point:${vals.join('+')}`, ask: 'The angles go all the way round a point. What is the missing one?', prompt: [fig(rayFig(angs)), op('='), blank, tx('°')],
        input: 'number', answer: { kind: 'number', value: left }, weight: Math.min(5, 2 + r - 3), explain: `All the way round is 360°: 360 − ${vals.slice(0, -1).join(' − ')} = ${left}°.`, trick };
    }
    const trick = { name: 'A triangle makes 180°', say: 'Tear off a triangle\'s three corners and they fit on a straight line: together they make 180°.' };
    let A: number, B: number, show: [string, string, string];
    if (r === 6) { A = 30; B = 60; show = ['x', '2x', '3x']; }
    else if (r === 4) { const top = 2 * int(rng, 10, 70); A = (180 - top) / 2; B = A; show = [`${top}°`, '?', '']; }
    else if (r === 3) { A = 90; B = int(rng, 20, 70); show = ['', `${B}°`, '?']; }
    else { A = step * int(rng, Math.ceil(30 / step), Math.floor(100 / step)); B = step * int(rng, Math.ceil(20 / step), Math.floor((150 - A) / step)); show = [`${A}°`, `${B}°`, '?']; }
    const C = 180 - A - B;
    // the triangle with angles (top, left, right)
    const [top, bl, br] = r === 4 ? [180 - 2 * A, A, B] : r === 3 ? [B, A, C] : r === 6 ? [90, 30, 60] : [A, B, C];
    const tb = Math.tan((bl * Math.PI) / 180), tr = Math.tan((br * Math.PI) / 180);
    const xx = bl === 90 ? 0 : br === 90 ? 1 : tr / (tb + tr), yy = bl === 90 ? tr : br === 90 ? tb : xx * tb;
    const pts = fit([[xx, -yy], [0, 0], [1, 0]], 10, 10);
    const ans = r === 6 ? 30 : r === 4 ? A : r === 5 ? 180 - C : C;
    if (r === 5) {
      // the outside angle at the bottom right: the two far corners together
      const ext = { ...base('sh-anglefacts', sub), id: `sh-anglefacts:tri:ext:${A}:${B}`, ask: 'What is the outside angle? (The side is made longer.)', prompt: [fig({ w: 10, h: 10, polys: [tile(pts, 'sky', { arcs: { 0: `${A}°`, 1: `${B}°` } }), { pts: [pts[2], [pts[2][0] + 1.8, pts[2][1]]], open: true, hue: 'pale' }], angles: [{ at: pts[2], from: 0, to: 180 - (180 - A - B), len: 1.4, arc: true, text: '?', hue: 'rose' }] }), op('='), blank, tx('°')],
        input: 'number' as const, answer: { kind: 'number' as const, value: A + B }, weight: 5, explain: `The inside corner there is 180 − ${A} − ${B} = ${C}°, and with the outside angle it makes 180°: ${180 - C}°. (It's the two far corners added: ${A} + ${B}.)`, trick };
      return ext;
    }
    const arcs: Record<number, string> = {};
    show.forEach((s, i) => { if (s) arcs[i] = s; });
    const right = [top, bl, br].map((a, i) => (a === 90 && !show[i] ? i : -1)).filter(i => i >= 0);
    return { ...base('sh-anglefacts', sub), id: `sh-anglefacts:tri:${r}:${A}:${B}`, ask: r === 6 ? 'The angles are x, 2x and 3x. What is x?' : r === 4 ? 'The two marked sides are equal. What is the missing angle?' : 'What is the missing angle in the triangle?',
      prompt: [fig(one(pts, 'sky', { arcs, right, ...(r === 4 ? { ticks: { 0: 1, 2: 1 } } : {}) })), r === 6 ? tx('x =') : op('='), blank, ...(r === 6 ? [] : [tx('°')])],
      input: 'number', answer: { kind: 'number', value: ans }, weight: Math.min(5, 1 + r),
      explain: r === 6 ? 'x + 2x + 3x = 6x = 180°, so x = 30°.' : r === 4 ? `The two bottom corners are equal: (180 − ${180 - 2 * A}) ÷ 2 = ${A}°.` : `180 − ${show.filter(s => s && s !== '?').map(s => s.replace('°', '')).concat(r === 3 ? ['90'] : []).join(' − ')} = ${ans}°.`, trick };
  },
  check: (it, a) => check(it, a),
};

// ---------- circles (7) ----------
const PI = 3.14;
// rungs: radius and diameter: 1 the diameter from the radius, to 10 · 2 the radius from the diameter · 3 up
// to 50 · 4 halves (a radius of 2.5) · 5 decimals both ways · 6 a circle in a square. Around (circumference,
// π = 3.14): 1 diameters 1, 2 and 10 · 2 any diameter to 10 · 3 from the radius · 4 bigger radii · 5 half a
// circle's curved edge · 6 the diameter from the circumference. Area: 1 radius 1, 2 or 10 · 2 up to 5 · 3
// up to 10 · 4 from the diameter · 5 half circles · 6 the radius from the area.
export const shCircle: Skill = {
  id: 'sh-circle', area: 'shapes', grade: 7, standard: '7.G.B.4',
  name: 'Circles', short: 'Circles', plain: 'Knows the radius and diameter, and finds the distance round a circle (circumference = π × d) and its area (π × r × r), using π ≈ 3.14.',
  input: 'number', fastMs: 14000,
  subs: [{ id: 'parts', label: 'radius and diameter' }, { id: 'around', label: 'the distance round' }, { id: 'area', label: 'the area' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const c = (more: Partial<{ radius: string; diameter: string; label: string }>, half = false): Fig => half
      ? { w: 10, h: 10, polys: [tile([...Array.from({ length: 25 }, (_, i) => [5 + 4.2 * Math.cos((Math.PI * i) / 24), 6.5 - 4.2 * Math.sin((Math.PI * i) / 24)] as P)], 'teal', { sideText: { 24: more.diameter ?? '' } })] }
      : { w: 10, h: 10, circles: [{ c: [5, 5], r: 4.2, hue: 'teal', ...more }] };
    if (sub === 'parts') {
      const trick = { name: 'Two radii make a diameter', say: 'The radius goes from the middle to the edge. The diameter goes right across, through the middle: two radii.' };
      if (r === 6) {
        const s = 2 * int(rng, 2, 15);
        return { ...base('sh-circle', sub), id: `sh-circle:parts:sq:${s}`, ask: `A circle just fits inside a square with sides of ${s}. What is its radius?`, prompt: [fig({ w: 10, h: 10, polys: [tile([[0.8, 0.8], [9.2, 0.8], [9.2, 9.2], [0.8, 9.2]], 'pale', { sideText: { 0: `${s}` } })], circles: [{ c: [5, 5], r: 4.2, hue: 'teal' }] }), tx('radius ='), blank],
          input: 'number', answer: { kind: 'number', value: s / 2 }, weight: 4, explain: `The circle is as wide as the square: its diameter is ${s}, so its radius is ${s / 2}.`, trick };
      }
      const toD = r === 1 || (r >= 3 && rng() < 0.5);
      const rad = r <= 2 ? int(rng, 1, 10) : r === 3 ? int(rng, 4, 50) : r === 4 ? int(rng, 1, 9) + 0.5 : dec(int(rng, 11, 99) / 10, 1);
      const d = r <= 2 ? 2 * int(rng, 1, 10) : r === 3 ? 2 * int(rng, 2, 25) : r === 4 ? int(rng, 3, 19) : dec(int(rng, 11, 99) / 10, 1);
      const R = d / 2;
      return { ...base('sh-circle', sub), id: `sh-circle:parts:${toD ? 'd' : 'r'}:${toD ? rad : d}`, ask: toD ? `The radius is ${rad}. What is the diameter?` : `The diameter is ${d}. What is the radius?`,
        prompt: [fig(c(toD ? { radius: `${rad}` } : { diameter: `${d}` })), tx(toD ? 'diameter =' : 'radius ='), blank], input: 'number', answer: { kind: 'number', value: dec(toD ? 2 * rad : R) },
        weight: Math.min(5, r), explain: toD ? `The diameter is two radii: 2 × ${rad} = ${dec(2 * rad)}.` : `The radius is half the diameter: ${d} ÷ 2 = ${dec(R)}.`, trick };
    }
    if (sub === 'around') {
      const trick = { name: 'π times across', say: 'The distance round a circle is a bit more than 3 times across: circumference = 3.14 × diameter (or 2 × 3.14 × radius).' };
      if (r === 6) {
        const d = int(rng, 2, 20), C = dec(PI * d, 2);
        return { ...base('sh-circle', sub), id: `sh-circle:around:back:${d}`, ask: `A circle is ${C} round. What is its diameter? (π = 3.14)`, prompt: [tx(`3.14 × diameter = ${C}`), op('·'), tx('diameter ='), blank],
          input: 'number', answer: { kind: 'number', value: d }, weight: 5, explain: `${C} ÷ 3.14 = ${d}.`, trick };
      }
      const fromR = r >= 3 && r !== 5 ? true : false;
      const v = r === 1 ? pick(rng, [1, 2, 10]) : r === 4 ? int(rng, 8, 25) : int(rng, 2, 10);
      const d = fromR ? 2 * v : v, ans = dec(r === 5 ? (PI * d) / 2 : PI * d);
      return { ...base('sh-circle', sub), id: `sh-circle:around:${r === 5 ? 'half' : fromR ? 'r' : 'd'}:${v}`, ask: r === 5 ? `How long is the curved edge of this half circle? (π = 3.14)` : `How far is it all the way round? (π = 3.14)`,
        prompt: [fig(c(fromR ? { radius: `${v}` } : { diameter: `${v}` }, r === 5)), op('='), blank], input: 'number', answer: { kind: 'number', value: ans }, weight: Math.min(5, 1 + r),
        explain: r === 5 ? `A whole circle would be 3.14 × ${d} = ${dec(PI * d)}; half of it is ${ans}.` : fromR ? `The diameter is 2 × ${v} = ${d}. 3.14 × ${d} = ${ans}.` : `3.14 × ${d} = ${ans}.`, trick };
    }
    const trick = { name: 'π × r × r', say: 'The area of a circle is 3.14 × radius × radius. Halve the diameter first if that\'s what you have.' };
    if (r === 6) {
      const rad = int(rng, 2, 10), A = dec(PI * rad * rad, 2);
      return { ...base('sh-circle', sub), id: `sh-circle:area:back:${rad}`, ask: `A circle's area is ${A}. What is its radius? (π = 3.14)`, prompt: [tx(`3.14 × r × r = ${A}`), op('·'), tx('r ='), blank],
        input: 'number', answer: { kind: 'number', value: rad }, weight: 5, explain: `${A} ÷ 3.14 = ${rad * rad}, and ${rad} × ${rad} = ${rad * rad}, so r = ${rad}.`, trick };
    }
    const rad = r === 1 ? pick(rng, [1, 2, 10]) : r === 2 ? int(rng, 1, 5) : int(rng, 2, 10);
    const fromD = r === 4, half = r === 5;
    const ans = dec((PI * rad * rad) / (half ? 2 : 1));
    return { ...base('sh-circle', sub), id: `sh-circle:area:${fromD ? 'd' : half ? 'h' : 'r'}:${rad}`, ask: half ? 'What is the area of the half circle? (π = 3.14)' : 'What is the area of the circle? (π = 3.14)',
      prompt: [fig(c(fromD || half ? { diameter: `${2 * rad}` } : { radius: `${rad}` }, half)), op('='), blank], input: 'number', answer: { kind: 'number', value: ans }, weight: Math.min(5, 1 + r),
      explain: `${fromD || half ? `The radius is ${2 * rad} ÷ 2 = ${rad}. ` : ''}3.14 × ${rad} × ${rad} = ${dec(PI * rad * rad)}${half ? `, and half of that is ${ans}` : ''}.`, trick };
  },
  check: (it, a) => check(it, a),
};

// ---------- the Pythagorean theorem (8) ----------
const TRIPLES: [number, number, number][][] = [
  [[3, 4, 5]], [[6, 8, 10], [3, 4, 5]], [[5, 12, 13], [8, 15, 17], [6, 8, 10]], [[9, 12, 15], [12, 16, 20], [10, 24, 26], [15, 20, 25]], [[7, 24, 25], [20, 21, 29], [9, 40, 41], [12, 35, 37]], [[11, 60, 61], [28, 45, 53], [33, 56, 65], [16, 63, 65]],
];
function rightTri(a: number, b: number, t: number): P[] {
  return turn(fit([[0, 0], [0, -a], [b, 0]], 10, 10, 0.16), t, 5, 5);
}
// rungs: squares on the sides: 1 a 3-4-5 triangle with its squares drawn · 2 6-8-10 · 3 two squares' areas
// given, any numbers · 4 a short side's square (big take away small) · 5 bigger numbers · 6 is it a right
// triangle? (the squares add up, or don't). The long side: 1 3-4-5 · 2 6-8-10 · 3 5-12-13 and 8-15-17 · 4
// bigger multiples · 5 7-24-25, 20-21-29 · 6 the rarest triples, turned. The short side: the same ladder.
export const shPyth: Skill = {
  id: 'sh-pyth', area: 'shapes', grade: 8, standard: '8.G.B.7',
  name: 'The Pythagorean theorem', short: 'Pythagoras', plain: 'In a right triangle the squares on the two short sides add up to the square on the long side (a² + b² = c²): finds a missing side.',
  input: 'number', fastMs: 15000,
  subs: [{ id: 'squares', label: 'squares on the sides' }, { id: 'long', label: 'the long side' }, { id: 'short', label: 'a short side' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const trick = { name: 'a² + b² = c²', say: 'Square the two short sides and add: that\'s the long side squared. For a short side, take away instead: c² − a².' };
    const [a, b, c] = pick(rng, TRIPLES[r - 1]);
    const t = r >= 4 ? int(rng, 0, 7) * 45 : 0;
    const pts = rightTri(a, b, t);
    if (sub === 'squares') {
      if (r === 6) {
        const ok = rng() < 0.5, x = ok ? c : c + 1;
        return { ...base('sh-pyth', sub), id: `sh-pyth:squares:is:${a}:${b}:${x}`, ask: `A triangle has sides ${a}, ${b} and ${x}. Is it a right triangle?`, prompt: [tx(`${a}² + ${b}² = ${x}² ?`)],
          input: 'choice', choices: [{ id: 'yes', parts: [tx('Yes')] }, { id: 'no', parts: [tx('No')] }], answer: { kind: 'choice', id: ok ? 'yes' : 'no' }, weight: 5,
          explain: `${a * a} + ${b * b} = ${a * a + b * b}, and ${x}² = ${x * x}. ${ok ? 'They match: it is a right triangle.' : 'They don\'t match, so it isn\'t.'}`, trick };
      }
      const A = r <= 2 ? a * a : int(rng, 5, 60), B = r <= 2 ? b * b : int(rng, 5, 60);
      const findShort = r === 4 || r === 5;
      const C = A + B;
      const squares: FigPoly[] = [];
      // the squares on the sides of a triangle drawn small, with their areas
      const T: P[] = [[3.5, 6.5], [3.5, 3.6], [6.4, 6.5]];
      squares.push(tile(T, 'pale', { right: [0] }));
      squares.push(tile([[3.5, 6.5], [3.5, 3.6], [0.6, 3.6], [0.6, 6.5]], 'teal', { label: findShort ? '?' : `${A}` }));
      squares.push(tile([[3.5, 6.5], [6.4, 6.5], [6.4, 9.4], [3.5, 9.4]], 'rose', { label: findShort ? `${A}` : `${B}` }));
      squares.push(tile([[3.5, 3.6], [6.4, 6.5], [9.3, 3.6], [6.4, 0.7]], 'gold', { label: findShort ? `${C}` : '?' }));
      return { ...base('sh-pyth', sub), id: `sh-pyth:squares:${A}:${B}:${findShort ? 's' : 'l'}:${r}`, ask: findShort ? 'The squares are on the sides of a right triangle. What is the area of the missing small square?' : 'The squares are on the sides of a right triangle. What is the area of the big square?',
        prompt: [fig({ w: 10, h: 10, polys: squares }), op('='), blank], input: 'number', answer: { kind: 'number', value: findShort ? C - A : C }, weight: Math.min(5, 1 + r),
        explain: findShort ? `The two small squares make the big one: ${C} − ${A} = ${C - A}.` : `The two small squares make the big one: ${A} + ${B} = ${C}.`, trick };
    }
    const long = sub === 'long';
    // the sides: 0 from the right angle up (a), 1 the long side, 2 back along the bottom (b)
    const st: Record<number, string> = long ? { 0: `${a}`, 1: '?', 2: `${b}` } : { 0: `${a}`, 1: `${c}`, 2: '?' };
    return { ...base('sh-pyth', sub), id: `sh-pyth:${sub}:${a}:${b}:${c}:${t}`, ask: long ? 'How long is the longest side?' : 'How long is the missing short side?',
      prompt: [fig(one(pts, pick(rng, ['sky', 'violet', 'mint'] as FigHue[]), { right: [0], sideText: st })), op('='), blank], input: 'number', answer: { kind: 'number', value: long ? c : b },
      weight: Math.min(5, 1 + r), explain: long ? `${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c}, and ${c} × ${c} = ${c * c}. The long side is ${c}.` : `${c}² − ${a}² = ${c * c} − ${a * a} = ${b * b}, and ${b} × ${b} = ${b * b}. The side is ${b}.`, trick };
  },
  check: (it, a) => check(it, a),
};

// ---------- slides, flips and turns (8) ----------
const FLAG: P[] = [[0, 0], [0, 3], [1, 3], [1, 2], [2, 2], [2, 1], [1, 1], [1, 0]];
const moveFig = (before: P[], after: P[] | null, at: P[] = [], span = 5): Fig => {
  const map = (ps: P[]) => ps.map(([x, y]) => [x + span, span - y] as P);
  const polys: FigPoly[] = [tile(map(before), 'teal')];
  if (after) polys.push(tile(map(after), 'rose'));
  return { w: span * 2, h: span * 2, grid: 'axes', polys, dots: at.map((p, i) => ({ at: map([p])[0], text: i === 0 ? 'A' : undefined, hue: 'gold' as FigHue })) };
};
// rungs: which move: 1 a slide or a flip over a line up and down · 2 adds quarter turns · 3 adds half turns ·
// 4 diagonal slides, flips over a flat line · 5-6 all of them, the shape set anywhere. Slide a point: 1
// one way, right or up · 2 two ways · 3 left and down too · 4 into the minus numbers · 5-6 bigger moves
// across the axes. Flip: 1-2 over the up-down axis · 3-4 over the flat axis · 5-6 either, from any corner of
// the plane. Turn about the middle: 1-3 a half turn · 4-6 a quarter turn, clockwise.
export const shMove: Skill = {
  id: 'sh-move', area: 'shapes', grade: 8, standard: '8.G.A.3',
  name: 'Slides, flips and turns', short: 'Moves', plain: 'Moves shapes and points on the coordinate plane: slides (translations), flips (reflections over an axis) and turns (rotations about the origin), and tells which move was made.',
  input: 'grid', fastMs: 12000,
  subs: [{ id: 'which', label: 'which move?' }, { id: 'slide', label: 'slides' }, { id: 'flip', label: 'flips' }, { id: 'turn', label: 'turns' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const trick = { name: 'Slide, flip, turn', say: 'A slide moves it without turning. A flip is a mirror image. A turn spins it round a point. Follow one corner to check.' };
    const grid = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
    if (sub === 'which') {
      const kinds = r === 1 ? ['slide', 'flip'] : ['slide', 'flip', 'turn'];
      const want = pick(rng, kinds);
      const dx = int(rng, -4, -1), dy = int(rng, -4, -1);
      const before = FLAG.map(([x, y]) => [x + dx, y + dy] as P);
      let after: P[];
      if (want === 'slide') { const sx = int(rng, 2, 3), sy = r >= 4 ? int(rng, 1, 2) : 0; after = before.map(([x, y]) => [x + sx, y + sy] as P); }
      else if (want === 'flip') after = r >= 4 && rng() < 0.5 ? before.map(([x, y]) => [x, -y] as P) : before.map(([x, y]) => [-x, y] as P);
      else after = r === 2 || (r >= 4 && rng() < 0.5) ? before.map(([x, y]) => [y, -x] as P) : before.map(([x, y]) => [-x, -y] as P);
      return { ...base('sh-move', sub), id: `sh-move:which:${want}:${idOf(after)}`, ask: 'The teal flag moved to the pink one. Which move was it?', prompt: [fig(moveFig(before, after))],
        input: 'choice', choices: kinds.map(k => ({ id: k, parts: [tx(k)] })), answer: { kind: 'choice', id: want }, weight: Math.min(5, 1 + Math.floor(r / 1.5)),
        explain: want === 'slide' ? 'It points the same way, just moved over: a slide.' : want === 'flip' ? 'It is a mirror image of the first: a flip.' : 'It is spun round the middle of the grid: a turn.', trick };
    }
    const x0 = r <= 2 ? int(rng, 1, 3) : int(rng, -4, 4) || 2, y0 = r <= 2 ? int(rng, 1, 3) : int(rng, -4, 4) || -1;
    let to: P, ask: string, why: string;
    if (sub === 'slide') {
      const dx = r === 1 ? int(rng, 1, 3) : int(rng, r >= 3 ? -5 : 1, 4) || 2, dy = r === 1 ? 0 : int(rng, r >= 3 ? -4 : 1, 3) || -2;
      to = [Math.max(-5, Math.min(5, x0 + dx)), Math.max(-5, Math.min(5, y0 + dy))];
      const ddx = to[0] - x0, ddy = to[1] - y0;
      const words = [ddx ? `${Math.abs(ddx)} ${ddx > 0 ? 'right' : 'left'}` : '', ddy ? `${Math.abs(ddy)} ${ddy > 0 ? 'up' : 'down'}` : ''].filter(Boolean).join(' and ') || '0 right';
      ask = `Point A is at (${x0}, ${y0}). Slide it ${words}. Tap where it lands.`;
      why = `Right and left change x; up and down change y: (${x0} ${ddx >= 0 ? '+' : '−'} ${Math.abs(ddx)}, ${y0} ${ddy >= 0 ? '+' : '−'} ${Math.abs(ddy)}) = (${to[0]}, ${to[1]}).`;
    } else if (sub === 'flip') {
      const overY = r <= 2 || ((r >= 5) && rng() < 0.5);
      to = overY ? [-x0 || 0, y0] : [x0, -y0 || 0];
      ask = `Flip point A (${x0}, ${y0}) over the ${overY ? 'up-and-down (y)' : 'flat (x)'} axis. Tap where it lands.`;
      why = overY ? `Over the y axis, x changes sign: (${x0}, ${y0}) → (${to[0]}, ${to[1]}).` : `Over the x axis, y changes sign: (${x0}, ${y0}) → (${to[0]}, ${to[1]}).`;
    } else {
      const quarter = r >= 4;
      to = quarter ? [y0, -x0 || 0] : [-x0 || 0, -y0 || 0];
      ask = quarter ? `Turn point A (${x0}, ${y0}) a quarter turn clockwise about the middle (0, 0). Tap where it lands.` : `Turn point A (${x0}, ${y0}) a half turn about the middle (0, 0). Tap where it lands.`;
      why = quarter ? `A quarter turn clockwise: (x, y) → (y, −x). (${x0}, ${y0}) → (${to[0]}, ${to[1]}).` : `A half turn: both numbers change sign. (${x0}, ${y0}) → (${to[0]}, ${to[1]}).`;
    }
    return { ...base('sh-move', sub), id: `sh-move:${sub}:${x0},${y0}>${to[0]},${to[1]}:${r >= 4 ? 'q' : 'h'}`, ask, prompt: [tx(`A (${x0}, ${y0})`), op('→'), blank],
      input: 'grid', grid, answer: { kind: 'point', x: to[0], y: to[1] }, weight: Math.min(5, 1 + Math.floor(r / 1.3)), explain: why, trick };
  },
  check: (it, a) => check(it, a),
};

export const SHAPE_SKILLS: Skill[] = [shName, shSides, shParts, shQuad, shAngle, shLines, shFamily, shArea, shVolume, shAngleFacts, shCircle, shPyth, shMove];
