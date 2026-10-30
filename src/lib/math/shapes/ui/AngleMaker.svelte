<script lang="ts">
  // Make an angle: one side lies still along a protractor's 0; drag the glowing end of the other side round
  // (or use the arrow keys) and it clicks from mark to mark. The protractor's numbers say where you are
  // (gentle rungs show the size as you go); Check when it's the angle asked for.
  import { sfx } from '../../../audio/sound';
  import Icon from '../../../ui/Icon.svelte';
  import type { CustomInputProps } from '../../skills/ui/SkillInput.svelte';
  import ProtractorArt from './ProtractorArt.svelte';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  type Spec = { target: number; from: number; guide: 'full' | 'tens' | 'thirties'; step: number; live: boolean };
  const spec = $derived(item.custom?.spec as Spec);
  const W = 360, H = 360, C = { x: 180, y: 180 }, R = 140;
  let open = $state(30);
  let bad = $state(false);
  let moved = $state(false);
  $effect(() => { void item.id; open = spec.target === 30 ? 60 : 30; moved = false; bad = false; });
  const rad = (d: number) => (d * Math.PI) / 180;
  const end = (d: number, rr = R * 1.12) => [C.x + Math.cos(rad(spec.from + d)) * rr, C.y - Math.sin(rad(spec.from + d)) * rr];
  const a = $derived(end(0)), b = $derived(end(open));
  let svg: SVGSVGElement | undefined = $state();
  let dragging = false;
  function setOpen(d: number) {
    const s = Math.max(spec.step, Math.min(180, Math.round(d / spec.step) * spec.step));
    if (s !== open) { open = s; moved = true; if (s % 10 === 0) sfx.click(); }
  }
  function at(e: PointerEvent) {
    const r = svg!.getBoundingClientRect(), x = ((e.clientX - r.left) * W) / r.width - C.x, y = ((e.clientY - r.top) * H) / r.height - C.y;
    let d = (Math.atan2(-y, x) * 180) / Math.PI - spec.from;
    d = ((d % 360) + 360) % 360;
    // past the straight line it stays at the nearer end
    if (d > 180) d = d > 270 ? spec.step : 180;
    return d;
  }
  function down(e: PointerEvent) { if (disabled || !svg) return; onfirst(); dragging = true; setOpen(at(e)); (e.currentTarget as Element).setPointerCapture(e.pointerId); }
  function move(e: PointerEvent) { if (dragging) setOpen(at(e)); }
  function up() { dragging = false; }
  function check() {
    if (disabled || !moved) return;
    const ok = onanswer({ kind: 'number', value: open });
    if (ok === false) { bad = true; setTimeout(() => (bad = false), 700); }
  }
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); onfirst(); setOpen(open + spec.step); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); onfirst(); setOpen(open - spec.step); }
    else if (e.key === 'Enter') { e.preventDefault(); check(); }
  }
  const arcD = $derived.by(() => { const n = 24, rr = 34; return `M${C.x},${C.y} ` + Array.from({ length: n + 1 }, (_, j) => { const t = rad(spec.from + (open * j) / n); return `L${C.x + Math.cos(t) * rr},${C.y - Math.sin(t) * rr}`; }).join(' ') + ' Z'; });
  const every = $derived(spec.guide === 'full' ? 10 : 30), tick = $derived(spec.guide === 'thirties' ? 30 : spec.guide === 'tens' ? 10 : 5);
</script>

<svelte:window onkeydown={key} />

<div class="am" class:compact>
  <svg bind:this={svg} viewBox="0 0 {W} {H}" class="pic" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} role="img" aria-label="Make an angle">
    <rect x="0" y="0" width={W} height={H} rx="20" fill="#fffaf0" />
    <ProtractorArt cx={C.x} cy={C.y} r={R} turn={spec.from} both={false} {every} {tick} />
    <path d={arcD} fill={bad ? '#ff8aa5' : '#b9a0ff'} fill-opacity=".45" />
    <line x1={C.x} y1={C.y} x2={a[0]} y2={a[1]} stroke="#5a3d8a" stroke-width="7" stroke-linecap="round" />
    <line x1={C.x} y1={C.y} x2={b[0]} y2={b[1]} stroke="#e6a817" stroke-width="8" stroke-linecap="round" />
    <line x1={C.x} y1={C.y} x2={b[0]} y2={b[1]} stroke="#fff3c4" stroke-width="3" stroke-linecap="round" />
    <circle cx={b[0]} cy={b[1]} r="15" fill="#ffd36b" stroke="#fff" stroke-width="4" class="knob" />
    <circle cx={C.x} cy={C.y} r="6" fill="#5a3d8a" />
    {#if spec.live}<text x={C.x} y={C.y + 36} class="live" text-anchor="middle">{open}°</text>{/if}
  </svg>
  <div class="side">
    <span class="want">Make <b>{spec.target}°</b></span>
    <button class="ok" disabled={disabled || !moved} onpointerdown={(e) => { e.preventDefault(); check(); }} tabindex="-1"><Icon name="check" size={24} /><span>Check</span></button>
  </div>
</div>

<style>
  .am { display: flex; align-items: center; justify-content: center; gap: 16px; width: 100%; flex-wrap: wrap; }
  .pic { width: min(340px, 92vw); height: auto; touch-action: none; cursor: pointer; border-radius: 20px; box-shadow: 0 4px 0 #e6d9c2, 0 6px 16px rgba(80, 50, 10, .12); }
  .knob { filter: drop-shadow(0 0 8px rgba(255, 190, 40, .9)); animation: pulse 1.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes pulse { 50% { transform: scale(1.15); } }
  .live { font: 600 26px var(--font-ui); fill: #5a3d8a; }
  .side { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .want { font: 600 20px var(--font-ui); color: var(--ink2); }
  .want b { font-size: 34px; color: #b7791f; }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 8px 18px 8px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 20px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact { gap: 10px; }
  .compact .pic { width: min(240px, 62vw); }
  .compact .want { font-size: 16px; } .compact .want b { font-size: 26px; }
</style>
