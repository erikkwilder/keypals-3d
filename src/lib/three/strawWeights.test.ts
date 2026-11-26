import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { keepParts, neckPart, partWeights } from './buddyHead';

// Straw's skin was weighted again in public/models/straw.glb: its straw cloak and the strands round its neck rode the
// arm bones, and its head a share of them too, so in the YMCA its straw tore and its head bent toward its arms. The
// weights it came with are kept in the file for what asks which part of the body a vertex is (buddyHead.ts keepParts).

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
async function straw() {
  const g = await loader.parseAsync(bare('public/models/straw.glb'), '');
  const dances = await loader.parseAsync(bare('public/models/straw-dances.glb'), '');
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

describe("Straw's skin weights", () => {
  it('keep the weights it came with for which-part readers, off the graphics card', async () => {
    const { m, live, kept, inFile } = await straw();
    expect(inFile).toBe(true);
    expect(m.geometry.attributes._partjoints).toBeUndefined();
    expect(m.geometry.attributes._partweights).toBeUndefined();
    expect(kept.sw).not.toBe(live.sw);
    expect(m.geometry.attributes.skinWeight).toBe(live.sw);
  });

  it('give its head no arm weight, nor the middle of its cloak and neck, which the arms held before', async () => {
    const { m, live, kept } = await straw();
    const pos = m.geometry.attributes.position, arm = m.skeleton.bones.map(b => ARM.test(b.name)), head = neckPart(m)!.head;
    const v = new THREE.Vector3();
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    const H = y1 - y0, share = (w: W, i: number) => { let s = 0; for (let k = 0; k < 4; k++) if (arm[w.si.getComponent(i, k)]) s += w.sw.getComponent(i, k); return s; };
    let headArm = 0, headBefore = 0, mid = 0, midArm = 0, midBefore = 0, sumOff = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix);
      let t = 0;
      for (let k = 0; k < 4; k++) t += live.sw.getComponent(i, k);
      sumOff = Math.max(sumOff, Math.abs(t - 1));
      if (head[i]) { headArm = Math.max(headArm, share(live, i)); headBefore = Math.max(headBefore, share(kept, i)); continue; }
      // a strip down the middle of the cloak, front and back, from its hem to the neck
      const y = (v.y - y0) / H;
      if (Math.abs(v.x) < 0.03 * H && y > 0.2 && y < 0.6) { mid++; midArm = Math.max(midArm, share(live, i)); midBefore = Math.max(midBefore, share(kept, i)); }
    }
    expect(headBefore).toBeGreaterThan(0.5);
    expect(headArm).toBe(0);
    expect(mid).toBeGreaterThan(200);
    expect(midBefore).toBeGreaterThan(0.5);
    expect(midArm).toBe(0);
    expect(sumOff).toBeLessThan(1e-6);
  });

  it('stand where it stood at rest, and keep its straw together in the YMCA', async () => {
    const { scene, m, live, kept, ymca } = await straw();
    const n = m.geometry.attributes.position.count, A = new Float32Array(n * 3), B = new Float32Array(n * 3);
    scene.updateMatrixWorld(true); skin(m, kept, B); skin(m, live, A);
    let y0 = Infinity, y1 = -Infinity, rest = 0;
    for (let i = 0; i < n; i++) {
      y0 = Math.min(y0, B[i * 3 + 1]); y1 = Math.max(y1, B[i * 3 + 1]);
      rest = Math.max(rest, Math.hypot(A[i * 3] - B[i * 3], A[i * 3 + 1] - B[i * 3 + 1], A[i * 3 + 2] - B[i * 3 + 2]));
    }
    expect(rest / (y1 - y0)).toBeLessThan(1e-5);
    // every edge of the skin, its length at rest
    const ix = m.geometry.index!, E: number[] = [], L: number[] = [], seen = new Set<number>();
    for (let t = 0; t < ix.count; t += 3) for (let s = 0; s < 3; s++) {
      let a = ix.getX(t + s), b = ix.getX(t + ((s + 1) % 3));
      if (a > b) [a, b] = [b, a];
      if (seen.has(a * n + b)) continue;
      seen.add(a * n + b);
      const l = Math.hypot(B[a * 3] - B[b * 3], B[a * 3 + 1] - B[b * 3 + 1], B[a * 3 + 2] - B[b * 3 + 2]);
      if (l > 1e-6 * (y1 - y0)) { E.push(a * 3, b * 3); L.push(l); }
    }
    const mixer = new THREE.AnimationMixer(scene);
    mixer.clipAction(ymca).play();
    let before = 0, after = 0;
    for (let t = 0; t < ymca.duration; t += 0.1) {
      mixer.setTime(t); scene.updateMatrixWorld(true); skin(m, kept, B); skin(m, live, A);
      for (let e = 0; e < L.length; e++) {
        const a = E[e * 2], b = E[e * 2 + 1];
        before = Math.max(before, Math.hypot(B[a] - B[b], B[a + 1] - B[b + 1], B[a + 2] - B[b + 2]) / L[e] - 1);
        after = Math.max(after, Math.hypot(A[a] - A[b], A[a + 1] - A[b + 1], A[a + 2] - A[b + 2]) / L[e] - 1);
      }
    }
    // the weights it came with stretched some edge of its straw to over 20 times its length
    expect(before).toBeGreaterThan(20);
    expect(after).toBeLessThan(before / 3);
  }, 60000);
});
