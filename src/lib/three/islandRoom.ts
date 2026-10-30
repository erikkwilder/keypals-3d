// Inside a house on My Sky Island: one small, cosy room made of simple pieces (a wooden floor, three walls
// and a ceiling, a window with the sky in it, a bed, a round rug, a little table with a lamp, a picture and
// a door out), seen from the open front like a doll's house. Each kind of home tints it its own way (the
// cottage cream and blue, the hill house green, the mushroom house red, the tent purple). It's built once,
// well away from the island, and the buddy walks round it (three/islandScene.ts moves it there). A note
// from a Glimmer waits on the bed: the room's little secret.
import * as THREE from 'three';
import { loadTexture } from './assets';
import type { Box } from './gardenLayout';

type Keep = <T extends { dispose(): void }>(x: T) => T;
export type RoomLook = { wall: number; trim: number; rug: number; blanket: number; name: string };
/** each home's room (a home not here gets the cottage's) */
export const ROOM_LOOK: Record<string, RoomLook> = {
  cottage: { wall: 0xfff1dc, trim: 0x6f9fd8, rug: 0x7fc8c0, blanket: 0x8fb8f0, name: 'the cottage' },
  burrow: { wall: 0xeef5d8, trim: 0x8bb85a, rug: 0xf2c46a, blanket: 0xb6d98a, name: 'the hill house' },
  mushhouse: { wall: 0xfff0ec, trim: 0xe0614f, rug: 0xf7d26a, blanket: 0xf29a8c, name: 'the mushroom house' },
  tent: { wall: 0xf1eafc, trim: 0x8a6fd6, rug: 0xffb3cf, blanket: 0xb9a3f0, name: 'the tent' },
};

/** the room's size: half its width (x) and depth (z), and how tall */
export const ROOM_W = 2.0, ROOM_D = 1.4, ROOM_H = 2.6;

export class HouseRoom {
  readonly root = new THREE.Group();
  /** where the room is (the middle of its floor) */
  readonly at: THREE.Vector3;
  /** what the buddy can't walk through, in the room's own frame */
  readonly boxes: Box[] = [];
  /** the way out: where to stand (room frame), and the door */
  readonly exit = new THREE.Vector3(1.45, 0, 0.75);
  /** the note on the bed, and where to stand to read it */
  readonly note: THREE.Group;
  readonly noteSpot = new THREE.Vector3(-0.55, 0, -0.55);
  private tint: { wall: THREE.MeshStandardMaterial; trim: THREE.MeshStandardMaterial; rug: THREE.MeshStandardMaterial; blanket: THREE.MeshStandardMaterial };
  private lampGlow: THREE.Sprite | null = null;

  private constructor(at: THREE.Vector3, keep: Keep, planks: THREE.Texture | null) {
    this.at = at.clone();
    this.root.position.copy(at);
    const std = (o: THREE.MeshStandardMaterialParameters) => keep(new THREE.MeshStandardMaterial({ roughness: 0.8, ...o }));
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.root) => {
      const me = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), m); me.position.set(x, y, z); me.receiveShadow = true; me.castShadow = true; parent.add(me); return me;
    };
    const cyl = (r0: number, r1: number, h: number, m: THREE.Material, x: number, y: number, z: number, seg = 24) => {
      const me = new THREE.Mesh(keep(new THREE.CylinderGeometry(r0, r1, h, seg)), m); me.position.set(x, y, z); this.root.add(me); return me;
    };
    // (the walls glow a little of their own colour: a warm, lit-up room, never a dim one)
    this.tint = { wall: std({ color: 0xfff1dc, emissive: 0xfff1dc, emissiveIntensity: 0.22, roughness: 0.95 }), trim: std({ color: 0x6f9fd8 }), rug: std({ color: 0x7fc8c0, roughness: 1 }), blanket: std({ color: 0x8fb8f0, roughness: 0.9 }) };
    const W = ROOM_W, D = ROOM_D, H = ROOM_H;
    // the floor (planks), a deep base under it, the walls, a ceiling
    let floorMap: THREE.Texture | null = null;
    if (planks) { floorMap = keep(planks.clone()); floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(4, 3); floorMap.needsUpdate = true; }
    const wood = std({ map: floorMap, color: 0xe8c9a0, roughness: 0.7 });
    // (deep and tall enough that a tall phone screen never sees past them)
    box(W * 2 + 0.6, 0.6, D * 2 + 0.9, wood, 0, -0.3, 0.2);
    box(W * 2 + 0.6, 0.9, D * 2 + 0.9, std({ color: 0xc89a6a, roughness: 0.9 }), 0, -1.05, 0.2);
    const top = H + 1.0;
    box(W * 2 + 0.6, top, 0.2, this.tint.wall, 0, top / 2, -D - 0.1);
    for (const s of [-1, 1]) box(0.2, top, D * 2 + 0.4, this.tint.wall, s * (W + 0.1), top / 2, 0);
    box(W * 2 + 0.6, 0.25, D * 2 + 0.4, std({ color: 0xfff8ec, emissive: 0xfff8ec, emissiveIntensity: 0.35 }), 0, top + 0.12, 0);
    box(W * 2, 0.12, 0.05, this.tint.trim, 0, H, -D + 0.03);
    // a coloured strip along the bottom of the walls
    box(W * 2, 0.16, 0.04, this.tint.trim, 0, 0.08, -D + 0.02);
    for (const s of [-1, 1]) box(0.04, 0.16, D * 2, this.tint.trim, s * (W - 0.02), 0.08, 0);
    // a window on the back wall, with the sky in it
    const frame = std({ color: 0xffffff, roughness: 0.5 });
    box(1.0, 0.8, 0.02, std({ color: 0xbfe6ff, emissive: 0x9fd6ff, emissiveIntensity: 0.55, roughness: 0.3 }), 0.85, 1.55, -D + 0.01);
    box(1.12, 0.08, 0.06, frame, 0.85, 1.95, -D + 0.03); box(1.12, 0.08, 0.06, frame, 0.85, 1.15, -D + 0.03);
    for (const x of [0.29, 0.85, 1.41]) box(0.06, 0.82, 0.06, frame, x, 1.55, -D + 0.03);
    box(1.2, 0.06, 0.16, frame, 0.85, 1.1, -D + 0.08);
    // a cloud in the window
    const cloud = std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 });
    for (const [x, y, r] of [[0.65, 1.62, 0.09], [0.76, 1.66, 0.12], [0.88, 1.62, 0.09]]) { const c = new THREE.Mesh(keep(new THREE.SphereGeometry(r, 12, 8)), cloud); c.position.set(x, y, -D + 0.02); c.scale.z = 0.2; this.root.add(c); }
    // a picture of the island over the bed
    box(0.62, 0.48, 0.04, std({ color: 0xc89a6a }), -1.25, 1.75, -D + 0.03);
    box(0.52, 0.38, 0.02, std({ color: 0x9fd6ff, roughness: 0.6 }), -1.25, 1.75, -D + 0.055);
    const isle = new THREE.Mesh(keep(new THREE.CircleGeometry(0.12, 18)), std({ color: 0x7cc46a })); isle.position.set(-1.25, 1.68, -D + 0.07); isle.scale.y = 0.45; this.root.add(isle);
    const sun = new THREE.Mesh(keep(new THREE.CircleGeometry(0.05, 14)), std({ color: 0xffd34d, emissive: 0xffb52e, emissiveIntensity: 0.4 })); sun.position.set(-1.1, 1.84, -D + 0.07); this.root.add(sun);
    // the bed: a wooden frame, a blanket, a pillow
    box(0.95, 0.3, 1.5, std({ color: 0xb98a5a, roughness: 0.7 }), -1.45, 0.15, -0.6);
    box(0.95, 0.62, 0.1, std({ color: 0xb98a5a, roughness: 0.7 }), -1.45, 0.31, -1.33);
    box(0.92, 0.12, 1.1, this.tint.blanket, -1.45, 0.36, -0.42);
    box(0.7, 0.1, 0.32, std({ color: 0xffffff, roughness: 0.9 }), -1.45, 0.36, -1.1);
    this.boxes.push({ x0: -W, x1: -0.95, z0: -D, z1: 0.18 });
    // the round rug in the middle
    const rug = cyl(0.85, 0.85, 0.02, this.tint.rug, 0.05, 0.012, 0.15, 40); rug.receiveShadow = true;
    const ring = cyl(0.62, 0.62, 0.022, std({ color: 0xffffff, roughness: 1 }), 0.05, 0.014, 0.15, 40); ring.scale.set(1, 1, 1);
    cyl(0.5, 0.5, 0.024, this.tint.rug, 0.05, 0.016, 0.15, 40);
    // a little table with a lamp on it
    const tbl = std({ color: 0xd9a86a, roughness: 0.6 });
    cyl(0.36, 0.36, 0.06, tbl, 1.3, 0.62, -0.75); cyl(0.05, 0.07, 0.6, tbl, 1.3, 0.31, -0.75, 10); cyl(0.2, 0.22, 0.04, tbl, 1.3, 0.02, -0.75, 16);
    this.boxes.push({ x0: 0.9, x1: 1.7, z0: -1.15, z1: -0.35 });
    cyl(0.05, 0.06, 0.26, std({ color: 0xffffff }), 1.3, 0.78, -0.75, 10);
    const shade = cyl(0.1, 0.18, 0.18, std({ color: 0xfff1c2, emissive: 0xffc96a, emissiveIntensity: 0.9 }), 1.3, 0.98, -0.75, 18); shade.castShadow = false;
    // a flower pot by the window
    cyl(0.12, 0.09, 0.2, std({ color: 0xd9734f }), 1.75, 0.1, -1.15, 14);
    const leaf = std({ color: 0x5aa83a });
    for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(keep(new THREE.SphereGeometry(0.09, 10, 8)), leaf); const a = i * 1.26; l.position.set(1.75 + Math.cos(a) * 0.08, 0.3 + (i % 2) * 0.06, -1.15 + Math.sin(a) * 0.08); this.root.add(l); }
    const bloom = new THREE.Mesh(keep(new THREE.SphereGeometry(0.06, 10, 8)), std({ color: 0xff8fc0 })); bloom.position.set(1.75, 0.42, -1.15); this.root.add(bloom);
    // the door out, on the right wall near the front, with a mat in front of it
    box(0.06, 1.62, 0.84, this.tint.trim, W - 0.03, 0.81, 0.75);
    box(0.06, 1.5, 0.72, std({ map: floorMap, color: 0xb98a5a, roughness: 0.7 }), W - 0.06, 0.75, 0.75);
    const knob = new THREE.Mesh(keep(new THREE.SphereGeometry(0.035, 10, 8)), std({ color: 0xf5c542, metalness: 0.6, roughness: 0.3 })); knob.position.set(W - 0.11, 0.78, 0.48); this.root.add(knob);
    box(0.5, 0.02, 0.7, std({ color: 0xd9734f, roughness: 1 }), W - 0.35, 0.01, 0.75);
    // the note on the bed: a little envelope with a heart
    const note = new THREE.Group();
    const env = new THREE.Mesh(keep(new THREE.BoxGeometry(0.26, 0.02, 0.18)), std({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 0.35, roughness: 0.6 }));
    note.add(env);
    const heart = new THREE.Mesh(keep(new THREE.SphereGeometry(0.03, 10, 8)), std({ color: 0xff5f8f, emissive: 0xff5f8f, emissiveIntensity: 0.3 })); heart.position.y = 0.015; heart.scale.y = 0.4; note.add(heart);
    note.position.set(-1.35, 0.46, -0.45); note.rotation.y = 0.3;
    this.root.add(note);
    this.note = note;
  }

  static async build(at: THREE.Vector3, keep: Keep): Promise<HouseRoom> {
    const planks = await loadTexture('world/planks.webp', { repeat: true });
    return new HouseRoom(at, keep, planks);
  }
  /** Tint the room for a kind of home. */
  look(item: string) {
    const l = ROOM_LOOK[item] ?? ROOM_LOOK.cottage;
    this.tint.wall.color.set(l.wall); this.tint.wall.emissive.set(l.wall); this.tint.trim.color.set(l.trim); this.tint.rug.color.set(l.rug); this.tint.blanket.color.set(l.blanket);
  }
  /** room frame to the world */
  world(v: THREE.Vector3) { return v.clone().add(this.at); }
  update(t: number) {
    // the note bobs a little so it's easy to spot
    if (this.note.visible) { this.note.position.y = 0.46 + Math.abs(Math.sin(t * 2.4)) * 0.05; this.note.rotation.y = 0.3 + Math.sin(t * 1.3) * 0.15; }
    void this.lampGlow;
  }
}
