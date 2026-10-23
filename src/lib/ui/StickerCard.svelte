<script lang="ts">
  import type { FriendId, Look } from '../art/cast';
  import { renderSticker } from '../art/stickerArt';
  import type { StickerDef } from '../engine/stickers';
  import { snapshot } from '../three/snapshot';
  type Props = { def: StickerDef; friend: FriendId; look: Look; locked?: boolean; outfit?: string; size?: number; isNew?: boolean; onpick?: () => void; animate?: boolean };
  let { def, friend, look, locked = false, outfit = 'none', size = 124, isNew = false, onpick, animate = true }: Props = $props();
  // the buddy in the sticker's pose, drawn from the 3D model once and kept
  let image = $state<string | null>(null);
  $effect(() => { const k = `${friend}|${def.pose}|${outfit}`; void k; image = null; if (!locked) snapshot(friend, def.pose, outfit).then(u => { image = u; }); });
  const svg = $derived(renderSticker(def, friend, look, { locked, outfit, animate, image }));
</script>

<button class="stk rar-{def.rarity}" class:locked style:--sz="{size}px" onclick={() => onpick?.()} title={locked ? def.desc : def.name}>
  {@html svg}
  {#if isNew}<span class="new">NEW</span>{/if}
</button>

<style>
  .stk { position: relative; width: var(--sz); height: var(--sz); padding: 0; border: 0; background: none; cursor: pointer; transition: transform .18s cubic-bezier(.3, .8, .4, 1.4); }
  .stk :global(svg) { width: 100%; height: 100%; overflow: visible; display: block; }
  .stk:hover { transform: translateY(-4px) rotate(-3deg) scale(1.05); }
  .stk.locked:hover { transform: translateY(-2px); }
  .rar-epic:not(.locked) { filter: drop-shadow(0 0 8px hsl(268 90% 75% / .55)); }
  .rar-legendary:not(.locked) { filter: drop-shadow(0 0 10px hsl(48 100% 65% / .7)); animation: leg 2.4s ease-in-out infinite; }
  @keyframes leg { 50% { filter: drop-shadow(0 0 16px hsl(48 100% 65% / .9)); } }
  .new { position: absolute; top: 2px; right: 2px; background: var(--pink); color: #fff; font: 800 10px var(--font-body); padding: 3px 7px; border-radius: 999px; box-shadow: 0 0 0 2px #fff; animation: pop-in .4s cubic-bezier(.3, .8, .4, 1.6); }
</style>
