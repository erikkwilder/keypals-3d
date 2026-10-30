<script lang="ts">
  // Ideas and help: the light bulb beside the compass on every screen. It opens Ideas and help (suggest a
  // game, vote on ideas, tell us about a problem), and Back comes back to where you were.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  type Props = { size?: number };
  let { size = 44 }: Props = $props();
  function open(e: MouseEvent) { (e.currentTarget as HTMLElement).blur(); sfx.click(); game.openIdeas(); }
</script>

<button class="help" aria-label="Ideas and help" title="Ideas and help" onclick={open}>
  <img src="{import.meta.env.BASE_URL}icons/bulb.webp" width={size} height={size} alt="" draggable="false" />
</button>

<style>
  .help { display: grid; place-items: center; padding: 6px; border-radius: 50%; border: 3px solid #ffe7a1; background: #fffbea; cursor: pointer; box-shadow: 0 4px 0 #ffe7a1; transition: transform .15s; flex: none; }
  .help:hover { transform: rotate(10deg) scale(1.06); }
  .help:active { transform: translateY(3px); box-shadow: 0 1px 0 #ffe7a1; }
  .help img { display: block; object-fit: contain; user-select: none; }
</style>
