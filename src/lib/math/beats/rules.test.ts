// The rule checks themselves (rules.ts): rule 37's still stretches, and pictures passing over rules 6 to 11.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { scriptProblems, stillStretches, type Step } from './rules';

const W: Record<string, number> = { a: 20, b: 20, c: 10, long: 40 };
const words = (id: string) => W[id] ?? 0;
const say = (v: string, shown = false): Step => ({ k: 'say', v, shown });

describe('rule 37: during any longer narration, something on screen shows what is being said', () => {
  it('two lines in a row with nothing happening, 35 words or more, is a still stretch', () => {
    expect(stillStretches([say('a'), say('b')], words)).toEqual(['rule 37: 40 words with nothing new on screen (a, b)']);
  });
  it('a short run is fine', () => {
    expect(stillStretches([say('a'), say('c')], words)).toEqual([]);
  });
  it('something acted out, a question or a button between the lines ends the run', () => {
    for (const k of ['act', 'ask', 'go', 'answer'] as const) expect(stillStretches([say('a'), { k, v: 'x' }, say('b')], words), k).toEqual([]);
  });
  it('a line said with its pictures is never part of a still run, however long', () => {
    expect(stillStretches([say('long', true), { k: 'show', v: 'plates' }], words)).toEqual([]);
    expect(stillStretches([say('a'), say('long', true), { k: 'show', v: 'plates' }, say('b')], words)).toEqual([]);
  });
  it('one long line alone with no picture is a still stretch', () => {
    expect(stillStretches([say('long')], words)).toEqual(['rule 37: 40 words with nothing new on screen (long)']);
  });
});

describe('a picture that goes with a line is part of saying it', () => {
  it('rules 6 to 11 pass over it: an act still needs its line before and after', () => {
    const steps: Step[] = [say('try.you', true), { k: 'show', v: 'ghost' }, { k: 'act', v: 'serve' }, { k: 'show', v: 'ticks' }, say('fair')];
    expect(scriptProblems({ steps, announces: /^try\./ })).toEqual([]);
    expect(scriptProblems({ steps: [say('fair'), { k: 'show', v: 'ghost' }, { k: 'act', v: 'serve' }, say('fair')], announces: /^try\./ })[0]).toMatch(/^rule 6/);
  });
});

describe('the lesson player times pictures to the narrator', () => {
  const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
  it('by the clip\'s own clock, else the lesson\'s, and waits for every picture before the next line', () => {
    const s = src('./BeatEpisode.svelte');
    expect(s).toContain('fire(saidSoFar(id) ?? (P.elapsed() - t0) / 1000); await live(sleep(40));');
    expect(s).toMatch(/await live\(whole\);\n\s*fire\(Infinity\);\n\s*await live\(Promise\.all\(acts\)\);/);
    expect(s).toContain('sayWith: (id, cues, n, m, k) => speak(id, cues, n, m, k),');
    expect(src('../../audio/voice.svelte.ts')).toContain("return audio && voiceState.playing === id && !audio.error ? audio.currentTime : null;");
  });
});
