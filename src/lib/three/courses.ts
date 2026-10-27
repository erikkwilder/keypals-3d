// Courses for the math strands that don't run the island trail: a cliff to climb (Plus Peaks), a snowy
// slope to sled down (Minus Mountain) and a bay to swim across (Share Shore). Each is built like an
// island (the same shape: a trail with at(s), a finish, a root to put on stage), so the trip, the ride
// ladder, the finish dance and the results all work the same way on every one of them.
import * as THREE from 'three';
import { THEMES, type Theme } from './themes';
import type { Island, TrailPoint } from './island';

export type CourseMove = 'climb' | 'slide' | 'swim';
const UP = new THREE.Vector3(0, 1, 0);

/** A soft noise picture for rock and snow (no files to load). */
function noiseTex(w: number, h: number, paint: (x: number, y: number, n: number) => [number, number, number]) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!, img = g.createImageData(w, h);
  const grid = Array.from({ length: 33 * 33 }, () => Math.random());
  const at = (x: number, y: number) => grid[(y % 33) * 33 + (x % 33)];
  const vn = (x: number, y: number, s: number) => {
    const fx = (x / w) * s, fy = (y / h) * s, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = vn(x, y, 4) * 0.5 + vn(x, y, 9) * 0.3 + vn(x, y, 22) * 0.2;
    const [r, gg, b] = paint(x, y, n), i = (y * w + x) * 4;
    img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function flag(color: number) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }));
  pole.position.y = 1.3; g.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7, 8, 2), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.8 }));
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
export function buildCourse(move: CourseMove): Island {
  const root = new THREE.Group();
  const theme: Theme = { ...THEMES[move === 'climb' ? 'cliffs' : move === 'slide' ? 'ridge' : 'shores'] };
  const own: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { own.push(x); return x; };
  let finishS = 30;
  // the sky, and light that follows the buddy so shadows stay sharp (as on the islands)
  const T = theme, sunDir = new THREE.Vector3(0.45, 0.5, 0.75).normalize();
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(1500, 32, 16)), keep(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(T.sky[0]) }, mid: { value: new THREE.Color(T.sky[1]) }, low: { value: new THREE.Color(T.sky[2]) }, sunDir: { value: sunDir } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: 'uniform vec3 top, mid, low, sunDir; varying vec3 vDir; void main(){ float y = vDir.y; vec3 c = mix(low, mid, smoothstep(-0.08, 0.18, y)); c = mix(c, top, smoothstep(0.18, 0.75, y)); float s = max(0.0, dot(normalize(vDir), sunDir)); c += vec3(1.0,0.93,0.78) * (pow(s, 600.0) * 1.6 + pow(s, 12.0) * 0.18); gl_FragColor = vec4(c, 1.0); }',
  })));
  sky.renderOrder = -1;
  root.add(sky);
  const hemi = new THREE.HemisphereLight(T.hemi.sky, T.hemi.ground, T.hemi.power * 1.15);
  const sun = new THREE.DirectionalLight(T.sun.color, T.sun.power);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 160 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
  root.add(hemi, sun, sun.target);
  const sunOffset = sunDir.clone().multiplyScalar(70);
  const fin = flag(move === 'climb' ? 0xef7d2b : move === 'slide' ? 0x7c5cf5 : 0x2fa898);
  root.add(fin);
  let update: (dt: number, t: number) => void = () => {};
  let at: (s: number) => TrailPoint;

  if (move === 'climb') {
    // a rock face going up from a meadow; the buddy climbs it facing in, the camera on the open side (+z)
    const RUN = 4, H = 46;
    const rock = keep(noiseTex(256, 512, (x, y, n) => { const band = 0.5 + 0.5 * Math.sin(y / 23 + n * 3); const v = 120 + n * 70 + band * 30; return [v * 1.02, v * 0.88, v * 0.72]; }));
    rock.repeat.set(1.5, 6);
    const faceGeo = keep(new THREE.PlaneGeometry(9, H, 36, 150));
    const fp = faceGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), y = fp.getY(i); fp.setZ(i, Math.sin(x * 2.1 + y * 0.7) * 0.08 + Math.sin(y * 3.3 - x) * 0.05 + (Math.abs(x) > 2.6 ? (Math.abs(x) - 2.6) * 0.35 : 0)); }
    faceGeo.computeVertexNormals();
    const rockMat = keep(new THREE.MeshStandardMaterial({ map: rock, roughness: 0.95, color: 0xd9cbb8 }));
    const face = new THREE.Mesh(faceGeo, rockMat);
    face.position.set(0, H / 2 - 1, -0.45);
    face.receiveShadow = true;
    root.add(face);
    const back = new THREE.Mesh(keep(new THREE.BoxGeometry(9.6, H, 4)), rockMat);
    back.position.set(0, H / 2 - 1, -2.6);
    root.add(back);
    // the coloured holds up the climbing line
    const holdGeo = keep(new THREE.IcosahedronGeometry(0.09, 0));
    const holdCols = [0xef4f6a, 0xf7c548, 0x3fa7e0, 0x4fcf98, 0xb98cff];
    const holds = new THREE.InstancedMesh(holdGeo, keep(new THREE.MeshStandardMaterial({ roughness: 0.6 })), 260);
    const o = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < 260; i++) {
      const y = 0.3 + (i / 260) * (H - 3), x = (Math.random() - 0.5) * 1.8 + (i % 2 ? 0.45 : -0.45);
      o.position.set(x, y, -0.38); o.rotation.set(Math.random() * 3, Math.random() * 3, 0); o.scale.setScalar(0.7 + Math.random() * 0.7); o.updateMatrix();
      holds.setMatrixAt(i, o.matrix); holds.setColorAt(i, c.set(holdCols[i % holdCols.length]));
    }
    root.add(holds);
    // meadow at the foot, a ledge at the top
    const meadow = new THREE.Mesh(keep(new THREE.CircleGeometry(40, 48)), keep(new THREE.MeshStandardMaterial({ color: 0x8fc46a, roughness: 1 })));
    meadow.rotation.x = -Math.PI / 2; meadow.position.y = -0.02; meadow.receiveShadow = true; root.add(meadow);
    const ledge = new THREE.Mesh(keep(new THREE.BoxGeometry(9.6, 0.5, 3.2)), rockMat);
    root.add(ledge);
    const rockLumps = keep(new THREE.DodecahedronGeometry(0.6, 0));
    for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(rockLumps, rockMat); const a = Math.random() * Math.PI; m.position.set(Math.cos(a) * (5 + Math.random() * 14), 0.1, Math.sin(a) * (3 + Math.random() * 10)); m.scale.setScalar(0.5 + Math.random() * 1.4); root.add(m); }
    at = (s) => {
      const y = Math.max(0, Math.min(s, finishS) - RUN);
      // over the top: step onto the ledge
      const over = Math.max(0, Math.min(1, (s - finishS + 0.6) / 0.6));
      return { p: new THREE.Vector3(0, y + over * 0.55, over * 1.0), t: UP.clone(), n: new THREE.Vector3(0, 0, 1) };
    };
    const place = () => { const top = finishS - RUN; ledge.position.set(0, top + 0.3, 0.9); fin.position.set(1.4, top + 0.55, 1.2); };
    place();
    (root.userData as { place?: () => void }).place = place;
    update = (_dt, t) => wave(fin.userData.cloth, t);
  } else if (move === 'slide') {
    // a long snowy slope down the ridge with pines on both sides; the buddy sleds down along +x
    const SLOPE = 0.32;
    const snow = keep(noiseTex(256, 256, (_x, _y, n) => { const v = 232 + n * 22; return [v - 6, v, Math.min(255, v + 10)]; }));
    snow.repeat.set(20, 6);
    const slopeGeo = keep(new THREE.PlaneGeometry(320, 70, 160, 35));
    const sp = slopeGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i); sp.setZ(i, Math.abs(y) > 2.2 ? Math.sin(x * 0.11 + y * 0.3) * 0.5 + (Math.abs(y) - 2.2) * 0.12 : 0); }
    slopeGeo.computeVertexNormals();
    const slope = new THREE.Mesh(slopeGeo, keep(new THREE.MeshStandardMaterial({ map: snow, roughness: 0.9, color: 0xffffff })));
    slope.rotation.x = -Math.PI / 2;
    slope.rotation.z = 0; // along x
    const tilt = new THREE.Group(); tilt.rotation.z = -Math.atan(SLOPE); tilt.add(slope); slope.position.set(140, 0, 0); slope.receiveShadow = true;
    root.add(tilt);
    // pines
    const cone = keep(new THREE.ConeGeometry(1, 2.6, 7)), trunk = keep(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 6));
    const pineMat = keep(new THREE.MeshStandardMaterial({ color: 0x2f6b4a, roughness: 0.9 })), trunkMat = keep(new THREE.MeshStandardMaterial({ color: 0x6b4a33 }));
    const snowCap = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
    for (let i = 0; i < 90; i++) {
      const x = -10 + Math.random() * 300, side = Math.random() < 0.5 ? -1 : 1, z = side * (3.2 + Math.random() * 22);
      if (side > 0 && z < 6) continue; // keep the camera side open
      const g = new THREE.Group(), sc = 0.8 + Math.random() * 1.2;
      const tr = new THREE.Mesh(trunk, trunkMat); tr.position.y = 0.4; g.add(tr);
      for (let k = 0; k < 3; k++) { const cm = new THREE.Mesh(cone, k === 2 ? snowCap : pineMat); cm.position.y = 1.4 + k * 0.85; cm.scale.setScalar(1 - k * 0.25); g.add(cm); }
      g.scale.setScalar(sc); g.position.set(x, -x * SLOPE, z); root.add(g);
    }
    // the sled, carried by the scene (the buddy sits on it)
    const sled = new THREE.Group();
    const red = keep(new THREE.MeshStandardMaterial({ color: 0xd8463c, roughness: 0.5 })), metal = keep(new THREE.MeshStandardMaterial({ color: 0xc9ccd6, metalness: 0.6, roughness: 0.3 }));
    const deck = new THREE.Mesh(keep(new THREE.BoxGeometry(1.25, 0.08, 0.6)), red); deck.position.y = 0.22; sled.add(deck);
    for (const z of [-0.26, 0.26]) {
      const run = new THREE.Mesh(keep(new THREE.BoxGeometry(1.35, 0.04, 0.05)), metal); run.position.set(0, 0.04, z); sled.add(run);
      const tip = new THREE.Mesh(keep(new THREE.TorusGeometry(0.12, 0.025, 6, 10, Math.PI)), metal); tip.position.set(0.68, 0.16, z); tip.rotation.z = -Math.PI / 2; sled.add(tip);
      for (const x of [-0.4, 0.4]) { const leg = new THREE.Mesh(keep(new THREE.BoxGeometry(0.05, 0.18, 0.05)), metal); leg.position.set(x, 0.13, z); sled.add(leg); }
    }
    root.add(sled);
    root.userData.sled = sled;
    const dir = new THREE.Vector3(1, -SLOPE, 0).normalize();
    at = (s) => {
      // flat at the very end, so the buddy can stand and dance
      const x = Math.min(s, finishS + 0.2), flat = Math.max(0, s - finishS - 0.2);
      const p = new THREE.Vector3(x + flat, -x * SLOPE, 0);
      return { p, t: flat > 0 ? new THREE.Vector3(1, 0, 0) : dir.clone(), n: new THREE.Vector3(0, 0, 1) };
    };
    const banner = new THREE.Mesh(keep(new THREE.BoxGeometry(0.2, 0.6, 6.4)), keep(new THREE.MeshStandardMaterial({ color: 0x7c5cf5 })));
    root.add(banner);
    const place = () => { const f = at(finishS - 2.6); fin.position.set(f.p.x, f.p.y, -2.6); banner.position.set(f.p.x, f.p.y + 2.6, 0); };
    place();
    root.userData.place = place;
    update = (_dt, t) => wave(fin.userData.cloth, t);
  } else {
    // a bay: open water to the horizon, lane ropes, a dock at each end; the buddy swims along +x
    const waterGeo = keep(new THREE.PlaneGeometry(420, 160, 140, 50));
    const water = new THREE.Mesh(waterGeo, keep(new THREE.MeshStandardMaterial({ color: 0x2fa6c8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 })));
    water.rotation.x = -Math.PI / 2; water.position.set(150, 0, 0); water.receiveShadow = true;
    root.add(water);
    const wp = waterGeo.attributes.position as THREE.BufferAttribute;
    const base = Float32Array.from(wp.array as Float32Array);
    // a sandy floor you can see through the shallows near the docks
    const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(420, 160)), keep(new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: 1 })));
    floor.rotation.x = -Math.PI / 2; floor.position.set(150, -2.2, 0); root.add(floor);
    const wood = keep(new THREE.MeshStandardMaterial({ color: 0x9a6b43, roughness: 0.85 }));
    const dockGeo = keep(new THREE.BoxGeometry(5, 0.3, 3.4)), postGeo = keep(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6));
    const dock = (x: number) => { const g = new THREE.Group(); const d = new THREE.Mesh(dockGeo, wood); d.position.y = 0.35; g.add(d); for (const px of [-2.2, 2.2]) for (const pz of [-1.4, 1.4]) { const p = new THREE.Mesh(postGeo, wood); p.position.set(px, -0.6, pz); g.add(p); } g.position.x = x; root.add(g); return g; };
    dock(-2.4);
    const endDock = dock(40);
    // lane ropes: floats in red and white
    const floatGeo = keep(new THREE.SphereGeometry(0.11, 8, 6));
    const ropes = new THREE.InstancedMesh(floatGeo, keep(new THREE.MeshStandardMaterial({ roughness: 0.5 })), 2 * 380);
    const o = new THREE.Object3D(), c = new THREE.Color();
    let k = 0;
    for (const z of [-1.3, 1.3]) for (let i = 0; i < 380; i++) { o.position.set(i * 0.35, 0.02, z); o.updateMatrix(); ropes.setMatrixAt(k, o.matrix); ropes.setColorAt(k++, c.set(Math.floor(i / 4) % 2 ? 0xffffff : 0xe8484f)); }
    root.add(ropes);
    // a sandy island with palms far off, so the bay has somewhere to be
    const sand = new THREE.Mesh(keep(new THREE.SphereGeometry(30, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2)), keep(new THREE.MeshStandardMaterial({ color: 0xe6cf98, roughness: 1 })));
    sand.scale.y = 0.12; sand.position.set(70, -1, -70); root.add(sand);
    const trunkGeo = keep(new THREE.CylinderGeometry(0.25, 0.35, 7, 6)), leafGeo = keep(new THREE.ConeGeometry(2.6, 1.2, 7));
    const trunkMat = keep(new THREE.MeshStandardMaterial({ color: 0x8a6440 })), leafMat = keep(new THREE.MeshStandardMaterial({ color: 0x3f9a4f }));
    for (let i = 0; i < 9; i++) { const g = new THREE.Group(); const tr = new THREE.Mesh(trunkGeo, trunkMat); tr.position.y = 3.5; tr.rotation.z = (Math.random() - 0.5) * 0.3; g.add(tr); const lf = new THREE.Mesh(leafGeo, leafMat); lf.position.y = 7.2; g.add(lf); g.position.set(55 + Math.random() * 30, 1.5, -60 - Math.random() * 18); root.add(g); }
    at = (s) => {
      // swim from the start dock to the end dock; past the finish, climb out onto it
      const x = s, onDock = s >= finishS - 0.2;
      return { p: new THREE.Vector3(x, onDock ? 0.5 : -0.62, 0), t: new THREE.Vector3(1, 0, 0), n: new THREE.Vector3(0, 0, 1) };
    };
    const place = () => { endDock.position.x = finishS + 2.2; fin.position.set(finishS + 1.4, 0.5, -1.2); };
    place();
    root.userData.place = place;
    update = (_dt, t) => {
      for (let i = 0; i < wp.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        wp.setZ(i, Math.sin(x * 0.35 + t * 1.6) * 0.06 + Math.sin(y * 0.5 - t * 1.2 + x * 0.1) * 0.05);
      }
      wp.needsUpdate = true;
      waterGeo.computeVertexNormals();
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
      update(dt, t);
    },
    root,
    theme,
    dispose() { for (const x of own) x.dispose(); root.removeFromParent(); },
    stats: {},
  };
}
