// A rigged Glimmer's moves (glimmerRig.ts makes the skeleton). Every move is made in code from the body
// plan, so a new Glimmer moves as soon as it has landmarks: a loop it keeps doing (idle, walk, sit,
// sleep, swim) and one-off moves on top (happy, cheer, attack, hit, eat, hop, sad, stomp). Loops blend
// into each other over a third of a second; a one-off fades in and out over the loop under it.
//
// Each move writes a small turn for each bone (an axis times an angle, in the bone's own frame, which at
// rest is the model's), a stretch for some (a jelly's bell, a blob's squash) and a nudge for the whole
// body; the moves are mixed by weight and set on the bones.
import * as THREE from 'three';
import type { BoneSpec, Plan, Rig, Role } from './glimmerRig';

/** What it keeps doing. */
export type Base = 'idle' | 'walk' | 'sit' | 'sleep' | 'swim';
/** A one-off move. */
export type Act = 'happy' | 'cheer' | 'attack' | 'hit' | 'eat' | 'hop' | 'sad' | 'stomp';
export const BASES: Base[] = ['idle', 'walk', 'sit', 'sleep', 'swim'];
export const ACTS: Act[] = ['happy', 'cheer', 'attack', 'hit', 'eat', 'hop', 'sad', 'stomp'];
/** seconds each one-off lasts */
export const ACT_LEN: Record<Act, number> = { happy: 1.3, cheer: 1.6, attack: 0.95, hit: 0.6, eat: 0.75, hop: 0.45, sad: 2.0, stomp: 0.55 };
/** how much a one-off takes over from the loop under it (0: added on top, 1: in its place) */
const OVER: Record<Act, number> = { happy: 0.5, cheer: 0.7, attack: 0.7, hit: 0.5, eat: 0.2, hop: 0.3, sad: 0.6, stomp: 0.5 };
/** when in an attack the blow lands (seconds), for the puff of its element */
export const STRIKE_AT = 0.36;

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

class Pose {
  rot: Float32Array; scl: Float32Array; off = new THREE.Vector3();
  constructor(n: number) { this.rot = new Float32Array(n * 3); this.scl = new Float32Array(n * 3); }
  clear() { this.rot.fill(0); this.scl.fill(0); this.off.set(0, 0, 0); }
  /** this += o * k */
  add(o: Pose, k: number) {
    if (k === 0) return;
    for (let i = 0; i < this.rot.length; i++) { this.rot[i] += o.rot[i] * k; this.scl[i] += o.scl[i] * k; }
    this.off.addScaledVector(o.off, k);
  }
  scale(k: number) { for (let i = 0; i < this.rot.length; i++) { this.rot[i] *= k; this.scl[i] *= k; } this.off.multiplyScalar(k); }
}

/** The bones by what they are, for the moves. */
type Parts = {
  root: number; spine: number; neck: number; head: number;
  tail: number[]; legs: number[][]; arms: number[][]; wings: number[][]; fins: number[][]; ears: number[][]; tents: number[][];
};
function partsOf(bones: BoneSpec[]): Parts {
  const one = (r: Role) => bones.findIndex(b => b.role === r);
  const chains = (r: Role) => {
    const out: number[][] = [];
    bones.forEach((b, i) => { if (b.role === r) (out[b.chain] ??= [])[b.link] = i; });
    return out.filter(Boolean);
  };
  return { root: one('root'), spine: one('spine'), neck: one('neck'), head: one('head'), tail: chains('tail')[0] ?? [], legs: chains('leg'), arms: chains('arm'), wings: chains('wing'), fins: chains('fin'), ears: chains('ear'), tents: chains('tentacle') };
}

// smooth wandering numbers in -1..1 (sums of sines that never quite repeat)
const wander = (x: number) => (Math.sin(x) + Math.sin(x * 1.618 + 1.3) * 0.6 + Math.sin(x * 2.718 + 2.1) * 0.3) / 1.9;
/** a quick flick every few seconds: 0 most of the time, up to 1 */
const flick = (t: number, every: number, seed: number) => { const k = ((t + seed) % every) / every; return k > 0.92 ? Math.sin(((k - 0.92) / 0.08) * Math.PI) : 0; };
const smooth = (x: number) => { const f = Math.min(1, Math.max(0, x)); return f * f * (3 - 2 * f); };
/** 0 → 1 → 0 over [a, b, c, d]: up from a to b, held to c, down to d */
const bump = (k: number, a: number, b: number, c: number, d: number) => (k < a || k > d ? 0 : k < b ? smooth((k - a) / (b - a)) : k <= c ? 1 : 1 - smooth((k - c) / (d - c)));

/** Writes moves into a pose. */
class Mover {
  readonly B: BoneSpec[]; readonly p: Parts; readonly H: number; readonly plan: Plan;
  /** the pose being written */
  o!: Pose;
  floats = false;
  seed: number;
  constructor(rig: Rig, seed: number) { this.B = rig.bones; this.p = partsOf(rig.bones); this.H = rig.height; this.plan = rig.plan; this.seed = seed; }

  private turn(b: number, ax: THREE.Vector3, a: number) { if (b < 0 || !a) return; a *= this.B[b].free; const r = this.o.rot; r[b * 3] += ax.x * a; r[b * 3 + 1] += ax.y * a; r[b * 3 + 2] += ax.z * a; }
  /** nose down (+) / up (-) */ pitch(b: number, a: number) { this.turn(b, X, a); }
  /** turn toward +x */ yaw(b: number, a: number) { this.turn(b, Y, a); }
  roll(b: number, a: number) { this.turn(b, Z, a); }
  up(b: number, a: number) { if (b >= 0) this.turn(b, this.B[b].aUp, a); }
  fwd(b: number, a: number) { if (b >= 0) this.turn(b, this.B[b].aFwd, a); }
  out(b: number, a: number) { if (b >= 0) this.turn(b, this.B[b].aOut, a); }
  side(b: number, a: number) { if (b >= 0) this.turn(b, this.B[b].aSide, a); }
  stretch(b: number, sx: number, sy: number, sz: number) { if (b < 0) return; const s = this.o.scl; s[b * 3] += sx; s[b * 3 + 1] += sy; s[b * 3 + 2] += sz; }
  move(x: number, y: number, z: number) { this.o.off.x += x * this.H; this.o.off.y += y * this.H; this.o.off.z += z * this.H; }

  get legged() { return this.p.legs.length > 0; }
  get four() { return this.p.legs.length === 4; }

  // ---------------- pieces most moves use ----------------
  breathe(a: number, w: number, t: number) {
    const s = Math.sin(t * w + this.seed);
    this.stretch(this.p.spine, s * a, s * a * 0.4, s * a);
    if (this.plan === 'blob' || this.plan === 'jelly') this.stretch(this.p.root, s * a * 0.6, -s * a * 0.3, s * a * 0.6);
  }
  /** the tail sways (and lifts) */
  swish(a: number, w: number, t: number, lift = 0) {
    this.p.tail.forEach((b, i) => { this.side(b, a * (0.6 + i * 0.35) * Math.sin(t * w - i * 0.7 + this.seed)); this.up(b, lift / (i + 1)); });
  }
  ears(t: number, a: number, perk = 0) {
    for (const ch of this.p.ears) ch.forEach((b, i) => {
      const s = this.B[b].side || 1;
      this.out(b, (a * Math.sin(t * 1.7 + this.B[b].chain * 2 + this.seed) + perk) / (i + 1) + 0.4 * flick(t, 4.3 + this.B[b].chain, this.seed + s) * (i ? 0.5 : 1));
    });
  }
  /** each tentacle waves, one after another round the body */
  tentacles(t: number, a: number, w: number, flare = 0, trail = 0) {
    for (const ch of this.p.tents) ch.forEach((b, i) => {
      const c = this.B[b].chain;
      this.out(b, flare * (i ? 0.5 : 1) + a * Math.sin(t * w + c * 1.3 - i * 0.9 + this.seed));
      this.side(b, a * 0.7 * Math.sin(t * w * 0.7 + c * 2.1 - i * 0.8));
      this.fwd(b, -trail * (i ? 0.6 : 1));
    });
  }
  /** a jelly's bell squeezes and lets go; the tentacles flare as it squeezes */
  pulse(t: number, w: number, a: number): number {
    const s = Math.pow(Math.max(0, Math.sin(t * w + this.seed)), 2);
    this.stretch(this.p.spine, -s * a, s * a * 0.8, -s * a);
    this.stretch(this.p.neck, -s * a * 0.5, s * a * 0.5, -s * a * 0.5);
    return s;
  }
  /** a body wave from front to back: up and down (swimmers) or side to side (long ones) */
  wave(t: number, a: number, w: number, sideways: boolean) {
    const chain = [this.p.neck, this.p.spine, this.p.root, ...this.p.tail];
    chain.forEach((b, i) => {
      const k = a * (0.4 + i * 0.25) * Math.sin(t * w - i * 0.8 + this.seed);
      if (b === this.p.root) return;
      if (b === this.p.neck || b === this.p.spine) { if (sideways) this.yaw(b, -k * 0.5); else this.pitch(b, -k * 0.4); }
      else if (sideways) this.side(b, k); else this.up(b, k);
    });
  }
  wingsFlap(t: number, a: number, w: number, rest = 0, fold = 0) {
    for (const ch of this.p.wings) ch.forEach((b, i) => { this.up(b, (rest + a * Math.sin(t * w - i * 0.6)) * (i ? 0.6 : 1)); this.fwd(b, -fold * (i ? 0.5 : 1)); });
  }
  finsPaddle(t: number, a: number, w: number) { for (const ch of this.p.fins) ch.forEach((b, i) => { this.up(b, a * Math.sin(t * w - i * 0.7 + this.B[b].chain * 0.3)); this.fwd(b, a * 0.4 * Math.cos(t * w)); }); }
  armsSway(t: number, a: number) { for (const ch of this.p.arms) ch.forEach((b, i) => this.fwd(b, a * Math.sin(t * 1.2 + this.B[b].chain * Math.PI) * (i ? 0.5 : 1))); }
  /** the head (and neck) look around on their own */
  lookAround(t: number, a: number) {
    const s = this.seed;
    this.yaw(this.p.neck, 0.14 * a * wander(t * 0.37 + s));
    this.yaw(this.p.head, 0.26 * a * wander(t * 0.41 + s * 2));
    this.pitch(this.p.head, 0.09 * a * wander(t * 0.3 + s * 3));
    this.roll(this.p.head, 0.1 * a * wander(t * 0.23 + s * 4));
  }

  // ---------------- the loops ----------------
  idle(t: number) {
    const pl = this.plan;
    this.breathe(pl === 'jelly' ? 0 : 0.025, 2.2, t);
    this.roll(this.p.root, 0.03 * wander(t * 0.5 + this.seed)); this.roll(this.p.spine, -0.02 * wander(t * 0.5 + this.seed));
    this.lookAround(t, 1);
    this.swish(pl === 'serpent' ? 0.12 : 0.22, 2.4, t, 0.04);
    this.ears(t, 0.06);
    this.armsSway(t, 0.1);
    // feet shift now and then
    this.p.legs.forEach((ch, i) => { const f = flick(t * 0.8, 5.5, this.seed + i * 1.37); this.fwd(ch[0], 0.12 * f); this.fwd(ch[1], -0.25 * f); });
    if (pl === 'flyer' || this.p.wings.length) {
      if (this.floats) this.wingsFlap(t, 0.5, 11, 0.1);
      else { const f = flick(t, 4.5, this.seed) + flick(t + 0.25, 4.5, this.seed); this.wingsFlap(t, 0.06 + 0.5 * f, 13, 0, 0.08); }
    }
    this.finsPaddle(t, 0.22, 2.1);
    if (pl === 'jelly') { const s = this.pulse(t, 1.8, 0.07); this.tentacles(t, 0.13, 1.5, 0.12 + s * 0.25); }
    else this.tentacles(t, 0.12, 1.5);
    if (pl === 'swimmer') this.wave(t, 0.08, 1.8, false);
    if (pl === 'serpent') this.wave(t, 0.1, 1.6, true);
    if (pl === 'blob') { const s = Math.sin(t * 2.4 + this.seed); this.stretch(this.p.root, -s * 0.03, s * 0.04, -s * 0.03); this.roll(this.p.spine, 0.05 * Math.sin(t * 1.3)); }
  }
  walk(t: number) {
    const ph = t * 7.5, pl = this.plan;
    this.breathe(0.015, 2.2, t);
    this.lookAround(t, 0.4);
    this.swish(0.3, 5, t, 0.1);
    this.ears(t * 2, 0.08);
    if (this.legged && !this.floats) {
      if (this.four) {
        this.p.legs.forEach((ch, i) => {
          const phase = ph + (i === 0 || i === 3 ? 0 : Math.PI);
          this.fwd(ch[0], 0.42 * Math.sin(phase));
          this.fwd(ch[1], (this.B[ch[0]].front ? 1 : -1) * 0.45 * Math.max(0, Math.cos(phase)));
        });
        this.move(0, 0.025 * Math.abs(Math.sin(ph)), 0);
        this.pitch(this.p.head, 0.04 * Math.sin(ph * 2));
        this.roll(this.p.spine, 0.04 * Math.sin(ph));
      } else {
        this.p.legs.forEach((ch, i) => { const phase = ph + i * Math.PI; this.fwd(ch[0], 0.48 * Math.sin(phase)); this.fwd(ch[1], -0.5 * Math.max(0, Math.cos(phase))); });
        this.roll(this.p.root, 0.09 * Math.sin(ph)); this.roll(this.p.head, -0.06 * Math.sin(ph));
        this.move(0, 0.03 * Math.abs(Math.sin(ph)), 0);
        for (const ch of this.p.arms) this.fwd(ch[0], -0.4 * Math.sin(ph + this.B[ch[0]].chain * Math.PI));
      }
    }
    if (this.p.wings.length) { if (this.floats || !this.legged) this.wingsFlap(t, 0.65, 13, 0.15); else this.wingsFlap(t, 0.12, 9, 0.12); }
    if (this.floats) this.pitch(this.p.root, 0.1);
    this.finsPaddle(t, 0.4, 4);
    if (pl === 'swimmer') this.wave(t, 0.16, 4, false);
    if (pl === 'serpent') this.wave(t, 0.26, 5, true);
    if (pl === 'jelly') { const s = this.pulse(t, 3, 0.1); this.tentacles(t, 0.13, 3, 0.08 + s * 0.2, 0.15); }
    else this.tentacles(t, 0.2, 4);
    if (pl === 'blob') { const s = Math.sin(ph * 2); this.stretch(this.p.root, -s * 0.06, s * 0.08, -s * 0.06); this.roll(this.p.spine, 0.08 * Math.sin(ph)); }
  }
  sit(t: number) {
    const pl = this.plan;
    this.idleSoft(t, 0.7);
    if (this.four) {
      // sits up on its haunches, front legs straight under it, tail round its feet
      const back = -0.36;
      this.pitch(this.p.root, back); this.pitch(this.p.spine, -0.1);
      this.pitch(this.p.neck, 0.28); this.pitch(this.p.head, 0.18);
      this.move(0, -0.05, -0.05);
      this.p.legs.forEach(ch => {
        if (this.B[ch[0]].front) this.pitch(ch[0], -back + 0.1);
        else { this.fwd(ch[0], 0.55); this.fwd(ch[1], -0.95); }
      });
      this.p.tail.forEach((b, i) => { this.up(b, i ? -0.1 : -0.25); this.side(b, 0.25); });
    } else if (this.legged && pl !== 'flyer') {
      // down on its bottom, feet out in front
      this.p.legs.forEach(ch => { this.fwd(ch[0], 1.0); this.fwd(ch[1], -0.35); });
      this.pitch(this.p.root, -0.12); this.pitch(this.p.head, 0.08);
      this.move(0, -0.12, 0);
      for (const ch of this.p.arms) { this.fwd(ch[0], 0.35); this.out(ch[0], -0.1); this.fwd(ch[1], 0.3); }
      this.p.tail.forEach(b => this.up(b, -0.2));
    } else if (this.legged) {
      // a bird settles down over its feet
      this.p.legs.forEach(ch => { this.fwd(ch[0], 0.55); this.fwd(ch[1], -1.0); });
      this.move(0, -0.07, 0);
      this.wingsFlap(t, 0, 1, -0.12, 0.12);
    } else {
      // no legs: settles where it is
      this.move(0, -0.035, 0);
      this.stretch(this.p.root, 0.04, -0.06, 0.04);
      if (pl === 'jelly') this.tentacles(t, 0.05, 1, 0.3);
    }
  }
  /** a quieter idle under other loops */
  private idleSoft(t: number, k: number) {
    this.breathe(0.022 * k, 1.9, t);
    this.lookAround(t, 0.8 * k);
    this.swish(0.12 * k, 1.8, t);
    this.ears(t, 0.05 * k);
    this.finsPaddle(t, 0.12 * k, 1.6);
    if (this.plan === 'jelly') { const s = this.pulse(t, 1.4, 0.05 * k); this.tentacles(t, 0.08 * k, 1.2, s * 0.2); } else this.tentacles(t, 0.08 * k, 1.2);
    if (this.floats && this.p.wings.length) this.wingsFlap(t, 0.35 * k, 10, 0.1);
  }
  sleep(t: number) {
    const pl = this.plan, s = Math.sin(t * 1.25 + this.seed);
    // slow, deep breaths
    this.stretch(this.p.spine, s * 0.045, s * 0.02, s * 0.045);
    this.ears(t * 0.3, 0.02, -0.25);
    this.p.ears.forEach(ch => this.up(ch[0], -0.3));
    if (this.four) {
      // curled up on the ground: legs tucked, back curved, head down by the tail
      this.move(0, -0.1, 0);
      this.p.legs.forEach(ch => {
        if (this.B[ch[0]].front) { this.fwd(ch[0], 0.85); this.fwd(ch[1], 0.15); }
        else { this.fwd(ch[0], 0.7); this.fwd(ch[1], -1.1); }
      });
      this.yaw(this.p.root, 0.12); this.yaw(this.p.spine, 0.2);
      this.yaw(this.p.neck, 0.35); this.pitch(this.p.neck, 0.3); this.pitch(this.p.head, 0.2); this.roll(this.p.head, 0.28);
      this.p.tail.forEach((b, i) => { this.side(b, 0.3 + i * 0.06); this.up(b, i ? 0 : -0.3); });
    } else if (this.legged && pl !== 'flyer') {
      this.p.legs.forEach(ch => { this.fwd(ch[0], 1.0); this.fwd(ch[1], -0.35); });
      this.move(0, -0.12, 0); this.pitch(this.p.root, -0.1);
      this.pitch(this.p.neck, 0.38); this.pitch(this.p.head, 0.15); this.roll(this.p.head, 0.25);
      for (const ch of this.p.arms) { this.fwd(ch[0], 0.4); this.out(ch[0], -0.15); this.fwd(ch[1], 0.35); }
    } else if (pl === 'flyer') {
      // head tucked, wings wrapped
      if (this.legged) { this.p.legs.forEach(ch => { this.fwd(ch[0], 0.55); this.fwd(ch[1], -1.0); }); this.move(0, -0.07, 0); }
      this.pitch(this.p.neck, 0.22); this.yaw(this.p.neck, 0.3); this.roll(this.p.head, 0.2);
      this.wingsFlap(t, this.floats ? 0.15 : 0, 2, -0.15, 0.15);
    } else if (pl === 'swimmer') {
      this.move(0, -0.02, 0); this.wave(t, 0.04, 0.9, false); this.pitch(this.p.head, 0.1); this.finsPaddle(t, 0.06, 0.9);
    } else if (pl === 'jelly') {
      this.move(0, -0.04, 0); this.roll(this.p.spine, 0.12); this.pulse(t, 0.9, 0.04); this.tentacles(t, 0.05, 0.8, -0.15);
    } else if (pl === 'serpent') {
      // coiled round
      [this.p.neck, this.p.spine, ...this.p.tail].forEach((b, i) => (b === this.p.neck || b === this.p.spine ? this.yaw(b, 0.3) : this.side(b, 0.45 + i * 0.05)));
      this.pitch(this.p.neck, 0.35); this.move(0, -0.03, 0);
    } else {
      this.stretch(this.p.root, 0.07, -0.1, 0.07); this.roll(this.p.head, 0.22); this.pitch(this.p.head, 0.12);
    }
    this.p.tail.forEach(b => this.side(b, 0.03 * Math.sin(t * 0.7)));
  }
  swim(t: number) {
    // paddling round a pond, low in the water
    const pl = this.plan;
    this.lookAround(t, 0.5);
    if (pl === 'swimmer' || pl === 'jelly' || pl === 'serpent') { this.walk(t * 0.7); return; }
    this.breathe(0.015, 2, t);
    this.p.legs.forEach((ch, i) => { const ph = t * 6 + i * Math.PI * (this.four ? 0.5 : 1); this.fwd(ch[0], 0.5 * Math.sin(ph)); this.fwd(ch[1], -0.3 * Math.max(0, Math.cos(ph))); });
    for (const ch of this.p.arms) { const ph = t * 6 + this.B[ch[0]].chain * Math.PI; this.fwd(ch[0], 0.35 * Math.sin(ph)); this.out(ch[0], 0.3); }
    this.swish(0.3, 4, t, 0.2);
    this.pitch(this.p.root, -0.12); this.pitch(this.p.head, -0.15);
    this.ears(t, 0.05, -0.15);
    if (this.p.wings.length) this.wingsFlap(t, 0.15, 6, 0.05);
    this.tentacles(t, 0.15, 3, 0.2, 0.2);
  }

  // ---------------- the one-offs (k: seconds in) ----------------
  happy(t: number, k: number) {
    const pl = this.plan;
    this.roll(this.p.head, 0.22 * Math.sin(k * 9)); this.pitch(this.p.head, -0.15); this.pitch(this.p.neck, -0.08);
    this.p.tail.forEach((b, i) => { this.side(b, 0.5 * (0.6 + i * 0.3) * Math.sin(k * 17 - i * 0.6)); this.up(b, i ? 0.08 : 0.3); });
    this.ears(t * 3, 0.1, 0.25);
    this.wingsFlap(k, 0.65, 15, 0.3);
    this.finsPaddle(k, 0.6, 12);
    for (const ch of this.p.arms) { this.up(ch[0], 1.0); this.out(ch[0], 0.25); this.up(ch[1], 0.3 * Math.sin(k * 14 + this.B[ch[0]].chain * Math.PI)); }
    // feet tucked up in each hop (the body hops three times)
    const air = Math.max(0, Math.sin(((k % 0.42) / 0.42) * Math.PI));
    this.p.legs.forEach(ch => { this.fwd(ch[0], (this.B[ch[0]].front ? 0.3 : -0.3) * air); this.fwd(ch[1], (this.B[ch[0]].front ? -0.4 : 0.5) * air); });
    if (pl === 'jelly') { const s = this.pulse(k, 7, 0.1); this.tentacles(k, 0.2, 11, 0.22 + s * 0.15); } else this.tentacles(k, 0.2, 11, 0.2);
    if (pl === 'serpent') this.wave(k, 0.3, 10, true);
    if (pl === 'swimmer') { this.wave(k, 0.25, 9, false); this.pitch(this.p.spine, -0.1); }
    if (pl === 'blob') { const s = Math.sin(k * 15); this.stretch(this.p.root, -s * 0.05, s * 0.07, -s * 0.05); }
  }
  cheer(t: number, k: number) {
    const pl = this.plan, e = bump(k, 0, 0.25, 1.25, 1.6);
    this.pitch(this.p.head, -0.3 * e); this.pitch(this.p.neck, -0.15 * e); this.roll(this.p.head, 0.15 * Math.sin(k * 8));
    this.p.tail.forEach((b, i) => { this.side(b, 0.45 * Math.sin(k * 16 - i * 0.6)); this.up(b, i ? 0.06 : 0.28 * e); });
    this.ears(k * 3, 0.12, 0.35 * e);
    this.wingsFlap(k, pl === 'flyer' ? 0.9 : 0.55, 13, (pl === 'flyer' ? 0.35 : 0.15) * e);
    this.finsPaddle(k, 0.7, 13);
    // arms up high, waving
    for (const ch of this.p.arms) { this.up(ch[0], 1.5 * e); this.out(ch[0], 0.2 * e); this.up(ch[1], (0.3 + 0.35 * Math.sin(k * 13 + this.B[ch[0]].chain * Math.PI)) * e); }
    if (this.four) {
      // up on its back legs, front paws paddling the air
      this.pitch(this.p.root, -0.5 * e); this.pitch(this.p.neck, 0.2 * e); this.move(0, 0.05 * e, -0.05 * e);
      this.p.legs.forEach(ch => {
        if (this.B[ch[0]].front) { this.fwd(ch[0], (0.7 + 0.35 * Math.sin(k * 14 + this.B[ch[0]].chain * Math.PI)) * e); this.fwd(ch[1], -0.5 * e); }
        else { this.fwd(ch[0], 0.45 * e); this.fwd(ch[1], -0.3 * e); }
      });
    } else if (this.legged) {
      const air = Math.max(0, Math.sin(k * 9)); this.p.legs.forEach(ch => { this.fwd(ch[0], 0.3 * air); this.fwd(ch[1], -0.45 * air); });
    }
    // (tentacles flare only a little: they're fused to each other near the body)
    if (pl === 'jelly') { const s = this.pulse(k, 8, 0.1); this.tentacles(k, 0.14, 10, (0.26 + s * 0.12) * e); this.move(0, 0.06 * e, 0); }
    else this.tentacles(k, 0.2, 10, 0.3 * e);
    if (pl === 'serpent') { this.pitch(this.p.spine, -0.5 * e); this.pitch(this.p.neck, 0.2 * e); this.wave(k, 0.25, 9, true); }
    if (pl === 'swimmer') { this.pitch(this.p.spine, -0.2 * e); this.p.tail.forEach((b, i) => this.up(b, (0.35 + 0.2 * Math.sin(k * 12 - i)) * e)); }
    if (pl === 'blob') this.stretch(this.p.root, -0.07 * e, 0.14 * e, -0.07 * e);
  }
  attack(t: number, k: number) {
    // wind up, strike at STRIKE_AT, hold, recover
    const pl = this.plan;
    const w = bump(k, 0, 0.26, 0.28, 0.36), s = bump(k, 0.28, 0.4, 0.52, 0.95);
    this.swish(0.5 * w, 14, t, 0.3 * w);
    this.ears(t, 0, -0.3 * s + 0.15 * w);
    if (this.four) {
      // a pounce: crouch, then spring forward with the front paws out
      this.move(0, -0.06 * w + 0.03 * s, 0.22 * s);
      this.pitch(this.p.root, 0.15 * w - 0.25 * s); this.pitch(this.p.head, 0.15 * w - 0.15 * s);
      this.p.legs.forEach(ch => {
        if (this.B[ch[0]].front) { this.fwd(ch[0], -0.2 * w + 0.95 * s); this.fwd(ch[1], 0.3 * w - 0.2 * s); }
        else { this.fwd(ch[0], 0.3 * w - 0.5 * s); this.fwd(ch[1], -0.5 * w + 0.3 * s); }
      });
    } else if (pl === 'flyer' || this.p.wings.length && !this.p.arms.length) {
      // wings up and back, then a gust forward
      this.wingsFlap(t, 0, 1, 0.8 * w - 0.6 * s, 0.4 * w - 0.9 * s);
      this.pitch(this.p.root, -0.1 * w + 0.22 * s); this.move(0, 0, 0.1 * s);
      this.pitch(this.p.head, -0.1 * w + 0.15 * s);
    } else if (pl === 'swimmer') {
      // arches, then slaps its tail down
      this.pitch(this.p.spine, -0.2 * w + 0.12 * s); this.p.tail.forEach((b, i) => this.up(b, (0.5 * w - 0.6 * s) * (1 + i * 0.2)));
      this.finsPaddle(t, 0.3 * w, 10); this.move(0, 0.03 * w, 0.14 * s);
    } else if (pl === 'jelly') {
      // tentacles in, then a whip out and forward
      const sq = 0.12 * w - 0.06 * s; this.stretch(this.p.spine, -sq, sq * 0.8, -sq);
      for (const ch of this.p.tents) ch.forEach((b, i) => { this.out(b, (-0.25 * w + 0.4 * s) / (i + 1)); this.fwd(b, 0.3 * s * (i ? 0.7 : 1)); });
      this.move(0, 0.04 * w, 0.12 * s);
    } else if (pl === 'serpent') {
      // reared back, then a strike forward
      this.pitch(this.p.spine, -0.4 * w + 0.15 * s); this.pitch(this.p.neck, -0.2 * w + 0.45 * s); this.pitch(this.p.head, 0.1 * s);
      this.move(0, 0, -0.08 * w + 0.2 * s);
    } else if (pl === 'blob') {
      this.stretch(this.p.root, 0.12 * w - 0.06 * s, -0.18 * w - 0.06 * s, 0.12 * w + 0.22 * s); this.move(0, 0, 0.18 * s);
    } else {
      // two legs: winds back, then a lunge with a paw (or a push with both)
      const one = this.p.arms.length === 2;
      this.yaw(this.p.spine, -0.35 * w + 0.3 * s); this.pitch(this.p.spine, 0.15 * s); this.move(0, 0, 0.12 * s);
      this.p.arms.forEach((ch, i) => {
        if (one && i === 0) { this.fwd(ch[0], 0.2 * w + 0.3 * s); return; }
        this.fwd(ch[0], -0.7 * w + 1.3 * s); this.up(ch[0], 0.3 * w + 0.5 * s); this.fwd(ch[1], 0.3 * s);
      });
      this.p.legs.forEach((ch, i) => this.fwd(ch[0], (i ? -0.25 : 0.25) * s));
    }
    if (pl !== 'jelly') this.tentacles(t, 0.1, 6, 0.5 * s);
    this.finsPaddle(t, 0.2 * s, 8);
  }
  hit(t: number, k: number) {
    const h = k < 0.12 ? smooth(k / 0.12) : 1 - smooth((k - 0.12) / 0.48), shake = k > 0.25 ? Math.sin(k * 34) * (1 - smooth((k - 0.25) / 0.35)) : 0;
    this.pitch(this.p.head, -0.26 * h); this.pitch(this.p.neck, -0.15 * h); this.yaw(this.p.head, 0.16 * shake);
    this.pitch(this.p.root, -0.14 * h); this.move(0, 0, -0.08 * h);
    this.p.ears.forEach(ch => ch.forEach(b => this.fwd(b, -0.5 * h)));
    this.p.tail.forEach((b, i) => this.up(b, -0.35 * h / (i + 1)));
    for (const ch of this.p.arms) { this.up(ch[0], 0.6 * h); this.fwd(ch[0], 0.5 * h); this.fwd(ch[1], 0.6 * h); }
    this.wingsFlap(t, 0, 1, 0.5 * h, -0.2 * h);
    this.finsPaddle(t, 0, 1); for (const ch of this.p.fins) this.up(ch[0], 0.4 * h);
    for (const ch of this.p.tents) ch.forEach(b => this.out(b, -0.35 * h));
    if (this.plan === 'jelly' || this.plan === 'blob') this.stretch(this.p.root, 0.1 * h, -0.12 * h, 0.1 * h);
    this.p.legs.forEach(ch => this.fwd(ch[1], (this.B[ch[0]].front ? 0.2 : -0.2) * h));
  }
  eat(t: number, k: number) {
    // two quick nibbles
    const n = Math.pow(Math.sin((k / ACT_LEN.eat) * Math.PI * 2), 2), e = bump(k, 0, 0.1, 0.6, 0.75);
    this.pitch(this.p.neck, 0.2 * n * e); this.pitch(this.p.head, 0.3 * n * e);
    this.stretch(this.p.head, 0.04 * n, -0.04 * n, 0.04 * n);
    for (const ch of this.p.arms) { this.up(ch[0], 0.9 * e); this.fwd(ch[0], 0.7 * e); this.out(ch[0], -0.35 * e); this.fwd(ch[1], 0.6 * e); }
    for (const ch of this.p.tents) ch.forEach(b => { const fr = this.B[b].at.z > this.B[this.p.root].at.z; this.out(b, (fr ? -0.35 : 0.1) * e); });
    this.swish(0.25, 9, t, 0.1);
    this.ears(t * 2, 0.08, 0.1 * e);
  }
  hop(t: number, k: number) {
    const air = Math.max(0, Math.sin((k / ACT_LEN.hop) * Math.PI));
    this.p.legs.forEach(ch => { this.fwd(ch[0], (this.B[ch[0]].front ? 0.25 : -0.25) * air); this.fwd(ch[1], (this.B[ch[0]].front ? -0.35 : 0.4) * air); });
    this.p.ears.forEach(ch => ch.forEach((b, i) => this.up(b, -0.25 * air * (i + 1))));
    this.p.tail.forEach((b, i) => this.up(b, 0.25 * air / (i + 1)));
    this.wingsFlap(t, 0, 1, 0.35 * air);
    for (const ch of this.p.tents) ch.forEach((b, i) => this.out(b, -0.2 * air * (i + 1)));
    for (const ch of this.p.arms) this.out(ch[0], 0.3 * air);
  }
  sad(t: number, k: number) {
    const e = bump(k, 0, 0.3, 1.6, 2.0);
    this.droop(e);
    this.yaw(this.p.head, 0.1 * Math.sin(k * 1.5) * e);
  }
  stomp(t: number, k: number) {
    // a cross stomp with a front foot, and a shake of the head
    const lift = bump(k, 0, 0.2, 0.25, 0.4), shake = k > 0.3 ? Math.sin(k * 30) * (1 - smooth((k - 0.3) / 0.25)) : 0;
    const ch = this.p.legs[0];
    if (ch) { this.fwd(ch[0], 0.45 * lift); this.fwd(ch[1], (this.B[ch[0]].front ? -0.5 : -0.4) * lift); }
    for (const a of this.p.arms) this.up(a[0], 0.7 * lift);
    this.yaw(this.p.head, 0.2 * shake); this.pitch(this.p.head, 0.15 * lift);
    this.p.tail.forEach(b => this.side(b, 0.4 * shake));
    for (const c of this.p.tents) c.forEach((b, i) => this.out(b, (i ? 0.08 : 0.18) * lift));
    if (this.plan === 'blob' || this.plan === 'jelly') this.stretch(this.p.root, 0.07 * lift, -0.09 * lift, 0.07 * lift);
  }
  /** slumped and sulky (0..1): head and ears down, tail down */
  droop(d: number) {
    if (!d) return;
    this.pitch(this.p.neck, 0.15 * d); this.pitch(this.p.head, 0.25 * d); this.pitch(this.p.spine, 0.06 * d);
    this.p.ears.forEach(ch => ch.forEach((b, i) => this.up(b, -0.35 * d / (i + 1))));
    this.p.tail.forEach((b, i) => this.up(b, -0.3 * d / (i + 1)));
    this.wingsFlap(0, 0, 1, -0.2 * d, 0.1 * d);
    for (const ch of this.p.arms) { this.out(ch[0], -0.15 * d); this.fwd(ch[0], 0.1 * d); }
    for (const ch of this.p.tents) ch.forEach(b => this.out(b, -0.2 * d));
    for (const ch of this.p.fins) this.up(ch[0], -0.25 * d);
  }
}

/** Plays a rigged Glimmer's moves on its bones. */
export class Animator {
  readonly rig: Rig;
  readonly bones: THREE.Bone[];
  private mover: Mover;
  private poses: { a: Pose; b: Pose; act: Pose; out: Pose };
  private rest: THREE.Vector3[];
  /** the loop it's in, and the one it's leaving (blending over BLEND seconds) */
  private base: Base = 'idle'; private was: Base = 'idle'; private mix = 1;
  private act: Act | null = null; private actT = 0;
  /** a point to look at: yaw (toward +x) and pitch (up +) in radians from straight ahead, or null */
  look: { yaw: number; pitch: number } | null = null;
  private lookNow = { yaw: 0, pitch: 0, k: 0 };
  /** slumped and sulky, 0..1 */
  droop = 0;
  /** for the moves' timing: shifts it so two Glimmers don't move in step */
  readonly seed: number;
  constructor(rig: Rig, bones: THREE.Bone[], seed = Math.random() * 10, floats = false) {
    this.rig = rig; this.bones = bones; this.seed = seed;
    this.mover = new Mover(rig, seed); this.mover.floats = floats;
    const n = rig.bones.length;
    this.poses = { a: new Pose(n), b: new Pose(n), act: new Pose(n), out: new Pose(n) };
    this.rest = bones.map(b => b.position.clone());
  }
  get state() { return this.base; }
  get acting() { return this.act; }
  /** seconds into the one-off */
  get actTime() { return this.actT; }
  /** Change the loop (blends over a third of a second). */
  setBase(b: Base) { if (b === this.base) return; this.was = this.base; this.base = b; this.mix = 0; }
  /** Start a one-off. */
  play(a: Act) { this.act = a; this.actT = 0; }
  /** Stop any one-off at once. */
  stop() { this.act = null; }

  private loop(b: Base, t: number, into: Pose) {
    const m = this.mover; m.o = into; into.clear();
    if (b === 'idle') m.idle(t); else if (b === 'walk') m.walk(t); else if (b === 'sit') m.sit(t); else if (b === 'sleep') m.sleep(t); else m.swim(t);
  }

  /** Work out this frame's pose and set it on the bones. */
  update(dt: number, t: number) {
    const P = this.poses, m = this.mover;
    t += this.seed;
    this.mix = Math.min(1, this.mix + dt / 0.35);
    const mix = smooth(this.mix);
    P.out.clear();
    this.loop(this.base, t, P.a); P.out.add(P.a, mix);
    if (mix < 1) { this.loop(this.was, t, P.b); P.out.add(P.b, 1 - mix); }
    // the one-off over it
    let env = 0;
    if (this.act) {
      this.actT += dt;
      const len = ACT_LEN[this.act], k = this.actT;
      if (k >= len) this.act = null;
      else {
        env = Math.min(1, k / 0.1) * Math.min(1, (len - k) / 0.2);
        m.o = P.act; P.act.clear();
        const a = this.act;
        if (a === 'happy') m.happy(t, k); else if (a === 'cheer') m.cheer(t, k); else if (a === 'attack') m.attack(t, k); else if (a === 'hit') m.hit(t, k);
        else if (a === 'eat') m.eat(t, k); else if (a === 'hop') m.hop(t, k); else if (a === 'sad') m.sad(t, k); else m.stomp(t, k);
        P.out.scale(1 - OVER[a] * env);
        P.out.add(P.act, env);
      }
    }
    // sulking, and looking at something
    m.o = P.out;
    m.droop(this.droop * (1 - env * 0.5));
    const lw = this.base === 'sleep' ? 0 : 1 - env * 0.6;
    const L = this.lookNow, want = this.look, kk = 1 - Math.exp(-dt * 6);
    L.k += ((want ? 1 : 0) - L.k) * kk;
    if (want) { L.yaw += (want.yaw - L.yaw) * kk; L.pitch += (want.pitch - L.pitch) * kk; }
    if (L.k > 0.001) {
      const y = THREE.MathUtils.clamp(L.yaw, -0.9, 0.9) * L.k * lw, p = THREE.MathUtils.clamp(L.pitch, -0.5, 0.45) * L.k * lw;
      m.yaw(m.p.neck, y * 0.4); m.yaw(m.p.head, y * 0.6); m.pitch(m.p.neck, -p * 0.4); m.pitch(m.p.head, -p * 0.6);
    }
    this.apply(P.out);
  }

  private ax = new THREE.Vector3(); private m = new THREE.Matrix4(); private sv = new THREE.Vector3();
  private apply(o: Pose) {
    const bones = this.bones, specs = this.rig.bones;
    for (let i = 0; i < bones.length; i++) {
      const b = bones[i];
      const rx = o.rot[i * 3], ry = o.rot[i * 3 + 1], rz = o.rot[i * 3 + 2];
      let a = Math.sqrt(rx * rx + ry * ry + rz * rz);
      if (a > 1e-6) {
        // never more than ~95 degrees from rest
        if (a > 1.65) a = 1.65;
        this.ax.set(rx, ry, rz).normalize();
        b.quaternion.setFromAxisAngle(this.ax, a);
      } else b.quaternion.identity();
      b.scale.set(clampS(1 + o.scl[i * 3]), clampS(1 + o.scl[i * 3 + 1]), clampS(1 + o.scl[i * 3 + 2]));
      if (i === 0) b.position.copy(this.rest[0]).add(o.off);
      // the bone's matrix, without its parent's stretch: a squeezed bell or a breathing chest moves the
      // head and limbs along but never skews them
      b.matrix.compose(b.position, b.quaternion, b.scale);
      const p = specs[i].parent;
      if (p >= 0) {
        const ps = bones[p].scale;
        if (ps.x !== 1 || ps.y !== 1 || ps.z !== 1) {
          this.m.makeScale(1 / ps.x, 1 / ps.y, 1 / ps.z).multiply(b.matrix);
          b.matrix.copy(this.m).setPosition(this.sv.copy(b.position));
        }
      }
      b.matrixWorldNeedsUpdate = true;
    }
  }
}
const clampS = (s: number) => Math.min(1.5, Math.max(0.6, s));
