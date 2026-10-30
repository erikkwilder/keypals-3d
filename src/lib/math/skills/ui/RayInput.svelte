<script lang="ts">
  // Show an inequality on the number line: tap (or drag along) the line to put the dot, tap the dot (or
  // Open / Filled) to say whether the number itself counts, pick which way the numbers that work go
  // (Smaller or Bigger), then Check. The keys work too: arrows move the dot, space fills it, < and > pick
  // the way, Enter checks. The answer is a choice id like "ge:4" (x ≥ 4), the item's right choice.
  import { sfx } from '../../../audio/sound';
  import Icon from '../../../ui/Icon.svelte';
  import RayLine from './RayLine.svelte';
  import { rayId, type Ineq, type RaySpec } from '../algebra';
  import type { CustomInputProps } from './SkillInput.svelte';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  const spec = $derived((item.custom?.spec ?? { min: 0, max: 10 }) as RaySpec);
  let at = $state<number | null>(null);
  let closed = $state(false);
  let dir = $state<'left' | 'right' | null>(null);
  $effect(() => { void item.id; at = null; closed = false; dir = null; });
  const ready = $derived(at !== null && dir !== null);
  function put(n: number) { if (disabled) return; onfirst(); if (at !== n) sfx.click(); at = n; }
  function fill(v: boolean) { if (disabled) return; onfirst(); closed = v; sfx.pop(); }
  function way(d: 'left' | 'right') { if (disabled) return; onfirst(); dir = d; sfx.whoosh(); }
  function check() {
    if (disabled || at === null || !dir) return;
    const op: Ineq = dir === 'right' ? (closed ? 'ge' : 'gt') : (closed ? 'le' : 'lt');
    onanswer({ kind: 'choice', id: rayId(op, at) });
  }
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const v = at ?? Math.round((spec.min + spec.max) / 2); put(Math.max(spec.min + 1, Math.min(spec.max - 1, v + (e.key === 'ArrowRight' ? 1 : -1)))); }
    else if (e.key === ' ') { e.preventDefault(); if (at !== null) fill(!closed); }
    else if (e.key === '>' || e.key === '.') { e.preventDefault(); way('right'); }
    else if (e.key === '<' || e.key === ',') { e.preventDefault(); way('left'); }
    else if (e.key === 'Enter') { e.preventDefault(); check(); }
  }
</script>

<svelte:window onkeydown={key} />

<div class="ri" class:compact>
  <div class="line"><RayLine min={spec.min} max={spec.max} {at} {closed} {dir} {compact} ontap={put} ondot={() => fill(!closed)} /></div>
  {#if at === null}<p class="hint">Tap the line to put the dot.</p>{/if}
  <div class="tools">
    <div class="seg" role="group" aria-label="The dot">
      <button class:on={at !== null && !closed} disabled={disabled || at === null} onpointerdown={(e) => { e.preventDefault(); fill(false); }} tabindex="-1"><i class="d open"></i>Open</button>
      <button class:on={at !== null && closed} disabled={disabled || at === null} onpointerdown={(e) => { e.preventDefault(); fill(true); }} tabindex="-1"><i class="d"></i>Filled</button>
    </div>
    <div class="seg" role="group" aria-label="Which way">
      <button class:on={dir === 'left'} disabled={disabled || at === null} onpointerdown={(e) => { e.preventDefault(); way('left'); }} tabindex="-1"><Icon name="left" size={22} />Smaller</button>
      <button class:on={dir === 'right'} disabled={disabled || at === null} onpointerdown={(e) => { e.preventDefault(); way('right'); }} tabindex="-1">Bigger<Icon name="right" size={22} /></button>
    </div>
    <button class="ok" disabled={!ready || disabled} onpointerdown={(e) => { e.preventDefault(); check(); }} tabindex="-1"><Icon name="check" size={26} /><span>Check</span></button>
  </div>
</div>

<style>
  .ri { display: flex; flex-direction: column; align-items: center; gap: 10px; width: min(1000px, 100%); margin: 0 auto; }
  .line { width: 100%; }
  .hint { margin: -2px 0 0; font: 700 15px var(--font-body); color: var(--muted); }
  .tools { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; }
  .seg { display: flex; background: #efe9ff; border-radius: 16px; padding: 4px; gap: 4px; }
  .seg button { display: flex; align-items: center; gap: 6px; border: 0; border-radius: 12px; padding: 8px 14px; background: transparent; font: 600 18px var(--font-ui); color: #4b3a86; cursor: pointer; }
  .seg button.on { background: #fff; color: #6c4fd8; box-shadow: 0 2px 0 #c9b8ff, 0 0 0 2px #a98cff; }
  .seg button:disabled { opacity: .45; cursor: default; }
  .d { width: 16px; height: 16px; border-radius: 50%; background: #6c4fd8; border: 4px solid #6c4fd8; box-sizing: border-box; }
  .d.open { background: #fff; }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 8px 18px 8px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 20px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact .seg button { padding: 7px 10px; font-size: 16px; }
  .compact .tools { gap: 6px; }
</style>
