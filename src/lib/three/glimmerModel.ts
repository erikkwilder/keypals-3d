// A Glimmer in 3D: its model (made from its painting), brought to life without a skeleton. The model's
// head, tail, wings and ears were measured (public/models/glimmers/meta.json), and a little vertex
// program nods the head, wags the tail, flaps the wings and flops the ears; on top of that the whole body
// breathes, bobs (floaters hover), hops, spins and squashes like a cartoon. An evolved one is bigger and
// glows: its element's painted markings run over its body (mapped from three sides, pulsing softly), its
// edges shine in its element's colour, and little leaves, flakes, sparks, drops or crystals float round it.
import * as THREE from 'three';
import { loadGltf, loadTexture } from './assets';
import type { Fx, Shape } from './fx';
import { ELEMENT, GLIMMER, type Element, type GlimmerId } from '../adventure/glimmers';

/** What floats round an evolved Glimmer. */
const AURA: Record<Element, Shape[]> = { tide: ['drop', 'dot'], frost: ['flake', 'star'], sun: ['spark', 'star'], leaf: ['leaf', 'petal'], stone: ['shard', 'dot'] };
let blank: THREE.DataTexture | null = null;
const blankTex = () => (blank ??= Object.assign(new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1), { needsUpdate: true }));

type Meta = { height: number; head: number[]; tail: number[] | null; wings: number[][] | null; ears: number[][] | null; floats: boolean };
let metaP: Promise<Record<string, Meta>> | null = null;
function metas(): Promise<Record<string, Meta>> {
  metaP ??= fetch(`${import.meta.env.BASE_URL}models/glimmers/meta.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  return metaP;
}

type Move = 'idle' | 'hop' | 'happy' | 'act' | 'appear' | 'sad' | 'hit' | 'stomp';

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

  private constructor(id: GlimmerId) { this.id = id; this.root.add(this.inner); this.inner.scale.setScalar(0.001); }

  /** `height`: how tall it stands in the scene (metres); an evolved one stands a fifth taller. */
  static async create(id: GlimmerId, height = 0.6, opts: { evolved?: boolean } = {}): Promise<GlimmerModel> {
    const g = new GlimmerModel(id);
    const el = GLIMMER[id].element;
    g.evolved = !!opts.evolved;
    g.height = height * (g.evolved ? 1.2 : 1);
    const [gl, meta, shine] = await Promise.all([loadGltf(`models/glimmers/${id}.glb`), metas(), g.evolved ? loadTexture(`game/shine-${el}.webp`) : Promise.resolve(null)]);
    if (shine) {
      // mirrored tiling: the painted swatch never shows a seam
      if (shine.wrapS !== THREE.MirroredRepeatWrapping) { shine.wrapS = shine.wrapT = THREE.MirroredRepeatWrapping; shine.needsUpdate = true; }
      g.look.uShineMap.value = shine; g.look.uShine.value = 1; g.look.uShineCol.value.set(ELEMENT[el].color);
    }
    const m = meta[id];
    if (gl) g.build(gl.scene.clone(true), m); else g.placeholder();
    g.ready = true;
    return g;
  }

  private build(scene: THREE.Object3D, m: Meta | undefined) {
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
        c.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, u, this.look);
          sh.vertexShader = WIGGLE + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + WIGGLE_BODY);
          // grumpy: drained of colour, a little dark and blue; a white flash when cheer lands
          sh.fragmentShader = 'uniform float uGrey; uniform float uFlash; uniform float uT; uniform float uShine; uniform sampler2D uShineMap; uniform vec3 uShineCol;\nvarying vec3 vSPos; varying vec3 vSNrm;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
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
    // stand it on the ground, centred, facing +z
    const wrap = new THREE.Group();
    scene.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    wrap.add(scene); wrap.scale.setScalar(k);
    this.inner.add(wrap);
    // a soft glow of its element under it
    this.addGlow(ELEMENT[el].color);
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

  play(m: Move) { this.move = m; this.mt = 0; }

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
    } else if (this.move === 'act') {
      lean = Math.sin(Math.min(1, k / 0.5) * Math.PI) * 0.35; sy = 1 - lean * 0.15; sx = 1 + lean * 0.1;
      if (k > 0.5) this.move = 'idle';
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
    const breathe = this.move === 'idle' ? 1 + Math.sin(t * (2.4 - this.droop) + this.bob) * 0.015 : 1;
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
  }

  dispose() {
    this.root.removeFromParent();
    // the model's geometry is shared with the loaded file (cached): only the cloned materials are ours
    this.root.traverse(o => { const mm = o as THREE.Mesh; if (mm.isMesh) { const mt = mm.material as THREE.Material | THREE.Material[]; if (Array.isArray(mt)) mt.forEach(x => x.dispose()); else mt?.dispose(); } });
  }
}

const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
