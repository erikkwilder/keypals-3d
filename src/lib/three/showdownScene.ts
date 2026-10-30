// Spinner Showdown in 3D: a see-through renderer over the painted fair booth (arcade/bg-fair.webp). A big
// prize wheel on a gold stand, its face painted on the fly (equal coloured parts, with a word on each when
// the wheel picks the kind of question), carnival bulbs round its rim that chase while it spins and a
// red pointer that clicks over every part; two dice on the counter that tumble and land; Popcorn Puffling
// the host beside the wheel, cheering or sighing; and golden tickets that burst out of the wheel and fly
// up to the ticket count when a challenge is won.
import * as THREE from 'three';
import { Fx } from './fx';
import { GlimmerModel } from './glimmerModel';
import { die } from './episodeProps';
import { loadTexture } from './assets';
import { COLOR, type ColorId } from '../math/data/pics';
import type { GlimmerId } from '../adventure/glimmers';

const R = 1.25;
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
type Spin = { from: number; to: number; t: number; dur: number; resolve: () => void; lastPart: number };
type Ticket = { m: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; spin: number };
type Roll = { d: THREE.Group; from: THREE.Euler; to: THREE.Euler; t: number; base: THREE.Vector3; hop: number };

/** which way up each face of the die from episodeProps.die() is: the rotation that brings it to the top */
const FACE_UP: Record<number, [number, number, number]> = { 1: [0, 0, 0], 2: [-Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2], 5: [Math.PI / 2, 0, 0], 6: [Math.PI, 0, 0] };

export class ShowdownScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  private fx = new Fx();
  private wheel = new THREE.Group();
  private face!: THREE.Mesh;
  private faceTex: THREE.CanvasTexture;
  private faceCanvas: HTMLCanvasElement;
  private bulbs: THREE.Mesh[] = [];
  private pointer!: THREE.Group;
  private stand = new THREE.Group();
  private dice: THREE.Group[] = [];
  private host: GlimmerModel | null = null;
  private spin: Spin | null = null;
  private rolls: Roll[] = [];
  private tickets: Ticket[] = [];
  private ticketTex: THREE.Texture | null = null;
  private parts: ColorId[] = ['red', 'blue', 'yellow', 'green'];
  private raf = 0; private last = 0; private t = 0;
  private w = 1; private h = 1;
  private disposed = false;
  private wobble = 0;
  tall = false;
  /** a part passed the pointer (for the click sound) */
  onTick: (() => void) | null = null;

  private constructor(private canvas: HTMLCanvasElement) {
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.setClearColor(0x000000, 0);
    this.renderer = r;
    // warm evening light under the tent: a golden key light, the sky, a pink rim from the bulbs
    this.scene.add(new THREE.HemisphereLight(0xfff0e0, 0xa86a4a, 1.6));
    const key = new THREE.DirectionalLight(0xffe2b8, 2.6);
    key.position.set(-3, 6, 5); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
    Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xff9ac8, 1.1); rim.position.set(4, 3, -3); this.scene.add(rim);
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.28 }));
    catcher.rotation.x = -Math.PI / 2; catcher.receiveShadow = true;
    this.scene.add(catcher);
    this.faceCanvas = document.createElement('canvas');
    this.faceCanvas.width = this.faceCanvas.height = 1024;
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    this.faceTex.anisotropy = 4;
    this.buildWheel();
    this.buildDice();
    this.scene.add(this.stand, this.fx.root);
  }

  static async create(canvas: HTMLCanvasElement, host: GlimmerId = 'popcornpuff'): Promise<ShowdownScene> {
    const s = new ShowdownScene(canvas);
    s.ticketTex = await loadTexture('math/data/prize-ticket.webp', { color: true });
    try {
      const m = await GlimmerModel.create(host, 1.05);
      if (s.disposed) { m.dispose(); return s; }
      m.fx = s.fx; m.play('appear'); m.appearThen = 'idle'; m.face = s.camera.position;
      s.host = m; s.scene.add(m.root);
    } catch { /* the booth runs without its host */ }
    s.setParts(s.parts);
    s.resize();
    s.raf = requestAnimationFrame(s.frame);
    return s;
  }

  // ---------- the wheel ----------
  private buildWheel() {
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 0.6, roughness: 0.28 });
    const wood = new THREE.MeshStandardMaterial({ color: 0xc0393f, roughness: 0.45 });
    // the stand: a striped post on a round gold base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.16, 40), gold);
    base.position.y = 0.08; base.castShadow = base.receiveShadow = true;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.0, 20), wood);
    post.position.y = 0.6; post.castShadow = true;
    this.stand.add(base, post);
    // the wheel: a thick painted disc with a gold rim, bulbs and a hub
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.14, 72), new THREE.MeshStandardMaterial({ color: 0xfff1d6, roughness: 0.5 }));
    disc.rotation.x = Math.PI / 2; disc.castShadow = true;
    // the painted face, in front (a circle's picture sits the right way up: the canvas top is the top)
    this.face = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshStandardMaterial({ map: this.faceTex, roughness: 0.42 }));
    this.face.position.z = 0.072;
    this.wheel.add(this.face);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.04, 0.075, 14, 90), gold);
    ring.position.z = 0.02; ring.castShadow = true;
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), gold);
    hub.scale.z = 0.6; hub.position.z = 0.1;
    this.wheel.add(disc, ring, hub);
    const bulbGeo = new THREE.SphereGeometry(0.045, 12, 8);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const b = new THREE.Mesh(bulbGeo, new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd36b, emissiveIntensity: 0.8 }));
      b.position.set(Math.cos(a) * (R + 0.04), Math.sin(a) * (R + 0.04), 0.09);
      this.wheel.add(b); this.bulbs.push(b);
    }
    this.wheel.position.set(0, 1.1 + R, 0.05);
    this.stand.add(this.wheel);
    // the pointer: a red arrow at the top, on a gold peg
    const ptr = new THREE.Group();
    const tri = new THREE.Shape(); tri.moveTo(-0.16, 0.18); tri.lineTo(0.16, 0.18); tri.lineTo(0, -0.16); tri.closePath();
    const arrow = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: 0xe0304a, roughness: 0.35 }));
    arrow.castShadow = true;
    const peg = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), gold); peg.position.set(0, 0.2, 0.04);
    ptr.add(arrow, peg);
    ptr.position.set(0, 1.1 + 2 * R + 0.06, 0.16);
    this.pointer = ptr;
    this.stand.add(ptr);
  }
  /** Paint the wheel's face: equal parts in these colours (and a word on each, when given). */
  setParts(parts: ColorId[], words?: string[]) {
    this.parts = parts;
    const g = this.faceCanvas.getContext('2d')!, S = 1024, c = S / 2, r = S / 2 - 6, n = parts.length;
    g.clearRect(0, 0, S, S);
    for (let i = 0; i < n; i++) {
      // part i runs clockwise from the top
      const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2, a1 = -Math.PI / 2 + ((i + 1) / n) * Math.PI * 2;
      const col = COLOR[parts[i]];
      const grad = g.createRadialGradient(c, c, r * 0.1, c, c, r);
      grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.18, col.hex); grad.addColorStop(1, col.deep);
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, r, a0, a1); g.closePath();
      g.fillStyle = grad; g.fill();
      g.lineWidth = 10; g.strokeStyle = '#fff8e8'; g.stroke();
      if (words?.[i]) {
        const am = (a0 + a1) / 2;
        g.save(); g.translate(c + Math.cos(am) * r * 0.62, c + Math.sin(am) * r * 0.62); g.rotate(am + Math.PI / 2);
        g.font = `700 ${n > 6 ? 54 : 64}px Fredoka, "Baloo 2", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 12; g.strokeStyle = 'rgba(60,20,10,.55)'; g.strokeText(words[i], 0, 0);
        g.fillStyle = '#fff'; g.fillText(words[i], 0, 0);
        g.restore();
      }
    }
    // a soft shine across the top
    const sh = g.createLinearGradient(0, 0, 0, S);
    sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fillStyle = sh; g.fill();
    this.faceTex.needsUpdate = true;
  }
  /** Spin the wheel so part `i` stops under the pointer (a few full turns first). */
  spinTo(i: number, secs = 2.6): Promise<void> {
    const n = this.parts.length, step = (Math.PI * 2) / n;
    // (turning the wheel the other way round by a part's angle brings that part up to the pointer; a
    // little way inside the part, so it doesn't always stop dead centre)
    const inside = Math.sin(this.t * 13.7 + i) * 0.3 * step;
    const now = this.wheel.rotation.z, T = Math.PI * 2;
    const want = (i + 0.5) * step + inside;
    const to = want + Math.ceil((now + 3 * T - want) / T) * T;
    return new Promise(resolve => { this.spin = { from: now, to, t: 0, dur: secs, resolve, lastPart: this.partAt(now) }; });
  }
  /** which part is under the pointer at this turn of the wheel */
  private partAt(rot: number) {
    const n = this.parts.length, step = (Math.PI * 2) / n;
    return ((Math.floor((((rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / step) % n) + n) % n;
  }
  get spinning() { return !!this.spin; }

  // ---------- the dice ----------
  private buildDice() {
    for (let i = 0; i < 2; i++) {
      const d = die(0.34);
      d.position.set(0, 0, 0);
      d.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; });
      this.dice.push(d);
      this.scene.add(d);
    }
  }
  /** Tumble the dice and land them showing these faces. */
  roll(faces: [number, number]) {
    this.rolls = this.dice.map((d, i) => {
      const [x, y, z] = FACE_UP[faces[i]] ?? [0, 0, 0];
      const base = d.position.clone();
      return { d, from: d.rotation.clone(), to: new THREE.Euler(x + Math.PI * 2 * (2 + i), d.rotation.y + Math.PI * (1 + i), z + Math.PI * 2), t: -i * 0.12, base, hop: 0.9 + i * 0.2 };
    });
  }

  // ---------- the host ----------
  cheer() {
    this.host?.play('happy');
    const at = this.wheel.getWorldPosition(new THREE.Vector3());
    this.fx.emit({ at, count: 70, shape: ['star', 'heart', 'spark', 'note'], color: [0xffe066, 0xff9ad5, 0x9fe6ff, 0xffffff], speed: [1.2, 3.2], up: 1.6, life: [0.7, 1.4], size: [0.08, 0.17], gravity: 1.8, drag: 0.8, spin: 3, radius: 0.6 });
  }
  sad() { this.host?.play('sad'); this.wobble = 0.5; }
  hop() { this.host?.play('hop'); }

  // ---------- tickets ----------
  /** n golden tickets burst from the wheel and fly to this spot on the screen (px in the canvas) */
  tickets_(n: number, to: { x: number; y: number }) {
    if (!this.ticketTex) return;
    const src = this.wheel.getWorldPosition(new THREE.Vector3());
    // the screen spot, as a point a little in front of the wheel
    const ndc = new THREE.Vector3((to.x / this.w) * 2 - 1, -(to.y / this.h) * 2 + 1, 0.5).unproject(this.camera);
    const dir = ndc.sub(this.camera.position).normalize();
    const dest = this.camera.position.clone().addScaledVector(dir, 4);
    const asp = ((this.ticketTex.image as { width?: number })?.width ?? 2) / ((this.ticketTex.image as { height?: number })?.height ?? 1);
    for (let i = 0; i < Math.min(14, n); i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42 * asp, 0.42), new THREE.MeshBasicMaterial({ map: this.ticketTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      m.position.copy(src);
      m.renderOrder = 5;
      this.scene.add(m);
      const scatter = new THREE.Vector3((Math.random() - 0.5) * 2.4, Math.random() * 1.6, 0.6 + Math.random());
      this.tickets.push({ m, from: src.clone().add(scatter), to: dest.clone(), t: -i * 0.06, dur: 0.9 + Math.random() * 0.2, spin: (Math.random() - 0.5) * 10 });
    }
  }
  /** confetti over the whole booth (a new best, the end of a round) */
  party() {
    for (let i = 0; i < 4; i++) setTimeout(() => this.fx.emit({ at: new THREE.Vector3((Math.random() - 0.5) * 5, 3.4, 0.5), count: 40, shape: ['star', 'heart', 'note', 'spark'], color: [0xffe066, 0xff9ad5, 0x9fe6ff, 0xb48cff, 0xffffff], speed: [0.6, 1.8], up: 0.4, radius: 0.5, life: [1.4, 2.2], size: [0.07, 0.14], drag: 0.9, gravity: 0.9, spin: 3 }), i * 240);
  }

  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.tall = aspect < 0.9;
    this.camera.aspect = aspect;
    if (this.tall) {
      // a phone: the wheel in the top half, the host beside it, the dice in front
      this.camera.fov = 42;
      this.stand.position.set(-0.55, 0, 0); this.stand.scale.setScalar(0.92);
      this.host?.root.position.set(1.55, 0, 0.35);
      this.dice[0].position.set(0.75, 0, 1.25); this.dice[1].position.set(1.3, 0, 1.55);
      this.camera.position.set(0.15, 2.9, 9.6);
      this.camera.lookAt(0.15, 0.05, 0);
    } else {
      // the wheel on the left half, the host beside it; the question card takes the right
      this.camera.fov = 32;
      this.stand.position.set(-2.55, 0, 0); this.stand.scale.setScalar(1);
      this.host?.root.position.set(-0.55, 0, 0.55);
      this.dice[0].position.set(-1.25, 0, 1.6); this.dice[1].position.set(-0.6, 0, 1.95);
      this.camera.position.set(0, 2.55, 10.8);
      this.camera.lookAt(0, 1.7, 0);
    }
    for (const d of this.dice) d.position.y = 0;
    this.camera.updateProjectionMatrix();
    this.fx.setScale(h, this.camera.fov);
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now; this.t += dt;
    // the spin: fast, then slowing to a stop; the pointer flicks as each part passes
    const sp = this.spin;
    let flick = 0;
    if (sp) {
      sp.t += dt / sp.dur;
      const k = Math.min(1, sp.t);
      const e = 1 - Math.pow(1 - k, 3.2);
      this.wheel.rotation.z = sp.from + (sp.to - sp.from) * e;
      const part = this.partAt(this.wheel.rotation.z);
      if (part !== sp.lastPart) { sp.lastPart = part; this.onTick?.(); flick = 1; }
      if (k >= 1) { this.spin = null; this.wobble = 0.35; sp.resolve(); }
    }
    this.pointer.rotation.z += ((flick ? 0.5 : 0) - this.pointer.rotation.z) * Math.min(1, dt * (flick ? 60 : 10));
    // bulbs: chase while spinning, a soft twinkle while still
    this.bulbs.forEach((b, i) => {
      const m = b.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = sp ? ((Math.floor(this.t * 14) + i) % 3 === 0 ? 2.2 : 0.3) : 0.7 + Math.sin(this.t * 3 + i * 0.8) * 0.35;
    });
    // a little settle wobble after a stop or a miss
    this.wobble = Math.max(0, this.wobble - dt);
    this.stand.rotation.z = Math.sin(this.t * 30) * 0.01 * this.wobble;
    // the dice
    for (const r of this.rolls) {
      r.t += dt / 1.1;
      if (r.t < 0) continue;
      const k = Math.min(1, r.t), e = ease(k);
      r.d.rotation.set(r.from.x + (r.to.x - r.from.x) * e, r.from.y + (r.to.y - r.from.y) * e, r.from.z + (r.to.z - r.from.z) * e);
      r.d.position.y = Math.abs(Math.sin(k * Math.PI * 2.5)) * (1 - k) * r.hop;
    }
    if (this.rolls.length && this.rolls.every(r => r.t >= 1)) {
      for (const r of this.rolls) { r.d.position.y = 0; this.fx.emit({ at: r.d.position.clone().add(new THREE.Vector3(0, 0.05, 0)), count: 8, shape: 'dot', color: [0xffffff, 0xe8dccb], speed: [0.3, 0.8], life: [0.3, 0.6], size: [0.04, 0.08], up: 0.6 }); }
      this.rolls = [];
    }
    // tickets: out of the wheel in a burst, then a swoop up to the count
    for (const tk of this.tickets) {
      tk.t += dt / tk.dur;
      if (tk.t < 0) { tk.m.visible = false; continue; }
      tk.m.visible = true;
      const k = Math.min(1, tk.t);
      const out = ease(Math.min(1, k * 2.4)), home = ease(Math.max(0, (k - 0.35) / 0.65));
      const mid = tk.m.position;
      mid.lerpVectors(this.wheel.getWorldPosition(new THREE.Vector3()), tk.from, out);
      mid.lerp(tk.to, home);
      tk.m.rotation.z += tk.spin * dt;
      tk.m.quaternion.copy(this.camera.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tk.m.rotation.z));
      tk.m.scale.setScalar(1 - home * 0.5);
    }
    for (const tk of this.tickets.filter(x => x.t >= 1)) { this.scene.remove(tk.m); tk.m.geometry.dispose(); (tk.m.material as THREE.Material).dispose(); }
    this.tickets = this.tickets.filter(x => x.t < 1);
    this.host?.update(dt, this.t);
    this.fx.update(dt, this.t);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.host?.dispose();
    this.fx.dispose();
    for (const tk of this.tickets) { tk.m.geometry.dispose(); (tk.m.material as THREE.Material).dispose(); }
    this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); const mm = m.material; (Array.isArray(mm) ? mm : [mm]).forEach(x => x.dispose()); } });
    this.faceTex.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
