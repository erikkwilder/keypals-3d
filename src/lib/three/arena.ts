// The round stone arena on the island trail, for the Family Duel and Rival Ghosts: the same painted
// paving, ring of stones, fire bowls on stone pillars, element banners on wooden poles and ruined arch as
// the Adventure battle arena (battleScene.ts builds its own copy of this; they share the painted art).
import * as THREE from 'three';
import { loadGltf, loadTexture } from './assets';
import type { Fx } from './fx';
import type { Island } from './island';
import { ELEMENT, ELEMENTS } from '../adventure/glimmers';

const UP = new THREE.Vector3(0, 1, 0);
export type Arena = { group: THREE.Group; banners: THREE.Mesh[]; fires: THREE.Vector3[]; lights: THREE.PointLight[] };

export async function buildArena(island: Island, C: THREE.Vector3, n: THREE.Vector3, right: THREE.Vector3, R = 3.6): Promise<Arena> {
  const group = new THREE.Group(), banners: THREE.Mesh[] = [], fires: THREE.Vector3[] = [], lights: THREE.PointLight[] = [];
  const drape = (geo: THREE.BufferGeometry, lift = 0.03) => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) + C.x, z = pos.getZ(i) + C.z; pos.setY(i, island.height(x, z) - C.y + lift); }
    geo.computeVertexNormals();
  };
  const [floorTex, rockTex, arch, ruin] = await Promise.all([loadTexture('game/arena-floor.webp', { color: true }), loadTexture('world/rock.webp', { repeat: true, color: true }), loadGltf('world/rock_arch.glb'), loadGltf('world/ruin.glb')]);
  const floorGeo = new THREE.CircleGeometry(R, 96, 0, Math.PI * 2);
  floorGeo.rotateX(-Math.PI / 2);
  drape(floorGeo, 0.04);
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ map: floorTex, color: floorTex ? 0xffffff : 0xd8b98a, roughness: 0.95 }));
  floor.receiveShadow = true; floor.position.copy(C); group.add(floor);
  const stoneMat = new THREE.MeshStandardMaterial({ map: rockTex, color: rockTex ? 0xf2e6d4 : 0xbfa98a, roughness: 0.9 });
  if (rockTex) rockTex.repeat.set(0.6, 0.4);
  const block = new THREE.BoxGeometry(0.62, 0.34, 0.42, 3, 2, 2);
  { const p = block.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + (Math.sin(x * 9 + z * 7) + Math.cos(y * 11 + x * 5)) * 0.04; p.setXYZ(i, x * k, y * k, z * k); } block.computeVertexNormals(); }
  const N = 32;
  const rim = new THREE.InstancedMesh(block, stoneMat, N);
  const o = new THREE.Object3D();
  const facing = Math.atan2(n.x, n.z);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.sin(a + facing), 0, Math.cos(a + facing));
    const front = Math.max(0, dir.dot(n));
    const at = C.clone().addScaledVector(dir, R + 0.18);
    at.y = island.height(at.x, at.z) + 0.1 - front * 0.14;
    o.position.copy(at); o.rotation.set(0, a + facing, (Math.random() - 0.5) * 0.08); o.scale.set(1, 1 - front * 0.45, 1); o.updateMatrix();
    rim.setMatrixAt(i, o.matrix);
  }
  rim.castShadow = true; rim.receiveShadow = true; group.add(rim);
  const [postTex, ...bannerTex] = await Promise.all([loadTexture('world/post.webp', { repeat: true, color: true }), ...ELEMENTS.map(el => loadTexture(`game/banner-${el}.webp`))]);
  if (postTex) postTex.repeat.set(1, 3);
  const woodMat = new THREE.MeshStandardMaterial({ map: postTex, color: postTex ? 0xffffff : 0x8a6440, roughness: 0.85 });
  const pillarGeo = new THREE.CylinderGeometry(0.17, 0.22, 1.5, 14, 4);
  const bowlGeo = new THREE.CylinderGeometry(0.34, 0.2, 0.26, 18, 1);
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x3a1a0a, emissive: 0xff5a14, emissiveIntensity: 1.2, roughness: 0.9 });
  for (const off of [-1.15, 1.15]) {
    const a = facing + Math.PI + off;
    const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const at = C.clone().addScaledVector(dir, R + 0.5); at.y = island.height(at.x, at.z);
    const pillar = new THREE.Mesh(pillarGeo, stoneMat); pillar.position.copy(at).y += 0.75; pillar.castShadow = true; group.add(pillar);
    const bowl = new THREE.Mesh(bowlGeo, stoneMat); bowl.position.copy(at).y += 1.62; bowl.castShadow = true; group.add(bowl);
    const coals = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), coalMat); coals.rotation.x = -Math.PI / 2; coals.position.copy(at).y += 1.74; group.add(coals);
    const fire = at.clone().add(new THREE.Vector3(0, 1.78, 0));
    fires.push(fire);
    const l = new THREE.PointLight(0xff9a3a, 7, 8, 2); l.position.copy(fire).y += 0.3; group.add(l); lights.push(l);
  }
  ELEMENTS.forEach((el, i) => {
    const b = facing + Math.PI + (i - 2) * 0.4;
    const bd = new THREE.Vector3(Math.sin(b), 0, Math.cos(b));
    const bp = C.clone().addScaledVector(bd, R + 0.95); bp.y = island.height(bp.x, bp.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 3.0, 10), woodMat); pole.position.copy(bp).y += 1.5; pole.castShadow = true; group.add(pole);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 0.8, roughness: 0.3 })); knob.position.copy(bp).y += 3.05; group.add(knob);
    const tex = bannerTex[i];
    const img = tex?.image as { width: number; height: number } | undefined;
    const hgt = 1.45, wdt = img ? hgt * (img.width / img.height) : 0.62;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(wdt, hgt, 8, 12), new THREE.MeshStandardMaterial({ map: tex, color: tex ? 0xffffff : ELEMENT[el].color, side: THREE.DoubleSide, roughness: 0.8, transparent: true, alphaTest: 0.4 }));
    cloth.geometry.translate(0, -hgt / 2, 0);
    cloth.position.copy(bp).addScaledVector(bd, -0.08).y += 2.85;
    cloth.rotation.y = b + Math.PI;
    cloth.castShadow = true;
    group.add(cloth); banners.push(cloth);
  });
  const backDir = n.clone().negate();
  const place = (g: typeof arch, h: number, at: THREE.Vector3, turn: number) => {
    if (!g) return;
    const m = g.scene.clone(true), box = new THREE.Box3().setFromObject(m), k = h / Math.max(1e-4, box.getSize(new THREE.Vector3()).y);
    m.scale.setScalar(k); m.position.copy(at); m.position.y = island.height(at.x, at.z) - box.min.y * k - 0.05; m.rotation.y = turn;
    m.traverse(x => { const mm = x as THREE.Mesh; if (mm.isMesh) { mm.castShadow = true; mm.receiveShadow = true; } });
    group.add(m);
  };
  place(arch, 3.6, C.clone().addScaledVector(backDir, R + 2.6).addScaledVector(right, -0.8), facing);
  place(ruin, 2.2, C.clone().addScaledVector(backDir, R + 2.2).addScaledVector(right, 3.6), facing + 0.6);
  return { group, banners, fires, lights };
}

/** Banners wave, fires flicker, each frame. */
export function animateArena(a: Arena, fx: Fx, t: number) {
  for (const b of a.banners) { const p = b.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const y = -p.getY(i); p.setZ(i, Math.sin(t * 2.6 + y * 4 + b.id) * 0.06 * y); } p.needsUpdate = true; }
  for (const f of a.fires) fx.emit({ at: f, count: Math.random() < 0.5 ? 2 : 1, shape: ['dot', 'spark'], color: [0xffd27a, 0xff9a3a], to: 0xff3d1a, dir: UP, spread: 0.25, speed: [0.5, 1.2], radius: 0.12, life: [0.35, 0.7], size: [0.18, 0.34], grow: -0.6, drag: 1 });
  a.lights.forEach((l, i) => (l.intensity = 6 + Math.sin(t * 13 + i * 2) * 0.8 + Math.sin(t * 7.3 + i) * 0.6));
}

export function disposeArena(a: Arena) {
  a.group.removeFromParent();
  a.group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !m.userData.shared) { (m.material as THREE.Material)?.dispose?.(); } });
}
