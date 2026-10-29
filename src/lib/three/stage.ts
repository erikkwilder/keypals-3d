// The 3D stage: one renderer on a canvas behind every screen. A screen hands it a controller (the
// lesson's runner, the title's parade, a showcase of one buddy) and the stage runs it each frame; with
// no controller it stops drawing. Each region has its own island, built the first time it's needed;
// the last three stay ready.
import * as THREE from 'three';
import { buildIsland, type Island } from './island';
import { THEMES } from './themes';
import type { RegionId } from '../engine/course';
import { Character, charLook } from './character';
import type { FriendId } from '../art/cast';

export interface Controller {
  /** frames a second this scene needs (menus can settle for 30); 60 if not given */
  fps?: number;
  /** called every frame; move things and the camera */
  update(dt: number, t: number): void;
  /** where the shadows and sky should follow */
  focus(): THREE.Vector3;
  /** the island this scene stands on (shown while it runs) */
  island?: Island;
  dispose(): void;
}

export type GraphicsPref = 'auto' | 'full' | 'smooth';
const PREF_KEY = 'keypals-graphics';
/** The graphics choice belongs to the computer, not the player, so it's kept apart from the profiles. */
export function graphicsPref(): GraphicsPref {
  try { const v = localStorage.getItem(PREF_KEY); return v === 'full' || v === 'smooth' ? v : 'auto'; } catch { return 'auto'; }
}

/**
 * Older computers (Intel graphics built into the processor, software drawing) can't keep up with the
 * full world: start them in smooth mode straight away. Safari hides the chip's name; the frame-rate
 * watch catches those.
 */
function weakGpu(r: THREE.WebGLRenderer) {
  try {
    const gl = r.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    if (/SwiftShader|llvmpipe|Software|Microsoft Basic/i.test(name)) return true;
    return /Intel/i.test(name) && !/Iris\(R\)? Xe|Arc/i.test(name);
  } catch { return false; }
}

class Stage {
  canvas: HTMLCanvasElement | null = null;
  renderer: THREE.WebGLRenderer | null = null;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
  low = false;
  /** smooth mode: fewer pixels and frames, no real shadows, simpler lighting, the extras hidden */
  smooth = false;
  /** told when auto-detect switches to smooth mode by itself (to let the player know) */
  onAutoSmooth: (() => void) | null = null;
  private islands = new Map<RegionId, Promise<Island>>();
  private recent: RegionId[] = [];
  island: Island | null = null;
  private ctrl: Controller | null = null;
  private raf = 0;
  private timer = new THREE.Timer();
  private t = 0;
  /** frames a second, measured, for the quality switch */
  fps = 60;
  ready = false;
  // screens mount before the app shell hands over the canvas: anything that needs the renderer waits for it
  private resolveMount!: () => void;
  private mounted = new Promise<void>(r => (this.resolveMount = r));

  mount(canvas: HTMLCanvasElement, low = false) {
    if (this.renderer) return;
    this.canvas = canvas;
    this.low = low;
    const r = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' });
    // Retina screens at full resolution make laptops hot for little gain: 1.5x at most, 1x on low
    this.maxRatio = Math.min(devicePixelRatio, low ? 1 : 1.5);
    this.ratio = this.maxRatio;
    r.setPixelRatio(this.ratio);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    // neutral tone mapping keeps the colours bright (filmic tone mapping greyed the characters)
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    this.renderer = r;
    this.scene.background = new THREE.Color(0xa9d6f5);
    this.scene.fog = new THREE.Fog(0xd6e9f5, 70, 600);
    this.resize();
    addEventListener('resize', () => this.resize());
    const pref = graphicsPref();
    if (pref === 'smooth' || (pref === 'auto' && weakGpu(r))) this.setSmooth(true);
    this.resolveMount();
  }

  /** Switch smooth mode on or off, live: nothing is rebuilt, things are hidden, swapped or turned down. */
  setSmooth(on: boolean) {
    const r = this.renderer;
    if (!r || on === this.smooth) return;
    this.smooth = on;
    this.ratio = on ? Math.min(devicePixelRatio, 1) * 0.75 : this.maxRatio;
    r.setPixelRatio(this.ratio);
    r.shadowMap.enabled = !on;
    charLook.blob = on;
    this.camera.far = on ? 700 : 2000;
    this.camera.updateProjectionMatrix();
    this.island?.setSmooth(on);
    this.swapMaterials();
    this.scene.traverse(o => { const m = (o as THREE.Mesh).material; if (m) for (const mm of [m].flat()) mm.needsUpdate = true; });
    this.resize();
  }
  /** Change the computer's graphics choice (Settings). */
  setPref(p: GraphicsPref) {
    try { localStorage.setItem(PREF_KEY, p); } catch { /* the choice lasts until the page closes */ }
    if (p === 'full') this.setSmooth(false);
    else if (p === 'smooth') this.setSmooth(true);
    else if (this.renderer) this.setSmooth(weakGpu(this.renderer));
  }

  private lambert = new WeakMap<THREE.Material, THREE.Material>();
  /**
   * Smooth mode lights everything the cheap way (Lambert instead of the physically based standard
   * material): far less work for every pixel. Run again as new things (rides, outfits) appear.
   */
  private swapMaterials() {
    this.scene.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const ud = mesh.userData as { fullMat?: THREE.Material | THREE.Material[] };
      if (!this.smooth) { if (ud.fullMat) { mesh.material = ud.fullMat; delete ud.fullMat; } return; }
      if (ud.fullMat) return;
      const mats = [mesh.material].flat();
      if (!mats.some(m => (m as THREE.MeshStandardMaterial).isMeshStandardMaterial)) return;
      const swap = (m: THREE.Material) => {
        const s = m as THREE.MeshStandardMaterial;
        if (!s.isMeshStandardMaterial) return m;
        let l = this.lambert.get(m);
        if (!l) {
          const nl = new THREE.MeshLambertMaterial({ map: s.map, color: s.color, emissive: s.emissive, emissiveMap: s.emissiveMap, transparent: s.transparent, opacity: s.opacity, alphaTest: s.alphaTest, side: s.side, vertexColors: s.vertexColors, depthWrite: s.depthWrite });
          nl.onBeforeCompile = s.onBeforeCompile;
          nl.customProgramCacheKey = s.customProgramCacheKey;
          this.lambert.set(m, (l = nl));
        }
        return l;
      };
      ud.fullMat = mesh.material;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
  }

  resize() {
    if (!this.renderer || !this.canvas) return;
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /**
   * A region's island, built the first time anyone asks. It goes on stage when a scene standing on it
   * starts running (a slower build finishing later must not swap itself in under another scene).
   */
  getIsland(region: RegionId = 'village'): Promise<Island> {
    let p = this.islands.get(region);
    if (!p) {
      p = this.mounted.then(() => buildIsland(this.renderer!, { low: this.low, length: 420, theme: THEMES[region] }));
      this.islands.set(region, p);
      p.catch(() => this.islands.delete(region));
    }
    return p;
  }
  private show(isl: Island) {
    const region = isl.theme.id;
    if (this.island !== isl) {
      this.island?.root.removeFromParent();
      this.scene.add(isl.root);
      this.island = isl;
      (this.scene.fog as THREE.Fog).color.set(isl.theme.fog);
      isl.setSmooth(this.smooth);
      if (this.smooth) this.swapMaterials();
    }
    // keep the three most recent islands; free older ones (never the one on stage)
    this.recent = this.recent.filter(r => r !== region).concat(region);
    while (this.recent.length > 3) {
      const old = this.recent.shift()!, op = this.islands.get(old);
      this.islands.delete(old);
      op?.then(i => { if (i !== this.island) i.dispose(); });
    }
  }

  character(id: FriendId) { return Character.create(id); }

  /** Run a controller (or none: stop drawing and hide the canvas). */
  use(ctrl: Controller | null) {
    if (this.ctrl && this.ctrl !== ctrl) this.ctrl.dispose();
    this.ctrl = ctrl;
    if (ctrl?.island) this.show(ctrl.island);
    this.watchFrom = performance.now() + 2500; // give a new scene a moment to load before judging its speed
    this.lateness = 1;
    if (this.canvas) this.canvas.style.visibility = ctrl ? 'visible' : 'hidden';
    // the paper grain over the page isn't needed over the 3D world (and blending it costs every frame)
    document.documentElement.classList.toggle('stage-on', !!ctrl);
    if (ctrl && !this.raf) { this.timer.update(); this.raf = requestAnimationFrame(this.frame); }
    if (!ctrl && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  }

  current() { return this.ctrl; }
  /** Run another controller for a while without ending the one running now (a Learn lesson over a math
   *  trip): returns the one that was running, to swap back to afterwards. */
  swap(ctrl: Controller | null): Controller | null { const was = this.ctrl; this.ctrl = null; this.use(ctrl); return was; }

  private maxRatio = 1.5;
  private ratio = 1.5;
  private lastDraw = 0;
  private slow = 0;
  private fpsN = 0; private fpsT = 0;
  private watchFrom = 0;
  /** how far behind the wanted frame rate drawing runs, smoothed (1 = on time) */
  private lateness = 0;
  private swapAt = 0;
  private frame = () => {
    this.raf = 0;
    if (!this.ctrl || !this.renderer) return;
    // draw at most `fps` times a second, however fast the screen refreshes (120 Hz laptops would draw
    // twice as often); smooth mode settles for 30
    const now = performance.now(), want = Math.min(this.ctrl.fps ?? 60, this.smooth ? 30 : 60), gap = 1000 / want;
    if (now - this.lastDraw < gap - 2) { this.raf = requestAnimationFrame(this.frame); return; }
    const late = this.lastDraw ? now - this.lastDraw : gap;
    this.lastDraw = now;
    // if frames keep arriving late, the computer is struggling: first draw fewer pixels, then (on
    // auto) switch to smooth mode, and in smooth mode draw fewer pixels still
    // only judge speed while the game has focus: browsers slow down covered or background windows on purpose
    if (now > this.watchFrom && document.visibilityState === 'visible' && document.hasFocus()) {
      this.lateness += (Math.min(4, late / gap) - this.lateness) * 0.03;
      this.slow = this.lateness > 1.3 ? this.slow + 1 : Math.max(0, this.slow - 2);
      if (this.slow > want * 2) {
        this.slow = 0; this.lateness = 1;
        if (!this.smooth && this.ratio > 1) { this.ratio = Math.max(1, this.ratio - 0.25); this.renderer.setPixelRatio(this.ratio); this.resize(); }
        else if (!this.smooth && graphicsPref() === 'auto') { this.setSmooth(true); this.onAutoSmooth?.(); }
        else if (this.smooth && this.ratio > 0.5) { this.ratio = Math.max(0.5, this.ratio - 0.1); this.renderer.setPixelRatio(this.ratio); this.resize(); }
      }
    }
    // new things (a ride, an outfit) get the cheap lighting too
    if (this.smooth && now > this.swapAt) { this.swapAt = now + 1000; this.swapMaterials(); }
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    this.t += dt;
    this.ctrl.update(dt, this.t);
    this.island?.update(dt, this.t, this.ctrl.focus());
    this.renderer.render(this.scene, this.camera);
    this.fpsN++; this.fpsT += dt;
    if (this.fpsT > 1) { this.fps = this.fpsN / this.fpsT; this.fpsN = 0; this.fpsT = 0; }
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Times n frames back to back (for checking speed from the console). */
  bench(n = 120) {
    const r = this.renderer!, gl = r.getContext(), px = new Uint8Array(4);
    r.render(this.scene, this.camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { this.ctrl?.update(1 / 60, this.t + i / 60); this.island?.update(1 / 60, this.t + i / 60, this.ctrl?.focus() ?? new THREE.Vector3()); r.render(this.scene, this.camera); }
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const ms = (performance.now() - t0) / n;
    return { msPerFrame: +ms.toFixed(2), calls: r.info.render.calls, tris: r.info.render.triangles, w: r.domElement.width, h: r.domElement.height, ratio: this.ratio, fps: Math.round(this.fps) };
  }
}

export const stage = new Stage();
if (import.meta.env.DEV) (window as unknown as { __stage: Stage }).__stage = stage;
