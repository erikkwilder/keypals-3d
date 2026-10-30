<script lang="ts">
  // Find them all: crystal shapes on a tray, tap every one that fits ("every triangle") so it glows, tap
  // again to put it back, then Done. The answer is the shapes picked (math/shapes/skills.ts checks them).
  // Number keys pick by place, Enter is Done.
  import { sfx } from '../../../audio/sound';
  import Icon from '../../../ui/Icon.svelte';
  import type { CustomInputProps } from '../../skills/ui/SkillInput.svelte';
  import type { Fig } from '../fig';
  import ShapePic from './ShapePic.svelte';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  const spec = $derived(item.custom?.spec as { figs: Fig[]; word: string });
  let picked = $state<Set<number>>(new Set());
  $effect(() => { void item.id; picked = new Set(); });
  function flip(i: number) {
    if (disabled) return;
    onfirst();
    const s = new Set(picked);
    if (s.has(i)) { s.delete(i); sfx.click(); } else { s.add(i); sfx.pop(); }
    picked = s;
  }
  function done() { if (!disabled && picked.size) onanswer({ kind: 'choice', id: [...picked].sort((a, b) => a - b).join(',') }); }
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey || e.altKey) return;
    const n = Number(e.key);
    if (n >= 1 && n <= spec.figs.length) { e.preventDefault(); flip(n - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); done(); }
  }
  const cell = $derived(compact ? (spec.figs.length > 6 ? 62 : 72) : spec.figs.length > 6 ? 92 : 108);
</script>

<svelte:window onkeydown={key} />

<div class="pick" class:compact>
  <div class="tray" role="group" aria-label="Shapes to pick">
    {#each spec.figs as f, i (i)}
      <button class="sh" class:on={picked.has(i)} {disabled} onpointerdown={(e) => { e.preventDefault(); flip(i); }} tabindex="-1" aria-pressed={picked.has(i)} aria-label="Shape {i + 1}">
        <ShapePic fig={f} size={cell} />
        {#if !compact}<span class="k">{i + 1}</span>{/if}
        {#if picked.has(i)}<span class="tick"><Icon name="check" size={compact ? 14 : 18} /></span>{/if}
      </button>
    {/each}
  </div>
  <button class="ok" disabled={disabled || !picked.size} onpointerdown={(e) => { e.preventDefault(); done(); }} tabindex="-1"><Icon name="check" size={26} /><span>Done{picked.size ? ` (${picked.size})` : ''}</span></button>
</div>

<style>
  .pick { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; }
  .tray { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; padding: 12px; border-radius: 24px; background: linear-gradient(#f6f0ff, #e9e0fb); box-shadow: inset 0 3px 10px rgba(90, 60, 160, .18), 0 4px 0 #d9cff0; max-width: min(760px, 100%); }
  .sh { position: relative; border: 3px solid transparent; border-radius: 20px; background: rgba(255, 255, 255, .75); padding: 6px; cursor: pointer; transition: transform .12s, border-color .15s, box-shadow .15s, background .15s; -webkit-tap-highlight-color: transparent; }
  .sh:hover:not(:disabled) { transform: translateY(-2px); }
  .sh.on { border-color: #ffc93d; background: #fff8dc; box-shadow: 0 0 0 4px rgba(255, 201, 61, .35), 0 0 22px rgba(255, 190, 40, .75); transform: scale(1.05); }
  .k { position: absolute; top: 4px; left: 8px; font: 700 11px var(--font-body); color: var(--muted); }
  .tick { position: absolute; top: -8px; right: -8px; width: 26px; height: 26px; border-radius: 50%; background: #3fbf7a; color: #fff; display: grid; place-items: center; box-shadow: 0 2px 0 #2f9a60; }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 8px 20px 8px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 20px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact .tray { gap: 6px; padding: 8px; border-radius: 18px; }
  .compact .sh { padding: 3px; border-radius: 14px; }
  .compact .ok { font-size: 18px; padding: 6px 16px 6px 10px; }
  .compact .tick { width: 20px; height: 20px; top: -6px; right: -6px; }
</style>
