// Dev only: do a rigged Glimmer's eyes keep their shape while it moves? For each Glimmer with a "rig" in
// public/models/glimmers/meta.json, its eyes are found from its painting (the darkest spots on the front
// of its head, one each side) and every move is played: each point round an eye is measured from the
// eye's middle, against at rest (the eye turning or sliding doesn't count, only stretching or squashing).
// In the dev server's page:
//   const m = await import('/src/dev/faceWarp.ts'); await m.faceWarp()  ->  { id: { worst, move, side } }
// worst: the most an eye stretches or squashes, as a share of its size (0.1 is 10%).
import * as THREE from 'three';
import { loadGltf } from '../lib/three/assets';
import { makeBones, positionsOf, skinFor, type Landmarks } from '../lib/three/glimmerRig';
import { ACTS, ACT_LEN, Animator, BASES, type Act, type Base } from '../lib/three/glimmerMotion';

type Meta = Record<string, { rig?: Landmarks }>;

export async function faceWarp(only?: string[]): Promise<Record<string, { worst: number; move: string; side: string; points: number; eyes?: number[][] }>> {
  const meta = (await (await fetch(`${import.meta.env.BASE_URL}models/glimmers/meta.json`)).json()) as Meta;
  const out: Record<string, { worst: number; move: string; side: string; points: number; eyes?: number[][] }> = {};
  for (const [id, m] of Object.entries(meta)) {
    if (!m?.rig || (only && !only.includes(id))) continue;
    const g = await loadGltf(`models/glimmers/${id}.glb`);
    if (!g) continue;
    let mesh: THREE.Mesh | null = null;
    g.scene.updateMatrixWorld(true);
    g.scene.traverse(o => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
    const me = mesh as THREE.Mesh | null;
    if (!me) continue;
    let geo = me.geometry;
    if (!me.matrixWorld.equals(new THREE.Matrix4())) { geo = geo.clone(); geo.applyMatrix4(me.matrixWorld); }
    const skin = skinFor(`warp|${id}|${JSON.stringify(m.rig)}`, geo, m.rig);
    const { bones, inverses } = makeBones(skin.rig);
    const sk = new THREE.SkinnedMesh(skin.geometry, new THREE.MeshBasicMaterial());
    sk.add(bones[0]); sk.bind(new THREE.Skeleton(bones, inverses), new THREE.Matrix4());
    const hi = skin.rig.bones.findIndex(b => b.role === 'head'), head = skin.rig.bones[hi];
    const H = skin.rig.height, hc = new THREE.Vector3(...skin.rig.lm.head);
    // the eyes: the darkest spots of its painting on the front of its head (the pupils), one each side,
    // and the points round each one
    const pos = positionsOf(skin.geometry), uv = skin.geometry.attributes.uv;
    const map = ((Array.isArray(me.material) ? me.material[0] : me.material) as THREE.MeshStandardMaterial).map;
    const img = map?.image as CanvasImageSource & { width: number; height: number } | undefined;
    if (!img || !uv) continue;
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const g2 = cv.getContext('2d', { willReadFrequently: true })!; g2.drawImage(img, 0, 0);
    const px = g2.getImageData(0, 0, cv.width, cv.height).data;
    const lumAt = (i: number) => {
      let u = uv.getX(i), w = uv.getY(i); u -= Math.floor(u); w -= Math.floor(w);
      const x = Math.min(cv.width - 1, Math.floor(u * cv.width)), y = Math.min(cv.height - 1, Math.floor((map!.flipY ? 1 - w : w) * cv.height));
      const o = (y * cv.width + x) * 4;
      return (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255;
    };
    const p = new THREE.Vector3(), near: number[] = [];
    for (let i = 0; i < pos.length / 3; i++) {
      p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      if (p.distanceTo(hc) < Math.max(head.r * 1.8, H * 0.3) && p.z > hc.z - head.r * 0.2 && p.y > hc.y - H * 0.3) near.push(i);
    }
    const lums = near.map(lumAt), cut = Math.min(0.14, [...lums].sort((a, b) => a - b)[Math.floor(lums.length * 0.03)] ?? 0.14);
    const eyes: { side: string; ids: number[]; c: THREE.Vector3; R: number }[] = [];
    for (const sgn of [-1, 1]) {
      const dark = near.filter((_, k) => lums[k] <= cut && (pos[near[k] * 3] - hc.x) * sgn > H * 0.01);
      if (dark.length < 3) continue;
      const c = new THREE.Vector3();
      for (const i of dark) c.add(p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
      c.multiplyScalar(1 / dark.length);
      const R = H * 0.06, ids: number[] = [];
      for (const i of near) if (p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).distanceTo(c) < R) ids.push(i);
      if (ids.length >= 6) eyes.push({ side: sgn < 0 ? '-x' : '+x', ids, c, R });
    }
    if (!eyes.length) { out[id] = { worst: -1, move: 'no eyes found', side: '', points: 0 }; continue; }
    const anim = new Animator(skin.rig, bones, 0, false);
    const rest = eyes.map(e => e.ids.map(i => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])));
    const restD = rest.map((r, k) => r.map(q => q.distanceTo(eyes[k].c)));
    const now = new THREE.Vector3(), cNow = new THREE.Vector3();
    let worst = 0, move = '', side = '';
    const check = (name: string) => {
      sk.updateMatrixWorld(true);
      sk.skeleton.update();
      eyes.forEach((e, k) => {
        // its shape: how far each point is from the eye's middle, against at rest (turning or sliding doesn't count)
        const pts = e.ids.map(i => sk.getVertexPosition(i, new THREE.Vector3()));
        cNow.set(0, 0, 0); pts.forEach(q => cNow.add(q)); cNow.multiplyScalar(1 / pts.length);
        const c0 = rest[k].reduce((a, q) => a.add(q), new THREE.Vector3()).multiplyScalar(1 / rest[k].length);
        pts.forEach((q, j) => {
          const d = Math.abs(now.copy(q).sub(cNow).length() - rest[k][j].distanceTo(c0)) / e.R;
          if (d > worst) { worst = d; move = name; side = e.side; }
        });
        void restD;
      });
    };
    for (const b of BASES as Base[]) {
      anim.stop(); anim.setBase(b);
      for (let t = 0; t < 3; t += 0.1) { anim.update(0.1, t); if (t > 0.4) check(b); }
    }
    for (const a of ACTS as Act[]) {
      anim.setBase('idle'); anim.play(a);
      for (let t = 0; t < ACT_LEN[a]; t += 0.05) { anim.update(0.05, 3 + t); check(a); }
    }
    out[id] = { worst: +worst.toFixed(4), move, side, points: eyes.map(e => e.ids.length).reduce((a, b) => a + b, 0), eyes: eyes.map(e => e.c.toArray().map(x => Math.round(x * 1000) / 1000)) };
  }
  return out;
}
