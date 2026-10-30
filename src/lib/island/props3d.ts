// How everything on My Sky Island looks in 3D (catalog.ts lists them). The game's own models come first
// (the islands' trees, bushes, mushrooms, rocks, the little hill house, the treehouse tree, the balloon,
// the lighthouse, the signpost); the rest are modelled here in the same warm, glossy style: painted stone
// and roof tiles (paint.ts), the planks and posts the garden uses, flower cards from the garden's
// paintings, glowing lanterns. Each is built once, standing on the ground with its middle at the middle
// of its squares (one square is a metre), facing +z, and copied for every one placed. Things that move
// (a swing, a bird, the dais's sun, a lighthouse beam) bring a tick made for each copy.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { loadGltf, loadTexture } from '../three/assets';
import { ELEMENT, type Element } from '../adventure/glimmers';
import { ITEM } from './catalog';
import { glow, roofTiles, stones, stripes } from './paint';

export type Tick = (t: number, dt: number) => void;
type Keep = <T extends { dispose(): void }>(x: T) => T;

const MODELS = ['tree_puffy', 'tree_puffy2', 'tree_round', 'pine_tree', 'palm_tree', 'tree_umbrella', 'bush', 'mushroom', 'boulder', 'hobbit_hill', 'treehouse_tree', 'hot_air_balloon', 'lighthouse', 'signpost'] as const;
type ModelId = (typeof MODELS)[number];

/** A box with its texture tiled by size (metres per repeat), so stones and planks aren't stretched. */
export function tiledBox(w: number, h: number, d: number, per: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / per, uv.getY(i) * dims[f][1] / per); }
  return g;
}
/** A rounded flat stone (stepping stones, the tops of things). */
function pebble(r: number, h: number, seg = 14) {
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(r * 0.94, 0), new THREE.Vector2(r, h * 0.55), new THREE.Vector2(r * 0.82, h), new THREE.Vector2(0, h)];
  return new THREE.LatheGeometry(pts, seg);
}
const rnd = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

export class PropKit {
  private own: { dispose(): void }[] = [];
  readonly keep: Keep = (x) => { this.own.push(x); return x; };
  private protos = new Map<string, THREE.Object3D>();
  private models: Partial<Record<ModelId, GLTF | null>> = {};
  private tex: Record<string, THREE.Texture | null> = {};
  private mats = new Map<string, THREE.Material>();
  /** the water's clock (every pond shares it) */
  readonly water = { uT: { value: 0 } };
  /** makes the tick for a placed copy */
  private animators = new Map<string, (root: THREE.Object3D) => Tick>();

  static async load(): Promise<PropKit> {
    const k = new PropKit();
    const names = ['world/planks.webp', 'world/post.webp', 'world/rock.webp', 'world/dirt.webp', 'world/sand.webp', 'world/snow.webp', 'garden/heads.webp', 'garden/leaves-card.webp', 'world/flowers.webp', 'world/cloud.webp'];
    const [texs, models] = await Promise.all([
      Promise.all(names.map(n => loadTexture(n, { repeat: true }))),
      Promise.all(MODELS.map(m => loadGltf(`world/${m}.glb`))),
    ]);
    names.forEach((n, i) => (k.tex[n.split('/')[1].replace('.webp', '')] = texs[i]));
    MODELS.forEach((m, i) => (k.models[m] = models[i]));
    for (const t of ['heads', 'leaves-card', 'flowers']) if (k.tex[t]) k.tex[t]!.anisotropy = 4;
    // painted on a canvas: the cottage's stone and roof, the island's cliff stone, a tent's stripes, glows
    k.tex.stone = stones(k.keep, { seed: 17 });
    k.tex.greystone = stones(k.keep, { seed: 29, hue: 30, sat: 10, light: 74 });
    k.tex.roof = roofTiles(k.keep);
    k.tex.redroof = roofTiles(k.keep, 8, 60, 50);
    k.tex.stripes = stripes(k.keep);
    k.tex.glow = glow(k.keep);
    return k;
  }

  /** A copy of a thing, ready to place (null: not a thing). */
  make(id: string): THREE.Object3D | null {
    let p = this.protos.get(id);
    if (!p) {
      const built = this.build(id);
      if (!built) return null;
      this.bake(built);
      built.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.userData.noShadow !== true) { m.castShadow = true; m.receiveShadow = true; } });
      this.protos.set(id, (p = built));
    }
    const c = p.clone(true);
    c.userData.item = id;
    return c;
  }
  /** One mesh for each material: the parts modelled here (a cottage is dozens of little pieces) merged into
   *  as few draws as there are paints. Moving parts (named groups) and the game's models stay as they are. */
  private bake(root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert(), groups = new Map<THREE.Material, THREE.BufferGeometry[]>(), done: THREE.Mesh[] = [];
    root.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.userData.own || m.userData.noShadow || Array.isArray(m.material)) return;
      for (let q = m.parent; q && q !== root; q = q.parent) if (q.name) return;
      const g = m.geometry.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld));
      const flat = g.index ? g.toNonIndexed() : g; if (flat !== g) g.dispose();
      for (const k of Object.keys(flat.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') flat.deleteAttribute(k);
      if (!flat.attributes.normal || !flat.attributes.uv) { flat.dispose(); return; }
      let list = groups.get(m.material); if (!list) groups.set(m.material, (list = []));
      list.push(flat); done.push(m);
    });
    for (const m of done) m.removeFromParent();
    for (const [mat, list] of groups) {
      const merged = mergeGeometries(list); list.forEach(g => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(this.keep(merged), mat); root.add(mesh);
    }
  }
  /** The moving parts of a placed copy, or null. */
  tickFor(root: THREE.Object3D): Tick | null { const a = this.animators.get(root.userData.item); return a ? a(root) : null; }

  dispose() {
    for (const x of this.own) x.dispose();
    for (const m of this.mats.values()) m.dispose();
    this.own = []; this.mats.clear(); this.protos.clear();
  }

  // ---------- materials ----------
  private mat(key: string, make: () => THREE.Material): THREE.Material {
    let m = this.mats.get(key);
    if (!m) this.mats.set(key, (m = make()));
    return m;
  }
  private std(key: string, o: THREE.MeshStandardMaterialParameters) { return this.mat(key, () => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o })) as THREE.MeshStandardMaterial; }
  /** a texture turned a quarter (planks standing up) */
  private turned(name: string) {
    const key = `${name}@90`;
    if (!this.tex[key] && this.tex[name]) { const t = this.keep(this.tex[name]!.clone()); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; t.needsUpdate = true; this.tex[key] = t; }
    return this.tex[key] ?? null;
  }
  private get planks() { return this.std('planks', { map: this.tex.planks, color: 0xffe6cc, roughness: 0.75 }); }
  private get planksUp() { return this.std('planksUp', { map: this.turned('planks'), color: 0xf0c49a, roughness: 0.75 }); }
  private get post() { return this.std('post', { map: this.tex.post, color: 0xf2dcc0, roughness: 0.85 }); }
  private get darkWood() { return this.std('darkWood', { map: this.tex.post, color: 0x8a5a3a, roughness: 0.8 }); }
  private get stone() { return this.std('stone', { map: this.tex.stone, roughness: 0.92 }); }
  private get greyStone() { return this.std('greyStone', { map: this.tex.greystone, roughness: 0.95 }); }
  private get gold() { return this.std('gold', { color: 0xf5c542, metalness: 0.65, roughness: 0.28, emissive: 0x5a3a00, emissiveIntensity: 0.4 }); }
  private get iron() { return this.std('iron', { color: 0x3d3330, metalness: 0.4, roughness: 0.5 }); }
  private get lampGlass() { return this.std('lampGlass', { color: 0xffe2a0, emissive: 0xffb43a, emissiveIntensity: 1.6, roughness: 0.3 }); }
  private get windowGlass() { return this.std('windowGlass', { color: 0xffe6a8, emissive: 0xffb84a, emissiveIntensity: 1.25, roughness: 0.25 }); }
  private get leafGreen() { return this.std('leafGreen', { color: 0x4fb04f, roughness: 0.7 }); }
  private get rope() { return this.std('rope', { color: 0xd2ad72, roughness: 0.9 }); }
  private glowMat(color: number | string, opacity = 0.75) {
    return this.mat(`glow-${color}-${opacity}`, () => new THREE.SpriteMaterial({ map: this.tex.glow, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  }
  private glowSprite(color: number | string, size: number, x = 0, y = 0, z = 0, opacity = 0.75) {
    const s = new THREE.Sprite(this.glowMat(color, opacity) as THREE.SpriteMaterial);
    s.scale.setScalar(size); s.position.set(x, y, z); s.renderOrder = 2;
    return s;
  }
  /** pond water: deep in the middle, light at the edge, ripples and a pale rim, on the island's clock */
  waterMat(deep: number, shallow: number) {
    return this.mat(`water-${deep}-${shallow}`, () => new THREE.ShaderMaterial({
      uniforms: { uT: this.water.uT, uDeep: { value: new THREE.Color(deep) }, uShallow: { value: new THREE.Color(shallow) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uT; uniform vec3 uDeep, uShallow; varying vec2 vUv;
        void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p);
          vec3 c = mix(uDeep, uShallow, smoothstep(0.1, 1.0, r));
          float w = sin(p.x * 9.0 + uT * 1.3) * sin(p.y * 8.0 - uT * 1.1) + 0.6 * sin((p.x + p.y) * 14.0 + uT * 1.9);
          c += smoothstep(0.75, 1.5, w) * 0.16;
          c += smoothstep(0.55, 0.0, length(p - vec2(-0.35, 0.35))) * 0.10;
          c = mix(c, vec3(1.0), smoothstep(0.84, 0.99, r) * 0.45);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
  }
  private mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(this.keep(g), m); o.position.set(x, y, z); o.userData.own = true; return o; }

  // ---------- the game's models ----------
  /** A copy of one of the islands' models: `h` tall (or narrower than `maxW`), standing on the ground, centred. */
  private model(id: ModelId, h: number, maxW = Infinity): THREE.Object3D {
    const g = this.models[id];
    const wrap = new THREE.Group();
    if (!g) { wrap.add(this.mesh(new THREE.SphereGeometry(h * 0.3, 12, 8), this.leafGreen, 0, h * 0.3, 0)); return wrap; }
    const o = g.scene.clone(true);
    const box = new THREE.Box3().setFromObject(o), size = box.getSize(new THREE.Vector3());
    const k = Math.min(h / Math.max(1e-6, size.y), maxW / Math.max(1e-6, Math.max(size.x, size.z)));
    o.scale.setScalar(k);
    o.position.set(-(box.min.x + size.x / 2) * k, -box.min.y * k, -(box.min.z + size.z / 2) * k);
    wrap.add(o);
    return wrap;
  }

  // ---------- flowers ----------
  /** flower faces (the garden's painted heads, 3 by 2) on little stems, tilted up, with leaves at the foot */
  private flowerCluster(n: number, spread: number, seed: number, hMin = 0.18, hMax = 0.42, size = 0.2): THREE.Group {
    const r = rnd(seed), g = new THREE.Group();
    const heads: THREE.BufferGeometry[] = [], stems: THREE.BufferGeometry[] = [], leaves: THREE.BufferGeometry[] = [];
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * spread, z = (r() - 0.5) * spread, h = hMin + r() * (hMax - hMin), cell = Math.floor(r() * 6), s = size * (0.8 + r() * 0.45);
      const hg = new THREE.PlaneGeometry(s, s), uv = hg.attributes.uv as THREE.BufferAttribute, cx = cell % 3, cy = Math.floor(cell / 3);
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (cx + uv.getX(k)) / 3, 1 - (cy + 1 - uv.getY(k)) / 2);
      hg.rotateX(-0.9 - r() * 0.3); hg.rotateY((r() - 0.5) * 0.8); hg.translate(x, h, z); heads.push(hg);
      stems.push(new THREE.CylinderGeometry(0.008, 0.012, h, 4).translate(x, h / 2, z));
      if (i % 2 === 0) { const lg = new THREE.PlaneGeometry(0.22, 0.18).translate(0, 0.09, 0); lg.rotateY(r() * Math.PI); lg.translate(x, 0, z); leaves.push(lg); }
    }
    const headMat = this.std('flowerHead', { map: this.tex.heads, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.55 });
    const leafMat = this.std('leafCard', { map: this.tex['leaves-card'], alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.6 });
    g.add(this.mesh(mergeGeometries(heads)!, headMat), this.mesh(mergeGeometries(stems)!, this.leafGreen));
    if (leaves.length) g.add(this.mesh(mergeGeometries(leaves)!, leafMat));
    for (const x of [...heads, ...stems, ...leaves]) x.dispose();
    return g;
  }
  /** meadow flowers standing up (the islands' painted flowers, 3 by 2), as crossed cards */
  private wildflowers(n: number, spread: number, seed: number, h = 0.36): THREE.Group {
    const r = rnd(seed), parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < n; i++) {
      const cell = Math.floor(r() * 6), cx = cell % 3, cy = Math.floor(cell / 3), hh = h * (0.75 + r() * 0.5), x = (r() - 0.5) * spread, z = (r() - 0.5) * spread;
      for (const a of [Math.PI / 4, -Math.PI / 4]) {
        const p = new THREE.PlaneGeometry(hh * 0.66, hh), uv = p.attributes.uv as THREE.BufferAttribute;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, (cx + uv.getX(k)) / 3, 1 - (cy + 1 - uv.getY(k)) / 2);
        p.translate(0, hh / 2, 0); p.rotateY(a + r()); p.translate(x, 0, z); parts.push(p);
      }
    }
    const g = new THREE.Group();
    g.add(this.mesh(mergeGeometries(parts)!, this.std('wildflower', { map: this.tex.flowers, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 })));
    parts.forEach(p => p.dispose());
    return g;
  }

  // ---------- each thing ----------
  private build(id: string): THREE.Object3D | null {
    const it = ITEM[id];
    if (!it) return null;
    const g = new THREE.Group();
    switch (id) {
      case 'cottage': this.cottage(g); break;
      case 'burrow': g.add(this.model('hobbit_hill', 2.0, 2.9)); g.add(this.flowerCluster(10, 0.5, 4).translateX(1.1).translateZ(1.05)); break;
      case 'mushhouse': this.mushHouse(g); break;
      case 'tent': this.tent(g); break;
      case 'oak': g.add(this.model('tree_puffy', 3.4)); break;
      case 'puffy': g.add(this.model('tree_puffy2', 3.6)); break;
      case 'roundtree': g.add(this.model('tree_round', 2.4)); break;
      case 'pine': g.add(this.model('pine_tree', 2.7)); break;
      case 'palm': g.add(this.model('palm_tree', 2.8)); break;
      case 'umbrella': g.add(this.model('tree_umbrella', 2.7)); break;
      case 'bush': g.add(this.model('bush', 0.62, 1.05)); g.add(this.flowerCluster(3, 0.6, 9, 0.35, 0.5, 0.16)); break;
      case 'flowers': g.add(this.flowerCluster(9, 0.72, 11), this.wildflowers(5, 0.75, 12, 0.34)); break;
      case 'flowerbed': this.flowerBed(g); break;
      case 'mushrooms': this.mushroomRing(g); break;
      case 'boulder': g.add(this.model('boulder', 0.7, 0.95)); { const b = this.model('boulder', 0.28); b.position.set(0.36, 0, 0.32); b.rotation.y = 2; g.add(b); } g.add(this.wildflowers(3, 0.5, 21, 0.28).translateX(-0.3).translateZ(0.3)); break;
      case 'pond': this.pond(g); break;
      case 'fountain': this.fountain(g); break;
      case 'well': this.well(g); break;
      case 'stones': this.steppingStones(g); break;
      case 'deck': g.add(this.mesh(tiledBox(0.98, 0.08, 0.98, 1), this.planks, 0, 0.04, 0)); break;
      case 'fence': this.ropeFence(g); break;
      case 'picket': this.picket(g); break;
      case 'lamp': this.lamp(g); break;
      case 'bench': this.bench(g); break;
      case 'birdhouse': this.birdhouse(g); break;
      case 'swing': this.swing(g); break;
      case 'signpost': g.add(this.model('signpost', 1.5, 0.95)); break;
      case 'scarecrow': this.scarecrow(g); break;
      case 'lookout': this.lookout(g); break;
      case 'sundais': this.sunDais(g); break;
      case 'icepool': this.icePool(g); break;
      case 'tidepond': this.tidePond(g); break;
      case 'stonecave': this.stoneCave(g); break;
      case 'leafgrove': this.leafGrove(g); break;
      case 'balloon': this.balloon(g); break;
      case 'lighthouse': this.lighthouse(g); break;
      case 'treehouse': g.add(this.model('treehouse_tree', 5.6)); break;
      case 'rainbow': this.rainbow(g); break;
      default:
        if (it.gift) this.crystal(g, id.replace('gem-', '') as Element);
        else return null;
    }
    return g;
  }

  /** The cosy cottage: stone walls on a plinth, a slate-blue roof with its gable to the front, a round
   *  window glowing in the gable, an arched door between two lanterns, side windows with flower boxes, a
   *  chimney, a barrel and flowers climbing the corner. */
  private cottage(g: THREE.Group) {
    const W = 2.0, D = 2.1, H = 1.45, P = 0.14, RISE = 1.12, Z = -0.18;
    const h = new THREE.Group(); h.position.z = Z; g.add(h);
    h.add(this.mesh(tiledBox(W + 0.24, P, D + 0.24, 1.6), this.greyStone, 0, P / 2, 0));
    h.add(this.mesh(tiledBox(W, H, D, 1.7), this.stone, 0, P + H / 2, 0));
    // the gables: stone triangles front and back
    const tri = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, RISE)]);
    for (const s of [1, -1]) {
      const gg = new THREE.ExtrudeGeometry(tri, { depth: 0.08, bevelEnabled: false });
      const uv = gg.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.7, uv.getY(i) / 1.7);
      const m = this.mesh(gg, this.stone, 0, P + H, s > 0 ? D / 2 - 0.08 : -D / 2); h.add(m);
    }
    // timber under the eaves
    for (const s of [-1, 1]) h.add(this.mesh(tiledBox(0.1, 0.1, D + 0.1, 1), this.darkWood, s * (W / 2 - 0.02), P + H - 0.02, 0));
    // the roof: two slopes of slate tiles, a little overhang all round, a ridge along the top
    const half = W / 2 + 0.28, slope = Math.hypot(half, RISE + 0.08), a = Math.atan2(RISE + 0.08, half);
    const roofMat = this.std('roofSlate', { map: this.turned('roof'), roughness: 0.55 });
    const edgeMat = this.std('roofEdge', { color: 0x2c3e6e, roughness: 0.6 });
    for (const s of [-1, 1]) {
      const side = new THREE.Group();
      side.position.set(-s * half / 2 + s * 0.01, P + H + (RISE + 0.08) / 2 - 0.02, 0);
      side.rotation.z = s * a;
      const slab = this.mesh(tiledBox(slope + 0.06, 0.12, D + 0.5, 1.3), roofMat); side.add(slab);
      side.add(this.mesh(new THREE.BoxGeometry(slope + 0.08, 0.13, 0.06), edgeMat, 0, 0, (D + 0.5) / 2));
      side.add(this.mesh(new THREE.BoxGeometry(slope + 0.08, 0.13, 0.06), edgeMat, 0, 0, -(D + 0.5) / 2));
      h.add(side);
    }
    h.add(this.mesh(new THREE.CylinderGeometry(0.085, 0.085, D + 0.56, 10).rotateX(Math.PI / 2), edgeMat, 0, P + H + RISE + 0.1, 0));
    // the chimney, poking up through the left slope
    h.add(this.mesh(tiledBox(0.38, 1.0, 0.38, 1.2), this.greyStone, -0.55, P + H + 0.9, -0.5));
    h.add(this.mesh(tiledBox(0.48, 0.1, 0.48, 1), this.greyStone, -0.55, P + H + 1.43, -0.5));
    // the round window in the gable
    const front = D / 2 + 0.01;
    h.add(this.mesh(new THREE.CircleGeometry(0.17, 24), this.windowGlass, 0, P + H + 0.42, front + 0.005));
    h.add(this.mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 28), this.darkWood, 0, P + H + 0.42, front + 0.02));
    h.add(this.mesh(new THREE.BoxGeometry(0.34, 0.025, 0.02), this.darkWood, 0, P + H + 0.42, front + 0.02), this.mesh(new THREE.BoxGeometry(0.025, 0.34, 0.02), this.darkWood, 0, P + H + 0.42, front + 0.02));
    // the door: arched planks in a dark frame, a golden knob, a step
    const dw = 0.64, dh = 1.08;
    const arch = new THREE.Shape(); arch.moveTo(-dw / 2, 0); arch.lineTo(dw / 2, 0); arch.lineTo(dw / 2, dh - dw / 2); arch.absarc(0, dh - dw / 2, dw / 2, 0, Math.PI, false); arch.closePath();
    const dg = new THREE.ExtrudeGeometry(arch, { depth: 0.05, bevelEnabled: false });
    const duv = dg.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < duv.count; i++) duv.setXY(i, duv.getX(i) / 0.9, duv.getY(i) / 0.9);
    h.add(this.mesh(dg, this.std('door', { map: this.turned('planks'), color: 0xc98a52, roughness: 0.7 }), 0, P, front));
    const frame = new THREE.Shape(); frame.moveTo(-dw / 2 - 0.08, 0); frame.lineTo(dw / 2 + 0.08, 0); frame.lineTo(dw / 2 + 0.08, dh - dw / 2); frame.absarc(0, dh - dw / 2, dw / 2 + 0.08, 0, Math.PI, false); frame.closePath();
    frame.holes.push(arch);
    h.add(this.mesh(new THREE.ExtrudeGeometry(frame, { depth: 0.07, bevelEnabled: false }), this.greyStone, 0, P, front));
    h.add(this.mesh(new THREE.SphereGeometry(0.035, 10, 8), this.gold, 0.2, P + 0.52, front + 0.07));
    for (const y of [0.25, 0.75]) h.add(this.mesh(new THREE.BoxGeometry(0.22, 0.035, 0.02), this.iron, -0.17, P + y, front + 0.06));
    h.add(this.mesh(tiledBox(0.95, 0.1, 0.36, 1), this.greyStone, 0, 0.05, front + 0.26));
    // lanterns either side of the door
    for (const s of [-1, 1]) {
      const x = s * 0.62, y = P + 1.02;
      h.add(this.mesh(new THREE.BoxGeometry(0.03, 0.03, 0.14), this.iron, x, y + 0.2, front + 0.07));
      h.add(this.mesh(new THREE.BoxGeometry(0.13, 0.17, 0.13), this.lampGlass, x, y + 0.06, front + 0.14));
      h.add(this.mesh(new THREE.ConeGeometry(0.11, 0.08, 4).rotateY(Math.PI / 4), this.iron, x, y + 0.18, front + 0.14));
      h.add(this.glowSprite(0xffc46b, 0.75, x, y + 0.06, front + 0.2, 0.7));
    }
    // windows on the sides, with flower boxes under them
    for (const s of [-1, 1]) {
      const x = s * (W / 2 + 0.01), wz = 0.15;
      const win = new THREE.Group(); win.position.set(x, P + 0.82, wz); win.rotation.y = s * Math.PI / 2; h.add(win);
      win.add(this.mesh(new THREE.PlaneGeometry(0.46, 0.5), this.windowGlass, 0, 0, 0.005));
      for (const [w, hh, xx, yy] of [[0.56, 0.06, 0, 0.28], [0.56, 0.06, 0, -0.28], [0.06, 0.6, -0.26, 0], [0.06, 0.6, 0.26, 0], [0.03, 0.5, 0, 0], [0.46, 0.03, 0, 0]]) win.add(this.mesh(new THREE.BoxGeometry(w, hh, 0.05), this.darkWood, xx, yy, 0.02));
      win.add(this.mesh(tiledBox(0.6, 0.14, 0.18, 0.8), this.planks, 0, -0.38, 0.09));
      const fl = this.flowerCluster(6, 0.45, 30 + s, 0.08, 0.16, 0.15); fl.position.set(0, -0.31, 0.09); fl.scale.set(1, 1, 0.3); win.add(fl);
    }
    // a barrel by the door, flowers climbing the right-hand corner and along the front
    const barrel = this.mesh(new THREE.LatheGeometry([0.17, 0.2, 0.21, 0.2, 0.17].map((r, i) => new THREE.Vector2(r, i * 0.11)), 14), this.std('barrel', { map: this.turned('planks'), color: 0xd49a62 }), 0.86, 0, front + 0.28);
    h.add(barrel);
    for (const y of [0.08, 0.36]) h.add(this.mesh(new THREE.TorusGeometry(0.205, 0.012, 6, 18).rotateX(Math.PI / 2), this.iron, 0.86, y, front + 0.28));
    const climb = this.flowerCluster(14, 0.25, 41, 0.3, 1.5, 0.16); climb.position.set(W / 2 + 0.02, P, front - 0.02); h.add(climb);
    const climb2 = this.flowerCluster(10, 0.3, 43, 0.2, 0.9, 0.15); climb2.position.set(-W / 2 - 0.02, P, front - 0.05); h.add(climb2);
    for (const x of [-0.75, 0.55]) { const f = this.flowerCluster(7, 0.35, 50 + x * 10, 0.12, 0.3, 0.17); f.position.set(x, 0, front + 0.28); h.add(f); }
  }

  private mushHouse(g: THREE.Group) {
    const cream = this.std('mushStem', { color: 0xf6ead2, roughness: 0.6 });
    g.add(this.mesh(new THREE.LatheGeometry([0.6, 0.66, 0.66, 0.6, 0.52, 0.5].map((r, i) => new THREE.Vector2(r, i * 0.24)), 24), cream));
    const capPts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; capPts.push(new THREE.Vector2(Math.cos(a) * 0.98 + 0.001, Math.sin(a) * 0.7)); }
    capPts.reverse();
    const cap = this.mesh(new THREE.LatheGeometry([new THREE.Vector2(0.001, 0.7), ...capPts.slice(1), new THREE.Vector2(0.98, -0.05), new THREE.Vector2(0.5, -0.02)], 28), this.std('mushCap', { color: 0xe2483c, roughness: 0.45 }), 0, 1.18, 0);
    g.add(cap);
    const spot = this.std('mushSpot', { color: 0xfff6ea, roughness: 0.5 });
    const r = rnd(7);
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2, e = 0.25 + r() * 0.95, nx = Math.cos(a) * Math.cos(e), ny = Math.sin(e), nz = Math.sin(a) * Math.cos(e);
      const s = this.mesh(new THREE.SphereGeometry(0.11 + r() * 0.06, 10, 6), spot, nx * 0.97, 1.18 + ny * 0.69, nz * 0.97);
      s.scale.set(1, 0.35, 1); s.lookAt(nx * 3, 1.18 + ny * 3, nz * 3); s.rotateX(Math.PI / 2); g.add(s);
    }
    const dw = 0.36, dh = 0.62, arch = new THREE.Shape(); arch.moveTo(-dw / 2, 0); arch.lineTo(dw / 2, 0); arch.lineTo(dw / 2, dh - dw / 2); arch.absarc(0, dh - dw / 2, dw / 2, 0, Math.PI, false); arch.closePath();
    const dg = new THREE.ExtrudeGeometry(arch, { depth: 0.05, bevelEnabled: false }); const duv = dg.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < duv.count; i++) duv.setXY(i, duv.getX(i) / 0.7, duv.getY(i) / 0.7);
    g.add(this.mesh(dg, this.std('door', { map: this.turned('planks'), color: 0xc98a52, roughness: 0.7 }), 0, 0, 0.61));
    g.add(this.mesh(new THREE.SphereGeometry(0.025, 8, 6), this.gold, 0.11, 0.3, 0.68));
    for (const s of [-1, 1]) {
      const a = s * 0.9, x = Math.sin(a) * 0.655, z = Math.cos(a) * 0.655;
      const w = this.mesh(new THREE.CircleGeometry(0.11, 18), this.windowGlass, x, 0.72, z); w.rotation.y = a; g.add(w);
      const f = this.mesh(new THREE.TorusGeometry(0.115, 0.025, 6, 18), this.darkWood, x * 1.01, 0.72, z * 1.01); f.rotation.y = a; g.add(f);
    }
    g.add(this.glowSprite(0xffc46b, 0.6, 0, 0.75, 0.75, 0.35));
    g.add(this.flowerCluster(8, 0.6, 61, 0.1, 0.25).translateX(-0.55).translateZ(0.55));
  }

  private tent(g: THREE.Group) {
    const cloth = this.std('tent', { map: this.tex.stripes, roughness: 0.7, side: THREE.DoubleSide });
    const cone = this.mesh(new THREE.ConeGeometry(0.92, 1.55, 8, 1, true), cloth, 0, 0.775, 0); cone.rotation.y = Math.PI / 8; g.add(cone);
    // the door flap, open
    const dark = this.std('tentIn', { color: 0x3a2a55, roughness: 1 });
    const door = new THREE.Shape([new THREE.Vector2(-0.32, 0), new THREE.Vector2(0.32, 0), new THREE.Vector2(0, 0.95)]);
    g.add(this.mesh(new THREE.ShapeGeometry(door), dark, 0, 0.01, 0.86));
    for (const s of [-1, 1]) { const f = this.mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(s * 0.36, 0), new THREE.Vector2(0, 0.9)])), cloth, s * 0.3, 0.02, 0.86); f.rotation.y = s * 0.5; g.add(f); }
    g.add(this.mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), this.darkWood, 0, 1.75, 0));
    g.add(this.mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.3, 0.08), new THREE.Vector2(0, 0.16)])), this.std('flag', { color: 0xffc93d, side: THREE.DoubleSide }), 0.01, 1.82, 0));
    g.add(this.mesh(new THREE.CircleGeometry(1.0, 24).rotateX(-Math.PI / 2), this.std('rug', { color: 0xe7c9a0, roughness: 1 }), 0, 0.012, 0));
    g.add(this.glowSprite(0xffd27a, 0.7, 0, 0.35, 0.75, 0.4));
  }

  private flowerBed(g: THREE.Group) {
    g.add(this.mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.1, 18), this.std('soil', { map: this.tex.dirt, color: 0x9a7350, roughness: 1 }), 0, 0.05, 0));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, b = this.model('boulder', 0.13); b.position.set(Math.cos(a) * 0.43, -0.01, Math.sin(a) * 0.43); b.rotation.y = i * 1.3; g.add(b); }
    g.add(this.flowerCluster(12, 0.55, 71, 0.18, 0.4, 0.2).translateY(0.08), this.wildflowers(4, 0.5, 72, 0.32).translateY(0.08));
  }
  private mushroomRing(g: THREE.Group) {
    const r = rnd(81);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, m = this.model('mushroom', 0.18 + r() * 0.22); m.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3); m.rotation.y = r() * 6; g.add(m); }
    const big = this.model('mushroom', 0.5); g.add(big);
  }
  private pond(g: THREE.Group) {
    const R = 0.8;
    g.add(this.mesh(new THREE.CircleGeometry(R, 40).rotateX(-Math.PI / 2), this.waterMat(0x1f7fc4, 0x7fd8ee), 0, 0.03, 0));
    g.add(this.mesh(new THREE.RingGeometry(R - 0.02, R + 0.14, 40).rotateX(-Math.PI / 2), this.std('pondEdge', { map: this.tex.dirt, color: 0xd9c6a2, roughness: 1 }), 0, 0.02, 0));
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + 0.2, b = this.model('boulder', 0.16 + ((i * 7) % 5) * 0.025); b.position.set(Math.cos(a) * (R + 0.08), -0.02, Math.sin(a) * (R + 0.08)); b.rotation.y = i * 1.7; g.add(b); }
    const pad = this.std('lilyPad', { color: 0x4fae4a, roughness: 0.5, side: THREE.DoubleSide });
    for (const [x, z, s] of [[-0.3, 0.2, 1], [0.25, -0.25, 0.8], [0.35, 0.3, 0.7]]) { const m = this.mesh(new THREE.CircleGeometry(0.16 * s, 16, 0.3, Math.PI * 2 - 0.6).rotateX(-Math.PI / 2), pad, x, 0.045, z); m.rotation.y = x * 7; g.add(m); }
    const lotus = this.flowerCluster(1, 0, 3, 0.07, 0.07, 0.24); lotus.position.set(-0.3, 0.0, 0.2); g.add(lotus);
    g.add(this.wildflowers(4, 0.4, 95, 0.4).translateX(0.75).translateZ(-0.55));
    // reeds at the back
    const reed = this.std('reed', { color: 0x6aa84f }), tip = this.std('cattail', { color: 0x7a4a2a });
    for (let i = 0; i < 5; i++) { const x = -0.6 + i * 0.09, z = -0.55 - (i % 2) * 0.08, h = 0.5 + (i % 3) * 0.12; g.add(this.mesh(new THREE.CylinderGeometry(0.01, 0.014, h, 4), reed, x, h / 2, z)); if (i % 2 === 0) g.add(this.mesh(new THREE.CapsuleGeometry(0.025, 0.09, 3, 6), tip, x, h - 0.02, z)); }
  }
  private fountain(g: THREE.Group) {
    const st = this.stone;
    g.add(this.mesh(new THREE.LatheGeometry([[0.001, 0], [0.92, 0], [0.95, 0.12], [0.95, 0.36], [0.86, 0.4], [0.82, 0.32], [0.82, 0.12], [0.001, 0.12]].map(([x, y]) => new THREE.Vector2(x, y)), 36), st));
    g.add(this.mesh(new THREE.CircleGeometry(0.82, 36).rotateX(-Math.PI / 2), this.waterMat(0x2a8fd0, 0x9fe4f4), 0, 0.3, 0));
    g.add(this.mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.85, 12), st, 0, 0.6, 0));
    g.add(this.mesh(new THREE.LatheGeometry([[0.001, 0], [0.12, 0], [0.38, 0.1], [0.42, 0.18], [0.36, 0.17], [0.001, 0.12]].map(([x, y]) => new THREE.Vector2(x, y)), 24), st, 0, 0.98, 0));
    g.add(this.mesh(new THREE.CircleGeometry(0.36, 24).rotateX(-Math.PI / 2), this.waterMat(0x2a8fd0, 0x9fe4f4), 0, 1.13, 0));
    g.add(this.mesh(new THREE.SphereGeometry(0.08, 12, 8), this.gold, 0, 1.22, 0));
    // the water falling over the top bowl into the basin
    const fallMat = this.mat('fountainFall', () => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: this.water.uT },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uT; varying vec2 vUv;
        float n(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        float sn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(n(i), n(i+vec2(1,0)), f.x), mix(n(i+vec2(0,1)), n(i+vec2(1,1)), f.x), f.y); }
        void main(){ float s = sn(vec2(vUv.x * 40.0, vUv.y * 4.0 + uT * 3.0)); vec3 c = mix(vec3(0.62, 0.86, 0.97), vec3(1.0), s);
          gl_FragColor = vec4(c, 0.45 + 0.35 * s);
          #include <colorspace_fragment>
        }`,
    }));
    const fall = this.mesh(new THREE.CylinderGeometry(0.42, 0.62, 0.8, 24, 1, true), fallMat, 0, 0.72, 0); fall.userData.noShadow = true; g.add(fall);
    const jet = this.mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.4, 8, 1, true), fallMat, 0, 1.4, 0); jet.userData.noShadow = true; g.add(jet);
    fall.castShadow = jet.castShadow = false;
  }
  private well(g: THREE.Group) {
    const W = new THREE.Group(); W.scale.setScalar(0.92); g.add(W);
    W.add(this.mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.7, 22, 1, true).translate(0, 0.35, 0), this.std('wellStone', { map: this.tex.stone, side: THREE.DoubleSide, roughness: 0.9 })));
    W.add(this.mesh(new THREE.TorusGeometry(0.64, 0.08, 8, 26).rotateX(Math.PI / 2), this.greyStone, 0, 0.71, 0));
    W.add(this.mesh(new THREE.CircleGeometry(0.6, 24).rotateX(-Math.PI / 2), this.std('wellWater', { color: 0x1c4e6e, roughness: 0.15, emissive: 0x0a2a40 }), 0, 0.42, 0));
    for (const x of [-0.74, 0.74]) W.add(this.mesh(tiledBox(0.1, 1.7, 0.1, 1), this.post, x, 0.85, 0));
    for (const s of [-1, 1]) { const r = this.mesh(tiledBox(1.85, 0.06, 0.72, 1), this.std('wellRoof', { map: this.tex.redroof, roughness: 0.6 }), 0, 1.78, s * 0.26); r.rotation.x = s * 0.62; W.add(r); }
    W.add(this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.55, 10).rotateZ(Math.PI / 2), this.post, 0, 1.25, 0));
    W.add(this.mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 4), this.rope, 0, 1.06, 0));
    W.add(this.mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.18, 12), this.std('bucket', { map: this.turned('planks'), color: 0xb98a5a }), 0, 0.84, 0));
    W.add(this.flowerCluster(6, 0.4, 101, 0.1, 0.25).translateX(0.7).translateZ(0.5));
  }
  private steppingStones(g: THREE.Group) {
    const m = this.std('stepStone', { map: this.tex.greystone, color: 0xf4efe8, roughness: 0.85 });
    for (const [x, z, r] of [[-0.18, 0.2, 0.3], [0.22, -0.2, 0.26]] as [number, number, number][]) { const s = this.mesh(pebble(r, 0.07), m, x, 0, z); s.scale.set(1, 1, 0.85); g.add(s); }
  }
  private ropeFence(g: THREE.Group) {
    for (const x of [-0.5, 0.5]) {
      g.add(this.mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.72, 8), this.post, x, 0.36, 0));
      g.add(this.mesh(new THREE.SphereGeometry(0.065, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), this.post, x, 0.72, 0));
    }
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.5, 0.62, 0.05), new THREE.Vector3(0, 0.44, 0.05), new THREE.Vector3(0.5, 0.62, 0.05));
    g.add(this.mesh(new THREE.TubeGeometry(curve, 12, 0.026, 6), this.rope));
  }
  private picket(g: THREE.Group) {
    const white = this.std('picket', { color: 0xfaf5ea, roughness: 0.55 });
    for (let i = 0; i < 5; i++) { const x = -0.4 + i * 0.2; g.add(this.mesh(new THREE.BoxGeometry(0.1, 0.55, 0.03), white, x, 0.275, 0)); g.add(this.mesh(new THREE.BoxGeometry(0.07, 0.07, 0.03).rotateZ(Math.PI / 4), white, x, 0.55, 0)); }
    for (const y of [0.18, 0.42]) g.add(this.mesh(new THREE.BoxGeometry(1.0, 0.06, 0.03), white, 0, y, -0.03));
  }
  private lamp(g: THREE.Group) {
    g.add(this.mesh(pebble(0.2, 0.12), this.greyStone));
    g.add(this.mesh(tiledBox(0.12, 1.75, 0.12, 1.2), this.post, 0, 0.88, 0));
    g.add(this.mesh(tiledBox(0.48, 0.07, 0.07, 1), this.post, 0.2, 1.68, 0));
    g.add(this.mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), this.iron, 0.38, 1.6, 0));
    g.add(this.mesh(new THREE.BoxGeometry(0.17, 0.24, 0.17), this.lampGlass, 0.38, 1.4, 0));
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(this.mesh(new THREE.BoxGeometry(0.025, 0.26, 0.025), this.iron, 0.38 + dx * 0.09, 1.4, dz * 0.09));
    g.add(this.mesh(new THREE.ConeGeometry(0.15, 0.12, 4).rotateY(Math.PI / 4), this.iron, 0.38, 1.58, 0));
    g.add(this.mesh(new THREE.BoxGeometry(0.2, 0.03, 0.2), this.iron, 0.38, 1.27, 0));
    g.add(this.glowSprite(0xffc46b, 1.1, 0.38, 1.4, 0, 0.8));
    g.add(this.flowerCluster(4, 0.3, 111, 0.1, 0.22).translateX(-0.2).translateZ(0.2));
  }
  private bench(g: THREE.Group) {
    const w = this.planks;
    for (const z of [-0.1, 0.03, 0.16]) g.add(this.mesh(tiledBox(1.7, 0.05, 0.11, 1), w, 0, 0.44, z));
    for (const y of [0.66, 0.82]) { const s = this.mesh(tiledBox(1.7, 0.1, 0.04, 1), w, 0, y, -0.24); s.rotation.x = -0.15; g.add(s); }
    for (const x of [-0.75, 0.75]) {
      g.add(this.mesh(tiledBox(0.08, 0.44, 0.08, 1), this.darkWood, x, 0.22, 0.12), this.mesh(tiledBox(0.08, 0.92, 0.08, 1), this.darkWood, x, 0.46, -0.22));
      g.add(this.mesh(tiledBox(0.08, 0.06, 0.46, 1), this.darkWood, x, 0.6, -0.04));
    }
  }
  private birdhouse(g: THREE.Group) {
    g.add(this.mesh(tiledBox(0.09, 1.25, 0.09, 1), this.post, 0, 0.62, 0));
    const house = new THREE.Group(); house.position.y = 1.25; g.add(house);
    house.add(this.mesh(tiledBox(0.34, 0.3, 0.3, 0.8), this.std('birdHouse', { map: this.tex.planks, color: 0xfff3d9 }), 0, 0.15, 0));
    for (const s of [-1, 1]) { const r = this.mesh(tiledBox(0.3, 0.035, 0.42, 0.8), this.std('birdRoof', { map: this.tex.redroof, roughness: 0.6 }), s * 0.12, 0.38, 0); r.rotation.z = -s * 0.75; house.add(r); }
    house.add(this.mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-0.17, 0), new THREE.Vector2(0.17, 0), new THREE.Vector2(0, 0.17)]), { depth: 0.3, bevelEnabled: false }), this.std('birdHouse', {}), 0, 0.3, -0.15));
    house.add(this.mesh(new THREE.CircleGeometry(0.055, 14), this.std('hole', { color: 0x2a1a10 }), 0, 0.17, 0.152));
    house.add(this.mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 4).rotateX(Math.PI / 2), this.darkWood, 0, 0.08, 0.19));
    // a little bluebird on the roof
    const bird = new THREE.Group(); bird.name = 'bird'; bird.position.set(0.02, 0.5, 0.02); house.add(bird);
    const blue = this.std('bird', { color: 0x4a9ff0, roughness: 0.45 }), white = this.std('birdBelly', { color: 0xfff3e8 });
    bird.add(this.mesh(new THREE.SphereGeometry(0.06, 12, 8), blue).translateY(0.05));
    const belly = this.mesh(new THREE.SphereGeometry(0.045, 10, 6), white, 0, 0.04, 0.025); bird.add(belly);
    bird.add(this.mesh(new THREE.SphereGeometry(0.04, 10, 8), blue, 0, 0.12, 0.03));
    bird.add(this.mesh(new THREE.ConeGeometry(0.014, 0.04, 5).rotateX(Math.PI / 2), this.std('beak', { color: 0xffa52e }), 0, 0.12, 0.08));
    bird.add(this.mesh(new THREE.ConeGeometry(0.03, 0.08, 5).rotateX(-Math.PI / 2 - 0.4), blue, 0, 0.07, -0.07));
    this.animators.set('birdhouse', root => {
      const b = root.getObjectByName('bird')!, ph = Math.random() * 10;
      return (t) => { const k = (t + ph) % 4; b.position.y = 0.5 + (k < 0.3 ? Math.sin((k / 0.3) * Math.PI) * 0.06 : 0); b.rotation.y = Math.sin((t + ph) * 0.7) * 0.8; };
    });
  }
  private swing(g: THREE.Group) {
    for (const x of [-0.8, 0.8]) for (const s of [-1, 1]) { const l = this.mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.95, 8), this.post, x, 0.93, s * 0.22); l.rotation.x = -s * 0.24; g.add(l); }
    g.add(this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 10).rotateZ(Math.PI / 2), this.post, 0, 1.86, 0));
    const seat = new THREE.Group(); seat.name = 'seat'; seat.position.y = 1.84; g.add(seat);
    for (const x of [-0.24, 0.24]) seat.add(this.mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.42, 4), this.rope, x, -0.71, 0));
    seat.add(this.mesh(tiledBox(0.6, 0.05, 0.22, 1), this.std('swingSeat', { map: this.tex.planks, color: 0xffb8a8 }), 0, -1.42, 0));
    this.animators.set('swing', root => { const s = root.getObjectByName('seat')!, ph = Math.random() * 6; return (t) => { s.rotation.x = Math.sin(t * 1.8 + ph) * 0.32; }; });
  }
  private scarecrow(g: THREE.Group) {
    const S = new THREE.Group(); S.scale.setScalar(0.82); g.add(S);
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d')!;
    c.fillStyle = '#d9483b'; c.fillRect(0, 0, 64, 64); c.fillStyle = 'rgba(255,214,90,.55)'; for (let i = 0; i < 64; i += 16) { c.fillRect(i + 5, 0, 5, 64); c.fillRect(0, i + 5, 64, 5); }
    const plaid = this.keep(new THREE.CanvasTexture(cv)); plaid.colorSpace = THREE.SRGBColorSpace; plaid.wrapS = plaid.wrapT = THREE.RepeatWrapping; plaid.repeat.set(2, 2);
    const cloth = this.std('plaid', { map: plaid, roughness: 0.9 }), straw = this.std('straw', { color: 0xe9c75e, roughness: 0.9 });
    S.add(this.mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.1, 8), this.post, 0, 1.05, -0.05));
    S.add(this.mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.72, 12), cloth, 0, 1.33, 0));
    S.add(this.mesh(new THREE.CylinderGeometry(0.11, 0.12, 1.5, 10).rotateZ(Math.PI / 2), cloth, 0, 1.58, 0));
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) S.add(this.mesh(new THREE.ConeGeometry(0.05, 0.22, 6).rotateZ(-sx * Math.PI / 2), straw, sx * (0.86 + i * 0.02), 1.58 + (i - 1) * 0.06, (i - 1) * 0.04));
    S.add(this.mesh(new THREE.SphereGeometry(0.27, 16, 12), this.std('sack', { map: this.tex.dirt, color: 0xf2dcae, roughness: 1 }), 0, 2.0, 0));
    S.add(this.mesh(new THREE.ConeGeometry(0.34, 0.32, 16), straw, 0, 2.3, 0), this.mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.03, 18), straw, 0, 2.17, 0));
    for (const x of [-0.09, 0.09]) S.add(this.mesh(new THREE.SphereGeometry(0.03, 8, 6), this.std('eye', { color: 0x3a2416 }), x, 2.04, 0.25));
    S.add(this.mesh(new THREE.TorusGeometry(0.08, 0.012, 4, 12, Math.PI), this.std('eye', { color: 0x3a2416 }), 0, 1.97, 0.26).rotateZ(Math.PI));
  }
  private lookout(g: THREE.Group) {
    const P = 0.7, TOP = 2.35;
    for (const x of [-P, P]) for (const z of [-P, P]) g.add(this.mesh(tiledBox(0.14, 3.15, 0.14, 1.2), this.post, x, 1.575, z));
    // cross braces on three sides
    const L = Math.hypot(2 * P, TOP - 0.3);
    for (const [x, z, ry] of [[0, -P, 0], [-P, 0, Math.PI / 2], [P, 0, Math.PI / 2]] as [number, number, number][]) for (const s of [-1, 1]) {
      const b = this.mesh(tiledBox(L, 0.07, 0.05, 1), this.darkWood, x, (TOP - 0.3) / 2 + 0.15, z); b.rotation.set(0, ry, s * Math.atan2(TOP - 0.3, 2 * P)); g.add(b);
    }
    g.add(this.mesh(tiledBox(1.75, 0.1, 1.75, 1), this.planks, 0, TOP, 0));
    for (const [x, z, w, d] of [[0, -0.86, 1.75, 0.05], [0, 0.86, 1.75, 0.05], [-0.86, 0, 0.05, 1.75], [0.86, 0, 0.05, 1.75]]) g.add(this.mesh(tiledBox(w, 0.06, d, 1), this.darkWood, x, TOP + 0.45, z));
    for (const x of [-0.4, 0, 0.4]) for (const z of [-0.86, 0.86]) g.add(this.mesh(tiledBox(0.05, 0.45, 0.05, 1), this.darkWood, x, TOP + 0.24, z));
    const roof = this.mesh(new THREE.ConeGeometry(1.42, 0.95, 4), this.std('lookRoof', { map: this.tex.redroof, roughness: 0.6 }), 0, 3.55, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
    g.add(this.mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 4), this.iron, 0, 4.2, 0));
    g.add(this.mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.32, 0.08), new THREE.Vector2(0, 0.17)])), this.std('flag', { color: 0xffc93d, side: THREE.DoubleSide }), 0.01, 4.27, 0));
    // the ladder up the front
    const lad = new THREE.Group(); lad.position.set(0, 0, P + 0.32); lad.rotation.x = -0.14; g.add(lad);
    for (const x of [-0.22, 0.22]) lad.add(this.mesh(tiledBox(0.06, TOP + 0.4, 0.06, 1), this.post, x, (TOP + 0.4) / 2, 0));
    for (let y = 0.3; y < TOP + 0.2; y += 0.32) lad.add(this.mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.44, 6).rotateZ(Math.PI / 2), this.darkWood, 0, y, 0));
    g.add(this.mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), this.lampGlass, 0.62, TOP + 0.62, 0.62), this.glowSprite(0xffc46b, 0.8, 0.62, TOP + 0.62, 0.62, 0.7));
  }

  // ---------- the Glimmer homes ----------
  private sunDais(g: THREE.Group) {
    g.add(this.mesh(new THREE.LatheGeometry([[0.001, 0], [0.95, 0], [0.97, 0.08], [0.92, 0.16], [0.001, 0.16]].map(([x, y]) => new THREE.Vector2(x, y)), 36), this.stone));
    g.add(this.mesh(new THREE.LatheGeometry([[0.001, 0], [0.7, 0], [0.72, 0.07], [0.68, 0.13], [0.001, 0.13]].map(([x, y]) => new THREE.Vector2(x, y)), 32), this.std('daisTop', { map: this.tex.stone, color: 0xfff3dc, roughness: 0.6 }), 0, 0.16, 0));
    g.add(this.mesh(new THREE.TorusGeometry(0.82, 0.03, 6, 48).rotateX(Math.PI / 2), this.gold, 0, 0.165, 0), this.mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 40).rotateX(Math.PI / 2), this.gold, 0, 0.295, 0));
    g.add(this.mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.42, 12), this.std('daisTop', {}), 0, 0.5, 0));
    const sun = new THREE.Group(); sun.name = 'sun'; sun.position.y = 1.02; g.add(sun);
    const sunMat = this.std('sunOrb', { color: 0xffd34d, emissive: 0xffa31a, emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.2 });
    sun.add(this.mesh(new THREE.SphereGeometry(0.2, 20, 14), sunMat));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, r = this.mesh(new THREE.ConeGeometry(0.05, 0.18, 6), sunMat, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0); r.rotation.z = a - Math.PI / 2; sun.add(r); }
    sun.add(this.glowSprite(0xffb52e, 1.6, 0, 0, 0, 0.75));
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2, x = Math.cos(a) * 0.86, z = Math.sin(a) * 0.86; g.add(this.mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.42, 10), this.stone, x, 0.21, z), this.mesh(new THREE.SphereGeometry(0.075, 12, 8), sunMat, x, 0.48, z)); }
    this.animators.set('sundais', root => { const s = root.getObjectByName('sun')!; return (t) => { s.rotation.z = t * 0.4; s.position.y = 1.02 + Math.sin(t * 1.6) * 0.05; }; });
  }
  private icePool(g: THREE.Group) {
    const R = 0.72;
    g.add(this.mesh(new THREE.CircleGeometry(R, 36).rotateX(-Math.PI / 2), this.waterMat(0x2f86d6, 0xc8f2ff), 0, 0.04, 0));
    const snow = this.std('snowRim', { map: this.tex.snow, color: 0xffffff, roughness: 0.9 });
    g.add(this.mesh(new THREE.TorusGeometry(R + 0.1, 0.13, 10, 40).rotateX(Math.PI / 2), snow, 0, 0.06, 0));
    const ice = this.std('ice', { color: 0xbfe9ff, emissive: 0x3aa0e0, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 });
    const floe = this.std('floe', { color: 0xf2fbff, roughness: 0.35 });
    for (const [x, z, s] of [[-0.25, 0.15, 0.22], [0.25, -0.2, 0.16], [0.2, 0.3, 0.12]]) { const f = this.mesh(new THREE.CylinderGeometry(s, s * 1.05, 0.06, 6), floe, x, 0.06, z); f.rotation.y = x * 5; g.add(f); }
    const r = rnd(121);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4, cl = new THREE.Group(); cl.position.set(Math.cos(a) * (R + 0.12), 0.05, Math.sin(a) * (R + 0.12)); g.add(cl);
      for (let k = 0; k < 3; k++) { const h = 0.18 + r() * 0.3, c = this.mesh(new THREE.OctahedronGeometry(0.07, 0), ice, (r() - 0.5) * 0.12, h / 2, (r() - 0.5) * 0.12); c.scale.set(1, h / 0.14, 1); c.rotation.set((r() - 0.5) * 0.5, r() * 3, (r() - 0.5) * 0.5); cl.add(c); }
    }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2, m = this.mesh(new THREE.SphereGeometry(0.16, 12, 8), snow, Math.cos(a) * 0.95, 0.02, Math.sin(a) * 0.95); m.scale.set(1.2, 0.45, 1); g.add(m); }
    g.add(this.glowSprite(0x9fe0ff, 1.6, 0, 0.3, 0, 0.35));
  }
  private tidePond(g: THREE.Group) {
    const R = 0.72;
    g.add(this.mesh(new THREE.CircleGeometry(R + 0.22, 36).rotateX(-Math.PI / 2), this.std('sandRim', { map: this.tex.sand, color: 0xfff1d6, roughness: 1 }), 0, 0.015, 0));
    g.add(this.mesh(new THREE.CircleGeometry(R, 36).rotateX(-Math.PI / 2), this.waterMat(0x0f97b0, 0x8ff0e4), 0, 0.03, 0));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, b = this.model('boulder', 0.2 + ((i * 5) % 4) * 0.06); b.position.set(Math.cos(a) * (R + 0.12), -0.03, Math.sin(a) * (R + 0.12)); b.rotation.y = i; g.add(b); }
    // a starfish on a rock, shells on the sand, coral in the water
    const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 0.045 : 0.11; if (i) star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    const sf = this.mesh(new THREE.ExtrudeGeometry(star, { depth: 0.025, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }), this.std('starfish', { color: 0xff8a3d, roughness: 0.6 }), 0.55, 0.3, 0.45);
    sf.rotation.x = -1.2; g.add(sf);
    const shell = this.std('shell', { color: 0xffd6cf, roughness: 0.45 });
    for (const [x, z, ry] of [[-0.75, 0.55, 0.4], [0.82, -0.3, 2]]) { const s = this.mesh(new THREE.SphereGeometry(0.08, 10, 6, 0, Math.PI), shell, x, 0.02, z); s.rotation.set(-Math.PI / 2, 0, ry); s.scale.set(1, 1, 0.5); g.add(s); }
    const coral = this.std('coral', { color: 0xff7aa8, roughness: 0.5, emissive: 0x401020 });
    for (const [x, z] of [[-0.2, -0.25], [0.15, 0.1]]) for (let k = 0; k < 4; k++) { const b = this.mesh(new THREE.CapsuleGeometry(0.025, 0.14 + k * 0.03, 3, 6), coral, x + (k - 1.5) * 0.04, 0.1, z); b.rotation.z = (k - 1.5) * 0.35; g.add(b); }
    g.add(this.glowSprite(0x7ff0e0, 1.4, 0, 0.2, 0, 0.25));
  }
  private stoneCave(g: THREE.Group) {
    // a rocky mound with a dark arched mouth, crystals glowing at the door and on top
    const geo = new THREE.SphereGeometry(0.95, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute, r = rnd(131);
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const n = 1 + 0.08 * Math.sin(x * 7 + z * 3) + 0.06 * Math.sin(z * 9 - y * 5); pos.setXYZ(i, x * n, y * n * 1.05, z * n * 0.92); }
    geo.computeVertexNormals();
    g.add(this.mesh(geo, this.std('caveRock', { map: this.tex.greystone, color: 0xd8d0c4, roughness: 0.95 })));
    const mouth = new THREE.Shape(); mouth.moveTo(-0.3, 0); mouth.lineTo(0.3, 0); mouth.lineTo(0.3, 0.32); mouth.absarc(0, 0.32, 0.3, 0, Math.PI, false); mouth.closePath();
    g.add(this.mesh(new THREE.ShapeGeometry(mouth), this.std('caveIn', { color: 0x1d1520, roughness: 1 }), 0, 0.005, 0.86));
    const am = this.std('amethyst', { color: 0xc59bff, emissive: 0x7a3df0, emissiveIntensity: 0.7, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 });
    for (const [x, y, z, s, rz] of [[-0.42, 0, 0.78, 1, 0.3], [0.44, 0, 0.76, 0.85, -0.3], [0.1, 0.86, 0.2, 0.8, 0.1], [-0.25, 0.8, -0.1, 0.6, -0.4], [0.5, 0.55, -0.3, 0.7, 0.4]]) {
      const c = new THREE.Group(); c.position.set(x, y, z); c.rotation.z = rz; c.scale.setScalar(s); g.add(c);
      for (let k = 0; k < 3; k++) { const h = 0.2 + r() * 0.22, m = this.mesh(new THREE.OctahedronGeometry(0.07, 0), am, (k - 1) * 0.07, h / 2, (r() - 0.5) * 0.06); m.scale.set(1, h / 0.14, 1); m.rotation.z = (k - 1) * 0.35; c.add(m); }
    }
    for (const [x, z, s] of [[-0.7, 0.55, 0.32], [0.75, 0.5, 0.28], [0.3, 0.9, 0.16]]) { const b = this.model('boulder', s); b.position.set(x, 0, z); b.rotation.y = x * 4; g.add(b); }
    const moss = this.std('moss', { color: 0x6fb84a, roughness: 0.9 });
    for (const [x, y, z, s] of [[-0.3, 0.86, 0.2, 0.25], [0.2, 0.9, -0.35, 0.3]]) { const m = this.mesh(new THREE.SphereGeometry(s, 12, 8), moss, x, y, z); m.scale.y = 0.35; g.add(m); }
    g.add(this.glowSprite(0xb98aff, 1.0, 0, 0.3, 0.95, 0.55));
  }
  private leafGrove(g: THREE.Group) {
    for (const [x, z, s] of [[-0.6, -0.55, 0.75], [0.1, -0.7, 0.85], [0.68, -0.4, 0.65]]) { const b = this.model('bush', s, s * 1.8); b.position.set(x, 0, z); b.rotation.y = x * 3; g.add(b); }
    // big leaves standing up like fronds
    const leaf = this.std('bigLeaf', { map: this.tex['leaves-card'], alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.55 });
    const fronds = new THREE.Group(); fronds.name = 'fronds'; g.add(fronds);
    for (const [x, z, ry, s] of [[-0.75, 0.05, 0.6, 0.9], [0.8, 0.15, -0.7, 0.8], [-0.35, -0.3, 0.2, 1.05], [0.4, -0.3, -0.3, 0.95]]) { const f = this.mesh(new THREE.PlaneGeometry(0.8 * s, 0.85 * s).translate(0, 0.42 * s, 0), leaf, x, 0, z); f.rotation.y = ry; f.rotation.x = -0.15; fronds.add(f); }
    // a mossy log, mushrooms and flowers
    const log = this.mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.0, 12).rotateZ(Math.PI / 2), this.std('log', { map: this.turned('post'), color: 0xc49a72 }), -0.05, 0.16, 0.35); log.rotation.y = 0.35; g.add(log);
    const top = this.mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.9, 12, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), this.std('moss', { color: 0x6fb84a, roughness: 0.9 }), -0.05, 0.175, 0.35); top.rotation.y = 0.35; g.add(top);
    for (const [x, z, h] of [[0.45, 0.45, 0.22], [0.58, 0.32, 0.15], [-0.6, 0.6, 0.18]]) { const m = this.model('mushroom', h); m.position.set(x, 0, z); g.add(m); }
    g.add(this.flowerCluster(8, 0.6, 141, 0.1, 0.28).translateZ(0.62));
    g.add(this.glowSprite(0x9dff8a, 1.4, 0, 0.35, 0.1, 0.25));
    this.animators.set('leafgrove', root => { const f = root.getObjectByName('fronds')!; return (t) => { f.children.forEach((c, i) => { c.rotation.z = Math.sin(t * 1.3 + i) * 0.06; }); }; });
  }

  // ---------- dream things ----------
  private balloon(g: THREE.Group) {
    g.add(this.mesh(tiledBox(0.12, 0.7, 0.12, 1), this.post, 0.6, 0.35, 0.6));
    const b = new THREE.Group(); b.name = 'balloon'; g.add(b);
    b.add(this.model('hot_air_balloon', 2.9));
    b.position.y = 1.6;
    const rope = this.mesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 4).translate(0, 0.5, 0), this.rope); rope.name = 'tether'; g.add(rope);
    this.animators.set('balloon', root => {
      const bb = root.getObjectByName('balloon')!, rr = root.getObjectByName('tether')!, ph = Math.random() * 6;
      const from = new THREE.Vector3(0.6, 0.7, 0.6);
      return (t) => {
        bb.position.set(Math.sin(t * 0.4 + ph) * 0.12, 1.6 + Math.sin(t * 0.7 + ph) * 0.18, Math.cos(t * 0.33 + ph) * 0.1);
        const to = bb.position.clone().add(new THREE.Vector3(0.12, 0.15, 0.12)), d = to.clone().sub(from);
        rr.position.copy(from); rr.scale.set(1, d.length(), 1); rr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      };
    });
  }
  private lighthouse(g: THREE.Group) {
    const m = this.model('lighthouse', 4.6, 1.9); g.add(m);
    const beam = new THREE.Group(); beam.name = 'beam'; beam.position.y = 3.95; g.add(beam);
    const bm = this.mat('beam', () => new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    for (const s of [1, -1]) { const c = this.mesh(new THREE.ConeGeometry(0.55, 4.5, 16, 1, true).rotateZ(s * Math.PI / 2).translate(s * 2.25, 0, 0), bm); c.userData.noShadow = true; beam.add(c); }
    beam.add(this.glowSprite(0xfff0a0, 1.3, 0, 0, 0, 0.8));
    this.animators.set('lighthouse', root => { const b = root.getObjectByName('beam')!; return (t) => { b.rotation.y = t * 0.7; }; });
  }
  private rainbow(g: THREE.Group) {
    const cols = [0xff5b5b, 0xff9f3d, 0xffe04d, 0x6fd66a, 0x4fa8ff, 0x9a7bff];
    cols.forEach((c, i) => g.add(this.mesh(new THREE.TorusGeometry(1.42 - i * 0.075, 0.045, 8, 48, Math.PI), this.std(`rb${i}`, { color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.4 }), 0, 0.05, 0)));
    const cloud = this.std('puff', { color: 0xffffff, roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0.15 });
    for (const s of [-1, 1]) for (const [dx, dy, r] of [[0, 0.18, 0.3], [0.22, 0.12, 0.22], [-0.22, 0.12, 0.22], [0.05, 0.38, 0.2]]) g.add(this.mesh(new THREE.SphereGeometry(r, 14, 10), cloud, s * 1.24 + dx, dy, 0));
  }

  // ---------- a visitor's gift ----------
  private crystal(g: THREE.Group, el: Element) {
    const c = ELEMENT[el].color;
    g.add(this.model('boulder', 0.22, 0.55));
    const m = this.std(`gem-${el}`, { color: c, emissive: c, emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 });
    const r = rnd(el.length * 13);
    for (let k = 0; k < 4; k++) { const h = 0.24 + r() * 0.3, o = this.mesh(new THREE.OctahedronGeometry(0.08, 0), m, (k - 1.5) * 0.07, 0.15 + h / 2, (r() - 0.5) * 0.1); o.scale.set(1, h / 0.16, 1); o.rotation.z = (k - 1.5) * 0.3; g.add(o); }
    g.add(this.glowSprite(c, 1.0, 0, 0.4, 0, 0.55));
  }
}
