// Sitting on the sled: hips on the deck, legs straight out along the top toward the steering bar, hands
// on the sides. Every buddy is shaped differently (long legs, round bodies, big feet), so the first time a
// buddy sits down it is measured from its own skin: how far the hips sit above its bottom, and the
// ankles above its heels. Then nothing passes through the slats.
import * as THREE from 'three';
import type { Character } from './character';
import { reach } from './ik';

/** The sled from makeSled and the course sled: long axis +x (front), slats' top here, this wide. */
const DECK = 0.2775, HALF = 0.29, FRONT = 0.5, HIP_X = -0.27, EPS = 0.012;

type Fit = { drop: number; ankle: number; sat: number; done: boolean };
const fits = new WeakMap<Character, Fit>();

const v = new THREE.Vector3(), w = new THREE.Vector3();

/** Call after the buddy's last update this frame, with the sit move playing and the root facing +x of the sled. */
export function sitOnSled(me: Character, sled: THREE.Object3D, dt: number) {
  const B = me.bones;
  if (!B.Hips) return;
  let fit = fits.get(me);
  if (!fit) { fit = { drop: 0.13, ankle: 0.07, sat: 0, done: false }; fits.set(me, fit); }
  fit.sat += dt;
  sled.updateMatrixWorld(true);
  // sit up straight (the sit move is a chair sit, leaning over its knees)
  me.uprightSpine(0.8);
  pose(me, sled, fit);
  // measure once the sit move has faded all the way in
  if (!fit.done && fit.sat > 0.45) {
    for (let k = 0; k < 3; k++) {
      const [body, legs] = lowest(me, sled);
      if (body !== null) fit.drop += DECK + EPS - body;
      if (legs !== null) fit.ankle += DECK + EPS - legs;
      pose(me, sled, fit);
    }
    fit.done = true;
  }
}

/** Hips onto the deck, then legs and arms. */
function pose(me: Character, sled: THREE.Object3D, fit: Fit) {
  const B = me.bones;
  me.root.updateMatrixWorld(true);
  const hips = B.Hips.getWorldPosition(new THREE.Vector3());
  const want = sled.localToWorld(new THREE.Vector3(HIP_X, DECK + fit.drop, 0));
  const parent = me.root.parent;
  if (parent) { parent.worldToLocal(want); parent.worldToLocal(hips); }
  me.root.position.add(want.sub(hips));
  me.root.updateMatrixWorld(true);
  const fwd = new THREE.Vector3(1, 0, 0).transformDirection(sled.matrixWorld);
  const up = new THREE.Vector3(0, 1, 0).transformDirection(sled.matrixWorld);
  const knee = up.clone().addScaledVector(fwd, 0.35);
  for (const [a, b, c] of [[B.LeftUpLeg, B.LeftLeg, B.LeftFoot], [B.RightUpLeg, B.RightLeg, B.RightFoot]]) {
    if (!a || !b || !c) continue;
    const pa = a.getWorldPosition(new THREE.Vector3()), pb = b.getWorldPosition(new THREE.Vector3()), pc = c.getWorldPosition(new THREE.Vector3());
    const len = (pa.distanceTo(pb) + pb.distanceTo(pc)) * 0.94;
    const hip = sled.worldToLocal(pa.clone());
    const y = DECK + fit.ankle, dy = Math.max(0, hip.y - y);
    const x = Math.min(FRONT, hip.x + Math.sqrt(Math.max(0.01, len * len - dy * dy)));
    const z = Math.sign(hip.z || 1) * Math.min(0.2, Math.max(0.07, Math.abs(hip.z)));
    reach(a, b, c, sled.localToWorld(new THREE.Vector3(x, y, z)), knee);
  }
  // hands on the sides of the sled, a little ahead of the hips
  for (const [a, b, c] of [[B.LeftArm, B.LeftForeArm, B.LeftHand], [B.RightArm, B.RightForeArm, B.RightHand]]) {
    if (!a || !b || !c) continue;
    const s = sled.worldToLocal(a.getWorldPosition(v)), side = Math.sign(s.z || 1);
    const target = sled.localToWorld(w.set(HIP_X + 0.14, DECK + 0.08, side * Math.max(HALF + 0.05, Math.abs(s.z) + 0.06)));
    const elbow = new THREE.Vector3(0, 0, side).transformDirection(sled.matrixWorld).addScaledVector(fwd, -0.6).addScaledVector(up, -0.2);
    reach(a, b, c, target.clone(), elbow);
  }
  me.root.updateMatrixWorld(true);
}

/** The lowest skin over the deck (sled height): the bottom (hips and thighs) and the legs below the knees
 *  (shins, feet, toes). Arms, tails and the rest are left out: hands hold the sides, tails trail off the back. */
function lowest(me: Character, sled: THREE.Object3D): [number | null, number | null] {
  const B = me.bones, inv = sled.matrixWorld.clone().invert();
  const body = new Set<THREE.Object3D>([B.Hips, B.LeftUpLeg, B.RightUpLeg].filter(Boolean));
  const legs = new Set<THREE.Object3D>();
  for (const b of [B.LeftLeg, B.RightLeg]) b?.traverse(o => legs.add(o));
  let lo: number | null = null, lo2: number | null = null;
  me.model.traverse(o => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh || !m.visible) return;
    const pos = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
    if (!si || !sw) return;
    const bones = m.skeleton.bones, mw = m.matrixWorld;
    for (let i = 0; i < pos.count; i++) {
      // the bone that moves this bit of skin the most
      let k = 0;
      for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, k)) k = j;
      const bone = bones[si.getComponent(i, k)];
      const isBody = body.has(bone), isLeg = !isBody && legs.has(bone);
      if (!isBody && !isLeg) continue;
      m.getVertexPosition(i, v);
      v.applyMatrix4(mw).applyMatrix4(inv);
      if (isBody) { if (lo === null || v.y < lo) lo = v.y; }
      else if (lo2 === null || v.y < lo2) lo2 = v.y;
    }
  });
  return [lo, lo2];
}
