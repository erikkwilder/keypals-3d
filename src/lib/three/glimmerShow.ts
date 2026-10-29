// One Glimmer on show (the collection and the incubator): standing on a mossy stone on the island, turning
// slowly in the light. A new one arrives with a beam of its rarity's colour and a shower of sparkles.
import * as THREE from 'three';
import { stage, type Controller } from './stage';
import { GlimmerModel } from './glimmerModel';
import { Fx } from './fx';
import { loadTexture } from './assets';
import type { Island } from './island';
import type { View } from './runScene';
import { GLIMMER, RARITY, type GlimmerId } from '../adventure/glimmers';

const UP = new THREE.Vector3(0, 1, 0);

export class GlimmerShow implements Controller {
  fps = 60;
  readonly island: Island;
  view: View;
  readonly fx = new Fx();
  private g: GlimmerModel | null = null;
  private base: THREE.Vector3; private n: THREE.Vector3;
  private stone: THREE.Mesh;
  private camPos = new THREE.Vector3(); private camAim = new THREE.Vector3(); private ready = false;
  private loading = 0;
  spin = 0;

  private constructor(island: Island, view: View, stoneTex: THREE.Texture | null) {
    this.island = island; this.view = view;
    const f = island.trail.at(14);
    this.base = f.p.clone(); this.n = f.n.clone().setY(0).normalize();
    const geo = new THREE.CylinderGeometry(0.85, 1.0, 0.32, 40, 2);
    { const p = geo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i); const k = 1 + Math.sin(x * 7 + z * 5) * 0.03; p.setXYZ(i, x * k, y + (y > 0 ? Math.sin(x * 9) * Math.cos(z * 8) * 0.02 : 0), z * k); } geo.computeVertexNormals(); }
    if (stoneTex) { stoneTex.repeat.set(1.2, 0.5); }
    this.stone = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: stoneTex, color: stoneTex ? 0xf0e4d2 : 0xc9b49a, roughness: 0.9 }));
    this.stone.position.copy(this.base); this.stone.position.y = island.height(this.base.x, this.base.z) + 0.1;
    this.stone.castShadow = true; this.stone.receiveShadow = true;
    stage.scene.add(this.stone, this.fx.root);
    this.fx.setScale(innerHeight * Math.min(2, devicePixelRatio || 1), stage.camera.fov);
  }

  static async create(view: View, region: Parameters<typeof stage.getIsland>[0] = 'village'): Promise<GlimmerShow> {
    const [island, tex] = await Promise.all([stage.getIsland(region), loadTexture('world/rock.webp', { repeat: true, color: true })]);
    return new GlimmerShow(island, view, tex);
  }

  /** Show a Glimmer; `big` adds the beam and sparkles (a hatch, a new friend). */
  async show(id: GlimmerId, big = false) {
    const n = ++this.loading;
    const r = GLIMMER[id].rarity;
    const h = r === 'legendary' || r === 'mythic' ? 1.15 : id === 'whalecalf' ? 0.85 : 0.9;
    const g = await GlimmerModel.create(id, h).catch(() => null);
    if (!g || n !== this.loading) { g?.dispose(); return; }
    this.g?.dispose();
    this.g = g;
    g.root.position.copy(this.stone.position).y += 0.17;
    stage.scene.add(g.root);
    this.spin = 0;
    if (big) {
      const c = RARITY[r].color;
      this.fx.beam(this.stone.position.clone(), c, { radius: 1.1, height: 16, life: 3, peak: 1 });
      this.fx.emit({ at: g.root.position.clone().add(new THREE.Vector3(0, 0.6, 0)), count: 90, shape: ['star', 'dot', 'spark'], color: [c, 0xffffff, 0xffe066], speed: [1.5, 5], life: [0.8, 1.6], size: [0.12, 0.3], drag: 1.4, gravity: 0.5, spin: 3 });
    }
  }
  /** A little hop (tapped). */
  poke() { this.g?.play('happy'); }

  update(dt: number, t: number) {
    if (this.g) {
      this.spin += dt * 0.35;
      const camDir = this.n.clone().applyAxisAngle(UP, Math.sin(this.spin) * 0.6);
      this.g.face = this.g.root.position.clone().addScaledVector(camDir, 5);
      this.g.update(dt, t);
    }
    if (Math.random() < dt * 6) this.fx.emit({ at: this.stone.position.clone().add(new THREE.Vector3(0, 0.3, 0)), count: 1, shape: 'dot', color: [0xfff2b0, 0xffffff], speed: [0.1, 0.3], up: 3, radius: 1.2, life: [2, 3.5], size: [0.04, 0.08], gravity: -0.05 });
    this.fx.update(dt, t);
    // the camera: in front, a little above, fitting the Glimmer into the view
    const cam = stage.camera, v = this.view, tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const bandH = Math.max(0.2, v.bottom - v.top), bandW = Math.max(0.2, v.right - v.left);
    const focus = this.stone.position.clone().add(new THREE.Vector3(0, 0.75, 0));
    const d = Math.max(2.8 / (bandH * 2 * tanH), 2.6 / (bandW * 2 * tanH * cam.aspect));
    const wantPos = focus.clone().addScaledVector(this.n, d).add(new THREE.Vector3(0, d * 0.22, 0));
    const aim = focus.clone();
    const ndcX = 2 * ((v.left + v.right) / 2) - 1, ndcY = 1 - 2 * ((v.top + v.bottom) / 2);
    const right = new THREE.Vector3().crossVectors(aim.clone().sub(wantPos).normalize(), UP).normalize();
    aim.addScaledVector(right, -ndcX * d * tanH * cam.aspect).y -= ndcY * d * tanH;
    if (!this.ready) { this.camPos.copy(wantPos); this.camAim.copy(aim); this.ready = true; }
    const k = 1 - Math.exp(-dt * 3);
    this.camPos.lerp(wantPos, k); this.camAim.lerp(aim, k);
    cam.position.copy(this.camPos); cam.lookAt(this.camAim);
  }

  focus() { return this.base; }
  dispose() { this.g?.dispose(); this.fx.dispose(); this.stone.removeFromParent(); this.stone.geometry.dispose(); (this.stone.material as THREE.Material).dispose(); }
}
