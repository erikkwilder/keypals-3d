<script lang="ts">
  // Your shells, opened from the shells in the top bar: how many, where they come from, the last few that
  // came in (state/shellLog.svelte.ts), and the places to spend them: the Shop and My Sky Island.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { advView } from '../adventure/state';
  import { shellNotes } from '../state/shellLog.svelte';
  import Popover from './Popover.svelte';

  /** `earned`: opened from a results screen, the shells this round brought */
  type Props = { anchor: HTMLElement | null; onclose: () => void; earned?: number };
  let { anchor, onclose, earned = 0 }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const shells = $derived(advView(p).shells);
  const notes = $derived(shellNotes(p.id).slice(0, 5));
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  const WAYS = [
    { img: 'icons/map.webp', text: 'Lessons and math trips: more stars, more shells' },
    { img: 'game/icon-stickers.webp', text: 'Stickers and medals you win' },
    { img: 'game/icon-grump.webp', text: 'Adventure battles and practice stops' },
    { img: 'icons/daily.webp', text: "Beating the Arcade's challenge of the day" },
    { img: 'icons/book.webp', text: 'Learning a new trick' },
  ];
  function when(at: number) {
    const d = new Date(at), now = new Date();
    const day = d.toDateString() === now.toDateString() ? 'Today' : new Date(now.getTime() - 86400000).toDateString() === d.toDateString() ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'long' });
    return `${day}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  function go(to: 'shop' | 'island') { sfx.click(); onclose(); if (to === 'shop') game.openShop(); else game.go('island'); }
</script>

<Popover {anchor} {onclose} label="Your shells">
  <div class="head">
    <img src="{base}game/icon-shell.webp" alt="" />
    <div><b>{fmt(shells)} shells</b><span>Yours to spend on things to wear and your island</span></div>
  </div>
  {#if earned}<p class="now"><em>+{fmt(earned)}</em> from this round</p>{/if}
  <h3>How you earn them</h3>
  <ul class="ways">
    {#each WAYS as w (w.img)}<li><img src="{base}{w.img}" alt="" />{w.text}</li>{/each}
  </ul>
  <h3>The last few</h3>
  {#if notes.length}
    <ul class="notes">
      {#each notes as n (n.at)}<li><em>+{fmt(n.n)}</em><span>{n.where}</span><small>{when(n.at)}</small></li>{/each}
    </ul>
  {:else}
    <p class="none">Play a lesson or a trip and your shells show up here.</p>
  {/if}
  <div class="go">
    <button class="btn btn-primary" onclick={() => go('shop')}><img src="{base}game/icon-shell.webp" alt="" />Shop</button>
    <button class="btn" onclick={() => go('island')}><img src="{base}island/tile.webp" alt="" />My Sky Island</button>
  </div>
</Popover>

<style>
  .head { display: flex; align-items: center; gap: 12px; padding-right: 36px; }
  .head img { width: 58px; height: 58px; object-fit: contain; filter: drop-shadow(0 4px 4px rgba(120, 60, 90, .25)); }
  .head div { display: flex; flex-direction: column; }
  .head b { font: 600 26px/1.1 var(--font-ui); color: var(--ink); }
  .head span { font: 700 13px/1.3 var(--font-body); color: var(--muted); }
  h3 { margin: 12px 0 6px; font-size: 16px; color: #a86a00; }
  .now { margin: 10px 0 0; padding: 6px 12px; border-radius: 14px; background: #e6f8ee; font: 700 15px var(--font-body); color: var(--ink); }
  .now em { font: 600 20px var(--font-ui); font-style: normal; color: #1f8a55; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .ways li { display: flex; align-items: center; gap: 8px; font: 700 14px/1.25 var(--font-body); color: var(--ink2); }
  .ways img { width: 30px; height: 30px; object-fit: contain; flex: none; }
  .notes li { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; padding: 4px 10px; border-radius: 12px; background: #fff8e6; }
  .notes em { font: 600 17px var(--font-ui); font-style: normal; color: #1f8a55; }
  .notes span { font: 700 14px var(--font-body); color: var(--ink); }
  .notes small { font: 700 12px var(--font-body); color: var(--muted); white-space: nowrap; }
  .none { margin: 0; font: 600 14px var(--font-body); color: var(--muted); }
  .go { display: flex; gap: 8px; margin-top: 14px; }
  .go .btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; padding-left: 10px; padding-right: 12px; }
  .go img { width: 28px; height: 28px; object-fit: contain; }
</style>
