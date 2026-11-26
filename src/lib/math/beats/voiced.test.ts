// Every line the beat lessons speak has its clip, and every clip fits the time the player gives its line.
// The player (BeatEpisode.svelte) holds a line for at most 2.5 s + 95 ms a letter of the words shown, then
// moves on, and the next line stops a clip still playing: a clip longer than that is cut off mid-sentence.
import { describe, expect, it } from 'vitest';
import { BEAT_LINES, COUNT_WORDS, EQ_LINES } from '../../content/voice';
import manifest from '../../content/voice-manifest.json';

const made = manifest as Record<string, { voice: string; ms: number }>;
/** the shortest the player can hold a line: each {n}, {m} or {k} shown as a one-digit number */
const hold = (text: string) => 2500 + text.replace(/\{[nmk]\}/g, '7').length * 95;
const LESSONS = /^ep\.(crate|count|share|eq|ten)\./;
const lines = [...BEAT_LINES, ...EQ_LINES].filter(l => LESSONS.test(l.id));

describe('the beat lessons are voiced', () => {
  it('has the lines of all four lessons', () => {
    for (const p of ['crate', 'count', 'share', 'eq', 'ten']) expect(lines.some(l => l.id.startsWith(`ep.${p}.`)), p).toBe(true);
  });

  it('every line and count word has a clip', () => {
    const missing = [...lines, ...COUNT_WORDS].filter(l => !made[l.id]).map(l => l.id);
    expect(missing).toEqual([]);
  });

  it('every clip ends before the player moves on', () => {
    const cut = lines.filter(l => made[l.id] && made[l.id].ms > hold(l.text)).map(l => `${l.id}: ${made[l.id].ms} ms, held ${hold(l.text)} ms`);
    expect(cut).toEqual([]);
  });

  it('a count word ends before the next cookie is counted', () => {
    // the narrator counts a cookie every 0.9 s (countKit demoCount), and the next word stops the one before
    const long = COUNT_WORDS.filter(l => made[l.id] && made[l.id].ms > 850).map(l => `${l.id}: ${made[l.id].ms} ms`);
    expect(long).toEqual([]);
  });
});
