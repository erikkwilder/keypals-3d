// Make Ten played with a pretend child and a pretend world: every kind of child gets to the end, every number
// the child gives is acted out, nothing gives an answer away before it's asked, and the words keep to the
// lesson rules. (The film itself is checked by playing it.)
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { BUDDY, EXTRA, FIRST, NEXT_DAY, PAL, TEN_LESSON, TEN_LINES, type FrameWorld } from './tenLesson';
import type { Teller } from './types';
import { bottomRowIdea, emptyPlaces, meaning, partner, wholeIdea } from './ten';
import { BEAT_LINES, LEARN_LINES } from '../../content/voice';
import { lineProblems, scriptProblems, stillStretches, type Step } from './rules';

/** The pretend child: the numbers typed, in order, and the choices picked, in order (none left: the first
 *  choice). The two jobs for the hands end the same way whatever is tapped (a wrong tap only shakes). */
type Child = { nums: number[]; picks?: string[] };

/** what a reader of the cold read is told each picture is, by the world's call */
const PICTURE: Record<string, string> = {
  moreOff: 'the pink buns slide away, and the places they were in are empty again',
  spareOff: 'the pink buns that have no place slide away one after another; the buns on the tray stay, and the rings go',
  'light("top")': 'a yellow ring lights each of the 5 places in the top row',
  'light("bottom")': 'a yellow ring lights each of the 5 places in the bottom row (the top row goes dark)',
  'light("all")': 'a yellow ring lights every one of the 10 places',
  'light("empty")': 'a yellow ring lights each empty place',
  'light("a")': 'a yellow ring lights each blue bun',
  'light("b")': 'a yellow ring lights each pink bun',
  'light(null)': 'the yellow rings go',
  showLeft: 'a red ring comes on what is left over: each empty place, or each pink bun that has no place',
  tapFill: 'each empty place the child taps gets a pink bun with the next number on it, and the number is heard; a place that has a bun shakes',
  tapEmpty: 'the child taps an empty place and a yellow ring comes on it; a place that has a bun shakes',
  clear: 'the tray slides away with everything on it',
};
const picture = (key: string, a: unknown[], l: string) =>
  key === 'trayIn' ? `any tray on the table slides away with everything on it and beside it; a bun tray (2 rows of 5 places) slides in${a[0] ? ` with ${a[0]} blue buns on it, the top row filled first from the left` : ', empty'}`
  : key === 'fill' ? `${a[0]} blue buns drop onto the tray one after another, the top row first, from the left`
  : key === 'more' ? (a[0] ? `${a[0]} pink bun${a[0] === 1 ? '' : 's'} come one after another, each into an empty place${a[2] === 'bottom' ? ' of the bottom row' : ''}; a bun with no place stops in a row in front of the tray` : 'no bun comes')
  : key === 'point' ? `a yellow ring lights empty place number ${a[0]}, and the number ${a[0]} stands on it`
  : key === 'writeSum' ? `the sum stands over the tray: ${a[0]} + ${a[1]} = 10, the ${a[0]} in blue and the ${a[1]} in pink`
  : PICTURE[l] ?? PICTURE[key] ?? l;
/** a real try: something whose result the child is then told about (rules 6 to 8 hold it, inside a line or not) */
const TRY = /^more\(/;
/** the answer being worked out on the thing (rules 10 and 11 hold it) */
const WORKING = /^point\(/;
/** how many of a call's arguments say what happens; the one after those says how long it takes, which is the
 *  kit's business: the log keeps what happens, and the cold read says how long */
const KEPT: Record<string, number> = { trayIn: 1, fill: 1, more: 1, spareOff: 0, clear: 0 };
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
  const world = new Proxy({} as FrameWorld, {
    get: (_, key: string) => (...a: unknown[]) => {
      const keep = KEPT[key], over = keep == null ? undefined : a[keep];
      const l = `${key}(${(keep == null ? a : a.slice(0, keep)).map(x => JSON.stringify(x)).join(',')})`;
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
    thought: (who, text) => { if (text) { log.push(`${who} thinks ${text}`); film.push(`(a thought over ${who === 'pal' ? "the Glimmer's" : "the buddy's"} head: ${text})`); } },
    myBet: () => {}, beat: () => {},
  };
  return { log, said, world, teller, film };
}
/** The run as the rules see it. */
const stepsOf = (log: string[]): Step[] => log.flatMap((l, i): Step[] => {
  if (l.startsWith('say ')) {
    const shown = log[i - 1] === 'with pictures';
    // (the working shown inside a line, a light going to each empty place as its number is said, is an answer: rules 10 and 11)
    const next = log.slice(i + 1), end = next.findIndex(x => !x.startsWith('show ')), pics = next.slice(0, end < 0 ? next.length : end);
    const worked: Step[] = shown && pics.some(x => WORKING.test(x.slice(5))) ? [{ k: 'answer', v: 'the working' }] : [];
    return [...worked, { k: 'say', v: l.slice(4), shown }];
  }
  if (l.startsWith('show ')) return [{ k: 'show', v: l.slice(5) }];
  if (l.startsWith('go ')) return [{ k: 'go', v: l.slice(3) }];
  // (the child's hands at work are a wait for the child, as a question is)
  if (l.startsWith('num ') || l.startsWith('pick ') || l === 'hands') return [{ k: 'ask', v: l }];
  if (TRY.test(l)) return [{ k: 'act', v: l }];
  if (WORKING.test(l)) return [{ k: 'answer', v: l }];
  return [];
});
const play = async (c: Child) => { const p = pretend(c); const notes = await TEN_LESSON.play(p.teller, p.world); return { ...p, notes }; };
const nextDay = async (c: Child) => { const p = pretend(c); await TEN_LESSON.check(p.teller, p.world, null); return p; };
const text = (id: string) => BEAT_LINES.find(l => l.id === id)!.text;
const RIGHT = partner(FIRST);

describe('making ten, in numbers', () => {
  it('a number of more buns means a full tray, places still empty, or buns with no place', () => {
    expect(meaning(3, 7)).toEqual({ kind: 'full' });
    expect(meaning(2, 7)).toEqual({ kind: 'short', missing: 1 });
    expect(meaning(0, 7)).toEqual({ kind: 'short', missing: 3 });
    expect(meaning(9999, 7)).toEqual({ kind: 'over', extra: 9996 });
    for (let have = 1; have <= 9; have++) expect(have + partner(have)).toBe(10);
  });
  it('new buns go into the empty places, top row first or the bottom row first', () => {
    expect(emptyPlaces(7)).toEqual([7, 8, 9]);
    expect(emptyPlaces(3)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(emptyPlaces(3, 'bottom')).toEqual([5, 6, 7, 8, 9, 3, 4]);
  });
  it("each friend's idea gives a number of its own on its tray, and the trays are all different", () => {
    expect([partner(BUDDY), wholeIdea(BUDDY)]).toEqual([4, 10]);
    expect(new Set([partner(PAL), bottomRowIdea(PAL), wholeIdea(PAL)]).size).toBe(3);
    // (the Glimmer's buns fill the bottom row and leave the top row's empty places for the child to find)
    expect(partner(PAL) - bottomRowIdea(PAL)).toBe(2);
    expect(new Set([9, FIRST, BUDDY, PAL, EXTRA, NEXT_DAY]).size).toBe(6);
  });
});

describe('the lesson, played by every kind of child', () => {
  it('a child who is right goes straight through, and still hears where the answer comes from', async () => {
    const { notes, said } = await play({ nums: [RIGHT] });
    expect(notes).toEqual({ first: 3 });
    expect(said).toContain('ep.ten.why');
    expect(said).not.toContain('ep.ten.p3.show');
    expect(said).not.toContain('ep.ten.extra');
    expect(said).toContain('ep.ten.sum.3');
  });
  it('the idea is shown once, on 9 and 1, before the child is asked anything', async () => {
    const { log } = await play({ nums: [RIGHT] });
    const ask = log.findIndex(l => l.startsWith('num '));
    expect(log.indexOf('show fill(9)')).toBeGreaterThan(0);
    expect(log.indexOf('more(1)')).toBeLessThan(ask);
    expect(log.indexOf('more(1)')).toBeGreaterThan(log.indexOf('show fill(9)'));
  });
  it('every number is acted out, even a silly one, and zero gets its own words', async () => {
    expect((await play({ nums: [9999] })).log).toContain('more(9999)');
    const zero = await play({ nums: [0] });
    expect(zero.log).toContain('more(0)');
    expect(zero.said).toContain('ep.ten.try.zero');
    expect(zero.said).toContain('ep.ten.zero');
    expect(zero.said).not.toContain('ep.ten.few');
  });
  it('a wrong number is looked at together and never asked again; too few and too many each hear what was right in it', async () => {
    const few = await play({ nums: [2] }), over = await play({ nums: [9] });
    expect(few.said).toContain('ep.ten.few');
    expect(over.said).toContain('ep.ten.over');
    for (const p of [few, over]) {
      expect(p.said).toContain('ep.ten.p3.show');
      expect(p.log.filter(l => l.startsWith('num '))).toHaveLength(1);
      // the pink buns go before the count, the empty places are lit one by one, and then the right number comes
      const at = p.log.indexOf('say ep.ten.p3.show');
      expect(p.log.slice(at + 1, at + 5)).toEqual(['show moreOff()', 'show point(1)', 'show point(2)', 'show point(3)']);
      expect(p.log.slice(at)).toContain('more(3)');
    }
  });
  it("the buddy's idea shows as a thought, is tried on its own tray, and the child judges it; the ring that answers comes after the question", async () => {
    for (const pick of ['no', 'yes']) {
      const { log, said } = await play({ nums: [RIGHT], picks: [pick] });
      expect(log).toContain('buddy thinks 10');
      const tried = log.indexOf('say ep.ten.try.buddy'), asked = log.indexOf(`pick ${pick}`);
      expect(log.slice(tried, asked)).toContain('more(10)');
      expect(log.slice(tried, asked).some(l => /showLeft|light/.test(l))).toBe(false);
      expect(log.slice(asked)).toContain('show showLeft()');
      expect(said).toContain(`ep.ten.buddy.${pick}`);
      // the idea is closed before Next: the buns with no place go from the start of the line that says how many
      // the tray did need, and the pink buns on it are lit
      const so = log.indexOf('say ep.ten.buddy.so');
      expect(so).toBeGreaterThan(log.indexOf(`say ep.ten.buddy.${pick}`));
      expect(log.slice(so - 1, so + 4)).toEqual(['with pictures', 'say ep.ten.buddy.so', 'show spareOff()', 'show light("b")', 'go Next']);
    }
    expect(text('ep.ten.buddy.so').match(new RegExp(`\\b${partner(BUDDY)}\\b`, 'g'))).toHaveLength(2);
  });
  it('too few: "an empty place" is said only when exactly one place is left, and "empty places" when 2 or more are (rule 40)', async () => {
    const one = await play({ nums: [2] }), two = await play({ nums: [1] });
    expect(one.said).toContain('ep.ten.few');
    expect(one.said).not.toContain('ep.ten.few.places');
    expect(two.said).toContain('ep.ten.few.places');
    expect(two.said).not.toContain('ep.ten.few');
    // the next day's tray of 4 has 6 empty places: 5 more leave one, 4 more leave two
    expect((await nextDay({ nums: [5] })).said).toContain('ep.ten.few');
    const day = await nextDay({ nums: [4] });
    expect(day.said).toContain('ep.ten.few.places');
    expect(day.said).not.toContain('ep.ten.few');
    // the two forms differ only in the place or places, shown and said, and the red ring comes inside each
    for (const form of ['text', 'said'] as const) expect(BEAT_LINES.find(l => l.id === 'ep.ten.few.places')![form]).toBe(BEAT_LINES.find(l => l.id === 'ep.ten.few')![form]!.replace('an empty place', 'empty places'));
    for (const p of [one, two]) expect(p.log[p.log.findIndex(l => /^say ep\.ten\.few/.test(l)) + 1]).toBe('show showLeft()');
  });
  it('a child who says 10, as the buddy does, has it played once for the two of them, with the reason', async () => {
    const { log, said } = await play({ nums: [10] });
    expect(said).toContain('ep.ten.try.both');
    expect(said).toContain('ep.ten.both.why');
    expect(log).toContain('buddy thinks 10');
    expect(said).not.toContain('ep.ten.try.buddy');
    expect(said).not.toContain('ep.ten.buddy.in');
    expect(said).not.toContain('ep.ten.buddy.so');
    expect(log.filter(l => l === 'more(10)')).toHaveLength(1);
    // (the next day there is no buddy at the table: 10 is tried as the child's own number)
    expect((await nextDay({ nums: [10] })).said).not.toContain('ep.ten.try.both');
  });
  it("the Glimmer's idea fills the bottom row, and the child finds a missed place with a tap before anything is ringed", async () => {
    const { log, said } = await play({ nums: [RIGHT] });
    expect(log).toContain('pal thinks 5');
    const tried = log.indexOf('say ep.ten.try.pal'), tapped = log.indexOf('hands');
    expect(log.slice(tried, tapped)).toContain('more(5)');
    expect(log.slice(tried, tapped).some(l => /showLeft|light\("empty"\)|point/.test(l))).toBe(false);
    expect(log.slice(tapped, tapped + 2)).toEqual(['hands', 'tapEmpty()']);
    expect(log.slice(tapped)).toContain('show showLeft()');
    expect(log.slice(tapped)).toContain('more(2)');
    expect(said.indexOf('ep.ten.pal.found')).toBeGreaterThan(said.indexOf('ep.ten.pal.ask'));
  });
  it('a child who was not right at first fills one more tray with their own taps before the end, and one who was right does not', async () => {
    for (const n of [2, 9, 0, 10]) {
      const wrong = await play({ nums: [n] });
      expect(wrong.said, String(n)).toContain('ep.ten.extra');
      expect(wrong.log).toContain('tapFill()');
      expect(wrong.said.indexOf('ep.ten.extra.done')).toBeGreaterThan(wrong.said.indexOf('ep.ten.extra'));
      expect(wrong.said).toContain('ep.ten.sum.8');
      expect(wrong.log).toContain('show writeSum(8,2)');
    }
    const right = await play({ nums: [RIGHT] });
    expect(right.log).not.toContain('tapFill()');
    expect(right.log).toContain('show writeSum(3,7)');
  });
  it('the sum is written last, from the full tray, and waits for the child; then the tray goes', async () => {
    const { log } = await play({ nums: [RIGHT] });
    const sum = log.indexOf('show writeSum(3,7)');
    expect(log.slice(sum).filter(l => l.startsWith('go '))).toHaveLength(1);
    expect(log.slice(sum).some(l => l.startsWith('num ') || l === 'hands')).toBe(false);
    expect(log[log.length - 1]).toBe('show clear()');
  });
  it('the next day: a new tray, how many more, and the reason either way', async () => {
    for (const n of [6, 4]) {
      const p = await nextDay({ nums: [n] });
      expect(p.log).toContain('show trayIn(4)');
      expect(p.said).toContain(n === 6 ? 'ep.ten.why' : 'ep.ten.p6.show');
      expect(p.log).toContain('more(6)');
    }
    expect(TEN_LESSON.card({ first: 2 })[0]).toContain('2');
  });
});

describe('the lesson rules (docs/lesson-rules.md)', () => {
  const kids: Record<string, Child> = {
    'right every time': { nums: [3], picks: ['no'] }, 'wrong every time': { nums: [2], picks: ['yes'] }, 'too many': { nums: [9] },
    'too few': { nums: [1] }, 'sure that zero more are needed': { nums: [0], picks: ['yes'] }, 'thinking like the buddy (10)': { nums: [10] },
    'saying the number of buns on the tray (7)': { nums: [7] }, 'typing a silly number': { nums: [9999] },
  };
  const again = (c: Child): Child => ({ nums: [...c.nums], picks: c.picks ? [...c.picks] : undefined });
  for (const [name, kid] of Object.entries(kids)) it(`a child who is ${name}: every try named, explained, and every answer waits`, async () => {
    const { log } = await play(again(kid));
    expect(scriptProblems({ steps: stepsOf(log), announces })).toEqual([]);
  });
  it('the next day too', async () => {
    for (const n of [6, 4, 0, 10]) expect(scriptProblems({ steps: stepsOf((await nextDay({ nums: [n] })).log), announces })).toEqual([]);
  });
  const words = (id: string) => text(id).split(/\s+/).length;
  it('rule 37: no child sits through 35 words or more with nothing new on screen', async () => {
    for (const [name, kid] of Object.entries(kids)) expect(stillStretches(stepsOf((await play(again(kid))).log), words), name).toEqual([]);
    for (const n of [6, 4, 0]) expect(stillStretches(stepsOf((await nextDay({ nums: [n] })).log), words)).toEqual([]);
  });
  it('rule 45: a movement begins inside the line that names it, and the only moves left on their own are the stops kept on purpose', async () => {
    // every call that moves something on the table (not the child's own taps, not a light)
    const move = /^(show )?(trayIn|fill|more|moreOff|spareOff|showLeft|clear)\(/;
    /** the line a move is made in (the line said with pictures that it follows), or null when it is made in silence */
    const lineOf = (log: string[], i: number) => { let j = i - 1; while (j >= 0 && (log[j].startsWith('show ') || TRY.test(log[j]))) j--; return log[j]?.startsWith('say ') && log[j - 1] === 'with pictures' ? log[j].slice(4) : null; };
    const alone = (log: string[]) => log.filter((l, i) => move.test(l) && lineOf(log, i) == null);
    // The stops kept, each with its reason:
    // 1. the question "How many more buns fill the tray?" and its number keys, and the buddy's question;
    // 2. "Is the tray full now? Tap a place that still needs a bun", then the child's tap: a question and a job
    //    for the hands, with nothing moving until the child does;
    // 3. the child's own taps on the extra tray (their buns come as they tap);
    // 4. zero: nothing is coming, so nothing moves under "no more buns go on the tray";
    // 5. the next day's tray leaves after the last line, with nothing left to say over it.
    // None of the first four is a move made by the world outside a line, so in the lesson no move stands alone:
    for (const kid of Object.values(kids)) expect(alone((await play(again(kid))).log)).toEqual([]);
    expect(alone((await nextDay({ nums: [6] })).log)).toEqual(['clear()']);
    // each move is in the line that names it
    const right = await play({ nums: [3] });
    expect(lineOf(right.log, right.log.indexOf('show trayIn(7)'))).toBe('ep.ten.turn');
    expect(lineOf(right.log, right.log.indexOf('more(1)'))).toBe('ep.ten.try.demo');
    expect(lineOf(right.log, right.log.indexOf('more(3)'))).toBe('ep.ten.try.you');
    expect(lineOf(right.log, right.log.indexOf('more(10)'))).toBe('ep.ten.try.buddy');
    expect(lineOf(right.log, right.log.indexOf('show spareOff()'))).toBe('ep.ten.buddy.so');
    expect(lineOf(right.log, right.log.indexOf('more(5)'))).toBe('ep.ten.try.pal');
    expect(lineOf(right.log, right.log.indexOf('more(2)'))).toBe('ep.ten.try.top');
    expect(lineOf(right.log, right.log.lastIndexOf('show clear()'))).toBe('ep.ten.off');
    // a real try made inside its line is still a try: said whose it is, acted out, and what it showed said after
    const steps = stepsOf(right.log), at = steps.findIndex(x => x.k === 'act' && x.v === 'more(3)');
    expect([steps[at - 1], steps[at + 1]].map(x => `${x.k} ${x.v}`)).toEqual(['say ep.ten.try.you', 'say ep.ten.right']);
  });
  it('nothing said or lit before a question gives its answer away', async () => {
    const { log } = await play({ nums: [2] });
    const turn = log.indexOf('say ep.ten.turn'), ask = log.findIndex(l => l.startsWith('num '));
    for (const l of log.slice(turn, ask)) {
      if (l.startsWith('say ')) expect(text(l.slice(4)), l).not.toMatch(/\b3\b/);
      expect(l).not.toMatch(/light|point|showLeft/);
    }
    const day = (await nextDay({ nums: [4] })).log;
    for (const l of day.slice(0, day.findIndex(x => x.startsWith('num ')))) {
      if (l.startsWith('say ')) expect(text(l.slice(4)), l).not.toMatch(/\b6\b/);
      expect(l).not.toMatch(/light|point|showLeft/);
    }
    // the two empty places the Glimmer missed are not named or lit until the child has tapped
    const tried = log.indexOf('say ep.ten.try.pal'), tap = log.indexOf('hands');
    for (const l of log.slice(tried, tap).filter(x => x.startsWith('say '))) expect(text(l.slice(4)), l).not.toMatch(/\b2\b|top row/);
  });
  it('every line can stand up to the words rules', () => {
    expect(lineProblems(BEAT_LINES.filter(l => l.id.startsWith('ep.ten.')))).toEqual([]);
  });
  it('writes the script out for a cold read, when asked (rule 21): COLD_READ=out.txt writes out.ten.txt', async () => {
    const out = process.env.COLD_READ;
    if (!out) return;
    const runs: [string, Child][] = [
      ["A CHILD WHO IS WRONG EVERY TIME (says 2 more for the tray of 7; says every one of the buddy's buns found a place)", kids['wrong every time']],
      ['A CHILD WHO IS RIGHT EVERY TIME (says 3 more for the tray of 7; says not every one of the buddy\'s buns found a place)', kids['right every time']],
      ['A CHILD WHO SAYS 10, AS THE BUDDY DOES (only the part that differs matters: the try, and no buddy tray after it)', kids['thinking like the buddy (10)']],
    ];
    const parts: string[] = [];
    for (const [who, kid] of runs) {
      const p = await play(again(kid));
      const still = stillStretches(stepsOf(p.log), words);
      parts.push(who, '', ...p.film, '', `STILL STRETCHES LEFT: ${still.length ? still.join('; ') : 'none'}`, '', '');
    }
    for (const n of [4, 6]) {
      const p = await nextDay({ nums: [n] });
      parts.push(`THE NEXT DAY, A CHILD WHO SAYS ${n} MORE FOR THE TRAY OF 4`, '', ...p.film, '', '');
    }
    writeFileSync(out.replace(/(\.txt)?$/, '.ten.txt'), parts.join('\n'));
  });
});

describe('the words', () => {
  const said = (id: string) => BEAT_LINES.find(l => l.id === id)?.said ?? '';
  it('every line the lesson uses exists, and nothing else is written for it', () => {
    expect(BEAT_LINES.filter(l => l.id.startsWith('ep.ten.')).map(l => l.id).sort()).toEqual([...TEN_LINES].sort());
    for (const id of TEN_LINES) expect(LEARN_LINES.some(l => l.id === id), id).toBe(true);
  });
  it('every line the script can say is said by some child (none is written and never reached)', async () => {
    const heard = new Set<string>();
    for (const c of [{ nums: [3], picks: ['no'] }, { nums: [2], picks: ['yes'] }, { nums: [9] }, { nums: [0] }, { nums: [10] }]) for (const id of (await play(c)).said) heard.add(id);
    for (const n of [6, 4]) for (const id of (await nextDay({ nums: [n] })).said) heard.add(id);
    expect(TEN_LINES.filter(id => !heard.has(id))).toEqual([]);
  });
  it('a line explains in a sentence or three, and never runs on', () => {
    for (const id of TEN_LINES) expect(said(id).split(/\s+/).length, id).toBeLessThanOrEqual(40);
  });
  it('no ending about learning, and the voice never reads a digit or a blank it should say as a word', () => {
    for (const id of TEN_LINES) { expect(said(id), id).not.toMatch(/learn|explain|great job|well done|thank you/i); expect(said(id), id).not.toMatch(/\d|\{/); }
  });
});
