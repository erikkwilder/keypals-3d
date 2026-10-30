<script lang="ts">
  // The top bar on Home and the subject pages: only "me" things, the same everywhere. Home (when you're
  // not there), your buddy and name (switch player), friendship, today's minutes and shells; then
  // Keypals and Wardrobe, the Shop, Dances, Stickers and Medals; then the compass, music and settings.
  // The ways to play live on the page under it, never up here. On a narrower screen the bar keeps the
  // compass and drops tiles from the right (they're all in the compass menu); on a phone the tiles drop
  // to a second row, and on a short laptop screen everything gets a little smaller.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { bookView, outfitOf, palOf, todayMs } from '../engine/profile';
  import { DANCES, forBuddy } from '../engine/rewards';
  import { levelFromXp, STICKERS } from '../engine/stickers';
  import { MEDALS } from '../engine/achievements';
  import { advView } from '../adventure/state';
  import { FRIEND } from '../art/cast';
  import NavTile from './NavTile.svelte';
  import Critter from './Critter.svelte';
  import GearButton from './GearButton.svelte';
  import FancyAntButton from './FancyAntButton.svelte';
  import Ring from './Ring.svelte';
  import Icon from './Icon.svelte';

  type Props = { home?: boolean };
  let { home = false }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const look = $derived(p.settings.look);
  const lvl = $derived(levelFromXp(palOf(p).xp));
  const goalMs = $derived(p.settings.dailyGoalMin * 60000);
  const today = $derived(todayMs(p));
  const shells = $derived(advView(p).shells);
  const book = $derived(bookView(p));
  const dancesOpen = $derived(forBuddy(DANCES, p.buddy).filter(d => d.level <= lvl.level).length);
  const stickers = $derived(STICKERS.filter(s => book.stickers[s.id]).length);
  const medals = $derived(MEDALS.filter(m => (book.medals[m.id] ?? 0) > 0).length);

  let w = $state(1280);
  let ih = $state(900);
  const phone = $derived(w < 760);
  // the tiles' pictures: smaller on a phone and on a short laptop screen
  const pic = $derived(phone || ih <= 800 ? 30 : 36);
  // what fits beside the tiles (the Home button takes a tile's room)
  const room = $derived(w - (home ? 0 : 84));
  const showFriend = $derived(phone ? w >= 400 : room >= 1040);
  const showGoal = $derived(!phone && room >= 1300);
  const showName = $derived(home || !phone);
  // tiles: all five, or the first few (the rest are in the compass menu)
  const nTiles = $derived(phone ? 5 : room >= 900 ? 5 : room >= 800 ? 4 : 3);
  const btn = $derived(phone ? 34 : 40);
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  function goHome() { sfx.click(); game.go('hub'); }
</script>

<svelte:window bind:innerHeight={ih} />

<header class="tb" class:phone bind:clientWidth={w}>
  {#if !home}
    <button class="homebtn" onclick={goHome} title="Home" aria-label="Home"><img src="{base}game/icon-home.webp" alt="" /><span>Home</span></button>
  {/if}
  <button class="me" onclick={() => { sfx.click(); game.go('players'); }} title="Switch player">
    <Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={phone ? 38 : 48} round />
    {#if showName}<span class="nm">{p.name}</span>{/if}
  </button>
  {#if showFriend}
    <div class="pill friend" title="Everything you play makes you better friends">
      <Icon name="heart" size={phone ? 18 : 22} />
      {#if phone}<b>{lvl.level}</b>{:else}<span class="ft"><b>{FRIEND[p.buddy].name} · Friendship {lvl.level}</b><i><em style:width="{(lvl.into / lvl.need) * 100}%"></em></i></span>{/if}
    </div>
  {/if}
  {#if showGoal}
    <div class="pill goal" title="Today's practice goal: typing and math both count">
      <Ring value={Math.min(1, today / goalMs)} size={28} color="var(--mint)" />
      <span><b>{Math.floor(today / 60000)}</b>/{p.settings.dailyGoalMin} min today</span>
    </div>
  {/if}
  <div class="pill shells" title="Shells: earned by playing, spent in the Shop">
    <img src="{base}game/icon-shell.webp" alt="" /><span><b>{fmt(shells)}</b>{#if !phone && room >= 980}{' shells'}{/if}</span>
  </div>
  <div class="spacer"></div>
  <nav class="tiles" aria-label="My stuff">
    <NavTile size="bar" tone="pink" label="Keypals" title="Keypals and Wardrobe: your buddies and what they wear" onclick={() => game.openCloset('outfits')}>
      {#snippet art()}<Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={pic} round />{/snippet}
    </NavTile>
    <NavTile size="bar" tone="mint" label="Shop" title="The Shop: things to wear, eggs and treats" onclick={() => game.openShop()}>
      {#snippet art()}<img class="ti" src="{base}game/icon-shell.webp" alt="" style:width="{pic}px" style:height="{pic}px" />{/snippet}
    </NavTile>
    {#if nTiles >= 4}<NavTile size="bar" tone="lilac" kind="dances" label="Dances" title="Dances: pick your buddy's dance" badge={dancesOpen || ''} onclick={() => game.openCloset('dances')} />{/if}
    <NavTile size="bar" tone="butter" kind="stickers" label="Stickers" badge={stickers || ''} onclick={() => game.openStickers('stickers')} />
    {#if nTiles >= 5}<NavTile size="bar" tone="sky" kind="medals" label="Medals" badge={medals || ''} onclick={() => game.openStickers('medals')} />{/if}
  </nav>
  {#if w >= 1600}<FancyAntButton variant="round" />{/if}
  <GearButton size={btn} />
</header>

<style>
  .tb { flex: none; position: relative; z-index: 5; display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: rgba(255, 255, 255, .93); border-bottom: var(--panel-border); box-shadow: 0 6px 20px -16px rgba(60, 40, 110, .4); }
  .homebtn { flex: none; display: flex; flex-direction: column; align-items: center; gap: 0; border: 2px solid #c4e3fa; border-radius: 18px; background: linear-gradient(#fff, #e7f4ff); padding: 3px 8px 4px; cursor: pointer; box-shadow: 0 4px 0 #94c8f0; font: 600 13.5px var(--font-ui); color: var(--ink); transition: transform .14s; }
  .homebtn img { width: 38px; height: 38px; object-fit: contain; }
  .homebtn:hover { transform: translateY(-2px); }
  .homebtn:active { transform: translateY(3px); box-shadow: 0 1px 0 #94c8f0; }
  .me { flex: none; display: flex; align-items: center; gap: 6px; background: none; border: 0; cursor: pointer; padding: 0 8px 0 0; border-radius: 16px; }
  .me:hover { background: var(--bg2); }
  .nm { font: 600 21px var(--font-ui); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pill { flex: none; display: flex; align-items: center; gap: 7px; white-space: nowrap; background: var(--bg2); padding: 5px 12px; border-radius: 999px; font: 700 14px var(--font-body); color: var(--ink2); }
  .pill b { font: 600 18px var(--font-ui); color: var(--ink); }
  .ft { display: flex; flex-direction: column; gap: 3px; }
  .ft b { font: 600 14.5px var(--font-ui); }
  .ft i { display: block; width: 130px; height: 6px; border-radius: 999px; background: #fff; overflow: hidden; }
  .ft em { display: block; height: 100%; background: linear-gradient(90deg, var(--primary-hi), var(--pink)); }
  .shells img { width: 26px; height: 26px; object-fit: contain; }
  .spacer { flex: 1; min-width: 0; }
  .tiles { display: flex; gap: 8px; flex: none; }
  .ti { object-fit: contain; }

  /* short laptop screens (1280x720, 1366x768): a slimmer bar, so the page under it has the room */
  @media (max-height: 800px) and (min-width: 760px) {
    .tb { padding: 5px 14px; gap: 8px; }
    .tiles :global(.tile) { padding: 3px 7px 4px; min-width: 64px; }
    .tiles :global(.tile .pic) { width: 30px !important; height: 30px !important; }
    .tiles :global(.tile .pic .art) { width: 30px !important; height: 30px !important; }
    .tiles :global(.tile .lbl) { font-size: 12.5px; }
    .homebtn img { width: 30px; height: 30px; }
    .homebtn { font-size: 12.5px; padding: 2px 7px 3px; }
  }

  /* phones: Home, you, friendship, shells and the round buttons on top; the five tiles share a second row */
  .phone { flex-wrap: wrap; gap: 6px 6px; padding: 6px 8px 8px; }
  .phone .homebtn { padding: 2px 5px; border-radius: 14px; }
  .phone .homebtn img { width: 30px; height: 30px; }
  .phone .homebtn span { display: none; }
  .phone .nm { font-size: 17px; max-width: 96px; }
  .phone .pill { padding: 4px 9px; gap: 4px; }
  .phone .pill b { font-size: 16px; }
  .phone .shells img { width: 22px; height: 22px; }
  .phone .tiles { order: 10; width: 100%; gap: 5px; justify-content: space-between; }
  .phone .tiles :global(.tile) { flex: 1 1 0; min-width: 0; padding: 3px 2px 4px; }
  .phone .tiles :global(.tile .lbl) { font-size: 12px; white-space: nowrap; }
  .phone .tiles :global(.tile .pic), .phone .tiles :global(.tile .pic .art) { width: 30px !important; height: 30px !important; }
  .phone :global(.pair) { gap: 5px; }
  .phone :global(.gear), .phone :global(.mus), .phone :global(.menu) { padding: 3px; }
</style>
