<script lang="ts">
  // Something a results screen shows you earned, made tappable the way stickers and medals open to say
  // what they are: shells open the shells card (what this round brought, how you earn them, and the way to
  // the Shop and My Sky Island); a ready egg hatches right there (ui/HatchMoment.svelte), then offers to see
  // it in My stuff; a treasure opens its card. The screen draws its own button (so it keeps its own look)
  // and calls `tap` from it (`done`: the egg has hatched from here):
  //   <RewardTap kind="shells" n={5}>{#snippet children(tap)}<button onclick={tap}>+5 shells</button>{/snippet}</RewardTap>
  import type { Snippet } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { advView } from '../adventure/state';
  import ShellsCard from './ShellsCard.svelte';
  import HatchMoment from './HatchMoment.svelte';
  import TreasureCard from './TreasureCard.svelte';
  import { portal } from './portal';

  type Props = {
    kind: 'shells' | 'egg' | 'treasure';
    /** shells: how many this round brought; treasure: which one (TREASURES) */
    n?: number;
    /** treasure: the scores that find each, and where they count ("in a lesson") */
    at?: number[]; where?: string;
    children: Snippet<[(e: MouseEvent) => void, boolean]>;
  };
  let { kind, n = 0, at, where, children }: Props = $props();
  let anchor = $state<HTMLElement | null>(null);
  let open = $state(false);
  let slot = $state(-1);
  let done = $state(false);

  function tap(e: MouseEvent) {
    e.stopPropagation();
    sfx.click();
    anchor = e.currentTarget as HTMLElement;
    if (kind === 'egg') {
      // the first egg in the incubator that's ready; none ready there (it waits in a nest): the incubator
      const s = game.profile ? advView(game.profile).incubator.findIndex(x => x && x.have >= x.need) : -1;
      if (s < 0) { game.visit('eggs'); return; }
      slot = s;
    }
    open = true;
  }
</script>

{@render children(tap, done)}
{#if open}
  <div class="layer" use:portal>
    {#if kind === 'shells'}<ShellsCard {anchor} earned={n} onclose={() => (open = false)} />
    {:else if kind === 'egg' && slot >= 0}<HatchMoment {slot} see onhatched={(h) => { if (h) done = true; }} onclose={() => { open = false; slot = -1; }} />
    {:else if kind === 'treasure'}<TreasureCard i={n} found={n} {at} {where} onclose={() => (open = false)} />{/if}
  </div>
{/if}

<style>
  /* over the whole game (the cards inside are fixed to the window) */
  .layer { position: relative; z-index: 60; }
</style>
