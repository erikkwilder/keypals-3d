// Battle effects: glowing particles (sparks, droplets, snowflakes, leaves, pebbles, stars, notes, hearts)
// drawn from one painted atlas in a single draw call, plus the bigger pieces: a power flying from your
// buddy to the Grumble, lightning, a shield bubble, light beams. Everything is pooled; nothing allocates
// per frame.
import * as THREE from 'three';

export type Shape = 'dot' | 'star' | 'flake' | 'leaf' | 'drop' | 'pebble' | 'note' | 'heart' | 'ring' | 'spark' | 'petal' | 'shard';
const SHAPES: Shape[] = ['dot', 'star', 'flake', 'leaf', 'drop', 'pebble', 'note', 'heart', 'ring', 'spark', 'petal', 'shard'];
const CELL = 128, COLS = 4, ROWS = 3;

/** The atlas, painted once on a canvas: soft white shapes, tinted per particle. */
function atlas(): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = CELL * COLS; cv.height = CELL * ROWS;
  const g = cv.getContext('2d')!;
  const at = (i: number) => [(i % COLS) * CELL + CELL / 2, Math.floor(i / COLS) * CELL + CELL / 2] as const;
  const glow = (x: number, y: number, r: number, a = 1) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.35, `rgba(255,255,255,${a * 0.55})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  const path = (pts: number[][], x: number, y: number, s: number) => { g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(x + px * s, y + py * s) : g.moveTo(x + px * s, y + py * s))); g.closePath(); };
  SHAPES.forEach((sh, i) => {
    const [x, y] = at(i);
    g.save(); g.fillStyle = '#fff'; g.strokeStyle = '#fff';
    if (sh === 'dot') glow(x, y, 60);
    if (sh === 'star') { glow(x, y, 40, 0.5); const pts: number[][] = []; for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.42 : 1, a = (k / 10) * Math.PI * 2 - Math.PI / 2; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } path(pts, x, y, 52); g.fill(); }
    if (sh === 'flake') { g.lineWidth = 7; g.lineCap = 'round'; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 52, y + Math.sin(a) * 52); g.stroke(); for (const d of [24, 38]) { const bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a + s * 0.8) * 13, by + Math.sin(a + s * 0.8) * 13); g.stroke(); } } } glow(x, y, 26, 0.8); }
    if (sh === 'leaf') { g.beginPath(); g.moveTo(x, y - 56); g.bezierCurveTo(x + 46, y - 30, x + 40, y + 30, x, y + 56); g.bezierCurveTo(x - 40, y + 30, x - 46, y - 30, x, y - 56); g.fill(); g.globalCompositeOperation = 'destination-out'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, y - 46); g.lineTo(x, y + 50); g.stroke(); }
    if (sh === 'drop') { g.beginPath(); g.moveTo(x, y - 58); g.bezierCurveTo(x + 10, y - 30, x + 40, y, x + 40, y + 20); g.arc(x, y + 20, 40, 0, Math.PI); g.bezierCurveTo(x - 40, y, x - 10, y - 30, x, y - 58); g.fill(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(x - 14, y + 14, 8, 14, -0.4, 0, Math.PI * 2); g.fill(); }
    if (sh === 'pebble') { const gr = g.createRadialGradient(x - 14, y - 16, 4, x, y, 52); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#9a9a9a'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 50, 38, 0.3, 0, Math.PI * 2); g.fill(); }
    if (sh === 'note') { g.beginPath(); g.ellipse(x - 14, y + 30, 22, 16, -0.4, 0, Math.PI * 2); g.fill(); g.fillRect(x + 4, y - 50, 9, 82); g.beginPath(); g.moveTo(x + 13, y - 50); g.quadraticCurveTo(x + 50, y - 36, x + 40, y - 6); g.quadraticCurveTo(x + 36, y - 28, x + 13, y - 28); g.fill(); }
    if (sh === 'heart') { g.beginPath(); g.moveTo(x, y + 48); g.bezierCurveTo(x - 70, y - 4, x - 34, y - 62, x, y - 26); g.bezierCurveTo(x + 34, y - 62, x + 70, y - 4, x, y + 48); g.fill(); }
    if (sh === 'ring') { g.lineWidth = 10; g.beginPath(); g.arc(x, y, 46, 0, Math.PI * 2); g.stroke(); glow(x, y, 60, 0.25); }
    if (sh === 'spark') { glow(x, y, 30, 1); g.beginPath(); g.moveTo(x, y - 60); g.lineTo(x + 7, y); g.lineTo(x, y + 60); g.lineTo(x - 7, y); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x - 60, y); g.lineTo(x, y + 7); g.lineTo(x + 60, y); g.lineTo(x, y - 7); g.closePath(); g.fill(); }
    if (sh === 'petal') { g.beginPath(); g.ellipse(x, y, 26, 50, 0, 0, Math.PI * 2); g.fill(); }
    if (sh === 'shard') { path([[0, -1], [0.38, -0.1], [0.18, 1], [-0.3, 0.3]], x, y, 56); g.fill(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.35)'; path([[0, -1], [0.38, -0.1], [0.05, 0]], x, y, 56); g.fill(); }
    g.restore();
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type P = { alive: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; age: number; size: number; grow: number;
  r: number; g: number; b: number; r2: number; g2: number; b2: number; shape: number; rot: number; spin: number; drag: number; grav: number; flutter: number; fade: number };

export type Emit = {
  at: THREE.Vector3; count: number; shape?: Shape | Shape[]; color?: THREE.ColorRepresentation | THREE.ColorRepresentation[]; to?: THREE.ColorRepresentation;
  speed?: [number, number]; dir?: THREE.Vector3; spread?: number; life?: [number, number]; size?: [number, number]; grow?: number;
  gravity?: number; drag?: number; spin?: number; flutter?: number; radius?: number; up?: number; fade?: number;
};

const MAX = 2400;

export class Fx {
  readonly root = new THREE.Group();
  private ps: P[] = [];
  private geo = new THREE.BufferGeometry();
  private pos = new Float32Array(MAX * 3); private col = new Float32Array(MAX * 4); private misc = new Float32Array(MAX * 3);
  private points: THREE.Points;
  private next = 0;
  private bolts: { mesh: THREE.Mesh; age: number; life: number }[] = [];
  private beams: { mesh: THREE.Mesh; age: number; life: number; peak: number }[] = [];
  private flies: { from: THREE.Vector3; to: THREE.Vector3; mid: THREE.Vector3; age: number; life: number; orb: THREE.Sprite; trail: () => Emit; hit: () => void; done: boolean }[] = [];
  private tex: THREE.CanvasTexture;
  private glowMat: THREE.SpriteMaterial;
  private shield: THREE.Mesh | null = null; private shieldAge = 0; private shieldLife = 0; private shieldCrack = false;

  constructor() {
    this.tex = atlas();
    for (let i = 0; i < MAX; i++) this.ps.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, age: 0, size: 1, grow: 0, r: 1, g: 1, b: 1, r2: 1, g2: 1, b2: 1, shape: 0, rot: 0, spin: 0, drag: 0, grav: 0, flutter: 0, fade: 1 });
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('misc', new THREE.BufferAttribute(this.misc, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: this.tex }, scale: { value: 600 } },
      vertexShader: `attribute vec4 color; attribute vec3 misc; uniform float scale; varying vec4 vC; varying vec2 vCell; varying float vRot;
        void main(){ vC = color; vCell = vec2(mod(misc.y, ${COLS}.0), floor(misc.y / ${COLS}.0)); vRot = misc.z;
          vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = misc.x * scale / -mv.z; }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vC; varying vec2 vCell; varying float vRot;
        void main(){ vec2 p = gl_PointCoord - 0.5; float c = cos(vRot), s = sin(vRot); p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
          if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) discard;
          vec4 t = texture2D(map, vec2((vCell.x + p.x) / ${COLS}.0, 1.0 - (vCell.y + p.y) / ${ROWS}.0));
          gl_FragColor = vec4(vC.rgb * t.rgb, t.a * vC.a); if (gl_FragColor.a < 0.01) discard; }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.root.add(this.points);
    this.glowMat = new THREE.SpriteMaterial({ map: this.tex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    // the glow sprite uses the 'dot' cell of the atlas
    const t2 = this.tex.clone(); t2.repeat.set(1 / COLS, 1 / ROWS); t2.offset.set(0, 1 - 1 / ROWS); t2.needsUpdate = true;
    this.glowMat.map = t2;
  }

  /** Scale points to the screen (call when the window or camera changes). */
  setScale(heightPx: number, fov: number) { (this.points.material as THREE.ShaderMaterial).uniforms.scale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2))); }

  emit(e: Emit) {
    const shapes = Array.isArray(e.shape) ? e.shape : [e.shape ?? 'dot'];
    const cols = (Array.isArray(e.color) ? e.color : [e.color ?? 0xffffff]).map(c => new THREE.Color(c));
    const to = e.to !== undefined ? new THREE.Color(e.to) : null;
    const dir = e.dir?.clone().normalize();
    for (let i = 0; i < e.count; i++) {
      const p = this.ps[this.next]; this.next = (this.next + 1) % MAX;
      const sp = rnd(e.speed ?? [0.5, 2]);
      let v: THREE.Vector3;
      if (dir) { v = dir.clone(); const spr = e.spread ?? 0.5; v.x += (Math.random() - 0.5) * spr * 2; v.y += (Math.random() - 0.5) * spr * 2; v.z += (Math.random() - 0.5) * spr * 2; v.normalize(); }
      else { v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5 + (e.up ?? 0), Math.random() - 0.5).normalize(); }
      v.multiplyScalar(sp);
      const r0 = e.radius ?? 0;
      const c = cols[Math.floor(Math.random() * cols.length)], c2 = to ?? c;
      Object.assign(p, {
        alive: true, x: e.at.x + (Math.random() - 0.5) * r0 * 2, y: e.at.y + (Math.random() - 0.5) * r0 * 2, z: e.at.z + (Math.random() - 0.5) * r0 * 2,
        vx: v.x, vy: v.y, vz: v.z, life: rnd(e.life ?? [0.5, 1]), age: 0, size: rnd(e.size ?? [0.1, 0.2]), grow: e.grow ?? 0,
        r: c.r, g: c.g, b: c.b, r2: c2.r, g2: c2.g, b2: c2.b, shape: SHAPES.indexOf(shapes[Math.floor(Math.random() * shapes.length)]),
        rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * (e.spin ?? 2), drag: e.drag ?? 1, grav: e.gravity ?? 0, flutter: e.flutter ?? 0, fade: e.fade ?? 1,
      });
    }
  }

  /** A power flying in an arc from one point to another, trailing particles; `hit` runs on arrival. */
  fly(from: THREE.Vector3, to: THREE.Vector3, o: { color: THREE.ColorRepresentation; size: number; time: number; arc: number; trail: (at: THREE.Vector3) => Emit; hit: () => void }) {
    const orb = new THREE.Sprite(this.glowMat.clone());
    orb.material.color = new THREE.Color(o.color);
    orb.scale.setScalar(o.size);
    orb.position.copy(from);
    this.root.add(orb);
    const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, o.arc, 0));
    const f = { from: from.clone(), to: to.clone(), mid, age: 0, life: o.time, orb, trail: () => o.trail(orb.position), hit: o.hit, done: false };
    this.flies.push(f);
  }

  /** A jagged lightning bolt between two points, flickering out. */
  lightning(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation = 0xfff3a0, width = 0.06) {
    const pts: THREE.Vector3[] = [], n = 12, side = new THREE.Vector3().subVectors(to, from).cross(new THREE.Vector3(0, 0, 1)).normalize();
    for (let i = 0; i <= n; i++) { const k = i / n; const p = from.clone().lerp(to, k); if (i && i < n) p.addScaledVector(side, (Math.random() - 0.5) * 0.5).y += (Math.random() - 0.5) * 0.3; pts.push(p); }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, width, 5), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, width * 3.5, 5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    mesh.add(glow);
    this.root.add(mesh);
    this.bolts.push({ mesh, age: 0, life: 0.45 });
  }

  /** A soft column of light from the sky (a rarity reveal, the Finale). */
  beam(at: THREE.Vector3, color: THREE.ColorRepresentation, o: { radius?: number; height?: number; life?: number; peak?: number } = {}) {
    const h = o.height ?? 14, r = o.radius ?? 0.9;
    const geo = new THREE.CylinderGeometry(r * 0.55, r, h, 32, 1, true); geo.translate(0, h / 2, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { c: { value: new THREE.Color(color) }, a: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 c; uniform float a; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(1.0 - abs(dot(vN, vV)), 1.5); float fall = smoothstep(0.0, 0.15, vUv.y) * (1.0 - vUv.y); gl_FragColor = vec4(c * 1.4, a * (1.0 - edge) * fall * 0.85); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(at);
    this.root.add(mesh);
    this.beams.push({ mesh, age: 0, life: o.life ?? 2.2, peak: o.peak ?? 1 });
  }

  /** A shield bubble round a point: holds (full), cracks (half) or pops (none). */
  shieldAt(at: THREE.Vector3, radius: number, color: THREE.ColorRepresentation, crack: boolean) {
    if (!this.shield) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { c: { value: new THREE.Color(color) }, a: { value: 0 }, t: { value: 0 }, crack: { value: 0 } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: `uniform vec3 c; uniform float a; uniform float t; uniform float crack; varying vec3 vN; varying vec3 vV; varying vec3 vP;
          float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
          void main(){ float f = pow(1.0 - max(0.0, dot(vN, vV)), 2.2);
            vec3 q = vP * 6.0; vec3 i = floor(q); float hex = smoothstep(0.42, 0.5, abs(fract(q.x + q.y * 0.5) - 0.5) + abs(fract(q.y) - 0.5) * 0.6);
            float wave = 0.5 + 0.5 * sin(vP.y * 10.0 - t * 8.0);
            float cr = crack * step(0.86, h(i)) ;
            vec3 col = c * (0.35 + f * 1.6 + hex * 0.35 * wave) + vec3(1.0) * cr * 0.8;
            gl_FragColor = vec4(col, a * (0.12 + f * 0.85 + hex * 0.12 + cr * 0.6)); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      this.shield = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 4), mat);
      this.root.add(this.shield);
    }
    const m = this.shield.material as THREE.ShaderMaterial;
    m.uniforms.c.value.set(color); m.uniforms.crack.value = crack ? 1 : 0;
    this.shield.position.copy(at); this.shield.scale.setScalar(radius); this.shield.userData.r = radius;
    this.shieldAge = 0; this.shieldLife = crack ? 0.9 : 1.3; this.shieldCrack = crack;
    this.shield.visible = true;
  }

  update(dt: number, t: number) {
    // flying powers
    for (const f of this.flies) {
      if (f.done) continue;
      f.age += dt;
      const k = Math.min(1, f.age / f.life), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const a = f.from.clone().lerp(f.mid, e), b = f.mid.clone().lerp(f.to, e);
      f.orb.position.copy(a.lerp(b, e));
      f.orb.material.rotation += dt * 4;
      this.emit(f.trail());
      if (k >= 1) { f.done = true; f.orb.removeFromParent(); f.orb.material.dispose(); f.hit(); }
    }
    this.flies = this.flies.filter(f => !f.done);
    // lightning flicker
    for (const b of this.bolts) {
      b.age += dt;
      const on = b.age < b.life && Math.sin(b.age * 70) > -0.3;
      b.mesh.visible = on;
      ((b.mesh.material as THREE.MeshBasicMaterial).opacity) = 1 - b.age / b.life;
      if (b.age >= b.life) { b.mesh.removeFromParent(); b.mesh.geometry.dispose(); (b.mesh.children[0] as THREE.Mesh).geometry.dispose(); }
    }
    this.bolts = this.bolts.filter(b => b.age < b.life);
    for (const b of this.beams) {
      b.age += dt;
      const k = b.age / b.life, a = k < 0.15 ? k / 0.15 : k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      ((b.mesh.material as THREE.ShaderMaterial).uniforms.a.value) = a * b.peak;
      b.mesh.rotation.y += dt * 0.6;
      if (b.age >= b.life) { b.mesh.removeFromParent(); b.mesh.geometry.dispose(); (b.mesh.material as THREE.Material).dispose(); }
    }
    this.beams = this.beams.filter(b => b.age < b.life);
    if (this.shield?.visible) {
      this.shieldAge += dt;
      const k = this.shieldAge / this.shieldLife, m = this.shield.material as THREE.ShaderMaterial;
      m.uniforms.t.value = t;
      m.uniforms.a.value = k < 0.12 ? k / 0.12 : Math.max(0, 1 - (k - 0.5) / 0.5);
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.45 : 1.05 - Math.min(0.05, k * 0.05);
      this.shield.scale.setScalar((this.shield.userData.r ?? 1) * pop);
      if (this.shieldAge >= this.shieldLife) this.shield.visible = false;
    }
    // particles
    let n = 0;
    for (let i = 0; i < MAX; i++) {
      const p = this.ps[i];
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) { p.alive = false; continue; }
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vy = p.vy * dr - p.grav * dt; p.vz *= dr;
      if (p.flutter) { p.vx += Math.sin(t * 5 + i) * p.flutter * dt; p.vz += Math.cos(t * 4 + i * 1.3) * p.flutter * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.spin * dt;
      const k = p.age / p.life, a = (k < 0.1 ? k / 0.1 : 1 - Math.pow((k - 0.1) / 0.9, 1.6) * p.fade);
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.col[n * 4] = p.r + (p.r2 - p.r) * k; this.col[n * 4 + 1] = p.g + (p.g2 - p.g) * k; this.col[n * 4 + 2] = p.b + (p.b2 - p.b) * k; this.col[n * 4 + 3] = Math.max(0, a);
      this.misc[n * 3] = p.size * (1 + p.grow * k); this.misc[n * 3 + 1] = p.shape; this.misc[n * 3 + 2] = p.rot;
      n++;
    }
    this.geo.setDrawRange(0, n);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.misc as THREE.BufferAttribute).needsUpdate = true;
  }

  /** Nothing left in the air: every sparkle and beam gone at once. */
  clear() {
    for (const p of this.ps) p.alive = false;
    for (const b of this.beams) { b.mesh.removeFromParent(); b.mesh.geometry.dispose(); (b.mesh.material as THREE.Material).dispose(); }
    this.beams = [];
  }

  dispose() {
    this.root.removeFromParent();
    this.geo.dispose(); (this.points.material as THREE.Material).dispose(); this.tex.dispose();
    this.shield?.geometry.dispose(); (this.shield?.material as THREE.Material | undefined)?.dispose();
  }
}

const rnd = ([a, b]: [number, number]) => a + Math.random() * (b - a);
