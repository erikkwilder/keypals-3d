// The egg in the hatch moment (ui/HatchMoment.svelte), in 3D: the egg's own painting wrapped round a real
// egg shape (its outline read from the painting), so it is lit like a solid thing and turns as it wobbles.
// The shell is already cut into its pieces along the cracks (a cap above a zigzag round the middle, three
// pieces below it, and a few small chips at the zigzag), each with a real thickness: an outside, an inside
// and the broken edges between. The cracks happen in three steps:
//   1. a groove runs across the front (dark, its edges lit, a thin line of light in it), with hairlines;
//   2. the shell gives: the pieces part a little, so light from inside shines out through the gaps and the
//      broken edges glow, a chip pops off and leaves a hole full of light;
//   3. the whole zigzag and the cracks below it open wider, more chips fly off, light pours out.
// Then it bursts: the cap lifts off and tumbles away, the lower pieces fall open like petals and drop,
// the light inside flashes. It draws on its own see-through canvas over the screen (the incubator's 3D
// stage, or a results screen), and lets everything go when it's done.
import * as THREE from 'three';

type Piece = {
  mesh: THREE.Mesh; kind: 'cap' | 'wedge' | 'chip';
  /** outward, from the egg's middle to the piece's own middle */
  out: THREE.Vector3; mid: THREE.Vector3;
  vel: THREE.Vector3; spin: THREE.Vector3; flying: boolean; t: number; hinge?: THREE.Vector3;
};

/** a little random number source that always gives the same numbers for the same seed */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const TAU = Math.PI * 2;
const wrapA = (a: number) => { let x = (a + Math.PI) % TAU; if (x < 0) x += TAU; return x - Math.PI; };

/** The egg's outline from its painting: half its width at each height, as a share of its height. */
function readProfile(img: HTMLImageElement, N: number) {
  const W = img.naturalWidth || 328, H = img.naturalHeight || 420;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, W, H);
  const a = g.getImageData(0, 0, W, H).data;
  const cx0 = W / 2, half: number[] = new Array(H).fill(0), mids: number[] = [];
  for (let y = 0; y < H; y++) {
    // the run of this row that holds the middle (sparkles beside the egg don't count; a see-through bit of
    // a glassy egg, a few pixels wide, doesn't end it)
    const solid = (x: number) => a[(y * W + x) * 4 + 3] >= 40;
    let x0 = Math.round(cx0), x1 = x0;
    if (!solid(x0)) continue;
    for (let gap = 0; x0 > 0 && gap <= 6; ) { x0--; gap = solid(x0) ? 0 : gap + 1; }
    for (let gap = 0; x1 < W - 1 && gap <= 6; ) { x1++; gap = solid(x1) ? 0 : gap + 1; }
    while (x0 < cx0 && !solid(x0)) x0++;
    while (x1 > cx0 && !solid(x1)) x1--;
    half[y] = (x1 - x0 + 1) / 2; mids.push((x0 + x1) / 2);
  }
  let top = half.findIndex(h => h > W * 0.03), bot = H - 1 - [...half].reverse().findIndex(h => h > W * 0.03);
  if (top < 0 || bot <= top + 10) { top = 0; bot = H - 1; }
  const hpx = bot - top;
  mids.sort((p, q) => p - q);
  const cx = mids.length ? mids[Math.floor(mids.length / 2)] : cx0;
  // a smooth egg to keep it to (a bow or a sparkle sticking out of the painting isn't the shell)
  let rmax = 0;
  for (let y = Math.round(top + hpx * 0.3); y <= Math.round(top + hpx * 0.75); y++) rmax = Math.max(rmax, half[y] ?? 0);
  const ideal = (v: number) => { const s = 2 * v - 1; return Math.sqrt(Math.max(0, 1 - s * s)) * (1 - 0.1 * s); };
  let imax = 0; for (let i = 0; i <= 100; i++) imax = Math.max(imax, ideal(i / 100));
  const prof = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const v = i / N, row = bot - v * hpx;
    // the middle of five rows round it (smooth, and no stray pixel)
    const near = [-2, -1, 0, 1, 2].map(d => half[Math.max(0, Math.min(H - 1, Math.round(row + d * hpx / N * 0.5)))] ?? 0).sort((p, q) => p - q);
    // (kept close to a smooth egg: never much wider, never much narrower)
    const want = (rmax / hpx) * ideal(v) / imax, meas = near[2] / hpx;
    prof[i] = i === 0 || i === N ? 0 : Math.max(want * 0.9, Math.min(meas > 0 ? meas : want, want * 1.05));
  }
  return { prof, top, bot, hpx, cx, W, H };
}

/** A soft round light, for the light that leaks out of the cracks. */
function glowTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class EggHatch {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  /** where the egg stands (its bottom), and the egg itself inside (it wobbles about its bottom) */
  private holder = new THREE.Group(); private egg = new THREE.Group();
  private intact: THREE.Mesh | null = null;
  private pieces: Piece[] = [];
  private shellMat: THREE.MeshStandardMaterial | null = null; private innerMat: THREE.MeshStandardMaterial | null = null;
  private crackCv = document.createElement('canvas'); private crackTex: THREE.CanvasTexture;
  private glowU = { uGlowCol: { value: new THREE.Color() }, uGlow: { value: 0 } };
  private core: THREE.Mesh; private lamp: THREE.PointLight;
  private leaks: THREE.Sprite[] = []; private dot: THREE.Texture;
  private prof = new Float32Array(1); private N = 96;
  private raf = 0; private last = 0; private t0 = 0;
  private col: THREE.Color;
  private gap = 0; private gapTo = 0; private glow = 0; private glowTo = 0;
  private reveal = { ring: 0, down: 0, hair: 0 }; private revealTo = { ring: 0, down: 0, hair: 0 };
  private burstAt = -1; private stepNow = 0;
  /** the egg's wobble and squash, set from outside (degrees, and how tall) */
  tilt = 0; squash = 1;
  /** where on the screen the egg's middle is, and how tall it is, in CSS pixels */
  private at = { x: 0, y: 0, h: 200 };
  private riseT = 0;
  private rand = rng(7);
  // the cracks: a zigzag round the middle, chips above it, and cracks running down from it
  private ringNodes: { a: number; v: number }[] = [];
  private chips: { a: number; b: number; h: number }[] = [];
  private downs: { a: number; w: number[] }[] = [];
  private hairs: { pts: [number, number][]; at: number }[] = [];

  private constructor(private canvas: HTMLCanvasElement, rarityColor: string) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.col = new THREE.Color(rarityColor);
    this.glowU.uGlowCol.value.copy(this.col).lerp(new THREE.Color(0xffffff), 0.35);
    this.crackCv.width = 1024; this.crackCv.height = 512;
    this.crackTex = new THREE.CanvasTexture(this.crackCv);
    this.crackTex.colorSpace = THREE.NoColorSpace; this.crackTex.channel = 1; this.crackTex.anisotropy = 4;
    this.dot = glowTexture();
    // light: a soft sky and a warm key from the upper left, like the stage
    this.scene.add(new THREE.HemisphereLight(0xf4f0ff, 0x8a7a66, 1.3));
    const key = new THREE.DirectionalLight(0xfff4e6, 2.2); key.position.set(-1.4, 2.4, 2.6); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.6); fill.position.set(2, 0.5, 1.5); this.scene.add(fill);
    // the light inside: a glowing heart and a lamp that lights the inside of the shell and its broken edges
    this.core = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: this.glowU.uGlowCol.value.clone(), toneMapped: false, transparent: true, opacity: 0 }));
    this.lamp = new THREE.PointLight(this.col.clone().lerp(new THREE.Color(0xffffff), 0.5), 0, 3, 1.2);
    this.scene.add(this.holder); this.holder.add(this.egg);
    this.egg.add(this.core, this.lamp);
  }

  /** A 3D egg from its painting on this canvas (null: this computer can't draw it; use the flat egg). */
  static async create(canvas: HTMLCanvasElement, img: HTMLImageElement, rarityColor: string, seed = 7): Promise<EggHatch | null> {
    try {
      const e = new EggHatch(canvas, rarityColor);
      e.rand = rng(seed);
      e.build(img);
      return e;
    } catch { return null; }
  }

  // ---------- the shape ----------
  private r(v: number) { const f = Math.max(0, Math.min(1, v)) * this.N, i = Math.min(this.N - 1, Math.floor(f)); return this.prof[i] + (this.prof[i + 1] - this.prof[i]) * (f - i); }
  private point(a: number, v: number, out: THREE.Vector3) { const r = this.r(v); return out.set(r * Math.sin(a), v, r * Math.cos(a)); }
  private normal(a: number, v: number, out: THREE.Vector3) {
    if (v <= 0.002) return out.set(0, -1, 0);
    if (v >= 0.998) return out.set(0, 1, 0);
    const d = 0.004, dr = (this.r(Math.min(1, v + d)) - this.r(Math.max(0, v - d))) / (Math.min(1, v + d) - Math.max(0, v - d));
    return out.set(Math.sin(a), -dr, Math.cos(a)).normalize();
  }
  /** the zigzag round the middle at this angle */
  private ring(a: number) {
    const n = this.ringNodes, x = ((wrapA(a) + Math.PI) / TAU) * (n.length - 1), i = Math.min(n.length - 2, Math.floor(x));
    return n[i].v + (n[i + 1].v - n[i].v) * (x - i);
  }
  /** the top of the chips (the cap's own edge): the zigzag, raised where a chip is */
  private capEdge(a: number) {
    let v = this.ring(a);
    for (const c of this.chips) { const s = (wrapA(a) - c.a) / (c.b - c.a); if (s > 0 && s < 1) v += c.h * Math.pow(Math.sin(Math.PI * s), 0.6); }
    return v;
  }
  /** a crack running down from the zigzag, wiggling, at this height */
  private down(k: number, v: number) { const d = this.downs[k], f = Math.max(0, Math.min(1, v)) * (d.w.length - 1), i = Math.min(d.w.length - 2, Math.floor(f)); return d.a + d.w[i] + (d.w[i + 1] - d.w[i]) * (f - i); }

  private build(img: HTMLImageElement) {
    const P = readProfile(img, this.N);
    this.prof = P.prof;
    const R = this.rand;
    // the zigzag: round the egg a little above the middle, a real break's uneven teeth (short and long, deep
    // and shallow, now and then two steps the same way), so it never looks drawn with a ruler. Stored as
    // even steps round the egg, filled in between the teeth.
    const teeth: { a: number; v: number }[] = [];
    let a = -Math.PI, up = R() < 0.5;
    while (a < Math.PI) { teeth.push({ a, v: 0.6 + (up ? 1 : -1) * (0.008 + R() * 0.045) + (R() - 0.5) * 0.012 }); a += 0.1 + R() * 0.22; up = R() < 0.82 ? !up : up; }
    teeth.push({ a: Math.PI, v: teeth[0].v });
    const NR = 360;
    for (let i = 0; i <= NR; i++) {
      const x = -Math.PI + (i / NR) * TAU, nx = teeth.findIndex(t => t.a > x), j = nx < 0 ? teeth.length - 2 : Math.max(0, nx - 1), t0 = teeth[j], t1 = teeth[j + 1];
      const f = t1.a > t0.a ? Math.max(0, Math.min(1, (x - t0.a) / (t1.a - t0.a))) : 0;
      this.ringNodes.push({ a: x, v: t0.v + (t1.v - t0.v) * f });
    }
    // the chips: three on the front, just above the zigzag
    this.chips = [{ a: -0.42, b: -0.2, h: 0.07 }, { a: 0.12, b: 0.3, h: 0.06 }, { a: 0.62, b: 0.8, h: 0.075 }];
    // three cracks down to the bottom: two you can see, one behind
    this.downs = [-0.85, 1.15, 2.95].map(a => ({ a, w: Array.from({ length: 9 }, (_, i) => (i === 8 ? 0 : (R() - 0.5) * 0.16)) }));
    this.downs.forEach(d => (d.w[0] = d.w[0] * 0.3));
    // hairlines: short branches off the cracks (they don't split the shell; they make it look real)
    for (let i = 0; i < 16; i++) {
      const front = (R() - 0.5) * 2.6, onRing = i < 10;
      let a = front, v = onRing ? this.ring(front) : 0.15 + R() * 0.35;
      if (!onRing) { const k = R() < 0.5 ? 0 : 1; v = 0.12 + R() * 0.38; a = this.down(k, v / this.ring(this.downs[k].a)); }
      const pts: [number, number][] = [[a, v]];
      const dir = R() * TAU;
      for (let j = 0; j < 3; j++) { a += Math.cos(dir + (R() - 0.5) * 1.2) * (0.06 + R() * 0.08); v += Math.sin(dir + (R() - 0.5) * 1.2) * (0.03 + R() * 0.04); pts.push([a, v]); }
      this.hairs.push({ pts, at: Math.abs(front) / 1.3 });
    }

    // the materials: outside, the painting (lit, and glowing a little so it keeps its own colours) with the
    // cracks cut into it; inside and on the broken edges, plain shell lit by the light inside
    // (the painting's see-through edge, filled with its own colours spread outward, so the shell never shows
    // a dark fringe where the 3D egg is a hair wider than the painted one)
    const pc = document.createElement('canvas'); pc.width = P.W; pc.height = P.H;
    const pg = pc.getContext('2d')!;
    pg.fillStyle = '#fff'; pg.fillRect(0, 0, P.W, P.H);
    for (const k of [1.16, 1.1, 1.05]) {
      pg.save(); pg.filter = 'blur(4px)'; pg.translate(P.cx, (P.top + P.bot) / 2); pg.scale(k, k); pg.translate(-P.cx, -(P.top + P.bot) / 2);
      pg.drawImage(img, 0, 0, P.W, P.H); pg.restore();
    }
    pg.drawImage(img, 0, 0, P.W, P.H);
    const tex = new THREE.CanvasTexture(pc); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const shell = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(0.5, 0.5, 0.5), roughness: 0.42, metalness: 0, bumpMap: this.crackTex, bumpScale: -3.2 });
    shell.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, this.glowU);
      sh.fragmentShader = 'uniform vec3 uGlowCol;\nuniform float uGlow;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', '#include <map_fragment>\n vec4 kpCr = texture2D(bumpMap, vBumpMapUv); diffuseColor.rgb *= 1.0 - 0.82 * kpCr.r;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= 1.0 - kpCr.r; totalEmissiveRadiance += uGlowCol * kpCr.g * uGlow * 2.2;');
    };
    shell.customProgramCacheKey = () => 'kp-egg-shell';
    const inner = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xf3e6cc).lerp(this.col, 0.22), roughness: 0.8, metalness: 0, side: THREE.DoubleSide, emissive: new THREE.Color(0, 0, 0) });
    this.shellMat = shell; this.innerMat = inner;

    const uvOf = (p: THREE.Vector3) => [(P.cx + p.x * P.hpx) / P.W, 1 - (P.bot - p.y * P.hpx) / P.H];
    const crackUv = (a: number, v: number) => [wrapA(a) / TAU + 0.5, v];

    // the whole egg, before it opens (the pieces fit together exactly, but this has no seams at all)
    this.intact = new THREE.Mesh(this.surface(64, 96, (s, t) => [-Math.PI + s * TAU, t], uvOf, crackUv, false), [shell, inner]);
    this.egg.add(this.intact);

    // the pieces
    const add = (kind: Piece['kind'], geo: THREE.BufferGeometry) => {
      const mesh = new THREE.Mesh(geo, [shell, inner]); mesh.visible = false;
      geo.computeBoundingBox();
      const mid = geo.boundingBox!.getCenter(new THREE.Vector3());
      const out = new THREE.Vector3(mid.x, (mid.y - 0.5) * 0.6, mid.z).normalize();
      if (kind === 'cap') out.set(0, 1, 0);
      this.egg.add(mesh);
      this.pieces.push({ mesh, kind, out, mid, vel: new THREE.Vector3(), spin: new THREE.Vector3(), flying: false, t: 0 });
    };
    add('cap', this.surface(64, 24, (s, t) => { const a = -Math.PI + s * TAU, v0 = this.capEdge(a); return [a, v0 + t * (1 - v0)]; }, uvOf, crackUv, true, { s0: false, s1: false, t0: true, t1: false }));
    for (const c of this.chips) add('chip', this.surface(10, 4, (s, t) => { const a = c.a + s * (c.b - c.a), v0 = this.ring(a); return [a, v0 + t * (this.capEdge(a) - v0)]; }, uvOf, crackUv, true));
    const D = this.downs.length;
    for (let k = 0; k < D; k++) {
      const k1 = (k + 1) % D, wrap = k1 === 0 ? TAU : 0;
      add('wedge', this.surface(28, 30, (s, t) => {
        // (the height depends on the angle and the angle on the height: settle them together)
        let a = this.downs[k].a + s * (this.downs[k1].a + wrap - this.downs[k].a), v = t * this.ring(a);
        for (let it = 0; it < 3; it++) { const top = this.ring(a); a = this.down(k, v / top) + s * (this.down(k1, v / top) + wrap - this.down(k, v / top)); v = t * this.ring(a); }
        return [a, v];
      }, uvOf, crackUv, true, { s0: true, s1: true, t0: false, t1: true }));
    }
    this.drawCracks();
  }

  /** One piece of shell: its outside over a grid of (s, t) mapped to (angle, height), its inside a shell's
   *  thickness in, and its broken edges along the sides of the grid that are cracks. */
  private surface(ns: number, nt: number, map: (s: number, t: number) => [number, number], uvOf: (p: THREE.Vector3) => number[], crackUv: (a: number, v: number) => number[],
    edges: boolean, sides = { s0: true, s1: true, t0: true, t1: true }) {
    const T = 0.022;
    const pos: number[] = [], nrm: number[] = [], uv: number[] = [], uv1: number[] = [], idx: number[] = [];
    const p = new THREE.Vector3(), n = new THREE.Vector3();
    const outer: THREE.Vector3[][] = [], innerP: THREE.Vector3[][] = [];
    for (let j = 0; j <= nt; j++) {
      outer.push([]); innerP.push([]);
      for (let i = 0; i <= ns; i++) {
        const [a, v] = map(i / ns, j / nt);
        this.point(a, v, p); this.normal(a, v, n);
        outer[j].push(p.clone()); innerP[j].push(p.clone().addScaledVector(n, -T));
        pos.push(p.x, p.y, p.z); nrm.push(n.x, n.y, n.z); uv.push(...uvOf(p)); uv1.push(...crackUv(a, v));
      }
    }
    const row = ns + 1;
    for (let j = 0; j < nt; j++) for (let i = 0; i < ns; i++) { const q = j * row + i; idx.push(q, q + 1, q + row + 1, q, q + row + 1, q + row); }
    const outerCount = idx.length;
    // the inside (facing in)
    const base = pos.length / 3;
    for (let j = 0; j <= nt; j++) for (let i = 0; i <= ns; i++) { const q = innerP[j][i], o = outer[j][i]; pos.push(q.x, q.y, q.z); n.copy(o).sub(q).normalize().negate(); nrm.push(n.x, n.y, n.z); uv.push(0, 0); uv1.push(0, 0); }
    for (let j = 0; j < nt; j++) for (let i = 0; i < ns; i++) { const q = base + j * row + i; idx.push(q, q + row + 1, q + 1, q, q + row, q + row + 1); }
    // the broken edges: a strip from outside to inside along each crack side of the grid
    if (edges) {
      const strip = (line: [number, number][]) => {
        for (let k = 0; k < line.length - 1; k++) {
          const [i0, j0] = line[k], [i1, j1] = line[k + 1];
          const a0 = outer[j0][i0], a1 = outer[j1][i1], b0 = innerP[j0][i0], b1 = innerP[j1][i1];
          if (a0.distanceToSquared(a1) < 1e-12) continue;
          n.subVectors(a1, a0).cross(new THREE.Vector3().subVectors(b0, a0)).normalize();
          const s = pos.length / 3;
          for (const q of [a0, a1, b1, b0]) { pos.push(q.x, q.y, q.z); nrm.push(n.x, n.y, n.z); uv.push(0, 0); uv1.push(0, 0); }
          idx.push(s, s + 1, s + 2, s, s + 2, s + 3);
        }
      };
      const line = (f: (k: number) => [number, number], m: number) => Array.from({ length: m + 1 }, (_, k) => f(k));
      if (sides.t0) strip(line(i => [i, 0], ns));
      if (sides.t1) strip(line(i => [i, nt], ns));
      if (sides.s0) strip(line(j => [0, j], nt));
      if (sides.s1) strip(line(j => [ns, j], nt));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
    g.setIndex(idx);
    g.addGroup(0, outerCount, 0); g.addGroup(outerCount, idx.length - outerCount, 1);
    return g;
  }

  // ---------- the cracks, drawn into the shell (red: how deep the groove is; green: light in it) ----------
  private drawCracks() {
    const cv = this.crackCv, W = cv.width, H = cv.height, g = cv.getContext('2d')!;
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
    const X = (a: number) => (wrapA(a) / TAU + 0.5) * W, Y = (v: number) => (1 - v) * H;
    const rv = this.reveal;
    /** a crack along f from angle a0 to a1 (only as far as it has grown) */
    const along = (f: (a: number) => number, a0: number, a1: number) => { const m = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 0.02)); g.moveTo(X(a0), Y(f(a0))); for (let i = 1; i <= m; i++) { const a = a0 + (a1 - a0) * i / m; g.lineTo(X(a), Y(f(a))); } };
    const ringTo = rv.ring * Math.PI;
    const main = (wide: number, colour: string) => {
      g.strokeStyle = colour; g.lineWidth = wide; g.beginPath();
      if (ringTo > 0) { along(a => this.ring(a), 0, ringTo); along(a => this.ring(a), 0, -ringTo); }
      // the chips' outlines, once the zigzag has reached them
      for (const c of this.chips) if (Math.max(Math.abs(c.a), Math.abs(c.b)) < ringTo) along(a => this.capEdge(a), c.a, c.b);
      // the cracks down, from the zigzag, as far as they've grown (the front ones first)
      this.downs.forEach((d, k) => {
        const grow = Math.max(0, Math.min(1, rv.down * 1.6 - Math.abs(wrapA(d.a)) / 3));
        if (grow <= 0 || Math.abs(wrapA(d.a)) > ringTo + 0.2) return;
        const top = this.ring(d.a), m = 24;
        g.moveTo(X(this.down(k, 1)), Y(top));
        for (let i = 1; i <= m; i++) { const f = 1 - (i / m) * grow * 0.92; g.lineTo(X(this.down(k, f)), Y(top * f)); }
      });
      g.stroke();
    };
    main(9, 'rgb(150,0,0)'); main(5, 'rgb(255,0,0)');
    // hairlines
    g.strokeStyle = 'rgb(200,0,0)'; g.lineWidth = 2.6; g.beginPath();
    for (const h of this.hairs) {
      const k = Math.max(0, Math.min(1, (rv.hair - h.at * 0.5) * 2));
      if (k <= 0) continue;
      g.moveTo(X(h.pts[0][0]), Y(h.pts[0][1]));
      const m = (h.pts.length - 1) * k;
      for (let i = 1; i <= Math.ceil(m); i++) { const f = Math.min(1, m - (i - 1)), p0 = h.pts[i - 1], p1 = h.pts[i]; g.lineTo(X(p0[0] + (p1[0] - p0[0]) * f), Y(p0[1] + (p1[1] - p0[1]) * f)); }
    }
    g.stroke();
    // the light in the middle of the main cracks
    main(2.2, 'rgb(0,255,0)');
    this.crackTex.needsUpdate = true;
  }

  // ---------- where it is ----------
  /** Put the egg's middle at (x, y) on the screen (CSS pixels), this tall. */
  place(x: number, y: number, h: number) {
    this.at = { x, y, h };
    const w = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, H, false);
    this.cam.aspect = w / H; this.cam.updateProjectionMatrix();
    const tan = Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)), D = (H / 2) / (h * tan);
    const wx = ((x - w / 2) / (H / 2)) * D * tan, wy = (-(y - H / 2) / (H / 2)) * D * tan;
    // the egg is 1 tall with its bottom at 0: stand it so its middle lands on the spot
    this.holder.position.set(wx, wy - 0.5, -D);
  }

  /** Rise into view (from below, growing, with a little overshoot), then keep drawing. */
  start() {
    this.riseT = 0; this.t0 = this.last = performance.now();
    // (a frame's time can be a moment before the one it was asked for at: never step backwards)
    const loop = (now: number) => { this.raf = requestAnimationFrame(loop); this.frame(Math.max(0, Math.min(0.05, (now - this.last) / 1000)), Math.max(0, now - this.t0) / 1000); this.last = Math.max(this.last, now); };
    this.raf = requestAnimationFrame(loop);
  }

  /** A crack step (1, 2 or 3). */
  crack(step: number) {
    this.stepNow = step;
    const S = [{ ring: 0, down: 0, hair: 0, gap: 0, glow: 0 }, { ring: 0.28, down: 0, hair: 0.25, gap: 0, glow: 0.35 }, { ring: 0.62, down: 0.55, hair: 0.7, gap: 0.006, glow: 0.7 }, { ring: 1, down: 1, hair: 1, gap: 0.016, glow: 1 }][step] ?? { ring: 1, down: 1, hair: 1, gap: 0.016, glow: 1 };
    this.revealTo = { ring: S.ring, down: S.down, hair: S.hair };
    this.gapTo = S.gap; this.glowTo = S.glow;
    if (step >= 2 && this.intact?.visible) { this.intact.visible = false; for (const p of this.pieces) p.mesh.visible = true; }
    // chips pop off: one at the second crack, the others at the third
    const chips = this.pieces.filter(p => p.kind === 'chip' && !p.flying);
    for (const c of step === 2 ? chips.slice(1, 2) : step >= 3 ? chips : []) this.fly(c, 1.1, 2.4);
    // light leaking out of the cracks
    const want = [0, 2, 5, 9][step] ?? 9;
    while (this.leaks.length < want) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dot, color: this.glowU.uGlowCol.value, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      const i = this.leaks.length, a = (i % 2 ? 1 : -1) * (0.08 + (i >> 1) * 0.3) * (step >= 3 ? 1.25 : 1);
      const p = this.point(a, this.ring(a), new THREE.Vector3()), n = this.normal(a, this.ring(a), new THREE.Vector3());
      sp.position.copy(p).addScaledVector(n, 0.02);
      sp.userData = { a, ph: Math.random() * 6, k: 0 };
      this.egg.add(sp); this.leaks.push(sp);
    }
  }

  private fly(p: Piece, speed: number, up: number) {
    p.flying = true; p.t = 0;
    p.vel.copy(p.out).multiplyScalar(speed).add(new THREE.Vector3((this.rand() - 0.5) * 0.4, up, 0.6 + this.rand() * 0.4));
    p.spin.set((this.rand() - 0.5) * 9, (this.rand() - 0.5) * 6, (this.rand() - 0.5) * 9);
  }

  /** It bursts: the cap lifts off and tumbles away, the pieces below fall open and drop, the light flashes. */
  burst() {
    if (this.intact) this.intact.visible = false;
    for (const p of this.pieces) {
      p.mesh.visible = true;
      // (the cap pops up and tumbles off to one side and back, never in front of the Glimmer)
      if (p.kind === 'cap') { const side = this.rand() < 0.5 ? -1 : 1; p.flying = true; p.t = 0; p.vel.set(side * (0.9 + this.rand() * 0.4), 2.5, -0.7); p.spin.set(1.6 + this.rand(), (this.rand() - 0.5) * 2, -side * (2.2 + this.rand() * 1.2)); }
      else if (p.kind === 'chip' && !p.flying) this.fly(p, 1.6, 2.2);
      else if (p.kind === 'wedge') { p.flying = true; p.t = 0; p.hinge = new THREE.Vector3(0, 1, 0).cross(p.out).normalize(); }
    }
    this.burstAt = 0; this.glowTo = 1.6; this.gapTo = 0.03;
    this.tilt = 0; this.squash = 1;
  }

  // ---------- each frame ----------
  private frame(dt: number, t: number) {
    // rising into view
    if (this.riseT < 1) this.riseT = Math.min(1, Math.max(0, this.riseT) + dt / 0.55);
    const e = this.riseT, c1 = 1.9, ease = e >= 1 ? 1 : 1 + (c1 + 1) * Math.pow(e - 1, 3) + c1 * Math.pow(e - 1, 2);
    this.egg.position.y = -0.9 * (1 - ease);
    this.egg.scale.set(0.55 + 0.45 * ease, (0.55 + 0.45 * ease) * this.squash, 0.55 + 0.45 * ease);
    // the wobble: about its bottom, a little toward and away too, so you see it's round
    this.egg.rotation.set(Math.sin(t * 3.1) * THREE.MathUtils.degToRad(this.tilt) * 0.35, Math.sin(t * 0.7) * 0.12, THREE.MathUtils.degToRad(-this.tilt));
    // cracks grow quickly to where they're going
    const k = 1 - Math.exp(-dt * 14);
    let moved = false;
    for (const key of ['ring', 'down', 'hair'] as const) {
      const d = this.revealTo[key] - this.reveal[key];
      if (Math.abs(d) > 1e-3) { this.reveal[key] += d * k; moved = true; } else if (d !== 0) { this.reveal[key] = this.revealTo[key]; moved = true; }
    }
    if (moved) this.drawCracks();
    this.gap += (this.gapTo - this.gap) * (1 - Math.exp(-dt * 10));
    this.glow += (this.glowTo - this.glow) * (1 - Math.exp(-dt * 6));
    const pulse = 0.85 + 0.15 * Math.sin(t * 9);
    this.glowU.uGlow.value = this.glow * pulse;
    // the light inside: the heart shows through the gaps, the lamp lights the inside and the broken edges
    const cm = this.core.material as THREE.MeshBasicMaterial;
    // (when it bursts the heart flares and is gone in a blink: the flash on the screen takes over)
    const heart = this.burstAt >= 0 ? Math.max(0, 1 - this.burstAt / 0.28) : Math.min(1, this.glow);
    cm.opacity = heart; this.core.visible = heart > 0.01;
    const grow = 1 + (this.burstAt >= 0 ? Math.min(0.35, this.burstAt * 1.5) : 0), rs = this.r(0.5) * 0.8 * grow;
    this.core.scale.set(rs, 0.36 * grow, rs); this.core.position.set(0, 0.47, 0);
    this.lamp.position.set(0, 0.5, 0); this.lamp.intensity = 4 * Math.min(1, this.glow) * pulse * (this.burstAt >= 0 ? Math.max(0, 1 - this.burstAt / 0.5) : 1);
    if (this.innerMat) this.innerMat.emissive.copy(this.col).multiplyScalar(0.22 * Math.min(1, this.glow) * (this.burstAt >= 0 ? Math.max(0.25, 1 - this.burstAt / 0.5) : 1));
    // the pieces: parted by the gap, or flying
    for (const p of this.pieces) {
      if (!p.flying) { p.mesh.position.copy(p.out).multiplyScalar(this.gap); continue; }
      p.t += dt;
      if (p.hinge) {
        // a lower piece falls open about the egg's bottom, then drops away
        const ang = Math.min(1.9, 0.5 * 10 * p.t * p.t);
        p.mesh.quaternion.setFromAxisAngle(p.hinge, ang);
        p.mesh.position.copy(p.out).multiplyScalar(this.gap + p.t * 0.35);
        p.mesh.position.y -= 3.2 * Math.max(0, p.t - 0.35) ** 2;
      } else {
        p.vel.y -= 7.5 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.rotation.x += p.spin.x * dt; p.mesh.rotation.y += p.spin.y * dt; p.mesh.rotation.z += p.spin.z * dt;
      }
      // fading once it's well on its way (the materials are shared: fade by shrinking a little instead)
      const f = Math.max(0, Math.min(1, (p.t - 0.75) / 0.45));
      if (f > 0) p.mesh.scale.setScalar(Math.max(0.001, 1 - f));
      if (f >= 1) p.mesh.visible = false;
    }
    // the light leaking out
    for (const sp of this.leaks) {
      const u = sp.userData as { a: number; ph: number; k: number };
      u.k = Math.min(1, u.k + dt * 4);
      const m = sp.material as THREE.SpriteMaterial;
      const s = (0.07 + 0.08 * this.glow) * (0.8 + 0.2 * Math.sin(t * 7 + u.ph));
      sp.scale.set(s, s, 1);
      m.opacity = this.burstAt >= 0 ? Math.max(0, 1 - this.burstAt / 0.3) : u.k * (0.35 + 0.3 * Math.min(1, this.glow));
    }
    if (this.burstAt >= 0) this.burstAt += dt;
    this.renderer.render(this.scene, this.cam);
  }

  /** Let everything go (the canvas stays; it's the page's). */
  dispose() {
    cancelAnimationFrame(this.raf);
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
      for (const x of mats) x.dispose();
    });
    this.shellMat?.map?.dispose(); this.crackTex.dispose(); this.dot.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
