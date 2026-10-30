<script lang="ts">
  // The top bar on Home and the subject pages: only "me" things, the same everywhere. Home (when you're
  // not there), your buddy and name (switch player), friendship, today's minutes (tap: today's goal and
  // the week) and shells (tap: how you earn them and where to spend them); then My stuff, Keypals and
  // Wardrobe, the Shop, Dances, Stickers and Medals; then the compass, Ideas and help, music and settings.
  // Every button says what it is on hover (a long press on a touch screen). The ways to play live on the
  // page under it, never up here. The tiles take whatever room is left and drop from the right when it
  // runs out (they're all in My stuff and the compass menu); on a phone the tiles drop to a second row, and
  // on a short laptop screen everything gets a little smaller.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { bookView, outfitOf, palOf, todayMs } from '../engine/profile';
  import { DANCES, forBuddy } from '../engine/rewards';
  import { levelFromXp, STICKERS } from '../engine/stickers';
  import { MEDALS } from '../engine/achievements';
  import { advView } from '../adventure/state';
  import { FRIEND } from '../art/cast';
  import '../state/shellLog.svelte';
  import NavTile from './NavTile.svelte';
  import Critter from './Critter.svelte';
  import GearButton from './GearButton.svelte';
  import FancyAntButton from './FancyAntButton.svelte';
  import Ring from './Ring.svelte';
  import Icon from './Icon.svelte';
  import ShellsCard from './ShellsCard.svelte';
  import GoalCard from './GoalCard.svelte';
  import { tips } from './tips';

  type Props = { home?: boolean };
  let { home = false }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const look = $derived(p.settings.look);
  const lvl = $derived(levelFromXp(palOf(p).xp));
  const goalMin = $derived(p.settings.dailyGoalMin);
  const todayMin = $derived(Math.floor(todayMs(p) / 60000));
  const shells = $derived(advView(p).shells);
  const book = $derived(bookView(p));
  const dancesOpen = $derived(forBuddy(DANCES, p.buddy).filter(d => d.level <= lvl.level).length);
  const stickers = $derived(STICKERS.filter(s => book.stickers[s.id]).length);
  const medals = $derived(MEDALS.filter(m => (book.medals[m.id] ?? 0) > 0).length);

  let w = $state(1280);
  let ih = $state(900);
  /** the widths of the left group (you, friendship, minutes, shells) and the round buttons, so the tiles take what's left */
  let lw = $state(500), rw = $state(260);
  const phone = $derived(w < 760);
  // the tiles' pictures: smaller on a phone and on a short laptop screen
  const pic = $derived(phone || ih <= 800 ? 30 : 36);
  // what fits beside the tiles (the Home button takes a tile's room)
  const room = $derived(w - (home ? 0 : 84));
  const showFriend = $derived(phone ? false : room >= 1080);
  const friendFull = $derived(room >= 1560);
  const goalFull = $derived(!phone && room >= 1300);
  const showName = $derived(home || !phone);
  // tiles: as many as fit (a phone has a row of its own); My stuff is always first
  const tileW = $derived(ih <= 800 ? 80 : 86);
  const nTiles = $derived(phone ? 6 : Math.max(1, Math.min(6, Math.floor((w - lw - rw - 52) / tileW))));
  const btn = $derived(phone ? 28 : 40);
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  function goHome() { sfx.click(); game.go('hub'); }

  // the little cards under the shells and the minutes
  let card = $state<'shells' | 'goal' | null>(null);
  let shellEl: HTMLElement | null = $state(null), goalEl: HTMLElement | null = $state(null);
  function toggle(c: 'shells' | 'goal') { sfx.click(); card = card === c ? null : c; }
  const goalTip = $derived(`Today's goal: ${todayMin} of ${goalMin} minutes. Tap to see your week`);
</script>

<svelte:window bind:innerHeight={ih} />

<header class="tb" class:phone bind:clientWidth={w} use:tips>
  <div class="lft" bind:clientWidth={lw}>
    {#if !home}
      <button class="homebtn" onclick={goHome} title="Home"><img src="{base}game/icon-home.webp" alt="" /><span>Home</span></button>
    {/if}
    <button class="me" onclick={() => { sfx.click(); game.go('players'); }} title="{p.name}: switch player">
      <Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={phone ? 38 : 48} round />
      {#if showName}<span class="nm">{p.name}</span>{/if}
    </button>
    {#if showFriend}
      <div class="pill friend" title="Friendship with {FRIEND[p.buddy].name}: {lvl.level}. Everything you play makes you better friends">
        <Icon name="heart" size={22} />
        {#if friendFull}<span class="ft"><b>{FRIEND[p.buddy].name} · Friendship {lvl.level}</b><i><em style:width="{(lvl.into / lvl.need) * 100}%"></em></i></span>{:else}<b>{lvl.level}</b>{/if}
      </div>
    {/if}
    {#if !phone}
      <button class="pill goal tap" class:on={card === 'goal'} class:met={todayMin >= goalMin} bind:this={goalEl} title={goalTip} aria-expanded={card === 'goal'} onclick={() => toggle('goal')}>
        <Ring value={Math.min(1, todayMin / Math.max(1, goalMin))} size={28} color="var(--mint)" />
        <span><b>{todayMin}</b>/{goalMin}{goalFull ? ' min today' : ' min'}</span>
      </button>
    {/if}
    <button class="pill shells tap" class:on={card === 'shells'} bind:this={shellEl} title="Shells: {fmt(shells)}. Tap to see how you earn them" aria-expanded={card === 'shells'} onclick={() => toggle('shells')}>
      <img src="{base}game/icon-shell.webp" alt="" /><span><b>{fmt(shells)}</b>{#if !phone && room >= 1180}{' shells'}{/if}</span>
    </button>
  </div>
  <div class="spacer"></div>
  <nav class="tiles" aria-label="My things">
    {#if phone}
      <!-- a phone: today's minutes lead the second row (there's no room beside the shells) -->
      <span class="todaytile" bind:this={goalEl}>
        <NavTile size="bar" tone="mint" label="Today" title={goalTip} onclick={() => { card = card === 'goal' ? null : 'goal'; }}>
          {#snippet art()}<span class="ringpic"><Ring value={Math.min(1, todayMin / Math.max(1, goalMin))} size={32} width={4} color="var(--mint)" /><b>{todayMin}</b></span>{/snippet}
        </NavTile>
      </span>
    {/if}
    <NavTile size="bar" tone="butter" label="My stuff" title="My stuff: everything you've collected, and how you're doing" onclick={() => game.go('mystuff')}>
      {#snippet art()}<img class="ti" src="{base}game/chest.webp" alt="" style:width="{pic}px" style:height="{pic}px" />{/snippet}
    </NavTile>
    {#if nTiles >= 2}<NavTile size="bar" tone="pink" label="Keypals" title="Keypals and Wardrobe: your buddies and what they wear" onclick={() => game.openCloset('outfits')}>
      {#snippet art()}<Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={pic} round />{/snippet}
    </NavTile>{/if}
    {#if nTiles >= 3}<NavTile size="bar" tone="mint" label="Shop" title="The Shop: things to wear, eggs and treats" onclick={() => game.openShop()}>
      {#snippet art()}<img class="ti" src="{base}game/icon-shell.webp" alt="" style:width="{pic}px" style:height="{pic}px" />{/snippet}
    </NavTile>{/if}
    {#if nTiles >= 4 && !phone}<NavTile size="bar" tone="lilac" kind="dances" label="Dances" title="Dances: pick your buddy's dance" badge={dancesOpen || ''} onclick={() => game.openCloset('dances')} />{/if}
    {#if nTiles >= 5}<NavTile size="bar" tone="butter" kind="stickers" label="Stickers" title="Stickers: one for every first" badge={stickers || ''} onclick={() => game.openStickers('stickers')} />{/if}
    {#if nTiles >= 6}<NavTile size="bar" tone="sky" kind="medals" label="Medals" title="Medals: for great things you can do again and again" badge={medals || ''} onclick={() => game.openStickers('medals')} />{/if}
  </nav>
  <div class="rgt" bind:clientWidth={rw}>
    {#if w >= 1680}<FancyAntButton variant="round" />{/if}
    <GearButton size={btn} />
  </div>
</header>

{#if card === 'shells'}<ShellsCard anchor={shellEl} onclose={() => (card = null)} />{/if}
{#if card === 'goal'}<GoalCard anchor={goalEl} onclose={() => (card = null)} />{/if}

<style>
  .tb { flex: none; position: relative; z-index: 5; display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: rgba(255, 255, 255, .93); border-bottom: var(--panel-border); box-shadow: 0 6px 20px -16px rgba(60, 40, 110, .4); }
  .lft, .rgt { flex: none; display: flex; align-items: center; gap: 10px; }
  .homebtn { flex: none; display: flex; flex-direction: column; align-items: center; gap: 0; border: 2px solid #c4e3fa; border-radius: 18px; background: linear-gradient(#fff, #e7f4ff); padding: 3px 8px 4px; cursor: pointer; box-shadow: 0 4px 0 #94c8f0; font: 600 13.5px var(--font-ui); color: var(--ink); transition: transform .14s; }
  .homebtn img { width: 38px; height: 38px; object-fit: contain; }
  .homebtn:hover { transform: translateY(-2px); }
  .homebtn:active { transform: translateY(3px); box-shadow: 0 1px 0 #94c8f0; }
  .me { flex: none; display: flex; align-items: center; gap: 6px; background: none; border: 0; cursor: pointer; padding: 0 8px 0 0; border-radius: 16px; }
  .me:hover { background: var(--bg2); }
  .nm { font: 600 21px var(--font-ui); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pill { flex: none; display: flex; align-items: center; gap: 7px; white-space: nowrap; background: var(--bg2); padding: 5px 12px; border-radius: 999px; font: 700 14px var(--font-body); color: var(--ink2); }
  .pill b { font: 600 18px var(--font-ui); color: var(--ink); }
  /* the minutes and the shells open a card: they look pressable */
  .tap { border: 0; cursor: pointer; box-shadow: inset 0 0 0 2px #e6def7, 0 3px 0 #e1d8f3; transition: transform .12s, box-shadow .12s; }
  .tap:hover { transform: translateY(-2px); box-shadow: inset 0 0 0 2px #d6c9f3, 0 5px 0 #d6c9f3; }
  .tap:active { transform: translateY(2px); box-shadow: inset 0 0 0 2px #d6c9f3, 0 1px 0 #d6c9f3; }
  .tap.on { background: #fff; box-shadow: inset 0 0 0 3px #ffc93d, 0 3px 0 #e8b92c; }
  .shells { background: #fff8e6; box-shadow: inset 0 0 0 2px #ffe3a0, 0 3px 0 #f3d27a; }
  .goal.met { background: #ecfaf2; box-shadow: inset 0 0 0 2px #bfe9d0, 0 3px 0 #a9dfc0; }
  .ft { display: flex; flex-direction: column; gap: 3px; }
  .ft b { font: 600 14.5px var(--font-ui); }
  .ft i { display: block; width: 130px; height: 6px; border-radius: 999px; background: #fff; overflow: hidden; }
  .ft em { display: block; height: 100%; background: linear-gradient(90deg, var(--primary-hi), var(--pink)); }
  .shells img { width: 26px; height: 26px; object-fit: contain; }
  .spacer { flex: 1; min-width: 0; }
  .tiles { display: flex; gap: 8px; flex: none; }
  .ti { object-fit: contain; }
  .ringpic { position: relative; display: grid; place-items: center; width: 100%; height: 100%; }
  .ringpic b { position: absolute; inset: 0; display: grid; place-items: center; font: 600 13px var(--font-ui); color: var(--ink); }

  /* short laptop screens (1280x720, 1366x768): a slimmer bar, so the page under it has the room */
  @media (max-height: 800px) and (min-width: 760px) {
    .tb { padding: 5px 14px; gap: 8px; }
    .lft, .rgt { gap: 8px; }
    .tiles :global(.tile) { padding: 3px 7px 4px; min-width: 64px; }
    .tiles :global(.tile .pic) { width: 30px !important; height: 30px !important; }
    .tiles :global(.tile .pic .art) { width: 30px !important; height: 30px !important; }
    .tiles :global(.tile .lbl) { font-size: 12.5px; }
    .homebtn img { width: 30px; height: 30px; }
    .homebtn { font-size: 12.5px; padding: 2px 7px 3px; }
  }

  /* phones: Home, you, shells and the round buttons on top; today's minutes and the tiles share a second row */
  .phone { flex-wrap: wrap; gap: 6px 5px; padding: 6px 8px 8px; }
  .phone .lft { gap: 5px; }
  .phone .spacer { display: none; }
  .phone .rgt { margin-left: auto; }
  .phone .homebtn { padding: 2px 5px; border-radius: 14px; }
  .phone .homebtn img { width: 30px; height: 30px; }
  .phone .homebtn span { display: none; }
  .phone .me { padding: 0; }
  .phone .nm { font-size: 17px; max-width: 96px; }
  .phone .pill { padding: 4px 9px; gap: 4px; }
  .phone .pill b { font-size: 16px; }
  .phone .shells img { width: 22px; height: 22px; }
  .phone .tiles { order: 10; width: 100%; gap: 5px; justify-content: space-between; }
  .phone .tiles > :global(.tile), .phone .todaytile { flex: 1 1 0; min-width: 0; }
  .phone .todaytile { display: flex; }
  .phone .todaytile :global(.tile) { flex: 1; }
  .phone .tiles :global(.tile) { min-width: 0; padding: 3px 2px 4px; }
  .phone .tiles :global(.tile .lbl) { font-size: 12px; white-space: nowrap; }
  .phone .tiles :global(.tile .pic), .phone .tiles :global(.tile .pic .art) { width: 30px !important; height: 30px !important; }
  .phone :global(.pair) { gap: 4px; }
  .phone :global(.gear), .phone :global(.mus), .phone :global(.menu), .phone :global(.help) { padding: 2px; border-width: 2px; }
</style>
