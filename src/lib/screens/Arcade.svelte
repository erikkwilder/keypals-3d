<script lang="ts">
  // The Arcade: a painted plaza on a sky island, the 3D buddy waving you in, and the game cabinets, each
  // with your best score and stars. Today's challenge sits on a banner: one game a day, the same course
  // for everyone in the family, and bonus shells for beating its goal. Arcade rounds count as practice:
  // every answer feeds the fact memory, and they earn stars, shells and treasure (not lessons).
  import { onDestroy, onMount } from 'svelte';
  import { game, type Screen } from '../state/game.svelte';
  import { advView } from '../adventure/state';
  import { ARCADE, ARCADE_GAMES, arcadeOf, dailyBeaten, dailyGame, dailyGoal, DAILY_SHELLS, type ArcadeId } from '../arcade/arcade';
  import { stage } from '../three/stage';
  import { PlazaScene } from '../three/arcade/plaza';
  import { FRIEND } from '../art/cast';
  import { sfx, unlockAudio } from '../audio/sound';
  import Stars from '../ui/Stars.svelte';
  import Icon from '../ui/Icon.svelte';
  import GearButton from '../ui/GearButton.svelte';

  const p = $derived(game.profile!);
  const save = $derived(arcadeOf(p));
  const shells = $derived(advView(p).shells);
  const today = dailyGame();
  const beaten = $derived(dailyBeaten(p, today));
  const buddyName = FRIEND[game.profile!.buddy].name;
  const fmt = (n: number) => n.toLocaleString('en-US');

  let scene: PlazaScene | null = null;
  let spotEl: HTMLDivElement | undefined = $state();
  let w = $state(1280), h = $state(800);
  const compact = $derived(w < 760);
  let say = $state('Pick a game to play!');
  let ready = $state(false);

  function place() {
    if (!scene || !spotEl) return;
    const r = spotEl.getBoundingClientRect();
    scene.spot = { x: (r.left + r.width / 2) / innerWidth, y: r.bottom / innerHeight, h: r.height / innerHeight };
  }
  $effect(() => { void w; void h; void compact; requestAnimationFrame(place); });

  function play(id: ArcadeId, daily = false) {
    unlockAudio();
    sfx.click();
    scene?.cheer();
    game.playArcade(id, daily);
  }
  /** Pizza Rush is the Fractions area's game, on its own screen */
  function openPizza() { unlockAudio(); sfx.click(); scene?.cheer(); game.go('pizza' as Screen); }
  /** Market Dash is the Decimals and money area's game, on its own screen too */
  function openMarket() { unlockAudio(); sfx.click(); scene?.cheer(); game.go('market' as Screen); }
  function hover(id: ArcadeId | 'pizza' | 'market' | null, el?: HTMLElement) {
    if (!scene) return;
    if (!id || !el) { scene.look(null); say = 'Pick a game to play!'; return; }
    const r = el.getBoundingClientRect();
    scene.look((r.left + r.width / 2) / innerWidth);
    say = id === 'slalom' ? 'Wheee, the snowy mountain!' : id === 'catch' ? 'Catch them all!' : id === 'tower' ? 'How tall can we go?' : id === 'market' ? 'Coins! Count them up!' : 'Pizza! Slice it up!';
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { game.go('map'); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= ARCADE_GAMES.length) play(ARCADE_GAMES[n - 1].id);
    if (n === ARCADE_GAMES.length + 1) openPizza();
    if (n === ARCADE_GAMES.length + 2) openMarket();
    if (e.key === 'd' || e.key === 'D') play(today, true);
  }

  onMount(() => {
    PlazaScene.create(game.profile!.buddy).then(sc => {
      scene = sc;
      place();
      stage.use(sc);
      ready = true;
      setTimeout(() => scene?.greet(), 400);
    });
    window.addEventListener('keydown', onKey);
  });
  onDestroy(() => { window.removeEventListener('keydown', onKey); stage.use(null); });
</script>

<div class="arcade" class:compact class:ready bind:clientWidth={w} bind:clientHeight={h}>
  <!-- the painted plaza shows from the 3D stage behind; until it's ready, the same painting here -->
  <div class="paint" style:background-image="url({import.meta.env.BASE_URL}arcade/bg-plaza.webp)"></div>

  <header class="top">
    <button class="btn btn-icon" aria-label="Back to the math map" onclick={() => { sfx.click(); game.go('map'); }}><Icon name="back" /></button>
    <img class="sign" src="{import.meta.env.BASE_URL}arcade/sign.webp" alt="Arcade" />
    <div class="rt">
      <span class="wallet"><img src="{import.meta.env.BASE_URL}game/icon-shell.webp" alt="" /><b>{fmt(shells)}</b>{#if !compact} shells{/if}</span>
      <GearButton size={compact ? 32 : 38} />
    </div>
  </header>

  <div class="stagebox" onscroll={place}>
    <div class="buddycol">
      <div class="bubble">{say}</div>
      <div class="spot" bind:this={spotEl} aria-label="{buddyName} waving"></div>
    </div>

    <div class="right">
      <button class="daily" class:done={beaten} onclick={() => play(today, true)} onpointerenter={(e) => hover(today, e.currentTarget)} onpointerleave={() => hover(null)}>
        <img class="dicon" src="{import.meta.env.BASE_URL}icons/daily.webp" alt="" />
        <span class="dtext">
          <small>Today's challenge</small>
          <b>{ARCADE[today].name}</b>
          <span>{beaten ? 'Beaten today! Play again any time.' : `Beat ${fmt(dailyGoal(today))} for ${DAILY_SHELLS} bonus shells`}</span>
        </span>
        <span class="dgo">{#if beaten}<Icon name="check" size={30} />{:else}Play{/if}</span>
      </button>

      <div class="cabs">
        {#each ARCADE_GAMES as g, i (g.id)}
          {@const r = save[g.id]}
          <button class="cab" style:--c={g.color} style:--d="{i * 90}ms" onclick={() => play(g.id)} onpointerenter={(e) => hover(g.id, e.currentTarget)} onpointerleave={() => hover(null)} onfocus={(e) => hover(g.id, e.currentTarget)}>
            {#if g.id === today && !beaten}<span class="ribbon">Today!</span>{/if}
            <img class="art" src="{import.meta.env.BASE_URL}{g.art}" alt="" />
            <span class="plate">
              <b>{g.name}</b>
              <span class="bs">{r?.plays ? `Best score ${fmt(r.best)}` : 'New! Give it a go'}</span>
              <Stars n={r?.stars ?? 0} of={3} size={compact ? 20 : 26} />
            </span>
            {#if !compact}<span class="kbd">{i + 1}</span>{/if}
          </button>
        {/each}
        <!-- Pizza Rush lives with the Fractions area (its own screen and records); its cabinet stands here too -->
        <button class="cab" style:--c="#e2452b" style:--d="{ARCADE_GAMES.length * 90}ms" onclick={openPizza} onpointerenter={(e) => hover('pizza', e.currentTarget)} onpointerleave={() => hover(null)}>
          <img class="art" src="{import.meta.env.BASE_URL}arcade/cab-pizza.webp" alt="" />
          <span class="plate"><b>Pizza Rush</b><span class="bs">Slice up fractions</span></span>
          {#if !compact}<span class="kbd">{ARCADE_GAMES.length + 1}</span>{/if}
        </button>
        <button class="cab" style:--c="#e6a817" style:--d="{(ARCADE_GAMES.length + 1) * 90}ms" onclick={openMarket} onpointerenter={(e) => hover('market', e.currentTarget)} onpointerleave={() => hover(null)}>
          <img class="art" src="{import.meta.env.BASE_URL}arcade/cab-market.webp" alt="" />
          <span class="plate"><b>Market Dash</b><span class="bs">Pay and make change</span></span>
          {#if !compact}<span class="kbd">{ARCADE_GAMES.length + 2}</span>{/if}
        </button>
      </div>
      <p class="note">Arcade games count as practice: every answer helps your Fact Garden grow, and you earn shells and treasure.</p>
    </div>
  </div>
</div>

<style>
  .arcade { position: absolute; inset: 0; display: flex; flex-direction: column; overflow: hidden; }
  .paint { position: absolute; inset: 0; background-size: cover; background-position: 50% 75%; z-index: -1; transition: opacity .5s; }
  .ready .paint { opacity: 0; }
  .top { position: relative; z-index: 3; display: flex; align-items: center; gap: 14px; padding: 10px 18px; background: linear-gradient(rgba(255, 255, 255, .92), rgba(255, 255, 255, .78)); box-shadow: 0 6px 20px -14px rgba(40, 30, 90, .5); }
  .sign { height: 64px; margin: -8px 0 -10px; filter: drop-shadow(0 4px 4px rgba(60, 30, 90, .25)); }
  .rt { margin-left: auto; display: flex; align-items: center; gap: 10px; }
  .wallet { display: inline-flex; align-items: center; gap: 6px; font: 600 18px var(--font-ui); color: var(--ink); background: #fff8e6; padding: 4px 14px 4px 6px; border-radius: 999px; box-shadow: inset 0 0 0 2px #ffe3a0; }
  .wallet img { width: 28px; height: 28px; object-fit: contain; }

  .stagebox { flex: 1; min-height: 0; display: flex; gap: 2%; padding: 18px 2.5% 20px; }
  .buddycol { flex: 0 0 22%; position: relative; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; }
  .spot { width: 100%; height: 43%; margin-bottom: 5vh; }
  .bubble { position: absolute; left: 6%; bottom: 62%; background: #fff; padding: 12px 18px; border-radius: 20px; font: 600 19px/1.15 var(--font-ui); color: var(--ink); box-shadow: 0 10px 24px -12px rgba(40, 30, 90, .5); max-width: 220px; animation: pop-in .35s cubic-bezier(.3, .8, .4, 1.5); }
  .bubble::after { content: ''; position: absolute; left: 34px; bottom: -10px; border: 10px solid transparent; border-top-color: #fff; border-bottom: 0; }

  .right { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-end; gap: 14px; }
  .daily { align-self: center; display: flex; align-items: center; gap: 12px; padding: 8px 10px 8px 8px; border: 0; cursor: pointer; text-align: left; border-radius: 24px; min-width: min(560px, 100%);
    background: linear-gradient(135deg, #fff9e8, #ffe9b0); box-shadow: 0 0 0 4px #fff, 0 0 0 7px #ffc93d, 0 14px 28px -12px rgba(140, 90, 0, .55); transition: transform .15s; animation: pop-in .45s cubic-bezier(.3, .8, .4, 1.4); }
  .daily:hover { transform: translateY(-3px) rotate(-.5deg); }
  .dicon { width: 60px; height: 60px; object-fit: contain; flex: none; filter: drop-shadow(0 4px 4px rgba(120, 80, 0, .3)); }
  .dtext { flex: 1; display: flex; flex-direction: column; }
  .dtext small { font: 800 11.5px var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: #a86a00; }
  .dtext b { font: 600 24px/1.1 var(--font-ui); color: #5a3800; }
  .dtext span { font: 700 14px var(--font-body); color: #7a5410; }
  .dgo { flex: none; display: grid; place-items: center; min-width: 84px; height: 52px; padding: 0 18px; border-radius: 18px; background: linear-gradient(#ffb43d, #f08a1c); color: #fff; font: 600 22px var(--font-ui); box-shadow: 0 4px 0 #c0650a; text-shadow: 0 1px 0 rgba(120, 50, 0, .5); }
  .daily.done { background: linear-gradient(135deg, #f1fff6, #d6f5e3); box-shadow: 0 0 0 4px #fff, 0 0 0 7px #7ed9a8, 0 14px 28px -12px rgba(0, 110, 60, .4); }
  .daily.done .dgo { background: #fff; box-shadow: 0 4px 0 #b6e6cc; }
  .daily.done small { color: #1f8a55; } .daily.done b { color: #0f5a3c; } .daily.done .dtext span { color: #2f6a4a; }

  .cabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.6%; align-items: end; }
  .cab { position: relative; display: flex; flex-direction: column; align-items: center; border: 0; background: none; padding: 0; cursor: pointer; animation: rise-in .5s var(--d) cubic-bezier(.3, .8, .4, 1.3) both; transition: transform .18s; }
  .cab:hover, .cab:focus-visible { transform: translateY(-8px) scale(1.03); }
  .cab:hover .art { filter: drop-shadow(0 18px 18px rgba(40, 30, 90, .35)) brightness(1.06); }
  .art { width: 100%; max-height: 38vh; object-fit: contain; object-position: bottom; filter: drop-shadow(0 14px 14px rgba(40, 30, 90, .3)); transition: filter .18s; margin-bottom: -18px; position: relative; z-index: 0; }
  .plate { position: relative; z-index: 1; width: 92%; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 8px 9px; border-radius: 18px; background: rgba(255, 255, 255, .97);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--c, #7c5cf5) 55%, #fff), 0 10px 20px -10px rgba(40, 30, 90, .45); }
  .plate b { font: 600 clamp(17px, 1.6vw, 22px)/1.1 var(--font-ui); color: var(--ink); white-space: nowrap; }
  .bs { font: 700 13px var(--font-body); color: var(--muted); white-space: nowrap; }
  .kbd { position: absolute; top: 6px; left: 8px; z-index: 2; }
  .ribbon { position: absolute; top: 4%; right: -4px; z-index: 2; padding: 4px 10px; border-radius: 10px; background: linear-gradient(#ffb43d, #f08a1c); color: #fff; font: 600 15px var(--font-ui); box-shadow: 0 3px 0 #c0650a; transform: rotate(8deg); }
  @keyframes rise-in { 0% { transform: translateY(40px) scale(.9); opacity: 0; } 100% { transform: none; opacity: 1; } }
  .note { margin: 0; align-self: center; text-align: center; font: 700 13.5px var(--font-body); color: #fff; text-shadow: 0 1px 4px rgba(40, 30, 60, .8); }

  /* phones: the challenge, the cabinets two by two, and the buddy waving from the terrace at the bottom */
  .compact .top { padding: 8px 10px; gap: 8px; }
  .compact .sign { height: 44px; margin: -6px 0; }
  .compact .stagebox { flex-direction: column; padding: 8px 12px 12px; gap: 8px; overflow-y: auto; }
  .compact .buddycol { order: 2; flex: 0 0 140px; flex-direction: row; align-items: flex-end; justify-content: flex-start; }
  .compact .spot { order: -1; width: 38%; height: 100%; margin: 0; }
  .compact .bubble { position: relative; left: auto; bottom: auto; margin: 0 0 70px 4px; font-size: 16px; padding: 10px 14px; max-width: 58%; }
  .compact .bubble::after { left: -8px; bottom: 14px; border: 8px solid transparent; border-right-color: #fff; border-left: 0; }
  .compact .right { justify-content: flex-start; gap: 10px; }
  .compact .daily { min-width: 0; width: 100%; gap: 8px; border-radius: 20px; }
  .compact .dicon { width: 46px; height: 46px; }
  .compact .dtext b { font-size: 19px; }
  .compact .dtext span { font-size: 12.5px; }
  .compact .dgo { min-width: 60px; height: 44px; padding: 0 12px; font-size: 18px; }
  .compact .cabs { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 10px; }
  .compact .art { max-height: 148px; margin-bottom: -14px; }
  .compact .plate b { font-size: 17px; }
  .compact .bs { font-size: 11.5px; }
  .compact .note { font-size: 12px; }
</style>
