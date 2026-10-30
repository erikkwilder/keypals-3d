// How long a frame with many Glimmers takes: eight of them (My Sky Island's most) on a lit, shadowed
// floor, posed and drawn again and again, the GPU made to finish each frame (a one-pixel read) so the time
// is the whole frame. Development only: /scripts/glimmers/perf.html
//   ?rig=0      the old wiggle instead of skeletons (to compare)
//   &n=8        how many Glimmers;  &size=1280x720  the canvas;  &frames=240
// window.__done, window.__perf: { update: ms to pose all of them, frame: { median, p95 } ms }
import * as THREE from 'three';
import { GlimmerModel } from '../../src/lib/three/glimmerModel';
import type { GlimmerId } from '../../src/lib/adventure/glimmers';

const q = new URLSearchParams(location.search);
const IDS: GlimmerId[] = ['puddlepup', 'frostjelly', 'frostowl', 'whalecalf', 'mittenyeti', 'sunsnail', 'bubbleocto', 'embernewt', 'fernfox', 'popcornpuff', 'snowseal', 'cactuskit'];
const N = +(q.get('n') ?? 8), FR = +(q.get('frames') ?? 240), rig = q.get('rig') !== '0';
const [W, H] = (q.get('size') ?? '1280x720').split('x').map(Number);
const status = document.getElementById('status')!;

const canvas = document.createElement('canvas'); document.getElementById('grid')!.append(canvas);
const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
r.setPixelRatio(1); r.setSize(W, H, false); canvas.style.width = '640px';
r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NeutralToneMapping;
r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xbfe3ff);
scene.add(new THREE.HemisphereLight(0xd5ecff, 0x6f9a52, 1.2));
const sun = new THREE.DirectionalLight(0xfff2d2, 2.5); sun.position.set(4, 8, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); scene.add(sun, sun.target);
const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ color: 0x8cc06a })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 100); cam.position.set(0, 3.2, 6.5); cam.lookAt(0, 0.4, 0);

async function run() {
  status.textContent = 'Loading...';
  const gs = await Promise.all(IDS.slice(0, N).map(id => GlimmerModel.create(id, 0.6, rig ? {} : { src: `models/glimmers/${id}.glb` })));
  gs.forEach((g, i) => { const a = (i / gs.length) * Math.PI * 2; g.root.position.set(Math.cos(a) * 2.2, 0, Math.sin(a) * 1.6); g.root.rotation.y = -a; g.play('idle'); g.pose = (['idle', 'walk', 'sit', 'sleep'] as const)[i % 4]; scene.add(g.root); });
  const gl = r.getContext(), px = new Uint8Array(4);
  let t = 0;
  const step = () => { t += 1 / 60; gs.forEach((g, i) => { if (i % 3 === 0 && Math.floor(t * 2) % 4 === 0 && t % 0.5 < 1 / 60) g.play('happy'); g.update(1 / 60, t); }); };
  for (let i = 0; i < 60; i++) { step(); r.render(scene, cam); }
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  // posing alone, many times over
  const u0 = performance.now(); for (let i = 0; i < 600; i++) step(); const update = (performance.now() - u0) / 600;
  const fr: number[] = [];
  for (let i = 0; i < FR; i++) {
    const a = performance.now();
    step(); r.render(scene, cam); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    fr.push(performance.now() - a);
  }
  fr.sort((x, y) => x - y);
  // the GPU's own time for a frame, where the browser offers a GPU timer
  const tq = gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null, g2 = gl as WebGL2RenderingContext;
  let gpu: number | null = null;
  if (tq) {
    const qs: WebGLQuery[] = [];
    for (let i = 0; i < 60; i++) { const qq = g2.createQuery()!; g2.beginQuery(tq.TIME_ELAPSED_EXT, qq); step(); r.render(scene, cam); g2.endQuery(tq.TIME_ELAPSED_EXT); qs.push(qq); }
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    await new Promise(res => setTimeout(res, 300));
    const ns = qs.map(qq => (g2.getQueryParameter(qq, g2.QUERY_RESULT_AVAILABLE) ? g2.getQueryParameter(qq, g2.QUERY_RESULT) as number : NaN)).filter(x => x > 0).sort((x, y) => x - y);
    if (ns.length) gpu = +(ns[Math.floor(ns.length / 2)] / 1e6).toFixed(2);
  }
  const perf = { glimmers: N, rigged: rig, update: +update.toFixed(3), frame: { median: +fr[Math.floor(fr.length / 2)].toFixed(2), p95: +fr[Math.floor(fr.length * 0.95)].toFixed(2) }, bones: gs.reduce((a, g) => a + (g.anim?.rig.bones.length ?? 0), 0), gpu };
  status.textContent = JSON.stringify(perf);
  Object.assign(window, { __perf: perf, __done: true });
}
run().catch(e => { status.textContent = 'Failed: ' + e; Object.assign(window, { __done: true, __err: String(e) }); });
