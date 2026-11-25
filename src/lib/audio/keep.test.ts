// A Learn lesson's spoken clips are kept on this computer while it plays (keep.ts), so the narrator still
// speaks when the connection drops partway. A stand-in network and Audio: nothing goes over the wire.
import { existsSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ALL_LINES } from '../content/voice';
import { keepClips, keptUrl, lessonClips } from './keep';

/** a stand-in fetch: each answer takes a moment; `down` is the connection gone, `gone` files that aren't there */
function network(o: { down?: () => boolean; gone?: string[] } = {}) {
  const asked: string[] = [];
  let open = 0, most = 0;
  const fetch = async (url: string, init?: RequestInit) => {
    asked.push(url); open++; most = Math.max(most, open);
    try {
      await new Promise(r => setTimeout(r, 1));
      if (init?.signal?.aborted) throw new DOMException('The lesson ended', 'AbortError');
      if (o.down?.()) throw new TypeError('Failed to fetch');
      if (o.gone?.some(g => url.endsWith(`/${g}.mp3`))) return new Response('', { status: 404 });
      return new Response(new Blob([url], { type: 'audio/mpeg' }));
    } finally { open--; }
  };
  return { fetch, asked, most: () => most };
}
function blobs(tag = 'kept') {
  let n = 0;
  const revoked: string[] = [];
  return { toUrl: () => `blob:${tag}-${++n}`, revoke: (u: string) => { revoked.push(u); }, revoked };
}

describe('which clips a lesson keeps', () => {
  it('Count On with a kid-c buddy: its own lines and its buddy\'s for it first, then the ones every episode says', () => {
    const ids = lessonClips(ALL_LINES, { keys: ['count-on'], voice: 'kid-c', shared: true });
    const own = ['ep.count-on.intro', 'ep.count-on.s0', 'ep.count-on.s1', 'ep.count-on.s2', 'ep.count-on.s3', 'ep.count-on.card', 'bv.kid-c.count-on.try', 'bv.kid-c.count-on.fixed'];
    const shared = ['ep.teach', 'ep.fix', 'ep.fixed', 'ep.again', 'ep.turn', 'ep.turn2', 'ep.check', 'ep.checked', 'ep.tomorrow',
      'bv.kid-c.praise0', 'bv.kid-c.praise1', 'bv.kid-c.praise2', 'bv.kid-c.praise3', 'bv.kid-c.praise4', 'bv.kid-c.miss', 'bv.kid-c.show'];
    expect([...ids.slice(0, own.length)].sort()).toEqual([...own].sort());
    expect([...ids].sort()).toEqual([...own, ...shared].sort());
  });
  it('a beat lesson (Layers of Cubes): only its own lines, all 66', () => {
    const ids = lessonClips(ALL_LINES, { keys: ['crate'] });
    expect(ids).toHaveLength(66);
    expect(ids.every(id => id.startsWith('ep.crate.'))).toBe(true);
  });
  it('every clip they keep is a real file', () => {
    for (const ids of [lessonClips(ALL_LINES, { keys: ['count-on'], voice: 'kid-a', shared: true }), lessonClips(ALL_LINES, { keys: ['crate'] })])
      for (const id of ids) expect(existsSync(new URL(`../../../public/voice/${id}.mp3`, import.meta.url)), id).toBe(true);
  });
  it('not a line shown only as words, another buddy\'s, nor a lesson whose name only starts the same', () => {
    const lines = [
      { id: 'ep.hop.intro', voice: 'coach' }, { id: 'ep.hop.s0', voice: 'monkey' }, { id: 'ep.hop-far.intro', voice: 'coach' },
      { id: 'bv.kid-a.hop.try', voice: 'kid-a' }, { id: 'bv.kid-b.hop.try', voice: 'kid-b' }, { id: 'bv.kid-a.miss', voice: 'kid-a' },
    ];
    expect(lessonClips(lines, { keys: ['hop'], voice: 'kid-a' })).toEqual(['ep.hop.intro', 'bv.kid-a.hop.try']);
    expect(lessonClips(lines, { keys: ['hop'], voice: 'kid-a', shared: true })).toEqual(['ep.hop.intro', 'bv.kid-a.hop.try', 'bv.kid-a.miss']);
  });
});

describe('keeping them', () => {
  it('fetches each once, two at a time, and keeps what came', async () => {
    const net = network({ gone: ['b'] }), b = blobs();
    const k = keepClips(['a', 'b', 'c', 'a', 'd'], { ...net, ...b, win: null });
    expect(keptUrl('a')).toBeNull();
    await k.settled;
    expect(net.asked).toEqual(['voice/a.mp3', 'voice/b.mp3', 'voice/c.mp3', 'voice/d.mp3']);
    expect(net.most()).toBe(2);
    expect(['a', 'b', 'c', 'd'].map(keptUrl)).toEqual(['blob:kept-1', null, 'blob:kept-2', 'blob:kept-3']);
    k.release();
    expect(b.revoked).toEqual(['blob:kept-1', 'blob:kept-2', 'blob:kept-3']);
    expect(keptUrl('a')).toBeNull();
  });
  it('the ones that failed with the connection are fetched again when it comes back', async () => {
    let down = true;
    const win = new EventTarget() as EventTarget & Window;
    const net = network({ down: () => down }), b = blobs();
    const k = keepClips(['a', 'b'], { ...net, ...b, win });
    await k.settled;
    expect(keptUrl('a')).toBeNull();
    down = false;
    win.dispatchEvent(new Event('online'));
    await k.settled;
    expect([keptUrl('a'), keptUrl('b')]).toEqual(['blob:kept-1', 'blob:kept-2']);
    k.release();
    // let go: the connection coming back fetches nothing more
    const before = net.asked.length;
    win.dispatchEvent(new Event('online'));
    await k.settled;
    expect(net.asked.length).toBe(before);
  });
  it('a lesson that ends stops fetching and keeps nothing', async () => {
    const net = network(), b = blobs();
    const k = keepClips(['a', 'b', 'c', 'd'], { ...net, ...b, win: null });
    k.release();
    await k.settled;
    expect(net.asked.length).toBeLessThanOrEqual(2);
    expect(['a', 'b', 'c', 'd'].map(keptUrl)).toEqual([null, null, null, null]);
    expect(b.revoked).toEqual([]);
  });
  it('as one lesson closes and the next opens, the newer copy plays', async () => {
    const one = keepClips(['a'], { ...network(), ...blobs('one'), win: null });
    const two = keepClips(['a'], { ...network(), ...blobs('two'), win: null });
    await Promise.all([one.settled, two.settled]);
    expect(keptUrl('a')).toBe('blob:two-1');
    two.release();
    expect(keptUrl('a')).toBe('blob:one-1');
    one.release();
    expect(keptUrl('a')).toBeNull();
  });
});

describe('say() plays the kept copy, and the network when there isn\'t one', () => {
  const els: FakeAudio[] = [];
  class FakeAudio {
    paused = true; ended = false; volume = 1; onended: (() => void) | null = null; onerror: (() => void) | null = null;
    constructor(public src = '') { els.push(this); }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  let voice: typeof import('./voice.svelte');
  beforeAll(async () => {
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
    vi.stubGlobal('Audio', FakeAudio);
    voice = await import('./voice.svelte');
  });
  afterAll(() => { vi.unstubAllGlobals(); });

  it('kept: the copy on this computer; not kept, or let go: the network', async () => {
    const k = keepClips(['coach.nice'], { ...network(), toUrl: () => 'blob:nice', revoke: () => {}, win: null });
    await k.settled;
    void voice.say('coach.nice');
    expect(els.at(-1)!.src).toBe('blob:nice');
    void voice.say('coach.great');
    expect(els.at(-1)!.src).toBe('voice/coach.great.mp3');
    k.release();
    void voice.say('coach.nice');
    expect(els.at(-1)!.src).toBe('voice/coach.nice.mp3');
    voice.hush();
  });
  it('a clip that fails offline is tried again once the connection is back; one that fails online is missing', () => {
    vi.stubGlobal('navigator', { onLine: false });
    void voice.say('coach.perfect');
    const first = els.at(-1)!;
    first.onerror!();
    vi.stubGlobal('navigator', { onLine: true });
    void voice.say('coach.perfect');
    const second = els.at(-1)!;
    expect(second).not.toBe(first);
    second.onerror!();
    const count = els.length;
    void voice.say('coach.perfect');
    expect(els.length).toBe(count);
    voice.hush();
  });
});

describe('the lesson players keep their clips', () => {
  const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
  it.each([
    ['../math/ui/EpisodeClassic.svelte', 'keepLesson({ keys: [voiceId, id], buddy, shared: true })'],
    ['../math/measure/MeasureEpisode.svelte', 'keepLesson({ keys: [L.id], buddy, shared: true })'],
    ['../math/beats/BeatEpisode.svelte', 'keepLesson({ keys: [L.voice ?? L.id] })'],
  ])('%s: when it opens, and lets them go when it closes', (file, call) => {
    const s = src(file);
    const mount = s.slice(s.indexOf('onMount(() => {'), s.indexOf('onDestroy(() => {'));
    expect(mount).toContain(`letGo = ${call};`);
    expect(s.slice(s.indexOf('onDestroy(() => {')).split('});')[0]).toContain('letGo();');
  });
});
