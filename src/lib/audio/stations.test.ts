import { describe, expect, it } from 'vitest';
import { AUTO, STATIONS, knownChoice } from './stations';

describe('music stations', () => {
  it('only the music the game makes itself: no recordings on any station', () => {
    // the 140 tracks licensed from Envato Elements came out on 26 Nov 2026 (that licence holds only for a product
    // finished while the subscription lasts); recordings come back only with a licence that is clear
    expect(STATIONS.map(s => s.id)).toEqual(['originals']);
    for (const s of STATIONS) expect(s.tracks).toHaveLength(0);
  });
  it('Auto plays Keypals Originals in every place', () => {
    for (const id of Object.values(AUTO)) expect(id).toBe('originals');
  });
  it('a saved choice of a station that is gone plays as Auto, and a real one as itself', () => {
    for (const old of ['calm', 'happy', 'pop', 'dance', 'storybook', 'snow', 'adventure', 'rock', 'electronic', 'retro', 'beats', 'funk', 'hiphop', 'world']) expect(knownChoice(old)).toBe('auto');
    for (const odd of [undefined, null, 3, '', 'toString', 'constructor', '__proto__']) expect(knownChoice(odd)).toBe('auto');
    for (const id of ['auto', 'originals']) expect(knownChoice(id)).toBe(id);
  });
});
