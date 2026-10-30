<script lang="ts">
  // The Shop: one for the whole game, with three sections (shop/shop.ts): Wear (try things on your buddy
  // and buy them: the try-on page, Closet.svelte), Island (things for My Sky Island and special paints) and
  // Care (eggs and treats). It opens where you came from: the Wardrobe's "Get more" on Wear, the island on
  // Island; My stuff, the shells card and the Menu open it on Wear, all three sections a tap apart.
  import Closet from './Closet.svelte';
  import ShopShelf from '../shop/ShopShelf.svelte';
  import Header from '../ui/Header.svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { SECTIONS, type Section } from '../shop/shop';

  const base = import.meta.env.BASE_URL;
  // svelte-ignore state_referenced_locally
  let section = $state<Section>(game.shopSection ?? 'wear');
  function pick(s: Section) {
    if (s === section) return;
    section = s; game.shopSection = s;
    if (s !== 'wear') game.shopSlot = null;
    sfx.click();
  }
</script>

<div class="screen shop">
  <Header />
  <div class="sections" role="tablist" aria-label="The Shop">
    {#each SECTIONS as s (s.id)}
      <button role="tab" aria-selected={section === s.id} class:on={section === s.id} class="sec {s.id}" onclick={() => pick(s.id)}>
        <img src="{base}{s.pic}" alt="" />
        <span><b>{s.name}</b><small>{s.line}</small></span>
      </button>
    {/each}
  </div>
  {#if section === 'wear'}<Closet mode="shop" embedded />{:else}<ShopShelf {section} />{/if}
</div>

<style>
  .shop { display: flex; flex-direction: column; background: transparent; }
  .sections { flex: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 12px 20px 0; max-width: 1100px; width: 100%; margin: 0 auto; box-sizing: border-box; }
  .sec { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 6px 14px 6px 8px; border-radius: 22px; border: 0; cursor: pointer; text-align: left; font: inherit; background: rgba(255, 255, 255, .88); box-shadow: inset 0 0 0 2px #e4ddf3, var(--shadow-sm); color: var(--ink2); }
  .sec img { width: 46px; height: 46px; object-fit: contain; flex: none; }
  .sec span { display: flex; flex-direction: column; min-width: 0; }
  .sec b { font: 600 22px/1.1 var(--font-ui); color: var(--ink); }
  .sec small { font: 700 12px/1.25 var(--font-body); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sec.on { background: #fff; box-shadow: 0 0 0 3px var(--tc), var(--shadow-sm); }
  .sec.wear { --tc: #ffb627; } .sec.island { --tc: #2fbf73; } .sec.care { --tc: #ff8fbf; }
  .sec:not(.on):hover { background: #fff; }
  @media (max-height: 820px) and (min-width: 761px) {
    .sections { padding-top: 8px; } .sec { padding: 4px 12px 4px 6px; } .sec img { width: 36px; height: 36px; } .sec b { font-size: 19px; }
  }
  @media (max-width: 760px) {
    .sections { gap: 6px; padding: 8px 10px 0; }
    .sec { flex-direction: column; gap: 0; padding: 4px 4px 5px; text-align: center; border-radius: 16px; }
    .sec img { width: 34px; height: 34px; }
    .sec span { align-items: center; }
    .sec b { font-size: 16px; }
    .sec small { display: none; }
  }
</style>
