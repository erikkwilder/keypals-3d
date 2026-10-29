<script lang="ts">
  // The compass: opens the menu that goes anywhere in the game (and shows everything you've earned). It
  // sits with the music button and the settings gear on every screen that has a player.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  type Props = { size?: number; plain?: boolean };
  let { size = 44, plain = false }: Props = $props();
  function open(e: MouseEvent) { (e.currentTarget as HTMLElement).blur(); sfx.click(); game.openMenu(); }
</script>

{#if game.profile}
  <button class="menu" class:plain aria-label="Menu: go anywhere" title="Menu: go anywhere" onclick={open}>
    <img src="{import.meta.env.BASE_URL}icons/menu.webp" width={size} height={size} alt="" draggable="false" />
  </button>
{/if}

<style>
  .menu { display: grid; place-items: center; padding: 6px; border-radius: 50%; border: 3px solid #cfe9d8; background: #f4fff8; cursor: pointer; box-shadow: 0 4px 0 #cfe9d8; transition: transform .15s; flex: none; }
  .menu:hover { transform: rotate(-12deg) scale(1.06); }
  .menu:active { transform: translateY(3px); box-shadow: 0 1px 0 #cfe9d8; }
  .menu img { display: block; object-fit: contain; user-select: none; }
  .plain { padding: 4px; box-shadow: none; border-width: 2px; background: rgba(255, 255, 255, .92); }
</style>
