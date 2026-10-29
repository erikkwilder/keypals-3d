// Courses for the math trips that don't run the island trail: a cliff to climb, a snowy slope to sled
// down and a bay to swim across. Each is built like an island (a trail with at(s), a finish, a root to
// put on stage), so the trip, the speed ladder, the finish dance and the results work the same way on
// every one of them. They're dressed with the islands' own models (cliffs, spires, pines, snowy peaks,
// palms, the lighthouse, boulders, bushes), painted textures, a sky, clouds and floating islands.
import * as THREE from 'three';
import { THEMES, type Theme } from './themes';
import { loadGltf, loadTexture } from './assets';
import type { Island, TrailPoint } from './island';
import { courseEggs } from '../fun/worldEggs';

export type CourseMove = 'climb' | 'slide' | 'swim';
const UP = new THREE.Vector3(0, 1, 0);

/** A copy of a model scaled to a height, its base on y = 0. */
async function model(path: string, height: number): Promise<THREE.Object3D | null> {
  const g = await loadGltf(path);
  if (!g) return null;
  const o = g.scene.clone(true);
  const box = new THREE.Box3().setFromObject(o), size = box.getSize(new THREE.Vector3());
  const k = height / Math.max(1e-6, size.y);
  o.scale.setScalar(k);
  o.position.y = -box.min.y * k;
  const wrap = new THREE.Group(); wrap.add(o);
  o.traverse(m => { const mm = m as THREE.Mesh; if (mm.isMesh) { mm.castShadow = true; mm.receiveShadow = true; } });
  return wrap;
}
/** Place copies of a model: [x, z, scale, turn, y?]. */
async function scatter(root: THREE.Object3D, path: string, height: number, spots: number[][]) {
  const m = await model(path, height);
  if (!m) return;
  for (const [x, z, s, r, y] of spots) { const c = m.clone(true); c.position.set(x, y ?? 0, z); c.scale.setScalar(s); c.rotation.y = r; root.add(c); }
}
const rand = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function flag(color: number) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }));
  pole.position.y = 1.3; pole.castShadow = true; g.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7, 10, 3), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.8 }));
  cloth.position.set(0.58, 2.2, 0); g.add(cloth);
  g.userData.cloth = cloth;
  return g;
}
const wave = (cloth: THREE.Mesh, t: number) => {
  const pos = cloth.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) + 0.55; pos.setZ(i, Math.sin(t * 5 + x * 5) * 0.08 * x); }
  pos.needsUpdate = true;
};

/** Build a course. `length` is a first guess; placeFinish sets the real end. */
export async function buildCourse(move: CourseMove): Promise<Island> {
  const root = new THREE.Group();
  const theme: Theme = { ...THEMES[move === 'climb' ? 'cliffs' : move === 'slide' ? 'ridge' : 'shores'] };
  const own: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { own.push(x); return x; };
  const rnd = rand(move === 'climb' ? 11 : move === 'slide' ? 23 : 37);
  let finishS = 30;
  const fin = flag(move === 'climb' ? 0xef7d2b : move === 'slide' ? 0x7c5cf5 : 0x2fa898);
  root.add(fin);
  let update: (dt: number, t: number) => void = () => {};
  let archFade: (k: number) => void = () => {};
  let at: (s: number) => TrailPoint;

  // ---------- sky, light, clouds and far islands (as on the islands) ----------
  const T = theme, sunDir = new THREE.Vector3(0.45, 0.55, 0.7).normalize();
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(1500, 32, 16)), keep(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(T.sky[0]) }, mid: { value: new THREE.Color(T.sky[1]) }, low: { value: new THREE.Color(T.sky[2]) }, sunDir: { value: sunDir } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: 'uniform vec3 top, mid, low, sunDir; varying vec3 vDir; void main(){ float y = vDir.y; vec3 c = mix(low, mid, smoothstep(-0.08, 0.18, y)); c = mix(c, top, smoothstep(0.18, 0.75, y)); float s = max(0.0, dot(normalize(vDir), sunDir)); c += vec3(1.0,0.93,0.78) * (pow(s, 600.0) * 1.6 + pow(s, 12.0) * 0.18); gl_FragColor = vec4(c, 1.0); }',
  })));
  sky.renderOrder = -1;
  root.add(sky);
  const hemi = new THREE.HemisphereLight(T.hemi.sky, T.hemi.ground, T.hemi.power * 1.1);
  const sun = new THREE.DirectionalLight(T.sun.color, T.sun.power);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 180 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
  root.add(hemi, sun, sun.target);
  const sunOffset = sunDir.clone().multiplyScalar(70);
  const puffTex = await loadTexture('world/cloud.webp');
  const clouds = new THREE.Group(); root.add(clouds);
  if (puffTex) {
    const mat = keep(new THREE.MeshBasicMaterial({ map: puffTex, transparent: true, depthWrite: false, fog: false }));
    const geo = keep(new THREE.PlaneGeometry(1, 1));
    const n = move === 'swim' ? 16 : 34;
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(geo, mat), sz = 14 + rnd() * 26;
      const low = move !== 'swim' && i < n / 2;
      p.position.set(-60 + rnd() * 300, low ? -26 + rnd() * 10 : 18 + rnd() * 40, -70 - rnd() * 160);
      p.scale.set(sz * 2.2, sz, 1); clouds.add(p);
    }
  }
  const farIsl = move === 'swim' ? null : await model('world/island.glb', 10);
  if (farIsl) for (let i = 0; i < 7; i++) { const c = farIsl.clone(true); c.position.set(-40 + rnd() * 240, -8 + rnd() * 30, -60 - rnd() * 120); c.scale.setScalar(0.8 + rnd() * 2); c.rotation.y = rnd() * 6; root.add(c); }

  if (move === 'climb') {
    // a sandstone pillar rising from a meadow; the buddy climbs its face (facing in, the camera out on the
    // open side, +z) and steps over the lip onto a grassy summit. The face ends at the top: nothing hangs
    // over the climber.
    const RUN = 4, H = 70, CZ = -3.2, A = 6.1, B = 3.0; // the summit: an oval A by B round (0, CZ)
    const rockTex = await loadTexture('world/rock.webp', { repeat: true, color: true });
    if (rockTex) rockTex.repeat.set(2.2, H / 5.5);
    const rockMat = keep(new THREE.MeshStandardMaterial({ map: rockTex, color: rockTex ? 0xffffff : 0xd9b98a, roughness: 0.92 }));
    // the face's relief: ledges and bulges, smooth near the climbing line, curving back at the sides
    const faceZ = (x: number, y: number) => {
      const bump = Math.sin(x * 1.7 + y * 0.6) * 0.12 + Math.sin(y * 2.3 - x * 0.8) * 0.08 + Math.max(0, Math.sin(y * 0.9 + x)) * 0.1;
      return -0.45 + bump * Math.min(1, 0.35 + Math.abs(x) / 2) - Math.max(0, Math.abs(x) - 2.8) ** 1.6 * 0.35;
    };
    const faceGeo = keep(new THREE.PlaneGeometry(11, H, 60, 300));
    const face = new THREE.Mesh(faceGeo, rockMat);
    face.receiveShadow = true; face.castShadow = true;
    root.add(face);
    // the pillar's sides and back, just behind the face
    const sideTex = rockTex?.clone();
    if (sideTex) { sideTex.repeat.set(7, H / 5.5); sideTex.needsUpdate = true; }
    const pillar = new THREE.Mesh(keep(new THREE.CylinderGeometry(1, 1, H, 48, 1, true)), keep(new THREE.MeshStandardMaterial({ map: sideTex ?? null, color: sideTex ? 0xffffff : 0xd9b98a, roughness: 0.92 })));
    pillar.scale.set(A - 0.2, 1, B - 0.45); pillar.receiveShadow = true; root.add(pillar);
    // the summit: grass on a gentle mound, a turf edge hanging over the rock
    const grassTex = await loadTexture('world/grass.webp', { repeat: true, color: true });
    const capGeo = keep(new THREE.CircleGeometry(1, 72, 0, Math.PI * 2));
    {
      const cp = capGeo.attributes.position as THREE.BufferAttribute, uv = capGeo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < cp.count; i++) {
        const x = cp.getX(i), y = cp.getY(i), r2 = x * x + y * y, ang = Math.atan2(y, x);
        const wob = 1 + Math.sin(ang * 5 + 1) * 0.015 * r2;
        const wx = x * A * wob, wy = y * B * wob;
        cp.setXYZ(i, wx, wy, 0.1 * (1 - r2));
        uv.setXY(i, wx / 2.2, wy / 2.2); // about 2 metres of grass per tile, as on the islands
      }
      capGeo.computeVertexNormals();
    }
    const capTex = grassTex?.clone();
    if (capTex) { capTex.repeat.set(1, 1); capTex.needsUpdate = true; }
    const cap = new THREE.Mesh(capGeo, keep(new THREE.MeshStandardMaterial({ map: capTex ?? null, color: capTex ? 0xe8f2d8 : 0x8fc46a, roughness: 1 })));
    cap.rotation.x = -Math.PI / 2; cap.receiveShadow = true;
    // the turf's edge: a band of earth just under the grass, all the way round
    const dirtTex = await loadTexture('world/dirt.webp', { repeat: true, color: true });
    if (dirtTex) dirtTex.repeat.set(14, 0.25);
    const turf = new THREE.Mesh(keep(new THREE.CylinderGeometry(1, 0.97, 0.32, 72, 1, true)), keep(new THREE.MeshStandardMaterial({ map: dirtTex ?? null, color: dirtTex ? 0x9c8466 : 0x7a5a3a, roughness: 1 })));
    turf.scale.set(A, 1, B);
    // grass blades on the summit, swaying, thicker at the edge where they hang over
    const wind = { value: 0 };
    const blade = keep(new THREE.BufferGeometry());
    {
      const Wd = 0.03;
      blade.setAttribute('position', new THREE.Float32BufferAttribute([-Wd, 0, 0, Wd, 0, 0, -Wd * 0.8, 0.4, 0, Wd * 0.8, 0.4, 0, -Wd * 0.5, 0.75, 0, Wd * 0.5, 0.75, 0, 0, 1, 0], 3));
      blade.setAttribute('color', new THREE.Float32BufferAttribute([0.3, 0.46, 0.18, 0.3, 0.46, 0.18, 0.52, 0.68, 0.28, 0.52, 0.68, 0.28, 0.72, 0.84, 0.4, 0.72, 0.84, 0.4, 0.88, 0.94, 0.52], 3));
      blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
    }
    const bladeMat = keep(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    bladeMat.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = wind;
      sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float bend = position.y * position.y;
        transformed.x += (sin(uWind * 1.6 + ip.x * 0.8 + ip.z * 0.5) * 0.5 + sin(uWind * 2.7 + ip.x * 1.9) * 0.18) * 0.2 * bend;
        transformed.z += cos(uWind * 1.3 + ip.z * 0.9) * 0.08 * bend;`).replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);');
    };
    const BLADES = 2600;
    const blades = new THREE.InstancedMesh(blade, bladeMat, BLADES);
    blades.receiveShadow = true;
    const bladeAt: number[][] = [];
    for (let i = 0; i < BLADES; i++) {
      // half of them crowd the edge, the rest anywhere on top
      const ang = rnd() * Math.PI * 2, r = i % 2 ? 0.86 + rnd() * 0.15 : Math.sqrt(rnd()) * 0.95;
      bladeAt.push([Math.cos(ang) * r * A, Math.sin(ang) * r * B, r, rnd() * Math.PI, 0.6 + rnd() * 0.8, 0.12 + rnd() * 0.16 + (r > 0.85 ? 0.08 : 0), rnd()]);
    }
    // climbing holds: sculpted resin shapes bolted to the rock (jugs, crimps, slopers, pinches)
    const grain = (() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const g = cv.getContext('2d')!, img = g.createImageData(128, 128);
      for (let i = 0; i < 128 * 128; i++) { const v = 200 + Math.random() * 55 - (Math.random() < 0.04 ? 60 : 0); img.data.set([v, v, v, 255], i * 4); }
      g.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
      return keep(t);
    })();
    const holdMat = keep(new THREE.MeshStandardMaterial({ map: grain, bumpMap: grain, bumpScale: 1.5, roughness: 0.82 }));
    const shapeHold = (kind: number) => {
      const g = new THREE.SphereGeometry(0.1, 22, 16), p = g.attributes.position as THREE.BufferAttribute;
      const [sx, sy, sz] = [[1.35, 0.85, 0.75], [1.7, 0.42, 0.5], [1.2, 1.0, 0.5], [0.6, 1.45, 0.7]][kind];
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i) / 0.1, y = p.getY(i) / 0.1, z = p.getZ(i) / 0.1;
        // lumpy, like hand-sculpted resin
        const lump = 1 + (Math.sin(x * 3.1 + kind) * Math.sin(y * 2.7 + 0.3 * kind) * Math.sin(z * 3.3 + 2.1)) * (kind === 2 ? 0.05 : 0.14) + Math.sin(x * 7 + y * 5) * 0.03;
        x *= lump; y *= lump; z *= lump;
        // a jug has an incut lip: scoop the top front so fingers can wrap it
        if (kind === 0 && y > 0.1 && z > 0) z *= 1 - Math.min(0.7, (y - 0.1) * 0.9);
        if (kind === 1 && y > 0.2) y = 0.2 + (y - 0.2) * 0.4; // a crimp's flat top edge
        z = Math.max(z, -0.05); // flat on the back, against the rock
        p.setXYZ(i, x * sx * 0.1, y * sy * 0.1, z * sz * 0.1);
      }
      g.computeVertexNormals();
      return keep(g);
    };
    const HOLD_COLS = [0xd8434f, 0xf2b632, 0x2f86c9, 0x3fa36f, 0x8d63cf, 0xee7430, 0x2c2c34, 0xf3efe6];
    const holdSets = [0, 1, 2, 3].map(k => { const m = new THREE.InstancedMesh(shapeHold(k), holdMat, 200); m.castShadow = true; m.receiveShadow = true; root.add(m); return m; });
    const bolts = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 6)), keep(new THREE.MeshStandardMaterial({ color: 0x55585f, metalness: 0.8, roughness: 0.35 })), 800);
    root.add(bolts);
    const holdAt: { x: number; y: number; kind: number; turn: number; s: number; col: number }[] = [];
    for (let y = 0.25; y < H; y += 0.34 + rnd() * 0.12) {
      // two on the line, one each side of the body, and now and then one further out
      for (const side of [-1, 1]) holdAt.push({ x: side * (0.28 + rnd() * 0.25), y: y + side * 0.08, kind: Math.floor(rnd() * 4), turn: (rnd() - 0.5) * 0.9, s: 0.85 + rnd() * 0.45, col: Math.floor(rnd() * HOLD_COLS.length) });
      if (rnd() < 0.6) holdAt.push({ x: (rnd() < 0.5 ? -1 : 1) * (1 + rnd() * 1.4), y: y + rnd() * 0.2, kind: Math.floor(rnd() * 4), turn: (rnd() - 0.5) * 1.6, s: 0.8 + rnd() * 0.5, col: Math.floor(rnd() * HOLD_COLS.length) });
    }
    // a rope down the line, tied off to a stake on top
    const ropeMat = keep(new THREE.MeshStandardMaterial({ color: 0xe8543a, roughness: 0.75 }));
    const rope = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.022, 0.022, 1, 6)), ropeMat);
    const tie = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.022, 0.022, 0.8, 6)), ropeMat);
    tie.rotation.x = Math.PI / 2 - 0.15;
    const stake = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.035, 0.03, 0.45, 8)), keep(new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.9 })));
    root.add(rope, tie, stake);
    // rock spires either side and behind, well back so none comes between the camera and the climber
    await scatter(root, 'world/rock_spire.glb', 18, [[-14, -10, 1.4, 0.3], [15, -11, 1.6, 2], [-22, -20, 2.2, 1], [23, -18, 2.4, 4], [-32, -34, 2.8, 5], [34, -32, 3, 2]]);
    // a meadow at the foot: grass, bushes, boulders, mushrooms
    if (grassTex) grassTex.repeat.set(30, 30);
    const meadow = new THREE.Mesh(keep(new THREE.CircleGeometry(60, 48)), keep(new THREE.MeshStandardMaterial({ map: grassTex, color: grassTex ? 0xffffff : 0x8fc46a, roughness: 1 })));
    meadow.rotation.x = -Math.PI / 2; meadow.position.y = -0.02; meadow.receiveShadow = true; root.add(meadow);
    await scatter(root, 'world/bush.glb', 0.9, [[-4.2, 0.9, 1, 0], [4.4, 0.8, 1.2, 2], [-6.5, 2.5, 1.4, 1], [6.8, 2.2, 1, 3], [8.5, 0.5, 1.3, 1], [-9, 1, 1.2, 2]]);
    await scatter(root, 'world/boulder.glb', 1.1, [[-4.5, 0.4, 1, 0.5], [4.6, -0.2, 1.3, 2], [8.5, 3.5, 1.6, 1], [-8, 4, 1.4, 3]]);
    await scatter(root, 'world/mushroom.glb', 0.5, [[-3.4, 0.8, 1, 0], [3.2, 0.9, 0.8, 1]]);
    // the summit's own things, set on top when the height is known
    const summit = new THREE.Group();
    summit.add(cap, turf, blades);
    for (const [path, h, spots] of [
      ['world/bush.glb', 0.8, [[-2.9, -1.6, 1.1, 0.4], [3.3, -2.4, 0.9, 2], [-1.2, -5.2, 1.3, 1], [4.6, -4.1, 1.2, 3]]],
      ['world/boulder.glb', 0.9, [[-4.4, -3.3, 1, 1], [2.2, -5.4, 0.8, 2.5]]],
      ['world/mushroom.glb', 0.4, [[-2.2, -0.9, 0.9, 0], [-2.5, -1.2, 0.6, 1]]],
      ['world/pine_tree.glb', 3.6, [[-3.4, -4.8, 1, 0.3], [3.6, -5.0, 0.9, 2]]],
    ] as [string, number, number[][]][]) {
      const m = await model(path, h);
      if (!m) continue;
      for (const [x, wz, sc, r] of spots) { const z = wz - CZ, c = m.clone(true); c.position.set(x, 0.1 * Math.max(0, 1 - (x / A) ** 2 - (z / B) ** 2), z); c.scale.setScalar(sc); c.rotation.y = r; summit.add(c); }
    }
    root.add(summit);
    // the climb ends OVER metres of trail before the finish; those last metres walk back over the lip
    const OVER = 0.7;
    at = (s) => {
      const y = Math.max(0, Math.min(s, finishS - OVER) - RUN);
      const over = Math.max(0, Math.min(1, (s - finishS + OVER) / OVER));
      return { p: new THREE.Vector3(0, y + Math.sin(over * Math.PI / 2) * 0.08, -over * 1.4), t: UP.clone(), n: new THREE.Vector3(0, 0, 1) };
    };
    root.userData.overAt = () => finishS - OVER;
    // for the surprises: the rock's depth anywhere on the face, and where the top is
    root.userData.wallZ = faceZ; root.userData.top = () => finishS - OVER - RUN;
    const o = new THREE.Object3D(), c = new THREE.Color();
    const place = () => {
      const top = finishS - OVER - RUN;
      // the face, curved to its relief, ending at the summit
      const fp = faceGeo.attributes.position as THREE.BufferAttribute, base = (faceGeo.userData.base ??= Float32Array.from(fp.array as Float32Array)) as Float32Array;
      for (let i = 0; i < fp.count; i++) { const x = base[i * 3], y = base[i * 3 + 1] + top - H / 2; fp.setZ(i, faceZ(x, y) + 0.45); }
      fp.needsUpdate = true; faceGeo.computeVertexNormals();
      face.position.set(0, top - H / 2, -0.45);
      pillar.position.set(0, top - H / 2 - 0.05, CZ);
      summit.position.set(0, top, CZ);
      cap.position.set(0, 0.0, 0); turf.position.set(0, -0.15, 0);
      // blades sit on the mound
      bladeAt.forEach(([x, z, r, turn, w, h, hue], i) => {
        o.position.set(x, 0.1 * (1 - r * r) - 0.02, z); o.rotation.set(0, turn, (hue - 0.5) * 0.4); o.scale.set(w, h, 1); o.updateMatrix();
        blades.setMatrixAt(i, o.matrix); blades.setColorAt(i, c.setHSL(0.24 + hue * 0.06, 0.45 + hue * 0.15, 0.36 + hue * 0.14));
      });
      blades.instanceMatrix.needsUpdate = true; if (blades.instanceColor) blades.instanceColor.needsUpdate = true;
      blades.computeBoundingSphere();
      // the holds, on the rock up to the lip
      const counts = [0, 0, 0, 0];
      let nb = 0;
      for (const h of holdAt) {
        if (h.y > top - 0.35) continue;
        const set = holdSets[h.kind], k = counts[h.kind]++;
        if (k >= 200) continue;
        const z = faceZ(h.x, h.y);
        o.position.set(h.x, h.y, z - 0.01); o.rotation.set(0, 0, h.turn); o.scale.setScalar(h.s); o.updateMatrix();
        set.setMatrixAt(k, o.matrix); set.setColorAt(k, c.set(HOLD_COLS[h.col]));
        o.position.set(h.x, h.y, z + 0.1 * [0.75, 0.5, 0.5, 0.7][h.kind] * h.s * 0.9); o.rotation.set(Math.PI / 2, 0, 0); o.scale.setScalar(1); o.updateMatrix();
        if (nb < 800) bolts.setMatrixAt(nb++, o.matrix);
      }
      holdSets.forEach((m, k) => { m.count = Math.min(200, counts[k]); m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); });
      bolts.count = nb; bolts.instanceMatrix.needsUpdate = true; bolts.computeBoundingSphere();
      rope.scale.y = top; rope.position.set(-0.85, top / 2, -0.17);
      stake.position.set(-0.85, top + 0.15, -0.95);
      tie.position.set(-0.85, top + 0.12, -0.55);
      fin.position.set(1.9, top + 0.05, -2.3);
    };
    place();
    root.userData.place = place;
    update = (_dt, t) => { wave(fin.userData.cloth, t); wind.value = t; };
  } else if (move === 'slide') {
    // a long snowy run down the ridge between pines; the buddy sleds down along +x
    const SLOPE = 0.3;
    const snowTex = await loadTexture('world/snow.webp', { repeat: true, color: true });
    if (snowTex) snowTex.repeat.set(40, 9);
    const snowMat = keep(new THREE.MeshStandardMaterial({ map: snowTex, color: 0xffffff, roughness: 0.85 }));
    const slopeGeo = keep(new THREE.PlaneGeometry(360, 90, 180, 45));
    const sp = slopeGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i), y = sp.getY(i);
      // a smooth groomed run in the middle, drifts and banks either side
      sp.setZ(i, Math.abs(y) > 2.4 ? Math.sin(x * 0.09 + y * 0.25) * 0.7 + (Math.abs(y) - 2.4) * 0.16 + Math.sin(x * 0.4 + y) * 0.12 : Math.sin(x * 0.5) * 0.02);
    }
    slopeGeo.computeVertexNormals();
    const slope = new THREE.Mesh(slopeGeo, snowMat);
    slope.rotation.x = -Math.PI / 2; slope.position.set(160, 0, 0); slope.receiveShadow = true;
    const tilt = new THREE.Group(); tilt.rotation.z = -Math.atan(SLOPE); tilt.add(slope);
    root.add(tilt);
    // the groomed lanes, a blue edge line either side
    const lineMat = keep(new THREE.MeshBasicMaterial({ color: 0x9cc6ff, transparent: true, opacity: 0.55 }));
    for (const z of [-2.2, 2.2]) { const l = new THREE.Mesh(keep(new THREE.PlaneGeometry(340, 0.12)), lineMat); l.rotation.x = -Math.PI / 2; l.position.set(160, 0.02, z); const g = new THREE.Group(); g.rotation.z = -Math.atan(SLOPE); g.add(l); root.add(g); }
    // pines and boulders down both sides, far peaks behind
    const pines: number[][] = [];
    for (let i = 0; i < 120; i++) {
      const x = -10 + rnd() * 330, side = rnd() < 0.62 ? -1 : 1, z = side * (3.6 + Math.pow(rnd(), 0.8) * 26);
      if (side > 0 && z < 7) continue; // keep the camera side open
      pines.push([x, z, 0.8 + rnd() * 0.9, rnd() * 6, -x * SLOPE - 0.2]);
    }
    await scatter(root, 'world/pine_tree.glb', 4.5, pines);
    await scatter(root, 'world/boulder.glb', 1.2, Array.from({ length: 22 }, () => { const x = rnd() * 320, z = -(3.3 + rnd() * 8); return [x, z, 0.6 + rnd(), rnd() * 6, -x * SLOPE - 0.3]; }));
    await scatter(root, 'world/snowy_mountain.glb', 60, [[60, -150, 1.2, 0.3, -60], [180, -170, 1.5, 1.2, -90], [300, -160, 1.3, 2.4, -120], [-40, -140, 1.1, 4, -30]]);
    // falling snow
    const flakeN = 600, flakes = new Float32Array(flakeN * 3);
    for (let i = 0; i < flakeN; i++) { flakes[i * 3] = rnd() * 60 - 20; flakes[i * 3 + 1] = rnd() * 20; flakes[i * 3 + 2] = rnd() * 30 - 15; }
    const fg = keep(new THREE.BufferGeometry()); fg.setAttribute('position', new THREE.BufferAttribute(flakes, 3));
    const snow = new THREE.Points(fg, keep(new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false })));
    root.add(snow);
    // the sled, carried by the scene (the buddy sits on it): painted red and natural wooden slats on a
    // varnished frame, steel runners curling up at the front, a steering bar and a pull rope
    const sled = new THREE.Group();
    const redTex = await loadTexture('world/redwood.webp', { repeat: true, color: true });
    const pineTex = await loadTexture('world/planks.webp', { repeat: true, color: true });
    // a strip of each texture, so the grain runs along the slat at its true size
    const strip = (t: THREE.Texture | null, v: number) => { if (!t) return null; const c = t.clone(); c.repeat.set(1, v); c.needsUpdate = true; return keep(c); };
    const red = keep(new THREE.MeshStandardMaterial({ map: strip(redTex, 0.12), color: redTex ? 0xffffff : 0xd8463c, roughness: 0.42 }));
    const wood = keep(new THREE.MeshStandardMaterial({ map: strip(pineTex, 0.1), color: pineTex ? 0xf2d2a6 : 0xb07a45, roughness: 0.6 }));
    const frame = keep(new THREE.MeshStandardMaterial({ map: strip(pineTex, 0.05), color: pineTex ? 0xc8945c : 0x8a5a30, roughness: 0.55 }));
    const metal = keep(new THREE.MeshStandardMaterial({ color: 0x9aa0aa, metalness: 0.85, roughness: 0.32 }));
    const slatGeo = keep(new THREE.BoxGeometry(1.3, 0.045, 0.125));
    // round the slats' top edges a touch
    { const p = slatGeo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setZ(i, p.getZ(i) * 0.9); slatGeo.computeVertexNormals(); }
    for (let k = 0; k < 4; k++) { const slat = new THREE.Mesh(slatGeo, k % 2 ? wood : red); slat.position.set(-0.02, 0.255, -0.23 + k * 0.153); slat.castShadow = true; slat.receiveShadow = true; sled.add(slat); }
    // the frame under the slats: two side rails and cross pieces
    for (const z of [-0.27, 0.27]) { const rail = new THREE.Mesh(keep(new THREE.BoxGeometry(1.36, 0.06, 0.05)), frame); rail.position.set(-0.02, 0.205, z); rail.castShadow = true; sled.add(rail); }
    for (const x of [-0.55, 0.0, 0.5]) { const bar = new THREE.Mesh(keep(new THREE.BoxGeometry(0.06, 0.04, 0.6)), frame); bar.position.set(x, 0.2, 0); sled.add(bar); }
    // the steering bar at the front, with a pull rope looping forward
    const steer = new THREE.Mesh(keep(new THREE.BoxGeometry(0.09, 0.05, 0.78)), frame); steer.position.set(0.6, 0.27, 0); steer.castShadow = true; sled.add(steer);
    const pull = new THREE.CatmullRomCurve3([new THREE.Vector3(0.6, 0.3, -0.36), new THREE.Vector3(0.85, 0.22, -0.3), new THREE.Vector3(1.05, 0.08, 0), new THREE.Vector3(0.85, 0.22, 0.3), new THREE.Vector3(0.6, 0.3, 0.36)]);
    sled.add(new THREE.Mesh(keep(new THREE.TubeGeometry(pull, 30, 0.012, 6)), keep(new THREE.MeshStandardMaterial({ color: 0xd9c49a, roughness: 0.9 }))));
    for (const z of [-0.27, 0.27]) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.72, 0.05, z), new THREE.Vector3(0.5, 0.035, z), new THREE.Vector3(0.78, 0.1, z), new THREE.Vector3(0.8, 0.26, z), new THREE.Vector3(0.66, 0.3, z), new THREE.Vector3(0.6, 0.24, z)]);
      const run = new THREE.Mesh(keep(new THREE.TubeGeometry(curve, 40, 0.022, 8)), metal); run.castShadow = true; sled.add(run);
      for (const x of [-0.5, -0.05, 0.38]) { const leg = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.014, 0.014, 0.17, 6)), metal); leg.position.set(x, 0.12, z); sled.add(leg); }
    }
    root.add(sled);
    root.userData.sled = sled;
    const dir = new THREE.Vector3(1, -SLOPE, 0).normalize();
    at = (s) => {
      // flat at the very end, so the buddy can stand and dance
      const x = Math.min(s, finishS + 0.2), flat = Math.max(0, s - finishS - 0.2);
      return { p: new THREE.Vector3(x + flat, -x * SLOPE, 0), t: flat > 0 ? new THREE.Vector3(1, 0, 0) : dir.clone(), n: new THREE.Vector3(0, 0, 1) };
    };
    // a finish arch made of two flags and a banner
    const arch = new THREE.Group();
    const post = keep(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 8)), postMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff }));
    // the post on the camera's side and the banner go see-through as the camera passes them
    const nearMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true }));
    for (const z of [-2.8, 2.8]) { const p = new THREE.Mesh(post, z > 0 ? nearMat : postMat); p.position.set(0, 1.7, z); p.castShadow = true; arch.add(p); }
    const bannerMat = keep(new THREE.MeshStandardMaterial({ color: 0x7c5cf5, transparent: true }));
    archFade = (k: number) => { nearMat.opacity = k; bannerMat.opacity = Math.max(k, 0.5); nearMat.depthWrite = bannerMat.depthWrite = k > 0.95; };
    const banner = new THREE.Mesh(keep(new THREE.BoxGeometry(0.12, 0.7, 5.8)), bannerMat);
    banner.position.y = 3.2; arch.add(banner);
    root.add(arch);
    const place = () => { const f = at(finishS - 2.6); arch.position.copy(f.p); fin.position.set(f.p.x + 3, -(f.p.x + 3) * SLOPE, -3.2); };
    root.userData.slopeY = (x: number) => -x * SLOPE;
    place();
    root.userData.place = place;
    update = (dt, t) => {
      wave(fin.userData.cloth, t);
      for (let i = 0; i < flakeN; i++) { flakes[i * 3 + 1] -= dt * (0.8 + (i % 7) * 0.12); flakes[i * 3] += Math.sin(t + i) * dt * 0.2; if (flakes[i * 3 + 1] < -2) flakes[i * 3 + 1] = 18; }
      (fg.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    };
    root.userData.follow = (p: THREE.Vector3) => snow.position.set(p.x - 10, p.y - 4, 0);
  } else {
    // a bay inside a tropical island: water to the horizon, a roped lane, a dock at each end, beach and palms
    const waterMat = keep(new THREE.ShaderMaterial({
      fog: false, transparent: false,
      uniforms: { uT: { value: 0 }, uSun: { value: sunDir } },
      vertexShader: `uniform float uT; varying vec3 vW; varying float vH;
        void main(){ vec3 p = position; vec4 w = modelMatrix * vec4(p, 1.0);
          float h = sin(w.x * 0.45 + uT * 1.7) * 0.05 + sin(w.z * 0.7 - uT * 1.3 + w.x * 0.2) * 0.04 + sin((w.x + w.z) * 1.6 + uT * 2.6) * 0.015;
          w.y += h; vH = h; vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uT; uniform vec3 uSun; varying vec3 vW; varying float vH;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          vec2 q = vW.xz;
          // normals from two drifting noise layers, for glints and the shimmer
          float a = n(q * 0.9 + vec2(uT * 0.35, uT * 0.18)), b = n(q * 2.3 - vec2(uT * 0.5, -uT * 0.3));
          vec3 nrm = normalize(vec3((a - 0.5) * 0.6 + (b - 0.5) * 0.35, 1.0, (b - 0.5) * 0.6));
          float shore = abs(vW.z);
          vec3 shallow = vec3(0.32, 0.88, 0.86), mid = vec3(0.12, 0.66, 0.82), deep = vec3(0.04, 0.42, 0.70);
          vec3 c = mix(shallow, mid, smoothstep(2.0, 9.0, shore + vW.x * 0.0));
          c = mix(c, deep, smoothstep(10.0, 60.0, shore));
          // light rippling on the water (caustics), stronger in the shallows
          float caus = pow(1.0 - abs(n(q * 1.3 + uT * 0.4) - n(q * 1.3 - uT * 0.3)), 6.0);
          c += vec3(0.55, 0.9, 0.95) * caus * 0.35 * (1.0 - smoothstep(4.0, 14.0, shore));
          // sun glints
          vec3 v = normalize(cameraPosition - vW), r = reflect(-uSun, nrm);
          c += vec3(1.0, 0.97, 0.9) * pow(max(0.0, dot(r, v)), 140.0) * 1.4;
          c += (vH * 3.0);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    const water = new THREE.Mesh(keep(new THREE.PlaneGeometry(460, 200, 230, 100)), waterMat);
    water.rotation.x = -Math.PI / 2; water.position.set(150, 0, 0); root.add(water);
    // the beach behind the lane: painted sand, darker and wet where the water reaches it
    const sandTex = await loadTexture('world/sand.webp', { repeat: true, color: true });
    if (sandTex) sandTex.repeat.set(460 / 3.5, 40 / 3.5);
    const sandMat = keep(new THREE.MeshStandardMaterial({ map: sandTex, color: sandTex ? 0xffffff : 0xead6a2, roughness: 1, vertexColors: true }));
    const beachGeo = keep(new THREE.PlaneGeometry(460, 40, 230, 20));
    // the sand's height at a spot (world x, z): rising gently from the water's edge at z = -6
    const sandY = (x: number, z: number) => -0.25 + (-z - 6) * 0.06 + Math.sin(x * 0.15) * 0.2;
    {
      const bp = beachGeo.attributes.position as THREE.BufferAttribute, col: number[] = [];
      for (let i = 0; i < bp.count; i++) {
        const x = bp.getX(i) + 150, z = -26 - bp.getY(i);
        bp.setZ(i, sandY(x, z) + 0.25);
        const wet = 1 - Math.min(1, Math.max(0, (-z - 6.2) / 2.2));
        const k = 1 - wet * 0.32;
        col.push(k, k * 0.98, k * 0.95);
      }
      beachGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      beachGeo.computeVertexNormals();
    }
    const beach = new THREE.Mesh(beachGeo, sandMat);
    beach.rotation.x = -Math.PI / 2; beach.position.set(150, -0.25, -26); beach.receiveShadow = true; root.add(beach);
    // everything stands on the sand, a little sunk in
    const onSand = (spots: number[][], sink = 0.06) => spots.map(([x, z, sc, r]) => [x, z, sc, r, sandY(x, z) - sink]);
    await scatter(root, 'world/palm_tree.glb', 6, onSand(Array.from({ length: 26 }, (_, i) => [-20 + i * 13 + rnd() * 6, -14 - rnd() * 14, 0.8 + rnd() * 0.5, rnd() * 6])));
    await scatter(root, 'world/boulder.glb', 1.2, onSand(Array.from({ length: 16 }, () => [-20 + rnd() * 340, -9 - rnd() * 4, 0.6 + rnd() * 1.4, rnd() * 6]), 0.25));
    await scatter(root, 'world/bush.glb', 1, onSand(Array.from({ length: 22 }, () => [-20 + rnd() * 340, -12 - rnd() * 10, 0.8 + rnd() * 0.8, rnd() * 6]), 0.1));
    await scatter(root, 'world/lighthouse.glb', 12, onSand([[60, -32, 1, 0.4], [230, -36, 1, 2]], 0.2));
    await scatter(root, 'world/rock_spire.glb', 14, [[30, 60, 1.2, 1, -2], [140, 70, 1.6, 3, -2], [260, 64, 1.3, 5, -2]]);
    // docks of planks at both ends of the lane, on weathered timber posts
    const planksTex = await loadTexture('world/planks.webp', { repeat: true, color: true });
    if (planksTex) planksTex.repeat.set(2, 1.5);
    const wood = keep(new THREE.MeshStandardMaterial({ map: planksTex, color: planksTex ? 0xffffff : 0x9a6b43, roughness: 0.85 }));
    const postTex = await loadTexture('world/post.webp', { repeat: true, color: true });
    if (postTex) postTex.repeat.set(1, 2.4);
    const postMat = keep(new THREE.MeshStandardMaterial({ map: postTex, color: postTex ? 0xffffff : 0x7a5534, roughness: 0.92 }));
    const dockGeo = keep(new THREE.BoxGeometry(5, 0.3, 3.4)), postGeo = keep(new THREE.CylinderGeometry(0.14, 0.15, 2.7, 14));
    const dock = (x: number) => {
      const g = new THREE.Group(); const d = new THREE.Mesh(dockGeo, wood); d.position.y = 0.35; d.castShadow = true; d.receiveShadow = true; g.add(d);
      for (const px of [-2.35, 2.35]) for (const pz of [-1.55, 1.55]) { const p = new THREE.Mesh(postGeo, postMat); p.position.set(px, -0.5, pz); p.castShadow = true; g.add(p); }
      g.position.x = x; root.add(g); return g;
    };
    dock(-2.4);
    const endDock = dock(40);
    // swim steps down from the end dock into the water: the swimmer stands up on the bottom one and
    // walks up and out (never swimming into the dock itself). Wide enough for the ghost's lane too.
    const STEPS = 4, RUN = 0.35, STEP_Z = -0.35, STEP_W = 2.7;
    const steps = new THREE.Group();
    const treadGeo = keep(new THREE.BoxGeometry(RUN + 0.06, 0.07, STEP_W)), sideGeo = keep(new THREE.BoxGeometry(STEPS * RUN + 0.5, 0.12, 0.09));
    for (let k = 0; k < STEPS; k++) {
      const tr = new THREE.Mesh(treadGeo, wood);
      tr.position.set(-STEPS * RUN + RUN * (k + 0.5), -0.4 + k * 0.25 - 0.035, 0); tr.castShadow = true; tr.receiveShadow = true; steps.add(tr);
    }
    const rise = Math.atan2(0.9, STEPS * RUN);
    for (const z of [-STEP_W / 2 - 0.02, STEP_W / 2 + 0.02]) {
      const sd = new THREE.Mesh(sideGeo, wood); sd.position.set(-STEPS * RUN / 2 - 0.05, 0.02, z); sd.rotation.z = rise; sd.castShadow = true; steps.add(sd);
      // a handrail on the far side (the near side stays open, so the camera sees the swimmer climb out)
      if (z > 0) continue;
      for (const x of [-STEPS * RUN + 0.1, -0.1]) { const pp = new THREE.Mesh(postGeo, postMat); pp.scale.y = 0.5; pp.position.set(x, x < -0.5 ? 0.03 : 0.83, z); pp.castShadow = true; steps.add(pp); }
      const rail = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.045, 0.045, Math.hypot(STEPS * RUN - 0.2, 0.8), 10)), postMat);
      rail.rotation.z = Math.atan2(0.8, STEPS * RUN - 0.2) - Math.PI / 2; rail.position.set(-STEPS * RUN / 2, 1.05, z); rail.castShadow = true; steps.add(rail);
    }
    root.add(steps);
    // where the steps start (in the water) and end (the dock's edge), along the lane
    let exitA = 0, exitB = 0;
    root.userData.exitAt = () => [exitA, exitB];
    // lane lines: ridged racing floats strung tight on a cable, red at the ends and white and blue between,
    // with an orange marker buoy at each end of each line
    const FLOAT = 0.12, PER = 700;
    const prof = [[0.01, -0.065], [0.055, -0.065], [0.075, -0.05], [0.058, -0.035], [0.088, -0.018], [0.094, 0], [0.088, 0.018], [0.058, 0.035], [0.075, 0.05], [0.055, 0.065], [0.01, 0.065]].map(([r, y]) => new THREE.Vector2(r, y));
    const floatGeo = keep(new THREE.LatheGeometry(prof, 18));
    floatGeo.rotateZ(Math.PI / 2); // its axis along the lane
    floatGeo.scale(0.8, 0.8, 0.8);
    const floats = new THREE.InstancedMesh(floatGeo, keep(new THREE.MeshPhysicalMaterial({ roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 })), 2 * PER);
    floats.castShadow = true; floats.frustumCulled = false;
    const o = new THREE.Object3D(), c = new THREE.Color();
    const LANES = [-1.8, 1.8];
    let k = 0;
    for (const z of LANES) for (let i = 0; i < PER; i++) { o.position.set(i * FLOAT, 0, z); o.updateMatrix(); floats.setMatrixAt(k, o.matrix); floats.setColorAt(k++, c.set(0xffffff)); }
    root.add(floats);
    const cableMat = keep(new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.6 }));
    const cables = LANES.map(z => { const m = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.008, 0.008, 1, 4)), cableMat); m.rotation.z = Math.PI / 2; m.position.set(0, 0, z); root.add(m); return m; });
    const buoyMat = keep(new THREE.MeshPhysicalMaterial({ color: 0xff7a1f, roughness: 0.35, clearcoat: 0.5 }));
    const bandMat = keep(new THREE.MeshStandardMaterial({ color: 0xf6f3ea, roughness: 0.5 }));
    const buoy = () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.2, 0.26, 0.42, 20)), buoyMat); body.position.y = 0.08; body.castShadow = true;
      const band = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.212, 0.232, 0.1, 20)), bandMat); band.position.y = 0.12;
      const cone = new THREE.Mesh(keep(new THREE.ConeGeometry(0.2, 0.24, 20)), buoyMat); cone.position.y = 0.41;
      const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(0.05, 0.012, 6, 14)), cableMat); ring.position.y = 0.56;
      g.add(body, band, cone, ring); root.add(g); return g;
    };
    const buoys = [buoy(), buoy(), buoy(), buoy()];
    let laneLen = 0;
    const lanes = () => {
      // the lines run from the start dock to the end dock; the last few metres at each end are red
      laneLen = Math.min(PER, Math.ceil((finishS + 0.2) / FLOAT));
      for (let li = 0; li < 2; li++) for (let i = 0; i < laneLen; i++) {
        const x = i * FLOAT, end = Math.min(x, finishS - x);
        floats.setColorAt(li * laneLen + i, c.set(end < 4 ? 0xe23b3b : Math.floor(i / 6) % 2 ? 0x2f6fd6 : 0xf6f6f2));
      }
      floats.count = 2 * laneLen;
      if (floats.instanceColor) floats.instanceColor.needsUpdate = true;
      cables.forEach(m => { m.scale.y = laneLen * FLOAT; m.position.x = (laneLen * FLOAT) / 2; });
      buoys.forEach((b, i) => b.position.set(i % 2 ? finishS - 0.7 : 0.7, -0.06, LANES[i < 2 ? 0 : 1] * 1.17));
    };
    at = (s) => {
      // swim from the start dock to the swim steps, stand up on the bottom step, walk up onto the dock
      const y = s < exitA ? -0.62 : s < exitB ? -0.4 + ((s - exitA) / (exitB - exitA)) * 0.9 : 0.5;
      return { p: new THREE.Vector3(s, y, 0), t: new THREE.Vector3(1, 0, 0), n: new THREE.Vector3(0, 0, 1) };
    };
    const place = () => {
      endDock.position.x = finishS + 2.2; fin.position.set(finishS + 1.4, 0.5, -1.2);
      exitB = finishS - 0.3; exitA = exitB - STEPS * RUN;
      steps.position.set(exitB, 0, STEP_Z);
      lanes();
    };
    place();
    root.userData.place = place;
    update = (_dt, t) => {
      waterMat.uniforms.uT.value = t;
      // the floats ride the swell (the same waves the water's surface makes), a little behind each other
      const wy = (x: number, z: number) => Math.sin(x * 0.45 + t * 1.7) * 0.05 + Math.sin(z * 0.7 - t * 1.3 + x * 0.2) * 0.04;
      for (let li = 0; li < 2; li++) for (let i = 0; i < laneLen; i++) {
        const x = i * FLOAT, z = LANES[li], y = wy(x, z);
        o.position.set(x, y + 0.005, z); o.rotation.set(t * 0.6 + i * 0.4, 0, (wy(x + 0.2, z) - y) * 2); o.updateMatrix(); floats.setMatrixAt(li * laneLen + i, o.matrix);
      }
      floats.instanceMatrix.needsUpdate = true;
      buoys.forEach((b, i) => { b.position.y = wy(b.position.x, b.position.z) - 0.06; b.rotation.set(Math.sin(t * 1.3 + i) * 0.08, 0, Math.cos(t * 1.1 + i) * 0.08); });
      wave(fin.userData.cloth, t);
    };
  }

  // the little surprises on each course (a tiny door, a snowman, leaping fish, visiting Glimmers...)
  const eggs = courseEggs(move, { root, keep, at: s => at(s), finishS: () => finishS, wallZ: root.userData.wallZ, top: root.userData.top, slopeY: root.userData.slopeY });
  const placeCourse = root.userData.place as (() => void) | undefined;
  root.userData.place = () => { placeCourse?.(); eggs.place(); };
  const trail = { length: 1000, at: (s: number) => at(s) };
  return {
    trail,
    height: () => 0,
    placeFinish(s: number) { finishS = s; (root.userData.place as (() => void) | undefined)?.(); },
    gateSolid(k = 1) { archFade(k); },
    setSmooth(on: boolean) { sun.castShadow = !on; },
    update(dt: number, t: number, focus: THREE.Vector3) {
      sun.position.copy(focus).add(sunOffset); sun.target.position.copy(focus); sky.position.copy(focus);
      clouds.position.x = focus.x * 0.6;
      (root.userData.follow as ((p: THREE.Vector3) => void) | undefined)?.(focus);
      update(dt, t);
      eggs.update(dt, t, focus);
    },
    root,
    theme,
    dispose() { eggs.dispose(); for (const x of own) x.dispose(); root.removeFromParent(); },
    stats: {},
  };
}
