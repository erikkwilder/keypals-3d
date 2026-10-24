// Dev page (dancecheck.html): for each buddy and dance clip, how deep the hands and forearms go into
// the head. window.__check(files) -> { buddy: { clip: worst depth as a share of the head radius } }.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);

async function check(buddy: string, files: string[]) {
  const g = await L.loadAsync(`/models/${buddy}.glb`);
  const model = g.scene;
  const bones: Record<string, THREE.Bone> = {};
  model.traverse(o => { if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone; });
  const clips: THREE.AnimationClip[] = [];
  for (const f of files) { try { clips.push(...(await L.loadAsync(f.replace('{b}', buddy))).animations); } catch { /* missing */ } }
  const mixer = new THREE.AnimationMixer(model);
  const out: Record<string, number> = {};
  const v = new THREE.Vector3(), hc = new THREE.Vector3(), ht = new THREE.Vector3();
  for (const clip of clips) {
    mixer.stopAllAction();
    const a = mixer.clipAction(clip); a.play();
    let worst = 0;
    for (let i = 0; i <= 80; i++) {
      mixer.setTime(clip.duration * i / 80); model.updateMatrixWorld(true);
      bones.Head.getWorldPosition(hc); bones.head_end.getWorldPosition(ht);
      // the head as a ball: centre partway up from the neck joint, radius from its height
      const up = ht.clone().sub(hc), r = up.length() * 0.55, c = hc.clone().addScaledVector(up, 0.5);
      for (const n of ['LeftHand', 'RightHand', 'LeftForeArm', 'RightForeArm']) {
        const b = bones[n]; if (!b) continue;
        // sample along the bone toward its child
        b.getWorldPosition(v);
        const child = b.children.find(x => (x as THREE.Bone).isBone);
        const end = child ? child.getWorldPosition(new THREE.Vector3()) : v.clone();
        for (let k = 0; k <= 4; k++) {
          const p = v.clone().lerp(end, k / 4);
          const depth = 1 - p.distanceTo(c) / r;
          if (depth > worst) worst = depth;
        }
      }
    }
    out[clip.name] = +worst.toFixed(2);
  }
  return out;
}
(window as unknown as { __check: (files: string[]) => Promise<unknown> }).__check = async (files) => {
  const res: Record<string, unknown> = {};
  for (const b of ['dino', 'cheetah', 'monkey', 'koala']) res[b] = await check(b, files);
  return res;
};
(window as unknown as { __ready: boolean }).__ready = true;
