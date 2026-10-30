// Dev only: each Glimmer's outline, rendered from its 3D model with a see-through background, for the
// Glimmer Book's unmet cards (public/game/glimmers/shape/<id>.webp; the ladder's own come from their concept
// paintings, scripts/glimmers/concepts-finish.py). In the dev server's page:
//   const m = await import('/src/dev/shapes.ts'); await m.renderShapes(['puddlepup'])  -> { id: PNG data URL }
// 384 x 576, the model turned a little toward you, black where the model is.
import * as THREE from 'three';
import { loadGltf } from '../lib/three/assets';

export async function renderShapes(ids: string[], w = 384, h = 576): Promise<Record<string, string>> {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(w, h, false); renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(24, w / h, 0.01, 100);
  const black = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  const out: Record<string, string> = {};
  for (const id of ids) {
    const gl = await loadGltf(`models/glimmers/${id}.glb`);
    if (!gl) continue;
    const obj = gl.scene.clone(true);
    obj.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.material = black; });
    obj.rotation.y = -0.45;
    scene.add(obj); obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    // fit the taller of its height, or its width for this picture's shape, with a little room round it
    const fitH = Math.max(size.y, (size.x * h) / w) * 1.12;
    const d = fitH / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) + size.z / 2;
    cam.position.set(mid.x, mid.y + fitH * 0.05, mid.z + d); cam.lookAt(mid);
    renderer.render(scene, cam);
    out[id] = renderer.domElement.toDataURL('image/png');
    scene.remove(obj);
  }
  renderer.dispose();
  return out;
}
