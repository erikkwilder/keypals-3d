<script lang="ts">
  // The market's and the clockmaker's Learn episodes play over the page they were started from
  // (game.learnOverlay) and close back to it: on My path and on the Journey trail, as on a topic's pages.
  import { game } from '../state/game.svelte';
  import Episode from '../math/ui/Episode.svelte';
  import MeasureEpisode from '../math/measure/MeasureEpisode.svelte';
  import { MARKET_LESSON } from '../math/market/episodes';
  import { MEASURE_LESSON } from '../math/measure/episodes';

  function close() { game.learnOverlay = null; game.learnCheck = false; }
</script>

{#if game.learnOverlay && MARKET_LESSON[game.learnOverlay]}{#key game.learnOverlay}<Episode id={game.learnOverlay} check={game.learnCheck} onclose={close} />{/key}{/if}
{#if game.learnOverlay && MEASURE_LESSON[game.learnOverlay]}{#key game.learnOverlay}<MeasureEpisode lesson={MEASURE_LESSON[game.learnOverlay]} check={game.learnCheck} onclose={close} />{/key}{/if}
