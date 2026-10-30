// The blocks built on My Sky Island, in 3D (island/blocks.ts is what they are and where). Every piece is a
// soft toy block: rounded edges, a painted face tinted by its paint, or wood, stone, brick, hedge, roof
// tiles, crystal, gold, a warm glow or cloud. They're drawn as instances: one draw for each piece-and-paint
// pair in use (all the wooden cubes at once, all the blue ramps...), however many there are, so a big build
// stays smooth on a phone. Windows light up at night, new blocks pop in, and while building a see-through
// copy of the piece shows where it will go.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadTexture } from './assets';
import { BLOCK, PAINTS, SHAPE, builtOf, type Block, type PaintKind, type ShapeId } from '../island/blocks';
import { blockFace, bricks, crystal, hedge, puffs, roofTiles, stones } from '../island/paint';

type Role = 'paint' | 'glass' | 'pane' | 'wood' | 'gold';
type Part = { role: Role; geo: THREE.BufferGeometry };
export type BlockHit = { key: string; block: Block; point: THREE.Vector3; normal: THREE.Vector3 };
const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const H = BLOCK / 2;

/** plain triangles (position, normal, uv) */
function prep(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
  if (!n.attributes.normal) n.computeVertexNormals();
  n.clearGroups();
  return n;
}
function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry { const m = mergeGeometries(list.map(prep))!; return m; }
/** an extruded outline (an arch, a window frame), its pictures spread across the block */
function extrude(shape: THREE.Shape, depth: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 + 0.5, uv.getY(i) * 2);
  return g;
}
/** a ramp: rising from the front (+z) to the back */
function wedge(): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [];
  const tri = (a: number[], b: number[], c: number[], ua: number[], ub: number[], uc: number[]) => { pos.push(...a, ...b, ...c); uv.push(...ua, ...ub, ...uc); };
  const quad = (a: number[], b: number[], c: number[], d: number[]) => { tri(a, b, c, [0, 0], [1, 0], [1, 1]); tri(a, c, d, [0, 0], [1, 1], [0, 1]); };
  const fl = [-H, 0, H], fr = [H, 0, H], bl = [-H, 0, -H], br = [H, 0, -H], tl = [-H, BLOCK, -H], tr = [H, BLOCK, -H];
  quad(fl, fr, tr, tl); // the slope
  quad(br, bl, tl, tr); // the back
  quad(bl, br, fr, fl); // underneath
  tri(fl, tl, bl, [1, 0], [0, 1], [0, 0]); // the sides
  tri(fr, br, tr, [0, 0], [1, 0], [1, 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const soft = (w: number, h: number, d: number, x = 0, y = 0, z = 0, r = 0.04) => new RoundedBoxGeometry(w, h, d, 1, r).translate(x, y, z);

/** Each piece's parts (what's painted, what's glass, wood or gold), standing on its square, facing +z. */
function pieces(): Record<ShapeId, Part[]> {
  const arch = new THREE.Shape();
  const o = H - 0.02;
  arch.moveTo(-o, 0.02); arch.lineTo(-0.14, 0.02); arch.lineTo(-0.14, 0.13); arch.absarc(0, 0.13, 0.14, Math.PI, 0, true); arch.lineTo(0.14, 0.02); arch.lineTo(o, 0.02); arch.lineTo(o, BLOCK - 0.02); arch.lineTo(-o, BLOCK - 0.02); arch.closePath();
  const frame = new THREE.Shape();
  frame.moveTo(-o, 0.02); frame.lineTo(o, 0.02); frame.lineTo(o, BLOCK - 0.02); frame.lineTo(-o, BLOCK - 0.02); frame.closePath();
  const hole = new THREE.Path(); hole.moveTo(-0.13, 0.12); hole.lineTo(-0.13, 0.38); hole.lineTo(0.13, 0.38); hole.lineTo(0.13, 0.12); hole.closePath();
  frame.holes.push(hole);
  const pillar = new THREE.LatheGeometry([[0.001, 0], [0.235, 0], [0.235, 0.05], [0.2, 0.075], [0.17, 0.09], [0.165, 0.41], [0.2, 0.43], [0.235, 0.455], [0.235, 0.5], [0.001, 0.5]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
  const edges: THREE.BufferGeometry[] = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    edges.push(box(0.04, BLOCK, 0.04, a * (H - 0.02), H, b * (H - 0.02)), box(BLOCK, 0.04, 0.04, 0, H + a * (H - 0.02), b * (H - 0.02)), box(0.04, 0.04, BLOCK, a * (H - 0.02), H + b * (H - 0.02), 0));
  }
  return {
    cube: [{ role: 'paint', geo: prep(soft(BLOCK, BLOCK, BLOCK, 0, H)) }],
    half: [{ role: 'paint', geo: prep(soft(BLOCK, H, BLOCK, 0, H / 2, 0, 0.035)) }],
    ramp: [{ role: 'paint', geo: prep(wedge()) }],
    stairs: [{ role: 'paint', geo: merge([soft(BLOCK, H, H, 0, H / 2, H / 2, 0.035), soft(BLOCK, BLOCK, H, 0, H, -H / 2, 0.035)]) }],
    arch: [{ role: 'paint', geo: prep(extrude(arch, BLOCK - 0.04)) }],
    pillar: [{ role: 'paint', geo: prep(pillar) }],
    fence: [{ role: 'paint', geo: merge([box(0.08, 0.46, 0.08, -0.19, 0.23), box(0.08, 0.46, 0.08, 0.19, 0.23), box(BLOCK, 0.06, 0.05, 0, 0.16), box(BLOCK, 0.06, 0.05, 0, 0.34), box(0.1, 0.03, 0.1, -0.19, 0.475), box(0.1, 0.03, 0.1, 0.19, 0.475)]) }],
    window: [
      { role: 'paint', geo: merge([extrude(frame, BLOCK - 0.04), box(0.26, 0.022, 0.03, 0, 0.25), box(0.022, 0.26, 0.03, 0, 0.25), box(0.32, 0.03, 0.07, 0, 0.11, H - 0.02)]) },
      { role: 'pane', geo: prep(new THREE.PlaneGeometry(0.26, 0.26).translate(0, 0.25, 0)) },
    ],
    door: [
      { role: 'paint', geo: merge([box(0.05, 0.94, BLOCK, -H + 0.025, 0.47), box(0.05, 0.94, BLOCK, H - 0.025, 0.47), soft(BLOCK, 0.08, BLOCK, 0, 0.96, 0, 0.02)]) },
      { role: 'wood', geo: merge([box(0.035, 0.86, 0.38, -H + 0.07, 0.45, 0), box(0.05, 0.05, 0.22, -H + 0.07, 0.62, 0), box(0.05, 0.05, 0.22, -H + 0.07, 0.24, 0)]) },
      { role: 'gold', geo: prep(new THREE.SphereGeometry(0.025, 8, 6).translate(-H + 0.1, 0.45, 0.15)) },
    ],
    glass: [
      { role: 'glass', geo: prep(soft(BLOCK - 0.02, BLOCK - 0.02, BLOCK - 0.02, 0, H, 0, 0.03)) },
      { role: 'paint', geo: merge(edges) },
    ],
  };
}

export class BlockKit {
  readonly root = new THREE.Group();
  private own: { dispose(): void }[] = [];
  private keep = <T extends { dispose(): void }>(x: T) => { this.own.push(x); return x; };
  private parts: Record<ShapeId, Part[]>;
  private mats = new Map<string, THREE.Material>();
  private meshes = new Map<string, THREE.InstancedMesh>();
  /** where each block's instances are (for popping in) */
  private where = new Map<string, [THREE.InstancedMesh, number, Block][]>();
  private pops = new Map<string, number>();
  private str = '\u0000';
  private ghostG: THREE.Group | null = null;
  private ghostMat: THREE.MeshStandardMaterial;
  private ghostShape: ShapeId | null = null;
  private outline: THREE.Mesh;
  private night = 0;

  private constructor(tex: Record<string, THREE.Texture | null>) {
    this.parts = pieces();
    for (const list of Object.values(this.parts)) for (const p of list) this.keep(p.geo);
    const k = this.keep, T = tex;
    const rep = (t: THREE.Texture | null, n: number) => { if (!t) return null; const c = k(t.clone()); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(n, n); c.needsUpdate = true; return c; };
    const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
    const glowPatch = (m: THREE.MeshStandardMaterial, key: string) => {
      // the glow takes each block's own colour
      m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#if defined( USE_INSTANCING_COLOR ) || defined( USE_COLOR )\n totalEmissiveRadiance *= vColor;\n#endif'); };
      m.customProgramCacheKey = () => key;
      return m;
    };
    const set: Record<string, THREE.Material> = {
      plain: std({ map: blockFace(k), roughness: 0.42 }),
      wood: std({ map: rep(T.planks, 1), color: 0xffffff, roughness: 0.7 }),
      stone: std({ map: rep(stones(k, { seed: 23 }), 0.5), roughness: 0.9 }),
      brick: std({ map: bricks(k), roughness: 0.85 }),
      leaf: std({ map: hedge(k), roughness: 0.85 }),
      roof: std({ map: rep(roofTiles(k), 0.5), roughness: 0.55 }),
      crystal: glowPatch(std({ map: crystal(k), roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.86, emissive: 0xffffff, emissiveIntensity: 0.32 }), 'blk-crystal'),
      gold: std({ map: blockFace(k), metalness: 0.55, roughness: 0.25, emissive: 0x6a4500, emissiveIntensity: 0.5 }),
      glow: glowPatch(std({ map: blockFace(k), emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.4 }), 'blk-glow'),
      cloud: std({ map: puffs(k), roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.18 }),
      glass: std({ color: 0xffffff, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.15, depthWrite: false }),
      pane: std({ color: 0xd6efff, emissive: 0xffb84a, emissiveIntensity: 0.12, roughness: 0.12, side: THREE.DoubleSide }),
      woodPart: std({ map: rep(T.planks, 1), color: 0xb98a5a, roughness: 0.75 }),
      goldPart: std({ color: 0xf5c542, metalness: 0.6, roughness: 0.3, emissive: 0x5a3a00, emissiveIntensity: 0.4 }),
    };
    for (const [n, m] of Object.entries(set)) this.mats.set(n, m);
    this.ghostMat = k(new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, emissive: 0x5fe08a, emissiveIntensity: 0.35 }));
    this.outline = new THREE.Mesh(k(new THREE.BoxGeometry(BLOCK + 0.04, BLOCK + 0.04, BLOCK + 0.04)), k(new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.35, depthWrite: false })));
    this.outline.visible = false; this.outline.renderOrder = 3;
    this.root.add(this.outline);
  }
  static async load(): Promise<BlockKit> {
    const planks = await loadTexture('world/planks.webp', { repeat: true });
    return new BlockKit({ planks });
  }

  /** the paint's material and the colour its instances take */
  private look(role: Role, p: number): { mat: string; color: THREE.Color } {
    const def = PAINTS[p] ?? PAINTS[0], c = new THREE.Color(def.color);
    if (role === 'glass') return { mat: 'glass', color: c.lerp(new THREE.Color(0xffffff), def.kind === 'plain' ? 0.45 : 0.85) };
    if (role === 'pane') return { mat: 'pane', color: new THREE.Color(0xffffff) };
    if (role === 'wood') return { mat: 'woodPart', color: new THREE.Color(0xffffff) };
    if (role === 'gold') return { mat: 'goldPart', color: new THREE.Color(0xffffff) };
    return { mat: def.kind, color: c };
  }
  private static matrix(b: Block, s = 1, m4 = new THREE.Matrix4()) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -b.r * Math.PI / 2);
    return m4.compose(new THREE.Vector3((b.x + 0.5) * BLOCK, b.y * BLOCK, (b.z + 0.5) * BLOCK), q, new THREE.Vector3(s, s, s));
  }

  /** Show the save's blocks (all redrawn: it's quick). */
  sync(str: string | undefined) {
    if ((str ?? '') === this.str) return;
    this.str = str ?? '';
    const groups = new Map<string, { geo: THREE.BufferGeometry; mat: string; list: { b: Block; c: THREE.Color; key: string }[] }>();
    for (const [key, b] of builtOf(str).map) {
      this.parts[b.s].forEach((part, i) => {
        const lk = this.look(part.role, b.p), gk = `${b.s}|${i}|${lk.mat}`;
        let g = groups.get(gk); if (!g) groups.set(gk, (g = { geo: part.geo, mat: lk.mat, list: [] }));
        g.list.push({ b, c: lk.color, key });
      });
    }
    for (const [k, m] of this.meshes) if (!groups.has(k)) { m.removeFromParent(); m.dispose(); this.meshes.delete(k); }
    this.where.clear();
    const m4 = new THREE.Matrix4();
    for (const [k, g] of groups) {
      let mesh = this.meshes.get(k);
      if (mesh && mesh.instanceMatrix.count < g.list.length) { mesh.removeFromParent(); mesh.dispose(); mesh = undefined; }
      if (!mesh) {
        mesh = new THREE.InstancedMesh(g.geo, this.mats.get(g.mat)!, Math.max(16, Math.ceil(g.list.length * 1.5)));
        const see = g.mat === 'glass' || g.mat === 'pane';
        mesh.castShadow = !see; mesh.receiveShadow = !see;
        if (g.mat === 'glass') mesh.renderOrder = 2;
        this.root.add(mesh); this.meshes.set(k, mesh);
      }
      mesh.count = g.list.length;
      const keys: string[] = [];
      g.list.forEach((x, i) => {
        mesh!.setMatrixAt(i, BlockKit.matrix(x.b, this.pops.has(x.key) ? 0.001 : 1, m4));
        mesh!.setColorAt(i, x.c);
        keys.push(x.key);
        let w = this.where.get(x.key); if (!w) this.where.set(x.key, (w = []));
        w.push([mesh!, i, x.b]);
      });
      mesh.userData.keys = keys;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere(); mesh.computeBoundingBox();
    }
  }
  /** A block pops in (just placed). Call before the sync that adds it. */
  pop(key: string) { this.pops.set(key, 0); }

  /** The block under a ray (the nearest), with the side it was hit on, or null. It walks the ray square by
   *  square through the blocks' grid (so a block just popping in, or a thin piece, is hit all the same). */
  pick(ray: THREE.Raycaster): BlockHit | null {
    const { occ, map } = builtOf(this.str);
    if (!occ.size) return null;
    const o = ray.ray.origin, d = ray.ray.direction;
    let x = Math.floor(o.x / BLOCK), y = Math.floor(o.y / BLOCK), z = Math.floor(o.z / BLOCK);
    const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
    const dx = sx ? Math.abs(BLOCK / d.x) : Infinity, dy = sy ? Math.abs(BLOCK / d.y) : Infinity, dz = sz ? Math.abs(BLOCK / d.z) : Infinity;
    let tx = sx > 0 ? ((x + 1) * BLOCK - o.x) / d.x : sx < 0 ? (x * BLOCK - o.x) / d.x : Infinity;
    let ty = sy > 0 ? ((y + 1) * BLOCK - o.y) / d.y : sy < 0 ? (y * BLOCK - o.y) / d.y : Infinity;
    let tz = sz > 0 ? ((z + 1) * BLOCK - o.z) / d.z : sz < 0 ? (z * BLOCK - o.z) / d.z : Infinity;
    const n = new THREE.Vector3();
    for (let i = 0; i < 1200; i++) {
      let t: number;
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += dx; n.set(-sx, 0, 0); }
      else if (ty < tz) { y += sy; t = ty; ty += dy; n.set(0, -sy, 0); }
      else { z += sz; t = tz; tz += dz; n.set(0, 0, -sz); }
      if (t > 400 || (y < 0 && sy <= 0)) break;
      const k = occ.get(`${x},${y},${z}`);
      if (k) { const block = map.get(k)!; return { key: k, block, point: o.clone().addScaledVector(d, t), normal: n.clone() }; }
    }
    return null;
  }

  /** The see-through piece where the next one will go (null: none); red where it can't. */
  ghost(b: Block | null, ok = true) {
    if (!b) { if (this.ghostG) this.ghostG.visible = false; return; }
    if (!this.ghostG || this.ghostShape !== b.s) {
      this.ghostG?.removeFromParent();
      this.ghostG = new THREE.Group();
      for (const p of this.parts[b.s]) this.ghostG.add(new THREE.Mesh(p.geo, this.ghostMat));
      this.ghostG.renderOrder = 4;
      this.root.add(this.ghostG); this.ghostShape = b.s;
    }
    this.ghostG.visible = true;
    BlockKit.matrix(b, 1.02, this.ghostG.matrix); this.ghostG.matrixAutoUpdate = false; this.ghostG.matrixWorldNeedsUpdate = true;
    this.ghostMat.color.set(ok ? PAINTS[b.p]?.color ?? 0xffffff : 0xff8a8a);
    this.ghostMat.emissive.set(ok ? 0x5fe08a : 0xff4040);
  }
  /** A soft box round one block (the one a tool will paint, turn or take away), or none. */
  mark(b: Block | null, color = 0xffd34d) {
    this.outline.visible = !!b;
    if (!b) return;
    const tall = SHAPE[b.s].tall;
    this.outline.scale.set(1, tall, 1);
    this.outline.position.set((b.x + 0.5) * BLOCK, (b.y + tall / 2) * BLOCK, (b.z + 0.5) * BLOCK);
    (this.outline.material as THREE.MeshBasicMaterial).color.set(color);
  }
  /** Night (0 day .. 1 night): windows and glowing blocks light up. */
  setNight(k: number) {
    this.night = k;
    (this.mats.get('pane') as THREE.MeshStandardMaterial).emissiveIntensity = 0.12 + k * 1.7;
    (this.mats.get('glow') as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + k * 0.9;
    (this.mats.get('crystal') as THREE.MeshStandardMaterial).emissiveIntensity = 0.32 + k * 0.5;
  }
  update(t: number, dt: number) {
    for (const [key, k0] of this.pops) {
      const k = Math.min(1, k0 + dt / 0.35);
      this.pops.set(key, k);
      const s = Math.max(0.001, easeOutBack(k)), m4 = new THREE.Matrix4();
      for (const [mesh, i, b] of this.where.get(key) ?? []) { mesh.setMatrixAt(i, BlockKit.matrix(b, s, m4)); mesh.instanceMatrix.needsUpdate = true; }
      if (k >= 1) this.pops.delete(key);
    }
    if (this.ghostG?.visible) this.ghostMat.opacity = 0.45 + Math.sin(t * 5) * 0.12;
    if (this.outline.visible) (this.outline.material as THREE.MeshBasicMaterial).opacity = 0.28 + Math.sin(t * 5) * 0.1;
  }
  /** a picture of a piece in a paint, for the catalogue: a little group to draw */
  sample(s: ShapeId, p: number): THREE.Group {
    const g = new THREE.Group();
    for (const part of this.parts[s]) {
      const lk = this.look(part.role, p), m = (this.mats.get(lk.mat) as THREE.MeshStandardMaterial).clone();
      m.color.multiply(lk.color);
      // (the glow takes the paint's colour from each instance; a single piece takes it here)
      if (lk.mat === 'glow' || lk.mat === 'crystal') { m.emissive.copy(lk.color); m.onBeforeCompile = () => {}; m.customProgramCacheKey = () => `blk-sample-${lk.mat}`; }
      if (lk.mat === 'crystal') { m.opacity = 0.95; m.emissiveIntensity = 0.55; }
      this.keep(m); g.add(new THREE.Mesh(part.geo, m));
    }
    return g;
  }
  /** draws and triangles of the blocks (for checking they stay light) */
  stats() { let calls = 0, tris = 0; for (const m of this.meshes.values()) { calls++; tris += (m.geometry.attributes.position.count / 3) * m.count; } return { calls, tris }; }
  get nightK() { return this.night; }
  dispose() {
    for (const m of this.meshes.values()) m.dispose();
    for (const m of this.mats.values()) m.dispose();
    for (const x of this.own) x.dispose();
    this.root.removeFromParent();
  }
}
export type { PaintKind };
