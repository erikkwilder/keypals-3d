<script lang="ts">
  // The thermometer to drag (the negative numbers' own input, registered as 'thermo'): press or drag up
  // and down on it and the red line follows to the nearest mark (the arrow keys move it a mark at a time),
  // the reading shows on a tag beside it, and Check (or Enter) answers with that temperature.
  import Icon from '../../../ui/Icon.svelte';
  import Thermo from './Thermo.svelte';
  import type { CustomInputProps } from './SkillInput.svelte';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  const spec = $derived(item.custom?.spec as { min: number; max: number; step: number; label: number });
  let at = $state<number | null>(null);
  $effect(() => { void item.id; at = null; });
  const txt = (v: number) => (v < 0 ? `−${-v}` : String(v));
  function set(v: number) { if (disabled) return; onfirst(); at = v; }
  function check() { if (at !== null && !disabled) onanswer({ kind: 'number', value: at }); }
  function key(e: KeyboardEvent) {
    if (disabled) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const v = at ?? 0; set(Math.max(spec.min, Math.min(spec.max, +(v + (e.key === 'ArrowUp' ? spec.step : -spec.step)).toFixed(6)))); }
    if (e.key === 'Enter' && at !== null) { e.preventDefault(); check(); }
  }
</script>

<svelte:window onkeydown={key} />

<div class="ti" class:compact>
  <div class="wrap">
    <Thermo min={spec.min} max={spec.max} {at} step={spec.step} label={spec.label} height={compact ? 230 : 300} onset={set} glow={at === null} />
    <span class="read" class:none={at === null}>{at === null ? 'Drag me' : `${txt(at)}°`}</span>
  </div>
  <button class="ok" disabled={at === null || disabled} onpointerdown={(e) => { e.preventDefault(); check(); }} tabindex="-1"><Icon name="check" size={28} /><span>Check</span></button>
</div>

<style>
  .ti { display: flex; align-items: center; justify-content: center; gap: 22px; width: min(1000px, 100%); margin: 0 auto; }
  .wrap { position: relative; display: flex; align-items: center; gap: 12px; }
  .read { font: 600 30px var(--font-ui); color: #c81e3a; background: #fff; border-radius: 16px; padding: 6px 16px; box-shadow: 0 0 0 3px #ffd0d6, var(--shadow-sm); min-width: 3.4em; text-align: center; }
  .read.none { font-size: 18px; color: var(--muted); box-shadow: 0 0 0 3px #ffe08a, var(--shadow-sm); animation: nudge 1.4s ease-in-out infinite; }
  @keyframes nudge { 50% { transform: translateY(-6px); } }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 10px 18px 10px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 20px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact { gap: 12px; }
  .compact .read { font-size: 24px; }
</style>
