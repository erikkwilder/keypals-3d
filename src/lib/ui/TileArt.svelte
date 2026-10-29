<script lang="ts" module>
  export type ArtKind = 'play' | 'redo' | 'map' | 'settings' | 'stickers' | 'medals' | 'coach' | 'sfx' | 'music' | 'demo' | 'players' | 'close' | 'chart' | 'dances' | 'outfits' | 'home' | 'garden';
</script>

<script lang="ts">
  // Little pictures for the big buttons, so kids can tell what a button does without reading. All of them
  // are painted, in the same style as the Adventure art, so every button in the game looks like one set.
  import { gameIconUrl, iconUrl } from '../art/icons';
  type Props = { kind: ArtKind; size?: number; off?: boolean };
  let { kind, size = 64, off = false }: Props = $props();
  const HOME_SET: Partial<Record<ArtKind, string>> = { home: 'home', dances: 'dances', stickers: 'stickers', medals: 'medals', settings: 'settings' };
  const src = $derived(HOME_SET[kind] ? gameIconUrl(HOME_SET[kind]!) : iconUrl(kind));
</script>

{#if off}
  <!-- switched off (a setting): faded, with the little red "off" badge in the corner -->
  <span class="art offw" style:width="{size}px" style:height="{size}px" aria-hidden="true">
    <img class="off" {src} width={size} height={size} alt="" draggable="false" />
    <img class="x" src={iconUrl('close')} alt="" draggable="false" />
  </span>
{:else}
  <img class="art" {src} width={size} height={size} alt="" aria-hidden="true" draggable="false" />
{/if}

<style>
  .art { display: block; object-fit: contain; user-select: none; transition: transform .2s cubic-bezier(.3, .8, .4, 1.5), filter .2s; }
  .offw { position: relative; }
  .offw img { display: block; user-select: none; }
  .off { filter: grayscale(.9) opacity(.5); }
  .x { position: absolute; right: -4%; bottom: -4%; width: 42%; height: 42%; }
</style>
