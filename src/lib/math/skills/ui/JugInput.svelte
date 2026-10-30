<script lang="ts">
  // Pour to a mark: drag up and down on the glass jug and the water follows your finger, snapping to the
  // jug's marks (or tap the pour and tip buttons, or use the arrow keys). A jug that already has some
  // water in it ("pour in 300 mL more") starts there and can't go below it. Then Done.
  import { sfx } from '../../../audio/sound';
  import { mSfx } from '../../measure/sounds';
  import Icon from '../../../ui/Icon.svelte';
  import MeasurePic from './MeasurePic.svelte';
  import type { CustomInputProps } from './SkillInput.svelte';
  import type { JugSpec } from '../measure';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  const spec = $derived((item.custom?.spec ?? { max: 1000, step: 100, label: 200, unit: 'mL', start: 0 }) as JugSpec);
  let level = $state(0);
  let held = $state(false), moved = $state(false);
  $effect(() => { void item.id; level = spec.start; held = false; moved = false; });
  const size = $derived(compact ? 190 : 250);
  let box: HTMLDivElement | undefined = $state();
  // (the jug picture: 512 x 466, its water from y 398 at empty up to y 82 when full: MeasurePic)
  function at(e: PointerEvent) {
    const r = box!.getBoundingClientRect();
    const vy = ((e.clientY - r.top) / r.height) * 466;
    const v = ((398 - vy) / (398 - 82)) * spec.max;
    return Math.max(spec.start, Math.min(spec.max, Math.round(v / spec.step) * spec.step));
  }
  function setTo(v: number) { if (v !== level) { if (v > level) mSfx.pour(true); else mSfx.tick(); level = v; moved = true; } }
  function down(e: PointerEvent) { if (disabled || !box) return; e.preventDefault(); held = true; (e.currentTarget as Element).setPointerCapture(e.pointerId); onfirst(); setTo(at(e)); }
  function move(e: PointerEvent) { if (held && !disabled) setTo(at(e)); }
  function up() { held = false; }
  function nudge(k: number) { if (disabled) return; onfirst(); setTo(Math.max(spec.start, Math.min(spec.max, level + k * spec.step))); }
  function done() { if (!disabled && moved) { sfx.click(); onanswer({ kind: 'number', value: level }); } }
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); nudge(1); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); nudge(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); done(); }
  }
</script>

<svelte:window onkeydown={key} />

<div class="ji" class:compact>
  <div class="jug" class:held bind:this={box} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} role="slider" aria-label="Water in the jug" aria-valuenow={level} tabindex="-1">
    <MeasurePic m={{ kind: 'jug', max: spec.max, step: spec.step, label: spec.label, value: level, unit: spec.unit }} {size} />
    {#if !moved && !disabled}<span class="hint">Drag the water up</span>{/if}
  </div>
  <div class="side">
    <button class="b" disabled={disabled || level >= spec.max} onpointerdown={(e) => { e.preventDefault(); nudge(1); }} tabindex="-1" aria-label="Pour more">+ {spec.step} {spec.unit}</button>
    <button class="b" disabled={disabled || level <= spec.start} onpointerdown={(e) => { e.preventDefault(); nudge(-1); }} tabindex="-1" aria-label="Pour some out">− {spec.step} {spec.unit}</button>
    <button class="ok" disabled={disabled || !moved} onpointerdown={(e) => { e.preventDefault(); done(); }} tabindex="-1"><Icon name="check" size={28} /><span>Done</span></button>
  </div>
</div>

<style>
  .ji { display: flex; align-items: center; justify-content: center; gap: 20px; width: 100%; user-select: none; }
  .jug { position: relative; cursor: ns-resize; touch-action: none; }
  .jug.held { cursor: grabbing; }
  .hint { position: absolute; left: 50%; bottom: 18%; translate: -50% 0; white-space: nowrap; font: 700 14px var(--font-body); color: #fff; background: rgba(33, 80, 125, .85); padding: 4px 10px; border-radius: 999px; pointer-events: none; animation: up 1.4s ease-in-out infinite; }
  @keyframes up { 50% { transform: translateY(-10px); } }
  .side { display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
  .b { border: 0; border-radius: 14px; padding: 8px 14px; background: #e8f4ff; box-shadow: inset 0 0 0 3px #9fd0ff, 0 3px 0 #9fc4e8; font: 600 18px var(--font-ui); color: #1b4a78; cursor: pointer; }
  .b:disabled { opacity: .5; cursor: default; }
  .ok { display: flex; align-items: center; justify-content: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 10px 20px 10px 14px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 22px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact { gap: 12px; }
  .compact .b { font-size: 15px; padding: 6px 10px; }
  .compact .ok { font-size: 19px; padding: 8px 14px 8px 10px; }
</style>
