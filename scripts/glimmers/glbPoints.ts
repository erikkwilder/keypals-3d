// A Glimmer model's points and triangles straight from its .glb file, with no loader (for the tests and
// tools that run in node). The game's Glimmer files are plain: one mesh, float positions, no node turns
// (some have their vertex data interleaved: byteStride).
import { readFileSync } from 'node:fs';

export function glbPoints(path: string): { pos: Float32Array; index: Uint32Array } {
  const b = readFileSync(path);
  const jsonLen = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8'));
  const binAt = 20 + jsonLen + 8;
  const prim = j.meshes[0].primitives[0];
  const SIZE: Record<number, number> = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 };
  const read = (ai: number): number[] => {
    const acc = j.accessors[ai], bv = j.bufferViews[acc.bufferView];
    const comps = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 } as Record<string, number>)[acc.type], size = SIZE[acc.componentType];
    const stride = bv.byteStride ?? comps * size, at = binAt + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const out: number[] = new Array(acc.count * comps);
    for (let i = 0; i < acc.count; i++) for (let c = 0; c < comps; c++) {
      const o = at + i * stride + c * size;
      out[i * comps + c] = acc.componentType === 5126 ? b.readFloatLE(o) : acc.componentType === 5125 ? b.readUInt32LE(o) : acc.componentType === 5123 ? b.readUInt16LE(o) : b.readUInt8(o);
    }
    return out;
  };
  return { pos: Float32Array.from(read(prim.attributes.POSITION)), index: Uint32Array.from(read(prim.indices)) };
}
