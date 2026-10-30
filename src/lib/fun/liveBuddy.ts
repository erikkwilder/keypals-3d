// Your buddy for real on Home: Home paints a picture of the buddy first (fast), and as soon as the 3D code
// is ready the real buddy takes its place by itself (its own little renderer, laid exactly over the
// picture and framed the way the picture was made, src/dev/portraits.ts): standing, breathing, glancing
// about, now and then a little hop or fist pump. A tickle makes its whole body squirm, giggle and sneeze
// on its bones (character.ts tickle and sneeze). `stay: false` (the old way) hands back to the picture
// after a while with no tickles.
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
  /** Home's buddy, live from the start: never hands back to the picture by itself, and moves now and then */
  private stay = false;
  private calm = 0;
  private nextMove = 6;
  private move: string | null = null;
  private turn = { now: -0.38, goal: -0.38 };
  /** no little moves (Settings: less motion) */
  quiet = false;
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
  static async create(id: FriendId, el: HTMLElement, o: { stay?: boolean; quiet?: boolean } = {}): Promise<LiveBuddy | null> {
    try {
      const c = await Character.create(id);
      if (!c) return null;
      c.play('idle', 0);
      await dressUp(c).catch(() => null);
      // (the little moves come a moment later; idling needs nothing more)
      if (o.stay) void c.loadMoves().catch(() => null);
      const canvas = document.createElement('canvas');
      canvas.className = 'fun-livebuddy';
      canvas.setAttribute('aria-hidden', 'true');
      Object.assign(canvas.style, { position: 'fixed', pointerEvents: 'none', zIndex: '4' });
      // inside the page (not over the whole app): the top bar and any card opened over Home stay on top of it
      (el.closest('.screen') ?? document.body).appendChild(canvas);
      const lb = new LiveBuddy(c, el, canvas);
      lb.stay = !!o.stay; lb.quiet = !!o.quiet;
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
    if (this.stay) this.ambient(dt);
    this.c.update(dt);
    this.renderer.render(this.scene, this.cam);
    this.idleFor += dt;
    // a while after the last tickle, back to the picture (not Home's buddy: it stays)
    if (!this.stay && this.idleFor > 9 && !this.c.acting) { this.end(); return; }
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Home's buddy, between tickles: a glance one way or the other, and now and then a little move */
  private ambient(dt: number) {
    const c = this.c;
    if (this.move && c.finished(this.move)) { c.play('idle', 0.4); this.move = null; }
    this.turn.now += (this.turn.goal - this.turn.now) * (1 - Math.exp(-dt * 2.5));
    c.root.rotation.y = this.turn.now;
    if (c.acting || this.move) { this.calm = 0; return; }
    this.calm += dt;
    if (this.calm < this.nextMove) return;
    this.calm = 0;
    this.nextMove = 5 + Math.random() * 6;
    // mostly a glance (toward you, or a little to the side); sometimes a hop or a fist pump
    const moves = this.quiet ? [] : ['jump', 'fistpump'].filter(n => c.has(n));
    if (moves.length && Math.random() < 0.35) { const n = moves[Math.floor(Math.random() * moves.length)]; if (c.play(n, 0.3)) { c.actions[n]?.reset(); this.move = n; } }
    else this.turn.goal = [-0.38, -0.1, -0.62][Math.floor(Math.random() * 3)];
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
