<script lang="ts">
  // What a math area's own arcade round earned (Pizza Rush, Clock Rush, Balance Beam...), the same row in
  // every one of them and the same things the fact games' results show: the treasure the score found,
  // today's challenge's bonus shells, shells, friendship, then any medal, sticker, new buddy or warm egg (engine/settle.ts pays them all).
  import type { Settled } from '../../engine/settle';
  import { TREASURES } from '../../engine/rewards';
  import { FRIEND, type FriendId } from '../../art/cast';
  import Icon from '../../ui/Icon.svelte';
  import RewardTap from '../../ui/RewardTap.svelte';

  type Props = { o: Settled; buddy: FriendId };
  let { o, buddy }: Props = $props();
  const base = import.meta.env.BASE_URL;
</script>

<div class="prizes">
  <!-- the treasure, the shells and a ready egg open when tapped (its card, the shells card, the hatch) -->
  {#if o.treasure >= 0}
    <RewardTap kind="treasure" n={o.treasure}>{#snippet children(tap)}<button class="tr tap" onclick={tap} title="What is it?"><img src="{base}treasures/{TREASURES[o.treasure].id}.webp" alt="" /><span><small>{o.newBestTreasure ? 'New best treasure!' : 'Found'}</small>{TREASURES[o.treasure].name}</span></button>{/snippet}</RewardTap>
  {/if}
  {#if o.dailyBeat}<RewardTap kind="shells" n={o.shells + (o.dailyShells ?? 0)}>{#snippet children(tap)}<button class="day tap" onclick={tap}><img src="{base}icons/daily.webp" alt="" /><b>Today's challenge beaten!</b> +{o.dailyShells} bonus shells</button>{/snippet}</RewardTap>{/if}
  {#if o.shells}<RewardTap kind="shells" n={o.shells + (o.dailyBeat ? o.dailyShells ?? 0 : 0)}>{#snippet children(tap)}<button class="tap" onclick={tap} title="Your shells"><img src="{base}game/icon-shell.webp" alt="" /> +{o.shells} shells</button>{/snippet}</RewardTap>{/if}
  <span>{FRIEND[buddy].name} <Icon name="heart" size={16} /> +{o.xp.gained} friendship{#if o.xp.after.level > o.xp.before.level}<em>Level {o.xp.after.level}!</em>{/if}</span>
  {#each o.medals as m (m.id)}<span><Icon name="medal" size={16} /> {m.name}</span>{/each}
  {#each o.stickers as s (s.id)}<span><Icon name="sticker" size={16} /> {s.name}</span>{/each}
  {#each o.buddies as b (b)}<span><Icon name="heart" size={16} /> {FRIEND[b].name} joined the team!</span>{/each}
  {#if o.eggsReady.length}<RewardTap kind="egg">{#snippet children(tap)}<button class="tap egg" onclick={tap}><img src="{base}game/egg-{o.eggsReady[0]}.webp" alt="" /> An egg is ready: hatch it!</button>{/snippet}</RewardTap>{/if}
</div>

<style>
  .prizes { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; align-items: center; }
  .prizes > span, .prizes > .tap { display: inline-flex; align-items: center; gap: 5px; background: var(--bg2); border-radius: 999px; padding: 5px 12px; font: 700 14px var(--font-body); color: var(--ink2); }
  /* the ones that open when tapped look like buttons: a raised edge, and they lift on hover */
  .prizes > .tap { border: 0; cursor: pointer; box-shadow: inset 0 -2px 0 rgba(90, 60, 150, .18); transition: transform .12s; }
  .prizes > .tap:hover { transform: translateY(-2px); }
  .egg { background: #e2f7ee !important; color: #0f5a3c !important; }
  .egg img { width: 22px; height: 26px; object-fit: contain; }
  .prizes img { width: 20px; height: 20px; }
  .prizes em { font-style: normal; color: var(--primary); margin-left: 4px; }
  .day { background: #fff6d8 !important; box-shadow: inset 0 0 0 2px #ffd36b; color: #6b4300 !important; }
  .day img { width: 26px; height: 26px; object-fit: contain; }
  .tr { padding: 3px 14px 3px 4px !important; background: #fff6d8 !important; box-shadow: inset 0 0 0 2px #f3d27a; }
  .tr img { width: 34px; height: 34px; object-fit: contain; }
  .tr > span { display: flex; flex-direction: column; line-height: 1.1; }
  .tr small { font: 700 11px var(--font-body); color: #a8741a; }
</style>
