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

// ---------- car ----------
function car(): Vehicle {
  const g = new THREE.Group();
  const paint = mat(0xe8414f, { roughness: 0.3 }), white = mat(0xffffff, { roughness: 0.4 }), dark = mat(0x2c2a3a, { roughness: 0.85 }), silver = mat(0xd7dae2, { metalness: 0.5, roughness: 0.3 }), glass = mat(0xbfe4ff, { roughness: 0.1, transparent: true, opacity: 0.6 });
  const chassis = new THREE.Mesh(new RoundedBoxGeometry(0.92, 0.3, 1.7, 5, 0.12), paint); chassis.position.set(0, 0.36, 0.05); g.add(chassis);
  const hood = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.26, 0.7, 5, 0.12), paint); hood.position.set(0, 0.56, 0.52); g.add(hood);
  const tail = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.3, 0.42, 5, 0.12), paint); tail.position.set(0, 0.58, -0.6); g.add(tail);
  for (const x of [-0.42, 0.42]) { const side = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.22, 0.75, 3, 0.04), paint); side.position.set(x, 0.58, -0.08); g.add(side); }
  const stripe = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.012, 1.2, 2, 0.006), white); stripe.position.set(0, 0.7, 0.3); g.add(stripe);
  const screen = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.2, 0.03, 3, 0.012), glass); screen.position.set(0, 0.78, 0.2); screen.rotation.x = -0.35; g.add(screen);
  for (const x of [-0.28, 0.28]) { const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), mat(0xfff6c8, { emissive: 0xfff2b0, emissiveIntensity: 0.4 })); lamp.position.set(x, 0.56, 0.89); lamp.scale.z = 0.5; g.add(lamp); }
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.12, 0.36, 3, 0.05), dark); seat.position.set(0, 0.5, -0.24); g.add(seat);
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.4, 0.1, 3, 0.05), dark); back.position.set(0, 0.7, -0.4); back.rotation.x = -0.15; g.add(back);
  const wheelG = new THREE.Group(); wheelG.position.set(0, 0.74, 0.12); wheelG.rotation.x = -1.0; g.add(wheelG);
  const steer = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 10, 28), dark); wheelG.add(steer);
  wheelG.add(tube(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -0.18), 0.015, silver));
  const wheels: THREE.Object3D[] = [];
  for (const [x, z] of [[-0.46, 0.55], [0.46, 0.55], [-0.46, -0.5], [0.46, -0.5]]) {
    const w = wheel(0.22, 0.14, dark, silver); w.position.set(x, 0.22, z); g.add(w); wheels.push(w);
  }
  shadowAll(g);
  return {
    id: 'car', group: g,
    mount: { stance: 'sit', seat: new THREE.Vector3(0, 0.58, -0.22), hands: [new THREE.Vector3(0.11, 0.8, 0.08), new THREE.Vector3(-0.11, 0.8, 0.08)],
      feet: () => { g.updateMatrixWorld(true); return [g.localToWorld(new THREE.Vector3(0.12, 0.32, 0.5)), g.localToWorld(new THREE.Vector3(-0.12, 0.32, 0.5))]; } },
    update(dt, speed, t) {
      for (const w of wheels) w.rotation.x += (speed * dt) / 0.22;
      wheelG.rotation.z = Math.sin(t * 1.3) * 0.15;
      chassis.position.y = 0.36 + Math.abs(Math.sin(t * 9)) * 0.008 * Math.min(1, speed);
    },
  };
}

// ---------- rocket ----------
function rocket(): Vehicle {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const white = mat(0xf6f4fb, { roughness: 0.35 }), red = mat(0xe8414f, { roughness: 0.35 }), blue = mat(0x5ab4f5, { roughness: 0.15, metalness: 0.2 }), dark = mat(0x3a3550);
  // the body: a lathe from tail to nose, along +z
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) { const u = i / 24; const z = -1 + u * 2; const r = z < 0.5 ? 0.3 - Math.pow(Math.max(0, -z - 0.7) / 0.3, 2) * 0.06 : 0.3 * Math.sqrt(Math.max(0, 1 - Math.pow((z - 0.5) / 0.5, 2))); prof.push(new THREE.Vector2(Math.max(0.001, r), z)); }
  const lathe = new THREE.LatheGeometry(prof, 32);
  lathe.rotateX(Math.PI / 2);
  const hull = new THREE.Mesh(lathe, white); body.add(hull);
  // red nose cap and stripe
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 3), red); nose.rotation.x = Math.PI / 2; nose.position.z = 0.75; nose.scale.set(0.62, 0.62, 0.8); body.add(nose);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.1, 32), red); band.rotation.x = Math.PI / 2; band.position.z = -0.35; body.add(band);
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), blue); win.position.set(0.302, 0.06, 0.25); win.rotation.y = Math.PI / 2; body.add(win);
  const win2 = win.clone(); win2.position.x = -0.302; win2.rotation.y = -Math.PI / 2; body.add(win2);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.32, -0.05); s.lineTo(0.32, -0.3); s.lineTo(0, -0.42); s.closePath();
    const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }), red);
    fin.geometry.translate(0, 0, -0.02);
    const holder = new THREE.Group(); holder.rotation.z = (i / 3) * Math.PI * 2 + Math.PI / 2;
    fin.position.set(0.22, 0, -0.55); fin.rotation.y = Math.PI / 2;
    holder.add(fin); body.add(holder);
  }
  const saddle = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.07, 0.4, 3, 0.03), dark); saddle.position.set(0, 0.31, -0.05); body.add(saddle);
  for (const x of [-0.33, 0.33]) { const peg = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.03, 0.12, 2, 0.012), dark); peg.position.set(x, -0.06, 0.12); body.add(peg); }
  const handle = tube(new THREE.Vector3(-0.15, 0.4, 0.32), new THREE.Vector3(0.15, 0.4, 0.32), 0.018, dark); body.add(handle);
  body.add(tube(new THREE.Vector3(0, 0.28, 0.32), new THREE.Vector3(0, 0.4, 0.32), 0.02, dark));
  // the flame: two nested glowing cones that flicker
  const flame = new THREE.Group(); flame.position.z = -1.0; body.add(flame);
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xff7ab8, transparent: true, opacity: 0.75, depthWrite: false }));
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.95, depthWrite: false }));
  for (const c of [outer, inner]) { c.rotation.x = -Math.PI / 2; c.geometry.translate(0, -0.45, 0); }
  inner.geometry.translate(0, 0.17, 0);
  flame.add(outer, inner);
  hull.castShadow = true;
  shadowAll(body);
  outer.castShadow = inner.castShadow = false;
  const H = 0.95;
  return {
    id: 'rocket', group: g,
    mount: { stance: 'sit', hover: H, seat: new THREE.Vector3(0, H + 0.36, -0.05), hands: [new THREE.Vector3(0.13, H + 0.42, 0.32), new THREE.Vector3(-0.13, H + 0.42, 0.32)],
      feet: () => { g.updateMatrixWorld(true); return [g.localToWorld(new THREE.Vector3(0.4, H - 0.04, 0.12)), g.localToWorld(new THREE.Vector3(-0.4, H - 0.04, 0.12))]; } },
    update(_dt, speed, t) {
      body.position.y = H + Math.sin(t * 2.4) * 0.05;
      body.rotation.z = Math.sin(t * 1.3) * 0.05;
      const s = 0.7 + Math.min(1.4, speed * 0.25) + Math.random() * 0.25;
      outer.scale.set(1, s, 1); inner.scale.set(1, s * (0.9 + Math.random() * 0.2), 1);
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
