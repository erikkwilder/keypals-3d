<script lang="ts">
  // Make a bar: the bar graph with one bar empty (a dashed outline). Drag it up (or along, when the bars lie
  // down) to the right height: it snaps to whole steps, and the number it reaches shows at its top as you
  // go. Then Check. Arrow keys move it a step too; Enter checks.
  import { sfx } from '../../../audio/sound';
  import Icon from '../../../ui/Icon.svelte';
  import type { CustomInputProps } from '../../skills/ui/SkillInput.svelte';
  import { COLOR, barLayout, type DataPic } from '../pics';
  import DataPic_ from './DataPic.svelte';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  const spec = $derived(item.custom?.spec as { pic: Extract<DataPic, { kind: 'bars' }>; snap: number });
  const g = $derived(spec.pic);
  const L = $derived(barLayout(g));
  const hide = $derived(g.hide ?? 0);
  const col = $derived(COLOR[g.cats[hide]?.color ?? 'blue']);
  let v = $state(0);
  let dragging = $state(false);
  let svg: SVGSVGElement | undefined = $state();
  $effect(() => { void item.id; v = 0; });
  const hpx = $derived(compact ? 220 : 280);
  const wpx = $derived(Math.round((hpx * L.W) / L.H));

  function toValue(e: PointerEvent) {
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * L.W, sy = ((e.clientY - r.top) / r.height) * L.H;
    const raw = L.flip ? ((sx - L.left) / L.len) * g.max : ((L.bottom - sy) / L.len) * g.max;
    const nv = Math.max(0, Math.min(g.max, Math.round(raw / spec.snap) * spec.snap));
    if (nv !== v) { v = nv; sfx.click(); }
  }
  function down(e: PointerEvent) {
    if (disabled) return;
    e.preventDefault();
    onfirst();
    dragging = true;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    toValue(e);
  }
  function move(e: PointerEvent) { if (dragging && !disabled) toValue(e); }
  function up() { dragging = false; }
  function check() { if (!disabled && v > 0) onanswer({ kind: 'number', value: v }); }
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey) return;
    const more = L.flip ? 'ArrowRight' : 'ArrowUp', less = L.flip ? 'ArrowLeft' : 'ArrowDown';
    if (e.key === more) { e.preventDefault(); onfirst(); v = Math.min(g.max, v + spec.snap); sfx.click(); }
    else if (e.key === less) { e.preventDefault(); v = Math.max(0, v - spec.snap); sfx.click(); }
    else if (e.key === 'Enter') { e.preventDefault(); check(); }
  }
</script>

<svelte:window onkeydown={key} />

<div class="bd" class:compact>
  <div class="wrap" style:width="{wpx}px" style:height="{hpx}px">
    <DataPic_ d={g} size={hpx / 1.2} />
    <svg bind:this={svg} class="over" class:dragging viewBox="0 0 {L.W} {L.H}" role="slider" aria-label="Drag the {g.cats[hide]?.name} bar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={g.max} tabindex="-1"
      onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
      {#if L.flip}
        <rect x={L.left} y={L.at(hide) - L.bar / 2} width={Math.max(4, L.size(v))} height={L.bar} rx="6" fill={col.hex} stroke={col.deep} stroke-width="2" class="live" />
        <rect x={L.left + L.size(v) - 9} y={L.at(hide) - L.bar / 2 - 4} width="18" height={L.bar + 8} rx="7" fill="#fff" stroke={col.deep} stroke-width="2.5" class="grip" />
        {#if v > 0}<text x={L.left + L.size(v) + 16} y={L.at(hide) + 6} class="val">{v}</text>{/if}
      {:else}
        <rect x={L.at(hide) - L.bar / 2} y={L.bottom - Math.max(4, L.size(v))} width={L.bar} height={Math.max(4, L.size(v))} rx="6" fill={col.hex} stroke={col.deep} stroke-width="2" class="live" />
        <rect x={L.at(hide) - L.bar / 2 - 4} y={L.bottom - L.size(v) - 9} width={L.bar + 8} height="18" rx="7" fill="#fff" stroke={col.deep} stroke-width="2.5" class="grip" />
        <path d="M{L.at(hide) - 6},{L.bottom - L.size(v) - 1} l6,-5 l6,5" fill="none" stroke={col.deep} stroke-width="2" stroke-linecap="round" />
        {#if v > 0}<text x={L.at(hide)} y={L.bottom - L.size(v) - 16} class="val mid">{v}</text>{/if}
      {/if}
      <!-- the whole graph takes the drag, so a finger anywhere near works -->
      <rect x="0" y="0" width={L.W} height={L.H} fill="transparent" />
    </svg>
  </div>
  <button class="ok" disabled={disabled || v === 0} onpointerdown={(e) => { e.preventDefault(); check(); }} tabindex="-1"><Icon name="check" size={26} /><span>Check</span></button>
</div>

<style>
  .bd { display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap; width: 100%; touch-action: none; user-select: none; }
  .wrap { position: relative; max-width: 100%; }
  .wrap :global(.dp) { width: 100%; height: 100%; }
  .over { position: absolute; inset: 0; width: 100%; height: 100%; cursor: grab; touch-action: none; }
  .over.dragging { cursor: grabbing; }
  .live { transition: none; }
  .grip { filter: drop-shadow(0 2px 2px rgba(0, 0, 0, .25)); }
  .val { font: 700 18px var(--font-ui); fill: #4a2c12; paint-order: stroke; stroke: #fff; stroke-width: 4px; }
  .val.mid { text-anchor: middle; }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 10px 18px 10px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 22px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact .ok { font-size: 18px; padding: 8px 14px 8px 10px; }
</style>
