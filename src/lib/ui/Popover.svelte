<script lang="ts">
  // A small card that opens from a button (your shells in the top bar, today's minutes, the shells on a
  // results screen): just under the button on a computer (above it when the button is low on the screen),
  // across the top of the screen on a phone. A tap outside it or Escape closes it.
  import type { Snippet } from 'svelte';
  import { onDestroy, onMount } from 'svelte';
  import { sfx } from '../audio/sound';
  import CloseButton from './CloseButton.svelte';

  type Props = { anchor: HTMLElement | null; label: string; onclose: () => void; children: Snippet; width?: number };
  let { anchor, label, onclose, children, width = 380 }: Props = $props();
  let at = $state<{ x: number; y: number; arrow: number; up: boolean } | null>(null);
  let phone = $state(innerWidth < 760);
  function place() {
    phone = innerWidth < 760;
    const r = anchor?.getBoundingClientRect();
    if (!r || phone) { at = null; return; }
    const w = Math.min(width, innerWidth - 24);
    const x = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2));
    // (`y` is from the top, or, opening upwards, from the bottom of the window)
    const up = innerHeight - r.bottom < 420 && r.top > innerHeight - r.bottom;
    at = { x, y: up ? innerHeight - r.top + 12 : r.bottom + 12, arrow: r.left + r.width / 2 - x, up };
  }
  function close() { sfx.click(); onclose(); }
  function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } }
  onMount(() => { place(); sfx.pop(); addEventListener('resize', place); addEventListener('keydown', onKey, true); });
  onDestroy(() => { removeEventListener('resize', place); removeEventListener('keydown', onKey, true); });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="pbg" class:phone onclick={close}>
  <div class="pop" class:phone class:up={at?.up} role="dialog" aria-modal="true" aria-label={label} tabindex="-1"
    style:left={at ? `${at.x}px` : null} style:top={at && !at.up ? `${at.y}px` : null} style:bottom={at?.up ? `${at.y}px` : null} style:width={at ? `${Math.min(width, innerWidth - 24)}px` : null} style:--ax={at ? `${at.arrow}px` : '50%'}
    onclick={(e) => e.stopPropagation()}>
    <span class="x"><CloseButton onclick={close} label="Close" size={34} /></span>
    {@render children()}
  </div>
</div>

<style>
  .pbg { position: fixed; inset: 0; z-index: 75; }
  .pbg.phone { background: rgba(36, 24, 70, .4); }
  .pop { position: fixed; max-height: calc(100dvh - 100px); overflow: auto; overscroll-behavior: contain; padding: 14px 16px 16px; border-radius: 24px; background: #fff;
    box-shadow: 0 0 0 3px #ffe3a0, 0 24px 50px -20px rgba(30, 10, 70, .55); animation: drop .2s cubic-bezier(.3, .8, .4, 1.3); }
  .pop::before { content: ''; position: absolute; top: -9px; left: calc(var(--ax) - 9px); width: 18px; height: 18px; background: #fff; transform: rotate(45deg); box-shadow: -3px -3px 0 0 #ffe3a0; border-radius: 3px; }
  .pop.up::before { top: auto; bottom: -9px; box-shadow: 3px 3px 0 0 #ffe3a0; }
  .pop.phone { left: 10px; right: 10px; top: 12px; max-height: calc(100dvh - 24px); }
  .pop.phone::before { display: none; }
  .x { position: absolute; top: 8px; right: 8px; z-index: 1; }
  @keyframes drop { from { transform: translateY(-8px); opacity: 0; } }
</style>
