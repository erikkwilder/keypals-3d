<script lang="ts">
  // A percent bar: a long glass of juice from 0% to 100%, with a tick at every step. Drag across it (or tap,
  // or the arrow keys) and the juice fills to the nearest tick, its percent riding on top. When the bar
  // stands for some fruit (`whole`), the whole is written at its end, and the fruit's picture sits at the
  // start. Check (or Enter) answers with the percent.
  import { onDestroy } from 'svelte';
  import { WRONG_MS } from '../../ui/NumPad.svelte';
  import Icon from '../../../ui/Icon.svelte';
  import type { CustomInputProps } from './SkillInput.svelte';
  import type { Answer } from '../types';
  import type { PctBarSpec } from '../ratios';
  import { FRUIT } from '../ratioPic';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  const base = import.meta.env.BASE_URL;
  const spec = $derived(item.custom!.spec as PctBarSpec);
  const send = (a: Answer) => (onanswer as (a: Answer) => unknown)(a);
  const ticks = $derived(Math.round(100 / spec.step));
  let pct = $state<number | null>(null);
  let bad = $state(false);
  let el: HTMLDivElement | undefined = $state();
  let dragging = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => { void item.id; pct = null; bad = false; clearTimeout(timer); });
  onDestroy(() => clearTimeout(timer));
  function setFromX(x: number) {
    if (!el || disabled) return;
    const r = el.getBoundingClientRect();
    const k = Math.max(0, Math.min(1, (x - r.left) / r.width));
    onfirst();
    bad = false;
    pct = Math.round((k * 100) / spec.step) * spec.step;
  }
  function check() {
    if (pct === null || disabled) return;
    if (send({ kind: 'point', x: pct }) === false) { bad = true; clearTimeout(timer); timer = setTimeout(() => (bad = false), WRONG_MS); }
  }
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); onfirst(); pct = Math.max(0, Math.min(100, (pct ?? 0) + (e.key === 'ArrowRight' ? spec.step : -spec.step))); }
    else if (e.key === 'Enter') { e.preventDefault(); check(); }
  }
  const color = $derived(FRUIT[spec.f].color);
</script>

<svelte:window onkeydown={key} />

<div class="pb" class:compact>
  {#if spec.whole !== null}<img class="who" src="{base}math/ratios/fruit/{spec.f}.webp" alt="" />{/if}
  <div class="wrap">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="bar" class:bad bind:this={el} style:--c={color}
      onpointerdown={(e) => { dragging = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setFromX(e.clientX); }}
      onpointermove={(e) => { if (dragging) setFromX(e.clientX); }} onpointerup={() => (dragging = false)}>
      <span class="fill" style:width="{pct ?? 0}%"><i class="shine"></i></span>
      {#each Array(ticks + 1) as _, i (i)}
        {@const v = i * spec.step}
        <span class="tick" class:ten={v % 10 === 0} class:edge={i === 0 || i === ticks} style:left="{(v / 100) * 100}%">
          {#if spec.labels === 'all' ? v % 10 === 0 : v % 50 === 0}<b>{v}%</b>{/if}
        </span>
      {/each}
      {#if pct !== null}<span class="flag" style:left="clamp(34px, {pct}%, calc(100% - 34px))">{pct}%</span>{/if}
    </div>
    {#if spec.whole !== null}<div class="under"><span>0</span><span>{spec.whole} {FRUIT[spec.f].many}</span></div>{/if}
  </div>
  <button class="ok" disabled={pct === null || disabled} onpointerdown={(e) => { e.preventDefault(); check(); }} tabindex="-1"><Icon name="check" size={28} /><span>Check</span></button>
</div>

<style>
  .pb { display: flex; align-items: center; gap: 14px; width: min(1000px, 100%); margin: 0 auto; }
  .who { width: 54px; height: 54px; object-fit: contain; filter: drop-shadow(0 3px 2px rgba(60, 30, 10, .3)); }
  .wrap { flex: 1; display: flex; flex-direction: column; gap: 4px; padding-top: 30px; }
  .bar { position: relative; height: 64px; border-radius: 22px; background: linear-gradient(#ffffff, #eef4f8); box-shadow: inset 0 0 0 4px #c9a77a, inset 0 6px 12px rgba(80, 50, 20, .12), 0 6px 0 #b88a55; cursor: pointer; touch-action: none; overflow: visible; }
  .fill { position: absolute; left: 4px; top: 4px; bottom: 4px; max-width: calc(100% - 8px); border-radius: 18px; background: linear-gradient(color-mix(in srgb, var(--c) 70%, #fff), var(--c)); transition: width .12s ease-out; overflow: hidden; }
  .shine { position: absolute; left: 0; right: 0; top: 6px; height: 10px; border-radius: 6px; background: rgba(255, 255, 255, .45); }
  .tick { position: absolute; top: 0; height: 18px; width: 3px; margin-left: -1.5px; background: rgba(91, 52, 22, .45); }
  .tick.ten { height: 26px; background: rgba(91, 52, 22, .75); }
  .tick b { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 6px; font: 600 15px var(--font-ui); color: #5b3416; white-space: nowrap; }
  .tick.edge b { opacity: 1; }
  .tick.edge { background: transparent; }
  .flag { position: absolute; top: 50%; transform: translate(-50%, -50%); font: 600 20px var(--font-ui); color: #b4501c; background: #fff; padding: 2px 10px; border-radius: 999px; box-shadow: 0 0 0 3px #f07a3a, var(--shadow-sm); white-space: nowrap; pointer-events: none; }
  .bar.bad { animation: nope .4s ease; box-shadow: inset 0 0 0 4px #ff8aa5, 0 6px 0 #b88a55; }
  @keyframes nope { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
  .under { display: flex; justify-content: space-between; font: 600 16px var(--font-ui); color: var(--muted); padding: 2px 4px 0; }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 10px 18px 10px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 20px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact { flex-wrap: wrap; justify-content: center; }
  .compact .wrap { flex-basis: 100%; }
  .compact .who { display: none; }
  .compact .bar { height: 54px; }
  .compact .tick b { font-size: 13px; }
</style>
