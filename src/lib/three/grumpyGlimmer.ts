// The one you battle: a real Glimmer caught in the storm. It stands drained of colour and sulking, with
// its own little painted storm cloud raining on it. Every bit of cheer brings some colour back and shrinks
// the cloud; at zero the cloud bursts, its colours come back all at once, and it's happy again.
import * as THREE from 'three';
import { GlimmerModel } from './glimmerModel';
import { loadTexture } from './assets';
import type { Fx } from './fx';
import { GLIMMER, type GlimmerId } from '../adventure/glimmers';

/** A red cartoon anger mark, drawn once. */
let angerTex: THREE.CanvasTexture | null = null;
function anger() {
  if (angerTex) return angerTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  g.translate(64, 64); g.lineCap = 'round'; g.lineWidth = 14;
  for (let i = 0; i < 4; i++) {
    g.save(); g.rotate((i * Math.PI) / 2);
    g.strokeStyle = '#7a0f22'; g.lineWidth = 20; g.beginPath(); g.moveTo(14, -40); g.quadraticCurveTo(14, -14, 40, -14); g.stroke();
    g.strokeStyle = '#ff3d55'; g.lineWidth = 12; g.beginPath(); g.moveTo(14, -40); g.quadraticCurveTo(14, -14, 40, -14); g.stroke();
    g.restore();
  }
  angerTex = new THREE.CanvasTexture(cv); angerTex.colorSpace = THREE.SRGBColorSpace;
  return angerTex;
}

export class GrumpyGlimmer {
  readonly root = new THREE.Group();
  readonly glimmer: GlimmerModel;
  readonly height: number;
  /** a point at its middle, for powers to fly at */
  get centre() { return this.root.position.clone().add(new THREE.Vector3(0, this.height * (this.glimmer.floats ? 0.85 : 0.55), 0)); }
  /** 1 = as grumpy as can be, 0 = cheered right up */
  mood = 1; private shown = 1;
  lookAt = new THREE.Vector3();
  fx: Fx | null = null;
  private cloud = new THREE.Group();
  private puffs: { s: THREE.Sprite; base: THREE.Vector3; ph: number; w: number }[] = [];
  private rain: THREE.LineSegments; private rainPos: Float32Array; private rainN = 80;
  private mark: THREE.Sprite;
  private markT = 0; private zapT = 2; private laughT = 0;
  private bursting = -1;
  private cloudY: number; private cloudW: number;
  /** extra height for the cloud (it comes down out of the sky at the start) */
  cloudLift = 0;

  private constructor(g: GlimmerModel, h: number, tex: (THREE.Texture | null)[], champion: boolean) {
    this.glimmer = g; this.height = h;
    this.root.add(g.root);
    g.setGrey(1); g.droop = 1; g.appearThen = 'idle';
    // the storm cloud over its head, wider for a Champion
    this.cloudW = h * (champion ? 1.7 : 1.45) + 0.4;
    this.cloudY = h * (g.floats ? 1.45 : 1.18) + 0.25;
    const layout = [[0, 0, 1], [-0.32, -0.06, 0.72], [0.34, -0.04, 0.78], [-0.12, 0.12, 0.7], [0.18, 0.1, 0.64]];
    layout.forEach(([x, y, w], i) => {
      const t = tex[i % tex.length];
      const mat = new THREE.SpriteMaterial({ map: t, color: 0xa9b0c8, transparent: true, depthWrite: false, opacity: t ? 1 : 0 });
      const s = new THREE.Sprite(mat);
      const ww = this.cloudW * w;
      s.scale.set(ww, ww * 0.48, 1);
      s.position.set(x * this.cloudW, y * this.cloudW * 0.45, i * -0.02);
      s.renderOrder = 2;
      this.cloud.add(s);
      this.puffs.push({ s, base: s.position.clone(), ph: i * 1.9, w: ww });
    });
    this.cloud.position.y = this.cloudY;
    this.root.add(this.cloud);
    // rain from the cloud to the ground
    this.rainPos = new Float32Array(this.rainN * 6);
    for (let i = 0; i < this.rainN; i++) this.drop(i, true);
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xc8dcff, transparent: true, opacity: 0.7, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.root.add(this.rain);
    this.mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: anger(), transparent: true, depthWrite: false }));
    this.mark.scale.setScalar(0.001); this.mark.renderOrder = 3;
    this.root.add(this.mark);
  }

  static async create(id: GlimmerId, champion: boolean): Promise<GrumpyGlimmer> {
    const r = GLIMMER[id].rarity;
    const h = champion ? 1.35 : r === 'epic' || r === 'mythic' ? 1.05 : 0.95;
    const [g, t1, t2] = await Promise.all([GlimmerModel.create(id, h), loadTexture('game/storm1.webp'), loadTexture('game/storm2.webp')]);
    return new GrumpyGlimmer(g, h, [t1, t2], champion);
  }

  private drop(i: number, anywhere = false) {
    const x = (Math.random() - 0.5) * this.cloudW * 0.75, z = (Math.random() - 0.5) * 0.5;
    const top = this.cloudY - 0.1, y = anywhere ? Math.random() * top : top;
    this.rainPos.set([x, y, z, x - 0.015, y - 0.14, z], i * 6);
  }

  /** Cheer lands: a squash, a flash, a little anger mark. */
  hit(k = 0.6) { this.glimmer.play('hit'); this.glimmer.flash(0.35 + k * 0.4); if (this.mood > 0.25) this.markT = 0.9; }
  /** A cross little stomp before its mischief. */
  attack() { this.glimmer.play('stomp'); this.markT = 1.1; }
  /** Hops about, pleased with itself (you ran out of energy). */
  laugh() { this.laughT = 2.4; }
  /** Cheered right up: the cloud bursts and its colours come back. */
  burst() {
    this.bursting = 0;
    this.glimmer.droop = 0;
    this.glimmer.play('happy');
    this.fx?.emit({ at: this.root.position.clone().add(new THREE.Vector3(0, this.cloudY, 0)), count: 70, shape: ['star', 'dot', 'heart'], color: [0xffffff, 0xffe066, 0xff9ad5, 0x9fe6ff], speed: [1.5, 4.5], life: [0.8, 1.5], size: [0.15, 0.3], drag: 1.5, spin: 3 });
  }
  get burstDone() { return this.bursting >= 1; }

  update(dt: number, t: number) {
    this.shown += (this.mood - this.shown) * Math.min(1, dt * 2.5);
    const m = this.shown;
    if (this.bursting < 0) { this.glimmer.setGrey(Math.min(1, m * 1.05)); this.glimmer.droop = Math.min(1, m * 1.4); }
    else { this.bursting = Math.min(1, this.bursting + dt * 1.6); this.glimmer.setGrey(Math.max(0, (1 - this.bursting * 2)) * 0.4); }
    // the cloud: darker and bigger when grumpy, it thins and lightens as the mood lifts
    const size = this.bursting >= 0 ? 1 + this.bursting * 0.8 : 0.55 + m * 0.45;
    const dark = new THREE.Color(0xa9b0c8).lerp(new THREE.Color(0xf4f6fc), 1 - m);
    for (const p of this.puffs) {
      const mat = p.s.material as THREE.SpriteMaterial;
      mat.color.copy(dark);
      mat.opacity = this.bursting >= 0 ? Math.max(0, 1 - this.bursting * 1.3) : 1;
      const b = 1 + Math.sin(t * 1.3 + p.ph) * 0.04;
      p.s.scale.set(p.w * size * b, p.w * 0.48 * size * b, 1);
      p.s.position.set(p.base.x * size + Math.sin(t * 0.6 + p.ph) * 0.04, p.base.y * size + Math.sin(t * 1.1 + p.ph) * 0.03, p.base.z);
    }
    this.cloud.position.y = this.cloudY + this.cloudLift + Math.sin(t * 1.4) * 0.05 + (this.glimmer.floats ? Math.sin(t * 2) * 0.03 : 0);
    // rain, heavy when grumpy
    const n = this.bursting >= 0 ? 0 : Math.round(this.rainN * Math.max(0, (m - 0.15) / 0.85));
    for (let i = 0; i < this.rainN; i++) {
      const y = this.rainPos[i * 6 + 1] - dt * 3.4;
      if (y < 0.02) this.drop(i); else { this.rainPos[i * 6 + 1] = y; this.rainPos[i * 6 + 4] = y - 0.14; }
    }
    this.rain.geometry.setDrawRange(0, n * 2);
    (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    // now and then a little lightning in the cloud, while it's still really grumpy
    this.zapT -= dt;
    if (this.zapT < 0 && this.fx && m > 0.55 && this.bursting < 0) {
      this.zapT = 2.5 + Math.random() * 3;
      const c = this.root.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * this.cloudW * 0.5, this.cloudY - 0.1, 0.1));
      this.fx.lightning(c, c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.45, 0)), 0xfff1a0, 0.025);
    }
    // the anger mark pops up by its head, then shrinks away
    this.markT = Math.max(0, this.markT - dt);
    const ms = this.markT > 0 ? Math.min(1, this.markT * 4) * (0.26 + Math.sin(t * 18) * 0.02) * (this.height / 0.95) : 0.001;
    this.mark.scale.setScalar(ms);
    this.mark.position.set(this.height * 0.32, this.height * (this.glimmer.floats ? 1.25 : 0.98), 0.25);
    // laughing: hop, hop, hop
    if (this.laughT > 0) { this.laughT -= dt; if (Math.floor(this.laughT / 0.45) !== Math.floor((this.laughT + dt) / 0.45)) this.glimmer.play('hop'); }
    this.glimmer.face = this.lookAt;
    this.glimmer.update(dt, t);
  }

  dispose() {
    this.glimmer.dispose();
    this.root.removeFromParent();
    for (const p of this.puffs) (p.s.material as THREE.Material).dispose();
    this.rain.geometry.dispose(); (this.rain.material as THREE.Material).dispose();
    (this.mark.material as THREE.Material).dispose();
  }
}
