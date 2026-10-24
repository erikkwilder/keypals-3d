// Pictures of the 3D buddies in poses, for stickers and thumbnails. A small renderer of its own draws
// one buddy at a moment of a move on a transparent background and keeps the picture.
import * as THREE from 'three';
import { Character } from './character';
import { makeOutfit } from './outfits3d';
import type { FriendId } from '../art/cast';

/** Sticker poses, as a move and the moment in it (0 to 1). */
export const POSE_MOVES: Record<string, [string, number][]> = {
  cheer: [['fistpump', 0.45], ['jump', 0.35]],
  wave: [['wave1', 0.35], ['wave', 0.4]],
  proud: [['fistpump', 0.6], ['idle', 0.2]],
  love: [['dance_happyhands', 0.25], ['idle', 0.25]],
  cool: [['dance_hiphop', 0.3], ['idle', 0.2]],
  sleep: [['sit', 0.5], ['idle', 0.5]],
  surprised: [['jump', 0.35], ['idle', 0.2]],
  run: [['run', 0.3]],
  ride: [['seated', 0.5], ['sit', 0.5]],
  hug: [['dance_sway', 0.4], ['idle', 0.4]],
  wink: [['dance_hiphop1', 0.3], ['wave1', 0.4]],
};

let renderer: THREE.WebGLRenderer | null = null;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
const chars = new Map<FriendId, Promise<Character | null>>();
const pics = new Map<string, Promise<string | null>>();
let queue: Promise<unknown> = Promise.resolve();

function setup() {
  if (renderer) return renderer;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 384;
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(384, 384, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);
  scene.add(new THREE.HemisphereLight(0xeef6ff, 0x9aa888, 1.5));
  const key = new THREE.DirectionalLight(0xfff4e6, 2.2); key.position.set(1.5, 3, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0xe8dcff, 1.0); rim.position.set(-2, 2, -2); scene.add(rim);
  return renderer;
}

function character(id: FriendId) {
  let p = chars.get(id);
  if (!p) {
    p = Character.create(id).then(async c => {
      if (!c) return null;
      await c.loadMoves();
      c.groundFeet = false;
      scene.add(c.root);
      c.root.visible = false;
      return c;
    });
    chars.set(id, p);
  }
  return p;
}

/** A picture (data URL) of a buddy in a sticker pose, wearing an outfit. */
export function snapshot(id: FriendId, pose: string, outfit = 'none'): Promise<string | null> {
  const key = `${id}|${pose}|${outfit}`;
  let p = pics.get(key);
  if (!p) {
    p = (queue = queue.then(() => draw(id, pose, outfit)).catch(() => null)) as Promise<string | null>;
    pics.set(key, p);
  }
  return p;
}

async function draw(id: FriendId, pose: string, outfit: string): Promise<string | null> {
  const r = setup();
  const c = await character(id);
  if (!c) return null;
  await c.wear(outfit, makeOutfit);
  const [move, at] = (POSE_MOVES[pose] ?? POSE_MOVES.cheer).find(([m]) => c.has(m)) ?? ['idle', 0];
  c.mixer.stopAllAction();
  const a = c.actions[move];
  if (a) { a.reset().play(); c.mixer.setTime(a.getClip().duration * at); }
  for (const other of await Promise.all([...chars.values()])) if (other) other.root.visible = other === c;
  c.root.position.set(0, 0, 0);
  c.root.rotation.set(0, -0.35, 0);
  c.root.updateMatrixWorld(true);
  // frame the whole body, whatever the pose
  const box = new THREE.Box3();
  for (const b of Object.values(c.bones)) box.expandByPoint(b.getWorldPosition(new THREE.Vector3()));
  box.min.y = Math.min(box.min.y, 0);
  box.expandByScalar(0.16);
  box.max.y += 0.12; // heads and hats reach above the head bone
  const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
  const h = Math.max(size.y, size.x * 1.05);
  const d = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.02;
  camera.position.set(centre.x, centre.y + h * 0.05, centre.z + d);
  camera.lookAt(centre);
  r.render(scene, camera);
  return r.domElement.toDataURL('image/png');
}
