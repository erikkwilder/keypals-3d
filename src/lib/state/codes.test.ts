// "mint planet sun99" opens Mia: a number typed straight after the last word is the likeliest slip, and it
// was refused ("That save code wasn't found"), using up one of the address's tries. Nothing looser is taken.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cleanCode } from './codes';
import { cleanClassCode } from '../teach/names';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
// the server's own cleanCode, as it is in deploy/site/worker.js
const line = read('../../../deploy/site/worker.js').match(/^const cleanCode = (\(c\) => .*);$/m);
const serverClean = new Function(`return ${line?.[1]}`)() as (c: unknown) => string;

const TAKEN: [string, string][] = [
  ['mint planet sun99', 'MINT-PLANET-SUN-99'],
  ['Mint Planet Sun99.', 'MINT-PLANET-SUN-99'],
  ['mint planet sun 99', 'MINT-PLANET-SUN-99'],
  ['  MINT-planet   Sun - 99. ', 'MINT-PLANET-SUN-99'],
  ['mint-planet-sun-99', 'MINT-PLANET-SUN-99'],
  ['fox pear42', 'FOX-PEAR-42'],
];
// these stay as typed, so they're still not found
const NOT_LOOSER: [string, string][] = [
  ['mintplanetsun99', 'MINTPLANETSUN-99'],
  ['min planet sun 99', 'MIN-PLANET-SUN-99'],
  ['planet mint sun 99', 'PLANET-MINT-SUN-99'],
  ['mint planet sun ninety-nine', 'MINT-PLANET-SUN-NINETY-NINE'],
];

describe('codes as children type them', () => {
  it('takes a number typed straight after the last word', () => {
    for (const [typed, code] of TAKEN) expect(cleanCode(typed), typed).toBe(code);
  });

  it('takes nothing looser: run-together words, a misspelling, swapped words, the number in words', () => {
    for (const [typed, code] of NOT_LOOSER) expect(cleanCode(typed), typed).toBe(code);
  });

  it('the server cleans every code the same way', () => {
    expect(line, 'cleanCode in deploy/site/worker.js').toBeTruthy();
    for (const [typed] of [...TAKEN, ...NOT_LOOSER, ['', ''], ['99sun', ''], ['a1b2', ''], ['sun-99-', '']]) expect(serverClean(typed), typed).toBe(cleanCode(typed));
    expect(serverClean(undefined)).toBe('');
  });

  it('class codes are cleaned the same way, since the server has one cleanCode for both', () => {
    for (const [typed] of [...TAKEN, ...NOT_LOOSER]) expect(cleanClassCode(typed), typed).toBe(cleanCode(typed));
  });

  it('the game cleans a typed save code with it, and has no other way of cleaning one', () => {
    const cloud = read('./cloud.svelte.ts');
    expect(cloud).toContain("import { cleanCode } from './codes';");
    expect(cloud).toMatch(/const code = cleanCode\(raw\);/);
    expect(cloud).not.toMatch(/toUpperCase\(\)\.replace/);
    expect(read('../teach/names.ts')).not.toMatch(/toUpperCase\(\)\.replace/);
  });
});
