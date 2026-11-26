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

/** `finds`: what each tap on a friend's slip is (the right cookie, a wrong one, or asking to be shown); a child
 *  with none finds every slip first go */
type Child = { nums: number[]; finds?: ('yes' | 'no' | 'shown')[] };
function pretend(child: Child) {
  const log: string[] = [], said: string[] = [];
  /** the run as a reader would follow it: each line as it shows on screen (its numbers filled in), and what the picture or the child does */
  const film: string[] = [];
  const shown = (id: string, n?: number, m?: number) => (BEAT_LINES.find(l => l.id === id)?.text ?? id).replaceAll('{n}', String(n ?? '')).replaceAll('{m}', String(m ?? ''));
  const world = new Proxy({} as CountWorld, {
    get: (_, k: string) => {
      if (k === 'slipCount') return async (who: string, slip: string) => { log.push(`slipCount("${who}","${slip}")`); film.push(`(picture: ${who === 'pal' ? 'Sprout Bunny' : 'the buddy'} counts the 7 cookies where they lie, a number landing on each one counted; ${slip === 'twice' ? 'one cookie is counted twice and ends up with two numbers' : 'one cookie is skipped and ends up with no number'})`); return countPath(7, slip as 'twice').length; };
      if (k === 'tapSlip') return async () => { const r = child.finds?.shift() ?? 'yes'; log.push(`tapSlip() ${r}`); film.push(`(the child taps ${r === 'yes' ? 'the right cookie' : r === 'no' ? 'a different cookie, which shakes' : '"Show me"'})`); return r; };
      return (...a: unknown[]) => { const l = `${k}(${a.map(x => JSON.stringify(x)).join(',')})`; log.push(l); film.push(`(picture: ${l})`); return Promise.resolve(); };
    },
  });
  const speak = (id: string, n?: number, m?: number) => { said.push(id); log.push(`say ${id}`); film.push(`SAID: ${shown(id, n, m)}`); };
  const teller: Teller = {
    say: async (id, n, m) => { speak(id, n, m); },
    // (a line said with its pictures: the line, then each picture in turn)
    sayWith: async (id, cues, n, m) => { speak(id, n, m); for (const [, act] of cues) await act(); },
    num: async (q, id, k) => { if (id) speak(id, k); const n = child.nums.shift(); if (n == null) throw new Error('the lesson asked for more numbers than this child has'); log.push(`num ${n}`); film.push(`(asked "${q}": the child types ${n})`); return n; },
    pick: async (_, choices, id) => { if (id) speak(id); log.push(`pick ${choices[0].id}`); return choices[0].id as never; },
    hands: async (words, job) => { log.push('hands'); film.push(`(the child's hands: ${words})`); await job(); },
    go: async l => { log.push(`go ${l}`); film.push(`(the child taps ${l})`); }, wait: async () => {},
    buddy: () => {}, pal: () => {}, thought: (w, t) => { if (t) { log.push(`${w} thinks ${t}`); film.push(`(a thought over ${w === 'pal' ? "Sprout Bunny's" : "the buddy's"} head: ${t})`); } }, myBet: () => {}, beat: () => {},
  };
  return { log, said, world, teller, film };
}
/** The run as the rules see it: a number of plates, a friend's count, a counting demo and a bump are things
 *  tried and acted out; the light going along the numbers and the recount are the answer worked out. */
const stepsOf = (log: string[]): Step[] => log.flatMap((l): Step[] => {
  if (l.startsWith('say ')) return [{ k: 'say', v: l.slice(4) }];
  if (l.startsWith('go ')) return [{ k: 'go', v: l.slice(3) }];
  if (l.startsWith('num ') || l.startsWith('pick ')) return [{ k: 'ask', v: l }];
  if (/^(plates|slipCount|demoCount|bump)\(/.test(l)) return [{ k: 'act', v: l }];
  if (/^(pointCount|tapHere)\(/.test(l)) return [{ k: 'answer', v: l }];
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
    // (they knew the number hadn't changed: told why, and not made to count them again)
    expect(log).not.toContain('tapHere()');
    expect(said).toContain('ep.count.moved.right');
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
    const { log, said } = await play({ nums: [9999, 0, 3, 4] });
    expect(log).toContain('plates(9999)');
    expect(log).toContain('plates(0)');
    // (zero gets its own words: no plates at all, not "your 0 plates weren't enough")
    expect(JSON.stringify(said)).toMatch(/ep\.count\.zero/);
    expect(JSON.stringify(said)).not.toMatch(/Your 0 plates/);
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
  it('the child finds each friend\'s slip with a tap: told so when they do, shown after two misses or when they ask', async () => {
    const found = await play({ nums: [5, 7, 7] });
    expect(found.said).toContain('ep.count.pal.found');
    expect(found.said).toContain('ep.count.buddy.found');
    expect(found.said).not.toContain('ep.count.find.no.two');
    // one miss, then the right cookie: told what the wrong cookie had, and still gets the credit
    const second = await play({ nums: [5, 7, 7], finds: ['no', 'yes', 'no', 'yes'] });
    expect(second.said.filter(id => id.startsWith('ep.count.find.no'))).toEqual(['ep.count.find.no.two', 'ep.count.find.no.none']);
    expect(second.said).toContain('ep.count.pal.found');
    // two misses: the red ring shows it, and the line doesn't say "you found it"
    const missed = await play({ nums: [5, 7, 7], finds: ['no', 'no', 'no', 'no'] });
    expect(missed.log.filter(l => l.startsWith('tapSlip'))).toHaveLength(4);
    // (told what the wrong cookie had once for each friend, not again just before being shown)
    expect(missed.said.filter(id => id.startsWith('ep.count.find.no'))).toEqual(['ep.count.find.no.two', 'ep.count.find.no.none']);
    expect(missed.said).toContain('ep.count.pal.shown');
    expect(missed.said).toContain('ep.count.buddy.shown');
    expect(missed.said).not.toContain('ep.count.pal.found');
    // "Show me": shown at once, no "that cookie has..." line
    const asked = await play({ nums: [5, 7, 7], finds: ['shown', 'shown'] });
    expect(asked.said).toContain('ep.count.pal.shown');
    expect(asked.said).not.toContain('ep.count.find.no.two');
    // every way, the ring goes on the cookie before the line about it
    for (const r of [found, second, missed, asked]) expect(r.log.filter(l => l === 'showSlip()')).toHaveLength(2);
  });
  it('after the bump a child who thought the number changed counts them again where they sit and hears why it did not; one who knew is told why they are right', async () => {
    for (const moved of [7, 3, 12]) {
      const { log, said } = await play({ nums: [5, 7, moved, 4] });
      expect(log.includes('tapHere()')).toBe(moved !== 7);
      expect(said.includes('ep.count.recount.why')).toBe(moved !== 7);
      expect(said.includes('ep.count.moved.right')).toBe(moved === 7);
    }
    expect(BEAT_LINES.find(l => l.id === 'ep.count.moved.right')!.text).toMatch(/doesn't add any or take any away/);
    const why = BEAT_LINES.find(l => l.id === 'ep.count.recount.why')!.text;
    expect(why).toMatch(/doesn't add any or take any away/);
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

describe('what the cold read of 23 November found', () => {
  it('the ending uses the number that was counted, and a child on the extra tray is not shown the same plates twice', async () => {
    const right = await play({ nums: [5, 7, 7] });
    expect(right.said.at(-2)).toBe('ep.count.try.party');
    expect(right.said.at(-1)).toBe('ep.count.off');
    const wrong = await play({ nums: [4, 8, 6, 3] });
    expect(wrong.said).not.toContain('ep.count.try.party');
    expect(wrong.said.at(-1)).toBe('ep.count.off.extra');
    // (the plates the extra tray ended on are the ones that go to the party: nothing takes them off and lays them again)
    const from = wrong.log.lastIndexOf('plates(4)');
    expect(wrong.log.slice(from)).not.toContain('platesOff()');
    expect(wrong.said).toContain('ep.count.how.last');
  });
  it('the child who was wrong about the mixed-up cookies also hears "not 8 and not 6", and why counting in place is safe now', async () => {
    const { said } = await play({ nums: [4, 8, 6, 3] });
    expect(BEAT_LINES.find(l => l.id === 'ep.count.b7.show')!.text).toMatch(/not 8 and not 6/);
    expect(said).toContain('ep.count.try.recount.again');
    expect(BEAT_LINES.find(l => l.id === 'ep.count.try.recount.again')!.text).toMatch(/its number shows it's been counted/);
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
    const runs: [string, Child][] = [['A CHILD WHO IS WRONG EVERY TIME (4, 8, 6, 3; taps the wrong cookie each time)', { nums: [4, 8, 6, 3], finds: ['no', 'no', 'no', 'no'] }], ['A CHILD WHO IS RIGHT EVERY TIME (5, 7, 7)', { nums: [5, 7, 7] }]];
    const parts: string[] = [];
    for (const [who, kid] of runs) {
      const p = pretend({ nums: [...kid.nums], finds: kid.finds ? [...kid.finds] : undefined });
      await COUNT_LESSON.play(p.teller, p.world);
      parts.push(who, '', ...p.film, '', '');
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
    for (const id of COUNT_LINES) expect(said(id).split(/\s+/).length, id).toBeLessThanOrEqual(40);
  });
  it('no ending about learning, and the voice never reads a digit it should say as a word', () => {
    for (const id of COUNT_LINES) { expect(said(id), id).not.toMatch(/learn|explain|great job|well done|thank you/i); expect(said(id), id).not.toMatch(/\d/); }
  });
});
