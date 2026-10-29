<script lang="ts">
  // Subtitles for whatever is being said, with the speaker's face.
  import { voiceState } from '../audio/voice.svelte';
  import { game } from '../state/game.svelte';
  import Critter from './Critter.svelte';
  import Icon from './Icon.svelte';
  import type { FriendId } from '../art/cast';
</script>

{#if voiceState.caption}
  <div class="cap" role="status" aria-live="polite">
    {#if voiceState.speaker && voiceState.speaker !== 'coach'}
      <Critter friend={voiceState.speaker as FriendId} look={game.settings.look} size={46} lite />
    {:else}
      <span class="coach"><Icon name="cap" size={30} /></span>
    {/if}
    <span class="txt">{voiceState.caption}</span>
  </div>
{/if}

<style>
  .cap { position: fixed; left: 0; right: 0; margin: 0 auto; width: max-content; bottom: 22px; z-index: 60; display: flex; align-items: center; gap: 10px; max-width: min(760px, 90vw); background: rgba(43, 33, 64, .92); color: #fff; padding: 8px 18px 8px 8px; border-radius: 18px; font: 600 17px/1.35 var(--font-body); box-shadow: var(--shadow); animation: fade-up .25s ease; pointer-events: none; }
  .coach { width: 40px; height: 40px; border-radius: 12px; background: rgba(255, 255, 255, .15); display: grid; place-items: center; }
</style>
