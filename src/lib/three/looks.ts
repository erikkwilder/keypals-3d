// The four Looks from Settings, on the real 3D buddy (everywhere it's drawn: every scene dresses its
// buddy through dress.ts, which puts the Look on too):
// - Soft Squish: the buddy as it's made, soft and glowy.
// - Ink Sticker: a bold dark outline all the way round, like a sticker, and a little shinier.
// - Paper Craft: matte and evenly lit, like coloured paper, with a cream cut-paper edge round it.
// - Geo Pop: flat-shaded facets, like a model folded from shapes, a little brighter, with a thin crease
//   round it in a deeper shade of the buddy's own colours (blue skin gets a deep blue edge, a red jacket a
//   deep red one; a painted buddy a deep shade of its paint), so it reads as a fold, not a coloured line.
//   (It used to be one bright pink line round every buddy: a child who picked Geo Pop for the pages'
//   look got a pink outline on every character.)
// The outline is the buddy's own body drawn again a few pixels bigger, inside out and in one colour,
// behind it (the same skeleton, so it moves with every dance). It hangs on the buddy's root, beside the
// model rather than in it, so nothing that changes the model's own materials (a new colour, the shadowy
// look) touches it, and it hides whenever the body does. Only the body gets the Look: hats and
// gear keep their own. Changing the Look in Settings changes every buddy on screen straight away.
import * as THREE from 'three';
import type { Character } from './character';

export type BuddyLook = 'soft' | 'ink' | 'paper' | 'geo';
const LOOKS: BuddyLook[] = ['soft', 'ink', 'paper', 'geo'];
/** each Look's edge (none for Soft Squish): its colour and how thick, in screen pixels; 'self': the
 *  buddy's own colour where the edge is, deeper (Geo Pop) */
const EDGE: Record<BuddyLook, { color: number | 'self'; px: number } | null> = {
  soft: null,
  ink: { color: 0x2a1b3d, px: 3.2 },
  paper: { color: 0xfff3dc, px: 5 },
  geo: { color: 'self', px: 2.8 },
};
/** how much of its own colour a Geo Pop edge keeps (deeper and a little more colourful) */
const SELF_DEPTH = 0.3, SELF_VIVID = 1.4;

type Kept = { roughness?: number; metalness?: number; flatShading: boolean; envMapIntensity?: number; emissive?: THREE.Color; emissiveMap?: THREE.Texture | null };
type EdgeU = { uPx: THREE.IUniform<number>; uRes: THREE.IUniform<THREE.Vector2>; uHide: THREE.IUniform<number>; uSelf: THREE.IUniform<number>; uTone: THREE.IUniform<THREE.Color> };
type State = { look: BuddyLook | null; body: THREE.Mesh[]; kept: Kept[][]; edges: THREE.Mesh[]; edgeMats: THREE.MeshBasicMaterial[]; edgeU: EdgeU; edge: { px: number; self: boolean } };
const states = new WeakMap<Character, State>();
const live = new Set<WeakRef<Character>>();

/** The Look the player picked (the app keeps it on the page: <html data-look>). */
export function currentLook(): BuddyLook {
  const l = typeof document !== 'undefined' ? document.documentElement.dataset.look : undefined;
  return (LOOKS as string[]).includes(l ?? '') ? (l as BuddyLook) : 'soft';
}

const mats = (m: THREE.Mesh) => (Array.isArray(m.material) ? m.material : [m.material]);
/** a copy of a material for this one buddy (the buddies share theirs), keeping its shader tweaks */
function own(mat: THREE.Material) {
  const c = mat.clone();
  c.onBeforeCompile = mat.onBeforeCompile;
  c.customProgramCacheKey = mat.customProgramCacheKey;
  return c;
}

/** The buddy's own body: its meshes, not anything held on its bones (hats, gear, the eyes). */
function bodyOf(c: Character): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D) => {
    if ((o as THREE.Bone).isBone || o.userData.kpEdge) return;
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
    for (const ch of o.children) walk(ch);
  };
  walk(c.model);
  return out;
}

const _v = new THREE.Vector4();
function setup(c: Character): State {
  const body = bodyOf(c);
  for (const m of body) m.material = Array.isArray(m.material) ? m.material.map(own) : own(m.material);
  const kept = body.map(m => mats(m).map(x => { const s = x as THREE.MeshStandardMaterial; return { roughness: s.roughness, metalness: s.metalness, flatShading: !!s.flatShading, envMapIntensity: s.envMapIntensity, emissive: s.emissive?.clone(), emissiveMap: s.emissiveMap ?? null }; }));
  // the edge: the body again, inside out, pushed out along its normals by a few pixels on screen. Each body
  // part gets its own (it carries that part's picture, for Geo Pop's own-colour edge); they share the rest.
  const edgeU: EdgeU = { uPx: { value: 3 }, uRes: { value: new THREE.Vector2(1, 1) }, uHide: { value: 0 }, uSelf: { value: 0 }, uTone: { value: new THREE.Color(0x2a1b3d) } };
  const edge = { px: 3, self: false };
  const edgeMatFor = (m: THREE.Mesh) => {
    const ms = mats(m), map = (ms[0] as THREE.MeshStandardMaterial).map ?? null;
    // one picture for the whole part (a part made of several pictures takes a one-colour edge instead)
    const one = ms.every(x => ((x as THREE.MeshStandardMaterial).map ?? null) === map);
    // (pushed back a little in depth, so it never shows through the body's own folds and openings)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: one ? map : null, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 8 });
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, edgeU);
      sh.vertexShader = 'uniform float uPx;\nuniform vec2 uRes;\nuniform float uHide;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      {
        #ifdef USE_SKINNING
          vec3 kpN = objectNormal;
        #else
          vec3 kpN = normal;
        #endif
        vec4 kpC = projectionMatrix * vec4(normalize(normalMatrix * kpN), 0.0);
        float kpL = length(kpC.xy);
        if (kpL > 1e-5) gl_Position.xy += (kpC.xy / kpL) * uPx * 2.0 / uRes * gl_Position.w;
        if (uHide > 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`);
      // one colour (Ink's dark, Paper's cream, a painted buddy's deep paint), or the part's own colour, deeper
      sh.fragmentShader = 'uniform float uSelf;\nuniform vec3 uTone;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef USE_MAP
        if (uSelf > 0.5) { float kpY = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)); diffuseColor.rgb = max(vec3(0.0), mix(vec3(kpY), diffuseColor.rgb, ${SELF_VIVID.toFixed(2)})) * ${SELF_DEPTH.toFixed(2)}; }
        else diffuseColor.rgb = uTone;
      #else
        diffuseColor.rgb = uTone;
      #endif`);
    };
    mat.customProgramCacheKey = () => 'kp-look-edge2';
    return mat;
  };
  const edges: THREE.Mesh[] = [], edgeMats: THREE.MeshBasicMaterial[] = [];
  for (const m of body) {
    const sk = m as THREE.SkinnedMesh, edgeMat = edgeMatFor(m);
    let e: THREE.Mesh;
    if (sk.isSkinnedMesh) { const se = new THREE.SkinnedMesh(sk.geometry, edgeMat); se.bind(sk.skeleton, sk.bindMatrix); se.bindMode = sk.bindMode; e = se; }
    else e = new THREE.Mesh(m.geometry, edgeMat);
    e.userData.kpEdge = true;
    e.castShadow = false; e.receiveShadow = false; e.frustumCulled = false; e.visible = false;
    e.raycast = () => {};
    e.onBeforeRender = (r) => {
      r.getCurrentViewport(_v); edgeU.uRes.value.set(Math.max(1, _v.z), Math.max(1, _v.w)); edgeU.uPx.value = edge.px * r.getPixelRatio();
      // Geo Pop on a painted buddy: a deep shade of the paint, all round (its picture still has the old colour)
      const paint = edge.self ? c.paintTone() : null;
      edgeU.uSelf.value = edge.self && !paint && edgeMat.map ? 1 : 0;
      if (edge.self && !edgeU.uSelf.value) edgeU.uTone.value.setHSL(paint?.hue ?? 0.75, paint ? Math.min(1, paint.sat * 1.1) : 0.25, 0.2);
      // hidden with the body (a scene hiding the model, or a part of it)
      let o: THREE.Object3D | null = m, shown = true;
      while (o && o !== c.root) { if (!o.visible) { shown = false; break; } o = o.parent; }
      edgeU.uHide.value = shown ? 0 : 1;
    };
    // (a skin bound "attached" draws in its bones' places wherever the mesh hangs; any other kind rides the body mesh)
    if (!sk.isSkinnedMesh || sk.bindMode !== 'attached') m.add(e); else c.root.add(e);
    edges.push(e); edgeMats.push(edgeMat);
  }
  const st: State = { look: null, body, kept, edges, edgeMats, edgeU, edge };
  states.set(c, st);
  live.add(new WeakRef(c));
  return st;
}

/** Put a Look on a buddy (again is fine: nothing changes if it already has it). */
export function applyLook(c: Character, look: BuddyLook = currentLook()) {
  const st = states.get(c) ?? setup(c);
  if (st.look === look) return;
  st.look = look;
  st.body.forEach((m, i) => mats(m).forEach((x, j) => {
    const s = x as THREE.MeshStandardMaterial, k = st.kept[i]?.[j];
    if (!k) return;
    const flat = look === 'geo';
    if (k.roughness !== undefined) s.roughness = look === 'paper' ? 1 : look === 'ink' ? Math.min(k.roughness, 0.42) : look === 'geo' ? Math.max(k.roughness, 0.7) : k.roughness;
    if (k.metalness !== undefined) s.metalness = look === 'paper' || look === 'geo' ? 0 : k.metalness;
    if (k.envMapIntensity !== undefined) s.envMapIntensity = look === 'paper' ? 0.25 : k.envMapIntensity;
    if (s.flatShading !== (flat || k.flatShading)) { s.flatShading = flat || k.flatShading; s.needsUpdate = true; }
    // paper is lit evenly (some of its own colour glows through, so the shading is soft and flat); geo is a little brighter
    if (k.emissive && s.emissive) {
      const glow = look === 'paper' ? 0.38 : look === 'geo' ? 0.16 : 0;
      const map = glow ? s.map : k.emissiveMap ?? null;
      if (glow) s.emissive.setScalar(glow); else s.emissive.copy(k.emissive);
      if (s.emissiveMap !== map) { s.emissiveMap = map; s.needsUpdate = true; }
    }
  }));
  const edge = EDGE[look];
  for (const e of st.edges) e.visible = !!edge;
  if (edge) {
    st.edge.px = edge.px; st.edge.self = edge.color === 'self';
    if (edge.color !== 'self') st.edgeU.uTone.value.setHex(edge.color);
  }
}

/** The Look changed: every buddy that has one gets the new one. */
export function refreshLooks(look: BuddyLook = currentLook()) {
  for (const ref of live) {
    const c = ref.deref();
    if (!c) { live.delete(ref); continue; }
    applyLook(c, look);
  }
}

// the Look follows the setting: the app writes it on <html data-look>, so watch that
if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
  let was = currentLook();
  new MutationObserver(() => { const now = currentLook(); if (now !== was) { was = now; refreshLooks(now); } })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-look'] });
}
