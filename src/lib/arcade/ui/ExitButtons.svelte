<script lang="ts">
  // The ways out of an arcade game, on its stop or pause card and its end card: always "Back to the
  // Arcade", and the page it was opened from too (a part of math, the Games list, Home) when that wasn't
  // the Arcade. Plain .btn buttons, so they sit in each game's own row of buttons.
  import type { Exits } from '../exits';
  import { sfx } from '../../audio/sound';

  let { exits, before }: { exits: Exits; before?: () => void } = $props();
  const go = (fn: () => void) => { sfx.click(); before?.(); fn(); };
</script>

<button class="btn" onclick={() => go(exits.toArcade)}>Back to the Arcade</button>
{#if exits.other}<button class="btn" onclick={() => go(exits.other!.go)}>{exits.other.text}</button>{/if}
