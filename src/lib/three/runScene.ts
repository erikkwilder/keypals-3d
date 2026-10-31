// The lesson in 3D: your buddy travels the island trail as you type. Every right letter moves the goal
// one step down the trail; the buddy chases it at a speed that follows your typing rate, so motion is
// smooth (no step-per-key lurches) and never runs ahead of what you've typed. The ride changes with
// your live score (walk, run, skateboard, bike, car, rocket). The goal follows how much is done out of
// the whole, so it reaches the finish line with the last letter (or answer) and never before; that
// last one carries the buddy over the line in a short dash. At the gate: a celebration dance, then
// the results show your buddy on the best ride of the run.
import * as THREE from 'three';
import { stage, type Controller } from './stage';
import { Character } from './character';
import { vehicle, type Vehicle } from './rides3d';
import { reach } from './ik';
import { sitOnSled } from './sledSeat';
import { dressUp } from './dress';
import { climbKit, type ClimbKit } from './climbKit';
import { followWorn } from './gear3d';
import { sledKit } from './sledKit';
import { swimKit } from './swimKit';
import type { RideKit } from './kitParts';
import { RIDES } from '../engine/rides';
import { sfx } from '../audio/sound';
import type { FriendId } from '../art/cast';
import type { RegionId } from '../engine/course';
import { GATE_BEFORE, type Island, type TrailPoint } from './island';
import { buildCourse, LINE_BEFORE, type CourseMove } from './courses';
import { world } from '../fun/bus';

export const STEP = 1.35; // metres of trail per letter
const RUNUP = 4; // trail before the first letter
const UP_V = new THREE.Vector3(0, 1, 0);

/** Screen space the 3D view should use (fractions of the window): the rest is covered by the letters and keyboard. */
export type View = { top: number; bottom: number; left: number; right: number };

/** How the buddy keeps pace: the typing rate over the last `window` seconds, full speed until `full`
 *  seconds after the last key and stopped by `stop`; it catches up when more than `lead` steps behind. */
type Pace = { window: number; full: number; stop: number; lead: number };
const TYPING_PACE: Pace = { window: 2.5, full: 0.8, stop: 1.8, lead: 1.5 };

/** Metres of course per key in a typing lesson. A typing lesson has many more keys than a math trip has
 *  answers, so the course is sized to about a math trip's (a 25 m cliff, a 45 m swim, a 130 m sled run),
 *  a little longer for long lessons, and each key moves that share of it. */
const COURSE_M: Record<CourseMove, number> = { climb: 25, swim: 45, slide: 130 };
export function courseKeyLen(move: CourseMove, keys: number) {
  const k = Math.max(0.8, Math.min(1.5, keys / 110));
  return (COURSE_M[move] * k) / Math.max(1, keys);
}

/** `length`: how many keys (answers) to the finish line. `keyLen`: metres of trail per key (the math game
 *  moves a longer way for each answer). */
/** `move`: how the buddy travels: the island trail (run), or a course of its own: up a cliff, down a
 *  snowy slope on a sled, or across a bay (the math strands). */
type Opts = { buddy: FriendId; outfit: string; dance: string; length: number; ghostCps?: number; /** the speed step the ghost's pace earns (its way of climbing) */ ghostStep?: number; region?: RegionId; keyLen?: number; pace?: Pace; move?: 'run' | CourseMove };

export class RunScene implements Controller {
  /** smooth while running; the results screen can settle for 30 */
  get fps() { return this.phase === 'results' ? 30 : 60; }
  readonly island: Island;
  readonly me: Character;
  private ghost: Character | null = null;
  readonly opts: Opts;
  finishS: number;
  pos = RUNUP; vel = 0; goal = RUNUP;
  private keyTimes: number[] = [];
  private lastKey = 0;
  private startT = 0;
  private oopsUntil = 0;
  private hopUntil = 0;
  tier = 0;
  private veh: Vehicle | null = null;
  private vehTier = 0;
  phase: 'run' | 'arrive' | 'dance' | 'results' = 'run';
  paused = false;
  view: View = { top: 0.35, bottom: 0.68, left: 0, right: 1 };
  /** a close camera for checking poses (dev only) */
  debugCam: { angle: number; dist: number; y?: number } | null = null;
  /** lay planted feet flat (off only to compare, in checks) */
  groundFix = true;
  /** called once the celebration at the gate is over */
  onCelebrated: (() => void) | null = null;
  /** called as the buddy (and ride) passes through the finish gate */
  onCrossed: (() => void) | null = null;
  private crossed = false;
  private ghostMat: THREE.MeshBasicMaterial | null = null;
  private ghostSled: THREE.Group | null = null;
  private ghostFade = 1;
  private ghostStopT = 0;
  private gateK = 1;
  private danceEnd = 0;
  /** keys (answers) in so far, and the metres the last one moved the goal */
  private answered = 0;
  private stepLen = 0;
  /** the last answer's dash over the line: from where the buddy was (at its speed) to `to`, in `dur` s */
  private dash: { from: number; to: number; v0: number; v1: number; t0: number; dur: number } | null = null;
  private following = false;
  private camPos = new THREE.Vector3(); private camAim = new THREE.Vector3(); private camReady = false;
  private camOff = new THREE.Vector3(); private aimOff = new THREE.Vector3();
  private here: TrailPoint;
  private puff: Puff;

  private get keyLen() { return this.opts.keyLen ?? STEP; }
  /** a course of its own (climb, slide, swim) instead of the island trail: no vehicles there */
  private get course(): CourseMove | null { return this.opts.move && this.opts.move !== 'run' ? this.opts.move : null; }
  private splashT = 0;
  private swimLift = 0;
  private outOfWater = false;
  /** where the swim course's steps start and end (only on the swim course) */
  private swimExit(): [number, number] { return (this.island.root.userData.exitAt as (() => [number, number]) | undefined)?.() ?? [this.finishS - 0.2, this.finishS - 0.2]; }
  private lastTier = 0;
  /** the six ways up the cliff (the cliff course only): each speed step's own gear and motion */
  private kit: ClimbKit | null = null;
  private ghostKit: ClimbKit | null = null;
  /** the six ways down the slope or across the bay: each speed step's own ride and motion */
  private ride: RideKit | null = null;
  private ghostRide: RideKit | null = null;
  private get pace() { return this.opts.pace ?? TYPING_PACE; }

  private constructor(island: Island, me: Character, opts: Opts) {
    world.run = true; // the trail's little surprises show during lessons and trips (src/lib/fun)
    this.island = island;
    this.me = me;
    this.opts = opts;
    // the finish line comes after `length` keys; the buddy stops a little way past it (through the gate,
    // over the cliff's lip, up the swim steps onto the dock)
    this.finishS = RUNUP + opts.length * this.keyLen + this.lineBefore;
    this.stepLen = this.keyLen;
    island.placeFinish(this.finishS);
    this.here = island.trail.at(this.pos);
    stage.scene.add(me.root);
    this.puff = new Puff(stage.scene);
    if (import.meta.env.DEV) (window as unknown as { __scene: RunScene }).__scene = this;
    me.play('idle', 0);
  }

  static async create(opts: Opts): Promise<RunScene> {
    const course = opts.move && opts.move !== 'run' ? opts.move : null;
    const [island, me] = await Promise.all([course ? buildCourse(course) : stage.getIsland(opts.region), Character.create(opts.buddy)]);
    if (!me) throw new Error('character missing');
    const sc = new RunScene(island, me, opts);
    // the whole look from the save: hat, everything else the buddy has on, and its nudges
    void dressUp(me);
    me.loadMoves();
    if (opts.ghostCps) {
      const g = await Character.create(opts.buddy);
      if (g) {
        sc.ghostMat = ghostify(g); sc.ghost = g; stage.scene.add(g.root); g.play('idle', 0);
        // on a course the ghost climbs, swims or sleds too (on a see-through sled of its own)
        if (course) {
          await g.loadMoves();
          const sled = island.root.userData.sled as THREE.Group | undefined;
          if (course === 'slide' && sled) { const gs = sled.clone(true); gs.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = sc.ghostMat!; m.castShadow = false; } }); sc.ghostSled = gs; stage.scene.add(gs); }
        }
      }
    }
    if (!course) sc.preloadRides();
    if (course === 'climb') void sc.gearUp();
    if (course === 'slide' || course === 'swim') void sc.rideUp();
    return sc;
  }

  /** Everything for the six ways up the cliff, made now and readied to draw: no stall at a step-up. */
  private async gearUp() {
    const u = this.island.root.userData as { wallZ: (x: number, y: number) => number; top: () => number };
    const k = await climbKit(this.me, { wall: u.wallZ, top: u.top });
    if (this.gone) { k?.dispose(); return; }
    this.kit = k;
    if (k) {
      // a change of step is a moment, as a new ride is on the trail: a burst of dust and a sound of its own
      k.onChange = (step, up, at) => { this.puff.burst(at, up ? 30 : 14, up ? 0xfff2a8 : 0xffffff); if (!up) sfx.levelDown(); else if (step >= 4) sfx.turbo(); else sfx.levelUp(step); };
      k.onTouch = (at, n) => this.puff.burst(at, n, 0xfff2a8);
      void k.ready();
    }
    if (this.ghost && this.ghostMat) {
      const gk = await climbKit(this.ghost, { wall: u.wallZ, top: u.top, ghost: this.ghostMat });
      if (this.gone) gk?.dispose(); else this.ghostKit = gk;
    }
  }

  /** Everything for the six rides of the sled run (or the six strokes of the swim), made and readied now. */
  private async rideUp() {
    const sled = this.island.root.userData.sled as THREE.Group | undefined, swim = this.course === 'swim';
    if (!swim && !sled) return;
    const k = await (swim ? swimKit(this.me) : sledKit(this.me, { sled: sled! }));
    if (this.gone) { k?.dispose(); return; }
    this.ride = k;
    if (k) {
      k.onChange = (step, up, at) => { if (swim) sfx.splashSmall(up ? 1 : 0.5); this.puff.burst(at, !up ? 8 : swim ? 12 : 30, swim ? 0xe8f8ff : 0xffffff); if (!up) sfx.levelDown(); else if (step >= 4) sfx.turbo(); else sfx.levelUp(step); };
      k.onTouch = swim ? n => sfx.splashSmall(n) : (n, at) => this.puff.burst(at, Math.round(n * 10), 0xffffff);
      void k.ready();
    }
    if (this.ghost && this.ghostMat && (swim || this.ghostSled)) {
      const gk = await (swim ? swimKit(this.ghost, { ghost: this.ghostMat }) : sledKit(this.ghost, { sled: this.ghostSled!, ghost: this.ghostMat }));
      if (this.gone) gk?.dispose(); else this.ghostRide = gk;
    }
  }

  /**
   * Load every ride and get it ready to draw while the lesson starts: a ride loaded and drawn for the
   * first time mid-run stalled the whole game for a moment.
   */
  private async preloadRides() {
    const r = stage.renderer;
    for (let t = 2; t < RIDES.length; t++) {
      const v = await vehicle(RIDES[t].id);
      if (!v || !r) continue;
      try { await r.compileAsync(v.group, stage.camera, stage.scene); } catch { /* it compiles when first drawn instead */ }
      v.group.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.map) r.initTexture(m.map); });
    }
  }

  // ---------- typing ----------
  /** How far before the stop the finish line is: the gate (the sled run's arch), the cliff's lip, the
   *  foot of the swim steps. */
  private get lineBefore() { return this.course ? LINE_BEFORE[this.course] : GATE_BEFORE; }
  /** Where the finish line is along the way. */
  get lineS() { return this.finishS - this.lineBefore; }

  /** A key was pressed (an answer given): `done` is how many are in now, `left` how many are still to
   *  come (a lesson's text knows; a math trip can grow when a miss comes back). The goal moves its share
   *  of the rest of the way to the finish line, so the last one lands on it, and it never goes back. */
  key(ok: boolean, done: number, left = this.opts.length - done) {
    const now = performance.now() / 1000;
    if (!this.startT) this.startT = now;
    if (ok) {
      this.keyTimes.push(now);
      this.lastKey = now;
      const n = Math.max(1, done - this.answered), line = this.lineS;
      this.answered = done;
      const to = left <= 0 ? line : this.goal + ((line - this.goal) * n) / (n + left);
      if (to > this.goal) { this.stepLen = (to - this.goal) / n; this.goal = Math.min(line, to); }
    } else {
      this.oopsUntil = now + 0.6;
      this.vel *= 0.8;
    }
  }
  /** Space bar: a little hop on foot. */
  hop() { if (this.tier <= 1) this.hopUntil = performance.now() / 1000 + 0.35; }
  setTier(t: number) { this.tier = Math.max(0, Math.min(RIDES.length - 1, t)); }
  /** The end: after the last key (the goal's on the line) a short dash over it; when time ran out first,
   *  a run the rest of the way. */
  finish() {
    if (this.phase !== 'run') return;
    this.phase = 'arrive';
    const line = this.lineS;
    if (this.goal >= line - 1e-3) {
      // through the gate to the stop; over the lip or onto the swim steps, then walk the last bit
      const to = this.course === 'climb' || this.course === 'swim' ? line + 0.02 : this.finishS;
      const dist = to - this.pos;
      if (dist > 0.05) {
        const dur = Math.max(0.4, Math.min(0.8, 0.3 + (0.15 * dist) / Math.max(0.3, this.stepLen)));
        this.dash = { from: this.pos, to, v0: Math.min(this.vel, (2 * dist) / dur), v1: to < this.finishS ? 1.2 : 0, t0: performance.now() / 1000, dur };
      }
    }
    this.goal = this.finishS;
  }
  /** The dash: a smooth curve from where the buddy was, at the speed it had, to the end of the dash. */
  private dashOn(now: number, dt: number) {
    const d = this.dash!, k = Math.min(1, (now - d.t0) / d.dur), k2 = k * k, k3 = k2 * k;
    const s = (2 * k3 - 3 * k2 + 1) * d.from + (k3 - 2 * k2 + k) * d.dur * d.v0 + (3 * k2 - 2 * k3) * d.to + (k3 - k2) * d.dur * d.v1;
    const next = Math.min(d.to, Math.max(this.pos, s));
    if (dt > 0) this.vel = (next - this.pos) / dt;
    this.pos = next;
    if (k >= 1) { this.pos = d.to; this.vel = d.v1; this.dash = null; }
  }

  private rate(now: number) {
    const pc = this.pace;
    while (this.keyTimes.length && now - this.keyTimes[0] > pc.window) this.keyTimes.shift();
    if (this.keyTimes.length < 2) return 0;
    const r = (this.keyTimes.length - 1) / Math.max(0.35, now - this.keyTimes[0]);
    // typing: full speed until a 0.8 s pause, stopped by 1.8 s
    return r * Math.max(0, Math.min(1, (pc.stop - (now - this.lastKey)) / (pc.stop - pc.full)));
  }

  // ---------- rides ----------
  private async swapRide(tier: number) {
    this.vehTier = tier;
    const id = RIDES[tier].id;
    const v = await vehicle(id);
    if (this.vehTier !== tier) return;
    if (this.veh && this.veh !== v) this.veh.group.removeFromParent();
    this.veh = v;
    if (v) stage.scene.add(v.group);
    this.puff.burst(this.me.root.position, 14);
  }

  private mounted(dt: number, f: TrailPoint, t: number) {
    const v = this.veh!, m = v.mount, me = this.me;
    const yaw = Math.atan2(f.t.x, f.t.z);
    v.group.position.copy(f.p);
    const since = performance.now() / 1000 - this.cheerT;
    if (since >= 0 && since < 0.9) v.group.position.y += Math.abs(Math.sin(since * Math.PI * 2.2)) * 0.35 * (1 - since / 0.9);
    v.group.rotation.set(0, yaw, 0);
    v.update(dt, this.phase === 'results' ? 0.6 : this.vel, t);
    me.groundFeet = false;
    if (m.stance === 'sit') me.play('sit', 0.25);
    else me.play('idle', 0.25);
    me.root.rotation.set(0, m.sideways ? Math.atan2(f.n.x, f.n.z) : yaw, 0);
    me.root.position.copy(f.p);
    me.update(dt);
    me.root.updateMatrixWorld(true);
    if (m.stance === 'sit') me.uprightSpine();
    const B = me.bones;
    if (m.stance === 'sit' && m.seat && B.Hips) {
      // sit the hips on the seat
      const seat = v.group.localToWorld(m.seat.clone());
      const hips = B.Hips.getWorldPosition(new THREE.Vector3());
      me.root.position.add(seat.sub(hips)).add(new THREE.Vector3(0, 0.05, 0));
      me.root.updateMatrixWorld(true);
    } else {
      me.root.position.y += 0.08 - 0.05; // stand on the deck, knees a little bent
      me.root.updateMatrixWorld(true);
    }
    const fwd = f.t.clone(), up = new THREE.Vector3(0, 1, 0);
    const facing = m.sideways ? f.n.clone() : fwd;
    if (m.feet && B.LeftUpLeg && B.LeftLeg && B.LeftFoot && B.RightUpLeg) {
      const [l, r] = m.feet();
      const kneeDir = facing.clone().add(up.clone().multiplyScalar(0.3));
      reach(B.LeftUpLeg, B.LeftLeg, B.LeftFoot, l, kneeDir);
      reach(B.RightUpLeg, B.RightLeg, B.RightFoot, r, kneeDir);
    }
    if (B.LeftArm && B.LeftForeArm && B.LeftHand && B.RightArm) {
      const elbow = up.clone().multiplyScalar(-1).addScaledVector(fwd, -0.4);
      if (m.hands) {
        const [l, r] = m.hands.map(h => v.group.localToWorld(h.clone()));
        reach(B.LeftArm, B.LeftForeArm, B.LeftHand, l, elbow.clone().addScaledVector(f.n, 0.3));
        reach(B.RightArm, B.RightForeArm, B.RightHand, r, elbow.clone().addScaledVector(f.n, -0.3));
      } else if (m.sideways) {
        // arms out for balance on the skateboard
        const ls = B.LeftArm.getWorldPosition(new THREE.Vector3()), rs = B.RightArm.getWorldPosition(new THREE.Vector3());
        const side = ls.clone().sub(rs).normalize(), len = ls.distanceTo(rs) * 1.1, sway = Math.sin(t * 2.2) * 0.12;
        reach(B.LeftArm, B.LeftForeArm, B.LeftHand, ls.clone().addScaledVector(side, len).add(new THREE.Vector3(0, -len * (0.45 + sway), 0)), up.clone().negate());
        reach(B.RightArm, B.RightForeArm, B.RightHand, rs.clone().addScaledVector(side, -len).add(new THREE.Vector3(0, -len * (0.45 - sway), 0)), up.clone().negate());
      }
    }
  }

  // ---------- each frame ----------
  update(dt: number, t: number) {
    const now = performance.now() / 1000, me = this.me;
    if (this.dash && this.phase === 'arrive') this.dashOn(now, dt);
    else if (this.phase === 'run' || this.phase === 'arrive') {
      const rate = this.paused ? 0 : this.rate(now);
      const lag = this.goal - this.pos;
      let want = rate * this.stepLen + Math.max(0, lag - this.stepLen * this.pace.lead) * 0.9;
      if (lag < 0.03) want = 0;
      // the last stretch (over the lip, up the swim steps, or the rest of the way when time ran out):
      // catch up quickly if fast typing left the buddy behind, and stop at the end (never creep)
      if (this.phase === 'arrive') want = lag <= 0.001 ? 0 : Math.max(0.9, Math.min(lag * 1.8, Math.max(this.vel, 3, Math.min(14, lag))));
      // a math trip's long strides (9 m on the run) need a quicker buddy to keep up with a quick player
      const quick = Math.max(1, this.stepLen / 4.5);
      const accel = (want > this.vel ? (this.phase === 'arrive' ? 6 : 3.5) : 5) * quick;
      this.vel += Math.max(-accel * dt, Math.min(accel * dt, want - this.vel));
      this.vel = Math.max(0, Math.min(this.vel, (this.phase === 'arrive' ? 14 : 9) * quick));
      // walking up the swim steps, not shooting up them
      if (this.course === 'swim' && this.pos > this.swimExit()[0] - 0.4) this.vel = Math.min(this.vel, 1.5);
      this.pos = Math.min(this.goal, this.pos + this.vel * dt);
    }
    if (this.phase === 'arrive') {
      // over the line: just past the gate, or at the lip, or touching the swim steps
      if (!this.crossed && this.pos >= this.lineS + (this.course === 'climb' || this.course === 'swim' ? 0 : 0.4)) { this.crossed = true; this.onCrossed?.(); }
      if (!this.dash && this.goal - this.pos < 0.06) { this.pos = this.goal; this.vel = 0; this.arrive(); }
    }
    const f = (this.here = this.island.trail.at(this.pos));
    const rideTier = this.phase === 'dance' ? 0 : this.tier;
    if (!this.course && (rideTier >= 2 ? rideTier : 0) !== (this.veh ? this.vehTier : 0)) {
      if (rideTier >= 2) this.swapRide(rideTier);
      else if (this.veh) { this.veh.group.removeFromParent(); this.veh = null; this.vehTier = 0; this.puff.burst(me.root.position, 10); }
    }
    // (the climbing gear off when the climb isn't on)
    if (this.kit && !(this.course && (this.phase === 'run' || this.phase === 'arrive'))) { this.kit.rest(dt, t); this.ghostKit?.rest(dt, t); }
    if (this.ride && !(this.course && (this.phase === 'run' || this.phase === 'arrive'))) { this.ride.rest(dt, t); this.ghostRide?.rest(dt, t); }
    if (this.course && (this.phase === 'run' || this.phase === 'arrive')) this.onCourse(dt, f, t, now);
    else if (this.veh && rideTier >= 2) this.mounted(dt, f, t);
    else {
      me.groundFeet = this.groundFix;
      me.root.position.copy(f.p);
      if (now < this.hopUntil) me.root.position.y += Math.sin(((this.hopUntil - now) / 0.35) * Math.PI) * 0.12;
      if (this.course === 'slide') this.parkSled();
      if (this.phase === 'dance') {
        // face the camera to dance
        me.root.rotation.set(0, this.towardCamera(), 0);
        if (now > this.danceEnd && this.onCelebrated) { const cb = this.onCelebrated; this.onCelebrated = null; cb(); }
      } else if (this.phase === 'results') {
        // after a cheer, back to standing
        const cur = me.currentName;
        if (cur && cur !== 'idle' && me.finished(cur)) me.play('idle', 0.5);
      } else {
        me.root.rotation.set(0, Math.atan2(f.t.x, f.t.z), 0);
        const v = this.vel;
        if (now < this.oopsUntil && v < 1.4 && me.has('stumble')) me.play('stumble', 0.15);
        else {
          let gait = v < 0.12 ? 'idle' : this.tier === 0 ? 'walk' : v < 1.6 ? 'walk' : v < 4.4 ? 'run' : 'sprint';
          if (!startedGait(me, gait)) gait = me.has(gait) ? gait : 'run';
          me.play(gait, gait === 'idle' ? 0.45 : 0.3);
          const a = me.actions[gait];
          if (a && gait !== 'idle') a.timeScale = Math.max(0.5, Math.min(gait === 'walk' ? 2.0 : 2.2, v / (me.speedOf[gait] ?? 2)));
        }
      }
      me.update(dt);
    }
    // the ghost racer: from your first key it runs at its own steady pace, through the gate and a little
    // past where you stop; once you've both finished it fades away (if you won, you see it come in)
    if (this.ghost && this.ghostMat) {
      // (at the top of the cliff there is nowhere further to go)
      const g = this.ghost, end = this.finishS + (this.course === 'climb' ? 0 : 2.5);
      const gs = this.startT ? Math.min(end, RUNUP + (now - this.startT) * (this.opts.ghostCps ?? 0) * this.keyLen) : RUNUP;
      const done = gs >= end - 0.01;
      if (done && !this.ghostStopT) this.ghostStopT = now;
      // it stands a moment past the line where you can see it, then fades
      if (done && this.phase !== 'run' && now - this.ghostStopT > 2) this.ghostFade = Math.max(0, this.ghostFade - dt / 1.5);
      this.ghostMat.opacity = 0.32 * this.ghostFade;
      g.root.visible = !!this.startT && this.ghostFade > 0;
      const gf = this.island.trail.at(gs);
      if (this.ghostSled) this.ghostSled.visible = g.root.visible && !this.ghostRide?.way;
      if (this.course) this.ghostOnCourse(g, gf, gs, done, t, dt);
      else {
        // a lane of its own, beyond the buddy (and clear of the rides)
        g.root.position.copy(gf.p).addScaledVector(gf.n, -1.2);
        g.root.rotation.set(0, Math.atan2(gf.t.x, gf.t.z), 0);
        g.play(this.startT && !done ? 'run' : 'idle', 0.3, 1.1);
        if (g.root.visible) g.update(dt);
      }
    }
    // following from behind, the camera looks through the gate as the buddy goes under it, and its near
    // pillar hid the very moment of finishing: let it go see-through for those few steps
    const past = this.pos - (this.finishS - GATE_BEFORE);
    // (on the sled run, also while the camera swings round for the dance)
    const wantK = (this.phase === 'run' || this.phase === 'arrive' || (this.course === 'slide' && this.phase === 'dance')) && past > -2 && past < 6 ? 0.28 : 1;
    if (Math.abs(wantK - this.gateK) > 0.001) { this.gateK += (wantK - this.gateK) * (1 - Math.exp(-dt * 8)); if (Math.abs(wantK - this.gateK) < 0.01) this.gateK = wantK; this.island.gateSolid(this.gateK); }
    this.puff.update(dt, stage.camera);
    this.camera(dt, f);
  }

  /** Climbing, sledding or swimming, with the speed ladder showing in how hard the buddy goes for it. */
  private onCourse(dt: number, f: TrailPoint, t: number, now: number) {
    const me = this.me, v = this.vel, kind = this.course!;
    me.groundFeet = false;
    // (on the cliff the climbing gear has its own moment: gearUp)
    if (this.tier !== this.lastTier) { if (this.tier > this.lastTier && kind !== 'climb' && !this.ride) this.puff.burst(me.root.position, 10, kind === 'slide' ? 0xffffff : 0xfff2a8); this.lastTier = this.tier; }
    const sled = this.island.root.userData.sled as THREE.Group | undefined;
    if (kind === 'climb') {
      me.root.position.copy(f.p);
      // facing the wall while climbing; over the lip, a few steps back onto the summit, then round to the camera
      const overAt = (this.island.root.userData.overAt as (() => number) | undefined)?.() ?? this.finishS;
      const walking = this.pos > overAt + 0.02, there = this.pos > this.finishS - 0.05;
      me.root.rotation.set(0, there ? 0 : Math.PI, 0);
      // Hold On is the climbing move; every other way of going up has its own motion (climbKit.ts)
      const way = walking ? 0 : this.kit?.way ?? 0;
      const a = me.play(walking ? (there ? 'idle' : 'walk') : way ? 'idle' : me.has('climb') ? 'climb' : 'idle', 0.25);
      if (a && !walking && !way) a.timeScale = v < 0.04 ? 0 : Math.max(0.35, Math.min(2.4, v / 0.55));
      if (walking) this.kit?.rest(dt, t); else this.kit?.lead(dt, t, { step: this.tier, y: f.p.y, v, stride: this.stepLen });
    } else if (kind === 'slide' && this.ride) {
      const pitch = Math.atan2(-f.t.y, Math.hypot(f.t.x, f.t.z));
      me.root.position.copy(f.p);
      this.ride.lead(dt, t, { step: this.tier, at: f.p, pitch, lane: 0, v, s: this.pos, left: this.finishS - this.pos });
      // the wind in your ears, from the skis on
      if (this.ride.way >= 2 && v > 0.5 && !this.paused) sfx.wind(0.1 + this.ride.way * 0.12);
    } else if (kind === 'slide') {
      const yaw = Math.atan2(f.t.x, f.t.z), pitch = Math.atan2(-f.t.y, Math.hypot(f.t.x, f.t.z));
      if (sled) { sled.visible = true; sled.position.copy(f.p); sled.rotation.set(0, yaw - Math.PI / 2, -pitch); }
      // sitting on the sled (hips on the deck, legs out along it: sitOnSled, after the update below)
      me.play(me.has('sit') ? 'sit' : me.has('seated') ? 'seated' : 'idle', 0.25);
      me.root.position.copy(f.p);
      me.root.rotation.set(pitch, yaw, 0, 'YXZ');
      if (v > 2.5 && now - this.splashT > 0.18) { this.splashT = now; this.puff.burst(f.p.clone().addScaledVector(f.t, -0.6), 3, 0xffffff); }
    } else if (this.pos >= this.swimExit()[0]) {
      // at the swim steps: stand up in the water and walk up them onto the dock, dripping
      if (!this.outOfWater) { this.outOfWater = true; this.ride?.rest(dt, t); this.puff.burst(f.p.clone().add(new THREE.Vector3(0, 0.5, 0)), 10, 0xe8f8ff); }
      this.swimLift *= Math.max(0, 1 - dt * 6);
      me.root.position.copy(f.p);
      me.root.rotation.set(0, Math.atan2(f.t.x, f.t.z), 0);
      const a = me.play(v < 0.08 ? 'idle' : 'walk', 0.25);
      if (a && v >= 0.08) a.timeScale = Math.max(0.6, Math.min(1.8, v / 0.9));
    } else if (this.ride) {
      this.outOfWater = false;
      me.root.position.copy(f.p);
      this.ride.lead(dt, t, { step: this.tier, at: f.p, pitch: 0, lane: 0, v, s: this.pos, left: this.finishS - this.pos });
    } else {
      this.outOfWater = false;
      me.root.position.copy(f.p);
      me.root.position.y += Math.sin(t * 3) * 0.04;
      me.root.rotation.set(0, Math.atan2(f.t.x, f.t.z), 0);
      const a = me.play(me.has('swim') ? 'swim' : 'run', 0.3);
      if (a) a.timeScale = Math.max(0.45, Math.min(2.2, 0.45 + v / 2.5));
      // swimmers breathe: lift the buddy so the head stays above the water line, whatever the stroke does
      me.update(0); me.root.updateMatrixWorld(true);
      const head = me.bones.Head?.getWorldPosition(new THREE.Vector3());
      if (head) { const need = 0.16 - head.y; this.swimLift += (need - this.swimLift) * Math.min(1, dt * 8); me.root.position.y += this.swimLift; }
      if (v > 0.6 && now - this.splashT > 0.35) { this.splashT = now; this.puff.burst(f.p.clone().add(new THREE.Vector3(0, 0.6, 0)), 3, 0xe8f8ff); }
    }
    me.update(dt);
    me.root.updateMatrixWorld(true);
    if (kind === 'swim' && this.ride && !this.outOfWater) this.ride.follow(dt, t);
    else if (kind === 'slide' && this.ride) this.ride.follow(dt, t);
    else if (kind === 'slide' && sled) sitOnSled(me, sled, dt);
    // hands and feet on their marks, and the gear (not walking over the top)
    if (kind === 'climb' && this.pos <= ((this.island.root.userData.overAt as (() => number) | undefined)?.() ?? this.finishS) + 0.02) this.kit?.follow(dt, t);
    // the sit, the stroke and the climb above move the bones after the moves did: what's worn catches up
    followWorn(me);
  }

  /** The ghost racer on a course, beside the buddy and moving the same way: up the cliff a little to the
   *  right, in the next stretch of water, or on its own sled further across the run. */
  private ghostOnCourse(g: Character, f: TrailPoint, s: number, done: boolean, t: number, dt: number) {
    const going = !!this.startT && !done, kind = this.course!, gv = (this.opts.ghostCps ?? 0) * this.keyLen;
    g.groundFeet = false;
    if (kind === 'climb') {
      const overAt = (this.island.root.userData.overAt as (() => number) | undefined)?.() ?? this.finishS;
      const over = s > overAt + 0.02;
      g.root.position.copy(f.p).add(new THREE.Vector3(1.2, 0, 0));
      g.root.rotation.set(0, over ? 0 : Math.PI, 0);
      // it climbs the way its own pace earns, the same six ways as you (and rests until you've started)
      const way = over || !going ? 0 : this.ghostKit?.way ?? 0;
      const a = g.play(over ? (going ? 'walk' : 'idle') : way ? 'idle' : g.has('climb') ? 'climb' : 'idle', 0.25);
      if (a && !over && !way) a.timeScale = going ? Math.max(0.35, Math.min(2.4, gv / 0.55)) : 0;
      if (g.root.visible && !over) { this.ghostKit?.lead(dt, t, { step: going ? this.opts.ghostStep ?? 0 : 0, y: f.p.y, v: going ? gv : 0, stride: Math.max(this.keyLen, 0.9) }); g.update(dt); g.root.updateMatrixWorld(true); this.ghostKit?.follow(dt, t); return; }
      if (over) this.ghostKit?.rest(dt, t);
    } else if (kind === 'slide' && this.ghostRide) {
      if (g.root.visible) {
        const pitch = Math.atan2(-f.t.y, Math.hypot(f.t.x, f.t.z));
        g.root.position.copy(f.p);
        this.ghostRide.lead(dt, t, { step: going ? this.opts.ghostStep ?? 0 : 0, at: f.p, pitch, lane: -1.7, v: going ? gv : 0, s, left: this.finishS - s });
        g.update(dt); g.root.updateMatrixWorld(true);
        this.ghostRide.follow(dt, t);
      } else this.ghostRide.rest(dt, t);
      return;
    } else if (kind === 'slide') {
      const yaw = Math.atan2(f.t.x, f.t.z), pitch = Math.atan2(-f.t.y, Math.hypot(f.t.x, f.t.z));
      const p = f.p.clone().addScaledVector(f.n, -1.3);
      this.ghostSled?.position.copy(p);
      this.ghostSled?.rotation.set(0, yaw - Math.PI / 2, -pitch);
      g.play(g.has('sit') ? 'sit' : 'idle', 0.25);
      g.root.position.copy(p); g.root.rotation.set(pitch, yaw, 0, 'YXZ');
    } else {
      // the ghost walks up the same swim steps, in its own lane
      const out = s >= this.swimExit()[0], onDock = s >= this.finishS - 0.2;
      if (this.ghostRide && !out && !onDock) {
        if (g.root.visible) {
          g.root.position.copy(f.p);
          this.ghostRide.lead(dt, t, { step: going ? this.opts.ghostStep ?? 0 : 0, at: f.p, pitch: 0, lane: -1.2, v: going ? gv : 0, s, left: this.finishS - s });
          g.update(dt); g.root.updateMatrixWorld(true);
          this.ghostRide.follow(dt, t);
        } else this.ghostRide.rest(dt, t);
        return;
      }
      this.ghostRide?.rest(dt, t);
      g.root.position.copy(f.p).addScaledVector(f.n, -1.2);
      g.root.rotation.set(0, onDock && !going ? this.towardCamera() : Math.atan2(f.t.x, f.t.z), 0);
      if (onDock && !going) g.play('idle', 0.3);
      else if (out) g.play('walk', 0.25);
      else {
        g.root.position.y += Math.sin(t * 3 + 1) * 0.04 + this.swimLift;
        const a = g.play(g.has('swim') ? 'swim' : 'run', 0.3);
        if (a) a.timeScale = Math.max(0.45, Math.min(2.2, 0.45 + gv / 2.5));
      }
    }
    if (g.root.visible) g.update(dt);
    if (g.root.visible && kind === 'slide' && this.ghostSled) { g.root.updateMatrixWorld(true); sitOnSled(g, this.ghostSled, dt); followWorn(g); }
  }

  private arrive() {
    this.phase = 'dance';
    const d = this.opts.dance;
    const name = this.me.has(d) ? d : 'fistpump';
    const a = this.me.play(name, 0.35);
    this.danceEnd = performance.now() / 1000 + danceLength(a);
    this.puff.burst(this.me.root.position, 20, 0xfff2a8);
  }

  /** Dance again (the results screen's button). */
  dance(id: string) {
    this.phase = 'dance';
    const name = this.me.has(id) ? id : 'fistpump';
    const a = this.me.play(name, 0.3);
    if (a) a.reset();
    this.danceEnd = performance.now() / 1000 + danceLength(a);
    this.onCelebrated = () => this.results(this.resultTier);
  }

  private resultTier = 0;
  /** The results: the buddy on the best ride of the run, framed to one side of the card. */
  results(bestTier: number) {
    this.resultTier = bestTier;
    this.phase = 'results';
    this.setTier(bestTier);
    if (bestTier < 2) this.me.play(bestTier === 1 ? 'fistpump' : 'idle', 0.4);
    if (bestTier < 2 && !this.me.has('fistpump')) this.me.play('idle', 0.4);
    this.me.root.rotation.set(0, this.towardCamera(), 0);
  }
  /** Which way the results camera looks from (in front, a little along the way): the buddy faces it. */
  private resultsDir() {
    const stop = this.island.trail.at(this.finishS);
    const along = stop.t.clone().setY(0);
    if (along.lengthSq() < 1e-4) along.crossVectors(UP_V, stop.n);
    along.normalize();
    return { n: stop.n.clone().setY(0).normalize(), along };
  }
  private towardCamera() { const { n, along } = this.resultsDir(); const d = n.multiplyScalar(0.88).addScaledVector(along, 0.42); return Math.atan2(d.x, d.z); }
  /** Off the sled at the bottom: it lies on the snow just up the slope, beside the buddy. */
  private parkSled() {
    const sled = this.island.root.userData.sled as THREE.Group | undefined;
    if (!sled) return;
    const f = this.island.trail.at(this.pos - 1.9), yaw = Math.atan2(f.t.x, f.t.z), pitch = Math.atan2(-f.t.y, Math.hypot(f.t.x, f.t.z));
    // the ride it finished on, or the plain sled
    if (this.ride?.park?.(f.p.clone().addScaledVector(f.n, -0.9), pitch)) { sled.visible = false; return; }
    sled.position.copy(f.p).addScaledVector(f.n, -0.9);
    sled.rotation.set(0, yaw - Math.PI / 2 + 0.35, -pitch, 'YXZ');
  }

  /** What the camera frames: the buddy, or the buddy on their ride (centre on the trail, and height). */
  private subject(): { centre: THREE.Vector3; h: number } {
    const ground = this.here.p, id = this.veh && this.tier >= 2 ? RIDES[this.tier].id : null;
    const [cy, h] = id === 'rocket' ? [1.45, 2.8] : id === 'bike' ? [0.85, 1.75] : id === 'car' ? [0.7, 1.6] : id === 'skate' ? [0.75, 1.55] : [0.62, 1.3];
    return { centre: ground.clone().add(new THREE.Vector3(0, cy + (this.kit?.camUp ?? this.ride?.camUp ?? 0), 0)), h: h + (this.ride?.camTall ?? 0) };
  }

  private camera(dt: number, f: TrailPoint) {
    const cam = stage.camera;
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const wantPos = new THREE.Vector3(), aim = new THREE.Vector3();
    const v = this.view, bandH = Math.max(0.16, v.bottom - v.top);
    const { centre, h } = this.subject();
    const ndcX = 2 * ((v.left + v.right) / 2) - 1, ndcY = 1 - 2 * ((v.top + v.bottom) / 2);
    let d: number;
    if (this.phase === 'run' || this.phase === 'arrive') {
      // beside and a little behind, looking a bit ahead down the trail; the buddy (and ride) fills about
      // 62% of the open band of screen between the letters and the keyboard
      d = Math.max(3.8, Math.min(10, h / (bandH * 0.62 * 2 * tanH)));
      if (this.course === 'climb') {
        // out from the wall at the climber's height, a little to the side, looking slightly up the route
        wantPos.copy(centre).addScaledVector(f.n, d * 0.95).add(new THREE.Vector3(d * 0.18, d * 0.05, 0));
        // a climber's arms reach well above its middle: aim a little high so the head clears the question
        aim.copy(centre).add(new THREE.Vector3(0, 0.3, 0));
      } else {
        // on a narrow phone screen a swimmer or sled (long and low) needs to sit nearer the middle
        const narrow = !!this.course && cam.aspect < 0.9;
        wantPos.copy(centre).addScaledVector(f.t, -d * (narrow ? 0.12 : 0.3)).addScaledVector(f.n, d * 0.94).y += d * 0.2;
        aim.copy(centre).addScaledVector(f.t, narrow ? 0.25 : 0.9);
      }
    } else {
      // at the gate: in front, a little to one side; the buddy sits in the middle of the hero area
      // the way along, kept level (on a cliff the trail runs straight up, on the slope it runs downhill):
      // the camera stands in front and a little to one side, at the buddy's height, never above or below
      const { n: stopN, along } = this.resultsDir();
      d = Math.max(3.2, Math.min(9, h / (bandH * 0.7 * 2 * tanH)));
      wantPos.copy(centre).addScaledVector(stopN, d * 0.88).addScaledVector(along, d * 0.42).y += d * 0.16;
      aim.copy(centre);
    }
    if (this.debugCam) {
      // close look for checking poses: angle 0 = from the camera side, 90 = from ahead
      const a = THREE.MathUtils.degToRad(this.debugCam.angle), dir = f.n.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.t, Math.sin(a));
      const at = this.debugCam.y != null ? this.me.root.position.clone().setY(this.me.root.position.y + this.debugCam.y) : centre;
      cam.position.copy(at).addScaledVector(dir, this.debugCam.dist).y += 0.3;
      cam.lookAt(at);
      return;
    }
    // shift the aim so the subject lands in the middle of the open part of the screen
    const right = new THREE.Vector3().crossVectors(aim.clone().sub(wantPos).normalize(), new THREE.Vector3(0, 1, 0)).normalize();
    aim.addScaledVector(right, -ndcX * d * tanH * cam.aspect).y -= ndcY * d * tanH;
    // the results card arrives quickly: the camera settles on its new framing just as fast
    const k = 1 - Math.exp(-dt * (this.phase === 'run' ? 4 : this.phase === 'results' ? 6 : 2.2));
    if (this.course || this.phase === 'arrive') {
      // on a course the buddy can go fast (a sled at top speed), and the last answer's dash is fast
      // anywhere: the camera keeps up exactly and only its framing around the buddy eases, or the buddy
      // slides out of the picture
      const offPos = wantPos.clone().sub(centre), offAim = aim.clone().sub(centre);
      if (!this.camReady) { this.camOff.copy(offPos); this.aimOff.copy(offAim); this.camReady = true; }
      else if (!this.following) { this.camOff.copy(this.camPos).sub(centre); this.aimOff.copy(this.camAim).sub(centre); }
      this.following = true;
      this.camOff.lerp(offPos, k); this.aimOff.lerp(offAim, k);
      this.camPos.copy(centre).add(this.camOff); this.camAim.copy(centre).add(this.aimOff);
    } else {
      this.following = false;
      if (!this.camReady) { this.camPos.copy(wantPos); this.camAim.copy(aim); this.camReady = true; }
      this.camPos.lerp(wantPos, k); this.camAim.lerp(aim, k);
    }
    cam.position.copy(this.camPos);
    cam.lookAt(this.camAim);
  }

  /** Where the buddy (on their ride, if any) sits on screen, in fractions of the window. */
  screenBox() {
    const { centre, h } = this.subject();
    const top = centre.clone().add(new THREE.Vector3(0, h / 2, 0)).project(stage.camera);
    const bot = centre.clone().add(new THREE.Vector3(0, -h / 2, 0)).project(stage.camera);
    return { x: (top.x + 1) / 2, top: (1 - top.y) / 2, bottom: (1 - bot.y) / 2 };
  }

  private cheerT = -1;
  /** A happy moment: a cheer on foot, a bounce on a ride. */
  cheer() {
    this.cheerT = performance.now() / 1000;
    if (!(this.veh && this.tier >= 2)) {
      const name = ['fistpump', 'jump'].find(n => this.me.has(n));
      if (name) { const a = this.me.play(name, 0.25); a?.reset(); }
    }
  }

  /** Where the buddy's head is on screen (fractions of the window), for the speech bubble. */
  screen() {
    const p = this.me.root.position.clone().add(new THREE.Vector3(0, this.veh && this.tier >= 2 ? 1.9 : 1.4, 0)).project(stage.camera);
    return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
  }

  focus() { return this.me.root.position; }

  private gone = false;
  dispose() {
    this.gone = true;
    this.kit?.dispose(); this.kit = null;
    this.ghostKit?.dispose(); this.ghostKit = null;
    this.ride?.dispose(); this.ride = null;
    this.ghostRide?.dispose(); this.ghostRide = null;
    this.island.gateSolid(1);
    world.run = false;
    if (this.course) this.island.dispose();
    this.me.dispose();
    this.ghost?.dispose();
    this.ghostSled?.removeFromParent();
    this.veh?.group.removeFromParent();
    this.puff.dispose();
  }
}

const startedGait = (me: Character, g: string) => g === 'idle' || me.has(g);
/** How long the finish dance plays: long ones are cut at 6 s, short loops (the floss) go round a few times. */
function danceLength(a: THREE.AnimationAction | null) {
  const d = a ? a.getClip().duration : 2.5;
  return d < 2.5 ? d * Math.ceil(3.2 / d) : Math.min(6, Math.max(2.4, d));
}

/** A see-through copy of the buddy for the ghost racer. */
function ghostify(c: Character) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xd9ccff, transparent: true, opacity: 0.32, depthWrite: false });
  c.model.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = mat; m.castShadow = false; } });
  c.groundFeet = false;
  return mat;
}

/** Little clouds of dust: when a ride changes and at the finish. */
class Puff {
  private im: THREE.InstancedMesh;
  private ps = Array.from({ length: 40 }, () => ({ life: 9, max: 0.8, p: new THREE.Vector3(), v: new THREE.Vector3(), s: 0.3 }));
  private o = new THREE.Object3D();
  constructor(scene: THREE.Scene) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    this.im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0.85 }), 40);
    this.im.frustumCulled = false;
    this.im.count = 40;
    scene.add(this.im);
  }
  burst(at: THREE.Vector3, n: number, color = 0xffffff) {
    (this.im.material as THREE.MeshBasicMaterial).color.set(color);
    for (let i = 0; i < n; i++) {
      const q = this.ps.find(x => x.life >= x.max) ?? this.ps[i % this.ps.length];
      const a = Math.random() * Math.PI * 2;
      q.life = 0; q.max = 0.6 + Math.random() * 0.5; q.s = 0.25 + Math.random() * 0.3;
      q.p.copy(at).add(new THREE.Vector3(Math.cos(a) * 0.3, 0.15 + Math.random() * 0.5, Math.sin(a) * 0.3));
      q.v.set(Math.cos(a) * 1.2, 0.6 + Math.random() * 0.8, Math.sin(a) * 1.2);
    }
  }
  update(dt: number, cam: THREE.Camera) {
    this.ps.forEach((q, i) => {
      q.life += dt;
      const k = q.life / q.max;
      if (k >= 1) this.o.scale.setScalar(0.0001);
      else { q.p.addScaledVector(q.v, dt); q.v.multiplyScalar(0.94); this.o.position.copy(q.p); this.o.quaternion.copy(cam.quaternion); this.o.scale.setScalar(q.s * (1 + k * 1.5) * (1 - k * 0.5)); }
      this.o.updateMatrix(); this.im.setMatrixAt(i, this.o.matrix);
    });
    this.im.instanceMatrix.needsUpdate = true;
  }
  dispose() { this.im.removeFromParent(); }
}
