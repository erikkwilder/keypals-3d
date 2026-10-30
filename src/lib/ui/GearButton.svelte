<script lang="ts">
  // The settings gear that sits on every screen and opens the quick settings sheet, with the music
  // button beside it (pick your music from anywhere), the compass that opens the menu (go anywhere) and
  // the light bulb for Ideas and help. A screen with no player yet (the title, the player list) has no
  // menu: there's nowhere to go. Each button shows its name on hover (a long press on a touch screen).
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import TileArt from './TileArt.svelte';
  import MusicButton from './MusicButton.svelte';
  import MenuButton from './MenuButton.svelte';
  import HelpButton from './HelpButton.svelte';
  import { tips } from './tips';
  type Props = { size?: number; floating?: boolean; music?: boolean; menu?: boolean };
  let { size = 44, floating = false, music = true, menu = true }: Props = $props();
  const noMenu = new Set(['title', 'players', 'newPlayer']);
</script>

<span class="pair" class:floating use:tips>
  {#if menu && game.profile && !noMenu.has(game.screen)}<MenuButton {size} />{#if game.screen !== 'ideas'}<HelpButton {size} />{/if}{/if}
  {#if music}<MusicButton {size} />{/if}
  <button class="gear" aria-label="Settings" title="Settings" onclick={() => { sfx.click(); game.openSettings(); }}>
    <TileArt kind="settings" {size} />
  </button>
</span>

<style>
  .gear { display: grid; place-items: center; padding: 6px; border-radius: 50%; border: 3px solid #ddd0fb; background: #faf7ff; cursor: pointer; box-shadow: 0 4px 0 #ddd0fb; transition: transform .15s; }
  .gear:hover { transform: rotate(40deg) scale(1.06); }
  .gear:active { transform: translateY(3px); box-shadow: 0 1px 0 #ddd0fb; }
  .pair { display: inline-flex; align-items: center; gap: 8px; flex: none; }
  .floating { position: absolute; top: 16px; right: 18px; z-index: 30; }
  /* phones: four round buttons share the bar with a title, so each is a little smaller */
  @media (max-width: 600px) {
    .pair { gap: 5px; }
    .pair :global(.gear), .pair :global(.mus), .pair :global(.menu), .pair :global(.help) { padding: 3px; border-width: 2px; }
    .pair :global(.gear img), .pair :global(.mus img), .pair :global(.menu img), .pair :global(.help img) { width: 28px !important; height: 28px !important; }
  }
</style>
