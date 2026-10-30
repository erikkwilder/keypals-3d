// Pictures of the real 3D buddy, dressed in everything it has on and in a Look, drawn by a small renderer
// of its own on a see-through background: Home's buddy (framed exactly as the tickled 3D buddy in
// fun/liveBuddy.ts, so the swap doesn't jump and the gear is on both) and the Look cards in Settings.
// Each picture is kept for the visit, and Home's last one is kept on this computer too, so a refresh
// shows the dressed buddy straight away.
import * as THREE from 'three';
import { Character } from './character';
import { dressUp } from './dress';
import { applyLook, currentLook, type BuddyLook } from './looks';
import type { FriendId } from '../art/cast';
import type { Dress } from '../adventure/gear';

let renderer: THREE.WebGLRenderer | null = null;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(24, 1, 0.05, 50);
const chars = new Map<FriendId, Promise<Character | null>>();
const pics = new Map<string, Promise<string | null>>();
let queue: Promise<unknown> = Promise.resolve();
const STORE = 'keypals-buddy-pic';

function setup() {
  if (renderer) return renderer;
  const canvas = document.createElement('canvas');
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);
  // the portraits' own lights (the same as the tickled buddy's)
  scene.add(new THREE.HemisphereLight(0xeef6ff, 0xa8b090, 1.5));
  const key = new THREE.DirectionalLight(0xfff4e6, 2.3); key.position.set(1.6, 3, 3.2); scene.add(key);
  const rim = new THREE.DirectionalLight(0xe8dcff, 1.1); rim.position.set(-2.5, 2, -2); scene.add(rim);
  return renderer;
}

function character(id: FriendId) {
  let p = chars.get(id);
  if (!p) {
    p = Character.create(id).then(c => {
      if (!c) return null;
      c.play('idle', 0);
      scene.add(c.root);
      c.root.visible = false;
      return c;
    }).catch(() => null);
    chars.set(id, p);
  }
  return p;
}

/** 'full': the whole buddy as on Home; 'bust': from the waist up; 'face': head and shoulders, close enough to
 *  see a Look's edges and shading (the Look cards in Settings) */
export type Frame = 'full' | 'bust' | 'face';
const keyOf = (id: FriendId, look: BuddyLook, dress: Dress | null | undefined, size: number, frame: Frame = 'full', dpr = 1) => `${id}|${look}|${size}|${frame}|${dpr === 1 ? '' : dpr}|${JSON.stringify(dress ?? null)}`;

/** The picture saved on this computer for this buddy, look and outfit, if it's the one asked for. */
export function storedPicture(id: FriendId, dress: Dress | null | undefined, size: number, look: BuddyLook = currentLook()): string | null {
  try { const s = JSON.parse(localStorage.getItem(STORE) ?? 'null'); return s && s.key === keyOf(id, look, dress, size) ? s.url : null; } catch { return null; }
}

/** A picture (data URL) of a buddy standing as on Home: dressed in `dress` (the save's look when not
 *  given), in `look` (the one picked in Settings when not given), `size` pixels square. `keep` saves it on
 *  this computer for next time. */
export function buddyPicture(id: FriendId, o: { dress?: Dress | null; look?: BuddyLook; size?: number; keep?: boolean; frame?: Frame; dpr?: number } = {}): Promise<string | null> {
  const look = o.look ?? currentLook(), size = Math.round(o.size ?? 200), frame = o.frame ?? 'full';
  // `dpr`: drawn for a screen's sharper pixels (`size` is then in CSS pixels): a Look's edge comes out as
  // thick as it is on the buddy in the game
  const dpr = Math.max(1, Math.min(3, o.dpr ?? 1));
  const key = keyOf(id, look, o.dress, size, frame, dpr);
  let p = pics.get(key);
  if (!p) {
    p = (queue = queue.then(() => draw(id, o.dress, look, size, frame, dpr)).catch(() => null)) as Promise<string | null>;
    pics.set(key, p);
    p.then(u => { if (!u) pics.delete(key); });
  }
  if (o.keep) void p.then(url => { if (url) try { localStorage.setItem(STORE, JSON.stringify({ key, url })); } catch { /* too big or private: fine */ } });
  return p;
}

async function draw(id: FriendId, dress: Dress | null | undefined, look: BuddyLook, size: number, frame: Frame, dpr = 1): Promise<string | null> {
  const r = setup();
  const c = await character(id);
  if (!c) return null;
  await dressUp(c, dress);
  applyLook(c, look);
  for (const other of await Promise.all([...chars.values()])) if (other) other.root.visible = other === c;
  // framed like Home's picture and the tickled buddy: a little turned, the whole body and room for a hat
  c.root.position.set(0, 0, 0);
  c.root.rotation.set(0, -0.38, 0);
  c.mixer.setTime((c.actions.idle?.getClip().duration ?? 1) * 0.15);
  c.root.updateMatrixWorld(true);
  const pb = new THREE.Box3();
  for (const b of Object.values(c.bones)) pb.expandByPoint(b.getWorldPosition(new THREE.Vector3()));
  const hy = c.bones.Head?.getWorldPosition(new THREE.Vector3()).y ?? pb.max.y;
  const top = Math.max(pb.max.y, hy) + 0.32;
  // the whole buddy (Home), from the waist up, or head and shoulders (a Look card)
  const h = frame === 'face' ? top * 0.5 : frame === 'bust' ? top * 0.66 : top * 1.04, aim = new THREE.Vector3(0, frame === 'full' ? top / 2 : top - h / 2 - top * 0.02, 0);
  const d = h / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
  cam.position.set(aim.x, aim.y + h * 0.04, aim.z + d);
  cam.lookAt(aim);
  r.setPixelRatio(dpr);
  r.setSize(size, size, false);
  r.render(scene, cam);
  return r.domElement.toDataURL('image/png');
}
