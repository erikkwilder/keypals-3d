<script lang="ts">
  // Make a length: a satin ribbon lies on a wooden ruler from its start (0, or another mark), and you pull
  // its end along to the length asked for. It snaps to whole units (or halves). Arrow keys move it too.
  // Then Done.
  import { sfx } from '../../../audio/sound';
  import { mSfx } from '../../measure/sounds';
  import Icon from '../../../ui/Icon.svelte';
  import type { CustomInputProps } from './SkillInput.svelte';
  import type { RulerSpec } from '../measure';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  const base = import.meta.env.BASE_URL;
  const spec = $derived((item.custom?.spec ?? { unit: 'cm', len: 10, start: 0, snap: 1, thing: 'pencil' }) as RulerSpec);
  let end = $state(1);
  let held = $state(false);
  let moved = $state(false);
  $effect(() => { void item.id; end = spec.start + 1; held = false; moved = false; });
  let w = $state(600);
  const W = $derived(Math.max(280, Math.min(compact ? 360 : 680, w)));
  const pad = 22;
  const u = $derived((W - pad - 50) / spec.len);
  const RH = $derived(Math.max(50, u * 1.3));
  const top = 58;
  let svg: SVGSVGElement | undefined = $state();
  const x = (v: number) => pad + v * u;
  function at(e: PointerEvent) {
    const r = svg!.getBoundingClientRect();
    const v = (((e.clientX - r.left) / r.width) * W - pad) / u;
    return Math.max(spec.start + spec.snap, Math.min(spec.len, Math.round(v / spec.snap) * spec.snap));
  }
  function down(e: PointerEvent) { if (disabled || !svg) return; e.preventDefault(); held = true; (e.currentTarget as Element).setPointerCapture(e.pointerId); onfirst(); move(e); }
  function move(e: PointerEvent) { if (!held || disabled) return; const v = at(e); if (v !== end) { end = v; moved = true; mSfx.tick(); } }
  function up() { held = false; }
  function done() { if (!disabled && moved) { sfx.click(); onanswer({ kind: 'number', value: end }); } }
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault(); onfirst();
      const v = Math.max(spec.start + spec.snap, Math.min(spec.len, end + (e.key === 'ArrowRight' ? spec.snap : -spec.snap)));
      if (v !== end) { end = v; moved = true; mSfx.tick(); }
    } else if (e.key === 'Enter') { e.preventDefault(); done(); }
  }
</script>

<svelte:window onkeydown={key} />

<div class="ri" class:compact bind:clientWidth={w}>
  <svg bind:this={svg} viewBox="0 0 {W} {top + RH + 6}" width={W} height={top + RH + 6} role="slider" aria-label="Ribbon end" aria-valuenow={end} tabindex="-1" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} class:held>
    <defs>
      <pattern id="rw" patternUnits="userSpaceOnUse" width="700" height="69"><image href="{base}learn/plank.webp" width="1400" height="137" x="-300" y="-30" /></pattern>
      <linearGradient id="rb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9cc2" /><stop offset=".45" stop-color="#ff5d98" /><stop offset="1" stop-color="#d6336f" /></linearGradient>
    </defs>
    <!-- the ribbon, from its start to the end you pull -->
    <rect x={x(spec.start)} y={top - 34} width={Math.max(2, x(end) - x(spec.start))} height="24" rx="5" fill="url(#rb)" stroke="#b02560" stroke-width="2" />
    <rect x={x(spec.start) + 3} y={top - 30} width={Math.max(0, x(end) - x(spec.start) - 6)} height="5" rx="2.5" fill="#fff" opacity=".45" />
    <line x1={x(spec.start)} x2={x(spec.start)} y1={top - 40} y2={top + 6} stroke="#ff5a7a" stroke-width="2.5" stroke-dasharray="4 4" />
    <line x1={x(end)} x2={x(end)} y1={top - 40} y2={top + 6} stroke="#b02560" stroke-width="2.5" />
    <g transform="translate({x(end)}, {top - 22})"><g class="knob">
      <circle r="17" fill="#fff" stroke="#b02560" stroke-width="4" />
      <circle r="7" fill="#ff5d98" />
    </g></g>
    <rect x="2" y={top} width={W - 4} height={RH} rx="8" fill="url(#rw)" stroke="#a8763c" stroke-width="3" />
    <rect x="2" y={top} width={W - 4} height={RH} rx="8" fill="#ffe7b0" opacity=".35" />
    {#each Array(spec.len * (spec.snap < 1 ? 2 : 1) + 1) as _, i (i)}
      {@const v = spec.snap < 1 ? i / 2 : i}
      {@const whole = Number.isInteger(v)}
      <line x1={x(v)} x2={x(v)} y1={top} y2={top + (whole ? RH * 0.36 : RH * 0.2)} stroke="#4a2e10" stroke-width={whole ? 2.4 : 1.6} />
      {#if whole}<text x={x(v)} y={top + RH - 9} text-anchor="middle" class="rn" style:font-size="{Math.min(20, Math.max(12, u * 0.6))}px">{v}</text>{/if}
    {/each}
    <text x={W - 10} y={top + RH - 10} text-anchor="end" class="ru">{spec.unit === 'cm' ? 'cm' : 'in'}</text>
  </svg>
  <button class="ok" disabled={disabled || !moved} onpointerdown={(e) => { e.preventDefault(); done(); }} tabindex="-1"><Icon name="check" size={28} /><span>Done</span></button>
</div>

<style>
  .ri { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; touch-action: none; user-select: none; }
  svg { display: block; cursor: ew-resize; touch-action: none; filter: drop-shadow(0 8px 10px rgba(60, 40, 10, .2)); overflow: visible; }
  .knob { filter: drop-shadow(0 3px 3px rgba(120, 20, 60, .35)); animation: bob 1.2s ease-in-out infinite; }
  .held .knob { animation: none; }
  @keyframes bob { 50% { transform: translateY(-3px); } }
  .rn { font-family: var(--font-ui); font-weight: 600; fill: #3a220a; pointer-events: none; }
  .ru { font: 700 16px var(--font-body); fill: #6b4318; }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 10px 20px 10px 14px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 22px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact .ok { font-size: 19px; padding: 8px 14px 8px 10px; }
</style>
