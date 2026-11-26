// Fair Shares played with a pretend child and a pretend world: every kind of child gets to the end, every
// cut and every pick is acted out, nothing is said that gives an answer away before it's asked, and the
// lesson holds to the rules in docs/lesson-rules.md. (The film itself is checked by playing it, by eye.)
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { SHARE_BARS, SHARE_LESSON, SHARE_LINES, type ShareWorld } from './shareLesson';
import type { Teller } from './types';
import { fair, fairCuts, middle, nameIdea, piecesOf, sides } from './share';
import { BEAT_LINES, LEARN_LINES } from '../../content/voice';
import { lineProblems, scriptProblems, stillStretches, type Step } from './rules';

/** a child: the cuts they make (one list of lines per bar), the single taps when cutting together, the picks */
type Child = { cuts: number[][]; taps: number[]; picks: string[] };
/** the things that move on the table, and where among its arguments each one's length in seconds is (-1: it takes none) */
const MOVES: Record<string, number> = { serve: 0, testOther: 0, otherBar: 1, besides: 2, give: 2, barIn: -1, plates: -1, barOut: -1, clearOther: -1, join: -1, uncut: -1, eat: -1 };
/** the real tries: the child is told what each is before it and what it showed after it (rules 6 to 8). Made
 *  inside the line that names it (rule 45), a try is still a try */
const TRIES = ['serve', 'otherBar', 'testOther', 'besides', 'give'];
function pretend(child: Child) {
  const log: string[] = [];
  /** every movement made between lines, with no words over it (rule 45) */
  const apart: string[] = [];
  const said: string[] = [];
  /** the run as a reader would follow it: each line as it shows on screen (its numbers filled in), and what the picture or the child does */
  const film: string[] = [];
  /** the second of its line a picture comes at, while a line is being said with its pictures (null: between lines) */
  let cue: number | null = null;
  const shown = (id: string, n?: number, m?: number) => (BEAT_LINES.find(l => l.id === id)?.text ?? id).replaceAll('{n}', String(n ?? '')).replaceAll('{m}', String(m ?? ''));
  const world = new Proxy({} as ShareWorld, {
    get: (_, k: string) => {
      if (k === 'cut') return async (n: number) => { const c = child.cuts.shift(); if (!c) throw new Error('the lesson asked for more cuts than this child has'); log.push(`cut(${n}) ${c.join(',')}`); film.push(`(the child cuts the bar into ${n} pieces, after squares ${c.join(', ')})`); return c; };
      if (k === 'tapCut') return async (hint: number) => { const g = child.taps.shift() ?? hint; log.push(`tapCut ${g}`); film.push(`(the child cuts once, after square ${g})`); return g; };
      // (a picture that goes with a line is recorded as shown with it, and the cold read gets its second)
      // (a move's length in seconds is left out of the record and printed in the cold read)
      return (...a: unknown[]) => {
        const at = MOVES[k] ?? -1, over = at >= 0 ? (a[at] as number | undefined) : undefined, args = at >= 0 ? a.slice(0, at) : a;
        while (args.length && args.at(-1) === undefined) args.pop();
        const l = `${k}(${args.map(x => JSON.stringify(x)).join(',')})`;
        if (cue == null && k in MOVES) apart.push(l);
        log.push(cue == null || TRIES.includes(k) ? l : `show ${l}`);
        film.push(cue == null ? `(picture: ${l})` : `   (picture, ${cue} s into that line${over ? `, taking ${over} s` : ''}: ${l})`);
        return Promise.resolve();
      };
    },
  });
  const speak = (id: string, n?: number, m?: number) => { said.push(id); log.push(`say ${id}`); film.push(`SAID: ${shown(id, n, m)}`); };
  const teller: Teller = {
    say: async (id, n, m) => { speak(id, n, m); },
    // (a line said with its pictures: the line, then each picture in turn)
    sayWith: async (id, cues, n, m) => { speak(id, n, m); log.push('(with pictures)'); for (const [at, act] of [...cues].sort((a, b) => a[0] - b[0])) { cue = at; await act(); } cue = null; },
    num: async () => { throw new Error('this lesson has no number questions'); },
    pick: async (q, choices, id) => { if (id) speak(id); const p = child.picks.shift() ?? choices[0].id; if (!choices.some(c => c.id === p)) throw new Error(`no choice ${p}`); log.push(`pick ${p}`); film.push(`(asked "${q}" with the choices ${choices.map(c => c.text).join(' / ')}: the child picks ${choices.find(c => c.id === p)!.text})`); return p as never; },
    hands: async (words, job) => { film.push(`(the child's hands: ${words})`); await job(); },
    go: async l => { log.push(`go ${l}`); film.push(`(the child taps ${l})`); }, wait: async ms => { film.push(`(nothing moves and nothing is said for ${ms / 1000} s)`); },
    buddy: () => {}, pal: () => {}, thought: (w, t) => { if (t) { log.push(`${w} thinks ${t}`); film.push(`(a thought over ${w === 'pal' ? "Pebble's" : "the buddy's"} head: ${t})`); } }, myBet: () => {}, beat: () => {},
  };
  return { log, said, world, teller, film, apart };
}
const countOf = (log: string[], name: string) => log.filter(l => l.startsWith(name)).length;
/** The run as the rules see it: serving, someone else's knife, and a piece laid under are what get acted out. */
const stepsOf = (log: string[]): Step[] => log.flatMap((l): Step[] => {
  if (l.startsWith('show ')) return [{ k: 'show', v: l.slice(5) }];
  if (l.startsWith('say ')) return [{ k: 'say', v: l.slice(4) }];
  if (l.startsWith('go ')) return [{ k: 'go', v: l.slice(3) }];
  if (l.startsWith('pick ') || l.startsWith('cut(') || l.startsWith('tapCut')) return [{ k: 'ask', v: l }];
  if (l.startsWith('serve') || l.startsWith('otherBar') || l.startsWith('testOther') || l.startsWith('besides') || l.startsWith('give')) return [{ k: 'act', v: l }];
  if ((l.startsWith('label(') && !l.startsWith('label(null')) || (l.startsWith('total(') && !l.startsWith('total(null'))) return [{ k: 'answer', v: l }];
  return [];
});
/** The run as the screen shows it, for rule 37: every line and whether it was said with its pictures, every
 *  question, and everything that happens on the table or over a friend's head between lines (a thing going away
 *  is not a picture, and neither is "Show me"). */
const screenOf = (log: string[]): Step[] => {
  const out: Step[] = [];
  for (const l of log) {
    if (l === '(with pictures)') out[out.length - 1].shown = true;
    else if (l.startsWith('say ')) out.push({ k: 'say', v: l.slice(4) });
    else if (l.startsWith('show ')) out.push({ k: 'show', v: l.slice(5) });
    else if (l.startsWith('go ')) out.push({ k: 'go', v: l });
    else if (l.startsWith('pick ') || l.startsWith('cut(') || l.startsWith('tapCut')) out.push({ k: 'ask', v: l });
    else if (!/^\w+\((null)?\)$/.test(l) || /^(serve|join|eat|testOther|clearOther|barOut)\(\)$/.test(l)) out.push({ k: 'act', v: l });
  }
  return out;
};
const wordsOf = (id: string) => (BEAT_LINES.find(l => l.id === id)?.text ?? '').split(/\s+/).length;
const RIGHT: Child = { cuts: [[2, 4, 6], [2, 4]], taps: [], picks: ['no', '4', '3', '2'] };
const WRONG: Child = { cuts: [[1, 4, 5], [3, 6, 7], [1, 2], [4, 5], [2, 4]], taps: [3, 4, 5, 2, 7, 6], picks: ['yes', '8', '6', '6'] };

describe('a bar, in numbers', () => {
  it('cuts leave the pieces between them, in any order, ignoring a repeat', () => {
    expect(piecesOf(8, [6, 2, 4])).toEqual([2, 2, 2, 2]);
    expect(piecesOf(8, [1, 4, 5])).toEqual([1, 3, 1, 3]);
    expect(piecesOf(8, [4, 4])).toEqual([4, 4]);
    expect(piecesOf(8, [])).toEqual([8]);
  });
  it('knows a fair share', () => {
    expect(fair([2, 2, 2, 2])).toBe(true);
    expect(fair([1, 1, 2, 4])).toBe(false);
    expect(fairCuts(8, 4)).toEqual([2, 4, 6]);
    expect(fairCuts(8, 3)).toBeNull();
    expect(SHARE_BARS).toEqual({ first: [2, 4, 6], last: [2, 4], nextDay: [3, 6, 9] });
  });
  it('finds a middle, and the pieces either side of a cut', () => {
    expect(middle(0, 8)).toBe(4); expect(middle(4, 8)).toBe(6); expect(middle(0, 3)).toBeNull();
    expect(sides(0, 8, 3)).toEqual([3, 5]);
  });
  it('the buddy\'s 4 pieces are really 4, and really not equal', () => {
    expect(piecesOf(8, [1, 2, 4])).toEqual([1, 1, 2, 4]);
  });
  it('tells a name from the pieces from a name from the squares', () => {
    expect(nameIdea(3, 6, 3)).toBe('right');
    expect(nameIdea(6, 6, 3)).toBe('squares');
    expect(nameIdea(2, 6, 3)).toBe('other');
  });
});

describe('the lesson, played by every kind of child', () => {
  const play = async (c: Child) => { const p = pretend({ cuts: c.cuts.map(x => [...x]), taps: [...c.taps], picks: [...c.picks] }); const notes = await SHARE_LESSON.play(p.teller, p.world); return { ...p, notes }; };
  it('a child who cuts fairly goes straight through, and is never walked through the halving', async () => {
    const { said, notes } = await play(RIGHT);
    expect(notes).toEqual({ fair: 1, small: 2, big: 2 });
    expect(said).not.toContain('ep.share.together');
    expect(said).toContain('ep.share.fair');
  });
  it('an unfair cut is served and lined up like a fair one: only the bar says which', async () => {
    const { log, said } = await play(WRONG);
    expect(log.indexOf('cut(4) 1,4,5')).toBeLessThan(log.indexOf('serve()'));
    expect(said[said.indexOf('ep.share.try.you') + 1]).toBe('ep.share.unfair');
  });
  it('two unfair cuts means cutting it together, and a wrong half is cut, shown and undone', async () => {
    const { log, said } = await play(WRONG);
    expect(said).toContain('ep.share.together');
    expect(log).toContain('tapCut 3');
    expect(log).toContain('show uncut(3)');
    expect(said).toContain('ep.share.eight.half.no');
    expect(said).toContain('ep.share.eight.quarter.no');
    expect(said).toContain('ep.share.fair.together');
  });
  it('the buddy\'s pieces and Pebble\'s eighth are acted out whatever the child picks', async () => {
    for (const c of [RIGHT, WRONG]) {
      const { log } = await play(c);
      expect(log).toContain('otherBar([1,2,5])');
      expect(log).toContain('testOther()');
      expect(log).toContain('besides(8)');
    }
  });
  it('a child who names the third by its squares sees a sixth laid under it', async () => {
    const { log, said } = await play(WRONG);
    expect(log).toContain('besides(6)');
    expect(said).toContain('ep.share.call.squares');
  });
  it('a child who picks a half sees a half laid under it', async () => {
    const { log, said } = await play({ ...RIGHT, picks: ['no', '4', '2'] });
    expect(log).toContain('besides(2)');
    expect(said).toContain('ep.share.call.half');
  });
  it('the last bar is cut by the child alone: a hint after two misses, never the cut done for them', async () => {
    const { log, said } = await play(WRONG);
    expect(said).toContain('ep.share.hint');
    expect(countOf(log, 'cut(3)')).toBe(3);
    expect(log.filter(l => l.startsWith('cut(3)')).at(-1)).toBe('cut(3) 2,4');
  });
  it('the next day remembers the first cut, and two misses still end in halving', async () => {
    const p = pretend({ cuts: [[1, 2, 3], [4, 8, 10]], taps: [], picks: ['12'] });
    await SHARE_LESSON.check(p.teller, p.world, { fair: 0, small: 1, big: 3 });
    expect(p.said).toContain('ep.share.together');
    expect(p.said).toContain('ep.share.check.call.no');
    expect(SHARE_LESSON.card({ fair: 0, small: 1, big: 3 })[0]).toContain('1 to 3');
  });
});

describe('the lesson rules (docs/lesson-rules.md)', () => {
  const kids: Record<string, Child> = {
    'right every time': RIGHT,
    'wrong all the way through': WRONG,
    'right the second time': { cuts: [[1, 2, 3], [2, 4, 6], [1, 5], [2, 4]], taps: [], picks: ['yes', 'same', '2'] },
    'unfair, then wrong at every step of the halving': { cuts: [[7, 6, 5], [1, 2, 3], [2, 4]], taps: [1, 2, 3, 4, 1, 3, 2, 5, 6], picks: ['no', '8', '3'] },
  };
  const announces = /\.try\./;
  for (const [name, kid] of Object.entries(kids)) it(`a child who is ${name}: every try named, explained, and every answer waits`, async () => {
    const p = pretend({ cuts: kid.cuts.map(x => [...x]), taps: [...kid.taps], picks: [...kid.picks] });
    await SHARE_LESSON.play(p.teller, p.world);
    expect(scriptProblems({ steps: stepsOf(p.log), announces })).toEqual([]);
  });
  it('the next day too', async () => {
    for (const cuts of [[[3, 6, 9]], [[1, 2, 3], [3, 6, 9]], [[1, 2, 3], [5, 6, 7]]]) for (const pick of ['4', '12']) {
      const p = pretend({ cuts: cuts.map(x => [...x]), taps: [], picks: [pick] });
      await SHARE_LESSON.check(p.teller, p.world, { fair: 1, small: 2, big: 2 });
      expect(scriptProblems({ steps: stepsOf(p.log), announces })).toEqual([]);
    }
  });
  it('the name 1/4 comes only after the hands made fair fourths (rule 17)', async () => {
    for (const c of [RIGHT, WRONG]) {
      const p = pretend({ cuts: c.cuts.map(x => [...x]), taps: [...c.taps], picks: [...c.picks] });
      await SHARE_LESSON.play(p.teller, p.world);
      const named = p.log.findIndex(l => l.endsWith('label("1/4")'));
      expect(named).toBeGreaterThan(p.log.findIndex(l => l === 'say ep.share.fair' || l === 'say ep.share.fair.together'));
      expect(p.said.slice(0, p.said.indexOf('ep.share.name')).some(id => /eighth|fourth/.test(BEAT_LINES.find(l => l.id === id)?.text ?? ''))).toBe(false);
    }
  });
  it('a question never has its answer on screen or in the words first (rule 13a)', async () => {
    const p = pretend({ ...WRONG, cuts: WRONG.cuts.map(x => [...x]), taps: [...WRONG.taps], picks: [...WRONG.picks] });
    await SHARE_LESSON.play(p.teller, p.world);
    // the third's name isn't said or shown before the child is asked for it
    const asked = p.said.indexOf('ep.share.call');
    expect(p.said.slice(0, asked).some(id => /third|1\/3/.test(BEAT_LINES.find(l => l.id === id)?.text ?? ''))).toBe(false);
    expect(p.log.slice(0, p.log.indexOf('say ep.share.call')).some(l => l.includes('1/3'))).toBe(false);
  });
  // rule 37 (Erik: "you're just kind of sitting there"): a run of 35 words or more with nothing happening on screen
  const still = async (kid: Child, part: 'start' | 'rest') => {
    const p = pretend({ cuts: kid.cuts.map(x => [...x]), taps: [...kid.taps], picks: [...kid.picks] });
    await SHARE_LESSON.play(p.teller, p.world);
    // (the first Next is the one after what one fourth means)
    const steps = screenOf(p.log), named = steps.findIndex(s => s.k === 'go');
    return stillStretches(part === 'start' ? steps.slice(0, named + 1) : steps.slice(named + 1), wordsOf).map(b => b.replace(/^.*\((.*)\)$/, '$1'));
  };
  it('from the opening to what one fourth means, no child sits watching a still table while the narrator talks (rule 37)', async () => {
    for (const kid of Object.values(kids)) expect(await still(kid, 'start')).toEqual([]);
  });
  it('nor the next day', async () => {
    for (const cuts of [[[3, 6, 9]], [[1, 2, 3], [3, 6, 9]], [[1, 2, 3], [5, 6, 7]]]) for (const pick of ['4', '12']) {
      const p = pretend({ cuts: cuts.map(x => [...x]), taps: [], picks: [pick] });
      await SHARE_LESSON.check(p.teller, p.world, { fair: 1, small: 2, big: 2 });
      expect(stillStretches(screenOf(p.log), wordsOf)).toEqual([]);
    }
  });
  it('nor from there to the end: the buddy\'s pieces, the eighth, the names of a third and of two thirds (rule 37)', async () => {
    for (const kid of Object.values(kids)) expect(await still(kid, 'rest')).toEqual([]);
  });
  it('a line with its pictures says so in the record, and the pieces go back together as the narrator says they do', async () => {
    const p = pretend({ cuts: WRONG.cuts.map(x => [...x]), taps: [...WRONG.taps], picks: [...WRONG.picks] });
    await SHARE_LESSON.play(p.teller, p.world);
    const at = (l: string) => p.log.indexOf(l);
    // the plates come with the line that names them, and the pretend pieces are uneven with a cross, then even with a tick
    expect(at('show plates(4)')).toBe(at('say ep.share.plates') + 2);
    expect(p.log.filter(l => l.startsWith('show pretend(')).slice(0, 3)).toEqual(['show pretend([2.6,1,2.4,2],"no")', 'show pretend([2,2,2,2],"yes")', 'show pretend(null)']);
    // an unfair cut: the smallest pieces light, then the biggest, then the level line with a cross
    const u = at('say ep.share.unfair');
    expect(p.log.slice(u + 2, u + 6)).toEqual(['show light([0,2])', 'show light([1,3])', 'show light(null)', 'show level("no")']);
    expect(p.log[at('say ep.share.again') + 2]).toBe('show join()');
    expect(p.log[at('say ep.share.together') + 2]).toBe('show join()');
    // the hint: the pieces go back, then 2 more squares light at each "2" the narrator says (rule 42)
    const h = at('say ep.share.hint');
    expect(p.log.slice(h + 2, h + 6)).toEqual(['show join()', 'show squares([[0,1]])', 'show squares([[0,1],[2,3]])', 'show squares([[0,1],[2,3],[4,5]])']);
    // a half's squares light so they can be counted, and its middle is never marked (rule 41)
    const q = at('say ep.share.eight.quarter');
    expect(p.log.slice(q + 2, q + 4)).toEqual(['show squares([[0],[1],[2],[3]])', 'show squares([[0],[1],[2],[3],[4],[5],[6],[7]])']);
    // the name comes onto the pieces while the line that gives it is being said, after the pieces are counted
    const n = at('say ep.share.name');
    expect(p.log.slice(n + 2, n + 6)).toEqual(['show squares([[0,1],[2,3],[4,5],[6,7]])', 'show light([0])', 'show light(null)', 'show label("1/4")']);
    // no pretend piece is ever cut where the real bar's fair cuts are shown: the plan has no squares, only plates
    expect(p.log.filter(l => l.startsWith('show plan(')).every(l => /^show plan\((null|\[[124,3]+\])\)$/.test(l))).toBe(true);
  });
  // rule 45 (Erik: "the talking of the narrator has to completely stop before the thing ... happens. But then
  // when the plates are moving, there's no talking")
  it('rule 45: every movement begins inside the line that names it, and the one move left on its own is the bar leaving after the next-day check', async () => {
    for (const kid of Object.values(kids)) {
      const p = pretend({ cuts: kid.cuts.map(x => [...x]), taps: [...kid.taps], picks: [...kid.picks] });
      await SHARE_LESSON.play(p.teller, p.world);
      expect(p.apart).toEqual([]);
    }
    for (const cuts of [[[3, 6, 9]], [[1, 2, 3], [5, 6, 7]]]) {
      const p = pretend({ cuts: cuts.map(x => [...x]), taps: [], picks: ['4'] });
      await SHARE_LESSON.check(p.teller, p.world, { fair: 1, small: 2, big: 2 });
      expect(p.apart).toEqual(['barOut()']);
    }
    const p = pretend({ cuts: WRONG.cuts.map(x => [...x]), taps: [...WRONG.taps], picks: [...WRONG.picks] });
    await SHARE_LESSON.play(p.teller, p.world);
    // each move, and the line it is made in
    const lineOf = (move: string) => { const i = p.log.indexOf(move); return i < 0 ? 'never' : p.log.slice(0, i).reverse().find(l => l.startsWith('say '))!.slice('say ep.share.'.length); };
    const where = { 'show barIn(8)': 'intro', 'serve()': 'try.you', 'show uncut(3)': 'eight.half.no', 'show uncut(5)': 'eight.quarter.no', 'otherBar([1,2,5])': 'try.buddy', 'testOther()': 'try.test',
      'show clearOther()': 'more', 'besides(8)': 'try.pal', 'show barOut()': 'last', 'show barIn(6)': 'last', 'show plates(3,["Your buddy","Pebble","You"])': 'last', 'besides(6)': 'try.name',
      'give(1,2)': 'try.give', 'besides(6,2)': 'try.six', 'show label("1/3")': 'try.two.together', 'show eat()': 'eat' };
    expect(Object.fromEntries(Object.keys(where).map(m => [m, lineOf(m)]))).toEqual(where);
    // every time the pieces are served, it is inside a line that says so
    p.log.forEach((l, i) => { if (l === 'serve()') expect(p.log.slice(0, i).reverse().find(x => x.startsWith('say '))).toMatch(/^say ep\.share\.try\.(you|again|together|last)$/); });
    // a try made inside its line is still a try: named by the line it is in, and the next thing said is what it showed
    const steps = stepsOf(p.log).filter(s => s.k !== 'show');
    for (const tried of ['serve()', 'otherBar([1,2,5])', 'testOther()', 'besides(8)', 'besides(6)', 'give(1,2)', 'besides(6,2)']) {
      const i = steps.findIndex(s => s.k === 'act' && s.v === tried);
      expect(steps[i - 1], tried).toMatchObject({ k: 'say', v: expect.stringMatching(/\.try\./) });
      expect(steps[i + 1].k, tried).toMatch(/say|ask/);
    }
  });
  it('why equal pieces are fair is said whole once: the last bar\'s fair cut gets its own numbers and the reason, shorter (rule 44)', async () => {
    for (const kid of Object.values(kids)) {
      const p = pretend({ cuts: kid.cuts.map(x => [...x]), taps: [...kid.taps], picks: [...kid.picks] });
      await SHARE_LESSON.play(p.teller, p.world);
      expect(p.said.filter(id => id === 'ep.share.fair' || id === 'ep.share.fair.together')).toHaveLength(1);
      expect(p.said.filter(id => id === 'ep.share.fair.again')).toHaveLength(1);
      expect(p.film).toContain('SAID: Your 3 pieces are all the same size, 2 squares each, so this share is fair too.');
    }
  });
  it('every line can stand up to the words rules', () => {
    expect(lineProblems(BEAT_LINES.filter(l => l.id.startsWith('ep.share.')))).toEqual([]);
  });
  it('writes the script out for a cold read, when asked (rule 21): a child wrong all the way through', async () => {
    const out = process.env.COLD_READ;
    if (!out) return;
    const parts: string[] = [];
    for (const [who, kid] of [['A CHILD WHO IS WRONG EVERY TIME', WRONG], ['A CHILD WHO IS RIGHT EVERY TIME', RIGHT]] as const) {
      const p = pretend({ cuts: kid.cuts.map(x => [...x]), taps: [...kid.taps], picks: [...kid.picks] });
      await SHARE_LESSON.play(p.teller, p.world);
      parts.push(who, '', ...p.film, '', '');
    }
    writeFileSync(out.replace(/(\.txt)?$/, '.share$1'), parts.join('\n'));
  });
});

describe('what the cold read of 23 November found', () => {
  const run = async (c: Child) => { const p = pretend({ cuts: c.cuts.map(x => [...x]), taps: [...c.taps], picks: [...c.picks] }); const notes = await SHARE_LESSON.play(p.teller, p.world); return { ...p, notes }; };
  it('none of the buddy\'s pieces is a fourth of the bar (a 2-square piece of an 8-square bar would be)', async () => {
    const { log } = await run(WRONG);
    const cut = log.find(l => l.startsWith('otherBar('))!;
    const lines = JSON.parse(cut.slice('otherBar('.length, -1)) as number[];
    const pieces = [...lines, 8].map((g, i) => g - (i ? lines[i - 1] : 0));
    expect(pieces).toHaveLength(4);
    expect(pieces.reduce((a, b) => a + b, 0)).toBe(8);
    expect(pieces).not.toContain(2);
    const text = BEAT_LINES.find(l => l.id === 'ep.share.buddy.no')!.text;
    for (const n of pieces) expect(text).toContain(String(n));
  });
  it('a child who named no piece right gets one more to name alone before the end; one who did is not asked again', async () => {
    const wrong = await run(WRONG);
    expect(wrong.said).toContain('ep.share.own.ask');
    expect(wrong.said.indexOf('ep.share.own.ask')).toBeLessThan(wrong.said.indexOf('ep.share.eat'));
    const right = await run(RIGHT);
    expect(right.said).not.toContain('ep.share.own.ask');
  });
  it('the reasons the right child hears reach the wrong child too: what the bottom number and the top number count', async () => {
    const { said } = await run(WRONG);
    expect(said).toContain('ep.share.call.why');
    expect(said).toContain('ep.share.two.top');
    expect(said).toContain('ep.share.try.two.together');
    expect(said).not.toContain('ep.share.try.two');
  });
});

describe('the words', () => {
  const said = (id: string) => BEAT_LINES.find(l => l.id === id)?.said ?? '';
  it('every line the lesson uses exists, and nothing else is written for it', () => {
    expect(BEAT_LINES.filter(l => l.id.startsWith('ep.share.')).map(l => l.id).sort()).toEqual([...SHARE_LINES].sort());
    for (const id of SHARE_LINES) expect(LEARN_LINES.some(l => l.id === id), id).toBe(true);
  });
  it('a line explains in a sentence or three, and never runs on', () => {
    for (const id of SHARE_LINES) expect(said(id).split(/\s+/).length, id).toBeLessThanOrEqual(40);
  });
  it('no ending about learning, and the voice never reads a slash', () => {
    for (const id of SHARE_LINES) { expect(said(id), id).not.toMatch(/learn|explain|great job|well done|thank you/i); expect(said(id), id).not.toMatch(/\d\/\d/); }
  });
});
