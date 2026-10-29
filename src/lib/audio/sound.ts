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

function noise(dur: number, o: { gain?: number; freq?: number; q?: number; delay?: number; sweepTo?: number; kind?: BiquadFilterType } = {}) {
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
  f.type = o.kind ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 2000, t0);
  if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t0 + dur);
  f.Q.value = o.q ?? 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(o.gain ?? 0.15, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(sfxBus!);
  src.start(t0);
}

/** A tone with a wobble in it (vibrato): the grumpy Glimmer's little "hmph", the evolution hum. */
function wobble(freq: number, o: { dur: number; gain: number; rate: number; depth: number; type?: OscillatorType; delay?: number; slideTo?: number; tone?: number; attack?: number }) {
  const c = ac();
  if (!c || !enabled) return;
  const t0 = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
  osc.type = o.type ?? 'triangle';
  osc.frequency.setValueAtTime(freq, t0);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + o.dur);
  lfo.frequency.value = o.rate; lg.gain.value = freq * o.depth;
  lfo.connect(lg); lg.connect(osc.frequency);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + (o.attack ?? 0.02));
  g.gain.setValueAtTime(o.gain, t0 + o.dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  let src: AudioNode = osc;
  if (o.tone) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.tone; osc.connect(f); src = f; }
  src.connect(g); g.connect(sfxBus!);
  osc.start(t0); lfo.start(t0); osc.stop(t0 + o.dur + 0.05); lfo.stop(t0 + o.dur + 0.05);
}

// pentatonic scale, C major
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
const FINGER_NOTE: Record<Finger, number> = { LP: 0, LR: 1, LM: 2, LI: 3, TH: 4, RI: 5, RM: 6, RR: 7, RP: 8 };

// One sound language for the whole game (the full table is in docs/sound-map.md, and #sounds plays them
// all). Falling notes mean "that wasn't right" and play only for your own wrong answer (softly: kids hear
// it a lot). Locked buttons knock, the grumpy Glimmer grumbles like a cartoon, never like a buzzer, the
// other player's turn rings a neutral bell, good things rise and big moments get a short fanfare. The
// same moment makes the same sound in a battle, a duel, a rival game, a trip or a lesson.
export const sfx = {
  // ---------- answers and typing ----------
  /** A right key: a little note for the finger that pressed it. */
  key(finger: Finger | null) {
    const n = PENTA[FINGER_NOTE[finger ?? 'TH']] ?? 440;
    tone(n * 2, { type: 'triangle', dur: 0.07, gain: 0.05 });
    noise(0.03, { gain: 0.05, freq: 3200, q: 2 });
  },
  /** Your answer wasn't right: a soft "boo-op", two notes down. Only ever for your own wrong answer. */
  miss() {
    tone(329.63, { type: 'triangle', dur: 0.12, gain: 0.075 });
    tone(261.63, { type: 'triangle', dur: 0.2, gain: 0.07, delay: 0.1 });
  },
  /** A wrong key while typing: a tiny muted tap (it happens a lot, so it stays quiet). */
  slip() {
    tone(196, { type: 'sine', dur: 0.07, gain: 0.06, slideTo: 165 });
    noise(0.03, { gain: 0.025, freq: 900, q: 1.5 });
  },
  /** A hint lights up (the Glow, a trick): "bing!" */
  hint() {
    tone(1318.5, { type: 'sine', dur: 0.12, gain: 0.06 });
    tone(1760, { type: 'sine', dur: 0.35, gain: 0.06, delay: 0.08 });
  },
  // ---------- menus ----------
  click() { tone(660, { type: 'sine', dur: 0.06, gain: 0.06 }); },
  /** Something opens or is picked (a card, a tab, an info box). */
  pop() { tone(880, { type: 'sine', dur: 0.08, gain: 0.08, slideTo: 1320 }); },
  /** Off we go: a lesson, a trip, a battle or a duel is starting. */
  whoosh() { noise(0.35, { gain: 0.08, freq: 500, sweepTo: 3000, q: 0.8 }); },
  /** Not yet: a locked stop, a buddy you haven't met, not enough shells. Two soft knocks, nothing falls. */
  nope() {
    [0, 0.11].forEach(d => { tone(420, { type: 'sine', dur: 0.06, gain: 0.07, delay: d }); noise(0.03, { gain: 0.035, freq: 1400, q: 4, delay: d }); });
  },
  // ---------- rewards ----------
  /** Friendship (or a ride) goes up a level. */
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
  /** A star on the results: one, two, three, each a step higher. */
  star(i: number) {
    const n = [523.25, 659.25, 783.99][i] ?? 880;
    tone(n, { type: 'triangle', dur: 0.35, gain: 0.14 });
    tone(n * 2, { type: 'sine', dur: 0.5, gain: 0.06, delay: 0.05 });
  },
  /** A medal is won. */
  medal() {
    tone(783.99, { type: 'sine', dur: 0.12, gain: 0.1 });
    tone(1046.5, { type: 'sine', dur: 0.3, gain: 0.1, delay: 0.08 });
    noise(0.25, { gain: 0.04, freq: 7000, q: 0.7, delay: 0.05 });
  },
  /** (the medal sound, by its old name) */
  badge() { sfx.medal(); },
  /** Finished! A lesson, a trip, a practice stop, a lesson in Learn. */
  complete() {
    [523.25, 659.25, 783.99, 1046.5].forEach((n, i) => tone(n, { type: 'triangle', dur: 0.3, gain: 0.12, delay: i * 0.1 }));
    tone(1318.5, { type: 'sine', dur: 0.8, gain: 0.08, delay: 0.42 });
  },
  /** Something new is yours: an outfit, a dance, a buddy, an egg. A quick twinkle and a bell. */
  unlock() {
    [783.99, 1046.5, 1318.5, 1567.98, 2093].forEach((n, i) => tone(n, { type: 'triangle', dur: 0.18, gain: 0.07, delay: i * 0.045 }));
    tone(1046.5, { type: 'sine', dur: 0.7, gain: 0.06, delay: 0.24 });
    tone(1567.98, { type: 'sine', dur: 0.7, gain: 0.04, delay: 0.26 });
    noise(0.6, { gain: 0.035, freq: 8000, q: 0.6, delay: 0.2, sweepTo: 11000 });
  },
  /** Shells spent in the shop: shells clink, then a bell. */
  buy() {
    [2637, 3136, 2349.3].forEach((n, i) => { tone(n, { type: 'sine', dur: 0.08, gain: 0.05, delay: i * 0.06 }); noise(0.03, { gain: 0.03, freq: 6000, q: 3, delay: i * 0.06 }); });
    tone(1046.5, { type: 'triangle', dur: 0.35, gain: 0.08, delay: 0.22 });
    tone(1567.98, { type: 'sine', dur: 0.4, gain: 0.05, delay: 0.26 });
  },
  /** Put something on, or someone on your team: a quick "fwip" and a ding. */
  equip() {
    noise(0.15, { gain: 0.06, freq: 1500, sweepTo: 5000, q: 0.9 });
    tone(1318.5, { type: 'triangle', dur: 0.25, gain: 0.07, delay: 0.1 });
    tone(1975.5, { type: 'sine', dur: 0.3, gain: 0.03, delay: 0.14 });
  },
  /** A little "yay" (the hands cheering in a finger lesson). */
  cheer() { [659.25, 783.99, 1046.5].forEach((n, i) => tone(n, { type: 'triangle', dur: 0.16, gain: 0.07, delay: i * 0.06 })); },
  // ---------- battles, duels and rival games ----------
  /** A battle or duel begins: a drum, a rising "here we go", then the grumpy Glimmer's "hmph". */
  battleStart() {
    tone(130, { type: 'sine', dur: 0.32, gain: 0.13, slideTo: 70 });
    noise(0.12, { gain: 0.05, freq: 1500, q: 0.8 });
    [392, 523.25, 659.25].forEach((n, i) => tone(n, { type: 'triangle', dur: 0.2, gain: 0.09, delay: 0.08 + i * 0.09 }));
    tone(783.99, { type: 'triangle', dur: 0.45, gain: 0.09, delay: 0.35 });
    tone(1567.98, { type: 'sine', dur: 0.5, gain: 0.03, delay: 0.37 });
    sfx.grumble(0.95);
  },
  /** The grumpy Glimmer's voice: a cartoon "hmph-hmph", grumpy but cute (never a buzzer). */
  grumble(delay = 0) {
    noise(0.1, { gain: 0.03, freq: 700, q: 0.8, delay });
    wobble(196, { type: 'triangle', dur: 0.16, gain: 0.08, rate: 17, depth: 0.04, slideTo: 233, tone: 1400, delay });
    wobble(185, { type: 'triangle', dur: 0.26, gain: 0.08, rate: 17, depth: 0.05, slideTo: 165, tone: 1400, delay: delay + 0.2 });
  },
  /** A power flies: each element has its own sound. */
  cast(el: 'sun' | 'frost' | 'tide' | 'stone' | 'leaf') {
    if (el === 'sun') { tone(523.25, { type: 'triangle', dur: 0.35, gain: 0.1, slideTo: 1046.5 }); noise(0.4, { gain: 0.05, freq: 3000, sweepTo: 9000, q: 0.7 }); }
    if (el === 'tide') { noise(0.45, { gain: 0.09, freq: 700, sweepTo: 2400, q: 1.5 }); tone(330, { type: 'sine', dur: 0.3, gain: 0.07, slideTo: 660 }); }
    if (el === 'frost') { [1318.5, 1567.98, 2093].forEach((n, i) => tone(n, { type: 'sine', dur: 0.25, gain: 0.05, delay: i * 0.05 })); noise(0.3, { gain: 0.04, freq: 8000, q: 2 }); }
    if (el === 'leaf') { noise(0.5, { gain: 0.07, freq: 1200, sweepTo: 4000, q: 0.6 }); tone(587.33, { type: 'triangle', dur: 0.2, gain: 0.06, delay: 0.1, slideTo: 880 }); }
    if (el === 'stone') { tone(196, { type: 'triangle', dur: 0.16, gain: 0.08, slideTo: 262 }); noise(0.25, { gain: 0.08, freq: 400, q: 1 }); }
  },
  /** The cheer lands: a soft thump and bright notes going up; bigger numbers, more notes. */
  hit(k: number) {
    tone(160, { type: 'sine', dur: 0.14, gain: 0.08 + k * 0.04, slideTo: 110 });
    noise(0.2, { gain: 0.05 + k * 0.04, freq: 1800, q: 0.8 });
    [659.25, 783.99, 1046.5].slice(0, 1 + Math.round(k * 2)).forEach((n, i) => tone(n, { type: 'triangle', dur: 0.2, gain: 0.07, delay: 0.05 + i * 0.05 }));
  },
  /** Someone else's power didn't land (the other player's or a ghost's miss): a soft puff, nothing sad. */
  fizzle() {
    noise(0.25, { gain: 0.06, freq: 1800, sweepTo: 500, q: 0.7 });
    tone(660, { type: 'sine', dur: 0.12, gain: 0.03 });
  },
  /** A Perfect Cheer: a bright fanfare. */
  perfect() { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((n, i) => tone(n, { type: 'triangle', dur: 0.4, gain: 0.11, delay: i * 0.07 })); tone(2093, { type: 'sine', dur: 1.1, gain: 0.05, delay: 0.38 }); },
  /** A Glimmer on your team (or a piece of gear) helps: a bright little chime. */
  helper() { [783.99, 1046.5, 1318.5].forEach((n, i) => tone(n, { type: 'triangle', dur: 0.22, gain: 0.07, delay: i * 0.06 })); tone(2093, { type: 'sine', dur: 0.4, gain: 0.03, delay: 0.18 }); },
  /** Rain (or a zap, snow, pebbles) is coming: far-off thunder and a rising "dee-DEE!" (watch out, not wrong). */
  rainComing() {
    noise(0.9, { gain: 0.16, freq: 140, q: 0.5, sweepTo: 80, kind: 'lowpass' });
    tone(659.25, { type: 'triangle', dur: 0.1, gain: 0.08, delay: 0.05 });
    tone(880, { type: 'triangle', dur: 0.18, gain: 0.09, delay: 0.17 });
  },
  /** (rain coming, by its old name) */
  uhoh() { sfx.rainComing(); },
  /** A duel: your rain cloud flies over to the other side. */
  rainSend() {
    noise(0.4, { gain: 0.08, freq: 600, sweepTo: 3500, q: 0.8 });
    tone(392, { type: 'triangle', dur: 0.3, gain: 0.06, slideTo: 784 });
    noise(0.6, { gain: 0.1, freq: 140, q: 0.5, delay: 0.25, kind: 'lowpass' });
  },
  /** The grumpy cloud's zap flies: a cartoon crackle. */
  zap() {
    for (let i = 0; i < 5; i++) noise(0.04, { gain: 0.11, freq: 2600 + ((i * 1777) % 3000), q: 3, delay: i * 0.05 });
    tone(880, { type: 'triangle', dur: 0.25, gain: 0.06, slideTo: 1320 });
  },
  /** You blocked it: a glassy chime that holds (or cracks when only half of it was stopped). */
  shield(full: boolean) { [880, 1318.5].forEach((n, i) => tone(n, { type: 'sine', dur: 0.35, gain: 0.07, delay: i * 0.04 })); if (!full) noise(0.2, { gain: 0.08, freq: 5000, q: 1, delay: 0.08 }); },
  /** It landed on you: a splash and pitter-patter drops (a cartoon bump, not a "wrong"). */
  rainHit() {
    noise(0.3, { gain: 0.14, freq: 1200, sweepTo: 500, q: 0.6 });
    [1567.98, 1318.5, 1760, 1174.66].forEach((n, i) => tone(n, { type: 'sine', dur: 0.06, gain: 0.06, delay: 0.05 + i * 0.07, slideTo: n * 1.25 }));
  },
  /** (it landed, by its old name) */
  ouch() { sfx.rainHit(); },
  /** Energy back (a Glimmer heals you). */
  heal() { [783.99, 987.77, 1174.66].forEach((n, i) => tone(n, { type: 'sine', dur: 0.3, gain: 0.05, delay: i * 0.06 })); },
  freeze() { [2093, 2637, 3136].forEach((n, i) => tone(n, { type: 'sine', dur: 0.4, gain: 0.04, delay: i * 0.05 })); noise(0.5, { gain: 0.04, freq: 9000, q: 3 }); },
  /** The Finale stars are full: "ding, ding, DING!" */
  finaleReady() {
    [1046.5, 1318.5, 1567.98].forEach((n, i) => tone(n, { type: 'triangle', dur: i === 2 ? 0.5 : 0.14, gain: 0.08, delay: i * 0.11 }));
    tone(3136, { type: 'sine', dur: 0.6, gain: 0.02, delay: 0.22 });
  },
  /** The Finale starts: a little drum roll and a chord. */
  finale() { for (let i = 0; i < 8; i++) noise(0.06, { gain: 0.06 + i * 0.006, freq: 1200, q: 0.8, delay: i * 0.06 }); [392, 493.88, 587.33, 783.99].forEach((n, i) => tone(n, { type: 'triangle', dur: 1.2, gain: 0.07, delay: 0.5 + i * 0.03 })); },
  /** Aurora (the Finale is ready all at once): a shimmering wash. */
  aurora() {
    noise(1.2, { gain: 0.04, freq: 6000, q: 0.5, sweepTo: 11000 });
    [523.25, 659.25, 783.99, 987.77].forEach((n, i) => tone(n * 2, { type: 'sine', dur: 1.4, gain: 0.03, attack: 0.4, delay: i * 0.08 }));
  },
  /** A duel: the next player's turn. A friendly doorbell, a little higher for player 1. */
  turn(side: 0 | 1) {
    const [a, b] = side === 0 ? [783.99, 1046.5] : [659.25, 880];
    tone(a, { type: 'sine', dur: 0.18, gain: 0.05 });
    tone(b, { type: 'sine', dur: 0.3, gain: 0.05, delay: 0.12 });
  },
  /** A duel: one player has filled their bar and the other gets a last turn. A drum and two notes that
   *  climb: "your move!" */
  lastTurn() {
    tone(130, { type: 'sine', dur: 0.28, gain: 0.08, slideTo: 75 });
    tone(392, { type: 'triangle', dur: 0.18, gain: 0.08, delay: 0.1 });
    tone(587.33, { type: 'triangle', dur: 0.4, gain: 0.09, delay: 0.28 });
    tone(130, { type: 'sine', dur: 0.28, gain: 0.07, slideTo: 75, delay: 0.28 });
  },
  /** The grumpy Glimmer cheers up (you won): a rising swish, a POP as the cloud bursts, a happy run up. */
  cheeredUp(at = 0.45) {
    noise(at, { gain: 0.05, freq: 500, sweepTo: 4000, q: 0.8 });
    noise(0.08, { gain: 0.16, freq: 1500, q: 0.7, delay: at });
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((n, i) => tone(n, { type: 'triangle', dur: 0.22, gain: 0.09, delay: at + 0.04 + i * 0.05 }));
    tone(700, { type: 'sine', dur: 0.35, gain: 0.04, slideTo: 1600, delay: at + 0.05 });
    noise(0.8, { gain: 0.04, freq: 8000, q: 0.6, delay: at + 0.1, sweepTo: 12000 });
  },
  /** Out of energy: a soft "aww", then a little lift (next time!). */
  tryAgain() {
    tone(392, { type: 'triangle', dur: 0.25, gain: 0.06 });
    tone(329.63, { type: 'triangle', dur: 0.38, gain: 0.06, delay: 0.22 });
    tone(392, { type: 'sine', dur: 0.25, gain: 0.045, delay: 0.7 });
    tone(523.25, { type: 'sine', dur: 0.45, gain: 0.045, delay: 0.84 });
  },
  // ---------- Glimmers, eggs and treasure ----------
  /** An egg wobbles, cracks. */
  crack() { noise(0.12, { gain: 0.12, freq: 2500, q: 2 }); tone(1600, { type: 'square', dur: 0.05, gain: 0.03 }); },
  /** A Glimmer appears: the rarer, the grander (0 common .. 5 mythic). */
  reveal(rank: number) {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093];
    const n = 3 + rank;
    for (let i = 0; i < n; i++) tone(notes[Math.min(notes.length - 1, i)], { type: 'triangle', dur: 0.45, gain: 0.1, delay: i * 0.085 });
    tone(notes[Math.min(notes.length - 1, n)] * (rank >= 4 ? 1 : 0.5), { type: 'sine', dur: 1.6, gain: 0.07, delay: n * 0.085 });
    if (rank >= 3) [0, 4, 7, 12].forEach((k, i) => tone(523.25 * Math.pow(2, k / 12), { type: 'sine', dur: 1.8, gain: 0.04, delay: n * 0.085 + i * 0.03 }));
    if (rank >= 4) noise(1.4, { gain: 0.05, freq: 8000, q: 0.5, delay: n * 0.085, sweepTo: 12000 });
  },
  /** An evolution builds up: a humming note that climbs a step each time (call it again and again). */
  evolveCharge(step: number) {
    const f = 330 * Math.pow(2, Math.min(12, step * 2) / 12);
    wobble(f, { type: 'sine', dur: 0.75, gain: 0.05, rate: 6, depth: 0.01, attack: 0.3 });
    noise(0.7, { gain: 0.02, freq: 5000 + step * 600, q: 0.8 });
  },
  /** The evolution: a big rising sweep into the Glimmer's reveal. */
  evolve(rank: number) {
    noise(0.5, { gain: 0.09, freq: 400, sweepTo: 6000, q: 0.8 });
    tone(262, { type: 'triangle', dur: 0.45, gain: 0.07, slideTo: 1046.5 });
    setTimeout(() => sfx.reveal(rank), 380);
  },
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

export type MusicStyleId = 'sunny' | 'adventure' | 'dreamy' | 'arcade' | 'chill' | 'rock' | 'surf' | 'funk' | 'synthwave' | 'lofi' | 'epic';
type Drums = 'shaker' | 'band' | 'chip' | 'soft' | 'none' | 'rock' | 'surf' | 'funk' | 'gated' | 'boombap' | 'taiko';
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
  /** a guitar part made from plucked strings: distorted power-chord chugs, surf picking, funk chops */
  guitar?: 'chug' | 'surf' | 'funk';
  /** the tune on a guitar instead of a plain wave: distorted or clean and twangy */
  leadGuitar?: 'dist' | 'clean';
  /** vinyl crackle under it all (lo-fi) */
  crackle?: boolean;
  /** strings and brass swells on each chord (epic) */
  strings?: boolean;
};
export const MUSIC_STYLES: Record<MusicStyleId, Flavour> = {
  // the first one, as it was
  sunny: { name: 'Sunny', pace: 1, lead: 'triangle', leadGain: 0.09, leadUp: 1, leadLen: 1.6, bass: 'sine', bassGain: 0.12, drums: 'shaker', chords: [0, 0, 0, 0] },
  adventure: { name: 'Adventure', pace: 1.2, scale: [0, 2, 4, 5, 7, 9, 10], lead: 'sawtooth', leadGain: 0.05, leadUp: 1, leadLen: 1.3, leadTone: 2200, bass: 'sawtooth', bassGain: 0.07, bassDrive: true, drums: 'band', chords: [0, 6, 3, 4], echo: 0.18 },
  dreamy: { name: 'Dreamy', pace: 0.72, scale: [0, 2, 4, 6, 7, 9, 11], lead: 'sine', leadGain: 0.08, leadUp: 2, leadLen: 3.5, bass: 'sine', bassGain: 0.08, drums: 'none', chords: [0, 3, 5, 4], pad: 'triangle', echo: 0.45 },
  arcade: { name: 'Arcade', pace: 1.3, lead: 'square', leadGain: 0.04, leadUp: 2, leadLen: 0.9, leadTone: 3500, bass: 'square', bassGain: 0.05, bassDrive: true, drums: 'chip', chords: [0, 3, 4, 3], arp: true },
  chill: { name: 'Chill', pace: 0.85, scale: [0, 3, 5, 7, 10], lead: 'triangle', leadGain: 0.07, leadUp: 1, leadLen: 2.2, leadTone: 1600, bass: 'sine', bassGain: 0.11, drums: 'soft', chords: [0, 3, 2, 4], pad: 'sine', echo: 0.3, swing: 0.28 },
  // the grown-up ones: guitars, big drums
  rock: { name: 'Rock', pace: 1.35, scale: [0, 2, 3, 5, 7, 8, 10], lead: 'sawtooth', leadGain: 0.05, leadUp: 1, leadLen: 1.4, bass: 'sawtooth', bassGain: 0.07, bassDrive: true, drums: 'rock', chords: [0, 5, 2, 6], guitar: 'chug', leadGuitar: 'dist', echo: 0.12 },
  surf: { name: 'Surf', pace: 1.4, scale: [0, 2, 4, 5, 7, 9, 10], lead: 'triangle', leadGain: 0.06, leadUp: 1, leadLen: 1, bass: 'triangle', bassGain: 0.1, bassDrive: true, drums: 'surf', chords: [0, 3, 4, 3], guitar: 'surf', leadGuitar: 'clean', echo: 0.35 },
  funk: { name: 'Funk', pace: 1.05, scale: [0, 3, 5, 7, 10], lead: 'square', leadGain: 0.035, leadUp: 2, leadLen: 0.7, leadTone: 1800, bass: 'sawtooth', bassGain: 0.09, bassDrive: true, drums: 'funk', chords: [0, 0, 3, 4], guitar: 'funk', swing: 0.18 },
  synthwave: { name: 'Synthwave', pace: 1.15, scale: [0, 2, 3, 5, 7, 8, 10], lead: 'sawtooth', leadGain: 0.045, leadUp: 2, leadLen: 2, leadTone: 2600, bass: 'sawtooth', bassGain: 0.07, bassDrive: true, drums: 'gated', chords: [0, 5, 2, 6], pad: 'sawtooth', arp: true, echo: 0.4 },
  lofi: { name: 'Lo-fi', pace: 0.78, scale: [0, 2, 3, 5, 7, 9, 10], lead: 'sine', leadGain: 0.07, leadUp: 1, leadLen: 2.4, leadTone: 1400, bass: 'sine', bassGain: 0.12, drums: 'boombap', chords: [1, 4, 0, 5], pad: 'triangle', echo: 0.25, swing: 0.3, crackle: true },
  epic: { name: 'Epic', pace: 0.95, scale: [0, 2, 3, 5, 7, 8, 10], lead: 'sawtooth', leadGain: 0.04, leadUp: 1, leadLen: 2.6, leadTone: 2000, bass: 'sawtooth', bassGain: 0.06, drums: 'taiko', chords: [0, 5, 2, 6], strings: true, echo: 0.3 },
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
function hit(c: AudioContext, t: number, kind: 'kick' | 'snare' | 'hat' | 'shaker' | 'rim' | 'crash' | 'tom' | 'boom' | 'gated', gain: number, pitch = 1) {
  if (kind === 'tom' || kind === 'boom') {
    // toms, and the big taiko boom
    const o = c.createOscillator(), g = c.createGain(), base = (kind === 'boom' ? 70 : 150) * pitch;
    o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 0.55, t + (kind === 'boom' ? 0.5 : 0.25));
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'boom' ? 0.9 : 0.35));
    o.connect(g); g.connect(musicBus!); o.start(t); o.stop(t + 1);
    if (kind === 'boom') hit(c, t, 'snare', gain * 0.25);
    return;
  }
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
  src.buffer = noiseBuf; src.loop = kind === 'crash' || kind === 'gated';
  const [type, freq, len] = kind === 'snare' ? ['bandpass', 1900, 0.16] : kind === 'gated' ? ['bandpass', 1500, 0.32] : kind === 'crash' ? ['highpass', 5000, 1.3] : kind === 'rim' ? ['bandpass', 3200, 0.05] : kind === 'shaker' ? ['highpass', 6000, 0.04] : ['highpass', 7500, 0.035];
  f.type = type as BiquadFilterType; f.frequency.value = freq as number;
  g.gain.setValueAtTime(gain, t);
  if (kind === 'gated') { g.gain.setValueAtTime(gain * 0.7, t + 0.22); g.gain.linearRampToValueAtTime(0.0001, t + (len as number)); }
  else g.gain.exponentialRampToValueAtTime(0.0001, t + (len as number));
  src.connect(f); f.connect(g); g.connect(musicBus!); src.start(t); src.stop(t + (len as number) + 0.02);
}


// ---------- guitars: plucked strings (Karplus-Strong), worked out once per note and kept ----------
const pluckCache = new Map<number, AudioBuffer>();
function pluckBuf(c: AudioContext, freq: number) {
  const key = Math.round(freq * 2);
  let b = pluckCache.get(key);
  if (b) return b;
  const sr = c.sampleRate, len = Math.ceil(sr * 2.2), N = Math.max(2, Math.round(sr / freq));
  b = c.createBuffer(1, len, sr);
  const y = b.getChannelData(0);
  // a burst of noise, softened a little, then each pass round the string averages and fades it
  let prev = 0;
  for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; prev = prev * 0.35 + r * 0.65; y[i] = prev; }
  const decay = 0.996 - Math.min(0.006, freq / 400000);
  for (let i = N; i < len; i++) y[i] = decay * 0.5 * (y[i - N] + y[i - N + 1 < i ? i - N + 1 : i - N]);
  pluckCache.set(key, b);
  return b;
}
/** A distorted amp for rock guitar (and a clean, bright one for surf), shared. */
let ampDist: GainNode | null = null, ampClean: GainNode | null = null;
function amp(c: AudioContext, kind: 'dist' | 'clean') {
  if (kind === 'dist' && !ampDist) {
    ampDist = c.createGain(); ampDist.gain.value = 4;
    const ws = c.createWaveShaper(), k = 40, n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    ws.curve = curve; ws.oversample = '2x';
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
    const cab = c.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 3400; cab.Q.value = 0.9;
    const mid = c.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 900; mid.gain.value = 3;
    const out = c.createGain(); out.gain.value = 0.065;
    ampDist.connect(ws); ws.connect(hp); hp.connect(mid); mid.connect(cab); cab.connect(out); out.connect(musicBus!);
  }
  if (kind === 'clean' && !ampClean) {
    ampClean = c.createGain(); ampClean.gain.value = 1;
    const bright = c.createBiquadFilter(); bright.type = 'peaking'; bright.frequency.value = 2400; bright.gain.value = 5;
    const out = c.createGain(); out.gain.value = 0.33;
    ampClean.connect(bright); bright.connect(out); out.connect(musicBus!);
    if (echoIn) { const send = c.createGain(); send.gain.value = 0.5; out.connect(send); send.connect(echoIn); }
  }
  return kind === 'dist' ? ampDist! : ampClean!;
}
function pluck(c: AudioContext, t: number, freq: number, dur: number, gain: number, kind: 'dist' | 'clean', mute = false) {
  const src = c.createBufferSource(), g = c.createGain();
  src.buffer = pluckBuf(c, freq);
  g.gain.setValueAtTime(gain, t);
  g.gain.setTargetAtTime(0.0001, t + (mute ? 0.02 : dur), mute ? 0.035 : 0.12);
  let node: AudioNode = src;
  if (mute) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200; src.connect(f); node = f; }
  node.connect(g); g.connect(amp(c, kind));
  src.start(t); src.stop(t + (mute ? 0.3 : dur + 0.8));
}
let crackleSrc: AudioBufferSourceNode | null = null;
function crackle(c: AudioContext, on: boolean) {
  if (crackleSrc) { try { crackleSrc.stop(); } catch { /* already stopped */ } crackleSrc = null; }
  if (!on) return;
  const len = c.sampleRate * 3, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.9 : 0) + (Math.random() * 2 - 1) * 0.012;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = b; src.loop = true; f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 0.5; g.gain.value = 0.25;
  src.connect(f); f.connect(g); g.connect(musicBus!); src.start();
  crackleSrc = src;
}

function scheduleStep(pl: Playing, t: number) {
  const c = ctx!, F = pl.f;
  const beat = 60 / (pl.key.bpm * F.pace) / 2; // eighth notes
  const i = step % 16, bar = Math.floor(step / 8) % 4;
  const at = i % 2 === 1 && F.swing ? t + F.swing * beat : t;
  const chord = F.chords[bar];
  const deg = pattern[i];
  // the tune: on the beat, and on every eighth once the ride gets going
  if (deg >= 0 && (i % 2 === 0 || energy > 0.4 || F.arp)) {
    const lf = freqOf(pl, deg + chord) * F.leadUp;
    // a guitar lead plays fewer notes until the ride gets going, and holds them
    if (F.leadGuitar) { if (i % 2 === 0 && (energy > 0.25 || i % 4 === 0)) pluck(c, at, lf, beat * F.leadLen, F.leadGuitar === 'dist' ? 0.32 : 0.5, F.leadGuitar); }
    else note(c, at, lf, beat * F.leadLen, F.leadGain, F.lead, { tone: F.leadTone, echo: F.echo ? echoLevel : 0 });
  }
  const groot = freqOf(pl, chord), low = groot / (groot > 160 ? 2 : 1), low2 = low / (low > 110 ? 2 : 1);
  if (F.guitar === 'chug') {
    // power chords: root and fifth, an open hit on the bar, palm-muted eighths in between
    const open = i % 8 === 0 || (i === 14 && bar === 3);
    pluck(c, t, low2, open ? beat * 3 : beat, open ? 0.5 : 0.42, 'dist', !open);
    pluck(c, t, low2 * 1.4983, open ? beat * 3 : beat, open ? 0.38 : 0.3, 'dist', !open);
    if (open) pluck(c, t, low2 * 2, beat * 3, 0.25, 'dist');
  }
  if (F.guitar === 'surf') {
    // fast tremolo picking on the chord's root, twangy and wet
    if (i % 4 !== 3 || energy > 0.3) pluck(c, t, low * 2, beat * 0.9, 0.3, 'clean');
    if (i % 8 === 0) pluck(c, t, low * 3, beat * 2, 0.22, 'clean');
  }
  if (F.guitar === 'funk') {
    // short muted chops on the off-beats, a full chord on the "and" of two
    if (i % 2 === 1 || i % 8 === 6) { for (const k of [0, 2, 4]) pluck(c, at, freqOf(pl, chord + k), beat * 0.4, 0.3, 'clean', i % 8 !== 6); }
  }
  if (F.strings && i % 8 === 0) {
    for (const k of [0, 2, 4, 7]) note(c, t, freqOf(pl, chord + k) / 2, beat * 7.8, 0.022, 'sawtooth', { attack: beat * 2.5, tone: 1500 });
    if (bar % 2 === 0) for (const k of [0, 4]) note(c, t + beat * 4, freqOf(pl, chord + k), beat * 1.6, 0.03, 'sawtooth', { attack: 0.03, tone: 2400 });
  }
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
  if (F.drums === 'rock') {
    if (i % 8 === 0 || i % 8 === 3 || i % 8 === 5) hit(c, t, 'kick', 0.48);
    if (i % 8 === 4 || (i % 8 === 6 && bar === 3 && i > 8)) hit(c, t, 'snare', 0.17);
    hit(c, t, 'hat', 0.04 + 0.03 * e);
    if (i === 0 && bar === 0) hit(c, t, 'crash', 0.06);
    if (bar === 3 && i >= 12) hit(c, t, 'tom', 0.25, 1.4 - (i - 12) * 0.15);
  }
  if (F.drums === 'surf') {
    if (i % 4 === 0) hit(c, t, 'kick', 0.35);
    if (i % 8 === 4) hit(c, t, 'snare', 0.14);
    if (i % 2 === 0) hit(c, t, 'tom', 0.12, 1.2);
    hit(c, t, 'hat', 0.03 + 0.02 * e);
  }
  if (F.drums === 'funk') {
    if (i === 0 || i === 3 || i === 10) hit(c, t, 'kick', 0.42);
    if (i % 8 === 4) hit(c, t, 'snare', 0.15);
    if (i % 8 === 7) hit(c, at, 'snare', 0.04);
    hit(c, at, 'hat', i % 2 ? 0.025 : 0.045);
  }
  if (F.drums === 'gated') {
    if (i % 8 === 0 || i === 10) hit(c, t, 'kick', 0.45);
    if (i % 8 === 4) hit(c, t, 'gated', 0.14);
    if (e > 0.1) hit(c, t, 'hat', 0.03 + 0.02 * e);
  }
  if (F.drums === 'boombap') {
    if (i === 0 || i === 5 || i === 10) hit(c, t, 'kick', 0.4);
    if (i % 8 === 4) hit(c, at, 'snare', 0.12);
    if (i % 2 === 0 || e > 0.3) hit(c, at, 'hat', 0.02 + 0.015 * e);
  }
  if (F.drums === 'taiko') {
    if (i % 8 === 0) hit(c, t, 'boom', 0.5);
    if (i % 8 === 6 || (bar === 3 && i % 2 === 0 && i > 8)) hit(c, t, 'boom', 0.3, 1.3);
    if (e > 0.3 && i % 4 === 2) hit(c, t, 'tom', 0.15, 1.6);
    if (i === 0 && bar === 0) hit(c, t, 'crash', 0.05);
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
  crackle(c, !!f.crackle);
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
  if (ctx) crackle(ctx, false);
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
