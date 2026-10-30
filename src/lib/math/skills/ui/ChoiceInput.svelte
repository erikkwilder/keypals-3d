<script lang="ts">
  // Two to four big choices to tap or click. Each can hold numbers, fractions and pictures. The keyboard
  // doesn't pick them (its number keys type answers): choices of numbers or fractions keep the pad under
  // them, so the answer can be typed instead (SkillInput).
  import type { Choice } from '../types';
  import SkillPrompt from './SkillPrompt.svelte';
  /** `slim`: a pad sits under them, so they give it some room */
  type Props = { choices: Choice[]; disabled?: boolean; compact?: boolean; slim?: boolean; marked?: { id: string; ok: boolean } | null; onpick: (id: string) => void };
  let { choices, disabled = false, compact = false, slim = false, marked = null, onpick }: Props = $props();
</script>

<div class="choices" class:compact class:slim class:four={choices.length === 4} role="group" aria-label="Choices">
  {#each choices as c (c.id)}
    <button class="ch" class:right={marked?.id === c.id && marked.ok} class:wrong={marked?.id === c.id && !marked.ok} {disabled} onpointerdown={(e) => { e.preventDefault(); if (!disabled) onpick(c.id); }} tabindex="-1">
      <SkillPrompt parts={c.parts} size={compact ? (slim ? 28 : 34) : 46} picSize={compact ? 54 : 74} />
    </button>
  {/each}
</div>

<style>
  .choices { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 12px; width: min(1000px, 100%); margin: 0 auto; touch-action: manipulation; user-select: none; }
  .ch { position: relative; min-height: clamp(84px, 13vh, 130px); border-radius: 22px; border: 3px solid #ece6f6; background: linear-gradient(#fff, #f1ecfb); box-shadow: 0 6px 0 #d9cff0; cursor: pointer; display: grid; place-items: center; padding: 10px; transition: transform .06s, box-shadow .06s, border-color .15s; -webkit-tap-highlight-color: transparent; }
  .ch:hover:not(:disabled) { border-color: #c9b8ff; }
  .ch:active { transform: translateY(4px); box-shadow: 0 2px 0 #d9cff0; }
  .ch:disabled { cursor: default; }
  .ch.right { background: linear-gradient(#eafff3, #c9f5dd); border-color: #7fdcaa; box-shadow: 0 6px 0 #6fc795; }
  .ch.wrong { background: linear-gradient(#fff0f3, #ffd6df); border-color: #ff9fb3; box-shadow: 0 6px 0 #f08aa1; animation: nope .4s ease; }
  @keyframes nope { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
  .slim .ch { min-height: clamp(70px, 10vh, 104px); padding: 6px; }
  .compact { gap: 8px; }
  .compact .ch { min-height: 64px; border-radius: 18px; padding: 6px; }
  /* four on a phone: two by two, so each stays big enough to tap */
  .compact.four { grid-auto-flow: row; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  /* numbers and fractions over a pad, on a phone: one row (a long number wraps to two) */
  .compact.slim { display: flex; flex-wrap: wrap; }
  .compact.slim .ch { flex: 1 1 64px; min-width: max-content; min-height: 54px; padding: 4px 8px; }
</style>
