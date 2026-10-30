<script lang="ts">
  // The chance line: from Impossible on the left to Certain on the right, with Even chance in the middle and
  // small marks for each equal step. Drag the star (or tap the line) to where the chance is, then Check: it
  // counts when it's close enough (the item says how close). Arrow keys nudge it a step; Enter checks.
  import { sfx } from '../../../audio/sound';
  import Icon from '../../../ui/Icon.svelte';
  import type { CustomInputProps } from '../../skills/ui/SkillInput.svelte';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  const spec = $derived(item.custom?.spec as { den: number; tol: number });
  const W = 520, H = 120, L0 = 40, L1 = W - 40, Y = 56;
  let x = $state(0.5);
  let moved = $state(false);
  let dragging = $state(false);
  let svg: SVGSVGElement | undefined = $state();
  $effect(() => { void item.id; x = 0.5; moved = false; });
  const px = (v: number) => L0 + v * (L1 - L0);

  function at(e: PointerEvent) {
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    x = Math.max(0, Math.min(1, (sx - L0) / (L1 - L0)));
    moved = true;
  }
  function down(e: PointerEvent) { if (disabled) return; e.preventDefault(); onfirst(); dragging = true; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); at(e); sfx.click(); }
  function move(e: PointerEvent) { if (dragging && !disabled) at(e); }
  function up() { dragging = false; }
  function check() { if (!disabled && moved) onanswer({ kind: 'point', x }); }
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey) return;
    const s = 1 / (spec.den || 10);
    if (e.key === 'ArrowRight') { e.preventDefault(); onfirst(); x = Math.min(1, x + s); moved = true; sfx.click(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); onfirst(); x = Math.max(0, x - s); moved = true; sfx.click(); }
    else if (e.key === 'Enter') { e.preventDefault(); check(); }
  }
</script>

<svelte:window onkeydown={key} />

<div class="cl" class:compact>
  <svg bind:this={svg} viewBox="0 0 {W} {H}" class:dragging role="slider" aria-label="How likely" aria-valuenow={Math.round(x * 100)} aria-valuemin={0} aria-valuemax={100} tabindex="-1"
    onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
    <defs>
      <linearGradient id="clg" x1="0" x2="1"><stop offset="0" stop-color="#9aa8c2" /><stop offset=".5" stop-color="#ffd36b" /><stop offset="1" stop-color="#5cc96a" /></linearGradient>
    </defs>
    <rect x={L0} y={Y - 9} width={L1 - L0} height="18" rx="9" fill="url(#clg)" stroke="#7a5a3a" stroke-width="2" />
    {#each Array((spec.den || 10) + 1) as _, i (i)}
      <line x1={px(i / (spec.den || 10))} y1={Y - 13} x2={px(i / (spec.den || 10))} y2={Y + 13} stroke="#7a5a3a" stroke-width={i === 0 || i === spec.den || 2 * i === spec.den ? 3 : 1.5} />
    {/each}
    <text x={L0} y={Y + 38} class="w">Impossible</text>
    <text x={(L0 + L1) / 2} y={Y + 38} class="w mid">Even chance</text>
    <text x={L1} y={Y + 38} class="w end">Certain</text>
    <text x={(L0 + px(0.5)) / 2} y={Y - 22} class="s">unlikely</text>
    <text x={(px(0.5) + L1) / 2} y={Y - 22} class="s">likely</text>
    <g transform="translate({px(x)} {Y})" class="star">
      <path class:idle={!moved} d="M0,-22 L6,-8 L21,-7 L9,3 L13,18 L0,10 L-13,18 L-9,3 L-21,-7 L-6,-8 Z" fill="#ffcf3d" stroke="#c0601a" stroke-width="2.5" stroke-linejoin="round" />
    </g>
    <rect x="0" y="0" width={W} height={H} fill="transparent" />
  </svg>
  <button class="ok" disabled={disabled || !moved} onpointerdown={(e) => { e.preventDefault(); check(); }} tabindex="-1"><Icon name="check" size={26} /><span>Check</span></button>
</div>

<style>
  .cl { display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap; width: 100%; user-select: none; touch-action: none; }
  svg { width: min(560px, 100%); height: auto; cursor: grab; touch-action: none; }
  svg.dragging { cursor: grabbing; }
  .w { font: 600 17px var(--font-ui); fill: #4a2c12; text-anchor: start; }
  .w.mid { text-anchor: middle; }
  .w.end { text-anchor: end; }
  .s { font: 600 13px var(--font-ui); fill: #8a6a4a; text-anchor: middle; }
  .star { filter: drop-shadow(0 3px 3px rgba(80, 40, 0, .35)); }
  .idle { animation: bob 1.2s ease-in-out infinite; }
  @keyframes bob { 50% { transform: translateY(-5px); } }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 10px 18px 10px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 22px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact .ok { font-size: 18px; padding: 8px 14px 8px 10px; }
</style>
