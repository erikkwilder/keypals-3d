// Contact sheets of Glimmer moves, drawn by the game's own GlimmerModel: a row of still frames per
// Glimmer and move, so a move can be judged from stills (melting, tearing at joints, feet through the
// floor). Development only: open /scripts/glimmers/moves.html on the dev server.
//   ?ids=frostjelly,puddlepup   which Glimmers (default: the first 30)
//   &moves=idle,walk,happy      which moves (default: all): loops idle walk sit sleep swim, one-offs
//                               happy cheer attack hit eat hop sad stomp
//   &frames=6                   frames per row
//   &size=180                   tile size in pixels
//   &view=three|side|front      where the camera looks from
//   &evolved=1                  the grown-up look
//   &free=1                     every limb moves fully (ignores how freely its skin lets it)
//   &gallery=1                  one row per Glimmer, one still per move (a one-off half way through)
// When it's done, window.__done is true and window.__sheet holds the sheet as a JPEG data URL; the
// frame times it took to pose and draw are in window.__ms.
import * as THREE from 'three';
import { GlimmerModel, type Move } from '../../src/lib/three/glimmerModel';
import { GLIMMERS, type GlimmerId } from '../../src/lib/adventure/glimmers';
import { ACT_LEN, ACTS, BASES, type Act, type Base } from '../../src/lib/three/glimmerMotion';
import { Fx } from '../../src/lib/three/fx';

const q = new URLSearchParams(location.search);
const ids = (q.get('ids')?.split(',') ?? GLIMMERS.map(g => g.id)) as GlimmerId[];
const moves = (q.get('moves')?.split(',') ?? [...BASES, ...ACTS]) as (Base | Act)[];
const gallery = q.get('gallery') === '1';
const N = gallery ? 1 : +(q.get('frames') ?? 6), S = +(q.get('size') ?? 180), view = q.get('view') ?? 'three';
const status = document.getElementById('status')!;

const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
r.setPixelRatio(1); r.setSize(S, S, false);
r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NeutralToneMapping;
r.shadowMap.enabled = true;
r.setClearColor(0xdcecf7, 1);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xd5ecff, 0x6f9a52, 1.2));
const sun = new THREE.DirectionalLight(0xfff2d2, 2.5); sun.position.set(3, 5, 4); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2 });
scene.add(sun, sun.target);
const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.MeshStandardMaterial({ color: 0xb9d8a0, roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
const fx = new Fx(); scene.add(fx.root); fx.setScale(S, cam.fov);

const LAB = 16, cols = gallery ? moves.length : N;
const sheet = document.createElement('canvas');
sheet.width = cols * S + 110; sheet.height = (gallery ? ids.length : ids.length * moves.length) * (S + 2) + LAB + (gallery ? 16 : 0);
const g2 = sheet.getContext('2d')!;
g2.fillStyle = '#fff'; g2.fillRect(0, 0, sheet.width, sheet.height);
g2.font = '13px system-ui, sans-serif';
const times: number[] = [];

async function run() {
  let row = 0;
  for (const id of ids) {
    status.textContent = `Loading ${id}...`;
    const g = await GlimmerModel.create(id, 1, { evolved: q.get('evolved') === '1' });
    g.fx = fx;
    if (q.get('free')) g.anim?.rig.bones.forEach(b => { b.free = +q.get('free')!; });
    scene.add(g.root);
    // frame it: a little room above and to the sides for the moves
    const box = new THREE.Box3().setFromObject(g.root), size = box.getSize(new THREE.Vector3());
    // (room for hops and a floater's hover above, lunges to the sides)
    const h = Math.max(size.y, size.x * 0.8, size.z * 0.8, 1) * 1.3 + 0.35 + (g.floats ? 0.35 : 0);
    const dir = view === 'side' ? new THREE.Vector3(1, 0.25, 0.05) : view === 'front' ? new THREE.Vector3(0.02, 0.2, 1) : new THREE.Vector3(0.75, 0.38, 1);
    const d = h / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    const aim = new THREE.Vector3(0, h * 0.4, 0);
    cam.position.copy(aim).addScaledVector(dir.normalize(), d); cam.lookAt(aim);
    for (const mv of moves) {
      const base = (BASES as string[]).includes(mv);
      // settle into it
      let t = 10;
      g.play('idle'); g.pose = base ? (mv as Base) : 'idle';
      for (let i = 0; i < 60; i++) { g.update(1 / 60, t); t += 1 / 60; }
      const span = base ? (mv === 'walk' ? 0.84 : mv === 'idle' ? 4 : 2.4) : ACT_LEN[mv as Act];
      if (!base) g.play(mv as Move);
      const step = span / N;
      let local = 0;
      for (let f = 0; f < N; f++) {
        // step to the frame's time in sixtieths of a second
        const tf = (f + (base ? 0 : 0.5)) * step;
        while (local < tf - 1e-6) { const a = performance.now(); g.update(1 / 60, t); times.push(performance.now() - a); fx.update(1 / 60, t); t += 1 / 60; local += 1 / 60; }
        r.render(scene, cam);
        if (gallery) g2.drawImage(r.domElement, 110 + moves.indexOf(mv) * S, LAB + 16 + row * (S + 2));
        else g2.drawImage(r.domElement, 110 + f * S, LAB + row * (S + 2));
      }
      if (gallery) { if (row === 0) { g2.fillStyle = '#557'; g2.fillText(mv, 110 + moves.indexOf(mv) * S + 4, LAB + 10); } continue; }
      g2.fillStyle = '#223'; g2.fillText(id, 4, LAB + row * (S + 2) + 18); g2.fillStyle = '#557'; g2.fillText(mv, 4, LAB + row * (S + 2) + 36);
      row++;
    }
    if (gallery) { g2.fillStyle = '#223'; g2.fillText(id, 4, LAB + 16 + row * (S + 2) + 18); row++; }
    g.dispose();
  }
  const out = document.createElement('img'); out.src = sheet.toDataURL('image/jpeg', 0.85);
  document.getElementById('grid')!.append(out);
  times.sort((a, b) => a - b);
  const ms = { median: times[Math.floor(times.length / 2)], p95: times[Math.floor(times.length * 0.95)], n: times.length };
  status.textContent = `Done: ${ids.length} Glimmers, ${moves.length} moves. Posing one Glimmer: median ${ms.median.toFixed(3)} ms, 95% under ${ms.p95.toFixed(3)} ms.`;
  Object.assign(window, { __sheet: out.src, __ms: ms, __done: true });
}
run().catch(e => { status.textContent = 'Failed: ' + e; console.error(e); Object.assign(window, { __done: true, __err: String(e) }); });
