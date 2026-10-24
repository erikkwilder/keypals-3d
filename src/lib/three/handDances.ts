// Dances keyed by hand, for well-known moves no motion library has (the floss). A dance is a loop of
// poses: where each arm points and which way the hips sway, in the buddy's own frame (x toward the
// buddy's left, y up, z forward). For each buddy the loop is posed on its own skeleton with reaching
// (two-bone IK, feet kept planted) and kept as an ordinary animation clip, so it plays like any move.
import * as THREE from 'three';
import { reach } from './ik';

type Dir = [number, number, number];
type Pose = { L: Dir; R: Dir; hips: number };
type HandDance = { step: number; loops: number; poses: Pose[] };

/** The floss: straight arms swing side to side together, one in front of the hips and one behind, swapping each swing; the hips swing the other way. */
const FLOSS: HandDance = {
  step: 0.19, loops: 6,
  poses: [
    { L: [-1.15, -1, 0.85], R: [-1.0, -1, -0.75], hips: 1 }, // arms to the right: left arm across the front, right arm behind
    { L: [1.0, -1, 0.05], R: [-1.0, -1, 0.05], hips: 0 }, // both out at the sides, swapping
    { L: [1.0, -1, -0.75], R: [1.15, -1, 0.85], hips: -1 }, // arms to the left: right arm across the front, left arm behind
    { L: [1.0, -1, 0.05], R: [-1.0, -1, 0.05], hips: 0 },
  ],
};

export const HAND_DANCES: Record<string, HandDance> = { dance_floss: FLOSS };

/** Turn a bone about a world axis, whatever its parents' turns. */
function turn(b: THREE.Object3D, axis: THREE.Vector3, angle: number) {
  const pw = b.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
  const w = b.getWorldQuaternion(new THREE.Quaternion());
  b.quaternion.copy(pw.multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle).multiply(w)));
  b.updateMatrixWorld(true);
}

/** Catmull-Rom through a loop of numbers. */
function loop(vals: number[], u: number) {
  const n = vals.length, i = Math.floor(u), f = u - i;
  const p = (k: number) => vals[((i + k) % n + n) % n];
  const [a, b, c, d] = [p(-1), p(0), p(1), p(2)];
  return 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
}

/**
 * Pose a hand-keyed dance on one buddy's skeleton and return it as a clip. `bind` holds each bone's
 * turn when standing straight. The model's current pose is put back afterwards.
 */
export function bakeHandDance(id: string, model: THREE.Object3D, bones: Record<string, THREE.Bone>, bind: Map<THREE.Bone, THREE.Quaternion>): THREE.AnimationClip | null {
  const d = HAND_DANCES[id], B = bones;
  const need = ['Hips', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
  if (!d || need.some(n => !B[n])) return null;
  const all = Object.values(B);
  const saved = all.map(b => [b.quaternion.clone(), b.position.clone()] as const);
  const hipsBind = B.Hips.position.clone();
  const reset = () => { for (const b of all) b.quaternion.copy(bind.get(b) ?? b.quaternion); B.Hips.position.copy(hipsBind); model.updateMatrixWorld(true); };
  reset();
  // the buddy's own frame in the world, and which way is its left (skeletons are mirrored at times)
  const mq = model.getWorldQuaternion(new THREE.Quaternion());
  const wp = (b: THREE.Object3D) => b.getWorldPosition(new THREE.Vector3());
  const inv = mq.clone().invert();
  const leftSign = Math.sign(wp(B.LeftArm).sub(wp(B.RightArm)).applyQuaternion(inv).x) || 1;
  const toWorld = (v: Dir) => new THREE.Vector3(v[0] * leftSign, v[1], v[2]).normalize().applyQuaternion(mq);
  const side = new THREE.Vector3(leftSign, 0, 0).applyQuaternion(mq), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(mq), up = new THREE.Vector3(0, 1, 0).applyQuaternion(mq);
  const feet = [wp(B.LeftFoot), wp(B.RightFoot)];
  const armLen = (a: THREE.Bone, b: THREE.Bone, c: THREE.Bone) => wp(a).distanceTo(wp(b)) + wp(b).distanceTo(wp(c));
  const lenL = armLen(B.LeftArm, B.LeftForeArm, B.LeftHand), lenR = armLen(B.RightArm, B.RightForeArm, B.RightHand);
  const height = wp(B.Head ?? B.Hips).y - feet[0].y;

  const fps = 30, n = d.poses.length, dur = d.step * n * d.loops, frames = Math.round(dur * fps);
  const times = new Float32Array(frames + 1);
  const quats = all.map(() => new Float32Array((frames + 1) * 4));
  const hipPos = new Float32Array((frames + 1) * 3);
  const comp = (k: 'L' | 'R', axis: number) => d.poses.map(p => p[k][axis]);
  for (let f = 0; f <= frames; f++) {
    const t = f / fps, u = (t / d.step) % n;
    reset();
    // hips: sway against the arms and dip on each swing, feet staying where they were
    const sway = loop(d.poses.map(p => p.hips), u);
    const dip = 0.5 + 0.5 * Math.cos(Math.PI * u);
    const hipsW = wp(B.Hips).addScaledVector(side, sway * height * 0.06).addScaledVector(up, -dip * height * 0.025);
    B.Hips.position.copy(B.Hips.parent!.worldToLocal(hipsW));
    model.updateMatrixWorld(true);
    turn(B.Hips, fwd, -sway * 0.07);
    if (B.Spine) turn(B.Spine, fwd, sway * 0.1);
    reach(B.LeftUpLeg, B.LeftLeg, B.LeftFoot, feet[0], fwd);
    reach(B.RightUpLeg, B.RightLeg, B.RightFoot, feet[1], fwd);
    // straight arms toward this moment's directions
    for (const [k, a, b, c, len] of [['L', B.LeftArm, B.LeftForeArm, B.LeftHand, lenL], ['R', B.RightArm, B.RightForeArm, B.RightHand, lenR]] as const) {
      const dir = toWorld([loop(comp(k, 0), u), loop(comp(k, 1), u), loop(comp(k, 2), u)]);
      const elbow = fwd.clone().negate().addScaledVector(side, k === 'L' ? 0.4 : -0.4);
      reach(a, b, c, wp(a).addScaledVector(dir, len * 0.97), elbow);
    }
    times[f] = t;
    all.forEach((b, i) => b.quaternion.toArray(quats[i], f * 4));
    B.Hips.position.toArray(hipPos, f * 3);
  }
  all.forEach((b, i) => { b.quaternion.copy(saved[i][0]); b.position.copy(saved[i][1]); });
  model.updateMatrixWorld(true);
  const tracks: THREE.KeyframeTrack[] = all.map((b, i) => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, quats[i]));
  tracks.push(new THREE.VectorKeyframeTrack(`${B.Hips.name}.position`, times, hipPos));
  return new THREE.AnimationClip(id, dur, tracks);
}
