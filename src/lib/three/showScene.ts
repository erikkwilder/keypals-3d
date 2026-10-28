// Buddies on show: standing on the island facing the camera, for the title screen (everyone), the
// buddy picker (everyone, the chosen one stepping forward) and the Keypals screen (one, close up,
// trying on outfits and dances).
import * as THREE from 'three';
import { stage, type Controller } from './stage';
import { Character } from './character';
import { makeOutfit } from './outfits3d';
import type { FriendId } from '../art/cast';
import type { Island } from './island';
import type { View } from './runScene';

type Opts = { buddies: FriendId[]; view: View; spot?: number; outfits?: Partial<Record<FriendId, string>>; orbit?: boolean };

export class ShowScene implements Controller {
  /** menus don't need 60 frames a second */
  fps = 30;
  readonly island: Island;
  readonly chars: Character[];
  view: View;
  selected: FriendId | null = null;
  private opts: Opts;
  private base: THREE.Vector3;
  private n: THREE.Vector3; private t: THREE.Vector3;
  private camPos = new THREE.Vector3(); private camAim = new THREE.Vector3(); private ready = false;
  private next: number[] = [];
  /** what each buddy is doing, and until when (seconds on the stage clock) */
  private dancing: ({ name: string; until: number } | null)[] = [];
  private now = 0;
  /** turntable angle the player can drag (the Keypals screen) */
  spin = 0;
  /** the extra moves (the one-hand wave, dances), loaded after the buddy appears */
  private movesReady: Promise<unknown> = Promise.resolve();
  private shown = new Set<Character>();

  private constructor(island: Island, chars: Character[], opts: Opts) {
    this.island = island; this.chars = chars; this.opts = opts; this.view = opts.view;
    const f = island.trail.at(opts.spot ?? 6);
    this.base = f.p; this.n = f.n; this.t = f.t;
    chars.forEach((c, i) => {
      // hidden until its first pose is applied, so the bind pose never flashes up
      c.root.visible = false;
      stage.scene.add(c.root);
      c.play('idle', 0);
      this.next.push(2 + Math.random() * 4 + i);
      this.dancing.push(null);
      c.mixer.setTime(Math.random() * 3);
    });
    this.place(0);
  }

  static async create(opts: Opts): Promise<ShowScene> {
    const [island, ...chars] = await Promise.all([stage.getIsland(), ...opts.buddies.map(b => Character.create(b))]);
    const ok = chars.filter((c): c is Character => !!c);
    const loads: Promise<unknown>[] = [];
    for (const c of ok) {
      loads.push(c.loadMoves());
      const o = opts.outfits?.[c.id];
      if (o && o !== 'none') c.wear(o, makeOutfit);
    }
    const sc = new ShowScene(island, ok, opts);
    sc.movesReady = Promise.all(loads);
    return sc;
  }

  /** A big cast stands in rows, like a class photo: fewer at the front, each row a step further back and
   *  shifted half a place so every face shows between the shoulders in front. */
  private rows(): { row: number; off: number }[] {
    const n = this.chars.length, gap = n > 14 ? 1.02 : 1.2;
    // one more in each row going back, so the rows interleave (6, 7, 8 for the whole cast of 21)
    const k = Math.floor(n / 3);
    // a tall, narrow screen (a phone) stands them three to a row
    const narrow = stage.camera.aspect < 0.85;
    const per = narrow && n > 3 ? Array.from({ length: Math.ceil(n / 3) }, (_, r) => Math.min(3, n - r * 3)) : n <= 7 ? [n] : n <= 14 ? [Math.floor(n / 2), Math.ceil(n / 2)] : [k - 1, k, n - 2 * k + 1];
    const out: { row: number; off: number }[] = [];
    per.forEach((c, r) => { for (let j = 0; j < c; j++) out.push({ row: r, off: (j - (c - 1) / 2) * gap }); });
    return out;
  }
  private place(dt: number) {
    const n = this.chars.length, spots = this.rows();
    this.chars.forEach((c, i) => {
      const { row, off } = spots[i];
      const chosen = n > 1 && this.selected === c.id; // in a group the chosen one steps forward
      const want = this.base.clone().addScaledVector(this.t, off).addScaledVector(this.n, (chosen ? 0.7 : 0) - row * 1.1);
      want.y = this.island.height(want.x, want.z);
      if (dt === 0) c.root.position.copy(want); else c.root.position.lerp(want, 1 - Math.exp(-dt * 6));
      c.root.rotation.set(0, Math.atan2(this.n.x, this.n.z) + (n > 1 ? -off * 0.06 : this.spin), 0);
    });
  }

  select(id: FriendId | null) {
    this.selected = id;
    const c = this.chars.find(x => x.id === id);
    // the small one-hand wave (the big two-arm one starts by pulling both arms in, which looked like the
    // shoulders deflating); wait for it to load rather than fall back
    if (c) this.movesReady.then(() => { if (this.selected === id && c.has('wave1')) this.start(this.chars.indexOf(c), 'wave1'); });
  }
  async wear(id: FriendId, outfit: string) { await this.chars.find(c => c.id === id)?.wear(outfit, makeOutfit); }
  dance(id: FriendId, dance: string) {
    const i = this.chars.findIndex(c => c.id === id);
    if (i < 0) return;
    this.start(i, this.chars[i].has(dance) ? dance : 'fistpump');
  }
  /** Play a move; dances play for up to eight seconds, then back to standing. */
  private start(i: number, name: string) {
    const c = this.chars[i], a = c.play(name, 0.3);
    if (!a) return;
    a.reset();
    const len = a.getClip().duration;
    this.dancing[i] = { name, until: this.now + (a.loop === THREE.LoopOnce ? len : Math.min(8, Math.max(len, 4))) };
  }

  update(dt: number, t: number) {
    this.now = t;
    this.place(dt);
    this.chars.forEach((c, i) => {
      const d = this.dancing[i];
      if (d) {
        if (t > d.until) { this.dancing[i] = null; c.play('idle', 0.45); }
      } else if (this.chars.length > 1 && t > this.next[i]) {
        // now and then someone waves or does a little dance
        const pick = ['wave1', 'fistpump', 'dance_hiphop', 'jump', 'dance_hiphop2'][Math.floor(Math.random() * 5)];
        if (c.has(pick)) this.start(i, pick);
        this.next[i] = t + 5 + Math.random() * 6;
      }
      c.update(dt);
      if (!this.shown.has(c)) { this.shown.add(c); c.root.visible = true; }
    });
    this.camera(dt, t);
  }

  private camera(dt: number, t: number) {
    const cam = stage.camera, v = this.view, tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const n = this.chars.length, bandH = Math.max(0.2, v.bottom - v.top), bandW = Math.max(0.2, v.right - v.left);
    const focus = this.selected && n > 1 ? this.chars.find(c => c.id === this.selected)!.root.position.clone() : this.base.clone();
    focus.y = this.base.y;
    // fit the group's height into the band, and its width into the band's width
    const rows = n > 1 ? Math.max(...this.rows().map(x => x.row)) + 1 : 1;
    const widest = n > 1 ? Math.max(...this.rows().map(x => x.row).map(r => this.rows().filter(x => x.row === r).length)) : 1;
    const groupW = n > 1 ? widest * (n > 14 ? 1.02 : 1.2) + 0.4 : 1.4;
    // one buddy: room above for a hat; a group: everyone fits across, and the back rows show over the front
    const dH = (n > 1 ? 1.45 + (rows - 1) * 0.45 : 2.0) / (bandH * 2 * tanH), dW = groupW / (bandW * 2 * tanH * cam.aspect);
    const d = Math.max(n > 1 ? 2.4 : 3.0, n > 1 ? Math.max(dH, dW) : Math.max(dH, 1.3 / (bandW * 2 * tanH * cam.aspect)));
    const sway = this.opts.orbit ? Math.sin(t * 0.15) * 0.18 : 0;
    const dir = this.n.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), sway);
    const wantPos = this.base.clone().addScaledVector(dir, d).add(new THREE.Vector3(0, 0.75 + d * 0.12 + (rows - 1) * 0.55, 0));
    if (this.selected && n > 1) wantPos.addScaledVector(this.t, focus.clone().sub(this.base).dot(this.t) * 0.5);
    const aim = (this.selected && n > 1 ? focus : this.base).clone().add(new THREE.Vector3(0, n > 1 ? 0.62 : 0.78, 0)).addScaledVector(this.n, -(rows - 1) * 0.6);
    const ndcX = 2 * ((v.left + v.right) / 2) - 1, ndcY = 1 - 2 * ((v.top + v.bottom) / 2);
    const right = new THREE.Vector3().crossVectors(aim.clone().sub(wantPos).normalize(), new THREE.Vector3(0, 1, 0)).normalize();
    aim.addScaledVector(right, -ndcX * d * tanH * cam.aspect).y -= ndcY * d * tanH;
    if (!this.ready) { this.camPos.copy(wantPos); this.camAim.copy(aim); this.ready = true; }
    const k = 1 - Math.exp(-dt * 3);
    this.camPos.lerp(wantPos, k); this.camAim.lerp(aim, k);
    cam.position.copy(this.camPos); cam.lookAt(this.camAim);
  }

  focus() { return this.base; }
  dispose() { for (const c of this.chars) c.dispose(); }
}
