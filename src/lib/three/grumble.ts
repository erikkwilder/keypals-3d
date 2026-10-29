// A Grumble: a Glimmer caught in storm weather, now a puffy grey cloud with a pout. As it cheers up its
// cloud whitens, the brows lift, the frown turns into a grin, the rain thins out, and the Glimmer inside
// shows through as a glow in its rarity's colour. Champions are bigger, wear a crown, and their cloud takes
// the shape of the Legendary inside (a fox, a drake, a whale).
import * as THREE from 'three';

export type CloudShape = 'round' | 'fox' | 'drake' | 'whale';
type Puff = [number, number, number, number, number?, number?, number?]; // x y z r, stretch x y z

const ROUND: Puff[] = [[0, 0, 0, 0.62], [-0.55, -0.06, 0.04, 0.45], [0.56, -0.04, 0.02, 0.47], [-0.27, 0.34, 0, 0.42], [0.26, 0.37, -0.02, 0.45], [0, 0.14, -0.3, 0.5],
  [-0.86, -0.2, -0.02, 0.3], [0.88, -0.18, 0, 0.3], [0, -0.28, 0.12, 0.44], [-0.45, -0.3, 0.12, 0.3], [0.45, -0.3, 0.1, 0.32], [0.02, 0.56, -0.12, 0.3]];
const SHAPES: Record<CloudShape, Puff[]> = {
  round: ROUND,
  fox: [...ROUND, [-0.36, 0.78, 0, 0.17, 1, 1.9, 0.8], [0.36, 0.78, 0, 0.17, 1, 1.9, 0.8], [0.95, 0.05, -0.35, 0.26], [1.18, 0.32, -0.45, 0.23], [1.3, 0.62, -0.5, 0.2], [1.02, -0.15, -0.55, 0.22], [1.25, -0.02, -0.75, 0.19]],
  drake: [...ROUND, [-0.3, 0.82, 0.02, 0.1, 1, 2.4, 1], [0.3, 0.82, 0.02, 0.1, 1, 2.4, 1], [-1.1, 0.38, -0.25, 0.42, 1.5, 0.6, 0.35], [1.1, 0.38, -0.25, 0.42, 1.5, 0.6, 0.35], [0.1, -0.2, -0.85, 0.3], [0.2, -0.05, -1.25, 0.22]],
  whale: [[-0.95, 0, 0, 0.55], [-0.35, 0.06, 0, 0.66], [0.32, 0.02, 0, 0.62], [0.95, -0.02, 0, 0.48], [1.38, 0.04, 0, 0.32], [1.75, 0.3, 0, 0.22, 1.7, 0.7, 0.6], [1.75, -0.18, 0, 0.22, 1.7, 0.7, 0.6],
    [-0.5, 0.48, -0.05, 0.38], [0.15, 0.55, -0.05, 0.4], [0.7, 0.42, -0.05, 0.34], [-0.3, -0.4, 0.3, 0.2, 1.8, 0.6, 1], [-0.65, -0.32, 0.1, 0.36], [0.1, -0.36, 0.1, 0.4], [0.75, -0.3, 0.05, 0.32]],
};

const STORM = new THREE.Color(0x868da6), HAPPY = new THREE.Color(0xf7f9ff), RIM_STORM = new THREE.Color(0xc4d0ff), RIM_HAPPY = new THREE.Color(0xfff2d6);

export class Grumble {
  readonly root = new THREE.Group();
  /** the cloud and face, which squash and wobble */
  private body = new THREE.Group();
  private puffs: { mesh: THREE.Mesh; base: THREE.Vector3; r: number; ph: number; s: THREE.Vector3 }[] = [];
  private mat: THREE.MeshStandardMaterial;
  private uniforms = { uT: { value: 0 }, uRim: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uGlowAmt: { value: 0 }, uFlash: { value: 0 } };
  private face = new THREE.Group();
  private eyes: { white: THREE.Mesh; pupil: THREE.Mesh; shine: THREE.Mesh }[] = [];
  private brows: THREE.Mesh[] = [];
  private cheeks: THREE.Mesh[] = [];
  private mouthLine: THREE.Mesh; private mouthOpen: THREE.Mesh; private mouthCurve = 99;
  private darkMat = new THREE.MeshStandardMaterial({ color: 0x2b2440, roughness: 0.5 });
  private rain: THREE.LineSegments; private rainPos: Float32Array; private rainN = 90;
  private crown: THREE.Group | null = null;
  /** 1 = as grumpy as can be, 0 = cheered right up */
  mood = 1; private shown = 1;
  private squash = 0; private squashV = 0; private lunge = 0; private blink = 0; private hurt = 0; private laughT = 0;
  private bursting = -1;
  readonly size: number;
  /** where it looks (its buddy) */
  lookAt = new THREE.Vector3();

  constructor(o: { shape?: CloudShape; champion?: boolean; glow: THREE.ColorRepresentation }) {
    const shape = o.shape ?? 'round';
    this.size = o.champion ? 1.2 : 0.78;
    this.uniforms.uGlow.value.set(o.glow);
    this.mat = new THREE.MeshStandardMaterial({ color: STORM.clone(), roughness: 0.95, metalness: 0 });
    this.mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(position, 1.0);
        transformed += normal * (sin(wp.x * 5.0 + uT * 1.4) * sin(wp.y * 6.0 + uT * 1.1) * 0.025 + sin(wp.z * 7.0 - uT * 0.9) * 0.012);`);
      sh.fragmentShader = 'uniform vec3 uRim; uniform vec3 uGlow; uniform float uGlowAmt; uniform float uFlash;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        gl_FragColor.rgb += uRim * pow(1.0 - facing, 2.2) * 0.55;
        gl_FragColor.rgb += uGlow * pow(facing, 1.6) * uGlowAmt;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), uFlash);`);
    };
    this.mat.customProgramCacheKey = () => 'grumble';
    const sphere = new THREE.SphereGeometry(1, 28, 20);
    SHAPES[shape].forEach(([x, y, z, r, sx = 1, sy = 1, sz = 1], i) => {
      const m = new THREE.Mesh(sphere, this.mat);
      m.position.set(x, y, z); m.castShadow = true;
      const s = new THREE.Vector3(r * sx, r * sy, r * sz); m.scale.copy(s);
      this.body.add(m);
      this.puffs.push({ mesh: m, base: m.position.clone(), r, ph: i * 1.7, s });
    });
    // the face, on the front of the cloud (whale: on its front end)
    const front = shape === 'whale' ? new THREE.Vector3(-0.95, 0.05, 0.5) : new THREE.Vector3(0, 0.06, 0.6);
    this.face.position.copy(front);
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
    const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const ball = new THREE.SphereGeometry(1, 24, 18);
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(ball, white); w.scale.set(0.15, 0.17, 0.08); w.position.set(side * 0.19, 0.06, 0.03);
      const p = new THREE.Mesh(ball, this.darkMat); p.scale.set(0.085, 0.1, 0.05); p.position.set(side * 0.19, 0.04, 0.09);
      const sh2 = new THREE.Mesh(ball, shine); sh2.scale.setScalar(0.028); sh2.position.set(side * 0.19 + 0.03, 0.08, 0.13);
      this.face.add(w, p, sh2);
      this.eyes.push({ white: w, pupil: p, shine: sh2 });
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.15, 4, 10), this.darkMat);
      brow.rotation.z = Math.PI / 2; brow.position.set(side * 0.2, 0.27, 0.07);
      this.face.add(brow); this.brows.push(brow);
      const ch = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), new THREE.MeshBasicMaterial({ color: 0xff8fb0, transparent: true, opacity: 0.35, depthWrite: false }));
      ch.position.set(side * 0.36, -0.1, 0.05); ch.scale.y = 0.7;
      this.face.add(ch); this.cheeks.push(ch);
    }
    this.mouthLine = new THREE.Mesh(new THREE.BufferGeometry(), this.darkMat);
    this.mouthOpen = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0x5a1f35, roughness: 0.6, side: THREE.DoubleSide }));
    this.face.add(this.mouthLine, this.mouthOpen);
    this.body.add(this.face);
    this.root.add(this.body);
    // rain under the cloud
    this.rainPos = new Float32Array(this.rainN * 6);
    for (let i = 0; i < this.rainN; i++) this.resetDrop(i, true);
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.75, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.root.add(this.rain);
    if (o.champion) this.addCrown(shape === 'whale' ? new THREE.Vector3(-0.45, 0.85, 0) : new THREE.Vector3(0, 0.88, -0.05));
    this.root.scale.setScalar(this.size);
    this.setMouth(-1);
  }

  private addCrown(at: THREE.Vector3) {
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc933, metalness: 0.9, roughness: 0.22, emissive: 0x6a4500, emissiveIntensity: 0.4 });
    const c = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.13, 32, 1, true), gold); band.material.side = THREE.DoubleSide; c.add(band);
    const gems = [0xff3d6e, 0x38c6ff, 0x7dff8a, 0xb26bff, 0xffffff];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 10), gold); spike.position.set(Math.cos(a) * 0.25, 0.15, Math.sin(a) * 0.25); c.add(spike);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), gold); ball.position.set(Math.cos(a) * 0.25, 0.27, Math.sin(a) * 0.25); c.add(ball);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), new THREE.MeshStandardMaterial({ color: gems[i], metalness: 0.3, roughness: 0.1, emissive: gems[i], emissiveIntensity: 0.6 }));
      gem.position.set(Math.cos(a + 0.6) * 0.262, 0, Math.sin(a + 0.6) * 0.262); c.add(gem);
    }
    c.position.copy(at); c.rotation.z = -0.15;
    this.body.add(c); this.crown = c;
  }

  private resetDrop(i: number, anywhere = false) {
    const w = 1.5, a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.75;
    const x = Math.cos(a) * r * w * 0.8, z = Math.sin(a) * r * 0.5, y = anywhere ? -0.3 - Math.random() * 1.6 : -0.35;
    this.rainPos.set([x, y, z, x - 0.02, y - 0.16, z], i * 6);
  }

  /** The mouth: -1 a frown, 0 flat, 1 a grin (open when happy). */
  private setMouth(c: number) {
    if (Math.abs(c - this.mouthCurve) < 0.04) return;
    this.mouthCurve = c;
    const y = -0.14, w = 0.13 + Math.max(0, c) * 0.05;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-w, y + c * 0.03, 0.06), new THREE.Vector3(0, y - c * 0.09, 0.09), new THREE.Vector3(w, y + c * 0.03, 0.06));
    this.mouthLine.geometry.dispose();
    this.mouthLine.geometry = new THREE.TubeGeometry(curve, 16, 0.024, 6);
    // a happy open mouth: the space between the smile and a flatter top lip
    this.mouthOpen.geometry.dispose();
    if (c > 0.45) {
      const open = (c - 0.45) / 0.55;
      const s = new THREE.Shape();
      s.moveTo(-w, y + c * 0.03); s.quadraticCurveTo(0, y + c * 0.03 + 0.015, w, y + c * 0.03);
      s.quadraticCurveTo(0, y - c * 0.09 * 2 * (0.6 + open * 0.6), -w, y + c * 0.03);
      this.mouthOpen.geometry = new THREE.ShapeGeometry(s, 12);
      this.mouthOpen.position.z = 0.075;
    } else this.mouthOpen.geometry = new THREE.BufferGeometry();
  }

  /** A hit of cheer: a squash, a flash, eyes squeezed for a moment. `k` 0..1 how big. */
  hit(k = 0.6) { this.squashV += 5 + k * 9; this.hurt = 0.35; this.uniforms.uFlash.value = 0.55; }
  /** Wind up and lunge toward its buddy (mischief). */
  attack() { this.lunge = 1; }
  /** A mean little bounce of laughter (you lost). */
  laugh() { this.laughT = 1.6; }
  /** Cheered right up: it puffs out into sparkles. */
  burst() { this.bursting = 0; }
  get burstDone() { return this.bursting >= 0.9; }

  update(dt: number, t: number) {
    this.uniforms.uT.value = t;
    this.shown += (this.mood - this.shown) * Math.min(1, dt * 3);
    const m = this.shown, happy = 1 - m;
    this.mat.color.copy(STORM).lerp(HAPPY, Math.pow(happy, 0.8));
    this.uniforms.uRim.value.copy(RIM_STORM).lerp(RIM_HAPPY, happy);
    this.uniforms.uGlowAmt.value = 0.06 + Math.pow(happy, 1.4) * 0.85;
    this.uniforms.uFlash.value = Math.max(0, this.uniforms.uFlash.value - dt * 3);
    // squash spring
    this.squashV += (-this.squash * 90 - this.squashV * 9) * dt;
    this.squash += this.squashV * dt;
    const sq = this.squash * 0.06;
    // bob, breathe, lunge, laugh
    this.lunge = Math.max(0, this.lunge - dt * 1.6);
    const lungeX = this.lunge > 0.6 ? -(1 - this.lunge) * 0.6 : Math.sin(this.lunge / 0.6 * Math.PI) * 0.45 * (this.lunge > 0 ? 1 : 0);
    this.laughT = Math.max(0, this.laughT - dt);
    const laugh = this.laughT > 0 ? Math.abs(Math.sin(t * 16)) * 0.12 : 0;
    this.body.position.set(-lungeX, Math.sin(t * 1.6) * 0.06 + laugh, 0);
    this.body.rotation.z = Math.sin(t * 0.9) * 0.04 + this.lunge * 0.1;
    this.body.scale.set(1 + sq, 1 - sq, 1 + sq * 0.5);
    for (const p of this.puffs) {
      const b = 1 + Math.sin(t * 2.1 + p.ph) * 0.035 * (0.5 + m);
      p.mesh.scale.copy(p.s).multiplyScalar(b);
      if (this.bursting >= 0) { const k = this.bursting; p.mesh.position.copy(p.base).multiplyScalar(1 + k * 2.2); p.mesh.scale.multiplyScalar(Math.max(0.001, 1 - k * 1.1)); }
    }
    if (this.bursting >= 0) { this.bursting = Math.min(1, this.bursting + dt * 1.4); this.face.visible = this.bursting < 0.25; if (this.crown) this.crown.visible = this.bursting < 0.3; }
    // the face: brows from cross to happy arches, pupils on its buddy, a blink now and then
    const browTilt = m * 0.55 - happy * 0.35;
    this.brows.forEach((b, i) => { const side = i ? 1 : -1; b.rotation.z = Math.PI / 2 + side * browTilt; b.position.y = 0.27 + happy * 0.06 - m * 0.02; b.position.x = side * (0.19 + m * 0.01); });
    this.setMouth(Math.max(-1, Math.min(1, 1 - 2.2 * m)));
    this.cheeks.forEach(c => ((c.material as THREE.MeshBasicMaterial).opacity = 0.18 + happy * 0.55));
    this.blink -= dt;
    if (this.blink < -3 - Math.random() * 2) this.blink = 0.13;
    this.hurt = Math.max(0, this.hurt - dt);
    const lid = this.blink > 0 || this.hurt > 0 ? 0.15 : 1 - m * 0.18;
    const local = this.face.worldToLocal(this.lookAt.clone());
    const dir = local.normalize();
    this.eyes.forEach((e, i) => {
      const side = i ? 1 : -1;
      e.white.scale.y = 0.17 * lid; e.pupil.scale.y = 0.1 * lid; e.shine.visible = lid > 0.5;
      e.pupil.position.set(side * 0.19 + dir.x * 0.04, 0.04 + dir.y * 0.03 - m * 0.015, 0.09);
      e.shine.position.set(side * 0.19 + 0.03 + dir.x * 0.04, 0.08 + dir.y * 0.03, 0.13);
    });
    // rain: heavy when grumpy, gone when happy
    const n = Math.round(this.rainN * Math.max(0, (m - 0.12) / 0.88));
    for (let i = 0; i < this.rainN; i++) {
      const y = this.rainPos[i * 6 + 1] - dt * 3.2;
      if (y < -2.2) this.resetDrop(i); else { this.rainPos[i * 6 + 1] = y; this.rainPos[i * 6 + 4] = y - 0.16; }
    }
    this.rain.geometry.setDrawRange(0, this.bursting >= 0 ? 0 : n * 2);
    (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.rain.position.copy(this.body.position);
  }

  dispose() {
    this.root.removeFromParent();
    this.root.traverse(o => { const mm = o as THREE.Mesh; if (mm.geometry) mm.geometry.dispose(); const mt = mm.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mt)) mt.forEach(x => x.dispose()); else mt?.dispose(); });
  }
}
