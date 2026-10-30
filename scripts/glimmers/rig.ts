// The landmark tool: set a Glimmer's body plan and landmarks, see its skeleton, its weights and its
// moves, and save them to public/models/glimmers/meta.json. Development only: run
// `node scripts/glimmers/rig-tool.mjs` (a dev server that can save) and open the address it prints.
//   ?id=puddlepup   which Glimmer
// How to rig a new one: the top of src/lib/three/glimmerRig.ts.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLANS, PLAN_NAME, cloudOf, dropSkin, positionsOf, guessLandmarks, landmarksJson, makeBones, skinFor, type Cloud, type Landmarks, type OldMeta, type Plan, type V3 } from '../../src/lib/three/glimmerRig';
import { ACTS, Animator, BASES, type Act, type Base } from '../../src/lib/three/glimmerMotion';

const $ = (id: string) => document.getElementById(id)!;
const q = new URLSearchParams(location.search);
const base = import.meta.env.BASE_URL;

type Meta = OldMeta & { height: number; floats?: boolean; rig?: Landmarks };
let meta: Record<string, Meta> = {};
let id = q.get('id') ?? '';
let lm: Landmarks = { plan: 'quad', head: [0, 0.7, 0.3] };
let cloud: Cloud | null = null;
let model: THREE.Mesh | null = null;
let skinned: THREE.SkinnedMesh | null = null;
let anim: Animator | null = null;
let helper: THREE.SkeletonHelper | null = null;
let pick: string | null = null;
let showW = false, showB = true;
const dots = new THREE.Group();

// ---- the view ----
const view = $('view');
const r = new THREE.WebGLRenderer({ antialias: true });
r.setPixelRatio(Math.min(2, devicePixelRatio)); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NeutralToneMapping;
r.setClearColor(0xe8f2fa);
view.append(r.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xd5ecff, 0x8faa70, 1.3));
const sun = new THREE.DirectionalLight(0xfff2d2, 2.2); sun.position.set(2, 4, 3); scene.add(sun);
const grid = new THREE.GridHelper(3, 30, 0x99aabb, 0xccd8e2); scene.add(grid, dots);
const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
cam.position.set(1.6, 1.0, 2.2);
const ctl = new OrbitControls(cam, r.domElement); ctl.target.set(0, 0.45, 0); ctl.update();
const size = () => { const w = view.clientWidth, h = view.clientHeight; r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); };
addEventListener('resize', size); size();

// ---- the points, as a list of slots ----
type Slot = { key: string; label: string; color: number; get(): V3 | undefined; set(p: V3): void };
const COL = { trunk: 0xff4f6d, tail: 0xffa31a, foot: 0x2e9cff, hand: 0x22c4a6, wing: 0xa45cff, fin: 0x3a6dff, ear: 0xff66cc, tent: 0x1fb85a };
function slots(): Slot[] {
  const out: Slot[] = [];
  const one = (key: 'head' | 'chest' | 'hips', label: string) => out.push({ key, label, color: COL.trunk, get: () => lm[key], set: p => { lm[key] = p; } });
  one('head', 'Head (middle)'); one('chest', 'Chest (front / upper body)'); one('hips', 'Hips (back / lower body)');
  lm.tail?.forEach((_, i, a) => out.push({ key: `tail.${i}`, label: i === 0 ? 'Tail root' : i === a.length - 1 ? 'Tail tip' : `Tail ${i}`, color: COL.tail, get: () => lm.tail?.[i], set: p => { lm.tail![i] = p; } }));
  const FEET4 = ['Front foot -x', 'Front foot +x', 'Back foot -x', 'Back foot +x'], FEET2 = ['Foot -x', 'Foot +x'];
  lm.feet?.forEach((_, i, a) => out.push({ key: `feet.${i}`, label: (a.length === 4 ? FEET4 : FEET2)[i] ?? `Foot ${i}`, color: COL.foot, get: () => lm.feet?.[i], set: p => { lm.feet![i] = p; } }));
  lm.hands?.forEach((_, i) => out.push({ key: `hands.${i}`, label: `Hand ${i ? '+x' : '-x'}`, color: COL.hand, get: () => lm.hands?.[i], set: p => { lm.hands![i] = p; } }));
  for (const [k, name, color] of [['wings', 'Wing', COL.wing], ['fins', 'Fin', COL.fin], ['ears', 'Ear', COL.ear]] as const) {
    lm[k]?.forEach((_, i, a) => [0, 1].forEach(j => out.push({ key: `${k}.${i}.${j}`, label: `${name} ${a.length === 2 ? (i ? '+x' : '-x') : i + 1} ${j ? 'tip' : k === 'ears' ? 'base' : 'root'}`, color, get: () => lm[k]?.[i]?.[j], set: p => { lm[k]![i][j] = p; } })));
  }
  lm.tentacles?.forEach((t, i) => t.forEach((_, j) => out.push({ key: `tent.${i}.${j}`, label: `Tentacle ${i + 1} ${j === 0 ? 'root' : j === t.length - 1 ? 'tip' : 'middle'}`, color: COL.tent, get: () => lm.tentacles?.[i]?.[j], set: p => { lm.tentacles![i][j] = p; } })));
  return out;
}

function listPoints() {
  const box = $('pts'); box.innerHTML = '';
  for (const s of slots()) {
    const b = document.createElement('button');
    if (s.key === pick) b.className = 'on';
    const p = s.get();
    b.innerHTML = `<i style="background:#${s.color.toString(16).padStart(6, '0')}"></i>${s.label}<small>${p ? p.map(x => x.toFixed(2)).join(' ') : '-'}</small>`;
    b.onclick = () => { pick = pick === s.key ? null : s.key; listPoints(); drawDots(); msg(pick ? `Click the model to place: ${s.label}` : ''); };
    box.append(b);
  }
}
function drawDots() {
  dots.clear();
  const H = cloud?.height ?? 1;
  for (const s of slots()) {
    const p = s.get(); if (!p) continue;
    const m = new THREE.Mesh(new THREE.SphereGeometry(H * (s.key === pick ? 0.028 : 0.017), 12, 8), new THREE.MeshBasicMaterial({ color: s.key === pick ? 0xffe000 : s.color, depthTest: false }));
    m.position.set(p[0], p[1], p[2]); m.renderOrder = 10; dots.add(m);
  }
  dots.visible = showB;
}
const msg = (t: string) => { $('msg').textContent = t; };

// ---- building ----
const PALETTE = [0xe6194b, 0x3cb44b, 0xffe119, 0x4363d8, 0xf58231, 0x911eb4, 0x46f0f0, 0xf032e6, 0xbcf60c, 0xfabebe, 0x008080, 0xe6beff, 0x9a6324, 0xfffac8, 0x800000, 0xaaffc3, 0x808000, 0xffd8b1, 0x000075, 0x808080, 0x222222, 0xff8800, 0x00aa88, 0x8800ff];
let srcGeo: THREE.BufferGeometry | null = null, srcMat: THREE.Material | null = null;
function rebuild() {
  if (!srcGeo || !cloud) return;
  if (skinned) { skinned.removeFromParent(); skinned.skeleton.dispose(); }
  helper?.removeFromParent();
  const key = `tool|${id}|${JSON.stringify(lm)}`;
  dropSkin(key);
  const t0 = performance.now();
  const skin = skinFor(key, srcGeo, lm);
  const ms = performance.now() - t0;
  const { bones, inverses } = makeBones(skin.rig);
  let mat = srcMat!;
  if (showW) {
    // each point tinted by its bones
    const si = skin.geometry.attributes.skinIndex, sw = skin.geometry.attributes.skinWeight, n = si.count, col = new Float32Array(n * 3), c = new THREE.Color();
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { c.setHex(PALETTE[si.getComponent(i, k) % PALETTE.length]); const w = sw.getComponent(i, k); col[i * 3] += c.r * w; col[i * 3 + 1] += c.g * w; col[i * 3 + 2] += c.b * w; }
    skin.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  }
  skinned = new THREE.SkinnedMesh(skin.geometry, mat);
  skinned.add(bones[0]);
  skinned.bind(new THREE.Skeleton(bones, inverses), new THREE.Matrix4());
  skinned.frustumCulled = false;
  scene.add(skinned);
  helper = new THREE.SkeletonHelper(skinned); (helper.material as THREE.LineBasicMaterial).depthTest = false; helper.renderOrder = 9; helper.visible = showB; scene.add(helper);
  const was = anim;
  anim = new Animator(skin.rig, bones, 0, !!meta[id]?.floats);
  if (was) anim.setBase(was.state);
  drawDots(); listPoints();
  msg(`${skin.rig.bones.length} bones, ${cloud.n} points, made in ${ms.toFixed(0)} ms`);
}

async function load(newId: string) {
  id = newId; history.replaceState(null, '', `?id=${id}`);
  const gl = await new GLTFLoader().loadAsync(`${base}models/glimmers/${id}.glb`);
  gl.scene.updateMatrixWorld(true);
  let mesh: THREE.Mesh | null = null;
  gl.scene.traverse(o => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
  const m = mesh as THREE.Mesh | null;
  if (!m) { msg('No mesh in this file'); return; }
  srcGeo = m.geometry.clone(); srcGeo.applyMatrix4(m.matrixWorld);
  srcMat = m.material as THREE.Material;
  model?.removeFromParent();
  model = new THREE.Mesh(srcGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, visible: false }));
  scene.add(model);
  cloud = cloudOf(positionsOf(srcGeo));
  const me = meta[id];
  lm = me?.rig ? structuredClone(me.rig) : guessLandmarks(cloud, (q.get('plan') as Plan) ?? 'quad', {}, me);
  if (!me?.rig) msg('No landmarks saved yet: these are guesses. Pick the body plan first.');
  ($('plan') as HTMLSelectElement).value = lm.plan;
  // the whole model in view (long ones too)
  const big = Math.max(cloud.height, cloud.max.x - cloud.min.x, cloud.max.z - cloud.min.z);
  ctl.target.set((cloud.min.x + cloud.max.x) / 2, cloud.height * 0.45, (cloud.min.z + cloud.max.z) / 2); cam.position.copy(ctl.target).add(new THREE.Vector3(big * 1.5, big * 0.9, big * 2.1)); ctl.update();
  grid.scale.setScalar(cloud.height);
  pick = null;
  rebuild();
}

// ---- clicking on the model: the middle of the part under the pointer ----
const ray = new THREE.Raycaster(); let down: [number, number] | null = null;
r.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
r.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || !pick || !model) return;
  const rect = r.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), cam);
  const hits = ray.intersectObject(model);
  if (!hits.length) return;
  // in through the first face, out through the next one facing away
  const a = hits[0].point, out = hits.slice(1).find(h => h.face && h.face.normal.dot(ray.ray.direction) > 0);
  const p = out ? a.clone().lerp(out.point, 0.5) : a;
  const s = slots().find(x => x.key === pick);
  if (!s) return;
  s.set([+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)]);
  rebuild();
});

// ---- the buttons ----
async function boot() {
  meta = await fetch(`${base}models/glimmers/meta.json?${Date.now()}`).then(x => x.json());
  const list: string[] = await fetch('/__rig/list').then(x => (x.ok ? x.json() : Object.keys(meta))).catch(() => Object.keys(meta));
  const who = $('who') as HTMLSelectElement;
  for (const k of list) who.add(new Option(`${k}${meta[k]?.rig ? '' : ' (no rig)'}`, k));
  if (!id || !list.includes(id)) id = list[0];
  who.value = id; who.onchange = () => load(who.value);
  const plan = $('plan') as HTMLSelectElement;
  for (const p of PLANS) plan.add(new Option(PLAN_NAME[p], p));
  plan.onchange = () => { if (!cloud) return; lm = guessLandmarks(cloud, plan.value as Plan, { head: lm.head }, meta[id]); rebuild(); };
  $('guess').onclick = () => { if (!cloud) return; lm = guessLandmarks(cloud, lm.plan, { head: lm.head }, meta[id]); rebuild(); };
  $('save').onclick = async () => {
    const res = await fetch('/__rig/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, rig: landmarksJson(lm), height: cloud?.height }) }).catch(() => null);
    if (res?.ok) { meta[id] = { ...(meta[id] ?? { height: cloud!.height, head: lm.head }), rig: landmarksJson(lm) }; msg(`Saved ${id} to meta.json`); }
    else msg('Could not save: run node scripts/glimmers/rig-tool.mjs (the plain dev server cannot write files). The landmarks are in the console.'), console.log(JSON.stringify(landmarksJson(lm)));
  };
  $('wts').onclick = () => { showW = !showW; $('wts').classList.toggle('on', showW); rebuild(); };
  $('bones').onclick = () => { showB = !showB; $('bones').classList.toggle('on', showB); dots.visible = showB; if (helper) helper.visible = showB; };
  const mv = $('moves');
  for (const b of BASES) { const e = document.createElement('button'); e.textContent = b; e.onclick = () => anim?.setBase(b as Base); mv.append(e); }
  for (const a of ACTS) { const e = document.createElement('button'); e.textContent = a; e.onclick = () => anim?.play(a as Act); mv.append(e); }
  const H = () => cloud?.height ?? 1, hd = () => new THREE.Vector3(...lm.head);
  const add: [string, () => void][] = [
    ['+ Tail', () => { const hp = lm.hips ?? [0, H() * 0.4, -H() * 0.2]; lm.tail = [[hp[0], hp[1], hp[2] - H() * 0.15], [hp[0], hp[1] + H() * 0.1, hp[2] - H() * 0.45]]; }],
    ['+ Tail point', () => { if (lm.tail && lm.tail.length < 6) { const n = lm.tail.length, a = lm.tail[n - 2], b = lm.tail[n - 1]; lm.tail.splice(n - 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]); } }],
    ['- Tail', () => { delete lm.tail; }],
    ['2 / 4 feet', () => { const y = H() * 0.035; lm.feet = lm.feet?.length === 4 ? [[-0.12 * H(), y, 0], [0.12 * H(), y, 0]] : [[-0.15 * H(), y, 0.2 * H()], [0.15 * H(), y, 0.2 * H()], [-0.15 * H(), y, -0.2 * H()], [0.15 * H(), y, -0.2 * H()]]; }],
    ['- Feet', () => { delete lm.feet; }],
    ['+ Arms', () => { const c = lm.chest ?? [0, H() * 0.5, 0]; lm.hands = [[c[0] - 0.3 * H(), c[1] - 0.1 * H(), c[2] + 0.05 * H()], [c[0] + 0.3 * H(), c[1] - 0.1 * H(), c[2] + 0.05 * H()]]; }],
    ['- Arms', () => { delete lm.hands; }],
    ['+ Wings', () => { const c = lm.chest ?? [0, H() * 0.5, 0]; lm.wings = [-1, 1].map(s => [[c[0] + s * 0.12 * H(), c[1] + 0.05 * H(), c[2] - 0.05 * H()], [c[0] + s * 0.5 * H(), c[1] + 0.2 * H(), c[2] - 0.15 * H()]] as [V3, V3]); }],
    ['- Wings', () => { delete lm.wings; }],
    ['+ Fins', () => { const c = lm.chest ?? [0, H() * 0.5, 0]; lm.fins = [-1, 1].map(s => [[c[0] + s * 0.15 * H(), c[1] - 0.1 * H(), c[2]], [c[0] + s * 0.4 * H(), c[1] - 0.2 * H(), c[2] - 0.1 * H()]] as [V3, V3]); }],
    ['- Fins', () => { delete lm.fins; }],
    ['+ Ears', () => { const h = hd(); lm.ears = [-1, 1].map(s => [[h.x + s * 0.1 * H(), h.y + 0.12 * H(), h.z], [h.x + s * 0.15 * H(), h.y + 0.25 * H(), h.z]] as [V3, V3]); }],
    ['+ One ear', () => { const h = hd(); (lm.ears ??= []).push([[h.x, h.y + 0.15 * H(), h.z], [h.x, h.y + 0.3 * H(), h.z]]); }],
    ['- Ears', () => { delete lm.ears; }],
    ['+ Tentacle', () => { const hp = lm.hips ?? [0, H() * 0.4, 0]; (lm.tentacles ??= []).push([[hp[0], hp[1] - 0.03 * H(), hp[2] + 0.1 * H()], [hp[0], hp[1] * 0.5, hp[2] + 0.2 * H()], [hp[0], 0.03 * H(), hp[2] + 0.3 * H()]]); }],
    ['- Tentacle', () => { lm.tentacles?.pop(); if (!lm.tentacles?.length) delete lm.tentacles; }],
  ];
  for (const [label, f] of add) { const e = document.createElement('button'); e.textContent = label; e.onclick = () => { f(); pick = null; rebuild(); }; $('add').append(e); }
  await load(id);
}

let last = performance.now();
r.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  anim?.update(dt, now / 1000);
  r.render(scene, cam);
});
Object.assign(window, { __rig: { get lm() { return lm; }, set lm(v: Landmarks) { lm = v; rebuild(); }, rebuild, load, get anim() { return anim; } } });
boot().catch(e => msg('Failed: ' + e));
