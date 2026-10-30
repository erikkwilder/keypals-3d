<script lang="ts">
  // A number line on a painted wooden plank: drag the marker (or tap the line, or use the arrow keys) and
  // it snaps to the nearest tick; Check (or Enter) answers. Ticks can be labelled as fractions.
  import Icon from '../../../ui/Icon.svelte';
  import type { LineSpec } from '../types';
  type Props = { line: LineSpec; disabled?: boolean; compact?: boolean; onanswer: (x: number) => void; onfirst?: () => void };
  let { line, disabled = false, compact = false, onanswer, onfirst }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const ticks = $derived(Math.round((line.max - line.min) / line.step));
  let at = $state<number | null>(null);
  let el: HTMLDivElement | undefined = $state();
  const frac = (k: number) => (k - line.min) / (line.max - line.min);
  const label = (v: number) => {
    if (!line.denom) return String(Math.round(v * 1000) / 1000).replace('-', '−');
    const n = Math.round(v * line.denom);
    return n % line.denom === 0 ? String(n / line.denom) : `${n}/${line.denom}`;
  };
  function setFromX(clientX: number) {
    if (!el || disabled) return;
    const r = el.getBoundingClientRect();
    const k = Math.max(0, Math.min(1, (clientX - r.left - 24) / (r.width - 48)));
    onfirst?.();
    at = line.min + Math.round(k * ticks) * line.step;
  }
  let dragging = false;
  function key(e: KeyboardEvent) {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); onfirst?.(); const v = at ?? line.min; at = Math.max(line.min, Math.min(line.max, v + (e.key === 'ArrowRight' ? 1 : -1) * line.step)); }
    if (e.key === 'Enter' && at !== null) { e.preventDefault(); onanswer(at); }
  }
</script>

<svelte:window onkeydown={key} />

<div class="nl" class:compact>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="track" bind:this={el} style:background-image="url({base}learn/plank.webp)"
    onpointerdown={(e) => { dragging = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setFromX(e.clientX); }}
    onpointermove={(e) => { if (dragging) setFromX(e.clientX); }} onpointerup={() => (dragging = false)}>
    {#each Array(ticks + 1) as _, i}
      {@const v = line.min + i * line.step}
      <span class="tick" class:big={i === 0 || i === ticks} style:left="calc(24px + (100% - 48px) * {frac(v)})">
        {#if line.labels === 'all' || i === 0 || i === ticks}<b>{label(v)}</b>{/if}
      </span>
    {/each}
    {#if at !== null}<span class="pin" style:left="calc(24px + (100% - 48px) * {frac(at)})"><span class="flag">{label(at)}</span></span>{/if}
  </div>
  <button class="ok" disabled={at === null || disabled} onpointerdown={(e) => { e.preventDefault(); if (at !== null && !disabled) onanswer(at); }} tabindex="-1"><Icon name="check" size={28} /><span>Check</span></button>
</div>

<style>
  .nl { display: flex; align-items: center; gap: 14px; width: min(1000px, 100%); margin: 0 auto; }
  .track { position: relative; flex: 1; height: 96px; border-radius: 18px; background-size: 100% 100%; cursor: pointer; touch-action: none; box-shadow: 0 6px 0 #c9a77a; }
  .tick { position: absolute; top: 18px; width: 4px; height: 26px; margin-left: -2px; border-radius: 2px; background: #5b3416; }
  .tick.big { height: 36px; top: 13px; }
  .tick b { position: absolute; top: 40px; left: 50%; transform: translateX(-50%); font: 600 18px var(--font-ui); color: #5b3416; white-space: nowrap; }
  .pin { position: absolute; top: -14px; width: 0; height: 0; }
  .pin::before { content: ''; position: absolute; left: -11px; top: 20px; width: 22px; height: 22px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: linear-gradient(#ffd166, #f2a63a); box-shadow: 0 0 0 3px #fff, 0 4px 8px rgba(0, 0, 0, .25); }
  .flag { position: absolute; left: 50%; top: -18px; transform: translateX(-50%); font: 600 18px var(--font-ui); background: #fff; padding: 2px 10px; border-radius: 99px; box-shadow: var(--shadow-sm); white-space: nowrap; }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 10px 18px 10px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 20px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact { flex-direction: column; }
  /* (in a column the plank keeps its own height: flex: 1 would squash it to nothing under the Check button) */
  .compact .track { flex: none; width: 100%; height: 84px; }
</style>
