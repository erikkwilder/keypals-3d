// Every skill in the game, area by area, K to 8. The four fact strands (adding, taking away, times,
// sharing) are wrapped as skills so battles, the grown-ups' view and new areas can treat everything the
// same way; their memory, picker and garden stay the facts' own. New areas add their skills here.
import type { Rng } from '../../engine/rng';
import { answerOf, factId, opSign, type Fact, type Op } from '../facts';
import { groupFacts, trickOf } from '../course';
import { checkAnswer, FRACTION_SKILLS } from './fractions';
import { DECIMAL_SKILLS } from './decimals';
import type { Area, AreaId, Item, Skill } from './types';

const base = 'math/';
export const AREAS: Area[] = [
  { id: 'plus', op: '+', name: 'Adding', grades: '1-2', blurb: 'Facts to 20: small steps, doubles, tens and making ten.', color: '#3fa7e0', art: `${base}strand-plus.webp`, live: true },
  { id: 'minus', op: '-', name: 'Taking away', grades: '1-2', blurb: 'Taking away within 20.', color: '#7c5cf5', art: `${base}strand-minus.webp`, live: true },
  { id: 'times', op: 'x', name: 'Times tables', grades: '3', blurb: 'Every times table, 0 to 10.', color: '#ef7d2b', art: `${base}strand-times.webp`, live: true },
  { id: 'share', op: '/', name: 'Sharing', grades: '3', blurb: 'Dividing, thinking of the times tables.', color: '#2fa898', art: `${base}strand-share.webp`, live: true },
  { id: 'fractions', name: 'Fractions', grades: '3-5', blurb: 'Parts of a whole: naming, comparing, equal fractions and adding.', color: '#e0567a', art: `${base}area-fractions.webp`, sign: '½', live: true },
  { id: 'place', name: 'Place value and big numbers', grades: 'K-4', blurb: 'Tens and ones, hundreds, thousands, rounding.', color: '#5a8de8', art: `${base}area-fractions.webp`, live: false },
  { id: 'decimals', name: 'Decimals and money', grades: '2-5', blurb: 'Coins and change, tenths and hundredths, adding decimals and rounding.', color: '#d9a21b', art: `${base}area-decimals.webp`, sign: '¢', live: true },
  { id: 'measure', name: 'Measurement and time', grades: '1-5', blurb: 'Clocks, lengths, weights, area and perimeter.', color: '#8a6bd6', art: `${base}area-fractions.webp`, live: false },
  { id: 'shapes', name: 'Shapes and angles', grades: 'K-8', blurb: 'Shapes, symmetry, angles, area and volume.', color: '#2fb3a0', art: `${base}area-fractions.webp`, live: false },
  { id: 'ratios', name: 'Ratios and percents', grades: '6-7', blurb: 'Ratios, rates, percents.', color: '#f07a3a', art: `${base}area-fractions.webp`, live: false },
  { id: 'integers', name: 'Negative numbers', grades: '6-7', blurb: 'Below zero and the coordinate plane.', color: '#3d7fc4', art: `${base}area-fractions.webp`, live: false },
  { id: 'algebra', name: 'Expressions and equations', grades: '6-8', blurb: 'Order of operations, equations, slope.', color: '#6c5ce7', art: `${base}area-fractions.webp`, live: false },
  { id: 'data', name: 'Data and chance', grades: '3-8', blurb: 'Graphs, mean and median, probability.', color: '#e85d9a', art: `${base}area-fractions.webp`, live: false },
];
export const AREA: Record<AreaId, Area> = Object.fromEntries(AREAS.map(a => [a.id, a])) as Record<AreaId, Area>;
export const areaOfOp = (op: Op): AreaId => (op === '+' ? 'plus' : op === '-' ? 'minus' : op === '/' ? 'share' : 'times');

/** A fact as an item (for battles and anywhere that wants every question in one shape). */
export function factItem(skill: string, f: Fact): Item {
  const ans = answerOf(f), tr = trickOf(f);
  return {
    skill, key: factId(f), id: factId(f), ask: 'What is it?',
    prompt: [{ t: 'num', n: f.a }, { t: 'op', s: opSign(f) }, { t: 'num', n: f.b }, { t: 'op', s: '=' }, { t: 'blank' }],
    input: 'number', answer: { kind: 'number', value: ans }, weight: ans >= 50 ? 3 : ans >= 15 ? 2 : 1,
    explain: `${f.a} ${opSign(f)} ${f.b} = ${ans}.`, trick: { name: tr.name, say: tr.say },
  };
}
function factSkill(id: string, op: Op, grade: number, standard: string, name: string, plain: string, groups: string[]): Skill {
  return {
    id, area: areaOfOp(op), grade, standard, name, plain, input: 'number', fastMs: 3000, facts: op,
    subs: groups.map(g => ({ id: g, label: g })),
    make(rng: Rng, sub: string) { const fs = groupFacts(sub); return factItem(id, fs[Math.floor(rng() * fs.length)] ?? { a: 1, b: 1, op }); },
    check: (it, a) => checkAnswer(it.answer, a),
  };
}
const FACT_SKILLS: Skill[] = [
  factSkill('add-facts', '+', 1, '1.OA.C.6', 'Adding to 20', 'Knows addition facts to 20 quickly (2.OA.B.2: by heart).', ['+s', '+d', '+t', '+b']),
  factSkill('sub-facts', '-', 1, '1.OA.C.6', 'Taking away within 20', 'Knows subtraction facts within 20 quickly (2.OA.B.2: by heart).', ['-s', '-d', '-t', '-b']),
  factSkill('mult-facts', 'x', 3, '3.OA.C.7', 'Times tables', 'Knows the times tables to 10 × 10 by heart.', ['x2', 'x10', 'x5', 'x4', 'x3', 'x9', 'x6', 'x8', 'x7']),
  factSkill('div-facts', '/', 3, '3.OA.C.7', 'Sharing (dividing)', 'Knows the division facts that undo the times tables.', ['/2', '/10', '/5', '/4', '/3', '/9', '/6', '/8', '/7']),
];

export const SKILLS: Skill[] = [...FACT_SKILLS, ...FRACTION_SKILLS, ...DECIMAL_SKILLS];
export const SKILL: Record<string, Skill> = Object.fromEntries(SKILLS.map(s => [s.id, s]));
export const skillsOf = (area: AreaId) => SKILLS.filter(s => s.area === area);
/** A memory key's skill and sub: `fr-name:4` -> fr-name, 4. */
export const splitKey = (key: string) => { const i = key.indexOf(':'); return { skill: key.slice(0, i), sub: key.slice(i + 1) }; };
/** The label kids see for a memory key: "Name the fraction: quarters". */
export function keyLabel(key: string): string {
  const { skill, sub } = splitKey(key), s = SKILL[skill];
  const sb = s?.subs.find(x => x.id === sub);
  return s ? `${s.name}: ${sb?.label ?? sub}` : key;
}
