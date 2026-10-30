// My Sky Island's secrets in 3D (island/secrets.ts says what they are and when they show): the cave rock
// off the edge with a little waterfall over a crystal cave (facing the way the camera starts), the rock floating high and far with a star
// stone on it, the sparkle in the grass and the treasure chest under it, a bottle bobbing in a pond, a note
// a happy Glimmer left, a rain shower and the rainbow after it, the night sky (stars, a moon, fireflies),
// and the Sky Whale swimming past. Owned by three/islandScene.ts, which tells it what to show.
import * as THREE from 'three';
import { loadGltf, loadTexture } from './assets';
import { Fx } from './fx';
import { GlimmerModel } from './glimmerModel';
import { sfx } from '../audio/sound';
import { stones, glow as glowTex } from '../island/paint';
import type { Rock } from '../island/blocks';

type Keep = <T extends { dispose(): void }>(x: T) => T;
const rand = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

/** falling water, on the island's clock (the scene's waterfalls use the same look) */
export function fallMaterial(keep: Keep, uT: { value: number }, fade = 0.95): THREE.ShaderMaterial {
  return keep(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT, uA: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uT, uA; varying vec2 vUv;
      float n(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float sn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(n(i), n(i+vec2(1,0)), f.x), mix(n(i+vec2(0,1)), n(i+vec2(1,1)), f.x), f.y); }
      void main(){ float streak = sn(vec2(vUv.x * 10.0, vUv.y * 9.0 + uT * 2.6)) * 0.6 + sn(vec2(vUv.x * 24.0, vUv.y * 16.0 + uT * 4.0)) * 0.4;
        float side = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
        float fade = smoothstep(${fade.toFixed(2)}, 0.5, vUv.y) * smoothstep(0.0, 0.03, vUv.y);
        vec3 c = mix(vec3(0.58, 0.84, 0.96), vec3(1.0), smoothstep(0.35, 0.8, streak));
        gl_FragColor = vec4(c, uA * side * fade * (0.62 + 0.36 * streak));
        #include <colorspace_fragment>
      }`,
  }));
}

/** a floating rock: stone blocks tapering to a point, a grassy top at `top` */
function floatingRock(keep: Keep, stoneMat: THREE.Material, grassMat: THREE.Material, r: number, top: number, depth: number, seed: number): THREE.Group {
  const g = new THREE.Group(), rnd = rand(seed);
  const pts: THREE.Vector2[] = [];
  const prof: [number, number][] = [[1, 0], [1.02, 0.08], [0.95, 0.25], [0.82, 0.45], [0.62, 0.65], [0.38, 0.84], [0.12, 0.97], [0.001, 1]];
  for (const [k, d] of prof) pts.push(new THREE.Vector2(r * k * (0.95 + rnd() * 0.1), -d * depth));
  const body = new THREE.Mesh(keep(new THREE.LatheGeometry(pts, 14)), stoneMat);
  body.position.y = top - 0.06; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const cap = new THREE.Mesh(keep(new THREE.CylinderGeometry(r * 1.04, r * 1.0, 0.12, 18)), grassMat);
  cap.position.y = top - 0.05; cap.receiveShadow = true; cap.castShadow = true; g.add(cap);
  return g;
}

export class IslandSecrets {
  readonly root = new THREE.Group();
  private own: { dispose(): void }[] = [];
  private keep: Keep = (x) => { this.own.push(x); return x; };
  private fx: Fx;
  private uT: { value: number };
  private glowT!: THREE.Texture;
  // the cave
  private cave: { g: THREE.Group; left: THREE.Mesh; right: THREE.Mesh; shine: THREE.Sprite; mouth: THREE.Vector3; side: THREE.Vector3; open: number; mat: THREE.ShaderMaterial } | null = null;
  private star: { g: THREE.Group; gem: THREE.Mesh; at: THREE.Vector3 } | null = null;
  private sparkle: THREE.Group | null = null;
  private dug: { g: THREE.Group; lid: THREE.Object3D | null; t0: number; first: boolean; done: (() => void) | null } | null = null;
  private bottle: THREE.Group | null = null;
  private note: THREE.Group | null = null;
  private rain: { lines: THREE.LineSegments; pos: Float32Array; k: number; on: boolean; R: number } | null = null;
  private bow: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; k: number; on: boolean } | null = null;
  private sky: { stars: THREE.Points; moon: THREE.Sprite; flies: { s: THREE.Sprite; p: THREE.Vector3; v: THREE.Vector3; ph: number }[]; k: number } | null = null;
  private whaleM: { m: GlimmerModel; t0: number; from: THREE.Vector3; to: THREE.Vector3; done: () => void } | null = null;
  private now = 0;
  private rimR = 6;

  constructor(fx: Fx, uT: { value: number }) { this.fx = fx; this.uT = uT; }

  /** The two rocks off the edge (built once; `caveOpen`: the cave was found before). */
  async build(rocks: { cave: Rock; sky: Rock }, rimR: number, caveOpen: boolean) {
    const keep = this.keep;
    this.rimR = rimR;
    this.glowT = glowTex(keep);
    const grassT = await loadTexture('world/grass.webp', { repeat: true });
    const stoneMat = keep(new THREE.MeshStandardMaterial({ map: stones(keep, { big: true, seed: 53 }), roughness: 0.95 }));
    const grassMat = keep(new THREE.MeshStandardMaterial({ map: grassT, color: 0xd8f5b8, roughness: 0.95 }));
    // ---- the cave rock: its cave faces the island, a little waterfall pours over the mouth ----
    const k = rocks.cave, g = floatingRock(keep, stoneMat, grassMat, k.r, k.top, 3.4, 7);
    g.position.set(k.x, 0, k.z);
    // (the cave looks out toward where the camera starts, so the little waterfall shows from the island)
    const toIsland = new THREE.Vector3(0.3, 0, 1).normalize(), side = new THREE.Vector3(-toIsland.z, 0, toIsland.x);
    const mouth = toIsland.clone().multiplyScalar(k.r * 0.9).setY(k.top - 0.62);
    const caveTex = this.caveArt(keep);
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.95, 0.95)), keep(new THREE.MeshBasicMaterial({ map: caveTex, transparent: true, alphaTest: 0.05 })));
    m.position.copy(mouth); m.lookAt(mouth.clone().add(toIsland)); g.add(m);
    const mat = fallMaterial(keep, this.uT, 0.9);
    const half = (s: number) => {
      const pg = keep(new THREE.PlaneGeometry(0.5, 3.6).translate(0, -1.8, 0));
      const w = new THREE.Mesh(pg, mat); w.renderOrder = 3;
      w.position.copy(toIsland.clone().multiplyScalar(k.r * 0.97 + 0.05)).addScaledVector(side, s * 0.24).setY(k.top + 0.02);
      w.lookAt(w.position.clone().add(toIsland)); g.add(w); return w;
    };
    const left = half(-1), right = half(1);
    // the little spring on top the water comes from
    const pool = new THREE.Mesh(keep(new THREE.CircleGeometry(0.32, 20).rotateX(-Math.PI / 2)), keep(new THREE.MeshStandardMaterial({ color: 0x5ec3ec, emissive: 0x1a6a9a, emissiveIntensity: 0.3, roughness: 0.15 })));
    pool.position.copy(toIsland.clone().multiplyScalar(k.r * 0.55)).setY(k.top + 0.01); g.add(pool);
    const boulder = await loadGltf('world/boulder.glb');
    if (boulder) for (let i = 0; i < 6; i++) { const b = boulder.scene.clone(true), a = (i / 6) * Math.PI * 2; b.scale.setScalar(0.1 + (i % 3) * 0.03); b.position.copy(pool.position).add(new THREE.Vector3(Math.cos(a) * 0.36, -0.02, Math.sin(a) * 0.36)); g.add(b); }
    const shine = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: this.glowT, color: 0xd9a8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })));
    shine.scale.setScalar(1.6); shine.position.copy(mouth).addScaledVector(toIsland, 0.1); g.add(shine);
    this.root.add(g);
    this.cave = { g, left, right, shine, mouth: mouth.clone().add(g.position), side, open: caveOpen ? 1 : 0, mat };
    // ---- the floating rock, high up and far out, with a star stone on it ----
    const s = rocks.sky, sg = floatingRock(keep, stoneMat, grassMat, s.r, s.top, 2.6, 11);
    sg.position.set(s.x, 0, s.z);
    const gem = new THREE.Mesh(keep(new THREE.OctahedronGeometry(0.17, 0)), keep(new THREE.MeshStandardMaterial({ color: 0xffe27a, emissive: 0xffb52e, emissiveIntensity: 1.0, metalness: 0.3, roughness: 0.25 })));
    gem.position.set(0, s.top + 0.55, 0); gem.scale.set(1, 1.4, 1); sg.add(gem);
    const gl = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: this.glowT, color: 0xffd36b, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })));
    gl.scale.setScalar(1.3); gem.add(gl);
    const ped = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.16, 0.22, 0.2, 10)), stoneMat); ped.position.y = s.top + 0.08; sg.add(ped);
    this.root.add(sg);
    this.star = { g: sg, gem, at: new THREE.Vector3(s.x, s.top + 0.55, s.z) };
  }
  /** the cave's mouth: dark inside, crystals glittering */
  private caveArt(keep: Keep) {
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d')!, r = rand(5);
    g.beginPath(); g.moveTo(30, S); g.lineTo(30, 120); g.quadraticCurveTo(S / 2, -30, S - 30, 120); g.lineTo(S - 30, S); g.closePath();
    const gr = g.createRadialGradient(S / 2, S * 0.75, 10, S / 2, S * 0.7, 150); gr.addColorStop(0, '#3a2a5a'); gr.addColorStop(1, '#120c1e');
    g.fillStyle = gr; g.fill();
    g.save(); g.clip();
    for (let i = 0; i < 14; i++) {
      const x = 50 + r() * (S - 100), y = 120 + r() * 120, h = 18 + r() * 40, w = 8 + r() * 10, c = ['#e6b8ff', '#9fe0ff', '#ffb8e0', '#fff2a8'][i % 4];
      g.fillStyle = c; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(x, y); g.lineTo(x - w, y - h * 0.4); g.lineTo(x, y - h); g.lineTo(x + w, y - h * 0.4); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(x - 2, y - h * 0.9); g.lineTo(x - w * 0.6, y - h * 0.45); g.lineTo(x - 2, y - h * 0.5); g.closePath(); g.fill();
    }
    g.restore(); g.globalAlpha = 1;
    g.strokeStyle = '#6a5a4a'; g.lineWidth = 10; g.beginPath(); g.moveTo(30, S); g.lineTo(30, 120); g.quadraticCurveTo(S / 2, -30, S - 30, 120); g.lineTo(S - 30, S); g.stroke();
    const t = keep(new THREE.CanvasTexture(cv)); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  /** The waterfall parts and the crystals light up. */
  openCave() { if (this.cave && this.cave.open === 0) { this.cave.open = 0.001; sfx.reveal(1); } }
  get caveMouth() { return this.cave?.mouth ?? null; }
  get starAt() { return this.star?.at ?? null; }

  // ---------- the sparkle, and digging ----------
  setSparkle(at: THREE.Vector3 | null) {
    if (!at) { this.sparkle?.removeFromParent(); this.sparkle = null; return; }
    if (!this.sparkle) {
      const g = new THREE.Group();
      const mound = new THREE.Mesh(this.keep(new THREE.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), this.keep(new THREE.MeshStandardMaterial({ color: 0x9a7048, roughness: 1 })));
      mound.scale.set(1.2, 0.35, 1); g.add(mound);
      const sm = this.keep(new THREE.SpriteMaterial({ map: this.glowT, color: 0xffe066, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(sm); s.scale.setScalar(0.22); s.userData.i = i; g.add(s); }
      // a soft golden light on the grass, so it shows from across the island
      const pool = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2)), this.keep(new THREE.MeshBasicMaterial({ map: this.glowT, color: 0xffd34d, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })));
      pool.position.y = 0.03; pool.name = 'pool'; g.add(pool);
      this.sparkle = g; this.root.add(g);
    }
    this.sparkle.position.copy(at);
  }
  get sparkleAt() { return this.sparkle?.position ?? null; }
  /** Dig: dirt flies, then the chest comes up and opens (the first time) or a treat pops out. */
  dig(at: THREE.Vector3, first: boolean, done: () => void) {
    this.setSparkle(null);
    const g = new THREE.Group(); g.position.copy(at);
    let lid: THREE.Object3D | null = null;
    if (first) {
      const wood = this.keep(new THREE.MeshStandardMaterial({ color: 0x9a5a2e, roughness: 0.7 })), gold = this.keep(new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 0.6, roughness: 0.3, emissive: 0x5a3a00, emissiveIntensity: 0.5 }));
      const body = new THREE.Mesh(this.keep(new THREE.BoxGeometry(0.5, 0.3, 0.34)), wood); body.position.y = 0.15; g.add(body);
      for (const x of [-0.18, 0.18]) { const b = new THREE.Mesh(this.keep(new THREE.BoxGeometry(0.05, 0.31, 0.35)), gold); b.position.set(x, 0.15, 0); g.add(b); }
      const coins = new THREE.Mesh(this.keep(new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), gold); coins.scale.set(1.1, 0.4, 0.75); coins.position.y = 0.28; g.add(coins);
      const pivot = new THREE.Group(); pivot.position.set(0, 0.3, -0.17); g.add(pivot);
      const top = new THREE.Mesh(this.keep(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2)), wood); top.position.set(0, 0, 0.17); pivot.add(top);
      lid = pivot;
    } else {
      const treat = new THREE.Mesh(this.keep(new THREE.TorusGeometry(0.08, 0.045, 8, 16)), this.keep(new THREE.MeshStandardMaterial({ color: 0xe8a050, roughness: 0.6 })));
      treat.rotation.x = Math.PI / 2; treat.position.y = 0.1; g.add(treat);
      const berry = new THREE.Mesh(this.keep(new THREE.SphereGeometry(0.05, 10, 8)), this.keep(new THREE.MeshStandardMaterial({ color: 0xff4f7a, roughness: 0.35 }))); berry.position.y = 0.16; g.add(berry);
    }
    g.scale.setScalar(0.001);
    this.root.add(g);
    this.dug = { g, lid, t0: this.now, first, done };
  }

  // ---------- the bottle and the note ----------
  setBottle(at: THREE.Vector3 | null) {
    if (!at) { this.bottle?.removeFromParent(); this.bottle = null; return; }
    if (!this.bottle) {
      const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
      const glass = this.keep(new THREE.MeshStandardMaterial({ color: 0x8fe0c8, transparent: true, opacity: 0.6, roughness: 0.08, metalness: 0.1 }));
      inner.add(new THREE.Mesh(this.keep(new THREE.CapsuleGeometry(0.07, 0.16, 4, 12)), glass));
      const neck = new THREE.Mesh(this.keep(new THREE.CylinderGeometry(0.03, 0.045, 0.1, 10)), glass); neck.position.y = 0.16; inner.add(neck);
      const cork = new THREE.Mesh(this.keep(new THREE.CylinderGeometry(0.032, 0.03, 0.05, 10)), this.keep(new THREE.MeshStandardMaterial({ color: 0xb07a48, roughness: 0.9 }))); cork.position.y = 0.23; inner.add(cork);
      const paper = new THREE.Mesh(this.keep(new THREE.CylinderGeometry(0.035, 0.035, 0.15, 10)), this.keep(new THREE.MeshStandardMaterial({ color: 0xfff3d6, roughness: 0.9 }))); inner.add(paper);
      inner.rotation.z = 1.2;
      const gl = new THREE.Sprite(this.keep(new THREE.SpriteMaterial({ map: this.glowT, color: 0xbff4ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }))); gl.scale.setScalar(0.7); g.add(gl);
      this.bottle = g; this.root.add(g);
    }
    this.bottle.position.copy(at);
  }
  get bottleAt() { return this.bottle?.position ?? null; }
  setNote(at: THREE.Vector3 | null) {
    if (!at) { this.note?.removeFromParent(); this.note = null; return; }
    if (!this.note) {
      const g = new THREE.Group();
      const paper = new THREE.Mesh(this.keep(new THREE.BoxGeometry(0.26, 0.02, 0.18)), this.keep(new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.8 })));
      paper.position.y = 0.06; paper.rotation.set(-0.25, 0.4, 0); g.add(paper);
      const seal = new THREE.Mesh(this.keep(new THREE.SphereGeometry(0.035, 10, 6)), this.keep(new THREE.MeshStandardMaterial({ color: 0xff4f7a, roughness: 0.4, emissive: 0x5a0a20 })));
      seal.scale.set(1, 0.4, 1); seal.position.set(0, 0.08, 0.02); g.add(seal);
      const gl = new THREE.Sprite(this.keep(new THREE.SpriteMaterial({ map: this.glowT, color: 0xff9fc6, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }))); gl.scale.setScalar(0.8); gl.position.y = 0.08; g.add(gl);
      this.note = g; this.root.add(g);
    }
    this.note.position.copy(at);
  }
  get noteAt() { return this.note?.position ?? null; }

  // ---------- rain and the rainbow ----------
  setRain(on: boolean) {
    if (on && !this.rain) {
      const N = 520, R = this.rimR + 4, pos = new Float32Array(N * 6), rnd = rand(31);
      for (let i = 0; i < N; i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R, y = rnd() * 14 - 2; pos.set([Math.cos(a) * d, y, Math.sin(a) * d, Math.cos(a) * d + 0.04, y + 0.45, Math.sin(a) * d], i * 6); }
      const geo = this.keep(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const lines = new THREE.LineSegments(geo, this.keep(new THREE.LineBasicMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0, depthWrite: false })));
      lines.frustumCulled = false; this.root.add(lines);
      this.rain = { lines, pos, k: 0, on: true, R };
    }
    if (this.rain) this.rain.on = on;
  }
  get raining() { return this.rain?.k ?? 0; }
  setRainbow(on: boolean) {
    if (on && !this.bow) {
      // (an arch rising out of the clouds behind the island, its top just in the view)
      const R = this.rimR + 7;
      const mat = this.keep(new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uA: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform float uA; varying vec2 vUv;
          vec3 band(float t){ t = clamp(t, 0.0, 1.0) * 6.0;
            vec3 c[7]; c[0]=vec3(1.0,0.35,0.35); c[1]=vec3(1.0,0.62,0.25); c[2]=vec3(1.0,0.9,0.35); c[3]=vec3(0.45,0.85,0.4); c[4]=vec3(0.35,0.7,1.0); c[5]=vec3(0.45,0.45,0.95); c[6]=vec3(0.75,0.45,0.95);
            int i = int(floor(t)); float f = fract(t); vec3 a = c[0], b = c[0];
            for (int k = 0; k < 7; k++) { if (k == i) a = c[k]; if (k == min(i + 1, 6)) b = c[k]; }
            return mix(a, b, f); }
          void main(){ float t = abs(vUv.y - 0.5) * 2.0; float edge = smoothstep(1.0, 0.7, t);
            float side = vUv.y < 0.5 ? 0.0 : 1.0;
            gl_FragColor = vec4(band(t), uA * edge * 0.8 * side);
            #include <colorspace_fragment>
          }`,
      }));
      const mesh = new THREE.Mesh(this.keep(new THREE.TorusGeometry(R, 1.1, 10, 96, Math.PI)), mat);
      mesh.position.set(0, 2.6 - R, -this.rimR - 9); mesh.renderOrder = 2; // (over the cloud sea, which writes no depth)
      this.root.add(mesh);
      this.bow = { mesh, mat, k: 0, on: true };
    }
    if (this.bow) this.bow.on = on;
  }
  get rainbowMesh() { return this.bow && this.bow.k > 0.3 ? this.bow.mesh : null; }
  /** Does a ray pass close to the rainbow (generously: it's thin on the screen)? */
  hitsRainbow(ray: THREE.Ray): boolean {
    const b = this.bow; if (!b || b.k < 0.3) return false;
    const c = b.mesh.position, p = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -c.z), new THREE.Vector3());
    if (!p || p.y < c.y) return false;
    const R = (b.mesh.geometry as THREE.TorusGeometry).parameters.radius;
    return Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - R) < 2.6;
  }

  // ---------- night ----------
  setNight(k: number) {
    if (k > 0 && !this.sky) {
      const rnd = rand(77), N = 700, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        // (down to below the horizon: the island floats high over the clouds, and the view looks down)
        const a = rnd() * Math.PI * 2, y = -0.3 + Math.pow(rnd(), 0.8) * 1.3, r = Math.sqrt(Math.max(0, 1 - y * y));
        pos.set([Math.cos(a) * r * 900, y * 900, Math.sin(a) * r * 900], i * 3);
        const w = 0.75 + rnd() * 0.25; col.set([w, w, w * (0.85 + rnd() * 0.15)], i * 3);
      }
      const geo = this.keep(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const stars = new THREE.Points(geo, this.keep(new THREE.PointsMaterial({ size: 4, sizeAttenuation: false, map: this.glowT, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })));
      stars.renderOrder = -0.9; stars.frustumCulled = false;
      const moon = new THREE.Sprite(this.keep(new THREE.SpriteMaterial({ map: this.moonArt(), transparent: true, opacity: 0, depthWrite: false, fog: false })));
      moon.scale.setScalar(80); moon.position.set(380, -140, -560); moon.renderOrder = -0.8;
      const flies: { s: THREE.Sprite; p: THREE.Vector3; v: THREE.Vector3; ph: number }[] = [];
      const fm = this.keep(new THREE.SpriteMaterial({ map: this.glowT, color: 0xdcff7a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      for (let i = 0; i < 28; i++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (this.rimR - 0.5), s = new THREE.Sprite(fm.clone()); this.keep(s.material);
        s.scale.setScalar(0.22);
        flies.push({ s, p: new THREE.Vector3(Math.cos(a) * d, 0.4 + rnd() * 1.6, Math.sin(a) * d), v: new THREE.Vector3(), ph: rnd() * 6 });
        this.root.add(s);
      }
      this.root.add(stars, moon);
      this.sky = { stars, moon, flies, k: 0 };
    }
    if (this.sky) this.sky.k = k;
  }
  private moonArt() {
    const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d')!;
    const halo = g.createRadialGradient(64, 64, 20, 64, 64, 64); halo.addColorStop(0, 'rgba(255,248,220,.6)'); halo.addColorStop(1, 'rgba(255,248,220,0)');
    g.fillStyle = halo; g.fillRect(0, 0, S, S);
    const body = g.createRadialGradient(56, 54, 4, 64, 64, 30); body.addColorStop(0, '#fffdf2'); body.addColorStop(1, '#f2e6b8');
    g.fillStyle = body; g.beginPath(); g.arc(64, 64, 28, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(200,180,130,.35)'; for (const [x, y, r] of [[56, 58, 6], [72, 70, 4], [66, 52, 3], [58, 74, 3]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    const t = this.keep(new THREE.CanvasTexture(cv)); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  // ---------- the Sky Whale ----------
  /** The Sky Whale swims across the sky behind the island (`done` when it has passed). */
  async whale(done: () => void): Promise<boolean> {
    if (this.whaleM) return false;
    const m = await GlimmerModel.create('skywhale', 4.5).catch(() => null);
    if (!m) return false;
    // (low over the cloud sea behind the island, where the view looks)
    const R = this.rimR * 1.6 + 14, from = new THREE.Vector3(-R * 1.15, -3.6, -R * 0.8), to = new THREE.Vector3(R * 1.15, -2.8, -R * 0.7);
    m.root.position.copy(from); m.appearThen = 'idle'; m.fx = this.fx;
    m.face = to.clone();
    this.root.add(m.root);
    this.whaleM = { m, t0: this.now, from, to, done };
    sfx.twinkle();
    return true;
  }
  get whaleSwimming() { return !!this.whaleM; }

  update(t: number, dt: number, camPos: THREE.Vector3) {
    this.now = t;
    // the cave's waterfall parting
    const c = this.cave;
    if (c) {
      if (c.open > 0 && c.open < 1) c.open = Math.min(1, c.open + dt / 1.6);
      const k = c.open, e = k * k * (3 - 2 * k);
      c.left.position.addScaledVector(c.side, 0); // (moved by the offset below)
      c.left.scale.x = 1 - e * 0.55; c.right.scale.x = 1 - e * 0.55;
      c.left.userData.base ??= c.left.position.clone(); c.right.userData.base ??= c.right.position.clone();
      c.left.position.copy(c.left.userData.base).addScaledVector(c.side, -e * 0.32); c.right.position.copy(c.right.userData.base).addScaledVector(c.side, e * 0.32);
      (c.shine.material as THREE.SpriteMaterial).opacity = e * (0.55 + Math.sin(t * 2.4) * 0.2);
      if (Math.random() < dt * (0.6 + e * 3)) this.fx.emit({ at: c.mouth.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.4, 0)), count: 1, shape: ['star', 'spark'], color: [0xe6b8ff, 0x9fe0ff, 0xffffff], speed: [0.1, 0.4], life: [0.5, 0.9], size: [0.05, 0.11], drag: 1 });
    }
    if (this.star) {
      this.star.gem.rotation.y = t * 1.3; this.star.gem.position.y = this.star.at.y + Math.sin(t * 1.8) * 0.06;
      if (Math.random() < dt * 2.5) this.fx.emit({ at: this.star.at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4)), count: 1, shape: 'star', color: [0xffe27a, 0xffffff], speed: [0.1, 0.4], up: 0.5, life: [0.6, 1], size: [0.05, 0.1], drag: 1 });
    }
    if (this.sparkle) {
      this.sparkle.children.forEach(ch => { const i = ch.userData.i; if (i === undefined) return; const a = t * 1.6 + i * 1.256; ch.position.set(Math.cos(a) * 0.26, 0.12 + Math.abs(Math.sin(t * 3 + i)) * 0.18, Math.sin(a) * 0.26); ch.scale.setScalar(0.12 + Math.abs(Math.sin(t * 4 + i * 2)) * 0.16); });
      const pool = this.sparkle.getObjectByName('pool') as THREE.Mesh | undefined;
      if (pool) (pool.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 2.5) * 0.25;
      if (Math.random() < dt * 5) this.fx.emit({ at: this.sparkle.position.clone().add(new THREE.Vector3(0, 0.15, 0)), count: 1, shape: ['star', 'spark'], color: [0xffe066, 0xffffff], speed: [0.2, 0.6], up: 1, life: [0.5, 0.8], size: [0.05, 0.1], drag: 1 });
    }
    const d = this.dug;
    if (d) {
      const k = t - d.t0;
      if (k < 1.0 && Math.random() < dt * 30) this.fx.emit({ at: d.g.position.clone().add(new THREE.Vector3(0, 0.05, 0)), count: 2, shape: ['pebble', 'dot'], color: [0x8a5a34, 0xb08050, 0x6a4a2a], speed: [1, 2.4], up: 2.2, life: [0.4, 0.7], size: [0.05, 0.1], gravity: 7 });
      const up = Math.min(1, Math.max(0, (k - 0.8) / 0.5));
      d.g.scale.setScalar(Math.max(0.001, easeOutBack(up)));
      d.g.position.y = d.first ? 0 : up * 0.25;
      if (d.lid) d.lid.rotation.x = -Math.min(1.9, Math.max(0, (k - 1.4) / 0.5) * 1.9);
      if (d.first && k > 1.5 && k < 2.6 && Math.random() < dt * 25) this.fx.emit({ at: d.g.position.clone().add(new THREE.Vector3(0, 0.35, 0)), count: 2, shape: ['star', 'dot'], color: [0xffd34d, 0xfff2a8, 0xffffff], speed: [0.6, 1.8], up: 2.2, life: [0.6, 1.0], size: [0.07, 0.13], gravity: 2 });
      if (k > 1.4 && d.done) { const f = d.done; d.done = null; f(); }
      if (k > 3.6) { const s = Math.max(0.001, 1 - (k - 3.6) / 0.4); d.g.scale.setScalar(s); if (k > 4) { d.g.removeFromParent(); this.dug = null; } }
    }
    if (this.bottle) { this.bottle.children[0].rotation.y = t * 0.4; this.bottle.children[0].position.y = Math.sin(t * 1.6) * 0.03; }
    if (this.note) { this.note.position.y += 0; this.note.children[0].position.y = 0.06 + Math.sin(t * 2.2) * 0.02; }
    // rain
    const r = this.rain;
    if (r) {
      r.k = Math.max(0, Math.min(1, r.k + (r.on ? dt / 3 : -dt / 3)));
      (r.lines.material as THREE.LineBasicMaterial).opacity = r.k * 0.55;
      r.lines.visible = r.k > 0.01;
      if (r.lines.visible) {
        const p = r.pos;
        for (let i = 0; i < p.length; i += 6) { p[i + 1] -= dt * 13; p[i + 4] -= dt * 13; if (p[i + 1] < -3) { p[i + 1] += 15; p[i + 4] += 15; } }
        (r.lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        if (Math.random() < dt * 30 * r.k) { const a = Math.random() * Math.PI * 2, dd = Math.sqrt(Math.random()) * (this.rimR - 0.8); this.fx.emit({ at: new THREE.Vector3(Math.cos(a) * dd, 0.03, Math.sin(a) * dd), count: 3, shape: 'drop', color: 0xcfe8ff, speed: [0.3, 0.8], up: 1.4, life: [0.25, 0.4], size: [0.03, 0.05], gravity: 6 }); }
      }
    }
    const b = this.bow;
    if (b) {
      b.k = Math.max(0, Math.min(1, b.k + (b.on ? dt / 4 : -dt / 3)));
      b.mat.uniforms.uA.value = b.k; b.mesh.visible = b.k > 0.01;
    }
    // night
    const s = this.sky;
    if (s) {
      (s.stars.material as THREE.PointsMaterial).opacity = s.k; s.stars.visible = s.k > 0.01;
      (s.moon.material as THREE.SpriteMaterial).opacity = s.k; s.moon.visible = s.k > 0.01;
      const on = s.k > 0.2;
      for (const f of s.flies) {
        f.s.visible = on;
        if (!on) continue;
        f.v.add(new THREE.Vector3((Math.random() - 0.5) * dt * 1.2, (Math.random() - 0.5) * dt * 0.6, (Math.random() - 0.5) * dt * 1.2)).multiplyScalar(0.985);
        f.p.addScaledVector(f.v, dt * 2);
        const dd = Math.hypot(f.p.x, f.p.z); if (dd > this.rimR - 0.3) { f.p.x *= (this.rimR - 0.3) / dd; f.p.z *= (this.rimR - 0.3) / dd; f.v.multiplyScalar(-0.5); }
        f.p.y = Math.max(0.25, Math.min(2.4, f.p.y));
        f.s.position.copy(f.p);
        (f.s.material as THREE.SpriteMaterial).opacity = s.k * (0.35 + 0.65 * Math.max(0, Math.sin(t * 2.2 + f.ph)));
      }
    }
    // the whale swims by
    const w = this.whaleM;
    if (w) {
      const k = (t - w.t0) / 18;
      w.m.root.position.lerpVectors(w.from, w.to, k); w.m.root.position.y += Math.sin(k * Math.PI * 3) * 0.5;
      w.m.update(dt, t);
      if (Math.random() < dt * 6) this.fx.emit({ at: w.m.root.position.clone().add(new THREE.Vector3(-3, 1, 0)), count: 2, shape: 'dot', color: [0xffffff, 0xeaf4ff], speed: [0.2, 0.6], life: [1, 1.6], size: [0.6, 1.2], drag: 1 });
      if (k >= 1) { w.m.dispose(); this.whaleM = null; w.done(); }
    }
    void camPos;
  }

  dispose() {
    this.whaleM?.m.dispose();
    this.root.removeFromParent();
    for (const x of this.own) x.dispose();
  }
}
