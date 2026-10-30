// A contact sheet of Glimmers drawn the way the game draws them: the game's own GlimmerModel (its
// material fixes, wiggle and evolved shine), the renderer settings from stage.ts, and an island's sun and
// sky light from themes.ts. Development only (open /scripts/glimmers/sheet.html on the dev server).
//   ?ids=sunsnail,puddlepup   which Glimmers (default: all)
//   &looks=normal,evolved     which looks
//   &light=show|battle        the Glimmers screen's island light (treetops) or a battle's (village)
//   &turn=4                   that many views round each one (a turntable), else one three-quarter view
//   &src=models/glimmers/_test/{id}.glb   load each model from another file
//   &size=320                 tile size in pixels
// Each tile is a PNG with a transparent background (the floor glow hidden) so its colours can be measured;
// window.__tiles holds them once window.__done is true.
import * as THREE from 'three';
import { GlimmerModel } from '../../src/lib/three/glimmerModel';
import { GLIMMER, type GlimmerId } from '../../src/lib/adventure/glimmers';

const q = new URLSearchParams(location.search);
const ids = (q.get('ids')?.split(',') ?? Object.keys(GLIMMER)) as GlimmerId[];
const looks = (q.get('looks') ?? 'normal,evolved').split(',');
const turn = +(q.get('turn') ?? 0);
const src = q.get('src');
const S = +(q.get('size') ?? 320);
const LIGHT = {
  show: { sun: 0xfff2d2, sunK: 2.5, sky: 0xd5ecff, ground: 0x6f9a52, hemiK: 1.2 },
  battle: { sun: 0xfff0d8, sunK: 2.6, sky: 0xcfe8ff, ground: 0x7f9a5c, hemiK: 1.15 },
}[q.get('light') === 'battle' ? 'battle' : 'show'];

const canvas = document.createElement('canvas');
const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
r.setPixelRatio(1); r.setSize(S, S, false);
r.outputColorSpace = THREE.SRGBColorSpace;
r.toneMapping = THREE.NeutralToneMapping;
r.toneMappingExposure = 1.0;
r.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(LIGHT.sky, LIGHT.ground, LIGHT.hemiK));
// the island's sun: over the far side's right shoulder, toward the camera side (island.ts sunOffset)
const sun = new THREE.DirectionalLight(LIGHT.sun, LIGHT.sunK);
sun.position.set(31.3, 34.7, 40); scene.add(sun, sun.target);
const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);

type Tile = { id: string; look: string; yaw: number; url: string };
const tiles: Tile[] = [];
const grid = document.getElementById('grid')!, status = document.getElementById('status')!;

async function shoot(id: GlimmerId, look: string) {
  const g = await GlimmerModel.create(id, 0.9, { evolved: look === 'evolved', src: src ? src.replace('{id}', id) : undefined });
  // no floor glow: tiles are measured against a clear background
  g.root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry?.type === 'CircleGeometry') m.visible = false; });
  scene.add(g.root);
  g.play('idle' as never);
  g.update(0.016, 1.0);
  g.root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  g.root.traverseVisible(o => { if ((o as THREE.Mesh).isMesh) box.expandByObject(o); });
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const rad = Math.max(size.x, size.y, size.z) * 0.62;
  const d = rad / Math.sin(THREE.MathUtils.degToRad(15));
  const yaws = turn ? Array.from({ length: turn }, (_, i) => (i * 360) / turn) : [25];
  for (const yaw of yaws) {
    // the camera goes round; the Glimmer and the light stay put (as in the game, where it turns to face you
    // under a fixed sun, a turntable here keeps the light fixed relative to the camera instead)
    const a = THREE.MathUtils.degToRad(yaw);
    g.root.rotation.y = -a + THREE.MathUtils.degToRad(25);
    g.root.updateMatrixWorld(true);
    cam.position.set(c.x + Math.sin(THREE.MathUtils.degToRad(25)) * d, c.y + d * 0.2, c.z + Math.cos(THREE.MathUtils.degToRad(25)) * d);
    cam.lookAt(c);
    r.render(scene, cam);
    const url = canvas.toDataURL('image/png');
    tiles.push({ id, look, yaw, url });
    const fig = document.createElement('figure');
    fig.innerHTML = `<img width="${S}" height="${S}" src="${url}"><figcaption>${id} ${look}${turn ? ' ' + yaw + '°' : ''}</figcaption>`;
    grid.append(fig);
  }
  g.dispose();
}

(async () => {
  for (const id of ids) for (const look of looks) {
    status.textContent = `Drawing ${id} (${look})...`;
    try { await shoot(id, look); } catch (e) { console.error(id, e); }
  }
  status.textContent = `Done: ${tiles.length} tiles.`;
  Object.assign(window, { __tiles: tiles, __done: true });
})();
