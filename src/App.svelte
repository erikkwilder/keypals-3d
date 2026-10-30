<script lang="ts">
  import MusicPicker from './lib/ui/MusicPicker.svelte';
  import GlobalMenu from './lib/ui/GlobalMenu.svelte';
  import { onMount } from 'svelte';
  import { game } from './lib/state/game.svelte';
  import { configureSound, startMusic, unlockAudio, setMusicStyle, setMusicStation, setPlaceStation } from './lib/audio/sound';
  import { lastWorld, stationOf } from './lib/adventure/worlds';
  import { NODE, ISLAND } from './lib/adventure/state';
  import SvgDefs from './lib/ui/SvgDefs.svelte';
  import Title from './lib/screens/Title.svelte';
  import Players from './lib/screens/Players.svelte';
  import NewPlayer from './lib/screens/NewPlayer.svelte';
  import MapScreen from './lib/screens/MapScreen.svelte';
  import Run from './lib/screens/Run.svelte';
  import Results from './lib/screens/Results.svelte';
  import Stickers from './lib/screens/Stickers.svelte';
  import Closet from './lib/screens/Closet.svelte';
  import Shop from './lib/screens/Shop.svelte';
  import { setDressSource } from './lib/three/dress';
  import { dressOf } from './lib/adventure/wardrobe';
  import SettingsScreen from './lib/screens/Settings.svelte';
  import Grownups from './lib/screens/Grownups.svelte';
  import MathMap from './lib/screens/MathMap.svelte';
  import Hub from './lib/screens/Hub.svelte';
  import Playground from './lib/screens/Playground.svelte';
  import Adventure from './lib/screens/Adventure.svelte';
  import Battle from './lib/screens/Battle.svelte';
  import PizzaRush from './lib/screens/PizzaRush.svelte';
  import NumberBuilder from './lib/screens/NumberBuilder.svelte';
  import MarketDash from './lib/screens/MarketDash.svelte';
  import ClockRush from './lib/screens/ClockRush.svelte';
  import MeasureBench from './lib/screens/MeasureBench.svelte';
  import ShapeShifter from './lib/screens/ShapeShifter.svelte';
  import ShapeBuilder from './lib/screens/ShapeBuilder.svelte';
  import SmoothieStand from './lib/screens/SmoothieStand.svelte';
  import TreasureGrid from './lib/screens/TreasureGrid.svelte';
  import SpinnerShowdown from './lib/screens/SpinnerShowdown.svelte';
  import BalanceBeam from './lib/screens/BalanceBeam.svelte';
  import Glimmers from './lib/screens/Glimmers.svelte';
  import Eggs from './lib/screens/Eggs.svelte';
  import Learn from './lib/screens/Learn.svelte';
  import Duel from './lib/screens/Duel.svelte';
  import Rivals from './lib/screens/Rivals.svelte';
  import GlimmerDrop from './lib/screens/GlimmerDrop.svelte';
  import SkyIsland from './lib/screens/SkyIsland.svelte'; // My Sky Island
  import MathRun from './lib/screens/MathRun.svelte';
  import MathResults from './lib/screens/MathResults.svelte';
  import SkillRun from './lib/screens/SkillRun.svelte';
  import SkillResults from './lib/screens/SkillResults.svelte';
  import SkillsReport from './lib/screens/SkillsReport.svelte';
  import FactGarden from './lib/screens/FactGarden.svelte';
  import Arcade from './lib/screens/Arcade.svelte';
  import ArcadePlay from './lib/screens/ArcadePlay.svelte';
  import Ideas from './lib/screens/Ideas.svelte';
  import MyStuff from './lib/screens/MyStuff.svelte';
  import About from './lib/screens/About.svelte';
  // the 100-Glimmer ladder: its book, and the special eggs' moments (looked for on the calm screens)
  import LadderMoment from './lib/ui/LadderMoment.svelte';
  import { CALM_SCREENS, lookForEggs } from './lib/adventure/ladderMoment.svelte';
  import { installProblemReports } from './lib/state/reports';
  import { countScreen, countPlayer } from './lib/state/counting';
  import { untrack } from 'svelte';
  $effect(() => { const s = game.screen, id = game.profile?.id; if (id && CALM_SCREENS.has(s)) untrack(() => setTimeout(() => { if (game.screen === s) lookForEggs(); }, 700)); });
  // counting visits (no identifiers: counts.ts): every screen opened, and each player's first visit today
  $effect(() => { const s = game.screen; untrack(() => countScreen(s)); });
  $effect(() => {
    const p = game.profile, s = game.screen;
    if (p && s !== 'title' && s !== 'players' && s !== 'newPlayer') untrack(() => countPlayer(p));
  });
  // My path, and the doors grown-ups and teachers can close (the free-time places' daily time, the path first)
  import MyPath from './lib/screens/MyPath.svelte';
  // the one way around (state/where.ts): a subject's page, a topic, a way of a topic, My stuff's pages, and
  // the one Pause card every activity opens
  import Subject from './lib/screens/Subject.svelte';
  import Topic from './lib/screens/Topic.svelte';
  import WayPage from './lib/screens/WayPage.svelte';
  import Progress from './lib/screens/Progress.svelte';
  import PauseCard from './lib/ui/PauseCard.svelte';
  import GlimmerBook from './lib/screens/GlimmerBook.svelte'; // Glimmers' All 100 tab
  import Door from './lib/path/Door.svelte';
  import { doorFor } from './lib/path/rules';
  import { freeClock, playerRules, watchFree } from './lib/path/player.svelte';
  import { loadClasses } from './lib/teach/student.svelte';
  import { cloud } from './lib/state/cloud.svelte';
  // a class player's class rules (and class work) as soon as the server answers, whatever screen is open
  $effect(() => { const on = cloud.online, id = game.profile?.id; if (on && id) untrack(() => void loadClasses(game.profile)); });
  // (a Learn episode opened over a subject page, as the market's and the clockmaker's are, is Learn)
  const door = $derived(game.profile ? doorFor((game.screen === 'map' || game.screen === 'way') && game.learnOverlay ? 'learn' : game.screen, game.closetTab, game.profile, playerRules(game.profile), Date.now(), freeClock.running) : null);
  // minutes count while a free-time place is open (not while its door is shut)
  $effect(() => { const s = game.screen, t = game.closetTab, id = game.profile?.id ?? null, shut = !!door; untrack(() => watchFree(shut ? 'hub' : s, t, id)); });
  import Teach from './lib/screens/Teach.svelte';
  import ClassLogin from './lib/screens/ClassLogin.svelte';
  import Boards from './lib/screens/Boards.svelte';
  import { startClasses } from './lib/teach/student.svelte';
  import { stage } from './lib/three/stage';
  import QuickSettings from './lib/ui/QuickSettings.svelte';
  import FunLayer from './lib/fun/FunLayer.svelte';
  import LessonChart from './lib/ui/LessonChart.svelte';
  import FancyAntIntro, { introDue } from './lib/ui/FancyAntIntro.svelte';
  // the FancyAnt film plays once a visit when the game opens (not on dev shortcuts like #run=)
  let intro = $state(!location.hash && introDue());
  import { devBoot } from './lib/state/dev';
  import { startCloud } from './lib/state/cloud.svelte';
  // every 3D buddy dresses from the player's save: its hat, everything else it has on, and its nudges
  setDressSource(b => (game.profile ? dressOf(game.profile, b) : null));

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

  let canvas: HTMLCanvasElement | undefined = $state();
  onMount(() => {
    if (canvas) stage.mount(canvas, game.settings.graphics === 'low');
    stage.onAutoSmooth = () => game.say('Switched to smooth mode so the game runs better on this computer. You can change it in Settings.', 6000);
    installProblemReports();
    devBoot();
    startCloud();
    startClasses();
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
  });
</script>

<SvgDefs />
<canvas class="stage3d" bind:this={canvas} aria-hidden="true"></canvas>
<main class="app">
  {#if door}<Door {door} />
  {:else if game.screen === 'title'}<Title />
  {:else if game.screen === 'players'}<Players />
  {:else if game.screen === 'newPlayer'}<NewPlayer />
  {:else if game.screen === 'hub'}<Hub />
  {:else if game.screen === 'map'}{#key `${game.subject}:${game.topic}`}{#if game.subject === 'typing'}<MapScreen />{:else}<MathMap />{/if}{/key}
  {:else if game.screen === 'run'}{#key game.runKey}<Run />{/key}
  {:else if game.screen === 'results'}<Results />
  {:else if game.screen === 'stickers'}<Stickers />
  {:else if game.screen === 'closet'}{#key 'wardrobe'}<Closet mode="wardrobe" />{/key}
  {:else if game.screen === 'keypals'}{#key 'keypals'}<Closet mode="keypals" />{/key}
  {:else if game.screen === 'dances'}{#key 'dances'}<Closet mode="dances" />{/key}
  {:else if game.screen === 'shop'}<Shop />
  {:else if game.screen === 'subject'}{#key game.subject}<Subject />{/key}
  {:else if game.screen === 'topic'}{#key `${game.subject}:${game.topic}`}<Topic />{/key}
  {:else if game.screen === 'way'}{#key `${game.subject}:${game.topic}:${game.wayId}`}<WayPage />{/key}
  {:else if game.screen === 'progress'}<Progress />
  {:else if game.screen === 'settings'}<SettingsScreen />
  {:else if game.screen === 'grownups'}<Grownups />
  {:else if game.screen === 'mathRun'}{#key game.runKey}<MathRun />{/key}
  {:else if game.screen === 'mathResults'}<MathResults />
  {:else if game.screen === 'skillRun'}{#key game.runKey}<SkillRun />{/key}
  {:else if game.screen === 'skillResults'}<SkillResults />
  {:else if game.screen === 'skills'}<SkillsReport />
  {:else if game.screen === 'garden'}<FactGarden />
  {:else if game.screen === 'playground'}<Playground />
  {:else if game.screen === 'adventure'}<Adventure />
  {:else if game.screen === 'battle'}{#key game.battleKey}<Battle />{/key}
  {:else if game.screen === 'glimmers'}{#if game.glimmerTab === 'all'}<GlimmerBook />{:else}<Glimmers />{/if}
  {:else if game.screen === 'eggs'}<Eggs />
  {:else if game.screen === 'learn'}<Learn />
  {:else if game.screen === 'duel'}{#key game.duelKey}<Duel />{/key}
  {:else if game.screen === 'rivals'}<Rivals />
  {:else if game.screen === 'pizza'}<PizzaRush />
  {:else if game.screen === 'builder'}<NumberBuilder />
  {:else if game.screen === 'market'}<MarketDash />
  {:else if game.screen === 'clockrush'}<ClockRush />
  {:else if game.screen === 'bench'}<MeasureBench />
  {:else if game.screen === 'shifter'}<ShapeShifter />
  {:else if game.screen === 'shapebuilder'}<ShapeBuilder />
  {:else if game.screen === 'smoothie'}<SmoothieStand />
  {:else if game.screen === 'treasure'}<TreasureGrid />
  {:else if game.screen === 'showdown'}<SpinnerShowdown />
  {:else if game.screen === 'balance'}<BalanceBeam />
  {:else if game.screen === 'drop'}<GlimmerDrop />
  {:else if game.screen === 'island'}<SkyIsland />
  {:else if game.screen === 'arcade'}<Arcade />
  {:else if game.screen === 'arcadePlay'}{#key game.arcadeKey}<ArcadePlay />{/key}
  {:else if game.screen === 'ideas'}<Ideas />
  {:else if game.screen === 'mystuff'}<MyStuff />
  {:else if game.screen === 'about'}<About />
  {:else if game.screen === 'teach'}<Teach />
  {:else if game.screen === 'classLogin'}<ClassLogin />
  {:else if game.screen === 'boards'}<Boards />
  {:else if game.screen === 'path'}<MyPath />
  {/if}
  <LadderMoment />
  {#if intro}<FancyAntIntro onDone={() => (intro = false)} />{/if}
  {#if game.settingsOpen && game.profile}<div class="settings-layer"><SettingsScreen overlay /></div>{/if}
  {#if game.chartLesson && game.profile}{#key game.chartLesson}<LessonChart />{/key}{/if}
  {#if game.sheet}<QuickSettings />{/if}
  {#if game.musicOpen}<MusicPicker />{/if}
  {#if game.menuOpen && game.profile}<GlobalMenu />{/if}
  {#if game.pause}<PauseCard />{/if}
  <FunLayer />
  {#if game.toast}<div class="toast">{game.toast}</div>{/if}
</main>

<style>
  .app { position: fixed; inset: 0; overflow: hidden; z-index: 1; }
  .stage3d { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; display: block; visibility: hidden; }
  .toast { position: fixed; left: 0; right: 0; margin: 0 auto; width: max-content; max-width: 90vw; bottom: 28px; z-index: 100; background: var(--ink); color: #fff; padding: 12px 18px; border-radius: 14px; font: 600 16px var(--font-ui); box-shadow: var(--shadow); animation: fade-up .25s ease; }
  .settings-layer { position: fixed; inset: 0; z-index: 70; animation: fade-up .2s ease; }
</style>
