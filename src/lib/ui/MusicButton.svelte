<script lang="ts">
  // The music button: opens the music picker from any screen (next to the settings gear, and in the
  // lesson, trip and battle bars). It never takes the keyboard: typing goes on straight after.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import TileArt from './TileArt.svelte';
  type Props = { size?: number; plain?: boolean };
  let { size = 44, plain = false }: Props = $props();
  function open(e: MouseEvent) { (e.currentTarget as HTMLElement).blur(); sfx.click(); game.openMusic(); }
</script>

<button class="mus" class:plain aria-label="Pick your music" title="Pick your music" onclick={open}>
  <TileArt kind="music" {size} />
</button>

<style>
  .mus { display: grid; place-items: center; padding: 6px; border-radius: 50%; border: 3px solid #ffd9ec; background: #fff7fb; cursor: pointer; box-shadow: 0 4px 0 #ffd9ec; transition: transform .15s; }
  .mus:hover { transform: rotate(-8deg) scale(1.06); }
  .mus:active { transform: translateY(3px); box-shadow: 0 1px 0 #ffd9ec; }
  .plain { padding: 4px; box-shadow: none; border-width: 2px; background: rgba(255, 255, 255, .92); }
  .mus :global(img) { display: block; }
</style>
