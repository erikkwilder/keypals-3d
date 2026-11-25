<script lang="ts">
  // Make a line plot: an empty number line (wholes, halves, quarters or eighths). Tap above a length to put
  // a dot there (they stack); tap a stack's top dot to take it back. Then Check: right when every length has
  // as many dots as ribbons of that length. Number keys add a dot over that whole number; Backspace takes
  // the last one back; Enter checks.
  // By keyboard (plotKey, inputKeys.ts): Tab reaches the line plot, then Check. While the plot has focus Left
  // and Right move a ring from mark to mark (Home and End to the ends); Up, Enter or Space put a dot there, as
  // a tap does, and Down takes one back. Elsewhere the keys work as before. A screen reader hears the mark
  // under the ring and how many dots it has.
  import { sfx } from '../../../audio/sound';
  import Icon from '../../../ui/Icon.svelte';
  import type { CustomInputProps } from '../../skills/ui/SkillInput.svelte';
  import { fracText, lineLayout } from '../pics';
  import { buttonKey, plotKey, press } from '../../skills/inputKeys';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  const spec = $derived(item.custom?.spec as { min: number; max: number; den: number; unit?: string });
  const STACK = 6;
  const L = $derived(lineLayout(spec, STACK));
  let counts = $state<number[]>([]);
  // (state, so Check turns on with the first dot: it was a plain list, and the button never heard of it)
  let order = $state<number[]>([]);
  let pop = $state(-1);
  // the keyboard's ring: the mark it's on, and whether it shows (not after a tap, only once a key is used)
  let cur = $state(0);
  let ring = $state(false);
  let plot: SVGSVGElement | undefined = $state();
  const uid = `dt${Math.random().toString(36).slice(2, 8)}`;
  $effect(() => { void item.id; counts = Array.from({ length: (spec.max - spec.min) * spec.den + 1 }, () => 0); order = []; cur = 0; });
  const hpx = $derived(compact ? 190 : 240);
  const wpx = $derived(Math.round((hpx * L.W) / L.H));
  const dotY = (k: number) => L.lineY - 14 - k * L.dot * 2.1;

  function add(t: number) {
    if (disabled || t < 0 || t >= counts.length) return;
    onfirst();
    if (counts[t] >= STACK + 2) return;
    counts[t]++; order.push(t); pop = t; sfx.pop();
  }
  function take(t: number) {
    if (disabled || !counts[t]) return;
    counts[t]--; const i = order.lastIndexOf(t); if (i >= 0) order.splice(i, 1); sfx.click();
  }
  function check() { if (!disabled && order.length) onanswer({ kind: 'choice', id: counts.join(',') }); }
  function key(e: KeyboardEvent) {
    if (disabled || buttonKey(e)) return;
    if (e.target === plot) {
      const k = plotKey(e, cur, counts.length - 1);
      if (k !== null) {
        e.preventDefault(); ring = true;
        if (k === 'add') add(cur); else if (k === 'take') take(cur); else if (k !== 'hold') { onfirst(); cur = k; }
        return;
      }
    }
    if (e.metaKey || e.ctrlKey) return;
    const n = Number(e.key);
    if (/^[0-9]$/.test(e.key) && Number.isInteger(n) && n >= spec.min && n <= spec.max) { e.preventDefault(); add((n - spec.min) * spec.den); }
    else if (e.key === 'Backspace' && order.length) { e.preventDefault(); take(order[order.length - 1]); }
    else if (e.key === 'Enter') { e.preventDefault(); check(); }
  }
  const many = (c: number) => (c === 0 ? 'no dots' : c === 1 ? '1 dot' : `${c} dots`);
</script>

<svelte:window onkeydown={key} />

<div class="dt" class:compact>
  <svg bind:this={plot} viewBox="0 0 {L.W} {L.H}" width={wpx} height={hpx} role="grid" tabindex="0" aria-label="Line plot: tap above a length to add a dot" aria-activedescendant="{uid}-{cur}"
    onfocus={(e) => (ring = (e.currentTarget as Element).matches(':focus-visible'))} onblur={() => (ring = false)}>
    <rect x="1" y="1" width={L.W - 2} height={L.H - 2} rx="14" fill="#fffaf0" stroke="#f0d9b0" stroke-width="2" />
    <line x1={L.left - 14} y1={L.lineY} x2={L.W - L.left + 14} y2={L.lineY} stroke="#5b3416" stroke-width="3" stroke-linecap="round" />
    <g role="row">
      {#each counts as c, t (t)}
        {@const whole = spec.den === 1 || t % spec.den === 0}
        <!-- the column to tap: the whole space over this tick -->
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <rect class="col" x={L.x(t) - L.gap / 2 + 1} y="6" width={L.gap - 2} height={L.lineY - 4} rx="8" onpointerdown={(e) => { e.preventDefault(); add(t); }} role="gridcell" id="{uid}-{t}" aria-label="{fracText(spec.min + t / spec.den, spec.den)}: {many(c)}" />
        <line x1={L.x(t)} y1={L.lineY - (whole ? 8 : 5)} x2={L.x(t)} y2={L.lineY + (whole ? 8 : 5)} stroke="#5b3416" stroke-width={whole ? 3 : 2} pointer-events="none" />
        <text class="tick" class:small={fracText(spec.min + t / spec.den, spec.den).length > 3} x={L.x(t)} y={L.lineY + 28} pointer-events="none" aria-hidden="true">{fracText(spec.min + t / spec.den, spec.den)}</text>
        {#each Array(c) as _, k (k)}
          <!-- (a tap on the top dot takes it back; by keyboard Down does) -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g class="dot" class:new={pop === t && k === c - 1} onpointerdown={(e) => { e.preventDefault(); e.stopPropagation(); if (k === c - 1) take(t); else add(t); }} aria-hidden="true">
            <circle cx={L.x(t)} cy={dotY(k)} r={L.dot} fill="#ff7aa8" stroke="#c23d6c" stroke-width="1.5" />
            <circle cx={L.x(t) - L.dot * 0.3} cy={dotY(k) - L.dot * 0.35} r={L.dot * 0.35} fill="#fff" opacity=".6" />
          </g>
        {/each}
      {/each}
    </g>
    {#if ring}<rect class="cur" x={L.x(cur) - L.gap / 2 + 1} y="6" width={L.gap - 2} height={L.lineY - 4} rx="8" />{/if}
  </svg>
  <button class="ok" disabled={disabled || !order.length} {...press(check)}><Icon name="check" size={26} /><span>Check</span></button>
</div>

<style>
  .dt { display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap; width: 100%; user-select: none; touch-action: manipulation; }
  svg { max-width: 100%; height: auto; }
  .col { fill: transparent; cursor: pointer; }
  .col:hover { fill: rgba(255, 180, 77, .14); }
  .cur { fill: none; stroke: var(--primary-edge); stroke-width: 3; pointer-events: none; }
  .dot { cursor: pointer; }
  .dot.new { animation: plop .25s cubic-bezier(.3, 1.6, .5, 1); transform-box: fill-box; transform-origin: center; }
  @keyframes plop { from { transform: translateY(-18px) scale(1.3); opacity: .3; } }
  .tick { font: 600 14px var(--font-ui); fill: #4a2c12; text-anchor: middle; }
  .tick.small { font-size: 11.5px; }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 10px 18px 10px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 22px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact .ok { font-size: 18px; padding: 8px 14px 8px 10px; }
</style>
