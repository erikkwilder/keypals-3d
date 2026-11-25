// Fair Shares played with a pretend child and a pretend world: every kind of child gets to the end, every
// cut and every pick is acted out, nothing is said that gives an answer away before it's asked, and the
// lesson holds to the rules in docs/lesson-rules.md. (The film itself is checked by playing it, by eye.)
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { SHARE_BARS, SHARE_LESSON, SHARE_LINES, type ShareWorld } from './shareLesson';
import type { Teller } from './types';
import { fair, fairCuts, middle, nameIdea, piecesOf, sides } from './share';
import { BEAT_LINES, LEARN_LINES } from '../../content/voice';
import { lineProblems, scriptProblems, type Step } from './rules';

/** a child: the cuts they make (one list of lines per bar), the single taps when cutting together, the picks */
type Child = { cuts: number[][]; taps: number[]; picks: string[] };
function pretend(child: Child) {
  const log: string[] = [];
  const said: string[] = [];
  /** the run as a reader would follow it: each line as it shows on screen (its numbers filled in), and what the picture or the child does */
  const film: string[] = [];
  const shown = (id: string, n?: number, m?: number) => (BEAT_LINES.find(l => l.id === id)?.text ?? id).replaceAll('{n}', String(n ?? '')).replaceAll('{m}', String(m ?? ''));
  const world = new Proxy({} as ShareWorld, {
    get: (_, k: string) => {
      if (k === 'cut') return async (n: number) => { const c = child.cuts.shift(); if (!c) throw new Error('the lesson asked for more cuts than this child has'); log.push(`cut(${n}) ${c.join(',')}`); film.push(`(the child cuts the bar into ${n} pieces, after squares ${c.join(', ')})`); return c; };
      if (k === 'tapCut') return async (hint: number) => { const g = child.taps.shift() ?? hint; log.push(`tapCut ${g}`); film.push(`(the child cuts once, after square ${g})`); return g; };
      return (...a: unknown[]) => { const l = `${k}(${a.map(x => JSON.stringify(x)).join(',')})`; log.push(l); film.push(`(picture: ${l})`); return Promise.resolve(); };
    },
  });
  const speak = (id: string, n?: number, m?: number) => { said.push(id); log.push(`say ${id}`); film.push(`SAID: ${shown(id, n, m)}`); };
  const teller: Teller = {
    say: async (id, n, m) => { speak(id, n, m); },
    num: async () => { throw new Error('this lesson has no number questions'); },
    pick: async (q, choices, id) => { if (id) speak(id); const p = child.picks.shift() ?? choices[0].id; if (!choices.some(c => c.id === p)) throw new Error(`no choice ${p}`); log.push(`pick ${p}`); film.push(`(asked "${q}" with the choices ${choices.map(c => c.text).join(' / ')}: the child picks ${choices.find(c => c.id === p)!.text})`); return p as never; },
    hands: async (words, job) => { film.push(`(the child's hands: ${words})`); await job(); },
    go: async l => { log.push(`go ${l}`); film.push(`(the child taps ${l})`); }, wait: async () => {},
    buddy: () => {}, pal: () => {}, thought: (w, t) => { if (t) { log.push(`${w} thinks ${t}`); film.push(`(a thought over ${w === 'pal' ? "Pebble's" : "the buddy's"} head: ${t})`); } }, myBet: () => {}, beat: () => {},
  };
  return { log, said, world, teller, film };
}
const countOf = (log: string[], name: string) => log.filter(l => l.startsWith(name)).length;
/** The run as the rules see it: serving, someone else's knife, and a piece laid under are what get acted out. */
const stepsOf = (log: string[]): Step[] => log.flatMap((l): Step[] => {
  if (l.startsWith('say ')) return [{ k: 'say', v: l.slice(4) }];
  if (l.startsWith('go ')) return [{ k: 'go', v: l.slice(3) }];
  if (l.startsWith('pick ') || l.startsWith('cut(') || l.startsWith('tapCut')) return [{ k: 'ask', v: l }];
  if (l.startsWith('serve') || l.startsWith('otherBar') || l.startsWith('testOther') || l.startsWith('besides') || l.startsWith('give')) return [{ k: 'act', v: l }];
  if ((l.startsWith('label(') && !l.startsWith('label(null')) || (l.startsWith('total(') && !l.startsWith('total(null'))) return [{ k: 'answer', v: l }];
  return [];
});
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
    expect(log).toContain('uncut(3)');
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
      const named = p.log.indexOf('label("1/4")');
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
