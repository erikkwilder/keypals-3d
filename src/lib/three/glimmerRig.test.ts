import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { glbPoints } from '../../../scripts/glimmers/glbPoints';
import { GLIMMERS } from '../adventure/glimmers';
import { PLANS, buildRig, cloudOf, fitFreedom, guessLandmarks, makeBones, skinWeights, type Landmarks, type Plan, type Rig } from './glimmerRig';
import { ACT_LEN, ACTS, Animator, BASES } from './glimmerMotion';

// ---- a made-up creature of each body plan: blobs of points along its parts ----
function creature(plan: Plan): Float32Array {
  const pts: number[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const blob = (cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, n = 600) => {
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      pts.push(cx + rx * s * Math.cos(a), cy + ry * u, cz + rz * s * Math.sin(a));
    }
  };
  const limb = (a: number[], b: number[], r: number) => { for (let k = 0; k <= 6; k++) { const f = k / 6; blob(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, r, r, r, 80); } };
  if (plan === 'quad') {
    blob(0, 0.45, 0, 0.2, 0.17, 0.35); blob(0, 0.72, 0.38, 0.17, 0.17, 0.17);
    for (const [x, z] of [[-0.13, 0.25], [0.13, 0.25], [-0.13, -0.25], [0.13, -0.25]]) limb([x, 0.35, z], [x, 0.01, z], 0.05);
    limb([0, 0.5, -0.33], [0, 0.75, -0.65], 0.04);
  } else if (plan === 'biped' || plan === 'flyer' || plan === 'blob') {
    blob(0, 0.4, 0, 0.22, 0.25, 0.2); blob(0, 0.8, 0.05, 0.18, 0.17, 0.17);
    for (const s of [-1, 1]) limb([s * 0.1, 0.2, 0], [s * 0.1, 0.01, 0.03], 0.05);
    if (plan === 'biped' || plan === 'blob') for (const s of [-1, 1]) limb([s * 0.2, 0.5, 0], [s * 0.38, 0.38, 0.05], 0.04);
    if (plan === 'flyer') for (const s of [-1, 1]) limb([s * 0.18, 0.5, -0.05], [s * 0.6, 0.65, -0.15], 0.05);
  } else if (plan === 'swimmer') {
    blob(0, 0.45, 0.1, 0.25, 0.25, 0.55); limb([0, 0.45, -0.4], [0, 0.6, -0.9], 0.07);
    for (const s of [-1, 1]) limb([s * 0.22, 0.35, 0.3], [s * 0.5, 0.25, 0.15], 0.04);
  } else if (plan === 'jelly') {
    blob(0, 0.75, 0, 0.3, 0.22, 0.3);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; limb([Math.sin(a) * 0.15, 0.52, Math.cos(a) * 0.15], [Math.sin(a) * 0.3, 0.02, Math.cos(a) * 0.3], 0.04); }
  } else {
    for (let k = 0; k <= 10; k++) blob(0, 0.15 + Math.sin(k / 10 * Math.PI) * 0.1, -0.6 + k * 0.12, 0.1, 0.1, 0.1, 120);
    blob(0, 0.45, 0.65, 0.15, 0.15, 0.15);
  }
  return Float32Array.from(pts);
}
const HEAD: Record<Plan, [number, number, number]> = { quad: [0, 0.72, 0.38], biped: [0, 0.8, 0.05], flyer: [0, 0.8, 0.05], swimmer: [0, 0.5, 0.5], jelly: [0, 0.8, 0.05], serpent: [0, 0.45, 0.65], blob: [0, 0.8, 0.05] };

function checkWeights(rig: Rig, pos: Float32Array) {
  const { index, weight } = skinWeights(rig, pos);
  const n = pos.length / 3;
  let worst = 0;
  for (let i = 0; i < n; i++) {
    const s = weight[i * 4] + weight[i * 4 + 1] + weight[i * 4 + 2] + weight[i * 4 + 3];
    worst = Math.max(worst, Math.abs(s - 1));
    for (let k = 0; k < 4; k++) { expect(Number.isFinite(weight[i * 4 + k])).toBe(true); expect(index[i * 4 + k]).toBeLessThan(rig.bones.length); }
  }
  expect(worst).toBeLessThan(1e-5);
  return { index, weight };
}

describe('Glimmer skeletons', () => {
  for (const plan of PLANS) {
    it(`builds a small skeleton for a ${plan}`, () => {
      const pos = creature(plan), c = cloudOf(pos);
      const rig = buildRig(guessLandmarks(c, plan, { head: HEAD[plan] }), c);
      expect(rig.bones.length).toBeGreaterThanOrEqual(6);
      expect(rig.bones.length).toBeLessThanOrEqual(24);
      rig.bones.forEach((b, i) => { expect(b.parent).toBeLessThan(i); expect(b.r).toBeGreaterThan(0); expect(Number.isFinite(b.at.x + b.at.y + b.at.z + b.end.x + b.end.y + b.end.z)).toBe(true); });
      const roles = new Set(rig.bones.map(b => b.role));
      if (plan === 'quad') expect(rig.bones.filter(b => b.role === 'leg').length).toBe(8);
      if (plan === 'biped') expect(roles.has('arm') && roles.has('leg')).toBe(true);
      if (plan === 'flyer') expect(roles.has('wing')).toBe(true);
      if (plan === 'swimmer') expect(roles.has('fin') && roles.has('tail')).toBe(true);
      if (plan === 'jelly') expect(rig.bones.filter(b => b.role === 'tentacle').length).toBeGreaterThanOrEqual(8);
      if (plan === 'serpent') expect(rig.bones.filter(b => b.role === 'tail').length).toBe(3);
      checkWeights(rig, pos);
    });
  }
});

// ---- the 30 Glimmers' own models ----
type Meta = { rig?: Landmarks };
const meta: Record<string, Meta> = JSON.parse(readFileSync('public/models/glimmers/meta.json', 'utf8'));
const NEEDS: Record<Plan, (lm: Landmarks) => boolean> = {
  quad: lm => lm.feet?.length === 4, biped: lm => lm.feet?.length === 2 && lm.hands?.length === 2, flyer: lm => lm.wings?.length === 2,
  swimmer: lm => !!lm.tail && lm.fins?.length === 2, jelly: lm => (lm.tentacles?.length ?? 0) >= 3, serpent: lm => (lm.tail?.length ?? 0) >= 2, blob: () => true,
};

describe('the 30 Glimmers', () => {
  it('every one has a body plan and its landmarks', () => {
    for (const g of GLIMMERS) {
      const lm = meta[g.id]?.rig;
      expect(lm, g.id).toBeTruthy();
      expect(PLANS, g.id).toContain(lm!.plan);
      expect(lm!.head.length, g.id).toBe(3);
      expect(lm!.chest && lm!.hips, g.id).toBeTruthy();
      expect(NEEDS[lm!.plan](lm!), `${g.id} has what a ${lm!.plan} needs`).toBe(true);
    }
  });

  // Every move, sampled through its length, skinned on the CPU the way the GPU does it: no NaN, nothing
  // flies off (each point stays within a share of the Glimmer's size of where it rests), and the skin
  // doesn't melt or tear. Image-to-3D models are one skin, so where two parts touch (an armpit, legs
  // tucked under) a few slivers of skin deep in the crease stretch a lot unseen; what the eye catches is
  // many edges stretching. Checked against contact sheets by eye (2026-10-30): fewer than 4 in 100 edges
  // past twice their length, fewer than 1.8 in 100 past three times, none past 30 times.
  it('moves without NaN or huge stretches', () => {
    const report: string[] = [];
    for (const g of GLIMMERS) {
      const { pos, index } = glbPoints(`public/models/glimmers/${g.id}.glb`);
      const c = cloudOf(pos), rig = buildRig(meta[g.id].rig!, c), H = Math.max(c.height, c.max.x - c.min.x, c.max.z - c.min.z);
      const { index: si, weight: sw } = checkWeights(rig, pos);
      const seen = fitFreedom(rig, pos, { index: si, weight: sw });
      if (process.env.RIG_FREE) console.log(g.id, JSON.stringify(seen));
      const { bones, inverses } = makeBones(rig);
      const n = pos.length / 3, step = 2;
      const edges: number[] = [];
      for (let t = 0; t < index.length; t += 9) edges.push(index[t], index[t + 1], index[t + 1], index[t + 2]);
      const rest = edges.map((_, i) => (i % 2 ? 0 : dist(pos, edges[i], pos, edges[i + 1])));
      const out = new Float32Array(pos.length), mats = bones.map(() => new THREE.Matrix4()), v = new THREE.Vector3(), acc = new THREE.Vector3(), tmp = new THREE.Vector3();
      let maxMove = 0, maxStretch = 0, where = '', swhere = '', worstShare = 0, shareWhere = '', worst3 = 0, where3 = '';
      const moves = [...BASES.map(b => ({ b, a: null as null | (typeof ACTS)[number] })), ...ACTS.map(a => ({ b: 'idle' as const, a }))];
      for (const mv of moves) {
        const an = new Animator(rig, bones, 3, false);
        an.setBase(mv.b);
        let t = 0;
        for (let i = 0; i < 40; i++) an.update(1 / 60, (t += 1 / 60));
        if (mv.a) an.play(mv.a);
        const len = mv.a ? ACT_LEN[mv.a] : 2.4;
        for (let s = 0; s < 6; s++) {
          for (let i = 0; i < Math.round((len / 6) * 60); i++) an.update(1 / 60, (t += 1 / 60));
          bones[0].updateMatrixWorld(true);
          bones.forEach((b, i) => mats[i].multiplyMatrices(b.matrixWorld, inverses[i]));
          for (let i = 0; i < n; i += 1) {
            v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); acc.set(0, 0, 0);
            for (let k = 0; k < 4; k++) { const w = sw[i * 4 + k]; if (w) acc.addScaledVector(tmp.copy(v).applyMatrix4(mats[si[i * 4 + k]]), w); }
            out[i * 3] = acc.x; out[i * 3 + 1] = acc.y; out[i * 3 + 2] = acc.z;
            if (i % step === 0) {
              const m = acc.distanceTo(v) / H;
              if (!(m < Infinity)) throw new Error(`${g.id} ${mv.a ?? mv.b}: NaN`);
              if (m > maxMove) { maxMove = m; where = `${mv.a ?? mv.b}`; }
            }
          }
          let over = 0, over3 = 0, all = 0;
          for (let e = 0; e < edges.length; e += 2) {
            const r0 = rest[e]; if (r0 < c.height * 0.004) continue;
            const st = dist(out, edges[e], out, edges[e + 1]) / r0;
            all++; if (st > 2) over++; if (st > 3) over3++;
            if (st > maxStretch) maxStretch = st;
            if (st >= maxStretch && process.env.RIG_REPORT === '2') { swhere = `${mv.a ?? mv.b} bones ${[0, 1, 2, 3].map(k => rig.bones[si[edges[e] * 4 + k]].name + ':' + sw[edges[e] * 4 + k].toFixed(2)).join(',')} / ${[0, 1, 2, 3].map(k => rig.bones[si[edges[e + 1] * 4 + k]].name + ':' + sw[edges[e + 1] * 4 + k].toFixed(2)).join(',')}`; }
          }
          if (over / all > worstShare) { worstShare = over / all; shareWhere = mv.a ?? mv.b; }
          if (over3 / all > worst3) { worst3 = over3 / all; where3 = mv.a ?? mv.b; }
        }
      }
      const free = [...new Set(rig.bones.filter(b => b.free < 1).map(b => `${b.role}${b.chain}:${b.free.toFixed(2)}`))].join(' ');
      report.push(`${g.id} ${rig.plan} ${rig.bones.length} bones [${free}]: moves ${maxMove.toFixed(2)} of its size (${where}); edges past 2x ${(worstShare * 100).toFixed(2)}% (${shareWhere}), past 3x ${(worst3 * 100).toFixed(2)}% (${where3}), worst x${maxStretch.toFixed(1)} ${swhere}`);
      if (process.env.RIG_REPORT) continue;
      expect(rig.bones.length, g.id).toBeLessThanOrEqual(24);
      expect(maxMove, `${g.id} moves too far (${where})`).toBeLessThan(0.75);
      expect(worstShare, `${g.id} stretches (${shareWhere})`).toBeLessThan(0.04);
      expect(worst3, `${g.id} stretches a lot (${where3})`).toBeLessThan(0.018);
      expect(maxStretch, `${g.id} tears`).toBeLessThan(30);
    }
    if (process.env.RIG_REPORT) console.log(report.join('\n'));
  }, 120_000);
});

function dist(a: Float32Array, i: number, b: Float32Array, j: number) {
  const dx = a[i * 3] - b[j * 3], dy = a[i * 3 + 1] - b[j * 3 + 1], dz = a[i * 3 + 2] - b[j * 3 + 2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
