// Flat views of Glimmer models on a measuring grid, for reading off landmark positions by eye: from the
// front (x across, y up), from the side (z across, y up) and from above (x across, z down the page),
// with the current landmarks as labelled dots. Development only: /scripts/glimmers/rigviews.html?ids=a,b
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { guessLandmarks, cloudOf, positionsOf, type Landmarks, type V3 } from '../../src/lib/three/glimmerRig';

const q = new URLSearchParams(location.search), S = +(q.get('size') ?? 300);
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setPixelRatio(1); r.setSize(S, S, false); r.setClearColor(0xf4f7fa); r.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x999999, 2.4));
const COLS: Record<string, string> = { head: '#ff0040', chest: '#ff0040', hips: '#ff0040', tail: '#ff8c00', feet: '#0070ff', hands: '#00a080', wings: '#9030ff', fins: '#3050ff', ears: '#ff30b0', tentacles: '#10a040' };

async function run() {
  const meta: Record<string, { rig?: Landmarks; head: number[] }> = await fetch(`${import.meta.env.BASE_URL}models/glimmers/meta.json?${Date.now()}`).then(x => x.json());
  const ids = q.get('ids')!.split(',');
  const sheet = document.createElement('canvas'); sheet.width = 3 * S; sheet.height = ids.length * (S + 16);
  const g2 = sheet.getContext('2d')!; g2.fillStyle = '#fff'; g2.fillRect(0, 0, sheet.width, sheet.height);
  for (const [n, id] of ids.entries()) {
    const gl = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/glimmers/${id}.glb`);
    gl.scene.updateMatrixWorld(true);
    let mesh: THREE.Mesh | null = null; gl.scene.traverse(o => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
    const m = mesh as unknown as THREE.Mesh;
    const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld);
    const obj = new THREE.Mesh(geo, m.material); scene.add(obj);
    const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position as THREE.BufferAttribute);
    const lm = meta[id]?.rig ?? guessLandmarks(cloudOf(positionsOf(geo)), 'quad', {}, meta[id] as never);
    const half = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) * 0.56;
    const mid = box.getCenter(new THREE.Vector3());
    const cam = new THREE.OrthographicCamera(-half, half, half, -half, -10, 10);
    // [camera direction, up, the page's x axis (world axis, sign), the page's y axis]
    const views: [THREE.Vector3, THREE.Vector3, [number, number], [number, number], string][] = [
      [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), [0, 1], [1, 1], 'front: x across, y up'],
      [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), [2, -1], [1, 1], 'side: z across (front at left), y up'],
      [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), [0, 1], [2, -1], 'top: x across, z down the page (front at the bottom)'],
    ];
    views.forEach(([dir, up, ax, ay, label], v) => {
      cam.position.copy(mid).addScaledVector(dir, 5); cam.up.copy(up); cam.lookAt(mid); cam.updateProjectionMatrix();
      r.render(scene, cam);
      const ox = v * S, oy = n * (S + 16);
      g2.drawImage(r.domElement, ox, oy);
      const c = (p: number[]) => [mid.getComponent(ax[0]) + ((p[ax[0]] - mid.getComponent(ax[0])) * ax[1]), 0];
      void c;
      const px = (w: number, axis: [number, number]) => (axis === ax ? ox + S / 2 + ((w - mid.getComponent(ax[0])) * ax[1] / half) * (S / 2) : 0);
      const py = (w: number) => oy + S / 2 - ((w - mid.getComponent(ay[0])) * ay[1] / half) * (S / 2);
      // the grid: every 0.1 m, labelled every 0.2
      g2.strokeStyle = 'rgba(0,40,90,.18)'; g2.fillStyle = 'rgba(0,40,90,.7)'; g2.font = '10px system-ui';
      for (let w = Math.ceil((mid.getComponent(ax[0]) - half) * 10) / 10; w <= mid.getComponent(ax[0]) + half; w += 0.1) {
        const x = px(w, ax); g2.beginPath(); g2.moveTo(x, oy); g2.lineTo(x, oy + S); g2.stroke();
        if (Math.round(w * 10) % 2 === 0) g2.fillText(w.toFixed(1), x + 1, oy + S - 3);
      }
      for (let w = Math.ceil((mid.getComponent(ay[0]) - half) * 10) / 10; w <= mid.getComponent(ay[0]) + half; w += 0.1) {
        const y = py(w); g2.beginPath(); g2.moveTo(ox, y); g2.lineTo(ox + S, y); g2.stroke();
        if (Math.round(w * 10) % 2 === 0) g2.fillText(w.toFixed(1), ox + 2, y - 2);
      }
      // the landmarks
      const dot = (p: V3, col: string, tag: string) => {
        const x = px(p[ax[0]], ax), y = py(p[ay[0]]);
        g2.fillStyle = col; g2.beginPath(); g2.arc(x, y, 3.5, 0, 7); g2.fill();
        g2.fillStyle = '#000'; g2.font = 'bold 9px system-ui'; g2.fillText(tag, x + 4, y - 3);
      };
      const L = lm as Record<string, unknown>;
      for (const k of ['head', 'chest', 'hips']) if (L[k]) dot(L[k] as V3, COLS[k], k[0] + (k === 'chest' ? 'c' : k === 'hips' ? 'h' : 'd'));
      (lm.tail ?? []).forEach((p, i) => dot(p, COLS.tail, `t${i}`));
      (lm.feet ?? []).forEach((p, i) => dot(p, COLS.feet, `f${i}`));
      (lm.hands ?? []).forEach((p, i) => dot(p, COLS.hands, `a${i}`));
      for (const k of ['wings', 'fins', 'ears'] as const) (lm[k] ?? []).forEach((pr, i) => pr.forEach((p, j) => dot(p, COLS[k], `${k[0]}${i}${j ? 't' : 'r'}`)));
      (lm.tentacles ?? []).forEach((t, i) => t.forEach((p, j) => dot(p, COLS.tentacles, `n${i}${j}`)));
      g2.fillStyle = '#223'; g2.font = '11px system-ui'; g2.fillText(`${id} (${lm.plan}) ${label}`, ox + 4, oy + S + 12);
    });
    scene.remove(obj);
  }
  const out = document.createElement('img'); out.src = sheet.toDataURL('image/jpeg', 0.88); document.getElementById('grid')!.append(out);
  Object.assign(window, { __sheet: out.src, __done: true });
}
run().catch(e => { document.getElementById('status')!.textContent = 'Failed: ' + e; Object.assign(window, { __done: true, __err: String(e) }); });
