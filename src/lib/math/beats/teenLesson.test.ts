// Ten and Some More played with a pretend child and a pretend world: every kind of child gets to the end,
// every number the child gives is acted out, nothing gives an answer away before it's asked, and the words
// keep to the lesson rules. (The film itself is checked by playing it.)
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { ALONE, BUDDY, DEMO, FIRST, NEXT_DAY, PAL, TEEN_LESSON, TEEN_LINES, type TeenWorld } from './teenLesson';
import type { Teller } from './types';
import { TEN, heardIdea, meaning, rest, unitIdea } from './teen';
import { BEAT_LINES, LEARN_LINES } from '../../content/voice';
import { lineProblems, scriptProblems, stillStretches, type Step } from './rules';

/** The pretend child: the numbers typed, in order, and the choices picked, in order (none left: the first
 *  choice). The two jobs for the hands end the same way whatever is tapped (a wrong tap only shakes). */
type Child = { nums: number[]; picks?: string[] };

/** what a reader of the cold read is told each picture is, by the world's call */
const PICTURE: Record<string, string> = {
  topOff: 'every marshmallow lifts away, from the buns and from the row in front; the rings go',
  'light("a")': 'a yellow ring lights each of the 10 blue buns on the full tray',
  'light("b")': 'a yellow ring lights each pink bun on the second tray (the blue buns go dark)',
  'light("ab")': 'a yellow ring lights every bun on both trays',
  ten: 'the number 10 stands over the full tray',
  showLeft: 'a red ring comes on what is left over: each bun that has no marshmallow, or each marshmallow that has no bun',
  tapBare: 'the child taps a bun that has no marshmallow and a yellow ring comes on it; a bun that has one shakes',
  clear: 'the trays slide away with everything on them',
};
const s = (n: unknown) => (n === 1 ? '' : 's');
const picture = (key: string, a: unknown[], l: string) =>
  key === 'trayIn' ? `any trays on the table slide away with everything on them and beside them; two bun trays (each 2 rows of 5 places) slide in, the first full with ${a[0]} blue buns, ${a[2] ? `the second with ${a[2]} pink buns in its first places` : 'the second empty'}`
  : key === 'more' ? `${a[0]} pink bun${s(a[0])} come one after another onto the second tray, into its first places`
  : key === 'top' || key === 'dress' ? (a[0] ? `${a[0]} white marshmallow${s(a[0])} come one after another, one onto each bun, the full tray's buns first; a marshmallow with no bun stops in a row in front of the trays (at most 10 are shown there, with a card saying how many were asked for)` : 'no marshmallow comes')
  : key === 'point' ? `a yellow ring lights bun number ${a[0]} of the second tray, and the number ${Number(a[1]) + Number(a[0])} stands on it`
  : key === 'tapCount' ? `each pink bun the child taps gets the next number after ${a[0]} on it, and the number is heard; a blue bun, or a bun already counted, shakes. A moment after the last one the numbers on the pink buns go`
  : key === 'writeSum' ? `the sum stands over the trays: ${a[0]} + ${a[1]} = ${Number(a[0]) + Number(a[1])}, the ${a[0]} in blue and the ${a[1]} in pink`
  : PICTURE[l] ?? PICTURE[key] ?? l;
/** a real try: marshmallows for a number someone gave, whose result the child is then told about (rules 6 to 8) */
const TRY = /^top\(/;
/** the lines in which the answer is worked out on the trays, a light going to each bun as its number is said (rules 10 and 11) */
const WORKING = /\.show$|\.buddy\.so$/;
/** what the log keeps of a call (what happens), and how long it takes (the kit's business; the cold read says it) */
const kept = (key: string, a: unknown[]): [unknown[], unknown] =>
  key === 'trayIn' ? [[a[0], a[2] ?? 0], a[1]] : key === 'more' || key === 'top' || key === 'dress' ? [[a[0]], a[1]] : key === 'clear' ? [[], a[0]] : [a, undefined];
/** the lines that say what's about to be tried, and whose try it is */
const announces = /\.try\./;

function pretend(child: Child) {
  const log: string[] = [], said: string[] = [];
  /** the run as a reader would follow it: each line as it shows on screen (its numbers filled in), and what the
   *  picture or the child does */
  const film: string[] = [];
  /** inside a line's picture: the second of the line it comes at */
  let cue: number | null = null;
  const shown = (id: string, n?: number, m?: number, k?: number) => (BEAT_LINES.find(l => l.id === id)?.text ?? id).replaceAll('{n}', String(n ?? '')).replaceAll('{m}', String(m ?? '')).replaceAll('{k}', String(k ?? ''));
  const world = new Proxy({} as TeenWorld, {
    get: (_, key: string) => (...a: unknown[]) => {
      const [args, over] = kept(key, a);
      const l = `${key}(${args.map(x => JSON.stringify(x)).join(',')})`;
      // (a picture that goes with a line, acted out while it is said, is a 'show'; a real try is itself wherever it happens)
      log.push(cue == null || TRY.test(l) ? l : `show ${l}`);
      film.push(cue == null ? `(picture: ${picture(key, a, l)})` : `(picture, ${cue} s into that line${over ? `, taking ${over} s` : ''}: ${picture(key, a, l)})`);
      return Promise.resolve();
    },
  });
  const speak = (id: string, n?: number, m?: number, k?: number) => { said.push(id); log.push(`say ${id}`); film.push(`SAID: ${shown(id, n, m, k)}`); };
  const teller: Teller = {
    say: async (id, n, m, k) => { speak(id, n, m, k); },
    // (a line said with its pictures: marked as one, then each picture in the order of its second, as the player does)
    sayWith: async (id, cues, n, m, k) => { log.push('with pictures'); speak(id, n, m, k); for (const [at, act] of [...cues].sort((a, b) => a[0] - b[0])) { cue = at; await act(); } cue = null; },
    num: async (q, id, k) => { if (id) speak(id, k); const n = child.nums.shift(); if (n == null) throw new Error('the lesson asked for more numbers than this child has'); log.push(`num ${n}`); film.push(`(asked "${q}": the child types ${n})`); return n; },
    pick: async (q, choices, id) => { if (id) speak(id); const p = child.picks?.shift() ?? choices[0].id; log.push(`pick ${p}`); film.push(`(asked "${q}": the child picks "${choices.find(c => c.id === p)?.text ?? p}")`); return p as never; },
    hands: async (words, job) => { log.push('hands'); film.push(`(the child's hands: ${words})`); await job(); },
    go: async l => { log.push(`go ${l}`); film.push(`(the child taps ${l})`); },
    wait: async () => {},
    buddy: () => {}, pal: () => {},
    thought: (who, text) => { if (text) { log.push(`${who} thinks ${text}`); film.push(`(${cue == null ? '' : `${cue} s into that line, `}a thought over ${who === 'pal' ? "the Glimmer's" : "the buddy's"} head: ${text})`); } },
    myBet: () => {}, beat: () => {},
  };
  return { log, said, world, teller, film };
}
/** The run as the rules see it. */
const stepsOf = (log: string[]): Step[] => log.flatMap((l, i): Step[] => {
  if (l.startsWith('say ')) {
    const shown = log[i - 1] === 'with pictures';
    // (the working shown inside a line, a light going to each bun as its number is said, is an answer: rules 10 and 11)
    const worked: Step[] = shown && WORKING.test(l) ? [{ k: 'answer', v: 'the working' }] : [];
    return [...worked, { k: 'say', v: l.slice(4), shown }];
  }
  if (l.startsWith('show ')) return [{ k: 'show', v: l.slice(5) }];
  if (l.startsWith('go ')) return [{ k: 'go', v: l.slice(3) }];
  // (the child's hands at work are a wait for the child, as a question is)
  if (l.startsWith('num ') || l.startsWith('pick ') || l === 'hands') return [{ k: 'ask', v: l }];
  if (TRY.test(l)) return [{ k: 'act', v: l }];
  return [];
});
const play = async (c: Child) => { const p = pretend(c); const notes = await TEEN_LESSON.play(p.teller, p.world); return { ...p, notes }; };
const nextDay = async (c: Child) => { const p = pretend(c); await TEEN_LESSON.check(p.teller, p.world, null); return p; };
const text = (id: string) => BEAT_LINES.find(l => l.id === id)!.text;

describe('ten and some more, in numbers', () => {
  it('a number of marshmallows means one for each bun, buns with none, or marshmallows with no bun', () => {
    expect(meaning(15, 15)).toEqual({ kind: 'right' });
    expect(meaning(14, 15)).toEqual({ kind: 'few', bare: 1 });
    expect(meaning(0, 15)).toEqual({ kind: 'few', bare: 15 });
    expect(meaning(9999, 15)).toEqual({ kind: 'over', spare: 9984 });
  });
  it("each friend's idea gives a number of its own on its trays, and the trays are all different teen numbers", () => {
    expect([rest(BUDDY), unitIdea(BUDDY)]).toEqual([4, 5]);
    expect(heardIdea(PAL)).toBe(61);
    expect([unitIdea(FIRST), heardIdea(FIRST)]).toEqual([6, 51]);
    const all = [DEMO, FIRST, BUDDY, PAL, ALONE, NEXT_DAY];
    expect(new Set(all).size).toBe(6);
    for (const n of all) { expect(n).toBeGreaterThan(TEN); expect(n).toBeLessThan(20); }
  });
});

describe('the lesson, played by every kind of child', () => {
  it('a child who is right goes straight through, and still sees the count from 10', async () => {
    const { notes, said, log } = await play({ nums: [FIRST] });
    expect(notes).toEqual({ first: 15 });
    expect(said).toContain('ep.teen.right');
    expect(said).toContain('ep.teen.p15.show');
    expect(said).not.toContain('ep.teen.alone');
    expect(said).toContain('ep.teen.sum.16');
    // the right child's marshmallows stay on their buns while the count is said
    const at = log.indexOf('say ep.teen.p15.show');
    expect(log.slice(at + 1, at + 8)).toEqual(['show light("a")', 'show ten()', 'show point(1,10)', 'show point(2,10)', 'show point(3,10)', 'show point(4,10)', 'show point(5,10)']);
  });
  it('the idea is shown once, on a full tray and 3 more, before the child is asked anything', async () => {
    const { log } = await play({ nums: [FIRST] });
    const ask = log.findIndex(l => l.startsWith('num '));
    expect(log.indexOf('show trayIn(10,0)')).toBeGreaterThan(0);
    expect(log.indexOf('show more(3)')).toBeGreaterThan(log.indexOf('show trayIn(10,0)'));
    for (const l of ['show ten()', 'show point(1,10)', 'show point(3,10)', 'show dress(13)']) { expect(log.indexOf(l), l).toBeGreaterThan(0); expect(log.indexOf(l), l).toBeLessThan(ask); }
  });
  it('every number is acted out, even a silly one, and zero gets its own words', async () => {
    expect((await play({ nums: [9999, 9999] })).log).toContain('top(9999)');
    const zero = await play({ nums: [0, ALONE] });
    expect(zero.log).toContain('top(0)');
    expect(zero.said).toContain('ep.teen.try.zero');
    expect(zero.said).toContain('ep.teen.zero');
    expect(zero.said).not.toContain('ep.teen.few');
  });
  it('a wrong number is counted together and not asked again; its marshmallows go before the count; too few and too many each hear what it showed', async () => {
    const few = await play({ nums: [14, ALONE] }), over = await play({ nums: [16, ALONE] });
    expect(few.said).toContain('ep.teen.few');
    expect(over.said).toContain('ep.teen.over');
    for (const p of [few, over]) {
      const at = p.log.indexOf('say ep.teen.p15.show');
      expect(p.log[at - 2]).toBe('show showLeft()');
      expect(p.log.slice(at + 1, at + 5)).toEqual(['show topOff()', 'show light("a")', 'show ten()', 'show point(1,10)']);
      expect(p.log[at + 9]).toBe('go Next');
      // the next number question is the one on the child's own new trays, after both friends
      expect(p.log.slice(at).findIndex(l => l.startsWith('num '))).toBeGreaterThan(p.log.slice(at).indexOf('say ep.teen.pal.so'));
    }
  });
  it("the buddy's idea shows as a thought, is tried on its own trays, and the child finds a bun with no marshmallow before anything is ringed", async () => {
    const { log, said } = await play({ nums: [FIRST] });
    expect(log).toContain('buddy thinks 1 + 4 = 5');
    const tried = log.indexOf('say ep.teen.try.buddy'), tapped = log.indexOf('hands');
    expect(log.slice(tried, tapped)).toContain('top(5)');
    expect(log.slice(tried, tapped).some(l => /showLeft|ten|point/.test(l))).toBe(false);
    expect(log.slice(tapped, tapped + 2)).toEqual(['hands', 'tapBare()']);
    expect(log.slice(tapped)).toContain('show showLeft()');
    // then the reason (the full tray is 10, not 1), and the idea is closed with the count from 10, which waits for Next
    expect(said.indexOf('ep.teen.buddy.why')).toBe(said.indexOf('ep.teen.buddy.found') + 1);
    const so = log.indexOf('say ep.teen.buddy.so');
    expect(log.slice(so + 1, so + 7)).toEqual(['show topOff()', 'show point(1,10)', 'show point(2,10)', 'show point(3,10)', 'show point(4,10)', 'go Next']);
    expect(text('ep.teen.buddy.found')).toMatch(new RegExp(`\\b${BUDDY - unitIdea(BUDDY)} buns have no marshmallow, so ${unitIdea(BUDDY)}\\b`));
  });
  it("the Glimmer counts right and writes 61; it is tried, the child judges it, the rings come after the question, and 61 turns into 16", async () => {
    for (const pick of ['no', 'yes']) {
      const { log, said } = await play({ nums: [FIRST], picks: [pick] });
      const tried = log.indexOf('say ep.teen.try.pal'), asked = log.indexOf(`pick ${pick}`);
      expect(log.slice(tried, asked).slice(1, 3)).toEqual(['pal thinks 61', 'top(61)']);
      expect(log.slice(tried, asked).some(l => /showLeft|light/.test(l))).toBe(false);
      expect(log[asked + 3]).toBe('show showLeft()');
      expect(said).toContain(`ep.teen.pal.${pick}`);
      const so = log.indexOf('say ep.teen.pal.so');
      expect(log.slice(so + 1, so + 6)).toEqual(['show topOff()', 'show light("a")', 'show light("b")', 'pal thinks 16', 'go Next']);
    }
  });
  it('a child who was not right at first counts on new trays with their own taps and types the number, which is tried; one who was right does not', async () => {
    for (const n of [6, 51, 0, 14]) {
      const wrong = await play({ nums: [n, ALONE] });
      const at = wrong.log.indexOf('say ep.teen.alone');
      expect(wrong.log.slice(at + 1, at + 6), String(n)).toEqual(['show trayIn(10,7)', 'show light("a")', 'show ten()', 'hands', 'tapCount(10)']);
      expect(wrong.log.slice(at)).toContain('top(17)');
      expect(wrong.said.slice(-5)).toEqual(['ep.teen.try.you', 'ep.teen.right', 'ep.teen.alone.right', 'ep.teen.sum.17', 'ep.teen.off']);
      expect(wrong.log).toContain('show writeSum(10,7)');
    }
    // a number typed wrong after a right count: tried like any other, the credit for the count, and how 17 is written
    const twice = await play({ nums: [6, 71] });
    expect(twice.said.slice(-5)).toEqual(['ep.teen.try.you', 'ep.teen.over', 'ep.teen.alone.so', 'ep.teen.sum.17', 'ep.teen.off']);
    const so = twice.log.indexOf('say ep.teen.alone.so');
    expect(twice.log.slice(so + 1, so + 3)).toEqual(['show topOff()', 'show point(7,10)']);
    const right = await play({ nums: [FIRST] });
    expect(right.log).not.toContain('tapCount(10)');
    expect(right.log).toContain('show writeSum(10,6)');
  });
  it('the sum is written last, from the trays on the table, and waits for the child; then every bun gets its marshmallow and the trays go', async () => {
    const { log } = await play({ nums: [FIRST] });
    const sum = log.indexOf('show writeSum(10,6)');
    expect(log.slice(sum).filter(l => l.startsWith('go '))).toHaveLength(1);
    expect(log.slice(sum).some(l => l.startsWith('num ') || l === 'hands')).toBe(false);
    expect(log.slice(-2)).toEqual(['show dress(16)', 'show clear()']);
  });
  it('the next day: new trays, how many in all, and the count from 10 either way', async () => {
    for (const n of [18, 9, 81]) {
      const p = await nextDay({ nums: [n] });
      expect(p.log).toContain('show trayIn(10,8)');
      expect(p.log).toContain(`top(${n})`);
      expect(p.said).toContain(n === 18 ? 'ep.teen.right' : n === 9 ? 'ep.teen.few' : 'ep.teen.over');
      expect(p.said).toContain('ep.teen.p18.show');
      expect(p.log).toContain('show point(8,10)');
    }
    expect(TEEN_LESSON.card({ first: 6 })[0]).toContain('6');
  });
});

describe('the lesson rules (docs/lesson-rules.md)', () => {
  const kids: Record<string, Child> = {
    'right every time': { nums: [15], picks: ['no'] }, 'wrong every time, thinking like the buddy (6)': { nums: [6, 71], picks: ['yes'] }, 'too many by one': { nums: [16, 17] },
    'too few by one': { nums: [14, 17] }, 'sure there are zero': { nums: [0, 0], picks: ['yes'] }, 'writing it as it is heard, like the Glimmer (51)': { nums: [51, 17] },
    'saying only the second tray (5)': { nums: [5, 7] }, 'typing a silly number': { nums: [9999, 9999] },
  };
  const again = (c: Child): Child => ({ nums: [...c.nums], picks: c.picks ? [...c.picks] : undefined });
  for (const [name, kid] of Object.entries(kids)) it(`a child who is ${name}: every try named, explained, and every answer waits`, async () => {
    const { log } = await play(again(kid));
    expect(scriptProblems({ steps: stepsOf(log), announces })).toEqual([]);
  });
  it('the next day too', async () => {
    for (const n of [18, 9, 0, 81]) expect(scriptProblems({ steps: stepsOf((await nextDay({ nums: [n] })).log), announces })).toEqual([]);
  });
  const words = (id: string) => text(id).split(/\s+/).length;
  it('rule 37: no child sits through 35 words or more with nothing new on screen', async () => {
    for (const [name, kid] of Object.entries(kids)) expect(stillStretches(stepsOf((await play(again(kid))).log), words), name).toEqual([]);
    for (const n of [18, 9, 0]) expect(stillStretches(stepsOf((await nextDay({ nums: [n] })).log), words)).toEqual([]);
  });
  it('rule 45: a movement begins inside the line that names it, and the only moves left on their own are the stops kept on purpose', async () => {
    // every call that moves something on the table (not the child's own taps, not a light or a number)
    const move = /^(show )?(trayIn|more|top|dress|topOff|showLeft|clear)\(/;
    /** the line a move is made in (the line said with pictures that it follows), or null when it is made in silence */
    const lineOf = (log: string[], i: number) => { let j = i - 1; while (j >= 0 && (log[j].startsWith('show ') || TRY.test(log[j]) || / thinks /.test(log[j]))) j--; return log[j]?.startsWith('say ') && log[j - 1] === 'with pictures' ? log[j].slice(4) : null; };
    const alone = (log: string[]) => log.filter((l, i) => move.test(l) && lineOf(log, i) == null);
    // The stops kept, each with its reason:
    // 1. the questions "How many buns in all?" (twice for a child not right at first) and the Glimmer's question: every question waits;
    // 2. "Does every bun have a marshmallow now? Tap a bun that still needs one", then the child's tap: a question
    //    and a job for the hands, with nothing moving until the child does;
    // 3. the child's own taps on the pink buns (a count word is heard at each: a count can't be said under a line);
    // 4. zero: nothing is coming, so nothing moves under "no marshmallows come at all";
    // 5. the next day's trays leave after the last line, with nothing left to say over it.
    // None of the first four is a move made by the world outside a line, so in the lesson no move stands alone:
    for (const kid of Object.values(kids)) expect(alone((await play(again(kid))).log)).toEqual([]);
    expect(alone((await nextDay({ nums: [18] })).log)).toEqual(['clear()']);
    // each move is in the line that names it
    const wrong = await play({ nums: [6, 71], picks: ['yes'] });
    const where = (l: string) => lineOf(wrong.log, wrong.log.indexOf(l));
    expect(where('show more(3)')).toBe('ep.teen.intro');
    expect(where('show dress(1)')).toBe('ep.teen.need');
    expect(where('show dress(13)')).toBe('ep.teen.demo.full');
    expect(where('show trayIn(10,5)')).toBe('ep.teen.turn');
    expect(where('top(6)')).toBe('ep.teen.try.you');
    expect(where('top(5)')).toBe('ep.teen.try.buddy');
    expect(where('top(61)')).toBe('ep.teen.try.pal');
    expect(where('top(71)')).toBe('ep.teen.try.you');
    expect(where('show dress(17)')).toBe('ep.teen.off');
    expect(lineOf(wrong.log, wrong.log.lastIndexOf('show clear()'))).toBe('ep.teen.off');
    // a real try made inside its line is still a try: said whose it is, acted out, and what it showed said after
    const steps = stepsOf(wrong.log), at = steps.findIndex(x => x.k === 'act' && x.v === 'top(6)');
    expect([steps[at - 1], steps[at + 1]].map(x => `${x.k} ${x.v}`)).toEqual(['say ep.teen.try.you', 'say ep.teen.few']);
  });
  it('nothing said, lit or numbered before a question gives its answer away', async () => {
    const { log } = await play({ nums: [6, 71] });
    const turn = log.indexOf('say ep.teen.turn'), ask = log.findIndex(l => l.startsWith('num '));
    for (const l of log.slice(turn, ask)) {
      if (l.startsWith('say ')) expect(text(l.slice(4)), l).not.toMatch(/\b(5|15)\b/);
      expect(l).not.toMatch(/light|point|ten\(|showLeft/);
    }
    const day = (await nextDay({ nums: [9] })).log;
    for (const l of day.slice(0, day.findIndex(x => x.startsWith('num ')))) {
      if (l.startsWith('say ')) expect(text(l.slice(4)), l).not.toMatch(/\b(8|18)\b/);
      expect(l).not.toMatch(/light|point|ten\(|showLeft/);
    }
    // on the child's own trays the count is theirs: no number is put on a bun by the world before the question,
    // and the line that asks does not say the number
    const alone = log.indexOf('say ep.teen.alone'), asked = log.findIndex((l, i) => i > alone && l.startsWith('num '));
    for (const l of log.slice(alone, asked)) { if (l.startsWith('say ')) expect(text(l.slice(4)), l).not.toMatch(/\b(7|17)\b|seventeen/); expect(l).not.toMatch(/point/); }
  });
  it('every line can stand up to the words rules', () => {
    expect(lineProblems(BEAT_LINES.filter(l => l.id.startsWith('ep.teen.')))).toEqual([]);
  });
  it('writes the script out for a cold read, when asked (rule 21): COLD_READ=out.txt writes out.teen.txt', async () => {
    const out = process.env.COLD_READ;
    if (!out) return;
    const runs: [string, Child][] = [
      ['A CHILD WHO IS WRONG EVERY TIME (says 6 for the full tray and 5 more, as the buddy would; says every one of the 61 marshmallows found a bun; counts the last trays right by taps, then types 71)', kids['wrong every time, thinking like the buddy (6)']],
      ['A CHILD WHO IS RIGHT EVERY TIME (says 15; says not every one of the 61 marshmallows found a bun)', kids['right every time']],
      ['A CHILD WHO SAYS 16, ONE TOO MANY, AND THEN TYPES 17 RIGHT AFTER COUNTING ON ALONE', kids['too many by one']],
      ['A CHILD WHO SAYS 0', kids['sure there are zero']],
    ];
    const parts: string[] = [];
    for (const [who, kid] of runs) {
      const p = await play(again(kid));
      const still = stillStretches(stepsOf(p.log), words);
      parts.push(who, '', ...p.film, '', `STILL STRETCHES LEFT: ${still.length ? still.join('; ') : 'none'}`, '', '');
    }
    for (const n of [81, 18]) {
      const p = await nextDay({ nums: [n] });
      parts.push(`THE NEXT DAY, A CHILD WHO SAYS ${n} FOR THE FULL TRAY AND 8 MORE`, '', ...p.film, '', '');
    }
    writeFileSync(out.replace(/(\.txt)?$/, '.teen.txt'), parts.join('\n'));
  });
});

describe('the words', () => {
  const said = (id: string) => BEAT_LINES.find(l => l.id === id)?.said ?? text(id);
  it('every line the lesson uses exists, and nothing else is written for it', () => {
    expect(BEAT_LINES.filter(l => l.id.startsWith('ep.teen.')).map(l => l.id).sort()).toEqual([...TEEN_LINES].sort());
    for (const id of TEEN_LINES) expect(LEARN_LINES.some(l => l.id === id), id).toBe(true);
  });
  it('every line the script can say is said by some child (none is written and never reached)', async () => {
    const heard = new Set<string>();
    for (const c of [{ nums: [15], picks: ['no'] }, { nums: [6, 71], picks: ['yes'] }, { nums: [16, 17] }, { nums: [0, 17] }]) for (const id of (await play(c)).said) heard.add(id);
    for (const n of [18, 9]) for (const id of (await nextDay({ nums: [n] })).said) heard.add(id);
    expect(TEEN_LINES.filter(id => !heard.has(id))).toEqual([]);
  });
  it('a line explains in a sentence or three, and never runs on', () => {
    for (const id of TEEN_LINES) expect(said(id).split(/\s+/).length, id).toBeLessThanOrEqual(40);
  });
  it('no ending about learning, and the voice never reads a digit or a blank it should say as a word', () => {
    for (const id of TEEN_LINES) { expect(said(id), id).not.toMatch(/learn|explain|great job|well done|thank you/i); expect(said(id), id).not.toMatch(/\d|\{/); }
  });
  it('a count said in a line has a full stop after each count word, so the voice does not run them together', () => {
    for (const id of ['demo.count', 'p15.show', 'p18.show', 'buddy.so', 'pal.in']) expect(said(`ep.teen.${id}`), id).toMatch(/Eleven\. Twelve\. /);
  });
});
