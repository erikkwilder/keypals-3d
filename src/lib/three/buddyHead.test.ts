import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { FRIEND, type FriendId } from '../art/cast';
import { FADE, neckPart, partWeights, STEADY_HEADS, steadyHead, type Fade } from './buddyHead';

/** a buddy's .glb without its pictures (node can't decode them) */
function bare(path: string): ArrayBuffer {
  const b = readFileSync(path), n = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + n).toString('utf8'));
  delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.materials ?? []) {
    delete m.pbrMetallicRoughness?.baseColorTexture; delete m.pbrMetallicRoughness?.metallicRoughnessTexture;
    delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture;
  }
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
async function buddy(id: string, withMoves = false) {
  const g = await loader.parseAsync(bare(`public/models/${id}.glb`), '');
  const more = withMoves ? await Promise.all(['moves', 'dances', 'moves2'].map(s => `public/models/${id}-${s}.glb`).filter(existsSync).map(p => loader.parseAsync(bare(p), ''))) : [];
  let mesh: THREE.SkinnedMesh | null = null;
  g.scene.traverse(o => { if (!mesh && (o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh; });
  return { scene: g.scene, mesh: mesh! as THREE.SkinnedMesh, clips: [...g.animations, ...more.flatMap(m => m.animations)] };
}
type W = { si: THREE.BufferAttribute | THREE.InterleavedBufferAttribute; sw: THREE.BufferAttribute | THREE.InterleavedBufferAttribute };
/** where vertex i is in the world with the given weights (three's own skinning) */
function place(m: THREE.SkinnedMesh, w: W, i: number, out = new THREE.Vector3()) {
  const v = new THREE.Vector3().fromBufferAttribute(m.geometry.attributes.position, i).applyMatrix4(m.bindMatrix), M = new THREE.Matrix4();
  out.set(0, 0, 0);
  for (let k = 0; k < 4; k++) {
    const wk = w.sw.getComponent(i, k), j = w.si.getComponent(i, k);
    if (wk) out.addScaledVector(v.clone().applyMatrix4(M.multiplyMatrices(m.skeleton.bones[j].matrixWorld, m.skeleton.boneInverses[j])), wk);
  }
  return out.applyMatrix4(m.bindMatrixInverse).applyMatrix4(m.matrixWorld);
}
const height = (m: THREE.SkinnedMesh) => { m.computeBoundingBox(); return m.boundingBox!.clone().applyMatrix4(m.matrixWorld).getSize(new THREE.Vector3()).y; };

/** [buddy, move, time, the head's worst drift after as a share of before at most] */
const MEASURED: [FriendId, string, number, number][] = [['sloth', 'dance_twist', 0.4, 0.5], ['diver', 'dance_twist', 5.48, 0.5]];
const listed = Object.entries(STEADY_HEADS) as [FriendId, Fade][];

describe("a buddy's neck and head don't bend with its arms", () => {
  it('lists only buddies, each with its fade', () => {
    expect(listed.length).toBeGreaterThan(0);
    for (const [id, f] of listed) {
      expect(FRIEND[id], id).toBeTruthy();
      expect(f.below + f.above, id).toBeGreaterThan(0);
    }
  });

  it('changes only the neck and head, keeps every weight total, and every listed buddy stands exactly where it did at rest', async () => {
    for (const [id, fade] of listed) {
      const { scene, mesh } = await buddy(id);
      scene.updateMatrixWorld(true);
      const before = { si: mesh.geometry.attributes.skinIndex.clone(), sw: mesh.geometry.attributes.skinWeight.clone() };
      const np = neckPart(mesh, fade)!, done = steadyHead(mesh, fade)!;
      expect(done.changed, id).toBeGreaterThan(0);
      const after = { si: mesh.geometry.attributes.skinIndex, sw: mesh.geometry.attributes.skinWeight }, H = height(mesh);
      expect(partWeights(mesh.geometry).sw.array, id).toEqual(before.sw.array);
      expect(steadyHead(mesh, fade), id).toBeNull();
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      for (let i = 0; i < np.inPart.length; i++) {
        let s0 = 0, s1 = 0, same = true;
        for (let k = 0; k < 4; k++) {
          s0 += before.sw.array[i * 4 + k]; s1 += after.sw.array[i * 4 + k];
          if (after.si.array[i * 4 + k] !== before.si.array[i * 4 + k] || after.sw.array[i * 4 + k] !== before.sw.array[i * 4 + k]) same = false;
        }
        if (!np.inPart[i]) expect(same, `${id} v${i}`).toBe(true);
        expect(Math.abs(s1 - s0), `${id} v${i}`).toBeLessThan(1e-5);
        if (!same) expect(place(mesh, before, i, a).distanceTo(place(mesh, after, i, b)) / H, `${id} v${i}`).toBeLessThan(1e-5);
      }
    }
  }, 120_000);

  it('leaves a buddy off the list as the model came', async () => {
    const off = (Object.keys(FRIEND) as FriendId[]).filter(id => !STEADY_HEADS[id]);
    expect(off.length).toBeGreaterThan(0);
    expect(FADE.below).toBeGreaterThan(0);
  });

  // the worst moment for the head before the change, measured over every move (fresh/handoff/buddy-heads-2.md)
  it.each(MEASURED)(
    '%s in %s at %s s: the head bends far less, and no edge of the changed skin stretches more than before',
    async (id, clipName, t, drop) => {
      const { scene, mesh, clips } = await buddy(id, true);
      const fade = STEADY_HEADS[id]!;
      const before = { si: mesh.geometry.attributes.skinIndex.clone(), sw: mesh.geometry.attributes.skinWeight.clone() };
      const np = neckPart(mesh, fade)!;
      steadyHead(mesh, fade);
      const after = { si: mesh.geometry.attributes.skinIndex, sw: mesh.geometry.attributes.skinWeight };
      scene.updateMatrixWorld(true);
      const N = np.inPart.length, H = height(mesh), hi = mesh.skeleton.bones.findIndex(b => b.name === 'Head'), restHead = mesh.skeleton.bones[hi].matrixWorld.clone().invert();
      const changed = new Uint8Array(N);
      for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) if (after.si.array[i * 4 + k] !== before.si.array[i * 4 + k] || after.sw.array[i * 4 + k] !== before.sw.array[i * 4 + k]) changed[i] = 1;
      const ix = mesh.geometry.index!, edges: [number, number][] = [];
      for (let c = 0; c < ix.count; c += 3) for (let s = 0; s < 3; s++) {
        const a = ix.getX(c + s), b = ix.getX(c + ((s + 1) % 3));
        if (a < b && (changed[a] || changed[b] || (np.head[a] && np.head[b]))) edges.push([a, b]);
      }
      const rest = new Map<number, THREE.Vector3>(), at0 = (i: number) => rest.get(i) ?? rest.set(i, place(mesh, before, i)).get(i)!;
      for (const [a, b] of edges) { at0(a); at0(b); }
      for (let i = 0; i < N; i++) if (np.head[i]) at0(i);
      const mixer = new THREE.AnimationMixer(scene);
      mixer.clipAction(clips.find(c => c.name === clipName)!).play();
      mixer.setTime(t);
      scene.updateMatrixWorld(true);
      const headOnly = new THREE.Matrix4().multiplyMatrices(mesh.skeleton.bones[hi].matrixWorld, restHead);
      const P0 = new Map<number, THREE.Vector3>(), P1 = new Map<number, THREE.Vector3>();
      const at = (P: Map<number, THREE.Vector3>, w: W, i: number) => P.get(i) ?? P.set(i, place(mesh, w, i)).get(i)!;
      let drift0 = 0, drift1 = 0;
      for (let i = 0; i < N; i++) {
        if (!np.head[i]) continue;
        const own = at0(i).clone().applyMatrix4(headOnly);
        drift0 = Math.max(drift0, at(P0, before, i).distanceTo(own) / H);
        drift1 = Math.max(drift1, at(P1, after, i).distanceTo(own) / H);
      }
      expect(drift1).toBeLessThan(drift0 * drop);
      let worst0 = 0, worst1 = 0;
      for (const [a, b] of edges) {
        if (np.head[a] && np.head[b]) continue;
        const l0 = at0(a).distanceTo(at0(b));
        if (l0 < 1e-6 * H) continue;
        worst0 = Math.max(worst0, Math.abs(at(P0, before, a).distanceTo(at(P0, before, b)) / l0 - 1));
        worst1 = Math.max(worst1, Math.abs(at(P1, after, a).distanceTo(at(P1, after, b)) / l0 - 1));
      }
      expect(worst1).toBeLessThanOrEqual(worst0 * 1.03 + 0.03);
    },
    60_000,
  );
});
