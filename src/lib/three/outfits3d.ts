// Outfits in 3D: hats and headpieces made with Meshy (public/outfits/<id>.glb), sized to each
// buddy's head when worn. `fit` is the hat's width as a share of the head's; `sink` is how far it
// slides down over the head, as a share of its own height.
import * as THREE from 'three';
import { loadGltf } from './assets';

const FIT: Record<string, { fit: number; sink: number }> = {
  party_hat: { fit: 0.55, sink: 0.08 },
  flower_crown: { fit: 0.95, sink: 0.35 },
  propeller_cap: { fit: 0.95, sink: 0.4 },
  cowboy_hat: { fit: 1.45, sink: 0.35 },
  pirate_hat: { fit: 1.25, sink: 0.3 },
  wizard_hat: { fit: 1.2, sink: 0.12 },
  viking_helmet: { fit: 1.0, sink: 0.45 },
  top_hat: { fit: 0.85, sink: 0.12 },
  gold_crown: { fit: 0.75, sink: 0.2 },
};

/** A fresh copy of an outfit's model, ready to wear (null if it isn't there yet). */
export async function makeOutfit(id: string): Promise<THREE.Object3D | null> {
  const g = await loadGltf(`outfits/${id}.glb`);
  if (!g) return null;
  const obj = g.scene.clone(true);
  const f = FIT[id] ?? { fit: 0.9, sink: 0.25 };
  obj.userData.fit = f.fit;
  obj.userData.sink = f.sink;
  return obj;
}
