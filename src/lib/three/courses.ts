// Courses for the math trips that don't run the island trail: a cliff to climb, a snowy slope to sled
// down and a bay to swim across. Each is built like an island (a trail with at(s), a finish, a root to
// put on stage), so the trip, the speed ladder, the finish dance and the results work the same way on
// every one of them. They're dressed with the islands' own models (cliffs, spires, pines, snowy peaks,
// palms, the lighthouse, boulders, bushes), painted textures, a sky, clouds and floating islands.
import * as THREE from 'three';
import { THEMES, type Theme } from './themes';
import { loadGltf, loadTexture } from './assets';
import type { Island, TrailPoint } from './island';

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
    // a sandstone face going up from a meadow; the buddy climbs it facing in, the camera on the open side (+z)
    const RUN = 4, H = 50;
    const rockTex = await loadTexture('world/rock.webp', { repeat: true, color: true });
    if (rockTex) rockTex.repeat.set(2.2, 9);
    const rockMat = keep(new THREE.MeshStandardMaterial({ map: rockTex, color: rockTex ? 0xffffff : 0xd9b98a, roughness: 0.92 }));
    const faceGeo = keep(new THREE.PlaneGeometry(11, H, 60, 220));
    const fp = faceGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i), y = fp.getY(i);
      // ledges and bulges, smooth near the climbing line, curving back at the sides
      const bump = Math.sin(x * 1.7 + y * 0.6) * 0.12 + Math.sin(y * 2.3 - x * 0.8) * 0.08 + Math.max(0, Math.sin(y * 0.9 + x)) * 0.1;
      fp.setZ(i, bump * Math.min(1, 0.35 + Math.abs(x) / 2) - Math.max(0, Math.abs(x) - 2.8) ** 1.6 * 0.35);
    }
    faceGeo.computeVertexNormals();
    const face = new THREE.Mesh(faceGeo, rockMat);
    face.position.set(0, H / 2 - 1, -0.45); face.receiveShadow = true; face.castShadow = true;
    root.add(face);
    const back = new THREE.Mesh(keep(new THREE.BoxGeometry(11, H, 5)), rockMat);
    back.position.set(0, H / 2 - 1, -3.4); root.add(back);
    // the coloured holds up the climbing line, bigger and rounder
    const holdGeo = keep(new THREE.DodecahedronGeometry(0.11, 1));
    const holdCols = [0xef4f6a, 0xf7c548, 0x3fa7e0, 0x4fcf98, 0xb98cff, 0xff8a3d];
    const holds = new THREE.InstancedMesh(holdGeo, keep(new THREE.MeshStandardMaterial({ roughness: 0.45 })), 320);
    const o = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < 320; i++) {
      const y = 0.3 + (i / 320) * (H - 3), x = (rnd() - 0.5) * 2.2 + (i % 2 ? 0.5 : -0.5);
      o.position.set(x, y, -0.33); o.rotation.set(rnd() * 3, rnd() * 3, 0); o.scale.set(0.8 + rnd() * 0.8, 0.6 + rnd() * 0.5, 0.7 + rnd() * 0.5); o.updateMatrix();
      holds.setMatrixAt(i, o.matrix); holds.setColorAt(i, c.set(holdCols[i % holdCols.length]));
    }
    holds.castShadow = true; root.add(holds);
    // a safety rope beside the line, and bolts
    const rope = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.025, 0.025, H, 6)), keep(new THREE.MeshStandardMaterial({ color: 0xe8543a, roughness: 0.7 })));
    rope.position.set(-0.85, H / 2 - 0.5, -0.2); root.add(rope);
    // rock pillars and spires either side, and behind
    // well back and out to the sides, so none of them comes between the camera and the climber
    await scatter(root, 'world/rock_spire.glb', 18, [[-14, -10, 1.4, 0.3], [15, -11, 1.6, 2], [-22, -20, 2.2, 1], [23, -18, 2.4, 4], [-32, -34, 2.8, 5], [34, -32, 3, 2]]);
    // a meadow at the foot: grass, bushes, boulders, flowers
    const grassTex = await loadTexture('world/grass.webp', { repeat: true, color: true });
    if (grassTex) grassTex.repeat.set(30, 30);
    const meadow = new THREE.Mesh(keep(new THREE.CircleGeometry(60, 48)), keep(new THREE.MeshStandardMaterial({ map: grassTex, color: grassTex ? 0xffffff : 0x8fc46a, roughness: 1 })));
    meadow.rotation.x = -Math.PI / 2; meadow.position.y = -0.02; meadow.receiveShadow = true; root.add(meadow);
    // kept to the sides: the camera stands a few metres out in front of the line
    await scatter(root, 'world/bush.glb', 0.9, [[-4.2, 0.9, 1, 0], [4.4, 0.8, 1.2, 2], [-6.5, 2.5, 1.4, 1], [6.8, 2.2, 1, 3], [8.5, 0.5, 1.3, 1], [-9, 1, 1.2, 2]]);
    await scatter(root, 'world/boulder.glb', 1.1, [[-4.5, 0.4, 1, 0.5], [4.6, -0.2, 1.3, 2], [8.5, 3.5, 1.6, 1], [-8, 4, 1.4, 3]]);
    await scatter(root, 'world/mushroom.glb', 0.5, [[-3.4, 0.8, 1, 0], [3.2, 0.9, 0.8, 1]]);
    const ledgeTop = new THREE.Mesh(keep(new THREE.BoxGeometry(11, 0.6, 3.6)), keep(new THREE.MeshStandardMaterial({ map: grassTex, color: grassTex ? 0xffffff : 0x8fc46a, roughness: 1 })));
    const ledge = new THREE.Mesh(keep(new THREE.BoxGeometry(11, 1.4, 3.6)), rockMat);
    root.add(ledgeTop, ledge);
    const topBush = await model('world/bush.glb', 0.8);
    if (topBush) root.add(topBush);
    at = (s) => {
      const y = Math.max(0, Math.min(s, finishS) - RUN);
      // over the top: step onto the ledge
      const over = Math.max(0, Math.min(1, (s - finishS + 0.6) / 0.6));
      return { p: new THREE.Vector3(0, y + over * 0.6, over * 1.1), t: UP.clone(), n: new THREE.Vector3(0, 0, 1) };
    };
    const place = () => {
      const top = finishS - RUN;
      ledge.position.set(0, top - 0.4, 1.0); ledgeTop.position.set(0, top + 0.3, 1.0);
      fin.position.set(1.6, top + 0.6, 1.4);
      if (topBush) topBush.position.set(-2.6, top + 0.6, 0.9);
    };
    place();
    root.userData.place = place;
    update = (_dt, t) => wave(fin.userData.cloth, t);
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
    // the sled, carried by the scene (the buddy sits on it)
    const sled = new THREE.Group();
    const red = keep(new THREE.MeshStandardMaterial({ color: 0xd8463c, roughness: 0.45 })), wood = keep(new THREE.MeshStandardMaterial({ color: 0xb07a45, roughness: 0.7 }));
    const metal = keep(new THREE.MeshStandardMaterial({ color: 0xc9ccd6, metalness: 0.7, roughness: 0.25 }));
    for (let k = 0; k < 4; k++) { const slat = new THREE.Mesh(keep(new THREE.BoxGeometry(1.3, 0.05, 0.13)), k % 2 ? wood : red); slat.position.set(0, 0.24, -0.23 + k * 0.155); slat.castShadow = true; sled.add(slat); }
    for (const z of [-0.27, 0.27]) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.7, 0.05, z), new THREE.Vector3(0.55, 0.04, z), new THREE.Vector3(0.78, 0.12, z), new THREE.Vector3(0.74, 0.3, z), new THREE.Vector3(0.6, 0.32, z)]);
      const run = new THREE.Mesh(keep(new THREE.TubeGeometry(curve, 24, 0.025, 6)), metal); run.castShadow = true; sled.add(run);
      for (const x of [-0.45, 0.35]) { const leg = new THREE.Mesh(keep(new THREE.BoxGeometry(0.05, 0.2, 0.05)), metal); leg.position.set(x, 0.14, z); sled.add(leg); }
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
    for (const z of [-2.8, 2.8]) { const p = new THREE.Mesh(post, postMat); p.position.set(0, 1.7, z); p.castShadow = true; arch.add(p); }
    const banner = new THREE.Mesh(keep(new THREE.BoxGeometry(0.12, 0.7, 5.8)), keep(new THREE.MeshStandardMaterial({ color: 0x7c5cf5 })));
    banner.position.y = 3.2; arch.add(banner);
    root.add(arch);
    const place = () => { const f = at(finishS - 2.6); arch.position.copy(f.p); fin.position.set(f.p.x + 3, -(f.p.x + 3) * SLOPE, -3.2); };
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
    // sand: the beach behind the lane, and the sea floor near the docks
    const sandMat = keep(new THREE.MeshStandardMaterial({ color: 0xead6a2, roughness: 1 }));
    const beach = new THREE.Mesh(keep(new THREE.PlaneGeometry(460, 40, 120, 8)), sandMat);
    const bp = beach.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setZ(i, (y + 20) * 0.06 + Math.sin(bp.getX(i) * 0.15) * 0.2); }
    beach.geometry.computeVertexNormals();
    beach.rotation.x = -Math.PI / 2; beach.position.set(150, -0.25, -26); beach.receiveShadow = true; root.add(beach);
    await scatter(root, 'world/palm_tree.glb', 6, Array.from({ length: 26 }, (_, i) => [-20 + i * 13 + rnd() * 6, -14 - rnd() * 14, 0.8 + rnd() * 0.5, rnd() * 6, 0.6]));
    await scatter(root, 'world/boulder.glb', 1.2, Array.from({ length: 16 }, () => [-20 + rnd() * 340, -9 - rnd() * 4, 0.6 + rnd() * 1.4, rnd() * 6, -0.2]));
    await scatter(root, 'world/bush.glb', 1, Array.from({ length: 22 }, () => [-20 + rnd() * 340, -12 - rnd() * 10, 0.8 + rnd() * 0.8, rnd() * 6, 0.5]));
    await scatter(root, 'world/lighthouse.glb', 12, [[60, -32, 1, 0.4, 1.4], [230, -36, 1, 2, 1.4]]);
    await scatter(root, 'world/rock_spire.glb', 14, [[30, 60, 1.2, 1, -2], [140, 70, 1.6, 3, -2], [260, 64, 1.3, 5, -2]]);
    // docks of planks at both ends of the lane
    const planksTex = await loadTexture('world/planks.webp', { repeat: true, color: true });
    if (planksTex) planksTex.repeat.set(2, 1.5);
    const wood = keep(new THREE.MeshStandardMaterial({ map: planksTex, color: planksTex ? 0xffffff : 0x9a6b43, roughness: 0.85 }));
    const postMat = keep(new THREE.MeshStandardMaterial({ color: 0x7a5534, roughness: 0.9 }));
    const dockGeo = keep(new THREE.BoxGeometry(5, 0.3, 3.4)), postGeo = keep(new THREE.CylinderGeometry(0.13, 0.13, 2.6, 8));
    const dock = (x: number) => {
      const g = new THREE.Group(); const d = new THREE.Mesh(dockGeo, wood); d.position.y = 0.35; d.castShadow = true; d.receiveShadow = true; g.add(d);
      for (const px of [-2.2, 2.2]) for (const pz of [-1.5, 1.5]) { const p = new THREE.Mesh(postGeo, postMat); p.position.set(px, -0.55, pz); g.add(p); }
      g.position.x = x; root.add(g); return g;
    };
    dock(-2.4);
    const endDock = dock(40);
    // lane ropes: floats in red and white, bobbing
    const floatGeo = keep(new THREE.SphereGeometry(0.075, 10, 8));
    const ropes = new THREE.InstancedMesh(floatGeo, keep(new THREE.MeshStandardMaterial({ roughness: 0.4 })), 2 * 400);
    const o = new THREE.Object3D(), c = new THREE.Color();
    let k = 0;
    for (const z of [-1.8, 1.8]) for (let i = 0; i < 400; i++) { o.position.set(i * 0.34, 0.02, z); o.updateMatrix(); ropes.setMatrixAt(k, o.matrix); ropes.setColorAt(k++, c.set(Math.floor(i / 4) % 2 ? 0xffffff : 0xe8484f)); }
    root.add(ropes);
    at = (s) => {
      // swim from the start dock to the end dock; past the finish, climb out onto it
      const onDock = s >= finishS - 0.2;
      return { p: new THREE.Vector3(s, onDock ? 0.5 : -0.62, 0), t: new THREE.Vector3(1, 0, 0), n: new THREE.Vector3(0, 0, 1) };
    };
    const place = () => { endDock.position.x = finishS + 2.2; fin.position.set(finishS + 1.4, 0.5, -1.2); };
    place();
    root.userData.place = place;
    update = (_dt, t) => {
      waterMat.uniforms.uT.value = t;
      for (let i = 0; i < 2 * 400; i++) { const z = i < 400 ? -1.8 : 1.8, x = (i % 400) * 0.34; o.position.set(x, 0.02 + Math.sin(x * 0.45 + t * 1.7) * 0.05, z); o.updateMatrix(); ropes.setMatrixAt(i, o.matrix); }
      ropes.instanceMatrix.needsUpdate = true;
      wave(fin.userData.cloth, t);
    };
  }

  const trail = { length: 1000, at: (s: number) => at(s) };
  return {
    trail,
    height: () => 0,
    placeFinish(s: number) { finishS = s; (root.userData.place as (() => void) | undefined)?.(); },
    gateSolid() { /* no gate to see through */ },
    setSmooth(on: boolean) { sun.castShadow = !on; },
    update(dt: number, t: number, focus: THREE.Vector3) {
      sun.position.copy(focus).add(sunOffset); sun.target.position.copy(focus); sky.position.copy(focus);
      clouds.position.x = focus.x * 0.6;
      (root.userData.follow as ((p: THREE.Vector3) => void) | undefined)?.(focus);
      update(dt, t);
    },
    root,
    theme,
    dispose() { for (const x of own) x.dispose(); root.removeFromParent(); },
    stats: {},
  };
}
