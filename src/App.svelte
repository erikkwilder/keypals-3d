<script lang="ts">
  import { onMount } from 'svelte';
  import { game } from './lib/state/game.svelte';
  import { configureSound, startMusic, unlockAudio, setMusicStyle, setMusicStation, setPlaceStation } from './lib/audio/sound';
  import { lastWorld, stationOf } from './lib/adventure/worlds';
  import { NODE, ISLAND } from './lib/adventure/state';
  import SvgDefs from './lib/ui/SvgDefs.svelte';
  // the title is the only screen that comes with the first page; every other screen (its 3D scene, its
  // games, its data) loads when it first opens (ui/lazy.svelte.ts), so the first download is small
  import Title from './lib/screens/Title.svelte';
  import Loading from './lib/ui/Loading.svelte';
  import { lazy, preloadWhenIdle, type Lazy } from './lib/ui/lazy.svelte';
  // the 100-Glimmer ladder's special eggs' moments (looked for on the calm screens)
  import { CALM_SCREENS, lookForEggs } from './lib/adventure/ladderMoment.svelte';
  import { installProblemReports } from './lib/state/reports';
  import { countScreen, countPlayer } from './lib/state/counting';
  import { untrack } from 'svelte';
  // My path, and the doors grown-ups and teachers can close (the free-time places' daily time, the path first)
  import { doorFor } from './lib/path/rules';
  import { freeClock, playerRules, watchFree } from './lib/path/player.svelte';
  import { loadClasses, startClasses } from './lib/teach/student.svelte';
  import { cloud, startCloud } from './lib/state/cloud.svelte';
  import FancyAntIntro, { introDue } from './lib/ui/FancyAntIntro.svelte';

  const S = {
    players: lazy(() => import('./lib/screens/Players.svelte')),
    newPlayer: lazy(() => import('./lib/screens/NewPlayer.svelte')),
    hub: lazy(() => import('./lib/screens/Hub.svelte')),
    mapScreen: lazy(() => import('./lib/screens/MapScreen.svelte')),
    mathMap: lazy(() => import('./lib/screens/MathMap.svelte')),
    run: lazy(() => import('./lib/screens/Run.svelte')),
    results: lazy(() => import('./lib/screens/Results.svelte')),
    stickers: lazy(() => import('./lib/screens/Stickers.svelte')),
    closet: lazy(() => import('./lib/screens/Closet.svelte')),
    shop: lazy(() => import('./lib/screens/Shop.svelte')),
    subject: lazy(() => import('./lib/screens/Subject.svelte')),
    topic: lazy(() => import('./lib/screens/Topic.svelte')),
    way: lazy(() => import('./lib/screens/WayPage.svelte')),
    progress: lazy(() => import('./lib/screens/Progress.svelte')),
    grownups: lazy(() => import('./lib/screens/Grownups.svelte')),
    mathRun: lazy(() => import('./lib/screens/MathRun.svelte')),
    mathResults: lazy(() => import('./lib/screens/MathResults.svelte')),
    skillRun: lazy(() => import('./lib/screens/SkillRun.svelte')),
    skillResults: lazy(() => import('./lib/screens/SkillResults.svelte')),
    skills: lazy(() => import('./lib/screens/SkillsReport.svelte')),
    garden: lazy(() => import('./lib/screens/FactGarden.svelte')),
    playground: lazy(() => import('./lib/screens/Playground.svelte')),
    adventure: lazy(() => import('./lib/screens/Adventure.svelte')),
    battle: lazy(() => import('./lib/screens/Battle.svelte')),
    glimmers: lazy(() => import('./lib/screens/Glimmers.svelte')),
    glimmerBook: lazy(() => import('./lib/screens/GlimmerBook.svelte')), // Glimmers' All 100 tab
    eggs: lazy(() => import('./lib/screens/Eggs.svelte')),
    learn: lazy(() => import('./lib/screens/Learn.svelte')),
    duel: lazy(() => import('./lib/screens/Duel.svelte')),
    rivals: lazy(() => import('./lib/screens/Rivals.svelte')),
    pizza: lazy(() => import('./lib/screens/PizzaRush.svelte')),
    builder: lazy(() => import('./lib/screens/NumberBuilder.svelte')),
    market: lazy(() => import('./lib/screens/MarketDash.svelte')),
    clockrush: lazy(() => import('./lib/screens/ClockRush.svelte')),
    bench: lazy(() => import('./lib/screens/MeasureBench.svelte')),
    shifter: lazy(() => import('./lib/screens/ShapeShifter.svelte')),
    shapebuilder: lazy(() => import('./lib/screens/ShapeBuilder.svelte')),
    smoothie: lazy(() => import('./lib/screens/SmoothieStand.svelte')),
    treasure: lazy(() => import('./lib/screens/TreasureGrid.svelte')),
    showdown: lazy(() => import('./lib/screens/SpinnerShowdown.svelte')),
    balance: lazy(() => import('./lib/screens/BalanceBeam.svelte')),
    drop: lazy(() => import('./lib/screens/GlimmerDrop.svelte')),
    island: lazy(() => import('./lib/screens/SkyIsland.svelte')), // My Sky Island
    arcade: lazy(() => import('./lib/screens/Arcade.svelte')),
    arcadePlay: lazy(() => import('./lib/screens/ArcadePlay.svelte')),
    ideas: lazy(() => import('./lib/screens/Ideas.svelte')),
    mystuff: lazy(() => import('./lib/screens/MyStuff.svelte')),
    about: lazy(() => import('./lib/screens/About.svelte')),
    teach: lazy(() => import('./lib/screens/Teach.svelte')),
    classLogin: lazy(() => import('./lib/screens/ClassLogin.svelte')),
    boards: lazy(() => import('./lib/screens/Boards.svelte')),
    path: lazy(() => import('./lib/screens/MyPath.svelte')),
    door: lazy(() => import('./lib/path/Door.svelte')),
  };
  // the layers over the screens
  const O = {
    settings: lazy(() => import('./lib/screens/Settings.svelte')),
    chart: lazy(() => import('./lib/ui/LessonChart.svelte')),
    sheet: lazy(() => import('./lib/ui/QuickSettings.svelte')),
    music: lazy(() => import('./lib/ui/MusicPicker.svelte')),
    menu: lazy(() => import('./lib/ui/GlobalMenu.svelte')),
    pause: lazy(() => import('./lib/ui/PauseCard.svelte')),
    ladder: lazy(() => import('./lib/ui/LadderMoment.svelte')),
    fun: lazy(() => import('./lib/fun/FunLayer.svelte')),
  };

  $effect(() => { const s = game.screen, id = game.profile?.id; if (id && CALM_SCREENS.has(s)) untrack(() => setTimeout(() => { if (game.screen === s) lookForEggs(); }, 700)); });
  // counting visits (no identifiers: counts.ts): every screen opened, and each player's first visit today
  $effect(() => { const s = game.screen; untrack(() => countScreen(s)); });
  $effect(() => {
    const p = game.profile, s = game.screen;
    if (p && s !== 'title' && s !== 'players' && s !== 'newPlayer') untrack(() => countPlayer(p));
  });
  // a class player's class rules (and class work) as soon as the server answers, whatever screen is open
  $effect(() => { const on = cloud.online, id = game.profile?.id; if (on && id) untrack(() => void loadClasses(game.profile)); });
  // (a Learn episode opened over a subject page, as the market's and the clockmaker's are, is Learn)
  const door = $derived(game.profile ? doorFor((game.screen === 'map' || game.screen === 'way') && game.learnOverlay ? 'learn' : game.screen, game.closetTab, game.profile, playerRules(game.profile), Date.now(), freeClock.running) : null);
  // minutes count while a free-time place is open (not while its door is shut)
  $effect(() => { const s = game.screen, t = game.closetTab, id = game.profile?.id ?? null, shut = !!door; untrack(() => watchFree(shut ? 'hub' : s, t, id)); });
  // the FancyAnt film plays once a visit when the game opens (not on dev shortcuts like #run=)
  let intro = $state(!location.hash && introDue());
  // every 3D buddy dresses from the player's save: its hat, everything else it has on, and its nudges
  // (the 3D code comes after the first page: it's set before any screen that dresses a buddy can load)
  void Promise.all([import('./lib/three/dress'), import('./lib/adventure/wardrobe')]).then(([d, w]) => d.setDressSource(b => (game.profile ? w.dressOf(game.profile, b) : null)));

  $effect(() => {
    const s = game.settings;
    const root = document.documentElement;
    root.dataset.look = s.look;
    root.dataset.font = s.font;
    root.dataset.motion = s.reducedMotion ? 'reduced' : 'full';
    configureSound({ sound: s.sound, music: s.music, volume: s.volume });
    setMusicStyle(s.musicStyle ?? 'sunny');
    setMusicStation(s.musicStation ?? 'auto');
  });

  // the first game a player starts (a math trip, the playground, a battle, a duel) asks how things should
  // sound, once per player; a typing lesson asks for itself, before its coach starts talking
  $effect(() => {
    const scr = game.screen;
    if (!['mathRun', 'skillRun', 'playground', 'battle', 'duel', 'drop', 'arcadePlay', 'pizza', 'builder', 'market', 'clockrush', 'smoothie', 'treasure', 'showdown', 'balance'].includes(scr) || !game.profile || game.profile.soundSetup || game.sheet) return;
    setTimeout(() => { if (game.screen === scr && game.profile && !game.profile.soundSetup && !game.sheet) game.openSheet('setup'); }, 300);
  });

  // menu music on the screens around the lessons; Adventure's own on its screens and the Arcade's (Auto
  // plays an adventure there; a picked station just keeps playing)
  const ADVENTURE_SCREENS = new Set(['adventure', 'battle', 'duel', 'rivals', 'glimmers', 'eggs', 'drop', 'arcade', 'arcadePlay', 'pizza', 'builder', 'market', 'clockrush', 'shifter', 'shapebuilder', 'smoothie', 'treasure', 'showdown', 'balance']);
  $effect(() => {
    const scr = game.screen;
    if (scr !== 'run' && scr !== 'mathRun' && scr !== 'skillRun' && scr !== 'title') startMusic(ADVENTURE_SCREENS.has(scr) ? 'adventure' : 'menu');
    // a world with a station of its own plays it on its map and in its battles (the Chance Fair: World)
    const node = scr === 'battle' ? NODE[game.battleNode ?? ''] : null;
    if (scr !== 'showdown') setPlaceStation(scr === 'adventure' ? stationOf(lastWorld.id) : node ? stationOf(ISLAND[node.island]?.world) : null);
  });

  // the next screens a player is likely to open come down while the title is up (one at a time, when the
  // computer is quiet); from Home, the pages it leads to
  preloadWhenIdle([S.players, S.newPlayer, S.hub, O.pause]);
  let homeSeen = false;
  $effect(() => { if (game.screen === 'hub' && !homeSeen) { homeSeen = true; untrack(() => preloadWhenIdle([S.subject, S.topic, S.way, S.path, S.mystuff, O.menu, O.music, O.ladder, O.fun], 2500)); } });

  // the loading screen's picture (index.html) stays under the title until the 3D island is on screen, or
  // until another screen opens; then it fades away
  function bootGone() {
    const b = document.getElementById('kp-boot');
    if (!b || b.classList.contains('gone')) return;
    b.classList.add('gone');
    setTimeout(() => b.remove(), 700);
  }
  $effect(() => { if (game.screen !== 'title') untrack(bootGone); });

  let canvas: HTMLCanvasElement | undefined = $state();
  onMount(() => {
    if (canvas) {
      const c = canvas;
      const mo = new MutationObserver(() => { if (c.style.visibility === 'visible') { mo.disconnect(); bootGone(); } });
      mo.observe(c, { attributes: true, attributeFilter: ['style'] });
    }
    // the 3D stage (three.js) comes after the first page too: the title's words and button don't need it
    void import('./lib/three/stage').then(({ stage }) => {
      if (canvas) stage.mount(canvas, game.settings.graphics === 'low');
      stage.onAutoSmooth = () => game.say('Switched to smooth mode so the game runs better on this computer. You can change it in Settings.', 6000);
    });
    installProblemReports();
    // the dev shortcuts (#run=..., #tester) only when asked for
    if (import.meta.env.DEV || location.hash) void import('./lib/state/dev').then(m => m.devBoot());
    startCloud();
    startClasses();
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
  });
</script>

{#snippet screen(l: Lazy, props: Record<string, unknown> = {})}
  {#if l.c}{@const C = l.c}<C {...props} />{:else}<Loading failed={l.failed} retry={l.retry} />{/if}
{/snippet}
{#snippet layer(l: Lazy, props: Record<string, unknown> = {})}
  {#if l.c}{@const C = l.c}<C {...props} />{/if}
{/snippet}

<SvgDefs />
<canvas class="stage3d" bind:this={canvas} aria-hidden="true"></canvas>
<main class="app">
  {#if door}{@render screen(S.door, { door })}
  {:else if game.screen === 'title'}<Title />
  {:else if game.screen === 'players'}{@render screen(S.players)}
  {:else if game.screen === 'newPlayer'}{@render screen(S.newPlayer)}
  {:else if game.screen === 'hub'}{@render screen(S.hub)}
  {:else if game.screen === 'map'}{#key `${game.subject}:${game.topic}`}{#if game.subject === 'typing'}{@render screen(S.mapScreen)}{:else}{@render screen(S.mathMap)}{/if}{/key}
  {:else if game.screen === 'run'}{#key game.runKey}{@render screen(S.run)}{/key}
  {:else if game.screen === 'results'}{@render screen(S.results)}
  {:else if game.screen === 'stickers'}{@render screen(S.stickers)}
  {:else if game.screen === 'closet'}{#key 'wardrobe'}{@render screen(S.closet, { mode: 'wardrobe' })}{/key}
  {:else if game.screen === 'keypals'}{#key 'keypals'}{@render screen(S.closet, { mode: 'keypals' })}{/key}
  {:else if game.screen === 'dances'}{#key 'dances'}{@render screen(S.closet, { mode: 'dances' })}{/key}
  {:else if game.screen === 'shop'}{@render screen(S.shop)}
  {:else if game.screen === 'subject'}{#key game.subject}{@render screen(S.subject)}{/key}
  {:else if game.screen === 'topic'}{#key `${game.subject}:${game.topic}`}{@render screen(S.topic)}{/key}
  {:else if game.screen === 'way'}{#key `${game.subject}:${game.topic}:${game.wayId}`}{@render screen(S.way)}{/key}
  {:else if game.screen === 'progress'}{@render screen(S.progress)}
  {:else if game.screen === 'grownups'}{@render screen(S.grownups)}
  {:else if game.screen === 'mathRun'}{#key game.runKey}{@render screen(S.mathRun)}{/key}
  {:else if game.screen === 'mathResults'}{@render screen(S.mathResults)}
  {:else if game.screen === 'skillRun'}{#key game.runKey}{@render screen(S.skillRun)}{/key}
  {:else if game.screen === 'skillResults'}{@render screen(S.skillResults)}
  {:else if game.screen === 'skills'}{@render screen(S.skills)}
  {:else if game.screen === 'garden'}{@render screen(S.garden)}
  {:else if game.screen === 'playground'}{@render screen(S.playground)}
  {:else if game.screen === 'adventure'}{@render screen(S.adventure)}
  {:else if game.screen === 'battle'}{#key game.battleKey}{@render screen(S.battle)}{/key}
  {:else if game.screen === 'glimmers'}{#if game.glimmerTab === 'all'}{@render screen(S.glimmerBook)}{:else}{@render screen(S.glimmers)}{/if}
  {:else if game.screen === 'eggs'}{@render screen(S.eggs)}
  {:else if game.screen === 'learn'}{@render screen(S.learn)}
  {:else if game.screen === 'duel'}{#key game.duelKey}{@render screen(S.duel)}{/key}
  {:else if game.screen === 'rivals'}{@render screen(S.rivals)}
  {:else if game.screen === 'pizza'}{@render screen(S.pizza)}
  {:else if game.screen === 'builder'}{@render screen(S.builder)}
  {:else if game.screen === 'market'}{@render screen(S.market)}
  {:else if game.screen === 'clockrush'}{@render screen(S.clockrush)}
  {:else if game.screen === 'bench'}{@render screen(S.bench)}
  {:else if game.screen === 'shifter'}{@render screen(S.shifter)}
  {:else if game.screen === 'shapebuilder'}{@render screen(S.shapebuilder)}
  {:else if game.screen === 'smoothie'}{@render screen(S.smoothie)}
  {:else if game.screen === 'treasure'}{@render screen(S.treasure)}
  {:else if game.screen === 'showdown'}{@render screen(S.showdown)}
  {:else if game.screen === 'balance'}{@render screen(S.balance)}
  {:else if game.screen === 'drop'}{@render screen(S.drop)}
  {:else if game.screen === 'island'}{@render screen(S.island)}
  {:else if game.screen === 'arcade'}{@render screen(S.arcade)}
  {:else if game.screen === 'arcadePlay'}{#key game.arcadeKey}{@render screen(S.arcadePlay)}{/key}
  {:else if game.screen === 'ideas'}{@render screen(S.ideas)}
  {:else if game.screen === 'mystuff'}{@render screen(S.mystuff)}
  {:else if game.screen === 'about'}{@render screen(S.about)}
  {:else if game.screen === 'teach'}{@render screen(S.teach)}
  {:else if game.screen === 'classLogin'}{@render screen(S.classLogin)}
  {:else if game.screen === 'boards'}{@render screen(S.boards)}
  {:else if game.screen === 'path'}{@render screen(S.path)}
  {/if}
  {#if game.profile}{@render layer(O.ladder)}{/if}
  {#if intro}<FancyAntIntro onDone={() => (intro = false)} />{/if}
  {#if game.settingsOpen && game.profile}<div class="settings-layer">{@render layer(O.settings, { overlay: true })}</div>{/if}
  {#if game.chartLesson && game.profile}{#key game.chartLesson}{@render layer(O.chart)}{/key}{/if}
  {#if game.sheet}{@render layer(O.sheet)}{/if}
  {#if game.musicOpen}{@render layer(O.music)}{/if}
  {#if game.menuOpen && game.profile}{@render layer(O.menu)}{/if}
  {#if game.pause}{@render layer(O.pause)}{/if}
  {#if game.profile}{@render layer(O.fun)}{/if}
  {#if game.toast}<div class="toast">{game.toast}</div>{/if}
</main>

<style>
  .app { position: fixed; inset: 0; overflow: hidden; z-index: 1; }
  .stage3d { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; display: block; visibility: hidden; }
  .toast { position: fixed; left: 0; right: 0; margin: 0 auto; width: max-content; max-width: 90vw; bottom: 28px; z-index: 100; background: var(--ink); color: #fff; padding: 12px 18px; border-radius: 14px; font: 600 16px var(--font-ui); box-shadow: var(--shadow); animation: fade-up .25s ease; }
  .settings-layer { position: fixed; inset: 0; z-index: 70; animation: fade-up .2s ease; }
</style>
