// A sheet of Glimmer skeletons for checking landmarks at a glance: each Glimmer from the front three
// quarters and from the side, its mesh tinted by the bone that moves it, the bones as lines and the
// landmarks as dots. Development only: /scripts/glimmers/rigsheet.html?ids=a,b (default: all with a rig).
// window.__sheet holds the result (JPEG data URL) when window.__done is true.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeBones, skinFor, type Landmarks } from '../../src/lib/three/glimmerRig';

const q = new URLSearchParams(location.search), S = +(q.get('size') ?? 240);
const PALETTE = [0xe6194b, 0x3cb44b, 0xffe119, 0x4363d8, 0xf58231, 0x911eb4, 0x46f0f0, 0xf032e6, 0xbcf60c, 0xfabebe, 0x008080, 0xe6beff, 0x9a6324, 0xfffac8, 0x800000, 0xaaffc3, 0x808000, 0xffd8b1, 0x000075, 0x808080, 0x222222, 0xff8800, 0x00aa88, 0x8800ff];
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setPixelRatio(1); r.setSize(S, S, false); r.setClearColor(0xf2f6fa);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 2.2));
const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);

async function run() {
  const meta: Record<string, { rig?: Landmarks }> = await fetch(`${import.meta.env.BASE_URL}models/glimmers/meta.json?${Date.now()}`).then(x => x.json());
  const ids = q.get('ids')?.split(',') ?? Object.keys(meta).filter(k => meta[k].rig);
  const cols = 3, views = 2;
  const sheet = document.createElement('canvas');
  sheet.width = cols * views * S; sheet.height = Math.ceil(ids.length / cols) * (S + 18);
  const g2 = sheet.getContext('2d')!; g2.fillStyle = '#fff'; g2.fillRect(0, 0, sheet.width, sheet.height); g2.font = '13px system-ui';
  for (const [n, id] of ids.entries()) {
    (document.getElementById('status')!).textContent = id;
    const lm = meta[id].rig!;
    const gl = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/glimmers/${id}.glb`);
    gl.scene.updateMatrixWorld(true);
    let mesh: THREE.Mesh | null = null; gl.scene.traverse(o => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
    const geo = (mesh as unknown as THREE.Mesh).geometry.clone(); geo.applyMatrix4((mesh as unknown as THREE.Mesh).matrixWorld);
    const skin = skinFor(`sheet|${id}|${JSON.stringify(lm)}`, geo, lm);
    const si = skin.geometry.attributes.skinIndex, sw = skin.geometry.attributes.skinWeight, col = new Float32Array(si.count * 3), c = new THREE.Color();
    for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) { c.setHex(PALETTE[si.getComponent(i, k) % PALETTE.length]); const w = sw.getComponent(i, k); col[i * 3] += c.r * w; col[i * 3 + 1] += c.g * w; col[i * 3 + 2] += c.b * w; }
    const g = skin.geometry.clone(); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const { bones, inverses } = makeBones(skin.rig);
    const sk = new THREE.SkinnedMesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.8 }));
    sk.add(bones[0]); sk.bind(new THREE.Skeleton(bones, inverses), new THREE.Matrix4()); sk.frustumCulled = false;
    const lines = new THREE.Group();
    for (const b of skin.rig.bones) {
      const lg = new THREE.BufferGeometry().setFromPoints([b.at, b.end]);
      const l = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x000000, depthTest: false })); l.renderOrder = 5; lines.add(l);
      const d = new THREE.Mesh(new THREE.SphereGeometry(skin.rig.height * 0.013, 8, 6), new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false })); d.position.copy(b.at); d.renderOrder = 6; lines.add(d);
    }
    scene.add(sk, lines);
    const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position as THREE.BufferAttribute), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const h = Math.max(size.x, size.y, size.z) * 1.1, d = h / (2 * Math.tan(THREE.MathUtils.degToRad(15)));
    [new THREE.Vector3(0.7, 0.35, 1), new THREE.Vector3(1, 0.15, 0)].forEach((dir, v) => {
      cam.position.copy(mid).addScaledVector(dir.normalize(), d); cam.lookAt(mid); r.render(scene, cam);
      g2.drawImage(r.domElement, ((n % cols) * views + v) * S, Math.floor(n / cols) * (S + 18));
    });
    g2.fillStyle = '#223'; g2.fillText(`${id} (${lm.plan}, ${skin.rig.bones.length} bones)`, (n % cols) * views * S + 4, Math.floor(n / cols) * (S + 18) + S + 13);
    scene.remove(sk, lines); g.dispose();
  }
  const out = document.createElement('img'); out.src = sheet.toDataURL('image/jpeg', 0.85); document.getElementById('grid')!.append(out);
  document.getElementById('status')!.textContent = 'Done';
  Object.assign(window, { __sheet: out.src, __done: true });
}
run().catch(e => { document.getElementById('status')!.textContent = 'Failed: ' + e; Object.assign(window, { __done: true, __err: String(e) }); });
