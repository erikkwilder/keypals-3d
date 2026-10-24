// The sky island: a grassy floating island with a winding trail, its far edge dropping away to a sea of
// clouds, waterfalls spilling over, floating rocks in the distance, and an old stone gate at the finish.
// Props are Meshy models made from pictures in one style; everything repeated is instanced, and the long
// stretches (grass, flowers) are cut into chunks so the ones off screen aren't drawn.
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { loadGltf, loadTexture } from './assets';

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rng = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export type TrailPoint = { p: THREE.Vector3; t: THREE.Vector3; n: THREE.Vector3 };
export type Island = {
  /** metres of trail from the start line; at(s) gives the point, the direction along the trail, and the side the camera is on */
  trail: { length: number; at(s: number): TrailPoint };
  height(x: number, z: number): number;
  placeFinish(s: number): void;
  /** How solid the finish gate is (1) or see-through (less), so it never hides the buddy going through it. */
  gateSolid(k: number): void;
  update(dt: number, t: number, focus: THREE.Vector3): void;
  root: THREE.Group;
};

/** The finish gate stands this far before the spot where the buddy stops, so they always run through it. */
export const GATE_BEFORE = 2.6;

export async function buildIsland(renderer: THREE.WebGLRenderer, { low = false, length = 420 } = {}): Promise<Island> {
  const root = new THREE.Group();
  const rnd = rng(11);
  const aniso = renderer.capabilities.getMaxAnisotropy();

  // ---------- shape of the land ----------
  const X0 = -40, X1 = length + 60;
  const trailZ = (x: number) => 2.4 * Math.sin(x / 23) + 1.4 * Math.sin(x / 9.7 + 1);
  // the far edge of the island, 2.5 to 7.9 m past the trail
  const edgeZ = (x: number) => trailZ(x) - 5.2 - 1.8 * Math.sin(x / 31 + 2) - 0.9 * Math.sin(x / 12.7);
  function height(x: number, z: number) {
    const dz = z - trailZ(x);
    let h = 0.55 * Math.sin(x * 0.061) * Math.cos(z * 0.083) + 0.35 * Math.sin(x * 0.17 + z * 0.11);
    h *= 0.35 + 0.65 * smooth(1.5, 7, Math.abs(dz)); // the trail runs along a gentle, even line
    h += Math.max(0, dz - 9) * 0.06; // the near side rises a little toward the camera
    const out = edgeZ(x) - z; // past the edge: a rounded lip, then a long fall
    if (out > -1.5) h -= Math.pow(Math.max(0, out + 1.5), 2) * 0.55 + Math.max(0, out) * 2.5;
    return h;
  }

  // ---------- the trail, with arc length so a runner moves at a true speed ----------
  const pts: THREE.Vector3[] = [], cum = [0];
  for (let x = X0 + 20; x <= X1 - 20; x += 0.25) pts.push(new THREE.Vector3(x, 0, trailZ(x)));
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const sStart = cum[pts.findIndex(p => p.x >= 0)];
  const trail = {
    length: cum[cum.length - 1] - sStart,
    at(s: number): TrailPoint {
      const S = Math.max(0, Math.min(cum[cum.length - 1], s + sStart));
      let lo = 0, hi = cum.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < S) lo = m; else hi = m; }
      const f = (S - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
      const p = pts[lo].clone().lerp(pts[hi], f);
      p.y = height(p.x, p.z);
      const t = pts[Math.min(pts.length - 1, hi + 2)].clone().sub(pts[Math.max(0, lo - 2)]).setY(0).normalize();
      const n = new THREE.Vector3(-t.z, 0, t.x);
      if (n.z < 0) n.negate();
      return { p, t, n };
    },
  };

  // ---------- sky ----------
  const sunDir = new THREE.Vector3(0.45, 0.5, -0.75).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x4f9fe8) }, mid: { value: new THREE.Color(0x9fd0f4) }, low: { value: new THREE.Color(0xdcecf6) }, sunDir: { value: sunDir } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: 'uniform vec3 top, mid, low, sunDir; varying vec3 vDir; void main(){ float y = vDir.y; vec3 c = mix(low, mid, smoothstep(-0.08, 0.18, y)); c = mix(c, top, smoothstep(0.18, 0.75, y)); float s = max(0.0, dot(normalize(vDir), sunDir)); c += vec3(1.0,0.93,0.78) * (pow(s, 600.0) * 1.6 + pow(s, 12.0) * 0.18); gl_FragColor = vec4(c, 1.0); }',
  }));
  sky.renderOrder = -1;
  root.add(sky);

  // ---------- light: shadows follow the focus, snapped to the shadow map's texels so they don't shimmer ----------
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x7f9a5c, 1.15);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
  sun.castShadow = true;
  const SH = low ? 1024 : 2048, R = 13;
  sun.shadow.mapSize.set(SH, SH);
  Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 160 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
  root.add(hemi, sun, sun.target);
  const sunOffset = sunDir.clone().multiplyScalar(70).setZ(40);
  const lz = sunOffset.clone().normalize().negate(), lx = new THREE.Vector3(0, 1, 0).cross(lz).normalize(), ly = lz.clone().cross(lx);
  const texel = (2 * R) / SH;

  // ---------- ground ----------
  const grassTex = await loadTexture('world/grass.webp', { repeat: true });
  if (grassTex) grassTex.anisotropy = aniso;
  {
    const W = X1 - X0, D = 90, SX = Math.round(W / (low ? 1.2 : 0.8)), SZ = Math.round(D / (low ? 1.2 : 0.8));
    const g = new THREE.PlaneGeometry(W, D, SX, SZ);
    g.rotateX(-Math.PI / 2);
    g.translate((X0 + X1) / 2, 0, 20);
    const pos = g.attributes.position, uv = g.attributes.uv, col = new Float32Array(pos.count * 3);
    const c = new THREE.Color(), lush = new THREE.Color(0xffffff), dry = new THREE.Color(0xe8e2b0), rock = new THREE.Color(0x9a8f86), rockDark = new THREE.Color(0x6f6670);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, height(x, z));
      uv.setXY(i, x / 5, z / 5);
      const patch = 0.5 + 0.5 * Math.sin(x * 0.13 + Math.cos(z * 0.11) * 2.2);
      c.copy(lush).lerp(dry, patch * 0.35);
      const out = edgeZ(x) - z;
      if (out > -1.2) c.lerp(out > 3 ? rockDark : rock, smooth(-1.2, 0.8, out));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: grassTex, vertexColors: true }));
    ground.receiveShadow = true;
    root.add(ground);
  }

  // ---------- the trail ribbon ----------
  const dirtTex = await loadTexture('world/dirt.webp', { repeat: true });
  if (dirtTex) dirtTex.anisotropy = aniso;
  {
    const alpha = document.createElement('canvas'); alpha.width = 64; alpha.height = 4;
    const a = alpha.getContext('2d')!, grad = a.createLinearGradient(0, 0, 64, 0);
    grad.addColorStop(0, '#000'); grad.addColorStop(0.22, '#fff'); grad.addColorStop(0.78, '#fff'); grad.addColorStop(1, '#000');
    a.fillStyle = grad; a.fillRect(0, 0, 64, 4);
    const alphaMap = new THREE.CanvasTexture(alpha);
    const half = 1.15, rows: TrailPoint[] = [];
    for (let s = -18; s <= trail.length - 1; s += 0.5) rows.push(trail.at(s));
    const posA: number[] = [], uvA: number[] = [], idx: number[] = [];
    rows.forEach((f, i) => {
      for (const side of [-1, 1]) {
        const x = f.p.x + f.n.x * half * side, z = f.p.z + f.n.z * half * side;
        posA.push(x, height(x, z) + 0.035, z);
        uvA.push(side < 0 ? 0 : 1, (i * 0.5) / 2.3);
      }
      if (i) { const b = i * 2; idx.push(b - 2, b - 1, b, b - 1, b + 1, b); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(posA, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvA, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ map: dirtTex, color: dirtTex ? 0xffffff : 0xd8bf94, alphaMap, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    // the alpha map runs across the trail, the dirt texture along it
    mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <alphamap_fragment>', 'diffuseColor.a *= texture2D( alphaMap, vec2(vAlphaMapUv.x, 0.5) ).g;'); };
    const ribbon = new THREE.Mesh(g, mat);
    ribbon.receiveShadow = true;
    root.add(ribbon);
  }

  /** Spread instances along the trail in chunks, so each chunk can be skipped when it's off screen. */
  const CHUNK = 30;
  function chunked(geo: THREE.BufferGeometry, mat: THREE.Material, perMetre: number, place: (o: THREE.Object3D, c: THREE.Color, x: number) => boolean, opts: { colors?: boolean; extra?: (i: number) => number } = {}) {
    const group = new THREE.Group();
    for (let x0 = -16; x0 < length + 20; x0 += CHUNK) {
      const n = Math.round(perMetre * CHUNK);
      const im = new THREE.InstancedMesh(geo, mat, n);
      const o = new THREE.Object3D(), c = new THREE.Color();
      let k = 0, tries = 0;
      const extra = opts.extra ? new Float32Array(n) : null;
      while (k < n && tries++ < n * 4) {
        if (!place(o, c, x0 + rnd() * CHUNK)) continue;
        o.updateMatrix(); im.setMatrixAt(k, o.matrix);
        if (opts.colors) im.setColorAt(k, c);
        if (extra) extra[k] = opts.extra!(k);
        k++;
      }
      im.count = k;
      if (extra) im.geometry = geo.clone(), im.geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(extra, 1));
      im.computeBoundingSphere();
      im.receiveShadow = true;
      group.add(im);
    }
    root.add(group);
    return group;
  }

  // ---------- grass that sways ----------
  const windUniform = { value: 0 };
  {
    const blade = new THREE.BufferGeometry();
    const H = 1, Wd = 0.028;
    blade.setAttribute('position', new THREE.Float32BufferAttribute([-Wd, 0, 0, Wd, 0, 0, -Wd * 0.8, H * 0.4, 0, Wd * 0.8, H * 0.4, 0, -Wd * 0.5, H * 0.75, 0, Wd * 0.5, H * 0.75, 0, 0, H, 0], 3));
    blade.setAttribute('color', new THREE.Float32BufferAttribute([0.32, 0.5, 0.2, 0.32, 0.5, 0.2, 0.55, 0.72, 0.3, 0.55, 0.72, 0.3, 0.75, 0.86, 0.42, 0.75, 0.86, 0.42, 0.9, 0.95, 0.55], 3));
    blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
    blade.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = windUniform;
      sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float bend = position.y * position.y;
        float w = sin(uWind * 1.6 + ip.x * 0.35 + ip.z * 0.22) * 0.5 + sin(uWind * 2.7 + ip.x * 0.9) * 0.18;
        transformed.x += w * 0.22 * bend;
        transformed.z += cos(uWind * 1.3 + ip.z * 0.4) * 0.08 * bend;`)
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);');
    };
    chunked(blade, mat, low ? 100 : 280, (o, c, x) => {
      const dz = (rnd() < 0.5 ? -1 : 1) * (1.05 + Math.pow(rnd(), 1.6) * 11);
      const z = trailZ(x) + dz;
      if (edgeZ(x) - z > -1.0) return false;
      o.position.set(x, height(x, z) - 0.02, z);
      o.rotation.set(0, rnd() * Math.PI, (rnd() - 0.5) * 0.3);
      o.scale.set(0.8 + rnd() * 0.8, 0.12 + rnd() * 0.2 + (Math.abs(dz) > 4 ? 0.08 : 0), 1);
      c.setHSL(0.2 + rnd() * 0.06, 0.6 + rnd() * 0.2, 0.5 + rnd() * 0.16);
      return true;
    }, { colors: true });
  }

  // ---------- flowers: painted cut-outs on cards ----------
  const flowerTex = await loadTexture('world/flowers.webp');
  if (flowerTex) {
    const cols = 3, rows = 2;
    const card = new THREE.PlaneGeometry(0.34, 0.34);
    card.translate(0, 0.17, 0);
    const mat = new THREE.MeshLambertMaterial({ map: flowerTex, alphaTest: 0.5, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute float aCell;\n' + sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        vMapUv = (vMapUv + vec2(mod(aCell, ${cols}.0), floor(aCell / ${cols}.0))) / vec2(${cols}.0, ${rows}.0);`);
    };
    chunked(card, mat, low ? 3 : 8, (o, _c, x) => {
      const dz = -9 + rnd() * 20, z = trailZ(x) + dz;
      if (Math.abs(dz) < 1.3 || edgeZ(x) - z > -1.2) return false;
      o.position.set(x, height(x, z), z); o.rotation.set(0, rnd() * Math.PI, 0); o.scale.setScalar(0.7 + rnd() * 0.7);
      return true;
    }, { extra: () => Math.floor(rnd() * cols * rows) });
  }

  // ---------- props ----------
  const placed: [number, number, number][] = [];
  const free = (x: number, z: number, r: number) => placed.every(([px, pz, pr]) => (px - x) ** 2 + (pz - z) ** 2 > (pr + r) ** 2);
  type Spot = { x: number; y: number; z: number; h: number; w?: number; ry?: number; sink?: number };
  /**
   * Copies of a model at spots, as instanced meshes, in 40 m stretches of trail so the stretches off
   * screen (and outside the shadow's reach) aren't drawn at all.
   */
  function instances(g: GLTF | null, all: Spot[], opts: { shadow?: boolean } = {}) {
    if (!g || !all.length) return null;
    const group = new THREE.Group();
    const bins = new Map<number, Spot[]>();
    for (const sp of all) { const k = Math.floor(sp.x / 40); (bins.get(k) ?? bins.set(k, []).get(k)!).push(sp); }
    for (const spots of bins.values()) group.add(instancesOf(g, spots, opts));
    root.add(group);
    return group;
  }
  function instancesOf(g: GLTF, spots: Spot[], opts: { shadow?: boolean }) {
    const src = g.scene; src.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(src), size = box.getSize(new THREE.Vector3());
    const group = new THREE.Group();
    src.traverse((m) => {
      if (!(m instanceof THREE.Mesh)) return;
      const im = new THREE.InstancedMesh(m.geometry, m.material, spots.length);
      const base = m.matrixWorld.clone(), mx = new THREE.Matrix4(), o = new THREE.Object3D();
      spots.forEach((sp, i) => {
        const s = sp.w ? sp.w / size.x : sp.h / size.y;
        o.position.set(sp.x, sp.y - box.min.y * s - (sp.sink ?? 0), sp.z); o.rotation.set(0, sp.ry ?? 0, 0); o.scale.setScalar(s);
        o.updateMatrix(); mx.multiplyMatrices(o.matrix, base); im.setMatrixAt(i, mx);
      });
      im.castShadow = opts.shadow !== false; im.receiveShadow = true;
      const mm = m.material as THREE.MeshStandardMaterial;
      if (mm.map) mm.map.anisotropy = 4;
      im.computeBoundingSphere();
      group.add(im);
    });
    return group;
  }
  const names = ['tree_puffy', 'tree_puffy2', 'bush', 'boulder', 'ruin', 'gate', 'island', 'cliff'];
  const [treeA, treeB, bush, boulder, ruin, gateG, islandG, cliffG] = await Promise.all(names.map(n => loadGltf(`world/${n}.glb`)));
  function scatter(n: number, { near = -9.5, far = -3, minR = 1, h = [1, 2], sink = 0, where = null as ((x: number) => boolean) | null }) {
    const out: Spot[] = [];
    let tries = 0;
    while (out.length < n && tries++ < n * 60) {
      const x = -16 + rnd() * (length + 36), dz = near + rnd() * (far - near), z = trailZ(x) + dz;
      if (edgeZ(x) - z > -minR - 0.8) continue;
      if (where && !where(x)) continue;
      if (!free(x, z, minR)) continue;
      placed.push([x, z, minR]);
      out.push({ x, z, y: height(x, z), h: h[0] + rnd() * (h[1] - h[0]), ry: rnd() * Math.PI * 2, sink });
    }
    return out;
  }
  const perLen = (n: number) => Math.round((n * length) / 230);
  // trees grow in clumps, so there are long open views over the edge between them
  const clump = (x: number) => Math.sin(x / 19 + 1.3) > 0.4;
  instances(treeA, scatter(perLen(low ? 6 : 9), { near: -8.5, far: -3.2, minR: 2.2, h: [4.4, 6.2], sink: 0.15, where: clump }));
  instances(treeB, scatter(perLen(low ? 3 : 6), { near: -9.5, far: -4, minR: 2.4, h: [5.2, 7], sink: 0.15, where: clump }));
  instances(bush, scatter(perLen(low ? 20 : 34), { near: -9.5, far: -1.8, minR: 0.8, h: [0.6, 1.2], sink: 0.08 }));
  instances(boulder, scatter(perLen(low ? 10 : 16), { near: -10, far: -2.2, minR: 0.9, h: [0.5, 1.4], sink: 0.2 }));
  instances(ruin, scatter(perLen(low ? 5 : 8), { near: -9, far: -3, minR: 1.6, h: [1.1, 2.2], sink: 0.1 }));
  // a few low bushes and stones on the near side, far enough from the trail to keep the runner in view
  instances(bush, scatter(perLen(low ? 6 : 12), { near: 2.2, far: 4.5, minR: 0.6, h: [0.35, 0.6], sink: 0.05 }), { shadow: false });
  instances(boulder, scatter(perLen(low ? 4 : 8), { near: 2.0, far: 4.5, minR: 0.5, h: [0.25, 0.5], sink: 0.08 }), { shadow: false });

  // rocky cliffs under the island's edge
  if (cliffG) {
    const box = new THREE.Box3().setFromObject(cliffG.scene), size = box.getSize(new THREE.Vector3());
    const spots: Spot[] = [];
    for (let x = -30; x < length + 50; x += 5.5 + rnd() * 1.5) {
      const z = edgeZ(x), dz = (edgeZ(x + 1) - edgeZ(x - 1)) / 2, w = 7.5 + rnd() * 2;
      spots.push({ x, z: z - 1.6, y: height(x, z + 0.6) - 0.35, w, h: 0, ry: -Math.atan2(dz, 1) + (rnd() - 0.5) * 0.15, sink: (w / size.x) * size.y * 0.92 });
    }
    instances(cliffG, spots, { shadow: false });
  }
  // floating islands and loose slabs of rock out in the sky
  const floaters = new THREE.Group();
  root.add(floaters);
  if (islandG) {
    const spots: Spot[] = [];
    for (let i = 0; i < (low ? 9 : 16); i++) spots.push({ x: -60 + rnd() * (length + 160), z: -70 - rnd() * 260, y: -6 + rnd() * 34, h: 10 + rnd() * 26, ry: rnd() * 6.28 });
    const g = instances(islandG, spots, { shadow: false });
    if (g) floaters.add(g);
  }
  if (cliffG) {
    const spots: Spot[] = [];
    for (let i = 0; i < (low ? 8 : 16); i++) spots.push({ x: -60 + rnd() * (length + 160), z: -40 - rnd() * 220, y: -18 + rnd() * 46, w: 8 + rnd() * 22, h: 0, ry: rnd() * 6.28 });
    const g = instances(cliffG, spots, { shadow: false });
    if (g) floaters.add(g);
  }

  // ---------- the sea of clouds below, and clouds in the sky ----------
  const seaMat = new THREE.ShaderMaterial({
    fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 } }]),
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uT; varying vec3 vW;
      #include <fog_pars_fragment>
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){ vec2 p = vW.xz * 0.018 + vec2(uT * 0.004, 0.0);
        float b = fbm(p), b2 = fbm(p * 2.7 + 3.1);
        float lit = smoothstep(0.35, 0.75, b * 0.75 + b2 * 0.35);
        gl_FragColor = vec4(mix(vec3(0.70, 0.80, 0.92), vec3(1.0, 0.99, 0.96), lit), 1.0);
        #include <fog_fragment>
      }`,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.y = -24;
  root.add(sea);
  const puffTex = await loadTexture('world/cloud.webp');
  const clouds = new THREE.Group();
  if (puffTex) {
    const spots: number[][] = [];
    for (let i = 0; i < (low ? 60 : 130); i++) { const x = -80 + rnd() * (length + 200); spots.push([x, -24 + rnd() * 14, edgeZ(Math.max(-30, Math.min(length + 50, x))) - 12 - Math.pow(rnd(), 0.7) * 240, 12 + rnd() * 26]); }
    for (let i = 0; i < (low ? 16 : 30); i++) spots.push([-80 + rnd() * (length + 200), 22 + rnd() * 50, -110 - rnd() * 280, 26 + rnd() * 36]);
    spots.sort((a, b) => a[2] - b[2]); // far ones first, so the soft edges blend
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: puffTex, transparent: true, depthWrite: false, fog: true }), spots.length);
    const o = new THREE.Object3D();
    spots.forEach(([x, y, z, sz], i) => { o.position.set(x, y, z); o.scale.set(sz * 2.2, sz, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.frustumCulled = false;
    clouds.add(im);
  }
  root.add(clouds);

  // ---------- waterfalls over the edge ----------
  const fallMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uT; varying vec2 vUv;
      float n(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float sn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(n(i), n(i+vec2(1,0)), f.x), mix(n(i+vec2(0,1)), n(i+vec2(1,1)), f.x), f.y); }
      void main(){ float streak = sn(vec2(vUv.x * 18.0, vUv.y * 3.0 + uT * 2.2)) * 0.6 + sn(vec2(vUv.x * 40.0, vUv.y * 6.0 + uT * 3.4)) * 0.4;
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float fade = smoothstep(0.0, 0.35, vUv.y);
        vec3 c = mix(vec3(0.62, 0.84, 0.95), vec3(1.0), smoothstep(0.35, 0.8, streak));
        gl_FragColor = vec4(c, edge * fade * (0.55 + 0.4 * streak)); }`,
  });
  const poolMat = new THREE.MeshLambertMaterial({ color: 0x6fc3dd, transparent: true, opacity: 0.85 });
  for (let i = 0, count = Math.max(3, Math.round(length / 70)); i < count; i++) {
    const x = 25 + i * ((length - 40) / count) + rnd() * 10, z = edgeZ(x);
    const w = 2.2 + rnd() * 1.6, hgt = 38;
    const g = new THREE.PlaneGeometry(w, hgt, 1, 8);
    g.translate(0, -hgt / 2, 0);
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) { const d = -pos.getY(k); pos.setZ(k, -Math.min(4, d * 0.18) - d * 0.02); } // arcs out, then falls
    const m = new THREE.Mesh(g, fallMat);
    m.position.set(x, height(x, z + 1.5) + 0.05, z + 0.4);
    root.add(m);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), poolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, height(x, z + 2.2) + 0.06, z + 2.0);
    root.add(pool);
  }

  // ---------- the finish gate ----------
  const gate = new THREE.Group();
  if (gateG) {
    const g = gateG.scene.clone(true);
    g.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3());
    const s = 4.4 / size.y;
    g.scale.setScalar(s);
    g.position.set(-(box.min.x + size.x / 2) * s, -box.min.y * s - 0.1, -(box.min.z + size.z / 2) * s);
    gate.add(g);
  }
  root.add(gate);
  // drawn as see-through-able from the start, so fading it later never has to rebuild its shaders
  const gateMats: THREE.Material[] = [];
  gate.traverse(o => { if (o instanceof THREE.Mesh) for (const m of [o.material].flat()) { m.transparent = true; gateMats.push(m); } });
  function gateSolid(k: number) {
    for (const m of gateMats) { m.opacity = k; m.depthWrite = k > 0.99; }
  }
  /** Put the gate across the trail a few steps before s, so the runner goes through it and stops just past. */
  function placeFinish(s: number) {
    const f = trail.at(s - GATE_BEFORE);
    gate.position.copy(f.p);
    gate.rotation.y = Math.atan2(f.t.x, f.t.z); // the model's opening runs along its x, so this lines it up with the trail
  }

  const snapped = new THREE.Vector3();
  function update(_dt: number, t: number, focus: THREE.Vector3) {
    windUniform.value = t;
    fallMat.uniforms.uT.value = t;
    seaMat.uniforms.uT.value = t;
    clouds.position.x = Math.sin(t * 0.02) * 12;
    floaters.position.y = Math.sin(t * 0.25) * 0.8;
    const fx = focus.dot(lx), fy = focus.dot(ly);
    snapped.copy(focus).addScaledVector(lx, Math.round(fx / texel) * texel - fx).addScaledVector(ly, Math.round(fy / texel) * texel - fy);
    sun.position.copy(snapped).add(sunOffset);
    sun.target.position.copy(snapped);
    sky.position.copy(focus);
  }

  return { trail, height, placeFinish, gateSolid, update, root };
}
