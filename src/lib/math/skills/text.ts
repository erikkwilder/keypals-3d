// An item's answer and question as short words and parts, for help cards, results and battle cards.
import type { Answer, Item, Part, Pic } from './types';
import { moneyText } from './decimals';
import { measText } from './measure';
import { figText } from '../shapes/fig';

/** A picture in a few words: 3/4 pie, 46¢ in coins, 35 of 100 squares. */
function picText(p: Pic): string {
  if (p.kind === 'coins') return `${moneyText(p.coins.reduce((t, c) => t + Math.abs(c), 0))} in coins`;
  if (p.kind === 'grid') return `${p.filled} of 100 squares`;
  return `${p.filled}/${p.parts} ${p.kind}`;
}

/** The right answer as parts (a fraction, a number, the right choice's own parts). */
export function answerParts(it: Item): Part[] {
  const a = it.answer;
  if (a.kind === 'fraction') return [{ t: 'frac', n: a.n, d: a.d }];
  if (a.kind === 'number') return [{ t: 'num', n: a.value }];
  if (a.kind === 'choice') return it.choices?.find(c => c.id === a.id)?.parts ?? [{ t: 'text', s: a.id }];
  // a point on a fractions number line is a fraction (1/2, not 0.5)
  const den = it.line?.denom;
  if (a.y === undefined && den) return [{ t: 'frac', n: Math.round(a.x * den), d: den }];
  return [{ t: 'text', s: a.y === undefined ? String(a.x) : `(${a.x}, ${a.y})` }];
}
/** The right answer in a few characters: 3/4, 12, "The same", (2, 3). */
export const answerText = (it: Item): string => givenText(it, it.answer);
/** Any answer to an item in a few characters (a ghost's in a duel, say). */
export function givenText(it: Item, a: Answer): string {
  if (a.kind === 'fraction') return `${a.n}/${a.d}`;
  if (a.kind === 'number') return String(a.value);
  if (a.kind === 'choice') { const c = it.choices?.find(x => x.id === a.id); return c ? partsText(c.parts) : a.id; }
  const den = it.line?.denom;
  if (a.y === undefined && den) return `${Math.round(a.x * den)}/${den}`;
  return a.y === undefined ? String(a.x) : `(${a.x}, ${a.y})`;
}
/** A near miss, the kind of wrong answer a child gives (one off, another choice): a ghost's in a duel. */
export function nearMiss(it: Item, r: () => number): Answer {
  const a = it.answer, step = r() < 0.5 ? -1 : 1;
  if (a.kind === 'fraction') return { kind: 'fraction', n: a.n + step < 0 ? a.n + 1 : a.n + step, d: a.d };
  if (a.kind === 'number') return { kind: 'number', value: a.value + step * (it.line?.step ?? 1) };
  if (a.kind === 'choice') { const other = (it.choices ?? []).filter(c => c.id !== a.id); return { kind: 'choice', id: other.length ? other[Math.floor(r() * other.length)].id : a.id + '?' }; }
  return { ...a, x: a.x + step * (it.line?.step ?? 1) };
}
/** base-ten blocks in words: "3 hundreds, 4 tens, 5 ones" */
const blocksText = (b: { th?: number; h: number; t: number; o: number }) => [b.th ? `${b.th} thousands` : '', b.h ? `${b.h} hundreds` : '', b.t ? `${b.t} tens` : '', b.o ? `${b.o} ones` : ''].filter(Boolean).join(', ') || '0';
/** Parts as plain text: "3/4 or 1/2", "2/5 + 1/5 = ?". A picture reads as its fraction. */
export function partsText(ps: Part[]): string {
  return ps.map(p => p.t === 'meas' ? measText(p.m) : p.t === 'text' ? p.s : p.t === 'num' ? String(p.n) : p.t === 'op' ? p.s : p.t === 'frac' ? `${p.n ?? '?'}/${p.d ?? '?'}` : p.t === 'pic' ? picText(p.pic) : p.t === 'money' ? moneyText(p.cents, p.dollars) : p.t === 'blocks' ? blocksText(p.b) : p.t === 'fig' ? figText(p.fig) : '?').join(' ');
}
/** The question in a few words for lists (results, cards): the question line, or the ask when the line is
 *  only a picture. */
export function shortText(it: Item): string {
  if (it.prompt.length === 1 && it.prompt[0].t === 'blocks') return blocksText(it.prompt[0].b);
  if (it.prompt[0]?.t === 'pic' && it.prompt.every(p => p.t !== 'num' && p.t !== 'frac')) { const p = it.prompt[0].pic; return p.kind === 'set' ? `${p.filled} of ${p.parts} cupcakes` : p.kind === 'coins' || p.kind === 'grid' ? picText(p) : `${p.filled} of ${p.parts} shaded`; }
  return partsText(it.prompt);
}
