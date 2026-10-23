// Reaching for things: turn bones so a limb lands on a point. Used for feet on pedals and hands on
// handlebars, for every character alike (their skeletons share bone names but not proportions).
import * as THREE from 'three';

const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();
const from = new THREE.Vector3(), to = new THREE.Vector3();
const wq = new THREE.Quaternion(), pq = new THREE.Quaternion(), r = new THREE.Quaternion();

/** Turn `bone` the shortest way so that the point `child` (world) moves onto the line toward `target`. */
export function aim(bone: THREE.Object3D, child: THREE.Vector3, target: THREE.Vector3, amount = 1) {
  bone.getWorldPosition(pa);
  from.subVectors(child, pa).normalize();
  to.subVectors(target, pa).normalize();
  if (from.lengthSq() < 1e-8 || to.lengthSq() < 1e-8) return;
  r.setFromUnitVectors(from, to);
  if (amount < 1) r.slerp(new THREE.Quaternion(), 1 - amount);
  bone.getWorldQuaternion(wq);
  const want = r.multiply(wq);
  bone.parent!.getWorldQuaternion(pq);
  bone.quaternion.copy(pq.invert().multiply(want));
  bone.updateMatrixWorld(true);
}

/**
 * Two-bone reach (thigh-shin-foot, or upper arm-forearm-hand): the end lands on `target`, and the
 * middle joint bends toward `pole` (a world direction: knees forward, elbows down and back).
 */
export function reach(a: THREE.Object3D, b: THREE.Object3D, c: THREE.Object3D, target: THREE.Vector3, pole: THREE.Vector3, amount = 1) {
  a.getWorldPosition(pa); b.getWorldPosition(pb); c.getWorldPosition(pc);
  const l1 = pa.distanceTo(pb), l2 = pb.distanceTo(pc);
  const t = target.clone();
  if (amount < 1) t.lerpVectors(pc, target, amount);
  const dir = t.clone().sub(pa);
  let d = dir.length();
  d = Math.min(Math.max(d, Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
  dir.normalize();
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const p = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (p.lengthSq() < 1e-8) p.set(0, 1, 0);
  p.normalize();
  const knee = pa.clone().addScaledVector(dir, along).addScaledVector(p, h);
  aim(a, pb, knee);
  b.getWorldPosition(pb); c.getWorldPosition(pc);
  aim(b, pc, pa.clone().addScaledVector(dir, d));
}
