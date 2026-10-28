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
  <div class="tt"><h1>{title}</h1>{#if sub}<span class="muted">{sub}</span>{/if}</div>
  <div class="rt">{@render right?.()}{#if gear}<GearButton size={36} />{/if}</div>
</header>

<style>
  .hd { display: flex; align-items: center; gap: 14px; padding: 14px 20px; background: rgba(255, 255, 255, .9); border-bottom: var(--panel-border); position: relative; z-index: 3; }
  .tt { display: flex; align-items: baseline; gap: 12px; flex: 1; min-width: 0; }
  h1 { font-size: 30px; }
  .tt span { font: 700 15px var(--font-body); }
  .rt { display: flex; gap: 10px; align-items: center; }
  @media (max-width: 600px) { .hd { flex-wrap: wrap; row-gap: 6px; } .rt { margin-left: auto; } h1 { font-size: 24px; } }
</style>
