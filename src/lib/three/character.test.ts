import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Character } from './character';
import { IdleHold, SETTLE } from './calm';

const dt = 1 / 30;

// ---- a made-up buddy: one box skinned to a hips bone and a head bone, enough for its moves and a sneeze ----
// (no page here, and this file runs on its own: the buddies' file looks for the window as it loads, and the
// blob under its feet and the sneeze's puff draw on a canvas, so a stand-in canvas takes the drawing)
vi.hoisted(() => {
  const page = globalThis as { window?: unknown; document?: unknown };
  const pen = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, fillStyle: '' };
  page.window ??= globalThis;
  page.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => pen }) };
});

function buddy(): Character {
  const hips = new THREE.Bone(), head = new THREE.Bone();
  hips.name = 'Hips'; head.name = 'Head'; head.position.y = 0.9;
  hips.add(head);
  const geo = new THREE.BoxGeometry(0.5, 1.2, 0.4).translate(0, 0.6, 0);
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: n * 4 }, (_, i) => (i % 4 ? 0 : 1)), 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  const model = new THREE.Group();
  model.add(hips, mesh);
  model.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([hips, head]));
  const Make = Character as unknown as new (id: string, model: THREE.Object3D, clips: THREE.AnimationClip[]) => Character;
  return new Make('dino', model, []);
}

/** dressed: worn gear (and a painted coat) keep a ticker going for as long as they're on (gear3d.ts, paint) */
function dress(c: Character) {
  const worn = { ran: 0 };
  c.tickers.add(d => { worn.ran += d; });
  return worn;
}

describe("a dressed buddy with less motion (Home's buddy, the title, the Shop, the Wardrobe)", () => {
  it("standing there, dressed, it isn't busy: what it wears doesn't count as a move", () => {
    const c = buddy();
    expect(c.busy).toBe(false);
    dress(c);
    expect(c.busy).toBe(false);
  });

  it('with less motion, a dressed buddy that only stands there holds its pose, and what it wears holds too', () => {
    const c = buddy(), h = new IdleHold(), worn = dress(c);
    for (let i = 0; i < 90; i++) c.update(h.step(dt, c.busy, true));
    expect(c.mixer.time).toBe(0);
    expect(worn.ran).toBe(0);
  });

  it('without less motion, it breathes and what it wears moves, every frame, as ever', () => {
    const c = buddy(), h = new IdleHold(), worn = dress(c);
    for (let i = 0; i < 90; i++) c.update(h.step(dt, c.busy, false));
    expect(c.mixer.time).toBeCloseTo(90 * dt, 9);
    expect(worn.ran).toBeCloseTo(90 * dt, 9);
  });

  it('with less motion, a sneeze (a tap on it) plays all the way, its puff too, then the pose holds', () => {
    const c = buddy(), h = new IdleHold();
    dress(c);
    const kids = c.root.children.length;
    for (let i = 0; i < 30; i++) c.update(h.step(dt, c.busy, true));
    const len = c.sneeze();
    let ran = 0, puffed = false, busyAll = true;
    for (let i = 0; i < 200; i++) {
      const d = h.step(dt, c.busy, true);
      if (ran < len) busyAll &&= c.busy;
      ran += d;
      c.update(d);
      if (c.root.children.length > kids) puffed = true;
    }
    expect(puffed).toBe(true);
    expect(busyAll).toBe(true);
    // the puff is gone, and nothing's left playing
    expect(c.root.children.length).toBe(kids);
    expect(c.busy).toBe(false);
    // the sneeze, then the fade back to standing, then it holds
    expect(ran).toBeGreaterThanOrEqual(len + SETTLE - 1e-9);
    expect(ran).toBeLessThan(len + SETTLE + 3 * dt);
  });
});
