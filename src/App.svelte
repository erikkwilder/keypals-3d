<script lang="ts">
  import MusicPicker from './lib/ui/MusicPicker.svelte';
  import { onMount } from 'svelte';
  import { game } from './lib/state/game.svelte';
  import { configureSound, startMusic, unlockAudio, setMusicStyle, setMusicStation } from './lib/audio/sound';
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
  import Glimmers from './lib/screens/Glimmers.svelte';
  import Eggs from './lib/screens/Eggs.svelte';
  import Learn from './lib/screens/Learn.svelte';
  import Duel from './lib/screens/Duel.svelte';
  import Rivals from './lib/screens/Rivals.svelte';
  import GlimmerDrop from './lib/screens/GlimmerDrop.svelte';
  import MathRun from './lib/screens/MathRun.svelte';
  import MathResults from './lib/screens/MathResults.svelte';
  import SkillRun from './lib/screens/SkillRun.svelte';
  import SkillResults from './lib/screens/SkillResults.svelte';
  import SkillsReport from './lib/screens/SkillsReport.svelte';
  import FactGarden from './lib/screens/FactGarden.svelte';
  import Arcade from './lib/screens/Arcade.svelte';
  import ArcadePlay from './lib/screens/ArcadePlay.svelte';
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
    if (!['mathRun', 'skillRun', 'playground', 'battle', 'duel', 'drop', 'arcadePlay', 'pizza'].includes(scr) || !game.profile || game.profile.soundSetup || game.sheet) return;
    setTimeout(() => { if (game.screen === scr && game.profile && !game.profile.soundSetup && !game.sheet) game.openSheet('setup'); }, 300);
  });

  // menu music on the screens around the lessons; Adventure's own on its screens and the Arcade's (Auto
  // plays an adventure there; a picked station just keeps playing)
  const ADVENTURE_SCREENS = new Set(['adventure', 'battle', 'duel', 'rivals', 'glimmers', 'eggs', 'drop', 'arcade', 'arcadePlay', 'pizza']);
  $effect(() => {
    const scr = game.screen;
    if (scr !== 'run' && scr !== 'mathRun' && scr !== 'skillRun' && scr !== 'title') startMusic(ADVENTURE_SCREENS.has(scr) ? 'adventure' : 'menu');
  });

  let canvas: HTMLCanvasElement | undefined = $state();
  onMount(() => {
    if (canvas) stage.mount(canvas, game.settings.graphics === 'low');
    stage.onAutoSmooth = () => game.say('Switched to smooth mode so the game runs better on this computer. You can change it in Settings.', 6000);
    devBoot();
    startCloud();
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
  });
</script>

<SvgDefs />
<canvas class="stage3d" bind:this={canvas} aria-hidden="true"></canvas>
<main class="app">
  {#if game.screen === 'title'}<Title />
  {:else if game.screen === 'players'}<Players />
  {:else if game.screen === 'newPlayer'}<NewPlayer />
  {:else if game.screen === 'hub'}<Hub />
  {:else if game.screen === 'map'}{#if game.homeGame === 'math'}<MathMap />{:else}<MapScreen />{/if}
  {:else if game.screen === 'run'}{#key game.runKey}<Run />{/key}
  {:else if game.screen === 'results'}<Results />
  {:else if game.screen === 'stickers'}<Stickers />
  {:else if game.screen === 'closet'}<Closet />
  {:else if game.screen === 'shop'}<Shop />
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
  {:else if game.screen === 'glimmers'}<Glimmers />
  {:else if game.screen === 'eggs'}<Eggs />
  {:else if game.screen === 'learn'}<Learn />
  {:else if game.screen === 'duel'}{#key game.duelKey}<Duel />{/key}
  {:else if game.screen === 'rivals'}<Rivals />
  {:else if game.screen === 'pizza'}<PizzaRush />
  {:else if game.screen === 'drop'}<GlimmerDrop />
  {:else if game.screen === 'arcade'}<Arcade />
  {:else if game.screen === 'arcadePlay'}{#key game.arcadeKey}<ArcadePlay />{/key}
  {/if}
  {#if intro}<FancyAntIntro onDone={() => (intro = false)} />{/if}
  {#if game.settingsOpen && game.profile}<div class="settings-layer"><SettingsScreen overlay /></div>{/if}
  {#if game.chartLesson && game.profile}{#key game.chartLesson}<LessonChart />{/key}{/if}
  {#if game.sheet}<QuickSettings />{/if}
  {#if game.musicOpen}<MusicPicker />{/if}
  <FunLayer />
  {#if game.toast}<div class="toast">{game.toast}</div>{/if}
</main>

<style>
  .app { position: fixed; inset: 0; overflow: hidden; z-index: 1; }
  .stage3d { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; display: block; visibility: hidden; }
  .toast { position: fixed; left: 0; right: 0; margin: 0 auto; width: max-content; max-width: 90vw; bottom: 28px; z-index: 100; background: var(--ink); color: #fff; padding: 12px 18px; border-radius: 14px; font: 600 16px var(--font-ui); box-shadow: var(--shadow); animation: fade-up .25s ease; }
  .settings-layer { position: fixed; inset: 0; z-index: 70; animation: fade-up .2s ease; }
</style>
