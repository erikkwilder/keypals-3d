// A 3D buddy: the model (weights redone in Blender so raised arms stay round), its moves, a colour
// lift for the scanned textures, and two fixes applied every frame: planted feet are turned flat on
// the ground, and the character never casts shadows on itself (that's what flickered on faces).
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { loadGltf } from './assets';
import { FRIEND, type FriendId } from '../art/cast';

import { CLIP_NAMES as MOVE } from './clipNames';
const ONCE = new Set(['cheer', 'jump', 'wave', 'fistpump', 'wave1']);
/** extra moves: the seated pose for rides, celebrations and dances, loaded the first time they're needed */
export const MOVE_FILES = ['moves'];

type Loaded = { scene: THREE.Group; clips: THREE.AnimationClip[] };
const sources = new Map<FriendId, Promise<Loaded | null>>();
function source(id: FriendId) {
  let p = sources.get(id);
  if (!p) {
    p = loadGltf(`models/${id}.glb`).then(g => {
      if (!g) return null;
      g.scene.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) liftColours(o as THREE.SkinnedMesh); });
      return { scene: g.scene, clips: g.animations };
    });
    sources.set(id, p);
  }
  return p;
}
const moveSets = new Map<string, Promise<THREE.AnimationClip[]>>();
function moves(id: FriendId) {
  let p = moveSets.get(id);
  if (!p) {
    // the Meshy moves, and the dances remapped from Mixamo and Sketchfab (tools/blender/retarget.py)
    // (and climbing and swimming for the math courses, copied the same way)
    p = Promise.all([loadGltf(`models/${id}-moves.glb`), loadGltf(`models/${id}-dances.glb`), loadGltf(`models/${id}-moves2.glb`)]).then(gs => gs.flatMap(g => g?.animations ?? []));
    moveSets.set(id, p);
  }
  return p;
}

/** The scanned textures read drab on screen: lift saturation and a touch of brightness in the shader. */
function liftColours(m: THREE.SkinnedMesh, vivid = 1.28, bright = 1.06) {
  const mats = Array.isArray(m.material) ? m.material : [m.material];
  for (const mat of mats) {
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        { float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)); diffuseColor.rgb = max(vec3(0.0), mix(vec3(l), diffuseColor.rgb, ${vivid.toFixed(3)})) * ${bright.toFixed(3)}; }`);
    };
    mat.customProgramCacheKey = () => 'kp-lift';
    const mm = mat as THREE.MeshStandardMaterial;
    if (mm.map) mm.map.anisotropy = 8;
  }
}

/** Shared looks: smooth mode (older computers) has no real shadows, so each buddy gets a soft blob under its feet. */
export const charLook = { blob: false };
let blobParts: { geo: THREE.CircleGeometry; mat: THREE.MeshBasicMaterial } | null = null;
function blobMesh() {
  if (!blobParts) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(30,40,20,0.5)'); grad.addColorStop(1, 'rgba(30,40,20,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    blobParts = { geo: new THREE.CircleGeometry(1, 24), mat: new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }) };
  }
  const m = new THREE.Mesh(blobParts.geo, blobParts.mat);
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.visible = false;
  return m;
}

type Foot = { foot: THREE.Bone; toe: THREE.Bone | null; bindQ: THREE.Quaternion; toeBindLocal: THREE.Quaternion | null; bindY: number };

export class Character {
  readonly id: FriendId;
  readonly root = new THREE.Group();
  readonly model: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer;
  readonly actions: Record<string, THREE.AnimationAction> = {};
  readonly bones: Record<string, THREE.Bone> = {};
  /** metres a second each gait really travels, so feet don't skate */
  speedOf: Record<string, number> = {};
  scale = 1;
  current: THREE.AnimationAction | null = null;
  currentName = '';
  /** flatten planted feet (off while seated on a ride) */
  groundFeet = true;
  private feet: Foot[] = [];
  /** every bone's turn in the bind pose (standing straight), for sitting up straight on rides */
  private bindQ = new Map<THREE.Bone, THREE.Quaternion>();
  private outfit: THREE.Object3D | null = null;
  private blob: THREE.Mesh;
  outfitId = 'none';
  /** worn things that move on their own every frame (gear3d: a cape's sway, bubbles, flames) */
  readonly tickers = new Set<(dt: number) => void>();

  private constructor(id: FriendId, model: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.id = id;
    this.model = model;
    this.root.add(model);
    model.traverse(o => {
      if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; }
      if ((o as THREE.Bone).isBone) this.bones[o.name] = o as THREE.Bone;
    });
    for (const b of Object.values(this.bones)) this.bindQ.set(b, b.quaternion.clone());
    // size from the skinned vertices (Meshy's armature is in centimetres, so the plain box is wrong)
    model.updateMatrixWorld(true);
    const box = new THREE.Box3();
    model.traverse(o => {
      const s = o as THREE.SkinnedMesh;
      if (s.isSkinnedMesh) { s.skeleton.update(); s.computeBoundingBox(); box.union(s.boundingBox!.clone().applyMatrix4(s.matrixWorld)); }
    });
    this.scale = FRIEND[id].height / box.getSize(new THREE.Vector3()).y;
    this.blob = blobMesh();
    this.blob.scale.setScalar(FRIEND[id].height * 0.32);
    this.root.add(this.blob);
    model.scale.setScalar(this.scale);
    model.position.y = -box.min.y * this.scale;
    model.updateMatrixWorld(true);
    this.mixer = new THREE.AnimationMixer(model);
    this.addClips(clips);
    for (const k of ['walk', 'run', 'sprint']) this.speedOf[k] = this.gaitSpeed(k);
    this.mixer.stopAllAction();
    // measuring the gaits ran the clock on: back to zero, or the first move's fade-in would be scheduled
    // in the future and the buddy would stand in its stiff bind pose until the clock caught up
    this.mixer.setTime(0);
    this.addEyes();
    // feet as they stand in the bind pose (flat on the ground)
    model.updateMatrixWorld(true);
    for (const side of ['Left', 'Right']) {
      const foot = this.bones[`${side}Foot`], toe = this.bones[`${side}ToeBase`] ?? null;
      if (!foot) continue;
      this.feet.push({
        foot, toe,
        bindQ: foot.getWorldQuaternion(new THREE.Quaternion()),
        toeBindLocal: toe ? toe.quaternion.clone() : null,
        bindY: foot.getWorldPosition(new THREE.Vector3()).y,
      });
    }
  }

  /** Glowing eyes for a face hidden in a hood (Scruff): two little lights fixed to the head bone. */
  private addEyes() {
    const e = FRIEND[this.id].eyes, head = this.bones.Head;
    if (!e || !head) return;
    this.model.updateMatrixWorld(true);
    const hp = head.getWorldPosition(new THREE.Vector3());
    const geo = new THREE.SphereGeometry(1, 16, 12);
    const mat = new THREE.MeshBasicMaterial({ color: e.color, toneMapped: false });
    const glow = new THREE.MeshBasicMaterial({ color: e.color, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false });
    for (const side of [-1, 1]) {
      // placed in world space in the bind pose (the model faces +z), then kept in the head bone's space
      const w = hp.clone().add(new THREE.Vector3((e.x ?? 0) + side * e.gap / 2, e.up, e.fwd));
      const eye = new THREE.Mesh(geo, mat), halo = new THREE.Mesh(geo, glow);
      const local = head.worldToLocal(w.clone());
      const s = head.getWorldScale(new THREE.Vector3()).x || 1;
      eye.position.copy(local); eye.scale.setScalar(e.size / s); eye.scale.y *= 1.25;
      halo.position.copy(local); halo.scale.setScalar((e.size * 1.9) / s);
      head.add(eye, halo);
    }
  }

  static async create(id: FriendId): Promise<Character | null> {
    const src = await source(id);
    if (!src) return null;
    const model = cloneSkinned(src.scene);
    return new Character(id, model, src.clips);
  }

  private addClips(clips: THREE.AnimationClip[]) {
    for (const clip of clips) {
      const key = MOVE[clip.name] ?? clip.name.replace(/^Armature\|/, '').toLowerCase();
      if (this.actions[key]) continue;
      const a = this.mixer.clipAction(clip);
      if (ONCE.has(key)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions[key] = a;
    }
  }

  /** The extra moves (seated pose, dances), loaded once per buddy. */
  async loadMoves() {
    const clips = await moves(this.id);
    // dances and sitting stay in one place: drop any drift of the hips across the ground
    for (const c of clips) for (const tr of c.tracks) {
      if (tr.name.endsWith('Hips.position')) {
        const v = tr.values, first = [v[0], v[2]];
        for (let i = 0; i < v.length; i += 3) { v[i] = first[0]; v[i + 2] = first[1]; }
        // climbing moves the hips up through the cycle; the course does the rising, so take that out
        // (or the buddy drops back down every time the move starts over)
        if (c.name === 'climb') { const n = v.length / 3, y0 = v[1], yN = v[v.length - 2]; for (let k = 0; k < n; k++) v[k * 3 + 1] -= ((yN - y0) * k) / Math.max(1, n - 1); }
      }
    }
    this.addClips(clips);
  }

  /** Shown in shadowy black and white (a buddy who hasn't joined the team yet). */
  shadowed() {
    this.model.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const one = (mat: THREE.Material) => {
        const c = mat.clone();
        c.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
            float grey = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
            gl_FragColor.rgb = mix(vec3(0.16, 0.17, 0.22), vec3(0.62, 0.64, 0.7), smoothstep(0.0, 0.9, grey));`);
        };
        c.customProgramCacheKey = () => 'shadowed';
        return c;
      };
      m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
    });
  }

  has(name: string) { return !!this.actions[name]; }

  play(name: string, fade = 0.3, timeScale = 1) {
    const a = this.actions[name];
    if (!a) return null;
    if (this.current === a) { a.timeScale = timeScale; return a; }
    a.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1).fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = a;
    this.currentName = name;
    return a;
  }

  /** Sit up straight: hips, back, neck and head back to their bind-pose turn (the sitting move slouches). */
  uprightSpine(amount = 1) {
    for (const n of ['Hips', 'Spine', 'Spine01', 'Spine02', 'neck', 'Head']) {
      const b = this.bones[n], q = b && this.bindQ.get(b);
      if (b && q) b.quaternion.slerp(q, amount);
    }
    this.model.updateMatrixWorld(true);
  }

  /** True once a play-once move has reached its end. */
  finished(name: string) {
    const a = this.actions[name];
    return !!a && this.current === a && a.time >= a.getClip().duration - 0.02;
  }

  /** How fast a gait carries the body: the speed a planted toe slides backward under the hips. */
  private gaitSpeed(name: string) {
    const a = this.actions[name], toe = this.bones.LeftToeBase ?? this.bones.LeftFoot, hips = this.bones.Hips;
    if (!a || !toe || !hips) return 2;
    this.mixer.stopAllAction();
    a.reset().play();
    const dur = a.getClip().duration, n = 120, rel: number[] = [], low: number[] = [];
    const tp = new THREE.Vector3(), hp = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      this.mixer.setTime((i / n) * dur);
      this.model.updateMatrixWorld(true);
      toe.getWorldPosition(tp); hips.getWorldPosition(hp);
      rel.push(tp.z - hp.z); low.push(tp.y);
    }
    a.stop();
    const ymin = Math.min(...low), ymax = Math.max(...low), back: number[] = [];
    for (let i = 1; i <= n; i++) if (low[i] <= ymin + (ymax - ymin) * 0.2) back.push(-(rel[i] - rel[i - 1]) / (dur / n));
    back.sort((x, y) => x - y);
    const v = back.length ? back[Math.floor(back.length / 2)] : 0;
    return Math.max(0.5, name === 'sprint' ? v * 0.8 : v);
  }

  private q = new THREE.Quaternion(); private q2 = new THREE.Quaternion(); private rootQ = new THREE.Quaternion(); private v = new THREE.Vector3();

  /** Advance the moves, then lay planted feet flat (turned only about the up axis, as in the bind pose). */
  update(dt: number) {
    this.mixer.update(dt);
    for (const f of this.tickers) f(dt);
    // the blob only on the ground (seated on a ride, the ride is underneath)
    this.blob.visible = charLook.blob && this.groundFeet;
    if (!this.groundFeet || !this.feet.length) return;
    this.root.updateMatrixWorld(true);
    this.root.getWorldQuaternion(this.rootQ);
    const rootY = this.root.getWorldPosition(this.v).y;
    for (const f of this.feet) {
      const y = f.foot.getWorldPosition(this.v).y - rootY;
      const w = 1 - THREE.MathUtils.smoothstep(y, f.bindY + 0.02, f.bindY + 0.09);
      if (w <= 0.01) continue;
      // the foot's turn since the bind pose, keeping only its twist about the world's up axis
      const cur = f.foot.getWorldQuaternion(this.q);
      const bind = this.q2.copy(this.rootQ).multiply(f.bindQ);
      const d = cur.clone().multiply(bind.clone().invert());
      const twist = new THREE.Quaternion(0, d.y, 0, d.w).normalize();
      const want = twist.multiply(bind);
      cur.slerp(want, w);
      const parentQ = f.foot.parent!.getWorldQuaternion(new THREE.Quaternion());
      f.foot.quaternion.copy(parentQ.invert().multiply(cur));
      if (f.toe && f.toeBindLocal) f.toe.quaternion.slerp(f.toeBindLocal, w);
      f.foot.updateMatrixWorld(true);
    }
  }

  // ---------- outfits: hats and things worn on the head ----------
  private headFit: { top: THREE.Vector3; width: number; basis: THREE.Quaternion } | null = null;
  /**
   * Where the top of the head is, in the Head bone's own space, from the vertices the head moves, and
   * which way is up and forward there (the bone's axes aren't the world's).
   */
  private fitHead() {
    if (this.headFit) return this.headFit;
    const head = this.bones.Head;
    let mesh: THREE.SkinnedMesh | null = null;
    this.model.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh && !mesh) mesh = o as THREE.SkinnedMesh; });
    if (!head || !mesh) return null;
    const m = mesh as THREE.SkinnedMesh;
    const hi = m.skeleton.bones.indexOf(head);
    const pos = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
    // everything in the head bone's own space as it was when the skin was bound: bone space doesn't
    // change as the head moves, so a hat placed there rides along
    const toBone = m.skeleton.boneInverses[hi];
    const hq = new THREE.Quaternion();
    toBone.decompose(new THREE.Vector3(), hq, new THREE.Vector3());
    // world up and forward (the model faces +z), seen from inside the head bone
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(hq).normalize();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(hq).normalize();
    const side = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const p = new THREE.Vector3();
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === hi) w += sw.getComponent(i, k);
      if (w < 0.7) continue;
      p.fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix).applyMatrix4(toBone);
      pts.push(p.clone());
    }
    if (pts.length < 20) return null;
    const c = pts.reduce((a, q) => a.add(q), new THREE.Vector3()).divideScalar(pts.length);
    const across = (q: THREE.Vector3) => { const d = q.clone().sub(c); return Math.hypot(d.dot(side), d.dot(fwd)); };
    const widthSide = Math.max(...pts.map(q => q.clone().sub(c).dot(side))) - Math.min(...pts.map(q => q.clone().sub(c).dot(side)));
    const widthFwd = Math.max(...pts.map(q => q.clone().sub(c).dot(fwd))) - Math.min(...pts.map(q => q.clone().sub(c).dot(fwd)));
    // the crown: the highest head points near the middle (ears and spikes stick out to the sides)
    const core = pts.filter(q => across(q) < Math.min(widthSide, widthFwd) * 0.25);
    let topH = Math.max(...(core.length ? core : pts).map(q => q.clone().sub(c).dot(up)));
    if (FRIEND[this.id].hatOn === 'flat') {
      // a flat-topped head with things sticking up (feathers): the top is the highest level where
      // the head is still nearly full width
      const hs = pts.map(q => q.clone().sub(c).dot(up)), lo = Math.min(...hs), hi = Math.max(...hs), N = 40;
      const bins = Array.from({ length: N }, () => [Infinity, -Infinity]);
      pts.forEach((q, i) => { const b = Math.min(N - 1, Math.floor(((hs[i] - lo) / (hi - lo)) * N)), x = q.clone().sub(c).dot(side); bins[b][0] = Math.min(bins[b][0], x); bins[b][1] = Math.max(bins[b][1], x); });
      const widths = bins.map(([a, b]) => (b > a ? b - a : 0)), full = Math.max(...widths);
      for (let b = N - 1; b >= 0; b--) if (widths[b] >= full * 0.6) { topH = lo + ((b + 1) / N) * (hi - lo); break; }
    }
    const top = c.clone().addScaledVector(up, topH + (FRIEND[this.id].hatLift ?? 0) / Math.max(1e-6, this.scale));
    const basis = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, fwd));
    this.headFit = { top, width: Math.min(widthSide, widthFwd * 1.1), basis };
    return this.headFit;
  }

  /** the Wardrobe's Move it nudge for the hat (shares of the buddy's height, a size, a turn) */
  private hatN: { x: number; y: number; z: number; s: number; r: number } | null = null;
  /** Move, size and turn the hat about where it sits on the head (null: back to its own place). */
  nudgeHat(n: { x: number; y: number; z: number; s: number; r: number } | null) {
    this.hatN = n;
    const fit = this.headFit, h = this.outfit;
    if (!fit || !h) return;
    // the nudge is in the buddy's own directions (x to its left, y up, z forward); the hat's holder sits in
    // the head bone's space, so turn the offset into it, in the model's own units
    const u = FRIEND[this.id].height / Math.max(1e-6, this.scale), q = fit.basis;
    const off = new THREE.Vector3(n?.x ?? 0, n?.y ?? 0, n?.z ?? 0).multiplyScalar(u).applyQuaternion(q);
    h.position.copy(fit.top).add(off);
    h.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), n?.r ?? 0));
    h.scale.setScalar(n?.s ?? 1);
  }

  /** Put an outfit on the head; `make` builds a fresh copy of the outfit's model. */
  async wear(id: string, make: (id: string) => Promise<THREE.Object3D | null>) {
    if (id === this.outfitId) return;
    this.outfitId = id;
    if (this.outfit) { this.outfit.removeFromParent(); this.outfit = null; }
    if (id === 'none') return;
    const fit = this.fitHead(), head = this.bones.Head;
    const obj = await make(id);
    if (!obj || !fit || !head || this.outfitId !== id) return;
    const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3());
    const s = (fit.width * (obj.userData.fit ?? 0.8)) / Math.max(size.x, size.z);
    obj.scale.multiplyScalar(s);
    obj.position.set(-(box.min.x + size.x / 2) * s, -box.min.y * s - size.y * s * (obj.userData.sink ?? 0.18), -(box.min.z + size.z / 2) * s);
    const holder = new THREE.Group();
    holder.add(obj);
    holder.position.copy(fit.top);
    holder.quaternion.copy(fit.basis);
    holder.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    head.add(holder);
    this.outfit = holder;
    if (this.hatN) this.nudgeHat(this.hatN);
  }

  dispose() { this.mixer.stopAllAction(); this.root.removeFromParent(); }
}
