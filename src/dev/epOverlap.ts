// Dev only: does anything in a Learn episode pass through anything else? Every episode's every picture
// (its steps, the buddy's go and the three tries) is put on the table the way the episode does it, the
// scene is left to settle, and then:
//   - the buddy and the Glimmer must not be inside the table (they stand behind it, or on the number line's
//     plank on top of it);
//   - they must not be inside a thing on the table (the corner props, trays, plates, pies, bars, bowls,
//     balances, the plank, the chart, the measuring things) or a counter, more than a touch (a hand on the
//     work is fine, so is a Glimmer standing on the plank);
//   - the things on the table must not be inside each other (counters in their tray, plate or dish are
//     what those are for, and counters may touch);
//   - nothing sinks into the table top.
// In the dev server's page:
//   const m = await import('/src/dev/epOverlap.ts'); const r = await m.epOverlap()  -> { count, issues: [...] }
// (m.epOverlap(['make-ten']) for some; the buddy is the player's.)
import * as THREE from 'three';
import { EpisodeScene } from '../lib/three/episodeScene';
import { epLesson, type EpLesson } from '../lib/math/episodes';
import type { Board } from '../lib/math/learn';
import { episodeIds } from '../lib/math/episodeIds';
import type { FriendId } from '../lib/art/cast';
import { MEASURE_LESSONS } from '../lib/math/measure/episodes';
import { MeasureKit } from '../lib/three/measureKit';

const TY = 0.48;
/** how far one thing may go into another before it counts (metres): a touch, a hand resting on the work */
const TOUCH = 0.015;

export type Issue = { ep: string; pic: string; what: string; depth: number };
type Thing = { name: string; kind: 'prop' | 'piece' | 'token'; box: THREE.Box3; obj: THREE.Object3D };


/** a solid thing's box: its meshes that cast shadows (not its glow, its soft shadow or a ring) */
function solidBox(o: THREE.Object3D): THREE.Box3 | null {
  const box = new THREE.Box3(), b = new THREE.Box3();
  let any = false;
  o.updateMatrixWorld(true);
  o.traverse(x => {
    const m = x as THREE.Mesh;
    if (!m.isMesh || !m.castShadow || !m.visible || !m.geometry) return;
    let shown = true;
    for (let p: THREE.Object3D | null = m; p && p !== o.parent; p = p.parent) if (!p.visible) { shown = false; break; }
    if (!shown) return;
    m.geometry.computeBoundingBox();
    b.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld);
    if (b.isEmpty()) return;
    box.union(b); any = true;
  });
  return any ? box : null;
}
/** points of a character as it stands now (every few of its skin's points, posed) */
function pointsOf(root: THREE.Object3D, every = 3): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  root.updateMatrixWorld(true);
  root.traverse(x => {
    const m = x as THREE.SkinnedMesh;
    if (!m.isMesh || !m.visible || !m.geometry?.attributes.position || m.userData.kpEdge) return;
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i += every) {
      const v = new THREE.Vector3();
      if (m.isSkinnedMesh) m.getVertexPosition(i, v); else v.fromBufferAttribute(p, i);
      out.push(v.applyMatrix4(m.matrixWorld));
    }
  });
  return out;
}
/** how deep a point is inside a box (0: not inside) */
const depthIn = (p: THREE.Vector3, b: THREE.Box3) => Math.max(0, Math.min(p.x - b.min.x, b.max.x - p.x, p.y - b.min.y, b.max.y - p.y, p.z - b.min.z, b.max.z - p.z));
/** how deep two boxes go into each other (0: apart) */
const overlap = (a: THREE.Box3, b: THREE.Box3) => Math.max(0, Math.min(a.max.x - b.min.x, b.max.x - a.min.x, a.max.y - b.min.y, b.max.y - a.min.y, a.max.z - b.min.z, b.max.z - a.min.z));

type Priv = {
  tokens: Map<string, { g: THREE.Group; leaving: number }>; trays: Map<string, { g: THREE.Group; leaving: number }>; plates: Map<string, { g: THREE.Group; leaving: number }>;
  dishes: Map<string, { g: THREE.Group; leaving: number }>; balances: Map<string, { g: THREE.Group; leaving: number }>;
  plank: THREE.Group | null; chartMesh: THREE.Object3D | null; propL: THREE.Group | null; propR: THREE.Group | null; backZ: number;
};

/** Check one picture as it stands now. */
export function checkNow(s: EpisodeScene, ep: string, pic: string, extra: Thing[] = []): Issue[] {
  const P = s as unknown as Priv, out: Issue[] = [];
  const things: Thing[] = [...extra];
  const add = (name: string, kind: Thing['kind'], o: THREE.Object3D | null | undefined) => { if (!o || !o.parent) return; const box = solidBox(o); if (box) things.push({ name, kind, box, obj: o }); };
  add('left corner prop', 'prop', P.propL); add('right corner prop', 'prop', P.propR);
  for (const [k, map] of [['tray', P.trays], ['plate', P.plates], ['dish', P.dishes], ['balance', P.balances]] as const) for (const [id, p] of map) if (!p.leaving) add(`${k} ${id}`, 'piece', p.g);
  add('number line plank', 'piece', P.plank); add('chart', 'piece', P.chartMesh);
  for (const [id, tk] of P.tokens) if (!tk.leaving) add(`counter ${id}`, 'token', tk.g);
  // the friends: not in the table, not in anything on it
  const back = P.backZ;
  for (const [who, root] of [['the buddy', s.me.root], ['the Glimmer', s.pal.root]] as const) {
    const pts = pointsOf(root);
    let n = 0, deep = 0;
    for (const p of pts) if (Math.abs(p.x) < 3 && p.z > back + TOUCH && p.y < TY - TOUCH && p.y > TY - 0.12 + 0.005) { n++; deep = Math.max(deep, Math.min(p.z - back, TY - p.y)); }
    if (n > 8) out.push({ ep, pic, what: `${who} is inside the table (${n} points)`, depth: deep });
    for (const t of things) {
      let k = 0, d = 0;
      for (const p of pts) { const dd = depthIn(p, t.box); if (dd > TOUCH) { k++; d = Math.max(d, dd); } }
      if (k > 8) out.push({ ep, pic, what: `${who} is inside the ${t.name} (${k} points)`, depth: d });
    }
  }
  // the things: not in each other (counters may sit in their tray, plate or dish, and touch each other)
  for (let i = 0; i < things.length; i++) for (let j = i + 1; j < things.length; j++) {
    const a = things[i], b = things[j];
    if (a.kind === 'token' && b.kind === 'token') continue;
    if ((a.kind === 'token' && b.kind === 'piece') || (b.kind === 'token' && a.kind === 'piece')) continue;
    // (a balance hangs from its own pans' rims: those plates are its pans)
    const pid = (n: string) => n.slice(6).split('@')[0];
    if ((a.name.startsWith('balance ') && b.name.startsWith('plate ') && a.name.slice(8).split('~').includes(pid(b.name))) || (b.name.startsWith('balance ') && a.name.startsWith('plate ') && b.name.slice(8).split('~').includes(pid(a.name)))) continue;
    // (the sack of carrots sits in the scale's pan: that's where it goes)
    if ([a.name, b.name].sort().join() === 'sack,scale') continue;
    // (round things, plates and pies, by their round shape: their boxes' corners don't count)
    const round = (t: Thing) => t.name.startsWith('plate ') || (t.name.startsWith('dish ') && !t.name.includes('foil'));
    let d = overlap(a.box, b.box);
    if (d > TOUCH && round(a) && round(b)) {
      const ca = a.box.getCenter(new THREE.Vector3()), cb = b.box.getCenter(new THREE.Vector3());
      const ra = (a.box.max.x - a.box.min.x) / 2, rb = (b.box.max.x - b.box.min.x) / 2, k = ra / Math.max(1e-6, (a.box.max.z - a.box.min.z) / 2);
      d = Math.min(d, Math.max(0, ra + rb - Math.hypot(ca.x - cb.x, (ca.z - cb.z) * k)));
    }
    if (d > TOUCH) out.push({ ep, pic, what: `the ${a.name} and the ${b.name} pass through each other`, depth: d });
  }
  for (const t of things) if (t.box.min.y < TY - 0.02 && t.kind !== 'token') out.push({ ep, pic, what: `the ${t.name} sinks into the table`, depth: TY - t.box.min.y });
  return out;
}

const settle = (s: EpisodeScene, t0: number, secs = 2) => { let t = t0; for (let i = 0; i < secs * 30; i++) { t += 1 / 30; s.update(1 / 30, t); } return t; };

/** Every picture of these episodes (all of them by default). */
export async function epOverlap(only?: string[], buddy?: FriendId): Promise<{ count: number; episodes: number; pictures: number; issues: Issue[] }> {
  const ids = episodeIds().filter(id => !only || only.includes(id));
  const me = buddy ?? ((window as unknown as { __game?: { profile?: { buddy: FriendId } } }).__game?.profile?.buddy ?? 'dino');
  const scenes = new Map<string, EpisodeScene>();
  const issues: Issue[] = [];
  let t = 0, pictures = 0;
  for (const id of ids) {
    const l = epLesson(id) as EpLesson | null;
    if (!l) continue;
    const key = `${l.set}|${l.star ?? ''}|${!l.cover}`;
    let s = scenes.get(key);
    if (!s) { s = await EpisodeScene.create({ setId: l.set, buddy: me, star: l.star, frac: !l.cover }); scenes.set(key, s); }
    // the steps, fitted together (as the episode does), then the buddy's go and the three tries one by one
    const steps = l.steps.map(x => x.board);
    s.fitBoards(steps);
    for (const [k, b] of steps.entries()) { s.show(b, true); t = settle(s, t); pictures++; issues.push(...checkNow(s, id, `step ${k + 1}`)); }
    const pics: [string, Board | undefined][] = [['buddy\'s go', l.teach.q.pic], ...l.tries.map((q, k) => [`try ${k + 1}`, q.pic] as [string, Board | undefined])];
    for (const [name, b] of pics) { if (!b) continue; s.fitBoards([b]); s.show(b, true); t = settle(s, t); pictures++; issues.push(...checkNow(s, id, name)); }
    s.show({ ...steps[0], dots: [], frames: [], plates: [], dishes: [], line: null, chart: undefined, beam: undefined, tags: [] } as Board, true);
  }
  for (const s of scenes.values()) s.dispose();
  // the measuring episodes: their things on the table (math/measure/MeasureEpisode.svelte)
  const mids = MEASURE_LESSONS.map(l => l.id).filter(id => !only || only.includes(id));
  for (const id of mids) {
    const l = MEASURE_LESSONS.find(x => x.id === id)!;
    const s = await EpisodeScene.create({ setId: 'clockshop', buddy: me, star: l.star });
    const kit = new MeasureKit(s);
    await kit.load();
    s.show({ ...(l.steps[0] as unknown as { board?: Board }).board, dots: [], frames: [], plates: [], dishes: [], tags: [] } as Board, true);
    s.fit(kit.bounds()); kit.refit();
    const states: [string, unknown][] = [...l.steps.map((x, k) => [`step ${k + 1}`, x.at] as [string, unknown]), ['buddy\'s go', l.teach.q.at], ...l.tries.map((q, k) => [`try ${k + 1}`, q.at] as [string, unknown])];
    for (const [name, st] of states) {
      kit.set(st as Parameters<MeasureKit['set']>[0]);
      for (let i = 0; i < 60; i++) { t += 1 / 30; s.update(1 / 30, t); kit.update(1 / 30, t); }
      pictures++;
      const extra: Thing[] = [];
      const K = kit as unknown as Record<string, THREE.Object3D | null> & { items: { g: THREE.Group }[] };
      const named = new Map<THREE.Object3D, string>();
      for (const k of ['clock', 'ruler', 'scale', 'sack', 'jug', 'garden', 'pile', 'fence']) if (K[k]) named.set(K[k]!, k);
      K.items.forEach((it, i) => named.set(it.g, `ruler's thing ${i + 1}`));
      for (const c of kit.root.children) { const box = solidBox(c); if (box) extra.push({ name: named.get(c) ?? `measuring thing ${c.name || c.type}`, kind: 'piece', box, obj: c }); }
      issues.push(...checkNow(s, id, name, extra));
    }
    kit.dispose(); s.dispose();
  }
  return { count: issues.length, episodes: ids.length + mids.length, pictures, issues };
}

/** Put one picture of an episode on the stage to look at (pic: 'step 1'.., "buddy's go", 'try 1'..). Returns
 *  a function that takes it away again. */
export async function look(id: string, pic = 'step 1', buddy?: FriendId): Promise<() => void> {
  const { stage } = await import('../lib/three/stage');
  const l = epLesson(id)!;
  const me = buddy ?? ((window as unknown as { __game?: { profile?: { buddy: FriendId } } }).__game?.profile?.buddy ?? 'dino');
  const s = await EpisodeScene.create({ setId: l.set, buddy: me, star: l.star, frac: !l.cover });
  const before = stage.swap(s); s.enter();
  const steps = l.steps.map(x => x.board);
  const m = /^step (\d+)/.exec(pic), tries = [l.teach.q.pic, ...l.tries.map(q => q.pic)];
  if (m) { s.fitBoards(steps); s.show(steps[+m[1] - 1], true); }
  else { const b = tries[pic.startsWith('try') ? +pic.slice(4) : 0]; s.fitBoards([b]); s.show(b, true); }
  (window as unknown as { __ep: EpisodeScene }).__ep = s;
  return () => { stage.swap(before); s.dispose(); };
}
