<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { GAME_TAGLINE } from '../config';
  import { BUDDIES } from '../art/cast';
  import { sfx, startMusic, unlockAudio } from '../audio/sound';
  import { stage } from '../three/stage';
  import { ShowScene } from '../three/showScene';
  import GearButton from '../ui/GearButton.svelte';
  import FancyAntButton from '../ui/FancyAntButton.svelte';
  import Logo from '../ui/Logo.svelte';

  let h = $state(800);
  let w = $state(1280);
  let scene: ShowScene | null = null;
  let disposed = false;
  function go() {
    unlockAudio();
    startMusic('menu');
    sfx.whoosh();
    game.go(game.save.profiles.length ? 'players' : 'newPlayer');
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Tab') return;
    e.preventDefault();
    go();
  }
  onMount(() => {
    // everyone stands on the island under the title, waving and dancing now and then
    ShowScene.create({ buddies: BUDDIES.map(b => b.id), view: { top: 0.5, bottom: 0.97, left: 0.08, right: 0.92 }, spot: 8, orbit: true })
      .then(sc => { if (disposed) { sc.dispose(); return; } scene = sc; stage.use(sc); });
    window.addEventListener('keydown', onKey);
  });
  onDestroy(() => {
    disposed = true;
    if (scene && stage.current() === scene) stage.use(null);
    window.removeEventListener('keydown', onKey);
  });
</script>

<div class="screen title" bind:clientHeight={h} bind:clientWidth={w}>
  {#if game.profile}<GearButton floating />{/if}
  <div class="center">
    <Logo size={Math.min(78, h * 0.085)} />
    <p class="tag">{GAME_TAGLINE}</p>
    <button class="btn btn-primary btn-big play" onclick={go}>Let's play!</button>
    <div class="press">or press any key</div>
  </div>
  <footer><FancyAntButton /></footer>
</div>

<style>
  .title { background: transparent; }
  .center { position: absolute; left: 0; right: 0; top: 7%; display: flex; flex-direction: column; align-items: center; gap: 14px; z-index: 6; }
  .tag { margin: 6px 0 4px; font: 600 22px/1.2 var(--font-ui); color: var(--ink2); background: rgba(255, 255, 255, .8); padding: 6px 16px; border-radius: 999px; }
  .play { margin-top: 10px; font-size: 26px; padding: 18px 40px; animation: float-y 2.4s ease-in-out infinite; }
  .press { font: 700 14px var(--font-body); color: var(--ink2); background: rgba(255, 255, 255, .7); padding: 4px 12px; border-radius: 999px; animation: blink 1.6s ease-in-out infinite; }
  @keyframes blink { 50% { opacity: .45; } }
  footer { position: absolute; bottom: 14px; left: 0; right: 0; text-align: center; z-index: 6; }
</style>
