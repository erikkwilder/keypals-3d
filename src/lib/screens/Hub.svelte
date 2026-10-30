<script lang="ts">
  // Home: the first thing you see. Under the one top bar (ui/Bar.svelte): your buddy and one line of hello
  // (and where your progress is kept, only when it matters); Today (path/TodayCard.svelte), the one best
  // next thing with one big Continue; and "Where to?", one grid of big picture tiles: the subjects
  // (Typing, Math: a new subject in subjects.ts adds a tile) and the places (Arcade, Adventure, My Sky
  // Island). Nothing else: "How Keypals works" is in the Menu's About.
  import { game } from '../state/game.svelte';
  import { outfitOf, todayMs } from '../engine/profile';
  import { sfx } from '../audio/sound';
  import { cloud, goSaveOnline, saveStatus, staySignedOut } from '../state/cloud.svelte';
  import { homeTiles } from '../nav';
  import Bar from '../ui/Bar.svelte';
  import Critter from '../ui/Critter.svelte';
  import ClassWorkCard from '../ui/ClassWorkCard.svelte';
  import TodayCard from '../path/TodayCard.svelte';
  import { buddyPicture, storedPicture } from '../three/buddyPic';
  import { dressOf } from '../adventure/wardrobe';
  import { nextFor } from '../path/player.svelte';
  import { startItem } from '../path/launch';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const look = $derived(p.settings.look);
  const goalMs = $derived(p.settings.dailyGoalMin * 60000);
  const today = $derived(todayMs(p));
  let sw = $state(1280);
  // the buddy by the hello: first the real 3D buddy's picture in everything it has on, saved on this
  // computer so a refresh shows it dressed straight away (the plain picture only if it can't be drawn);
  // then, by itself, the live 3D buddy in its place (fun/FunLayer.svelte, fun/liveBuddy.ts), standing on
  // its own little shadow
  const budPx = $derived(sw < 600 ? 64 : 96);
  let budPic = $state<string | null>(null), budWait = $state(true);
  $effect(() => {
    const id = p.buddy, dress = JSON.parse(JSON.stringify(dressOf(p))), size = budPx * 2;
    void p.settings.look;
    let gone = false;
    const kept = storedPicture(id, dress, size);
    if (kept) { budPic = kept; budWait = false; }
    else { budWait = true; setTimeout(() => { if (!gone) budWait = false; }, 2500); }
    void buddyPicture(id, { dress, size, keep: true }).then(u => { if (gone) return; if (u) budPic = u; budWait = false; });
    return () => { gone = true; };
  });
  const hello = $derived(today === 0 ? `Hi ${p.name}! Ready?` : today >= goalMs ? `Goal done for today, ${p.name}!` : `Welcome back, ${p.name}!`);
  // where progress is kept: a small line, only when it matters (not saved online yet)
  const save = $derived(saveStatus(p));
  const tiles = $derived(homeTiles(p));

  function onKey(e: KeyboardEvent) {
    if (game.modalOpen || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) { const n = nextFor(p); if (n) { e.preventDefault(); startItem(p, n.unit.unit, n.item); } }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="screen hub" bind:clientWidth={sw}>
  <Bar />

  <div class="body scroll">
    <div class="hello">
      <div class="bud" style:width="{budPx}px" style:height="{budPx}px">{#if budPic}<img class="budpic" src={budPic} alt={p.name} draggable="false" />{:else}<span class:waiting={budWait}><Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={budPx} mood="idle" /></span>{/if}</div>
      <div class="htx">
        <p>{hello}</p>
        {#if cloud.signedOut}
          <span class="note">You were signed out. <button class="linky" onclick={() => { sfx.click(); goSaveOnline(); }}>Sign in again</button> · <button class="linky" onclick={() => { sfx.click(); staySignedOut(); }}>Stay signed out</button></span>
        {:else if cloud.online && save.kind === 'local'}
          <span class="note">Not saved online yet: <button class="linky" onclick={() => { sfx.click(); goSaveOnline(); }}>Save it</button></span>
        {/if}
      </div>
    </div>

    <TodayCard compact={sw < 600} home /><!-- the one best next thing, and Continue -->
    <ClassWorkCard compact={sw < 600} /><!-- a class player's class work (only in a class) -->

    <h2 class="rowh">Where to?</h2>
    <div class="where">
      {#each tiles as t (t.id)}
        <button class="tile" onclick={t.go}>
          <span class="pic" style:background-image="url({base}{t.art})"><img class="ic" src="{base}{t.icon}" alt="" /></span>
          <span class="tx"><b>{t.name}</b><small>{t.line}</small></span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .hub { display: flex; flex-direction: column; background: linear-gradient(#d7edfb, #eef7ff 55%, #f7f3ff); }
  .body { flex: 1; min-height: 0; padding: 14px 24px 28px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .body > * { width: min(1240px, 100%); }
  .hello { display: flex; align-items: center; gap: 14px; }
  .bud { flex: none; position: relative; isolation: isolate; margin: -10px 0 2px; }
  /* its ground: a soft shadow under its feet (the picture and the live buddy both stand on it) */
  .bud::after { content: ''; position: absolute; left: 14%; right: 14%; bottom: -5px; height: 12px; border-radius: 50%; background: radial-gradient(closest-side, rgba(60, 40, 110, .3), rgba(60, 40, 110, 0)); z-index: -1; pointer-events: none; }
  .budpic { display: block; width: 100%; height: 100%; object-fit: contain; object-position: bottom; user-select: none; }
  .waiting { visibility: hidden; }
  .htx { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .htx p { margin: 0; font: 600 28px/1.15 var(--font-ui); color: var(--ink); }
  .note { font: 700 14px var(--font-body); color: #8a4a00; }
  .linky { border: 0; background: none; padding: 0; cursor: pointer; font: 800 14px var(--font-body); color: #b25a1e; text-decoration: underline; text-underline-offset: 3px; }
  .rowh { margin: 4px 0 -6px; font: 600 22px var(--font-ui); color: var(--ink2); }

  /* Where to? one grid of big, equal picture tiles: a picture, a name, one line, no buttons inside */
  .where { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; }
  .tile { display: flex; flex-direction: column; border: 0; padding: 0; cursor: pointer; text-align: left; border-radius: 24px; overflow: hidden; background: #fff; box-shadow: 0 14px 30px -20px rgba(60, 40, 110, .6), 0 0 0 3px #fff; transition: transform .16s; }
  .tile:hover, .tile:focus-visible { transform: translateY(-4px); box-shadow: 0 18px 34px -20px rgba(60, 40, 110, .7), 0 0 0 3px #c9b8ff; }
  .pic { position: relative; height: clamp(110px, 19vh, 190px); background: #dfeaf6 center / cover no-repeat; }
  .ic { position: absolute; left: 12px; bottom: -22px; width: 58px; height: 58px; object-fit: contain; padding: 4px; border-radius: 18px; background: #fff; box-shadow: 0 6px 14px -6px rgba(30, 10, 60, .45); }
  .tx { display: flex; flex-direction: column; gap: 2px; padding: 28px 14px 14px; }
  .tx b { font: 600 24px/1.1 var(--font-ui); color: var(--ink); }
  .tx small { font: 700 14px/1.3 var(--font-body); color: var(--muted); }

  @media (max-width: 1100px) { .where { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-height: 760px) and (min-width: 1100px) {
    .body { gap: 10px; padding-top: 8px; }
    .pic { height: 120px; }
    .tx { padding: 24px 12px 10px; }
    .tx b { font-size: 21px; }
  }
  @media (max-width: 600px) {
    .body { padding: 10px 12px 20px; gap: 10px; }
    .htx p { font-size: 22px; }
    .where { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .pic { height: 92px; }
    .ic { width: 46px; height: 46px; bottom: -18px; left: 8px; border-radius: 14px; }
    .tx { padding: 22px 10px 10px; }
    .tx b { font-size: 19px; }
    .tx small { font-size: 12.5px; }
  }
</style>
