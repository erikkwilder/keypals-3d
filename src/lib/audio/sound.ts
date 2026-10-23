// All sound is made live with Web Audio: no sound files to license or download.

import type { Finger } from '../art/cast';
import type { RegionId } from '../engine/course';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let enabled = true;
let musicOn = true;
let volume = 0.8;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = musicOn ? 0.32 : 0;
    musicBus.connect(master);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function configureSound(o: { sound: boolean; music: boolean; volume: number }) {
  enabled = o.sound;
  musicOn = o.music;
  volume = o.volume;
  if (master) master.gain.value = enabled ? volume : 0;
  if (musicBus && ctx) musicBus.gain.setTargetAtTime(musicOn && enabled ? 0.32 : 0, ctx.currentTime, 0.2);
}

/** Browsers only allow audio after a key press or click; call this from one. */
export function unlockAudio() { ac(); }

type ToneOpts = { type?: OscillatorType; dur?: number; gain?: number; attack?: number; slideTo?: number; delay?: number; bus?: GainNode | null; detune?: number };

function tone(freq: number, o: ToneOpts = {}) {
  const c = ac();
  if (!c || !enabled) return;
  const t0 = c.currentTime + (o.delay ?? 0);
  const dur = o.dur ?? 0.15;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (o.detune) osc.detune.value = o.detune;
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
  const peak = o.gain ?? 0.2;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(o.bus ?? sfxBus!);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur: number, o: { gain?: number; freq?: number; q?: number; delay?: number; sweepTo?: number } = {}) {
  const c = ac();
  if (!c || !enabled) return;
  const t0 = c.currentTime + (o.delay ?? 0);
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 2000, t0);
  if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t0 + dur);
  f.Q.value = o.q ?? 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(o.gain ?? 0.15, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(sfxBus!);
  src.start(t0);
}

// pentatonic scale, C major
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
const FINGER_NOTE: Record<Finger, number> = { LP: 0, LR: 1, LM: 2, LI: 3, TH: 4, RI: 5, RM: 6, RR: 7, RP: 8 };

export const sfx = {
  key(finger: Finger | null) {
    const n = PENTA[FINGER_NOTE[finger ?? 'TH']] ?? 440;
    tone(n * 2, { type: 'triangle', dur: 0.07, gain: 0.05 });
    noise(0.03, { gain: 0.05, freq: 3200, q: 2 });
  },
  miss() {
    tone(220, { type: 'sine', dur: 0.22, gain: 0.12, slideTo: 150 });
    tone(110, { type: 'triangle', dur: 0.18, gain: 0.05 });
  },
  levelUp(tier: number) {
    const base = 4 + tier;
    [0, 1, 2, 3].forEach((i) => tone(PENTA[Math.min(PENTA.length - 1, base - 3 + i)] * 1, { type: 'triangle', dur: 0.22, gain: 0.12, delay: i * 0.07 }));
    tone(PENTA[Math.min(PENTA.length - 1, base + 1)] * 2, { type: 'sine', dur: 0.5, gain: 0.07, delay: 0.3 });
    noise(0.5, { gain: 0.05, freq: 6000, q: 0.8, delay: 0.25, sweepTo: 9000 });
  },
  levelDown() {
    tone(392, { type: 'sine', dur: 0.16, gain: 0.07 });
    tone(330, { type: 'sine', dur: 0.22, gain: 0.07, delay: 0.12 });
  },
  star(i: number) {
    const n = [523.25, 659.25, 783.99][i] ?? 880;
    tone(n, { type: 'triangle', dur: 0.35, gain: 0.14 });
    tone(n * 2, { type: 'sine', dur: 0.5, gain: 0.06, delay: 0.05 });
  },
  badge() {
    tone(783.99, { type: 'sine', dur: 0.12, gain: 0.1 });
    tone(1046.5, { type: 'sine', dur: 0.3, gain: 0.1, delay: 0.08 });
    noise(0.25, { gain: 0.04, freq: 7000, q: 0.7, delay: 0.05 });
  },
  click() { tone(660, { type: 'sine', dur: 0.06, gain: 0.06 }); },
  whoosh() { noise(0.35, { gain: 0.08, freq: 500, sweepTo: 3000, q: 0.8 }); },
  complete() {
    [523.25, 659.25, 783.99, 1046.5].forEach((n, i) => tone(n, { type: 'triangle', dur: 0.3, gain: 0.12, delay: i * 0.1 }));
    tone(1318.5, { type: 'sine', dur: 0.8, gain: 0.08, delay: 0.42 });
  },
  pop() { tone(880, { type: 'sine', dur: 0.08, gain: 0.08, slideTo: 1320 }); },
  /** A treasure appears: a rising run and a shimmer, longer and brighter for better treasures (step 0 to 9). */
  treasure(step: number) {
    const notes = 4 + Math.min(6, Math.floor(step * 0.7));
    for (let i = 0; i < notes; i++) tone(PENTA[Math.min(PENTA.length - 1, i + 2)], { type: 'triangle', dur: 0.2, gain: 0.11, delay: i * 0.06 });
    tone(PENTA[Math.min(PENTA.length - 1, notes + 2)] * 2, { type: 'sine', dur: 0.9, gain: 0.08, delay: notes * 0.06 });
    noise(0.9, { gain: 0.05, freq: 7000, q: 0.6, delay: notes * 0.06, sweepTo: 11000 });
    if (step >= 6) [0, 4, 7].forEach((k, i) => tone(523.25 * Math.pow(2, k / 12), { type: 'sine', dur: 1.1, gain: 0.05, delay: notes * 0.06 + 0.1 + i * 0.02 }));
  },
};

// ---------- melody mode: each right key plays the next note of a tune ----------
const N: Record<string, number> = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99 };
// public-domain tunes
export const TUNES: Record<string, { name: string; notes: string[] }> = {
  twinkle: { name: 'Twinkle, Twinkle', notes: 'C4 C4 G4 G4 A4 A4 G4 F4 F4 E4 E4 D4 D4 C4 G4 G4 F4 F4 E4 E4 D4 G4 G4 F4 F4 E4 E4 D4'.split(' ') },
  ode: { name: 'Ode to Joy', notes: 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4 C4 C4'.split(' ') },
  jacques: { name: 'Frère Jacques', notes: 'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4 E4 F4 G4 G4 A4 G4 F4 E4 C4 G4 A4 G4 F4 E4 C4 C4 G4 C4 C4 G4 C4'.split(' ') },
  lamb: { name: 'Mary Had a Little Lamb', notes: 'E4 D4 C4 D4 E4 E4 E4 D4 D4 D4 E4 G4 G4 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4'.split(' ') },
};
let melodyIdx = 0;
let melodyTune = 'twinkle';
export function resetMelody(tune?: string) { melodyIdx = 0; if (tune) melodyTune = tune; }
export function melodyNote() {
  const t = TUNES[melodyTune];
  const n = N[t.notes[melodyIdx % t.notes.length]];
  melodyIdx++;
  tone(n, { type: 'triangle', dur: 0.32, gain: 0.13 });
  tone(n * 2, { type: 'sine', dur: 0.2, gain: 0.03 });
}

// ---------- background music: a gentle generated loop per region ----------
type MusicStyle = { root: number; scale: number[]; bpm: number; wave: OscillatorType; bassWave: OscillatorType };
const STYLES: Record<RegionId | 'menu', MusicStyle> = {
  menu: { root: 261.63, scale: [0, 2, 4, 7, 9], bpm: 92, wave: 'triangle', bassWave: 'sine' },
  village: { root: 261.63, scale: [0, 2, 4, 7, 9], bpm: 100, wave: 'triangle', bassWave: 'sine' },
  treetops: { root: 293.66, scale: [0, 2, 4, 7, 9], bpm: 104, wave: 'triangle', bassWave: 'sine' },
  burrows: { root: 220.0, scale: [0, 3, 5, 7, 10], bpm: 88, wave: 'sine', bassWave: 'triangle' },
  cliffs: { root: 246.94, scale: [0, 2, 4, 7, 9], bpm: 96, wave: 'triangle', bassWave: 'sine' },
  ridge: { root: 329.63, scale: [0, 2, 4, 7, 11], bpm: 92, wave: 'sine', bassWave: 'sine' },
  shores: { root: 277.18, scale: [0, 2, 4, 7, 9], bpm: 98, wave: 'triangle', bassWave: 'sine' },
  road: { root: 261.63, scale: [0, 2, 4, 5, 7, 9], bpm: 108, wave: 'triangle', bassWave: 'sine' },
};

let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicStyle: MusicStyle | null = null;
let step = 0;
let nextTime = 0;
let pattern: number[] = [];
let energy = 0;

function newPattern() {
  // a singable 16-step phrase that mostly steps between neighbours
  const p: number[] = [];
  let deg = 2;
  for (let i = 0; i < 16; i++) {
    if (i % 4 === 3 && Math.random() < 0.5) { p.push(-1); continue; }
    deg = Math.max(0, Math.min(7, deg + [-1, 1, 0, 2, -2, 1, -1][Math.floor(Math.random() * 7)]));
    p.push(deg);
  }
  pattern = p;
}

function freqFor(st: MusicStyle, deg: number) {
  const s = st.scale;
  const oct = Math.floor(deg / s.length);
  return st.root * Math.pow(2, (s[deg % s.length] + 12 * oct) / 12);
}

function scheduleStep(st: MusicStyle, t: number) {
  const c = ctx!;
  const beat = 60 / st.bpm / 2; // eighth notes
  const i = step % 16;
  const deg = pattern[i];
  const play = (f: number, dur: number, gain: number, type: OscillatorType) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicBus!);
    o.start(t); o.stop(t + dur + 0.05);
  };
  if (deg >= 0 && (i % 2 === 0 || energy > 0.4)) play(freqFor(st, deg), beat * 1.6, 0.09, st.wave);
  if (i % 4 === 0) play(st.root / 2 * (i % 8 === 0 ? 1 : 1.5), beat * 3.6, 0.12, st.bassWave);
  if (energy > 0.15 && i % 2 === 1) {
    // soft shaker
    const len = Math.ceil(c.sampleRate * 0.04), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'highpass'; f.frequency.value = 6000; g.gain.value = 0.05 * Math.min(1, energy);
    src.connect(f); f.connect(g); g.connect(musicBus!); src.start(t);
  }
  step++;
  if (step % 32 === 0) newPattern();
}

export function startMusic(region: RegionId | 'menu') {
  const c = ac();
  if (!c) return;
  const st = STYLES[region];
  if (musicStyle === st && musicTimer) return;
  stopMusic();
  musicStyle = st;
  step = 0;
  newPattern();
  nextTime = c.currentTime + 0.1;
  musicTimer = setInterval(() => {
    if (!ctx || !musicStyle) return;
    const beat = 60 / musicStyle.bpm / 2;
    while (nextTime < ctx.currentTime + 0.25) { scheduleStep(musicStyle, nextTime); nextTime += beat; }
  }, 60);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  musicStyle = null;
}

/** 0..1, how lively the music should be (follows the ride). */
export function musicEnergy(e: number) { energy = e; }
