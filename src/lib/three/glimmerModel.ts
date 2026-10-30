// A Glimmer in 3D: its model (made from its painting), brought to life. A Glimmer with landmarks in
// public/models/glimmers/meta.json ("rig") gets a small skeleton made in code when it loads
// (glimmerRig.ts) and moves its body: looks round, swishes its tail, flaps, waves its tentacles, sits,
// sleeps, cheers, attacks and flinches (glimmerMotion.ts). One without keeps the old wiggle: a little
// vertex program that nods the head, wags the tail, flaps the wings and flops the ears from the measured
// points. On top of either, the whole body breathes, bobs (floaters hover), hops, spins and squashes like
// a cartoon. An evolved one is bigger and
// glows: its element's painted markings run over its body (mapped from three sides, pulsing softly), its
// edges shine in its element's colour, and little leaves, flakes, sparks, drops or crystals float round it.
import * as THREE from 'three';
import { loadGltf, loadTexture } from './assets';
import type { Fx, Shape } from './fx';
import { ELEMENT, GLIMMER, type Element, type GlimmerId } from '../adventure/glimmers';
import { makeBones, skinFor, type Landmarks, type V3 } from './glimmerRig';
import { Animator, STRIKE_AT, type Act, type Base } from './glimmerMotion';

/** What floats round an evolved Glimmer. */
const AURA: Record<Element, Shape[]> = { tide: ['drop', 'dot'], frost: ['flake', 'star'], sun: ['spark', 'star'], leaf: ['leaf', 'petal'], stone: ['shard', 'dot'] };
let blank: THREE.DataTexture | null = null;
const blankTex = () => (blank ??= Object.assign(new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1), { needsUpdate: true }));

type Meta = { height: number; head: number[]; tail: number[] | null; wings: number[][] | null; ears: number[][] | null; floats: boolean; rig?: Landmarks };
let metaP: Promise<Record<string, Meta>> | null = null;
function metas(): Promise<Record<string, Meta>> {
  metaP ??= fetch(`${import.meta.env.BASE_URL}models/glimmers/meta.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  return metaP;
}

/** One-off moves. A rigged Glimmer moves its body too; every Glimmer hops, squashes and leans. `act`: it
 *  leans in to do something (a Learn episode's helper); `attack`: a lunge with a puff of its element. */
export type Move = 'idle' | 'hop' | 'happy' | 'act' | 'appear' | 'sad' | 'hit' | 'stomp' | 'cheer' | 'attack' | 'eat';
const ACT_OF: Partial<Record<Move, Act>> = { hop: 'hop', happy: 'happy', act: 'hop', attack: 'attack', sad: 'sad', hit: 'hit', stomp: 'stomp', cheer: 'cheer', eat: 'eat' };
/** what each element puffs out when it attacks */
const PUFF: Record<Element, { shape: Shape[]; color: number[] }> = {
  sun: { shape: ['spark', 'star'], color: [0xffb52e, 0xffe066, 0xffffff] }, frost: { shape: ['flake', 'star'], color: [0xbff0ff, 0xffffff, 0x7fd6ff] },
  tide: { shape: ['drop', 'dot'], color: [0x7fc4ff, 0xd8f0ff, 0x3fa2ff] }, leaf: { shape: ['leaf', 'petal'], color: [0x5fd17a, 0xb8f0a0, 0x2f9a4a] },
  stone: { shape: ['pebble', 'dot'], color: [0xc9a27a, 0xe8d4b8, 0x8a6a4a] },
};

const WIGGLE = `
  uniform float uT; uniform vec3 uHead; uniform float uHeadR; uniform vec3 uTail; uniform float uTailOn; uniform vec3 uWingL; uniform vec3 uWingR; uniform float uWingOn;
  uniform vec3 uEarL; uniform vec3 uEarR; uniform float uEarOn; uniform float uWag; uniform float uFlap; uniform float uNod; uniform float uUnit; uniform float uBreath; uniform float uFinR;
  varying vec3 vSPos; varying vec3 vSNrm;
  vec3 rotAxis(vec3 p, vec3 c, vec3 ax, float a) { vec3 q = p - c; float s = sin(a), co = cos(a); return c + q * co + cross(ax, q) * s + ax * dot(ax, q) * (1.0 - co); }
`;
const WIGGLE_BODY = `
  vec3 p = transformed;
  p *= 1.0 + sin(uT * 2.4) * 0.012 * uBreath;
  float hw = 1.0 - smoothstep(uHeadR * 0.5, uHeadR * 1.5, distance(p, uHead));
  p = rotAxis(p, uHead - vec3(0.0, uHeadR * 0.7, uHeadR * 0.2), vec3(1.0, 0.0, 0.0), (sin(uT * 2.1) * 0.6 + sin(uT * 3.7) * 0.4) * uNod * hw);
  p = rotAxis(p, uHead - vec3(0.0, uHeadR * 0.7, uHeadR * 0.2), vec3(0.0, 1.0, 0.0), sin(uT * 1.3) * uNod * 0.8 * hw);
  if (uTailOn > 0.5) { float tw = smoothstep(0.0, 0.3 * uUnit, uTail.z - p.z); p = rotAxis(p, uTail, vec3(0.0, 1.0, 0.0), sin(uT * 6.5) * uWag * tw); }
  if (uWingOn > 0.5) { float sd = p.x < 0.0 ? -1.0 : 1.0; vec3 rt = sd < 0.0 ? uWingL : uWingR; float ww = smoothstep(0.0, 0.2 * uUnit, abs(p.x) - abs(rt.x));
    // the head never flaps with the wings; fins (uFinR) move only near their root, so a wide face (the
    // whale calf's eyes) doesn't get pulled along
    ww *= 1.0 - hw;
    if (uFinR > 0.0) ww *= 1.0 - smoothstep(uFinR * 0.6, uFinR, length(p.yz - rt.yz));
    p = rotAxis(p, rt, vec3(0.0, 0.0, 1.0), sd * sin(uT * 9.0) * uFlap * ww); }
  if (uEarOn > 0.5) { float sd = p.x < 0.0 ? -1.0 : 1.0; vec3 eb = sd < 0.0 ? uEarL : uEarR; float ew = (1.0 - smoothstep(0.0, 0.25 * uUnit, distance(p.xz, eb.xz))) * smoothstep(0.0, 0.06 * uUnit, p.y - eb.y); p = rotAxis(p, eb, vec3(0.0, 0.0, 1.0), -sd * (0.12 + sin(uT * 3.0 + sd) * 0.1) * ew); }
  transformed = p;
  vSPos = p / uUnit; vSNrm = objectNormal;
`;
// The island light (a sun, and a sky light whose ground half is grass green) leaves every model about a
// tenth darker than its painting, and greens the undersides of yellow ones. Like the buddies (character.ts
// liftColours), a Glimmer's paint is lifted a little: a vibrance boost that gives dull colours the most and
// leaves already-vivid ones nearly alone, and a touch of brightness.
const LIFT = `
  { vec3 c = diffuseColor.rgb; float mx = max(c.r, max(c.g, c.b)), sat = mx > 0.0 ? (mx - min(c.r, min(c.g, c.b))) / mx : 0.0;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    diffuseColor.rgb = max(vec3(0.0), mix(vec3(l), c, 1.0 + 0.3 * (1.0 - sat) * (1.0 - sat) * smoothstep(0.03, 0.12, sat))) * 1.05; }
`;
const FILL = 0.12;
// an evolved Glimmer's markings: the painted pattern seen from three sides and blended by the surface's
// facing (so it wraps round any model with no seams), pulsing up the body; plus a rim of its colour
const SHINE = `
  if (uShine > 0.0) {
    vec3 sn = normalize(vSNrm); vec3 sw = pow(abs(sn), vec3(4.0)); sw /= (sw.x + sw.y + sw.z + 1e-4);
    vec3 sq = vSPos * 1.3;
    vec3 tx = texture2D(uShineMap, sq.zy).rgb * sw.x + texture2D(uShineMap, sq.xz).rgb * sw.y + texture2D(uShineMap, sq.xy).rgb * sw.z;
    float sm = smoothstep(0.22, 0.75, max(tx.r, max(tx.g, tx.b)));
    float pulse = 0.6 + 0.4 * sin(uT * 2.2 - vSPos.y * 5.0);
    float rim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.5);
    // tinted in (so they show on white fur too), then a glow on top
    vec3 mk = mix(uShineCol, tx * 1.3, 0.45);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, mk, sm * 0.6 * pulse * uShine);
    gl_FragColor.rgb += (tx * sm * 0.45 * pulse + uShineCol * rim * 0.4) * uShine;
  }
`;

export class GlimmerModel {
  readonly root = new THREE.Group();
  private inner = new THREE.Group();
  readonly id: GlimmerId;
  height = 0.6;
  floats = false;
  private uniforms: Record<string, { value: unknown }>[] = [];
  private move: Move = 'appear'; private mt = 0;
  private bob = Math.random() * 6;
  /** turn to face this point (world) */
  face: THREE.Vector3 | null = null;
  private ready = false;
  /** shared by all its materials: how grey (grumpy) it is, a hit flash, and an evolved one's markings */
  private look = { uGrey: { value: 0 }, uFlash: { value: 0 }, uShine: { value: 0 }, uShineMap: { value: blankTex() as THREE.Texture }, uShineCol: { value: new THREE.Color() } };
  /** grown up: bigger, glowing markings, an aura */
  evolved = false;
  /** where the aura's bits go (the scene's effects) */
  fx: Fx | null = null;
  private auraT = 0;
  /** what it does once it has popped in */
  appearThen: Move = 'happy';
  /** 0..1: slumped and sulky */
  droop = 0;
  setGrey(k: number) { this.look.uGrey.value = k; }
  flash(k = 0.6) { this.look.uFlash.value = k; }
  /** keep it glowing at least this white (evolving) */
  hold = 0;
  /** its skeleton's moves (null: no landmarks yet, it keeps the old wiggle) */
  anim: Animator | null = null;
  private skinned: THREE.SkinnedMesh | null = null;
  private headBone = -1;
  /** turn its head to look at this point (world), as far as its neck goes; null: it looks round itself */
  lookAt: THREE.Vector3 | null = null;
  /** an attack's puff has gone out */
  private puffed = false;

  private constructor(id: GlimmerId) { this.id = id; this.root.add(this.inner); this.inner.scale.setScalar(0.001); }

  /** Has a skeleton (moves its body). */
  get rigged() { return !!this.anim; }
  /** Walks on legs (a walking loop instead of hops when it moves about). */
  get walks() { return !!this.anim && !this.floats && this.anim.rig.bones.some(b => b.role === 'leg'); }
  /** What it keeps doing: idle, walk, sit, sleep or swim (a Glimmer with no skeleton only shows it in
   *  how it breathes). */
  get pose(): Base { return this.anim?.state ?? this.basePose; }
  set pose(b: Base) { this.basePose = b; this.anim?.setBase(b); }
  private basePose: Base = 'idle';
  /** Where the middle of its head is now (world). */
  headAt(out = new THREE.Vector3()): THREE.Vector3 {
    if (this.skinned && this.headBone >= 0) return this.skinned.skeleton.bones[this.headBone].getWorldPosition(out);
    return this.root.localToWorld(out.set(0, this.height * (this.floats ? 1.05 : 0.72), this.height * 0.2));
  }

  /** `height`: how tall it stands in the scene (metres); an evolved one stands a fifth taller. */
  /** `src`: another model file to show in its place (for comparing versions side by side) */
  static async create(id: GlimmerId, height = 0.6, opts: { evolved?: boolean; src?: string } = {}): Promise<GlimmerModel> {
    const g = new GlimmerModel(id);
    const el = GLIMMER[id].element;
    g.evolved = !!opts.evolved;
    g.height = height * (g.evolved ? 1.2 : 1);
    const [gl, meta, shine] = await Promise.all([loadGltf(opts.src ?? `models/glimmers/${id}.glb`), metas(), g.evolved ? loadTexture(`game/shine-${el}.webp`) : Promise.resolve(null)]);
    if (shine) {
      // mirrored tiling: the painted swatch never shows a seam
      if (shine.wrapS !== THREE.MirroredRepeatWrapping) { shine.wrapS = shine.wrapT = THREE.MirroredRepeatWrapping; shine.needsUpdate = true; }
      g.look.uShineMap.value = shine; g.look.uShine.value = 1; g.look.uShineCol.value.set(ELEMENT[el].color);
    }
    const m = meta[id];
    if (gl) g.build(gl.scene.clone(true), m, opts.src ? undefined : m?.rig); else g.placeholder();
    g.ready = true;
    return g;
  }

  private build(scene: THREE.Object3D, m: Meta | undefined, rig?: Landmarks) {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene), size = box.getSize(new THREE.Vector3());
    const k = this.height / Math.max(1e-4, size.y);
    this.floats = !!m?.floats;
    const fileH = m?.height ?? size.y;
    // meta points are in the file's metres; the model may be any size, so scale them to the model
    const toModel = size.y / Math.max(1e-4, fileH);
    const pt = (a: number[] | null | undefined) => (a ? new THREE.Vector3(a[0], a[1], a[2]).multiplyScalar(toModel) : null);
    const head = pt(m?.head) ?? new THREE.Vector3(0, size.y * 0.75 + box.min.y, box.max.z * 0.6);
    const tail = pt(m?.tail), wings = m?.wings?.map(w => pt(w)!), ears = m?.ears?.map(e => pt(e)!);
    const el = GLIMMER[this.id].element;
    scene.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true; mesh.receiveShadow = false;
      const inv = mesh.matrixWorld.clone().invert();
      const local = (v: THREE.Vector3 | null) => (v ? v.clone().applyMatrix4(inv) : new THREE.Vector3());
      const unit = new THREE.Vector3(1, 0, 0).applyMatrix3(new THREE.Matrix3().setFromMatrix4(inv)).length() * size.y;
      const u = {
        uT: { value: 0 }, uHead: { value: local(head) }, uHeadR: { value: 0.22 * unit }, uTail: { value: local(tail) }, uTailOn: { value: tail ? 1 : 0 },
        uWingL: { value: local(wings?.[0] ?? null) }, uWingR: { value: local(wings?.[1] ?? null) }, uWingOn: { value: wings ? 1 : 0 },
        uEarL: { value: local(ears?.[0] ?? null) }, uEarR: { value: local(ears?.[1] ?? null) }, uEarOn: { value: ears ? 1 : 0 },
        uWag: { value: 0.25 }, uFlap: { value: el === 'tide' ? 0.25 : 0.6 }, uNod: { value: 0.07 }, uUnit: { value: unit }, uBreath: { value: 1 },
        // water Glimmers have fins, not wings: keep the flap close to the fin
        uFinR: { value: el === 'tide' ? 0.22 * unit : 0 },
      };
      this.uniforms.push(u);
      const fix = (mat: THREE.Material) => {
        const c = mat.clone() as THREE.MeshStandardMaterial;
        if ('roughness' in c) { c.roughness = Math.max(0.35, c.roughness ?? 0.6); c.metalness = Math.min(0.1, c.metalness ?? 0); }
        // a little of its own colour in the shade, so undersides and backs keep their paint (the sky
        // light's green ground half turned yellow wings olive and grey wool slate)
        if (c.map && 'emissive' in c) { c.emissiveMap = c.map; c.emissive.setScalar(FILL); }
        c.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, u, this.look);
          sh.vertexShader = WIGGLE + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + WIGGLE_BODY);
          // grumpy: drained of colour, a little dark and blue; a white flash when cheer lands
          sh.fragmentShader = 'uniform float uGrey; uniform float uFlash; uniform float uT; uniform float uShine; uniform sampler2D uShineMap; uniform vec3 uShineCol;\nvarying vec3 vSPos; varying vec3 vSNrm;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            ${LIFT}`).replace('#include <dithering_fragment>', `#include <dithering_fragment>
            ${SHINE}
            float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(lum) * vec3(0.72, 0.76, 0.86), uGrey);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), uFlash);`);
        };
        c.customProgramCacheKey = () => 'glimmer-wiggle';
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(fix) : fix(mesh.material);
    });
    if (rig) this.rigUp(scene, rig, toModel);
    // stand it on the ground, centred, facing +z
    const wrap = new THREE.Group();
    scene.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    wrap.add(scene); wrap.scale.setScalar(k);
    this.inner.add(wrap);
    // a soft glow of its element under it
    this.addGlow(ELEMENT[el].color);
  }

  /** Its skeleton: the mesh becomes a skinned one (the skin is made once per kind of Glimmer and shared)
   *  and the old wiggle stops (the bones move it now). */
  private rigUp(scene: THREE.Object3D, lm: Landmarks, toModel: number) {
    let mesh: THREE.Mesh | null = null;
    scene.traverse(o => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
    const m = mesh as THREE.Mesh | null;
    if (!m) return;
    // the landmarks are in the file's metres: the mesh in the same space
    let geo = m.geometry;
    if (!m.matrixWorld.equals(new THREE.Matrix4())) { geo = geo.clone(); geo.applyMatrix4(m.matrixWorld); }
    const sc = (p: V3): V3 => [p[0] * toModel, p[1] * toModel, p[2] * toModel];
    const deep = (x: unknown): unknown => (Array.isArray(x) && typeof x[0] === 'number' ? sc(x as V3) : Array.isArray(x) ? x.map(deep) : x);
    const scaled = Object.fromEntries(Object.entries(lm).map(([k, x]) => [k, deep(x)])) as Landmarks;
    const skin = skinFor(`${this.id}|${toModel.toFixed(4)}|${JSON.stringify(lm)}`, geo, scaled);
    const { bones, inverses } = makeBones(skin.rig);
    const sk = new THREE.SkinnedMesh(skin.geometry, m.material);
    sk.castShadow = true; sk.receiveShadow = false;
    sk.add(bones[0]);
    sk.bind(new THREE.Skeleton(bones, inverses), new THREE.Matrix4());
    // room for the moves to reach out, so it isn't culled at the screen's edge
    sk.boundingSphere = skin.geometry.boundingSphere!.clone(); sk.boundingSphere.radius *= 1.4;
    m.removeFromParent();
    scene.add(sk);
    for (const u of this.uniforms) { u.uNod.value = 0; u.uTailOn.value = 0; u.uWingOn.value = 0; u.uEarOn.value = 0; u.uBreath.value = 0; }
    this.skinned = sk;
    this.headBone = skin.rig.bones.findIndex(b => b.role === 'head');
    this.anim = new Animator(skin.rig, bones, Math.random() * 20, this.floats);
    this.anim.setBase(this.basePose);
  }

  /** No model yet: a little glowing creature so nothing is missing. */
  private placeholder() {
    const el = GLIMMER[this.id].element;
    const body = new THREE.Mesh(new THREE.SphereGeometry(this.height * 0.42, 32, 24), new THREE.MeshStandardMaterial({ color: ELEMENT[el].color, roughness: 0.4, emissive: ELEMENT[el].deep, emissiveIntensity: 0.25 }));
    body.position.y = this.height * 0.45; body.scale.y = 0.9; body.castShadow = true;
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff }), dark = new THREE.MeshBasicMaterial({ color: 0x241a3a });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(this.height * 0.08, 16, 12), white); e.position.set(s * this.height * 0.14, this.height * 0.55, this.height * 0.36); this.inner.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(this.height * 0.045, 12, 8), dark); p.position.set(s * this.height * 0.14, this.height * 0.55, this.height * 0.42); this.inner.add(p);
    }
    this.inner.add(body);
    this.addGlow(ELEMENT[el].color);
  }

  private addGlow(color: string) {
    const g = new THREE.Mesh(new THREE.CircleGeometry(this.height * (this.evolved ? 0.7 : 0.55), 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: this.evolved ? 0.34 : 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
    g.rotation.x = -Math.PI / 2; g.position.y = 0.02;
    this.root.add(g);
  }

  play(m: Move) {
    this.move = m; this.mt = 0;
    const a = ACT_OF[m];
    if (this.anim && a) this.anim.play(a);
    this.puffed = false;
  }

  update(dt: number, t: number) {
    if (!this.ready) return;
    this.mt += dt;
    // an evolved one's aura: a little of its element drifting up round it (not while it sulks grey)
    if (this.evolved && this.fx && this.look.uGrey.value < 0.6) {
      this.auraT -= dt;
      if (this.auraT <= 0) {
        this.auraT = 0.08;
        const el = GLIMMER[this.id].element, w = this.root.getWorldPosition(new THREE.Vector3()), s = this.root.getWorldScale(new THREE.Vector3()).y;
        const lift = this.floats ? 0.35 * this.height : 0;
        this.fx.emit({ at: w.add(new THREE.Vector3(0, (lift + this.height * (0.15 + Math.random() * 0.7)) * s, 0)), count: 1, shape: AURA[el], color: [ELEMENT[el].color, 0xffffff, ELEMENT[el].color],
          speed: [0.1, 0.3], up: 0.7, radius: this.height * 0.6 * s, life: [1.2, 2.2], size: [0.06 * s, 0.13 * s], drag: 0.6, spin: 2, flutter: el === 'leaf' ? 1.2 : 0.3 });
      }
    }
    for (const u of this.uniforms) u.uT.value = t;
    const lift = this.floats ? 0.35 * this.height + Math.sin(t * 2 + this.bob) * 0.06 : 0;
    let y = lift, sx = 1, sy = 1, spin = 0, lean = 0;
    const k = this.mt;
    if (this.move === 'appear') {
      // pop in with a bounce
      const s = k < 0.5 ? easeOutBack(k / 0.5) : 1;
      sx = sy = s;
      if (k > 0.5) this.move = this.appearThen, this.mt = 0;
    } else if (this.move === 'hop') {
      const h = Math.max(0, Math.sin((k / 0.45) * Math.PI)); y += h * 0.25 * this.height; sy = 1 + h * 0.12; sx = 1 - h * 0.06;
      if (k < 0.08) { sy = 0.85; sx = 1.1; }
      if (k > 0.45) this.move = 'idle';
    } else if (this.move === 'happy') {
      const n = Math.floor(k / 0.42), f = (k % 0.42) / 0.42;
      if (n < 3) { const h = Math.sin(f * Math.PI); y += h * 0.3 * this.height; sy = 1 + h * 0.1; if (n === 1) spin = f * Math.PI * 2; } else this.move = 'idle';
    } else if (this.move === 'cheer') {
      // two big hops (a rigged one also throws its arms, wings or tentacles up)
      const n = Math.floor(k / 0.5), f = (k % 0.5) / 0.5;
      if (n < 3) { const h = Math.sin(f * Math.PI); y += h * 0.32 * this.height; sy = 1 + h * 0.08; sx = 1 - h * 0.04; if (f < 0.1) { sy = 0.9; sx = 1.06; } } else this.move = 'idle';
    } else if (this.move === 'act' || this.move === 'attack') {
      // a lean into it (a rigged one lunges with its whole body when it attacks, so it leans less)
      const at = this.move === 'attack';
      lean = Math.sin(Math.min(1, k / 0.5) * Math.PI) * (this.anim && at ? 0.12 : 0.35); sy = 1 - lean * 0.15; sx = 1 + lean * 0.1;
      if (at && k >= STRIKE_AT && !this.puffed) { this.puffed = true; this.puff(); }
      if (k > (this.anim && at ? 0.95 : 0.5)) this.move = 'idle';
    } else if (this.move === 'eat') {
      // little dips (a rigged one nibbles with its head)
      if (!this.anim) { const h = Math.max(0, Math.sin((k / 0.375) * Math.PI)); lean = h * 0.12; sy = 1 - h * 0.04; }
      if (k > 0.75) this.move = 'idle';
    } else if (this.move === 'hit') {
      // knocked back a little, squashed, then springs back
      const h = Math.sin(Math.min(1, k / 0.35) * Math.PI); sy = 1 - h * 0.14; sx = 1 + h * 0.1; lean = -h * 0.25;
      if (k > 0.35) this.move = 'idle';
    } else if (this.move === 'stomp') {
      // a cross little stomp before its mischief
      const h = Math.max(0, Math.sin((k / 0.5) * Math.PI)); y += h * 0.12 * this.height; lean = h * 0.2; if (k > 0.42 && k < 0.5) { sy = 0.86; sx = 1.08; }
      if (k > 0.55) this.move = 'idle';
    } else if (this.move === 'sad') {
      sy = 0.92; lean = -0.12;
      if (k > 2) this.move = 'idle';
    }
    // (a rigged one breathes with its chest)
    const breathe = this.move === 'idle' && !this.anim ? 1 + Math.sin(t * (this.basePose === 'sleep' ? 1.2 : 2.4 - this.droop) + this.bob) * (this.basePose === 'sleep' ? 0.03 : 0.015) : 1;
    this.look.uFlash.value = Math.max(this.hold, this.look.uFlash.value - dt * 3);
    this.inner.position.y = y;
    this.inner.scale.set(sx * breathe, sy / breathe * (1 - this.droop * 0.05), sx * breathe);
    this.inner.rotation.set(lean + this.droop * 0.1 + (this.droop > 0.3 ? Math.sin(t * 0.7) * 0.03 : 0), spin + (this.droop > 0.3 ? Math.sin(t * 0.5 + this.bob) * 0.15 : 0), 0);
    if (this.face) {
      const w = this.root.getWorldPosition(new THREE.Vector3());
      const want = Math.atan2(this.face.x - w.x, this.face.z - w.z);
      let d = want - this.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.root.rotation.y += d * Math.min(1, dt * 6);
    }
    if (this.anim) {
      // its head turns to what it's looking at (the body turns with `face`)
      if (this.lookAt) {
        const h = this.headAt(_v), q = this.root.getWorldQuaternion(_q).invert();
        const d = _d.subVectors(this.lookAt, h).applyQuaternion(q);
        this.anim.look = { yaw: Math.atan2(d.x, d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) };
        if (Math.abs(this.anim.look.yaw) > 2) this.anim.look = null;
      } else this.anim.look = null;
      this.anim.droop = this.droop;
      this.anim.update(dt, t);
    }
  }

  /** An attack's puff of its element from its mouth (sparks, snowflakes, drops, leaves, pebbles). */
  private puff() {
    if (!this.fx) return;
    const el = GLIMMER[this.id].element, s = this.root.getWorldScale(_v).y;
    const fwd = new THREE.Vector3(0, 0.15, 1).applyQuaternion(this.root.getWorldQuaternion(_q)).normalize();
    const at = this.headAt(new THREE.Vector3()).addScaledVector(fwd, this.height * 0.25 * s);
    this.fx.emit({ at, count: 18, shape: PUFF[el].shape, color: PUFF[el].color, dir: fwd, spread: 0.45, speed: [1.2, 2.6], life: [0.35, 0.7], size: [0.05 * s, 0.11 * s], drag: 2.2, spin: 3 });
  }

  dispose() {
    this.root.removeFromParent();
    this.skinned?.skeleton.dispose();
    // the model's geometry is shared with the loaded file (cached): only the cloned materials are ours
    this.root.traverse(o => { const mm = o as THREE.Mesh; if (mm.isMesh) { const mt = mm.material as THREE.Material | THREE.Material[]; if (Array.isArray(mt)) mt.forEach(x => x.dispose()); else mt?.dispose(); } });
  }
}

const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
