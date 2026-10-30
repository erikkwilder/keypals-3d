<script lang="ts">
  // The Arcade: a painted plaza on a sky island, the 3D buddy waving you in, and the game cabinets, each
  // with your best score and stars. Today's challenge sits on a banner: one game a day, the same course
  // for everyone in the family, and bonus shells for beating its goal. Arcade rounds count as practice:
  // every answer feeds the fact memory, and they earn stars, shells and treasure (not lessons). Glimmer
  // Drop stands here too: just for fun, played with the same play time as Adventure.
  import { onDestroy, onMount } from 'svelte';
  import { game, type Screen } from '../state/game.svelte';
  import { advView, playLeft } from '../adventure/state';
  import { dropOf } from '../drop/save';
  import { ARCADE, ARCADE_GAMES, arcadeOf, dailyBeaten, dailyGame, dailyGoal, DAILY_SHELLS, type ArcadeId } from '../arcade/arcade';
  import { stage } from '../three/stage';
  import { PlazaScene } from '../three/arcade/plaza';
  import { FRIEND } from '../art/cast';
  import { sfx, unlockAudio } from '../audio/sound';
  import Stars from '../ui/Stars.svelte';
  import Icon from '../ui/Icon.svelte';
  import GearButton from '../ui/GearButton.svelte';
  import { builderOf, builderOpen } from '../math/place/builder';
  import { treasureOf } from '../math/integers/treasure';
  import { showdownOf } from '../math/data/showdown';
  import { beamOf } from '../math/algebra/beam';
  import { AREA } from '../math/skills/registry';
  import { rushOf as pizzaOf } from '../math/pizza/rush';
  import { dashOf } from '../math/market/dash';
  import { rushOf as clockOf } from '../math/measure/rush';
  import { shifterOf } from '../math/shapes/shifter';
  import { standOf } from '../math/ratios/stand';
  import type { Profile } from '../engine/profile';

  const p = $derived(game.profile!);
  const save = $derived(arcadeOf(p));
  const shells = $derived(advView(p).shells);
  const today = dailyGame();
  const beaten = $derived(dailyBeaten(p, today));
  const buddyName = FRIEND[game.profile!.buddy].name;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const drop = $derived(dropOf(p));
  const time = $derived(playLeft(p));
  const playText = $derived(!time.open ? 'Play time is used up today' : time.left === null ? 'Uses play time' : `${Math.max(0, Math.floor(time.left))} min of play time left`);
  /** back to wherever the Arcade was opened from: Home or the math map */
  const back = () => game.go(game.home);

  let scene: PlazaScene | null = null;
  let spotEl: HTMLDivElement | undefined = $state();
  let w = $state(1280), h = $state(800);
  const compact = $derived(w < 760);
  let say = $state('Pick a game to play!');
  let ready = $state(false);

  // Where the buddy can stand: the painted plaza's stone terrace (an oval) and the steps at its front, in
  // shares of the picture across and down. The picture covers the screen, anchored half way across and
  // three quarters down (as the 3D stage paints it), so a spot on the screen maps to a spot in the picture.
  const PIC = { w: 2048, h: 1153, ax: 0.5, ay: 0.75 };
  const TERRACE = { cx: 0.55, cy: 0.66, rx: 0.42 * 0.9, ry: 0.15 * 0.84 };
  const STEPS = { l: 0.3, r: 0.63, t: 0.85, b: 1 };
  /** the nearest spot on the terrace (or its steps) to where the page put the buddy's feet, in window pixels */
  function onFloor(x: number, y: number): [number, number] {
    const W = innerWidth, H = innerHeight, k = Math.max(W / PIC.w, H / PIC.h), dw = PIC.w * k, dh = PIC.h * k;
    const ox = (W - dw) * PIC.ax, oy = (H - dh) * PIC.ay;
    let u = (x - ox) / dw, v = (y - oy) / dh;
    if (u >= STEPS.l && u <= STEPS.r && v >= STEPS.t && v <= STEPS.b) return [x, y];
    const T = TERRACE;
    // keep across where the page wants it (inside the oval), then come up or down onto the stones
    u = Math.max(T.cx - T.rx * 0.98, Math.min(T.cx + T.rx * 0.98, u));
    const du = (u - T.cx) / T.rx, half = T.ry * Math.sqrt(Math.max(0, 1 - du * du));
    v = Math.max(T.cy - half, Math.min(T.cy + half, v));
    return [ox + u * dw, oy + v * dh];
  }
  /** how far the buddy was lifted onto the terrace (its speech bubble goes up with it) */
  let lift = $state({ x: 0, y: 0 });
  function place() {
    if (!scene || !spotEl) return;
    const r = spotEl.getBoundingClientRect();
    // (a phone: the buddy stands on the steps at the bottom of the page, under the cabinets, and scrolls with them)
    const fx0 = r.left + r.width / 2, [fx, fy] = compact ? [fx0, r.bottom] : onFloor(fx0, r.bottom);
    // further back on the terrace is further away: a little smaller
    const far = Math.max(0.55, Math.min(1, fy / Math.max(1, r.bottom)));
    scene.spot = { x: fx / innerWidth, y: fy / innerHeight, h: (r.height / innerHeight) * Math.pow(far, 1.4) };
    lift = { x: fx - fx0, y: fy - r.bottom + r.height * (1 - Math.pow(far, 1.4)) };
  }
  $effect(() => { void w; void h; void compact; requestAnimationFrame(place); });

  function play(id: ArcadeId, daily = false) {
    unlockAudio();
    sfx.click();
    scene?.cheer();
    game.playArcade(id, daily);
  }
  /** The math areas' own games, each on its own screen with its own records: their cabinets stand here after
   *  the fact games, in the order the areas came, each labelled with its area's name. A new area adds one
   *  line here (and its screen). */
  type Rec = { best: number; stars: number; plays: number };
  type AreaCab = { id: string; screen: Screen; name: string; part: string; color: string; art: string; say: string; line: string; rec: (p: Profile) => Rec; unit?: string; before?: () => void };
  const AREA_CABS: AreaCab[] = [
    { id: 'pizza', screen: 'pizza', name: 'Pizza Rush', part: AREA.fractions.name, color: '#e2452b', art: 'arcade/cab-pizza.webp', say: 'Pizza! Slice it up!', line: 'Slice up fractions', rec: pizzaOf },
    { id: 'builder', screen: 'builder', name: 'Number Builder', part: AREA.place.name, color: '#2d6fb8', art: 'arcade/cab-builder.webp', say: 'Build it with blocks!', line: 'Build numbers with blocks', rec: builderOf,
      before: () => { builderOpen.toy = false; builderOpen.from = 'arcade'; } },
    { id: 'market', screen: 'market', name: 'Market Dash', part: AREA.decimals.name, color: '#e6a817', art: 'arcade/cab-market.webp', say: 'Coins! Count them up!', line: 'Pay and make change', rec: dashOf },
    { id: 'clockrush', screen: 'clockrush', name: 'Clock Rush', part: AREA.measure.name, color: '#8a6bd6', art: 'arcade/cab-clock.webp', say: 'Tick-tock, catch the clocks!', line: 'Catch the clocks', rec: clockOf },
    { id: 'shifter', screen: 'shifter', name: 'Shape Shifter', part: AREA.shapes.name, color: '#6f4ff0', art: 'arcade/cab-shapes.webp', say: 'Catch the crystals!', line: 'Catch the crystal shapes', rec: shifterOf },
    { id: 'smoothie', screen: 'smoothie', name: 'Smoothie Stand', part: AREA.ratios.name, color: '#ef5f8a', art: 'arcade/cab-smoothie.webp', say: 'Smoothies! Mix them just right!', line: 'Mix smoothies just right', rec: standOf },
    { id: 'treasure', screen: 'treasure', name: 'Treasure Grid', part: AREA.integers.name, color: '#2f9ed8', art: 'arcade/cab-treasure.webp', say: 'Treasure! Dig it up!', line: 'Dig on the map', rec: treasureOf },
    { id: 'showdown', screen: 'showdown', name: 'Spinner Showdown', part: AREA.data.name, color: '#e2468f', art: 'arcade/cab-spinner.webp', say: 'Spin the big wheel!', line: 'Graphs, spinners and chances', rec: showdownOf, unit: 'tickets' },
    { id: 'balance', screen: 'balance', name: 'Balance Beam', part: AREA.algebra.name, color: '#6c4fd8', art: 'arcade/cab-balance.webp', say: 'Keep it level!', line: 'Keep the seesaw level', rec: beamOf },
  ];
  /** an area cabinet's plate: the best score once played (and its stars, like the fact games'), else what you do */
  const best = (c: AreaCab, r: Rec) => (!r.plays ? c.line : c.unit ? `Best ${fmt(r.best)} ${c.unit}` : `Best score ${fmt(r.best)}`);
  function openCab(c: AreaCab) { unlockAudio(); sfx.click(); scene?.cheer(); c.before?.(); game.gameFrom = 'arcade'; game.go(c.screen); }
  /** Glimmer Drop: just for fun, on its own screen (it spends play time); its cabinet is always last */
  function openDrop() { unlockAudio(); sfx.click(); scene?.cheer(); game.go('drop'); }
  /** each cabinet's own key, by its place: 1 to 9, then 0, then along the top row of letters (D is today's challenge) */
  const KEYS = '1234567890qwertyuiop';
  const keyOf = (place: number) => KEYS[place - 1] ?? '';
  const DROP_PLACE = ARCADE_GAMES.length + AREA_CABS.length + 1;
  function hover(id: string | null, el?: HTMLElement) {
    if (!scene) return;
    if (!id || !el) { scene.look(null); say = 'Pick a game to play!'; return; }
    const r = el.getBoundingClientRect();
    scene.look((r.left + r.width / 2) / innerWidth);
    say = id === 'slalom' ? 'Wheee, the snowy mountain!' : id === 'catch' ? 'Catch them all!' : id === 'tower' ? 'How tall can we go?' : id === 'drop' ? 'Squish them together!' : AREA_CABS.find(c => c.id === id)?.say ?? 'Pick a game to play!';
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { back(); return; }
    const n = KEYS.indexOf(e.key.toLowerCase()) + 1;
    if (n >= 1 && n <= ARCADE_GAMES.length) play(ARCADE_GAMES[n - 1].id);
    else if (n > ARCADE_GAMES.length && n <= ARCADE_GAMES.length + AREA_CABS.length) openCab(AREA_CABS[n - ARCADE_GAMES.length - 1]);
    else if (n === DROP_PLACE) openDrop();
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
    <button class="btn btn-icon" aria-label="Back" onclick={() => { sfx.click(); back(); }}><Icon name="back" /></button>
    <img class="sign" src="{import.meta.env.BASE_URL}arcade/sign.webp" alt="Arcade" />
    <div class="rt">
      {#if w >= 430}<span class="wallet"><img src="{import.meta.env.BASE_URL}game/icon-shell.webp" alt="" /><b>{fmt(shells)}</b>{#if !compact} shells{/if}</span>{/if}
      <GearButton size={compact ? 30 : 38} />
    </div>
  </header>

  <div class="stagebox" onscroll={place}>
    <div class="buddycol">
      <div class="bubble" style:translate="{lift.x}px {lift.y}px">{say}</div>
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
              <span class="part">Plus · Minus · Times · Share</span>
              <b>{g.name}</b>
              <span class="bs">{r?.plays ? `Best score ${fmt(r.best)}` : 'New! Give it a go'}</span>
              <Stars n={r?.stars ?? 0} of={3} size={compact ? 20 : 26} />
            </span>
            {#if !compact}<span class="kbd">{i + 1}</span>{/if}
          </button>
        {/each}
        <!-- the math areas' own games (their own screens and records); their cabinets stand here too -->
        {#each AREA_CABS as c, k (c.id)}
          {@const r = c.rec(p)}
          <button class="cab" style:--c={c.color} style:--d="{(ARCADE_GAMES.length + k) * 90}ms" onclick={() => openCab(c)} onpointerenter={(e) => hover(c.id, e.currentTarget)} onpointerleave={() => hover(null)}>
            <img class="art" src="{import.meta.env.BASE_URL}{c.art}" alt="" />
            <span class="plate"><span class="part">{c.part}</span><b>{c.name}</b><span class="bs">{best(c, r)}</span><Stars n={r.stars} of={3} size={compact ? 20 : 26} /></span>
            {#if !compact && keyOf(ARCADE_GAMES.length + k + 1)}<span class="kbd">{keyOf(ARCADE_GAMES.length + k + 1)}</span>{/if}
          </button>
        {/each}
        <!-- Glimmer Drop: not practice, just for fun, so it uses play time (the same minutes as Adventure) -->
        <button class="cab fun" style:--c="#9a6cf0" style:--d="{(DROP_PLACE - 1) * 90}ms" onclick={openDrop} onpointerenter={(e) => hover('drop', e.currentTarget)} onpointerleave={() => hover(null)}>
          <span class="ribbon fun">Just for fun</span>
          <img class="art" src="{import.meta.env.BASE_URL}arcade/cab-drop.webp" alt="" />
          <span class="plate"><b>Glimmer Drop</b><span class="bs">{drop.best ? `Best score ${fmt(drop.best)}` : 'New! Give it a go'}</span><span class="pt" class:out={!time.open}>{playText}</span></span>
          {#if !compact && keyOf(DROP_PLACE)}<span class="kbd">{keyOf(DROP_PLACE)}</span>{/if}
        </button>
      </div>
      <p class="note">Math games count as practice: every answer helps your Fact Garden grow, and you earn shells and treasure. Typing games are coming soon. Glimmer Drop is just for fun and uses play time.</p>
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

  /* (safe: on a short screen the cabinets start at the top and scroll, instead of running up under the bar) */
  .right { flex: 1; min-width: 0; min-height: 0; overflow-y: auto; scrollbar-width: none; display: flex; flex-direction: column; justify-content: safe flex-end; gap: 14px; padding-top: 12px; }
  .right::-webkit-scrollbar { display: none; }
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

  /* (never squeezed shorter than its cabinets when the column scrolls, or the last plates run under the note) */
  .cabs { flex: none; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1.4%; align-items: end; }
  .cab { position: relative; display: flex; flex-direction: column; align-items: center; border: 0; background: none; padding: 0; cursor: pointer; animation: rise-in .5s var(--d) cubic-bezier(.3, .8, .4, 1.3) both; transition: transform .18s; }
  .cab:hover, .cab:focus-visible { transform: translateY(-8px) scale(1.03); }
  .cab:hover .art { filter: drop-shadow(0 18px 18px rgba(40, 30, 90, .35)) brightness(1.06); }
  .art { width: 100%; max-height: 38vh; object-fit: contain; object-position: bottom; filter: drop-shadow(0 14px 14px rgba(40, 30, 90, .3)); transition: filter .18s; margin-bottom: -18px; position: relative; z-index: 0; }
  .plate { position: relative; z-index: 1; width: 92%; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 8px 9px; border-radius: 18px; background: rgba(255, 255, 255, .97);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--c, #7c5cf5) 55%, #fff), 0 10px 20px -10px rgba(40, 30, 90, .45); }
  .plate b { font: 600 clamp(17px, 1.6vw, 22px)/1.1 var(--font-ui); color: var(--ink); white-space: nowrap; }
  .bs { font: 700 13px var(--font-body); color: var(--muted); white-space: nowrap; }
  /* which part of math a cabinet is, with the chip names the Math page uses */
  .part { position: absolute; top: -11px; left: 50%; translate: -50% 0; max-width: 104%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 800 10.5px var(--font-body); color: #fff; background: var(--c, #7c5cf5); padding: 2px 8px; border-radius: 999px; box-shadow: 0 0 0 2px #fff; }
  .kbd { position: absolute; top: 6px; left: 8px; z-index: 2; }
  .ribbon.fun { background: linear-gradient(#b48cff, #8a5ce8); box-shadow: 0 3px 0 #6a3fc4; top: 30%; font-size: 13px; }
  .pt { font: 800 11.5px var(--font-body); color: #6a3fc4; background: #f1eaff; padding: 1px 8px; border-radius: 999px; white-space: nowrap; }
  .pt.out { color: #9a4a00; background: #fff1dc; }
  .ribbon { position: absolute; top: 4%; right: -4px; z-index: 2; padding: 4px 10px; border-radius: 10px; background: linear-gradient(#ffb43d, #f08a1c); color: #fff; font: 600 15px var(--font-ui); box-shadow: 0 3px 0 #c0650a; transform: rotate(8deg); }
  @keyframes rise-in { 0% { transform: translateY(40px) scale(.9); opacity: 0; } 100% { transform: none; opacity: 1; } }
  .note { margin: 0; align-self: center; text-align: center; font: 700 13.5px var(--font-body); color: #fff; text-shadow: 0 1px 4px rgba(40, 30, 60, .8); }

  /* short laptop screens (1280x720, 1366x768): smaller cabinets, so both rows and today's challenge fit */
  @media (max-height: 800px) {
    .arcade:not(.compact) .stagebox { padding-top: 6px; padding-bottom: 10px; }
    .arcade:not(.compact) .art { max-height: 20vh; margin-bottom: -14px; }
    .arcade:not(.compact) .cabs { row-gap: 18px; }
    .arcade:not(.compact) .daily { padding: 5px 8px 5px 6px; }
    .arcade:not(.compact) .dicon { width: 46px; height: 46px; }
    .arcade:not(.compact) .dtext b { font-size: 20px; }
    .arcade:not(.compact) .dgo { height: 44px; }
    .arcade:not(.compact) .plate { padding: 7px 6px 7px; gap: 2px; }
    .arcade:not(.compact) .right { gap: 12px; }
  }
  /* phones: the challenge, the cabinets two by two, and the buddy waving from the terrace at the bottom */
  .compact .top { padding: 8px 10px; gap: 8px; }
  .compact .sign { height: auto; max-height: 44px; min-width: 0; max-width: 38vw; object-fit: contain; margin: -6px 0; }
  .top .btn-icon { flex: none; }
  .compact .rt { gap: 6px; }
  .compact .rt :global(.pair) { gap: 4px; }
  .compact .rt :global(.gear), .compact .rt :global(.mus), .compact .rt :global(.menu), .compact .rt :global(.help) { padding: 3px; border-width: 2px; }
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
