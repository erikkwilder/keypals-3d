<script lang="ts">
  import { onMount } from 'svelte';
  import { game } from './lib/state/game.svelte';
  import { configureSound, startMusic, unlockAudio, setMusicStyle } from './lib/audio/sound';
  import SvgDefs from './lib/ui/SvgDefs.svelte';
  import Title from './lib/screens/Title.svelte';
  import Players from './lib/screens/Players.svelte';
  import NewPlayer from './lib/screens/NewPlayer.svelte';
  import MapScreen from './lib/screens/MapScreen.svelte';
  import Run from './lib/screens/Run.svelte';
  import Results from './lib/screens/Results.svelte';
  import Stickers from './lib/screens/Stickers.svelte';
  import Closet from './lib/screens/Closet.svelte';
  import SettingsScreen from './lib/screens/Settings.svelte';
  import Grownups from './lib/screens/Grownups.svelte';
  import MathMap from './lib/screens/MathMap.svelte';
  import Hub from './lib/screens/Hub.svelte';
  import Playground from './lib/screens/Playground.svelte';
  import Adventure from './lib/screens/Adventure.svelte';
  import Battle from './lib/screens/Battle.svelte';
  import Glimmers from './lib/screens/Glimmers.svelte';
  import Eggs from './lib/screens/Eggs.svelte';
  import MathRun from './lib/screens/MathRun.svelte';
  import MathResults from './lib/screens/MathResults.svelte';
  import FactGarden from './lib/screens/FactGarden.svelte';
  import { stage } from './lib/three/stage';
  import QuickSettings from './lib/ui/QuickSettings.svelte';
  import LessonChart from './lib/ui/LessonChart.svelte';
  import FancyAntIntro from './lib/ui/FancyAntIntro.svelte';
  // the FancyAnt hello plays once when the game opens (not on dev shortcuts like #run=)
  let intro = $state(!location.hash);
  import { devBoot } from './lib/state/dev';
  import { startCloud } from './lib/state/cloud.svelte';

  $effect(() => {
    const s = game.settings;
    const root = document.documentElement;
    root.dataset.look = s.look;
    root.dataset.font = s.font;
    root.dataset.motion = s.reducedMotion ? 'reduced' : 'full';
    configureSound({ sound: s.sound, music: s.music, volume: s.volume });
    setMusicStyle(s.musicStyle ?? 'sunny');
  });

  // menu music on the screens around the lessons
  $effect(() => {
    const scr = game.screen;
    if (scr !== 'run' && scr !== 'mathRun' && scr !== 'title') startMusic('menu');
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
  {:else if game.screen === 'settings'}<SettingsScreen />
  {:else if game.screen === 'grownups'}<Grownups />
  {:else if game.screen === 'mathRun'}{#key game.runKey}<MathRun />{/key}
  {:else if game.screen === 'mathResults'}<MathResults />
  {:else if game.screen === 'garden'}<FactGarden />
  {:else if game.screen === 'playground'}<Playground />
  {:else if game.screen === 'adventure'}<Adventure />
  {:else if game.screen === 'battle'}{#key game.battleKey}<Battle />{/key}
  {:else if game.screen === 'glimmers'}<Glimmers />
  {:else if game.screen === 'eggs'}<Eggs />
  {/if}
  {#if intro}<FancyAntIntro onDone={() => (intro = false)} />{/if}
  {#if game.settingsOpen && game.profile}<div class="settings-layer"><SettingsScreen overlay /></div>{/if}
  {#if game.chartLesson && game.profile}{#key game.chartLesson}<LessonChart />{/key}{/if}
  {#if game.sheet}<QuickSettings />{/if}
  {#if game.toast}<div class="toast">{game.toast}</div>{/if}
</main>

<style>
  .app { position: fixed; inset: 0; overflow: hidden; z-index: 1; }
  .stage3d { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; display: block; visibility: hidden; }
  .toast { position: fixed; left: 0; right: 0; margin: 0 auto; width: max-content; max-width: 90vw; bottom: 28px; z-index: 100; background: var(--ink); color: #fff; padding: 12px 18px; border-radius: 14px; font: 600 16px var(--font-ui); box-shadow: var(--shadow); animation: fade-up .25s ease; }
  .settings-layer { position: fixed; inset: 0; z-index: 70; animation: fade-up .2s ease; }
</style>
