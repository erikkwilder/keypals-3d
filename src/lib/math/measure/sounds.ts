// The sounds of the measuring area that the shared sound box doesn't have: a clock's tick and tock as a
// hand moves, a ratchet of gears, a chime when a clock is set right, a cuckoo, water pouring, and a toy
// train's whistle. Made the same way as the game's own (little synth notes and filtered noise), on their
// own small audio graph, following the player's sound switch and volume.
import { game } from '../../state/game.svelte';
import { onPageAway, pageAway } from '../../audio/away';

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
// (quiet when the game is put away, like every other sound: audio/away.ts)
onPageAway({
  away() { if (ctx?.state === 'running') void ctx.suspend(); },
  back() { if (ctx?.state === 'suspended') void ctx.resume(); },
});
function ac(): AudioContext | null {
  const s = game.settings;
  if (s.sound === false || pageAway()) return null;
  try {
    if (!ctx) { ctx = new AudioContext(); out = ctx.createGain(); out.connect(ctx.destination); }
    if (ctx.state === 'suspended') void ctx.resume();
    out!.gain.value = (s.volume ?? 0.8) * 0.9;
    return ctx;
  } catch { return null; }
}
type T = { type?: OscillatorType; dur?: number; gain?: number; delay?: number; slideTo?: number; attack?: number };
function tone(freq: number, o: T = {}) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + (o.delay ?? 0), dur = o.dur ?? 0.12;
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type ?? 'sine'; osc.frequency.setValueAtTime(freq, t0);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(o.gain ?? 0.1, t0 + (o.attack ?? 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(out!); osc.start(t0); osc.stop(t0 + dur + 0.05);
}
function noise(dur: number, o: { gain?: number; freq?: number; q?: number; delay?: number; sweepTo?: number; attack?: number } = {}) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + (o.delay ?? 0);
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(o.freq ?? 1200, t0); f.Q.value = o.q ?? 1;
  if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t0 + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(o.gain ?? 0.08, t0 + (o.attack ?? 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(out!); src.start(t0); src.stop(t0 + dur + 0.02);
}
let lastTick = 0, odd = false;
export const mSfx = {
  /** a hand moves a step: tick, tock (never more than one every 45 ms, so a fast drag stays soft) */
  tick() {
    const now = performance.now(); if (now - lastTick < 45) return; lastTick = now; odd = !odd;
    tone(odd ? 2400 : 1900, { type: 'square', dur: 0.025, gain: 0.025 }); noise(0.02, { gain: 0.05, freq: odd ? 5200 : 4200, q: 6 });
  },
  /** gears turning: a little ratchet */
  gears() { for (let i = 0; i < 4; i++) noise(0.025, { gain: 0.05, freq: 3000 + i * 300, q: 8, delay: i * 0.05 }); },
  /** set right: a clock's bright two-bell chime */
  chime() { tone(1568, { dur: 0.5, gain: 0.08, type: 'triangle' }); tone(2093, { dur: 0.7, gain: 0.07, type: 'sine', delay: 0.12 }); tone(3136, { dur: 0.4, gain: 0.03, delay: 0.12 }); },
  /** the cuckoo: two soft falling notes */
  cuckoo() { tone(880, { dur: 0.18, gain: 0.09, type: 'triangle', slideTo: 860 }); tone(698, { dur: 0.26, gain: 0.09, type: 'triangle', delay: 0.22, slideTo: 680 }); },
  /** water pouring (a short glug when `short`) */
  pour(short = false) { noise(short ? 0.18 : 0.6, { gain: 0.05, freq: 700, sweepTo: 1400, q: 1.4, attack: 0.05 }); tone(320, { dur: 0.08, gain: 0.03, delay: 0.05, slideTo: 520 }); },
  /** the toy train's whistle */
  whistle() { tone(1046, { dur: 0.45, gain: 0.05, type: 'triangle', attack: 0.04 }); tone(1318, { dur: 0.45, gain: 0.04, type: 'triangle', attack: 0.04 }); noise(0.4, { gain: 0.03, freq: 2400, q: 3, attack: 0.05 }); },
  /** a clock ticking past its time: an alarm's quick double ring */
  ring() { for (let i = 0; i < 6; i++) tone(i % 2 ? 1760 : 1975, { dur: 0.05, gain: 0.04, type: 'square', delay: i * 0.06 }); },
  /** a thud on the scale's pan */
  thud() { tone(140, { dur: 0.16, gain: 0.12, slideTo: 80 }); noise(0.06, { gain: 0.05, freq: 400, q: 1 }); },
};
