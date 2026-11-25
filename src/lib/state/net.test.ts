// When the connection goes, a small note says so and the game carries on; it goes when the connection is back
// (net.svelte.ts, ui/NetNote.svelte). The browser's offline and online, and the requests the game makes
// anyway, against a stand-in window and network.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Profile } from '../engine/profile';
import { keepClips } from '../audio/keep';
import { net, requestAnswered, requestFailed, watchNet } from './net.svelte';

const NOTE = 'No internet right now. Keep playing: your progress is kept on this computer.';

describe('when the connection is gone', () => {
  it('the browser says so: offline, then online', () => {
    const win = new EventTarget() as EventTarget & Window;
    const stop = watchNet(win, { onLine: true });
    expect(net.down).toBe(false);
    win.dispatchEvent(new Event('offline'));
    expect(net.down).toBe(true);
    win.dispatchEvent(new Event('online'));
    expect(net.down).toBe(false);
    stop();
    win.dispatchEvent(new Event('offline'));
    expect(net.down).toBe(false);
  });
  it('already offline when the game starts', () => {
    const stop = watchNet(new EventTarget() as EventTarget & Window, { onLine: false });
    expect(net.down).toBe(true);
    stop(); net.down = false;
  });
  it('a request fails on the way, and any answer brings it back; a request stopped on purpose says nothing', () => {
    requestFailed(new TypeError('Failed to fetch'));
    expect(net.down).toBe(true);
    requestAnswered();
    expect(net.down).toBe(false);
    requestFailed(new DOMException('The lesson ended', 'AbortError'));
    expect(net.down).toBe(false);
  });
  it('a lesson\'s clips tell it: failed on the way, or answered', async () => {
    let down = true;
    const fetch = async () => { if (down) throw new TypeError('Failed to fetch'); return new Response(new Blob(['x'])); };
    const win = new EventTarget() as EventTarget & Window;
    const k = keepClips(['a'], { fetch, toUrl: () => 'blob:a', revoke: () => {}, win, answered: requestAnswered, failed: requestFailed });
    await k.settled;
    expect(net.down).toBe(true);
    down = false;
    win.dispatchEvent(new Event('online'));
    await k.settled;
    expect(net.down).toBe(false);
    k.release();
  });
});

describe('saving online while it\'s gone', () => {
  let cloudMod: typeof import('./cloud.svelte');
  beforeAll(async () => { cloudMod = await import('./cloud.svelte'); });
  afterAll(() => { vi.unstubAllGlobals(); net.down = false; });
  it('a request to save fails on the way: the note shows; an answer: it goes', async () => {
    vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch'); });
    await expect(cloudMod.call('/player')).rejects.toThrow('Failed to fetch');
    expect(net.down).toBe(true);
    vi.stubGlobal('fetch', async () => new Response('{"error":"no"}', { status: 500 }));
    await expect(cloudMod.call('/player')).rejects.toThrow('no');
    expect(net.down).toBe(false);
  });
  it('the save chip agrees: a player saved online is saved on this computer for now', () => {
    cloudMod.cloud.online = true;
    const online = { cloud: { code: 'bee-kite-74', at: 1 } } as unknown as Profile, here = {} as Profile;
    net.down = false;
    expect(cloudMod.saveStatus(online)).toEqual({ kind: 'code', text: 'Saved online with a save code', short: 'Saved online' });
    net.down = true;
    expect(cloudMod.saveStatus(online)).toEqual({ kind: 'code', text: 'No internet: saved on this computer for now', short: 'Saved here for now' });
    // only on this computer anyway: the same words as before
    expect(cloudMod.saveStatus(here).text).toBe('Only on this computer: keep your progress safe');
    net.down = false;
  });
});

describe('the note', () => {
  const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
  it('says it in these words, to a screen reader too, and lets taps through', () => {
    const s = src('../ui/NetNote.svelte');
    expect(s).toContain(`{#if net.down}<p>${NOTE}</p>{/if}`);
    expect(s).toContain('<div class="net" role="status">');
    expect(s).toMatch(/\.net \{[^}]*pointer-events: none/);
    expect(s).toContain('onMount(() => watchNet())');
  });
  it('is on every screen', () => {
    expect(src('../../App.svelte')).toContain('  <NetNote />\n');
  });
});
