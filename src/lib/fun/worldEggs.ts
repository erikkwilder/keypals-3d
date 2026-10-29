// Surprises in the 3D world during lessons and trips: things you notice on the third visit, and rare
// ones you may see once in a long while. All of them stay off to the far side of the trail (the camera
// looks from the near side), so nothing ever comes between you and your buddy.
//
// On the island trail: Pebble the tortoise is walking the whole trail, a few steps further every lesson;
// a Sky Whale drifts through the far sky (1 in 5); a Spark Moth flutters along with you for a while
// (1 in 4); a little flying saucer stops to have a look (1 in 40); a shooting star crosses the sky as you
// finish (1 in 5); pumpkins line the trail at the end of October; snow falls in December.
// On the courses: a tiny door halfway up the cliff (always there, if you look); the Spark Moth on the
// cliff (1 in 3); a snowman at the bottom of the sled run, in a different hat every time; Snowdrop Seal
// belly-sliding beside you (1 in 3); fish leaping out of the bay; Puddle Pup paddling by the lane
// (1 in 3); and the shooting star at the finish.
import * as THREE from 'three';
import { sfx } from '../audio/sound';
import { chance, recall, remember, season } from './luck';
import { world } from './bus';
import { cameo, fish, pumpkinPatch, saucer, shootingStar, snowman, tinyDoor, type Keep, type Leaper, type Saucer } from './props3d';

type TP = { p: THREE.Vector3; t: THREE.Vector3; n: THREE.Vector3 };
type GM = Awaited<ReturnType<typeof cameo>>;
const rand = () => Math.random();

/** Snow falling round the camera's subject (a cheap cloud of points that follows it). */
function snowfall(keep: Keep) {
  const N = 320, pos = new Float32Array(N * 3), sp = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (rand() - 0.5) * 26; pos[i * 3 + 1] = rand() * 12; pos[i * 3 + 2] = (rand() - 0.5) * 26; sp[i] = 0.5 + rand() * 0.7; }
  const geo = keep(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, keep(new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false })));
  pts.frustumCulled = false;
  return {
    pts,
    update(dt: number, t: number, focus: THREE.Vector3) {
      pts.position.set(focus.x, focus.y - 2, focus.z);
      for (let i = 0; i < N; i++) {
        let y = pos[i * 3 + 1] - dt * sp[i];
        if (y < 0) y += 12;
        pos[i * 3 + 1] = y; pos[i * 3] += Math.sin(t * 0.8 + i) * dt * 0.15;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

/** The shooting star at the finish (1 in 5), fired the first time the buddy reaches it. */
function finishStar(group: THREE.Group, keep: Keep) {
  const star = shootingStar(keep); group.add(star.group);
  let armed = false;
  return {
    arm() { armed = chance(1 / 5); },
    update(dt: number, focus: THREE.Vector3, fin: TP) {
      star.update(dt);
      if (!armed || focus.distanceTo(fin.p) > 3) return;
      armed = false;
      const far = fin.p.clone().addScaledVector(fin.n, -70);
      star.fire(far.clone().addScaledVector(fin.t, -40).add(new THREE.Vector3(0, 42, 0)), far.clone().addScaledVector(fin.t, 35).add(new THREE.Vector3(0, 26, 0)));
      setTimeout(() => sfx.twinkle(), 150);
    },
  };
}

// ---------- the island trail ----------
export function trailEggs(o: { root: THREE.Object3D; trail: { at(s: number): TP }; height: (x: number, z: number) => number }) {
  const group = new THREE.Group(); group.visible = false; o.root.add(group);
  const keep: Keep = x => x; // the island is kept for the whole game: nothing here is thrown away
  const ground = (p: THREE.Vector3) => p.setY(o.height(p.x, p.z));
  let finishS = 60, startT = -1;
  const star = finishStar(group, keep);
  // Pebble's big walk: a few metres further along the trail every lesson, until one day he makes it
  let pebble: GM | null = null, pebbleS = 6, pebbleMade = false, pebbleSaid = false;
  void cameo('pebbletort', 0.42).then(g => { pebble = g; group.add(g.root); }).catch(() => null);
  // the rest is rolled each lesson
  let whale: GM | null = null, moth: GM | null = null, ufo: Saucer | null = null;
  let roll = { whale: false, moth: false, ufo: false };
  let mothT = -1, ufoT = -1, ufoFrom = new THREE.Vector3(), ufoAt = new THREE.Vector3();
  let pumpkins: THREE.Object3D[] | null = null, snow: ReturnType<typeof snowfall> | null = null;

  function visit(s: number) {
    finishS = s; startT = -1; mothT = -1; ufoT = -1; pebbleSaid = false;
    // Pebble: on from where he got to last time (back to the start once he's made it)
    const walked = recall<number>('pebbleWalk', 0);
    pebbleMade = 6 + walked >= finishS - 5;
    pebbleS = pebbleMade ? finishS - 5 : 6 + walked;
    remember('pebbleWalk', pebbleMade ? 0 : walked + 7);
    roll = { whale: chance(1 / 5), moth: chance(1 / 4), ufo: chance(1 / 40) };
    star.arm();
    if (roll.whale && !whale) void cameo('skywhale', 7).then(g => { whale = g; group.add(g.root); }).catch(() => null);
    if (roll.moth && !moth) void cameo('sparkmoth', 0.42).then(g => { moth = g; group.add(g.root); }).catch(() => null);
    if (roll.ufo && !ufo) void saucer(keep).then(u => { ufo = u; group.add(u.group); u.group.visible = false; }).catch(() => null);
    const sz = season();
    if (sz === 'pumpkins' && !pumpkins) void pumpkinPatch(keep, 9, rand).then(ps => { pumpkins = ps; ps.forEach(x => group.add(x)); placePumpkins(); });
    else if (pumpkins) placePumpkins();
    if (sz === 'snow' && !snow) { snow = snowfall(keep); group.add(snow.pts); }
    if (snow) snow.pts.visible = sz === 'snow';
  }
  function placePumpkins() {
    if (!pumpkins) return;
    const on = season() === 'pumpkins';
    pumpkins.forEach((pk, i) => {
      pk.visible = on;
      const f = o.trail.at(5 + ((finishS - 8) * (i + 0.5)) / pumpkins!.length);
      pk.position.copy(ground(f.p.clone().addScaledVector(f.n, -(1.5 + (i % 3) * 0.45)).addScaledVector(f.t, (i % 2) * 0.6)));
    });
  }

  function update(dt: number, t: number, focus: THREE.Vector3) {
    group.visible = world.run;
    if (!world.run) return;
    if (startT < 0) startT = t;
    const since = t - startT;
    const fin = o.trail.at(finishS);
    star.update(dt, focus, fin);
    if (pebble) {
      // he plods on a little while you type
      if (!pebbleMade) pebbleS += dt * 0.06;
      const f = o.trail.at(pebbleS);
      pebble.root.position.copy(ground(f.p.clone().addScaledVector(f.n, -1.5)));
      pebble.face = pebble.root.position.clone().add(pebbleMade ? f.n.clone().multiplyScalar(3) : f.t);
      if (!pebbleSaid && focus.distanceTo(pebble.root.position) < 2.6) { pebbleSaid = true; pebble.play(pebbleMade ? 'happy' : 'hop'); if (pebbleMade) sfx.cheer(); }
      pebble.update(dt, t);
    }
    if (whale) {
      whale.root.visible = roll.whale;
      if (roll.whale) {
        const f = o.trail.at(finishS * 0.5);
        whale.root.position.copy(f.p).addScaledVector(f.n, -62).addScaledVector(f.t, -30 + since * 0.7).add(new THREE.Vector3(0, 20 + Math.sin(t * 0.3) * 1.5, 0));
        whale.face = whale.root.position.clone().add(f.t);
        whale.update(dt, t);
      }
    }
    if (moth) {
      const fs = focus;
      if (roll.moth && mothT < 0 && since > 8) mothT = 0;
      moth.root.visible = roll.moth && mothT >= 0 && mothT < 16;
      if (moth.root.visible) {
        mothT += dt;
        const away = Math.max(0, mothT - 12) * 3;
        const a = t * 1.6;
        const f = o.trail.at(finishS * 0.5);
        moth.root.position.copy(fs).addScaledVector(f.n, -1.3 + Math.sin(a) * 0.4).add(new THREE.Vector3(Math.cos(a) * 0.9, 1.5 + Math.sin(a * 2) * 0.25 + away, 0));
        moth.face = fs.clone().add(new THREE.Vector3(0, 1, 0));
        moth.update(dt, t);
      }
    }
    if (ufo) {
      const u = ufo;
      if (roll.ufo && ufoT < 0 && since > 12) {
        ufoT = 0;
        const f = o.trail.at(Math.min(finishS, finishS * 0.4 + since * 0.5));
        ufoAt.copy(f.p).addScaledVector(f.n, -28).add(new THREE.Vector3(0, 13, 0));
        ufoFrom.copy(ufoAt).addScaledVector(f.t, 70).add(new THREE.Vector3(0, 30, 0));
        u.group.visible = true;
        sfx.ufo();
      }
      if (ufoT >= 0 && u.group.visible) {
        ufoT += dt;
        const k = ufoT;
        if (k < 3) u.group.position.lerpVectors(ufoFrom, ufoAt, 1 - (1 - k / 3) ** 3);
        else if (k < 6) u.group.position.copy(ufoAt).add(new THREE.Vector3(Math.sin(k * 3) * 0.3, Math.sin(k * 2) * 0.4, 0));
        else u.group.position.copy(ufoAt).add(new THREE.Vector3(0, (k - 6) ** 2 * 18, 0)).addScaledVector(ufoFrom.clone().sub(ufoAt).setY(0).normalize(), -(k - 6) * 25);
        u.group.rotation.y = t * 2.5;
        (u.beam.material as THREE.MeshBasicMaterial).opacity = k > 3.6 && k < 5.6 ? 0.22 + Math.sin(t * 12) * 0.05 : 0;
        u.lights.forEach((l, i) => (l.material as THREE.MeshBasicMaterial).color.setHSL(((t * 1.5 + i / 10) % 1), 0.9, 0.65));
        if (k > 8) u.group.visible = false;
      }
    }
    snow?.update(dt, t, focus);
  }
  return { visit, update };
}

// ---------- the courses ----------
type CourseCtx = {
  root: THREE.Object3D; keep: Keep; at: (s: number) => TP; finishS: () => number;
  /** climb: the rock face's depth at (x, y), and the height of the top */
  wallZ?: (x: number, y: number) => number; top?: () => number;
  /** slide: the snow's height at x */
  slopeY?: (x: number) => number;
};
export function courseEggs(move: 'climb' | 'slide' | 'swim', c: CourseCtx) {
  const group = new THREE.Group(); c.root.add(group);
  const star = finishStar(group, c.keep);
  star.arm();
  const models: GM[] = [];
  const cam = (id: string, h: number) => cameo(id, h).then(g => { models.push(g); group.add(g.root); return g; });
  let door: THREE.Object3D | null = null, moth: GM | null = null, man: Awaited<ReturnType<typeof snowman>> | null = null;
  let seal: GM | null = null, pup: GM | null = null, leaper: Leaper | null = null;
  let sealOn = false, pupOn = false, mothOn = false, sealSaid = false, pupSaid = false, nextLeap = 2.5 + rand() * 3;
  if (move === 'climb') {
    void tinyDoor(c.keep).then(d => { door = d; if (d) { group.add(d); place(); } });
    mothOn = chance(1 / 3);
    if (mothOn) void cam('sparkmoth', 0.42).then(g => (moth = g));
  } else if (move === 'slide') {
    void snowman(c.keep).then(m => { man = m; group.add(m.group); place(); });
    sealOn = chance(1 / 3);
    if (sealOn) void cam('snowseal', 0.5).then(g => (seal = g));
  } else {
    void fish(c.keep).then(f => { leaper = f; if (f) group.add(f.group); });
    pupOn = chance(1 / 3);
    if (pupOn) void cam('puddlepup', 0.5).then(g => (pup = g));
  }
  function place() {
    const fs = c.finishS();
    if (door && c.wallZ && c.top) {
      // halfway up, just off the climbing line: a tiny door with a lantern and a doormat
      const y = Math.max(1.4, c.top() * 0.45), x = 1.55;
      door.position.set(x, y, c.wallZ(x, y) + 0.04);
    }
    if (man && c.slopeY) {
      // on the snow a little before the finish arch, where he can watch you go by
      const x = fs - 6.5;
      man.group.position.set(x, c.slopeY(x) - 0.08, -3.1);
      man.group.rotation.y = 0.35;
    }
  }
  function update(dt: number, t: number, focus: THREE.Vector3) {
    const fs = c.finishS(), fin = c.at(fs);
    star.update(dt, focus, fin);
    if (moth) {
      const a = t * 1.7;
      moth.root.position.copy(focus).add(new THREE.Vector3(1.0 + Math.cos(a) * 0.5, 0.5 + Math.sin(a * 2) * 0.3, 0.55));
      moth.face = focus.clone();
    }
    if (man) man.update(t, focus);
    if (seal && c.slopeY) {
      // belly-sliding a little ahead of you, racing you to the bottom, then a happy flop at the end
      const ahead = focus.x > fs * 0.2;
      seal.root.visible = ahead;
      const x = Math.min(fs + 1.6, focus.x + 1.8 + Math.sin(t * 0.7) * 0.5);
      seal.root.position.set(x, c.slopeY(Math.min(x, fs + 0.2)) + 0.03, -1.45);
      const done = x >= fs + 1.5;
      seal.face = done ? new THREE.Vector3(x, 0, 6).setY(seal.root.position.y) : seal.root.position.clone().add(new THREE.Vector3(1, 0, 0));
      if (done && !sealSaid && focus.x > fs - 1) { sealSaid = true; seal.play('happy'); }
    }
    if (pup) {
      const px = fs * 0.55;
      pup.root.position.set(px + Math.sin(t * 0.5) * 0.6, -0.16 + Math.sin(t * 2.2) * 0.05, -3.1);
      pup.face = focus.clone().setY(pup.root.position.y);
      if (!pupSaid && Math.abs(focus.x - px) < 2.5) { pupSaid = true; pup.play('happy'); sfx.splashSmall(); }
    }
    for (const m of models) m.update(dt, t);
    if (leaper) {
      const busy = leaper.update(dt);
      nextLeap -= dt;
      if (!busy && nextLeap < 0 && focus.x < fs - 3) {
        nextLeap = 6 + rand() * 7;
        const dir = rand() < 0.5 ? 1 : -1;
        leaper.leap(new THREE.Vector3(focus.x + 2 + rand() * 5, 0, -(2.6 + rand() * 2.4)), dir);
        sfx.splashSmall(0.6);
      }
    }
  }
  return { place, update, dispose() { for (const m of models) m.dispose(); group.removeFromParent(); } };
}
