<script lang="ts">
  // Two to four big choices to tap (or press 1 to 4). Each can hold numbers, fractions and pictures.
  import type { Choice } from '../types';
  import SkillPrompt from './SkillPrompt.svelte';
  type Props = { choices: Choice[]; disabled?: boolean; compact?: boolean; marked?: { id: string; ok: boolean } | null; onpick: (id: string) => void };
  let { choices, disabled = false, compact = false, marked = null, onpick }: Props = $props();
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey) return;
    const n = Number(e.key);
    if (n >= 1 && n <= choices.length) { e.preventDefault(); onpick(choices[n - 1].id); }
  }
</script>

<svelte:window onkeydown={key} />

<div class="choices" class:compact role="group" aria-label="Choices">
  {#each choices as c, i (c.id)}
    <button class="ch" class:right={marked?.id === c.id && marked.ok} class:wrong={marked?.id === c.id && !marked.ok} {disabled} onpointerdown={(e) => { e.preventDefault(); if (!disabled) onpick(c.id); }} tabindex="-1">
      {#if !compact}<span class="k">{i + 1}</span>{/if}
      <SkillPrompt parts={c.parts} size={compact ? 34 : 46} picSize={compact ? 54 : 74} />
    </button>
  {/each}
</div>

<style>
  .choices { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 12px; width: min(1000px, 100%); margin: 0 auto; touch-action: manipulation; user-select: none; }
  .ch { position: relative; min-height: clamp(84px, 13vh, 130px); border-radius: 22px; border: 3px solid #ece6f6; background: linear-gradient(#fff, #f1ecfb); box-shadow: 0 6px 0 #d9cff0; cursor: pointer; display: grid; place-items: center; padding: 10px; transition: transform .06s, box-shadow .06s; -webkit-tap-highlight-color: transparent; }
  .ch:active { transform: translateY(4px); box-shadow: 0 2px 0 #d9cff0; }
  .ch:disabled { cursor: default; }
  .ch.right { background: linear-gradient(#eafff3, #c9f5dd); border-color: #7fdcaa; box-shadow: 0 6px 0 #6fc795; }
  .ch.wrong { background: linear-gradient(#fff0f3, #ffd6df); border-color: #ff9fb3; box-shadow: 0 6px 0 #f08aa1; }
  .k { position: absolute; top: 8px; left: 10px; width: 24px; height: 24px; border-radius: 8px; background: rgba(120, 90, 190, .1); font: 700 13px/24px var(--font-body); color: var(--muted); text-align: center; }
  .compact { gap: 8px; }
  .compact .ch { min-height: 76px; border-radius: 18px; padding: 6px; }
</style>
