// The pictures a lesson or a practice needs before the connection may drop (ui/warm.ts).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FRIEND } from '../art/cast';
import { PAD, buddyPics, warm } from './warm';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
const file = (u: string) => new URL(`../../../public${u}`, import.meta.url);

describe('which pictures', () => {
  it("the number pad's: every picture on its keys", () => {
    const icons = [...src('../math/ui/NumPad.svelte').matchAll(/<Icon name="([a-z]+)"/g)].map(m => m[1]);
    expect(icons).toEqual(['erase']);
    expect(PAD).toEqual(['/icons/erase.webp']);
    expect(src('../math/ui/NumPad.svelte')).not.toMatch(/<img /);
  });
  it("a buddy's: the whole one and its head, as Critter asks for them, for every buddy", () => {
    expect(src('./Critter.svelte')).toContain("portraits/${FRIEND[friend]?.id ?? 'dino'}${round ? '-head' : ''}.png");
    expect(buddyPics('dino')).toEqual(['/portraits/dino.png', '/portraits/dino-head.png']);
    for (const id of Object.keys(FRIEND)) for (const u of buddyPics(id)) expect(existsSync(file(u)), u).toBe(true);
  });
  it('only a few: under 0.4 MB for any buddy, the erase key included', () => {
    const bytes = (us: string[]) => us.reduce((n, u) => n + statSync(file(u)).size, 0);
    for (const id of Object.keys(FRIEND)) expect(bytes([...PAD, ...buddyPics(id)]), id).toBeLessThan(400_000);
  });
});

describe('keeping them', () => {
  it('loads each once and keeps it with the page', () => {
    const made: { src: string; decoding: string }[] = [];
    const make = () => { const im = { src: '', decoding: '' }; made.push(im); return im as unknown as HTMLImageElement; };
    expect(warm(['/a.png', '/b.png', '/a.png'], make)).toEqual(['/a.png', '/b.png']);
    expect(made.map(m => m.src)).toEqual(['/a.png', '/b.png']);
    expect(made.every(m => m.decoding === 'async')).toBe(true);
    // (the same buddy again, or the pad's picture with a new buddy's: only what's new)
    expect(warm(['/a.png', '/c.png'], make)).toEqual(['/c.png']);
    expect(made).toHaveLength(3);
  });
  it('the game warms them once it is up and quiet, and again for a new buddy', () => {
    const app = src('../../App.svelte');
    expect(app).toContain("import { PAD, buddyPics, warmWhenIdle } from './lib/ui/warm';");
    expect(app).toContain('const buddyNow = $derived(game.profile?.buddy);');
    expect(app).toContain('$effect(() => { const b = buddyNow; untrack(() => warmWhenIdle([...PAD, ...(b ? buddyPics(b) : [])])); });');
  });
});
