<script lang="ts">
  import Icon from '../../ui/Icon.svelte';
  // The on-screen number pad: one row on a wide screen, a calculator block on a phone. The keyboard's
  // number row and number pad work too; this is for touch and for anyone who'd rather tap.
  // `extra`: a decimal point and a minus key, for decimals and negative numbers (they type '.' and '-')
  type Props = { ondigit: (d: string) => void; onback: () => void; disabled?: boolean; lit?: string | null; compact?: boolean; extra?: ('.' | '-')[] };
  let { ondigit, onback, disabled = false, lit = null, compact = false, extra = [] }: Props = $props();
  const ROW = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const GRID = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0'];
  const keys = $derived(compact ? [...GRID, ...extra] : [...ROW, ...extra, 'back']);
  function press(k: string, e: PointerEvent) {
    e.preventDefault();
    if (disabled) return;
    if (k === 'back') onback(); else ondigit(k);
  }
</script>

<div class="pad" class:compact class:ext={extra.length > 0} class:disabled role="group" aria-label="Number pad" style:--cols={11 + extra.length}>
  {#each keys as k (k)}
    <button class="k" class:back={k === 'back'} class:lit={lit === k} class:zero={compact && k === '0'} class:x={k === '.' || k === '-'} aria-label={k === 'back' ? 'Delete' : k}
      onpointerdown={(e) => press(k, e)} tabindex="-1">
      {#if k === 'back'}<Icon name="erase" size={40} />{:else if k === '-'}−{:else}{k}{/if}
    </button>
  {/each}
</div>

<style>
  .pad { display: grid; grid-template-columns: repeat(var(--cols, 11), minmax(0, 1fr)); gap: 10px; width: min(1000px, 100%); margin: 0 auto; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
  .k { height: clamp(56px, 8.5vh, 76px); border-radius: 18px; border: 3px solid #ece6f6; background: linear-gradient(#fff, #f1ecfb); box-shadow: 0 5px 0 #d9cff0; font: 600 clamp(26px, 4vh, 36px)/1 var(--font-ui); color: var(--ink); cursor: pointer; display: grid; place-items: center; transition: transform .06s, box-shadow .06s, background .15s; -webkit-tap-highlight-color: transparent; }
  .k:active, .k.lit { transform: translateY(4px); box-shadow: 0 1px 0 #d9cff0; background: linear-gradient(#efe9ff, #e2d8ff); }
  .k.back { color: var(--muted); }
  .k.back :global(.ico) { width: 40px; height: 40px; }
  .disabled .k { opacity: .5; cursor: default; }
  .compact { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; width: min(420px, 100%); }
  .compact .k { height: clamp(46px, 7.2vh, 60px); border-radius: 16px; }
  .compact .k.back { order: 10; }
  .compact .k.zero { order: 11; grid-column: span 2; }
  .compact .k.x { order: 12; }
  .compact.ext .k.zero { grid-column: auto; }
</style>
