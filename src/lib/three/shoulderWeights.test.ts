import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { keepParts, neckPart, partWeights, STEADY_HEADS } from './buddyHead';

// These buddies' shoulder weights ran up into the head: the arm and shoulder bones held the skin under the head and a
// few vertices of the head itself, so when an arm went up the head bent toward it. Their skin was weighted again in
// the file: the head lets go of every arm and shoulder share and the skin under it less and less, down to the shoulder
// tops. The weights each came with are kept in the file for what asks which part of the body a vertex is (keepParts).
// Each with how far its head's vertices drifted off the Head bone in the YMCA before (share of its height), and how many
// times less they drift now (Turtle's head still rides its neck bone a little, as it did).
const BUDDIES = [['monkey', 0.1, 4], ['antenna', 0.05, 4], ['pinkbunny', 0.03, 4], ['turtle', 0.05, 1.8], ['axolotl', 0.05, 4]] as const;

/** a .glb without its pictures (node can't decode them) */
function bare(path: string): ArrayBuffer {
  const b = readFileSync(path), n = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + n).toString('utf8'));
  delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.materials ?? []) delete m.pbrMetallicRoughness?.baseColorTexture;
  for (const k of ['extensionsUsed', 'extensionsRequired']) if (json[k]) json[k] = json[k].filter((e: string) => e !== 'EXT_texture_webp');
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const bin = b.subarray(20 + n), head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(20 + js.length + bin.length, 8);
  head.writeUInt32LE(js.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  const out = Buffer.concat([head, js, bin]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length) as ArrayBuffer;
}
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
type W = ReturnType<typeof partWeights>;
async function buddy(id: string) {
  const g = await loader.parseAsync(bare(`public/models/${id}.glb`), '');
  const dances = await loader.parseAsync(bare(`public/models/${id}-dances.glb`), '');
  let mesh: THREE.SkinnedMesh | null = null;
  g.scene.traverse(o => { if (!mesh && (o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh; });
  const m = mesh! as THREE.SkinnedMesh, a = m.geometry.attributes;
  const live: W = { si: a.skinIndex, sw: a.skinWeight }, inFile = !!a._partjoints && !!a._partweights;
  keepParts(m);
  return { scene: g.scene, m, live, kept: partWeights(m.geometry), inFile, ymca: dances.animations.find(c => c.name === 'dance_ymca')! };
}
const ARM = /Shoulder|Arm|Hand/;
/** where three's skinning puts every vertex with the given weights, in the pose the scene is in */
function skin(m: THREE.SkinnedMesh, w: W, out: Float32Array) {
  m.skeleton.update();
  const S = m.skeleton.boneMatrices!, pos = m.geometry.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix);
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k++) {
      const wk = w.sw.getComponent(i, k), j = w.si.getComponent(i, k) * 16;
      if (!wk) continue;
      x += wk * (S[j] * v.x + S[j + 4] * v.y + S[j + 8] * v.z + S[j + 12]);
      y += wk * (S[j + 1] * v.x + S[j + 5] * v.y + S[j + 9] * v.z + S[j + 13]);
      z += wk * (S[j + 2] * v.x + S[j + 6] * v.y + S[j + 10] * v.z + S[j + 14]);
    }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  return out;
}
const same = (a: W, b: W, i: number) => {
  for (let k = 0; k < 4; k++) if (a.si.getComponent(i, k) !== b.si.getComponent(i, k) || Math.abs(a.sw.getComponent(i, k) - b.sw.getComponent(i, k)) > 1e-6) return false;
  return true;
};

describe.each(BUDDIES)("%s's shoulder weights", (id, drift, by) => {
  it('keep the weights it came with for which-part readers, off the graphics card, and need no head fix at load', async () => {
    const { m, live, kept, inFile } = await buddy(id);
    expect(inFile).toBe(true);
    expect(m.geometry.attributes._partjoints).toBeUndefined();
    expect(m.geometry.attributes._partweights).toBeUndefined();
    expect(kept.sw).not.toBe(live.sw);
    expect(STEADY_HEADS[id as keyof typeof STEADY_HEADS]).toBeUndefined();
  });

  it('give its head no arm or shoulder weight, and change nothing below the shoulders', async () => {
    const { m, live, kept } = await buddy(id);
    const pos = m.geometry.attributes.position, arm = m.skeleton.bones.map(b => ARM.test(b.name)), head = neckPart(m)!.head;
    const v = new THREE.Vector3(), sh = new THREE.Vector3().setFromMatrixPosition(m.skeleton.boneInverses[m.skeleton.bones.findIndex(b => b.name === 'LeftArm')].clone().invert());
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    const H = y1 - y0, share = (w: W, i: number) => { let s = 0; for (let k = 0; k < 4; k++) if (arm[w.si.getComponent(i, k)]) s += w.sw.getComponent(i, k); return s; };
    let headArm = 0, headBefore = 0, changed = 0, lowest = Infinity, sumOff = 0;
    for (let i = 0; i < pos.count; i++) {
      let t = 0;
      for (let k = 0; k < 4; k++) t += live.sw.getComponent(i, k);
      sumOff = Math.max(sumOff, Math.abs(t - 1));
      if (head[i]) { headArm = Math.max(headArm, share(live, i)); headBefore = Math.max(headBefore, share(kept, i)); }
      if (!same(live, kept, i)) { changed++; v.fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix); lowest = Math.min(lowest, v.y); }
    }
    // the head held a fifth of a vertex's weight or more in an arm or shoulder bone (Monkey's all of it, Turtle's a quarter)
    expect(headBefore).toBeGreaterThan(0.2);
    expect(headArm).toBe(0);
    expect(changed).toBeGreaterThan(100);
    // the shoulder joint's height, less a little: the skin around the arms and below keeps its weights
    expect((lowest - sh.y) / H).toBeGreaterThan(-0.06);
    expect(sumOff).toBeLessThan(1e-6);
  });

  it('stand where it stood at rest, and keep its head whole in the YMCA without tearing what changed', async () => {
    const { scene, m, live, kept, ymca } = await buddy(id);
    const n = m.geometry.attributes.position.count, A = new Float32Array(n * 3), B = new Float32Array(n * 3), B0 = new Float32Array(n * 3);
    scene.updateMatrixWorld(true); skin(m, kept, B0); skin(m, live, A);
    let y0 = Infinity, y1 = -Infinity, rest = 0;
    for (let i = 0; i < n; i++) {
      y0 = Math.min(y0, B0[i * 3 + 1]); y1 = Math.max(y1, B0[i * 3 + 1]);
      rest = Math.max(rest, Math.hypot(A[i * 3] - B0[i * 3], A[i * 3 + 1] - B0[i * 3 + 1], A[i * 3 + 2] - B0[i * 3 + 2]));
    }
    const H = y1 - y0;
    expect(rest / H).toBeLessThan(1e-5);
    const headBone = m.skeleton.bones.find(b => b.name === 'Head')!, rInv = headBone.matrixWorld.clone().invert(), head = neckPart(m)!.head;
    // the edges with a vertex whose weights changed, their length at rest
    const ix = m.geometry.index!, E: number[] = [], L: number[] = [], seen = new Set<number>();
    for (let t = 0; t < ix.count; t += 3) for (let s = 0; s < 3; s++) {
      let a = ix.getX(t + s), b = ix.getX(t + ((s + 1) % 3));
      if (a > b) [a, b] = [b, a];
      if (seen.has(a * n + b) || (same(live, kept, a) && same(live, kept, b))) continue;
      seen.add(a * n + b);
      const l = Math.hypot(B0[a * 3] - B0[b * 3], B0[a * 3 + 1] - B0[b * 3 + 1], B0[a * 3 + 2] - B0[b * 3 + 2]);
      if (l > 1e-6 * H) { E.push(a * 3, b * 3); L.push(l); }
    }
    const mixer = new THREE.AnimationMixer(scene), Mh = new THREE.Matrix4(), p = new THREE.Vector3();
    mixer.clipAction(ymca).play();
    let driftB = 0, driftA = 0, before = 0, after = 0;
    for (let t = 0; t < ymca.duration; t += 0.1) {
      mixer.setTime(t); scene.updateMatrixWorld(true); skin(m, kept, B); skin(m, live, A);
      Mh.multiplyMatrices(headBone.matrixWorld, rInv);
      for (let i = 0; i < n; i++) {
        if (!head[i]) continue;
        p.set(B0[i * 3], B0[i * 3 + 1], B0[i * 3 + 2]).applyMatrix4(Mh);
        driftB = Math.max(driftB, Math.hypot(B[i * 3] - p.x, B[i * 3 + 1] - p.y, B[i * 3 + 2] - p.z) / H);
        driftA = Math.max(driftA, Math.hypot(A[i * 3] - p.x, A[i * 3 + 1] - p.y, A[i * 3 + 2] - p.z) / H);
      }
      for (let e = 0; e < L.length; e++) {
        const a = E[e * 2], b = E[e * 2 + 1];
        before = Math.max(before, Math.hypot(B[a] - B[b], B[a + 1] - B[b + 1], B[a + 2] - B[b + 2]) / L[e] - 1);
        after = Math.max(after, Math.hypot(A[a] - A[b], A[a + 1] - A[b + 1], A[a + 2] - A[b + 2]) / L[e] - 1);
      }
    }
    // the head's vertices drifted off its bone (by a tenth of the height and more for Monkey); now they ride it
    expect(driftB).toBeGreaterThan(drift);
    expect(driftA).toBeLessThan(driftB / by);
    expect(after).toBeLessThanOrEqual(before * 1.03 + 0.03);
  }, 60000);
});
