// The rides, in 3D: walk, run, skateboard, bike, car, rocket. The skateboard is a Meshy model; the
// bike, car and rocket are built here so their wheels, pedals and flames can move. Each says where the
// rider sits, where the hands and feet go, and how it animates as it travels.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { loadGltf } from './assets';
import type { RideId } from '../engine/rides';

export type Mount = {
  /** stand on it (skateboard) or sit on it */
  stance: 'stand' | 'sit' | 'foot';
  /** the rider faces sideways on a skateboard */
  sideways?: boolean;
  /** local points (the vehicle travels along +z, up is +y) */
  seat?: THREE.Vector3;
  feet?: () => [THREE.Vector3, THREE.Vector3];
  hands?: [THREE.Vector3, THREE.Vector3];
  /** how high the vehicle floats (the rocket) */
  hover?: number;
};
export type Vehicle = { id: RideId; group: THREE.Group; mount: Mount; update(dt: number, speed: number, t: number): void };

const mat = (color: number, opts: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...opts });
function tube(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, 12);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return mesh;
}
function shadowAll(g: THREE.Object3D) { g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }

function wheel(radius: number, width: number, tyre: THREE.Material, hub: THREE.Material, spokes = 0) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.TorusGeometry(radius - width * 0.5, width * 0.5, 12, 32), tyre);
  t.rotation.y = Math.PI / 2;
  g.add(t);
  const h = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, width * 1.1, 16), hub);
  h.rotation.z = Math.PI / 2;
  g.add(h);
  if (spokes) for (let i = 0; i < spokes; i++) {
    const s = tube(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, Math.cos((i / spokes) * Math.PI * 2) * (radius - width), Math.sin((i / spokes) * Math.PI * 2) * (radius - width)), 0.006, hub);
    g.add(s);
  } else {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius - width * 0.9, radius - width * 0.9, width * 0.6, 24), hub);
    disc.rotation.z = Math.PI / 2;
    g.add(disc);
  }
  return g;
}

// ---------- bike ----------
function bike(): Vehicle {
  const g = new THREE.Group();
  const frame = mat(0x3a8ee8, { roughness: 0.35 }), dark = mat(0x2c2a3a, { roughness: 0.8 }), white = mat(0xf4f2fa), mint = mat(0x6fd6b4), silver = mat(0xc9ccd6, { metalness: 0.6, roughness: 0.3 });
  const R = 0.3, back = new THREE.Vector3(0, R, -0.45), front = new THREE.Vector3(0, R, 0.45);
  const wb = wheel(R, 0.06, dark, silver, 12), wf = wheel(R, 0.06, dark, silver, 12);
  wb.position.copy(back); wf.position.copy(front);
  g.add(wb, wf);
  const crank = new THREE.Vector3(0, 0.3, -0.05), seatTop = new THREE.Vector3(0, 0.66, -0.2), head = new THREE.Vector3(0, 0.72, 0.32);
  g.add(tube(back, crank, 0.022, frame), tube(back, seatTop, 0.022, frame), tube(crank, seatTop, 0.026, frame), tube(crank, head, 0.028, frame), tube(seatTop, head.clone().add(new THREE.Vector3(0, -0.04, 0)), 0.026, frame), tube(head, front, 0.024, frame));
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.05, 0.22, 3, 0.025), white);
  seat.position.copy(seatTop).add(new THREE.Vector3(0, 0.04, -0.01));
  g.add(seat);
  const bar = tube(new THREE.Vector3(-0.22, 0.86, 0.3), new THREE.Vector3(0.22, 0.86, 0.3), 0.016, dark);
  g.add(bar, tube(head, new THREE.Vector3(0, 0.86, 0.3), 0.02, frame));
  for (const x of [-0.22, 0.22]) { const grip = tube(new THREE.Vector3(x * 0.82, 0.86, 0.3), new THREE.Vector3(x * 1.1, 0.86, 0.3), 0.024, mint); g.add(grip); }
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), silver); bell.position.set(0.12, 0.89, 0.3); g.add(bell);
  // crank and pedals turn as the bike goes
  const crankG = new THREE.Group(); crankG.position.copy(crank); g.add(crankG);
  const pedalL = new THREE.Group(), pedalR = new THREE.Group();
  for (const [p, side] of [[pedalL, -1], [pedalR, 1]] as const) {
    const arm = tube(new THREE.Vector3(side * 0.06, 0, 0), new THREE.Vector3(side * 0.06, side * 0.12, 0), 0.012, silver);
    crankG.add(arm);
    p.position.set(side * 0.1, side * 0.12, 0);
    const pad = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.02, 0.06, 2, 0.008), dark);
    p.add(pad); crankG.add(p);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.01, 8, 24), silver); ring.rotation.y = Math.PI / 2; ring.position.x = 0.04; crankG.add(ring);
  shadowAll(g);
  let ang = 0;
  const tmp = new THREE.Vector3();
  const pedalPos = (p: THREE.Object3D) => { g.updateMatrixWorld(true); return p.getWorldPosition(tmp.clone()); };
  return {
    id: 'bike', group: g,
    mount: { stance: 'sit', seat: seat.position.clone().add(new THREE.Vector3(0, 0.03, -0.02)), hands: [new THREE.Vector3(0.21, 0.88, 0.3), new THREE.Vector3(-0.21, 0.88, 0.3)],
      // world positions of the pedals, so the feet can follow them round (left pedal sits at +x)
      feet: () => [pedalPos(pedalR), pedalPos(pedalL)] },
    update(dt, speed) {
      const d = speed * dt;
      wb.rotation.x += d / R; wf.rotation.x += d / R;
      ang += d / R * 0.55;
      crankG.rotation.x = ang;
      // pedals stay level as the crank turns
      pedalL.rotation.x = -ang; pedalR.rotation.x = -ang;
    },
  };
}

/**
 * A Meshy model placed in vehicle space (travel along +z, up +y). `basis` gives where the model's own x, y
 * and z axes point; `length` is its size along the travel direction; `ground` is the model-space height
 * that touches the ground (the wheels' bottom, say).
 */
async function meshyRide(file: string, opts: { basis: [THREE.Vector3, THREE.Vector3, THREE.Vector3]; length: number; lengthAxis: 'x' | 'y' | 'z'; ground?: number }) {
  const src = await loadGltf(file);
  const body = new THREE.Group();
  if (!src) return { body, toLocal: (p: THREE.Vector3) => p, model: new THREE.Group() as THREE.Object3D };
  const model = src.scene.clone(true);
  model.traverse(o => { const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (mm?.map) mm.map.anisotropy = 8; });
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
  const s = opts.length / size[opts.lengthAxis];
  body.add(model);
  body.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(...opts.basis));
  body.scale.setScalar(s);
  body.updateMatrix();
  // lift so the ground point sits at y = 0
  const groundPt = new THREE.Vector3(0, opts.ground ?? box.min.y, 0);
  if (opts.basis[1].y === 0) { // the model's y isn't up: find its lowest point in vehicle space instead
    body.updateMatrixWorld(true); // detached, so its world matrix is its own transform
    body.position.y = -new THREE.Box3().setFromObject(model).min.y;
  } else body.position.y = -groundPt.applyMatrix4(body.matrix).y;
  body.updateMatrix();
  // a point in the model's own units, in the vehicle's space
  const toLocal = (p: THREE.Vector3) => p.clone().applyMatrix4(body.matrix);
  return { body, toLocal, model };
}
const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------- car: Erik's red roadster (Meshy), its wheels cut out in Blender (tools/blender/car_wheels.py) and put back as wheels that turn ----------
// wheel centres and sizes in the model's units, glTF axes (x along the car, front at -x; y up; z across)
const CAR_WHEELS = [
  { c: [-0.551, -0.0915, 0.322], r: 0.168, w: 0.205 }, { c: [-0.548, -0.0915, -0.323], r: 0.168, w: 0.205 },
  { c: [0.566, -0.087, 0.328], r: 0.171, w: 0.19 }, { c: [0.560, -0.091, -0.328], r: 0.169, w: 0.19 },
];
async function car(): Promise<Vehicle> {
  const g = new THREE.Group();
  // front at the model's -x: model x -> back (-z), y -> up, z -> the camera's far side (+x)
  const { body, toLocal, model } = await meshyRide('world/ride_car.glb', { basis: [V3(0, 0, -1), V3(0, 1, 0), V3(1, 0, 0)], length: 2.3, lengthAxis: 'x', ground: -0.26 });
  g.add(body);
  // black tyres with red spoked rims, like the picture
  const tyre = mat(0x1d1b22, { roughness: 0.8 }), rim = mat(0xc8141e, { roughness: 0.3, metalness: 0.3 }), dark = mat(0x2a2830, { roughness: 0.5 });
  const wheels: THREE.Object3D[] = [];
  for (const wl of CAR_WHEELS) {
    const w = new THREE.Group();
    const t = new THREE.Mesh(new THREE.TorusGeometry(wl.r * 0.74, wl.r * 0.26, 14, 40), tyre);
    t.scale.z = wl.w / (wl.r * 0.52);
    w.add(t);
    const side = Math.sign(wl.c[2]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(wl.r * 0.5, wl.r * 0.06, 8, 32), rim); ring.position.z = side * wl.w * 0.32; w.add(ring);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(wl.r * 0.5, wl.r * 0.5, wl.w * 0.5, 24), dark); back.rotation.x = Math.PI / 2; w.add(back);
    for (let k = 0; k < 10; k++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(wl.r * 0.07, wl.r * 0.46, wl.r * 0.05), rim);
      const a = (k / 10) * Math.PI * 2;
      sp.position.set(Math.sin(a) * wl.r * 0.26, Math.cos(a) * wl.r * 0.26, side * wl.w * 0.3); sp.rotation.z = -a; w.add(sp);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(wl.r * 0.11, wl.r * 0.11, wl.w * 0.7, 16), rim); cap.rotation.x = Math.PI / 2; w.add(cap);
    w.position.set(wl.c[0], wl.c[1], wl.c[2]);
    model.add(w); // in the model's own space, so it shares its turn and scale
    wheels.push(w);
  }
  shadowAll(g);
  const s = body.scale.x;
  // the driver's seat is on the camera's side (model -z)
  const seat = toLocal(V3(0.26, -0.03, -0.15));
  const hands: [THREE.Vector3, THREE.Vector3] = [toLocal(V3(0.1, 0.12, -0.1)), toLocal(V3(0.1, 0.12, -0.2))];
  const feetL = toLocal(V3(-0.02, -0.04, -0.1)), feetR = toLocal(V3(-0.02, -0.04, -0.2));
  return {
    id: 'car', group: g,
    mount: { stance: 'sit', seat, hands, feet: () => { g.updateMatrixWorld(true); return [g.localToWorld(feetL.clone()), g.localToWorld(feetR.clone())]; } },
    update(dt, speed, t) {
      // forward is the model's -x, so wheels turn positively about its across axis (z)
      for (const w of wheels) w.rotation.z += (speed * dt) / (0.17 * s);
      model.position.y = Math.abs(Math.sin(t * 9)) * 0.003 * Math.min(1, speed);
    },
  };
}

// ---------- rocket: Erik's red-and-cream rocket (Meshy), flying level with its porthole turned to the sky like a cockpit: the buddy sits in the seat inside, head and shoulders out ----------
// The porthole was cut open in Blender (tools/blender/porthole.py). Model units, glTF axes: nose +y,
// porthole on +z, centred at (0, -0.02, 0.44), rim radius 0.236, front surface at z 0.546.
export const ROCKET = { length: 2.35, hover: 0.3, seatDepth: 0.15, roll: 0.3 };
async function rocket(): Promise<Vehicle> {
  const g = new THREE.Group();
  const holder = new THREE.Group(); g.add(holder);
  // nose forward (model +y to +z), porthole up (model +z to +y)
  const { body, toLocal, model } = await meshyRide('world/ride_rocket.glb', { basis: [V3(-1, 0, 0), V3(0, 0, 1), V3(0, 1, 0)], length: ROCKET.length, lengthAxis: 'y' });
  holder.add(body);
  shadowAll(body);
  // a dark little cabin inside, seen around the buddy through the opening (no light of its own: adding a
  // light to the scene makes every material recompile, which froze the game when the rocket arrived)
  const cabin = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 16), new THREE.MeshBasicMaterial({ color: 0x24305a, side: THREE.BackSide }));
  cabin.position.set(0, -0.05, 0.08);
  model.add(cabin);
  const H = ROCKET.hover;
  holder.position.y = H;
  holder.rotation.x = -0.05; // nose up a touch
  // rolled a little toward the camera (the vehicle's -x side), so you see into the cockpit
  holder.rotation.z = ROCKET.roll;
  // the flame streams back from the nozzle (model -y)
  const flame = new THREE.Group(); flame.position.copy(toLocal(V3(0, -0.86, 0))); holder.add(flame);
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.8, depthWrite: false }));
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.95, depthWrite: false }));
  // wide at the nozzle, tapering away behind it
  outer.geometry.translate(0, 0.45, 0); inner.geometry.translate(0, 0.275, 0);
  for (const c of [outer, inner]) c.rotation.x = -Math.PI / 2;
  flame.add(outer, inner);
  // in the seat: hips down in the cabin so the chest comes up through the opening, hands on the front of the rim
  const rimZ = 0.52, seatL = toLocal(V3(0, -0.05, rimZ - ROCKET.seatDepth));
  const handL = [toLocal(V3(0.14, 0.15, rimZ + 0.01)), toLocal(V3(-0.14, 0.15, rimZ + 0.01))];
  const footL = [toLocal(V3(0.1, 0.2, 0.14)), toLocal(V3(-0.1, 0.2, 0.14))]; // tucked inside, toward the nose
  // the rocket bobs, so the seat and hands are read from where it is now
  const inHolder = (p: THREE.Vector3) => { holder.updateMatrix(); return p.clone().applyMatrix4(holder.matrix); };
  return {
    id: 'rocket', group: g,
    mount: {
      stance: 'sit', hover: H,
      get seat() { return inHolder(seatL); },
      get hands() { return [inHolder(handL[0]), inHolder(handL[1])] as [THREE.Vector3, THREE.Vector3]; },
      feet: () => { g.updateMatrixWorld(true); return [holder.localToWorld(footL[0].clone()), holder.localToWorld(footL[1].clone())]; },
    },
    update(_dt, speed, t) {
      holder.position.y = H + Math.sin(t * 2.4) * 0.05;
      holder.rotation.z = ROCKET.roll + Math.sin(t * 1.3) * 0.025;
      // a short, flickering flame (long ones looked like a carrot trailing behind)
      const k = 0.55 + Math.min(0.5, speed * 0.06) + Math.random() * 0.2;
      outer.scale.set(1, k, 1); inner.scale.set(1, k * (0.9 + Math.random() * 0.2), 1);
    },
  };
}

// ---------- skateboard ----------
async function skateboard(): Promise<Vehicle> {
  const g = new THREE.Group();
  const src = await loadGltf('world/ride_skateboard.glb');
  const board = new THREE.Group(); g.add(board);
  if (src) {
    const m = src.scene.clone(true);
    const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
    // the model lies along its longest axis; turn that along +z
    if (size.x > size.z) m.rotation.y = Math.PI / 2;
    m.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(m), s2 = b2.getSize(new THREE.Vector3());
    const s = 0.82 / s2.z;
    m.scale.multiplyScalar(s);
    m.position.set(-(b2.min.x + s2.x / 2) * s, -b2.min.y * s, -(b2.min.z + s2.z / 2) * s);
    board.add(m);
  } else {
    board.add(new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.03, 0.8, 3, 0.012), mat(0x7cc4f2)));
  }
  shadowAll(g);
  const top = 0.13;
  return {
    id: 'skate', group: g,
    mount: { stance: 'stand', sideways: true, feet: () => { g.updateMatrixWorld(true); return [g.localToWorld(new THREE.Vector3(0, top, 0.2)), g.localToWorld(new THREE.Vector3(0, top, -0.2))]; } },
    update(_dt, speed, t) {
      // a little sway on the trucks
      board.rotation.z = Math.sin(t * 2.2) * 0.04 * Math.min(1, speed);
    },
  };
}

const builders: Partial<Record<RideId, () => Vehicle | Promise<Vehicle>>> = { skate: skateboard, bike, car, rocket };
const made = new Map<RideId, Promise<Vehicle | null>>();
/** The vehicle for a ride (walking and running have none). One of each, reused. */
export function vehicle(id: RideId): Promise<Vehicle | null> {
  let p = made.get(id);
  if (!p) { const b = builders[id]; p = b ? Promise.resolve(b()) : Promise.resolve(null); made.set(id, p); }
  return p;
}
