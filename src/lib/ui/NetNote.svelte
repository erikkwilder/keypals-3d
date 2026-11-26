<script lang="ts">
  // A small note while the connection is gone (state/net.svelte.ts says when): the game carries on, a Learn
  // lesson's narrator too (audio/keep.ts), and the player's progress is kept on this computer until it's
  // back (cloud.svelte.ts sends it then). It goes when the connection comes back. On the left, over the 3D
  // place, below the pause button and the band where a lesson's words are said (at 82 px it sat on the
  // words' bubble on a phone): clear of its words, answers and buttons, and taps go through it. A screen
  // reader hears it once, when it comes.
  import { onMount } from 'svelte';
  import { net, watchNet } from '../state/net.svelte';
  onMount(() => watchNet());
</script>

<div class="net" role="status">
  {#if net.down}<p>No internet right now. Keep playing: your game is saved on this computer.</p>{/if}
</div>

<style>
  .net { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 166px); left: calc(env(safe-area-inset-left, 0px) + 12px); z-index: 95; pointer-events: none; }
  p { margin: 0; max-width: min(250px, calc(100vw - 24px)); padding: 7px 12px; border-radius: 14px; background: rgba(255, 255, 255, .94); color: var(--ink); font: 700 16px/1.3 var(--font-body); box-shadow: 0 2px 10px rgba(0, 0, 0, .18); }
</style>
