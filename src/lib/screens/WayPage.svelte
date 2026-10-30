<script lang="ts">
  // One way of a topic as a page of picture cards (ui/WayPane.svelte): Fractions' Learn episodes, Plus's
  // games, or every Learn lesson of a subject. The one top bar (← Fractions | Learn, trail Math › Fractions).
  // The market's and the clockmaker's episodes play over this page (game.learnOverlay) and close back to it.
  import { game } from '../state/game.svelte';
  import { SUBJECT } from '../subjects';
  import Bar from '../ui/Bar.svelte';
  import WayPane from '../ui/WayPane.svelte';
  import Episode from '../math/ui/Episode.svelte';
  import MeasureEpisode from '../math/measure/MeasureEpisode.svelte';
  import { MARKET_LESSON } from '../math/market/episodes';
  import { MEASURE_LESSON } from '../math/measure/episodes';

  const sid = $derived(SUBJECT[game.subject] ? game.subject : 'math');
  const S = $derived(SUBJECT[sid]);
  const chip = $derived(game.topic ?? 'all');
  function closeOverlay() { game.learnOverlay = null; game.learnCheck = false; }
</script>

{#if game.learnOverlay && MARKET_LESSON[game.learnOverlay]}{#key game.learnOverlay}<Episode id={game.learnOverlay} check={game.learnCheck} onclose={closeOverlay} />{/key}{/if}
{#if game.learnOverlay && MEASURE_LESSON[game.learnOverlay]}{#key game.learnOverlay}<MeasureEpisode lesson={MEASURE_LESSON[game.learnOverlay]} check={game.learnCheck} onclose={closeOverlay} />{/key}{/if}

<div class="screen waypage" class:behind={!!game.learnOverlay}>
  <Bar />
  <div class="body scroll">
    <WayPane subject={S} way={game.wayId} {chip} />
  </div>
</div>

<style>
  .waypage { display: flex; flex-direction: column; background: linear-gradient(#f6f2ff, #fbf9ff 45%, #f7fbff); }
  .body { flex: 1; min-height: 0; padding: 14px 24px 28px; }
  .behind { visibility: hidden; }
  @media (max-width: 600px) { .body { padding: 10px 10px 20px; } }
</style>
