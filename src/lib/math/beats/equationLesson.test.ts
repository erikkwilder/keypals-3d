// Mystery Bags played with a pretend child and a pretend world: every kind of child gets to the end, every
// number they give is put on the balance, nothing said gives an answer away before it's asked, and the
// script keeps to the lesson rules (docs/lesson-rules.md). The film itself is checked by playing it.
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { EQUATION_LESSON, EQUATION_LINES, FIRST, BUDDY, ONE_MORE, type EquationWorld } from './equationLesson';
import { offOther, oneBagOff, partShare, swapped, written, xOf } from './equation';
import type { Teller } from './types';
import { EQ_LINES, LEARN_LINES } from '../../content/voice';
import { lineProblems, scriptProblems, stillStretches, type Step } from './rules';

type Child = { nums: number[]; picks: string[] };
function pretend(child: Child) {
  const log: string[] = [], said: string[] = [];
  // (what the world does inside a line's pictures is logged as "show ...": it goes with the words, it isn't a try.
  // But a real try that begins while its own line announces it (rule 45: the lines called try.*) is still logged
  // as the try it is, and so is an answer put on the balance, so rules 6 to 12 keep holding them)
  let showing = false, trying = false;
  const world = new Proxy({} as EquationWorld, {
    get: (_, k: string) => (...a: unknown[]) => {
      const call = `${k}(${a.map(x => JSON.stringify(x)).join(',')})`;
      // (one try a line: the buddy's way comes off in two halves, and the second half is the rest of the same try)
      const real = /^(setRight|shareOut)/.test(call) || (trying && ACTS.test(call));
      if (trying && ACTS.test(call)) trying = false;
      log.push(`${showing && !real ? 'show ' : ''}${call}`); return Promise.resolve();
    },
  });
  const speak = (id: string, n?: number, m?: number, k?: number) => { said.push(id); log.push(`say ${id}${n != null ? ` [${[n, m, k].filter(x => x != null).join(',')}]` : ''}`); };
  const teller: Teller = {
    say: async (id, n, m, k) => { speak(id, n, m, k); },
    // (a line said with its pictures: the line, then each picture in turn)
    sayWith: async (id, cues, n, m, k) => { speak(id, n, m, k); log.push('shown'); showing = true; trying = /^ep\.eq\.try\./.test(id); for (const [, act] of cues) await act(); showing = trying = false; },
    num: async (_, id, n) => { if (id) speak(id, n); const v = child.nums.shift(); if (v == null) throw new Error('the lesson asked for more numbers than this child has'); log.push(`num ${v}`); return v; },
    pick: async (_, choices, id) => { if (id) speak(id); const p = child.picks.shift() ?? choices[0].id; log.push(`pick ${p}`); return p as never; },
    hands: async (_, job) => { await job(); },
    go: async l => { log.push(`go ${l}`); }, wait: async () => {},
    buddy: () => {}, pal: () => {}, thought: (w, t) => { if (t) log.push(`${w} thinks ${t}`); }, myBet: () => {}, beat: () => {},
  };
  return { log, said, world, teller };
}
const ACTS = /^(swapIn|takeOff|takeRight|share\(|buddyShare)/, ANSWERS = /^(writeSteps|shareOut|setRight)/;
const stepsOf = (log: string[]): Step[] => log.flatMap((l, i): Step[] => {
  if (l.startsWith('say ')) return [{ k: 'say', v: l.slice(4), shown: log[i + 1] === 'shown' }];
  if (l.startsWith('show ')) return [{ k: 'show', v: l.slice(5) }];
  if (l.startsWith('go ')) return [{ k: 'go', v: l.slice(3) }];
  if (l.startsWith('num ') || l.startsWith('pick ')) return [{ k: 'ask', v: l }];
  if (ACTS.test(l)) return [{ k: 'act', v: l }];
  if (ANSWERS.test(l)) return [{ k: 'answer', v: l }];
  return [];
});
const announces = /\.try\./;
const run = async (c: Child) => { const p = pretend({ nums: [...c.nums], picks: [...c.picks] }); const notes = await EQUATION_LESSON.play(p.teller, p.world); return { ...p, notes }; };

// right: guess 4, 3 off, 4 off, 5 on their own. All wrong: every number wrong, every pick wrong, the extra one wrong to the end
// (a guess of 7, 1 off, 1 with the bag, 7 for the buddy's balance, then 5 for the last step of the extra one).
const RIGHT: Child = { nums: [4, 3, 4, 5], picks: ['no'] };
const WRONG: Child = { nums: [7, 1, 1, 7, 5], picks: ['yes'] };
const MIXED: Child = { nums: [2, 5, 8, 5], picks: ['yes'] };

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
    for (const a of ['swapIn(7)', 'takeRight(1)', 'share(1)', 'swapIn(5)']) expect(log).toContain(a);
  });
  it('a child wrong all the way through is shown each answer, and gets one more balance to do alone', async () => {
    const { log, said, notes } = await run(WRONG);
    expect(notes.own).toBe(0);
    expect(said).toContain('ep.eq.together');
    expect(said).toContain('ep.eq.d.in');
    expect(log.filter(l => l.startsWith('takeOff')).length).toBe(3);
    expect(said).toContain('ep.eq.d.piles');
    // (the last thing said is the ending, and only its own pictures come after it)
    expect(log.filter(l => l.startsWith('say ')).at(-1)).toMatch(/^say ep\.eq\.end/);
    expect(log.slice(log.findIndex(l => /^say ep\.eq\.end/.test(l)) + 1).every(l => l === 'shown' || l.startsWith('show '))).toBe(true);
  });
  it('the extra balance starts with its first step done together by hand, and the last step is the child\'s', async () => {
    const { log, said } = await run({ nums: [7, 1, 1, 7, 3], picks: ['yes'] });
    expect(said).toContain('ep.eq.try.d');
    expect(said).toContain('ep.eq.d.own');
    expect(said).not.toContain('ep.eq.d.piles');
    // (one test each: the first guess, the buddy's balance, and the extra balance's last step. No try at the
    // whole extra balance first: this child has just needed the last one done together)
    expect(log.filter(l => l.startsWith('swapIn')).length).toBe(3);
    expect(log.indexOf('takeOff("both")', log.indexOf('say ep.eq.d.in'))).toBeLessThan(log.lastIndexOf('num 3'));
  });
  it('a miss is told in one line with what the bags\' side came to against the other side', async () => {
    const { log } = await run(WRONG);
    // 7 in each of 2 bags and the 3 loose weights is 17, against 11
    expect(log).toContain('say ep.eq.heavy [7,17,11]');
  });
  it('only a child who needed the buddy\'s balance done together sees it written down a second time', async () => {
    expect((await run(RIGHT)).said).not.toContain('ep.eq.b.write');
    expect((await run(WRONG)).said).toContain('ep.eq.b.write');
    expect((await run(RIGHT)).said).toContain('ep.eq.write.read');
  });
  it('one right on their own is enough: no extra balance', async () => {
    const { said } = await run(MIXED);
    expect(said).not.toContain('ep.eq.d.in');
  });
  it('the equation is written only after the hands have done it', async () => {
    const { log } = await run(RIGHT);
    expect(log.findIndex(l => l.startsWith('show writeLine'))).toBeGreaterThan(log.findIndex(l => l.startsWith('share(')));
    expect(log.findIndex(l => l.startsWith('show writeSteps'))).toBeGreaterThan(log.findIndex(l => l.startsWith('show writeLine')));
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
    'silly numbers': { nums: [9999, 0, 9999, 0, 9999, 0], picks: ['yes'] },
    'wrong until the very last step': { nums: [5, 2, 3, 7, 3], picks: ['no'] },
  };
  for (const [name, kid] of Object.entries(kids)) it(`a child who is ${name}: every try named, explained, and every answer waits`, async () => {
    const { log } = await run(kid);
    expect(scriptProblems({ steps: stepsOf(log), announces })).toEqual([]);
  });
  it('every line can stand up to the words rules', () => {
    expect(lineProblems(EQ_LINES)).toEqual([]);
  });
  it('only {n}, {m} and {k} are filled in, and never in what the voice says', () => {
    for (const l of EQ_LINES) { expect(l.text.replace(/\{[nmk]\}/g, ''), l.id).not.toMatch(/[{}]/); expect(l.said ?? '', l.id).not.toMatch(/[{}]/); }
  });
  it('a guess of the buddy\'s own mistake on the buddy\'s balance is told what the mistake was', async () => {
    const { said, log } = await run(WRONG);   // 7 = 21 shared into 3, with the 6 loose weights still on
    expect(said).toContain('ep.eq.b.seven');
    expect(log).toContain('say ep.eq.b.seven [7,27,21]');
    const other = await run({ nums: [7, 1, 1, 9, 5], picks: ['yes'] });
    expect(other.said).not.toContain('ep.eq.b.seven');
    expect(other.log).toContain('say ep.eq.heavy [9,33,21]');
  });
  it('a child who solved nothing alone is not told "you found"; one who did the last step is', async () => {
    expect((await run(WRONG)).said).toContain('ep.eq.end.we');
    expect((await run(RIGHT)).said).toContain('ep.eq.end');
    expect((await run({ nums: [7, 1, 1, 7, 3], picks: ['yes'] })).said).toContain('ep.eq.end');
  });
  it('writes the script out for a cold read, when asked (rule 21)', async () => {
    const out = process.env.COLD_READ;
    if (!out) return;
    const text = (id: string, nm?: string) => (EQ_LINES.find(l => l.id === id)?.text ?? id).replaceAll('{n}', nm?.split(',')[0] ?? '').replaceAll('{m}', nm?.split(',')[1] ?? '').replaceAll('{k}', nm?.split(',')[2] ?? '');
    const print = (log: string[]) => log.filter(l => l !== 'shown').map((l, i, all) => {
      const m = /^say (\S+)(?: \[(.+)\])?$/.exec(l);
      if (m) return `SAID${all[i + 1]?.startsWith('show ') ? ' (with the pictures under it, each as its words are said)' : ''}: ${text(m[1], m[2])}`;
      return l.startsWith('show ') ? `    (picture with those words: ${l.slice(5)})` : `(picture or child: ${l})`;
    }).join('\n');
    const w = await run(WRONG), r = await run(RIGHT);
    const left = (log: string[]) => stillStretches(stepsOf(log), words).join('\n') || 'none';
    writeFileSync(out.replace(/(\.txt)?$/, '.equation.txt'), `A CHILD WHO IS WRONG EVERY TIME\n\n${print(w.log)}\n\nSTILL STRETCHES LEFT (rule 37)\n${left(w.log)}\n\n\nA CHILD WHO IS RIGHT EVERY TIME\n\n${print(r.log)}\n\nSTILL STRETCHES LEFT (rule 37)\n${left(r.log)}\n`);
  });
});

/** how many words a line has on screen, by the step that said it */
const words = (v: string) => (EQ_LINES.find(l => l.id === v.split(' ')[0])?.text ?? '').split(/\s+/).length;

describe('rule 37: what is said is shown on the balance as it is said', () => {
  const upTo = (log: string[], id: string) => log.slice(0, log.indexOf(`say ${id}`));
  const kids: Record<string, Child> = { 'right every time': RIGHT, 'wrong every time (too few)': WRONG, 'wrong the other way (too many)': MIXED, 'giving silly numbers': { nums: [9999, 0, 9999, 0, 9999, 0], picks: ['yes'] } };
  for (const [name, kid] of Object.entries(kids)) it(`from the opening to x = 4 written down, a child who is ${name} never watches a still screen`, async () => {
    const { log } = await run(kid);
    expect(stillStretches(stepsOf(upTo(log, 'ep.eq.b.in')), words)).toEqual([]);
  });
  it('the opening happens as it is told: the bags, the question on one, onto the balance, then the x written', async () => {
    const { log } = await run(RIGHT);
    const at = (l: string) => log.indexOf(l);
    for (const l of ['show bagsOut({"p":2,"q":3,"r":11})', 'show askBag()', 'show loadLeft()', 'show fillRight()', 'show writeX()']) expect(at(l), l).toBeGreaterThan(-1);
    expect(at('show askBag()')).toBeLessThan(at('say ep.eq.scale'));
    expect(at('show fillRight()')).toBeLessThan(at('say ep.eq.level'));
    expect(at('show writeX()')).toBeGreaterThan(at('say ep.eq.letter'));
  });
  it('a miss shows what the bags\' side came to, on the balance, against the other side', async () => {
    const { log } = await run(WRONG);
    expect(log.indexOf('show total(17)')).toBeGreaterThan(log.indexOf('say ep.eq.heavy [7,17,11]'));
  });
  it('each written line is written as the balance does it again, and then all three wait for the child', async () => {
    for (const kid of [RIGHT, WRONG]) {
      const { log } = await run(kid);
      const a = log.indexOf('say ep.eq.write'), b = log.indexOf('say ep.eq.b.in'), part = log.slice(a, b);
      // the balance is put back the way it started, and each part of the first line is lit with its part of the balance
      expect(part).toContain('show reset("start")');
      const lit = (hot: number, what: string) => { const i = part.findIndex(l => l.startsWith('show writeLine(0,') && l.endsWith(`,${hot})`)); expect(i, what).toBeGreaterThan(-1); expect(part[i + 1], what).toBe(`show ${what}`); };
      lit(0, 'light("bags")'); lit(2, 'light("loose")'); lit(4, 'light("right")');
      expect(part[part.findIndex(l => l.startsWith('show writeLine(0,') && l.endsWith(',3)')) + 1]).toBe('show levelLine(true)');
      // then each step is done again before its line is written
      const i = (l: string) => part.findIndex(x => x.startsWith(l));
      expect(i('show offBoth()')).toBeLessThan(i('show writeLine(1,'));
      expect(i('show share(4)')).toBeGreaterThan(i('show writeLine(1,'));
      expect(i('show share(4)')).toBeLessThan(i('show writeLine(2,'));
      // and the three lines stand together until the child goes on
      expect(part.slice(i('show writeSteps')).filter(l => !l.startsWith('show '))).toEqual(['go Next', 'clearSteps()']);
    }
  });
  for (const [name, kid] of Object.entries(kids)) it(`from the buddy's idea to the end, a child who is ${name} never watches a still screen`, async () => {
    const { log } = await run(kid);
    expect(stillStretches(stepsOf(log), words)).toEqual([]);
  });
  it('the next day\'s check never leaves a still screen either, right or wrong', async () => {
    for (const nums of [[6], [9, 2], [7, 6]]) {
      const p = pretend({ nums: [...nums], picks: [] });
      await EQUATION_LESSON.check!(p.teller, p.world, { first: 7 });
      expect(stillStretches(stepsOf(p.log), words)).toEqual([]);
    }
  });
  it('rule 45: a try begins while its line announces it, and is still a try; nothing is put back or taken off in quiet between two lines', async () => {
    const { log } = await run(WRONG);
    const next = (l: string) => log.slice(log.indexOf(l) + 1, log.indexOf(l) + 3);
    expect(next('say ep.eq.try.you [7]')).toEqual(['shown', 'swapIn(7)']);
    expect(next('say ep.eq.try.again [7]')).toEqual(['shown', 'swapIn(7)']);
    expect(next('say ep.eq.try.other [1]')).toEqual(['shown', 'takeRight(1)']);
    expect(next('say ep.eq.try.share [1]')).toEqual(['shown', 'share(1)']);
    // the other side loses its 3 inside the line that says it has to; the piles come off with their bags inside the line that makes them
    expect(next('say ep.eq.other.few [1]')).toEqual(['shown', 'setRight(8)']);
    for (const [line, parts] of [['share.how', 2], ['b.share', 3], ['d.share', 4]]) {
      const i = log.indexOf(`say ep.eq.${line}`), j = log.findIndex((l, n) => n > i && l.startsWith('say '));
      expect(log.slice(i, j).at(-1), String(line)).toBe(`shareOut(${parts})`);
    }
    // the bags come back with the words that follow a miss, or inside a right number's own line; never a test left standing
    expect(next('say ep.eq.unlucky')[0]).toBe('swapBack()');
    expect(next('say ep.eq.together')[0]).toBe('swapBack()');
    expect(log.slice(log.indexOf('say ep.eq.d.share'), log.indexOf('say ep.eq.d.share') + 3)).toContain('show swapBack()');
    for (const kid of [RIGHT, WRONG, MIXED]) {
      const { log } = await run(kid);
      expect(log.filter(l => l.endsWith('swapBack()')).length).toBe(log.filter(l => l.startsWith('swapIn')).length);
    }
    const right = (await run(RIGHT)).log;
    expect(right.slice(right.findIndex(l => l.startsWith('say ep.eq.lucky')), right.indexOf('say ep.eq.own.why'))).toContain('show swapBack()');
    // (what level would mean is said before the weights go in, so the balance answers a question already put)
    const t = EQ_LINES.find(l => l.id === 'ep.eq.try.you')!.text;
    expect(t.indexOf('hang level')).toBeLessThan(t.indexOf('go in each bag'));
  });
  it('the two steps are told whole once, after the buddy\'s way tips, and the child\'s own turn only names them (rule 44)', () => {
    const text = (id: string) => EQ_LINES.find(l => l.id === id)!.text;
    expect(text('ep.eq.b.rule')).toMatch(/off both sides first\. Then only bags are left to share/);
    expect(text('ep.eq.b.own')).toMatch(/those two steps/);
    expect(text('ep.eq.b.own')).not.toMatch(/both sides|shared into/);
    // (the buddy's idea is announced by the line that tells it, not by the one before as well; and the buddy's way is
    // told once as a plan, so the try says what comes off without working the 14 out again)
    expect(text('ep.eq.b.in')).not.toMatch(/idea/);
    expect(text('ep.eq.try.buddy')).not.toMatch(/take away/);
    expect(text('ep.eq.scale')).not.toMatch(/puzzle/);
  });
  it('the buddy\'s plan is pictured before the child is asked, and nothing comes off until they have answered', async () => {
    for (const kid of [RIGHT, WRONG]) {
      const { log } = await run(kid);
      const idea = log.indexOf('say ep.eq.b.idea'), ask = log.indexOf('say ep.eq.b.ask'), tried = log.indexOf('say ep.eq.try.buddy'), told = log.findIndex(l => /^say ep\.eq\.b\.(no|yes)$/.test(l));
      // the new balance is set out as it is told
      expect(log.slice(log.indexOf('say ep.eq.b.in'), idea).filter(l => l.startsWith('show '))).toEqual(['show bagsOn({"p":3,"q":6,"r":21})', 'show looseOn()', 'show fillRight(true)']);
      // the plan: what would come off turns see-through, the 21 in 3 piles without the balance swinging (rule 41)
      const plan = log.slice(idea, ask);
      expect(plan).toContain('show keep("bag")'); expect(plan).toContain('show piles(3,true)'); expect(plan).toContain('show keep("pile")');
      expect(plan.some(l => /buddyShare|takeRight|shareOut|share\(/.test(l))).toBe(false);
      // then each half of the buddy's way as it is said, after the child's answer
      expect(log[ask + 1]).toMatch(/^pick /);
      expect(log.slice(tried, told).filter(l => /buddyShare/.test(l))).toEqual(['buddyShare("bags")', 'show buddyShare("weights")']);
    }
  });
  it('the tags get their numbers as the words say they are written', async () => {
    for (const kid of [RIGHT, WRONG]) {
      const { log } = await run(kid);
      const end = log.findIndex(l => /^say ep\.eq\.end/.test(l));
      // (rule 45: the bags come to stand in their row as the line begins, and get their numbers at its words)
      expect(log[end + 2]).toMatch(/^show tags\(/);
      expect(log.slice(end).indexOf('show writeTags()')).toBeGreaterThan(2);
    }
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
