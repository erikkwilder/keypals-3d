// How Many Cookies? played with a pretend child and a pretend world: every kind of child gets to the end,
// every number the child gives is acted out with plates, nothing is said that gives an answer away before
// it's asked, and the words keep to the lesson rules. (The film itself is checked by playing it.)
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { COUNT_LESSON, COUNT_LINES, type CountWorld } from './countLesson';
import type { Teller } from './types';
import { countPath, numbersOn, plateMeaning, slipped } from './count';
import { BEAT_LINES, LEARN_LINES } from '../../content/voice';
import { lineProblems, scriptProblems, type Step } from './rules';

type Child = { nums: number[] };
function pretend(child: Child) {
  const log: string[] = [], said: string[] = [];
  const world = new Proxy({} as CountWorld, {
    get: (_, k: string) => {
      if (k === 'slipCount') return async (who: string, slip: string) => { log.push(`slipCount("${who}","${slip}")`); return countPath(7, slip as 'twice').length; };
      return (...a: unknown[]) => { log.push(`${k}(${a.map(x => JSON.stringify(x)).join(',')})`); return Promise.resolve(); };
    },
  });
  const speak = (id: string) => { said.push(id); log.push(`say ${id}`); };
  const teller: Teller = {
    say: async id => { speak(id); },
    num: async (_, id) => { if (id) speak(id); const n = child.nums.shift(); if (n == null) throw new Error('the lesson asked for more numbers than this child has'); log.push(`num ${n}`); return n; },
    pick: async (_, choices, id) => { if (id) speak(id); log.push(`pick ${choices[0].id}`); return choices[0].id as never; },
    hands: async (_, job) => { log.push('hands'); await job(); },
    go: async l => { log.push(`go ${l}`); }, wait: async () => {},
    buddy: () => {}, pal: () => {}, thought: (w, t) => { if (t) log.push(`${w} thinks ${t}`); }, myBet: () => {}, beat: () => {},
  };
  return { log, said, world, teller };
}
/** The run as the rules see it: a number of plates, a friend's count, a counting demo and a bump are things
 *  tried and acted out; the light going along the numbers and the recount are the answer worked out. */
const stepsOf = (log: string[]): Step[] => log.flatMap((l): Step[] => {
  if (l.startsWith('say ')) return [{ k: 'say', v: l.slice(4) }];
  if (l.startsWith('go ')) return [{ k: 'go', v: l.slice(3) }];
  if (l.startsWith('num ') || l.startsWith('pick ')) return [{ k: 'ask', v: l }];
  if (/^(plates|slipCount|demoCount|bump)\(/.test(l)) return [{ k: 'act', v: l }];
  if (/^(pointCount|recount)\(/.test(l)) return [{ k: 'answer', v: l }];
  return [];
});
const announces = /\.try\./;
const play = async (c: Child) => { const p = pretend(c); const notes = await COUNT_LESSON.play(p.teller, p.world); return { ...p, notes }; };

describe('counting, in numbers', () => {
  it('plates mean one each, some cookies left out, or plates left empty', () => {
    expect(plateMeaning(5, 5)).toEqual({ kind: 'full' });
    expect(plateMeaning(4, 5)).toEqual({ kind: 'short', missing: 1 });
    expect(plateMeaning(0, 5)).toEqual({ kind: 'short', missing: 5 });
    expect(plateMeaning(9999, 7)).toEqual({ kind: 'over', extra: 9992 });
  });
  it('the two slips give one too many and one too few, and say which cookie', () => {
    const twice = countPath(7, 'twice'), skip = countPath(7, 'skip');
    expect(twice).toHaveLength(8); expect(skip).toHaveLength(6);
    expect(numbersOn(twice, 7)[slipped(twice, 7)]).toHaveLength(2);
    expect(numbersOn(skip, 7)[slipped(skip, 7)]).toHaveLength(0);
    expect(slipped(countPath(7), 7)).toBe(-1);
    // (the cookie counted twice gets its two numbers apart, so the slip shows: not 3 and 4)
    const two = numbersOn(twice, 7)[slipped(twice, 7)];
    expect(two[1] - two[0]).toBeGreaterThan(1);
  });
});

describe('the lesson, played by every kind of child', () => {
  it('a child who is right goes straight through, and still sees where each answer comes from', async () => {
    const { log, notes, said } = await play({ nums: [5, 7, 7] });
    expect(notes).toEqual({ first: 5, second: 7, moved: 7 });
    expect(said).toContain('ep.count.b5.why');
    expect(said).toContain('ep.count.b7.why');
    expect(said).not.toContain('ep.count.b5.show');
    expect(log.filter(l => l.startsWith('pointCount'))).toHaveLength(3); // the demo, then each of their counts
    expect(log).toContain('recount()');
  });
  it('the counting is shown before the child is asked to do any', async () => {
    const { log } = await play({ nums: [5, 7, 7] });
    expect(log.indexOf('demoCount()')).toBeLessThan(log.indexOf('hands'));
    expect(log.indexOf('demoCount()')).toBeLessThan(log.findIndex(l => l.startsWith('num ')));
  });
  it('the child always counts with their own hands before being asked how many', async () => {
    const { log } = await play({ nums: [5, 7, 7] });
    const asks = log.map((l, i) => l.startsWith('num ') ? i : -1).filter(i => i >= 0);
    expect(log.slice(0, asks[0]).includes('tapCount()')).toBe(true);
    expect(log.slice(asks[0] + 1, asks[1]).includes('tapCount()')).toBe(true);
  });
  it('every number is acted out with that many plates, even a silly one', async () => {
    const { log } = await play({ nums: [9999, 0, 3, 4] });
    expect(log).toContain('plates(9999)');
    expect(log).toContain('plates(0)');
    expect(log).toContain('plates(3)');
  });
  it('a wrong count is looked at together, never asked again straight after being shown', async () => {
    const { said, log } = await play({ nums: [4, 8, 6, 3] });
    expect(said).toContain('ep.count.b5.show');
    expect(said).toContain('ep.count.b7.show');
    const shown = said.indexOf('ep.count.b5.show');
    expect(said.slice(shown, said.indexOf('ep.count.mixed'))).not.toContain('ep.count.how');
    expect(log).toContain('plates(5)');
    expect(log).toContain('plates(7)');
  });
  it('the friends count the mixed-up cookies with the two slips, and their numbers are shown', async () => {
    const { log } = await play({ nums: [5, 7, 7] });
    expect(log).toContain('slipCount("pal","twice")');
    expect(log).toContain('pal thinks 8');
    expect(log).toContain('slipCount("buddy","skip")');
    expect(log).toContain('buddy thinks 6');
  });
  it('after the bump everyone sees the recount, right or wrong', async () => {
    for (const moved of [7, 3, 12]) {
      const { log, said } = await play({ nums: [5, 7, moved, 4] });
      expect(log).toContain('recount()');
      expect(said).toContain('ep.count.recount.same');
      expect(said.includes('ep.count.moved.right')).toBe(moved === 7);
    }
  });
  it('a child wrong every time still counts one batch right by themselves before the end, and one who got one right does not', async () => {
    const wrong = await play({ nums: [4, 8, 6, 4] });
    expect(wrong.said).toContain('ep.count.extra');
    expect(wrong.said).toContain('ep.count.b4.why');
    expect(wrong.log).toContain('plates(4)');
    const once = await play({ nums: [4, 8, 7] });
    expect(once.said).not.toContain('ep.count.extra');
  });
  it('the next day: a new mixed-up batch, counted by hand, then how many', async () => {
    for (const nums of [[6], [5]]) {
      const right = nums[0] === 6, p = pretend({ nums: [...nums] });
      await COUNT_LESSON.check(p.teller, p.world, null);
      expect(p.log.indexOf('tapCount()')).toBeLessThan(p.log.findIndex(l => l.startsWith('num ')));
      expect(p.said).toContain(right ? 'ep.count.b6.why' : 'ep.count.b6.show');
      expect(scriptProblems({ steps: stepsOf(p.log), announces })).toEqual([]);
    }
    expect(COUNT_LESSON.card({ first: 4 })[0]).toContain('4');
  });
});

describe('the lesson rules (docs/lesson-rules.md)', () => {
  const kids: Record<string, number[]> = {
    'right every time': [5, 7, 7], 'wrong every time': [4, 8, 6, 3], 'too many every time': [9, 9, 9, 9],
    'too few every time': [1, 2, 0, 1], 'right, then wrong': [5, 6, 8], 'counts like Sprout Bunny': [5, 8, 8],
  };
  for (const [name, nums] of Object.entries(kids)) it(`a child who is ${name}: every try named, explained, and every answer waits`, async () => {
    const { log } = await play({ nums });
    expect(scriptProblems({ steps: stepsOf(log), announces })).toEqual([]);
  });
  it('every line can stand up to the words rules', () => {
    expect(lineProblems(BEAT_LINES)).toEqual([]);
  });
  it('nothing said before a question gives its answer away', async () => {
    const { log } = await play({ nums: [4, 8, 6, 3] });
    const text = (id: string) => BEAT_LINES.find(l => l.id === id)!.text;
    // (each "how many" question: the lines since the child's count began say nothing of the total)
    for (const [ask, total] of [['ep.count.how', '5'], ['ep.count.how2', '7'], ['ep.count.moved', '7']] as const) {
      const at = log.indexOf(`say ${ask}`), from = log.lastIndexOf('hands', at) >= 0 && ask !== 'ep.count.moved' ? log.lastIndexOf('hands', at) : log.lastIndexOf('bump()', at);
      const lines = log.slice(from, at + 1).filter(l => l.startsWith('say ')).map(l => text(l.slice(4)));
      for (const l of lines) expect(l, ask).not.toMatch(new RegExp(`\\b${total}\\b`));
    }
  });
  it('writes the script out for a cold read, when asked (rule 21): COLD_READ=out.txt writes out.count.txt', async () => {
    const out = process.env.COLD_READ;
    if (!out) return;
    const text = (id: string) => BEAT_LINES.find(l => l.id === id)?.text ?? id;
    const runs = Object.entries({ 'a child who is wrong every time (4, 8, 6, 3)': [4, 8, 6, 3], 'a child who is right every time (5, 7, 7)': [5, 7, 7] });
    const parts: string[] = [];
    for (const [who, nums] of runs) {
      const p = pretend({ nums: [...nums] });
      await COUNT_LESSON.play(p.teller, p.world);
      parts.push(`=== ${who} ===`, ...p.log.map(l => l.startsWith('say ') ? `SAID: ${text(l.slice(4))}` : `(picture or child: ${l})`), '');
    }
    writeFileSync(out.replace(/(\.txt)?$/, '.count.txt'), parts.join('\n'));
  });
});

describe('the words', () => {
  const said = (id: string) => BEAT_LINES.find(l => l.id === id)?.said ?? '';
  it('every line the lesson uses exists, and nothing else is written for it', () => {
    expect(BEAT_LINES.filter(l => l.id.startsWith('ep.count.')).map(l => l.id).sort()).toEqual([...COUNT_LINES].sort());
    for (const id of COUNT_LINES) expect(LEARN_LINES.some(l => l.id === id), id).toBe(true);
  });
  it('a line explains in a sentence or three, and never runs on', () => {
    for (const id of COUNT_LINES) expect(said(id).split(/\s+/).length, id).toBeLessThanOrEqual(36);
  });
  it('no ending about learning, and the voice never reads a digit it should say as a word', () => {
    for (const id of COUNT_LINES) { expect(said(id), id).not.toMatch(/learn|explain|great job|well done|thank you/i); expect(said(id), id).not.toMatch(/\d/); }
  });
});
