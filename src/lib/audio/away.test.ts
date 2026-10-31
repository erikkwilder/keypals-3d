// The game goes quiet when it is put away (a tab hidden, a phone locked, a lid closed), and only what was
// playing comes back. The browser here is a small stand-in: the real sound code runs against it.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

class Param { value = 0; setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} setTargetAtTime() {} cancelScheduledValues() {} }
class Node_ {
  gain = new Param(); frequency = new Param(); detune = new Param(); Q = new Param(); playbackRate = new Param(); delayTime = new Param();
  type = ''; buffer: unknown = null; loop = false;
  connect() { return this; } disconnect() {} stop() {}
  start() { started.push(this); }
}
/** every sound started */
const started: Node_[] = [];
class Ctx extends EventTarget {
  state = 'running'; currentTime = 1; sampleRate = 8000; destination = new Node_();
  suspends = 0; resumes = 0;
  constructor() { super(); ctxs.push(this); }
  createGain() { return new Node_(); } createOscillator() { return new Node_(); } createBufferSource() { return new Node_(); }
  createBiquadFilter() { return new Node_(); } createDelay() { return new Node_(); } createMediaElementSource() { return new Node_(); }
  createBuffer() { return { getChannelData: () => new Float32Array(4) }; }
  async suspend() { this.suspends++; this.state = 'suspended'; }
  async resume() { this.resumes++; this.state = 'running'; }
}
const ctxs: Ctx[] = [];
const els: FakeAudio[] = [];
class FakeAudio {
  paused = true; ended = false; src = ''; preload = ''; volume = 1; currentTime = 0; onended: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor() { els.push(this); }
  addEventListener() {} removeAttribute() {} load() {}
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}
const win = new EventTarget() as EventTarget & { AudioContext: typeof Ctx };
const doc = new EventTarget() as EventTarget & { visibilityState: string };
win.AudioContext = Ctx;
doc.visibilityState = 'visible';

let snd: typeof import('./sound');
let voice: typeof import('./voice.svelte');
let line: string;
const music = () => els.filter(e => e.preload === 'auto').at(-1)!;
function hide() { doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); }
function show() { doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange')); }
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('Audio', FakeAudio);
  snd = await import('./sound');
  voice = await import('./voice.svelte');
  line = (await import('../content/voice')).ALL_LINES.find(l => l.voice === 'coach')!.id;
  snd.configureSound({ sound: true, music: true, volume: 0.8 });
  snd.startMusic('menu');
});
afterAll(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
beforeEach(async () => {
  show();
  snd.configureSound({ sound: true, music: true, volume: 0.8 });
  await settle();
});

describe('put away, the game goes quiet', () => {
  it('hidden: the song pauses and the sound stops at once; back: it carries on', async () => {
    expect(music().paused).toBe(false);
    const c = ctxs[0], s0 = c.suspends;
    hide();
    expect(music().paused).toBe(true);
    expect(c.suspends).toBe(s0 + 1);
    expect(c.state).toBe('suspended');
    show();
    await settle();
    expect(music().paused).toBe(false);
    expect(c.state).toBe('running');
  });
  it('the phone being put away (pagehide) and a frozen page do the same', async () => {
    for (const [target, ev] of [[win, 'pagehide'], [doc, 'freeze']] as const) {
      target.dispatchEvent(new Event(ev));
      expect(music().paused, ev).toBe(true);
      expect(ctxs[0].state, ev).toBe('suspended');
      target.dispatchEvent(new Event(ev === 'pagehide' ? 'pageshow' : 'resume'));
      await settle();
      expect(music().paused, ev).toBe(false);
    }
  });
  it('nothing starts while away: no effect, no wake-up, no settings change, no new song', async () => {
    hide();
    const n = started.length, r = ctxs[0].resumes;
    snd.sfx.click(); snd.sfx.complete();
    snd.unlockAudio();
    snd.configureSound({ sound: true, music: true, volume: 0.5 });
    snd.startMusic('adventure');
    win.dispatchEvent(new Event('pointerdown'));
    await settle();
    expect(started.length).toBe(n);
    expect(ctxs[0].resumes).toBe(r);
    expect(music().paused).toBe(true);
    // (back: the music for where the game is now)
    show();
    await settle();
    expect(music().paused).toBe(false);
    snd.startMusic('menu');
    await vi.advanceTimersByTimeAsync(2000);
  });
  it('the music only comes back if it was playing: turned off before, it stays off', async () => {
    snd.configureSound({ sound: true, music: false, volume: 0.8 });
    expect(music().paused).toBe(true);
    hide();
    show();
    await settle();
    expect(music().paused).toBe(true);
  });
  it('a song turned off is not started by coming back, even if it played before the game went away', async () => {
    hide();
    snd.configureSound({ sound: true, music: false, volume: 0.8 });
    show();
    await settle();
    expect(music().paused).toBe(true);
  });
  it('a spoken line pauses part-way and finishes when the game is back', async () => {
    let done = false;
    void voice.say(line).then(() => (done = true));
    const a = els.at(-1)!;
    expect(a.paused).toBe(false);
    hide();
    expect(a.paused).toBe(true);
    await settle();
    expect(done).toBe(false);
    show();
    expect(a.paused).toBe(false);
    a.onended?.();
    await settle();
    expect(done).toBe(true);
  });
  it('a line asked for while away waits, and one already finished is not said again', async () => {
    hide();
    void voice.say(line);
    const a = els.at(-1)!;
    expect(a.paused).toBe(true);
    show();
    expect(a.paused).toBe(false);
    a.ended = true; a.paused = true; a.onended?.();
    hide();
    show();
    expect(a.paused).toBe(true);
  });
  it('a lid closed with no event: the clock notices the jump in time, and a tap brings the sound back', async () => {
    await vi.advanceTimersByTimeAsync(2000);
    expect(music().paused).toBe(false);
    // the machine sleeps for ten minutes: no timers run, then the clock has jumped
    vi.setSystemTime(Date.now() + 10 * 60000);
    await vi.advanceTimersByTimeAsync(1100);
    expect(music().paused).toBe(true);
    expect(ctxs[0].state).toBe('suspended');
    // nothing comes back by itself: nobody may be there
    await vi.advanceTimersByTimeAsync(5000);
    expect(music().paused).toBe(true);
    win.dispatchEvent(new Event('pointerdown'));
    await settle();
    expect(music().paused).toBe(false);
    expect(ctxs[0].state).toBe('running');
  });
  it('a slow moment is not a sleep: a few seconds\' stall keeps the music going', async () => {
    await vi.advanceTimersByTimeAsync(2000);
    vi.setSystemTime(Date.now() + 6000);
    await vi.advanceTimersByTimeAsync(1100);
    expect(music().paused).toBe(false);
  });
  it('a phone call: the sound says "interrupted", the song pauses, and it carries on when the call ends', async () => {
    const c = ctxs[0];
    c.state = 'interrupted';
    c.dispatchEvent(new Event('statechange'));
    expect(music().paused).toBe(true);
    c.state = 'running';
    c.dispatchEvent(new Event('statechange'));
    await settle();
    expect(music().paused).toBe(false);
  });
});
