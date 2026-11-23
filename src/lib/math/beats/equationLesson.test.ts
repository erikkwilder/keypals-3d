// Mystery Bags played with a pretend child and a pretend world: every kind of child gets to the end, every
// number they give is put on the balance, nothing said gives an answer away before it's asked, and the
// script keeps to the lesson rules (docs/lesson-rules.md). The film itself is checked by playing it.
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { EQUATION_LESSON, EQUATION_LINES, FIRST, BUDDY, ONE_MORE, type EquationWorld } from './equationLesson';
import { offOther, oneBagOff, partShare, swapped, written, xOf } from './equation';
import type { Teller } from './types';
import { EQ_LINES, LEARN_LINES } from '../../content/voice';
import { lineProblems, scriptProblems, type Step } from './rules';

type Child = { nums: number[]; picks: string[] };
function pretend(child: Child) {
  const log: string[] = [], said: string[] = [];
  const world = new Proxy({} as EquationWorld, {
    get: (_, k: string) => (...a: unknown[]) => { log.push(`${k}(${a.map(x => JSON.stringify(x)).join(',')})`); return Promise.resolve(); },
  });
  const speak = (id: string, n?: number, m?: number) => { said.push(id); log.push(`say ${id}${n != null ? ` [${n}${m != null ? `,${m}` : ''}]` : ''}`); };
  const teller: Teller = {
    say: async (id, n, m) => { speak(id, n, m); },
    num: async (_, id, n) => { if (id) speak(id, n); const v = child.nums.shift(); if (v == null) throw new Error('the lesson asked for more numbers than this child has'); log.push(`num ${v}`); return v; },
    pick: async (_, choices, id) => { if (id) speak(id); const p = child.picks.shift() ?? choices[0].id; log.push(`pick ${p}`); return p as never; },
    hands: async (_, job) => { await job(); },
    go: async l => { log.push(`go ${l}`); }, wait: async () => {},
    buddy: () => {}, pal: () => {}, thought: (w, t) => { if (t) log.push(`${w} thinks ${t}`); }, myBet: () => {}, beat: () => {},
  };
  return { log, said, world, teller };
}
const ACTS = /^(swapIn|takeOff|takeRight|share\(|buddyShare)/, ANSWERS = /^(writeSteps|shareOut|setRight)/;
const stepsOf = (log: string[]): Step[] => log.flatMap((l): Step[] => {
  if (l.startsWith('say ')) return [{ k: 'say', v: l.slice(4) }];
  if (l.startsWith('go ')) return [{ k: 'go', v: l.slice(3) }];
  if (l.startsWith('num ') || l.startsWith('pick ')) return [{ k: 'ask', v: l }];
  if (ACTS.test(l)) return [{ k: 'act', v: l }];
  if (ANSWERS.test(l)) return [{ k: 'answer', v: l }];
  return [];
});
const announces = /\.try\./;
const run = async (c: Child) => { const p = pretend({ nums: [...c.nums], picks: [...c.picks] }); const notes = await EQUATION_LESSON.play(p.teller, p.world); return { ...p, notes }; };

// right: guess 4, 3 off, 4 off, 5 on their own. All wrong: every number wrong, every pick wrong, the extra one wrong to the end
// (a guess of 7, 1 off, 1 with the bag, 7 for the buddy's balance, then 1 and 5 for the extra one).
const RIGHT: Child = { nums: [4, 3, 4, 5], picks: ['up', 'no'] };
const WRONG: Child = { nums: [7, 1, 1, 7, 1, 5], picks: ['level', 'yes'] };
const MIXED: Child = { nums: [2, 5, 8, 5], picks: ['down', 'yes'] };

describe('a balance with bags, in numbers', () => {
  it('each balance has a whole number in every bag', () => {
    for (const e of [FIRST, BUDDY, ONE_MORE]) expect(Number.isInteger(xOf(e))).toBe(true);
    expect([xOf(FIRST), xOf(BUDDY), xOf(ONE_MORE)]).toEqual([4, 5, 3]);
  });
  it('a guess in place of each bag tips the way its weight says', () => {
    expect(swapped(FIRST, 4).tip).toBe(0);
    expect(swapped(FIRST, 5)).toEqual({ left: 13, tip: 1 });
    expect(swapped(FIRST, 0).tip).toBe(-1);
  });
  it('the other side must lose what the bags\' side lost, and one bag goes with half', () => {
    expect([offOther(FIRST, 3), offOther(FIRST, 1), offOther(FIRST, 9)]).toEqual([0, -1, 1]);
    expect([oneBagOff(FIRST, 4), oneBagOff(FIRST, 1), oneBagOff(FIRST, 8)]).toEqual([0, -1, 1]);
  });
  it('the buddy\'s share keeps the loose weights, so it tips toward the bags', () => {
    expect(partShare(BUDDY)).toEqual({ left: 11, right: 7, tip: 1, says: 1 });
  });
  it('the written lines come from the balance', () => {
    expect(written(FIRST).map(l => l.parts.map(p => p.t).join(' '))).toEqual(['2x + 3 = 11', '2x = 8', 'x = 4']);
  });
});

describe('the lesson, played by every kind of child', () => {
  it('a child who is right every time goes straight through, and still sees the working', async () => {
    const { log, said, notes } = await run(RIGHT);
    expect(notes).toEqual({ first: 4, own: 1 });
    expect(said).toContain('ep.eq.lucky');
    expect(said).toContain('ep.eq.write.read');
    expect(log.some(l => l.startsWith('setRight'))).toBe(false);
  });
  it('every number the child gives is put on the balance', async () => {
    const { log } = await run(WRONG);
    for (const a of ['swapIn(7)', 'takeRight(1)', 'share(1)', 'swapIn(1)', 'swapIn(5)']) expect(log).toContain(a);
  });
  it('a child wrong all the way through is shown each answer, and gets one more balance to do alone', async () => {
    const { log, said, notes } = await run(WRONG);
    expect(notes.own).toBe(0);
    expect(said).toContain('ep.eq.together');
    expect(said).toContain('ep.eq.d.in');
    expect(log.filter(l => l.startsWith('takeOff')).length).toBe(3);
    expect(said).toContain('ep.eq.d.piles');
    expect(log.at(-1)).toMatch(/^say ep\.eq\.end/);
  });
  it('after a miss on the extra balance its first step is done together by hand, and the last step is the child\'s', async () => {
    const { log, said } = await run({ nums: [7, 1, 1, 7, 1, 3], picks: ['level', 'yes'] });
    expect(said).toContain('ep.eq.try.d');
    expect(said).toContain('ep.eq.d.own');
    expect(said).not.toContain('ep.eq.d.piles');
    // (one test each: the first guess, the buddy's balance, the extra balance, and its last step)
    expect(log.filter(l => l.startsWith('swapIn')).length).toBe(4);
  });
  it('a miss is told in one line with what the bags\' side came to, and a wrong prediction is named back', async () => {
    const { log, said } = await run(WRONG);
    // 7 in each of 2 bags and the 3 loose weights is 17, against 11
    expect(log).toContain('say ep.eq.heavy [7,17]');
    expect(said).toContain('ep.eq.off.level');
    const down = await run({ ...WRONG, picks: ['down', 'yes'] });
    expect(down.said).toContain('ep.eq.off.down');
  });
  it('one right on their own is enough: no extra balance', async () => {
    const { said } = await run(MIXED);
    expect(said).not.toContain('ep.eq.d.in');
  });
  it('the equation is written only after the hands have done it', async () => {
    const { log } = await run(RIGHT);
    expect(log.findIndex(l => l.startsWith('writeSteps'))).toBeGreaterThan(log.findIndex(l => l.startsWith('share(')));
  });
  it('nothing said before a number question gives its answer', async () => {
    const { log } = await run(WRONG);
    const text = (l: string) => EQ_LINES.find(x => x.id === l.split(' ')[1])?.text ?? '';
    const before = (q: string, ans: string) => { const i = log.indexOf(q); return log.slice(0, i).filter(l => l.startsWith('say ')).map(text).join(' '); };
    expect(before('num 7', '4')).not.toMatch(/\b4\b/);
    expect(before('num 1', '3')).not.toMatch(/\bthree\b|\b3 off\b/);
  });
  it('the next day remembers the first guess, and a miss still ends in the hands', async () => {
    for (const nums of [[6], [5, 6], [5, 7]]) {
      const p = pretend({ nums: [...nums], picks: [] });
      await EQUATION_LESSON.check(p.teller, p.world, { first: 7 });
      expect(scriptProblems({ steps: stepsOf(p.log), announces })).toEqual([]);
      if (nums.at(-1) !== 6) expect(p.log.some(l => l.startsWith('takeOff'))).toBe(true);
    }
    expect(EQUATION_LESSON.card({ first: 7 })[0]).toContain('7');
  });
});

describe('the lesson rules (docs/lesson-rules.md)', () => {
  const kids: Record<string, Child> = {
    'right every time': RIGHT, 'wrong every time': WRONG, 'mixed': MIXED,
    'silly numbers': { nums: [9999, 0, 9999, 0, 9999, 0], picks: ['down', 'yes'] },
    'wrong until the very last step': { nums: [5, 2, 3, 7, 5, 3], picks: ['up', 'no'] },
  };
  for (const [name, kid] of Object.entries(kids)) it(`a child who is ${name}: every try named, explained, and every answer waits`, async () => {
    const { log } = await run(kid);
    expect(scriptProblems({ steps: stepsOf(log), announces })).toEqual([]);
  });
  it('every line can stand up to the words rules', () => {
    expect(lineProblems(EQ_LINES)).toEqual([]);
  });
  it('only {n} and {m} are filled in, and never in what the voice says', () => {
    for (const l of EQ_LINES) { expect(l.text.replace(/\{[nm]\}/g, ''), l.id).not.toMatch(/[{}]/); expect(l.said ?? '', l.id).not.toMatch(/[{}]/); }
  });
  it('writes the script out for a cold read, when asked (rule 21)', async () => {
    const out = process.env.COLD_READ;
    if (!out) return;
    const text = (id: string, nm?: string) => (EQ_LINES.find(l => l.id === id)?.text ?? id).replaceAll('{n}', nm?.split(',')[0] ?? '').replaceAll('{m}', nm?.split(',')[1] ?? '');
    const print = (log: string[]) => log.map(l => { const m = /^say (\S+)(?: \[(.+)\])?$/.exec(l); return m ? `SAID: ${text(m[1], m[2])}` : `(picture or child: ${l})`; }).join('\n');
    const w = await run(WRONG), r = await run(RIGHT);
    writeFileSync(out.replace(/(\.txt)?$/, '.equation.txt'), `A CHILD WHO IS WRONG EVERY TIME\n\n${print(w.log)}\n\n\nA CHILD WHO IS RIGHT EVERY TIME\n\n${print(r.log)}\n`);
  });
});

describe('the words', () => {
  const said = (id: string) => EQ_LINES.find(l => l.id === id)?.said ?? '';
  it('every line the lesson uses exists, and nothing else is written for it', () => {
    expect(EQ_LINES.map(l => l.id).sort()).toEqual([...EQUATION_LINES].sort());
    for (const id of EQUATION_LINES) expect(LEARN_LINES.some(l => l.id === id), id).toBe(true);
  });
  it('a line explains in a sentence or three, and never runs on', () => {
    for (const id of EQUATION_LINES) expect(said(id).split(/\s+/).length, id).toBeLessThanOrEqual(40);
  });
  it('no ending about learning, and no stock praise', () => {
    for (const id of EQUATION_LINES) expect(said(id), id).not.toMatch(/learn|explain|great job|well done|thank you|awesome|amazing/i);
  });
});
