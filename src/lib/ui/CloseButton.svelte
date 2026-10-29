<script lang="ts">
  // The round close button on cards and sheets: the painted close icon, centred in its circle (a text
  // "×" sat low in the font's line box).
  import TileArt from './TileArt.svelte';
  type Props = { onclick: () => void; label?: string; size?: number };
  let { onclick, label = 'Close', size = 40 }: Props = $props();
</script>

<button class="closebtn" style:--sz="{size}px" {onclick} aria-label={label} title={label}><TileArt kind="close" size={Math.round(size * 0.78)} /></button>

<style>
  .closebtn { flex: none; width: var(--sz); height: var(--sz); padding: 0; border: 0; border-radius: 50%; display: grid; place-items: center; background: var(--bg2); cursor: pointer; transition: transform .15s; }
  .closebtn:hover { transform: scale(1.08); }
  .closebtn :global(img) { display: block; }
</style>
