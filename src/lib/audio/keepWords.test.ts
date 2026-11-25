// The counting lesson's count words ("one", "two"...) are said by its world, not as lesson lines, so they were
// left out of the clips a lesson keeps on this computer (keep.ts): with the connection gone the narrator spoke
// and the counting fell silent. The counting kit now lists them, and the lesson player keeps them too.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COUNT_WORDS } from '../content/voice';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

describe("a lesson's count words are kept with it", () => {
  it('the counting kit lists every count word it can say', () => {
    expect(src('../three/countKit.ts')).toMatch(/readonly words = COUNT_WORDS\.map\(l => l\.id\)/);
    expect(COUNT_WORDS.map(l => l.id)).toEqual(Array.from({ length: 20 }, (_, i) => `n.${i + 1}`));
  });
  it("the lesson player keeps its world's words once the world is made, and lets them go at the end", () => {
    const ep = src('../math/beats/BeatEpisode.svelte');
    expect(ep).toMatch(/const wd = await L\.world\(s\);\n\s*\/\/[^\n]*\n\s*letGoWords = keepWords\(wd\.words \?\? \[\]\);/);
    expect(ep).toContain('letGo(); letGoWords();');
  });
  it('nothing is fetched with the voice off, or with no words', () => {
    const v = src('./voice.svelte.ts');
    expect(v).toMatch(/export function keepWords\(ids: readonly string\[\]\): \(\) => void \{\n\s*if \(game\.settings\.voice === false \|\| !ids\.length\) return \(\) => \{\};/);
  });
});
