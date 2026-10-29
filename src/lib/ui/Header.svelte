<script lang="ts">
  import type { Snippet } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import Icon from './Icon.svelte';
  import GearButton from './GearButton.svelte';
  type Props = { title: string; back?: () => void; right?: Snippet; sub?: string; gear?: boolean; overlay?: boolean };
  let { title, back = () => game.go(game.home), right, sub, gear = true, overlay = false }: Props = $props();
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && (overlay ? !game.sheet : !game.modalOpen) && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) back(); }} />

<header class="hd">
  <button class="btn btn-icon" aria-label="Back" onclick={() => { sfx.click(); back(); }}><Icon name="back" /></button>
  <div class="tt"><h1>{title}</h1>{#if sub}<span class="muted" class:long={sub.length > 26}>{sub}</span>{/if}</div>
  {#if right}<div class="rt">{@render right()}</div>{/if}
  {#if gear}<div class="gb"><GearButton size={36} /></div>{/if}
</header>

<style>
  .hd { display: flex; align-items: center; gap: 14px; padding: 14px 20px; background: rgba(255, 255, 255, .9); border-bottom: var(--panel-border); position: relative; z-index: 3; }
  .tt { display: flex; align-items: baseline; gap: 12px; flex: 1; min-width: 0; }
  h1 { font-size: 30px; }
  .tt span { font: 700 15px var(--font-body); }
  .rt, .gb { display: flex; gap: 10px; align-items: center; }
  .rt + .gb { margin-left: -4px; }
  /* phones: the title keeps room for a word or two, the menu, music and gear buttons stay on its row,
     and a screen's own chips or tabs drop to a second row when they don't fit beside them */
  @media (max-width: 600px) {
    .hd { flex-wrap: wrap; row-gap: 6px; gap: 10px; padding: 12px 12px; }
    .tt { min-width: 110px; flex-wrap: wrap; column-gap: 8px; row-gap: 0; }
    h1 { font-size: 22px; }
    .gb { order: 1; } .rt + .gb { margin-left: 0; }
    .rt { order: 2; margin-left: auto; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    /* a sentence-long note squeezed beside the buttons became a tall column; the short counts stay */
    .tt span.long { display: none; }
  }
  @media (max-width: 380px) { .hd { gap: 8px; padding: 10px 8px; } .tt { min-width: 100px; } h1 { font-size: 20px; } .gb :global(.pair) { gap: 4px; } }
</style>
