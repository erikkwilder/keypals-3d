<script lang="ts">
  // The way out of a game, on its start card and its end card: one "Back to ..." button, to where the game
  // was started from (arcade/exits.ts). Home is on the Pause card. A plain .btn, so it sits in the game's
  // own row of buttons.
  import type { Exits } from '../exits';
  import { sfx } from '../../audio/sound';

  let { exits, before }: { exits: Exits; before?: () => void } = $props();
</script>

<button class="btn" onclick={() => { sfx.click(); before?.(); exits.back(); }}>Back to {exits.backTo}</button>
