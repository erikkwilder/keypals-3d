<script lang="ts">
  // What a math area's own arcade round earned (Pizza Rush, Clock Rush, Balance Beam...), the same row in
  // every one of them and the same things the fact games' results show: the treasure the score found,
  // shells, friendship, then any medal, sticker, new buddy or warm egg (engine/settle.ts pays them all).
  import type { Settled } from '../../engine/settle';
  import { TREASURES } from '../../engine/rewards';
  import { FRIEND, type FriendId } from '../../art/cast';
  import Icon from '../../ui/Icon.svelte';

  type Props = { o: Settled; buddy: FriendId };
  let { o, buddy }: Props = $props();
  const base = import.meta.env.BASE_URL;
</script>

<div class="prizes">
  {#if o.treasure >= 0}
    <span class="tr" title={TREASURES[o.treasure].desc}><img src="{base}treasures/{TREASURES[o.treasure].id}.webp" alt="" /><span><small>{o.newBestTreasure ? 'New best treasure!' : 'Found'}</small>{TREASURES[o.treasure].name}</span></span>
  {/if}
  {#if o.shells}<span><img src="{base}game/icon-shell.webp" alt="" /> +{o.shells} shells</span>{/if}
  <span>{FRIEND[buddy].name} <Icon name="heart" size={16} /> +{o.xp.gained} friendship{#if o.xp.after.level > o.xp.before.level}<em>Level {o.xp.after.level}!</em>{/if}</span>
  {#each o.medals as m (m.id)}<span><Icon name="medal" size={16} /> {m.name}</span>{/each}
  {#each o.stickers as s (s.id)}<span><Icon name="sticker" size={16} /> {s.name}</span>{/each}
  {#each o.buddies as b (b)}<span><Icon name="heart" size={16} /> {FRIEND[b].name} joined the team!</span>{/each}
  {#if o.eggsReady.length}<span><Icon name="gift" size={16} /> An egg is ready to hatch!</span>{/if}
</div>

<style>
  .prizes { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; align-items: center; }
  .prizes > span { display: inline-flex; align-items: center; gap: 5px; background: var(--bg2); border-radius: 999px; padding: 5px 12px; font: 700 14px var(--font-body); color: var(--ink2); }
  .prizes img { width: 20px; height: 20px; }
  .prizes em { font-style: normal; color: var(--primary); margin-left: 4px; }
  .tr { padding: 3px 14px 3px 4px !important; background: #fff6d8 !important; box-shadow: inset 0 0 0 2px #f3d27a; }
  .tr img { width: 34px; height: 34px; object-fit: contain; }
  .tr > span { display: flex; flex-direction: column; line-height: 1.1; }
  .tr small { font: 700 11px var(--font-body); color: #a8741a; }
</style>
