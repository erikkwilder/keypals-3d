    if (!esc || e.key !== 'Escape' || home<script lang="ts">
  // The one top bar, the same on every screen that isn't an activity (state/where.ts says which are).
  // Left: on Home, the player (buddy face and name: tap to switch player); everywhere else one round Back
  // (up one level, or back to where a cross-link came from: game.back) and the page's title, with a small
  // trail under it on the levels below a subject ("Math › Fractions"). Esc is Back too.
  // Right: exactly four round buttons, in this order on every screen, each naming itself on hover (a long
  // press on a touch screen): Shells (how many: opens the shells card), My stuff, Ideas and help, Menu.
  // On a phone: Shells, My stuff, Menu (Ideas and help is in the Menu).
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { outfitOf } from '../engine/profile';
  import { advView } from '../adventure/state';
  import { placeName, trailOf } from '../nav';
  import { STUFF_PAGES } from '../state/where';
  import Critter from './Critter.svelte';
  import ShellsCard from './ShellsCard.svelte';
  import { tips } from './tips';
  import '../state/shellLog.svelte';

  /** `overlay`: a page opened over another screen (Settings): Esc works while it's open */
  /** `trail`: a line under the title other than where the page sits (My Sky Island: its size); `esc`: false on a
   *  page that closes its own things with Esc first and then calls game.back() itself */
  type Props = { title?: string; back?: () => void; overlay?: boolean; trail?: string; esc?: boolean };
  let { title, back, overlay = false, trail: line, esc = true }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile);
  const home = $derived(game.screen === 'hub' && !overlay);
  const here = $derived(game.here());
  const name = $derived(title ?? placeName(here));
  const trail = $derived(line ?? (overlay ? '' : trailOf(here)));
  const up = $derived(game.backTo());
  const backName = $derived(overlay ? 'where you were' : up ? placeName(up) : 'Home');
  const shells = $derived(p ? advView(p).shells : 0);
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  const inStuff = $derived(game.screen === 'mystuff' || STUFF_PAGES.has(game.screen));
  let w = $state(1280);
  const phone = $derived(w < 600);

  function goBack() { sfx.click(); if (back) back(); else game.back(); }
  let card = $state(false);
  let shellEl: HTMLElement | null = $state(null);
  function onKey(e: KeyboardEvent) {
    if (!esc || e.key !== 'Escape' || home || card || (overlay ? !!game.sheet || game.menuOpen : game.modalOpen)) return;
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
    e.preventDefault();
    goBack();
  }
</script>

<svelte:window onkeydown={onKey} bind:innerWidth={w} />

<header class="bar" class:phone data-bar use:tips>
  <div class="lft">
    {#if home && p}
      <button class="me" onclick={() => { sfx.click(); game.go('players'); }} title="{p.name}: switch player" aria-label="{p.name}: switch player">
        <Critter friend={p.buddy} look={p.settings.look} accessory={outfitOf(p)} size={phone ? 40 : 46} round />
        <span class="nm">{p.name}</span>
      </button>
    {:else}
      <button class="round back" onclick={goBack} title="Back to {backName}" aria-label="Back to {backName}">
        <img src="{base}icons/back.webp" alt="" draggable="false" />
      </button>
      <div class="tt">
        <h1>{name}</h1>
        {#if trail}<span class="trail">{trail}</span>{/if}
      </div>
    {/if}
  </div>
  {#if p}
    <nav class="rgt" aria-label="Shells, My stuff, Ideas and help, Menu">
      <button class="shells" class:on={card} bind:this={shellEl} title="Shells: {fmt(shells)}" aria-label="Shells: {fmt(shells)}" aria-expanded={card} onclick={() => { sfx.click(); card = !card; }}>
        <img src="{base}game/icon-shell.webp" alt="" draggable="false" /><b>{fmt(shells)}</b>
      </button>
      <button class="round stuff" class:on={inStuff} title="My stuff" aria-label="My stuff" onclick={() => { sfx.click(); game.visit('mystuff'); }}>
        <img src="{base}game/chest.webp" alt="" draggable="false" />
      </button>
      {#if !phone}
        <button class="round help" class:on={game.screen === 'ideas'} title="Ideas and help" aria-label="Ideas and help" onclick={() => { sfx.click(); game.openIdeas(); }}>
          <img src="{base}icons/bulb.webp" alt="" draggable="false" />
        </button>
      {/if}
      <button class="round menu" title="Menu" aria-label="Menu" onclick={(e) => { (e.currentTarget as HTMLElement).blur(); sfx.click(); game.openMenu(); }}>
        <img src="{base}icons/menu.webp" alt="" draggable="false" />
      </button>
    </nav>
  {/if}
</header>

{#if card}<ShellsCard anchor={shellEl} onclose={() => (card = false)} />{/if}

<style>
  .bar { flex: none; position: relative; z-index: 6; box-sizing: border-box; height: 68px; display: flex; align-items: center; gap: 12px; padding: 0 16px; background: #fff; border-bottom: 1px solid #ece6f6; box-shadow: 0 6px 18px -16px rgba(60, 40, 110, .45); }
  .lft { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; }
  .rgt { flex: none; display: flex; align-items: center; gap: 10px; }
  .round { flex: none; width: 50px; height: 50px; display: grid; place-items: center; padding: 0; border-radius: 50%; border: 2px solid #e6def5; background: #fbf9ff; cursor: pointer; box-shadow: 0 3px 0 #e6def5; transition: transform .14s; }
  .round img { width: 38px; height: 38px; object-fit: contain; user-select: none; }
  .round:hover { transform: translateY(-2px); }
  .round:active { transform: translateY(2px); box-shadow: 0 1px 0 #e6def5; }
  .round.on { border-color: #ffc93d; box-shadow: 0 3px 0 #e8b92c; background: #fffaf0; }
  .back img { width: 34px; height: 34px; }
  .tt { min-width: 0; display: flex; flex-direction: column; justify-content: center; }
  h1 { margin: 0; font: 600 26px/1.1 var(--font-ui); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .trail { font: 700 13.5px/1.2 var(--font-body); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .me { flex: none; display: flex; align-items: center; gap: 8px; background: none; border: 0; cursor: pointer; padding: 2px 12px 2px 2px; border-radius: 999px; }
  .me:hover { background: var(--bg2); }
  .nm { font: 600 22px var(--font-ui); color: var(--ink); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .shells { flex: none; height: 46px; display: flex; align-items: center; gap: 6px; padding: 0 14px 0 6px; border-radius: 999px; border: 2px solid #ffe3a0; background: #fff8e6; box-shadow: 0 3px 0 #f3d27a; cursor: pointer; transition: transform .14s; }
  .shells img { width: 32px; height: 32px; object-fit: contain; }
  .shells b { font: 600 19px var(--font-ui); color: var(--ink); }
  .shells:hover { transform: translateY(-2px); }
  .shells.on { border-color: #ffc93d; background: #fff; }

  /* short laptop screens (1280x720): a slimmer bar, so the page has the room */
  @media (max-height: 760px) and (min-width: 600px) {
    .bar { height: 60px; }
    .round { width: 44px; height: 44px; }
    .round img { width: 32px; height: 32px; }
    .shells { height: 42px; }
    h1 { font-size: 23px; }
  }
  .phone { height: 58px; gap: 8px; padding: 0 10px; }
  .phone .rgt { gap: 6px; }
  .phone .round { width: 42px; height: 42px; }
  .phone .round img { width: 30px; height: 30px; }
  .phone .back img { width: 28px; height: 28px; }
  .phone h1 { font-size: 20px; }
  .phone .trail { font-size: 12px; }
  .phone .shells { height: 40px; padding: 0 10px 0 4px; }
  .phone .shells img { width: 26px; height: 26px; }
  .phone .shells b { font-size: 16px; }
  .phone .nm { font-size: 18px; max-width: 110px; }
</style>
