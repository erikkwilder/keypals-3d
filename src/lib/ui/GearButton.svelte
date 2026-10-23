<script lang="ts">
  // The settings gear that sits on every screen and opens the quick settings sheet.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import TileArt from './TileArt.svelte';
  type Props = { size?: number; floating?: boolean };
  let { size = 44, floating = false }: Props = $props();
</script>

<button class="gear" class:floating aria-label="Settings" title="Settings" onclick={() => { sfx.click(); game.openSettings(); }}>
  <TileArt kind="settings" {size} />
</button>

<style>
  .gear { display: grid; place-items: center; padding: 6px; border-radius: 50%; border: 3px solid #ddd0fb; background: #faf7ff; cursor: pointer; box-shadow: 0 4px 0 #ddd0fb; transition: transform .15s; }
  .gear:hover { transform: rotate(40deg) scale(1.06); }
  .gear:active { transform: translateY(3px); box-shadow: 0 1px 0 #ddd0fb; }
  .floating { position: absolute; top: 16px; right: 18px; z-index: 30; }
</style>
