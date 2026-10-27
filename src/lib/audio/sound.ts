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

// ---------- background music: generated live, in a key of each region's own and a style you pick ----------
type RegionKey = { root: number; scale: number[]; bpm: number };
const KEYS: Record<RegionId | 'menu', RegionKey> = {
  menu: { root: 261.63, scale: [0, 2, 4, 7, 9], bpm: 92 },
  village: { root: 261.63, scale: [0, 2, 4, 7, 9], bpm: 100 },
  treetops: { root: 293.66, scale: [0, 2, 4, 7, 9], bpm: 104 },
  burrows: { root: 220.0, scale: [0, 3, 5, 7, 10], bpm: 88 },
  cliffs: { root: 246.94, scale: [0, 2, 4, 7, 9], bpm: 96 },
  ridge: { root: 329.63, scale: [0, 2, 4, 7, 11], bpm: 92 },
  shores: { root: 277.18, scale: [0, 2, 4, 7, 9], bpm: 98 },
  road: { root: 261.63, scale: [0, 2, 4, 5, 7, 9], bpm: 108 },
};

export type MusicStyleId = 'sunny' | 'adventure' | 'dreamy' | 'arcade' | 'chill';
type Drums = 'shaker' | 'band' | 'chip' | 'soft' | 'none';
type Flavour = {
  name: string;
  /** tempo against the region's own */
  pace: number;
  /** its own scale (the region's key still sets the pitch), or the region's */
  scale?: number[];
  lead: OscillatorType; leadGain: number; leadUp: number; leadLen: number;
  /** a lowpass on the lead (Hz), to soften bright waves */
  leadTone?: number;
  bass: OscillatorType; bassGain: number; bassDrive?: boolean;
  drums: Drums;
  /** chord roots (scale steps) for each bar of four */
  chords: number[];
  pad?: OscillatorType; arp?: boolean;
  /** echo on the lead: feedback 0..1 */
  echo?: number;
  /** late off-beats, for a laid-back feel (0..0.3 of an eighth) */
  swing?: number;
};
export const MUSIC_STYLES: Record<MusicStyleId, Flavour> = {
  // the first one, as it was
  sunny: { name: 'Sunny', pace: 1, lead: 'triangle', leadGain: 0.09, leadUp: 1, leadLen: 1.6, bass: 'sine', bassGain: 0.12, drums: 'shaker', chords: [0, 0, 0, 0] },
  adventure: { name: 'Adventure', pace: 1.2, scale: [0, 2, 4, 5, 7, 9, 10], lead: 'sawtooth', leadGain: 0.05, leadUp: 1, leadLen: 1.3, leadTone: 2200, bass: 'sawtooth', bassGain: 0.07, bassDrive: true, drums: 'band', chords: [0, 6, 3, 4], echo: 0.18 },
  dreamy: { name: 'Dreamy', pace: 0.72, scale: [0, 2, 4, 6, 7, 9, 11], lead: 'sine', leadGain: 0.08, leadUp: 2, leadLen: 3.5, bass: 'sine', bassGain: 0.08, drums: 'none', chords: [0, 3, 5, 4], pad: 'triangle', echo: 0.45 },
  arcade: { name: 'Arcade', pace: 1.3, lead: 'square', leadGain: 0.04, leadUp: 2, leadLen: 0.9, leadTone: 3500, bass: 'square', bassGain: 0.05, bassDrive: true, drums: 'chip', chords: [0, 3, 4, 3], arp: true },
  chill: { name: 'Chill', pace: 0.85, scale: [0, 3, 5, 7, 10], lead: 'triangle', leadGain: 0.07, leadUp: 1, leadLen: 2.2, leadTone: 1600, bass: 'sine', bassGain: 0.11, drums: 'soft', chords: [0, 3, 2, 4], pad: 'sine', echo: 0.3, swing: 0.28 },
};
let musicChoice: MusicStyleId | 'mix' = 'sunny';

type Playing = { key: RegionKey; f: Flavour; scale: number[]; region: RegionId | 'menu' };
let musicTimer: ReturnType<typeof setInterval> | null = null;
let playing: Playing | null = null;
let step = 0;
let nextTime = 0;
let pattern: number[] = [];
let energy = 0;
let echoIn: GainNode | null = null;
let echoLevel = 0;

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

function freqOf(pl: Playing, deg: number) {
  const s = pl.scale, n = s.length;
  const oct = Math.floor(deg / n), k = ((deg % n) + n) % n;
  return pl.key.root * Math.pow(2, (s[k] + 12 * oct) / 12);
}

/** An echo for the lead, shared; its level follows the style. */
function echoBus(c: AudioContext, level: number) {
  if (!echoIn) {
    echoIn = c.createGain();
    const d = c.createDelay(1), fb = c.createGain(), f = c.createBiquadFilter(), out = c.createGain();
    d.delayTime.value = 0.36; fb.gain.value = 0.38; f.type = 'lowpass'; f.frequency.value = 2400; out.gain.value = 0.7;
    echoIn.connect(d); d.connect(f); f.connect(fb); fb.connect(d); f.connect(out); out.connect(musicBus!);
  }
  echoLevel = level;
  return echoIn;
}

function note(c: AudioContext, t: number, freq: number, dur: number, gain: number, type: OscillatorType, o: { attack?: number; tone?: number; echo?: number } = {}) {
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = type; osc.frequency.value = freq;
  const a = o.attack ?? 0.01;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.02, dur));
  let src: AudioNode = osc;
  if (o.tone) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.tone; osc.connect(f); src = f; }
  src.connect(g); g.connect(musicBus!);
  if (o.echo && echoIn) { const send = c.createGain(); send.gain.value = o.echo; g.connect(send); send.connect(echoIn); }
  osc.start(t); osc.stop(t + dur + 0.05);
}

let noiseBuf: AudioBuffer | null = null;
function hit(c: AudioContext, t: number, kind: 'kick' | 'snare' | 'hat' | 'shaker' | 'rim', gain: number) {
  if (kind === 'kick') {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(musicBus!); o.start(t); o.stop(t + 0.32);
    return;
  }
  if (!noiseBuf) {
    const len = Math.ceil(c.sampleRate * 0.25); noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let k = 0; k < len; k++) d[k] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuf;
  const [type, freq, len] = kind === 'snare' ? ['bandpass', 1900, 0.16] : kind === 'rim' ? ['bandpass', 3200, 0.05] : kind === 'shaker' ? ['highpass', 6000, 0.04] : ['highpass', 7500, 0.035];
  f.type = type as BiquadFilterType; f.frequency.value = freq as number;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (len as number));
  src.connect(f); f.connect(g); g.connect(musicBus!); src.start(t); src.stop(t + (len as number) + 0.02);
}

function scheduleStep(pl: Playing, t: number) {
  const c = ctx!, F = pl.f;
  const beat = 60 / (pl.key.bpm * F.pace) / 2; // eighth notes
  const i = step % 16, bar = Math.floor(step / 8) % 4;
  const at = i % 2 === 1 && F.swing ? t + F.swing * beat : t;
  const chord = F.chords[bar];
  const deg = pattern[i];
  // the tune: on the beat, and on every eighth once the ride gets going
  if (deg >= 0 && (i % 2 === 0 || energy > 0.4 || F.arp)) note(c, at, freqOf(pl, deg + chord) * F.leadUp, beat * F.leadLen, F.leadGain, F.lead, { tone: F.leadTone, echo: F.echo ? echoLevel : 0 });
  // bass: the chord's root, held, or driving eighths
  const root = freqOf(pl, chord) / 2;
  if (F.bassDrive) note(c, t, (i % 4 === 2 ? root * 2 : root) / (F.bass === 'square' ? 1 : 2), beat * 0.9, F.bassGain, F.bass, { tone: 900 });
  else if (i % 4 === 0) note(c, t, i % 8 === 0 ? root : root * 1.5, beat * 3.6, F.bassGain, F.bass);
  // a soft chord at the top of each bar
  if (F.pad && i % 8 === 0) for (const k of [0, 2, 4]) note(c, t, freqOf(pl, chord + k), beat * 7.5, 0.03, F.pad, { attack: beat * 2, tone: 1800 });
  // a quick arpeggio over the chord (arcade)
  if (F.arp && i % 2 === 1) note(c, at, freqOf(pl, chord + [0, 2, 4, 7][(i >> 1) % 4]) * 2, beat * 0.5, 0.025, 'square', { tone: 4000 });
  // drums, livelier as the ride speeds up
  const e = Math.min(1, energy);
  if (F.drums === 'shaker' && e > 0.15 && i % 2 === 1) hit(c, t, 'shaker', 0.05 * e);
  if (F.drums === 'band') {
    if (i % 8 === 0 || i === 6 || i === 14 && bar === 3) hit(c, t, 'kick', 0.42);
    if (i % 8 === 4) hit(c, t, 'snare', 0.13);
    if (e > 0.1) hit(c, t, 'hat', 0.035 + 0.03 * e);
  }
  if (F.drums === 'chip') {
    if (i % 4 === 0) hit(c, t, 'kick', 0.3);
    if (i % 8 === 4) hit(c, t, 'rim', 0.12);
    hit(c, t, 'hat', 0.03 + 0.03 * e);
  }
  if (F.drums === 'soft') {
    if (i === 0 || i === 10) hit(c, t, 'kick', 0.3);
    if (i % 8 === 4) hit(c, at, 'rim', 0.08);
    if (i % 2 === 0 || e > 0.3) hit(c, at, 'hat', 0.02 + 0.02 * e);
  }
  step++;
  if (step % 32 === 0) newPattern();
}

/** Which music style to play ('mix': a different one for each lesson). */
export function setMusicStyle(id: MusicStyleId | 'mix') {
  if (id === musicChoice) return;
  musicChoice = id;
  // restart what's playing in the new style
  if (playing) { const r = playing.region; stopMusic(); startMusic(r); }
}

export function startMusic(region: RegionId | 'menu') {
  const c = ac();
  if (!c) return;
  const ids = Object.keys(MUSIC_STYLES) as MusicStyleId[];
  // mix: menus stay sunny, each lesson picks a style at random
  const id = musicChoice === 'mix' ? (region === 'menu' ? 'sunny' : ids[Math.floor(Math.random() * ids.length)]) : musicChoice;
  const f = MUSIC_STYLES[id], key = KEYS[region];
  if (playing && playing.region === region && playing.f === f && musicTimer) return;
  stopMusic();
  playing = { key, f, scale: f.scale ?? key.scale, region };
  echoBus(c, f.echo ?? 0);
  step = 0;
  newPattern();
  nextTime = c.currentTime + 0.1;
  musicTimer = setInterval(() => {
    if (!ctx || !playing) return;
    const beat = 60 / (playing.key.bpm * playing.f.pace) / 2;
    while (nextTime < ctx.currentTime + 0.25) { scheduleStep(playing, nextTime); nextTime += beat; }
  }, 60);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  playing = null;
}

/** 0..1, how lively the music should be (follows the ride). */
export function musicEnergy(e: number) { energy = e; }

// for checking the music during development: record what plays
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __music: object }).__music = {
    tap() { const c = ac()!; const d = c.createMediaStreamDestination(); master!.connect(d); return d.stream; },
    start: startMusic, style: setMusicStyle, energy: musicEnergy,
  };
}
