// The 3D stage: one renderer on a canvas behind every screen. A screen hands it a controller (the
// lesson's runner, the title's parade, a showcase of one buddy) and the stage runs it each frame; with
// no controller it stops drawing. The island is built once and shared.
import * as THREE from 'three';
import { buildIsland, type Island } from './island';
import { Character } from './character';
import type { FriendId } from '../art/cast';

export interface Controller {
  /** called every frame; move things and the camera */
  update(dt: number, t: number): void;
  /** where the shadows and sky should follow */
  focus(): THREE.Vector3;
  dispose(): void;
}

class Stage {
  canvas: HTMLCanvasElement | null = null;
  renderer: THREE.WebGLRenderer | null = null;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
  low = false;
  private islandP: Promise<Island> | null = null;
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
    r.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 2));
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
    this.resolveMount();
  }

  resize() {
    if (!this.renderer || !this.canvas) return;
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** The island, built the first time anyone asks. */
  getIsland(): Promise<Island> {
    if (!this.islandP) {
      this.islandP = this.mounted.then(() => buildIsland(this.renderer!, { low: this.low, length: 420 })).then(isl => {
        this.scene.add(isl.root);
        this.island = isl;
        return isl;
      });
      this.islandP.catch(() => { this.islandP = null; });
    }
    return this.islandP;
  }

  character(id: FriendId) { return Character.create(id); }

  /** Run a controller (or none: stop drawing and hide the canvas). */
  use(ctrl: Controller | null) {
    if (this.ctrl && this.ctrl !== ctrl) this.ctrl.dispose();
    this.ctrl = ctrl;
    if (this.canvas) this.canvas.style.visibility = ctrl ? 'visible' : 'hidden';
    if (ctrl && !this.raf) { this.timer.update(); this.raf = requestAnimationFrame(this.frame); }
    if (!ctrl && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  }

  current() { return this.ctrl; }

  private fpsN = 0; private fpsT = 0;
  private frame = () => {
    this.raf = 0;
    if (!this.ctrl || !this.renderer) return;
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
    return { msPerFrame: +ms.toFixed(2), calls: r.info.render.calls, tris: r.info.render.triangles, w: r.domElement.width, h: r.domElement.height };
  }
}

export const stage = new Stage();
if (import.meta.env.DEV) (window as unknown as { __stage: Stage }).__stage = stage;
