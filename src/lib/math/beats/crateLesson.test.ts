// The crate lesson played with a pretend child and a pretend world: every kind of child gets to the end,
// nothing is said that gives an answer away, the wrong answers all do something, and the lesson stays
// inside its word budget. (The film itself is checked by playing it: dev/epOverlap.ts and by eye.)
import { describe, expect, it } from 'vitest';
import { CRATE_LESSON, CRATE_LINES, type CrateWorld, type Face } from './crateLesson';
import type { Teller } from './types';
import { addedUp, floorOf, layer, meaning, pourOrder, rowBack, seenOnly, sumParts, volume, wrongIdea, type Dims } from './crate';
import { writeFileSync } from 'node:fs';
import { BEAT_LINES, LEARN_LINES } from '../../content/voice';
import { lineProblems, scriptProblems, type Step } from './rules';

type Child = { nums: number[]; picks: string[]; faces: Face[] };
function pretend(child: Child) {
  const log: string[] = [];
  const said: string[] = [];
  const world = new Proxy({} as CrateWorld, {
    get: (_, k: string) => {
      if (k === 'pickFace') return async () => child.faces.shift() ?? 'top';
      return (...a: unknown[]) => { log.push(`${k}(${a.map(x => JSON.stringify(x)).join(',')})`); return Promise.resolve(); };
    },
  });
  const speak = (id: string) => { said.push(id); log.push(`say ${id}`); };
  const teller: Teller = {
    say: async id => { speak(id); },
    num: async (_, id) => { if (id) speak(id); const n = child.nums.shift() ?? (id === 'ep.crate.total' ? 20 : null); if (n == null) throw new Error('the lesson asked for more numbers than this child has'); log.push(`num ${n}`); return n; },
    pick: async (_, choices, id) => { if (id) speak(id); const p = child.picks.shift() ?? choices[0].id; log.push(`pick ${p}`); return p as never; },
    hands: async (_, job) => { await job(); },
    go: async l => { log.push(`go ${l}`); }, wait: async () => {},
    buddy: () => {}, pal: () => {}, thought: (w, t) => { if (t) log.push(`${w} thinks ${t}`); }, myBet: () => {}, beat: () => {},
  };
  return { log, said, world, teller };
}
const countOf = (log: string[], name: string) => log.filter(l => l.startsWith(name)).length;

/** The run as the rules see it. */
const stepsOf = (log: string[]): Step[] => log.flatMap((l): Step[] => {
  if (l.startsWith('say ')) return [{ k: 'say', v: l.slice(4) }];
  if (l.startsWith('go ')) return [{ k: 'go', v: l.slice(3) }];
  if (l.startsWith('num ') || l.startsWith('pick ')) return [{ k: 'ask', v: l }];
  if (l.startsWith('pour') || l.startsWith('topUp')) return [{ k: 'act', v: l }];
  if (l.startsWith('writeSum')) return [{ k: 'answer', v: l }];
  return [];
});

describe('a crate, in numbers', () => {
  const d: Dims = { l: 5, w: 3, h: 2 };
  it('pours every place once, floor first', () => {
    const o = pourOrder(d);
    expect(o).toHaveLength(30);
    expect(new Set(o.map(s => `${s.x},${s.y},${s.z}`)).size).toBe(30);
    expect(o.slice(0, 15).every(s => s.y === 0)).toBe(true);
  });
  it('the rows and layers a hand makes are whole', () => {
    expect(rowBack(d, 2).every(s => s.z === 0)).toBe(true);
    expect(layer(d, 1)).toHaveLength(15);
  });
  it('what you can see from the corner leaves a hollow', () => {
    expect(seenOnly(d)).toHaveLength(22);
    expect(seenOnly({ l: 6, w: 3, h: 4 })).toHaveLength(42);
  });
  it('every number means something in the crate', () => {
    expect(meaning(30, d)).toEqual({ kind: 'full' });
    expect(meaning(12, d)).toEqual({ kind: 'short', missing: 18 });
    expect(meaning(40, d)).toEqual({ kind: 'over', extra: 10 });
    expect(meaning(0, d)).toEqual({ kind: 'short', missing: 30 });
  });
  it('knows the wrong ideas children bring', () => {
    expect(addedUp(d)).toBe(10); expect(floorOf(d)).toBe(15);
    expect(wrongIdea(10, d)).toBe('added');
    expect(wrongIdea(15, d)).toBe('floor');
    expect(wrongIdea(22, d)).toBe('seen');
    expect(wrongIdea(30, d)).toBeNull();
  });
  it('the sum keeps each number in its line\'s colour, whatever the order', () => {
    expect(sumParts(d).map(p => p.t).join(' ')).toBe('5 × 3 × 2 = 30');
    expect(sumParts({ l: 2, w: 3, h: 5 }, ['c', 'b', 'a'])[0]).toEqual({ t: '2', c: 'c' });
  });
  it('the lesson\'s crates can each be told apart: no two ideas give the same number in the first crate but the wall', () => {
    expect(new Set([addedUp(d), floorOf(d), seenOnly(d).length, volume(d)]).size).toBe(4);
  });
});

describe('the lesson, played by every kind of child', () => {
  const play = async (c: Child) => { const p = pretend(c); const notes = await CRATE_LESSON.play(p.teller, p.world); return { ...p, notes }; };
  it('a child who knows goes straight through, and is not asked to predict what they already showed', async () => {
    const { log, notes } = await play({ nums: [30, 30, 72], picks: ['same', 'layers'], faces: ['top'] });
    expect(notes).toEqual({ first: 30, second: 30 });
    expect(log.some(l => l.startsWith('topUp'))).toBe(false);
  });
  it('a child who adds sees their number poured with the buddy\'s', async () => {
    const { log } = await play({ nums: [12, 10, 30, 72], picks: ['same', 'layers'], faces: ['top'] });
    expect(log).toContain('buddy thinks 5 + 3 + 2 = 10');
    expect(countOf(log, 'pour(10)')).toBe(1); // one film for the two of them
  });
  it('a wrong prediction of the next layer is acted out, then the hand does it', async () => {
    const { log } = await play({ nums: [12, 10, 16, 72], picks: ['same', 'layers'], faces: ['top'] });
    expect(log).toContain('topUp(16)');
    expect(log.indexOf('topUp(16)')).toBeLessThan(log.lastIndexOf('sweep("h")'));
  });
  it('two misses on the shut crate means building it by hand, never being told the answer', async () => {
    const { log, said } = await play({ nums: [12, 10, 30, 13, 18], picks: ['same', 'layers'], faces: ['top'] });
    expect(countOf(log, 'sweep("w")')).toBe(2);
    expect(said.join()).not.toMatch(/72/);
  });
  it('Prism\'s hollow crate plays for everyone', async () => {
    const { log } = await play({ nums: [30, 30, 72], picks: ['same', 'layers'], faces: ['top'] });
    expect(log).toContain('pourSeen()');
    expect(log).toContain('liftTop()');
  });
  it('the buddy\'s crate: the end of the crate is 2 × 2, so that tap is shown and asked again', async () => {
    const { log } = await play({ nums: [30, 30, 72], picks: ['same', 'layers'], faces: ['side', 'side', 'front'] });
    expect(log.filter(l => l.startsWith('showFace'))).toEqual(['showFace("side")', 'showFace("side")', 'showFace("front")']);
    expect(log).toContain('layerOn("front")');
  });
  it('choosing "2 cubes" is acted out too', async () => {
    const { log } = await play({ nums: [30, 30, 72], picks: ['same', 'cubes', 'layers'], faces: ['top'] });
    expect(log).toContain('twoCubes()');
  });
  it('a silly number goes through like any other', async () => {
    const { log } = await play({ nums: [9999, 0, 9999, 0, 9999], picks: ['fewer', 'layers'], faces: ['top'] });
    expect(log).toContain('pour(9999)');
    expect(log).toContain('pour(0)');
  });
  it('the next day remembers the first guess, and a miss still ends in the hands', async () => {
    const p = pretend({ nums: [12, 12], picks: [], faces: [] });
    await CRATE_LESSON.check(p.teller, p.world, { first: 12 });
    expect(countOf(p.log, 'sweep("w")')).toBe(1);
    expect(CRATE_LESSON.card({ first: 12 })[0]).toContain('12');
  });
});

describe('the lesson rules (docs/lesson-rules.md)', () => {
  const kids: Record<string, Child> = {
    'wrong every time': { nums: [12, 20, 13, 18, 72 + 5], picks: ['more', 'cubes', 'layers'], faces: ['side', 'top'] },
    'too many every time': { nums: [99, 99, 99, 200, 200], picks: ['fewer', 'layers'], faces: ['top'] },
    'right every time': { nums: [30, 30, 72], picks: ['same', 'layers'], faces: ['top'] },
    'guesses what the buddy guesses': { nums: [10, 10, 30, 72], picks: ['same', 'layers'], faces: ['top'] },
    'guesses what Prism guesses': { nums: [15, 15, 30, 72], picks: ['same', 'layers'], faces: ['top'] },
  };
  const announces = /\.try\./;
  for (const [name, kid] of Object.entries(kids)) it(`a child who is ${name}: every try named, explained, and every answer waits`, async () => {
    const p = pretend({ ...kid, nums: [...kid.nums, 30, 30, 30, 30], picks: [...kid.picks], faces: [...kid.faces] });
    await CRATE_LESSON.play(p.teller, p.world);
    expect(scriptProblems({ steps: stepsOf(p.log), announces })).toEqual([]);
  });
  it('the next day too', async () => {
    for (const nums of [[60], [12, 60], [12, 13]]) {
      const p = pretend({ nums, picks: [], faces: [] });
      await CRATE_LESSON.check(p.teller, p.world, { first: 12 });
      expect(scriptProblems({ steps: stepsOf(p.log), announces })).toEqual([]);
      expect(p.log.some(l => l.startsWith('writeSum'))).toBe(true);
    }
  });
  it('a crate that was guessed wrong twice says so before it works it out, and shows the working', async () => {
    const p = pretend({ nums: [12, 20, 13, 18, 77, 30], picks: ["more", "layers"], faces: ["top"] });
    await CRATE_LESSON.play(p.teller, p.world);
    const at = p.said.indexOf('ep.crate.together');
    expect(at).toBeGreaterThan(-1);
    expect(p.said.slice(at + 1, at + 5)).toEqual(['ep.crate.shut.row', 'ep.crate.shut.floor', 'ep.crate.shut.up', 'ep.crate.shut.answer']);
    expect(p.said).toContain('ep.crate.total.no');
  });
  it('a guess of exactly the floor gets credit for the right first step, and a nudge from there', async () => {
    const p = pretend({ nums: [12, 20, 13, 18, 72, 20], picks: ['more', 'layers'], faces: ['top'] });
    await CRATE_LESSON.play(p.teller, p.world);
    expect(p.said).toContain('ep.crate.few.floor');
    expect(p.said).toContain('ep.crate.again.floor');
  });
  it('every child types a total of their own, even after being helped', async () => {
    const p = pretend({ nums: [12, 20, 13, 18, 77, 20], picks: ['more', 'layers'], faces: ['top'] });
    await CRATE_LESSON.play(p.teller, p.world);
    expect(p.said).toContain('ep.crate.total');
    expect(p.said).not.toContain('ep.crate.total.no');
  });
  it('every line can stand up to the words rules', () => {
    expect(lineProblems(BEAT_LINES)).toEqual([]);
  });
  it('the checks catch the mistakes they exist for', () => {
    expect(scriptProblems({ announces, steps: [{ k: 'act', v: 'pour(12)' }, { k: 'say', v: 'x' }] })[0]).toMatch(/rule 6/);
    expect(scriptProblems({ announces, steps: [{ k: 'say', v: 'a.try.you' }, { k: 'act', v: 'pour(12)' }, { k: 'act', v: 'pour(3)' }] }).join()).toMatch(/rule 8/);
    expect(scriptProblems({ announces, steps: [{ k: 'answer', v: 'sum' }, { k: 'say', v: 'x' }, { k: 'ask', v: 'num 3' }] })[0]).toMatch(/rule 11/);
    expect(lineProblems([{ id: 'x', voice: 'coach', text: 'Loose cubes crack!', said: 'Loose cubes crack!' }])[0]).toMatch(/rule 4/);
  });
  it('writes the script out for a cold read, when asked (rule 21)', async () => {
    const out = process.env.COLD_READ;
    if (!out) return;
    const p = pretend({ nums: [12, 20, 13, 18, 77, 30], picks: ['more', 'cubes', 'layers'], faces: ['side', 'top'] });
    await CRATE_LESSON.play(p.teller, p.world);
    const text = (id: string) => BEAT_LINES.find(l => l.id === id)?.text ?? id;
    writeFileSync(out, p.log.map(l => l.startsWith('say ') ? `SAID: ${text(l.slice(4))}` : `(picture or child: ${l})`).join('\n'));
  });
});

describe('the words', () => {
  const text = (id: string) => BEAT_LINES.find(l => l.id === id)?.said ?? '';
  it('every line the lesson uses exists, and nothing else is written for it', () => {
    expect(BEAT_LINES.map(l => l.id).sort()).toEqual([...CRATE_LINES].sort());
    for (const id of CRATE_LINES) expect(LEARN_LINES.some(l => l.id === id), id).toBe(true);
  });
  it('a line explains in a sentence or three, and never runs on', () => {
    for (const id of CRATE_LINES) expect(text(id).split(/\s+/).length, id).toBeLessThanOrEqual(36);
  });
  it('no ending about learning', () => {
    for (const id of CRATE_LINES) expect(text(id), id).not.toMatch(/learn|explain|great job|well done|thank you/i);
  });
});
