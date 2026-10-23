// Loading 3D files and textures, once each.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const base = import.meta.env.BASE_URL;
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const texLoader = new THREE.TextureLoader();

const gltfs = new Map<string, Promise<GLTF | null>>();
/** A glTF file from public/, or null if it isn't there (the game carries on without it). */
export function loadGltf(path: string): Promise<GLTF | null> {
  let p = gltfs.get(path);
  if (!p) {
    p = gltfLoader.loadAsync(base + path).catch((err) => { console.warn('missing', path, err); return null; });
    gltfs.set(path, p);
  }
  return p;
}

const textures = new Map<string, Promise<THREE.Texture | null>>();
export function loadTexture(path: string, opts: { repeat?: boolean; color?: boolean } = {}): Promise<THREE.Texture | null> {
  const key = `${path}|${opts.repeat}|${opts.color}`;
  let p = textures.get(key);
  if (!p) {
    p = texLoader.loadAsync(base + path).then((t) => {
      if (opts.color !== false) t.colorSpace = THREE.SRGBColorSpace;
      if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    }).catch(() => null);
    textures.set(key, p);
  }
  return p;
}
