<script lang="ts">
  // A treasure, shown big with what it is (tapped on a results screen): its picture, its name and story,
  // what it's worth in shells, and the arrows to look at the other nine.
  import { onDestroy, onMount } from 'svelte';
  import { sfx } from '../audio/sound';
  import { TREASURES } from '../engine/rewards';
  import { treasureWorth } from '../adventure/state';
  import Icon from './Icon.svelte';

  /** `found`: the one this round found; `at`: the scores that find each (and `where` they count) */
  type Props = { i: number; found?: number; at?: number[]; where?: string; onclose: () => void };
  let { i: start, found = -1, at, where = '', onclose }: Props = $props();
  // svelte-ignore state_referenced_locally
  let i = $state(start);
  const src = (k: number) => `${import.meta.env.BASE_URL}treasures/${TREASURES[k].id}.webp`;
  function go(k: number) { i = k; sfx.pop(); }
  function onKey(e: KeyboardEvent) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); onclose(); } }
  onMount(() => { sfx.pop(); addEventListener('keydown', onKey, true); });
  onDestroy(() => removeEventListener('keydown', onKey, true));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="tm" onclick={onclose}>
  <div class="tc card" role="dialog" aria-modal="true" tabindex="-1" aria-label={TREASURES[i].name} onclick={(e) => e.stopPropagation()}>
    <img class="pic" src={src(i)} alt="" />
    <span class="kind">Treasure · {i + 1} of {TREASURES.length}</span>
    <h3>{TREASURES[i].name}</h3>
    <p class="desc">{TREASURES[i].desc}</p>
    <p class="more">{#if at?.[i] !== undefined}Score {at[i]} or more{where ? ` ${where}` : ''} to find one. {/if}It's worth {treasureWorth(i)} shells.{#if i === found} You found one this time!{/if}</p>
    <div class="nav">
      <button class="btn" disabled={i === 0} onclick={() => go(i - 1)} aria-label="Previous treasure"><Icon name="back" size={26} /></button>
      <button class="btn btn-primary" onclick={onclose}>OK</button>
      <button class="btn" disabled={i === TREASURES.length - 1} onclick={() => go(i + 1)} aria-label="Next treasure"><Icon name="play" size={26} /></button>
    </div>
  </div>
</div>

<style>
  .tm { position: fixed; inset: 0; z-index: 76; display: grid; place-items: center; padding: 16px; background: rgba(40, 28, 70, .4); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); animation: fade-up .2s ease; }
  .tc { width: min(400px, 92vw); padding: 22px 26px 20px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; animation: pop-in .35s cubic-bezier(.3, .8, .4, 1.4); }
  .pic { width: 170px; height: 170px; object-fit: contain; filter: drop-shadow(0 10px 14px rgba(60, 40, 110, .3)); }
  .kind { font: 800 12px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  h3 { font-size: 28px; margin: 0; }
  .desc { margin: 2px 0; font: 600 17px/1.35 var(--font-body); color: var(--ink2); }
  .more { margin: 0 0 10px; font: 600 14px/1.35 var(--font-body); color: var(--muted); }
  .nav { display: flex; gap: 10px; align-items: center; }
  .nav .btn:not(.btn-primary) { font-size: 22px; padding: 6px 14px; }
</style>
