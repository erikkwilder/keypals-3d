// Your buddy for real on Home, when it's tickled: Home shows a picture of the buddy, so a tickle swaps in
// the 3D buddy (its own little renderer, laid exactly over the picture and framed the way the picture
// was made, src/dev/portraits.ts) and its whole body squirms, giggles and sneezes on its bones
// (character.ts tickle and sneeze). After a while with no tickles it hands back to the picture.
import * as THREE from 'three';
import { Character } from '../three/character';
import { dressUp } from '../three/dress';
import type { FriendId } from '../art/cast';

export class LiveBuddy {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(24, 1, 0.05, 50);
  private raf = 0;
  private last = 0;
  private idleFor = 0;
  private gone = false;
  /** called when it hands back to the picture by itself */
  onEnd: (() => void) | null = null;

  private constructor(readonly c: Character, private el: HTMLElement, private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    // the portraits' own lights, so the swap doesn't change how the buddy looks
    this.scene.add(new THREE.HemisphereLight(0xeef6ff, 0xa8b090, 1.5));
    const key = new THREE.DirectionalLight(0xfff4e6, 2.3); key.position.set(1.6, 3, 3.2); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xe8dcff, 1.1); rim.position.set(-2.5, 2, -2); this.scene.add(rim);
    this.scene.add(c.root);
    c.root.rotation.y = -0.38;
    // framed like the full-body portrait: the top of the buddy (plus room for a hat), centred
    c.mixer.setTime((c.actions.idle?.getClip().duration ?? 1) * 0.15);
    c.root.updateMatrixWorld(true);
    const pb = new THREE.Box3();
    for (const b of Object.values(c.bones)) pb.expandByPoint(b.getWorldPosition(new THREE.Vector3()));
    const hy = c.bones.Head?.getWorldPosition(new THREE.Vector3()).y ?? pb.max.y;
    const top = Math.max(pb.max.y, hy) + 0.32, h = top * 1.04, aim = new THREE.Vector3(0, top / 2, 0);
    const d = h / (2 * Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)));
    this.cam.position.set(aim.x, aim.y + h * 0.04, aim.z + d);
    this.cam.lookAt(aim);
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  /** The 3D buddy over the picture in `el` (null if it can't be drawn here). */
  static async create(id: FriendId, el: HTMLElement): Promise<LiveBuddy | null> {
    try {
      const c = await Character.create(id);
      if (!c) return null;
      c.play('idle', 0);
      await dressUp(c).catch(() => null);
      const canvas = document.createElement('canvas');
      canvas.className = 'fun-livebuddy';
      canvas.setAttribute('aria-hidden', 'true');
      Object.assign(canvas.style, { position: 'fixed', pointerEvents: 'none', zIndex: '4' });
      document.body.appendChild(canvas);
      const lb = new LiveBuddy(c, el, canvas);
      el.classList.add('fun-live');
      return lb;
    } catch { return null; }
  }

  tickle() { this.idleFor = 0; return this.c.tickle(); }
  sneeze() { this.idleFor = 0; return this.c.sneeze(); }

  private frame(now: number) {
    this.raf = 0;
    if (this.gone) return;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    const r = this.el.getBoundingClientRect();
    if (!this.el.isConnected || r.width < 4) { this.end(); return; }
    // the canvas reaches past the picture (room for hops, arms and a hat); the picture's square is the
    // camera's whole view, the rest is drawn round it
    const padX = r.width * 0.45, padT = r.height * 0.55, padB = r.height * 0.12;
    const W = Math.round(r.width + padX * 2), Hh = Math.round(r.height + padT + padB);
    const cs = this.canvas.style;
    cs.left = `${r.left - padX}px`; cs.top = `${r.top - padT}px`; cs.width = `${W}px`; cs.height = `${Hh}px`;
    const px = this.renderer.getPixelRatio();
    if (this.canvas.width !== Math.round(W * px) || this.canvas.height !== Math.round(Hh * px)) this.renderer.setSize(W, Hh, false);
    this.cam.setViewOffset(r.width, r.height, -padX, -padT, W, Hh);
    this.c.update(dt);
    this.renderer.render(this.scene, this.cam);
    this.idleFor += dt;
    // a while after the last tickle, back to the picture
    if (this.idleFor > 9 && !this.c.acting) { this.end(); return; }
    this.raf = requestAnimationFrame(this.frame);
  }

  private end() { if (this.gone) return; this.dispose(); this.onEnd?.(); }

  dispose() {
    this.gone = true;
    cancelAnimationFrame(this.raf);
    this.el.classList.remove('fun-live');
    this.c.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
