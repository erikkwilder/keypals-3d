// Shared pieces for the Arcade's 3D games: number plaques painted on a canvas (big friendly numbers on a
// glossy rounded board), the wooden sled, models drawn many times at once (pines, rocks), a soft sky, a
// painted picture filling the screen behind a little 3D world, and the stand-in island those worlds use.
import * as THREE from 'three';
import { loadGltf, loadTexture } from '../assets';
import { stage } from '../stage';
import type { Island } from '../island';
import { THEMES } from '../themes';

let fontReady: Promise<unknown> | null = null;
/** The game's rounded font, loaded before any plaque is painted (the canvas would fall back otherwise). */
export function fontLoaded() {
  fontReady ??= document.fonts ? Promise.all([document.fonts.load('600 120px Fredoka'), document.fonts.load('800 60px Nunito')]).catch(() => null) : Promise.resolve();
  return fontReady;
}

export type PlaqueLook = { bg?: [string, string]; ink?: string; edge?: string; glow?: string };
/** A glossy rounded board with text on it, as a texture (and its width:height). */
export function plaque(text: string, look: PlaqueLook = {}, h = 160): { tex: THREE.CanvasTexture; aspect: number } {
  const c = document.createElement('canvas'), g = c.getContext('2d')!;
  const font = `600 ${Math.round(h * 0.62)}px Fredoka, Nunito, sans-serif`;
  g.font = font;
  const w = Math.max(h * 1.35, Math.ceil(g.measureText(text).width + h * 0.8));
  c.width = w; c.height = h;
  const r = h * 0.32, pad = h * 0.07;
  const rr = (x: number, y: number, ww: number, hh: number, rad: number) => { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + ww, y, x + ww, y + hh, rad); g.arcTo(x + ww, y + hh, x, y + hh, rad); g.arcTo(x, y + hh, x, y, rad); g.arcTo(x, y, x + ww, y, rad); g.closePath(); };
  if (look.glow) { g.shadowColor = look.glow; g.shadowBlur = h * 0.12; }
  rr(pad, pad, w - pad * 2, h - pad * 2, r);
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, look.bg?.[0] ?? '#ffffff'); grd.addColorStop(1, look.bg?.[1] ?? '#e9e2ff');
  g.fillStyle = grd; g.fill();
  g.shadowBlur = 0;
  g.lineWidth = h * 0.06; g.strokeStyle = look.edge ?? '#ffffff'; g.stroke();
  // a soft shine across the top
  rr(pad * 2.2, pad * 1.6, w - pad * 4.4, h * 0.3, r * 0.6);
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.fill();
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = h * 0.05; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.strokeText(text, w / 2, h * 0.54);
  g.fillStyle = look.ink ?? '#2a1f45'; g.fillText(text, w / 2, h * 0.54);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { tex, aspect: w / h };
}
/** A plaque as a sprite that always faces the camera, `height` metres tall. */
export function plaqueSprite(text: string, height: number, look: PlaqueLook = {}) {
  const { tex, aspect } = plaque(text, look);
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(m);
  s.scale.set(height * aspect, height, 1);
  s.renderOrder = 5;
  return s;
}
export function disposeSprite(s: THREE.Sprite) { s.material.map?.dispose(); s.material.dispose(); }

/** The wooden sled (front along +x): red and natural slats on a varnished frame, steel runners. */
export async function makeSled(): Promise<{ group: THREE.Group; dispose(): void }> {
  const own: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { own.push(x); return x; };
  const sled = new THREE.Group();
  const [redTex, pineTex] = await Promise.all([loadTexture('world/redwood.webp', { repeat: true, color: true }), loadTexture('world/planks.webp', { repeat: true, color: true })]);
  const strip = (t: THREE.Texture | null, v: number) => { if (!t) return null; const c = t.clone(); c.repeat.set(1, v); c.needsUpdate = true; return keep(c); };
  const red = keep(new THREE.MeshStandardMaterial({ map: strip(redTex, 0.12), color: redTex ? 0xffffff : 0xd8463c, roughness: 0.42 }));
  const wood = keep(new THREE.MeshStandardMaterial({ map: strip(pineTex, 0.1), color: pineTex ? 0xf2d2a6 : 0xb07a45, roughness: 0.6 }));
  const frame = keep(new THREE.MeshStandardMaterial({ map: strip(pineTex, 0.05), color: pineTex ? 0xc8945c : 0x8a5a30, roughness: 0.55 }));
  const metal = keep(new THREE.MeshStandardMaterial({ color: 0x9aa0aa, metalness: 0.85, roughness: 0.32 }));
  const slatGeo = keep(new THREE.BoxGeometry(1.3, 0.045, 0.125));
  { const p = slatGeo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setZ(i, p.getZ(i) * 0.9); slatGeo.computeVertexNormals(); }
  for (let k = 0; k < 4; k++) { const slat = new THREE.Mesh(slatGeo, k % 2 ? wood : red); slat.position.set(-0.02, 0.255, -0.23 + k * 0.153); slat.castShadow = true; slat.receiveShadow = true; sled.add(slat); }
  for (const z of [-0.27, 0.27]) { const rail = new THREE.Mesh(keep(new THREE.BoxGeometry(1.36, 0.06, 0.05)), frame); rail.position.set(-0.02, 0.205, z); rail.castShadow = true; sled.add(rail); }
  for (const x of [-0.55, 0.0, 0.5]) { const bar = new THREE.Mesh(keep(new THREE.BoxGeometry(0.06, 0.04, 0.6)), frame); bar.position.set(x, 0.2, 0); sled.add(bar); }
  const steer = new THREE.Mesh(keep(new THREE.BoxGeometry(0.09, 0.05, 0.78)), frame); steer.position.set(0.6, 0.27, 0); steer.castShadow = true; sled.add(steer);
  const pull = new THREE.CatmullRomCurve3([new THREE.Vector3(0.6, 0.3, -0.36), new THREE.Vector3(0.85, 0.22, -0.3), new THREE.Vector3(1.05, 0.08, 0), new THREE.Vector3(0.85, 0.22, 0.3), new THREE.Vector3(0.6, 0.3, 0.36)]);
  sled.add(new THREE.Mesh(keep(new THREE.TubeGeometry(pull, 30, 0.012, 6)), keep(new THREE.MeshStandardMaterial({ color: 0xd9c49a, roughness: 0.9 }))));
  for (const z of [-0.27, 0.27]) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.72, 0.05, z), new THREE.Vector3(0.5, 0.035, z), new THREE.Vector3(0.78, 0.1, z), new THREE.Vector3(0.8, 0.26, z), new THREE.Vector3(0.66, 0.3, z), new THREE.Vector3(0.6, 0.24, z)]);
    const run = new THREE.Mesh(keep(new THREE.TubeGeometry(curve, 40, 0.022, 8)), metal); run.castShadow = true; sled.add(run);
    for (const x of [-0.5, -0.05, 0.38]) { const leg = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.014, 0.014, 0.17, 6)), metal); leg.position.set(x, 0.12, z); sled.add(leg); }
  }
  return { group: sled, dispose: () => own.forEach(o => o.dispose()) };
}

/** A model drawn many times in one go (every mesh of it as an InstancedMesh): place copies with set(). */
export class Many {
  readonly group = new THREE.Group();
  private parts: { mesh: THREE.InstancedMesh; base: THREE.Matrix4 }[] = [];
  private scale = 1;
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private s = new THREE.Vector3(); private p = new THREE.Vector3();
  private constructor(readonly count: number) {}
  /** `height`: the model's height in metres at scale 1. */
  static async load(path: string, height: number, count: number, shadow = true): Promise<Many | null> {
    const g = await loadGltf(path);
    if (!g) return null;
    const many = new Many(count);
    g.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3());
    many.scale = height / Math.max(1e-6, size.y);
    const lift = new THREE.Matrix4().makeTranslation(0, -box.min.y, 0);
    g.scene.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, count);
      im.castShadow = shadow; im.receiveShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      many.parts.push({ mesh: im, base: lift.clone().multiply(mesh.matrixWorld) });
      many.group.add(im);
    });
    for (let i = 0; i < count; i++) many.hide(i);
    many.commit();
    return many;
  }
  set(i: number, x: number, y: number, z: number, s = 1, turn = 0) {
    this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn);
    this.s.setScalar(s * this.scale); this.p.set(x, y, z);
    this.m.compose(this.p, this.q, this.s);
    for (const pt of this.parts) pt.mesh.setMatrixAt(i, this.m.clone().multiply(pt.base));
  }
  hide(i: number) { this.m.makeScale(0, 0, 0); for (const pt of this.parts) pt.mesh.setMatrixAt(i, this.m); }
  commit() { for (const pt of this.parts) pt.mesh.instanceMatrix.needsUpdate = true; }
  dispose() { this.group.removeFromParent(); for (const pt of this.parts) pt.mesh.dispose(); }
}

/** A big soft sky: three colours from the top down, a warm sun glow. */
export function skyDome(top: number, mid: number, low: number, sunDir = new THREE.Vector3(0.3, 0.45, -0.85)) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, low: { value: new THREE.Color(low) }, sunDir: { value: sunDir.normalize() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: 'uniform vec3 top, mid, low, sunDir; varying vec3 vDir; void main(){ float y = vDir.y; vec3 c = mix(low, mid, smoothstep(-0.1, 0.15, y)); c = mix(c, top, smoothstep(0.15, 0.7, y)); float s = max(0.0, dot(normalize(vDir), sunDir)); c += vec3(1.0,0.93,0.8) * (pow(s, 400.0) * 1.2 + pow(s, 10.0) * 0.16); gl_FragColor = vec4(c, 1.0); }',
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  mesh.renderOrder = -1;
  return mesh;
}

/** A painted picture on a big curved panel far away (a backdrop behind the world). */
export async function backdrop(path: string, radius: number, height: number, arc = Math.PI * 0.9): Promise<THREE.Mesh | null> {
  const tex = await loadTexture(path, { color: true });
  if (!tex) return null;
  const geo = new THREE.CylinderGeometry(radius, radius, height, 48, 1, true, -arc / 2, arc);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  // the cylinder's opening faces -z (the picture's middle straight ahead)
  mesh.rotation.y = Math.PI;
  mesh.renderOrder = -1;
  return mesh;
}

/** A painted picture filling the screen behind the 3D world, cropped to fit like CSS `cover`. `anchorY`:
 *  which part stays when the screen is taller than the picture (0 the top, 1 the bottom). */
export async function paintedBackground(path: string, anchorX = 0.5, anchorY = 0.5) {
  const tex = await loadTexture(path, { color: true });
  const was = stage.scene.background;
  let aspect = 0;
  const fit = () => {
    if (!tex) return;
    const a = stage.camera.aspect, img = tex.image as { width: number; height: number };
    if (a === aspect) return;
    aspect = a;
    const ia = img.width / img.height;
    if (a > ia) { tex.repeat.set(1, ia / a); tex.offset.set(0, (1 - tex.repeat.y) * (1 - anchorY)); }
    else { tex.repeat.set(a / ia, 1); tex.offset.set((1 - tex.repeat.x) * anchorX, 0); }
  };
  if (tex) { stage.scene.background = tex; fit(); }
  return {
    update: fit,
    dispose() { if (stage.scene.background === tex) stage.scene.background = was; tex?.dispose(); },
  };
}

/** The island a little arcade world stands on: none of the real island's trail, just a root to hang the
 *  world from (the stage takes the island that was showing away while this one runs). */
export function arcadeIsland(root = new THREE.Group(), dispose: () => void = () => {}): Island {
  return {
    trail: { length: 1e6, at: () => ({ p: new THREE.Vector3(), t: new THREE.Vector3(0, 0, -1), n: new THREE.Vector3(1, 0, 0) }) },
    height: () => 0, placeFinish: () => {}, gateSolid: () => {}, setSmooth: () => {}, update: () => {},
    root, theme: { ...THEMES.village }, stats: {}, dispose,
  };
}

/** Soft daylight for a small world: sky fill and a warm sun casting shadows over `size` metres. */
export function daylight(root: THREE.Object3D, size = 8, at = new THREE.Vector3(4, 10, 6)) {
  const hemi = new THREE.HemisphereLight(0xeaf4ff, 0xc9b8a0, 1.5);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
  sun.position.copy(at); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.5, far: 60 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  root.add(hemi, sun, sun.target);
  return sun;
}

/** A see-through floor that only shows the shadows falling on it (the buddy standing on the picture). */
export function shadowCatcher(w = 30, d = 12, opacity = 0.22) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.ShadowMaterial({ opacity, color: 0x2a1f45 }));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
  return m;
}

/** Where a point on the screen (0..1 across and down) meets the ground (y = `y`), for this camera. */
export function screenToGround(sx: number, sy: number, y = 0, cam: THREE.Camera = stage.camera) {
  const r = new THREE.Raycaster();
  r.setFromCamera(new THREE.Vector2(sx * 2 - 1, -(sy * 2 - 1)), cam);
  const t = (y - r.ray.origin.y) / r.ray.direction.y;
  return r.ray.origin.clone().addScaledVector(r.ray.direction, Math.max(0, t));
}
