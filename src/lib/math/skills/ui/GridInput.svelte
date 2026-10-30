<script lang="ts">
  // A coordinate grid to tap or drag on: the point snaps to the nearest crossing (and follows a finger
  // dragged across the grid), arrow keys move it, Check (or Enter) answers. Axes are numbered; negative
  // numbers work (the coordinate plane) and are written with a real minus sign.
  import Icon from '../../../ui/Icon.svelte';
  import type { GridSpec } from '../types';
  type Props = { grid: GridSpec; disabled?: boolean; compact?: boolean; onanswer: (x: number, y: number) => void; onfirst?: () => void };
  let { grid, disabled = false, compact = false, onanswer, onfirst }: Props = $props();
  const nx = $derived(grid.xMax - grid.xMin), ny = $derived(grid.yMax - grid.yMin);
  const S = 34, PAD = 30;
  const W = $derived(nx * S + PAD * 2), H = $derived(ny * S + PAD * 2);
  const X = (x: number) => PAD + (x - grid.xMin) * S, Y = (y: number) => PAD + (grid.yMax - y) * S;
  let pt = $state<{ x: number; y: number } | null>(null);
  let svg: SVGSVGElement | undefined = $state();
  let dragging = false;
  const txt = (n: number) => (n < 0 ? `−${-n}` : String(n));
  function tap(e: PointerEvent) {
    if (!svg || disabled) return;
    if (e.type === 'pointerdown') { dragging = true; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); }
    const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) * (W / r.width), sy = (e.clientY - r.top) * (H / r.height);
    onfirst?.();
    pt = { x: Math.max(grid.xMin, Math.min(grid.xMax, Math.round((sx - PAD) / S + grid.xMin))), y: Math.max(grid.yMin, Math.min(grid.yMax, Math.round(grid.yMax - (sy - PAD) / S))) };
  }
  function key(e: KeyboardEvent) {
    if (disabled) return;
    const d: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    if (d[e.key]) { e.preventDefault(); onfirst?.(); const p = pt ?? { x: 0, y: 0 }; pt = { x: Math.max(grid.xMin, Math.min(grid.xMax, p.x + d[e.key][0])), y: Math.max(grid.yMin, Math.min(grid.yMax, p.y + d[e.key][1])) }; }
    if (e.key === 'Enter' && pt) { e.preventDefault(); onanswer(pt.x, pt.y); }
  }
</script>

<svelte:window onkeydown={key} />

<div class="gi" class:compact>
  <svg bind:this={svg} viewBox="0 0 {W} {H}" class="grid" onpointerdown={tap} onpointermove={(e) => { if (dragging) tap(e); }} onpointerup={() => (dragging = false)} onpointercancel={() => (dragging = false)} role="img" aria-label="Coordinate grid">
    <rect x="0" y="0" width={W} height={H} rx="18" fill="#fffaf0" />
    {#each Array(nx + 1) as _, i}<line x1={X(grid.xMin + i)} y1={PAD} x2={X(grid.xMin + i)} y2={H - PAD} stroke={grid.xMin + i === 0 ? '#5b3416' : '#e6d9c2'} stroke-width={grid.xMin + i === 0 ? 3 : 1.5} />{/each}
    {#each Array(ny + 1) as _, j}<line x1={PAD} y1={Y(grid.yMin + j)} x2={W - PAD} y2={Y(grid.yMin + j)} stroke={grid.yMin + j === 0 ? '#5b3416' : '#e6d9c2'} stroke-width={grid.yMin + j === 0 ? 3 : 1.5} />{/each}
    {#each Array(nx + 1) as _, i}<text x={X(grid.xMin + i)} y={H - 10} text-anchor="middle" class="lab">{txt(grid.xMin + i)}</text>{/each}
    {#each Array(ny + 1) as _, j}<text x="14" y={Y(grid.yMin + j) + 6} text-anchor="middle" class="lab">{txt(grid.yMin + j)}</text>{/each}
    {#if pt}<circle cx={X(pt.x)} cy={Y(pt.y)} r="11" fill="#f2a63a" stroke="#fff" stroke-width="4" /><text x={X(pt.x)} y={Y(pt.y) - 18} text-anchor="middle" class="pl">({txt(pt.x)}, {txt(pt.y)})</text>{/if}
  </svg>
  <button class="ok" disabled={!pt || disabled} onpointerdown={(e) => { e.preventDefault(); if (pt && !disabled) onanswer(pt.x, pt.y); }} tabindex="-1"><Icon name="check" size={28} /><span>Check</span></button>
</div>

<style>
  .gi { display: flex; align-items: center; gap: 14px; justify-content: center; width: min(1000px, 100%); margin: 0 auto; }
  .grid { width: min(420px, 60vw); height: auto; cursor: crosshair; touch-action: none; filter: drop-shadow(0 6px 12px rgba(60, 40, 110, .2)); }
  .lab { font: 600 14px var(--font-ui); fill: #7a5a3a; }
  .pl { font: 700 15px var(--font-ui); fill: var(--ink); paint-order: stroke; stroke: #fff; stroke-width: 4px; }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 10px 18px 10px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 20px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact { flex-direction: column; }
  .compact .grid { width: min(360px, 92vw); }
</style>
