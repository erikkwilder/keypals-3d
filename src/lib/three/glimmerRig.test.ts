import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { glbPoints } from '../../../scripts/glimmers/glbPoints';
import { ALL_GLIMMERS } from '../adventure/glimmers';
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

// ---- every Glimmer's own model (all that have one: the ones not pending) ----
const GLIMMERS = ALL_GLIMMERS.filter(g => !g.pending);
type Meta = { rig?: Landmarks };
const meta: Record<string, Meta> = JSON.parse(readFileSync('public/models/glimmers/meta.json', 'utf8'));
const NEEDS: Record<Plan, (lm: Landmarks) => boolean> = {
  quad: lm => lm.feet?.length === 4, biped: lm => lm.feet?.length === 2 && lm.hands?.length === 2, flyer: lm => lm.wings?.length === 2,
  swimmer: lm => !!lm.tail && lm.fins?.length === 2, jelly: lm => (lm.tentacles?.length ?? 0) >= 3, serpent: lm => (lm.tail?.length ?? 0) >= 2, blob: () => true,
};

describe('every Glimmer with a model', () => {
  it('has its model and a meta.json entry', () => {
    for (const g of GLIMMERS) {
      expect(existsSync(`public/models/glimmers/${g.id}.glb`), g.id).toBe(true);
      expect(meta[g.id], g.id).toBeTruthy();
    }
  });

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

  // The eyes keep their shape (Erik: the Frost Owl's right eye warped as it moved; most Glimmers' eyes
  // stretched or squashed in some move, up to half their size). Each eye's points (round its meta.json
  // "eyes" landmark) are measured from the eye's middle in every move, against at rest: turning and
  // sliding don't count, and a whole head squashing as it chomps is a few in 100.
  it('keeps every eye round as it moves', () => {
    const bad: string[] = [];
    for (const g of GLIMMERS) {
      const lm = meta[g.id].rig!;
      expect(lm.eyes?.length, `${g.id} has its eyes marked`).toBeGreaterThan(0);
      const { pos, index } = glbPoints(`public/models/glimmers/${g.id}.glb`);
      const c = cloudOf(pos), rig = buildRig(lm, c), H = c.height, wts = skinWeights(rig, pos, index);
      fitFreedom(rig, pos, wts);
      const { bones, inverses } = makeBones(rig), n = pos.length / 3;
      const eyes = lm.eyes!.map(e => {
        const at = new THREE.Vector3(...e), ids: number[] = [];
        for (let i = 0; i < n; i++) if (Math.hypot(pos[i * 3] - at.x, pos[i * 3 + 1] - at.y, pos[i * 3 + 2] - at.z) < H * 0.05) ids.push(i);
        return ids;
      }).filter(ids => ids.length >= 6);
      const mats = bones.map(() => new THREE.Matrix4()), v = new THREE.Vector3(), tmp = new THREE.Vector3();
      const skinned = (i: number, out: THREE.Vector3) => {
        v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); out.set(0, 0, 0);
        for (let k = 0; k < 4; k++) { const w = wts.weight[i * 4 + k]; if (w) out.addScaledVector(tmp.copy(v).applyMatrix4(mats[wts.index[i * 4 + k]]), w); }
        return out;
      };
      let worst = 0, where = '';
      for (const mv of [...BASES.map(b => ({ b, a: null as null | (typeof ACTS)[number] })), ...ACTS.map(a => ({ b: 'idle' as const, a }))]) {
        const an = new Animator(rig, bones, 3, false);
        an.setBase(mv.b);
        let t = 0;
        for (let i = 0; i < 30; i++) an.update(1 / 30, (t += 1 / 30));
        if (mv.a) an.play(mv.a);
        const len = mv.a ? ACT_LEN[mv.a] : 2.4;
        for (let s = 0; s < 5; s++) {
          for (let i = 0; i < Math.round((len / 5) * 30); i++) an.update(1 / 30, (t += 1 / 30));
          bones[0].updateMatrixWorld(true);
          bones.forEach((b, i) => mats[i].multiplyMatrices(b.matrixWorld, inverses[i]));
          for (const ids of eyes) {
            const rest = ids.map(i => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])), now = ids.map(i => skinned(i, new THREE.Vector3()));
            const c0 = rest.reduce((a, q) => a.add(q), new THREE.Vector3()).divideScalar(rest.length), c1 = now.reduce((a, q) => a.add(q), new THREE.Vector3()).divideScalar(now.length);
            for (let k = 0; k < ids.length; k++) {
              const d = Math.abs(now[k].distanceTo(c1) - rest[k].distanceTo(c0)) / (H * 0.05);
              if (d > worst) { worst = d; where = mv.a ?? mv.b; }
            }
          }
        }
      }
      if (worst > 0.08) bad.push(`${g.id}: an eye changes shape by ${(worst * 100).toFixed(0)}% (${where})`);
    }
    expect(bad).toEqual([]);
  }, 120_000);
});

// Erik (2026-11-25, in "How Many Cookies?"): Sprout Bunny's right ear "stretches instead of moving". The
// head's wide reach had a share of the far end of each ear, which stayed with the head as the ear turned
// (glimmerRig.ts, EAR_OWN). Every move, skinned as the game does it: each ear's edges (the part of the mesh
// nearer its bones than any other bone, by plain distance) keep their length. Before the fix, in the cheer,
// 11% of the right ear's edges and 7% of the left's went past 1.5 times their length, some to 6 times.
describe("Sprout Bunny's ears", () => {
  it('move as one piece instead of stretching', () => {
    const worst = earShares('sproutbun');
    expect(worst.map(w => w.bones)).toEqual([2, 2]);
    expect(worst[0].share, `the right ear stretches (${worst[0].at})`).toBeLessThan(EAR_STRETCH);
    expect(worst[1].share, `the left ear stretches (${worst[1].at})`).toBeLessThan(EAR_STRETCH);
  }, 60_000);
});

// The other Glimmers' ears (2026-11-25): each fix is marked on the Glimmer in meta.json, and was kept only where
// its ears got better and no other part of it got worse, over every move. Moonbeambat's right ear and its wing are
// one piece of skin, so tying the ear to the head moved the tear into the wing: it has its own fix, earsOnWings.
describe("the other Glimmers' ears", () => {
  const FIXED: Record<string, string[]> = {
    sproutbun: ['earsFree'], hydrahatchling: ['earsOnBody'], sparkmoth: ['earsFused'], moonbeambat: ['earsOnWings'],
    dicebun: ['earsFused', 'earsOnHead'], lanternfox: ['earsFused', 'earsOnHead'], potgolem: ['earsFused', 'earsOnHead'],
    puddlepup: ['earsFused', 'earsOnHead'], stormlamb: ['earsFused', 'earsOnHead'], sunsnail: ['earsFused', 'earsOnHead'],
  };
  it('the Glimmers whose ears were fixed say so in meta.json, and only they', () => {
    const got = Object.fromEntries(Object.entries(meta).flatMap(([id, m]) => {
      const f = Object.entries((m.rig ?? {}) as Record<string, unknown>).filter(([k, v]) => /^ears[A-Z]/.test(k) && (v === true || (Array.isArray(v) && v.length > 0))).map(([k]) => k).sort();
      return f.length ? [[id, f]] : [];
    }));
    expect(got).toEqual(Object.fromEntries(Object.entries(FIXED).map(([k, v]) => [k, [...v].sort()])));
  });
  const rigOf = (id: string, over: Partial<Landmarks> = {}) => {
    const { pos, index } = glbPoints(`public/models/glimmers/${id}.glb`), rig = buildRig({ ...meta[id].rig!, ...over } as Landmarks, cloudOf(pos));
    fitFreedom(rig, pos, skinWeights(rig, pos, index));
    return rig;
  };
  it("Hydrahatchling's 'ears' grow from its chest: they hang from its spine and keep still", () => {
    const rig = rigOf('hydrahatchling'), ears = rig.bones.filter(b => b.role === 'ear');
    expect(ears.length).toBeGreaterThan(0);
    for (const b of ears) { expect(['spine', 'ear']).toContain(rig.bones[b.parent].role); expect(b.free).toBe(0); }
  });
  it('a fused ear moves only as far as its skin can follow (Dicebun)', () => {
    const least = (r: Rig) => Math.min(...r.bones.filter(b => b.role === 'ear').map(b => b.free));
    expect(least(rigOf('dicebun', { earsFused: false, earsOnHead: false }))).toBe(1);
    expect(least(rigOf('dicebun'))).toBeLessThan(0.5);
  });
  it("Hydrahatchling's and Dicebun's ears stretch far less in every move", () => {
    // before: Hydrahatchling 20.4% and 17.1% of an ear's edges past 1.5 times, Dicebun 12.1% and 3.3%
    const h = earShares('hydrahatchling'), d = earShares('dicebun');
    expect(h[0].share, h[0].at).toBeLessThan(0.11); expect(h[1].share, h[1].at).toBeLessThan(0.09);
    expect(d[0].share, d[0].at).toBeLessThan(0.01); expect(d[1].share, d[1].at).toBeLessThan(0.015);
  }, 120_000);
});
// Moonbeambat (2026-11-26): its right ear droops down the side of its head and runs along the top of its wing, one
// piece of skin with both. The ear's bone stands in the air above it, so the ear rode the wing and hung off the head
// as a sheet when the head turned (the attack). earsOnWings shares that skin out along the skin between the head and
// the wing (glimmerRig.ts, EAR_SEAM). Every move, skinned as the game does it: before, 9.0% of the real ear's edges
// went past 1.5 times their length, and 10.4% of the right wing's; after, about 4% and 8%. No other part's share
// rises by more than 0.09 points, and the right wing beats as far as it did.
describe("Moonbeambat's right ear", () => {
  it('stays on its head and its wing as both move, and the wing beats as far as before', () => {
    const before = partShares('moonbeambat', { earsOnWings: undefined }), after = partShares('moonbeambat');
    expect(before.ear, 'the real ear before').toBeGreaterThan(0.08);
    expect(after.ear, 'the real ear').toBeLessThan(0.05);
    expect(after.parts.wing1, 'the right wing').toBeLessThan(before.parts.wing1 - 0.015);
    for (const k of Object.keys(before.parts)) expect(after.parts[k], k).toBeLessThanOrEqual(before.parts[k] + 0.0009);
    expect(after.free).toEqual(before.free);
  }, 120_000);
});

/** For a Glimmer with an ear that runs into its wing: the most of each part's edges (each point's part by its nearest
 *  bone) that stretch past 1.5 times their length in any frame of any move, skinned as the game does it; the same for
 *  the real ear (the skin nearer that ear's line than any other bone); and how freely each bone moves. */
function partShares(id: string, over: Partial<Landmarks> = {}) {
  const { pos, index } = glbPoints(`public/models/glimmers/${id}.glb`);
  const c = cloudOf(pos), rig = buildRig({ ...meta[id].rig!, ...over } as Landmarks, c), n = pos.length / 3;
  const { index: si, weight: sw } = skinWeights(rig, pos, index);
  fitFreedom(rig, pos, { index: si, weight: sw });
  const p = new THREE.Vector3(), ab = new THREE.Vector3(), q = new THREE.Vector3();
  const seg = (a: THREE.Vector3, b: THREE.Vector3) => { ab.subVectors(b, a); const l2 = ab.lengthSq(), t = l2 > 0 ? Math.min(1, Math.max(0, q.subVectors(p, a).dot(ab) / l2)) : 0; return p.distanceTo(q.copy(a).addScaledVector(ab, t)); };
  const [la, lb] = meta[id].rig!.earsOnWings![0].map(v => new THREE.Vector3(...v)), side = Math.sign(la.x - rig.bones.find(b => b.role === 'head')!.at.x);
  const key = (j: number) => { const b = rig.bones[j]; return b.role === 'head' ? 'head' : ['root', 'spine', 'neck'].includes(b.role) ? 'body' : `${b.role}${b.chain}`; };
  const part: string[] = [], onEar: boolean[] = [];
  for (let i = 0; i < n; i++) {
    p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    let bd = Infinity, bo = Infinity;
    rig.bones.forEach((b, j) => { const d = seg(b.at, b.end); if (d < bd) { bd = d; part[i] = key(j); } if (!(b.role === 'ear' && b.side === side) && d < bo) bo = d; });
    onEar[i] = seg(la, lb) < bo;
  }
  const edges = new Map<string, number[]>(), add = (k: string, a: number, b: number) => (edges.get(k) ?? edges.set(k, []).get(k)!).push(a, b);
  for (let t = 0; t < index.length; t += 3) for (const [a, b] of [[index[t], index[t + 1]], [index[t + 1], index[t + 2]], [index[t + 2], index[t]]]) {
    if (dist(pos, a, pos, b) <= c.height * 0.002) continue;
    add(part[a], a, b); if (part[b] !== part[a]) add(part[b], a, b);
    if (onEar[a] || onEar[b]) add('ear', a, b);
  }
  const { bones, inverses } = makeBones(rig), mats = bones.map(() => new THREE.Matrix4()), out = new Float32Array(pos.length), v = new THREE.Vector3(), acc = new THREE.Vector3(), tmp = new THREE.Vector3();
  const worst: Record<string, number> = Object.fromEntries([...edges.keys()].map(k => [k, 0]));
  for (const mv of [...BASES.map(b => ({ b, a: null as null | (typeof ACTS)[number] })), ...ACTS.map(a => ({ b: 'idle' as const, a }))]) {
    const an = new Animator(rig, bones, 3, false);
    an.setBase(mv.b);
    let t = 0;
    for (let i = 0; i < 40; i++) an.update(1 / 60, (t += 1 / 60));
    if (mv.a) an.play(mv.a);
    const frames = Math.round((mv.a ? ACT_LEN[mv.a] : 2.4) * 60);
    for (let f = 0; f < frames; f++) {
      an.update(1 / 60, (t += 1 / 60));
      if (f % 4) continue;
      bones[0].updateMatrixWorld(true);
      bones.forEach((b, i) => mats[i].multiplyMatrices(b.matrixWorld, inverses[i]));
      for (let i = 0; i < n; i++) {
        v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); acc.set(0, 0, 0);
        for (let k = 0; k < 4; k++) { const w = sw[i * 4 + k]; if (w) acc.addScaledVector(tmp.copy(v).applyMatrix4(mats[si[i * 4 + k]]), w); }
        out[i * 3] = acc.x; out[i * 3 + 1] = acc.y; out[i * 3 + 2] = acc.z;
      }
      for (const [k, E] of edges) {
        let over15 = 0;
        for (let e = 0; e < E.length; e += 2) if (dist(out, E[e], out, E[e + 1]) > 1.5 * dist(pos, E[e], pos, E[e + 1])) over15++;
        worst[k] = Math.max(worst[k], over15 / (E.length / 2));
      }
    }
  }
  const { ear, ...parts } = worst;
  return { ear, parts, free: rig.bones.map(b => +b.free.toFixed(3)) };
}

/** the most of an ear's edges that may stretch past 1.5 times their length in any frame of any move */
const EAR_STRETCH = 0.06;

/** For each ear of a Glimmer (by chain, -x first): the most of its edges that stretch past 1.5 times their length
 *  in any frame of any move, skinned as the game does it, and where; with how many bones it has. */
function earShares(id: string): { share: number; at: string; bones: number }[] {
  const { pos, index } = glbPoints(`public/models/glimmers/${id}.glb`);
  const c = cloudOf(pos), rig = buildRig(meta[id].rig!, c), n = pos.length / 3;
  const { index: si, weight: sw } = skinWeights(rig, pos, index);
  fitFreedom(rig, pos, { index: si, weight: sw });
  const ab = rig.bones.map(b => b.end.clone().sub(b.at)), p = new THREE.Vector3(), q = new THREE.Vector3();
  const plain = (j: number) => { const b = rig.bones[j], l2 = ab[j].lengthSq(), t = l2 > 0 ? Math.min(1, Math.max(0, q.subVectors(p, b.at).dot(ab[j]) / l2)) : 0; return p.distanceTo(q.copy(b.at).addScaledVector(ab[j], t)); };
  const nearest = new Int16Array(n);
  for (let i = 0; i < n; i++) { p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); let bd = Infinity; rig.bones.forEach((_, j) => { const d = plain(j); if (d < bd) { bd = d; nearest[i] = j; } }); }
  // each ear's bones, by chain (the -x ear is chain 0)
  const ears = [...new Set(rig.bones.filter(b => b.role === 'ear').map(b => b.chain))].sort().map(ch => rig.bones.flatMap((b, j) => (b.role === 'ear' && b.chain === ch ? [j] : [])));
  const edges = ears.map(chain => {
    const out: number[] = [];
    for (let t = 0; t < index.length; t += 3) for (const [a, b] of [[index[t], index[t + 1]], [index[t + 1], index[t + 2]], [index[t + 2], index[t]]])
      if ((chain.includes(nearest[a]) || chain.includes(nearest[b])) && dist(pos, a, pos, b) > c.height * 0.002) out.push(a, b);
    return out;
  });
  const used = [...new Set(edges.flat())];
  const { bones, inverses } = makeBones(rig), mats = bones.map(() => new THREE.Matrix4()), out = new Float32Array(pos.length), v = new THREE.Vector3(), acc = new THREE.Vector3(), tmp = new THREE.Vector3();
  const worst = ears.map(() => ({ share: 0, at: '' }));
  const moves = [...BASES.map(b => ({ b, a: null as null | (typeof ACTS)[number] })), ...ACTS.map(a => ({ b: 'idle' as const, a }))];
  for (const mv of moves) {
    const an = new Animator(rig, bones, 3, false);
    an.setBase(mv.b);
    let t = 0;
    for (let i = 0; i < 40; i++) an.update(1 / 60, (t += 1 / 60));
    if (mv.a) an.play(mv.a);
    const frames = Math.round((mv.a ? ACT_LEN[mv.a] : 2.4) * 60);
    for (let f = 0; f < frames; f++) {
      an.update(1 / 60, (t += 1 / 60));
      if (f % 4) continue;
      bones[0].updateMatrixWorld(true);
      bones.forEach((b, i) => mats[i].multiplyMatrices(b.matrixWorld, inverses[i]));
      for (const i of used) {
        v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); acc.set(0, 0, 0);
        for (let k = 0; k < 4; k++) { const w = sw[i * 4 + k]; if (w) acc.addScaledVector(tmp.copy(v).applyMatrix4(mats[si[i * 4 + k]]), w); }
        out[i * 3] = acc.x; out[i * 3 + 1] = acc.y; out[i * 3 + 2] = acc.z;
      }
      edges.forEach((E, k) => {
        let over = 0;
        for (let e = 0; e < E.length; e += 2) if (dist(out, E[e], out, E[e + 1]) > 1.5 * dist(pos, E[e], pos, E[e + 1])) over++;
        const share = over / (E.length / 2);
        if (share > worst[k].share) worst[k] = { share, at: `${mv.a ?? mv.b}, frame ${f}` };
      });
    }
  }
  return worst.map((w, k) => ({ ...w, bones: ears[k].length }));
}

function dist(a: Float32Array, i: number, b: Float32Array, j: number) {
  const dx = a[i * 3] - b[j * 3], dy = a[i * 3 + 1] - b[j * 3 + 1], dz = a[i * 3 + 2] - b[j * 3 + 2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
