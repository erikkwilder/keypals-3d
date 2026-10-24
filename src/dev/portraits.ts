// Dev page (portraits.html): renders each buddy's picture from the 3D model, with a see-through
// background, for the menus. window.__portraits() returns { id: { full, head } } as PNG data URLs.
import * as THREE from 'three';
import { Character } from '../lib/three/character';
import { BUDDIES, type FriendId } from '../lib/art/cast';

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xeef6ff, 0xa8b090, 1.5));
const key = new THREE.DirectionalLight(0xfff4e6, 2.3); key.position.set(1.6, 3, 3.2); scene.add(key);
const rim = new THREE.DirectionalLight(0xe8dcff, 1.1); rim.position.set(-2.5, 2, -2); scene.add(rim);
const cam = new THREE.PerspectiveCamera(24, 1, 0.05, 50);

function shot(c: Character, size: number, frame: (box: THREE.Box3) => { aim: THREE.Vector3; h: number }) {
  renderer.setSize(size, size, false);
  c.root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  c.model.traverse(o => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh) { m.computeBoundingBox(); box.union(m.boundingBox!.clone().applyMatrix4(m.matrixWorld)); } });
  // skinned bounding boxes are in bind pose; use the bones for the posed extent
  const pb = new THREE.Box3();
  for (const b of Object.values(c.bones)) pb.expandByPoint(b.getWorldPosition(new THREE.Vector3()));
  const { aim, h } = frame(pb);
  const d = h / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
  cam.position.set(aim.x, aim.y + h * 0.04, aim.z + d);
  cam.lookAt(aim);
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/png');
}

async function one(id: FriendId) {
  const c = await Character.create(id);
  if (!c) return null;
  await c.loadMoves();
  scene.add(c.root);
  c.groundFeet = false;
  c.root.rotation.y = -0.38;
  c.mixer.stopAllAction();
  const a = c.actions.idle; a.reset().play(); c.mixer.setTime(a.getClip().duration * 0.15);
  c.root.updateMatrixWorld(true);
  const H = c.bones.Head.getWorldPosition(new THREE.Vector3());
  const full = shot(c, 512, (b) => { const top = Math.max(b.max.y, H.y) + 0.32; return { aim: new THREE.Vector3(0, top / 2, 0), h: top * 1.04 }; });
  const head = shot(c, 360, () => ({ aim: H.clone().add(new THREE.Vector3(0, 0.02, 0)), h: 0.9 }));
  scene.remove(c.root);
  return { full, head };
}

(window as unknown as { __portraits: () => Promise<Record<string, unknown>> }).__portraits = async () => {
  const out: Record<string, unknown> = {};
  for (const b of BUDDIES) out[b.id] = await one(b.id);
  return out;
};
(window as unknown as { __ready: boolean }).__ready = true;
