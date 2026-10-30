<script lang="ts">
  // The negative numbers pictures (types.ts IntPic): a brass thermometer, a sea-level gauge with a Glimmer
  // swimming under the water or flying above it, a number line on a wooden plank with dots and hops, and
  // a coordinate plane on an old treasure map with gold points. Numbers below zero have a real minus sign.
  import type { IntPic } from '../types';
  import Thermo from './Thermo.svelte';
  type Props = { pic: IntPic; size?: number };
  let { pic, size = 150 }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const uid = `ip${Math.random().toString(36).slice(2, 8)}`;
  const txt = (v: number) => (v < 0 ? `−${+(-v).toFixed(3)}` : String(+v.toFixed(3)));
  const marks = (min: number, max: number, step: number) => Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => +(min + i * step).toFixed(6));
  const isLabel = (v: number, label: number) => Math.abs(v / label - Math.round(v / label)) < 1e-6;
  const HUE = { a: ['#7cc0ff', '#2f7fd8'], b: ['#ff9cc8', '#e0458b'], c: ['#ffe58a', '#e6a817'] } as const;

  // ---- the plane: a cell per unit, a margin for the numbers ----
  const S = 30, M = 26;
  const plane = $derived(pic.kind === 'plane' ? pic : null);
  const PW = $derived(plane ? (plane.xMax - plane.xMin) * S + 2 * M : 0), PH = $derived(plane ? (plane.yMax - plane.yMin) * S + 2 * M : 0);
  const PX = (x: number) => M + (x - (plane?.xMin ?? 0)) * S, PY = (y: number) => M + ((plane?.yMax ?? 0) - y) * S;
  const every = $derived(plane && plane.xMax - plane.xMin > 14 ? 2 : 1);

  // ---- the number line: 600 by 130 ----
  const line = $derived(pic.kind === 'nline' ? pic : null);
  const LX = (x: number) => 30 + ((x - (line?.min ?? 0)) / ((line?.max ?? 1) - (line?.min ?? 0))) * 540;

  // ---- the sea gauge: 220 by 300, sea level where 0 is ----
  const depth = $derived(pic.kind === 'depth' ? pic : null);
  const DY = (v: number) => 260 - ((v - (depth?.min ?? 0)) / ((depth?.max ?? 1) - (depth?.min ?? 0))) * 230;
  const face = $derived(depth?.who === 'swim' ? 'bubbleocto' : 'frostowl');
</script>

{#if pic.kind === 'thermo'}
  <Thermo min={pic.min} max={pic.max} at={pic.at} step={pic.step} label={pic.label} height={size * 1.35} />
{:else if depth}
  <svg class="ip" viewBox="0 0 220 300" width={size * 0.95} height={size * 1.3} role="img" aria-label="A sea-level gauge with a Glimmer at {txt(depth.at)} meters">
    <defs>
      <linearGradient id="{uid}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3ff" /><stop offset="1" stop-color="#fff3dc" /></linearGradient>
      <linearGradient id="{uid}sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fc3e8" /><stop offset=".55" stop-color="#2a86c9" /><stop offset="1" stop-color="#173f8a" /></linearGradient>
      <clipPath id="{uid}clip"><rect x="0" y="0" width="220" height="300" rx="22" /></clipPath>
    </defs>
    <g clip-path="url(#{uid}clip)">
      <rect x="0" y="0" width="220" height={DY(0)} fill="url(#{uid}sky)" />
      <rect x="0" y={DY(0)} width="220" height={300 - DY(0)} fill="url(#{uid}sea)" />
      <!-- little waves at sea level, and light rays under it -->
      <path d="M0 {DY(0)} q 13 -7 27 0 t 27 0 t 27 0 t 27 0 t 27 0 t 27 0 t 27 0 t 27 0 t 27 0 v 6 H0 Z" fill="#7fd7f3" />
      <path d="M150 {DY(0) + 6} l 30 120 l 14 0 l -26 -120 Z" fill="#fff" opacity=".12" />
      <path d="M100 {DY(0) + 6} l 20 100 l 10 0 l -16 -100 Z" fill="#fff" opacity=".1" />
      {#each [[175, 286, 7], [195, 270, 5], [160, 262, 4]] as [bx, by, br] (bx)}<circle cx={bx} cy={by} r={br} fill="none" stroke="#bfefff" stroke-width="1.5" opacity=".7" />{/each}
    </g>
    <!-- the striped gauge post, with its marks -->
    <rect x="30" y="18" width="16" height="268" rx="6" fill="#fff" stroke="#8a5a2a" stroke-width="2" />
    {#each marks(depth.min, depth.max, depth.step) as v (v)}
      {@const big = isLabel(v, depth.label)}
      <line x1="46" y1={DY(v)} x2={big ? 60 : 53} y2={DY(v)} stroke={v === 0 ? '#c81e3a' : '#5b3416'} stroke-width={v === 0 ? 3.5 : big ? 2.2 : 1.3} />
      {#if big}<text x="63" y={DY(v) + 5} class="lab" class:zero={v === 0} class:under={v < 0}>{txt(v)}</text>{/if}
    {/each}
    <!-- the Glimmer, with a dotted line back to its height on the gauge -->
    <line x1="48" y1={DY(depth.at)} x2="128" y2={DY(depth.at)} stroke={depth.at < 0 ? '#fff' : '#5b3416'} stroke-width="2" stroke-dasharray="4 5" opacity=".85" />
    <image href="{base}game/glimmers/face/{face}.webp" x="124" y={DY(depth.at) - 32} width="64" height="64" />
    <text x="110" y={DY(0) - 8} class="sl">sea level</text>
  </svg>
{:else if line}
  <svg class="ip" viewBox="0 0 600 130" width={size * 2.6} height={size * 2.6 * (130 / 600)} role="img" aria-label="A number line from {txt(line.min)} to {txt(line.max)}">
    <defs>
      {#each Object.entries(HUE) as [k, [l, d]] (k)}<radialGradient id="{uid}{k}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff" /><stop offset=".25" stop-color={l} /><stop offset="1" stop-color={d} /></radialGradient>{/each}
      <marker id="{uid}arr" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#7c5cf5" /></marker>
    </defs>
    <image href="{base}learn/plank.webp" x="8" y="46" width="584" height="46" preserveAspectRatio="none" />
    {#each marks(line.min, line.max, line.step) as v (v)}
      {@const big = isLabel(v, line.label)}
      <line x1={LX(v)} y1="54" x2={LX(v)} y2={big ? 78 : 70} stroke={v === 0 ? '#1f3f7a' : '#5b3416'} stroke-width={v === 0 ? 4 : big ? 3 : 2} stroke-linecap="round" />
      {#if big}<text x={LX(v)} y="118" text-anchor="middle" class="nlab" class:zero={v === 0} class:under={v < 0}>{txt(v)}</text>{/if}
    {/each}
    {#each line.hops ?? [] as h, i (i)}
      {@const lift = Math.min(44, 16 + Math.abs(LX(h.b) - LX(h.a)) * 0.18)}
      <path d="M{LX(h.a)} 50 Q {(LX(h.a) + LX(h.b)) / 2} {50 - lift * 2} {LX(h.b)} 50" fill="none" stroke="#7c5cf5" stroke-width="3.5" stroke-dasharray="7 6" marker-end="url(#{uid}arr)" />
    {/each}
    {#each line.dots as d, i (i)}
      <circle cx={LX(d.x)} cy="62" r="13" fill="url(#{uid}{d.c})" stroke="#fff" stroke-width="3" />
      {#if d.tag}<text x={LX(d.x)} y="30" text-anchor="middle" class="tag">{d.tag}</text>{/if}
    {/each}
  </svg>
{:else if plane}
  <svg class="ip map" viewBox="0 0 {PW} {PH}" width={size * 1.3} height={size * 1.3 * (PH / PW)} role="img" aria-label="A map with {plane.pts.length === 1 ? 'a point' : `${plane.pts.length} points`}">
    <defs>
      {#each Object.entries(HUE) as [k, [l, d]] (k)}<radialGradient id="{uid}{k}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff" /><stop offset=".25" stop-color={l} /><stop offset="1" stop-color={d} /></radialGradient>{/each}
      <clipPath id="{uid}pc"><rect x="0" y="0" width={PW} height={PH} rx="18" /></clipPath>
    </defs>
    <g clip-path="url(#{uid}pc)">
      <rect x="0" y="0" width={PW} height={PH} fill="#f6e6c3" />
      <image href="{base}math/integers/paper.webp" x="0" y="0" width={PW} height={PH} preserveAspectRatio="none" />
    </g>
    {#each Array(plane.xMax - plane.xMin + 1) as _, i (i)}
      {@const x = plane.xMin + i}
      <line x1={PX(x)} y1={M} x2={PX(x)} y2={PH - M} stroke={x === 0 ? '#5b3416' : 'rgba(120, 80, 40, .32)'} stroke-width={x === 0 ? 3 : 1.4} />
    {/each}
    {#each Array(plane.yMax - plane.yMin + 1) as _, j (j)}
      {@const y = plane.yMin + j}
      <line x1={M} y1={PY(y)} x2={PW - M} y2={PY(y)} stroke={y === 0 ? '#5b3416' : 'rgba(120, 80, 40, .32)'} stroke-width={y === 0 ? 3 : 1.4} />
    {/each}
    <!-- numbers along the axes (on the bottom and left edge when 0 isn't on the map) -->
    {#each Array(plane.xMax - plane.xMin + 1) as _, i (i)}
      {@const x = plane.xMin + i}
      {#if x !== 0 && x % every === 0}<text x={PX(x)} y={(plane.yMin <= 0 && plane.yMax >= 0 ? PY(0) : PH - M) + 17} text-anchor="middle" class="plab">{txt(x)}</text>{/if}
    {/each}
    {#each Array(plane.yMax - plane.yMin + 1) as _, j (j)}
      {@const y = plane.yMin + j}
      {#if y !== 0 && y % every === 0}<text x={(plane.xMin <= 0 && plane.xMax >= 0 ? PX(0) : M) - 6} y={PY(y) + 5} text-anchor="end" class="plab">{txt(y)}</text>{/if}
    {/each}
    <text x={PX(0) - 6} y={PY(0) + 17} text-anchor="end" class="plab zero">0</text>
    {#if plane.seg && plane.pts.length >= 2}
      <line x1={PX(plane.pts[0].x)} y1={PY(plane.pts[0].y)} x2={PX(plane.pts[1].x)} y2={PY(plane.pts[1].y)} stroke="#7c5cf5" stroke-width="3.5" stroke-dasharray="7 6" stroke-linecap="round" />
    {/if}
    {#each plane.pts as q, i (i)}
      <circle cx={PX(q.x)} cy={PY(q.y)} r="11" fill="url(#{uid}{q.c})" stroke="#fff" stroke-width="3" />
      {#if q.tag}<text x={PX(q.x) + 13} y={PY(q.y) - 11} class="ptag">{q.tag}</text>{/if}
    {/each}
  </svg>
{/if}

<style>
  .ip { display: block; flex: none; filter: drop-shadow(0 6px 12px rgba(60, 40, 110, .18)); }
  .lab { font: 700 15px var(--font-ui); fill: #5b3416; }
  .lab.under { fill: #1f3f7a; }
  .lab.zero { fill: #c81e3a; font-size: 17px; }
  .sl { font: 800 12px var(--font-body); fill: #c81e3a; text-transform: uppercase; letter-spacing: .06em; }
  .nlab { font: 700 22px var(--font-ui); fill: #5b3416; }
  .nlab.under { fill: #1f5f9e; }
  .nlab.zero { font-size: 26px; fill: #1f3f7a; }
  .tag { font: 800 20px var(--font-ui); fill: var(--ink); }
  .plab { font: 700 13px var(--font-ui); fill: #6b4a1e; paint-order: stroke; stroke: #f6e6c3; stroke-width: 3px; }
  .plab.zero { fill: #5b3416; }
  .ptag { font: 800 18px var(--font-ui); fill: var(--ink); paint-order: stroke; stroke: #fff; stroke-width: 4px; }
</style>
