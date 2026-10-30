// The things the 3D surprises are made of: a leaping fish, a snowman (in one of the hats), pumpkins, a
// little flying saucer, a shooting star and a tiny door in the cliff. Painted where it counts (the fish,
// the door and the pumpkins' skin are paintings; the snowman wears the islands' snow and a real hat), and
// cheap: a few meshes each, nothing that costs a phone a frame.
import * as THREE from 'three';
import { loadTexture } from '../three/assets';
import { makeOutfit } from '../three/outfits3d';

export type Keep = <T extends { dispose(): void }>(x: T) => T;

/** A picture standing in the world, always turned to the camera (a sprite). */
async function sprite(path: string, height: number): Promise<THREE.Sprite | null> {
  const tex = await loadTexture(path, { color: true });
  if (!tex) return null;
  const img = tex.image as { width: number; height: number } | undefined;
  const aspect = img ? img.width / img.height : 1;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.15, depthWrite: false }));
  s.scale.set(height * aspect, height, 1);
  return s;
}

/** a soft round dot (puffs, snowflakes, the shooting star's head) */
export const soft = (() => {
  let tex: THREE.CanvasTexture | null = null;
  return () => {
    if (tex) return tex;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (tex = new THREE.CanvasTexture(cv));
  };
})();

// ---------- a fish that leaps out of the bay ----------
export type Leaper = { group: THREE.Group; leap(at: THREE.Vector3, dir: number): void; update(dt: number): boolean };
export async function fish(keep: Keep): Promise<Leaper | null> {
  const s = await sprite('fun/fish.webp', 1.2);
  if (!s) return null;
  const group = new THREE.Group();
  group.add(s);
  s.visible = false;
  // a ring of ripples where it goes in and comes out
  const ringMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  const rings = [0, 1].map(() => { const r = new THREE.Mesh(keep(new THREE.RingGeometry(0.3, 0.42, 32)), ringMat.clone()); r.rotation.x = -Math.PI / 2; group.add(r); return { r, k: 9 }; });
  const drop = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color: 0xe8fbff, transparent: true, opacity: 0, depthWrite: false }));
  drop.scale.setScalar(0.7); group.add(drop);
  let k = 9, from = new THREE.Vector3(), dir = 1;
  const DUR = 1.2, SPAN = 2.8, HIGH = 1.25;
  return {
    group,
    leap(at, d) { from.copy(at); dir = d; k = 0; s.visible = true; rings[0].r.position.set(at.x, 0.02, at.z); rings[0].k = 0; },
    update(dt) {
      for (const g of rings) if (g.k < 1) { g.k += dt / 0.9; g.r.scale.setScalar(1 + g.k * 2.2); (g.r.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - g.k); }
      if (k >= 1) { (drop.material as THREE.SpriteMaterial).opacity = Math.max(0, (drop.material as THREE.SpriteMaterial).opacity - dt * 2); return false; }
      k = Math.min(1, k + dt / DUR);
      const x = from.x + dir * SPAN * k, y = -0.25 + Math.sin(k * Math.PI) * HIGH;
      s.position.set(x, y, from.z);
      // nose up on the way out, nose down on the way in (and flipped to face the way it's going)
      (s.material as THREE.SpriteMaterial).rotation = dir * (0.9 - k * 1.8);
      s.scale.x = Math.abs(s.scale.x) * (dir > 0 ? -1 : 1);
      if (k >= 1) {
        s.visible = false;
        rings[1].r.position.set(x, 0.02, from.z); rings[1].k = 0;
        drop.position.set(x, 0.3, from.z); (drop.material as THREE.SpriteMaterial).opacity = 0.8;
      }
      return true;
    },
  };
}

// ---------- a snowman, wearing one of the hats ----------
const HATS = ['party_hat', 'flower_crown', 'propeller_cap', 'cowboy_hat', 'pirate_hat', 'wizard_hat', 'viking_helmet', 'top_hat', 'gold_crown'];
export type Snowman = { group: THREE.Group; update(t: number, look: THREE.Vector3 | null): void };
export async function snowman(keep: Keep, seed = Math.random()): Promise<Snowman> {
  const snowTex = await loadTexture('world/snow.webp', { repeat: true, color: true });
  const postTex = await loadTexture('world/post.webp', { repeat: true, color: true });
  const snow = keep(new THREE.MeshStandardMaterial({ map: snowTex, color: 0xffffff, roughness: 0.95 }));
  const coal = keep(new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.5 }));
  const stick = keep(new THREE.MeshStandardMaterial({ map: postTex, color: postTex ? 0xb08060 : 0x6a4a30, roughness: 0.9 }));
  const group = new THREE.Group(), head = new THREE.Group();
  const ball = (r: number, y: number, parent: THREE.Object3D) => { const m = new THREE.Mesh(keep(new THREE.SphereGeometry(r, 28, 18)), snow); m.position.y = y; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  ball(0.42, 0.36, group); ball(0.31, 0.95, group);
  head.position.y = 1.38; group.add(head); ball(0.22, 0, head);
  const dot = (r: number, x: number, y: number, z: number, p: THREE.Object3D) => { const m = new THREE.Mesh(keep(new THREE.SphereGeometry(r, 10, 8)), coal); m.position.set(x, y, z); p.add(m); };
  dot(0.028, -0.075, 0.06, 0.19, head); dot(0.028, 0.075, 0.06, 0.19, head);
  for (let i = 0; i < 5; i++) { const a = -0.55 + i * 0.275; dot(0.017, Math.sin(a) * 0.1, -0.06 - Math.cos(a) * 0.03, 0.2 - Math.abs(Math.sin(a)) * 0.02, head); }
  for (let i = 0; i < 3; i++) dot(0.03, 0, 1.12 - i * 0.16, 0.29 - i * 0.012, group);
  const nose = new THREE.Mesh(keep(new THREE.ConeGeometry(0.035, 0.24, 12)), keep(new THREE.MeshStandardMaterial({ color: 0xff8a2a, roughness: 0.6 })));
  nose.rotation.x = Math.PI / 2; nose.position.set(0, 0, 0.32); head.add(nose);
  // a red scarf, its tail blowing a little
  const red = keep(new THREE.MeshStandardMaterial({ color: 0xd8413e, roughness: 0.8 }));
  const scarf = new THREE.Mesh(keep(new THREE.TorusGeometry(0.2, 0.055, 10, 28)), red); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.2; group.add(scarf);
  const tail = new THREE.Mesh(keep(new THREE.BoxGeometry(0.1, 0.3, 0.04)), red); tail.position.set(0.12, 1.06, 0.18); tail.rotation.z = 0.25; group.add(tail);
  // twig arms, one waving now and then
  const arms = [-1, 1].map(side => {
    const a = new THREE.Group(); a.position.set(side * 0.27, 1.0, 0); group.add(a);
    const m = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.018, 0.024, 0.62, 6)), stick); m.position.x = side * 0.3; m.rotation.z = side * -Math.PI / 2.4; a.add(m);
    const f = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.012, 0.014, 0.16, 5)), stick); f.position.set(side * 0.55, 0.2, 0); f.rotation.z = side * -0.4; a.add(f);
    a.rotation.z = side * 0.35;
    return a;
  });
  // a different hat every time you come by
  const hat = await makeOutfit(HATS[Math.floor(seed * HATS.length) % HATS.length]).catch(() => null);
  if (hat) {
    const box = new THREE.Box3().setFromObject(hat), size = box.getSize(new THREE.Vector3());
    const fit = (hat.userData.fit as number) ?? 1, sink = (hat.userData.sink as number) ?? 0.25;
    const k = (0.44 * fit) / Math.max(1e-4, Math.max(size.x, size.z));
    hat.scale.setScalar(k);
    hat.position.y = 0.2 - box.min.y * k - size.y * k * sink;
    hat.rotation.z = (seed - 0.5) * 0.3;
    head.add(hat);
  }
  const wavePh = seed * 10;
  return {
    group,
    update(t, look) {
      if (look) { const local = group.worldToLocal(look.clone()); head.rotation.y += (Math.atan2(local.x, local.z) * 0.8 - head.rotation.y) * 0.06; }
      const w = Math.max(0, Math.sin(t * 0.7 + wavePh)) ** 6;
      arms[1].rotation.z = -0.35 - w * (1.2 + Math.sin(t * 9) * 0.35);
      tail.rotation.z = 0.25 + Math.sin(t * 2.3) * 0.12;
    },
  };
}

// ---------- pumpkins (in the last days of October) ----------
export async function pumpkinPatch(keep: Keep, n: number, rnd: () => number): Promise<THREE.Object3D[]> {
  const skin = await loadTexture('fun/pumpkin-skin.webp', { color: true });
  const geo = keep(new THREE.SphereGeometry(0.3, 40, 20));
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    const rib = 1 + Math.cos(a * 10) * 0.06 * (1 - Math.abs(y) / 0.3);
    const dent = y > 0.22 ? (y - 0.22) * 0.9 : 0;
    p.setXYZ(i, x * rib, y * 0.74 - dent, z * rib);
  }
  geo.computeVertexNormals();
  const stemGeo = keep(new THREE.CylinderGeometry(0.025, 0.045, 0.14, 8));
  const stemMat = keep(new THREE.MeshStandardMaterial({ color: 0x6f6a2c, roughness: 0.9 }));
  const out: THREE.Object3D[] = [];
  for (let i = 0; i < n; i++) {
    const mat = keep(new THREE.MeshStandardMaterial({ map: skin, color: new THREE.Color().setHSL(0.07 + rnd() * 0.03, 0.9, 0.62 + rnd() * 0.12), roughness: 0.55 }));
    const g = new THREE.Group();
    const body = new THREE.Mesh(geo, mat); body.position.y = 0.2; body.castShadow = true; g.add(body);
    const stem = new THREE.Mesh(stemGeo, stemMat); stem.position.y = 0.43; stem.rotation.z = (rnd() - 0.5) * 0.6; g.add(stem);
    g.scale.setScalar(0.7 + rnd() * 0.7); g.rotation.y = rnd() * 6;
    out.push(g);
  }
  return out;
}

// ---------- a little flying saucer ----------
export type Saucer = { group: THREE.Group; beam: THREE.Mesh; lights: THREE.Mesh[] };
export async function saucer(keep: Keep): Promise<Saucer> {
  const chrome = await loadTexture('gear/tile-chrome.webp', { repeat: true, color: true });
  const group = new THREE.Group();
  const hull = new THREE.Mesh(keep(new THREE.SphereGeometry(1, 36, 16)), keep(new THREE.MeshStandardMaterial({ map: chrome, color: 0xf2f6fc, metalness: 0.25, roughness: 0.32, emissive: 0x8899b8, emissiveIntensity: 0.25 })));
  hull.scale.set(1.4, 0.3, 1.4); group.add(hull);
  const rim = new THREE.Mesh(keep(new THREE.TorusGeometry(1.36, 0.08, 10, 48)), keep(new THREE.MeshStandardMaterial({ color: 0x8e9bb0, metalness: 0.8, roughness: 0.3 })));
  rim.rotation.x = Math.PI / 2; group.add(rim);
  const dome = new THREE.Mesh(keep(new THREE.SphereGeometry(0.62, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), keep(new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x3fb8e8, emissiveIntensity: 0.55, transparent: true, opacity: 0.8, roughness: 0.1 })));
  dome.position.y = 0.18; group.add(dome);
  const lights = Array.from({ length: 10 }, (_, i) => {
    const m = new THREE.Mesh(keep(new THREE.SphereGeometry(0.09, 10, 8)), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const a = (i / 10) * Math.PI * 2; m.position.set(Math.cos(a) * 1.36, -0.04, Math.sin(a) * 1.36); group.add(m); return m;
  });
  const beam = new THREE.Mesh(keep(new THREE.ConeGeometry(1.3, 7, 28, 1, true)), keep(new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  beam.position.y = -3.6; group.add(beam);
  return { group, beam, lights };
}

// ---------- a shooting star ----------
export type Streak = { group: THREE.Group; fire(from: THREE.Vector3, to: THREE.Vector3): void; update(dt: number): void };
export function shootingStar(keep: Keep): Streak {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 16;
  const g = cv.getContext('2d')!, gr = g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, 'rgba(255,240,200,0)'); gr.addColorStop(0.85, 'rgba(255,250,230,.85)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, 8); g.lineTo(256, 2); g.lineTo(256, 14); g.closePath(); g.fill();
  const tail = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), keep(new THREE.MeshBasicMaterial({ map: keep(new THREE.CanvasTexture(cv)), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color: 0xfff6cf, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  const group = new THREE.Group(); group.add(tail, head); group.visible = false;
  let k = 1; const a = new THREE.Vector3(), b = new THREE.Vector3();
  return {
    group,
    fire(from, to) { a.copy(from); b.copy(to); k = 0; group.visible = true; },
    update(dt) {
      if (k >= 1) { group.visible = false; return; }
      k = Math.min(1, k + dt / 1.1);
      const p = a.clone().lerp(b, k), dir = b.clone().sub(a).normalize(), len = a.distanceTo(b) * 0.28 * Math.sin(k * Math.PI);
      head.position.copy(p); head.scale.setScalar(len * 0.12 + 0.5);
      tail.position.copy(p).addScaledVector(dir, -len / 2); tail.scale.set(Math.max(0.01, len), Math.max(0.05, len * 0.03), 1);
      tail.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      (tail.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI);
    },
  };
}

// ---------- a tiny door in the cliff ----------
export async function tinyDoor(keep: Keep): Promise<THREE.Object3D | null> {
  const tex = await loadTexture('fun/door.webp', { color: true });
  if (!tex) return null;
  const img = tex.image as { width: number; height: number } | undefined, aspect = img ? img.width / img.height : 1;
  const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.5 * aspect, 0.5)), keep(new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.85 })));
  m.receiveShadow = true;
  return m;
}

/** A Glimmer from Adventure dropping in on a practice course (loaded only when it shows up). */
export async function cameo(id: string, height: number) {
  const { GlimmerModel } = await import('../three/glimmerModel');
  const g = await GlimmerModel.create(id as never, height);
  g.appearThen = 'idle';
  return g;
}

// ---------- a poof where a visitor pops in ----------
export type Poof = { group: THREE.Group; fire(at: THREE.Vector3, size?: number): void; update(dt: number): void };
/** A puff of little clouds and a few golden sparks bursting out round a spot and fading (a visitor's
 *  entrance, so it never just appears out of nowhere). */
export function poof(keep: Keep): Poof {
  const group = new THREE.Group(); group.visible = false;
  const bits = Array.from({ length: 12 }, (_, i) => {
    const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: soft(), color: i % 3 ? 0xffffff : 0xffe58a, transparent: true, depthWrite: false, opacity: 0 })));
    group.add(s);
    return { s, v: new THREE.Vector3() };
  });
  let k = 1, size = 0.5;
  return {
    group,
    fire(at, sz = 0.5) {
      size = sz; k = 0; group.position.copy(at); group.visible = true;
      bits.forEach((b, i) => { const a = (i / bits.length) * Math.PI * 2; b.v.set(Math.cos(a), 0.3 + Math.random() * 0.7, Math.sin(a)).multiplyScalar(sz * (1.4 + Math.random() * 0.6)); b.s.position.set(0, sz * 0.4, 0); });
    },
    update(dt) {
      if (k >= 1) { group.visible = false; return; }
      k = Math.min(1, k + dt / 0.75);
      for (const b of bits) {
        b.s.position.addScaledVector(b.v, dt * (1 - k));
        b.s.scale.setScalar(size * (0.35 + 0.9 * k));
        (b.s.material as THREE.SpriteMaterial).opacity = 0.95 * (1 - k * k);
      }
    },
  };
}
